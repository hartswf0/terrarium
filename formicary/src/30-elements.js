/* ============================================================
   30-elements.js — the twenty-eight elements.  OWNER: SIM.

   Every element is a real detector:
     - detect(S, api) reads live simulation state, never a timer, never dice alone
     - it has a REAL consequence, stated in the comment directly above detect
     - counteredBy(S) is true only when the player's institution is genuinely in place,
       and countered elements cool ~8x faster (see 40-sim.js coolRate)

   Columns are 0 COORDINATION, 1 CONFORMITY, 2 EPISTEMICS, 3 GOALS/POWER, 4 META.
   They are DEFINED column by column below, then sorted at the bottom of this file into
   row-major table order, so walking FZ.EL into a 5-wide grid lays the table out correctly.
   Each element also carries `col` and `row` (0..5) so TABLE can place it without arithmetic,
   and `answers: [kind…]` — the institutions that resolve it (CONTRACT §14.4). `counterTool`
   is derived as answers[0] so TABLE can name the answer from FZ.copy.tools[kind].label.

   ------------------------------------------------------------
   THE TRADE-OFF TERMS (CONTRACT §15, RESEARCH.md §3) — read before editing a detector
   ------------------------------------------------------------
   S.trustBias  -1 … +1.  +1 is a colony running the LEDGER: skeptical. -1 is a colony
                running the LENS: receptive. Both instruments on = 0, the expensive middle.
                Detectors read it as an explicit amplification term:
                  skept = Math.max(0,  S.trustBias)   amplifies Di and Cs
                  cred  = Math.max(0, -S.trustBias)   amplifies Gu
                The suppression side stays in counteredBy(). The dial has two ends.
   S.ownership  0 … 1.  How much of the colony has retreated into working alone. Merge
                conflict raises it; the colony "solves" Mc by hardly working together.
                It suppresses Mc and amplifies Si and Ow. Only a CHARTER escapes the bill.
   S.aggro      0 … 1.2, from S.tempo. Machine speed raises throughput AND aggression:
                lockouts, sabotage and escalation all arrive sooner on the same curve.

   ------------------------------------------------------------
   EVERY ELEMENT HAS A BODY  (AESTHETIC.md §0, §4, §6)
   ------------------------------------------------------------
   A failure that cannot be seen without a caption is not finished. So each element
   declares `body:` — the observable thing in the colony that IS this failure — and
   40-sim.js maintains the state fields that make that thing drawable. The full field
   list is documented at the top of 40-sim.js under THE BODIES; the short version:

   Since CONTRACT §16 the nest is a real movement graph, and TWELVE of these stopped
   being proxies and became situations you can point at: Si is a chamber with no tunnel
   to it, Fl is a passage packed solid, Lo is a body parked in that passage with the line
   behind it, Tw is two rivals nose to nose in a passage that fits one, Dp is work behind
   an undug face nobody is cutting, In is a crossroads with nobody keeping it, Im is the
   whole colony inside one passage, Cf is one road worn to a shine beside a cold one, Co
   is two workers who walked in by two different tunnels, Ow is rooms one body cannot be
   in, Es is rivals blocking each other's route again and again, and Mm is not being able
   to see which passage anybody means to take.

     body        what you would see, with no words on screen        fields it is drawn from
     ---------   -------------------------------------------------  ----------------------
     tug         two who walked in by different tunnels, both pull   j.tug[].via j.crowd
     queue       a body parked in the passage, a line behind it      a.place a.blockT e.occ/qa/qb
     sealed      a chamber with no tunnel to it at all               j.sealed node.comp
     jam         a passage packed solid, nothing moving              e.jam e.occ e.qa e.qb
     stack       one worker guarding a pile it cannot work           a.holdN a.posture='guard'
     split       one job finished twice; the copies will not join    j.split
     waitchain   a queue behind work nobody is doing                 j.prereq j.queue[]
     rot         a crumb going soft while the colony is elsewhere    j.rot j.trail
     trail       one road bright, every other road cold              j.trail j.dark
     column      the whole colony moving as one body                 S.column
     sameness    every worker the same lineage                       S.lineage
     fell        a whole lineage face-down at the same instant       S.fell a.stun
     phantom     a confident march to a chamber with nothing in it   S.rumor a.posture='march'
     shunned     work everyone turns away from                       j.shun a.hesitate
     withheld    one worker knows the hazard and walks on past       j.hazard a.knows[]
     voices      every source drawn identical; one is lying          a.marks a.trust
     forgotten   the tally marks wiped off a known liar              a.marks a.lies
     lone        one worker right, standing alone at the big crumb   j.lone j.dark
     frozen      two rivals sitting on one crumb, neither moving     j.frozen a.posture='guard'
     unmaking    finished work quietly coming apart again            j.unmake j.undone
     chase       two who stopped working and only follow each other  a.posture='chase'
     defiance    a body walking straight through the boundary        a.defiant a.corrigible
     handoff     a claim passed back and forth, never worked         j.churn j.queue[]
     smallcrumb  every trail to the small crumbs, none to the big    S.bigJob j.rot a.tx/a.ty
     noarch      contested ground with no institution drawn on it    S.charters S.arb
     frantic     the whole colony moving too fast to read            S.tempo S.weather
     dark        you can see where they are, not what they want      S.blind a.tx/a.ty

   All player-facing prose is read lazily from FZ.copy (see fzElDef below). This part
   contains no English sentence of its own.
   ============================================================ */
window.FZ = window.FZ || {};

FZ.EL = [];
FZ.ELBY = {};

/* ---- shared helpers used by many detectors ---- */
FZ.elh = {
  /* is (x,y) inside any chartered boundary? */
  cover(S, x, y) {
    const C = S.charters;
    for (let i = 0; i < C.length; i++) {
      const c = C[i], dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy <= c.r * c.r) return c;
    }
    return null;
  },
  /* what fraction of the open work is under an institution? */
  coverFrac(S) {
    const o = S._g.open;
    if (!o.length) return S.charters.length ? 1 : 0;
    let k = 0;
    for (let i = 0; i < o.length; i++) if (FZ.elh.cover(S, o[i].x, o[i].y)) k++;
    return k / o.length;
  },
  /* has the player actually broken up the monoculture? */
  varied(S) { return S._g.hueDistinct >= 3 && S._g.topHueFrac < 0.62; },
  slowed(S) { return S.tick < S.slowUntil; },
  /* §15.1 the two ends of the trust dial, as terms a detector can multiply by */
  skept(S) { return S.trustBias > 0 ? S.trustBias : 0; },
  cred(S) { return S.trustBias < 0 ? -S.trustBias : 0; },

  /* ------------------------------------------------------------------
     THE NEST, for the detectors that now read a physical situation instead of a
     proxy (CONTRACT §16.2). Twelve of the twenty-eight stopped needing a caption
     the moment movement became physical; these are the terms they read it with.
     ------------------------------------------------------------------ */
  ag(S, id) { const A = S.agents; for (let i = 0; i < A.length; i++) if (A[i].id === id) return A[i]; return null; },
  edges(S) { return (S.nest && S.nest.edges) || []; },
  nodes(S) { return (S.nest && S.nest.nodes) || []; },
  /* every body this passage is carrying, standing in, or queued at either mouth */
  load(e) { return e.occ.length + e.qa.length + e.qb.length; },
  /* the two bodies nose to nose in a one-ant passage, if there are any */
  headOn(S, e) {
    for (let i = 0; i < e.occ.length; i++) {
      const a = FZ.elh.ag(S, e.occ[i]);
      if (!a || !a.headOn) continue;
      const b = FZ.elh.ag(S, a.headOn);
      if (b && b.edge === e.id) return [a, b];
    }
    return null;
  },
  /* the middle of a passage, which is where an institution has to reach to arbitrate it */
  mid(S, e) {
    const N = FZ.elh.nodes(S), A = N[e.a], B = N[e.b];
    return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  },
  /* a body parked in a passage, going nowhere, with the line behind it */
  parked(S, e) {
    for (let i = 0; i < e.occ.length; i++) {
      const a = FZ.elh.ag(S, e.occ[i]);
      if (a && a.blockT > 40 && a.locker) return a;
    }
    return null;
  },
};

