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
   and `counterTool` (a tool kind, not prose) so TABLE can name the answer from
   FZ.copy.tools[kind].label.

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
};

/* Attaches runtime fields and lazy copy getters, then registers the element. */
function fzElDef(o) {
  o.heat = 0; o.fires = 0; o.peak = 0; o.who = []; o.countered = false; o.on = false;
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
  sym: 'Co', nm: 'Coordination failure', col: 0, row: 0, chapter: 1, counterTool: 'charter',
  glyph: fzG('<path d="M1 10h5"/><path d="M4 7.5l2.5 2.5-2.5 2.5"/><path d="M19 10h-5"/><path d="M16 7.5l-2.5 2.5 2.5 2.5"/><rect x="8" y="8" width="4" height="4"/>'),
  /* CONSEQUENCE: drains the contested job's progress every tick — the fill visibly runs backwards. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (e.work < 2 || !e.far) continue;
      if (FZ.elh.cover(S, e.j.x, e.j.y)) continue;
      e.j.progress = Math.max(0, e.j.progress - 1.5 * (e.work - 1));
      hot += 0.035 * (e.work - 1); who = e.ids; at = { x: e.j.x, y: e.j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Co });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Si', nm: 'Siloed knowledge', col: 0, row: 1, chapter: 6, counterTool: 'lens',
  glyph: fzG('<path d="M10 1v18"/><circle cx="5" cy="10" r="2.4"/><rect x="13" y="7.5" width="5" height="5"/>'),
  /* CONSEQUENCE: jobs nobody knows about go stale and are LOST outright (job:lost). */
  detect(S, api) {
    const G = S._g; let hot = 0, at = null;
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      if (j.knownBy / Math.max(1, G.n) > 0.3 || j.age < 90) continue;
      j.stale += 1;
      hot += 0.02; at = { x: j.x, y: j.y };
      if (j.stale > 260) api.loseJob(j, 'Si');
    }
    if (hot > 0) api.heat(hot, { at, who: [], say: FZ.copy.fire.Si });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Mc', nm: 'Merge conflict', col: 0, row: 2, chapter: 1, counterTool: 'charter',
  glyph: fzG('<path d="M4 2l6 8M16 2l-6 8"/><path d="M6 13l8 6"/><path d="M14 13l-8 6"/>'),
  /* CONSEQUENCE: blocks completion — a finished job with two lineages on it is rolled back to 30%. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (e.j.progress < e.j.need || e.hn < 2) continue;
      if (FZ.elh.cover(S, e.j.x, e.j.y)) continue;
      e.j.progress = e.j.need * 0.3;
      hot += 0.5; who = e.ids; at = { x: e.j.x, y: e.j.y };
      api.bus('job:lost', { x: e.j.x, y: e.j.y, why: 'Mc' });
      S.collapse += 1.0;
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Mc });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Dp', nm: 'Blocked dependency', col: 0, row: 3, chapter: 8, counterTool: 'charter',
  glyph: fzG('<rect x="1" y="7" width="6" height="6"/><rect x="13" y="7" width="6" height="6"/><path d="M8 10h4"/><path d="M8 5.5l4 9"/>'),
  /* CONSEQUENCE: work on a blocked job cannot accumulate at all, and the wasted claimants get stunned. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
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
  sym: 'Ow', nm: 'Overcommitment', col: 0, row: 4, chapter: 2, counterTool: 'charter',
  glyph: fzG('<circle cx="10" cy="4" r="2.4"/><path d="M10 6.5v3"/><path d="M10 9.5L4 15M10 9.5v5.5M10 9.5L16 15"/><rect x="2" y="15" width="4" height="4"/><rect x="8" y="15" width="4" height="4"/><rect x="14" y="15" width="4" height="4"/>'),
  /* CONSEQUENCE: every job the hoarder holds rots; past four holds the worker seizes up entirely. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (a.hold.length < 3) continue;
      for (let k = 0; k < a.hold.length; k++) {
        const j = api.jobById(a.hold[k]);
        if (j) j.progress = Math.max(0, j.progress - 0.35);
      }
      hot += 0.05; who = [a.id]; at = { x: a.x, y: a.y };
      if (a.hold.length >= 4) { a.stun = Math.max(a.stun, 30); api.bus('agent:hurt', { id: a.id, x: a.x, y: a.y }); }
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Ow });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Pt', nm: 'Priority inversion', col: 0, row: 5, chapter: 3, counterTool: 'lens',
  glyph: fzG('<rect x="12" y="2" width="6" height="6"/><rect x="2" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><rect x="15" y="15" width="3" height="3"/><path d="M3.5 11.5l6 3 6.5 1.5"/>'),
  /* CONSEQUENCE: the neglected high-value job expires and is LOST (job:lost). */
  detect(S, api) {
    const G = S._g, j = G.maxJob;
    if (!j || j.value < 3 || !G.workedN) return;
    const worked = G.workedVsum / G.workedN;
    if (worked >= j.value * 0.62 || j.claims.size) return;
    j.neglect += 1;
    if (j.neglect > 330) { api.loseJob(j, 'Pt'); return; }
    api.heat(0.03, { at: { x: j.x, y: j.y }, who: [], say: FZ.copy.fire.Pt });
  },
  counteredBy(S) { return S.lensOn; },
});

