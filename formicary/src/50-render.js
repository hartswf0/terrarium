/* ============================================================
   50-render.js — THE NEST.  OWNER: FIELD.
   FZ.render = { init(canvas), resize(w,h), draw(S) }

   CIVIC NATURALISM (AESTHETIC.md) governs this file. It is a cutaway ant farm:
   soil, excavated chambers, tunnels, ants with bodies, brood, stores, debris,
   scars and weather. The whole point of the rewrite is AESTHETIC.md §9, the
   information migration table — every row of it is a sentence somebody else had
   to write and no longer does:

     colour -> family        incident marks and chamber pigment, never ant colour
     shape  -> institution   a charter is a stone ring, a ledger is a tally wall
     motion -> severity      awkward, then queueing, then collisions, then spills
     density-> workload      a chamber visibly overwhelmed with bodies
     architecture-> history  every successful intervention CARVES the nest, forever
     wear   -> memory        misses collapse the tunnel and leave rubble and stains
     idle:7 -> behaviour     seven ants visibly wandering, antennae down, no load
     charts -> trails        pheromone laid by real feet, invisible without a lens
     meters -> weather       flooding, frantic grit, darkness, drained variety

   MATERIAL tones (paper/sand/soil/ink) are the world and never mean anything.
   The four SIGNAL colours appear ONLY when they mean something:
     teal  an institution is holding      amber  this is asking for you
     red   damage landed / a scar         blue   information, trail, what is known
   Every tint is globalAlpha over a palette literal, so no derived colour exists.

   S is read, never written. No two-letter element code is ever drawn here.
   ============================================================ */