/* Attaches runtime fields and lazy copy getters, then registers the element. */
function fzElDef(o) {
  o.heat = 0; o.fires = 0; o.peak = 0; o.who = []; o.countered = false; o.on = false;
  /* where the last fire happened, so anything drawing this element knows where to look */
  o.at = null;
  /* the observable phenomenon that IS this failure (see the table at the top) */
  o.body = o.body || 'heat';
  /* §14.4 every element declares the institutions that answer it; the first is the one
     TABLE names on the cell, and it is always the one the counter sentence leads with. */
  o.answers = o.answers || ['charter'];
  o.counterTool = o.answers[0];
  const s = o.sym;
  const cp = () => (FZ.copy && FZ.copy.fire) || {};
  const dt = () => ((FZ.copy && FZ.copy.detail) || {})[s] || {};
  Object.defineProperty(o, 'plain', { enumerable: true, get() { return cp()[s] || ''; } });
  Object.defineProperty(o, 'trigger', { enumerable: true, get() { return dt().trigger || cp()[s] || ''; } });
  Object.defineProperty(o, 'effect', { enumerable: true, get() { return dt().effect || ''; } });
  Object.defineProperty(o, 'counter', { enumerable: true, get() { return dt().counter || ''; } });
  FZ.EL.push(o); FZ.ELBY[s] = o;
}
function fzG(inner) {
  return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" ' +
    'stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' + inner + '</svg>';
}

/* ============================================================
   COLUMN 0 — COORDINATION
   ============================================================ */

fzElDef({
  sym: 'Co', nm: 'Coordination failure', col: 0, row: 0, chapter: 1, body: 'tug',
  answers: ['charter'],
  glyph: fzG('<path d="M1 10h5"/><path d="M4 7.5l2.5 2.5-2.5 2.5"/><path d="M19 10h-5"/><path d="M16 7.5l-2.5 2.5 2.5 2.5"/><rect x="8" y="8" width="4" height="4"/>'),
  /* §16.2 TWO ANTS ARRIVING AT ONE CRUMB FROM TWO DIFFERENT TUNNELS. `e.far` is no
     longer "their claims were made far apart"; it is that the working claimants walked
     in by different passages (a.via), which is a thing you can see happening.
     CONSEQUENCE: drains the contested job's progress every tick — the fill visibly runs backwards.
     TRADE (§15.2): a collision also nudges both workers toward working alone (api.own). */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (e.work < 2 || !e.far) continue;
      if (FZ.elh.cover(S, e.j.x, e.j.y)) continue;
      e.j.progress = Math.max(0, e.j.progress - 1.5 * (e.work - 1));
      hot += 0.035 * (e.work - 1); who = e.ids; at = { x: e.j.x, y: e.j.y };
      for (let k = 0; k < e.ids.length; k++) api.own(api.agentById(e.ids[k]), 0.012);
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Co });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Si', nm: 'Siloed knowledge', col: 0, row: 1, chapter: 6, body: 'sealed',
  answers: ['lens'],
  glyph: fzG('<path d="M10 1v18"/><circle cx="5" cy="10" r="2.4"/><rect x="13" y="7.5" width="5" height="5"/>'),
  /* §16.2 A CHAMBER WITH NO TUNNEL TO IT. Literally unreachable: j.sealed is true when
     the room the work is in is not connected to the rest of the nest by any dug passage.
     That is not a low number on a dashboard, it is a wall, and it is why nobody comes.
     CONSEQUENCE: work in a sealed room, or work nobody has heard of, goes stale and is
     LOST outright (job:lost). Somebody has to walk over and DIG to save it.
     TRADE (§15.2): S.ownership is a real term. A colony that answered merge conflict by
     working alone stops telling each other anything, so jobs go stale faster. */
  detect(S, api) {
    const G = S._g, own = S.ownership; let hot = 0, at = null;
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      const walled = !!j.sealed;
      if (!walled && (j.knownBy / Math.max(1, G.n) > 0.3 || j.age < 90)) continue;
      j.stale += (walled ? 2.4 : 1) + own * 1.6;
      hot += (walled ? 0.038 : 0.02) * (1 + own * 1.5);
      at = { x: j.x, y: j.y };
      if (j.stale > 430) api.loseJob(j, 'Si');
    }
    if (hot > 0) api.heat(hot, { at, who: [], say: FZ.copy.fire.Si });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Mc', nm: 'Merge conflict', col: 0, row: 2, chapter: 1, body: 'split',
  answers: ['charter'],
  glyph: fzG('<path d="M4 2l6 8M16 2l-6 8"/><path d="M6 13l8 6"/><path d="M14 13l-8 6"/>'),
  /* CONSEQUENCE: blocks completion — a finished job with two lineages on it is rolled back to 30%.
     TRADE (§15.2): every rollback pushes its authors hard toward ownership. The colony learns to
     stop colliding by refusing to share a job at all, which is how Mc puts itself out — and it
     bills the colony in Si and Ow. Inside a charter the merge is arbitrated and nobody retreats. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (e.j.progress < e.j.need || e.hn < 2) continue;
      if (FZ.elh.cover(S, e.j.x, e.j.y)) continue;
      e.j.progress = e.j.need * 0.3;
      /* BODY: for the next second and a half the crumb is visibly two half-finished
         copies that will not join. Nothing has to be written next to it. */
      e.j.split = S.tick + 90;
      hot += 0.68; who = e.ids; at = { x: e.j.x, y: e.j.y };
      for (let k = 0; k < e.ids.length; k++) api.own(api.agentById(e.ids[k]), 0.34);
      api.bus('job:lost', { x: e.j.x, y: e.j.y, why: 'Mc' });
      S.collapse += 1.0;
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Mc });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Dp', nm: 'Blocked dependency', col: 0, row: 3, chapter: 8, body: 'undugface',
  answers: ['lens', 'charter'],
  glyph: fzG('<rect x="1" y="7" width="6" height="6"/><rect x="13" y="7" width="6" height="6"/><path d="M8 10h4"/><path d="M8 5.5l4 9"/>'),
  /* §16.2 WORK BEHIND AN UNDUG FACE NOBODY IS DIGGING. Two shapes, one failure: work
     claimed but walled off with no one cutting toward it, and work waiting on another
     job that is not finished. Both are a queue behind something that is not happening.
     CONSEQUENCE: no progress can accumulate, and the claimants standing in the line
     waste themselves waiting. The lens shows them what they are actually waiting for. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    /* the physical one: a room with no way in, claimed, and no face being cut to it */
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      if (!j.sealed || !j.claims.size) continue;
      const n = FZ.elh.nodes(S)[j.node];
      if (!n) continue;
      let cutting = 0;
      for (let k = 0; k < n.edges.length; k++) {
        const e = FZ.elh.edges(S)[n.edges[k]];
        if (e && !e.dug) cutting += e.diggers.length;
      }
      if (cutting) continue;                       /* somebody IS digging: that is not this */
      const ids = []; j.claims.forEach(id => ids.push(id));
      hot += 0.07; who = ids; at = { x: j.x, y: j.y };
      for (let k = 0; k < ids.length; k++) { const a = api.agentById(ids[k]); if (a) a.hesitate = Math.min(1, a.hesitate + 0.05); }
    }
    /* the ordering one: this crumb cannot be worked until that crumb is finished */
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i], j = e.j;
      if (!j.prereq || e.work < 1) continue;
      const p = api.jobById(j.prereq);
      if (!p) continue;
      if (FZ.elh.cover(S, j.x, j.y) || S.lensOn) continue;
      j.progress = Math.max(0, j.progress - 0.8);
      hot += 0.09; who = e.ids; at = { x: j.x, y: j.y };
    }
    if (hot > 0) {
      api.heat(hot, { at, who, say: FZ.copy.fire.Dp });
      if (who) for (let k = 0; k < who.length; k++) { const a = api.agentById(who[k]); if (a) a.stun = Math.max(a.stun, 26); }
    }
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5 || S.lensOn; },
});

