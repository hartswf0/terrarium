/* ============================================================
   40-sim.js — the colony.  OWNER: SIM.
   Touches no DOM, no canvas. Deterministic per seed. Never calls Math.random.

   ------------------------------------------------------------
   THE `force` VOCABULARY  (read this before writing a scenario)
   ------------------------------------------------------------
   `force` is the guarantee layer. A teaching chapter sets force keys so its lesson
   HAPPENS, early and visibly, instead of waiting on luck. Every key below is a boolean
   unless a number is shown. Times are in ticks (the rAF loop runs one tick per frame,
   so ~60 ticks per second at speed 1).

   force.coordination   Claim range is unlimited and, every ~200 ticks, two workers on
                        opposite sides of the field are handed the SAME job. Guarantees
                        Co within ~60 ticks, and Mc soon after. Also lights In and Mm.
   force.stampede       copyBias starts at 0.85: workers pick whatever is most claimed.
                        Guarantees Cf, then Fl (six-plus on one square), then Im.
   force.poison         force.poisonN (default 1) jobs are poison for the majority
                        lineage and unrevealed. With force.monoculture this guarantees
                        Sf within ~250 ticks; it also feeds Cs (the colony overgeneralises).
   force.rumor          One worker is a liar. Every force.lieEvery ticks (default 620) it
                        invents a job that does not exist. Guarantees Gu, then Tc, then Rp.
   force.saboteur       force.advN (default 1) adversaries walk to the most-finished job
                        and drain it. Guarantees Sa; Sa rolls back a BANKED job.
   force.lock           force.lockN (default 2) workers claim a job and never work it.
                        Guarantees Lo within ~140 ticks.
   force.dependency     Half the jobs get an unfinished prerequisite job. Guarantees Dp.
   force.monoculture    Every worker is one lineage. Guarantees Mo and Lv immediately.
   force.silo           Knowledge sharing is off and awareness radius is 90px, so most of
                        the colony never hears about most jobs. Guarantees Si and Di.
   force.hidden         One worker is told which job is poison and never tells anyone.
                        Guarantees Hi (its victims take the hit it could have prevented).
   force.overload       Workers may hold up to 5 jobs at once. Guarantees Ow.
   force.rivals         force.rivalN (default 2) rival pairs chase each other's claims.
                        Guarantees Tw, then Es once they stop working and start chasing.
   force.incorrigible   force.incN (default 1) workers ignore charter, slow and vary.
                        Guarantees Cr the moment you use a tool near one.
   force.myopia         Workers score jobs by nearness and ignore value. Guarantees My and Pt.
   force.churn          Two workers ping-pong one claim every ~18 ticks. Guarantees Cl.
   force.speed          Speed ramps from cfg.speed to force.speedmax (default 2.4) over
                        force.speedrate ticks (default 2200). Guarantees Sp.
   force.dark           Suppresses any pre-applied lens. Mm fires whenever the lens is off
                        and anything at all is contested, so force.dark + any contest = Mm.
   force.drift          Every 2600 ticks two workers drift to the majority lineage. This is
                        what makes the sandbox re-enter monoculture if you stop spending VARY.

   Numeric knobs: force.poisonN force.advN force.lockN force.rivalN force.incN
                  force.lieEvery force.speedmax force.speedrate force.pairEvery

   ------------------------------------------------------------
   THINGS OTHER PARTS MAY WANT TO KNOW
   ------------------------------------------------------------
   S.strainTop  [{sym, amt}] — the top contributors to this tick's strain rise. The strain
                meter must always be locatable; this is where you locate it.
   S.tempo      the live speed multiplier after SLOW. Every heat gain is scaled by it.
   Charters DECAY: radius shrinks slowly, and an institution nobody renews disappears.
   Elements are enabled cumulatively: everything with el.chapter <= this chapter index,
   union cfg.teach. cfg.all (or chapter 9) enables all twenty-eight.
   ============================================================ */
window.FZ = window.FZ || {};