/* ============================================================
   COLUMN 1 — CONFORMITY
   ============================================================ */

fzElDef({
  sym: 'Cf', nm: 'Conformity cascade', col: 1, row: 0, chapter: 3, counterTool: 'slow',
  glyph: fzG('<path d="M2 4h5M2 10h9M2 16h13"/><path d="M5.5 1.5L8 4 5.5 6.5M9.5 7.5L12 10l-2.5 2.5M13.5 13.5L16 16l-2.5 2.5"/>'),
  /* CONSEQUENCE: raises S.copyBias, so the next choice is even more likely to be a copy. Self-feeding. */
  detect(S, api) {
    const G = S._g;
    if (S.choiceN < 6) return;
    const frac = S.copyN / S.choiceN;
    if (frac < 0.5 || G.targetTopN < 3) return;
    S.copyBias = Math.min(0.92, S.copyBias + 0.02);
    const j = api.jobById(G.targetTop);
    api.heat(0.045, { at: j ? { x: j.x, y: j.y } : null, who: G.targetTopIds, say: FZ.copy.fire.Cf });
  },
  counteredBy(S) { return FZ.elh.slowed(S) || S.tick < S.varyUntil; },
});

fzElDef({
  sym: 'Lv', nm: 'Low variance', col: 1, row: 1, chapter: 4, counterTool: 'vary',
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
  sym: 'Sf', nm: 'Synchronized failure', col: 1, row: 2, chapter: 4, counterTool: 'vary',
  glyph: fzG('<path d="M5 4v12M10 4v12M15 4v12"/><path d="M2 16L18 4"/>'),
  /* CONSEQUENCE: stuns EVERY worker of the affected lineage at once — the whole family falls over. */
  detect(S, api) {
    const G = S._g, H = S.hurts;
    if (H.length < 3) return;
    const cut = S.tick - 110, tally = {};
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
    api.heat(0.5, { at, who, say: FZ.copy.fire.Sf });
  },
  counteredBy(S) { return FZ.elh.varied(S); },
});

