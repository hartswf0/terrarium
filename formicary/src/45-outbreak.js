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

   ------------------------------------------------------------------------------
   THIS ROUND: THE INCIDENT OPENS ON A PHYSICAL SITUATION, NOT ON A COORDINATE
   ------------------------------------------------------------------------------
   The verdict was exact: THE EMPTY GROUND opened over two ants standing near a chamber,
   and "no institution" existed only in the sentence. That is the Depiction Law failing at
   the one place it is least affordable — the first tag a player ever meets.

   The nest is now a real movement graph (CONTRACT §16), so every one of those sentences
   has somewhere to point. anchor() below is the whole answer: before an incident is drawn
   it is RESOLVED ONTO A SITE — a junction, a passage, a sealed chamber, a dig face, a knot
   of implicated bodies — and the ring is sized to hold that site and nothing more.

       In  the crossroads where three tunnels meet and nobody keeps the line
       Si  the chamber with no tunnel to it at all
       Fl  the room packed to its walls, or the passage standing solid
       Lo  the body parked in the passage and the line behind it
       Tw  the two rivals nose to nose where only one fits
       Dp  the dig face nobody is cutting, with the work stuck behind it
       Co  the crumb two workers walked in on by two different tunnels
       Cf  the one road worn bright, with the cold one beside it
       Ow  the room of the worker holding more rooms than it can stand in

   Two rules underneath all of them:

     AN INCIDENT NEVER OPENS ON EMPTY EARTH. If the chosen site holds no body and no
     structural fact, the incident moves to the nearest knot of ants it is about, and if
     even that fails it does not open. holds(), nearestKnot().

     AN INCIDENT WAITS FOR ITS BODY. On the first pass the anchor is STRICT: a failure
     with a situation of its own will not open until the colony is actually in that
     situation. It goes to the waiting room, is retried every tick, and only after
     WAIT_BODY ticks will it settle for the bodies the detector named. The same waiting
     room re-times the clusters — the colony fails three at a time and then goes quiet,
     and the overflow used to be thrown away.

   ------------------------------------------------------------------------------
   THIS ROUND: THE RING IS THE BODIES, AND IT STAYS ON THEM FOR THE WHOLE FUSE
   ------------------------------------------------------------------------------
   Three critics independently found the same thing and they were right. Measured on the
   shipped build, chapter four: a ring reading THE JAMMED TUNNEL drawn over a stretch of
   corridor holding ZERO ants for its entire life, with four of them nose to tail two
   hundred pixels outside it. Chapter eight: an In ring on a four-way junction holding one
   solitary worker while the tag said "Nothing here settles anything."

   Two causes, both fixed here.

     THE EDGE PASS WAS UNCONDITIONAL. holds() used to accept ANY passage on the grounds
     that a passage is a thing. A passage is not an incident; THE ANTS IN IT ARE. holds()
     now counts bodies, and the count it demands depends on what the sentence claims: a
     failure whose meaning is a crowd (In Cf Dp Fl Im Sp Co Mc Tw Es Cl Mm) needs two of
     them inside the ring or it does not open at all; a failure about one worker or one
     untouched crumb needs that one worker or that crumb. siteJam() likewise now weighs
     LIVE LOAD twenty times above tunnel wear and refuses any passage with fewer than two
     bodies standing in it, so THE JAMMED TUNNEL lands on the passage the queue is in
     rather than on the shiniest corridor in the nest.

     THE PIN WAS SET ONCE. The ring was anchored at open() and then held still while the
     colony walked out from under it, so by the time the tag was hung it named an empty
     corridor. repin(), called from burn() every tick, re-reads the situation and follows
     the implicated bodies for the whole fuse: if the crossroads being contended is now a
     different crossroads, the ring moves; if the knot walks down a tunnel, the ring rides
     with it.

   AND: THE CLOCK IS CUT TO THE COLONY'S NEW TEMPO. WORLD slowed the nest to something a
   person can watch and the incident clock was never re-cut against it — a flat 900-tick
   fuse and a whole passage that produced ONE decision in twenty-seven seconds. The fuse
   is now ~330 ticks (about six seconds at the measured 56 ticks/second), and pull() puts
   a decision back on the table within about four seconds of the last one closing, because
   a detector only speaks on a RISING edge and a colony can sit in obvious, unanswered
   trouble in complete silence. The sandbox was measured correct at one decision every
   three seconds and is left exactly as it was.
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

  /* ticks. MEASURED, not assumed: the shipped build runs 56 ticks a second on a 390px
     phone, so a second is about 56 and the numbers below are quoted in both.
     The fuse shortens with machine speed: that is how Sp becomes the difficulty
     curve rather than a caption.

     RE-CUT AGAINST THE NEW TEMPO, ROUND TWO. The previous pass slowed the fuse to match
     a colony you can watch and overshot badly: ten and a half seconds of fuse plus a cap
     of one meant chapter four spent twenty-seven seconds producing a single decision. A
     chapter that yields one decision must yield five or six. The colony's pace was right;
     the clock on top of it was not.

       FUSE 330       about six seconds. Long enough to read the queue, watch it grow and
                      choose; short enough that a passage is a run of decisions and not
                      one decision with waiting either side of it.
       FUSE_SANDBOX   the last chapter was measured at one decision every three seconds
                      and is CORRECT. It keeps the number it had. Everything else is
                      tuned toward it, not away from it.
       FUSE_MIN 165   at machine speed the same incident is under three seconds. Sp is
                      still the difficulty curve; it now starts from a colony you can see.
       TAG_DELAY 45   eight tenths of a second of BODY before any word — a beat the eye
                      can use, and no longer a quarter of the whole fuse.
       COOL_*         the same failure does not re-open on top of itself, but it may come
                      back inside three seconds, because it is still happening. */
  var FUSE = 330, FUSE_SANDBOX = 620, FUSE_MIN = 165, FUSE_MAX = 900;
  var FIRST_GRACE = 1.7;          /* the first one you ever see waits for you */
  var TAG_DELAY = 45;             /* beat 1 before beat 2: the body arrives before the name */
  var COOL_OK = 190, COOL_MISS = 130;
  /* THE GAP. A detector only emits `fire` on a RISING edge, so a failure that is already
     hot and stays hot never speaks twice, and the player can be left with nothing on the
     table while the colony is visibly falling apart. When nothing has burned for this
     long, the hottest live element the player holds an instrument for is put back on the
     table directly. Nothing is invented — heat is the detector's own reading of the live
     sim, and the site still has to pass the body test below. */
  var GAP = 230;                  /* ~4.1s after you answered one: the beat you earned */
  var GAP_HARD = 160;             /* ~2.9s after one landed: trouble compounds, it does
                                     not buy quiet. The player who answers gets the room
                                     to breathe; the player who watches gets the colony. */
  var GAP_RETRY = 45;             /* if the colony had no body to point at, try again soon */
  var PULL_HOT = 0.10;
  var KEEP = 170;                 /* how long a resolved outbreak stays inspectable */
  /* the fuse is the exposure: a shorter one must not mean a cheaper miss, so the
     per-tick rate rises in the same proportion the fuse fell. Ignoring an incident costs
     what it always cost; it now costs it faster. */
  var BURN_DRAIN = 0.06;          /* progress lost per tick inside a burning ring */
  var LAND_STRAIN = 6, ANSWER_RELIEF = 6;
  var STORE = 'formicary.mastery';

  var list = [];
  var mastery = {};
  var cap = 1;
  var baseFuse = FUSE;
  var quietSince = 0, quietGap = GAP;
  var cool = {};
  /* THE WAITING ROOM. Measured in the sandbox: the colony does not fail at a steady
     rate, it fails in clusters — three detectors trip inside a second and then nothing
     trips for half a minute. Everything over the cap used to be thrown away, so the
     player spent half the sandbox with no decision on the table at all, then got three
     at once. Overflow now WAITS a few seconds for a slot, and is only let in if the
     element is still genuinely hot when the slot opens. Nothing is invented and nothing
     is invented late: the queue only re-times trouble the colony really is in, and drops
     it entirely if the colony cools. Measured in the shipped sandbox with this in place:
     a decision is on the table 97% of the ticks the game is actually in play, and the
     colony no longer alternates between three at once and nothing at all. */
  var waiting = [];
  var WAIT_KEEP = 1200;           /* how long an unserved fire stays worth serving (~20s) */
  var WAIT_HOT = 0.14;            /* and how hot its element must still be */
  var WAIT_BODY = 110;            /* how long an incident waits for its own situation */
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
  /* has this person ever answered anything, anywhere? Mastery persists across sessions,
     so this is a real question about the human and not about the current chapter. */
  function firstTimer() {
    var n = 0;
    for (var k in mastery) if (mastery[k]) n += (mastery[k].answered | 0) + (mastery[k].missed | 0);
    return n < 3;
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

  /* ============================================================================
     THE SITE — where the incident physically IS.

     Every function below returns a site or null, and null means "I could not find
     this situation in the nest right now", never "put it anywhere". The ring is sized
     to hold the site: a junction ring holds the junction and the mouths of the tunnels
     meeting at it; a passage ring holds the passage. A ring wider than its situation is
     the old bug in a smaller font — it points at a region instead of a thing.
     ============================================================================ */
  function nodesOf(st) { return (st.nest && st.nest.nodes) || []; }
  function edgesOf(st) { return (st.nest && st.nest.edges) || []; }
  function agentOf(st, id) {
    var A = st.agents;
    for (var i = 0; i < A.length; i++) if (A[i].id === id) return A[i];
    return null;
  }
  function edgeLoad(e) { return e.occ.length + e.qa.length + e.qb.length; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function bodiesNear(st, x, y, r) {
    var n = 0, r2 = r * r;
    for (var i = 0; i < st.agents.length; i++) {
      var a = st.agents[i], dx = a.x - x, dy = a.y - y;
      if (dx * dx + dy * dy <= r2) n++;
    }
    return n;
  }
  function idsNear(st, x, y, r) {
    var out = [], r2 = r * r;
    for (var i = 0; i < st.agents.length; i++) {
      var a = st.agents[i], dx = a.x - x, dy = a.y - y;
      if (dx * dx + dy * dy <= r2) out.push(a.id);
    }
    return out;
  }

  /* a room or a crossroads. pad is how far past its wall the ring reaches — for a
     junction that is how much of each tunnel you can see meeting there. */
  function atNode(st, n, pad) {
    if (!n) return null;
    return { kind: 'node', id: n.id, x: n.x, y: n.y, r: clamp(n.r + (pad == null ? 34 : pad), 46, 92) };
  }
  /* a passage, held whole, or held around one point in it (a parked body, a dig face) */
  function atEdge(st, e, cx, cy) {
    var N = nodesOf(st), A = N[e.a], B = N[e.b];
    if (!A || !B) return null;
    var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    var x = (cx == null) ? mx : cx, y = (cy == null) ? my : cy;
    var half = dist(A.x, A.y, B.x, B.y) / 2;
    var reach = Math.max(half + 18, dist(x, y, mx, my) + 34);
    return {
      kind: 'edge', id: e.id, x: x, y: y, r: clamp(reach, 46, 92),
      ax: A.x, ay: A.y, bx: B.x, by: B.y, dug: !!e.dug,
    };
  }
  /* a knot of the bodies this failure is actually about — the TIGHTEST knot, not their
     average, because the average of two ants in two tunnels is a wall. */
  function atBodies(st, ids) {
    var pts = [], i, k;
    for (i = 0; i < (ids || []).length; i++) { var a = agentOf(st, ids[i]); if (a) pts.push(a); }
    if (!pts.length) return null;
    var seed = pts[0], bn = -1;
    for (i = 0; i < pts.length; i++) {
      var n = 0;
      for (k = 0; k < pts.length; k++) if (dist(pts[i].x, pts[i].y, pts[k].x, pts[k].y) < 96) n++;
      if (n > bn) { bn = n; seed = pts[i]; }
    }
    var sx = 0, sy = 0, m = 0;
    for (i = 0; i < pts.length; i++) {
      if (dist(seed.x, seed.y, pts[i].x, pts[i].y) > 96) continue;
      sx += pts[i].x; sy += pts[i].y; m++;
    }
    var x = sx / m, y = sy / m, far = 0;
    for (i = 0; i < pts.length; i++) {
      var d = dist(x, y, pts[i].x, pts[i].y);
      if (d <= 96 && d > far) far = d;
    }
    /* A KNOT OF BODIES IS STILL A KNOT ON THE NETWORK. Bodies walk; the room and the
       passage they are in do not. So the ring is centred on the structure they occupy —
       otherwise it marks where they were a second and a half ago, which is the same
       failure as marking bare earth, only harder to spot. */
    var g = snapTo(st, x, y);
    if (g && dist(x, y, g.x, g.y) < 46) {
      return { kind: 'crowd', id: g.id, x: g.x, y: g.y, r: clamp(Math.max(far + 30, g.r), 46, 92) };
    }
    return { kind: 'crowd', id: 0, x: x, y: y, r: clamp(far + 30, 46, 92) };
  }

  /* nearest point on a segment — used to put a stray coordinate back on the network */
  function nearPt(x, y, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
    if (!L) return { x: ax, y: ay };
    var t = clamp(((x - ax) * vx + (y - ay) * vy) / L, 0, 1);
    return { x: ax + vx * t, y: ay + vy * t };
  }
  /* NO INCIDENT IS EVER CENTRED IN SOLID EARTH. A coordinate from a detector that has no
     situation of its own still lands on the network: the room or the passage nearest it. */
  function snapTo(st, x, y) {
    var N = nodesOf(st), E = edgesOf(st), i;
    var bn = null, bnd = Infinity;
    for (i = 0; i < N.length; i++) {
      var d = dist(x, y, N[i].x, N[i].y) - N[i].r;
      if (d < bnd) { bnd = d; bn = N[i]; }
    }
    var be = null, bed = Infinity, bp = null;
    for (i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e.dug) continue;
      var A = N[e.a], B = N[e.b];
      if (!A || !B) continue;
      var p = nearPt(x, y, A.x, A.y, B.x, B.y), q = dist(x, y, p.x, p.y);
      if (q < bed) { bed = q; be = e; bp = p; }
    }
    if (bn && bnd <= bed) return atNode(st, bn, 34);
    if (be) return atEdge(st, be, bp.x, bp.y);
    return bn ? atNode(st, bn, 34) : { kind: 'ground', id: 0, x: x, y: y, r: 60 };
  }

  /* ---- the situations, one per body in the §16.2 table ---- */

  /* a crossroads with nobody keeping it: three ways meet, bodies are waiting, no arch.
     `bare` prefers the UNGOVERNED one, which is the whole of In. */
  function siteCross(st, bare) {
    var N = nodesOf(st), E = edgesOf(st), best = null, bs = 0;
    for (var i = 0; i < N.length; i++) {
      var n = N[i];
      if (n.kind === 'surface') continue;
      var ways = 0, waiting = n.occ.length, k;
      for (k = 0; k < n.edges.length; k++) {
        var e = E[n.edges[k]];
        if (!e || !e.dug) continue;
        ways++;
        waiting += (e.a === n.id ? e.qa : e.qb).length;
      }
      if (ways < 3) continue;
      /* bodies already in the passages that meet here are bodies about to be here: by the
         time the tag is hung, the crossroads the ring chose is the one they arrive at. */
      var conv = 0;
      for (k = 0; k < n.edges.length; k++) {
        var ce = E[n.edges[k]];
        if (ce && ce.dug) conv += ce.occ.length;
      }
      /* BODIES DECIDE WHICH CROSSROADS. Every junction is a junction; the one worth
         pointing at is the one workers are actually contending for, so presence outweighs
         geometry and a crossroads with nobody at it is not the incident at all. */
      var near = bodiesNear(st, n.x, n.y, 78);
      /* TWO BODIES OR IT IS NOT A CONTEST. An In ring was measured sitting on a four-way
         junction holding one solitary worker while the tag read "Nothing here settles
         anything" — nothing was being settled because nothing was being disputed. */
      if (near + waiting + conv < 2) continue;
      var s = ways * 0.5 + waiting * 4 + near * 3 + conv * 2 + (bare ? (n.gov ? -8 : 2) : 0);
      if (s > bs) { bs = s; best = n; }
    }
    return best ? atNode(st, best, 38) : null;
  }

  /* a chamber with no tunnel to it at all — Si with a wall instead of a number */
  function siteSealed(st) {
    var N = nodesOf(st), E = edgesOf(st), main = st.nest ? st.nest.main : 0, i, k;
    var best = null, bs = -1;
    for (i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done || !j.sealed) continue;
      var n = N[j.node];
      if (!n) continue;
      var s = 4 + (j.dark || 0) * 3;
      if (s > bs) { bs = s; best = n; }
    }
    /* and if nothing is walled off this instant, the crumb the fewest of them have ever
       heard of — which is still a crumb sitting in a room, not a patch of floor */
    if (!best) {
      var bd = 0.35;
      for (i = 0; i < st.jobs.length; i++) {
        var jb = st.jobs[i];
        if (jb.done || !((jb.dark || 0) > bd)) continue;
        var nn = N[jb.node];
        if (nn) { bd = jb.dark; best = nn; }
      }
    }
    if (!best) {
      for (i = 0; i < N.length; i++) {
        var nd = N[i];
        if (nd.kind === 'junction' || nd.kind === 'surface') continue;
        var dug = 0;
        for (k = 0; k < nd.edges.length; k++) { var e = E[nd.edges[k]]; if (e && e.dug) dug++; }
        if (!dug || nd.comp !== main) { best = nd; break; }
      }
    }
    return best ? atNode(st, best, 42) : null;
  }

  /* the bodies standing in a passage — inside it, and queued at either mouth waiting to
     get in. These are the queue the sentence is about. */
  function edgeBodies(st, e) {
    var ids = e.occ.concat(e.qa, e.qb), pts = [], i;
    for (i = 0; i < ids.length; i++) { var a = agentOf(st, ids[i]); if (a) pts.push(a); }
    return pts;
  }
  /* a passage standing solid, or worn to a shine while its neighbour stays cold.

     LIVE LOAD DECIDES, AND NOTHING ELSE COMES CLOSE. Wear is a memory of traffic and jam
     is a memory of stalling; both persist on a corridor long after the last ant has left
     it, and weighting them anywhere near load is exactly how THE JAMMED TUNNEL was drawn
     over an empty stretch of tunnel with the real queue outside the ring. Load is worth
     twenty; a passage with fewer than two bodies in it is not a jam at any wear at all,
     and is refused outright. Wear only ever breaks a tie between two passages that are
     BOTH carrying somebody — which is what Cf actually means: of the roads in use, this
     is the one they have all worn bright. */
  function siteJam(st, wear) {
    var E = edgesOf(st), best = null, bs = 0, i;
    for (i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e.dug) continue;
      var load = edgeLoad(e);
      if (load < 2) continue;                 /* one worker walking a tunnel is a commute */
      var s = load * 20 + (e.jam || 0) * 8 + (wear ? (e.wear || 0) * wear : 0);
      if (s > bs) { bs = s; best = e; }
    }
    if (!best) return null;
    /* and the ring is centred on the bodies IN the passage, not on the passage's
       midpoint: a tunnel runs to a hundred and forty pixels and the queue is at one end
       of it. Centring on the midpoint is how a marker ends up beside its own subject. */
    var pts = edgeBodies(st, best);
    if (!pts.length) return null;
    var sx = 0, sy = 0;
    for (i = 0; i < pts.length; i++) { sx += pts[i].x; sy += pts[i].y; }
    return atEdge(st, best, sx / pts.length, sy / pts.length);
  }
  /* a room packed to its walls, before the passage that feeds it */
  function siteCrowd(st) {
    var N = nodesOf(st), best = null, bs = 2;
    for (var i = 0; i < N.length; i++) {
      var n = N[i];
      if (n.kind === 'surface') continue;
      if (n.occ.length > bs) { bs = n.occ.length; best = n; }
    }
    /* the fuller the room, the further the crowd spills into the doorway and the passage
       behind it — the ring has to hold the queue as well as the room */
    return best ? atNode(st, best, 26 + bs * 4) : siteJam(st, 0);
  }

  /* a body parked in the passage, and the line behind it */
  function siteParked(st, ids) {
    var E = edgesOf(st), N = nodesOf(st), i, k, a;
    for (i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e.dug || !e.occ.length || edgeLoad(e) < 2) continue;
      for (k = 0; k < e.occ.length; k++) {
        a = agentOf(st, e.occ[k]);
        if (!a) continue;
        if (a.blockT > 30 || a.locker || a.posture === 'guard') return atEdge(st, e, a.x, a.y);
      }
    }
    /* THE BODY, NOT THE CRUMB. A stale claim with nobody visible in the ring is the
       failure the critic caught: the ring must hold the worker that is sitting on it. */
    for (i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done || !j.locked) continue;
      a = agentOf(st, j.locked);
      if (a) return atBodies(st, [a.id]);
    }
    for (i = 0; i < st.agents.length; i++) {
      a = st.agents[i];
      if (a.locker || a.churner || (a.posture === 'guard' && a.holdN)) return atBodies(st, [a.id]);
    }
    for (i = 0; i < st.jobs.length; i++) {
      var jb = st.jobs[i];
      if (jb.done) continue;
      if (!(jb.queue && jb.queue.length)) continue;
      var n = N[jb.node];
      if (n) return atNode(st, n, 34);
    }
    return atBodies(st, ids);
  }

  /* two of them nose to nose in a passage that fits one */
  function siteHeadOn(st) {
    var E = edgesOf(st);
    for (var i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e.dug || e.occ.length < 2) continue;
      var pair = (FZ.elh && FZ.elh.headOn) ? FZ.elh.headOn(st, e) : null;
      if (pair) return atEdge(st, e, (pair[0].x + pair[1].x) / 2, (pair[0].y + pair[1].y) / 2);
    }
    return null;
  }
  /* and if they are not in a passage, the crumb they are both sitting on */
  function siteFrozen(st) {
    var N = nodesOf(st);
    for (var i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done) continue;
      if (!(j.frozen > st.tick) && !(j.claims && j.claims.size > 1)) continue;
      var n = N[j.node];
      if (n) return atNode(st, n, 32);
    }
    return null;
  }

  /* work behind an undug face nobody is cutting */
  function siteDig(st) {
    var E = edgesOf(st), N = nodesOf(st), best = null, bs = 0;
    for (var i = 0; i < E.length; i++) {
      var e = E[i];
      if (e.dug || !(e.prog > 0.02)) continue;
      var s = (e.diggers.length ? 0.5 : 2) + e.prog;
      if (s > bs) { bs = s; best = e; }
    }
    if (best) {
      var A = N[best.a], B = N[best.b], t = clamp(best.prog, 0.1, 0.9);
      return atEdge(st, best, A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t);
    }
    return null;
  }
  /* the crumb standing still behind it, with its queue */
  function siteBlocked(st) {
    var N = nodesOf(st), i;
    for (i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done || !j.prereq) continue;
      var n = N[j.node];
      if (n && (j.queue && j.queue.length || n.occ.length)) return atNode(st, n, 34);
    }
    return siteDig(st);
  }

  /* the crumb two workers walked in on by two different tunnels */
  function siteTug(st, split) {
    var best = null, bs = 1.5;
    for (var i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done) continue;
      var cl = j.claims ? (j.claims.size || j.claims.length || 0) : 0;
      var tug = j.tug ? j.tug.length : 0;
      var s = cl * 2 + tug * 2 + (split && j.split > st.tick ? 6 : 0) + (j.crowd || 0);
      if (s > bs) { bs = s; best = j; }
    }
    if (!best) return null;
    var n = nodesOf(st)[best.node];
    return n ? atNode(st, n, 32) : null;
  }

  /* the room a crumb is in, picked by whatever makes it the story: the big one nobody
     walks to, the one everybody turned away from, the one coming apart, the one only a
     single worker has ever heard of. A crumb sitting untouched in a lit room IS the
     failure; it does not need an ant standing next to it to be visible. */
  function siteJob(st, score) {
    var best = null, bs = 0;
    for (var i = 0; i < st.jobs.length; i++) {
      var j = st.jobs[i];
      if (j.done) continue;
      var s = score(j, st);
      if (s > bs) { bs = s; best = j; }
    }
    if (!best) return null;
    var n = nodesOf(st)[best.node];
    return n ? atNode(st, n, 34) : { kind: 'ground', id: 0, x: best.x, y: best.y, r: 56 };
  }
  /* the confident march to a chamber with nothing in it: the ring goes on the ROOM they
     are marching to, because that is where the emptiness is and where they arrive. */
  function siteRumour(st) {
    if (!st.rumor) return null;
    var N = nodesOf(st), best = null, bd = Infinity;
    for (var i = 0; i < N.length; i++) {
      if (N[i].kind === 'surface') continue;
      var d = dist(st.rumor.x, st.rumor.y, N[i].x, N[i].y);
      if (d < bd) { bd = d; best = N[i]; }
    }
    return best ? atNode(st, best, 38) : null;
  }
  /* one body, named: the liar, the one that knows and says nothing, the one that walks
     through whatever you put down. */
  function siteOne(st, pick) {
    for (var i = 0; i < st.agents.length; i++) if (pick(st.agents[i], st)) return atBodies(st, [st.agents[i].id]);
    return null;
  }

  /* one worker holding more rooms than one body can stand in */
  function siteHold(st, ids) {
    var A = st.agents, best = null, bn = 1;
    for (var i = 0; i < A.length; i++) if ((A[i].holdN | 0) > bn) { bn = A[i].holdN | 0; best = A[i]; }
    if (!best) return atBodies(st, ids);
    var n = (best.at != null) ? nodesOf(st)[best.at] : null;
    return n ? atNode(st, n, 32) : atBodies(st, [best.id]);
  }

  /* sym -> its situation. Everything not named here falls to the bodies the detector
     implicated, and then to the nearest thing on the network. */
  var SITE = {
    In: function (st) { return siteCross(st, true) || siteTug(st); },
    Mm: function (st) { return siteCross(st, false); },
    Si: siteSealed,
    Dp: siteBlocked,
    Fl: siteCrowd,
    Im: function (st) { return siteJam(st, 0); },
    Cf: function (st) { return siteJam(st, 5); },
    Lo: siteParked,
    Cl: siteParked,
    Tw: function (st) { return siteHeadOn(st) || siteFrozen(st); },
    Es: function (st) { return siteHeadOn(st) || siteFrozen(st); },
    Co: function (st) { return siteTug(st, false); },
    Mc: function (st) { return siteTug(st, true); },
    Ow: siteHold,
    /* the crumbs, and the rooms they are sitting in */
    Pt: function (st) { return siteJob(st, function (j) { return (j.value || 0) * (1 + (j.rot || 0) * 2) * (j.progress > 0 ? 0.4 : 1); }); },
    My: function (st) { return siteJob(st, function (j, s) { return j.id === s.bigJob ? 9 : (j.value || 0) * 0.5; }); },
    Cs: function (st) { return siteJob(st, function (j) { return (j.shun || 0) * 2 + (j.rot || 0); }); },
    Di: function (st) { return siteJob(st, function (j) { return (j.lone ? 6 : 0) + (j.dark || 0) * 3; }); },
    Sa: function (st) { return siteJob(st, function (j) { return (j.unmake || 0) * 6 + (j.undone ? 5 : 0); }); },
    Hi: function (st) { return siteJob(st, function (j) { return j.hazard ? 6 : 0; }) || siteOne(st, function (a) { return a.knows && a.knows.length; }); },
    /* the rumour, and the bodies that carry one */
    Gu: siteRumour,
    Tc: function (st) { return siteOne(st, function (a) { return a.liar; }) || siteRumour(st); },
    Rp: function (st) { return siteOne(st, function (a) { return a.liar && a.lies > 1; }) || siteRumour(st); },
    Cr: function (st) { return siteOne(st, function (a, s) { return !a.corrigible && a.defiant > s.tick - 300; }) || siteOne(st, function (a) { return !a.corrigible; }); },
    /* the whole colony moving too fast to read: the passage carrying the most of it */
    Sp: function (st) { return siteJam(st, 2); },
  };

  /* ============================================================================
     THE BODY TEST — the fix the whole round turns on.

     THE FAILURES WHOSE MEANING IS A CROWD. Every sentence on this list claims, in
     words, that several workers are doing something to each other: everyone taking one
     road, two claiming one crumb, the colony packed into one passage, a crossroads
     nobody is keeping. A ring around one ant, or none, makes the picture contradict the
     sentence, which is the one thing the Depiction Law forbids outright. These do not
     open until the ring encloses TWO BODIES, and they are re-checked every tick.

     THE LINE IS DRAWN BY THE SENTENCE, NOT BY TASTE. "Two of them started it from
     opposite ends" is two bodies or it is a lie. But "Someone claimed it and stopped"
     and "One worker is holding three jobs" name exactly ONE body, and forcing a second
     into those rings would shove the marker off the very worker the sentence is about —
     and, for Lo, off the worker an expulsion has to be aimed at. Lo and Ow are singular
     on purpose, and are named here so the next reader does not "fix" it. */
  var CROWD = {
    In: 1, Cf: 1, Dp: 1, Fl: 1, Im: 1, Sp: 1,
    Co: 1, Mc: 1, Tw: 1, Es: 1, Cl: 1, Mm: 1,
  };
  function needBodies(sym) { return CROWD[sym] ? 2 : 1; }

  /* is the failure this sentence names actually INSIDE this ring?

     A body counts. A crumb standing untouched counts, but only for the failures that
     ARE an untouched crumb — the big one nobody walks to, the one written off, the one
     in the chamber with no tunnel to it. A passage counts for NOTHING on its own: that
     unconditional edge pass is precisely how THE JAMMED TUNNEL came to be drawn over an
     empty corridor with the queue two hundred pixels outside the ring. */
  function holds(st, site, sym) {
    if (!site) return false;
    var need = needBodies(sym);
    var n = bodiesNear(st, site.x, site.y, site.r);
    if (site.kind === 'edge') {
      /* a tunnel is only an incident when there are bodies in it. Two, always — every
         failure that resolves onto a passage is a failure about traffic. */
      if (n >= 2) return true;
      /* the one exception, and it is structural rather than social: an unfinished dig
         face IS the failure for Dp — uncut earth with the work stranded behind it — and
         a face is a visible thing whether or not anyone is standing at it. */
      if (site.dug === false && (n >= 1 || sym === 'Dp')) return true;
      return false;
    }
    if (n >= need) return true;
    if (need > 1) return false;             /* a crowd sentence needs a crowd, full stop */
    if (site.kind === 'node') {
      var nd = nodesOf(st)[site.id];
      if (nd && nd.job) return true;
      if (nd && nd.kind !== 'junction') {
        for (var i = 0; i < st.jobs.length; i++) {
          var j = st.jobs[i];
          if (!j.done && j.node === nd.id) return true;
        }
      }
    }
    return false;
  }
  /* the last resort, and it still lands on bodies: the tightest knot of at least `need`
     of them, nearest to where we were looking. A crowd failure with no crowd anywhere in
     the colony returns null and does NOT open — it is not true yet, so it waits. */
  function nearestKnot(st, x, y, need) {
    need = need || 1;
    var best = null, bs = -Infinity;
    for (var i = 0; i < st.agents.length; i++) {
      var a = st.agents[i], n = bodiesNear(st, a.x, a.y, 92);
      if (n < need) continue;
      /* size first, nearness second: the point is to find the crowd, not the closest ant */
      var s = n * 44 - dist(x, y, a.x, a.y);
      if (s > bs) { bs = s; best = a; }
    }
    if (!best) return null;
    return atBodies(st, idsNear(st, best.x, best.y, 92));
  }

  /* THE WHOLE POINT: an incident is resolved onto a situation before it is drawn.

     `strict` is the first pass, and it is the difference between a tag that means
     something and one that does not: if this failure has a situation of its own and the
     colony is not in that situation YET — the crossroads nobody has reached, the passage
     nobody has jammed — the incident is not opened. It goes to the waiting room and tries
     again next tick. THE INCIDENT WAITS FOR ITS BODY, up to a few seconds, and only then
     settles for the bodies the detector named. */
  function anchor(sym, d, st, strict) {
    var site = null, need = needBodies(sym);
    if (st.nest && st.nest.nodes && st.nest.nodes.length) {
      try { if (SITE[sym]) site = SITE[sym](st, (d.who || [])); } catch (e) { site = null; }
      if (strict && SITE[sym] && (!site || !holds(st, site, sym))) return null;
      if (!site && d.who && d.who.length) site = atBodies(st, d.who);
      if (!site && d.at) site = snapTo(st, d.at.x, d.at.y);
      if (!site) site = nearestKnot(st, st.w / 2, st.h / 2, need);
      /* LAST GATE, AND IT IS NOT NEGOTIABLE. Whatever route got us here, the ring about
         to be drawn must contain the bodies the sentence claims. If it does not, we go to
         the ones the detector named; if those have scattered, to the nearest real knot;
         and if the colony contains no such knot at all, the incident does not open. */
      if (!holds(st, site, sym)) {
        var alt = (d.who && d.who.length) ? atBodies(st, d.who) : null;
        if (!alt || !holds(st, alt, sym)) {
          alt = nearestKnot(st, site ? site.x : st.w / 2, site ? site.y : st.h / 2, need);
        }
        site = (alt && holds(st, alt, sym)) ? alt : null;
      }
    }
    if (site) return site;
    var at = d.at || { x: st.w / 2, y: st.h / 2 };
    /* no nest at all (a headless harness, a scenario before the graph exists): there is
       nothing to point at and nothing to get wrong, so the coordinate stands. */
    if (!(st.nest && st.nest.nodes && st.nest.nodes.length)) {
      return { kind: 'ground', id: 0, x: at.x, y: at.y, r: radius(st) };
    }
    /* a failure whose whole meaning is several bodies is never drawn on bare ground.
       Waiting for it to become true is the honest move; asserting it is the old bug. */
    if (CROWD[sym]) return null;
    var g = snapTo(st, at.x, at.y);
    return (g && holds(st, g, sym)) ? g : null;
  }

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
  function open(d, soft) {
    var st = S();
    if (!st || !d || !d.sym || st.gameOver) return;
    if (cap <= 0) return;
    if (FZ.chapters && FZ.chapters.phase && FZ.chapters.phase() !== 'play') return;
    if (!answerable(d.sym, st)) return;
    if (findBurning(d.sym)) return;
    /* a cooldown means "not on top of itself", not "throw this away": if the colony is
       still in this trouble when the cooldown lifts, it comes back. */
    if (cool[d.sym] > st.tick) { hold(d, st); return; }
    if (burningCount() >= cap) { hold(d, st); return; }

    /* BEFORE ANYTHING ELSE: find the situation. The detector hands us a coordinate; the
       nest tells us what is physically there, and that is what the ring holds. If the
       situation is not on the field yet, this waits for it rather than drawing a ring
       around nothing. */
    var site = anchor(d.sym, d, st, !soft);
    if (!site) { hold(d, st); return; }
    var at = { x: site.x, y: site.y };
    var r = site.r;
    var fuse = Math.round(clamp(baseFuse / Math.max(1, st.speedMul || 1), FUSE_MIN, FUSE_MAX));
    /* THE GRACE IS FOR THE FIRST INCIDENT A PERSON EVER SEES, not for the first incident
       of every chapter. Measured: giving it to all ten cost four seconds off the top of
       each one — in a thirty-second passage that is a whole decision spent being polite
       to somebody who stopped needing it eight chapters ago. */
    if (seen === 0 && firstTimer()) fuse = Math.round(clamp(fuse * FIRST_GRACE, FUSE_MIN, FUSE_MAX));
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
      /* the fire that opened it, kept so the incident can keep finding its own body for
         the beat before it is named (see update). */
      seed: d,
      /* the situation itself, for FIELD: 'node' (a room or a crossroads), 'edge' (a
         passage, with both mouths), 'crowd' (a knot of bodies) or 'ground'. Drawing the
         passage or the crossroads the incident is ABOUT is the last mile of this work. */
      site: site,
      /* the bodies standing in it. Kept apart from `who` on purpose: `who` is the
         detector's list of the implicated and an expulsion is judged against it, so a
         bystander must never leak into it. */
      bodies: idsNear(st, site.x, site.y, site.r),
      state: 'burning',
      endAt: 0,
    };
    list.push(o);
    /* the player is looking at whatever most recently caught fire, unless she has
       deliberately pointed at something else that is still burning */
    if (!current(true)) focusId = o.id;
    emit('outbreak:open', { sym: o.sym, x: o.x, y: o.y, fuse: o.fuse, r: o.r, site: o.site });
  }

  /* the cap is full: keep this one, briefly, in case a slot frees while it is still true */
  function hold(d, st) {
    for (var i = 0; i < waiting.length; i++) {
      if (waiting[i].sym !== d.sym) continue;
      waiting[i].d = d; waiting[i].until = st.tick + WAIT_KEEP;
      return;
    }
    if (waiting.length > 5) waiting.shift();
    /* it may wait WAIT_BODY ticks for its own situation to appear on the field; after
       that it opens on the bodies the detector named, because a failure the player is
       never told about is worse than one anchored roughly. */
    waiting.push({ sym: d.sym, d: d, until: st.tick + WAIT_KEEP, ready: st.tick + WAIT_BODY });
  }
  /* a slot freed: let in the one that is still burning hardest in the colony itself */
  function serve(st) {
    if (!waiting.length || burningCount() >= cap) return;
    var best = null, bh = WAIT_HOT;
    for (var i = waiting.length - 1; i >= 0; i--) {
      var w = waiting[i];
      if (w.until < st.tick || findBurning(w.sym) || cool[w.sym] > st.tick) { waiting.splice(i, 1); continue; }
      var e = el(w.sym);
      var h = e ? e.heat : 0;
      if (h > bh) { bh = h; best = w; }
    }
    if (!best) return;
    waiting.splice(waiting.indexOf(best), 1);
    open(best.d, st.tick >= best.ready);
  }

  /* ------------------------------------------------------------------- damage */
  function el(sym) { return FZ.ELBY ? FZ.ELBY[sym] : null; }

  /* ------------------------------------------------------------------ the pin
     THE RING FOLLOWS THE BODIES, FOR THE WHOLE FUSE.

     The old code pinned the site once and then let it go: it re-anchored only in the
     three-quarters of a second before the tag was hung, and after that the ring sat
     still while the colony walked out from under it. Six seconds later the player reads
     THE JAMMED TUNNEL over an empty corridor. An incident IS its bodies; bodies move;
     so the pin moves. Called from burn(), every tick, until it lands or closes. */
  var REPIN_EVERY = 10;          /* how often the SITUATION is re-read (structure) */
  var FOLLOW = 0.3;              /* how fast the ring slides onto a new centre */

  /* the bodies that constitute this failure, still alive, in order of authority: the
     ones the detector implicated first, then the ones standing in the ring when it
     opened. An expulsion is judged against `who` alone, so nothing here leaks into it. */
  function tracked(o, st) {
    var out = [], i;
    for (i = 0; i < o.who.length; i++) if (agentOf(st, o.who[i])) out.push(o.who[i]);
    for (i = 0; i < o.bodies.length; i++) {
      if (out.indexOf(o.bodies[i]) > -1) continue;
      if (agentOf(st, o.bodies[i])) out.push(o.bodies[i]);
    }
    return out;
  }
  /* slide the ring onto a site. Structure is where the failure lives, so the site object
     (which FIELD may draw: the passage, the crossroads) is replaced outright; the drawn
     centre eases across so the marker is seen to FOLLOW rather than to teleport, which
     is the difference between a marker that tracks a queue and one that blinks. */
  function setSite(o, site, k, st) {
    if (!site || !st) return;
    o.site = site;
    o.r = o.r + (site.r - o.r) * k;
    o.x = clamp(o.x + (site.x - o.x) * k, 22, st.w - 22);
    o.y = clamp(o.y + (site.y - o.y) * k, 26, st.h - 22);
  }
  function repin(o, st) {
    var need = needBodies(o.sym);
    var here = bodiesNear(st, o.x, o.y, o.r);

    /* the situation itself, re-read on a slow beat: if the crossroads being contended,
       or the passage standing solid, is now a DIFFERENT one, the incident goes there. */
    if ((st.tick - o.born) % REPIN_EVERY === 0 && SITE[o.sym]) {
      var s2 = null;
      try { s2 = SITE[o.sym](st, o.who); } catch (e) { s2 = null; }
      if (s2 && holds(st, s2, o.sym)) {
        var same = o.site && s2.kind === o.site.kind && s2.id === o.site.id;
        var n2 = bodiesNear(st, s2.x, s2.y, s2.r);
        if (same || here < need || n2 > here) {
          setSite(o, s2, here < need ? 1 : FOLLOW, st);
          o.bodies = idsNear(st, o.x, o.y, o.r);
          return;
        }
      }
    }
    /* it still holds them. A knot of bodies is a moving thing, so ride with it; a room
       or a passage is not, so leave it where it is and let the bodies come and go. */
    if (here >= need) {
      if (o.site && o.site.kind === 'crowd') {
        var k = atBodies(st, tracked(o, st));
        if (k && holds(st, k, o.sym)) setSite(o, k, FOLLOW, st);
      }
      o.bodies = idsNear(st, o.x, o.y, o.r);
      return;
    }
    /* it has emptied out under the words. Go where they went. */
    var t = atBodies(st, tracked(o, st));
    if (!t || !holds(st, t, o.sym)) t = nearestKnot(st, o.x, o.y, need);
    if (t && holds(st, t, o.sym)) {
      setSite(o, t, 1, st);
      o.bodies = idsNear(st, o.x, o.y, o.r);
    }
  }

  /* it burns: work inside the ring goes backwards while the player decides */
  function burn(o, st) {
    repin(o, st);
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
    quietGap = GAP_HARD;                     /* it landed. The next one comes sooner. */

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
    quietGap = GAP;                          /* you answered it. Take the beat. */

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
      for (var q = 0; q < list.length; q++) {
        var oo = list[q];
        oo.x *= kx; oo.y *= ky;
        var s = oo.site;
        if (!s) continue;
        s.x *= kx; s.y *= ky;
        if (s.ax != null) { s.ax *= kx; s.bx *= kx; s.ay *= ky; s.by *= ky; }
      }
    }
    lastW = st.w; lastH = st.h;

    for (var i = list.length - 1; i >= 0; i--) {
      var o = list[i];
      if (o.state === 'burning') {
        /* the pin is no longer set once and abandoned: burn() re-reads the situation and
           follows the implicated bodies every tick, for the whole fuse. See repin(). */
        var e = el(o.sym);
        if (e && e.countered && e.heat < 0.1 && st.tick - o.born > 45) defuse(o, st);
        else if (st.tick - o.born >= o.fuse) land(o, st);
        else burn(o, st);
      } else if (st.tick >= o.endAt) {
        if (list[i].id === focusId) focusId = 0;
        list.splice(i, 1);
      }
    }
    serve(st);
    pull(st);
  }

  /* ------------------------------------------------------------------- the gap
     NO CHAPTER MAY GO QUIET. Measured on the shipped build: chapter four produced ONE
     decision in twenty-seven seconds, because a detector emits `fire` only on a RISING
     edge — a failure that is already hot and stays hot never speaks again, so the colony
     can stampede in complete silence with nothing at all on the table.

     So when nothing has burned for GAP ticks, the hottest live failure the player is
     actually holding an instrument for is put back on the table. This invents nothing:
     `heat` is the detector's own continuous reading of the live simulation, the element
     has to still be genuinely hot, and the incident still has to find bodies to sit on
     or it does not open. It is the same trouble, asked about again. */
  function pull(st) {
    if (cap <= 0 || burningCount() > 0) { quietSince = st.tick; return; }
    if (FZ.chapters && FZ.chapters.phase && FZ.chapters.phase() !== 'play') { quietSince = st.tick; return; }
    if (st.tick - quietSince < quietGap) return;
    var E = FZ.EL || [], en = FZ.sim ? FZ.sim.enabled : null, best = null, bh = PULL_HOT;
    for (var i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e || (en && en.has && !en.has(e.sym))) continue;
      if (e.countered || cool[e.sym] > st.tick || findBurning(e.sym)) continue;
      if (!answerable(e.sym, st)) continue;
      if (e.heat > bh) { bh = e.heat; best = e; }
    }
    if (!best) { quietSince = st.tick - quietGap + GAP_RETRY; return; }
    var n = list.length;
    open({ sym: best.sym, at: { x: st.w / 2, y: st.h / 2 }, who: (best.who || []).slice(),
           say: fireLine(best.sym) }, true);
    /* if the colony had no body to point at, this was not a decision — try again in
       under a second rather than burning the whole gap on it. */
    quietSince = (list.length > n) ? st.tick : st.tick - quietGap + GAP_RETRY;
  }

  function wire() {
    if (wired || !FZ.bus) return;
    wired = true;
    FZ.bus.on('fire', open);
    FZ.bus.on('intervene', settle);
    FZ.bus.on('lose', function () { list.length = 0; waiting.length = 0; pend = null; focusId = 0; });
    FZ.bus.on('goal', function () { list.length = 0; waiting.length = 0; pend = null; focusId = 0; });
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
      waiting.length = 0;
      pend = null;
      cool = {};
      seen = 0;
      focusId = 0;
      var st = S();
      lastW = st ? st.w : 0; lastH = st ? st.h : 0;
      quietSince = st ? st.tick : 0; quietGap = GAP;
      cap = (scenario && scenario.outbreakCap != null) ? scenario.outbreakCap : 1;
      /* THE SANDBOX KEEPS ITS CLOCK. It was measured at one decision every three seconds
         and that is the target the rest of the game is being tuned toward; re-cutting it
         would be tuning away from the one chapter that is already right. CHAPTERS may
         override per scenario with `fuse`; nothing else in the build sets it today. */
      baseFuse = (scenario && scenario.fuse) || (scenario && scenario.all ? FUSE_SANDBOX : FUSE);
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