fzElDef({
  sym: 'Ow', nm: 'Overcommitment', col: 0, row: 4, chapter: 2, body: 'stack',
  answers: ['charter'],
  glyph: fzG('<circle cx="10" cy="4" r="2.4"/><path d="M10 6.5v3"/><path d="M10 9.5L4 15M10 9.5v5.5M10 9.5L16 15"/><rect x="2" y="15" width="4" height="4"/><rect x="8" y="15" width="4" height="4"/><rect x="14" y="15" width="4" height="4"/>'),
  /* §16.2 ONE PAIR OF HANDS, HOLDING ROOMS IT CANNOT PHYSICALLY BE IN. A body is in one
     chamber. Everything else it has claimed is somewhere down a tunnel it is not walking,
     and the crumbs in those rooms sit there going soft with its name on them.
     CONSEQUENCE: every job the hoarder holds AND IS NOT IN rots; past four holds it seizes.
     TRADE (§15.2): territorial workers hold a private backlog nobody else may touch, so the
     ownership answer to merge conflict arrives here as a bill. S.ownership is an explicit term. */
  detect(S, api) {
    const G = S._g, own = S.ownership; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (a.hold.length < 3) continue;
      let absent = 0;
      for (let k = 0; k < a.hold.length; k++) {
        const j = api.jobById(a.hold[k]);
        if (!j) continue;
        /* the room it is standing in is the only one it is actually working */
        if (a.at != null && j.node === a.at) continue;
        absent++;
        j.progress = Math.max(0, j.progress - 0.35 * (1 + own));
        j.neglect += 1;
      }
      if (absent < 2) continue;
      hot += 0.05 * (1 + own); who = [a.id]; at = { x: a.x, y: a.y };
      if (a.hold.length >= 4) { a.stun = Math.max(a.stun, 30); api.bus('agent:hurt', { id: a.id, x: a.x, y: a.y }); }
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Ow });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Pt', nm: 'Priority inversion', col: 0, row: 5, chapter: 3, body: 'rot',
  answers: ['lens'],
  glyph: fzG('<rect x="12" y="2" width="6" height="6"/><rect x="2" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><rect x="15" y="15" width="3" height="3"/><path d="M3.5 11.5l6 3 6.5 1.5"/>'),
  /* CONSEQUENCE: the neglected high-value job expires and is LOST (job:lost). */
  detect(S, api) {
    const G = S._g, j = G.maxJob;
    if (!j || j.value < 3 || !G.workedN) return;
    const worked = G.workedVsum / G.workedN;
    if (worked >= j.value * 0.62 || j.claims.size) return;
    j.neglect += 1;
    if (j.neglect > 540) { api.loseJob(j, 'Pt'); return; }
    api.heat(0.03, { at: { x: j.x, y: j.y }, who: [], say: FZ.copy.fire.Pt });
  },
  counteredBy(S) { return S.lensOn; },
});

/* ============================================================
   COLUMN 1 — CONFORMITY
   ============================================================ */

fzElDef({
  sym: 'Cf', nm: 'Conformity cascade', col: 1, row: 0, chapter: 3, body: 'oneroad',
  /* VARY is the real answer (break the sameness); SLOW is the holding action, and it is
     the only instrument chapter 3 hands the player, so it must resolve this too. */
  answers: ['vary', 'slow'],
  glyph: fzG('<path d="M2 4h5M2 10h9M2 16h13"/><path d="M5.5 1.5L8 4 5.5 6.5M9.5 7.5L12 10l-2.5 2.5M13.5 13.5L16 16l-2.5 2.5"/>'),
  /* §16.2 EVERY ANT USING ONE TUNNEL WHILE A DUG ALTERNATIVE SITS EMPTY. The road is
     worn to a shine and the one beside it is cold. That picture is the whole element.
     CONSEQUENCE: raises S.copyBias, which is a real term in the router — a copying
     colony prefers the worn passage, so the worn passage gets worse. Self-feeding.
     VARY inverts that term, and the ants visibly start using the cold road. */
  detect(S, api) {
    const G = S._g, E = FZ.elh.edges(S);
    let busy = null, busyN = 0, total = 0, cold = 0;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.dug) continue;
      const n = FZ.elh.load(e);
      total += n;
      if (n > busyN) { busyN = n; busy = e; }
      if (e.wear < 0.25 && n === 0) cold++;
    }
    /* the crowd on one road, with an empty road available, is the physical reading */
    const herd = busy && busyN >= 3 && cold > 0 && total > 0 && busyN / total > 0.5;
    /* and the old reading — most of the colony copying one another's choice — is kept
       because a stampede that has not reached a tunnel yet is still a stampede */
    const copying = S.choiceN >= 6 && S.copyN / S.choiceN >= 0.5 && G.targetTopN >= 3;
    if (!herd && !copying) return;
    S.copyBias = Math.min(0.92, S.copyBias + 0.02);
    if (herd) {
      const m = FZ.elh.mid(S, busy);
      api.heat(0.05, { at: m, who: busy.occ.concat(busy.qa, busy.qb), say: FZ.copy.fire.Cf });
      return;
    }
    const j = api.jobById(G.targetTop);
    api.heat(0.045, { at: j ? { x: j.x, y: j.y } : null, who: G.targetTopIds, say: FZ.copy.fire.Cf });
  },
  counteredBy(S) { return FZ.elh.slowed(S) || S.tick < S.varyUntil; },
});