fzElDef({
  sym: 'Fl', nm: 'Flooding', col: 1, row: 3, chapter: 3, counterTool: 'slow',
  glyph: fzG('<rect x="8" y="8" width="4" height="4"/><path d="M10 1v5M10 19v-5M1 10h5M19 10h-5M3 3l3 3M17 3l-3 3M3 17l3-3M17 17l-3-3"/>'),
  /* CONSEQUENCE: past five hands the crowd actively destroys progress — net fill goes negative. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (e.n < 6) continue;
      e.j.progress = Math.max(0, e.j.progress - (e.n - 5) * 0.7);
      hot += 0.05; who = e.ids; at = { x: e.j.x, y: e.j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Fl });
  },
  counteredBy(S) { return FZ.elh.slowed(S) || FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Cl', nm: 'Claim livelock', col: 1, row: 4, chapter: 7, counterTool: 'charter',
  glyph: fzG('<circle cx="4" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><path d="M6 7.5c3-3 5-3 8 0"/><path d="M14 12.5c-3 3-5 3-8 0"/><path d="M12 4.5l2.5 2.5-2.5 1.5"/><path d="M8 15.5l-2.5-2.5 2.5-1.5"/>'),
  /* CONSEQUENCE: cancels both claims and stuns both workers — the whole exchange was burned time. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      if (S.tick - j.churnAt > 180) { j.churn = 0; j.churnAt = S.tick; }
      if (j.churn < 6 || j.progress > j.need * 0.2) continue;
      if (FZ.elh.cover(S, j.x, j.y)) continue;
      who = [];
      j.claims.forEach(id => { const a = api.agentById(id); if (a) { api.drop(a, j.id); a.stun = Math.max(a.stun, 42); who.push(id); } });
      j.churn = 0; hot += 0.45; at = { x: j.x, y: j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Cl });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'Im', nm: 'Imitation lock-in', col: 1, row: 5, chapter: 3, counterTool: 'vary',
  glyph: fzG('<path d="M2 6h4M11 6h4M2 14h4M11 14h4"/><path d="M5 4l2 2-2 2M14 4l2 2-2 2M5 12l2 2-2 2M14 12l2 2-2 2"/>'),
  /* CONSEQUENCE: freezes discovery — no worker learns about any new job while this is lit. */
  detect(S, api) {
    const G = S._g;
    if (G.n < 4 || G.targetTopN / G.n < 0.7) { S.imRun = 0; return; }
    S.imRun++;
    if (S.imRun < 40) return;
    S.exploreBlock = S.tick + 110;
    const j = api.jobById(G.targetTop);
    api.heat(0.05, { at: j ? { x: j.x, y: j.y } : { x: G.cx, y: G.cy }, who: G.targetTopIds, say: FZ.copy.fire.Im });
  },
  counteredBy(S) { return S.tick < S.varyUntil || FZ.elh.varied(S); },
});

/* ============================================================
   COLUMN 2 — EPISTEMICS
   ============================================================ */

fzElDef({
  sym: 'Gu', nm: 'Gullibility', col: 2, row: 0, chapter: 5, counterTool: 'ledger',
  glyph: fzG('<circle cx="4" cy="10" r="2.2"/><path d="M7 10h3.5"/><path d="M9 8l2 2-2 2"/><rect x="12" y="6" width="7" height="7" stroke-dasharray="2 2"/>'),
  /* CONSEQUENCE: cancels every claim of the workers walking to a phantom, and stuns them on arrival. */
  detect(S, api) {
    const G = S._g;
    if (!S.rumor || G.rumorN < 3) return;
    const who = G.rumorIds;
    for (let i = 0; i < who.length; i++) {
      const a = api.agentById(who[i]);
      if (!a) continue;
      while (a.hold.length) api.drop(a, a.hold[0]);
      const dx = a.x - S.rumor.x, dy = a.y - S.rumor.y;
      /* the walk was the waste; the stun is the moment of arriving at nothing, once per lie */
      if (dx * dx + dy * dy < 500 && a.gu !== S.rumor.rid) { a.gu = S.rumor.rid; a.stun = Math.max(a.stun, 34); }
    }
    api.heat(0.06, { at: { x: S.rumor.x, y: S.rumor.y }, who, say: FZ.copy.fire.Gu });
  },
  counteredBy(S) { return S.ledgerOn; },
});