FZ.render = (function () {
  'use strict';

  var MAT = {
    paper: '#f5efe3', paper2: '#e9e0cd', sand: '#e2d3b4', sand2: '#d3bf99',
    soil: '#9d5130', soil2: '#82401f', soil3: '#6b3318', ink: '#17150f', ink2: '#4a4335'
  };
  var SIG = { teal: '#19e6c8', amber: '#ffd23f', red: '#ff2e2e', blue: '#3b82f6' };
  var TAU = Math.PI * 2;
  var DS = 0.5;                       /* mask layers run at half resolution */

  var cv = null, ctx = null, dpr = 1, W = 360, H = 560;
  var nest = null, nx = null;         /* composited earth: soil + excavation + memory */
  var dig = null, dx = null;          /* the excavation mask — ants carve it as they walk */
  var trail = null, tx = null;        /* pheromone */
  var mem = null, mx = null;          /* permanent memory: scars, stamps, stains */
  var mix = null, mxx = null;         /* scratch for masking */
  var earth = null, floor2 = null, vign = null;  /* painted once: earth, floor, darkness */
  var wired = false, now = 0, lastNow = 0, sx = 1, sy = 1, frames = 0, nestDirty = true;
  var fit = 1, fitShown = -1, MINFIT = 0.58;   /* how much room the action bar needs */
  var L = null;                       /* the nest layout */
  var beats = [];
  var bodies = new Map();             /* per-ant render memory: heading, gait, wobble */
  var agentIx = new Map(), jobIx = new Map();
  var drawn = new Map();              /* id -> where the body is really standing */
  var peak = new Map(), hurtAt = new Map(), doneAt = new Map();
  var gimg = new Map();
  var stamped = new Set();            /* charters already carved into the nest */
  var compWas = new Map();            /* which chambers had no way in last frame */
  var lastTick = -1, floodMark = 0, spursMade = false, lastDial = null, joins = 0;

  /* ---------------------------------------------------------- tiny helpers */
  function A(a) { ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a; }
  function X(v) { return v * sx; }
  function Y(v) { return v * sy; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(i) { var t = Math.sin(i * 127.1 + 311.7) * 43758.5453; return t - Math.floor(t); }
  function ring(x, y, r, col, lw, a) {
    if (r <= 0) return;
    A(a); ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  function line(x1, y1, x2, y2, col, lw, a) {
    A(a); ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function dot(x, y, r, col, a) {
    A(a); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  /* four corner marks — the instrumentation register saying "this, here" */
  function brackets(g, x, y, r, len, col, lw, a) {
    g.globalAlpha = clamp(a, 0, 1); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'butt';
    var d = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (var i = 0; i < 4; i++) {
      var ox = d[i][0] * r, oy = d[i][1] * r;
      g.beginPath();
      g.moveTo(x + ox - d[i][0] * len, y + oy);
      g.lineTo(x + ox, y + oy);
      g.lineTo(x + ox, y + oy - d[i][1] * len);
      g.stroke();
    }
  }
  function taught(sym) {
    var e = (window.FZ && FZ.sim) ? FZ.sim.enabled : null;
    if (!e || typeof e.has !== 'function') return true;
    return e.has(sym);
  }
  /* where a body is drawn — its place in the nest, not its abstract coordinate */
  function AX(a) { var d = a ? drawn.get(a.id) : null; return d ? d.x : a ? X(a.x) : 0; }
  function AY(a) { var d = a ? drawn.get(a.id) : null; return d ? d.y : a ? Y(a.y) : 0; }
  function idsOf(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v.forEach === 'function') { var o = []; v.forEach(function (x) { o.push(x); }); return o; }
    return [];
  }
  function angLerp(a, b, k) {
    var d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return a + d * k;
  }
  /* an irregular hand-drawn blob — nothing in the colony is a perfect circle */
  function blobPath(g, x, y, r, seed, wob) {
    var n = clamp(Math.round(r / 1.7), 14, 40);
    g.beginPath();
    for (var i = 0; i <= n; i++) {
      var an = (i / n) * TAU;
      var rr = r * (1 - wob + wob * 2 * hash(seed * 7.3 + i * 1.7));
      var px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.92;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  /* ------------------------------------------------------- primitive glyphs
     Reused only as archaeological notation: the mark a landed failure leaves
     scratched into the wall, in ink, forever. Never as a code the player reads. */
  function glyph(sym, col) {
    var k = sym + '|' + col;
    var rec = gimg.get(k);
    if (rec) return rec.ok && rec.img.complete && rec.img.naturalWidth ? rec.img : null;
    var el = (window.FZ && FZ.ELBY) ? FZ.ELBY[sym] : null;
    var raw = el && el.glyph ? String(el.glyph) : '';
    var m = raw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    var inner = m ? m[1] : '';
    if (!inner) { gimg.set(k, { ok: false, img: null }); return null; }
    inner = inner.replace(/currentColor/g, col);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 20 20"' +
      ' fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">' +
      inner + '</svg>';
    var img = new Image();
    var r = { ok: true, img: img };
    img.onerror = function () { r.ok = false; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    gimg.set(k, r);
    return null;
  }
  function warm() {
    if (!window.FZ || !FZ.EL) return;
    for (var i = 0; i < FZ.EL.length; i++) glyph(FZ.EL[i].sym, MAT.ink);
  }

  /* ===================================== THE COLONY MAKES ROOM FOR THE ACTION
     The action bar is fixed to the floor of the screen and lies over the
     colony. When it appears it can sit exactly on top of the bodies that ARE
     the incident — the queue wedged in the passage, the pile at the doorway —
     at the very moment the player is being asked to look down and read them.

     So the nest gets out of the way. Once a frame we measure the height left
     above the bar and ease the WHOLE world — soil, tunnels, chambers, dig
     faces, spoil, crumbs, ants, incident grounds, scars, flood, every mark in
     this file — into that height with one uniform scale, over about a quarter
     of a second, so the colony is visibly making room rather than jumping.

     The scale is applied to the canvas ELEMENT, not to the drawing, and that
     is the whole trick. getBoundingClientRect reports the transformed box, so
     CONTROLS' tap mapping and the DOM paper tag follow the world exactly
     without a line changing anywhere else; clientWidth is a layout metric and
     ignores transforms, so nothing reflows, boot never re-sizes the field, and
     the excavation the colony has dug is never thrown away. */
  var barAt = 0, barWas = 1;
  function fitWant() {
    if (!cv || !(H > 0)) return 1;
    var el = document.getElementById('act');
    var r = (el && el.firstChild) ? el.getBoundingClientRect() : null;
    if (r && r.height) {
      var c = cv.getBoundingClientRect();
      barAt = now;
      barWas = clamp((r.top - c.top - 10) / H, MINFIT, 1);
      return barWas;
    }
    /* one decision closing and the next opening a moment later must not make the
       colony bob up and down. It stays stood back until the asking has stopped. */
    return (now - barAt < 900) ? barWas : 1;
  }
  function fitStep(dt) {
    var want = fitWant();
    if (fitShown < 0) fit = want;
    else {
      fit += (want - fit) * (1 - Math.exp(-clamp(dt, 0, 140) / 90));
      if (Math.abs(want - fit) < 0.0015) fit = want;
    }
    if (Math.abs(fit - fitShown) < 0.0012) return;
    fitShown = fit;
    cv.style.transformOrigin = '50% 0%';
    cv.style.transform = fit > 0.999 ? 'none' : 'scale(' + fit.toFixed(4) + ')';
  }

  /* ============================================================ THE LAYERS */
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  /* The unexcavated earth and the excavated floor never change within a run, so
     both are painted once here. Per frame the nest is only two mask composites,
     which is what keeps a phone at sixty. */
  function allocate() {
    nest = mk(W, H); nx = nest.getContext('2d');
    mix = mk(W, H); mxx = mix.getContext('2d');
    mem = mk(W, H); mx = mem.getContext('2d');
    dig = mk(W * DS, H * DS); dx = dig.getContext('2d');
    trail = mk(W * DS, H * DS); tx = trail.getContext('2d');
    earth = mk(W, H); floor2 = mk(W, H); vign = mk(W, H);
    paintEarth(earth.getContext('2d'));
    paintFloor(floor2.getContext('2d'));
    paintVignette(vign.getContext('2d'));
    L = null; nestDirty = true; stamped.clear(); spursMade = false;
  }
  function paintEarth(g) {
    var lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, MAT.soil3);
    lg.addColorStop(0.1, MAT.soil2);
    lg.addColorStop(0.34, MAT.soil);
    lg.addColorStop(0.68, MAT.soil2);
    lg.addColorStop(1, MAT.soil3);
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    /* strata: earth is layered, and layers make a cutaway read as a cutaway */
    var st, xx, yy;
    for (st = 0; st < 5; st++) {
      var sy2 = H * (0.16 + st * 0.19) + hash(st * 6.1) * 20;
      g.globalAlpha = 0.16; g.strokeStyle = MAT.soil3; g.lineWidth = 2 + hash(st) * 5;
      g.beginPath();
      for (xx = 0; xx <= W; xx += 14) {
        yy = sy2 + Math.sin(xx * 0.012 + st) * 7 + hash(xx + st * 3) * 3;
        if (xx === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.stroke();
    }
    var n = Math.round((W * H) / 620);
    for (var i = 0; i < n; i++) {
      g.globalAlpha = 0.1 + hash(i * 8.3) * 0.28;
      g.fillStyle = i % 3 ? MAT.soil3 : MAT.sand2;
      g.beginPath();
      g.arc(hash(i * 3.1) * W, hash(i * 5.7 + 9) * H, 0.6 + hash(i * 2.2) * 1.5, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  function paintFloor(g) {
    g.fillStyle = MAT.sand; g.fillRect(0, 0, W, H);
    var m = Math.round((W * H) / 900);
    for (var j = 0; j < m; j++) {
      g.globalAlpha = 0.14 + hash(j * 7.1) * 0.3;
      g.fillStyle = j % 4 ? MAT.sand2 : MAT.ink2;
      g.beginPath();
      g.arc(hash(j * 4.4 + 3) * W, hash(j * 6.6 + 1) * H, 0.6 + hash(j * 1.9) * 1.3, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  function wipeMemory() {
    if (!dx) return;
    dx.setTransform(1, 0, 0, 1, 0, 0); dx.globalCompositeOperation = 'source-over';
    dx.globalAlpha = 1; dx.clearRect(0, 0, dig.width, dig.height);
    tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over';
    tx.globalAlpha = 1; tx.clearRect(0, 0, trail.width, trail.height);
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.globalCompositeOperation = 'source-over';
    mx.globalAlpha = 1; mx.clearRect(0, 0, W, H);
    beats.length = 0; bodies.clear(); peak.clear(); hurtAt.clear(); doneAt.clear();
    stamped.clear(); compWas.clear(); joins = 0;
    floodMark = 0; spursMade = false; L = null; nestDirty = true;
  }

  /* ------------------------------------------------------------ excavation */
  function carve(x, y, r, a) {
    dx.globalCompositeOperation = 'source-over';
    dx.globalAlpha = clamp(a, 0, 1); dx.fillStyle = '#ffffff';
    dx.beginPath(); dx.arc(x * DS, y * DS, r * DS, 0, TAU); dx.fill();
    dx.globalAlpha = 1;
  }
  function collapseAt(x, y, r) {
    dx.globalCompositeOperation = 'destination-out';
    dx.globalAlpha = 0.85; dx.fillStyle = '#000000';
    dx.beginPath(); dx.arc(x * DS, y * DS, r * DS, 0, TAU); dx.fill();
    dx.globalCompositeOperation = 'source-over'; dx.globalAlpha = 1;
    nestDirty = true;
  }
  function carveChamber(x, y, r, seed) {
    dx.globalCompositeOperation = 'source-over';
    dx.globalAlpha = 1; dx.fillStyle = '#ffffff';
    dx.save(); dx.scale(DS, DS);
    blobPath(dx, x, y, r, seed, 0.2); dx.fill();
    dx.restore();
    nestDirty = true;
  }

  /* ==================================================== THE MOVEMENT GRAPH
     CONTRACT §16. SIM publishes the nest as `S.nest` — chambers, junctions and
     tunnels, with occupancy, queues, dig progress and wear on every one of them
     — and writes every body's x,y from it. There is no fifth state and no soil
     position, so FIELD's only job here is to DRAW THAT TRUTH and never invent a
     second geometry beside it. A tunnel is the straight run between two node
     centres, because that is exactly the line the bodies walk down.

     What used to be here was a private layout of the renderer's own, which is
     precisely how the round-3 build ended up with a beautiful drawn network the
     ants ignored. Nothing in this file may describe the nest except S.nest. */

  function nestOf(S) { return (S && S.nest && S.nest.nodes && S.nest.nodes.length) ? S.nest : null; }
  function layoutSig(S) {
    var N = nestOf(S);
    return W + 'x' + H + '|' + (N ? N.ver + '|' + N.nodes.length + '|' + N.edges.length : 'none');
  }
  /* the width of a passage is the width of what has to get down it: a lateral
     passes one body, the spine and the shaft pass two */
  function edgeW(e) { return e.cap > 1 ? 15 : 11; }
  /* a chamber is a ROOM. It is drawn wider than the packing radius SIM uses,
     because a room a body only just fits in is a pipe, and the difference
     between a pipe and a room is the whole of "this place is crowded". */
  function nodeR(n) {
    var k = n.kind;
    return n.r * (k === 'queen' ? 1.75 : k === 'chamber' || k === 'store' ? 1.6 : 1.3);
  }
  /* how far a face has come, in field px from the end it is being cut from */
  function digFrom(e, S) {
    var A = S.agents || [];
    for (var i = 0; i < A.length; i++) {
      if (A[i].digE === e.id && A[i].digFrom != null) return A[i].digFrom;
    }
    return e.a;
  }
  function carveEdge(le, t0, t1) {
    if (t1 <= t0 + 0.001) return;
    var a = le.A, b = le.B;
    dx.globalCompositeOperation = 'source-over';
    dx.globalAlpha = 1; dx.strokeStyle = '#ffffff'; dx.fillStyle = '#ffffff';
    dx.lineCap = 'round'; dx.lineJoin = 'round';
    dx.save(); dx.scale(DS, DS);
    /* the centreline is exactly the line the bodies walk; only the walls are
       rough, because earth is rough and a drawn straight edge is a corridor */
    var vx = b.x - a.x, vy = b.y - a.y, vl = Math.sqrt(vx * vx + vy * vy) || 1;
    var px2 = -vy / vl, py2 = vx / vl;
    var steps = clamp(Math.round(le.len * (t1 - t0) / 9), 1, 40);
    for (var i = 0; i < steps; i++) {
      var u0 = t0 + (t1 - t0) * (i / steps), u1 = t0 + (t1 - t0) * ((i + 1) / steps);
      dx.lineWidth = le.w * (0.9 + hash(le.id * 5.7 + i) * 0.3);
      dx.beginPath();
      dx.moveTo(a.x + vx * u0, a.y + vy * u0);
      dx.lineTo(a.x + vx * u1, a.y + vy * u1);
      dx.stroke();
      /* earth does not cut straight. The centreline is exactly the walked line,
         but the walls are bitten out either side of it. */
      var off = (hash(le.id * 2.9 + i * 1.7) - 0.5) * le.w * 0.8;
      dx.beginPath();
      dx.arc(a.x + vx * u1 + px2 * off, a.y + vy * u1 + py2 * off,
        le.w * (0.26 + hash(le.id + i * 3.1) * 0.2), 0, TAU);
      dx.fill();
    }
    dx.restore();
    nestDirty = true;
  }
  /* whatever the graph says exists and the earth does not yet show, cut it now.
     This is what makes digging watchable: the face moves a little each frame
     and the tunnel behind it is permanently longer than it was. */
  function carveOpen(le, S) {
    var e = le.ref;
    var want = e.dug ? 1 : clamp(e.prog || 0, 0, 1) * 0.96;
    if (want > le.cut + 0.004) {
      var from = e.dug ? le.from : digFrom(e, S);
      le.from = from;
      if (from === e.b) carveEdge(le, 1 - want, 1 - le.cut);
      else carveEdge(le, le.cut, want);
      le.cut = want;
    }
    /* WEAR IS ARCHITECTURE, NOT AN OVERLAY. The road the whole colony chooses
       gets physically wider and smoother, and the ones beside it stay narrow.
       One bright road with cold ones next to it is Cf and Im, drawn in earth. */
    if (!e.dug) return;
    var wr = clamp(e.wear || 0, 0, 1);
    var step = Math.floor(wr * 4);
    if (step > (le.worn || 0)) {
      le.worn = step;
      var keep = le.w;
      le.w = keep * (1 + step * 0.1);
      carveEdge(le, 0, 1);
      le.w = keep;
    }
  }
  function buildLayout(S) {
    var N = nestOf(S);
    var seed = (S.seed || 1) % 997;
    var i, n, e;
    var oldCut = {};
    if (L) for (i = 0; i < L.edges.length; i++) oldCut[L.edges[i].id] = L.edges[i].cut;

    var nodes = [], edges = [];
    var entry = null, queen = null, store = null;
    if (N) {
      for (i = 0; i < N.nodes.length; i++) {
        n = N.nodes[i];
        var ln = {
          x: X(n.x), y: Y(n.y), r: Math.max(9, n.r * sx),
          rr: Math.max(11, nodeR(n) * sx), kind: n.kind, id: n.id, ref: n
        };
        nodes.push(ln);
        if (n.kind === 'surface' && !entry) entry = ln;
        if (n.kind === 'queen' && !queen) queen = ln;
        if (n.kind === 'store' && !store) store = ln;
      }
      for (i = 0; i < N.edges.length; i++) {
        e = N.edges[i];
        var A2 = nodes[e.a], B2 = nodes[e.b];
        if (!A2 || !B2) continue;
        edges.push({
          id: e.id, A: A2, B: B2, a: e.a, b: e.b, ref: e, w: edgeW(e),
          len: Math.sqrt((A2.x - B2.x) * (A2.x - B2.x) + (A2.y - B2.y) * (A2.y - B2.y)) || 1,
          cut: oldCut[e.id] || 0, from: e.a
        });
      }
    }
    if (!entry) entry = nodes[0] || { x: W * 0.5, y: 12, r: 11, kind: 'surface' };
    if (!queen) queen = nodes[nodes.length - 1] || entry;
    if (!store) store = queen;

    L = { nodes: nodes, edges: edges, entry: entry, queen: queen, store: store, seed: seed, sig: layoutSig(S), spurs: [] };

    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].kind === 'surface') continue;
      carveChamber(nodes[i].x, nodes[i].y, nodes[i].rr, seed + i * 3);
    }
    /* the shaft head breaks the crust */
    carveEdge({ A: { x: entry.x, y: -10 }, B: { x: entry.x, y: entry.y + 4 }, len: entry.y + 14, w: 16, id: 909 }, 0, 1);
    for (i = 0; i < edges.length; i++) carveOpen(edges[i], S);
  }
  function refreshNest(S) {
    if (!L) return;
    var i;
    for (i = 0; i < L.edges.length; i++) carveOpen(L.edges[i], S);
    /* A ROOM THAT KEEPS BEING OVERFULL GETS DUG OUT BIGGER. Density is the
       workload meter, so the chamber has to be able to show density — and a
       chamber that was once packed stays enlarged, which is the colony's own
       record of where the pressure was. */
    for (i = 0; i < L.nodes.length; i++) {
      var n = L.nodes[i], ref = n.ref;
      if (!ref || ref.kind === 'surface') continue;
      var over = (ref.occ ? ref.occ.length : 0) - (ref.cap || 4);
      if (over <= 0) continue;
      var step = Math.min(4, over);
      if (step <= (n.grown || 0)) continue;
      n.grown = step;
      n.rr = Math.max(n.rr, Math.max(11, nodeR(ref) * sx) * (1 + step * 0.15));
      carveChamber(n.x, n.y, n.rr, L.seed + i * 3 + step);
    }
  }

  /* ------------------------------------------------------- reading the nest */
  function edgePt(le, t) {
    return { x: le.A.x + (le.B.x - le.A.x) * t, y: le.A.y + (le.B.y - le.A.y) * t };
  }
  /* the nearest place in the nest to a point, used only to pull a body that
     crowding has nudged at a wall back inside the passage it is really in */
  function snapIn(x, y) {
    if (!L || !L.nodes.length) return { x: x, y: y };
    var i, n, d;
    for (i = 0; i < L.nodes.length; i++) {
      n = L.nodes[i];
      d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < n.rr * n.rr * 0.86) return { x: x, y: y };
    }
    var bx = x, by = y, bd = Infinity, hw = 5;
    for (i = 0; i < L.edges.length; i++) {
      var le = L.edges[i];
      if (!le.ref.dug) continue;
      var vx = le.B.x - le.A.x, vy = le.B.y - le.A.y, l2 = vx * vx + vy * vy || 1;
      var t = clamp(((x - le.A.x) * vx + (y - le.A.y) * vy) / l2, 0, 1);
      var qx = le.A.x + vx * t, qy = le.A.y + vy * t;
      d = (qx - x) * (qx - x) + (qy - y) * (qy - y);
      if (d < bd) { bd = d; bx = qx; by = qy; hw = le.w * 0.3; }
    }
    var dl = Math.sqrt(bd);
    if (dl <= hw) return { x: x, y: y };
    if (dl < 0.001) return { x: bx, y: by };
    return { x: bx + (x - bx) / dl * hw, y: by + (y - by) / dl * hw };
  }
  /* no two bodies on top of each other. Sixteen CSS px of daylight is the whole
     difference between a crowd a player can count and one black clot. */
  var SEP = 17;
  function spread(list, sc, burn) {
    var mind = SEP * clamp(sc, 0.82, 1.15), i, j, k;
    for (k = 0; k < 7; k++) {
      for (i = 0; i < list.length; i++) {
        for (j = i + 1; j < list.length; j++) {
          var P = list[i], Q = list[j];
          var ddx = Q.x - P.x, ddy = Q.y - P.y;
          var d2 = ddx * ddx + ddy * ddy;
          var lim = (burn && (burn.has(P.id) || burn.has(Q.id))) ? mind * 1.12 : mind;
          if (d2 > lim * lim) continue;
          var d = Math.sqrt(d2);
          if (d < 0.05) { ddx = Math.cos(P.id * 2.3); ddy = Math.sin(P.id * 2.3); d = 1; }
          var pushd = (lim - d) * 0.5;
          P.x -= ddx / d * pushd; P.y -= ddy / d * pushd;
          Q.x += ddx / d * pushd; Q.y += ddy / d * pushd;
        }
      }
      /* put everybody back inside the nest between passes, so the next pass
         resolves the crowd in the space that actually exists rather than in
         open air that then collapses back into a clot */
      for (i = 0; i < list.length; i++) {
        var it = list[i];
        var ex = it.x - it.ox, ey = it.y - it.oy;
        var dm = Math.sqrt(ex * ex + ey * ey);
        if (dm > 28) { it.x = it.ox + ex / dm * 28; it.y = it.oy + ey / dm * 28; }
        if (dm > 0.4) { var sn = snapIn(it.x, it.y); it.x = sn.x; it.y = sn.y; }
      }
    }
  }

  /* ---------------------------------------------------------- the dig faces
     A face is watchable. The earth ahead is freshly broken, the spoil piles at
     the mouth behind, and the tunnel is longer every time you look. A face with
     nobody on it is a plan the colony has stopped paying for. */
  function drawFaces(S) {
    if (!L) return;
    for (var i = 0; i < L.edges.length; i++) {
      var le = L.edges[i], e = le.ref;
      if (e.dug) continue;
      var pr = clamp(e.prog || 0, 0, 1) * 0.96;
      var from = le.from;
      var t = from === e.b ? 1 - pr : pr;
      var f = edgePt(le, t);
      var mouth = edgePt(le, from === e.b ? 1 : 0);
      var ang = Math.atan2(le.B.y - le.A.y, le.B.x - le.A.x) + (from === e.b ? Math.PI : 0);
      var live = e.diggers && e.diggers.length;
      var hw = le.w * 0.78;
      /* THE NEW GROUND. The last stretch behind the face was earth a moment ago
         and is still pale with it, so the tunnel is visibly longer every time
         the player looks back at it. */
      if (pr > 0.02) {
        var back = clamp(26 / le.len, 0.02, 1);
        var t0 = from === e.b ? t : Math.max(0, t - back);
        var t1 = from === e.b ? Math.min(1, t + back) : t;
        A(live ? 0.5 : 0.22); ctx.strokeStyle = MAT.sand;
        ctx.lineWidth = le.w * 0.72; ctx.lineCap = 'round';
        var p0 = edgePt(le, t0), p1 = edgePt(le, t1);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(ang);
      /* THE FACE. A wall of broken earth across the whole passage, wider than
         the passage, so it reads as the end of the world rather than a smudge.
         It advances every second somebody is cutting at it. */
      A(0.97); ctx.fillStyle = MAT.soil3;
      ctx.beginPath();
      ctx.moveTo(-2, -hw);
      for (var q = -1; q <= 1.001; q += 0.2) {
        ctx.lineTo(2 + hash(le.id * 3.3 + q * 5 + Math.floor(pr * 18)) * 7, q * hw);
      }
      ctx.lineTo(-2, hw); ctx.closePath(); ctx.fill();
      /* the freshly cut lip: earth opened a moment ago is bright */
      A(live ? 0.8 : 0.35); ctx.strokeStyle = MAT.sand2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-2, -hw * 0.86); ctx.lineTo(-2, hw * 0.86); ctx.stroke();
      /* pick marks: the tool at work, or the stillness of a face nobody pays for */
      A(live ? 0.7 : 0.25); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.1;
      for (var m = -1; m <= 1; m++) {
        var jit = live ? Math.sin(now * 0.02 + m * 2 + le.id) * 2.2 : 0;
        ctx.beginPath();
        ctx.moveTo(1.5 + jit, m * hw * 0.45); ctx.lineTo(5.5 + jit, m * hw * 0.45 + (m ? 1.4 : -1.4));
        ctx.stroke();
      }
      /* earth coming off the face right now */
      if (live) {
        A(0.85); ctx.fillStyle = MAT.sand2;
        for (var c2 = 0; c2 < 4; c2++) {
          var ph2 = ((now * 0.004 + c2 * 0.25 + le.id * 0.13) % 1);
          ctx.beginPath();
          ctx.ellipse(-2 - ph2 * 16, (hash(le.id + c2) - 0.5) * hw * 1.2 + ph2 * 3,
            1.8 * (1 - ph2 * 0.5), 1.4, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      /* THE SPOIL. What has come out is heaped at the mouth and it stays there:
         a tunnel you can see was dug, by somebody, at a cost. */
      var heap = clamp(pr * 1.4 + (e.spoil || 0), 0.06, 1);
      var mo = Math.atan2(f.y - mouth.y, f.x - mouth.x);
      ctx.save();
      ctx.translate(mouth.x + Math.cos(mo) * 5, mouth.y + Math.sin(mo) * 5);
      ctx.rotate(mo);
      A(0.9); ctx.fillStyle = MAT.sand2;
      ctx.beginPath();
      ctx.moveTo(-6, hw * 0.9);
      ctx.quadraticCurveTo(0, hw * 0.9 - 5 - heap * 9, 7 + heap * 5, hw * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6, -hw * 0.9);
      ctx.quadraticCurveTo(0, -hw * 0.9 + 5 + heap * 9, 7 + heap * 5, -hw * 0.9);
      ctx.closePath(); ctx.fill();
      A(0.5); ctx.fillStyle = MAT.soil3;
      for (var g = 0; g < Math.round(heap * 8) + 2; g++) {
        var gx2 = -4 + hash(le.id + g * 3.7) * 12;
        var gy2 = (g % 2 ? 1 : -1) * (hw * 0.9 - 1 - hash(g + le.id) * heap * 8);
        ctx.beginPath(); ctx.ellipse(gx2, gy2, 1.5, 1.2, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------- drawn intentions */
  function edgeById(id) {
    if (!L) return null;
    for (var i = 0; i < L.edges.length; i++) if (L.edges[i].id === id) return L.edges[i];
    return null;
  }
  function drawIntent(S, agents) {
    ctx.setLineDash([2, 4]); ctx.lineWidth = 1.3; ctx.strokeStyle = SIG.blue;
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i], r = a.route;
      if (!r || !r.length) continue;
      var cur = a.at;
      if (cur == null && a.edge != null) {
        var e0 = edgeById(a.edge);
        if (e0) cur = a.dir > 0 ? e0.b : e0.a;
      }
      if (cur == null) continue;
      A(0.7);
      ctx.beginPath();
      ctx.moveTo(AX(a), AY(a));
      var n0 = L.nodes[cur];
      if (n0) ctx.lineTo(n0.x, n0.y);
      for (var k = 0; k < r.length && k < 9; k++) {
        var le = edgeById(r[k]);
        if (!le) break;
        var nxt = (le.a === cur) ? le.b : le.a;
        var nn = L.nodes[nxt];
        if (!nn) break;
        ctx.lineTo(nn.x, nn.y);
        cur = nxt;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------ what the passages are like
     Wear is a road the colony has chosen; a jam is a road it cannot get down.
     Both are drawn on the floor, in earth, and neither has a number. */
  /* A JAMMED PASSAGE NEEDS NO OVERLAY: the bodies wedged in it, shoulder to
     shoulder and not moving, ARE the jam — AESTHETIC §0.

     A chamber with no way in is the one thing the bodies cannot say, because
     the whole point is that there are no bodies there. So it gets the one
     drawn convention in this file: DASHED MEANS NO TUNNEL REACHES THIS.
     The dashes march, slowly, the way a surveyor's pending line does.

     And because a convention is only learned at the moment it changes, the
     dashes closing into one solid line is a BEAT — a small, clear, one-shot
     event wherever on screen it happens. That is the whole lesson of §16.2
     delivered in about a second, with nothing written down. */
  function drawRoads(S) {
    if (!L) return;
    var main = (S.nest && S.nest.main !== undefined) ? S.nest.main : null;
    for (var i = 0; i < L.nodes.length; i++) {
      var n = L.nodes[i];
      if (!n.ref || n.ref.comp === undefined || n.ref.kind === 'surface') continue;
      var cut = !!(L.edges.length && main !== null && n.ref.comp !== main);
      var was = compWas.get(n.id);
      compWas.set(n.id, cut);
      if (was === true && !cut) {
        joins++;
        /* which passage got here — the answer to "why is it connected now" is a
           tunnel, so the light runs down that tunnel and into the room */
        var ce = null;
        for (var q = 0; q < L.edges.length; q++) {
          var le = L.edges[q];
          if (!le.ref.dug || (le.A !== n && le.B !== n)) continue;
          var far = le.A === n ? le.B : le.A;
          ce = { x: far.x / sx, y: far.y / sy, tx: n.x / sx, ty: n.y / sy };
          break;
        }
        if (ce) push({ k: 'way', x: ce.x, y: ce.y, tx: ce.tx, ty: ce.ty, life: 620 });
        push({ k: 'join', x: n.x / sx, y: n.y / sy, r: n.rr + 3, life: 1150 });
        push({ k: 'holed', x: n.x / sx, y: n.y / sy, life: 760 });
      }
      if (!cut) continue;
      A(0.6); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.3;
      ctx.setLineDash([2, 4]);
      ctx.lineDashOffset = -(now * 0.009) % 6;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.rr + 3, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
  }


  /* -------------------------------------------------------------- the earth */
  function rebuildNest() {
    var g = nx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(earth, 0, 0);
    var i;

    /* packed earth immediately around every excavation: spoil pressed into the
       wall, darker than the soil, so a tunnel reads as a hole and not a light */
    mxx.setTransform(1, 0, 0, 1, 0, 0);
    mxx.globalCompositeOperation = 'source-over'; mxx.globalAlpha = 1;
    mxx.clearRect(0, 0, W, H);
    mxx.fillStyle = MAT.soil3; mxx.fillRect(0, 0, W, H);
    mxx.globalCompositeOperation = 'destination-in';
    try { mxx.filter = 'blur(4px)'; } catch (e1) { }
    mxx.drawImage(dig, 0, 0, W, H);
    try { mxx.filter = 'none'; } catch (e2) { }
    g.globalAlpha = 0.9; g.drawImage(mix, 0, 0); g.globalAlpha = 1;

    /* the excavated floor itself, eroded a little tighter than the rim */
    mxx.globalCompositeOperation = 'source-over';
    mxx.clearRect(0, 0, W, H);
    mxx.drawImage(floor2, 0, 0);
    mxx.globalCompositeOperation = 'destination-in';
    mxx.drawImage(dig, 0, 0, W, H);
    mxx.drawImage(dig, 0, 0, W, H);
    g.drawImage(mix, 0, 0);

    /* the wall casts a shadow onto its own floor, which is what makes a chamber
       read as a room you are looking into rather than a hole punched in a page */
    mxx.globalCompositeOperation = 'source-over';
    mxx.clearRect(0, 0, W, H);
    mxx.fillStyle = MAT.soil3; mxx.fillRect(0, 0, W, H);
    mxx.globalCompositeOperation = 'destination-in';
    try { mxx.filter = 'blur(3px)'; } catch (e3) { }
    mxx.drawImage(dig, 0, 0, W, H);
    try { mxx.filter = 'none'; } catch (e4) { }
    mxx.globalCompositeOperation = 'destination-out';
    mxx.drawImage(dig, 0, 0, W, H);
    mxx.drawImage(dig, 0, 0, W, H);
    mxx.drawImage(dig, 0, 0, W, H);
    g.globalAlpha = 0.55; g.drawImage(mix, 0, 0); g.globalAlpha = 1;

    /* spoil heaps and pebbles in the dead ends nobody uses */
    if (L && L.spurs) {
      for (i = 0; i < L.spurs.length; i++) {
        var sp = L.spurs[i];
        for (var d = 0; d < 4; d++) {
          var an = hash(sp.s * 3.9 + d) * TAU, rr = hash(sp.s + d * 2.2) * sp.r * 0.7;
          var px = sp.x + Math.cos(an) * rr, py = sp.y + Math.sin(an) * rr;
          g.globalAlpha = 0.5; g.fillStyle = d % 2 ? MAT.soil3 : MAT.ink2;
          g.beginPath(); g.ellipse(px, py, 1.6 + hash(d + sp.s) * 1.8, 1.3 + hash(d) * 1.2, an, 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;
    }

    /* everything the colony remembers: scars, stamps, stains */
    g.drawImage(mem, 0, 0);

    crust(g);
    nestDirty = false;
  }

  /* the cutaway read, in one band: this is the ground, and that is the way in */
  function crust(g) {
    var hgt = 13;
    g.globalAlpha = 1; g.fillStyle = MAT.soil3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, hgt);
    for (var x = W; x >= 0; x -= 10) g.lineTo(x, hgt - 2 + hash(x * 0.31) * 5);
    g.closePath(); g.fill();
    g.globalAlpha = 0.9; g.strokeStyle = MAT.ink; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, 1); g.lineTo(W, 1); g.stroke();
    /* tufts above the line */
    g.globalAlpha = 0.55; g.lineWidth = 1.2;
    for (var t = 0; t < 9; t++) {
      var gx = (t + 0.5) * (W / 9) + hash(t * 3.7) * 8;
      g.beginPath(); g.moveTo(gx, 5); g.quadraticCurveTo(gx + 2, 2, gx + 4 + hash(t) * 3, 0); g.stroke();
      g.beginPath(); g.moveTo(gx, 5); g.quadraticCurveTo(gx - 2, 2, gx - 3 - hash(t + 2) * 3, 0); g.stroke();
    }
    /* the entrance: a spoil mound and a hole */
    if (L) {
      var ex = L.entry.x;
      g.globalAlpha = 0.9; g.fillStyle = MAT.sand2;
      g.beginPath(); g.moveTo(ex - 17, hgt + 1); g.quadraticCurveTo(ex, 1, ex + 17, hgt + 1); g.closePath(); g.fill();
      g.globalAlpha = 1; g.fillStyle = MAT.ink;
      g.beginPath(); g.ellipse(ex, hgt - 1, 5.5, 3.2, 0, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ---------------------------------------------------------- memory layer
     Architecture is history. Every instrument you land carves its own silhouette
     into the wall; every failure you miss collapses the tunnel and leaves rubble.
     Nothing here is ever erased inside a run. */
  function memStamp(kind, x, y) {
    var g = mx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = MAT.ink; g.fillStyle = MAT.ink;
    g.lineWidth = 1.8; g.lineCap = 'butt'; g.globalAlpha = 0.5;
    if (kind === 'charter') {
      g.beginPath(); g.arc(x, y, 11, Math.PI, 0); g.stroke();
      g.beginPath(); g.moveTo(x - 11, y); g.lineTo(x - 11, y + 9);
      g.moveTo(x + 11, y); g.lineTo(x + 11, y + 9); g.stroke();
    } else if (kind === 'ledger') {
      for (var i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 8 + i * 4, y - 7); g.lineTo(x - 8 + i * 4, y + 7); g.stroke(); }
      g.beginPath(); g.moveTo(x - 11, y + 7); g.lineTo(x + 8, y - 7); g.stroke();
    } else if (kind === 'lens') {
      g.beginPath(); g.moveTo(x - 11, y); g.quadraticCurveTo(x, y - 9, x + 11, y);
      g.quadraticCurveTo(x, y + 9, x - 11, y); g.stroke();
      g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
    } else if (kind === 'slow') {
      g.beginPath(); g.moveTo(x - 9, y + 8); g.quadraticCurveTo(x - 9, y - 8, x, y - 8);
      g.quadraticCurveTo(x + 9, y - 8, x + 9, y + 8); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x - 12, y + 8); g.lineTo(x + 12, y + 8); g.stroke();
    } else if (kind === 'vary') {
      g.beginPath(); g.moveTo(x, y + 9); g.lineTo(x, y - 1);
      g.moveTo(x, y - 1); g.lineTo(x - 8, y - 9);
      g.moveTo(x, y - 1); g.lineTo(x + 8, y - 9);
      g.moveTo(x, y + 3); g.lineTo(x + 6, y - 2); g.stroke();
    } else if (kind === 'eject') {
      g.beginPath(); g.moveTo(x - 11, y - 8); g.lineTo(x - 11, y + 8);
      g.moveTo(x + 11, y - 8); g.lineTo(x + 11, y + 8); g.stroke();
      g.globalAlpha = 0.3;
      for (var k = -6; k <= 6; k += 4) { g.beginPath(); g.moveTo(x + k, y - 7); g.lineTo(x + k - 3, y + 7); g.stroke(); }
    }
    g.globalAlpha = 1;
    nestDirty = true;
  }
  /* a miss: the roof comes in. Rubble in earth tones, a red hatch that says it
     landed, and the element's own primitive mark scratched beside it. */
  function memScar(sym, x, y) {
    var g = mx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    var i;
    g.globalAlpha = 0.85; g.fillStyle = MAT.soil3;
    for (i = 0; i < 9; i++) {
      var an = hash(x + i * 3.1) * TAU, rr = 4 + hash(y + i * 5.7) * 15;
      var px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr;
      g.beginPath();
      g.moveTo(px, py - 3 - hash(i) * 2); g.lineTo(px + 3 + hash(i + 1) * 2, py + 2); g.lineTo(px - 3, py + 3);
      g.closePath(); g.fill();
    }
    /* A SCAR IS NOT A SIGNAL. It is what is left when the signal has gone: the
       colony's memory of a place where something landed. It stays red, because
       red is what damage is, but it is one short mark at the strength of a
       pencil note — never loud enough to compete with a live incident, which
       is the thing the player is actually being asked about. */
    g.globalAlpha = 0.22; g.strokeStyle = SIG.red; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(x - 4, y + 6); g.lineTo(x + 3, y - 6); g.stroke();
    var im = sym ? glyph(sym, MAT.ink) : null;
    if (im) { g.globalAlpha = 0.42; g.drawImage(im, x + 11, y - 9, 17, 17); }
    g.globalAlpha = 1;
    nestDirty = true;
  }
  /* water rises, water falls, the tidemark stays */
  function memTide(level) {
    var g = mx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.2; g.strokeStyle = MAT.soil3; g.lineWidth = 2;
    g.beginPath();
    for (var x = 0; x <= W; x += 9) {
      var y = level + Math.sin(x * 0.09 + level) * 2;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
    nestDirty = true;
  }

  /* ================================================================== beats */
  function push(b) { b.t = now || performance.now(); beats.push(b); if (beats.length > 26) beats.splice(0, beats.length - 26); }
  function alive(kind) {
    for (var i = 0; i < beats.length; i++) if (beats[i].k === kind && now - beats[i].t < beats[i].life) return true;
    return false;
  }
  /* THE ONE-EVENT RULE, enforced on the loudest marks in the file. Two things
     landing inside a second used to draw two expanding red rings across half
     the screen at once, and a screen of red is a screen with no signal left in
     it. Only the newest of a loud kind is ever live; the older one has already
     become a scar, and a scar is a quiet mark. */
  function only(kind) {
    for (var i = beats.length - 1; i >= 0; i--) if (beats[i].k === kind) beats.splice(i, 1);
  }

  function wire() {
    if (wired || !window.FZ || !FZ.bus) return;
    wired = true;
    /* A detector firing is a small physical event, not an announcement: dust, a
       flinch. The outbreak that opens on top of it does all the naming. */
    FZ.bus.on('fire', function (d) {
      if (!d || !d.at) return;
      push({ k: 'jolt', x: d.at.x, y: d.at.y, who: idsOf(d.who), life: 620 });
    });
    FZ.bus.on('job:done', function (d) { if (d) push({ k: 'haul', x: d.x, y: d.y, v: d.value || 1, life: 900 }); });
    FZ.bus.on('job:lost', function (d) {
      if (!d) return;
      var n = 0;
      for (var i = beats.length - 1; i >= 0; i--) if (beats[i].k === 'spill' && ++n > 1) beats.splice(i, 1);
      push({ k: 'spill', x: d.x, y: d.y, life: 820 });
    });
    FZ.bus.on('agent:hurt', function (d) {
      if (!d) return;
      push({ k: 'hurt', x: d.x, y: d.y, life: 560 });
      if (d.id !== undefined) hurtAt.set(d.id, performance.now());
    });
    FZ.bus.on('intervene', function (d) {
      if (!d || d.x === undefined || d.x === null) return;
      push({ k: 'act', x: d.x, y: d.y, ok: !!d.ok, kind: d.kind, life: 700 });
      if (d.ok && d.kind && mx) memStamp(d.kind, X(d.x), Y(d.y));
    });
    FZ.bus.on('outbreak:open', function (d) { if (!d) return; only('open'); push({ k: 'open', x: d.x, y: d.y, life: 560 }); });
    FZ.bus.on('outbreak:answered', function (d) {
      if (!d) return;
      only('shut');
      push({ k: 'shut', x: d.x, y: d.y, r: d.r || 60, life: 900 });
    });
    FZ.bus.on('outbreak:landed', function (d) {
      if (!d) return;
      only('burst');
      push({ k: 'burst', x: d.x, y: d.y, r: d.r || 60, life: 820 });
      if (dx) collapseAt(X(d.x), Y(d.y), 17);
      if (mx) memScar(d.sym, X(d.x), Y(d.y));
    });
    FZ.bus.on('conflict:resolved', function (d) {
      if (d) push({ k: 'end', x: d.x, y: d.y, mode: d.mode, life: 1100 });
    });
  }

  /* ================================================================ the ants
     Bodies, not dots. Gait, antennae, load, posture and markings, all of it
     driven by state the sim already computes. This is where "idle: 7" dies. */
  function bodyOf(id) {
    var b = bodies.get(id);
    if (!b) { b = { ang: hash(id * 3.3) * TAU, ph: hash(id) * 6, mov: 0, k: hash(id * 9.1) }; bodies.set(id, b); }
    return b;
  }
  function antScale(n) { return clamp(Math.sqrt((W * H) / (370 * 560)) * (n > 26 ? 0.82 : n > 16 ? 0.92 : 1), 0.72, 1.28); }

  /* THE POSTURE VOCABULARY. SIM chooses one word per worker per tick and the
     word is the whole drawing: how the legs are set, where the antennae are,
     how the body leans. During a burning incident the posture is FROZEN, so
     the bodies stop being animation and become a diagram of the failure you
     are being asked to name — a line of waiting workers, two braced against
     each other, five wedged in a doorway. */
  var POSE = {
    carry: { gait: 0, brace: -0.4, droop: 0.2, lean: 0.5, splay: 0, work: 1 },
    haul: { gait: 1, brace: 0, droop: 0.3, lean: 0.3, splay: 0, work: 1 },
    tug: { gait: 0, brace: -1.5, droop: 0.1, lean: -1.6, splay: 1.5, work: 1 },
    jam: { gait: 0.25, brace: 1.4, droop: 2.6, lean: 0, splay: 2.2, work: 0 },
    wait: { gait: 0, brace: -0.2, droop: 1.9, lean: 0, splay: 0.2, work: 0 },
    guard: { gait: 0, brace: -0.9, droop: 0.1, lean: 0.8, splay: 1.6, work: 0 },
    march: { gait: 1.2, brace: 0, droop: 0, lean: 0.4, splay: 0, work: 0 },
    chase: { gait: 1.4, brace: 0.3, droop: 0, lean: 1.2, splay: 0, work: 0 },
    dig: { gait: 0.3, brace: -1.2, droop: 0.4, lean: 1.4, splay: 1.1, work: 2 },
    wander: { gait: 0.7, brace: 0, droop: 1.6, lean: 0, splay: 0, work: 0 },
    idle: { gait: 0, brace: -0.4, droop: 2.7, lean: -0.4, splay: 0.6, work: 0 },
    down: { gait: 0, brace: 1.1, droop: 3, lean: 0, splay: 2.4, work: 0 }
  };

  function drawAnt(a, S, sc, dim, frozen) {
    var x = AX(a), y = AY(a);
    var b = bodyOf(a.id);
    var held = (a.hold && a.hold.length) ? a.hold.length : 0;
    var stunned = (a.stun || 0) > 0;
    var gave = !!a.gaveUp;
    var own = (a.terr || 0) > 0.5;

    /* heading and gait come from where the body actually went in the nest */
    var mx2 = b.px === undefined ? 0 : x - b.px, my2 = b.py === undefined ? 0 : y - b.py;
    var spd = Math.sqrt(mx2 * mx2 + my2 * my2);
    b.px = x; b.py = y;
    if (spd > 0.25) { b.ang = angLerp(b.ang, Math.atan2(my2, mx2), 0.3); b.mov = b.mov * 0.84 + 0.16; }
    else b.mov *= 0.88;

    /* the nest says what it is doing before the taxonomy does: cutting a face,
       standing in a queue that will not move, or pressed into a full passage */
    var pose = a.posture;
    if (stunned) pose = 'down';
    else if (a.place === 'dig' || a.digE != null) pose = 'dig';
    else if ((a.blockT || 0) > 26) pose = a.headOn ? 'tug' : 'wait';
    else if (!pose) pose = held ? 'haul' : 'wander';
    var P = POSE[pose] || POSE.wander;
    var idle = P.droop > 1.4;

    if (idle && !stunned && !frozen) b.ang += Math.sin(now * 0.0016 + b.k * 21) * 0.055;
    if (!frozen) b.ph += spd * 0.34 * P.gait + (stunned ? 0 : 0.015 * P.gait);

    var job = held ? jobIx.get(a.hold[0]) : null;
    var atWork = P.work > 0 && !stunned;
    if (P.work === 1 && job) {
      var ddx = X(job.x) - x, ddy = Y(job.y) - y;
      atWork = (ddx * ddx + ddy * ddy) < 30 * 30;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(stunned ? b.ang + 1.4 : b.ang);
    ctx.scale(sc, sc);
    var al = dim * (gave ? 0.7 : 1) * (stunned ? 0.82 : 1);

    /* --- the little pocket a body is always standing in, and its shadow --- */
    A(0.26 * al); ctx.fillStyle = MAT.sand;
    ctx.beginPath(); ctx.ellipse(-1, 0, 11, 8, 0, 0, TAU); ctx.fill();
    A(0.16 * al); ctx.fillStyle = MAT.ink;
    ctx.beginPath(); ctx.ellipse(-1, 1.6, 7, 3.4, 0, 0, TAU); ctx.fill();

    /* --- the hoard: every extra job it is sitting on is a crumb under it --- */
    if (held > 1 && taught('Ow')) {
      for (var q = 1; q < held && q < 5; q++) {
        A(0.95 * al); ctx.fillStyle = MAT.sand2;
        ctx.beginPath(); ctx.ellipse(-6 - q * 1.6, (q % 2 ? 3.1 : -3.1), 2.4, 1.9, 0, 0, TAU); ctx.fill();
        A(0.6 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.ellipse(-6 - q * 1.6, (q % 2 ? 3.1 : -3.1), 2.4, 1.9, 0, 0, TAU); ctx.stroke();
      }
    }

    /* --- legs: tripod gait, braced when pulling, splayed when wedged --- */
    A(0.85 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    var bases = [1.7, 0.2, -1.3];
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 3; i++) {
        var ph = b.ph + i * 2.0 + (s > 0 ? 0 : Math.PI);
        var sw = P.brace + Math.sin(ph) * 0.9 * P.gait * (0.35 + b.mov);
        var bx = bases[i];
        var kx = bx + 1.2 + sw * 0.9, ky = s * (2.4 + P.splay * 0.7 + (stunned ? -1 : 0));
        var fx = bx + 2 + sw * 1.9, fy = s * (3.9 + P.splay * 1.5 + (stunned ? -2.6 : gave ? -1.2 : 0));
        ctx.beginPath(); ctx.moveTo(bx, s * 1); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }
    }

    /* --- antennae: up and probing when working, down when idle, flat when spent --- */
    var wig = frozen ? 0 : Math.sin(now * 0.009 + b.k * 13) * (idle ? 0.4 : 1.1);
    var droop = P.droop + (gave ? 0.8 : 0) + (a.hesitate || 0) * 0.9;
    var reach = a.myopic ? 1.8 : 3.2;
    A(0.9 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.8;
    for (var t = -1; t <= 1; t += 2) {
      ctx.beginPath();
      ctx.moveTo(5, t * 0.9);
      ctx.lineTo(6.8, t * 1.9 + droop * 0.4);
      ctx.lineTo(6.8 + reach, t * (2.1 + wig * 0.5) + droop);
      ctx.stroke();
    }

    /* --- the body --- */
    A(0.97 * al); ctx.fillStyle = MAT.ink;
    ctx.beginPath(); ctx.ellipse(-4.9, 0, 3.9, 3.2, 0, 0, TAU); ctx.fill();    /* gaster */
    ctx.beginPath(); ctx.ellipse(0.6, 0, 2.6, 2.1, 0, 0, TAU); ctx.fill();     /* thorax */
    ctx.beginPath(); ctx.ellipse(4.3, 0, 2.7, 2.4, 0, 0, TAU); ctx.fill();     /* head */
    A(0.9 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(-1.7, 0); ctx.lineTo(-0.9, 0); ctx.stroke();   /* petiole */
    /* a rim of light on the shell, so a pile of eight workers stays countable */
    A(0.42 * al); ctx.strokeStyle = MAT.sand2; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(-4.9, 0, 3.9, 3.2, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4.3, 0, 2.7, 2.4, 0, 0, TAU); ctx.stroke();

    /* --- lineage, in markings. Monoculture drains these to nothing. --- */
    var hu = (typeof a.hue === 'number' && isFinite(a.hue)) ? Math.abs(Math.round(a.hue > 4 ? a.hue / 72 : a.hue)) % 5 : 0;
    if (hu) {
      A(0.85 * al); ctx.fillStyle = MAT.sand;
      if (hu === 1) ctx.fillRect(-5.4, -2.4, 1.1, 4.8);
      else if (hu === 2) { ctx.fillRect(-6, -2.2, 1, 4.4); ctx.fillRect(-3.9, -2.2, 1, 4.4); }
      else if (hu === 3) { ctx.beginPath(); ctx.arc(-4.7, 0, 1.3, 0, TAU); ctx.fill(); }
      else { A(0.8 * al); ctx.strokeStyle = MAT.sand; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(-4.7, 0, 3.7, 3, 0, 0, TAU); ctx.stroke(); }
    }
    /* --- a worker nothing gets through wears a hard shell --- */
    if ((a.corrigible === false || a.adversary) && (taught('Cr') || taught('Sa'))) {
      A(0.9 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.1;
      for (var k2 = -1; k2 <= 1; k2++) {
        ctx.beginPath();
        ctx.moveTo(-4.7 + k2 * 2.1, -2.6); ctx.lineTo(-5.1 + k2 * 2.1, -5.1);
        ctx.stroke();
      }
    }
    /* --- mandibles on the crumb --- */
    if (atWork && !stunned) {
      A(0.9 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(6.3, -1.4); ctx.lineTo(8.2, -2.2 - Math.sin(b.ph * 2) * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6.3, 1.4); ctx.lineTo(8.2, 2.2 + Math.sin(b.ph * 2) * 0.6); ctx.stroke();
    }
    ctx.restore();

    /* --- possession: a scratched line around what it has decided is its --- */
    if (own && taught('Ow')) {
      A(0.3 * dim); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.arc(x, y, 15 * sc, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    /* --- struck. The BLOW is red, for the second it lands. Being down is not:
       a worker on its side with its legs pulled in, among workers that are
       walking, has already said it. A red tick standing over every stunned
       body meant a quiet nest could hold a dozen red marks, and then the one
       incident actually asking for the player had nothing louder to be. --- */
    var ht = hurtAt.get(a.id);
    if (ht !== undefined && now - ht < 600) ring(x, y, (10 + (now - ht) * 0.02) * sc, SIG.red, 1.6, (1 - (now - ht) / 600) * 0.8 * dim);
    if (a.flash) ring(x, y, (11 + (1 - Math.min(1, a.flash)) * 6) * sc, MAT.paper, 1.6, 0.5 * Math.min(1, a.flash) * dim);
  }

  /* the queen and the brood: the colony's own health, with no meter attached */
  function drawQueen(S) {
    if (!L) return;
    var q = L.queen, strain = strainOf(S);
    var eggs = Math.round(3 + (1 - strain) * 8);
    var i;
    for (i = 0; i < eggs; i++) {
      var an = (i / eggs) * TAU + q.y * 0.01, rr = 6 + (i % 3) * 4.4;
      var ex = q.x + Math.cos(an) * rr * 1.3 + 10, ey = q.y + Math.sin(an) * rr * 0.7 + 6;
      A(0.9); ctx.fillStyle = MAT.paper2;
      ctx.beginPath(); ctx.ellipse(ex, ey, 2.6, 1.8, an, 0, TAU); ctx.fill();
      A(0.35); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(ex, ey, 2.6, 1.8, an, 0, TAU); ctx.stroke();
    }
    ctx.save();
    ctx.translate(q.x - 9, q.y - 3);
    ctx.rotate(Math.sin(now * 0.0008) * 0.1 - 0.2);
    ctx.scale(1.9, 1.9);
    A(0.15); ctx.fillStyle = MAT.ink;
    ctx.beginPath(); ctx.ellipse(-1, 2, 8, 3.4, 0, 0, TAU); ctx.fill();
    A(0.97); ctx.fillStyle = MAT.ink;
    ctx.beginPath(); ctx.ellipse(-6.4, 0, 5.4, 3.3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.4, 0, 2.7, 2.1, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4.4, 0, 2.7, 2.4, 0, 0, TAU); ctx.fill();
    A(0.9); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.9;
    var dp = strain * 3.2;
    for (var t = -1; t <= 1; t += 2) {
      ctx.beginPath();
      ctx.moveTo(5.6, t * 1.1); ctx.lineTo(8, t * 2.4 + dp * 0.4); ctx.lineTo(12, t * 2.6 + dp);
      ctx.stroke();
    }
    A(0.7); ctx.strokeStyle = MAT.sand; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(-6.4, 0, 5.5, 3.4, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* the store: every finished job is a seed in the wall. This is the score. */
  function drawStore(S) {
    if (!L) return;
    var st = L.store, done = S.jobsDone || 0, goal = S.jobsGoal || 0;
    var slots = goal > 0 ? goal : Math.max(done, 6);
    slots = Math.min(slots, 14);
    var cols = slots > 7 ? Math.ceil(slots / 2) : slots;
    var rows = slots > 7 ? 2 : 1;
    var gw = Math.min(st.r * 1.8, cols * 11);
    var step = cols > 1 ? gw / (cols - 1) : 0;
    var i = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols && i < slots; c++, i++) {
        var px = st.x - gw / 2 + c * step, py = st.y - (rows - 1) * 6 + r * 12;
        A(0.28); ctx.fillStyle = MAT.ink;
        ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
        if (i < done) {
          var pop = 1;
          var da = doneAt.get(i);
          if (da === undefined) { doneAt.set(i, now); da = now; }
          if (now - da < 420) pop = 1 + (1 - (now - da) / 420) * 0.9;
          A(0.95); ctx.fillStyle = MAT.soil2;
          ctx.beginPath(); ctx.ellipse(px, py, 4.6 * pop, 3.6 * pop, 0.5, 0, TAU); ctx.fill();
          A(0.85); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(px, py, 4.6 * pop, 3.6 * pop, 0.5, 0, TAU); ctx.stroke();
          A(0.5); ctx.strokeStyle = MAT.sand; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(px - 2.4, py - 1.4); ctx.lineTo(px + 2, py + 1.2); ctx.stroke();
        }
      }
    }
  }

  /* ================================================================== crumbs
     A job is a seed on the chamber floor. Work eats it and the grains pile up
     beside it, so progress is a physical fact and never a bar. */
  function crumbR(j) { return (7 + Math.min(9, (j.value || 1) * 1.5)) * clamp(Math.sqrt((W * H) / (370 * 560)), 0.8, 1.25); }

  function drawCrumb(j, S, dim) {
    var x = X(j.x), y = Y(j.y);
    var need = j.need || 1;
    var p = clamp((j.progress || 0) / need, 0, 1);
    var r0 = crumbR(j), r = r0 * (1 - 0.42 * p);
    var blocked = j.prereq !== undefined && j.prereq !== null && j.prereq !== false && !prereqMet(j);
    var jitter = 0;
    var nclaim = j.claims ? (j.claims.size || j.claims.length || 0) : 0;
    if (nclaim > 1 && taught('Co')) jitter = Math.min(2.4, nclaim * 0.5);
    var jx = x + Math.sin(now * 0.02 + j.id) * jitter, jy = y + Math.cos(now * 0.023 + j.id) * jitter;
    var a = dim * (blocked ? 0.72 : 1);

    /* grains already carried off: the work that is done, lying where it fell */
    var grains = Math.round(p * 7);
    for (var g = 0; g < grains; g++) {
      var an = hash(j.id * 5.1 + g) * TAU, rr = r0 + 5 + hash(j.id + g * 3.3) * 9;
      A(0.75 * a); ctx.fillStyle = MAT.sand2;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(an) * rr, y + Math.sin(an) * rr, 1.9, 1.5, an, 0, TAU); ctx.fill();
    }
    /* the ghost of grain that was carried and then rolled back */
    var pk = peak.get(j.id);
    if (pk !== undefined && pk > p + 0.05) {
      A(0.5 * a); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(x, y, r0 * (1 - 0.42 * pk), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    /* the seed itself */
    A(0.2 * a); ctx.fillStyle = MAT.ink;
    ctx.beginPath(); ctx.ellipse(jx + 1.4, jy + 2, r * 0.95, r * 0.72, 0.4, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(jx, jy); ctx.rotate(hash(j.id * 1.7) * TAU);
    A(0.98 * a); ctx.fillStyle = MAT.soil2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.quadraticCurveTo(r * 0.45, r * 0.86, -r * 0.55, r * 0.7);
    ctx.quadraticCurveTo(-r * 1.02, r * 0.2, -r * 0.86, -r * 0.42);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.92, r, 0);
    ctx.closePath(); ctx.fill();
    A(0.9 * a); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.3; ctx.stroke();
    A(0.35 * a); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(r * 0.72, 0); ctx.quadraticCurveTo(-r * 0.1, r * 0.2, -r * 0.7, -r * 0.1); ctx.stroke();
    A(0.45 * a); ctx.strokeStyle = MAT.paper; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.5); ctx.quadraticCurveTo(-r * 0.3, -r * 0.62, -r * 0.62, -r * 0.3); ctx.stroke();
    ctx.restore();

    /* left alone too long: it goes mouldy where it lies */
    var neg = Math.min(1, (j.neglect || 0) / 260);
    if (neg > 0.25) {
      A(0.5 * neg * a); ctx.strokeStyle = MAT.ink2; ctx.lineWidth = 0.9;
      for (var m = 0; m < 7; m++) {
        var ma = hash(j.id * 2.2 + m) * TAU;
        ctx.beginPath();
        ctx.moveTo(jx + Math.cos(ma) * r * 0.7, jy + Math.sin(ma) * r * 0.7);
        ctx.lineTo(jx + Math.cos(ma) * (r + 3.5), jy + Math.sin(ma) * (r + 3.5));
        ctx.stroke();
      }
    }
    /* somebody is sitting on it and not working it: a plug across the mouth */
    if (j.locked && taught('Lo')) {
      A(0.95 * a); ctx.strokeStyle = SIG.amber; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(jx - r - 3, jy); ctx.lineTo(jx + r + 3, jy); ctx.stroke();
    }
    /* poison, once anybody can see it */
    if (j.poison && j.revealed) {
      A(0.9 * a); ctx.strokeStyle = SIG.red; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(jx - r * 0.5, jy - r * 0.5); ctx.lineTo(jx + r * 0.5, jy + r * 0.5);
      ctx.moveTo(jx + r * 0.5, jy - r * 0.5); ctx.lineTo(jx - r * 0.5, jy + r * 0.5);
      ctx.stroke();
    }
    /* what the lens shows: how much this one is actually worth */
    if (S.lensOn) {
      /* counted ON the crumb, never floating in the earth above it */
      var n = clamp(Math.round(j.value || 1), 1, 6);
      A(0.92 * a); ctx.fillStyle = SIG.blue;
      for (var v = 0; v < n; v++) ctx.fillRect(jx - n * 1.9 + v * 3.8, jy + r * 0.12, 2.4, 3);
    }
    /* everybody hauling on one crumb, pulling in different directions. A short
       taut stub, not a ray across the nest: it is a grip, and it only reads as
       a grip if it stops at the mandibles. */
    if (nclaim > 1 && taught('Co')) {
      var cl = idsOf(j.claims);
      for (var c = 0; c < cl.length; c++) {
        var ca = agentIx.get(cl[c]);
        if (!ca) continue;
        var ax = AX(ca), ay = AY(ca);
        var d = Math.sqrt((ax - jx) * (ax - jx) + (ay - jy) * (ay - jy)) || 1;
        if (d > 46) continue;
        var stub = Math.min(d - 5, 15);
        if (stub < 2) continue;
        A(0.62 * dim); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(jx + (ax - jx) / d * (r - 1), jy + (ay - jy) / d * (r - 1));
        ctx.lineTo(jx + (ax - jx) / d * (r - 1 + stub), jy + (ay - jy) / d * (r - 1 + stub));
        ctx.stroke();
      }
    }
  }

  function prereqMet(j) {
    var pj = jobIx.get(j.prereq);
    if (!pj) return true;
    return (pj.progress || 0) >= (pj.need || 1);
  }

  /* ============================================================ institutions
     Shape is the teaching. A charter is a stone ring you can see the inside of. */
  function drawCharter(c) {
    var x = X(c.x), y = Y(c.y), r = (c.r || 60) * sx;
    /* a swept floor: somebody keeps this place */
    A(0.13); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.9;
    for (var s = 1; s <= 3; s++) { ctx.beginPath(); ctx.arc(x, y, r * (0.28 + s * 0.18), 0, TAU); ctx.stroke(); }
    /* the standing stones */
    var n = 10;
    for (var i = 0; i < n; i++) {
      var an = (i / n) * TAU + 0.2;
      var sxp = x + Math.cos(an) * r * 0.86, syp = y + Math.sin(an) * r * 0.86;
      ctx.save(); ctx.translate(sxp, syp); ctx.rotate(an + Math.PI / 2);
      A(0.22); ctx.fillStyle = MAT.ink;
      ctx.beginPath(); ctx.ellipse(0, 4, 5, 2, 0, 0, TAU); ctx.fill();
      A(0.98); ctx.fillStyle = MAT.soil3;
      ctx.beginPath(); ctx.moveTo(-3, 4.5); ctx.lineTo(-2.4, -5); ctx.lineTo(2.4, -5.6); ctx.lineTo(3.2, 4.5);
      ctx.closePath(); ctx.fill();
      A(0.9); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.restore();
    }
    /* the arch: the one silhouette that means "this is arbitrated", and it holds */
    var ar = clamp(r * 0.17, 8, 15);
    A(0.9); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(x, y - 1, ar, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - ar, y - 1); ctx.lineTo(x - ar, y + ar);
    ctx.moveTo(x + ar, y - 1); ctx.lineTo(x + ar, y + ar); ctx.stroke();
  }

  /* ================================================================ weather */
  function strainOf(S) {
    if (!S.collapseMax || !isFinite(S.collapseMax)) return 0;
    return clamp((S.collapse || 0) / S.collapseMax, 0, 1);
  }
  /* strain is water. It comes up from the bottom and it leaves a tidemark. */
  function drawFlood(S) {
    var k = strainOf(S);
    if (k < 0.03) return;
    var lvl = H - k * H * 0.4;
    if (k > floodMark + 0.06) { floodMark = k; memTide(lvl); }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, lvl);
    for (var x = 0; x <= W; x += 8) ctx.lineTo(x, lvl + Math.sin(x * 0.05 + now * 0.0012) * 2.4);
    ctx.lineTo(W, H); ctx.closePath();
    A(0.42); ctx.fillStyle = MAT.soil3; ctx.fill();
    ctx.restore();
    A(0.5); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var x2 = 0; x2 <= W; x2 += 8) {
      var y2 = lvl + Math.sin(x2 * 0.05 + now * 0.0012) * 2.4;
      if (x2 === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    /* the water is at the brood — but never while something is landing, because
       two red things at once is one red thing too many */
    if (k > 0.8 && !alive('burst')) {
      A(0.35 + Math.sin(now * 0.006) * 0.2); ctx.strokeStyle = SIG.red; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, lvl - 3); ctx.lineTo(W, lvl - 3); ctx.stroke();
    }
  }
  /* machine speed is grit shaking loose from the roof */
  function drawGrit(S) {
    var t = (S.tempo || 1);
    if (t < 1.12) return;
    var n = Math.min(34, Math.round((t - 1) * 34));
    A(0.4); ctx.fillStyle = MAT.sand2;
    for (var i = 0; i < n; i++) {
      var gx = hash(i * 7.7) * W;
      var gy = ((hash(i * 3.3) * H) + now * (0.05 + t * 0.06)) % H;
      ctx.fillRect(gx, gy, 1.4, 2.6 + t);
    }
  }
  /* no mental model of the place is literally not being able to see it */
  function drawDark(S) {
    var d = clamp(S.blind ? 0.5 : 0, 0, 1);
    if (!S.lensOn && (S.blind || 0)) d = 0.55;
    if (d < 0.02 || !vign) return;
    A(d); ctx.drawImage(vign, 0, 0); ctx.globalAlpha = 1;
  }
  /* painted once: a soft edge darkness, stacked from one ink so no derived
     colour exists, and blitted rather than re-stroked every frame */
  function paintVignette(g) {
    for (var i = 0; i < 9; i++) {
      g.globalAlpha = 0.05;
      g.strokeStyle = MAT.ink; g.lineWidth = 10 + i * 9;
      g.strokeRect(-6 - i * 8, -6 - i * 8, W + 12 + i * 16, H + 12 + i * 16);
    }
    g.globalAlpha = 1;
  }

  /* ================================================================ traffic
     Bodies get in each other's way, and you can see it happen. */
  function drawJostle(S, sc) {
    var ag = S.agents || [];
    var n = ag.length;
    if (n > 46) return;
    var lim = 13 * sc, l2 = lim * lim;
    for (var i = 0; i < n; i++) {
      var a = ag[i];
      if ((a.stun || 0) > 0) continue;
      for (var j = i + 1; j < n; j++) {
        var b = ag[j];
        if ((b.stun || 0) > 0) continue;
        var ddx = AX(b) - AX(a), ddy = AY(b) - AY(a);
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 > l2 || d2 < 0.01) continue;
        var k = 1 - Math.sqrt(d2) / lim;
        var mxp = (AX(a) + AX(b)) / 2, myp = (AY(a) + AY(b)) / 2;
        var an = Math.atan2(ddy, ddx);
        A(0.55 * k); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.1;
        for (var s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.arc(mxp, myp, 5 + k * 3, an + s * 0.6 + Math.PI / 2, an + s * 0.6 + Math.PI / 2 + 0.8);
          ctx.stroke();
        }
      }
    }
  }

  /* ============================================================== the paper
     ONE tag, near the thing, and only if no other region is already speaking.
     Never a code, never a heading, never a second sentence. */
  function domSpeaking() {
    var t = document.getElementById('tagLayer');
    if (t && t.textContent && t.textContent.trim()) return true;
    var a = document.getElementById('act');
    if (a && a.textContent && a.textContent.trim()) return true;
    return false;
  }
  function wrap(text, maxw) {
    var words = String(text || '').split(/\s+/), out = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > maxw && cur) { out.push(cur); cur = words[i]; }
      else cur = t;
    }
    if (cur) out.push(cur);
    return out.slice(0, 3);
  }
  function paperTag(text, cx, cy, above) {
    /* the nest may be standing back from the action bar; the writing does not
       shrink with it, so a sentence is the same size on the glass either way */
    var u = 1 / clamp(fit, 0.55, 1);
    ctx.font = (12 * u).toFixed(1) + 'px "IBM Plex Mono",ui-monospace,monospace';
    var maxw = Math.min(W - 30, 244 * u);
    var ls = wrap(text, maxw - 20 * u);
    if (!ls.length) return null;
    var tw = 0;
    for (var i = 0; i < ls.length; i++) tw = Math.max(tw, ctx.measureText(ls[i]).width);
    var bw = tw + 20 * u, bh = (13 + ls.length * 15) * u;
    var bx = clamp(cx - bw / 2, 6, Math.max(6, W - bw - 6));
    var by = above ? cy - bh : cy;
    var ar = actRect();
    var floor = ar ? Math.min(H - bh - 6, ar.top - bh - 4) : H - bh - 6;
    by = clamp(by, 16, Math.max(16, floor));
    A(0.2); ctx.fillStyle = MAT.ink; ctx.fillRect(bx + 2, by + 3, bw, bh);
    A(0.97); ctx.fillStyle = MAT.paper; ctx.fillRect(bx, by, bw, bh);
    A(0.5); ctx.strokeStyle = MAT.ink2; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    A(0.95); ctx.fillStyle = MAT.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (var l = 0; l < ls.length; l++) ctx.fillText(ls[l], bx + 10 * u, by + (19 + l * 15) * u);
    return { x: bx, y: by, w: bw, h: bh };
  }

  /* ============================================================= outbreaks */
  function live() {
    var o = (window.FZ && FZ.outbreak && FZ.outbreak.list) ? FZ.outbreak.list : null;
    return (o && o.length) ? o : null;
  }
  /* whichever fuse is shortest is the one the player is being asked about */
  function urgent(S) {
    var O = live();
    if (!O) return null;
    var best = null, bl = 2;
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (!o || (o.state && o.state !== 'burning')) continue;
      var l = clamp(1 - ((S.tick || 0) - (o.born || 0)) / (o.fuse || 1), 0, 1);
      if (l < bl) { bl = l; best = o; }
    }
    return best ? { o: best, left: bl } : null;
  }
  /* the workers the burning incident is about. Their posture freezes, and they
     are held further apart than usual, because these are the bodies the player
     has to read and count in the two seconds they have. */
  function burningWho(S) {
    var top = urgent(S);
    if (!top) return null;
    var el = (window.FZ && FZ.ELBY && top.o.sym) ? FZ.ELBY[top.o.sym] : null;
    var ids = el ? idsOf(el.who) : [];
    if (!ids.length && top.o.who) ids = idsOf(top.o.who);
    return ids.length ? new Set(ids) : null;
  }
  /* What the bar still covers, in nest coordinates, WHILE the colony is easing
     out from under it. Once the move has finished this returns null — there is
     nothing left to dodge, so the tag and the dial stop being displaced at all
     and simply sit on the thing they belong to. */
  function actRect() {
    if (!cv) return null;
    var el = document.getElementById('act');
    if (!el || !el.firstChild) return null;
    var r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
    if (!r.height) return null;
    var k = fit > 0.05 ? fit : 1;
    var top = (r.top - c.top) / k;
    if (top >= H - 2) return null;
    return { top: top - 12, bottom: (r.bottom - c.top) / k + 12 };
  }
  function safeSpot(x, y, r) {
    var fr = clamp(r * 0.5, 24, 44);
    var pad = Math.min(90, W * 0.24, H * 0.2);
    var ar = actRect();
    var lo = pad, hi = H - pad;
    if (ar && ar.top < hi) hi = Math.max(pad, Math.min(hi, ar.top));
    var tx2 = clamp(x, pad, Math.max(pad, W - pad));
    var ty2 = clamp(y, lo, Math.max(lo, hi));
    var dx2 = tx2 - x, dy2 = ty2 - y;
    var d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    var cap = r * 0.74;
    if (d > cap && d > 0) { tx2 = x + dx2 / d * cap; ty2 = y + dy2 / d * cap; d = cap; }
    /* the dial shrinks rather than reaching outside the ground it belongs to */
    fr = Math.min(fr, Math.max(15, r - d - 5));
    tx2 = clamp(tx2, fr + 11, Math.max(fr + 11, W - fr - 11));
    ty2 = clamp(ty2, fr + 11, Math.max(fr + 11, H - fr - 11));
    if (ar && ty2 + fr + 8 > ar.top && ty2 - fr - 8 < ar.bottom) {
      ty2 = Math.max(fr + 11, ar.top - fr - 8);
    }
    dx2 = tx2 - x; dy2 = ty2 - y;
    d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    fr = Math.min(fr, Math.max(15, r - d - 5));
    return { x: tx2, y: ty2, fr: fr, off: d };
  }
  function outbreakGround(S) {
    var O = live();
    if (!O) return;
    var top = urgent(S);
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (!o || (o.state && o.state !== 'burning')) continue;
      var x = X(o.x), y = Y(o.y), r = clamp((o.r || 60) * sx, 30, Math.min(W, H) * 0.33);
      var left = clamp(1 - ((S.tick || 0) - (o.born || 0)) / (o.fuse || 1), 0, 1);
      var lead = top && top.o === o;
      var col = left < 0.34 ? SIG.red : SIG.amber;
      var q = lead ? 1 : 0.28;
      A(0.09 * q); ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
  /* The fuse is the boundary itself draining away. It cannot come adrift from
     the place it belongs to, and it needs no numerals to be read. */
  function outbreakInstrument(S) {
    lastDial = null;
    var O = live();
    if (!O) return;
    var top = urgent(S);
    var i;
    for (i = 0; i < O.length; i++) {
      var o = O[i];
      if (!o || (o.state && o.state !== 'burning')) continue;
      var x = X(o.x), y = Y(o.y), r = clamp((o.r || 60) * sx, 30, Math.min(W, H) * 0.33);
      var left = clamp(1 - ((S.tick || 0) - (o.born || 0)) / (o.fuse || 1), 0, 1);
      var lead = top && top.o === o;
      var hot = left < 0.34;
      var col = hot ? SIG.red : SIG.amber;
      var bl = hot ? 0.62 + Math.abs(Math.sin(now * 0.012)) * 0.38 : 1;
      var q = lead ? 1 : 0.3;
      /* ONE FRAME AT FULL STRENGTH, EVER. The wide dashed boundary — how far an
         answer may land — is drawn only around the incident the player is being
         asked about. A second live incident keeps its bodies, its ground stain
         and a small dial, and nothing else: it is legible from what is happening
         in it, which is the whole point of the grammar. */
      if (lead) {
        A(0.22 * bl); ctx.strokeStyle = col; ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      /* the time left, on a compact dial — the wide dashed ring is how far an
         answer may land, the dial is how long it has. The dial is nudged clear
         of the screen edge and of the action bar, never further than the ring
         allows, so the thing you are told to tap is always tappable. */
      /* two incidents standing on the same ground draw one instrument between
         them, not two nested rings. The quieter one keeps its stain and its
         bodies; the dial belongs to the one being asked about. */
      if (!lead && top) {
        var lx = X(top.o.x) - x, ly = Y(top.o.y) - y;
        var lr = clamp((top.o.r || 60) * sx, 30, Math.min(W, H) * 0.33) * 0.9;
        if (lx * lx + ly * ly < lr * lr) continue;
      }
      var sp = safeSpot(x, y, r);
      var fr = sp.fr;
      if (sp.off > 3) { A(0.3 * q); line(x, y, sp.x, sp.y, col, 1.2, 0.3 * q); }
      A(0.18 * q); ctx.strokeStyle = MAT.ink; ctx.lineWidth = lead ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, fr, 0, TAU); ctx.stroke();
      A(0.95 * q * bl); ctx.strokeStyle = col; ctx.lineWidth = lead ? 4 : 2.5;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, fr, -Math.PI / 2, -Math.PI / 2 + left * TAU);
      ctx.stroke();
      if (lead) brackets(ctx, sp.x, sp.y, fr + 8, 8, col, 2.2, 0.8 * bl);
      ctx.globalAlpha = 1;
      if (lead) {
        top.sx = sp.x; top.sy = sp.y; top.sr = fr;
        lastDial = { x: sp.x, y: sp.y, fr: fr, off: sp.off, r: r };
      }
    }
    if (!top || domSpeaking()) return;
    /* one note, near the thing, only when nothing else on the page is speaking */
    var o2 = top.o;
    var bx = top.sx === undefined ? X(o2.x) : top.sx;
    var by = top.sy === undefined ? Y(o2.y) : top.sy;
    var br = (top.sr === undefined ? 30 : top.sr) + 10;
    var above = by - br - 62 > 18;
    var txt = o2.say || ((FZ.copy && FZ.copy.fire) ? FZ.copy.fire[o2.sym] : '');
    var tag = paperTag(txt, bx, above ? by - br - 8 : by + br + 8, above);
    if (!tag) return;
    A(0.55); ctx.strokeStyle = top.left < 0.34 ? SIG.red : SIG.amber; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(clamp(bx, tag.x + 8, tag.x + tag.w - 8), above ? tag.y + tag.h : tag.y);
    ctx.lineTo(bx, above ? by - br : by + br);
    ctx.stroke();
  }

  /* ================================================================== beats */
  function drawBeat(b, S) {
    var age = now - b.t, k = age / b.life;
    if (k >= 1) return false;
    var x = X(b.x), y = Y(b.y), e = ease(k);

    if (b.k === 'jolt') {
      A((1 - k) * 0.45); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.4;
      for (var i = 0; i < 5; i++) {
        var an = (i / 5) * TAU + b.t * 0.001;
        ctx.beginPath();
        ctx.arc(x, y, 8 + e * 20, an, an + 0.5);
        ctx.stroke();
      }
      return true;
    }
    if (b.k === 'haul') {
      /* the finished job walks to the store as grain */
      var tgt = L ? L.store : { x: x, y: y };
      var n = clamp(Math.round(b.v), 1, 6);
      for (var g = 0; g < n; g++) {
        var kk = clamp((k - g * 0.05) / 0.8, 0, 1);
        var px = x + (tgt.x - x) * ease(kk), py = y + (tgt.y - y) * ease(kk) - Math.sin(kk * Math.PI) * 16;
        A((1 - kk * 0.4) * 0.95); ctx.fillStyle = MAT.sand2;
        ctx.beginPath(); ctx.ellipse(px, py, 2.6, 2, kk * 4, 0, TAU); ctx.fill();
        A(0.5); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(px, py, 2.6, 2, kk * 4, 0, TAU); ctx.stroke();
      }
      A((1 - k) * 0.7); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 2;
      ctx.strokeRect(x - 8 - e * 10, y - 8 - e * 10, 16 + e * 20, 16 + e * 20);
      return true;
    }
    if (b.k === 'spill') {
      A((1 - k) * 0.9); ctx.fillStyle = MAT.sand2;
      for (var s = 0; s < 7; s++) {
        var sa = hash(b.t + s) * TAU, d = 4 + e * 22;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(sa) * d, y + Math.sin(sa) * d + e * e * 10, 2.2, 1.7, sa, 0, TAU);
        ctx.fill();
      }
      A((1 - k) * 0.7); ctx.strokeStyle = SIG.red; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
      return true;
    }
    if (b.k === 'holed') {
      /* the two faces meet and the passage is a passage: dust, and it is done */
      A((1 - k) * 0.6); ctx.fillStyle = MAT.sand2;
      for (var hh = 0; hh < 9; hh++) {
        var ha2 = hash(b.t + hh) * TAU, hd2 = 3 + e * 20;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(ha2) * hd2, y + Math.sin(ha2) * hd2 + e * e * 8, 2, 1.5, ha2, 0, TAU);
        ctx.fill();
      }
      return true;
    }
    if (b.k === 'way') {
      /* the way in, arriving: a bright length of floor running down the passage
         that just broke through, into the room that had nobody coming */
      var wx = X(b.tx), wy = Y(b.ty);
      var hd = clamp(e, 0, 1), tl = Math.max(0, hd - 0.3);
      A(0.8 * (1 - k * 0.7)); ctx.strokeStyle = MAT.paper; ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + (wx - x) * tl, y + (wy - y) * tl);
      ctx.lineTo(x + (wx - x) * hd, y + (wy - y) * hd);
      ctx.stroke();
      ctx.lineCap = 'butt';
      return true;
    }
    if (b.k === 'join') {
      /* THE DASHES CLOSE. Since the chapter began this outline has been saying
         "no tunnel reaches this chamber". A face has just broken through into
         it, so the gaps shut, one at a time, into a single solid line — and
         then the line lets go in one ring. Say nothing. */
      var jr = b.r || 20;
      var close = clamp(k / 0.5, 0, 1);
      var hold = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      A(0.9 * hold); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.3 + close * 1.6;
      if (close > 0.985) ctx.setLineDash([]);
      else {
        ctx.setLineDash([2 + close * 13, 4 * (1 - close) + 0.4]);
        ctx.lineDashOffset = -now * 0.02 * (1 - close);
      }
      ctx.beginPath(); ctx.arc(x, y, jr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      if (k > 0.42) {
        var ee = ease((k - 0.42) / 0.58);
        ring(x, y, jr + 4 + ee * 24, MAT.ink, 2.4 * (1 - ee), (1 - ee) * 0.55);
      }
      return true;
    }
    if (b.k === 'hurt') {
      A((1 - k) * 0.5); ctx.fillStyle = MAT.sand2;
      for (var h = 0; h < 8; h++) {
        var ha = (h / 8) * TAU, hd = 5 + e * 15;
        ctx.beginPath(); ctx.arc(x + Math.cos(ha) * hd, y + Math.sin(ha) * hd, 1.8 * (1 - k), 0, TAU); ctx.fill();
      }
      return true;
    }
    if (b.k === 'open') {
      brackets(ctx, x, y, 56 - e * 20, 11, SIG.amber, 2.6, 1 - k);
      ctx.globalAlpha = 1;
      return true;
    }
    if (b.k === 'shut') {
      var r0 = clamp((b.r || 60) * sx, 30, Math.min(W, H) * 0.33);
      ring(x, y, r0 * (1 - e * 0.8), SIG.teal, 3 - k * 2, (1 - k) * 0.95);
      A((1 - k) * 0.9); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 2.4;
      ctx.strokeRect(x - 9, y - 9, 18, 18);
      return true;
    }
    if (b.k === 'burst') {
      /* THE ROOF COMES IN. The damage is earth falling — that is the picture —
         and the red is one tight ring saying it landed HERE, close enough to
         the rubble to be part of it. It used to be a shockwave the width of a
         phone, which is not a signal, it is weather. */
      var r1 = clamp((b.r || 60) * sx * 0.5, 22, 54);
      ring(x, y, r1 * (0.7 + e * 0.35), SIG.red, 2.6 - k * 1.8, (1 - k) * 0.8);
      A((1 - k) * 0.8); ctx.fillStyle = MAT.soil3;
      for (var q = 0; q < 11; q++) {
        var qa = (q / 11) * TAU + hash(b.t + q) * 0.6;
        var qd = r1 * (0.15 + e * 0.55) * (0.6 + hash(q * 2.7) * 0.7);
        ctx.beginPath();
        ctx.arc(x + Math.cos(qa) * qd, y + Math.sin(qa) * qd + e * e * 7, 3.2 * (1 - k), 0, TAU);
        ctx.fill();
      }
      return true;
    }
    if (b.k === 'act') {
      var col = b.ok ? SIG.teal : SIG.red;
      A((1 - k) * 0.8); ctx.strokeStyle = col; ctx.lineWidth = 2;
      var ss = 10 + e * 26;
      ctx.strokeRect(x - ss / 2, y - ss / 2, ss, ss);
      return true;
    }
    if (b.k === 'end') {
      /* how a fight ended, in one mark: held, broken, walked away, still burning */
      var col2 = b.mode === 'truce' ? SIG.teal : b.mode === 'unsettled' ? SIG.amber : SIG.red;
      A((1 - k) * 0.85); ctx.strokeStyle = col2; ctx.lineWidth = 2;
      if (b.mode === 'truce') { ctx.beginPath(); ctx.arc(x, y - 2, 9, Math.PI, 0); ctx.stroke(); }
      else if (b.mode === 'force') { ctx.beginPath(); ctx.moveTo(x - 9, y + 8); ctx.lineTo(x - 9, y - 8); ctx.lineTo(x + 9, y - 8); ctx.stroke(); }
      else if (b.mode === 'passivity') { ctx.beginPath(); ctx.moveTo(x - 9, y + 6); ctx.lineTo(x + 9, y + 6); ctx.stroke(); }
      else { ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      return true;
    }
    return true;
  }

  /* ============================================================= aim preview */
  function aim(S) {
    var am = (window.FZ && FZ.controls) ? FZ.controls.aim : null;
    if (!am || am.x === undefined || am.x === null) return;
    var x = X(am.x), y = Y(am.y);
    var pulse = 0.7 + Math.sin(now * 0.006) * 0.2;
    if (am.kind === 'charter') {
      var r = ((FZ.sim && FZ.sim.charterR) || 82) * sx;
      A(0.5 * pulse); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      A(0.8 * pulse); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 2, 8, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 8, y - 2); ctx.lineTo(x - 8, y + 7);
      ctx.moveTo(x + 8, y - 2); ctx.lineTo(x + 8, y + 7); ctx.stroke();
      return;
    }
    if (am.kind === 'vary') {
      var vr = ((FZ.sim && FZ.sim.varyR) || 95) * sx;
      A(pulse * 0.8); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(x, y, vr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      var ags = S.agents || [];
      for (var i = 0; i < ags.length; i++) {
        var ddx = AX(ags[i]) - x, ddy = AY(ags[i]) - y;
        if (ddx * ddx + ddy * ddy < vr * vr) ring(AX(ags[i]), AY(ags[i]), 12, SIG.teal, 1.6, 0.8);
      }
      return;
    }
    if (am.kind === 'eject') {
      var best = null, bd = 46 * 46;
      var as = S.agents || [];
      for (var k = 0; k < as.length; k++) {
        var ex = AX(as[k]) - x, ey = AY(as[k]) - y, d2 = ex * ex + ey * ey;
        if (d2 < bd) { bd = d2; best = as[k]; }
      }
      if (best) {
        brackets(ctx, AX(best), AY(best), 17, 7, SIG.red, 2.4, pulse + 0.2);
        ctx.globalAlpha = 1;
      } else { brackets(ctx, x, y, 16, 6, MAT.ink, 2, 0.4); ctx.globalAlpha = 1; }
      return;
    }
    brackets(ctx, x, y, 15, 6, MAT.ink, 2, 0.5);
    ctx.globalAlpha = 1;
  }

  /* ================================================================== frame */
  function draw(S) {
    if (!ctx) return;
    now = performance.now();
    var dt = lastNow ? now - lastNow : 16;
    lastNow = now;
    frames++;
    wire();
    fitStep(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash([]);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    if (!S) {
      ctx.fillStyle = MAT.soil2; ctx.fillRect(0, 0, W, H);
      return;
    }
    sx = S.w ? W / S.w : 1;
    sy = S.h ? H / S.h : 1;

    if (typeof S.tick === 'number' && S.tick < lastTick) wipeMemory();
    lastTick = S.tick || 0;

    var agents = S.agents || [], jobs = S.jobs || [];
    agentIx.clear(); jobIx.clear();
    var i;
    for (i = 0; i < agents.length; i++) agentIx.set(agents[i].id, agents[i]);
    for (i = 0; i < jobs.length; i++) {
      var jb = jobs[i];
      jobIx.set(jb.id, jb);
      var pv = clamp((jb.progress || 0) / (jb.need || 1), 0, 1);
      var old = peak.get(jb.id);
      if (old === undefined || pv > old) peak.set(jb.id, pv);
      else if (old > pv) peak.set(jb.id, Math.max(pv, old - 0.003));
    }
    if (peak.size > 90) { peak.clear(); }

    if (!L || L.sig !== layoutSig(S)) buildLayout(S);
    else refreshNest(S);

    /* ============ WHERE EVERY BODY IS. CONTRACT §16, and the whole piece.
       SIM has already put every worker in a chamber, in a tunnel, at a dig face
       or on the surface — never in soil — so the position IS the truth and gets
       drawn as given. The only correction is crowding: bodies packed tighter
       than sixteen px are eased apart so a queue of eight is eight countable
       bodies, and anything the easing pushes at a wall is put back inside. */
    var sc = antScale(agents.length);
    var burnSet = burningWho(S);
    var spots = [];
    for (i = 0; i < agents.length; i++) {
      var ax0 = X(agents[i].x), ay0 = Y(agents[i].y);
      spots.push({ id: agents[i].id, x: ax0, y: ay0, ox: ax0, oy: ay0 });
    }
    spread(spots, sc, burnSet);
    drawn.clear();
    for (i = 0; i < spots.length; i++) drawn.set(spots[i].id, spots[i]);

    /* a worn floor: the routes the colony actually uses smooth out over time */
    var moved = false;
    for (i = 0; i < agents.length; i++) {
      var a3 = agents[i];
      if ((a3.stun || 0) > 0) continue;
      carve(AX(a3), AY(a3), 5, 0.02);
      moved = true;
      /* scent is a line laid by feet, not a puddle, and only a worker that
         knows where it is going lays any */
      var bd = bodyOf(a3.id);
      var px = AX(a3) * DS, py = AY(a3) * DS;
      if (a3.hold && a3.hold.length && !a3.chaseRumor && bd.lx !== undefined) {
        var seg = (px - bd.lx) * (px - bd.lx) + (py - bd.ly) * (py - bd.ly);
        if (seg > 0.04 && seg < 110) {
          tx.globalCompositeOperation = 'source-over';
          tx.globalAlpha = 0.075; tx.strokeStyle = SIG.blue;
          tx.lineWidth = 2.4; tx.lineCap = 'round';
          tx.beginPath(); tx.moveTo(bd.lx, bd.ly); tx.lineTo(px, py); tx.stroke();
          tx.globalAlpha = 1;
        }
      }
      bd.lx = px; bd.ly = py;
    }
    if (moved && (frames % 20) === 0) nestDirty = true;
    if ((frames % 4) === 0) {
      tx.globalCompositeOperation = 'destination-out';
      tx.globalAlpha = 0.02; tx.fillStyle = '#000000';
      tx.fillRect(0, 0, trail.width, trail.height);
      tx.globalCompositeOperation = 'source-over'; tx.globalAlpha = 1;
    }
    /* an institution that lands changes the shape of the nest for good */
    var chs = S.charters || [];
    for (i = 0; i < chs.length; i++) {
      var key = Math.round(chs[i].x) + ':' + Math.round(chs[i].y);
      if (stamped.has(key)) continue;
      stamped.add(key);
      carveChamber(X(chs[i].x), Y(chs[i].y), Math.max(26, (chs[i].r || 60) * sx * 0.92), 700 + stamped.size);
    }

    /* the earth is a composite of several full-canvas passes, and a live dig
       face dirties it every single frame. Rebuild at a third of frame rate:
       a tunnel growing half a pixel is not a thing anyone can see faster. */
    if ((nestDirty && (frames % 3) === 0) || frames < 3) rebuildNest();

    /* ---- the earth ---- */
    ctx.globalAlpha = 1;
    ctx.drawImage(nest, 0, 0, W, H);

    /* ---- what is known: scent, and you cannot see it without a lantern.
       It used to be washed in at fifteen percent all the time, which drew long
       pale rays across solid earth wherever a body changed rooms and read as a
       rendering fault. Scent is knowledge; knowledge is blue; blue only appears
       when somebody has lit the lamp. Traffic itself is told by wear, in earth. */
    if (S.lensOn) { A(1); ctx.drawImage(trail, 0, 0, W, H); ctx.globalAlpha = 1; }

    drawRoads(S);
    drawFaces(S);
    drawFlood(S);

    for (i = 0; i < chs.length; i++) drawCharter(chs[i]);

    drawStore(S);
    drawQueen(S);

    /* the rumour: a bright, confident scent to a chamber with nothing in it */
    if (S.rumor && taught('Gu')) {
      var rx = X(S.rumor.x), ry = Y(S.rumor.y), rp = 0.5 + Math.sin(now * 0.005) * 0.3;
      A(rp * 0.7); ctx.strokeStyle = SIG.blue; ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 4]);
      blobPath(ctx, rx, ry, 10, 5.5, 0.16); ctx.stroke();
      ctx.setLineDash([]);
      A(rp); ctx.strokeStyle = SIG.blue; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(rx, ry, 15 + Math.sin(now * 0.005) * 3, 0, TAU); ctx.stroke();
    }

    /* what the table is pointing at, if anything */
    var fsym = (window.FZ && FZ.table) ? FZ.table.focus : null;
    var fel = (fsym && FZ.ELBY) ? FZ.ELBY[fsym] : null;
    var fwho = fel ? idsOf(fel.who) : [];
    var fset = fwho.length ? new Set(fwho) : null;
    var dimBase = fset ? 0.42 : 1;

    outbreakGround(S);

    for (i = 0; i < jobs.length; i++) drawCrumb(jobs[i], S, dimBase);

    /* WHICH TUNNEL IT MEANS TO TAKE. With the lantern lit, every worker's route
       is drawn along the passages it will actually walk — not a straight line
       through solid earth, which would be a picture of something impossible.
       The one body with no line drawn is the one with no honest destination,
       and that is the puzzle: the lamp does not accuse anybody, it just shows
       intention, and one intention is missing. */
    if (S.lensOn && L) drawIntent(S, agents);

    for (i = 0; i < agents.length; i++) {
      var a2 = agents[i];
      drawAnt(a2, S, sc, (fset && !fset.has(a2.id)) ? dimBase : 1, burnSet ? burnSet.has(a2.id) : false);
    }
    drawJostle(S, sc);

    if (fset) {
      var wob = 0.55 + Math.sin(now * 0.007) * 0.35;
      for (i = 0; i < fwho.length; i++) {
        var fa = agentIx.get(fwho[i]);
        if (fa) ring(AX(fa), AY(fa), 14 * sc, MAT.paper, 2, wob);
      }
    }

    /* the bodies the burning incident is actually about, marked where they are.
       This is the causal beat with no sentence attached to it. */
    var top = urgent(S);
    if (top) {
      var tel = (FZ.ELBY && top.o.sym) ? FZ.ELBY[top.o.sym] : null;
      var twho = tel ? idsOf(tel.who) : [];
      var tc = top.left < 0.34 ? SIG.red : SIG.amber;
      var tp = 0.4 + Math.abs(Math.sin(now * 0.008)) * 0.4;
      /* only the bodies AT the incident. A colony-wide element can implicate
         thirteen workers, and thirteen rings scattered over the whole nest is
         not a causal beat, it is confetti. The ones inside the ground that is
         burning are the ones the player is being asked to look at. */
      var ox = X(top.o.x), oy = Y(top.o.y);
      var orr = clamp((top.o.r || 60) * sx, 30, Math.min(W, H) * 0.33) * 1.15;
      var marked = 0;
      for (i = 0; i < twho.length && marked < 8; i++) {
        var ta = agentIx.get(twho[i]);
        if (!ta) continue;
        var tx3 = AX(ta), ty3 = AY(ta);
        if ((tx3 - ox) * (tx3 - ox) + (ty3 - oy) * (ty3 - oy) > orr * orr) continue;
        ring(tx3, ty3, 9 * sc, tc, 1.7, tp);
        marked++;
      }
    }

    for (var b = beats.length - 1; b >= 0; b--) {
      if (now - beats[b].t >= beats[b].life) { beats.splice(b, 1); continue; }
      drawBeat(beats[b], S);
    }

    drawGrit(S);
    drawDark(S);
    aim(S);
    outbreakInstrument(S);

    /* the colony is being held at a speed a person can follow */
    if (S.slowUntil && S.tick < S.slowUntil) {
      A(0.55 + Math.sin(now * 0.004) * 0.2); ctx.strokeStyle = SIG.teal; ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    }
    ctx.globalAlpha = 1;
  }

  return {
    init: function (canvas) {
      cv = canvas;
      if (!cv) return;
      ctx = cv.getContext('2d');
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      wire(); warm();
      this.resize(cv.clientWidth || W, cv.clientHeight || H);
    },
    /* test hooks — read-only, for the placement/legibility harness */
    __drawn: function () { return drawn; },
    __dial: function () { return lastDial; },
    __fit: function () { return fit; },
    __joins: function () { return joins; },
    resize: function (w, h) {
      W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(h));
      if (!cv) return;
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      allocate();
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    draw: draw,
  };
})();
