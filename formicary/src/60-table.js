/* ============================================================
   60-table.js — THE FIELD GUIDE.  OWNER: TABLE (piece G — GUIDE).
   FZ.table = { build(), setEnabled(set), paint(S), open(sym), close(), focus }

   WHAT THIS FILE USED TO BE, AND WHY IT IS NOT THAT ANY MORE
   ----------------------------------------------------------
   A permanent 28-cell matrix, on screen the whole time, four columns of two-letter
   codes the player had to parse mid-panic to find the one thing that was burning.
   AESTHETIC.md §7 and §11 retire it outright. The client, who designed the taxonomy,
   could not read it either.

   IT IS NOW A NATURALIST'S COLLECTION. One plate per element, twenty-eight of them,
   in a drawer that opens between episodes and from one quiet mark, and NEVER while
   something is burning (CONTRACT §12.4 — theory is the reward for comprehension,
   never a thing competing with it).

     - A plate is BLANK until first witnessed. An uncollected specimen: a dashed
       frame and a specimen number, nothing else. The guide starts empty.
     - WITNESSING DRAWS IT. The element fires once on the live sim and the plate
       fills in: primitive glyph, the common name of the phenomenon, a tiny drawn
       diagram of the situation, one line of what you saw, and the scientific code
       in small type at the bottom.
     - ANSWERING STAMPS IT. Diagnose it yourself with the right institution and a
       stamp lands on the plate carrying that institution's silhouette.

   So the taxonomy is knowledge the player DISCOVERED about a species, not
   documentation shipped with the software. Play first, name second, and the name
   arrives in a drawer you chose to open.

   THE DIAGRAMS ARE THE POINT (AESTHETIC.md §0, §5). Each plate carries a drawn
   scene of the situation — ants, crumbs, walls, trails, arches — so the plate can
   be read before the sentence is. The primitive grammar is consistent across all
   twenty-eight: a dot with antennae is a worker, a square is work, a fill is
   progress, RED is damage, BLUE is information, TEAL is an institution, AMBER is
   the thing asking for you. A newcomer learns to read the colony the way one
   learns archaeological notation.

   ALL ENGLISH HERE COMES FROM FZ.copy AND FZ.EL / FZ.outbreak.phen. This file
   invents no sentence. Requests for VOICE are in the report.
   ============================================================ */