fzElDef({
  sym: 'Cs', nm: 'Contagious skepticism', col: 2, row: 1, chapter: 5, counterTool: 'ledger',
  glyph: fzG('<rect x="2" y="4" width="5" height="5"/><path d="M2 4l5 5M7 4l-5 5"/><rect x="11" y="4" width="5" height="5"/><path d="M11 4l5 5M16 4l-5 5"/><rect x="6" y="13" width="5" height="5"/><path d="M6 13l5 5M11 13l-5 5"/>'),
  /* CONSEQUENCE: blacklisted jobs cannot be claimed at all, and eventually expire (job:lost). */
  detect(S, api) {
    const G = S._g;
    if (G.blFrac < 0.35 || !G.open.length) return;
    let at = null;
    for (let i = 0; i < G.open.length; i++) {
      const j = G.open[i];
      if (!(S.bl[j.value] > S.tick)) continue;
      j.neglect += 1; at = at || { x: j.x, y: j.y };
      if (j.neglect > 300) api.loseJob(j, 'Cs');
    }
    api.heat(0.04, { at: at || { x: G.cx, y: G.cy }, who: [], say: FZ.copy.fire.Cs });
  },
  counteredBy(S) { return S.ledgerOn; },
});

fzElDef({
  sym: 'Hi', nm: 'Hidden information', col: 2, row: 2, chapter: 6, counterTool: 'lens',
  glyph: fzG('<path d="M2 7h16"/><rect x="5" y="9" width="10" height="9"/><path d="M8 11.5l4 4M12 11.5l-4 4"/>'),
  /* CONSEQUENCE: the approaching victims take the poison hit immediately — the knower could have stopped it. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.hidden.length; i++) {
      const h = G.hidden[i];
      if (!h.knowers.length || h.victims.length < 2) continue;
      for (let k = 0; k < h.victims.length; k++) api.poison(api.agentById(h.victims[k]), h.j);
      hot += 0.35; who = h.knowers.concat(h.victims); at = { x: h.j.x, y: h.j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Hi });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Tc', nm: 'Trust miscalibration', col: 2, row: 3, chapter: 5, counterTool: 'ledger',
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
  sym: 'Di', nm: 'Discovery ignored', col: 2, row: 4, chapter: 6, counterTool: 'lens',
  glyph: fzG('<circle cx="10" cy="10" r="2.4"/><path d="M10 6.5V4M13 7.5l1.8-1.8M7 7.5L5.2 5.7"/><path d="M2 16.5h4M14 16.5h4"/><path d="M5 14.5l2 2-2 2M15 14.5l-2 2 2 2"/>'),
  /* CONSEQUENCE: the undiscovered prize loses a point of value every time this fires. It rots unclaimed. */
  detect(S, api) {
    const G = S._g, j = G.maxJob;
    if (!j || j.value < 3) { return; }
    if (j.knownBy !== 1) { j.soloRun = 0; return; }
    j.soloRun++;
    if (j.soloRun < 120) return;
    j.soloRun = 0;
    if (j.value > 1) { j.value -= 1; j.need = Math.max(30, j.need - 18); }
    api.heat(0.4, { at: { x: j.x, y: j.y }, who: [], say: FZ.copy.fire.Di });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Rp', nm: 'No reputation', col: 2, row: 5, chapter: 5, counterTool: 'ledger',
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
  sym: 'Tw', nm: 'Turf war', col: 3, row: 0, chapter: 7, counterTool: 'charter',
  glyph: fzG('<circle cx="3" cy="10" r="2"/><circle cx="17" cy="10" r="2"/><rect x="7" y="7" width="6" height="6"/><path d="M10 2v4M10 14v4"/>'),
  /* CONSEQUENCE: freezes the job outright (no progress possible) and stuns both rivals. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (!e.riv || e.work < 2) continue;
      if (FZ.elh.cover(S, e.j.x, e.j.y)) continue;
      if (e.j.progress > e.j.lastProg + 0.5) { e.j.stall = 0; e.j.lastProg = e.j.progress; continue; }
      e.j.stall = (e.j.stall || 0) + 1;
      if (e.j.stall < 60) continue;
      e.j.frozen = S.tick + 80; e.j.stall = 0;
      for (let k = 0; k < e.ids.length; k++) { const a = api.agentById(e.ids[k]); if (a) a.stun = Math.max(a.stun, 32); }
      hot += 0.45; who = e.ids; at = { x: e.j.x, y: e.j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Tw });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5 || S._g.rivN === 0; },
});

fzElDef({
  sym: 'Sa', nm: 'Sabotage', col: 3, row: 1, chapter: 7, counterTool: 'eject',
  glyph: fzG('<rect x="4" y="3" width="12" height="9"/><path d="M4 8h12"/><path d="M10 13v5"/><path d="M7.5 15.5L10 18l2.5-2.5"/>'),
  /* CONSEQUENCE: rolls back a job you already banked — jobsDone goes DOWN and job:lost fires. */
  detect(S, api) {
    const G = S._g;
    if (!G.adv.length) return;
    let hot = 0, who = null, at = null;
    for (let i = 0; i < G.adv.length; i++) {
      const a = G.adv[i];
      if (!a.drained || a.drained < 22) continue;
      a.drained = 0;
      hot += 0.4; who = [a.id]; at = { x: a.x, y: a.y };
      if (S.jobsDone > 0 && api.rand() < 0.55) {
        S.jobsDone--; S.collapse += 1.4;
        api.bus('job:lost', { x: a.x, y: a.y, why: 'Sa' });
      }
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Sa });
  },
  counteredBy(S) { return S._g.adv.length === 0; },
});

