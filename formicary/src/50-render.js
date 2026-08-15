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
  var wired = false, now = 0, sx = 1, sy = 1, frames = 0, nestDirty = true;
  var L = null;                       /* the nest layout */
  var beats = [];
  var bodies = new Map();             /* per-ant render memory: heading, gait, wobble */
  var agentIx = new Map(), jobIx = new Map();
  var peak = new Map(), hurtAt = new Map(), doneAt = new Map();
  var gimg = new Map();
  var stamped = new Set();            /* charters already carved into the nest */
  var lastTick = -1, floodMark = 0, spursMade = false;

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
    var n = clamp(Math.round(r / 2.6), 11, 30);
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
    stamped.clear(); floodMark = 0; spursMade = false; L = null; nestDirty = true;
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
    blobPath(dx, x, y, r, seed, 0.13); dx.fill();
    dx.restore();
    nestDirty = true;
  }
  function carveTunnel(x1, y1, x2, y2, w, seed) {
    dx.globalCompositeOperation = 'source-over';
    dx.globalAlpha = 1; dx.strokeStyle = '#ffffff';
    dx.lineCap = 'round'; dx.lineJoin = 'round';
    dx.save(); dx.scale(DS, DS);
    var nxv = -(y2 - y1), nyv = (x2 - x1), nl = Math.sqrt(nxv * nxv + nyv * nyv) || 1;
    nxv /= nl; nyv /= nl;
    /* a gallery is dug around what the earth allows, so it wanders */
    var steps = clamp(Math.round(nl / 13), 6, 30);
    var amp = Math.min(52, nl * 0.3);
    var px = x1, py = y1;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var off = Math.sin(t * Math.PI) * (Math.sin(t * 2.4 + seed) * 0.5) * amp
        + Math.sin(t * 5.1 + seed * 1.7) * amp * 0.2;
      var qx = x1 + (x2 - x1) * t + nxv * off;
      var qy = y1 + (y2 - y1) * t + nyv * off;
      dx.lineWidth = w * (0.72 + hash(seed * 2 + i) * 0.62);
      dx.beginPath(); dx.moveTo(px, py); dx.lineTo(qx, qy); dx.stroke();
      px = qx; py = qy;
    }
    dx.restore();
    nestDirty = true;
  }

  /* ------------------------------------------------------------- the layout
     Chambers sit on the jobs, on the queen, on the store. Tunnels are the
     minimum spanning tree between them plus the shaft to the surface. A
     dependency's tunnel is NOT dug: the path to a blocked job physically does
     not exist yet, which is the whole of "this is waiting on another one". */
  function layoutSig(S) {
    var s = W + 'x' + H + '|' + (S.id || '') + '|';
    var jb = S.jobs || [];
    for (var i = 0; i < jb.length; i++) s += jb[i].id + ',';
    return s;
  }
  function buildLayout(S) {
    var seed = (S.seed || 1) % 997;
    var oldSpurs = (L && L.spurs) ? L.spurs : [];
    var nodes = [];
    var entry = { x: W * (0.26 + hash(seed) * 0.46), y: 9, r: 10, kind: 'entry' };
    nodes.push(entry);
    var queen = { x: W * (0.34 + hash(seed + 4) * 0.32), y: H * 0.9, r: Math.min(34, W * 0.13), kind: 'queen' };
    var store = { x: W * (0.16 + hash(seed + 8) * 0.16), y: H * 0.73, r: Math.min(28, W * 0.11), kind: 'store' };
    nodes.push(queen, store);
    var jb = S.jobs || [];
    for (var i = 0; i < jb.length; i++) {
      nodes.push({
        x: X(jb[i].x), y: Y(jb[i].y), r: 17 + Math.min(13, (jb[i].value || 1) * 2.1),
        kind: 'job', id: jb[i].id
      });
    }
    /* minimum spanning tree, so the nest is one connected excavation */
    var edges = [], inT = [0], out = [];
    for (var k = 1; k < nodes.length; k++) out.push(k);
    while (out.length) {
      var bi = -1, bj = -1, bd = Infinity;
      for (var p = 0; p < inT.length; p++) {
        for (var q = 0; q < out.length; q++) {
          var a = nodes[inT[p]], b = nodes[out[q]];
          var d = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
          if (d < bd) { bd = d; bi = p; bj = q; }
        }
      }
      if (bi < 0) break;
      edges.push({ a: inT[bi], b: out[bj], seed: edges.length * 13 + seed });
      inT.push(out[bj]); out.splice(bj, 1);
    }
    var first = !spursMade;
    L = {
      nodes: nodes, edges: edges, entry: entry, queen: queen, store: store,
      seed: seed, sig: layoutSig(S), spurs: oldSpurs
    };

    /* NOTHING is wiped here. A finished job's chamber stays as a gallery, the
       tunnels the ants wore stay worn, and an institution's hall outlives the
       job it was built for. The nest only ever accumulates inside a run. */
    for (var c = 0; c < nodes.length; c++) {
      if (nodes[c].kind === 'entry') continue;
      carveChamber(nodes[c].x, nodes[c].y, nodes[c].r, seed + c * 3);
    }
    if (first) carveTunnel(entry.x, -6, entry.x, entry.y + 22, 16, seed + 91);
    for (var e = 0; e < edges.length; e++) edges[e].dug = false;
    stampReadyEdges(S);
    if (!first) return;

    /* side galleries and dead ends, dug once: a colony excavates more than it
       needs, and a quiet chapter must still look like somewhere ants live */
    spursMade = true;
    L.spurs = [];
    for (var g = 0; g < 7; g++) {
      var from = nodes[1 + Math.floor(hash(seed + g * 5.5) * (nodes.length - 1))];
      var an = hash(seed + g * 2.7) * TAU;
      var len = 34 + hash(seed + g * 9.1) * 62;
      var ex2 = clamp(from.x + Math.cos(an) * len, 14, W - 14);
      var ey2 = clamp(from.y + Math.sin(an) * len, 26, H - 14);
      carveTunnel(from.x, from.y, ex2, ey2, 9, seed + g * 31);
      carveChamber(ex2, ey2, 8 + hash(g) * 7, seed + g * 17);
      L.spurs.push({ x: ex2, y: ey2, r: 8 + hash(g) * 7, s: g });
    }
  }
  function edgeBlocked(e, S) {
    var na = L.nodes[e.a], nb = L.nodes[e.b];
    var n = na.kind === 'job' ? na : nb.kind === 'job' ? nb : null;
    if (!n) return false;
    var j = jobIx.get(n.id);
    if (!j || j.prereq === undefined || j.prereq === null || j.prereq === false) return false;
    if (!taught('Dp')) return false;
    var pj = jobIx.get(j.prereq);
    if (!pj) return false;
    return (pj.progress || 0) < (pj.need || 1);
  }
  function stampReadyEdges(S) {
    for (var i = 0; i < L.edges.length; i++) {
      var e = L.edges[i];
      if (e.dug) continue;
      if (edgeBlocked(e, S)) continue;
      var a = L.nodes[e.a], b = L.nodes[e.b];
      carveTunnel(a.x, a.y, b.x, b.y, 13, e.seed);
      e.dug = true;
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
    g.globalAlpha = 0.38; g.strokeStyle = SIG.red; g.lineWidth = 1.3;
    for (i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(x - 7 + i * 5, y + 8); g.lineTo(x - 2 + i * 5, y - 8); g.stroke();
    }
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
      for (var i = beats.length - 1; i >= 0; i--) if (beats[i].k === 'spill' && ++n > 3) beats.splice(i, 1);
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
    FZ.bus.on('outbreak:open', function (d) { if (d) push({ k: 'open', x: d.x, y: d.y, life: 560 }); });
    FZ.bus.on('outbreak:answered', function (d) {
      if (!d) return;
      push({ k: 'shut', x: d.x, y: d.y, r: d.r || 60, life: 900 });
    });
    FZ.bus.on('outbreak:landed', function (d) {
      if (!d) return;
      push({ k: 'burst', x: d.x, y: d.y, r: d.r || 60, life: 900 });
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

  function drawAnt(a, S, sc, dim) {
    var x = X(a.x), y = Y(a.y);
    var b = bodyOf(a.id);
    var vx = a.vx || 0, vy = a.vy || 0, spd = Math.sqrt(vx * vx + vy * vy);
    var held = (a.hold && a.hold.length) ? a.hold.length : 0;
    var idle = held === 0;
    var stunned = (a.stun || 0) > 0;
    var gave = !!a.gaveUp;
    var own = (a.terr || 0) > 0.5;

    if (spd > 0.04) { b.ang = angLerp(b.ang, Math.atan2(vy, vx), 0.22); b.mov = b.mov * 0.86 + 0.14; }
    else b.mov *= 0.9;
    /* an ant with nothing to do casts about; a loaded one holds its line */
    if (idle && !stunned) b.ang += Math.sin(now * 0.0016 + b.k * 21) * 0.055;
    b.ph += spd * (0.5 + (S.tempo || 1) * 0.22) + (stunned ? 0 : 0.02);

    var job = held ? jobIx.get(a.hold[0]) : null;
    var atWork = false;
    if (job) {
      var ddx = job.x - a.x, ddy = job.y - a.y;
      atWork = (ddx * ddx + ddy * ddy) < 26 * 26;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(stunned ? b.ang + 1.4 : b.ang);
    ctx.scale(sc, sc);
    var al = dim * (gave ? 0.7 : 1);

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

    /* --- legs: tripod gait, frozen and braced at work, curled when down --- */
    A(0.85 * al); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    var bases = [1.7, 0.2, -1.3];
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 3; i++) {
        var ph = b.ph + i * 2.0 + (s > 0 ? 0 : Math.PI);
        var sw = stunned ? 1.1 : gave ? -0.5 : atWork ? -0.35 : Math.sin(ph) * 0.9 * (0.35 + b.mov);
        var bx = bases[i];
        var kx = bx + 1.2 + sw * 0.9, ky = s * (2.4 + (stunned ? -1 : 0));
        var fx = bx + 2 + sw * 1.9, fy = s * (3.9 + (stunned ? -2.6 : gave ? -1.2 : 0));
        ctx.beginPath(); ctx.moveTo(bx, s * 1); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }
    }

    /* --- antennae: up and probing when working, down when idle, flat when spent --- */
    var wig = Math.sin(now * 0.009 + b.k * 13) * (idle ? 0.4 : 1.1);
    var droop = gave ? 2.8 : idle ? 2.1 : 0.3;
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
    /* --- struck --- */
    if (stunned) {
      A(0.85 * dim); ctx.strokeStyle = SIG.red; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 4, y - 11 * sc); ctx.lineTo(x + 4, y - 11 * sc); ctx.stroke();
    }
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
    A(0.98 * a); ctx.fillStyle = MAT.sand2;
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
      var n = clamp(Math.round(j.value || 1), 1, 6);
      A(0.8 * a); ctx.fillStyle = SIG.blue;
      for (var v = 0; v < n; v++) ctx.fillRect(jx - n * 2.2 + v * 4.4, jy - r - 7, 2.6, 3);
    }
    /* everybody hauling on one crumb, pulling in different directions */
    if (nclaim > 1 && taught('Co')) {
      var cl = idsOf(j.claims);
      for (var c = 0; c < cl.length; c++) {
        var ca = agentIx.get(cl[c]);
        if (!ca) continue;
        var ax = X(ca.x), ay = Y(ca.y);
        var d = Math.sqrt((ax - jx) * (ax - jx) + (ay - jy) * (ay - jy)) || 1;
        if (d > 90) continue;
        A(0.5 * dim); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(jx + (ax - jx) / d * r, jy + (ay - jy) / d * r);
        ctx.lineTo(ax - (ax - jx) / d * 6, ay - (ay - jy) / d * 6);
        ctx.stroke();
      }
    }
  }

  function prereqMet(j) {
    var pj = jobIx.get(j.prereq);
    if (!pj) return true;
    return (pj.progress || 0) >= (pj.need || 1);
  }
  /* a dependency is a tunnel nobody has dug yet */
  function plannedTunnels(S) {
    if (!L) return;
    for (var i = 0; i < L.edges.length; i++) {
      var e = L.edges[i];
      if (e.dug) continue;
      var a = L.nodes[e.a], b = L.nodes[e.b];
      A(0.45); ctx.strokeStyle = MAT.ink; ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = -now * 0.006;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
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
    if (k > 0.8) {
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
        var ddx = X(b.x) - X(a.x), ddy = Y(b.y) - Y(a.y);
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 > l2 || d2 < 0.01) continue;
        var k = 1 - Math.sqrt(d2) / lim;
        var mxp = (X(a.x) + X(b.x)) / 2, myp = (Y(a.y) + Y(b.y)) / 2;
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
    ctx.font = '12px "IBM Plex Mono",ui-monospace,monospace';
    var maxw = Math.min(W - 30, 244);
    var ls = wrap(text, maxw - 20);
    if (!ls.length) return null;
    var tw = 0;
    for (var i = 0; i < ls.length; i++) tw = Math.max(tw, ctx.measureText(ls[i]).width);
    var bw = tw + 20, bh = 13 + ls.length * 15;
    var bx = clamp(cx - bw / 2, 6, W - bw - 6);
    var by = above ? cy - bh : cy;
    by = clamp(by, 16, H - bh - 6);
    A(0.2); ctx.fillStyle = MAT.ink; ctx.fillRect(bx + 2, by + 3, bw, bh);
    A(0.97); ctx.fillStyle = MAT.paper; ctx.fillRect(bx, by, bw, bh);
    A(0.5); ctx.strokeStyle = MAT.ink2; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    A(0.95); ctx.fillStyle = MAT.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (var l = 0; l < ls.length; l++) ctx.fillText(ls[l], bx + 10, by + 19 + l * 15);
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
      var q = lead ? 1 : 0.4;
      A(0.09 * q); ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
  /* The fuse is the boundary itself draining away. It cannot come adrift from
     the place it belongs to, and it needs no numerals to be read. */
  function outbreakInstrument(S) {
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
      var q = lead ? 1 : 0.42;
      /* the ground that is still in danger */
      A(0.22 * q * bl); ctx.strokeStyle = col; ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      /* the time left, on a compact dial at the spot — the wide dashed ring is
         how far an answer may land, the dial is how long it has */
      var fr = clamp(r * 0.5, 25, 44);
      A(0.18 * q); ctx.strokeStyle = MAT.ink; ctx.lineWidth = lead ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(x, y, fr, 0, TAU); ctx.stroke();
      A(0.95 * q * bl); ctx.strokeStyle = col; ctx.lineWidth = lead ? 4 : 2.5;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.arc(x, y, fr, -Math.PI / 2, -Math.PI / 2 + left * TAU);
      ctx.stroke();
      if (lead) brackets(ctx, x, y, fr + 8, 8, col, 2.2, 0.8 * bl);
      ctx.globalAlpha = 1;
    }
    if (!top || domSpeaking()) return;
    /* one note, near the thing, only when nothing else on the page is speaking */
    var o2 = top.o, bx = X(o2.x), by = Y(o2.y);
    var br = clamp(clamp((o2.r || 60) * sx, 30, Math.min(W, H) * 0.33) * 0.5, 25, 44) + 10;
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
      var r1 = clamp((b.r || 60) * sx, 30, Math.min(W, H) * 0.33);
      ring(x, y, r1 * (1 + e * 0.4), SIG.red, 3.5 - k * 2.6, (1 - k) * 0.9);
      A((1 - k) * 0.75); ctx.fillStyle = MAT.soil3;
      for (var q = 0; q < 10; q++) {
        var qa = (q / 10) * TAU, qd = r1 * (0.2 + e * 0.5);
        ctx.beginPath(); ctx.arc(x + Math.cos(qa) * qd, y + Math.sin(qa) * qd, 3 * (1 - k), 0, TAU); ctx.fill();
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
        var ddx = X(ags[i].x) - x, ddy = Y(ags[i].y) - y;
        if (ddx * ddx + ddy * ddy < vr * vr) ring(X(ags[i].x), Y(ags[i].y), 12, SIG.teal, 1.6, 0.8);
      }
      return;
    }
    if (am.kind === 'eject') {
      var best = null, bd = 46 * 46;
      var as = S.agents || [];
      for (var k = 0; k < as.length; k++) {
        var ex = X(as[k].x) - x, ey = Y(as[k].y) - y, d2 = ex * ex + ey * ey;
        if (d2 < bd) { bd = d2; best = as[k]; }
      }
      if (best) {
        brackets(ctx, X(best.x), Y(best.y), 17, 7, SIG.red, 2.4, pulse + 0.2);
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
    frames++;
    wire();
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
    else stampReadyEdges(S);

    /* every worker excavates as it walks, and lays scent as it goes */
    var moved = false;
    for (i = 0; i < agents.length; i++) {
      var a = agents[i];
      if ((a.stun || 0) > 0) continue;
      /* one pass leaves a scuff; a route used over and over becomes a tunnel */
      carve(X(a.x), Y(a.y), 6.5, 0.022);
      moved = true;
      /* scent is a line laid by feet, not a puddle, and only a worker that
         knows where it is going lays any */
      var bd = bodyOf(a.id);
      var px = X(a.x) * DS, py = Y(a.y) * DS;
      if (a.hold && a.hold.length && !a.chaseRumor && bd.lx !== undefined) {
        var seg = (px - bd.lx) * (px - bd.lx) + (py - bd.ly) * (py - bd.ly);
        if (seg > 0.04 && seg < 900) {
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

    if (nestDirty || frames < 3) rebuildNest();

    /* ---- the earth ---- */
    ctx.globalAlpha = 1;
    ctx.drawImage(nest, 0, 0, W, H);

    /* ---- what is known: scent, invisible unless somebody lit a lantern ---- */
    var lit = S.lensOn ? 1 : clamp(0.15 - (S.blind || 0) * 0.12, 0, 0.15);
    if (lit > 0.03) { A(lit); ctx.drawImage(trail, 0, 0, W, H); ctx.globalAlpha = 1; }

    plannedTunnels(S);
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

    /* intention lines, only where the lantern is lit */
    if (S.lensOn) {
      for (i = 0; i < agents.length; i++) {
        var ag = agents[i];
        var tj = (ag.hold && ag.hold.length) ? jobIx.get(ag.hold[0]) : null;
        if (!tj) continue;
        A(0.75); ctx.strokeStyle = SIG.blue; ctx.lineWidth = 1.3;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(X(ag.x), Y(ag.y)); ctx.lineTo(X(tj.x), Y(tj.y)); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    var sc = antScale(agents.length);
    for (i = 0; i < agents.length; i++) {
      var a2 = agents[i];
      drawAnt(a2, S, sc, (fset && !fset.has(a2.id)) ? dimBase : 1);
    }
    drawJostle(S, sc);

    if (fset) {
      var wob = 0.55 + Math.sin(now * 0.007) * 0.35;
      for (i = 0; i < fwho.length; i++) {
        var fa = agentIx.get(fwho[i]);
        if (fa) ring(X(fa.x), Y(fa.y), 14 * sc, MAT.paper, 2, wob);
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
      for (i = 0; i < twho.length && i < 8; i++) {
        var ta = agentIx.get(twho[i]);
        if (!ta) continue;
        ring(X(ta.x), Y(ta.y), 11 * sc, tc, 1.6, tp);
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