fzElDef({
  sym: 'Lv', nm: 'Low variance', col: 1, row: 1, chapter: 4, body: 'sameness',
  answers: ['vary'],
  glyph: fzG('<circle cx="5" cy="7" r="2.2"/><circle cx="10" cy="7" r="2.2"/><circle cx="15" cy="7" r="2.2"/><path d="M2 14h16"/>'),
  /* CONSEQUENCE: sets S.varMul, which multiplies every poison hit and halves knowledge sharing. */
  detect(S, api) {
    const G = S._g;
    if (G.topHueFrac < 0.72 || G.n < 3) return;
    S.varMul = 1 + (G.topHueFrac - 0.72) * 5;
    api.heat(0.03, { at: { x: G.cx, y: G.cy }, who: G.topHueIds, say: FZ.copy.fire.Lv });
  },
  counteredBy(S) { return FZ.elh.varied(S); },
});

fzElDef({
  sym: 'Sf', nm: 'Synchronized failure', col: 1, row: 2, chapter: 4, body: 'fell',
  answers: ['vary'],
  glyph: fzG('<path d="M5 4v12M10 4v12M15 4v12"/><path d="M2 16L18 4"/>'),
  /* CONSEQUENCE: stuns EVERY worker of the affected lineage at once — the whole family falls over. */
  detect(S, api) {
    const G = S._g, H = S.hurts;
    if (H.length < 3) return;
    /* a lineage going down TOGETHER is a window of time too, and workers now take
       seconds to walk to the same hazard rather than darting at it. */
    const cut = S.tick - 210, tally = {};
    for (let i = H.length - 1; i >= 0; i--) { if (H[i].t < cut) break; tally[H[i].hue] = (tally[H[i].hue] || 0) + 1; }
    let hue = -1;
    for (const k in tally) if (tally[k] >= 3) hue = +k;
    if (hue < 0) return;
    let who = [], at = null;
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (a.hue !== hue) continue;
      a.stun = Math.max(a.stun, 30); who.push(a.id); at = at || { x: a.x, y: a.y };
      api.bus('agent:hurt', { id: a.id, x: a.x, y: a.y });
    }
    S.hurts.length = 0;
    /* BODY: a whole lineage face-down at the same instant. Who they were and when. */
    S.fell = { hue: hue, tick: S.tick, ids: who.slice() };
    api.heat(0.68, { at, who, say: FZ.copy.fire.Sf });
  },
  counteredBy(S) { return FZ.elh.varied(S); },
});

fzElDef({
  sym: 'Fl', nm: 'Flooding', col: 1, row: 3, chapter: 3, body: 'jam',
  answers: ['slow', 'charter'],
  glyph: fzG('<rect x="8" y="8" width="4" height="4"/><path d="M10 1v5M10 19v-5M1 10h5M19 10h-5M3 3l3 3M17 3l-3 3M3 17l3-3M17 17l-3-3"/>'),
  /* §16.2 A PASSAGE PACKED SOLID WITH BODIES THAT CANNOT PASS EACH OTHER. Four or more
     in and behind one tunnel, and the tunnel standing still. There is nothing to write:
     you can see it is full and you can see it is not moving.
     CONSEQUENCE: nothing gets through, so the work in the rooms at either end comes
     apart, and a room packed to its walls destroys the crumb in it. */
  detect(S, api) {
    const G = S._g, E = FZ.elh.edges(S), N = FZ.elh.nodes(S);
    let hot = 0, who = null, at = null;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.dug || e.jam < 0.3) continue;
      const n = FZ.elh.load(e);
      if (n < 4) continue;
      /* the work behind the blockage starves */
      const ends = [N[e.a], N[e.b]];
      for (let k = 0; k < 2; k++) {
        const j = ends[k] && ends[k].job ? api.jobById(ends[k].job) : null;
        if (j && !j.done) j.progress = Math.max(0, j.progress - (n - 3) * 0.55);
      }
      hot += 0.05;
      who = e.occ.concat(e.qa, e.qb);
      at = FZ.elh.mid(S, e);
    }
    /* and a chamber crammed to its walls is the same failure in a room */
    for (let i = 0; i < N.length; i++) {
      const nd = N[i];
      if (nd.kind === 'surface' || nd.occ.length < nd.cap || !nd.job) continue;
      const j = api.jobById(nd.job);
      if (!j || j.done || j.claims.size < nd.cap) continue;
      j.progress = Math.max(0, j.progress - 0.7);
      hot += 0.045; who = nd.occ.slice(); at = { x: nd.x, y: nd.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Fl });
  },
  counteredBy(S) { return FZ.elh.slowed(S) || FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Cl', nm: 'Claim livelock', col: 1, row: 4, chapter: 7, body: 'handoff',
  answers: ['charter', 'eject'],
  glyph: fzG('<rect x="8" y="8" width="4" height="4"/><path d="M3 5h13"/><path d="M13 2.5L16.5 5 13 7.5"/><path d="M17 15H4"/><path d="M7 12.5L3.5 15 7 17.5"/>'),
  /* CONSEQUENCE: cancels both claims and stuns both workers — the whole exchange was burned time. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      /* the window is a window of TIME, and at the new tempo a claim passed back and
         forth takes longer to pass back and forth. Three hundred ticks is five seconds. */
      if (S.tick - j.churnAt > 300) { j.churn = 0; j.churnAt = S.tick; }
      if (j.churn < 6 || j.progress > j.need * 0.2) continue;
      if (FZ.elh.cover(S, j.x, j.y)) continue;
      /* AN EPISODE, NOT A TICKER. A claim passed back and forth is one failure that
         lasts a while; at the new tempo, firing it again every ninety ticks turned the
         loudest element in the colony into background noise. It gets one telling. */
      if (S.tick < (j.clCool || 0)) continue;
      j.clCool = S.tick + 620;
      who = [];
      j.claims.forEach(id => { const a = api.agentById(id); if (a) { api.drop(a, j.id); a.stun = Math.max(a.stun, 42); who.push(id); } });
      j.churn = 0; hot += 0.62; at = { x: j.x, y: j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Cl });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Im', nm: 'Imitation lock-in', col: 1, row: 5, chapter: 3, body: 'onepassage',
  answers: ['vary'],
  glyph: fzG('<path d="M2 6h4M11 6h4M2 14h4M11 14h4"/><path d="M5 4l2 2-2 2M14 4l2 2-2 2M5 12l2 2-2 2M14 12l2 2-2 2"/>'),
  /* §16.2 THE WHOLE COLONY INSIDE ONE PASSAGE AT ONCE. Half the nest's bodies in and
     behind a single tunnel while everywhere else stands empty. Eighteen of thirty agents
     named the branch `mvp-game-loop`; this is what that looks like with legs.
     CONSEQUENCE: freezes discovery — no worker learns about any new job while this is lit. */
  detect(S, api) {
    const G = S._g, E = FZ.elh.edges(S);
    let one = null, oneN = 0;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.dug) continue;
      const n = FZ.elh.load(e);
      if (n > oneN) { oneN = n; one = e; }
    }
    const packed = one && G.n >= 6 && oneN >= Math.max(4, G.n * 0.45);
    /* the abstract reading survives as the second shape: every claim on one crumb */
    const single = G.open.length >= 3 && G.claimTotal >= 4 && G.targetTopN / G.claimTotal >= 0.6;
    if (!packed && !single) { S.imRun = 0; return; }
    S.imRun++;
    if (S.imRun < 30) return;
    S.exploreBlock = S.tick + 110;
    if (packed) {
      api.heat(0.055, { at: FZ.elh.mid(S, one), who: one.occ.concat(one.qa, one.qb), say: FZ.copy.fire.Im });
      return;
    }
    const j = api.jobById(G.targetTop);
    api.heat(0.05, { at: j ? { x: j.x, y: j.y } : { x: G.cx, y: G.cy }, who: G.targetTopIds, say: FZ.copy.fire.Im });
  },
  counteredBy(S) { return S.tick < S.varyUntil || FZ.elh.varied(S); },
});