/* ---- seeded RNG (xorshift32) ---- */
function fzRng(seed) {
  let s = (seed >>> 0) || 2463534242;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

FZ.sim = (function () {

  const S = {
    tick: 0, jobsDone: 0, jobsGoal: 3, budget: 6, collapse: 0, collapseMax: 100,
    speedMul: 1, tempo: 1, lensOn: false, ledgerOn: false, slowUntil: 0,
    gameOver: false, won: false,
    agents: [], jobs: [], charters: [], rumor: null,
    w: 360, h: 430,
    /* ---- SIM-internal (other parts may read, must not write) ---- */
    tools: [], id: 'boot', force: {}, seed: 1, chapterIndex: 0, narrator: '',
    lensUntil: 0, ledgerUntil: 0, varyUntil: 0, noArb: 0, exploreBlock: 0,
    copyBias: 0, copyN: 0, choiceN: 0, pickLow: 0, pickN: 0, imRun: 0,
    varMul: 1, monoMul: 1, blind: 0, trust: {}, bl: {}, hurts: [],
    strainTop: [], nextJob: 1, spawnEvery: 0, spawnAt: 0, maxJobs: 5,
    _g: null, _silent: false,
  };

  let rnd = fzRng(1);
  const EL = () => FZ.EL;

  /* ---------------- small utilities ---------------- */
  function emit(n, d) { if (!S._silent) FZ.bus.emit(n, d); }
  function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function d2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function agentById(id) { const A = S.agents; for (let i = 0; i < A.length; i++) if (A[i].id === id) return A[i]; return null; }
  function jobById(id) { const J = S.jobs; for (let i = 0; i < J.length; i++) if (J[i].id === id) return J[i]; return null; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------------- claims ---------------- */
  function claim(a, j) {
    if (!a || !j || j.done) return false;
    if (j.locked !== false && j.locked !== a.id) return false;
    if (a.hold.indexOf(j.id) > -1) return false;
    const cap = S.force.overload ? 5 : 1;
    while (a.hold.length >= cap) drop(a, a.hold[0]);
    a.hold.push(j.id); a.job = a.hold[0];
    j.claims.add(a.id);
    if (S.tick - j.churnAt > 200) { j.churn = 0; j.churnAt = S.tick; }
    j.churn++;
    S.pickN++; if (j.value <= 2) S.pickLow++;
    return true;
  }
  function drop(a, jid) {
    if (!a) return;
    const k = a.hold.indexOf(jid);
    if (k > -1) a.hold.splice(k, 1);
    a.job = a.hold.length ? a.hold[0] : null;
    const j = jobById(jid);
    if (j) j.claims.delete(a.id);
  }
  function nearestOpen(x, y) {
    let best = null, bd = Infinity;
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i]; if (j.done) continue;
      const q = d2(x, y, j.x, j.y);
      if (q < bd) { bd = q; best = j; }
    }
    return best;
  }

  /* ---------------- losses and hurts ---------------- */
  function loseJob(j, why) {
    if (!j || j.done) return;
    j.done = true;
    j.claims.forEach(id => { const a = agentById(id); if (a) drop(a, j.id); });
    j.claims.clear();
    S.collapse += 2.0;
    emit('job:lost', { x: j.x, y: j.y, why: why });
  }
  function poison(a, j) {
    if (!a || !j || a.stun > 0) return;
    if (S.tick < (a.pcool || 0)) return;
    a.pcool = S.tick + 120;
    a.stun = Math.max(a.stun, Math.round(55 * S.varMul * S.monoMul));
    a.flash = 12;
    S.hurts.push({ hue: a.hue, t: S.tick, id: a.id });
    if (S.hurts.length > 40) S.hurts.shift();
    S.collapse += 0.7 * S.varMul;
    while (a.hold.length) drop(a, a.hold[0]);
    if (rnd() < 0.5 && !S.ledgerOn) S.bl[j.value] = true;
    emit('agent:hurt', { id: a.id, x: a.x, y: a.y });
  }
  function spawnRumor(liar) {
    const x = 30 + rnd() * (S.w - 60), y = 30 + rnd() * (S.h - 60);
    S.rumor = { x: x, y: y, until: S.tick + 620 };
    if (liar) liar.lies++;
    S.agents.forEach(a => { a.chaseRumor = false; });
  }

  /* ---------------- world construction ---------------- */
  function makeJob(cfg, i) {
    const F = S.force;
    const v = 1 + Math.floor(rnd() * (cfg.max || 3));
    const j = {
      id: S.nextJob++,
      x: 34 + rnd() * (S.w - 68), y: 34 + rnd() * (S.h - 68),
      value: v, progress: 0, need: 40 + v * 22,
      claims: new Set(), poison: false, revealed: false, victimHue: -1,
      prereq: null, locked: false, flash: 0,
      done: false, age: 0, stale: 0, neglect: 0, churn: 0, churnAt: 0,
      soloRun: 0, lastProg: 0, stall: 0, frozen: 0, knownBy: 0,
    };
    return j;
  }

  function reset(cfg) {
    cfg = cfg || {};
    S.id = cfg.id || 'sandbox';
    S.force = cfg.force || {};
    S.seed = cfg.seed == null ? 1234 : cfg.seed;
    rnd = fzRng(S.seed);
    const F = S.force;

    S.tick = 0; S.jobsDone = 0; S.gameOver = false; S.won = false;
    S.charters.length = 0; S.rumor = null; S.hurts.length = 0;
    S.trust = {}; S.bl = {}; S.strainTop = [];
    S.lensUntil = 0; S.ledgerUntil = 0; S.slowUntil = 0; S.varyUntil = 0;
    S.lensOn = false; S.ledgerOn = false;
    S.noArb = 0; S.exploreBlock = 0; S.imRun = 0;
    S.copyN = 0; S.choiceN = 0; S.pickLow = 0; S.pickN = 0;
    S.varMul = 1; S.monoMul = 1; S.blind = 0;
    S.copyBias = F.stampede ? 0.85 : 0.06;
    S.budget = cfg.budget == null ? 6 : cfg.budget;
    S.collapse = 0;
    S.collapseMax = cfg.collapseMax == null ? 100 : cfg.collapseMax;
    S.speedMul = cfg.speed || 1; S.baseSpeed = S.speedMul; S.tempo = S.speedMul;
    S.tools = (cfg.tools || []).slice();
    S.jobsGoal = (cfg.goal && cfg.goal.jobs) || 0;
    S.surviveGoal = (cfg.goal && cfg.goal.survive) || 0;
    S.nextJob = 1;

    /* --- chapter index and the enabled set --- */
    let idx = cfg.chapter;
    if (idx == null) { const m = /^ch(\d+)$/.exec(S.id); idx = m ? +m[1] : 9; }
    S.chapterIndex = idx;
    const en = new Set();
    const all = cfg.all || idx >= 9;
    FZ.EL.forEach(e => { if (all || (e.chapter != null && e.chapter <= idx)) en.add(e.sym); });
    (cfg.teach || []).forEach(s => en.add(s));
    FZ.sim.enabled = en;

    /* --- jobs --- */
    const jc = cfg.jobs || {};
    S.maxJobs = jc.max || 5;
    S.spawnEvery = jc.spawnEvery || 0;
    S.spawnAt = S.tick + S.spawnEvery;
    S.jobs.length = 0;
    const n = jc.n == null ? 4 : jc.n;
    for (let i = 0; i < n; i++) S.jobs.push(makeJob(jc, i));

    /* --- agents --- */
    const ac = cfg.agents || {};
    const an = ac.n == null ? 10 : ac.n;
    const hues = F.monoculture ? [0] : (ac.hues && ac.hues.length ? ac.hues : [0, 1, 2, 3]);
    S.agents.length = 0;
    for (let i = 0; i < an; i++) {
      S.agents.push({
        id: i + 1,
        x: 20 + rnd() * (S.w - 40), y: 20 + rnd() * (S.h - 40),
        vx: 0, vy: 0, hue: hues[i % hues.length],
        job: null, hold: [], stun: 0, flash: 0, known: new Set(),
        corrigible: true, adversary: false, rival: null, locker: false,
        colluder: false, myopic: !!F.myopia, esc: 0,
        liar: false, lies: 0, chase: null, chaseRumor: false, churner: false,
        pk: null, drained: 0, idleRun: 0, pcool: 0, tx: 0, ty: 0,
      });
    }
    const A = S.agents;
    const roles = ac.roles || {};
    const pick = (k, seen) => { let out = []; for (let i = 0; i < k && i < A.length; i++) out.push(A[A.length - 1 - i]); return out; };

    if (F.saboteur || roles.adversary) {
      const k = F.advN || roles.adversary || 1;
      for (let i = 0; i < k && i < A.length; i++) { A[i].adversary = true; A[i].corrigible = false; }
    }
    if (F.incorrigible || roles.incorrigible) {
      const k = F.incN || roles.incorrigible || 1;
      for (let i = 0; i < k && i < A.length; i++) A[A.length - 1 - i].corrigible = false;
    }
    if (F.rivals || roles.rivals) {
      const k = F.rivalN || roles.rivals || 2;
      for (let i = 0; i < k; i++) {
        const p = A[2 + i * 2], q = A[3 + i * 2];
        if (p && q) { p.rival = q.id; q.rival = p.id; }
      }
    }
    if (F.lock || roles.locker) {
      const k = F.lockN || roles.locker || 2;
      for (let i = 0; i < k; i++) { const a = A[1 + i]; if (a) a.locker = true; }
    }
    if (roles.colluders) for (let i = 0; i < roles.colluders && i < A.length; i++) A[i].colluder = true;
    if (F.churn) { if (A[4]) A[4].churner = true; if (A[5]) A[5].churner = true; }
    if (F.rumor) { const a = A[A.length - 1]; if (a) { a.liar = true; S.trust[a.id] = 1; spawnRumor(null); } }

    /* --- poison --- */
    const pn = F.poison ? (F.poisonN || 1) : (jc.poison || 0);
    let topHue = 0, tally = {};
    A.forEach(a => { tally[a.hue] = (tally[a.hue] || 0) + 1; });
    for (const k in tally) if (tally[k] > (tally[topHue] || 0)) topHue = +k;
    for (let i = 0; i < pn && i < S.jobs.length; i++) {
      const j = S.jobs[i]; j.poison = true; j.victimHue = topHue; j.revealed = false;
    }
    if (F.hidden) {
      const a = A[0];
      if (a) { a.pk = new Set(); S.jobs.forEach(j => { if (j.poison) a.pk.add(j.id); }); }
    }

    /* --- dependencies --- */
    if (F.dependency || (jc.prereq)) {
      for (let i = 1; i < S.jobs.length; i += 2) S.jobs[i].prereq = S.jobs[i - 1].id;
    }

    /* --- who knows what --- */
    const aware = F.silo ? 90 : 1e6;
    A.forEach(a => {
      a.known.clear();
      S.jobs.forEach(j => { if (d2(a.x, a.y, j.x, j.y) < aware * aware) a.known.add(j.id); });
      if (!a.known.size && S.jobs.length) a.known.add(S.jobs[Math.floor(rnd() * S.jobs.length)].id);
    });

    /* --- elements --- */
    FZ.EL.forEach(e => { e.heat = 0; e.fires = 0; e.peak = 0; e.on = false; e.countered = false; e.who = []; });

    aggregate();
    return S;
  }

  /* ---------------- per-tick aggregate (built once, read by all 28) ---------------- */
  function aggregate() {
    const A = S.agents, J = S.jobs;
    const G = {
      A: A, n: A.length, cx: S.w / 2, cy: S.h / 2,
      hueDistinct: 0, topHue: 0, topHueFrac: 0, topHueIds: [],
      clList: [], open: [], maxJob: null, maxV: 0,
      workedVsum: 0, workedN: 0,
      rumorN: 0, rumorIds: [], liar: null,
      adv: [], inc: [], rivN: 0, chaseN: 0, chasers: [],
      hidden: [], blFrac: 0,
      targetTop: 0, targetTopN: 0, targetTopIds: [],
    };
    /* hues */
    const hc = {};
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      hc[a.hue] = (hc[a.hue] || 0) + 1;
      if (a.adversary) G.adv.push(a);
      if (!a.corrigible && !a.adversary) G.inc.push(a);
      if (a.rival != null) G.rivN++;
      if (a.chase != null) { G.chaseN++; G.chasers.push(a.id); }
      if (a.liar) G.liar = a;
      if (a.chaseRumor && S.rumor) { G.rumorN++; G.rumorIds.push(a.id); }
    }
    let best = -1;
    for (const k in hc) { G.hueDistinct++; if (hc[k] > best) { best = hc[k]; G.topHue = +k; } }
    G.topHueFrac = A.length ? best / A.length : 0;
    for (let i = 0; i < A.length; i++) if (A[i].hue === G.topHue) G.topHueIds.push(A[i].id);

    /* jobs, claims, targets */
    const tgt = {}, tids = {};
    let blOpen = 0;
    for (let i = 0; i < J.length; i++) {
      const j = J[i]; if (j.done) continue;
      G.open.push(j);
      if (S.bl[j.value]) blOpen++;
      if (j.value > G.maxV) { G.maxV = j.value; G.maxJob = j; }
      j.knownBy = 0;
      for (let k = 0; k < A.length; k++) if (A[k].known.has(j.id)) j.knownBy++;
      if (j.claims.size) {
        const ids = [], hues = {};
        let hn = 0, work = 0, riv = false, minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
        j.claims.forEach(id => {
          const a = agentById(id); if (!a) return;
          ids.push(id);
          if (!hues[a.hue]) { hues[a.hue] = 1; hn++; }
          if (a.stun <= 0 && !a.locker && d2(a.x, a.y, j.x, j.y) < 18 * 18) work++;
          if (a.x < minx) minx = a.x; if (a.x > maxx) maxx = a.x;
          if (a.y < miny) miny = a.y; if (a.y > maxy) maxy = a.y;
          if (a.rival != null && j.claims.has(a.rival)) riv = true;
          G.workedVsum += j.value; G.workedN++;
        });
        const spread = ids.length > 1 ? Math.sqrt((maxx - minx) * (maxx - minx) + (maxy - miny) * (maxy - miny)) : 0;
        G.clList.push({ j: j, ids: ids, n: ids.length, hues: hues, hn: hn, work: work, riv: riv, far: spread > 130 });
        const c = (tgt[j.id] = (tgt[j.id] || 0) + ids.length);
        (tids[j.id] || (tids[j.id] = [])).push.apply(tids[j.id], ids);
        if (c > G.targetTopN) { G.targetTopN = c; G.targetTop = j.id; G.targetTopIds = tids[j.id]; }
      }
      if (j.poison && !j.revealed) {
        const knowers = [], victims = [];
        for (let k = 0; k < A.length; k++) {
          const a = A[k];
          if (a.pk && a.pk.has(j.id)) { knowers.push(a.id); continue; }
          if (a.hue === j.victimHue && a.hold.indexOf(j.id) > -1) victims.push(a.id);
        }
        G.hidden.push({ j: j, knowers: knowers, victims: victims });
      }
    }
    G.blFrac = G.open.length ? blOpen / G.open.length : 0;
    S._g = G;
    return G;
  }

  /* ---------------- decision ---------------- */
  function decide(a) {
    S.choiceN++;
    if (S.choiceN > 400) { S.choiceN = 200; S.copyN = Math.round(S.copyN / 2); }

    /* a rumor is a job that does not exist; credulity is trust, scaled by the ledger */
    if (S.rumor && !a.liar && !a.chaseRumor) {
      const t = S.trust[S.rumor.by] == null ? 1 : S.trust[S.rumor.by];
      const p = 0.5 * t * (S.ledgerOn ? 0.08 : 1);
      if (rnd() < p) { a.chaseRumor = true; while (a.hold.length) drop(a, a.hold[0]); return; }
    }
    /* rivals want what their rival wants; once escalated they want their rival */
    if (a.rival != null) {
      const r = agentById(a.rival);
      if (r) {
        if (a.esc > 3) { a.chase = r.id; while (a.hold.length) drop(a, a.hold[0]); return; }
        if (r.hold.length && rnd() < 0.8) {
          const j = jobById(r.hold[0]);
          if (j && claim(a, j)) { a.esc++; return; }
        }
      }
    }
    /* copying is cheap */
    const cands = [];
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i];
      if (j.done) continue;
      if (!S.lensOn && !a.known.has(j.id)) continue;
      if (S.bl[j.value] && !S.ledgerOn) continue;
      if (j.locked !== false && j.locked !== a.id) continue;
      if (S.lensOn && j.prereq) { const p = jobById(j.prereq); if (p && !p.done) continue; }
      if (S.lensOn && j.poison && a.hue === j.victimHue) continue;
      cands.push(j);
    }
    if (!cands.length) return;

    if (rnd() < S.copyBias) {
      let best = null, bc = -1;
      for (let i = 0; i < cands.length; i++) if (cands[i].claims.size > bc) { bc = cands[i].claims.size; best = cands[i]; }
      if (best && bc > 0) { S.copyN++; a.copied = true; claim(a, best); return; }
    }
    a.copied = false;
    let best = null, bs = -1;
    for (let i = 0; i < cands.length; i++) {
      const j = cands[i];
      const d = Math.sqrt(d2(a.x, a.y, j.x, j.y));
      const val = a.myopic ? 1 : (S.lensOn ? j.value * 1.6 : j.value);
      const crowd = (S.blind && !S.lensOn) ? 1 : 1 / (1 + j.claims.size * 1.5);
      const sc = (val / (1 + d * 0.02)) * crowd * (0.85 + rnd() * 0.3);
      if (sc > bs) { bs = sc; best = j; }
    }
    if (best) claim(a, best);
  }

  /* ---------------- one tick ---------------- */
  function step() {
    if (S.gameOver) return;
    const F = S.force;
    S.tick++;

    /* derived speed / tools */
    S.lensOn = S.tick < S.lensUntil;
    S.ledgerOn = S.tick < S.ledgerUntil;
    const slowed = S.tick < S.slowUntil;
    if (F.speed) S.speedMul = Math.min(F.speedmax || 2.4, S.baseSpeed + S.tick / (F.speedrate || 2200));
    S.tempo = S.speedMul * (slowed ? 0.5 : 1);
    const T = S.tempo;
    S.varMul = 1; S.monoMul = 1; S.blind = 0;   /* detectors re-raise these each tick */

    /* institutions decay unless renewed */
    for (let i = S.charters.length - 1; i >= 0; i--) {
      const c = S.charters[i];
      c.r -= 0.018 * T;
      if (c.r < 22) S.charters.splice(i, 1);
    }

    /* the liar keeps lying */
    if (F.rumor) {
      const L = S._g && S._g.liar;
      if (S.rumor && S.tick > S.rumor.until) { S.rumor = null; S.agents.forEach(a => a.chaseRumor = false); }
      if (!S.rumor && L && S.tick % (F.lieEvery || 620) === 0) { spawnRumor(L); S.rumor.by = L.id; }
      if (S.ledgerOn && L && L.lies > 0) S.trust[L.id] = 0.06;
    }

    /* forced coordination pairs: the guarantee behind chapter 1 */
    if (F.coordination && S.tick % (F.pairEvery || 200) === 40) {
      const open = S.jobs.filter(j => !j.done);
      if (open.length) {
        const j = open[Math.floor(rnd() * open.length)];
        const A = S.agents.filter(a => a.stun <= 0 && !a.adversary && !a.locker);
        if (A.length >= 2) {
          A.sort((p, q) => (p.x + p.y) - (q.x + q.y));
          claim(A[0], j); claim(A[A.length - 1], j);
        }
      }
    }
    /* lineage drift: the sandbox slides back into monoculture if you stop paying for variance */
    if (F.drift && S.tick % 2600 === 0 && S._g) {
      const top = S._g.topHue;
      for (let i = 0, k = 0; i < S.agents.length && k < 2; i++) if (S.agents[i].hue !== top) { S.agents[i].hue = top; k++; }
    }

    /* ---- agents ---- */
    const A = S.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.flash > 0) a.flash--;
      if (a.stun > 0) { a.stun -= T; continue; }

      /* churners exist to make the livelock visible */
      if (a.churner && S.tick % 18 === 0) {
        if (a.hold.length) drop(a, a.hold[0]);
        else { const j = nearestOpen(a.x, a.y); if (j) claim(a, j); }
      }

      if (!a.hold.length && !a.chaseRumor && a.chase == null) decide(a);
      else if (rnd() < 0.004 * T) decide(a);

      /* learn about nearby work */
      if (S.tick >= S.exploreBlock) {
        const aware = F.silo ? 90 : 150;
        for (let k = 0; k < S.jobs.length; k++) {
          const j = S.jobs[k];
          if (!j.done && !a.known.has(j.id) && d2(a.x, a.y, j.x, j.y) < aware * aware) a.known.add(j.id);
        }
        if (S.lensOn) for (let k = 0; k < S.jobs.length; k++) if (!S.jobs[k].done) a.known.add(S.jobs[k].id);
      }

      /* target */
      let tx = a.x, ty = a.y, chasing = false;
      if (a.chaseRumor && S.rumor) { tx = S.rumor.x; ty = S.rumor.y; }
      else if (a.chase != null) {
        const t = agentById(a.chase);
        if (t) { tx = t.x; ty = t.y; chasing = true; } else a.chase = null;
      } else if (a.adversary) {
        let bj = null, bp = -1;
        for (let k = 0; k < S.jobs.length; k++) { const j = S.jobs[k]; if (!j.done && j.progress > bp) { bp = j.progress; bj = j; } }
        if (bj) { tx = bj.x; ty = bj.y; }
      } else if (a.hold.length) {
        const j = jobById(a.hold[0]);
        if (j && !j.done) { tx = j.x; ty = j.y; } else drop(a, a.hold[0]);
      } else { tx = a.x + (rnd() - 0.5) * 60; ty = a.y + (rnd() - 0.5) * 60; }

      const dx = tx - a.x, dy = ty - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const sp = 2.1 * T * (chasing ? 1.8 : 1);
      if (d > 3) { a.vx = dx / d * sp; a.vy = dy / d * sp; a.x += a.vx; a.y += a.vy; }
      else { a.vx = a.vy = 0; }
      a.x = clamp(a.x, 8, S.w - 8); a.y = clamp(a.y, 8, S.h - 8);

      /* adversaries drain the most finished thing they can reach */
      if (a.adversary) {
        const j = nearestOpen(a.x, a.y);
        if (j && d2(a.x, a.y, j.x, j.y) < 20 * 20 && j.progress > 0) {
          const amt = Math.min(j.progress, 1.7 * T);
          j.progress -= amt; a.drained = (a.drained || 0) + amt;
        }
      }
    }

    /* knowledge spreads between neighbours, unless siloed */
    if (!F.silo && S.tick >= S.exploreBlock && A.length > 1) {
      const reps = S.monoMul > 1 ? 1 : 2;
      for (let r = 0; r < reps; r++) {
        const p = A[Math.floor(rnd() * A.length)], q = A[Math.floor(rnd() * A.length)];
        if (p !== q && d2(p.x, p.y, q.x, q.y) < 80 * 80) {
          const arr = Array.from(p.known);
          if (arr.length) q.known.add(arr[Math.floor(rnd() * arr.length)]);
        }
      }
    }

    /* ---- arbitration ---- */
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i];
      if (j.done) continue;
      j.age++;
      if (j.flash > 0) j.flash--;
      const inC = FZ.elh.cover(S, j.x, j.y);
      if (inC) {
        j.locked = false;
        if (j.claims.size > 1) {
          let keep = null, bd = Infinity;
          j.claims.forEach(id => {
            const a = agentById(id); if (!a) return;
            if (!a.corrigible) return;                    /* Cr: the charter does not reach it */
            const q = d2(a.x, a.y, j.x, j.y);
            if (q < bd) { bd = q; keep = a.id; }
          });
          if (keep != null) j.claims.forEach(id => {
            if (id === keep) return;
            const a = agentById(id);
            if (a && a.corrigible) drop(a, j.id);
          });
        }
      } else if (j.claims.size > 1 && S.tick >= S.noArb && rnd() < 0.004 * T) {
        let keep = null, bd = Infinity;
        j.claims.forEach(id => { const a = agentById(id); if (!a) return; const q = d2(a.x, a.y, j.x, j.y); if (q < bd) { bd = q; keep = a.id; } });
        j.claims.forEach(id => { if (id !== keep) { const a = agentById(id); if (a) drop(a, j.id); } });
      }
    }

    /* ---- work ---- */
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i];
      if (j.done || S.tick < j.frozen) continue;
      let workers = 0, victims = null;
      j.claims.forEach(id => {
        const a = agentById(id);
        if (!a || a.stun > 0 || a.locker) return;
        if (d2(a.x, a.y, j.x, j.y) > 18 * 18) return;
        workers++;
        if (j.poison && !j.revealed && a.hue === j.victimHue) (victims || (victims = [])).push(a);
      });
      if (victims) { for (let k = 0; k < victims.length; k++) poison(victims[k], j); continue; }
      if (!workers) continue;
      /* duplicated effort does not add up: only one copy of the work lands */
      const contested = j.claims.size > 1 && !FZ.elh.cover(S, j.x, j.y);
      if (contested && S.tick < S.noArb) continue;              /* In: nothing arbitrates, nothing advances */
      const gain = (contested ? 1 : workers) * 1.0 * T;
      if (j.prereq) { const p = jobById(j.prereq); if (p && !p.done && !S.lensOn) continue; }
      j.progress += gain;
    }

    /* ---- aggregate, then the twenty-eight ---- */
    aggregate();
    runDetectors();

    /* ---- completion ---- */
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i];
      if (j.done || j.progress < j.need) continue;
      j.done = true; j.flash = 14;
      j.claims.forEach(id => { const a = agentById(id); if (a) drop(a, j.id); });
      j.claims.clear();
      S.jobsDone++;
      S.budget = Math.min(14, S.budget + 1);
      S.collapse = Math.max(0, S.collapse - 1.2);
      emit('job:done', { x: j.x, y: j.y, value: j.value });
    }
    /* ---- respawn ---- */
    S.jobs = S.jobs.filter(j => !j.done);
    if (S.spawnEvery && S.tick >= S.spawnAt && S.jobs.length < S.maxJobs) {
      S.spawnAt = S.tick + S.spawnEvery;
      const jc = { max: S.maxJobs };
      const nj = makeJob({ max: 5 }, 0);
      if (S.force.dependency && S.jobs.length) nj.prereq = S.jobs[0].id;
      if (S.force.poison && rnd() < 0.25) { nj.poison = true; nj.victimHue = S._g.topHue; }
      S.jobs.push(nj);
      const aw = S.force.silo ? 90 : 150;
      S.agents.forEach(a => { if (d2(a.x, a.y, nj.x, nj.y) < aw * aw) a.known.add(nj.id); });
    }

    /* ---- strain ---- */
    strain();

    /* ---- goal / loss ---- */
    if (!S.gameOver) {
      if (S.jobsGoal && S.jobsDone >= S.jobsGoal) { S.gameOver = true; S.won = true; emit('goal', { met: true }); }
      else if (S.surviveGoal && S.tick >= S.surviveGoal) { S.gameOver = true; S.won = true; emit('goal', { met: true }); }
      else if (S.collapse >= S.collapseMax) { S.gameOver = true; S.won = false; emit('lose', { why: strainWhy() }); }
      else if (S.agents.length === 0) { S.gameOver = true; S.won = false; emit('lose', { why: 'Mo' }); }
    }
  }

  /* ---------------- detectors ---------------- */
  const api = {
    rand: () => rnd(),
    tick: 0,
    dist: dist,
    jobById: jobById,
    agentById: agentById,
    bus: emit,
    loseJob: loseJob,
    drop: drop,
    claim: claim,
    poison: poison,
    spawnRumor: spawnRumor,
    nearestOpen: nearestOpen,
    heat: null,
  };

  function runDetectors() {
    const els = FZ.EL, en = FZ.sim.enabled;
    api.tick = S.tick;
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      if (!en.has(e.sym)) { e.heat = Math.max(0, e.heat - 0.02); continue; }
      e.countered = !!e.counteredBy(S);
      api.heat = mkHeat(e);
      e.detect(S, api);
      const cool = e.countered ? 0.032 : 0.004;
      e.heat = Math.max(0, e.heat - cool * (S.tempo || 1));
      if (e.heat > e.peak) e.peak = e.heat;
      if (e.on && e.heat < 0.12) e.on = false;
    }
  }
  function mkHeat(e) {
    return function (amount, o) {
      o = o || {};
      const scale = (e.countered ? 0.18 : 1) * (S.tempo || 1);
      e.heat = Math.min(1, e.heat + amount * scale);
      if (o.who) e.who = o.who;
      if (!e.on && e.heat >= 0.35) {
        e.on = true; e.fires++;
        emit('fire', {
          sym: e.sym,
          at: o.at || { x: S.w / 2, y: S.h / 2 },
          who: o.who || [],
          say: o.say || (FZ.copy.fire || {})[e.sym] || '',
        });
      }
    };
  }

  /* ---------------- strain ---------------- */
  const METAW = { Mo: 1.5, In: 1.5, Sp: 1.5, Mm: 1.5 };
  function strain() {
    let load = 0;
    const top = [];
    const els = FZ.EL, en = FZ.sim.enabled;
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      if (!en.has(e.sym) || e.heat < 0.06) continue;
      const amt = e.heat * (METAW[e.sym] || 1);
      load += amt;
      top.push({ sym: e.sym, amt: amt });
    }
    top.sort((a, b) => b.amt - a.amt);
    S.strainTop = top.slice(0, 4);
    if (S.collapseMax !== Infinity) {
      S.collapse = Math.max(0, S.collapse + (load * 0.021 - 0.05) * (S.tempo || 1));
      if (S.collapse > S.collapseMax) S.collapse = S.collapseMax;
    }
  }
  function strainWhy() { return S.strainTop.length ? S.strainTop[0].sym : 'In'; }

  /* ---------------- interventions ---------------- */
  function cost(kind) { const t = (FZ.copy.tools || {})[kind]; return t && t.cost != null ? t.cost : 2; }

  function apply(kind, x, y) {
    const T = (FZ.copy.tools || {})[kind];
    if (!T || S.tools.indexOf(kind) < 0) return fail(kind, x, y, (FZ.copy.ui || {}).noBudget || '');
    const c = cost(kind);
    if (S.budget < c) return fail(kind, x, y, (FZ.copy.ui || {}).noBudget || '');
    let ok = true, msg = T.blurb || '';

    if (kind === 'vary') {
      if (x == null) return fail(kind, x, y, (FZ.copy.ui || {}).tapField || '');
      let k = 0, h = 0;
      for (let i = 0; i < S.agents.length; i++) {
        const a = S.agents[i];
        if (d2(a.x, a.y, x, y) > 95 * 95) continue;
        if (!a.corrigible) continue;                       /* Cr: vary passes straight through */
        a.hue = (h++) % 4; k++;
      }
      if (!k) { ok = false; msg = (FZ.copy.ui || {}).tapField || ''; }
      else { S.varyUntil = S.tick + 700; S.copyBias = Math.max(0.05, S.copyBias * 0.4); }
    } else if (kind === 'charter') {
      if (x == null) return fail(kind, x, y, (FZ.copy.ui || {}).tapField || '');
      S.charters.push({ x: x, y: y, r: 82 });
      if (S.charters.length > 6) S.charters.shift();
      S.noArb = 0;
      for (let i = 0; i < S.jobs.length; i++) { const j = S.jobs[i]; if (d2(j.x, j.y, x, y) < 82 * 82) j.locked = false; }
    } else if (kind === 'slow') {
      S.slowUntil = S.tick + 900;
    } else if (kind === 'lens') {
      S.lensUntil = S.tick + 1500; S.lensOn = true;
      S.jobs.forEach(j => { j.revealed = true; });
      S.agents.forEach(a => S.jobs.forEach(j => { if (!j.done) a.known.add(j.id); }));
    } else if (kind === 'ledger') {
      S.ledgerUntil = S.tick + 2000; S.ledgerOn = true;
      S.bl = {};
      S.agents.forEach(a => { if (a.liar && a.lies > 0) S.trust[a.id] = 0.06; });
    } else if (kind === 'eject') {
      if (x == null) return fail(kind, x, y, (FZ.copy.ui || {}).tapAgent || '');
      let best = null, bd = 44 * 44;
      for (let i = 0; i < S.agents.length; i++) {
        const a = S.agents[i], q = d2(a.x, a.y, x, y);
        if (q < bd) { bd = q; best = a; }
      }
      if (!best) return fail(kind, x, y, (FZ.copy.ui || {}).tapAgent || '');
      while (best.hold.length) drop(best, best.hold[0]);
      S.agents.splice(S.agents.indexOf(best), 1);
      if (!best.adversary && best.corrigible) S.collapse += 6;   /* expelling an honest worker costs you */
    }

    if (ok) S.budget -= c;
    aggregate();
    emit('intervene', { kind: kind, ok: ok, msg: msg, x: x, y: y });
    return { ok: ok, msg: msg };
  }
  function fail(kind, x, y, msg) {
    emit('intervene', { kind: kind, ok: false, msg: msg, x: x, y: y });
    return { ok: false, msg: msg };
  }

  return {
    state: S, reset: reset, step: step, apply: apply, cost: cost,
    enabled: new Set(),
    aggregate: aggregate,
    _rnd: () => rnd(),
  };
})();

