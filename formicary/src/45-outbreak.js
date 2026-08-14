/* ============================================================
   45-outbreak.js — THE CORE LOOP.  OWNER: PLAY.
   See CONTRACT.md §14 and REFERENCE-EOT.md §2B.

   A detector firing used to warm a table cell and nothing else. Here it opens an
   OUTBREAK: a bounded place on the field, named in one plain sentence, on a fuse of a
   few seconds, doing real damage the whole time it burns. The player reads which
   failure it is and answers it with the right institution, in the right place, in time.

     right instrument, inside the ring, before the fuse   -> it closes, the strain is
        refunded, the cell is marked as one she has answered herself
     wrong instrument                                     -> it does not close, and the
        game says plainly what the failure actually is
     the fuse runs out                                    -> the damage lands where it
        happened: work rolls back, workers go down, strain spikes, a scar stays

   FIELD draws the ring, the fuse and the resolution; TABLE pulses and marks the cell;
   CONTROLS routes every tap through tryAnswer() before FZ.sim.apply, so a correct
   diagnosis can be paid back and a wrong one can teach. This file draws nothing and
   contains no English: every sentence comes from FZ.copy.

   WHICH INSTRUMENT ANSWERS WHAT is not arbitrary and is not hidden. Each element's
   answer set is exactly the instruments NAMED in the counter line the player can already
   read on its table cell (FZ.copy.detail[sym].counter), so the mapping is learnable by
   tapping the cell — with one deliberate exception, noted at Sa below.
     CHARTER arbitrates  VARY decorrelates  LEDGER remembers
     LENS reveals        SLOW brakes        EJECT excludes
   ============================================================ */
window.FZ = window.FZ || {};