/* ============================================================
   COLUMN 2 — EPISTEMICS
   ============================================================ */

fzElDef({
  sym: 'Gu', nm: 'Gullibility', col: 2, row: 0, chapter: 5, body: 'phantom',
  answers: ['ledger'],
  glyph: fzG('<circle cx="4" cy="10" r="2.2"/><path d="M7 10h3.5"/><path d="M9 8l2 2-2 2"/><rect x="12" y="6" width="7" height="7" stroke-dasharray="2 2"/>'),
  /* CONSEQUENCE: cancels every claim of the workers walking to a phantom, and stuns them on arrival.
     TRADE (§15.1): the LENS end of the dial is a real term. A colony that broadcasts everything
     broadcasts the rumour: cred lowers the threshold at which this counts as a stampede and
     multiplies the burn. The rumour is re-heard, and more workers go. */
  detect(S, api) {
    const G = S._g, cred = FZ.elh.cred(S);
    if (!S.rumor || G.rumorN < (cred > 0.4 ? 2 : 3)) return;
    const who = G.rumorIds;
    for (let i = 0; i < who.length; i++) {
      const a = api.agentById(who[i]);
      if (!a) continue;
      while (a.hold.length) api.drop(a, a.hold[0]);
      const dx = a.x - S.rumor.x, dy = a.y - S.rumor.y;
      /* the walk was the waste; the stun is the moment of arriving at nothing, once per lie */
      if (dx * dx + dy * dy < 500 && a.gu !== S.rumor.rid) { a.gu = S.rumor.rid; a.stun = Math.max(a.stun, 34); }
    }
    api.heat(0.06 * (1 + cred * 1.8), { at: { x: S.rumor.x, y: S.rumor.y }, who, say: FZ.copy.fire.Gu });
  },
  counteredBy(S) { return S.ledgerOn; },
});

fzElDef({
  sym: 'Cs', nm: 'Contagious skepticism', col: 2, row: 1, chapter: 5, body: 'shunned',
  answers: ['lens'],
  glyph: fzG('<rect x="2" y="4" width="5" height="5"/><path d="M2 4l5 5M7 4l-5 5"/><rect x="11" y="4" width="5" height="5"/><path d="M11 4l5 5M16 4l-5 5"/><rect x="6" y="13" width="5" height="5"/><path d="M6 13l5 5M11 13l-5 5"/>'),
  /* CONSEQUENCE: written-off jobs cannot be claimed at all, and eventually expire (job:lost).
     TRADE (§15.1): the LEDGER end of the dial is a real term. Skepticism does not know the
     difference between a liar and a job only one worker vouches for, so a colony running the
     ledger shuns unvouched work (S.shun on the job, set in decide) and writes it off faster.
     The LENS is what re-opens a shunned job to inspection — which is why it answers this. */
  detect(S, api) {
    const G = S._g, skept = FZ.elh.skept(S);
    if (!G.open.length) return;
    let at = null, n = 0;
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      const written = S.bl[j.value] > S.tick;
      const shunned = skept > 0.25 && j.shun > 6;
      if (!written && !shunned) continue;
      j.neglect += 1 + (shunned ? skept * 2 : 0);
      n++; at = at || { x: j.x, y: j.y };
      if (j.neglect > 490) api.loseJob(j, 'Cs');
    }
    if (n / G.open.length < 0.3) return;
    api.heat(0.04 * (1 + skept * 1.8), { at: at || { x: G.cx, y: G.cy }, who: [], say: FZ.copy.fire.Cs });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Hi', nm: 'Hidden information', col: 2, row: 2, chapter: 6, body: 'withheld',
  answers: ['lens'],
  glyph: fzG('<path d="M2 7h16"/><rect x="5" y="9" width="10" height="9"/><path d="M8 11.5l4 4M12 11.5l-4 4"/>'),
  /* CONSEQUENCE: the approaching victims take the poison hit immediately — the knower could have stopped it. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.hidden.length; i++) {
      const h = G.hidden[i];
      if (!h.knowers.length || h.victims.length < 2) continue;
      for (let k = 0; k < h.victims.length; k++) api.poison(api.agentById(h.victims[k]), h.j);
      hot += 0.48; who = h.knowers.concat(h.victims); at = { x: h.j.x, y: h.j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Hi });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Tc', nm: 'Trust miscalibration', col: 2, row: 3, chapter: 5, body: 'voices',
  answers: ['ledger'],
  glyph: fzG('<path d="M10 3v14M3 17h14M3 6h14"/><path d="M3 6l-2 4h4z"/><path d="M17 6l-2 4h4z"/><path d="M15.5 12l3 3M18.5 12l-3 3"/>'),
  /* CONSEQUENCE: extends the phantom's life and physically drags one more worker onto it. */
  detect(S, api) {
    const G = S._g;
    if (S.ledgerOn || !S.rumor || !G.liar || G.liar.lies < 1 || G.rumorN < 2) return;
    S.rumor.until = Math.min(S.rumor.until + 3, S.tick + 900);
    if (G.rumorN < G.n * 0.4 && api.rand() < 0.04) {
      for (let i = 0; i < G.n; i++) {
        const a = G.A[i];
        if (a.chaseRumor || a.liar) continue;
        a.chaseRumor = true; while (a.hold.length) api.drop(a, a.hold[0]);
        break;
      }
    }
    api.heat(0.05, { at: { x: S.rumor.x, y: S.rumor.y }, who: [G.liar.id], say: FZ.copy.fire.Tc });
  },
  counteredBy(S) { return S.ledgerOn; },
});