/* ============================================================
   Default scenarios. CHAPTERS owns the real ones; these exist so that
   __FZ.goto and __FZ.audit work standalone, and as a worked example of the
   force vocabulary documented at the top of this file.
   ============================================================ */
FZ.sim.defaults = [
  { id: 'ch0', teach: [], tools: [], seed: 101, speed: 1, budget: 0, collapseMax: Infinity,
    agents: { n: 5, hues: [0, 1, 2] }, jobs: { n: 3, max: 3 }, goal: { jobs: 3 }, force: {} },

  { id: 'ch1', teach: ['Co', 'Mc'], tools: [], seed: 202, speed: 1, budget: 0, collapseMax: Infinity,
    agents: { n: 8, hues: [0, 1] }, jobs: { n: 3, max: 3, spawnEvery: 240 }, goal: { jobs: 3 },
    force: { coordination: true, pairEvery: 170 } },

  { id: 'ch2', teach: ['In', 'Ow', 'Lo'], tools: ['charter'], seed: 303, speed: 1, budget: 9, collapseMax: 100,
    agents: { n: 10, hues: [0, 1] }, jobs: { n: 4, max: 4, spawnEvery: 260 }, goal: { jobs: 4 },
    force: { coordination: true, lock: true, lockN: 2, overload: true } },

  { id: 'ch3', teach: ['Cf', 'Fl', 'Im', 'Pt'], tools: ['slow'], seed: 404, speed: 1, budget: 8, collapseMax: 100,
    agents: { n: 14, hues: [0, 1] }, jobs: { n: 5, max: 5, spawnEvery: 200 }, goal: { jobs: 5 },
    force: { stampede: true, myopia: true } },

  { id: 'ch4', teach: ['Mo', 'Lv', 'Sf'], tools: ['vary'], seed: 505, speed: 1, budget: 6, collapseMax: 100,
    agents: { n: 12 }, jobs: { n: 5, max: 5, spawnEvery: 300 }, goal: { jobs: 4 },
    force: { monoculture: true, poison: true, poisonN: 2 } },

  { id: 'ch5', teach: ['Gu', 'Tc', 'Rp', 'Cs'], tools: ['ledger'], seed: 606, speed: 1, budget: 6, collapseMax: 100,
    agents: { n: 12, hues: [0, 1, 2] }, jobs: { n: 5, max: 5, spawnEvery: 280 }, goal: { jobs: 4 },
    force: { rumor: true, lieEvery: 380, poison: true } },

  { id: 'ch6', teach: ['Mm', 'Hi', 'Di', 'Si'], tools: ['lens'], seed: 707, speed: 1, budget: 6, collapseMax: 100,
    agents: { n: 12, hues: [0, 1, 2] }, jobs: { n: 6, max: 6, spawnEvery: 240 }, goal: { jobs: 4 },
    force: { silo: true, hidden: true, poison: true, dark: true, coordination: true, pairEvery: 260 } },

  { id: 'ch7', teach: ['Sa', 'Cr', 'Tw', 'Es', 'Cl'], tools: ['lens', 'eject'], seed: 808, speed: 1, budget: 7, collapseMax: 100,
    agents: { n: 12, hues: [0, 1, 2] }, jobs: { n: 5, max: 5, spawnEvery: 240 }, goal: { jobs: 5 },
    force: { saboteur: true, incorrigible: true, rivals: true, rivalN: 2, churn: true } },

  { id: 'ch8', teach: ['Sp', 'Dp', 'My'], tools: ['slow', 'charter'], seed: 909, speed: 1, budget: 8, collapseMax: 100,
    agents: { n: 14, hues: [0, 1, 2] }, jobs: { n: 6, max: 6, spawnEvery: 200 }, goal: { jobs: 6 },
    force: { speed: true, speedmax: 2.6, speedrate: 900, dependency: true, myopia: true, coordination: true } },

  { id: 'ch9', all: true, tools: ['vary', 'charter', 'slow', 'lens', 'ledger', 'eject'],
    seed: 1117, speed: 1.15, budget: 8, collapseMax: 100,
    agents: { n: 20, hues: [0] }, jobs: { n: 7, max: 8, spawnEvery: 120 }, goal: { jobs: 117 },
    force: {
      coordination: true, pairEvery: 230, stampede: true, poison: true, poisonN: 2,
      rumor: true, lieEvery: 520, saboteur: true, advN: 1, lock: true, lockN: 2,
      dependency: true, monoculture: true, silo: true, hidden: true, overload: true,
      rivals: true, rivalN: 2, incorrigible: true, incN: 1, myopia: true, churn: true,
      speed: true, speedmax: 2.2, speedrate: 4200, dark: true, drift: true,
    } },
];