FZ.table = (function () {
  'use strict';

  /* ---- palette (AESTHETIC.md §2). MATERIAL is the world; SIGNAL always means something. */
  var PAPER = '#f5efe3', PAPER2 = '#e9e0cd', SAND = '#e2d3b4', SAND2 = '#d3bf99';
  var INK = '#17150f', INK2 = '#4a4335';
  var TEAL = '#19e6c8', AMBER = '#ffd23f', RED = '#ff2e2e', BLUE = '#3b82f6';

  var api = null;
  var built = false;
  var guide = null, gscroll = null, mark = null, markNum = null;
  var plates = new Map();          // sym -> {e, node, drawn:Boolean}
  var order = [];                  // element list, family by family
  var live = new Set();            // enabled this chapter (recorded, never revealed)
  var seen = {};                   // sym -> times personally witnessed, persisted
  var fresh = {};                  // collected since the drawer was last opened
  var openNow = false;
  var wantSym = null;
  var markAt = 0, markShown = false, lastCount = -1, quietAt = 0;
  var everOpened = false;          // the first drawer you open is all new; that is not news
  var STORE = 'formicary.guide';

  /* ============================================================
     THE DRAWN GRAMMAR — primitives every plate is built from
     ============================================================ */
  function n(v) { return Math.round(v * 10) / 10; }

  /* a worker: body, head, two antennae, two legs. Small enough to crowd. */
  function ant(x, y, f, o) {
    o = o || {};
    var c = o.c || INK, op = o.op == null ? 1 : o.op;
    return '<g stroke="' + c + '" stroke-width=".85" fill="' + c + '" opacity="' + op + '">' +
      '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="2.1" ry="1.7" stroke="none"/>' +
      '<circle cx="' + n(x + f * 2.9) + '" cy="' + n(y - .4) + '" r="1.15" stroke="none"/>' +
      '<path d="M' + n(x + f * 3.4) + ' ' + n(y - 1.2) + 'L' + n(x + f * 5.2) + ' ' + n(y - 3) + '" fill="none"/>' +
      '<path d="M' + n(x + f * 3.4) + ' ' + n(y - .2) + 'L' + n(x + f * 5.4) + ' ' + n(y - .8) + '" fill="none"/>' +
      '<path d="M' + n(x - .6) + ' ' + n(y + 1.5) + 'L' + n(x - 2) + ' ' + n(y + 3.4) + '" fill="none"/>' +
      '<path d="M' + n(x + 1) + ' ' + n(y + 1.5) + 'L' + n(x + 2.2) + ' ' + n(y + 3.4) + '" fill="none"/>' +
      '</g>';
  }
  /* work: a square. The fill is progress. Dashed means it is not really there. */
  function crumb(x, y, s, p, o) {
    o = o || {};
    var c = o.c || INK, h = s * (p || 0);
    return '<g>' +
      (h > 0 ? '<rect x="' + n(x) + '" y="' + n(y + s - h) + '" width="' + n(s) + '" height="' + n(h) + '" fill="' + (o.fill || SAND2) + '"/>' : '') +
      '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(s) + '" height="' + n(s) + '" fill="none" stroke="' + c +
      '" stroke-width="1.1"' + (o.dash ? ' stroke-dasharray="2 2"' : '') + '/></g>';
  }
  function line(x1, y1, x2, y2, o) {
    o = o || {};
    return '<path d="M' + n(x1) + ' ' + n(y1) + 'L' + n(x2) + ' ' + n(y2) + '" fill="none" stroke="' + (o.c || INK) +
      '" stroke-width="' + (o.w || 1) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') +
      (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  }
  function arrow(x1, y1, x2, y2, o) {
    o = o || {};
    var c = o.c || INK, dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L, hx = x2 - ux * 3, hy = y2 - uy * 3, px = -uy * 2, py = ux * 2;
    return line(x1, y1, x2, y2, o) +
      '<path d="M' + n(x2) + ' ' + n(y2) + 'L' + n(hx + px) + ' ' + n(hy + py) + 'L' + n(hx - px) + ' ' + n(hy - py) + 'Z" fill="' + c + '"' + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  }
  function xmark(x, y, r, o) {
    o = o || {};
    var c = o.c || RED;
    return line(x - r, y - r, x + r, y + r, { c: c, w: o.w || 1.3 }) + line(x + r, y - r, x - r, y + r, { c: c, w: o.w || 1.3 });
  }
  function ring(x, y, r, o) {
    o = o || {};
    return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '" fill="none" stroke="' + (o.c || INK) +
      '" stroke-width="' + (o.w || 1) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>';
  }
  function wall(x, y1, y2, o) { return line(x, y1, x, y2, { c: (o && o.c) || INK, w: 2.4 }); }
  function tick(x, y) { return line(x, y, x, y - 4, { c: INK2, w: .9 }); }

  /* THE SIX FOLK TECHNOLOGIES, AESTHETIC.md §5. These are the SAME silhouettes CONTROLS
     puts on the instruments — arch, seed, cairn, lantern, bell, gate — deliberately, so a
     stamp on a plate is recognisably the thing in your hand. The player learns six shapes
     once and reads them everywhere. (If CONTROLS ever exposes `FZ.controls.mark(kind)`,
     this file defers to it; requested in the report.) */
  var INST = {
    charter: '<path d="M3.6 21.4V12a8.4 8.4 0 0116.8 0v9.4"/><path d="M7.9 21.4v-9.2a4.1 4.1 0 018.2 0v9.2"/>' +
      '<path d="M1.6 21.4h20.8"/><path d="M12 1.6v2.6"/>',
    vary: '<path d="M12 21.4v-4.2"/><path d="M8.6 21.4h6.8"/>' +
      '<path d="M12 17.2c-1.5 0-2.6-1-2.6-2.3S10.5 12.6 12 12.6s2.6 1 2.6 2.3-1.1 2.3-2.6 2.3z"/>' +
      '<path d="M12 12.6V7.4M10.4 13.6L6.2 9.4M13.6 13.6l4.2-4.2"/><path d="M12 7.4V4.2M6.2 9.4V6.2M17.8 9.4V6.2"/>',
    ledger: '<path d="M2.5 21.4h19"/><path d="M4 15.4h16v6H4z"/><path d="M6.2 9.6h11.6v5.8H6.2z"/>' +
      '<path d="M8.4 4h7.2v5.6H8.4z"/><path d="M7 17v2.6M9.4 17v2.6M11.8 17v2.6M14.2 17v2.6M6.4 19.8l8.4-3.4"/>',
    lens: '<path d="M10 5.6a2 2 0 014 0v2"/><path d="M7 7.6h10v10H7z"/><path d="M5.6 17.6h12.8M5.6 7.6h12.8"/>' +
      '<path d="M12 10.6l2.2 2-2.2 2-2.2-2z"/><path d="M1.6 12.6h2.6M19.8 12.6h2.6M3.6 5.2l1.8 1.8M20.4 5.2l-1.8 1.8"/>',
    slow: '<path d="M6 17.4c0-6.4 1.8-9.4 6-9.4s6 3 6 9.4"/><path d="M4 17.4h16"/><path d="M12 5.6v2.4"/>' +
      '<path d="M12 3.2a1.4 1.4 0 010 2.8 1.4 1.4 0 010-2.8z"/><path d="M12 17.4v2.2"/>' +
      '<path d="M12 19.6a1.2 1.2 0 010 2.4 1.2 1.2 0 010-2.4z"/>',
    eject: '<path d="M3.5 21.4V4.6h9v16.8"/><path d="M3.5 4.6h9"/><path d="M2 12.8h12"/>' +
      '<path d="M15.6 12.8h6.6"/><path d="M19 9.6l3.2 3.2-3.2 3.2"/>',
  };
  function inst(kind, sz) {
    if (FZ.controls && typeof FZ.controls.mark === 'function') {
      var got = FZ.controls.mark(kind);
      if (got) return got;
    }
    var d = INST[kind];
    if (!d) return '';
    return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="square" aria-hidden="true">' + d + '</svg>';
  }

  /* ============================================================
     THE TWENTY-EIGHT SCENES — a drawn situation for every plate.
     viewBox 0 0 76 34. Ground line at y=30. Read left to right.
     ============================================================ */
  var GROUND = line(0, 30.5, 76, 30.5, { c: INK2, w: .8, op: .45 });

  var SCENE = {
    /* two arrive from opposite ends and the work cancels out */
    Co: crumb(33, 12, 10, .45) + ant(11, 18, 1) + arrow(18, 18, 30, 18) +
      ant(65, 18, -1) + arrow(58, 18, 46, 18) + xmark(38, 17, 5, { c: RED, w: 1.5 }),
    /* a wall, and the work on the other side of it that nobody has heard of */
    Si: wall(43, 3, 30) + ant(10, 20, -1) + ant(21, 13, -1) + ant(30, 25, -1) +
      crumb(58, 13, 11, .0) + line(57, 18, 45, 18, { c: BLUE, w: 1.2, dash: '2.5 2.5' }) + xmark(43, 18, 3, { c: RED, w: 1.2 }),
    /* both finished it, two different ways, and neither version survived */
    Mc: crumb(9, 6, 8, 1) + crumb(59, 6, 8, .45) + ant(14, 24, 1) + ant(62, 24, -1) +
      line(20, 12, 30, 15, { c: INK2 }) + line(56, 12, 46, 15, { c: INK2 }) +
      crumb(31, 13, 14, 0, { dash: 1 }) +
      '<path d="M31 20l4-4 4 4 4-4 4 4" fill="none" stroke="' + RED + '" stroke-width="1.5"/>',
    /* blocked behind work nobody is doing */
    Dp: crumb(7, 12, 11, 0, { dash: 1 }) + ring(12.5, 17.5, 9, { c: INK2, dash: '2 3', w: .9 }) +
      arrow(24, 17, 40, 17, { c: INK2 }) + crumb(44, 12, 11, .3) + wall(60, 8, 28) +
      ant(69, 20, -1),
    /* one worker, three claims, all three rotting */
    Ow: ant(38, 18, 1) + crumb(8, 3, 8, .2) + crumb(8, 22, 8, .2) + crumb(62, 12, 8, .2) +
      line(35, 16, 17, 8, { c: INK2, dash: '2 2' }) + line(35, 20, 17, 27, { c: INK2, dash: '2 2' }) +
      line(42, 18, 61, 16, { c: INK2, dash: '2 2' }) +
      xmark(12, 7, 2.6) + xmark(12, 26, 2.6) + xmark(66, 16, 2.6),
    /* grinding the small crumbs while the big one sits open */
    Pt: crumb(6, 20, 6, 1) + crumb(17, 20, 6, 1) + crumb(28, 20, 6, .7) +
      ant(9, 14, 1) + ant(20, 14, 1) + ant(31, 14, 1) +
      crumb(53, 8, 18, 0) + line(53, 26, 71, 26, { c: INK2, dash: '2 2' }),
    /* everyone picks whatever everyone else already picked */
    Cf: ant(6, 16, 1) + ant(17, 16, 1) + ant(28, 16, 1) + ant(39, 16, 1) +
      arrow(46, 16, 56, 16) + crumb(58, 11, 11, .5) + crumb(14, 24, 7, 0, { dash: 1 }),
    /* every worker in the colony is the same worker */
    Lv: ant(9, 17, 1) + ant(23, 17, 1) + ant(37, 17, 1) + ant(51, 17, 1) + ant(65, 17, 1) +
      line(2, 24, 74, 24, { c: INK2, w: .8, dash: '3 3' }),
    /* one blind spot, shared: they go down at the same instant */
    Sf: ant(14, 21, 1) + ant(38, 21, 1) + ant(62, 21, 1) +
      xmark(14, 9, 4, { c: RED, w: 1.5 }) + xmark(38, 9, 4, { c: RED, w: 1.5 }) + xmark(62, 9, 4, { c: RED, w: 1.5 }),
    /* more hands, less work */
    Fl: crumb(32, 13, 11, .25) + ant(20, 10, 1) + ant(20, 22, 1) + ant(29, 5, 1) + ant(31, 27, 1) +
      ant(50, 10, -1) + ant(50, 22, -1) + ant(60, 16, -1) + ant(41, 4, -1),
    /* two of them trade the claim and never work it */
    Cl: crumb(33, 15, 10, 0) + ant(14, 20, 1) + ant(62, 20, -1) +
      arrow(24, 9, 50, 9, { c: INK2 }) + arrow(52, 14, 26, 14, { c: INK2 }),
    /* the whole colony makes the same move on the same tick */
    Im: ant(9, 22, 1) + ant(25, 22, 1) + ant(41, 22, 1) + ant(57, 22, 1) +
      arrow(6, 10, 16, 10) + arrow(22, 10, 32, 10) + arrow(38, 10, 48, 10) + arrow(54, 10, 64, 10),
    /* there is nothing there, and they are going anyway */
    Gu: ring(58, 16, 9, { c: INK2, dash: '2.5 3', w: 1 }) +
      line(20, 16, 48, 16, { c: BLUE, w: 1.2, dash: '3 2.5' }) +
      ant(8, 16, 1) + ant(20, 16, 1) + ant(32, 16, 1) + ant(44, 16, 1),
    /* one bad crumb, and every crumb like it is written off */
    Cs: crumb(8, 11, 11, .3) + xmark(13.5, 16.5, 6, { c: RED, w: 1.5 }) +
      crumb(30, 11, 11, .8) + xmark(35.5, 16.5, 6, { c: RED, w: 1.1 }) +
      crumb(52, 11, 11, 1) + xmark(57.5, 16.5, 6, { c: RED, w: 1.1 }),
    /* somebody walked past the hazard and kept quiet */
    Hi: crumb(7, 13, 10, .4) + xmark(12, 18, 3.4, { c: RED, w: 1.3 }) + ant(24, 20, -1) +
      line(28, 15, 44, 15, { c: BLUE, w: 1.2, dash: '3 2.5' }) + xmark(37, 15, 3.2, { c: RED, w: 1.3 }) +
      ant(60, 20, -1) + arrow(56, 24, 44, 24, { c: INK2 }),
    /* every source weighs exactly the same, and one of them is lying */
    Tc: crumb(5, 3, 7, 1, { fill: SAND }) + crumb(5, 14, 7, 1, { fill: SAND }) + crumb(5, 25, 7, 1, { c: RED, fill: SAND }) +
      line(13, 6.5, 52, 17, { c: INK2 }) + line(13, 17.5, 52, 17, { c: INK2 }) + line(13, 28.5, 52, 17, { c: RED }) +
      ant(60, 17, -1),
    /* one worker found the best crumb. Nobody followed. */
    Di: crumb(5, 8, 14, .8) + ant(14, 25, 1) + ring(12, 15, 11, { c: BLUE, dash: '2.5 3', w: 1 }) +
      ant(42, 17, 1) + ant(53, 17, 1) + ant(64, 17, 1) + arrow(44, 27, 70, 27, { c: INK2 }),
    /* second lie, and nothing here remembers the first */
    Rp: xmark(12, 12, 5, { c: RED, w: 1.5 }) + arrow(21, 12, 37, 12, { c: INK2 }) + xmark(46, 12, 5, { c: RED, w: 1.5 }) +
      tick(58, 28) + tick(62, 28) + tick(66, 28) + tick(70, 28) +
      '<rect x="54" y="18" width="20" height="12" fill="none" stroke="' + INK2 + '" stroke-width="1" stroke-dasharray="2 2"/>',
    /* two rivals, one crumb, and neither will move */
    Tw: crumb(33, 13, 11, 0) + ant(15, 18, 1) + ant(61, 18, -1) +
      wall(28, 9, 27) + wall(48, 9, 27) + xmark(38, 18.5, 4, { c: RED, w: 1.4 }),
    /* finished work quietly draining away */
    Sa: crumb(10, 10, 14, .75) + arrow(26, 20, 44, 26, { c: RED }) +
      ant(58, 16, -1) + ring(58, 16, 8, { c: INK2, dash: '2 3', w: .9 }) +
      line(50, 8, 66, 8, { c: INK2, w: .8, dash: '2 2' }),
    /* someone claimed it and stopped, and the queue behind cannot pass */
    Lo: crumb(30, 14, 13, .15) + ant(36, 12, 1) + wall(22, 6, 30) +
      ant(13, 20, 1) + ant(4, 20, 1) + arrow(6, 28, 19, 28, { c: INK2 }) +
      xmark(36, 25, 3.4, { c: RED, w: 1.3 }),
    /* the small crumb every time, and the big one still open */
    My: crumb(6, 21, 7, 1) + crumb(16, 21, 7, 1) + crumb(26, 21, 7, 1) +
      ant(9, 13, 1) + ant(19, 13, 1) + ant(29, 13, 1) +
      crumb(50, 5, 22, 0) + line(50, 27, 72, 27, { c: INK2, dash: '2 2' }),
    /* they stopped working and started chasing each other */
    Es: ring(30, 16, 11, { c: INK2, dash: '3 3', w: 1 }) + ant(30, 5, 1) + ant(30, 27, -1) +
      arrow(41, 12, 41, 22, { c: RED }) + crumb(62, 12, 11, 0, { dash: 1 }),
    /* it walks straight through whatever you put down */
    Cr: '<g stroke="' + TEAL + '" stroke-width="1.4" fill="none"><path d="M24 28V17a10 10 0 0 1 20 0v11"/><path d="M18 28h32"/></g>' +
      xmark(34, 16, 6, { c: RED, w: 1.6 }) + ant(60, 22, -1) + arrow(56, 22, 20, 22, { c: INK }),
    /* one lineage, one habit, one way to be wrong */
    Mo: '<rect x="3" y="3" width="70" height="28" fill="none" stroke="' + INK2 + '" stroke-width="1"/>' +
      ant(14, 12, 1) + ant(31, 12, 1) + ant(48, 12, 1) + ant(63, 12, 1) +
      ant(14, 25, 1) + ant(31, 25, 1) + ant(48, 25, 1) + ant(63, 25, 1),
    /* nothing here settles anything: the arch is missing */
    In: '<g stroke="' + TEAL + '" stroke-width="1.3" fill="none" stroke-dasharray="3 3" opacity=".85">' +
      '<path d="M24 28V17a10 10 0 0 1 20 0v11"/><path d="M18 28h32"/></g>' +
      crumb(29, 14, 10, .3) + ant(12, 20, 1) + ant(62, 20, -1) + xmark(34, 19, 4, { c: RED, w: 1.3 }),
    /* everything sped up. You did not. */
    Sp: ant(16, 12, 1) + ant(16, 25, 1) + ant(40, 18, 1) +
      line(5, 12, 11, 12, { c: INK2 }) + line(3, 15, 10, 15, { c: INK2 }) +
      line(5, 25, 11, 25, { c: INK2 }) + line(3, 28, 10, 28, { c: INK2 }) +
      line(29, 18, 35, 18, { c: INK2 }) + line(27, 21, 34, 21, { c: INK2 }) +
      '<path d="M64 4a13 13 0 0 1 0 26" fill="none" stroke="' + AMBER + '" stroke-width="2.4"/>' +
      ring(64, 17, 13, { c: INK2, dash: '2 3', w: .9 }),
    /* you can see where they are, not what they want */
    Mm: '<rect x="0" y="0" width="76" height="34" fill="rgba(0,0,0,.13)"/>' +
      ant(12, 14, 1, { op: .4 }) + ant(30, 24, 1, { op: .4 }) + ant(48, 12, -1, { op: .4 }) + ant(64, 25, -1, { op: .4 }) +
      line(18, 14, 26, 14, { c: BLUE, dash: '2 3', op: .5 }) +
      line(36, 24, 44, 24, { c: BLUE, dash: '2 3', op: .5 }) +
      line(42, 12, 34, 12, { c: BLUE, dash: '2 3', op: .5 }),
  };

  function scene(sym) {
    return '<svg class="pdg" viewBox="0 0 76 34" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      GROUND + (SCENE[sym] || '') + '</svg>';
  }

  /* ---- the two marks that carry the counts. Both are already in the player's eye
     from play: the dashed incident ring is what witnessing looks like on the field,
     and the stamp is what an answered one looks like. No word needed for either. */
  var M_SEEN = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<circle cx="7" cy="7" r="5.2" stroke="' + INK2 + '" stroke-width="1.3" stroke-dasharray="2.2 2.4"/></svg>';
  var M_DONE = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M1.5 7.5 5.5 11.5 12.5 3" stroke="currentColor" stroke-width="2"/></svg>';
  var M_MISS = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M2 2 12 12M12 2 2 12" stroke="' + RED + '" stroke-width="1.6"/></svg>';
  /* the drawer pull: a stack of plates, one of them drawn */
  var M_DRAWER = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="13" stroke="' + INK + '" stroke-width="1.6"/>' +
    '<path d="M3 20h18" stroke="' + INK + '" stroke-width="1.6"/>' +
    '<circle cx="9" cy="10" r="1.6" fill="' + INK + '"/><rect x="13" y="8" width="4" height="4" stroke="' + INK + '" stroke-width="1.2"/>' +
    '</svg>';

  /* ============================================================
     STYLE — the drawer is paper. The instrumentation on it stays rectilinear.
     ============================================================ */
  function css() {
    var g = function (a) { return 'rgba(0,0,0,' + a + ')'; };
    return [
      /* the retired matrix. If the old shell still ships these ids, they hold nothing
         and take no room — the permanent taxonomy is gone from the play screen. */
      '#tableWrap,#etable,#metaRow,#detail{display:none!important}',

      '#guide.fzg{position:fixed;top:0;left:0;right:0;bottom:0;z-index:80;display:none;',
      'flex-direction:column;background:' + PAPER2 + ';color:' + INK + ';',
      'font-family:inherit;-webkit-tap-highlight-color:transparent}',
      '#guide.fzg.on{display:flex}',

      /* header: what you have collected, and the way out */
      '#guide.fzg .ghd{flex:0 0 auto;display:flex;align-items:center;gap:9px;',
      'padding:calc(9px + env(safe-area-inset-top)) 12px 9px;background:' + PAPER + ';',
      'border-bottom:2px solid ' + INK + '}',
      '#guide.fzg .ghd .gk{width:22px;height:22px;flex:0 0 22px}',
      '#guide.fzg .ghd .gk svg{width:22px;height:22px}',
      '#guide.fzg .gct{font-size:15px;font-weight:700;letter-spacing:.06em;font-variant-numeric:tabular-nums}',
      '#guide.fzg .gbar{flex:1 1 auto;height:6px;background:' + g('.1') + ';position:relative;overflow:hidden}',
      '#guide.fzg .gbar i{position:absolute;left:0;top:0;bottom:0;width:0%;background:' + INK + ';transition:width .3s linear}',
      '#guide.fzg .gx{flex:0 0 auto;min-width:56px;min-height:44px;padding:0 10px;background:' + INK + ';color:' + PAPER + ';',
      'font-size:11px;font-weight:700;letter-spacing:.14em;border:0}',

      '#guide.fzg .gsc{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;',
      '-webkit-overflow-scrolling:touch;padding:10px 10px calc(22px + env(safe-area-inset-bottom))}',

      /* --- an uncollected specimen: a frame with a number in it and nothing else --- */
      '#guide.fzg .pl{position:relative;display:block;width:100%;text-align:left;margin:0 0 8px;',
      'background:none;border:1px dashed ' + g('.3') + ';padding:0;color:inherit;font-family:inherit}',
      '#guide.fzg .pl .pno{font-size:10px;font-weight:700;letter-spacing:.2em;color:' + g('.32') + ';',
      'font-variant-numeric:tabular-nums;padding:14px 12px;display:block}',
      '#guide.fzg .pl .pin{display:none}',
      /* --- witnessed: the plate is drawn --- */
      '#guide.fzg .pl.dr{border:1px solid ' + INK + ';background:' + PAPER + ';box-shadow:2px 2px 0 ' + g('.12') + '}',
      '#guide.fzg .pl.dr .pno{position:absolute;right:9px;top:9px;padding:0;color:' + g('.28') + '}',
      '#guide.fzg .pl.dr .pin{display:block;padding:10px 11px 8px}',
      '#guide.fzg .ptop{display:flex;align-items:center;gap:8px;padding-right:26px}',
      '#guide.fzg .pgl{width:24px;height:24px;flex:0 0 24px;color:' + INK + '}',
      '#guide.fzg .pgl svg{width:24px;height:24px}',
      '#guide.fzg .pnm{font-size:14.5px;font-weight:700;letter-spacing:.045em;line-height:1.1}',
      '#guide.fzg .pmid{display:flex;gap:10px;align-items:center;margin-top:8px}',
      '#guide.fzg .pdgw{flex:0 0 122px;height:58px;background:' + SAND + ';border:1px solid ' + g('.22') + ';padding:3px}',
      '#guide.fzg .pdg{width:100%;height:100%}',
      '#guide.fzg .psay{flex:1 1 auto;font-size:11.5px;line-height:1.35;color:' + g('.82') + '}',
      '#guide.fzg .pfoot{display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:6px;',
      'border-top:1px solid ' + g('.2') + '}',
      '#guide.fzg .pcode{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      'font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:' + g('.5') + '}',
      '#guide.fzg .pct{display:flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;',
      'font-variant-numeric:tabular-nums;color:' + g('.62') + '}',
      '#guide.fzg .pct svg{width:11px;height:11px;flex:0 0 11px}',
      /* a signal colour appears only when it means something: the tick is grey at nought */
      '#guide.fzg .pct.ac{color:' + g('.3') + '}',
      '#guide.fzg .pct.ac.ok{color:' + INK + '}',
      '#guide.fzg .pct.ac.ok svg{color:' + TEAL + '}',
      /* THE STAMP. Witnessing the phenomenon also collects which instrument answers it:
         the silhouette sits on the plate in outline. Answering it yourself lands the stamp
         proper — teal, boxed, off-square, the way a specimen gets marked verified. */
      '#guide.fzg .pst{position:absolute;right:8px;bottom:8px;width:42px;height:42px;',
      'border:1px dashed ' + g('.28') + ';color:' + g('.36') + ';display:none;',
      'align-items:center;justify-content:center;transform:rotate(-7deg)}',
      '#guide.fzg .pl.dr .pst{display:flex}',
      '#guide.fzg .pl.st .pst{border:2px solid ' + TEAL + ';border-style:solid;color:' + TEAL + '}',
      '#guide.fzg .pl.dr .pfoot{padding-right:48px}',
      '#guide.fzg .pl.dr .psay{padding-right:30px}',
      /* newly collected since you last opened the drawer */
      '#guide.fzg .pl.nw{border-left:4px solid ' + AMBER + '}',
      /* the family break: a rule, no heading. Order is the taxonomy. */
      '#guide.fzg .gbrk{height:0;border-top:2px solid ' + g('.35') + ';margin:2px 0 10px}',
      '@keyframes fzdraw{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
      '#guide.fzg .pl.dr{animation:fzdraw .22s ease-out 1}',

      /* --- the quiet mark. It is ABSENT while anything is burning. --- */
      '#guideMark{position:fixed;z-index:65;width:46px;height:46px;display:none;',
      'align-items:center;justify-content:center;flex-direction:column;gap:1px;',
      'background:' + PAPER + ';border:1.5px solid ' + INK + ';padding:0;box-shadow:2px 2px 0 ' + g('.25') + '}',
      '#guideMark.on{display:flex}',
      '#guideMark svg{width:20px;height:20px}',
      '#guideMark .gmn{font-size:8.5px;font-weight:700;letter-spacing:.06em;color:' + INK + ';',
      'font-variant-numeric:tabular-nums;line-height:1}',
      '#guideMark.nw{border-color:' + AMBER + ';border-width:2.5px}',
      '@media (max-width:360px){#guide.fzg .pdgw{flex:0 0 106px;height:52px}',
      '#guide.fzg .pcode{font-size:8.5px;letter-spacing:.08em}',
      '#guide.fzg .pnm{font-size:13px}',
      '#guide.fzg .pl.dr .psay{padding-right:40px}}',
    ].join('');
  }

  /* ============================================================
     BUILD
     ============================================================ */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function pad2(v) { return (v < 10 ? '0' : '') + v; }
  function ui(k) { return (FZ.copy && FZ.copy.ui && FZ.copy.ui[k]) || ''; }

  /* the phenomenon, in the words the paper tag used. Never invented here. */
  function phen(sym) {
    if (FZ.outbreak && FZ.outbreak.phen) {
      var p = FZ.outbreak.phen(sym);
      if (p && (p.name || p.line)) return p;
    }
    var c = FZ.copy && FZ.copy.phen && FZ.copy.phen[sym];
    if (c) return { name: c.name || '', line: c.line || '' };
    var e = FZ.ELBY ? FZ.ELBY[sym] : null;
    return { name: (e && e.nm) ? e.nm.toUpperCase() : sym, line: (e && e.plain) || '' };
  }
  function answerKind(e) {
    if (e.answers && e.answers.length) return e.answers[0];
    if (FZ.outbreak && FZ.outbreak.answersFor) {
      var a = FZ.outbreak.answersFor(e.sym);
      if (a && a.length) return a[0];
    }
    return e.counterTool || null;
  }
  function mastery(sym) {
    var m = (FZ.outbreak && FZ.outbreak.mastery) ? FZ.outbreak.mastery[sym] : null;
    return m || { answered: 0, missed: 0 };
  }
  function collected(sym) {
    if (seen[sym] > 0) return true;
    var m = mastery(sym);
    return (m.answered + m.missed) > 0;
  }
  function count() {
    var k = 0;
    for (var i = 0; i < order.length; i++) if (collected(order[i].sym)) k++;
    return k;
  }

  function makePlate(e, idx) {
    /* A PLATE IS NOT A CONTROL. The old build made all 28 cells tappable and most taps
       opened a card about something that was not burning. In the drawer there is exactly
       one affordance — the way out — and everything else is read. */
    var b = el('div', 'pl');
    b.setAttribute('data-sym', e.sym);
    b.appendChild(el('span', 'pno', pad2(idx + 1)));
    var inn = el('div', 'pin');
    inn.innerHTML =
      '<div class="ptop"><span class="pgl"></span><span class="pnm"></span></div>' +
      '<div class="pmid"><span class="pdgw"></span><span class="psay"></span></div>' +
      '<div class="pfoot"><span class="pcode"></span>' +
      '<span class="pct sc">' + M_SEEN + '<b class="v">0</b></span>' +
      '<span class="pct ac">' + M_DONE + '<b class="v">0</b></span>' +
      '<span class="pct mc">' + M_MISS + '<b class="v">0</b></span></div>';
    b.appendChild(inn);
    b.appendChild(el('span', 'pst'));
    plates.set(e.sym, { e: e, n: b, drawn: false, st: false, s: -1, a: -1, m: -1 });
    return b;
  }

  function build() {
    if (built) return;
    if (!window.FZ || !FZ.EL || !FZ.EL.length) return;

    var st = document.getElementById('fzGuideCSS') || el('style');
    st.id = 'fzGuideCSS';
    st.textContent = css();
    document.head.appendChild(st);

    /* the old matrix, emptied. Nothing of it survives on the play screen. */
    ['etable', 'metaRow', 'detail'].forEach(function (id) {
      var q = document.getElementById(id);
      if (q) q.textContent = '';
    });

    var host = document.getElementById('app') || document.body;
    guide = document.getElementById('guide');
    if (!guide) { guide = el('div'); guide.id = 'guide'; host.appendChild(guide); }
    guide.classList.add('fzg');
    guide.textContent = '';

    var hd = el('div', 'ghd');
    hd.innerHTML = '<span class="gk">' + M_DRAWER + '</span>' +
      '<span class="gct"></span><span class="gbar"><i></i></span>';
    var x = el('button', 'gx');
    x.type = 'button';
    x.textContent = ui('close');
    x.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); closeGuide(); });
    hd.appendChild(x);
    guide.appendChild(hd);

    gscroll = el('div', 'gsc');
    guide.appendChild(gscroll);

    /* family by family, in taxonomy order, with a rule between families and no heading:
       the grouping is structure, not vocabulary. */
    order = FZ.EL.slice().sort(function (a, b) {
      return (a.col - b.col) || (a.row - b.row);
    });
    var lastCol = -1;
    for (var i = 0; i < order.length; i++) {
      if (lastCol >= 0 && order[i].col !== lastCol) gscroll.appendChild(el('div', 'gbrk'));
      lastCol = order[i].col;
      gscroll.appendChild(makePlate(order[i], i));
    }

    /* the quiet mark */
    mark = document.getElementById('guideMark');
    if (!mark) {
      mark = el('button', '');
      mark.id = 'guideMark';
      mark.type = 'button';
      mark.innerHTML = M_DRAWER + '<span class="gmn"></span>';
      host.appendChild(mark);
    }
    markNum = mark.querySelector('.gmn');
    mark.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (openNow) closeGuide(); else openGuide();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && openNow) closeGuide();
    });

    if (FZ.bus) {
      /* something starts burning while the drawer is open: the drawer shuts.
         Theory never competes with the incident. */
      FZ.bus.on('outbreak:open', function () { if (openNow) closeGuide(); });
      FZ.bus.on('chapter:enter', function () { if (openNow) closeGuide(); });
    }

    built = true;
    refresh(true);
  }

  /* ============================================================
     WITNESSING — the only thing that draws a plate
     ============================================================ */
  function load() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORE);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.seen) for (var k in o.seen) seen[k] = o.seen[k] | 0;
      if (o && o.op) everOpened = true;
    } catch (e) { /* private mode / file:// — the collection is a bonus, never a blocker */ }
  }
  /* a detector can fire many times a second; the collection is written once the colony
     stops for breath, never inside the tick. */
  var saveT = 0;
  function writeNow() {
    saveT = 0;
    try { if (window.localStorage) window.localStorage.setItem(STORE, JSON.stringify({ seen: seen, op: everOpened ? 1 : 0 })); }
    catch (e) { }
  }
  function save() {
    if (saveT) return;
    saveT = setTimeout(writeNow, 700);
  }
  function witness(sym) {
    if (!sym || !FZ.ELBY || !FZ.ELBY[sym]) return;
    var had = collected(sym);
    seen[sym] = (seen[sym] || 0) + 1;
    if (!had && everOpened) fresh[sym] = 1;
    save();
    if (built) refresh(!had);
  }

  /* ============================================================
     PAINT — plates only redraw when their numbers actually moved
     ============================================================ */
  function refresh(force) {
    if (!built) return;
    var k = 0;
    plates.forEach(function (p) {
      var sym = p.e.sym;
      var got = collected(sym);
      if (got) k++;
      if (got !== p.drawn) {
        p.drawn = got;
        p.n.classList.toggle('dr', got);
        if (got) draw(p);
      }
      if (!got) return;
      p.n.classList.toggle('nw', !!fresh[sym]);
      var m = mastery(sym), s = seen[sym] || 0;
      if (force || s !== p.s) { p.s = s; setv(p, '.sc', s || (m.answered + m.missed)); }
      if (force || m.answered !== p.a) {
        p.a = m.answered;
        setv(p, '.ac', m.answered);
        p.n.querySelector('.ac').classList.toggle('ok', m.answered > 0);
        var stamped = m.answered > 0;
        if (stamped !== p.st) { p.st = stamped; p.n.classList.toggle('st', stamped); }
      }
      if (force || m.missed !== p.m) {
        p.m = m.missed;
        setv(p, '.mc', m.missed);
        p.n.querySelector('.mc').style.display = m.missed > 0 ? '' : 'none';
      }
    });
    if (k !== lastCount) {
      lastCount = k;
      var c = guide && guide.querySelector('.gct');
      if (c) c.textContent = pad2(k) + ' / ' + order.length;
      var b = guide && guide.querySelector('.gbar i');
      if (b) b.style.width = Math.round(k / Math.max(1, order.length) * 100) + '%';
      if (markNum) markNum.textContent = pad2(k);
    }
  }
  function setv(p, sel, v) {
    var q = p.n.querySelector(sel + ' .v');
    if (q) q.textContent = String(v > 99 ? 99 : v);
  }

  /* the plate fills in: glyph, common name, the scene, the line, the code */
  function draw(p) {
    var e = p.e, ph = phen(e.sym);
    var g = p.n.querySelector('.pgl'); if (g) g.innerHTML = e.glyph || '';
    var nm = p.n.querySelector('.pnm'); if (nm) nm.textContent = ph.name || '';
    var dg = p.n.querySelector('.pdgw'); if (dg) dg.innerHTML = scene(e.sym);
    var sy = p.n.querySelector('.psay'); if (sy) sy.textContent = ph.line || e.plain || '';
    var cd = p.n.querySelector('.pcode');
    if (cd) cd.textContent = e.sym + ' · ' + (e.nm || '');
    var stmp = p.n.querySelector('.pst');
    var k = answerKind(e);
    if (stmp) stmp.innerHTML = k ? inst(k, 25) : '';
  }

  /* ============================================================
     THE RULE: never openable while an incident is burning
     ============================================================ */
  function burning() {
    var ob = window.FZ && FZ.outbreak;
    if (ob && ob.list) {
      for (var i = 0; i < ob.list.length; i++) {
        if (ob.list[i] && ob.list[i].state === 'burning') return true;
      }
    }
    if (FZ.controls && FZ.controls.armed) return true;
    return false;
  }
  function canOpen() { return built && !burning() && count() > 0; }

  function openGuide(sym) {
    if (!built) build();
    if (!canOpen()) return false;
    openNow = true;
    guide.classList.add('on');
    refresh(true);
    /* the plate you came for, at the top of the drawer */
    var target = sym || wantSym;
    wantSym = null;
    if (target && plates.get(target) && plates.get(target).drawn) {
      var nd = plates.get(target).n;
      if (nd && nd.offsetTop != null && gscroll) gscroll.scrollTop = Math.max(0, nd.offsetTop - 8);
    } else if (gscroll) gscroll.scrollTop = 0;
    if (mark) mark.classList.remove('on');
    return true;
  }
  function closeGuide() {
    if (!openNow) return;
    openNow = false;
    if (guide) guide.classList.remove('on');
    /* everything in the drawer has now been looked at */
    fresh = {};
    if (!everOpened) { everOpened = true; save(); }
    plates.forEach(function (p) { p.n.classList.remove('nw'); });
    if (mark) mark.classList.remove('nw');
    markShown = false;         /* force the mark to be re-placed on the next paint */
  }

  /* ---- where the mark sits: bottom-right of whatever the colony currently owns,
     so it never lands on a band another piece put underneath. Between episodes it
     goes to the top-right, above the episode card.

     The top-right corner belongs to the crown (CONTRACT §12) and is only ceded once
     the episode card is actually covering it — 10-style.css hides #crown on
     `#app:has(#gate.on)` and nothing else. Keying this off the phase instead would
     move the mark a whole SETTLE beat early: chapters flip to 'result' and then hold
     the colony on screen for 600ms before raising the gate, and for that beat the
     crown is still up, so the mark would sit on top of #aboutBtn on every single
     chapter transition. Follow the same signal the stylesheet follows. ---- */
  function place() {
    if (!mark) return;
    var gt = document.getElementById('gate');
    var covered = !!gt && gt.classList.contains('on');
    var W = window.innerWidth, H = window.innerHeight, S = 46, pad = 9;
    if (covered) {
      mark.style.left = (W - S - pad) + 'px';
      mark.style.top = (pad + 6) + 'px';
      return;
    }
    var box = document.getElementById('world') || document.getElementById('stage');
    var r = box ? box.getBoundingClientRect() : null;
    var right = r && r.width > 60 ? r.right : W;
    var bot = r && r.height > 60 ? r.bottom : H;
    mark.style.left = Math.round(Math.max(pad, Math.min(W - S - pad, right - S - pad))) + 'px';
    mark.style.top = Math.round(Math.max(pad, Math.min(H - S - pad, bot - S - pad))) + 'px';
  }

  function paint() {
    if (!built) { build(); if (!built) return; }
    var t = performance.now();

    if (openNow) {
      /* the drawer cannot survive an incident opening under it */
      if (burning()) { closeGuide(); return; }
      if (t - markAt > 260) { markAt = t; refresh(false); }
      return;
    }

    /* the instant anything catches fire the mark is gone — checked every frame, because
       a way into the theory must not survive one frame of the decision it competes with */
    if (markShown && burning()) {
      markShown = false; quietAt = 0;
      mark.classList.remove('on');
    }
    if (t - markAt < 220) return;
    markAt = t;
    refresh(false);

    /* the mark appears in a LULL, not in the gap between two incidents: it goes the
       instant something catches fire and comes back only once the colony has been
       quiet for a beat, so it never blinks in and out under the player's thumb. */
    if (burning()) quietAt = 0;
    else if (!quietAt) quietAt = t;
    var show = canOpen() && (t - quietAt > 900 || (FZ.chapters && FZ.chapters.phase && FZ.chapters.phase() !== 'play'));
    if (show !== markShown) {
      markShown = show;
      mark.classList.toggle('on', show);
    }
    if (show) {
      place();
      var anyNew = false;
      for (var k in fresh) { if (fresh[k]) { anyNew = true; break; } }
      mark.classList.toggle('nw', anyNew);
    }
  }

  /* ============================================================
     CONTRACT SURFACE (§9)
     ============================================================ */
  /* Recorded, never revealed: which elements are live this episode is the sim's
     business. A plate is drawn by being witnessed, not by being enabled. */
  function setEnabled(set) {
    live = new Set();
    if (set && typeof set.forEach === 'function') set.forEach(function (s) { live.add(s); });
    else if (Array.isArray(set)) set.forEach(function (s) { live.add(s); });
  }

  /* open(sym) — CONTRACT §9. Opens the drawer at that plate if the drawer may open
     at all; if an incident is burning it is remembered and honoured afterwards. */
  function open(sym) {
    if (!openGuide(sym)) { wantSym = sym || null; return false; }
    return true;
  }

  load();
  if (FZ.bus) FZ.bus.on('fire', function (d) { if (d && d.sym) witness(d.sym); });

  api = {
    build: build,
    setEnabled: setEnabled,
    paint: paint,
    open: open,
    close: closeGuide,
    /* the guide, by its own name, for CHAPTERS or SHELL */
    openGuide: openGuide,
    closeGuide: closeGuide,
    canOpen: canOpen,
    isOpen: function () { return openNow; },
    collected: count,
    pulse: function (sym) { if (sym && !collected(sym)) return; },
    focus: null,
  };
  return api;
})();