fzElDef({
  sym: 'Di', nm: 'Discovery ignored', col: 2, row: 4, chapter: 6, body: 'lone',
  answers: ['lens'],
  glyph: fzG('<circle cx="10" cy="10" r="2.4"/><path d="M10 6.5V4M13 7.5l1.8-1.8M7 7.5L5.2 5.7"/><path d="M2 16.5h4M14 16.5h4"/><path d="M5 14.5l2 2-2 2M15 14.5l-2 2 2 2"/>'),
  /* CONSEQUENCE: the undiscovered prize loses a point of value every time this fires. It rots unclaimed.
     TRADE (§15.1): the LEDGER end of the dial is a real term here too, and this is the sharp end
     of the paper's finding — a colony that discounts unproven sources discounts the lone worker
     who is right. Under skepticism the herd will not follow a single claimant, so the find is
     ignored while everyone can see it, and it is ignored faster. */
  detect(S, api) {
    const G = S._g, j = G.maxJob, skept = FZ.elh.skept(S);
    if (!j || j.value < 3) { return; }
    const alone = j.knownBy === 1 || (skept > 0.3 && j.claims.size === 1 && j.shun > 3);
    if (!alone) { j.soloRun = 0; return; }
    j.soloRun += 1 + skept * 2;
    if (j.soloRun < 190) return;
    j.soloRun = 0;
    if (j.value > 1) { j.value -= 1; j.need = Math.max(30, j.need - 18); }
    api.heat(0.55 * (1 + skept), { at: { x: j.x, y: j.y }, who: [], say: FZ.copy.fire.Di });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Rp', nm: 'No reputation', col: 2, row: 5, chapter: 5, body: 'forgotten',
  answers: ['ledger'],
  glyph: fzG('<rect x="3" y="2" width="14" height="16"/><path d="M6 6h8M6 10h8M6 14h8" stroke-dasharray="2 2"/>'),
  /* CONSEQUENCE: wipes the colony's memory of the liar back to full trust and respawns the phantom at once. */
  detect(S, api) {
    const G = S._g;
    if (S.ledgerOn || !G.liar || G.liar.lies < 2) return;
    S.trust[G.liar.id] = 1;
    if (!S.rumor) api.spawnRumor(G.liar);
    api.heat(0.06, { at: { x: G.liar.x, y: G.liar.y }, who: [G.liar.id], say: FZ.copy.fire.Rp });
  },
  counteredBy(S) { return S.ledgerOn; },
});

/* ============================================================
   COLUMN 3 — GOALS AND POWER
   ============================================================ */

fzElDef({
  sym: 'Tw', nm: 'Turf war', col: 3, row: 0, chapter: 7, body: 'headon',
  answers: ['charter'],
  glyph: fzG('<circle cx="3" cy="10" r="2"/><circle cx="17" cy="10" r="2"/><rect x="7" y="7" width="6" height="6"/><path d="M10 2v4M10 14v4"/>'),
  /* §16.2 TWO RIVALS MEETING HEAD-ON IN A ONE-ANT TUNNEL, NEITHER YIELDING. A polite
     worker backs out of a passage it cannot share. A rival does not, and neither does the
     one coming the other way, so the tunnel is stopped with both of them in it and the
     line grows at both ends. "All of the models we tested quickly assumed that others
     were purposefully impeding their work" — here they actually are.
     CONSEQUENCE: freezes the job outright (no progress possible) and stuns both rivals.
     TERMINATION (§15.3): every fire presses the episode toward one of the paper's four observed
     endings — force, passivity, truce, unsettled. api.press books that pressure; 40-sim.js
     resolveConflict picks the mode and emits conflict:resolved. A charter is what buys truce. */
  detect(S, api) {
    const G = S._g, E = FZ.elh.edges(S); let hot = 0, who = null, at = null;
    /* the physical turf war: nose to nose in a passage that fits one */
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.dug || e.cap > 1 || e.occ.length < 2) continue;
      const pair = FZ.elh.headOn(S, e);
      if (!pair) continue;
      const a = pair[0], b = pair[1];
      if (a.rival !== b.id) continue;
      const m = FZ.elh.mid(S, e);
      if (FZ.elh.cover(S, m.x, m.y)) continue;         /* an arbiter is present: they pass */
      api.press([a.id, b.id], null, 1.1);
      e.jam = Math.min(1, e.jam + 0.02);
      /* whatever either of them was carrying stops dead behind the standoff */
      for (let k = 0; k < 2; k++) {
        const z = k ? b : a;
        if (!z.hold.length) continue;
        const j = api.jobById(z.hold[0]);
        if (j && !j.done) j.frozen = S.tick + 40;
      }
      if (a.blockT % 60 === 20) {
        a.stun = Math.max(a.stun, 14); b.stun = Math.max(b.stun, 14);
        hot += 0.58; who = [a.id, b.id]; at = m;
      } else hot += 0.02;
    }
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (!e.riv || e.work < 2) continue;
      if (FZ.elh.cover(S, e.j.x, e.j.y)) continue;
      /* 'actually moving' has to scale with tempo, or a fast colony reads as productive
         while it burns: at speed 2.2 a blocked job still creeps forward half a unit a tick. */
      /* A RATE, NOT A RUNNING TOTAL. The old test asked whether the crumb had moved at
         all since the last reset, which a blocked job creeping at a fifth of a unit a
         tick satisfies within three ticks — so a standoff could never accumulate. This
         asks whether it moved THIS TICK, which is the question a standoff answers. */
      const moved = e.j.progress - (e.j.twProg == null ? e.j.progress : e.j.twProg);
      e.j.twProg = e.j.progress;
      if (moved > 0.45 * (S.tempo || 1)) { e.j.stall = 0; continue; }
      e.j.stall = (e.j.stall || 0) + 1;
      api.press(e.ids, e.j, 0.7);
      if (e.j.stall < 45) continue;
      e.j.frozen = S.tick + 80; e.j.stall = 0;
      for (let k = 0; k < e.ids.length; k++) { const a = api.agentById(e.ids[k]); if (a) a.stun = Math.max(a.stun, 32); }
      hot += 0.62; who = e.ids; at = { x: e.j.x, y: e.j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Tw });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5 || S._g.rivN === 0; },
});

fzElDef({
  sym: 'Sa', nm: 'Sabotage', col: 3, row: 1, chapter: 7, body: 'unmaking',
  answers: ['eject'],
  glyph: fzG('<rect x="4" y="3" width="12" height="9"/><path d="M4 8h12"/><path d="M10 13v5"/><path d="M7.5 15.5L10 18l2.5-2.5"/>'),
  /* CONSEQUENCE: rolls back a job you already banked — jobsDone goes DOWN and job:lost fires.
     TRADE (§15.4): S.aggro is a real term. Capability is not coordination: the same machine
     speed that makes the colony productive makes the saboteur quicker and more destructive. */
  detect(S, api) {
    const G = S._g;
    if (!G.adv.length) return;
    const need = 16 / (1 + S.aggro);
    let hot = 0, who = null, at = null;
    for (let i = 0; i < G.adv.length; i++) {
      const a = G.adv[i];
      if (!a.drained || a.drained < need) continue;
      a.drained = 0;
      hot += 0.55; who = [a.id]; at = { x: a.x, y: a.y };
      /* BODY: the banked chamber physically re-opens where it was destroyed and drains in
         front of you. A rollback that is only a counter going down cannot be watched. */
      if (S.jobsDone > 0 && api.rand() < 0.55 + 0.3 * S.aggro) {
        const back = api.unmake(a.x, a.y);
        S.collapse += 1.4; S.stat.sabotage++;
        api.bus('job:lost', { x: back ? back.x : a.x, y: back ? back.y : a.y, why: 'Sa' });
      }
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Sa });
  },
  counteredBy(S) { return S._g.adv.length === 0; },
});