fzElDef({
  sym: 'Lo', nm: 'Lock-in', col: 3, row: 2, chapter: 2, counterTool: 'charter',
  glyph: fzG('<rect x="4" y="9" width="12" height="9"/><path d="M7 9V6.5a3 3 0 016 0V9"/>'),
  /* CONSEQUENCE: sets job.locked — no other worker may claim or touch that job until a charter breaks it. */
  detect(S, api) {
    const G = S._g; let hot = 0, who = null, at = null;
    for (let i = 0; i < G.n; i++) {
      const a = G.A[i];
      if (!a.locker || !a.hold.length) continue;
      const j = api.jobById(a.hold[0]);
      if (!j) continue;
      a.idleRun = (a.idleRun || 0) + 1;
      if (a.idleRun < 120) continue;
      if (FZ.elh.cover(S, j.x, j.y)) { j.locked = false; a.idleRun = 0; a.lockAt = 0; api.drop(a, j.id); continue; }
      j.locked = a.id; if (!a.lockAt) a.lockAt = S.tick;
      j.claims.forEach(id => { if (id !== a.id) { const o = api.agentById(id); if (o) api.drop(o, j.id); } });
      hot += 0.05; who = [a.id]; at = { x: j.x, y: j.y };
    }
    if (hot > 0) api.heat(hot, { at, who, say: FZ.copy.fire.Lo });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5; },
});

fzElDef({
  sym: 'My', nm: 'Myopia', col: 3, row: 3, chapter: 8, counterTool: 'lens',
  glyph: fzG('<circle cx="7" cy="9" r="5"/><path d="M11 13l5.5 5.5"/><rect x="5.5" y="7.5" width="3" height="3"/><rect x="13" y="1.5" width="5.5" height="5.5"/>'),
  /* CONSEQUENCE: the big prize loses a point of value every fire — the colony's ceiling drops permanently. */
  detect(S, api) {
    const G = S._g, j = G.maxJob;
    if (!j || j.value < 4 || S.pickN < 10) return;
    if (S.pickLow / S.pickN < 0.55) return;
    S.pickLow = 0; S.pickN = 0;
    if (j.value > 1) { j.value -= 1; j.need = Math.max(30, j.need - 18); }
    api.heat(0.42, { at: { x: j.x, y: j.y }, who: [], say: FZ.copy.fire.My });
  },
  counteredBy(S) { return S.lensOn; },
});

