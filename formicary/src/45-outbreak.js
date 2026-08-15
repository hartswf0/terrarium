/* ============================================================
   45-outbreak.js — THE INCIDENT.  OWNER: PLAY.
   See CONTRACT.md §14, AESTHETIC.md §6, REFERENCE-EOT.md §2B and L11.

   THE GRAMMAR IS THREE BEATS, IN THIS ORDER, AND NOTHING ELSE:

     1. INCIDENT      something goes wrong and gets a BODY. A ring, a queue, ants that
                      cannot take the crumb, work sliding backwards. Nothing is written.
                      This file opens it and burns it; FIELD draws the body.
     2. RECOGNITION   TAG_DELAY ticks later — a beat after the eye has already found the
                      trouble — ONE small paper tag names the phenomenon in two lines.
                      CONTROLS hangs it. No two-letter code. Ever. Codes live in the guide.
     3. INTERVENTION  ONE contextual action surface, and only while a decision is live.

   What was deleted this round, deliberately: every narrator line this file used to emit
   (`firstOutbreak`, `firstMiss`, `firstWrong`, `firstAnswer`, `masteryOne`). They were a
   second and third explanation of an event that already has a tag and a body. At most one
   message exists on screen at any instant, so the extra voices are not quieted, they are
   gone.

   WHICH INSTRUMENT ANSWERS WHAT is not arbitrary and is not hidden. Each element's answer
   set is the instruments genuinely countering it in the sim.
     CHARTER arbitrates  VARY decorrelates  LEDGER remembers
     LENS reveals        SLOW brakes        EJECT excludes

   AND EJECT ANSWERS NOTHING UNLESS THE BODY YOU REMOVED IS THE ONE DOING IT. That was the
   round-one correctness bug: expelling an honest worker who happened to be standing inside a
   burning sabotage ring banked an ANSWERED and a refund while the real saboteur kept
   draining. See culprit() below.
   ============================================================ */
window.FZ = window.FZ || {};