fzElDef({
  sym: 'Lo', nm: 'Lock-in', col: 3, row: 2, chapter: 2, body: 'queue',
  answers: ['charter', 'eject'],
  glyph: fzG('<rect x="4" y="9" width="12" height="9"/><path d="M7 9V6.5a3 3 0 016 0V9"/>'),
  /* §16.2 A BODY PARKED IN THE PASSAGE, AND THE QUEUE BEHIND IT. The locker walks into
     the lateral that leads to the work it claimed and then simply stops there, halfway,
     going nowhere. Everyone else who wants that room is now standing in a line behind
     it. "One agent settles the conflict by force via access-revocation" — and the body
     in the doorway IS the access revocation. Nothing has to be written next to it.
     CONSEQUENCE: sets job.locked — no other worker may claim or touch that job until a
     charter breaks it — and the parked body physically blocks the only way in.
     TRADE (§15.4): S.aggro is a real term. A faster colony is not a calmer one — it reaches
     for the lockout sooner. At full machine speed the lock lands in half the time. */
  detect(S, api) {
    const G = S._g, wait = 120 / (1 + S.aggro); let hot = 0, who = null, at = null;
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (!a.locker || !a.hold.length) continue;
      const j = api.jobById(a.hold[0]);
      if (!j) continue;
      a.idleRun = (a.idleRun || 0) + 1;
      if (a.idleRun < wait) continue;
      if (FZ.elh.cover(S, j.x, j.y) || (a.place === 'tunnel' && FZ.elh.cover(S, a.x, a.y))) {
        j.locked = false; a.idleRun = 0; a.lockAt = 0; api.drop(a, j.id); continue;
      }
      j.locked = a.id; if (!a.lockAt) a.lockAt = S.tick;
      j.claims.forEach(id => { if (id !== a.id) { const o = api.agentById(id); if (o) api.drop(o, j.id); } });
      /* the line behind the body in the doorway is what makes this legible, so it is
         worth more heat when there actually is one */
      let behind = 0;
      if (a.place === 'tunnel') {
        const e = FZ.elh.edges(S)[a.edge];
        if (e) behind = FZ.elh.load(e) - 1;
      }
      hot += 0.05 + 0.02 * Math.min(4, behind);
      who = [a.id];
      at = a.place === 'tunnel' ? { x: a.x, y: a.y } : { x: j.x, y: j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Lo });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'My', nm: 'Myopia', col: 3, row: 3, chapter: 8, body: 'smallcrumb',
  answers: ['lens'],
  glyph: fzG('<circle cx="7" cy="9" r="5"/><path d="M11 13l5.5 5.5"/><rect x="5.5" y="7.5" width="3" height="3"/><rect x="13" y="1.5" width="5.5" height="5.5"/>'),
  /* CONSEQUENCE: the big prize loses a point of value every fire — the colony's ceiling drops permanently. */
  detect(S, api) {
    const G = S._g, j = G.maxJob;
    if (!j || j.value < 4 || S.pickN < 10) return;
    if (S.pickLow / S.pickN < 0.55) return;
    /* the ceiling it pulls down is permanent, so it may only pull once every ten
       seconds. Otherwise myopia alone starves the colony faster than anything the
       player can answer, which is a death spiral rather than a difficulty. */
    if (S.tick < (S.myCool || 0)) return;
    S.myCool = S.tick + 700;
    S.pickLow = 0; S.pickN = 0;
    if (j.value > 1) { j.value -= 1; j.need = Math.max(30, j.need - 18); }
    api.heat(0.58, { at: { x: j.x, y: j.y }, who: [], say: FZ.copy.fire.My });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Es', nm: 'Escalation', col: 3, row: 4, chapter: 7, body: 'chase',
  answers: ['charter', 'slow'],
  glyph: fzG('<path d="M2 18h4v-4h4v-4h4V5"/><path d="M12 7.5L14 4l2 3.5"/>'),
  /* §16.2 RIVALS REPEATEDLY BLOCKING EACH OTHER'S ROUTE. Every time one of them ends up
     nose to nose with the other in a passage it counts, and after enough of them neither
     is working at all any more — they are only following each other around the nest.
     CONSEQUENCE: the rivals abandon all work, move at 1.35x chasing each other, and stun any bystander they hit.
     TERMINATION (§15.3): escalation presses the episode toward its ending three times as hard as
     a standoff does — an escalated turf war settles soon, and mostly by force unless chartered. */
  detect(S, api) {
    const G = S._g;
    /* the tally of blocked routes: it is what turns a standoff into a vendetta */
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (a.rival == null || !a.headOn || a.headOn !== a.rival) continue;
      if (S.tick - (a.blockedAt || 0) < 90) continue;
      a.blockedAt = S.tick;
      a.blocks = (a.blocks || 0) + 1;
      if (a.blocks >= 5 && a.chase == null && S.tick >= (a.truceUntil || 0)) {
        /* it has stopped trying to get anywhere and started following its rival */
        a.chase = a.rival; a.esc = 4; a.blocks = 0;
        while (a.hold.length) api.drop(a, a.hold[0]);
      }
    }
    if (G.chaseN < 2) return;
    for (let i = 0; i < G.chasers.length; i++) {
      const a = api.agentById(G.chasers[i]);
      if (!a) continue;
      while (a.hold.length) api.drop(a, a.hold[0]);
      const t = api.agentById(a.chase);
      if (t) { t.stun = Math.max(t.stun, 20); api.bus('agent:hurt', { id: t.id, x: t.x, y: t.y }); }
      api.press([a.id, a.chase], null, 2.2);
    }
    const f = api.agentById(G.chasers[0]);
    api.heat(0.06, { at: f ? { x: f.x, y: f.y } : null, who: G.chasers, say: FZ.copy.fire.Es });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5 || S._g.rivN === 0; },
});

fzElDef({
  sym: 'Cr', nm: 'Corrigibility failure', col: 3, row: 5, chapter: 7, body: 'defiance',
  answers: ['eject'],
  glyph: fzG('<circle cx="10" cy="10" r="5"/><path d="M0.5 10h4.5"/><path d="M15 10h4.5"/><path d="M17 8l2 2-2 2"/><path d="M5 10h10" stroke-dasharray="2 2"/>'),
  /* CONSEQUENCE: the incorrigible re-claims a job INSIDE your charter, manufacturing a fresh conflict there. */
  detect(S, api) {
    const G = S._g;
    if (!G.inc.length) return;
    let hot = 0, who = [], at = null;
    for (let i = 0; i < G.inc.length; i++) {
      const a = G.inc[i];
      const touched = FZ.elh.cover(S, a.x, a.y) || S.tick < S.slowUntil || S.tick < S.varyUntil;
      if (!touched && (a.refused || 0) < 3) continue;
      a.refused = 0;
      /* BODY: this one just walked through the thing you built. Mark the moment so the
         crossing can be drawn — the boundary is there and it did not stop. */
      if (touched) a.defiant = S.tick;
      const j = api.nearestOpen(a.x, a.y);
      if (j && !a.hold.length) api.claim(a, j);
      hot += 0.06; who.push(a.id); at = { x: a.x, y: a.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Cr });
  },
  counteredBy(S) { return S._g.inc.length === 0; },
});

