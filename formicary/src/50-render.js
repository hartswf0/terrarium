/* ============================================================
   50-render.js — THE FIELD.  OWNER: FIELD.
   FZ.render = { init(canvas), resize(w,h), draw(S) }

   Rules obeyed here:
     - S is read, never written.
     - Colors are only the six palette literals. Every tint is done with
       ctx.globalAlpha over a palette literal, so no derived color exists.
     - The field is always black: a lit vitrine, legible on a light or dark page.
     - The causal beat (Law 3) is the point of this file. Every failure is drawn
       AT the coordinate where it happened, pointing at the bodies responsible,
       carrying the element's own mark, decaying in about a second.
   ============================================================ */
FZ.render = (function () {
  'use strict';

  var C = { teal: '#19e6c8', amber: '#ffd23f', red: '#ff2e2e', blue: '#3b82f6', white: '#ffffff', black: '#000000' };
  /* lineage -> one of five palette values. Red is last so it is rare. */
  var LINEAGE = [C.teal, C.amber, C.blue, C.white, C.red];
  var TAU = Math.PI * 2;

  var cv = null, ctx = null, dpr = 1, W = 360, H = 300;
  var wired = false, now = 0, sx = 1, sy = 1;
  var beats = [];                 // transient causal marks
  var dots = null;                // cached pattern: charter interior
  var peak = new Map();           // job id -> best progress seen (rollback ghost)
  var hurtAt = new Map();         // agent id -> t of last stun
  var gimg = new Map();           // 'sym|color' -> {img, ok}
  var agentIx = new Map();        // per-frame id -> agent
  var jobIx = new Map();          // per-frame id -> job
  var lastTick = -1;
  var tickMine = '', tickAt = 0;

  /* ---------------------------------------------------------- small helpers */
  function A(a) { ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a; }
  function X(v) { return v * sx; }
  function Y(v) { return v * sy; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function ring(x, y, r, col, lw, a) {
    if (r <= 0) return;
    A(a); ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  function disc(x, y, r, col, a) {
    A(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function box(x, y, s, col, lw, a) {
    A(a); ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.strokeRect(x - s / 2 + lw / 2, y - s / 2 + lw / 2, s - lw, s - lw);
  }
  function line(x1, y1, x2, y2, col, lw, a) {
    A(a); ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  /* four L brackets converging on a point — the "this, here" mark */
  function brackets(x, y, r, len, col, lw, a) {
    A(a); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'butt';
    var d = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (var i = 0; i < 4; i++) {
      var ox = d[i][0] * r, oy = d[i][1] * r;
      ctx.beginPath();
      ctx.moveTo(x + ox - d[i][0] * len, y + oy);
      ctx.lineTo(x + ox, y + oy);
      ctx.lineTo(x + ox, y + oy - d[i][1] * len);
      ctx.stroke();
    }
  }
  function lineage(h) {
    var i = 0;
    if (typeof h === 'number' && isFinite(h)) i = h > 4 ? Math.round(h / 72) : Math.round(h);
    i = ((i % LINEAGE.length) + LINEAGE.length) % LINEAGE.length;
    return LINEAGE[i];
  }
  /* The field only shouts about failures this chapter has taught. Chapter one has
     to look calm even when two workers happen to share a job. */
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

  /* -------------------------------------------------- element mark, on canvas
     The same drawn glyph the table cell shows, rasterized once per colour.
     This is what makes a fire on the field and a cell in the table the same
     object in the player's head. */
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
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 20 20"' +
      ' fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">' +
      inner + '</svg>';
    var img = new Image();
    var r = { ok: true, img: img };
    img.onerror = function () { r.ok = false; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    gimg.set(k, r);
    return null;
  }
  /* fallback mark so a beat always has an identity even if a glyph is missing */
  function fallbackMark(x, y, s, col, a) {
    box(x, y, s, col, 1.5, a);
    line(x - s / 2, y + s / 2, x + s / 2, y - s / 2, col, 1.5, a);
  }
  function markAt(sym, x, y, s, col, a) {
    var im = glyph(sym, col);
    if (im) { A(a); ctx.drawImage(im, x - s / 2, y - s / 2, s, s); }
    else fallbackMark(x, y, s * 0.72, col, a);
  }
  function warm() {
    if (!window.FZ || !FZ.EL) return;
    for (var i = 0; i < FZ.EL.length; i++) { glyph(FZ.EL[i].sym, C.red); glyph(FZ.EL[i].sym, C.white); }
  }

  /* A named tag: the element's own mark plus its two letters, on a hard plate.
     Fires and outbreaks share it, so the flash and the thing it leaves behind
     are visibly the same object. */
  function tag(sym, cx, cy, col, al) {
    ctx.font = '700 14px "IBM Plex Mono",ui-monospace,monospace';
    var tw = ctx.measureText(sym || '').width;
    var bw = 26 + tw + 11, bh = 26;
    var bx = Math.max(3, Math.min(W - bw - 3, cx - bw / 2));
    var by = Math.max(3, Math.min(H - bh - 3, cy - bh / 2));
    A(al); ctx.fillStyle = C.black; ctx.fillRect(bx, by, bw, bh);
    A(al); ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.strokeRect(bx + 1.25, by + 1.25, bw - 2.5, bh - 2.5);
    markAt(sym, bx + 14, by + bh / 2, 17, col, al);
    A(al); ctx.fillStyle = col;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(sym || '', bx + 25, by + bh / 2 + 1);
    return { x: bx, y: by, w: bw, h: bh };
  }

  /* ------------------------------------------------------------------ beats */
  function push(b) {
    b.t = now || performance.now();
    if (b.k === 'fire') {
      /* one element, one tag: a re-fire moves the mark, it does not stack a second one */
      var fi = [];
      for (var i = beats.length - 1; i >= 0; i--) {
        if (beats[i].k !== 'fire') continue;
        if (beats[i].sym === b.sym) beats.splice(i, 1); else fi.unshift(i);
      }
      /* and never let more than three named failures shout at once */
      for (var k = 0; k <= fi.length - 3; k++) beats.splice(fi[k] - k, 1);
    }
    beats.push(b);
    if (beats.length > 12) beats.splice(0, beats.length - 12);
  }

  function ticker(text) {
    var el = document.getElementById('ticker');
    if (!el || text === undefined || text === null) return;
    if (text === tickMine) { tickAt = performance.now(); return; }
    if (!text) { if (el.textContent === tickMine) { el.textContent = ''; el.removeAttribute('data-tone'); } tickMine = ''; return; }
    el.textContent = text;
    el.setAttribute('data-tone', 'bad');
    el.classList.remove('tkin');
    void el.offsetWidth;
    el.classList.add('tkin');
    tickMine = text; tickAt = performance.now();
  }
  /* While something is burning, the readout says THAT — the sentence the player is
     being asked to answer, not whatever fired most recently. */
  function tickerHold(S) {
    var O = live();
    if (!O) return;
    var best = null, bl = 2;
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (!o || (o.state && o.state !== 'burning')) continue;
      var l = o.fuse ? 1 - ((S.tick || 0) - (o.born || 0)) / o.fuse : 1;
      if (l < bl) { bl = l; best = o; }
    }
    if (best) ticker(best.say || ((FZ.copy && FZ.copy.fire) ? FZ.copy.fire[best.sym] : '') || '');
  }

  function tickerAge() {
    if (!tickMine) return;
    if (now - tickAt < 4200) return;
    var el = document.getElementById('ticker');
    if (el && el.textContent === tickMine) { el.textContent = ''; el.removeAttribute('data-tone'); }
    tickMine = '';
  }

  function wire() {
    if (wired || !window.FZ || !FZ.bus) return;
    wired = true;
    FZ.bus.on('fire', function (d) {
      if (!d) return;
      var at = d.at || {};
      push({ k: 'fire', sym: d.sym, x: at.x, y: at.y, who: idsOf(d.who), life: 1250 });
      ticker(d.say || '');
    });
    FZ.bus.on('job:done', function (d) { if (d) push({ k: 'done', x: d.x, y: d.y, v: d.value || 1, life: 780 }); });
    FZ.bus.on('job:lost', function (d) {
      if (!d) return;
      var n = 0;                       /* a wave of rollbacks must not bury the field */
      for (var i = beats.length - 1; i >= 0; i--) if (beats[i].k === 'lost' && ++n > 3) { beats.splice(i, 1); }
      push({ k: 'lost', x: d.x, y: d.y, life: 780 });
    });
    FZ.bus.on('agent:hurt', function (d) {
      if (!d) return;
      push({ k: 'hurt', x: d.x, y: d.y, life: 520 });
      if (d.id !== undefined) hurtAt.set(d.id, performance.now());
    });
    FZ.bus.on('intervene', function (d) {
      if (!d || d.x === undefined || d.x === null) return;
      push({ k: 'act', x: d.x, y: d.y, ok: !!d.ok, life: 620 });
    });
    /* the outbreak loop: opening, closing, and the mark a miss leaves behind */
    FZ.bus.on('outbreak:open', function (d) { if (d) push({ k: 'open', sym: d.sym, x: d.x, y: d.y, life: 620 }); });
    FZ.bus.on('outbreak:answered', function (d) {
      if (!d) return;
      push({ k: 'shut', sym: d.sym, x: d.x, y: d.y, r: d.r || 60, life: 900 });
      ticker('');
    });
    FZ.bus.on('outbreak:landed', function (d) {
      if (!d) return;
      push({ k: 'land', sym: d.sym, x: d.x, y: d.y, r: d.r || 60, life: 1000 });
      push({ k: 'scar', x: d.x, y: d.y, life: 14000 });
    });
  }

  /* ------------------------------------------------------------- background */
  function pattern() {
    if (dots) return dots;
    var p = document.createElement('canvas');
    p.width = 10; p.height = 10;
    var c2 = p.getContext('2d');
    c2.fillStyle = C.teal; c2.globalAlpha = 0.5;
    c2.fillRect(0, 0, 1.5, 1.5);
    c2.fillRect(5, 5, 1.5, 1.5);
    dots = ctx.createPattern(p, 'repeat');
    return dots;
  }

  function grid() {
    var g = Math.max(38, Math.round(Math.min(W, H) / 6));
    A(0.042); ctx.strokeStyle = C.white; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = g; x < W; x += g) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
    for (var y = g; y < H; y += g) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
    ctx.stroke();
  }
  /* one mark size for the whole field, so a tall phone field is not a wall of specks */
  function zoom() {
    return Math.max(0.9, Math.min(1.5, Math.sqrt((W * H) / (360 * 300))));
  }

  /* ---------------------------------------------------------------- charter
     An institution has to look like a place with an inside and an outside:
     patterned ground, a hard dashed wall, and posts pointing inward. */
  function charter(cx, cy, r, a, live) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    A(0.2 * a); ctx.fillStyle = pattern(); ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    A(0.07 * a); ctx.fillStyle = C.teal; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    A(0.5 * a); ctx.strokeStyle = C.teal; ctx.lineWidth = 2;
    ctx.setLineDash(live ? [7, 5] : [4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    A(0.62 * a); ctx.lineWidth = 2;
    for (var i = 0; i < 16; i++) {
      var an = (i / 16) * TAU, c = Math.cos(an), s = Math.sin(an);
      ctx.beginPath();
      ctx.moveTo(cx + c * r, cy + s * r);
      ctx.lineTo(cx + c * (r - 6), cy + s * (r - 6));
      ctx.stroke();
    }
  }

  /* --------------------------------------------------------------- outbreaks
     The core loop, drawn: a bounded place, a clock you can see run out, and the
     name of the thing you are being asked to answer. Pass 2 draws the tags so
     they sit above every body on the field. */
  function live() {
    var o = (window.FZ && FZ.outbreak && FZ.outbreak.list) ? FZ.outbreak.list : null;
    return (o && o.length) ? o : null;
  }

  function outbreaks(S, pass) {
    var O = live();
    if (!O) return;
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (!o || (o.state && o.state !== 'burning')) continue;
      var x = X(o.x), y = Y(o.y), r = Math.max(26, (o.r || 60) * sx);
      var fuse = o.fuse || 1;
      var left = Math.max(0, Math.min(1, 1 - ((S.tick || 0) - (o.born || 0)) / fuse));
      var urgent = left < 0.34;
      var blink = urgent ? 0.55 + Math.abs(Math.sin(now * 0.012)) * 0.45 : 1;

      if (pass === 1) {
        /* the ground it covers */
        A(0.055 * blink); ctx.fillStyle = C.red;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        /* its boundary */
        A(0.42 * blink); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); ctx.lineDashOffset = -now * 0.012;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        /* the fuse: a clock you read by looking, not by counting */
        A(0.16); ctx.strokeStyle = C.white; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, r - 4, 0, TAU); ctx.stroke();
        if (left > 0) {
          A(0.98 * blink); ctx.strokeStyle = C.red; ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, r - 4, -Math.PI / 2, -Math.PI / 2 + left * TAU);
          ctx.stroke();
          var ha = -Math.PI / 2 + left * TAU;
          A(blink); ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(ha) * (r - 10), y + Math.sin(ha) * (r - 10));
          ctx.lineTo(x + Math.cos(ha) * (r + 2), y + Math.sin(ha) * (r + 2));
          ctx.stroke();
        }
        /* it is doing damage the whole time it burns */
        var pr = (now * 0.05) % 60;
        A((1 - pr / 60) * 0.28 * blink);
        ctx.strokeStyle = C.red; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r - pr * (r / 60), 0, TAU); ctx.stroke();
      } else {
        var ty = y - r - 18;
        if (ty < 16) ty = y + r + 18;
        tag(o.sym, x, ty, C.red, blink);
        A(0.5 * blink); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, ty < y ? ty + 13 : ty - 13);
        ctx.lineTo(x, ty < y ? y - r : y + r);
        ctx.stroke();
      }
    }
  }

  /* ------------------------------------------------------------------- jobs */
  function jobSide(j) {
    var v = typeof j.value === 'number' ? j.value : 1;
    return Math.max(16, Math.min(34, 14 + v * 3.6)) * zoom();
  }

  function drawJob(j, dim, S) {
    var x = X(j.x), y = Y(j.y), s = jobSide(j), h = s / 2;
    var need = j.need || 1;
    var p = Math.max(0, Math.min(1, (j.progress || 0) / need));
    var blocked = j.prereq !== undefined && j.prereq !== null && j.prereq !== false && !prereqMet(j, S);
    var a = dim * (blocked ? 0.78 : 1);

    /* plate: an unstarted job still has to read as an object, not an outline */
    A(0.95 * a); ctx.fillStyle = C.black; ctx.fillRect(x - h, y - h, s, s);
    A(0.1 * a); ctx.fillStyle = C.white; ctx.fillRect(x - h, y - h, s, s);

    /* progress — bold, bottom-up, unmistakable at arm's length */
    if (p > 0) {
      var ih = (s - 6) * p;
      A(0.92 * a); ctx.fillStyle = C.teal;
      ctx.fillRect(x - h + 3, y + h - 3 - ih, s - 6, ih);
    }
    /* the ghost of progress already paid for — makes rollback visible */
    var pk = peak.get(j.id);
    if (pk !== undefined && pk > p + 0.04) {
      var gy = y + h - 3 - (s - 6) * pk;
      line(x - h + 2, gy, x + h - 2, gy, C.amber, 1.5, 0.85 * a);
      A(0.85 * a); ctx.fillStyle = C.amber;
      ctx.beginPath();
      ctx.moveTo(x + h - 2, gy); ctx.lineTo(x + h + 3, gy - 4); ctx.lineTo(x + h + 3, gy + 4);
      ctx.fill();
    }

    var contested = j.claims && (j.claims.size || j.claims.length || 0) > 1 && taught('Co');
    box(x, y, s, contested ? C.red : C.white, contested ? 2.5 : 2, (contested ? 0.98 : 0.85) * a);

    /* contested: two heads pointing in from opposite sides */
    if (contested) {
      A(0.95 * a); ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.moveTo(x - h - 7, y - 5); ctx.lineTo(x - h - 7, y + 5); ctx.lineTo(x - h - 1, y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + h + 7, y - 5); ctx.lineTo(x + h + 7, y + 5); ctx.lineTo(x + h + 1, y); ctx.fill();
    }
    /* poison, once someone can see it */
    if (j.poison && j.revealed) {
      A(0.95 * a); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - h + 3, y - h + 3); ctx.lineTo(x + h - 3, y + h - 3);
      ctx.moveTo(x + h - 3, y - h + 3); ctx.lineTo(x - h + 3, y + h - 3);
      ctx.stroke();
    }
    /* locked: a bar across it, held by nobody working */
    if (j.locked && taught('Lo')) {
      A(0.95 * a); ctx.fillStyle = C.amber;
      ctx.fillRect(x - h - 3, y - 2.5, s + 6, 5);
      ctx.fillRect(x - 2.5, y - h - 4, 5, 5);
      ctx.fillRect(x - 2.5, y + h - 1, 5, 5);
    }
    /* value pips, surfaced by the lens */
    if (S && S.lensOn) {
      var n = Math.max(1, Math.min(6, Math.round(j.value || 1)));
      A(0.75 * a); ctx.fillStyle = C.white;
      for (var i = 0; i < n; i++) ctx.fillRect(x - h + 3 + i * 4, y - h - 5, 2.5, 3);
    }
    if (j.flash) box(x, y, s + 8 + (1 - Math.min(1, j.flash)) * 6, C.white, 2, 0.5 * Math.min(1, j.flash) * a);
  }

  function prereqMet(j, S) {
    var pid = j.prereq;
    var pj = jobIx.get(pid);
    if (!pj) return true;
    return (pj.progress || 0) >= (pj.need || 1);
  }

  function prereqLinks(S, dim) {
    var jobs = S.jobs || [];
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      if (j.prereq === undefined || j.prereq === null || j.prereq === false) continue;
      if (!taught('Dp')) continue;
      var pj = jobIx.get(j.prereq);
      if (!pj) continue;
      var done = (pj.progress || 0) >= (pj.need || 1);
      var x1 = X(pj.x), y1 = Y(pj.y), x2 = X(j.x), y2 = Y(j.y);
      A(done ? 0.3 : 0.7); ctx.strokeStyle = done ? C.teal : C.amber; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      var an = Math.atan2(y2 - y1, x2 - x1), hx = x2 - Math.cos(an) * 20, hy = y2 - Math.sin(an) * 20;
      A(done ? 0.35 : 0.9); ctx.fillStyle = done ? C.teal : C.amber;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(an) * 6, hy + Math.sin(an) * 6);
      ctx.lineTo(hx + Math.cos(an + 2.5) * 6, hy + Math.sin(an + 2.5) * 6);
      ctx.lineTo(hx + Math.cos(an - 2.5) * 6, hy + Math.sin(an - 2.5) * 6);
      ctx.fill();
    }
  }

  /* ----------------------------------------------------------------- agents */
  function drawAgent(a, r, dim, S) {
    var x = X(a.x), y = Y(a.y);
    var col = lineage(a.hue);
    var stunned = (a.stun || 0) > 0;
    var idle = a.job === null || a.job === undefined || a.job === false;

    /* a hard black halo so a pile of workers on one job stays countable */
    disc(x, y, r + 1.7, C.black, 1);

    if (stunned) {
      /* struck: hollow, red-slashed, visibly out of the economy */
      disc(x, y, r, col, 0.18 * dim);
      ring(x, y, r, col, 1.2, 0.42 * dim);
      A(0.7 * dim); ctx.strokeStyle = C.red; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 0.8); ctx.lineTo(x + r * 0.8, y + r * 0.8);
      ctx.moveTo(x + r * 0.8, y - r * 0.8); ctx.lineTo(x - r * 0.8, y + r * 0.8);
      ctx.stroke();
    } else if (idle) {
      /* waiting: hollow ring, obviously not doing work */
      disc(x, y, r * 0.34, col, 0.75 * dim);
      ring(x, y, r - 1, col, 1.5, 0.55 * dim);
    } else {
      /* working: solid body */
      disc(x, y, r, col, 0.95 * dim);
      A(0.9 * dim); ctx.fillStyle = C.black;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    /* holding more work than it can do: one tick per job, all of them rotting */
    var hn = (a.hold && a.hold.length && taught('Ow')) ? a.hold.length : 0;
    if (hn > 1) {
      A(0.9 * dim); ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
      for (var q2 = 0; q2 < hn && q2 < 5; q2++) {
        var qa = -Math.PI / 2 + (q2 - (Math.min(hn, 5) - 1) / 2) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(qa) * (r + 2), y + Math.sin(qa) * (r + 2));
        ctx.lineTo(x + Math.cos(qa) * (r + 6), y + Math.sin(qa) * (r + 6));
        ctx.stroke();
      }
    }
    /* incorrigible: a hard shell nothing you do gets through */
    if ((a.corrigible === false || a.incorrigible) && taught('Cr')) {
      A(0.85 * dim); ctx.strokeStyle = C.red; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var i = 0; i < 8; i++) {
        var an = (i / 8) * TAU + 0.39, px = x + Math.cos(an) * (r + 3.5), py = y + Math.sin(an) * (r + 3.5);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
    if (a.flash) ring(x, y, r + 3 + (1 - Math.min(1, a.flash)) * 5, C.white, 2, 0.55 * Math.min(1, a.flash) * dim);
    var ht = hurtAt.get(a.id);
    if (ht !== undefined && now - ht < 600) ring(x, y, r + 4, C.red, 1.5, (1 - (now - ht) / 600) * 0.8 * dim);
  }

  /* is a burning outbreak already naming this failure at this spot? */
  function covered(b) {
    var O = live();
    if (!O) return false;
    for (var i = 0; i < O.length; i++) {
      var o = O[i];
      if (!o || o.sym !== b.sym || (o.state && o.state !== 'burning')) continue;
      var dx = o.x - b.x, dy = o.y - b.y;
      if (dx * dx + dy * dy < 3600) return true;
    }
    return false;
  }

  /* -------------------------------------------------------- the causal beat */
  function drawBeat(b) {
    var age = now - b.t, k = age / b.life;
    if (k >= 1) return false;
    var x = X(b.x), y = Y(b.y);

    if (b.k === 'fire') {
      var hold = 0.55;
      var fade = k < hold ? 1 : 1 - (k - hold) / (1 - hold);
      var snap = Math.min(1, age / 150);

      /* shockwave from the exact spot */
      if (k < 0.5) ring(x, y, 6 + ease(k / 0.5) * 52, C.red, 3.5 - k * 5, (1 - k / 0.5) * 0.95);

      /* brackets snapping onto the spot: "this, here" */
      brackets(x, y, 44 - ease(snap) * 18, 8, C.red, 2.5, fade);

      /* tethers to the bodies responsible */
      for (var i = 0; i < b.who.length; i++) {
        var ag = agentIx.get(b.who[i]);
        if (!ag) continue;
        var ax = X(ag.x), ay = Y(ag.y);
        A(0.8 * fade); ctx.strokeStyle = C.red; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]); ctx.lineDashOffset = -age * 0.03;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ax, ay); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        ring(ax, ay, 11 + Math.sin(age * 0.012) * 1.5, C.red, 2, 0.95 * fade);
      }

      /* the name, at the place — unless an outbreak already stands here saying it */
      if (b.sym && !covered(b)) {
        var ty2 = y - 53 - ease(snap) * 8;
        if (ty2 < 16) ty2 = Math.min(H - 16, y + 53);
        var bx2 = tag(b.sym, x, ty2, C.red, fade);
        var px2 = Math.max(bx2.x + 6, Math.min(bx2.x + bx2.w - 6, x));
        var y1 = ty2 > y ? bx2.y : bx2.y + bx2.h, y2 = ty2 > y ? y + 30 : y - 30;
        A(0.9 * fade); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px2, y1); ctx.lineTo(px2, y2); ctx.lineTo(x, y2); ctx.stroke();
      }
      return true;
    }

    if (b.k === 'done') {
      var e = ease(k);
      if (k < 0.3) { A((1 - k / 0.3) * 0.9); ctx.fillStyle = C.teal; ctx.fillRect(x - 13, y - 13, 26, 26); }
      box(x, y, 18 + e * 34, C.teal, 3 - k * 2.4, (1 - k) * 0.98);
      box(x, y, 18 + e * 18, C.teal, 2 - k * 1.6, (1 - k) * 0.6);
      var n = Math.max(1, Math.min(6, Math.round(b.v)));
      A((1 - k) * 0.98); ctx.fillStyle = C.teal;
      for (var p = 0; p < n; p++) ctx.fillRect(x - n * 3.5 + p * 7, y - 12 - e * 30, 4, 4);
      return true;
    }

    if (b.k === 'lost') {
      var e2 = ease(k), d = 3 + e2 * 16;
      A((1 - k) * 0.7); ctx.strokeStyle = C.red; ctx.lineWidth = 1.5;
      var q = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (var f = 0; f < 4; f++) {
        var fx = x + q[f][0] * d, fy = y + q[f][1] * d;
        ctx.strokeRect(fx - 3.5, fy - 3.5, 7, 7);
      }
      brackets(x, y, 7 + e2 * 5, 4, C.red, 1.5, (1 - k) * 0.65);
      return true;
    }

    if (b.k === 'hurt') {
      var e3 = ease(k);
      A((1 - k) * 0.95); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
      for (var s = 0; s < 6; s++) {
        var an2 = (s / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an2) * (5 + e3 * 8), y + Math.sin(an2) * (5 + e3 * 8));
        ctx.lineTo(x + Math.cos(an2) * (10 + e3 * 14), y + Math.sin(an2) * (10 + e3 * 14));
        ctx.stroke();
      }
      return true;
    }

    /* an outbreak opening: the field flinches at the exact spot */
    if (b.k === 'open') {
      var eo = ease(k);
      brackets(x, y, 60 - eo * 22, 10, C.red, 3, 1 - k);
      ring(x, y, 10 + eo * 30, C.red, 3 - k * 2, (1 - k) * 0.9);
      return true;
    }
    /* answered: the boundary closes, in the colour of things that work */
    if (b.k === 'shut') {
      var es = ease(k), r0 = Math.max(26, (b.r || 60) * sx);
      ring(x, y, r0 * (1 - es * 0.86), C.teal, 3.5 - k * 2, (1 - k) * 0.98);
      A((1 - k) * 0.9); ctx.strokeStyle = C.teal; ctx.lineWidth = 3;
      for (var s2 = 0; s2 < 4; s2++) {
        var sa = -Math.PI / 4 + s2 * (TAU / 4), rr = r0 * (1 - es) + 6;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(sa) * rr, y + Math.sin(sa) * rr);
        ctx.lineTo(x + Math.cos(sa) * (rr - 10), y + Math.sin(sa) * (rr - 10));
        ctx.stroke();
      }
      if (b.sym && k < 0.75) tag(b.sym, x, y - r0 - 18 < 16 ? y + r0 + 18 : y - r0 - 18, C.teal, 1 - k / 0.75);
      return true;
    }
    /* it landed: the boundary bursts outward and leaves a mark */
    if (b.k === 'land') {
      var el2 = ease(k), r1 = Math.max(26, (b.r || 60) * sx);
      ring(x, y, r1 * (1 + el2 * 0.5), C.red, 4 - k * 3, (1 - k) * 0.95);
      A((1 - k) * 0.9); ctx.strokeStyle = C.red; ctx.lineWidth = 2.5;
      for (var l2 = 0; l2 < 8; l2++) {
        var la = (l2 / 8) * TAU, d4 = r1 * (0.4 + el2 * 0.7);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(la) * d4, y + Math.sin(la) * d4);
        ctx.lineTo(x + Math.cos(la) * (d4 + 13), y + Math.sin(la) * (d4 + 13));
        ctx.stroke();
      }
      return true;
    }
    /* the scar a miss leaves on the ground */
    if (b.k === 'scar') {
      var a5 = (1 - k) * 0.4;
      A(a5); ctx.strokeStyle = C.red; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7);
      ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7);
      ctx.stroke();
      return true;
    }

    if (b.k === 'act') {
      var col = b.ok ? C.teal : C.red;
      ring(x, y, 8 + ease(k) * 34, col, 2, (1 - k) * 0.8);
      if (!b.ok) brackets(x, y, 14, 5, C.red, 2, (1 - k) * 0.9);
      return true;
    }
    return true;
  }

  /* ------------------------------------------------------------ aim preview */
  function aim(S) {
    var am = (window.FZ && FZ.controls) ? FZ.controls.aim : null;
    if (!am || am.x === undefined || am.x === null) return;
    var x = X(am.x), y = Y(am.y);
    var pulse = 0.72 + Math.sin(now * 0.006) * 0.18;

    if (am.kind === 'charter') {
      var r = (FZ.sim && FZ.sim.charterR) || 82;
      charter(x, y, r * sx, pulse, false);
      ring(x, y, 4, C.teal, 2, 0.9);
      return;
    }
    if (am.kind === 'vary') {
      var vr = ((FZ.sim && FZ.sim.varyR) || 62) * sx;
      A(pulse); ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(x, y, vr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      var ags = (S.agents || []);
      for (var i = 0; i < ags.length; i++) {
        var dx = X(ags[i].x) - x, dy = Y(ags[i].y) - y;
        if (dx * dx + dy * dy < vr * vr) ring(X(ags[i].x), Y(ags[i].y), 11, C.amber, 2, 0.9);
      }
      return;
    }
    if (am.kind === 'eject') {
      var best = null, bd = 44 * 44;
      var as = (S.agents || []);
      for (var k = 0; k < as.length; k++) {
        var ddx = X(as[k].x) - x, ddy = Y(as[k].y) - y, d2 = ddx * ddx + ddy * ddy;
        if (d2 < bd) { bd = d2; best = as[k]; }
      }
      if (best) {
        var bx = X(best.x), by = Y(best.y);
        brackets(bx, by, 16, 6, C.red, 2.5, pulse + 0.2);
        ring(bx, by, 22, C.red, 1.5, 0.4);
        line(bx - 26, by, bx - 18, by, C.red, 2, 0.8);
        line(bx + 18, by, bx + 26, by, C.red, 2, 0.8);
      } else {
        brackets(x, y, 16, 6, C.white, 2, 0.35);
      }
      return;
    }
    brackets(x, y, 14, 5, C.white, 2, 0.5);
  }

  /* -------------------------------------------------------------- the frame */
  function draw(S) {
    if (!ctx) return;
    now = performance.now();
    wire();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.setLineDash([]);
    A(1); ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, H);

    if (!S) { A(0.14); ctx.strokeStyle = C.white; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1); return; }

    sx = S.w ? W / S.w : 1;
    sy = S.h ? H / S.h : 1;

    if (typeof S.tick === 'number' && S.tick < lastTick) { peak.clear(); hurtAt.clear(); beats.length = 0; }
    lastTick = S.tick || 0;
    if ((lastTick % 600) === 0 && peak.size > 64) {
      var alive = new Set();
      for (var pk2 = 0; pk2 < (S.jobs || []).length; pk2++) alive.add(S.jobs[pk2].id);
      peak.forEach(function (v, k2) { if (!alive.has(k2)) peak.delete(k2); });
    }

    var agents = S.agents || [], jobs = S.jobs || [];
    agentIx.clear(); jobIx.clear();
    for (var i = 0; i < agents.length; i++) agentIx.set(agents[i].id, agents[i]);
    for (var q = 0; q < jobs.length; q++) {
      var jb = jobs[q];
      jobIx.set(jb.id, jb);
      var pv = Math.max(0, Math.min(1, (jb.progress || 0) / (jb.need || 1)));
      var old = peak.get(jb.id);
      if (old === undefined || pv > old) peak.set(jb.id, pv);
      else if (old > pv) peak.set(jb.id, Math.max(pv, old - 0.0025));
    }

    /* who is the table pointing at right now */
    var fsym = (window.FZ && FZ.table) ? FZ.table.focus : null;
    var fel = (fsym && FZ.ELBY) ? FZ.ELBY[fsym] : null;
    var fwho = fel ? idsOf(fel.who) : [];
    var focusing = fwho.length > 0;
    var dimBase = focusing ? 0.28 : 1;
    var fset = focusing ? new Set(fwho) : null;

    grid();

    var chs = S.charters || [];
    for (var c = 0; c < chs.length; c++) charter(X(chs[c].x), Y(chs[c].y), (chs[c].r || 60) * sx, 1, true);

    outbreaks(S, 1);
    prereqLinks(S, dimBase);

    /* a rumor is a job-shaped hole: dashed, empty, drifting */
    if (S.rumor && taught('Gu')) {
      var rx = X(S.rumor.x), ry = Y(S.rumor.y), rp = 0.55 + Math.sin(now * 0.005) * 0.3;
      A(rp); ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx - 11, ry - 11, 22, 22);
      ctx.beginPath(); ctx.arc(rx, ry, 18 + Math.sin(now * 0.005) * 4, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      A(rp * 0.9); ctx.strokeStyle = C.amber; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx - 5, ry - 5); ctx.lineTo(rx + 5, ry + 5); ctx.stroke();
    }

    for (var j = 0; j < jobs.length; j++) drawJob(jobs[j], dimBase, S);

    /* contested claims stay visible after the beat fades: the failure is a state */
    for (var t = 0; t < jobs.length; t++) {
      var job = jobs[t];
      var cl = (job.claims && taught('Co')) ? idsOf(job.claims) : [];
      if (cl.length < 2) continue;
      for (var u = 0; u < cl.length; u++) {
        var ca = agentIx.get(cl[u]);
        if (!ca) continue;
        A(0.26 * dimBase); ctx.strokeStyle = C.red; ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(X(job.x), Y(job.y)); ctx.lineTo(X(ca.x), Y(ca.y)); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    /* the lens: every worker draws a line to what it intends. One will not. */
    if (S.lensOn) {
      for (var l = 0; l < agents.length; l++) {
        var ag = agents[l];
        var tj = jobIx.get(ag.job);
        if (!tj) continue;
        var d1 = (fset && !fset.has(ag.id)) ? 0.3 : 1;
        line(X(ag.x), Y(ag.y), X(tj.x), Y(tj.y), lineage(ag.hue), 1.2, 0.5 * d1);
      }
    }

    var rad = (agents.length > 30 ? 5.8 : agents.length > 20 ? 6.4 : 7.2) * zoom();
    for (var m = 0; m < agents.length; m++) {
      var a2 = agents[m];
      drawAgent(a2, rad, (fset && !fset.has(a2.id)) ? dimBase : 1, S);
    }

    /* the table is pointing: ring the bodies it means, and name them there */
    if (focusing) {
      var wob = 0.6 + Math.sin(now * 0.007) * 0.35;
      for (var f = 0; f < fwho.length; f++) {
        var fa = agentIx.get(fwho[f]);
        if (!fa) continue;
        var fx = X(fa.x), fy = Y(fa.y);
        ring(fx, fy, 13, C.white, 2, wob);
        ring(fx, fy, 17.5, C.white, 1, wob * 0.5);
        markAt(fsym, fx + 15, fy - 14, 14, C.white, wob);
      }
    }

    outbreaks(S, 2);

    /* Beats. Everything that is not a fire draws in place; a fire first pulls the
       whole field down so the one thing that just went wrong is the only thing lit. */
    var fires = [];
    for (var b = beats.length - 1; b >= 0; b--) {
      var bt = beats[b];
      if (now - bt.t >= bt.life) { beats.splice(b, 1); continue; }
      if (bt.k === 'fire') fires.push(bt); else drawBeat(bt);
    }
    if (fires.length) {
      var dk = 0;
      for (var d2 = 0; d2 < fires.length; d2++) {
        var ag2 = now - fires[d2].t;
        if (ag2 < 460) dk = Math.max(dk, (1 - ag2 / 460) * 0.58);
      }
      if (fires.length > 2) dk *= 0.5;   /* in a storm, stop strobing the field */
      if (dk > 0.01) { A(dk); ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, H); }
      for (var d3 = fires.length - 1; d3 >= 0; d3--) drawBeat(fires[d3]);
    }

    aim(S);

    /* the colony is being held at human speed */
    if (S.slowUntil && S.tick < S.slowUntil) {
      A(0.35 + Math.sin(now * 0.004) * 0.15); ctx.strokeStyle = C.blue; ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    }
    A(0.16); ctx.strokeStyle = C.white; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    A(1);
    tickerHold(S);
    tickerAge();
  }

  return {
    init: function (canvas) {
      cv = canvas;
      if (!cv) return;
      ctx = cv.getContext('2d');
      dpr = Math.min(3, window.devicePixelRatio || 1);
      dots = null;
      wire();
      warm();
      this.resize(cv.clientWidth || W, cv.clientHeight || H);
    },
    resize: function (w, h) {
      W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(h));
      if (!cv) return;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); dots = null; }
    },
    draw: draw,
  };
})();