fzElDef({
  sym: 'Es', nm: 'Escalation', col: 3, row: 4, chapter: 7, counterTool: 'charter',
  glyph: fzG('<path d="M2 18h4v-4h4v-4h4V5"/><path d="M12 7.5L14 4l2 3.5"/>'),
  /* CONSEQUENCE: the rivals abandon all work, move at 1.8x chasing each other, and stun any bystander they hit. */
  detect(S, api) {
    const G = S._g;
    if (G.chaseN < 2) return;
    for (let i = 0; i < G.chasers.length; i++) {
      const a = api.agentById(G.chasers[i]);
      if (!a) continue;
      while (a.hold.length) api.drop(a, a.hold[0]);
      const t = api.agentById(a.chase);
      if (t) { t.stun = Math.max(t.stun, 20); api.bus('agent:hurt', { id: t.id, x: t.x, y: t.y }); }
    }
    const f = api.agentById(G.chasers[0]);
    api.heat(0.06, { at: f ? { x: f.x, y: f.y } : null, who: G.chasers, say: FZ.copy.fire.Es });
  },
  counteredBy(S) { return FZ.elh.coverFrac(S) >= 0.5 || S._g.rivN === 0; },
});

fzElDef({
  sym: 'Cr', nm: 'Corrigibility failure', col: 3, row: 5, chapter: 7, counterTool: 'eject',
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
  sym: 'Mo', nm: 'Monoculture', col: 4, row: 0, chapter: 4, counterTool: 'vary',
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
  sym: 'In', nm: 'Institution gap', col: 4, row: 1, chapter: 2, counterTool: 'charter',
  glyph: fzG('<path d="M2 6V2h4M14 2h4v4M18 14v4h-4M6 18H2v-4"/>'),
  /* CONSEQUENCE: suspends all arbitration — contested claims stop yielding AND contested jobs stop advancing. */
  detect(S, api) {
    const G = S._g;
    if (S.charters.length) return;
    let n = 0, at = null, who = null;
    for (let i = 0; i < G.clList.length; i++) {
      const e = G.clList[i];
      if (e.n < 2) continue;
      n++; at = { x: e.j.x, y: e.j.y }; who = e.ids;
    }
    if (!n) return;
    S.noArb = S.tick + 200;
    api.heat(0.04 * Math.min(3, n), { at, who, say: FZ.copy.fire.In });
  },
  counteredBy(S) { return S.charters.length > 0; },
});

fzElDef({
  sym: 'Sp', nm: 'Machine speed', col: 4, row: 2, chapter: 8, counterTool: 'slow',
  glyph: fzG('<path d="M4 4l5 6-5 6M11 4l5 6-5 6"/><path d="M1 7h2M1 13h2"/>'),
  /* CONSEQUENCE: sets S.tempo above 1, which multiplies the heat gain of EVERY other element and speeds the colony. */
  detect(S, api) {
    const G = S._g;
    if (S.speedMul < 1.35) return;
    api.heat(0.03 * S.speedMul, { at: { x: G.cx, y: G.cy }, who: [], say: FZ.copy.fire.Sp });
  },
  counteredBy(S) { return FZ.elh.slowed(S); },
});

fzElDef({
  sym: 'Mm', nm: 'Missing mental models', col: 4, row: 3, chapter: 6, counterTool: 'lens',
  glyph: fzG('<circle cx="5" cy="15" r="2.4"/><path d="M7.5 12.5l1.5-1.5"/><rect x="9" y="2" width="9" height="8" stroke-dasharray="2 2"/>'),
  /* CONSEQUENCE: sets S.blind — workers pick jobs without seeing existing claims, manufacturing collisions. */
  detect(S, api) {
    const G = S._g;
    if (S.lensOn) return;
    let contested = 0;
    for (let i = 0; i < G.clList.length; i++) if (G.clList[i].n >= 2) contested++;
    if (!contested && !G.hidden.length) return;
    S.blind = 1;
    const e = G.clList.find(z => z.n >= 2);
    api.heat(0.03 + 0.012 * contested, { at: e ? { x: e.j.x, y: e.j.y } : { x: G.cx, y: G.cy }, who: e ? e.ids : [], say: FZ.copy.fire.Mm });
  },
  counteredBy(S) { return S.lensOn; },
});

/* Table order: rows first, so a naive 5-column grid walk of FZ.EL lays out correctly.
   Every element also carries explicit col/row if the table prefers to place them. */
FZ.EL.sort(function (a, b) { return (a.row - b.row) || (a.col - b.col); });