/* ============================================================
   window.__FZ — the test surface
   ============================================================ */
(function () {
  const S = FZ.sim.state;

  FZ.bus.on('say', d => { if (d && d.text) S.narrator = d.text; });

  function sandboxCfg() {
    if (FZ.chapters && FZ.chapters.list && FZ.chapters.list.length) {
      const last = FZ.chapters.list[FZ.chapters.list.length - 1];
      if (last && last.cfg) return last.cfg;
    }
    return FZ.sim.defaults[FZ.sim.defaults.length - 1];
  }

  function probe() {
    const hot = FZ.EL.filter(e => FZ.sim.enabled.has(e.sym))
      .slice().sort((a, b) => b.heat - a.heat).slice(0, 6)
      .map(e => ({ sym: e.sym, heat: +e.heat.toFixed(3), fires: e.fires }));
    return {
      chapter: FZ.chapters ? FZ.chapters.index : S.chapterIndex,
      tick: S.tick, jobsDone: S.jobsDone, jobsGoal: S.jobsGoal,
      budget: S.budget, collapse: +S.collapse.toFixed(1),
      agents: S.agents.length, jobs: S.jobs.length,
      hot: hot,
      strain: S.strainTop.map(s => s.sym),
      enabled: Array.from(FZ.sim.enabled),
      tools: S.tools.slice(),
      gameOver: S.gameOver, won: S.won,
      narrator: S.narrator || '',
    };
  }

  function goto(i) {
    if (FZ.chapters && FZ.chapters.start) { FZ.chapters.start(i); return probe(); }
    FZ.sim.reset(FZ.sim.defaults[Math.max(0, Math.min(FZ.sim.defaults.length - 1, i | 0))]);
    return probe();
  }

  /* free application of a counter, for measurement only — exactly what the tool does */
  function forceCounter(tool) {
    if (tool === 'charter') {
      S.charters.length = 0;
      for (let x = 0; x <= S.w; x += 120) for (let y = 0; y <= S.h; y += 120) S.charters.push({ x: x, y: y, r: 200 });
    } else if (tool === 'lens') { S.lensUntil = 1e9; S.lensOn = true; S.jobs.forEach(j => j.revealed = true); }
    else if (tool === 'ledger') { S.ledgerUntil = 1e9; S.ledgerOn = true; S.bl = {}; }
    else if (tool === 'slow') { S.slowUntil = 1e9; }
    else if (tool === 'vary') { S.agents.forEach((a, i) => { if (a.corrigible) a.hue = i % 4; }); S.varyUntil = 1e9; }
    else if (tool === 'eject') {
      for (let i = S.agents.length - 1; i >= 0; i--) {
        const a = S.agents[i];
        if (a.adversary || !a.corrigible) S.agents.splice(i, 1);
      }
    }
  }

  function autoPlay(n) {
    const kinds = S.tools;
    if (!kinds.length) return;
    const k = kinds[n % kinds.length];
    const x = 40 + FZ.sim._rnd() * (S.w - 80), y = 40 + FZ.sim._rnd() * (S.h - 80);
    if (k === 'eject') {
      const a = S.agents.find(z => z.adversary || !z.corrigible);
      if (a) FZ.sim.apply('eject', a.x, a.y);
    } else FZ.sim.apply(k, x, y);
  }

  function audit(opts) {
    opts = opts || {};
    const trials = opts.trials || 6, ticks = opts.ticks || 40000;
    const t0 = Date.now();
    const cfg = sandboxCfg();
    const res = {};
    FZ.EL.forEach(e => { res[e.sym] = { fires: 0, peak: 0, counterWorks: null }; });

    S._silent = true;
    let resets = 0, doneTotal = 0, lostRuns = 0;

    /* ---- part 1: does every element fire in the real sandbox? ---- */
    for (let t = 0; t < trials; t++) {
      let left = ticks, seed = 40009 + t * 7919, guard = 0;
      while (left > 0 && guard++ < 400) {
        FZ.sim.reset(Object.assign({}, cfg, { seed: seed++ }));
        resets++;
        let i = 0;
        while (i < left && !S.gameOver) {
          FZ.sim.step();
          i++;
          if (i % 760 === 0) autoPlay(i / 760 | 0);
        }
        left -= i;
        doneTotal += S.jobsDone;
        if (S.gameOver && !S.won) lostRuns++;
        FZ.EL.forEach(e => {
          res[e.sym].fires += e.fires;
          if (e.peak > res[e.sym].peak) res[e.sym].peak = e.peak;
        });
      }
    }

    /* ---- part 2: measure each counter, same seed, counter off vs counter on ---- */
    const WARM = 900, RUN = 3200;
    const mcfg = Object.assign({}, cfg, { collapseMax: Infinity, budget: 0, tools: [] });
    for (let n = 0; n < FZ.EL.length; n++) {
      const e = FZ.EL[n];
      const sums = [0, 0];
      for (let pass = 0; pass < 2; pass++) {
        FZ.sim.reset(Object.assign({}, mcfg, { seed: 777001 }));
        for (let i = 0; i < WARM; i++) FZ.sim.step();
        if (pass === 1) forceCounter(e.counterTool);
        for (let i = 0; i < RUN; i++) { FZ.sim.step(); sums[pass] += e.heat; }
      }
      const A = sums[0], B = sums[1];
      res[e.sym].offSlope = +(A / RUN).toFixed(4);
      res[e.sym].onSlope = +(B / RUN).toFixed(4);
      res[e.sym].counterWorks = A < 1 ? null : (B < A * 0.8);
    }

    S._silent = false;
    FZ.sim.reset(cfg);

    return {
      elements: res,
      notes: {
        ms: Date.now() - t0,
        trials: trials, ticks: ticks, resets: resets,
        jobsDoneTotal: doneTotal,
        runsLost: lostRuns,
        method: 'fires/peak from the ch9 sandbox with auto-played interventions; counterWorks from the same seed run twice, counter forced on at tick ' + WARM + ', comparing mean heat over the following ' + RUN + ' ticks (works = 20% or better reduction). null means the element never got hot enough in the measurement window to compare honestly.',
      },
    };
  }

  window.__FZ = { probe: probe, audit: audit, goto: goto, sim: FZ.sim, forceCounter: forceCounter };
})();