FZ.outbreak = (function () {
  'use strict';

  /* sym -> the instruments that resolve it.
     SIM is the authority (`el.answers`, CONTRACT §14.4). This table is the fallback if an
     element ever ships without one, and a generosity margin: an instrument that genuinely
     counters the element in the sim is accepted even when the guide names a different one
     first. Being right for a readable reason is never punished. */
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
       the audit measures it going up). Only the LENS re-opens what was written off. */
    Cs: ['lens'],
    Hi: ['lens'],
    Tc: ['ledger'],
    Di: ['lens'],
    Rp: ['ledger'],
    /* goals and power */
    Tw: ['charter'],
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

  /* THE PHENOMENON NAMES — what the paper tag says.
     A name a naturalist would write on a card pinned beside the thing, and one plain line
     underneath. No taxonomy, no trigger/effect/counter, no code: those are the field
     guide's job and the guide is closed while anything is burning.

     VOICE owns the words. If `FZ.copy.phen` exists it wins outright; this table is the
     fallback so the piece is never mute, and is requested for 20-copy.js in the report. */
  var PHEN = {
    Co: ['CLAIMED TWICE', 'Two of them started it from opposite ends.'],
    Si: ['NOBODY KNOWS', 'Most of the colony never heard this work exists.'],
    Mc: ['TWO FINISHES', 'They both finished it, differently. It will not join.'],
    Dp: ['WAITING ON NOTHING', 'This one is stuck behind work nobody is doing.'],
    Ow: ['ONE PAIR OF HANDS', 'One worker is holding three jobs. All three rot.'],
    Pt: ['BUSY AND POOR', 'They grind the small crumbs and leave the big one.'],
    Cf: ['EVERYONE FOLLOWS', 'They pick whatever the others already picked.'],
    Lv: ['ALL ONE KIND', 'Nearly every worker here has the same lineage.'],
    Sf: ['FELL TOGETHER', 'One blind spot, shared. They went down at the same moment.'],
    Fl: ['THE STAMPEDE', 'Eight on one crumb. More hands, less work.'],
    Cl: ['PASSING IT BACK', 'Two of them trade the claim and never work it.'],
    Im: ['ONE BODY', 'The whole colony just made the same move.'],
    Gu: ['CHASING A RUMOUR', 'There is nothing there. They are going anyway.'],
    Cs: ['WRITTEN OFF', 'One bad crumb, and they shun every crumb like it.'],
    Hi: ['KNEW AND SAID NOTHING', 'Someone walked past that hazard and kept quiet.'],
    Tc: ['ALL VOICES EQUAL', 'Every source weighs the same. One of them is lying.'],
    Di: ['RIGHT AND ALONE', 'One worker found the best crumb. Nobody followed.'],
    Rp: ['LIED TWICE', 'Second lie. Nothing here remembers the first.'],
    Tw: ['BOTH SITTING ON IT', 'Two rivals, one crumb, and neither will move.'],
    Sa: ['COMING APART', 'Finished work is quietly draining away.'],
    Lo: ['STUCK CLAIM', 'Someone claimed it and stopped.'],
    My: ['QUICK WINS ONLY', 'They keep taking the small crumb over the big one.'],
    Es: ['ONLY EACH OTHER', 'The rivals stopped working. Now they only chase.'],
    Cr: ['WILL NOT BE GOVERNED', 'That one walks straight through whatever you put down.'],
    Mo: ['ONE OF EVERYTHING', 'One lineage, one habit, one way to be wrong.'],
    In: ['NO INSTITUTION', 'Nothing here settles anything.'],
    Sp: ['TOO FAST FOR HANDS', 'Everything sped up. You did not.'],
    Mm: ['DARK', 'You can see where they are. Not what they want.'],
  };

  /* said when the player expels a body that was not the one doing it — the correctness
     fix has to SAY something, and it must not say "answered". VOICE may override with
     FZ.copy.loop.wrongBody. */
  var WRONG_BODY = 'That one was working. Whatever is doing this is still in here.';

  /* ticks. The rAF loop steps once per frame, so ~60 ticks is a second.
     The fuse shortens with machine speed: that is how Sp becomes the difficulty
     curve rather than a caption. */
  var FUSE = 400, FUSE_MIN = 168, FUSE_MAX = 620;
  var FIRST_GRACE = 1.5;          /* the first one you ever see waits for you */
  var TAG_DELAY = 40;             /* beat 1 before beat 2: the body arrives before the name */
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
  var seq = 0;                    /* outbreak ids, so a tag can stay attached to one thing */
  var focusId = 0;                /* the one the player has pointed at, if any */
  var wired = false;
  var lastW = 0, lastH = 0;
  var api;

  function S() { return FZ.sim ? FZ.sim.state : null; }
  function loop(k) { return (FZ.copy && FZ.copy.loop && FZ.copy.loop[k]) || ''; }
  function wrongLine(sym) { return (FZ.copy && FZ.copy.wrong && FZ.copy.wrong[sym]) || ''; }
  function fireLine(sym) { return (FZ.copy && FZ.copy.fire && FZ.copy.fire[sym]) || ''; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function emit(n, d) { if (FZ.bus) FZ.bus.emit(n, d); }

  /* the two lines of the paper tag. VOICE first, fallback second, never a code. */
  function phen(sym) {
    var c = FZ.copy && FZ.copy.phen && FZ.copy.phen[sym];
    if (c && (c.name || c.line)) return { name: c.name || '', line: c.line || '' };
    var f = PHEN[sym];
    return f ? { name: f[0], line: f[1] } : { name: '', line: fireLine(sym) };
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
     An incident nothing in her hands can close is not a decision, it is a punishment. */
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

    var p = phen(d.sym);
    var o = {
      id: ++seq,
      sym: d.sym,
      /* kept just inside the field: an incident you cannot see the clock on is not a
         decision. The fuse arc starts at twelve o'clock, so the top of the ring is the
         part that must survive. */
      x: clamp(at.x, 22, st.w - 22),
      y: clamp(at.y, 26, st.h - 22),
      r: r,
      born: st.tick,
      /* BEAT ONE BEFORE BEAT TWO. For this many ticks the incident is only a body: ants
         piling up, work sliding back, a ring drawn where it is happening. The name arrives
         after the eye has already gone there. */
      tagAt: st.tick + TAG_DELAY,
      fuse: fuse,
      name: p.name,
      line: p.line,
      say: d.say || fireLine(d.sym),
      answers: answersFor(d.sym).slice(),
      who: (d.who || []).slice(),
      state: 'burning',
      endAt: 0,
    };
    list.push(o);
    /* the player is looking at whatever most recently caught fire, unless she has
       deliberately pointed at something else that is still burning */
    if (!current(true)) focusId = o.id;
    emit('outbreak:open', { sym: o.sym, x: o.x, y: o.y, fuse: o.fuse, r: o.r });
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
  }

  /* it closes: the failure visibly cools, and the instrument is paid back */
  function resolve(o, kind, st) {
    o.state = 'answered';
    o.endAt = st.tick + KEEP;
    cool[o.sym] = st.tick + COOL_OK;

    var back = (FZ.sim && FZ.sim.cost) ? FZ.sim.cost(kind) : 2;
    st.budget = Math.min(14, st.budget + back + 1);
    if (st.collapseMax !== Infinity) st.collapse = Math.max(0, st.collapse - ANSWER_RELIEF);

    /* the element drops out of the red immediately: the consequence is in the guide too */
    var e = el(o.sym);
    if (e) { e.heat = Math.min(e.heat, 0.1); e.on = false; }

    mark(o.sym, 'answered');
    emit('outbreak:answered', { sym: o.sym, x: o.x, y: o.y, r: o.r });
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

  /* THE CORRECTNESS FIX (round-one bug).
     EJECT is the only instrument that names a BODY rather than a place, so it is the only
     one that can be aimed at the wrong thing while still landing inside the ring. Expelling
     an honest worker out of a burning sabotage ring used to bank an ANSWERED and refund the
     spend while the saboteur kept draining — a bot banked eleven of them and gutted the
     colony while its strain climbed.

     An expulsion answers an incident only when the body removed IS the one causing it. The
     detectors already hand us the implicated ids on `fire`; the role flags are the backstop
     for a culprit that fired before this ring opened. Anything else is a wrong answer that
     says so, costs the budget, costs the colony a worker, and leaves the real one working. */
  function victimOf(st, x, y) {
    if (x == null) return null;
    var R = (FZ.sim && FZ.sim.ejectR) || 44, best = null, bd = R * R;
    for (var i = 0; i < st.agents.length; i++) {
      var a = st.agents[i], dx = a.x - x, dy = a.y - y, q = dx * dx + dy * dy;
      if (q < bd) { bd = q; best = a; }
    }
    return best;
  }
  function culprit(o, a) {
    if (!a) return false;
    if (o.who && o.who.length && o.who.indexOf(a.id) > -1) return true;
    switch (o.sym) {
      case 'Sa': return !!a.adversary;
      case 'Cr': return !a.corrigible;
      case 'Lo': return !!a.locker;
      case 'Cl': return !!(a.churner || a.colluder);
      /* eject is not the named instrument for anything else; if it ever becomes one,
         the caller has to teach this function who the body is. */
      default: return false;
    }
  }

  /* CONTROLS calls this BEFORE FZ.sim.apply. The spend can still fail (no budget, a
     tap with no worker under it), so the outcome is held until the sim reports back
     on `intervene`, and rolled back if nothing was actually spent. */
  function tryAnswer(kind, x, y) {
    var st = S();
    var miss = { hit: false, right: false, sym: null, msg: '' };
    if (!st || !kind) return miss;

    /* An expulsion is judged on the body, not on the distance: the saboteur wanders, and
       hunting it down outside the ring is exactly the skill the LENS is sold for. */
    if (kind === 'eject') {
      var o = current(true) || null, i;
      if (!o) { for (i = 0; i < list.length; i++) if (list[i].state === 'burning') { o = list[i]; break; } }
      if (!o || o.answers.indexOf('eject') < 0) {
        if (o) { pend = { o: o, kind: kind, right: false }; return { hit: true, right: false, sym: o.sym, msg: wrongLine(o.sym) }; }
        return miss;
      }
      var v = victimOf(st, x, y);
      if (!v) return miss;                       /* no body under the finger; sim will refuse */
      if (culprit(o, v)) {
        pend = { o: o, kind: kind, right: true };
        return { hit: true, right: true, sym: o.sym, msg: loop('answered') };
      }
      pend = { o: o, kind: kind, right: false, body: true };
      return { hit: true, right: false, sym: o.sym, msg: loop('wrongBody') || WRONG_BODY };
    }

    var best = null, bd = Infinity, near = null;
    for (var k = 0; k < list.length; k++) {
      var c = list[k];
      if (c.state !== 'burning') continue;
      var d = (x == null) ? 0 : Math.sqrt((c.x - x) * (c.x - x) + (c.y - y) * (c.y - y));
      var reach = c.r + 26;
      if (d <= reach) { if (d < bd) { bd = d; best = c; } }
      else if (c.answers.indexOf(kind) > -1 && !near) near = c;
    }

    if (!best) {
      /* the right instrument, in the wrong place: say so, and let it apply anyway */
      if (near) return { hit: false, right: false, sym: near.sym, msg: loop('tooFar') };
      return miss;
    }

    if (best.answers.indexOf(kind) > -1) {
      pend = { o: best, kind: kind, right: true };
      return { hit: true, right: true, sym: best.sym, msg: loop('answered') };
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
    emit('outbreak:wrong', {
      sym: p.o.sym, kind: p.kind, body: !!p.body,
      msg: p.body ? (loop('wrongBody') || WRONG_BODY) : wrongLine(p.o.sym),
      x: p.o.x, y: p.o.y,
    });
  }

  /* ---------------------------------------------------------------- the focus */
  /* THE ONE BEING ASKED ABOUT. There is exactly one paper tag, so exactly one incident
     owns the words at a time; the others stay legible from their bodies alone (CONTRACT
     §12.1). Default is whichever is closest to landing — the one that will hurt first —
     unless the player has tapped a different burning ring to read it. */
  function current(ignoreDelay) {
    var st = S();
    if (!st) return null;
    var i, o, ready = [];
    for (i = 0; i < list.length; i++) {
      o = list[i];
      if (o.state !== 'burning') continue;
      if (!ignoreDelay && st.tick < o.tagAt) continue;
      ready.push(o);
    }
    if (!ready.length) return null;
    for (i = 0; i < ready.length; i++) if (ready[i].id === focusId) return ready[i];
    var best = ready[0], bl = left(best, st);
    for (i = 1; i < ready.length; i++) { var l = left(ready[i], st); if (l < bl) { bl = l; best = ready[i]; } }
    return best;
  }

  /* -------------------------------------------------------------------- update */
  function update(st) {
    if (!st) return;
    if (!wired) wire();

    /* the phone rotated, or a panel grew a line: the sim rescales its world, so
       the incidents have to move with it or they point at nothing. */
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
        if (list[i].id === focusId) focusId = 0;
        list.splice(i, 1);
      }
    }
  }

  function wire() {
    if (wired || !FZ.bus) return;
    wired = true;
    FZ.bus.on('fire', open);
    FZ.bus.on('intervene', settle);
    FZ.bus.on('lose', function () { list.length = 0; pend = null; focusId = 0; });
    FZ.bus.on('goal', function () { list.length = 0; pend = null; focusId = 0; });
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
      focusId = 0;
      var st = S();
      lastW = st ? st.w : 0; lastH = st ? st.h : 0;
      cap = (scenario && scenario.outbreakCap != null) ? scenario.outbreakCap : 1;
      api.cap = cap;
      wire();
    },

    update: update,
    tryAnswer: tryAnswer,

    /* the incident that owns the paper tag and the action surface right now */
    current: current,

    /* the player pointed at the field: if she pointed at a burning ring, that is the one
       she is reading now, and the tag moves to it. Returns true if the focus changed. */
    focusAt: function (x, y) {
      var best = null, bd = Infinity;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (o.state !== 'burning') continue;
        var dx = o.x - x, dy = o.y - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < o.r + 26 && d < bd) { bd = d; best = o; }
      }
      if (!best || best.id === focusId) return false;
      focusId = best.id;
      return true;
    },

    /* fraction of fuse remaining, 1 -> 0, for whoever needs to draw a clock */
    left: function (o) { var st = S(); return (st && o) ? clamp(left(o, st), 0, 1) : 0; },

    /* the one a tap should be judged against when the instrument is untargeted:
       whichever is closest to landing. */
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

    /* the two lines of the tag, for anyone who must show a phenomenon by name.
       Never a two-letter code — that is the guide's, and only the guide's. */
    phen: phen,
    answersFor: answersFor,
  };
  return api;
})();