FZ.outbreak = (function () {
  'use strict';

  /* sym -> the instruments that resolve it.
     SIM is the authority (`el.answers`, CONTRACT §14.4). This table is the fallback if an
     element ever ships without one, and a generosity margin: an instrument that genuinely
     counters the element in the sim is accepted even when the cell's counter line names a
     different one first. Being right for a readable reason is never punished. */
  var ANSWERS = {
    /* coordination */
    Co: ['charter'],
    Si: ['lens'],
    Mc: ['charter'],
    Dp: ['lens', 'charter'],
    Ow: ['charter'],
    Pt: ['lens'],
    /* conformity */
    Cf: ['vary', 'slow'],
    Lv: ['vary'],
    Sf: ['vary'],
    Fl: ['slow', 'charter'],
    Cl: ['charter', 'eject'],
    Im: ['vary'],
    /* epistemics */
    Gu: ['ledger'],
    /* Cs: the LEDGER is the CAUSE, not the cure (§15.1 — skepticism up amplifies Cs, and
       the audit measures it going up). Only the LENS re-opens what was written off, and
       only the LENS is in counteredBy. Accepting a ledger here would pay the player for
       the exact move that made it worse. */
    Cs: ['lens'],
    Hi: ['lens'],
    Tc: ['ledger'],
    Di: ['lens'],
    Rp: ['ledger'],
    /* goals and power */
    Tw: ['charter'],
    /* Sa: the counter line says find it with a LENS, then EJECT. Only the expulsion
       ends it, so only the expulsion answers it — looking is not doing. */
    Sa: ['eject'],
    Lo: ['charter', 'eject'],
    My: ['lens'],
    Es: ['slow', 'charter'],
    Cr: ['eject'],
    /* meta */
    Mo: ['vary'],
    In: ['charter'],
    Sp: ['slow'],
    Mm: ['lens'],
  };

  /* ticks. The rAF loop steps once per frame, so ~60 ticks is a second.
     The fuse shortens with machine speed: that is how Sp becomes the difficulty
     curve rather than a caption. */
  var FUSE = 400, FUSE_MIN = 168, FUSE_MAX = 620;
  var FIRST_GRACE = 1.5;          /* the first one you ever see waits for you */
  var COOL_OK = 210, COOL_MISS = 160;
  var KEEP = 130;                 /* how long a resolved outbreak stays inspectable */
  var BURN_DRAIN = 0.05;          /* progress lost per tick inside a burning ring */
  var LAND_STRAIN = 6, ANSWER_RELIEF = 4;
  var STORE = 'formicary.mastery';

  var list = [];
  var mastery = {};
  var cap = 1;
  var cool = {};
  var pend = null;                /* an answer awaiting the sim's verdict on the spend */
  var seen = 0;                   /* outbreaks opened this run */
  var said = {};                  /* one-off narrator lines, once per session */
  var wired = false;
  var lastW = 0, lastH = 0;
  var api;

  function S() { return FZ.sim ? FZ.sim.state : null; }
  function loop(k) { return (FZ.copy && FZ.copy.loop && FZ.copy.loop[k]) || ''; }
  function wrongLine(sym) { return (FZ.copy && FZ.copy.wrong && FZ.copy.wrong[sym]) || ''; }
  function fireLine(sym) { return (FZ.copy && FZ.copy.fire && FZ.copy.fire[sym]) || ''; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function emit(n, d) { if (FZ.bus) FZ.bus.emit(n, d); }
  function say(key, tone) {
    if (said[key]) return;
    said[key] = 1;
    var t = loop(key);
    if (t) emit('say', { text: t, tone: tone || 'plain' });
  }

  /* ------------------------------------------------------------------ mastery */
  function load() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORE);
      if (!raw) return;
      var o = JSON.parse(raw);
      for (var k in o) {
        if (!ANSWERS[k] || !o[k]) continue;
        mastery[k] = { answered: o[k].answered | 0, missed: o[k].missed | 0 };
      }
    } catch (e) { /* private mode, file://, quota — mastery is a bonus, never a blocker */ }
  }
  function save() {
    try { if (window.localStorage) window.localStorage.setItem(STORE, JSON.stringify(mastery)); }
    catch (e) { }
  }
  function mark(sym, key) {
    var m = mastery[sym] || (mastery[sym] = { answered: 0, missed: 0 });
    m[key]++;
    save();
    return m;
  }

  /* -------------------------------------------------------------------- shape */
  function answersFor(sym) {
    var e = FZ.ELBY ? FZ.ELBY[sym] : null;
    var out = (e && e.answers && e.answers.length) ? e.answers.slice() : [];
    var extra = ANSWERS[sym] || [];
    for (var i = 0; i < extra.length; i++) if (out.indexOf(extra[i]) < 0) out.push(extra[i]);
    return out;
  }

  /* Only ever ask a question the player has been handed an instrument to answer.
     An outbreak nothing in the bar can close is not a decision, it is a punishment. */
  function answerable(sym, st) {
    var A = answersFor(sym), T = st.tools || [];
    for (var i = 0; i < A.length; i++) if (T.indexOf(A[i]) > -1) return true;
    return false;
  }

  function radius(st) { return clamp(Math.min(st.w, st.h) * 0.22, 56, 92); }

  function burningCount() {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (list[i].state === 'burning') n++;
    return n;
  }
  function findBurning(sym) {
    for (var i = 0; i < list.length; i++) if (list[i].state === 'burning' && list[i].sym === sym) return list[i];
    return null;
  }
  function left(o, st) {
    if (!o.fuse) return 0;
    return 1 - (st.tick - o.born) / o.fuse;
  }

  /* -------------------------------------------------------------------- open */
  function open(d) {
    var st = S();
    if (!st || !d || !d.sym || st.gameOver) return;
    if (cap <= 0) return;
    if (FZ.chapters && FZ.chapters.phase && FZ.chapters.phase() !== 'play') return;
    if (!answerable(d.sym, st)) return;
    if (findBurning(d.sym)) return;
    if (cool[d.sym] > st.tick) return;
    if (burningCount() >= cap) return;

    var at = d.at || { x: st.w / 2, y: st.h / 2 };
    var r = radius(st);
    var fuse = Math.round(clamp(FUSE / Math.max(1, st.speedMul || 1), FUSE_MIN, FUSE_MAX));
    if (seen === 0) fuse = Math.round(fuse * FIRST_GRACE);
    seen++;

    var o = {
      sym: d.sym,
      /* kept just inside the field: an outbreak you cannot see the clock on is not a
         decision. The fuse arc starts at twelve o'clock, so the top of the ring is the
         part that must survive. */
      x: clamp(at.x, 22, st.w - 22),
      y: clamp(at.y, 26, st.h - 22),
      r: r,
      born: st.tick,
      fuse: fuse,
      say: d.say || fireLine(d.sym),
      answers: answersFor(d.sym).slice(),
      who: (d.who || []).slice(),
      state: 'burning',
      endAt: 0,
    };
    list.push(o);
    emit('outbreak:open', { sym: o.sym, x: o.x, y: o.y, fuse: o.fuse, r: o.r });
    say('firstOutbreak', 'bad');
  }

  /* ------------------------------------------------------------------- damage */
  function el(sym) { return FZ.ELBY ? FZ.ELBY[sym] : null; }

  /* it burns: work inside the ring goes backwards while the player decides */
  function burn(o, st) {
    var d = BURN_DRAIN * (st.tempo || 1), r2 = o.r * o.r;
    for (var i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done || j.progress <= 0) continue;
      var dx = j.x - o.x, dy = j.y - o.y;
      if (dx * dx + dy * dy > r2) continue;
      j.progress = Math.max(0, j.progress - d);
    }
  }

  /* it lands: the damage arrives where it happened, all at once, and stays visible */
  function land(o, st) {
    o.state = 'landed';
    o.endAt = st.tick + KEEP;
    cool[o.sym] = st.tick + COOL_MISS;

    var r2 = (o.r * 1.15) * (o.r * 1.15), i;
    for (i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done) continue;
      var dx = j.x - o.x, dy = j.y - o.y;
      if (dx * dx + dy * dy > r2) continue;
      if (j.progress > 0) { j.progress = Math.max(0, j.progress * 0.4 - 4); j.flash = 12; }
    }
    /* the nearest few go down, not the whole colony: a miss must be legible as a
       located event, not a screen-wide freeze you cannot read */
    var near = [];
    for (i = 0; i < st.agents.length; i++) {
      var a = st.agents[i];
      var ax = a.x - o.x, ay = a.y - o.y, q = ax * ax + ay * ay;
      if (q <= r2) near.push({ a: a, q: q });
    }
    near.sort(function (p, z) { return p.q - z.q; });
    for (i = 0; i < near.length && i < 4; i++) {
      near[i].a.stun = Math.max(near[i].a.stun, 44);
      near[i].a.flash = 12;
      emit('agent:hurt', { id: near[i].a.id, x: near[i].a.x, y: near[i].a.y });
    }
    if (st.collapseMax !== Infinity) st.collapse = Math.min(st.collapseMax, st.collapse + LAND_STRAIN);
    var e = el(o.sym);
    if (e) e.heat = Math.min(1, e.heat + 0.3);

    mark(o.sym, 'missed');
    emit('outbreak:landed', { sym: o.sym, x: o.x, y: o.y, r: o.r });
    say('firstMiss', 'bad');
  }

  /* it closes: the failure visibly cools, and the instrument is paid back */
  function resolve(o, kind, st) {
    o.state = 'answered';
    o.endAt = st.tick + KEEP;
    cool[o.sym] = st.tick + COOL_OK;

    var back = (FZ.sim && FZ.sim.cost) ? FZ.sim.cost(kind) : 2;
    st.budget = Math.min(14, st.budget + back + 1);
    if (st.collapseMax !== Infinity) st.collapse = Math.max(0, st.collapse - ANSWER_RELIEF);

    /* the cell drops out of the red immediately: the consequence is in the table too */
    var e = el(o.sym);
    if (e) { e.heat = Math.min(e.heat, 0.1); e.on = false; }

    var m = mark(o.sym, 'answered');
    emit('outbreak:answered', { sym: o.sym, x: o.x, y: o.y, r: o.r });
    say('firstAnswer', 'good');
    if (m.answered === 1) say('masteryOne', 'good');
  }

  /* it stopped on its own terms: the element is genuinely countered and has gone cold,
     so the ring closes rather than burning down a fire that is already out. No reward and
     no mastery credit — the player fixed the colony, but did not answer THIS, here. */
  function defuse(o, st) {
    o.state = 'answered';
    o.endAt = st.tick + KEEP;
    cool[o.sym] = st.tick + COOL_OK;
    emit('outbreak:answered', { sym: o.sym, x: o.x, y: o.y, r: o.r });
  }

  /* ------------------------------------------------------------------ answers */
  /* CONTROLS calls this BEFORE FZ.sim.apply. The spend can still fail (no budget, a
     tap with no worker under it), so the outcome is held until the sim reports back
     on `intervene`, and rolled back if nothing was actually spent. */
  function tryAnswer(kind, x, y) {
    var st = S();
    var miss = { hit: false, right: false, sym: null, msg: '' };
    if (!st || !kind) return miss;

    var best = null, bd = Infinity, near = null;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.state !== 'burning') continue;
      var d = (x == null) ? 0 : Math.sqrt((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y));
      var reach = o.r + 26;
      if (d <= reach) { if (d < bd) { bd = d; best = o; } }
      else if (o.answers.indexOf(kind) > -1 && !near) near = o;
    }

    if (!best) {
      /* the right instrument, in the wrong place: say so, and let it apply anyway */
      if (near) return { hit: false, right: false, sym: near.sym, msg: loop('tooFar') };
      return miss;
    }

    if (best.answers.indexOf(kind) > -1) {
      pend = { o: best, kind: kind, right: true };
      return { hit: true, right: true, sym: best.sym, msg: loop('answered') + ' — ' + loop('refund') };
    }
    pend = { o: best, kind: kind, right: false };
    return { hit: true, right: false, sym: best.sym, msg: wrongLine(best.sym) };
  }

  function settle(d) {
    if (!pend) return;
    var p = pend; pend = null;
    var st = S();
    if (!st || !d || !d.ok) return;              /* nothing was spent — nothing happened */
    if (p.o.state !== 'burning') return;
    if (p.right) { resolve(p.o, p.kind, st); return; }
    emit('outbreak:wrong', { sym: p.o.sym, kind: p.kind, msg: wrongLine(p.o.sym) });
    say('firstWrong', 'bad');
  }

  /* ------------------------------------------------------------------- update */
  function update(st) {
    if (!st) return;
    if (!wired) wire();

    /* the phone rotated, or the ticker grew a line: the sim rescales its world, so
       the outbreaks have to move with it or they point at nothing. */
    if (lastW && lastH && (lastW !== st.w || lastH !== st.h)) {
      var kx = st.w / lastW, ky = st.h / lastH;
      for (var q = 0; q < list.length; q++) { list[q].x *= kx; list[q].y *= ky; }
    }
    lastW = st.w; lastH = st.h;

    for (var i = list.length - 1; i >= 0; i--) {
      var o = list[i];
      if (o.state === 'burning') {
        var e = el(o.sym);
        if (e && e.countered && e.heat < 0.1 && st.tick - o.born > 45) defuse(o, st);
        else if (st.tick - o.born >= o.fuse) land(o, st);
        else burn(o, st);
      } else if (st.tick >= o.endAt) {
        list.splice(i, 1);
      }
    }
  }

  function wire() {
    if (wired || !FZ.bus) return;
    wired = true;
    FZ.bus.on('fire', open);
    FZ.bus.on('intervene', settle);
    FZ.bus.on('lose', function () { list.length = 0; pend = null; });
    FZ.bus.on('goal', function () { list.length = 0; pend = null; });
  }

  load();
  wire();

  api = {
    list: list,
    mastery: mastery,
    enabled: true,
    cap: 1,

    reset: function (scenario) {
      list.length = 0;
      pend = null;
      cool = {};
      seen = 0;
      var st = S();
      lastW = st ? st.w : 0; lastH = st ? st.h : 0;
      cap = (scenario && scenario.outbreakCap != null) ? scenario.outbreakCap : 1;
      api.cap = cap;
      wire();
    },

    update: update,
    tryAnswer: tryAnswer,

    /* the one a tap should be judged against when the instrument is untargeted:
       whichever is closest to landing. CONTROLS uses this. */
    urgent: function () {
      var st = S();
      if (!st) return null;
      var best = null, bl = 2;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (o.state !== 'burning') continue;
        var l = left(o, st);
        if (l < bl) { bl = l; best = o; }
      }
      return best;
    },

    /* how many of the twenty-eight this player has personally answered */
    answeredCount: function () {
      var n = 0;
      for (var k in mastery) if (mastery[k] && mastery[k].answered > 0) n++;
      return n;
    },

    answersFor: answersFor,
  };
  return api;
})();