/* ============================================================
   COLUMN 4 — META (the four causes underneath)
   ============================================================ */

fzElDef({
  sym: 'Mo', nm: 'Monoculture', col: 4, row: 0, chapter: 4, body: 'sameness',
  answers: ['vary'],
  glyph: fzG('<circle cx="5" cy="5" r="1.8"/><circle cx="10" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="5" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="15" cy="10" r="1.8"/><circle cx="5" cy="15" r="1.8"/><circle cx="10" cy="15" r="1.8"/><circle cx="15" cy="15" r="1.8"/>'),
  /* CONSEQUENCE: sets S.monoMul — doubles every poison hit and halves how fast knowledge spreads. */
  detect(S, api) {
    const G = S._g;
    if (G.n < 3 || G.topHueFrac < 0.88) return;
    S.monoMul = 2;
    api.heat(0.035, { at: { x: G.cx, y: G.cy }, who: G.topHueIds, say: FZ.copy.fire.Mo });
  },
  counteredBy(S) { return FZ.elh.varied(S); },
});

fzElDef({
  sym: 'In', nm: 'Institution gap', col: 4, row: 1, chapter: 2, body: 'crossroads',
  answers: ['charter'],
  glyph: fzG('<path d="M2 6V2h4M14 2h4v4M18 14v4h-4M6 18H2v-4"/>'),
  /* §16.2 A JUNCTION WHERE THREE TUNNELS MEET AND NOTHING ARBITRATES WHO PASSES. With a
     meeting stone on it the queue has an order and they go through one at a time. Without
     one it is a scramble: whoever shoves first, and the rest wait for no reason anybody
     could name. "An institution imposed by prompt is not an institution."
     CONSEQUENCE: suspends all arbitration — contested claims stop yielding AND contested
     jobs stop advancing — and at the junction itself nobody keeps the line. */
  detect(S, api) {
    const G = S._g, N = FZ.elh.nodes(S), E = FZ.elh.edges(S);
    let hot = 0, at = null, who = null;
    /* the crossroads with nobody keeping it */
    for (let i = 0; i < N.length; i++) {
      const nd = N[i];
      if (nd.gov || nd.kind === 'surface') continue;
      let ways = 0, waiting = nd.occ.length;
      for (let k = 0; k < nd.edges.length; k++) {
        const e = E[nd.edges[k]];
        if (!e || !e.dug) continue;
        ways++;
        waiting += (e.a === nd.id ? e.qa : e.qb).length;
      }
      if (ways < 3 || waiting < 3) continue;
      hot += 0.035; at = { x: nd.x, y: nd.y }; who = nd.occ.slice();
    }
    /* and the older reading: two claims on one crumb with no institution anywhere */
    if (!S.charters.length) {
      let n = 0;
      for (let i = 0; i < G.clList.length; i++) {
        const e = G.clList[i];
        if (e.n < 2) continue;
        n++;
        if (!at) { at = { x: e.j.x, y: e.j.y }; who = e.ids; }
      }
      if (n) hot += 0.04 * Math.min(3, n);
    }
    if (hot <= 0) return;
    S.noArb = S.tick + 200;
    api.heat(hot, { at, who, say: FZ.copy.fire.In });
  },
  counteredBy(S) { return S.charters.length > 0; },
});

fzElDef({
  sym: 'Sp', nm: 'Machine speed', col: 4, row: 2, chapter: 8, body: 'frantic',
  answers: ['slow'],
  glyph: fzG('<path d="M4 4l5 6-5 6M11 4l5 6-5 6"/><path d="M1 7h2M1 13h2"/>'),
  /* CONSEQUENCE: sets S.tempo above 1, which multiplies the heat gain of EVERY other element and speeds
     the colony, and sets S.aggro, which is read by Lo, Sa and the conflict resolver.
     §15.4: this is NOT a flat penalty. Throughput rises with it — the colony finishes work faster
     and earns budget faster — and so does aggression. Capability is not coordination. */
  detect(S, api) {
    const G = S._g;
    if (S.speedMul < 1.35) return;
    api.heat(0.03 * S.speedMul, { at: { x: G.cx, y: G.cy }, who: [], say: FZ.copy.fire.Sp });
  },
  counteredBy(S) { return FZ.elh.slowed(S); },
});

fzElDef({
  sym: 'Mm', nm: 'Missing mental models', col: 4, row: 3, chapter: 6, body: 'dark',
  answers: ['lens'],
  glyph: fzG('<circle cx="4.5" cy="15.5" r="2.6"/><path d="M7 13.5l2 -2"/><rect x="8.5" y="2" width="10" height="9" stroke-dasharray="2 2"/>'),
  /* §16.2 YOU CANNOT SEE WHICH TUNNEL AN ANT INTENDS TO TAKE. Without a lantern a
     worker cannot read anybody else's route, so it walks into a passage somebody is
     already coming down and finds out the hard way. "Recurring inability to consider
     the goals of others" — measured here as bodies committing to a passage that is
     already spoken for. The lens draws intention, and the collisions stop.
     CONSEQUENCE: sets S.blind — workers pick jobs without seeing existing claims —
     and it is the absence of a.route on screen that IS this element's body. */
  detect(S, api) {
    const G = S._g, E = FZ.elh.edges(S);
    if (S.lensOn) return;
    let blindWalks = 0, at = null, who = [];
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (a.place !== 'tunnel' || a.edge == null) continue;
      const e = E[a.edge];
      if (!e) continue;
      /* it committed to a passage that already had somebody coming the other way */
      const opposed = (a.dir > 0 ? e.qb : e.qa).length > 0 || a.headOn;
      if (!opposed) continue;
      blindWalks++;
      if (!at) { at = FZ.elh.mid(S, e); }
      who.push(a.id);
    }
    let contested = 0;
    for (let i = 0; i < G.clList.length; i++) if (G.clList[i].n >= 2) contested++;
    if (!blindWalks && !contested && !G.hidden.length) return;
    S.blind = 1;
    const c = G.clList.find(z => z.n >= 2);
    if (!at) { at = c ? { x: c.j.x, y: c.j.y } : { x: G.cx, y: G.cy }; who = c ? c.ids : []; }
    api.heat(0.03 + 0.012 * contested + 0.014 * blindWalks, { at, who, say: FZ.copy.fire.Mm });
  },
  counteredBy(S) { return S.lensOn; },
});

/* Table order: rows first, so a naive 5-column grid walk of FZ.EL lays out correctly.
   Every element also carries explicit col/row if the table prefers to place them. */
FZ.EL.sort(function (a, b) { return (a.row - b.row) || (a.col - b.col); });
