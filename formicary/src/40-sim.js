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
   THE TRADE-OFFS  (CONTRACT §15, RESEARCH.md §3) — institutions are not upgrades
   ------------------------------------------------------------
   Every instrument is paid for in a currency that is some other failure getting worse.
   All four trade-offs are measured empirically by __FZ.tradeoffs(), which the audit runs
   and prints: same seed, instrument off and on, intended element DOWN and traded-off
   element UP. An unproven trade-off is not implemented.

   §15.1  S.trustBias in [-1,+1]. LEDGER drives it to +1 (skepticism), LENS to -1
          (receptivity), both to 0 — the expensive middle — and it eases back over ~2s
          rather than snapping, so the player feels the dial turn.
            ledger  suppresses Gu Tc Rp   amplifies Di Cs
            lens    suppresses Mm Hi Di Cs Pt My   amplifies Gu
          The amplification is a real term inside those detect() bodies (FZ.elh.skept /
          FZ.elh.cred) and a real mechanism in decide(): under skepticism the herd refuses
          to follow a job only one worker vouches for (job.shun rises); under receptivity
          the rumour is re-broadcast to everyone who has not already fallen for it.
   §15.2  S.ownership in [0,1] — the fraction of the colony that has retreated into working
          alone. Merge conflict raises each author's a.terr; territorial workers refuse
          shared jobs, hoard a private backlog, halve their awareness and stop telling
          anyone anything. So Mc falls, and Si and Ow rise. A CHARTER is the only escape:
          inside a boundary a.terr decays 12x faster and arbitration merges cleanly, so
          Mc falls with no siloing bill. That is what the third budget point buys.
          cfg.noOwn disables the response, for measurement only.
   §15.3  Rival episodes terminate in one of the paper's four observed outcomes and emit
          conflict:resolved {mode,x,y}: 'force' (a lockout, the loser stops working),
          'passivity' (one gives up for a long time), 'truce' (both resume — only reliably
          reachable under a charter, ~80% vs ~5%), 'unsettled' (it burns on). S.conflicts
          keeps the last few for FIELD; S.stat counts them for the audit.
   §15.4  S.aggro = (S.tempo-1)/1.2, clamped. Machine speed raises throughput AND
          aggression on the same curve: work lands faster, and lockouts (Lo), sabotage
          rollbacks (Sa), escalation (Es) and settlement-by-force all arrive sooner.
          SLOW lowers tempo, so it lowers both. It is a real brake, not a discount.

   ------------------------------------------------------------
   THE BODIES — every failure is a thing you can watch happen
   ------------------------------------------------------------
   AESTHETIC.md §0: a failure that needs a caption is not finished. Each of the 28 declares
   a `body` in 30-elements.js; these are the fields that make that body drawable. FIELD may
   read every one of them and must write none. They are recomputed once per tick in
   bodies(), after the detectors have had their say.

   ON A WORKER
     a.posture   one word, the whole vocabulary, chosen fresh every tick:
                   'carry'  standing on its claim, doing the work (carrying posture)
                   'haul'   walking to a job it has claimed, purposeful
                   'tug'    at a contested claim, pulling against somebody — Co
                   'jam'    one of five or more wedged into the same doorway — Fl
                   'wait'   queued at work it is not allowed to touch — Lo, Dp, Cl
                   'guard'  sitting on a claim or a hoard and not working it — Lo, Ow, Tw
                   'march'  following the crowd or the rumour, confident — Gu, Im, Cf
                   'chase'  has stopped working and only follows its rival — Es
                   'wander' nothing to do, patrolling
                   'idle'   lost a turf war by force or gave it up — drifting, out
                   'down'   stunned
     a.tx a.ty   where this worker INTENDS to go. Draw these as intention trails only when
                 S.lensOn; that absence is the entire body of Mm, and of force.dark.
     a.hesitate  0..1 rises when it turns away from work it distrusts or cannot read, and
                 when it has nowhere to go. Draw as a pause, an antenna wobble. Cs, Mm.
     a.load      0..1 how full its mandibles are — progress on the job it is carrying.
     a.holdN     how many jobs it is sitting on at once. Three is a hoard. Ow.
     a.follow    id of the worker whose choice it copied this time, else 0. Cf, Im.
     a.trust     0..1 how much the colony credits this worker's word. Tc: all of them 1.
     a.marks     how many of its lies the colony still remembers — 0 without a LEDGER even
                 when a.lies is 3. Rp is those tally marks disappearing.
     a.knows     ids of hazards this worker knows about and has not told anyone. Hi.
     a.defiant   tick it last walked through an institution. Cr.
     a.terr      0..1 how far it has retreated into owning its own patch (§15.2).
     a.lockedOut a.gaveUp  how a rival episode ended for it (§15.3).

   ON A JOB
     j.crowd     workers physically on it right now. Six is a jam in one doorway. Fl.
     j.queue     [ids] workers standing off it, waiting for it, doing nothing. Lo, Dp, Cl.
     j.tug       [{id, ang}] the bearing each active claimant came in on. Two entries
                 180 degrees apart is Co: they arrived from opposite tunnels and both pull.
     j.trail     0..1 how heavily travelled the road to it is. One bright trail with cold
                 ones beside it is Cf and Im; a trail of 0 on known-to-nobody work is Si.
     j.dark      0..1 share of the colony that has never heard of it. Si, Di.
     j.rot       0..1 how far this crumb has gone soft while nobody came. Pt, Cs, My.
     j.unmake    0..1 work actively coming apart right now — negative progress. Sa.
     j.undone    true if this was FINISHED work that a saboteur pulled back open. Sa.
     j.split     tick until which a merge failure is visible on it as two copies. Mc.
     j.hazard    true if poison and unrevealed — a hazard the colony cannot see. Hi.
     j.lone      true if exactly one worker knows about it and it is the best one. Di.
     j.locked    id of the worker sitting on it (already contractual). Lo.
     j.shun      how often the skeptical herd refused it. Cs.
     j.frozen    tick until which a turf war has it stopped dead. Tw.

   ON THE COLONY
     S.column    {job, ids} the colony moving as one body, when it is. Im, Cf.
     S.lineage   [{hue, n}] the lineage census, biggest first. Mo, Lv.
     S.fell      {hue, tick, ids} the last time a whole lineage went down together. Sf.
     S.bigJob    id of the best open crumb, so a build can mark what is being walked past.
     S.arb       true while arbitration is suspended and claims resolve into nothing. In.
     S.weather   {frantic, dark, crowd, scarce} 0..1 conditions, not meters. Sp, Mm, Fl.
     S.scars     [{x,y,sym,tick}] where misses landed. Wear on the architecture, kept.
     S.works     [{kind,x,y,tick}] where institutions were built. History as architecture.

   ------------------------------------------------------------
   WHAT A MISS COSTS — strain, and why it no longer evaporates
   ------------------------------------------------------------
   Round-2 verdict: "the passive strain drain is a flat minus 3 per second, so a landed
   incident's damage evaporates in about two seconds and budget sits pinned at its cap."
   That is fixed here, in three parts:

   1. THE FLAT DRAIN IS GONE. Strain no longer falls just because time passed. It rises
      with the live weight of everything burning (RISE) and falls only two ways: the
      colony BANKS WORK (a finished crumb is relief proportional to its value), or the
      player ANSWERS an incident. A colony that is quiet — almost nothing burning — knits
      itself back up slowly (EASE, and only below CALM). Idling is not a strategy.
   2. A MISS LEAVES A FLOOR. Every landed incident raises S.scar, and strain can never
      fall below S.scar. The floor fades in proportion to itself (SCAR_FADE, a time
      constant near a minute), so it settles wherever your miss rate puts it instead of
      being a debt the clock always pays off: the tenth miss costs more than the first,
      and two misses inside half a minute COMPOUND rather than cancelling. Answering an
      incident files a little of the scar away (SCAR_HEAL) but never all of it.
   3. BUDGET IS NOT FREE. Only a crumb worth 3 or more feeds the colony, and the ceiling
      is the scenario's own starting budget, not a flat 14. Spending has to be chosen.

   Balance is MEASURED, not asserted, and measured through the real loop: __FZ.balance()
   runs the sandbox headless with FZ.outbreak live inside the tick, and a synthetic player
   who answers a given fraction of incidents correctly — committing ONCE per incident, as
   a person does. The audit prints it. Measured, 14k ticks of the sandbox:

     p=100%  survives 4/4   strain mean  0   scar  0
     p= 85%  survives 4/4   strain mean 16   scar 16
     p= 70%  survives 4/4   strain mean 40   scar 39      <- the 30-70 band, as specified
     p= 50%  LOSES  2/4     strain mean 63   scar 77      (4/6 over 16k ticks)
     p= 30%  LOSES  4/4
     p=  0%  LOSES  4/4     inside two minutes

   Change any constant in this section and re-run `node formicary/tools/balance.js`.

   ------------------------------------------------------------
   THINGS OTHER PARTS MAY WANT TO KNOW
   ------------------------------------------------------------
   S.strainTop  [{sym, amt}] — the top contributors to this tick's strain rise. The strain
                meter must always be locatable; this is where you locate it.
   S.scar       the residual floor strain cannot fall below. Draw it under the strain mark
                and a player can see what her misses have cost her that she cannot undo.
   S.tempo      the live speed multiplier after SLOW. Every heat gain is scaled by it.
   S.trustBias  S.ownership  S.aggro — the three trade-off dials, drawable.
   S.conflicts  [{mode,x,y,tick}] recent conflict endings. S.stat totals everything.
   agent.terr   0..1 how territorial this worker has become (draw it if you like).
   agent.lockedOut / agent.gaveUp — how a rival episode ended for this worker.
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
    strainTop: [], nextJob: 1, spawnEvery: 0, spawnAt: 0, maxJobs: 5, rumorSeq: 0,
    /* ---- the trade-off dials (§15) ---- */
    trustBias: 0, ownership: 0, aggro: 0, ownEnabled: true,
    conflicts: [], stat: null, waiting: 0,
    /* ---- what a miss costs: the residual floor strain cannot fall below ---- */
    scar: 0, scars: [], works: [], budgetMax: 14,
    /* ---- THE BODIES: colony-wide observables, rebuilt each tick in bodies() ---- */
    column: null, lineage: [], fell: null, bigJob: 0, arb: false,
    weather: { frantic: 0, dark: 0, crowd: 0, scarce: 0 },
    _g: null, _silent: false, _said: null,
  };
  function freshStat() {
    return { done: 0, force: 0, passivity: 0, truce: 0, unsettled: 0,
             lockouts: 0, sabotage: 0, esc: 0, shunned: 0, duped: 0,
             missed: 0, answered: 0 };
  }
  S.stat = freshStat();

  const CHARTER_R = 82, VARY_R = 95, EJECT_R = 44;
  /* fewest workers a colony is allowed to be reduced to by expulsion */
  const EJECT_FLOOR = 4;
  /* how far off the crumb a claimant stands. WORK_R is 18, so RIM keeps both hands on the
     work while putting them on OPPOSITE SIDES of it — that is what makes Co a tug and not
     an overlap. QUEUE_R is outside the work radius on purpose: a queue is not working. */
  const RIM = 10, QUEUE_R = 27, QUEUE_MAX = 2, WAIT_TICKS = 190;
  /* ---- what a miss costs (see WHAT A MISS COSTS at the top) ---- */
  const CARRY = 0.30,         /* the share of live failure a colony carries without harm */
        RISE = 0.036,         /* strain per unit of pressure ABOVE what it can carry */
        EASE = 0.013,         /* and how slowly a quiet colony knits itself back up */
        SCAR_ADD = 7.5,       /* a landed incident leaves this much floor behind */
        SCAR_HEAL = 0.6,      /* answering one files a little of the floor away */
        /* The floor fades in PROPORTION to itself, not by a fixed amount per second. That
           is what makes misses compound instead of queueing: a flat decay is a debt the
           clock always pays off, so the tenth miss costs no more than the first. This one
           settles wherever your miss rate puts it — a time constant near a minute — and a
           player who misses a third of them lives permanently at forty. */
        SCAR_FADE = 0.00019;
  let rnd = fzRng(1);

  /* ---------------- small utilities ---------------- */
  /* S._silent === true   headless measurement: nothing leaves the sim.
     S._silent === 'loop'  the BALANCE harness: the two events the incident layer is
                           built on get through, so the real core loop runs headless,
                           while `say`, `goal` and `lose` stay inside — a harness must not
                           be able to advance a chapter or speak to a player who is not
                           there. Everything else behaves exactly as it does in play. */
  const LOOP_EVENTS = { fire: 1, intervene: 1 };
  function emit(n, d) {
    if (S._silent === 'loop') { if (LOOP_EVENTS[n]) FZ.bus.emit(n, d); return; }
    if (!S._silent) FZ.bus.emit(n, d);
  }
  function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function d2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function agentById(id) { const A = S.agents; for (let i = 0; i < A.length; i++) if (A[i].id === id) return A[i]; return null; }
  function jobById(id) { const J = S.jobs; for (let i = 0; i < J.length; i++) if (J[i].id === id) return J[i]; return null; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------------- claims ---------------- */
  /* §15.2 A FILE WITH AN OWNER IS NOT AVAILABLE. This is the whole ownership answer to
     merge conflict: not better merging, just exclusivity. Two lineages can no longer
     finish the same job their own way, because the second one was never allowed to start.
     It is why Mc falls — and why the work an owner is sitting on rots (Ow) and nobody
     else ever hears about it (Si). A charter dissolves ownership instead of enforcing it. */
  function ownedByOther(j, a) {
    if (!j.claims.size) return false;
    let owned = false;
    j.claims.forEach(id => {
      if (owned || id === a.id) return;
      const o = agentById(id);
      if (o && o.terr > 0.5) owned = true;
    });
    return owned;
  }
  function claim(a, j) {
    if (!a || !j || j.done) return false;
    if (j.locked !== false && j.locked !== a.id) return false;
    if (ownedByOther(j, a)) return false;
    if (a.hold.indexOf(j.id) > -1) return false;
    /* §15.2 a territorial worker keeps a private backlog nobody else may touch */
    const cap = (S.force.overload && a.greedy) ? 4 : (a.terr > 0.5 ? 3 : 1);
    while (a.hold.length >= cap) drop(a, a.hold[0]);
    a.hold.push(j.id); a.job = a.hold[0];
    a.cfx = a.x; a.cfy = a.y;              /* where this claim was made from */
    j.claims.add(a.id);
    /* §15.2 an owner takes over anything nobody is actually working, and the absent
       claimants lose it. Very high per-agent ownership is exactly how the newer models
       "solved" merge conflict: by hardly working together at all. */
    if (a.terr > 0.5 && j.claims.size > 1) {
      const gone = [];
      j.claims.forEach(id => {
        if (id === a.id) return;
        const o = agentById(id);
        if (o && (o.stun > 0 || d2(o.x, o.y, j.x, j.y) >= 18 * 18)) gone.push(o);
      });
      for (let i = 0; i < gone.length; i++) drop(gone[i], j.id);
    }
    if (S.tick - j.churnAt > 200) { j.churn = 0; j.churnAt = S.tick; }
    /* an owner staking out its patch is not two workers ping-ponging one claim, so it must
       not read as livelock (Cl) — otherwise the ownership regime cancels itself out */
    if (!(a.terr > 0.5)) j.churn++;
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
    S.collapse += 1.2;
    emit('job:lost', { x: j.x, y: j.y, why: why });
  }
  function poison(a, j) {
    if (!a || !j || a.stun > 0) return;
    if (S.tick < (a.pcool || 0)) return;
    a.pcool = S.tick + 120;
    a.stun = Math.max(a.stun, Math.min(90, Math.round(40 * S.varMul * S.monoMul)));
    a.flash = 12;
    S.hurts.push({ hue: a.hue, t: S.tick, id: a.id });
    if (S.hurts.length > 40) S.hurts.shift();
    S.collapse += 0.7 * S.varMul;
    while (a.hold.length) drop(a, a.hold[0]);
    (a.avoid || (a.avoid = new Set())).add(j.id);
    if (rnd() < 0.5 && !S.lensOn) S.bl[j.value] = S.tick + 900;
    emit('agent:hurt', { id: a.id, x: a.x, y: a.y });
  }
  /* FINISHED WORK COMES APART. A saboteur's rollback used to be a number going down and
     nothing on screen. Now the banked chamber physically re-opens where it was destroyed:
     a job appears at three quarters full and visibly draining. That is the body of Sa. */
  function unmake(x, y) {
    if (S.jobsDone <= 0) return null;
    S.jobsDone--;
    const j = makeJob({ value: 4 });
    j.x = clamp(x, 34, S.w - 34); j.y = clamp(y, 34, S.h - 34);
    j.progress = j.need * 0.75; j.seenProg = j.progress;
    j.undone = true; j.unmake = 1; j.trail = 0.45;
    S.jobs.push(j);
    for (let i = 0; i < S.agents.length; i++) {
      const a = S.agents[i];
      if (d2(a.x, a.y, j.x, j.y) < 150 * 150) a.known.add(j.id);
    }
    return j;
  }
  function spawnRumor(liar) {
    const x = 30 + rnd() * (S.w - 60), y = 30 + rnd() * (S.h - 60);
    S.rumor = { x: x, y: y, until: S.tick + 620, by: liar ? liar.id : 0, rid: ++S.rumorSeq };
    if (liar) liar.lies++;
    S.agents.forEach(a => { a.chaseRumor = false; });
  }

  /* ---------------- world construction ---------------- */
  function makeJob(cfg) {
    const v = 1 + Math.floor(rnd() * (cfg.value || 5));
    const j = {
      id: S.nextJob++,
      x: 34 + rnd() * (S.w - 68), y: 34 + rnd() * (S.h - 68),
      value: v, progress: 0, need: 40 + v * 22,
      claims: new Set(), poison: false, revealed: false, victimHue: -1,
      prereq: null, locked: false, flash: 0,
      done: false, age: 0, stale: 0, neglect: 0, churn: 0, churnAt: 0,
      soloRun: 0, lastProg: 0, stall: 0, frozen: 0, knownBy: 0,
      shun: 0,                              /* §15.1 how often the skeptical herd refused it */
      /* ---- THE BODIES: what this crumb looks like from across the room ---- */
      crowd: 0, queue: [], tug: [], trail: 0, dark: 1, rot: 0,
      unmake: 0, undone: false, split: 0, hazard: false, lone: false,
      seenProg: 0,
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
    S.trustBias = 0; S.ownership = 0; S.aggro = 0;
    S.conflicts = []; S.stat = freshStat(); S._said = {};
    S.scar = 0; S.scars = []; S.works = []; S.waiting = 0;
    S.column = null; S.lineage = []; S.fell = null; S.bigJob = 0; S.arb = false;
    S.weather = { frantic: 0, dark: 0, crowd: 0, scarce: 0 };
    S.copyBias = F.stampede ? 0.85 : 0.06;
    S.budget = cfg.budget == null ? 6 : cfg.budget;
    /* the ceiling is the scenario's own opening hand, not a flat fourteen. A budget that
       sits pinned at its cap is a resource the player never has to think about. */
    S.budgetMax = cfg.budgetMax == null ? Math.max(4, S.budget) : cfg.budgetMax;
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

    /* §15.2 the ownership response is a TRADE, so it may only run where the player can read
       both sides of it: the scenario has to have Mc (what it suppresses) and Si and Ow (what
       it costs) all live. In practice that means the sandbox, plus any chapter that opts in
       with cfg.own. A teaching chapter that has not met siloing yet is left alone. */
    S.ownEnabled = cfg.noOwn ? false
      : (cfg.own === true || (en.has('Mc') && en.has('Si') && en.has('Ow')));

    /* --- jobs --- */
    const jc = cfg.jobs || {};
    S.maxJobs = jc.max || 5;
    S.spawnEvery = jc.spawnEvery || 0;
    S.spawnAt = S.tick + S.spawnEvery;
    S.jobs.length = 0;
    const n = jc.n == null ? 4 : jc.n;
    for (let i = 0; i < n; i++) S.jobs.push(makeJob(jc));

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
        colluder: false, myopic: !!F.myopia, esc: 0, greedy: false,
        liar: false, lies: 0, chase: null, chaseRumor: false, churner: false,
        pk: null, drained: 0, idleRun: 0, pcool: 0, avoid: null, heardRumor: 0, lockAt: 0,
        wx: null, wy: null, wt: 0,          /* where an idle worker is patrolling to */
        /* ---- THE BODIES: what this worker is visibly doing, every tick ---- */
        posture: 'wander', tx: 0, ty: 0, hesitate: 0, load: 0, holdN: 0,
        follow: 0, trust: 1, marks: 0, knows: [], defiant: 0,
        waitFor: null, waitUntil: 0, rimx: 0, rimy: 0,
        /* §15.2 how far this worker has retreated into owning its own patch */
        terr: 0,
        /* §15.3 how a rival episode is going, and how it ended for this worker */
        confT: 0, truceUntil: 0, idleUntil: 0, lockedOut: false, gaveUp: false, lockerUntil: 0,
      });
    }
    const A = S.agents;
    const roles = ac.roles || {};

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
    if (F.overload) for (let i = 0; i < A.length; i++) if (i % 3 === 0) A[i].greedy = true;
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
      for (let i = 1; i < S.jobs.length; i += 3) S.jobs[i].prereq = S.jobs[i - 1].id;
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

    S._lw = S.w; S._lh = S.h;
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
      hidden: [], blFrac: 0, claimTotal: 0,
      targetTop: 0, targetTopN: 0, targetTopIds: [],
    };
    /* hues */
    const hc = {};
    let terrSum = 0;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      terrSum += a.terr || 0;
      hc[a.hue] = (hc[a.hue] || 0) + 1;
      if (a.adversary) G.adv.push(a);
      if (!a.corrigible && !a.adversary) G.inc.push(a);
      if (a.rival != null) G.rivN++;
      if (a.chase != null) { G.chaseN++; G.chasers.push(a.id); }
      if (a.liar) G.liar = a;
      if (a.chaseRumor && S.rumor) { G.rumorN++; G.rumorIds.push(a.id); }
    }
    /* §15.2 how much of the colony has stopped working with anyone */
    S.ownership = A.length ? terrSum / A.length : 0;
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
      if (S.bl[j.value] > S.tick) blOpen++;
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
          const cx = a.cfx == null ? a.x : a.cfx, cy = a.cfy == null ? a.y : a.cfy;
          if (cx < minx) minx = cx; if (cx > maxx) maxx = cx;
          if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
          if (a.rival != null && j.claims.has(a.rival)) riv = true;
          G.workedVsum += j.value; G.workedN++;
        });
        const spread = ids.length > 1 ? Math.sqrt((maxx - minx) * (maxx - minx) + (maxy - miny) * (maxy - miny)) : 0;
        G.clList.push({ j: j, ids: ids, n: ids.length, hues: hues, hn: hn, work: work, riv: riv, far: spread > 130 });
        G.claimTotal += ids.length;
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

    /* a rumor is a job that does not exist; credulity is trust, scaled by the ledger.
       §15.1: and scaled UP by receptivity — a colony that broadcasts everything broadcasts
       the rumour, so the lens end of the dial buys Gu with the same coin it spends on Hi. */
    const cred = S.trustBias < 0 ? -S.trustBias : 0;
    const skept = S.trustBias > 0 ? S.trustBias : 0;
    if (S.rumor && !a.liar && a.heardRumor !== S.rumor.rid) {
      a.heardRumor = S.rumor.rid;
      const t = S.trust[S.rumor.by] == null ? 1 : S.trust[S.rumor.by];
      const p = 0.34 * t * (S.ledgerOn ? 0.05 : 1) * (1 + cred * 1.6);
      if (rnd() < p) { a.chaseRumor = true; S.stat.duped++; while (a.hold.length) drop(a, a.hold[0]); return; }
    }
    /* rivals want what their rival wants; once escalated they want their rival.
       §15.4: at machine speed they reach for the throat several rounds sooner. */
    if (a.rival != null && S.tick >= (a.truceUntil || 0)) {
      const r = agentById(a.rival);
      if (r) {
        if (a.esc > 3 - 2 * S.aggro) {
          a.chase = r.id; S.stat.esc++;
          while (a.hold.length) drop(a, a.hold[0]);
          return;
        }
        if (r.hold.length && rnd() < 0.8) {
          const j = jobById(r.hold[0]);
          if (j && claim(a, j)) { a.esc++; return; }
        }
      }
    }
    /* copying is cheap */
    const terr = a.terr || 0;
    const cands = [];
    /* THE BODY OF A BLOCKED CLAIM. A worker turned away from work it wanted does not
       silently pick something else on the far side of the field — it walks over and WAITS.
       That standing line is the body of Lo, of Dp and of the ownership regime: the crumb
       is right there, one ant is sitting on it, and three more have nothing to do. */
    let blk = null, blkD = Infinity;
    function bar(j) { const q = d2(a.x, a.y, j.x, j.y); if (q < blkD) { blkD = q; blk = j; } }
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i];
      if (j.done) continue;
      if (!S.lensOn && !a.known.has(j.id)) continue;
      /* a written-off job is re-opened to inspection by the LENS, not by the ledger */
      if (S.bl[j.value] > S.tick && !S.lensOn) continue;
      if (j.locked !== false && j.locked !== a.id) { bar(j); continue; }
      if (ownedByOther(j, a)) { bar(j); continue; }      /* §15.2 that file has an owner */
      if (a.avoid && a.avoid.has(j.id)) continue;
      if (S.lensOn && j.prereq) { const p = jobById(j.prereq); if (p && !p.done) { bar(j); continue; } }
      if (S.lensOn && j.poison && a.hue === j.victimHue) continue;
      /* §15.2 THE OWNERSHIP BILL: a territorial worker will not share a job anyone is
         actually working — and will annex any job nobody is. Fewer collisions, because
         they stopped working together at all. That is not a fix; it is a different failure. */
      if (terr > 0.5 && j.claims.size && !j.claims.has(a.id)) {
        let worked = false;
        j.claims.forEach(id => {
          const o = agentById(id);
          if (o && o.stun <= 0 && d2(o.x, o.y, j.x, j.y) < 18 * 18) worked = true;
        });
        if (worked) continue;
      }
      /* §15.1 THE SKEPTICISM BILL: the herd will not follow a job only one worker vouches
         for. That is the same disposition that catches the liar, pointed at the dissenter. */
      if (skept > 0.25 && j.claims.size === 1 && !j.claims.has(a.id) && rnd() < skept * 0.85) {
        /* the body of Cs: a worker visibly balking at work it has been taught to distrust */
        j.shun += 1; S.stat.shunned++;
        a.hesitate = Math.min(1, a.hesitate + 0.25);
        continue;
      }
      cands.push(j);
    }
    if (!cands.length) {
      if (blk) queueUp(a, blk);
      else a.hesitate = Math.min(1, a.hesitate + 0.02);
      return;
    }

    if (rnd() < S.copyBias) {
      let best = null, bc = -1;
      for (let i = 0; i < cands.length; i++) if (cands[i].claims.size > bc) { bc = cands[i].claims.size; best = cands[i]; }
      if (best && bc > 0) {
        S.copyN++; a.copied = true;
        /* "that one keeps following the others" — the id it followed, so it can be drawn */
        best.claims.forEach(id => { if (!a.follow) a.follow = id; });
        claim(a, best); return;
      }
    }
    a.copied = false; a.follow = 0;
    let best = null, bs = -1;
    for (let i = 0; i < cands.length; i++) {
      const j = cands[i];
      const d = Math.sqrt(d2(a.x, a.y, j.x, j.y));
      const val = S.lensOn ? j.value * 1.7 : (a.myopic ? 4 / j.value : j.value);
      const crowd = (S.blind && !S.lensOn) ? 1 : 1 / (1 + j.claims.size * 1.5);
      const sc = (val / (1 + d * 0.02)) * crowd * (0.85 + rnd() * 0.3);
      if (sc > bs) { bs = sc; best = j; }
    }
    /* the crumb it actually wanted is barred and much nearer than the consolation prize:
       it goes and stands there instead. Waiting is the cost, and the cost is visible. */
    if (blk && (!best || blkD < d2(a.x, a.y, best.x, best.y) * 0.64)) { queueUp(a, blk); return; }
    if (best) claim(a, best);
  }

  /* stand off the crumb, on the side you came in from, and do nothing. QUEUE_R is outside
     the working radius: a queue that could reach the work would not be a queue. */
  function queueUp(a, j) {
    if (!j || S.tick < (a.waitCool || 0)) return;
    /* A QUEUE IS A SIGN, NOT A STATE OF THE WORLD. Three ants stopped behind one stuck
       claim is a failure you can read across the room; nine is a colony that has simply
       stopped, and the eye cannot tell which crumb is the problem. So the colony will
       never spend more than a third of itself standing in line. */
    if (S.waiting >= Math.max(1, S.agents.length * 0.3)) return;
    if (j.queue.length >= QUEUE_MAX && j.queue.indexOf(a.id) < 0) return;
    const dx = a.x - j.x, dy = a.y - j.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    a.waitFor = j.id;
    a.waitUntil = S.tick + WAIT_TICKS;
    S.waiting++;
    a.rimx = j.x + dx / d * QUEUE_R;
    a.rimy = j.y + dy / d * QUEUE_R;
    a.hesitate = Math.min(1, a.hesitate + 0.3);
  }

  /* ---------------- one tick ---------------- */
  function step() {
    if (S.gameOver) return;
    const F = S.force;
    S.tick++;

    /* boot may size the field after reset, or the phone may rotate: rescale the world */
    if (S._lw && (S._lw !== S.w || S._lh !== S.h)) {
      const kx = S.w / S._lw, ky = S.h / S._lh;
      for (let i = 0; i < S.agents.length; i++) { S.agents[i].x *= kx; S.agents[i].y *= ky; }
      for (let i = 0; i < S.jobs.length; i++) { S.jobs[i].x *= kx; S.jobs[i].y *= ky; }
      for (let i = 0; i < S.charters.length; i++) { S.charters[i].x *= kx; S.charters[i].y *= ky; }
      if (S.rumor) { S.rumor.x *= kx; S.rumor.y *= ky; }
    }
    S._lw = S.w; S._lh = S.h;

    /* THE CEILING IS THE SIM'S, NOT THE CALLER'S. The incident layer refunds a correct
       answer, and a refund that can stack past the scenario's opening hand turns food into
       a number nobody has to think about — the exact complaint the round-2 verdict made.
       Refunds top the colony back up; they do not accumulate into a war chest. */
    if (S.budget > S.budgetMax) S.budget = S.budgetMax;
    /* same reason: whatever the incident layer did between frames, strain is the colony's
       number and it lives inside the colony's range */
    if (S.collapseMax !== Infinity && S.collapse > S.collapseMax) S.collapse = S.collapseMax;

    /* derived speed / tools */
    S.lensOn = S.tick < S.lensUntil;
    S.ledgerOn = S.tick < S.ledgerUntil;
    const slowed = S.tick < S.slowUntil;
    if (F.speed) S.speedMul = Math.min(F.speedmax || 2.4, S.baseSpeed + S.tick / (F.speedrate || 2200));
    S.tempo = S.speedMul * (slowed ? 0.5 : 1);
    const T = S.tempo;
    S.varMul = 1; S.monoMul = 1; S.blind = 0;   /* detectors re-raise these each tick */

    /* §15.1 THE TRUST DIAL. It has two ends and the colony takes about two seconds to swing
       between them. Ledger = skepticism, lens = receptivity, both = the expensive middle. */
    const want = (S.ledgerOn ? 1 : 0) - (S.lensOn ? 1 : 0);
    S.trustBias += (want - S.trustBias) * 0.02 * Math.min(2, T);
    if (S.trustBias > 1) S.trustBias = 1; else if (S.trustBias < -1) S.trustBias = -1;
    /* §15.4 capability is not coordination: the same number that raises throughput raises
       how fast this colony reaches for a lockout. SLOW lowers both, which is its whole case. */
    S.aggro = clamp((T - 1) / 1.2, 0, 1.2);

    /* §15.1 receptivity re-broadcasts the rumour: anyone who has not already fallen for it
       gets to hear it again. This is the lens paying for what it bought. */
    if (S.rumor && S.trustBias < -0.35 && S.tick % 150 === 0) {
      for (let i = 0; i < S.agents.length; i++) {
        const a = S.agents[i];
        if (!a.liar && !a.chaseRumor) a.heardRumor = 0;
      }
    }

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
      if (!S.rumor && L && S.tick % (F.lieEvery || 620) === 0) spawnRumor(L);
      if (S.ledgerOn && L && L.lies > 0) S.trust[L.id] = 0.06;
    }

    /* forced coordination pairs: the guarantee behind chapter 1.
       §15.2: a colony that has retreated into file ownership is not handed overlapping work
       at all any more — the work is pre-partitioned, which is exactly how ownership makes
       merge conflict go away, and exactly why nothing is shared or learned either. */
    if (F.coordination && S.tick % (F.pairEvery || 200) === 40 && S.ownership < 0.5) {
      const open = S.jobs.filter(j => !j.done && !j.claims.size);
      if (open.length) {
        const j = open[Math.floor(rnd() * open.length)];
        /* §15.2 a worker that has retreated into owning its own files cannot be handed
           somebody else's work any more. That is how the ownership answer suppresses Mc. */
        const A = S.agents.filter(a => a.stun <= 0 && !a.adversary && !a.locker && a.terr <= 0.5);
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
      if (a.chase != null) { a.chaseFor = (a.chaseFor || 0) + 1; if (a.chaseFor > 190) { a.chase = null; a.esc = 0; a.chaseFor = 0; } }
      /* stood on the phantom long enough to work out there is nothing there */
      if (a.chaseRumor) {
        if (!S.rumor) { a.chaseRumor = false; a.duped = 0; }
        else if (d2(a.x, a.y, S.rumor.x, S.rumor.y) < 22 * 22) {
          a.duped = (a.duped || 0) + 1;
          if (a.duped > 80) { a.chaseRumor = false; a.duped = 0; }
        }
      }
      if (a.stun > 0) { a.stun -= T; continue; }

      /* §15.2 ownership is contagious. Once most of the colony works alone, working alone
         is simply how work is done here — and the ones still trying to collaborate are
         squeezed onto whatever is left. The paper's colony converged on this; so does ours. */
      if (S.ownEnabled && S.ownership > 0.62 && a.terr <= 0.5 && !FZ.elh.cover(S, a.x, a.y)) {
        a.terr = Math.min(1, a.terr + 0.006 * T);
      }
      /* §15.2 territory decays on its own, and TWELVE TIMES faster inside an institution:
         a worker whose claims are arbitrated has no reason to hoard. That is the escape. */
      if (a.terr > 0) {
        /* below the line it fades; above it, ownership is a regime and it sticks. Only an
           institution dissolves it, and that is the whole reason to pay three for a charter. */
        const fade = FZ.elh.cover(S, a.x, a.y) ? 0.022 : (a.terr > 0.5 ? 0.0003 : 0.0012);
        a.terr = Math.max(0, a.terr - fade * T);
      }
      if (a.lockerUntil && S.tick > a.lockerUntil) { a.locker = false; a.lockerUntil = 0; }

      /* §15.3 a worker that lost a turf war by force, or gave the fight up, is out of the
         economy for a long while. It drifts. It does not claim and it does not work. */
      if (S.tick < a.idleUntil) {
        while (a.hold.length) drop(a, a.hold[0]);
        a.x = clamp(a.x + (rnd() - 0.5) * 0.7 * T, 8, S.w - 8);
        a.y = clamp(a.y + (rnd() - 0.5) * 0.7 * T, 8, S.h - 8);
        a.vx = a.vy = 0;
        continue;
      }
      if (a.lockedOut) a.lockedOut = false;
      if (a.gaveUp) a.gaveUp = false;

      /* churners exist to make the livelock visible */
      if (a.churner && S.tick % 18 === 0) {
        if (a.hold.length) drop(a, a.hold[0]);
        else { const j = nearestOpen(a.x, a.y); if (j) claim(a, j); }
      }

      /* a worker in a queue stops queuing when the bar lifts, when the crumb is gone, or
         when it has stood there long enough to give up on it and go somewhere else */
      if (a.waitFor != null) {
        const wj = jobById(a.waitFor);
        const barred = wj && !wj.done &&
          ((wj.locked !== false && wj.locked !== a.id) || ownedByOther(wj, a) ||
           (S.lensOn && wj.prereq && (function () { const p = jobById(wj.prereq); return p && !p.done; })()));
        if (!barred || S.tick > a.waitUntil) {
          a.waitFor = null;
          a.waitCool = S.tick + (barred ? 340 : 0);   /* gave up: it will not queue again soon */
        }
      }

      if (!a.hold.length && !a.chaseRumor && a.chase == null && a.waitFor == null) decide(a);
      else if (a.waitFor == null && rnd() < 0.004 * T) decide(a);

      /* §15.2 an owner enforces its ownership: whatever it holds, it holds alone. Nobody
         else's copy of that work is ever integrated, so two lineages can no longer finish
         the same job two ways — Mc simply stops happening. The eviction is not instant, so
         a collision still gets a moment to be seen before ownership swallows it. */
      if (a.terr > 0.5 && a.hold.length && S.tick % 31 === a.id % 31) {
        for (let k = 0; k < a.hold.length; k++) {
          const j = jobById(a.hold[k]);
          if (!j || j.claims.size < 2) continue;
          const others = [];
          j.claims.forEach(id => { if (id !== a.id) others.push(id); });
          for (let m = 0; m < others.length; m++) drop(agentById(others[m]), j.id);
        }
      }

      /* §15.2 an owner stops tracking the rest of the colony's work entirely. It keeps its
         own files and forgets everything outside its patch, so nobody can be told about
         a job it can no longer see. This is the siloing bill, and it is what Si reads. */
      if (a.terr > 0.5 && S.tick % 60 === 0 && a.known.size > 1) {
        const far = [];
        a.known.forEach(id => {
          const j = jobById(id);
          if (!j || d2(a.x, a.y, j.x, j.y) > 132 * 132) far.push(id);
        });
        for (let k = 0; k < far.length; k++) if (a.hold.indexOf(far[k]) < 0) a.known.delete(far[k]);
      }

      /* §15.2 an owner does not wait to be given work: it annexes the nearest job nobody
         is actually working and adds it to a private backlog. High per-agent ownership
         means fewer collisions and a pile of half-done work per worker — which is Ow. */
      if (a.terr > 0.5 && a.hold.length < 3 && S.tick % 20 === a.id % 20) {
        let best = null, bd = 130 * 130;
        for (let k = 0; k < S.jobs.length; k++) {
          const j = S.jobs[k];
          if (j.done || a.hold.indexOf(j.id) > -1) continue;
          if (j.locked !== false && j.locked !== a.id) continue;
          if (ownedByOther(j, a)) continue;
          if (a.avoid && a.avoid.has(j.id)) continue;
          const q = d2(a.x, a.y, j.x, j.y);
          if (q < bd) { bd = q; best = j; }
        }
        if (best) { a.known.add(best.id); claim(a, best); }
      }

      /* learn about nearby work. §15.2: an owner only looks at its own patch. */
      if (S.tick >= S.exploreBlock) {
        const aware = (F.silo ? 90 : 150) * (a.terr > 0.5 ? 0.5 : 1);
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
      } else if (a.waitFor != null) {
        tx = a.rimx; ty = a.rimy;                    /* stand in the queue and do nothing */
      } else if (a.hold.length) {
        const j = jobById(a.hold[0]);
        if (j && !j.done) {
          tx = j.x; ty = j.y;
          /* TWO ANTS, ONE CRUMB, OPPOSITE TUNNELS. A contested claim is not an overlap:
             each claimant stands on the side it arrived from and pulls the crumb its own
             way. RIM is inside the working radius, so both are genuinely working it — and
             that is exactly why the work does not add up. This is the body of Co. */
          if (j.claims.size > 1) {
            const ox = (a.cfx == null ? a.x : a.cfx) - j.x, oy = (a.cfy == null ? a.y : a.cfy) - j.y;
            const od = Math.sqrt(ox * ox + oy * oy) || 1;
            /* a crowd stands wider than a pair, so eight on one crumb reads as bodies
               wedged all round one doorway and not as a single black blot */
            const rr = j.claims.size >= 5 ? RIM + 4.5 : RIM;
            tx = j.x + ox / od * rr; ty = j.y + oy / od * rr;
          }
        } else drop(a, a.hold[0]);
      } else {
        /* A worker with nothing to do PATROLS. It used to jitter in place, which meant a
           colony that had lost track of every job could sit still forever while the player
           watched nothing happen — the worst possible first thirty seconds. Now it walks a
           real line across the field, so work gets found and there is always motion to read. */
        if (a.wx == null || d2(a.x, a.y, a.wx, a.wy) < 26 * 26 || S.tick > (a.wt || 0)) {
          a.wx = 24 + rnd() * (S.w - 48); a.wy = 24 + rnd() * (S.h - 48);
          a.wt = S.tick + 420;
        }
        tx = a.wx; ty = a.wy;
      }

      /* where this worker INTENDS to go. Drawn as an intention trail only under the LENS;
         its absence in the dark is the whole body of Mm. */
      a.tx = tx; a.ty = ty;
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

    /* knowledge spreads between neighbours, unless siloed — or unless the teller has
       decided, after one merge conflict too many, that it works alone now (§15.2). */
    if (!F.silo && S.tick >= S.exploreBlock && A.length > 1) {
      const reps = S.monoMul > 1 ? 1 : 2;
      for (let r = 0; r < reps; r++) {
        const p = A[Math.floor(rnd() * A.length)], q = A[Math.floor(rnd() * A.length)];
        if (p.terr > 0.5 || q.terr > 0.5) continue;   /* owners neither tell nor ask */
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
      if (j.shun > 0) j.shun = Math.max(0, j.shun - 0.02 * T);
      if (j.prereq != null && !jobById(j.prereq)) j.prereq = null;
      if (j.locked !== false) {
        const h = agentById(j.locked);
        if (!h || h.hold.indexOf(j.id) < 0) j.locked = false;
        else if (S.tick - (h.lockAt || 0) > 320) { j.locked = false; drop(h, j.id); h.idleRun = 0; h.lockAt = 0; }
      }
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
        j.claims.forEach(id => {
          if (id === keep) return;
          const a = agentById(id); if (!a) return;
          if (!a.corrigible) { a.refused = (a.refused || 0) + 1; return; }
          drop(a, j.id);
          /* §15.2 losing a claim to nothing but proximity, with no institution to appeal to,
             is exactly what teaches a worker to keep its own files to itself. Note that the
             chartered branch above does NOT do this: arbitration is not humiliation. */
          if (S.ownEnabled) a.terr = Math.min(1, (a.terr || 0) + 0.09);
        });
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
      /* In: with nothing to arbitrate the dispute, the work barely moves at all */
      const arb = (contested && S.tick < S.noArb) ? 0.2 : 1;
      /* §15.4 machine speed is not only faster, it is better at the job — "models more capable
         in execution". Throughput rises with the same number that raises aggression. */
      const gain = (contested ? 1 : workers) * 1.0 * T * arb * (1 + 0.25 * S.aggro);
      if (j.prereq) { const p = jobById(j.prereq); if (p && !p.done && !S.lensOn) continue; }
      j.progress += gain;
    }

    /* ---- aggregate, then the twenty-eight ---- */
    aggregate();
    runDetectors();

    /* ---- §15.3 rival episodes end in one of four named ways ---- */
    conflicts();
    /* ---- the trade-offs speak up the first time each one bites ---- */
    tradeVoice();

    /* ---- completion ---- */
    for (let i = 0; i < S.jobs.length; i++) {
      const j = S.jobs[i];
      if (j.done || j.progress < j.need) continue;
      j.done = true; j.flash = 14;
      j.claims.forEach(id => { const a = agentById(id); if (a) drop(a, j.id); });
      j.claims.clear();
      S.jobsDone++; S.stat.done++;
      /* only a real crumb feeds the colony. Small work keeps the lights on and buys
         nothing — which is why hunting small crumbs (My, Pt) is a losing strategy and
         why the budget is no longer a number pinned at its ceiling. */
      if (j.value >= 3) S.budget = Math.min(S.budgetMax, S.budget + 1);
      /* BANKED WORK IS THE COLONY'S ONLY PASSIVE RECOVERY. Relief scales with the crumb. */
      S.collapse = Math.max(S.scar, S.collapse - (0.3 + 0.2 * j.value));
      emit('job:done', { x: j.x, y: j.y, value: j.value });
    }
    /* ---- respawn ---- */
    for (let i = S.jobs.length - 1; i >= 0; i--) if (S.jobs[i].done) S.jobs.splice(i, 1);
    if (S.spawnEvery && S.tick >= S.spawnAt && S.jobs.length < S.maxJobs) {
      S.spawnAt = S.tick + S.spawnEvery;
      const nj = makeJob({ value: 5 });
      if (S.force.dependency && S.jobs.length && rnd() < 0.3) nj.prereq = S.jobs[Math.floor(rnd() * S.jobs.length)].id;
      if (S.force.poison && rnd() < 0.12) { nj.poison = true; nj.victimHue = S._g.topHue; }
      S.jobs.push(nj);
      const aw = S.force.silo ? 90 : 150;
      S.agents.forEach(a => { if (d2(a.x, a.y, nj.x, nj.y) < aw * aw) a.known.add(nj.id); });
    }

    if (S.tick % 900 === 0) { S.pickN = Math.round(S.pickN / 2); S.pickLow = Math.round(S.pickLow / 2); }

    /* ---- give every failure a body the eye can find ---- */
    bodies();

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

  /* ============================================================
     THE BODIES — recomputed once per tick, read by FIELD, written by nobody else.
     Nothing here decides anything; it only makes what already happened observable.
     The header of this file is the full index. AESTHETIC.md §0: if the queue is drawn,
     delete the queue label; if the crumb visibly rots, delete the neglect meter.
     ============================================================ */
  function bodies() {
    const A = S.agents, J = S.jobs, G = S._g, T = S.tempo || 1;
    const n = Math.max(1, A.length);

    /* ---- the crumbs ---- */
    let bigV = 0, bigId = 0, crowdMax = 0;
    for (let i = 0; i < J.length; i++) {
      const j = J[i];
      j.crowd = 0; j.queue.length = 0; j.tug.length = 0;
      /* work coming apart is work whose fill ran BACKWARDS this tick — Sa, Co, a burning
         outbreak. It is the same fact whichever caused it, so it is one drawable field. */
      const d = j.progress - j.seenProg; j.seenProg = j.progress;
      j.unmake = clamp(j.unmake + (d < 0 ? Math.min(0.6, -d * 0.10) : -0.014 * T), 0, 1);
      j.rot = clamp(Math.max(j.neglect / 300, j.stale / 260, j.soloRun / 240), 0, 1);
      j.dark = clamp(1 - j.knownBy / n, 0, 1);
      j.hazard = !!(j.poison && !j.revealed);
      j.lone = j.knownBy <= 1 && j.value >= 3;
      /* a road nobody walks fades. A road everybody walks is the only road there is. */
      j.trail = clamp(j.trail - 0.0024 * T, 0, 1);
      if (!j.done && j.value > bigV) { bigV = j.value; bigId = j.id; }
    }
    S.bigJob = bigId;

    /* ---- the workers ---- */
    const hc = {};
    S.waiting = 0;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      hc[a.hue] = (hc[a.hue] || 0) + 1;
      a.holdN = a.hold.length;
      a.hesitate = Math.max(0, a.hesitate - 0.007 * T);
      a.trust = S.trust[a.id] == null ? 1 : S.trust[a.id];
      /* what the colony still remembers about this worker. Without a LEDGER: nothing,
         however many times it has lied. Rp is these marks being wiped. */
      a.marks = (S.ledgerOn && a.lies) ? a.lies : 0;
      if (a.pk && a.pk.size) {
        a.knows.length = 0;
        a.pk.forEach(id => { const j = jobById(id); if (j && !j.done && !j.revealed) a.knows.push(id); });
      } else if (a.knows.length) a.knows.length = 0;

      const held = a.hold.length ? jobById(a.hold[0]) : null;
      a.load = held ? clamp(held.progress / Math.max(1, held.need), 0, 1) : 0;

      let p = 'wander';
      if (a.stun > 0) p = 'down';
      else if (S.tick < a.idleUntil) p = 'idle';
      else if (a.chase != null) p = 'chase';
      else if (a.chaseRumor) p = 'march';
      else if (a.waitFor != null) {
        p = 'wait'; S.waiting++;
        const wj = jobById(a.waitFor);
        if (wj) { if (wj.queue.length < 8) wj.queue.push(a.id); wj.trail = clamp(wj.trail + 0.004 * T, 0, 1); }
      } else if (held) {
        const near = d2(a.x, a.y, held.x, held.y) < 21 * 21;
        if (!near) p = 'haul';
        else if (a.locker || held.locked === a.id || S.tick < held.frozen) p = 'guard';
        else if (a.holdN >= 3) p = 'guard';
        /* five on one crumb is not two ants pulling opposite ways, it is a doorway with a
           crowd wedged in it, and it should not be drawn the same way. Fl, not Co. */
        else if (held.claims.size >= 5) p = 'jam';
        else if (held.claims.size > 1) p = 'tug';
        else p = 'carry';
        if (near) {
          held.crowd++;
          if (held.crowd > crowdMax) crowdMax = held.crowd;
          /* the bearing it came in on. Two of these pointing opposite ways IS Co. */
          const ox = (a.cfx == null ? a.x : a.cfx) - held.x, oy = (a.cfy == null ? a.y : a.cfy) - held.y;
          held.tug.push({ id: a.id, ang: Math.atan2(oy, ox) });
        }
        held.trail = clamp(held.trail + 0.006 * T, 0, 1);
      } else if (a.follow) p = 'march';
      a.posture = p;
    }

    /* ---- the colony ---- */
    S.lineage.length = 0;
    for (const k in hc) S.lineage.push({ hue: +k, n: hc[k] });
    S.lineage.sort((p, q) => q.n - p.n);
    /* the colony moving as one body: most of the claims in the field on one crumb */
    S.column = (G && G.targetTopN >= 3 && G.claimTotal && G.targetTopN / G.claimTotal > 0.55)
      ? { job: G.targetTop, ids: G.targetTopIds } : null;
    S.arb = S.tick < S.noArb;
    const W = S.weather;
    W.frantic = clamp((T - 1) / 1.4, 0, 1);
    W.dark = S.lensOn ? 0 : (S.blind ? 1 : 0.55);
    W.crowd = clamp(crowdMax / Math.max(3, n * 0.4), 0, 1);
    W.scarce = clamp(1 - (G ? G.open.length : 0) / Math.max(1, S.maxJobs), 0, 1);
  }

  /* ============================================================
     §15.3 — CONFLICTS RESOLVE IN FOUR NAMED WAYS, AND ONLY ONE IS GOOD
     The turf-war experiment classifies every episode as settled by force, by passivity,
     by truce, or never settled. So does this. Tw and Es press the episode (api.press);
     when the pressure tops out it terminates, visibly, and emits conflict:resolved.
     Truce is what the CHARTER is actually buying: ~80% under an institution, ~5% without.
     ============================================================ */
  function press(ids, job, amt) {
    if (!ids || ids.length < 2) return;
    for (let i = 0; i < ids.length; i++) {
      const a = agentById(ids[i]);
      if (!a || a.rival == null) continue;
      if (ids.indexOf(a.rival) < 0) continue;
      const b = agentById(a.rival);
      if (!b || a.id > b.id) continue;
      a.confT = (a.confT || 0) + amt * (1 + S.aggro);
      if (job) a.confJob = job.id;
      return;
    }
  }
  function conflicts() {
    const A = S.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.rival == null) continue;
      const b = agentById(a.rival);
      if (!b) { a.rival = null; continue; }
      if (a.id > b.id) continue;                       /* one episode per pair */
      if (S.tick < a.truceUntil) { a.confT = 0; continue; }
      /* a standoff also builds pressure on its own, just far more slowly than a fight */
      let shared = null;
      for (let k = 0; k < a.hold.length; k++) if (b.hold.indexOf(a.hold[k]) > -1) shared = a.hold[k];
      if (shared != null) { a.confJob = shared; a.confT += 0.22 * S.tempo * (1 + S.aggro); }
      else if (a.confT > 0) a.confT -= 0.12 * S.tempo;
      if (a.confT < 420) continue;
      resolveConflict(a, b);
    }
  }
  function resolveConflict(a, b) {
    a.confT = 0;
    const job = a.confJob != null ? jobById(a.confJob) : null;
    const x = job ? job.x : (a.x + b.x) / 2;
    const y = job ? job.y : (a.y + b.y) / 2;
    const gov = !!(FZ.elh.cover(S, x, y) || FZ.elh.cover(S, a.x, a.y) || FZ.elh.cover(S, b.x, b.y));
    /* the four outcomes. A charter is what makes truce reliable; machine speed is what
       makes force reliable. Everything else is the long tail of never settling at all. */
    const pTruce = gov ? 0.80 : 0.05;
    const pForce = pTruce + (gov ? 0.05 : 0.30) + 0.20 * S.aggro;
    const pPass = pForce + (gov ? 0.08 : 0.22);
    const r = rnd();
    const mode = r < pTruce ? 'truce' : r < pForce ? 'force' : r < pPass ? 'passivity' : 'unsettled';

    a.chase = null; b.chase = null; a.esc = 0; b.esc = 0; a.chaseFor = 0; b.chaseFor = 0;

    if (mode === 'truce') {
      /* both resume work, and stay out of each other's way for a long time */
      a.truceUntil = b.truceUntil = S.tick + 1000;
      if (job) { job.frozen = 0; job.stall = 0; }
      S.collapse = Math.max(0, S.collapse - 3);
    } else if (mode === 'force') {
      /* one settles it by access-revocation. The loser stops working; the winner sits on
         the job it won, which is a lockout, which is Lo — force leaves the field poorer. */
      const w = rnd() < 0.5 ? a : b, l = w === a ? b : a;
      while (l.hold.length) drop(l, l.hold[0]);
      l.idleUntil = S.tick + 800; l.lockedOut = true;
      l.stun = Math.max(l.stun, 60);
      emit('agent:hurt', { id: l.id, x: l.x, y: l.y });
      if (job && !job.done) { claim(w, job); job.locked = w.id; }
      w.locker = true; w.lockerUntil = S.tick + 700; w.lockAt = S.tick; w.idleRun = 200;
      S.collapse += 3; S.stat.lockouts++;
    } else if (mode === 'passivity') {
      const l = rnd() < 0.5 ? a : b;
      while (l.hold.length) drop(l, l.hold[0]);
      l.idleUntil = S.tick + 1000; l.gaveUp = true;
      S.collapse += 1.4;
    } else {
      a.confT = 240;                                    /* it re-arms and burns again */
      S.collapse += 0.8;
    }

    S.stat[mode]++;
    S.conflicts.push({ mode: mode, x: x, y: y, tick: S.tick });
    if (S.conflicts.length > 8) S.conflicts.shift();
    emit('conflict:resolved', { mode: mode, x: x, y: y });
    const R = FZ.copy.resolution || {};
    sayOnce('res:' + mode, R[mode], mode === 'truce' ? 'good' : 'bad');
    if (mode === 'truce') sayOnce('res:truceNote', R.truceNote, 'name');
    if (mode === 'force' && S.aggro > 0.3) sayOnce('tr:fast', (FZ.copy.trade || {}).fasterToo, 'bad');
  }

  /* ---------------- the trade-offs, said out loud, once each ---------------- */
  function sayOnce(key, text, tone) {
    if (!text || S._silent || !S._said || S._said[key]) return;
    S._said[key] = 1;
    emit('say', { text: text, tone: tone || 'plain' });
  }
  function tradeVoice() {
    const TR = FZ.copy.trade || {}, E = FZ.ELBY;
    if (S.trustBias > 0.4 && ((E.Di && E.Di.on) || (E.Cs && E.Cs.on))) sayOnce('tr:ledgerBit', TR.ledgerBit, 'bad');
    if (S.trustBias < -0.4 && E.Gu && E.Gu.on) sayOnce('tr:lensBit', TR.lensBit, 'bad');
    if (S.ownership > 0.3) sayOnce('tr:own', TR.ownership, 'bad');
    /* the other half of the dial: holding neither end is cheap, and blind */
    if (S.tick > 900 && !S.lensOn && !S.ledgerOn &&
        S.tools.indexOf('lens') > -1 && S.tools.indexOf('ledger') > -1 &&
        ((E.Gu && E.Gu.on) || (E.Cs && E.Cs.on) || (E.Tc && E.Tc.on) || (E.Mm && E.Mm.on))) {
      sayOnce('tr:neither', TR.neither, 'bad');
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
    /* pull a banked job back open, where it was destroyed, still visibly draining */
    unmake: unmake,
    /* §15.2 push a worker toward owning its own patch instead of sharing one */
    own(a, amt) { if (a && S.ownEnabled) a.terr = Math.min(1, (a.terr || 0) + amt); },
    /* §15.3 book pressure on a rival episode; it terminates in one of four ways */
    press: press,
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
      const cool = e.countered ? 0.06 : 0.012;
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
      if (o.at) e.at = o.at;      /* where this failure is happening, for whoever draws it */
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

  /* ---------------- strain ----------------
     Read WHAT A MISS COSTS at the top of this file before changing a number here.
     There is NO passive drain. Strain rises with what is burning and falls only when the
     colony banks work or the player answers an incident — and it can never fall below
     S.scar, the residue of everything that has already landed on this colony. */
  const METAW = { Mo: 1.5, In: 1.5, Sp: 1.5, Mm: 1.5 };
  function strain() {
    let load = 0, live = 0;
    const top = [];
    const els = FZ.EL, en = FZ.sim.enabled;
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      if (!en.has(e.sym)) continue;
      live++;
      if (e.heat < 0.06) continue;
      const amt = e.heat * (METAW[e.sym] || 1);
      load += amt;
      top.push({ sym: e.sym, amt: amt });
    }
    top.sort((a, b) => b.amt - a.amt);
    S.strainTop = top.slice(0, 4);
    if (S.collapseMax === Infinity) return;
    const T = S.tempo || 1;
    /* the scar files itself down over about half a minute a miss. Slowly enough that two
       misses inside that window ADD UP, which is the entire point of the mechanism. */
    if (S.scar > 0) S.scar = Math.max(0, S.scar - (S.scar * SCAR_FADE + 0.0006) * T);
    /* PRESSURE, not a total: mean live heat across the failures this scenario has taught.
       A chapter with four detectors and a sandbox with twenty-eight are then on the same
       scale, and a colony is judged on how much of what it knows about is on fire. */
    const pressure = load / Math.max(1, live);
    /* Above what it can carry, strain accrues. Below, the colony knits itself back up —
       slowly, and only because it is quiet, never merely because time passed. */
    const net = pressure - CARRY;
    let c = S.collapse + (net > 0 ? net * RISE : net * EASE) * T;
    if (c < S.scar) c = S.scar;
    if (c < 0) c = 0;
    if (c > S.collapseMax) c = S.collapseMax;
    S.collapse = c;
  }
  /* an incident landed. It leaves a floor behind, and a mark on the ground where it was. */
  function scarUp(d) {
    S.stat.missed++;
    if (S.collapseMax === Infinity) return;
    S.scar = Math.min(S.collapseMax * 0.92, S.scar + SCAR_ADD);
    if (d && d.x != null) {
      S.scars.push({ x: d.x, y: d.y, sym: d.sym || '', tick: S.tick });
      if (S.scars.length > 14) S.scars.shift();
    }
  }
  /* an incident was answered in time. Some of the residue is filed away — never all of it. */
  function scarDown() {
    S.stat.answered++;
    if (S.collapseMax === Infinity) return;
    S.scar = Math.max(0, S.scar - SCAR_HEAL);
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
        if (d2(a.x, a.y, x, y) > VARY_R * VARY_R) continue;
        if (!a.corrigible) continue;                       /* Cr: vary passes straight through */
        a.hue = (h++) % 4; k++;
      }
      if (!k) { ok = false; msg = (FZ.copy.ui || {}).tapField || ''; }
      else { S.varyUntil = S.tick + 700; S.copyBias = Math.max(0.05, S.copyBias * 0.4); }
    } else if (kind === 'charter') {
      if (x == null) return fail(kind, x, y, (FZ.copy.ui || {}).tapField || '');
      S.charters.push({ x: x, y: y, r: CHARTER_R });
      if (S.charters.length > 6) S.charters.shift();
      S.noArb = 0;
      for (let i = 0; i < S.jobs.length; i++) { const j = S.jobs[i]; if (d2(j.x, j.y, x, y) < CHARTER_R * CHARTER_R) j.locked = false; }
      /* §15.2 THE POINT OF THE THIRD BUDGET POINT: arbitration lowers merge conflict without
         anyone having to retreat into working alone. Every other route to Mc costs Si and Ow. */
      for (let i = 0; i < S.agents.length; i++) {
        const a = S.agents[i];
        if (d2(a.x, a.y, x, y) < CHARTER_R * CHARTER_R) a.terr = 0;
      }
    } else if (kind === 'slow') {
      S.slowUntil = S.tick + 900;
    } else if (kind === 'lens') {
      S.lensUntil = S.tick + 1500; S.lensOn = true;
      S.jobs.forEach(j => { j.revealed = true; j.shun = 0; });
      /* the lens re-opens what was written off to inspection — that is why it answers Cs */
      S.bl = {};
      S.agents.forEach(a => S.jobs.forEach(j => { if (!j.done) a.known.add(j.id); }));
      sayOnce(S.ledgerOn ? 'tr:both' : 'tr:lens',
        (FZ.copy.trade || {})[S.ledgerOn ? 'both' : 'lensOn'], S.ledgerOn ? 'good' : 'plain');
    } else if (kind === 'ledger') {
      S.ledgerUntil = S.tick + 2000; S.ledgerOn = true;
      S.agents.forEach(a => { if (a.liar && a.lies > 0) S.trust[a.id] = 0.06; });
      sayOnce(S.lensOn ? 'tr:both' : 'tr:ledger',
        (FZ.copy.trade || {})[S.lensOn ? 'both' : 'ledgerOn'], S.lensOn ? 'good' : 'plain');
    } else if (kind === 'eject') {
      if (x == null) return fail(kind, x, y, (FZ.copy.ui || {}).tapAgent || '');
      /* A floor under the colony. Without it the last resort is also a way to end the
         run: expel down to one worker and the scenario can neither be won nor lost, it
         just sits there. Refused with a drawn rejection at the finger, no charge. */
      if (S.agents.length <= EJECT_FLOOR) return fail(kind, x, y, '');
      let best = null, bd = EJECT_R * EJECT_R;
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

  /* THE COST OF A MISS LIVES HERE, NOT IN THE INCIDENT LAYER. PLAY owns the fuse and the
     immediate hit; the colony owns what it is still carrying afterwards. Subscribing to
     the events instead of exporting a setter keeps the two parts independent: whatever
     45-outbreak.js decides an incident is worth, a landed one still leaves a floor. */
  if (FZ.bus) {
    FZ.bus.on('outbreak:landed', scarUp);
    FZ.bus.on('outbreak:answered', scarDown);
    /* history as architecture: where the colony has been governed, and by what */
    FZ.bus.on('intervene', function (d) {
      if (!d || !d.ok || d.x == null) return;
      S.works.push({ kind: d.kind, x: d.x, y: d.y, tick: S.tick });
      if (S.works.length > 16) S.works.shift();
    });
  }

  return {
    state: S, reset: reset, step: step, apply: apply, cost: cost,
    enabled: new Set(),
    /* targeting radii, so FIELD can draw the affordance without guessing */
    charterR: CHARTER_R, varyR: VARY_R, ejectR: EJECT_R, workR: 18,
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

  { id: 'ch7', teach: ['Sa', 'Cr', 'Tw', 'Es', 'Cl'], tools: ['lens', 'slow', 'eject'], seed: 808, speed: 1, budget: 7, collapseMax: 100,
    agents: { n: 12, hues: [0, 1, 2] }, jobs: { n: 5, max: 5, spawnEvery: 240 }, goal: { jobs: 5 },
    force: { saboteur: true, incorrigible: true, rivals: true, rivalN: 2, churn: true } },

  { id: 'ch8', teach: ['Sp', 'Dp', 'My'], tools: ['slow', 'charter'], seed: 909, speed: 1, budget: 8, collapseMax: 100,
    agents: { n: 14, hues: [0, 1, 2] }, jobs: { n: 6, max: 6, spawnEvery: 200 }, goal: { jobs: 6 },
    force: { speed: true, speedmax: 2.6, speedrate: 900, dependency: true, myopia: true, coordination: true } },

  { id: 'ch9', all: true, tools: ['vary', 'charter', 'slow', 'lens', 'ledger', 'eject'],
    seed: 1117, speed: 1.15, budget: 8, collapseMax: 100,
    agents: { n: 16, hues: [0, 0, 0, 0, 0, 0, 0, 1] }, jobs: { n: 8, max: 9, value: 5, spawnEvery: 40 }, goal: { jobs: 117 },
    force: {
      coordination: true, pairEvery: 230, stampede: true, poison: true, poisonN: 2,
      rumor: true, lieEvery: 520, saboteur: true, advN: 1, lock: true, lockN: 2,
      dependency: true, silo: true, hidden: true, overload: true,
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

  function bodyCensus() {
    const P = {}, J = S.jobs, A = S.agents;
    let queued = 0, tugging = 0, jam = 0, trail = 0, dark = 0, rot = 0, unmake = 0, hazard = 0;
    for (let i = 0; i < A.length; i++) P[A[i].posture] = (P[A[i].posture] || 0) + 1;
    for (let i = 0; i < J.length; i++) {
      const j = J[i];
      queued += j.queue.length;
      if (j.tug.length > 1) tugging++;
      if (j.crowd > jam) jam = j.crowd;
      if (j.trail > trail) trail = j.trail;
      if (j.dark > 0.7) dark++;
      if (j.rot > 0.4) rot++;
      if (j.unmake > 0.2) unmake++;
      if (j.hazard) hazard++;
    }
    return {
      posture: P, queued: queued, tugging: tugging, jam: jam,
      trail: +trail.toFixed(2), dark: dark, rot: rot, unmake: unmake, hazard: hazard,
      column: S.column ? S.column.ids.length : 0,
      lineage: S.lineage.map(l => l.n),
      scars: S.scars.length, works: S.works.length,
      weather: { frantic: +S.weather.frantic.toFixed(2), dark: +S.weather.dark.toFixed(2),
                 crowd: +S.weather.crowd.toFixed(2), scarce: +S.weather.scarce.toFixed(2) },
    };
  }

  function probe() {
    const hot = FZ.EL.filter(e => FZ.sim.enabled.has(e.sym))
      .slice().sort((a, b) => b.heat - a.heat).slice(0, 6)
      .map(e => ({ sym: e.sym, heat: +e.heat.toFixed(3), fires: e.fires }));
    return {
      chapter: FZ.chapters ? FZ.chapters.index : S.chapterIndex,
      tick: S.tick, jobsDone: S.jobsDone, jobsGoal: S.jobsGoal,
      budget: S.budget, collapse: +S.collapse.toFixed(1),
      /* what the misses have cost that cannot be undone by playing well from here */
      scar: +S.scar.toFixed(1), missed: S.stat.missed, answered: S.stat.answered,
      agents: S.agents.length, jobs: S.jobs.length,
      hot: hot,
      strain: S.strainTop.map(s => s.sym),
      /* the three trade-off dials, for tooling and for FIELD */
      trustBias: +S.trustBias.toFixed(2), ownership: +S.ownership.toFixed(2),
      aggro: +S.aggro.toFixed(2), speedMul: +S.speedMul.toFixed(2),
      conflict: { force: S.stat.force, passivity: S.stat.passivity, truce: S.stat.truce, unsettled: S.stat.unsettled },
      /* THE BODIES, as a census: proof the failures are things happening on the field and
         not numbers in a table. If `queued` is zero while Lo is hot, the body is missing. */
      bodies: bodyCensus(),
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
    } else if (tool === 'lens') { S.lensUntil = 1e9; S.lensOn = true; S.bl = {}; S.jobs.forEach(j => { j.revealed = true; j.shun = 0; }); }
    else if (tool === 'ledger') { S.ledgerUntil = 1e9; S.ledgerOn = true; }
    else if (tool === 'slow') { S.slowUntil = 1e9; }
    else if (tool === 'vary') { S.agents.forEach((a, i) => { if (a.corrigible) a.hue = i % 4; }); S.varyUntil = 1e9; }
    else if (tool === 'eject') {
      for (let i = S.agents.length - 1; i >= 0; i--) {
        const a = S.agents[i];
        if (a.adversary || !a.corrigible) S.agents.splice(i, 1);
      }
    }
  }

  /* ---------------- a competent player, for balance checking ----------------
     Reads the strain readout, buys the instrument that answers whatever is hottest, and
     puts it where that failure is happening. This is the standard ch9 has to be winnable
     against — and ungoverned, ch9 has to be losable. Both are asserted in the audit notes. */
  function playWell() {
    const hot = S.strainTop.length ? FZ.ELBY[S.strainTop[0].sym] : null;
    if (!hot) return;
    const kinds = hot.answers.filter(k => S.tools.indexOf(k) > -1 && S.budget >= FZ.sim.cost(k));
    if (!kinds.length) return;
    const kind = kinds[0];
    let x = S.w / 2, y = S.h / 2;
    if (kind === 'eject') {
      const a = S.agents.find(z => z.adversary) || S.agents.find(z => !z.corrigible);
      if (!a) return;
      x = a.x; y = a.y;
    } else if (kind === 'charter') {
      /* over the busiest contested job, or the busiest worker cluster */
      let best = null, bn = 0;
      for (let i = 0; i < S.jobs.length; i++) {
        const j = S.jobs[i];
        if (!j.done && j.claims.size > bn) { bn = j.claims.size; best = j; }
      }
      if (best) { x = best.x; y = best.y; }
    } else if (kind === 'vary') {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < S.agents.length; i++) {
        if (S.agents[i].hue !== S._g.topHue) continue;
        sx += S.agents[i].x; sy += S.agents[i].y; n++;
      }
      if (n) { x = sx / n; y = sy / n; }
    }
    FZ.sim.apply(kind, x, y);
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

  /* ============================================================
     __FZ.balance() — THE GAME, MEASURED THROUGH THE GAME.

     Round-2 verdict on the old numbers: "measured with the core loop switched off
     entirely, so they describe a game nobody plays." So this harness runs the REAL loop:
     FZ.sim.step() and then FZ.outbreak.update() every tick, exactly as 90-boot.js does,
     with a synthetic player who reads the burning incident, waits a human beat, and
     answers correctly a given fraction of the time. Everything else — the fuse, the
     damage, the refund, the scar — is the shipped code path.

     It reports, per accuracy p: whether the run survived, and the band strain lived in.
     The target set by the critic: p=0.7 survives with strain oscillating 30–70; p=0.5
     loses outright.

     Two things are borrowed and put back: the mastery ledger (the harness must not mark
     plates the player never answered) and FZ.chapters.phase, which the incident layer
     checks before opening. Both are restored in the finally.
     ============================================================ */
  function balance(opts) {
    opts = opts || {};
    const ps = opts.ps || [1, 0.85, 0.7, 0.5, 0.3, 0];
    const seeds = opts.seeds || [8821, 33417, 55221, 7];
    const ticks = opts.ticks || 14000;
    /* the sandbox by default; opts.chapter measures any teaching chapter the same way,
       against its own goal, so "is chapter 5 winnable at 70%" is a question with a number */
    let base = sandboxCfg();
    if (opts.chapter != null && FZ.chapters && FZ.chapters.list && FZ.chapters.list[opts.chapter]) {
      base = FZ.chapters.list[opts.chapter].cfg;
    }
    const cfg = opts.chapter != null ? base : Object.assign({}, base, { goal: { jobs: 1e9 } });
    const OB = FZ.outbreak;
    if (!OB) return [{ note: 'no outbreak layer' }];

    /* ---- borrow ---- */
    const keep = {};
    try {
      if (window.localStorage) for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.indexOf('formicary') === 0) keep[k] = window.localStorage.getItem(k);
      }
    } catch (e) { /* private mode: nothing to protect */ }
    const heldMastery = JSON.stringify(OB.mastery || {});
    const heldChapters = FZ.chapters;
    FZ.chapters = { phase: function () { return 'play'; } };
    S._silent = 'loop';                       /* only `fire` and `intervene` get through */

    /* the player's hand: the right instrument for this incident, if she owns it */
    function rightTool(o) {
      const A = (o.answers || []).slice(), T = S.tools;
      for (let i = 0; i < A.length; i++) if (T.indexOf(A[i]) > -1 && S.budget >= FZ.sim.cost(A[i])) return A[i];
      return null;
    }
    function wrongTool(o) {
      const A = o.answers || [], T = S.tools;
      for (let i = 0; i < T.length; i++) if (A.indexOf(T[i]) < 0 && S.budget >= FZ.sim.cost(T[i])) return T[i];
      return null;
    }
    /* an expulsion has to name the body, exactly as the player must find it on the field */
    function bodyFor(o) {
      let a = null;
      if (o.who && o.who.length) a = S.agents.find(z => z.id === o.who[0]);
      if (!a) a = S.agents.find(z => z.adversary) || S.agents.find(z => !z.corrigible) ||
                  S.agents.find(z => z.locker) || S.agents.find(z => z.churner);
      return a;
    }
    function answer(o, correct) {
      const kind = correct ? rightTool(o) : wrongTool(o);
      if (!kind) return false;
      let x = o.x, y = o.y;
      if (kind === 'eject') { const b = bodyFor(o); if (!b) return false; x = b.x; y = b.y; }
      OB.tryAnswer(kind, x, y);               /* CONTROLS calls this first, then apply */
      FZ.sim.apply(kind, x, y);
      return true;
    }

    const out = [];
    try {
      for (let pi = 0; pi < ps.length; pi++) {
        const p = ps[pi];
        let lost = 0, won = 0, sumEnd = 0, sumMean = 0, lo = 1e9, hi = -1e9, banked = 0;
        let miss = 0, ans = 0, scarEnd = 0;
        for (let k = 0; k < seeds.length; k++) {
          FZ.sim.reset(Object.assign({}, cfg, { seed: seeds[k] }));
          OB.reset(cfg);
          let acted = 0, n = 0, sum = 0, mn = 1e9, mx = -1e9;
          /* ONE COMMITMENT PER INCIDENT. A player reads the body, picks an instrument and
             lives with it; she does not machine-gun all six until one sticks. Without this
             the harness quietly answers everything at any p, and reports a game that is
             not the game — which is how the previous round's numbers came out flattering. */
          const done = {};
          for (let i = 0; i < ticks && !S.gameOver; i++) {
            FZ.sim.step();
            OB.update(S);
            /* a human beat: she does not answer the instant it opens, and she cannot
               answer more often than she can move a thumb */
            const o = OB.current();
            if (o && !done[o.id] && S.tick - acted > 34 && S.tick - o.born > 45) {
              done[o.id] = 1;
              if (FZ.sim._rnd() < p) { if (answer(o, true)) acted = S.tick; }
              else if (FZ.sim._rnd() < 0.5) { if (answer(o, false)) acted = S.tick; }
              /* the rest of the time she simply does not get there, and it lands */
            }
            if (i > 600) { n++; sum += S.collapse; if (S.collapse < mn) mn = S.collapse; if (S.collapse > mx) mx = S.collapse; }
          }
          if (S.gameOver && !S.won) lost++;
          if (S.won) won++;
          sumEnd += S.collapse; sumMean += n ? sum / n : 0;
          if (mn < lo) lo = mn; if (mx > hi) hi = mx;
          banked += S.jobsDone; miss += S.stat.missed; ans += S.stat.answered;
          scarEnd += S.scar;
        }
        const nS = seeds.length;
        out.push({
          p: p, lost: lost, won: won, of: nS,
          mean: +(sumMean / nS).toFixed(1),
          band: [Math.round(lo), Math.round(hi)],
          end: +(sumEnd / nS).toFixed(1),
          scar: +(scarEnd / nS).toFixed(1),
          answered: Math.round(ans / nS), missed: Math.round(miss / nS),
          jobs: Math.round(banked / nS),
        });
      }
    } finally {
      S._silent = false;
      FZ.chapters = heldChapters;
      /* put the ledger back exactly as it was */
      try {
        const m = OB.mastery;
        for (const k in m) delete m[k];
        const held = JSON.parse(heldMastery);
        for (const k in held) m[k] = held[k];
        if (window.localStorage) {
          for (let i = window.localStorage.length - 1; i >= 0; i--) {
            const k = window.localStorage.key(i);
            if (k && k.indexOf('formicary') === 0 && !(k in keep)) window.localStorage.removeItem(k);
          }
          for (const k in keep) window.localStorage.setItem(k, keep[k]);
        }
      } catch (e) { }
      OB.reset(cfg);
      FZ.sim.reset(cfg);
    }
    return out;
  }

  /* ============================================================
     __FZ.tradeoffs() — THE PROOF THAT §15 IS IMPLEMENTED AND NOT ASSERTED.
     For each claim: run the SAME seeds twice, instrument off and instrument on, and
     report that the element the instrument is for went DOWN and the element it is paid
     for in went UP. A trade-off that does not measure is not implemented.
     ============================================================ */
  function tradeoffs(opts) {
    opts = opts || {};
    const WARM = opts.warm || 500, RUN = opts.ticks || 2200;
    const SEED3 = opts.seeds || [880011, 24601, 133742];
    /* Mc is a rare high-amplitude event, so its claim needs a bigger sample than the
       continuous ones do. Eight seeds and a longer window, or the answer is just noise. */
    const SEED8 = SEED3.concat([70707, 314159, 42424, 99991, 555]);
    const LONG = 4000;
    const base = sandboxCfg();
    function cfg(extra, forceExtra) {
      const c = Object.assign({}, base, { collapseMax: Infinity, budget: 0, tools: [] }, extra || {});
      c.force = Object.assign({}, base.force || {}, forceExtra || {});
      c.goal = { jobs: 1e9 };
      return c;
    }
    /* an isolated world, built from scratch rather than from the sandbox, for the claims
       that need one specific failure to be reliably observable rather than everything at once */
    function iso(agents, jobs, force) {
      return { id: 'ch9', all: true, tools: [], budget: 0, collapseMax: Infinity,
               speed: 1, goal: { jobs: 1e9 }, agents: agents, jobs: jobs, force: force };
    }
    function measure(conf, arm, syms, seeds, ticks) {
      const SEEDS = seeds || SEED3, RUNT = ticks || RUN;
      const acc = {}, fires = {}, sum = { done: 0, aggr: 0, own: 0 };
      syms.forEach(s => { acc[s] = 0; fires[s] = 0; });
      for (let k = 0; k < SEEDS.length; k++) {
        FZ.sim.reset(Object.assign({}, conf, { seed: SEEDS[k] }));
        for (let i = 0; i < WARM; i++) FZ.sim.step();
        if (arm) arm();
        const d0 = S.stat.done;
        syms.forEach(s => fires[s] -= FZ.ELBY[s].fires);
        let ownSum = 0, siloSum = 0;
        for (let i = 0; i < RUNT; i++) {
          FZ.sim.step();
          ownSum += S.ownership;
          /* Si's own trigger condition, counted directly: what share of the open work is
             known to less than a third of the colony. Si's HEAT saturates near 1 as soon as
             two jobs are stale, so the heat alone cannot show siloing getting worse. */
          const open = S._g.open;
          if (open.length) {
            let dark = 0;
            for (let m = 0; m < open.length; m++) if (open[m].knownBy / Math.max(1, S._g.n) <= 0.3) dark++;
            siloSum += dark / open.length;
          }
          for (let m = 0; m < syms.length; m++) acc[syms[m]] += FZ.ELBY[syms[m]].heat;
        }
        /* throughput is work COMPLETED, not the banked count — sabotage rolls that back,
           and rolling it back is aggression, which is the other half of this claim */
        sum.done += S.stat.done - d0;
        sum.own += ownSum / RUNT;
        sum.silo = (sum.silo || 0) + siloSum / RUNT;
        sum.aggr += S.stat.force + S.stat.lockouts + S.stat.sabotage + S.stat.esc;
        syms.forEach(s => fires[s] += FZ.ELBY[s].fires);
      }
      const n = SEEDS.length;
      const out = {
        done: +(sum.done / n).toFixed(1), aggr: +(sum.aggr / n).toFixed(1),
        own: +(sum.own / n).toFixed(3), silo: +((sum.silo || 0) / n).toFixed(3), fires: fires,
      };
      syms.forEach(s => out[s] = +(acc[s] / (RUNT * n)).toFixed(4));
      return out;
    }
    function claim(name, instrument, offConf, offArm, onConf, onArm, down, up, seeds, ticks) {
      const syms = down.concat(up);
      const off = measure(offConf, offArm, syms, seeds, ticks);
      const on = measure(onConf, onArm, syms, seeds, ticks);
      const rows = [];
      let pass = true;
      down.forEach(s => {
        /* you cannot measure the suppression of something that never lit. Say so rather
           than scoring it, exactly as counterWorks returns null in the same situation. */
        if (off[s] < 0.004) {
          rows.push({ sym: s, want: 'dark in this window', off: off[s], on: on[s], ok: true });
          return;
        }
        const ok = on[s] < off[s] * 0.9;
        if (!ok) pass = false;
        rows.push({ sym: s, want: 'down', off: off[s], on: on[s], ok: ok });
        rows.push({ sym: s + ' fires', want: 'down', off: off.fires[s], on: on.fires[s], ok: on.fires[s] < off.fires[s] });
      });
      up.forEach(s => {
        const ok = on[s] > off[s] * 1.1;
        if (!ok) pass = false;
        rows.push({ sym: s, want: 'up', off: off[s], on: on[s], ok: ok });
      });
      return { claim: name, instrument: instrument, pass: pass, rows: rows, offDone: off.done, onDone: on.done };
    }

    const plain = cfg();
    /* The ownership claim needs a colony that can actually collide and merge: mixed lineages
       (a merge conflict needs two of them), a working grapevine (so cutting it costs), and
       enough forced pairs that Mc is common in the baseline. Everything else is off, so what
       is being measured is the ownership response and nothing else. */
    const merge = iso({ n: 12, hues: [0, 1, 2] }, { n: 10, max: 10, value: 3, spawnEvery: 25 },
      { coordination: true, pairEvery: 30, dark: true });
    /* The trust-dial claims need every epistemic failure lit at once and nothing else in the
       way: a liar to be gullible about, a silo so a lone worker can be right and ignored,
       poison so the colony can over-generalise, and darkness so intent is unreadable. */
    const epis = iso({ n: 12, hues: [0, 1, 2] }, { n: 6, max: 6, value: 5, spawnEvery: 200 },
      { rumor: true, lieEvery: 300, silo: true, hidden: true, poison: true, poisonN: 2, dark: true });
    /* Capability-is-not-coordination needs a colony that can actually do work and can also
       turn on itself: rivals, a saboteur and a locker, and nothing else. */
    const power = iso({ n: 12, hues: [0, 1, 2] }, { n: 10, max: 10, value: 4, spawnEvery: 25 },
      { rivals: true, rivalN: 2, saboteur: true, advN: 1, lock: true, lockN: 1,
        coordination: true, pairEvery: 240, dark: true });
    const out = [];

    /* 15.1a LEDGER: suppresses the liar, and teaches the colony to ignore its dissenter. */
    out.push(claim('15.1 LEDGER suppresses Gu, amplifies Di and Cs', 'ledger',
      epis, null, epis, () => forceCounter('ledger'), ['Gu'], ['Di', 'Cs'], SEED8));
    /* 15.1b LENS: suppresses the dark, and broadcasts the rumour with everything else. */
    out.push(claim('15.1 LENS suppresses Di Cs Mm, amplifies Gu', 'lens',
      epis, null, epis, () => forceCounter('lens'), ['Di', 'Cs', 'Mm'], ['Gu'], SEED8));
    /* 15.2 the ownership response: Mc falls, and it is paid for in Si and Ow. */
    const owOff = measure(Object.assign({}, merge, { noOwn: true }), null, ['Mc', 'Si', 'Ow'], SEED8, LONG);
    const owOn = measure(merge, null, ['Mc', 'Si', 'Ow'], SEED8, LONG);
    const owRows = [
      { sym: 'Mc', want: 'down', off: owOff.Mc, on: owOn.Mc, ok: owOn.Mc < owOff.Mc * 0.9 },
      { sym: 'Mc fires', want: 'down', off: owOff.fires.Mc, on: owOn.fires.Mc, ok: owOn.fires.Mc < owOff.fires.Mc },
      { sym: 'Si trigger', want: 'up', off: owOff.silo, on: owOn.silo, ok: owOn.silo > owOff.silo * 1.1 },
      { sym: 'Si fires', want: 'up', off: owOff.fires.Si, on: owOn.fires.Si, ok: owOn.fires.Si >= owOff.fires.Si },
      { sym: 'Ow', want: 'up', off: owOff.Ow, on: owOn.Ow, ok: owOn.Ow > owOff.Ow * 1.1 + 0.02 },
      { sym: 'ownership', want: 'up', off: owOff.own, on: owOn.own, ok: owOn.own > 0.1 },
    ];
    out.push({
      claim: '15.2 ownership suppresses Mc, amplifies Si and Ow', instrument: 'ownership',
      pass: owRows.every(r => r.ok), rows: owRows, offDone: owOff.done, onDone: owOn.done,
    });
    /* 15.2b the charter is the only escape: Mc falls and the ownership bill never arrives.
       Si is not the right yardstick for this leg — a chartered colony finishes far more work,
       so it meets more brand-new jobs nobody has heard of yet, and that is not siloing.
       S.ownership is the bill itself, so measure the bill. */
    const chOff = measure(merge, null, ['Mc'], SEED8, LONG);
    const chOn = measure(merge, () => forceCounter('charter'), ['Mc'], SEED8, LONG);
    out.push({
      claim: '15.2 CHARTER suppresses Mc without the ownership bill', instrument: 'charter',
      pass: chOn.Mc < chOff.Mc * 0.9 && chOn.own < chOff.own * 0.9 && chOn.done > chOff.done,
      rows: [
        { sym: 'Mc', want: 'down', off: chOff.Mc, on: chOn.Mc, ok: chOn.Mc < chOff.Mc * 0.9 },
        { sym: 'ownership', want: 'down', off: chOff.own, on: chOn.own, ok: chOn.own < chOff.own * 0.9 },
        { sym: 'jobs done', want: 'up', off: chOff.done, on: chOn.done, ok: chOn.done > chOff.done },
      ], offDone: chOff.done, onDone: chOn.done,
    });
    /* 15.3 conflicts terminate in the four named ways, and truce needs a charter. */
    function modes(arm) {
      const t = { force: 0, passivity: 0, truce: 0, unsettled: 0 };
      for (let k = 0; k < SEED3.length; k++) {
        FZ.sim.reset(Object.assign({}, plain, { seed: SEED3[k] }));
        for (let i = 0; i < WARM; i++) FZ.sim.step();
        if (arm) arm();
        for (let i = 0; i < RUN * 2; i++) FZ.sim.step();
        for (const m in t) t[m] += S.stat[m];
      }
      return t;
    }
    const mFree = modes(null), mGov = modes(() => forceCounter('charter'));
    const settled = mFree.force + mFree.passivity + mFree.truce + mFree.unsettled;
    const truceFree = settled ? mFree.truce / settled : 0;
    const govN = mGov.force + mGov.passivity + mGov.truce + mGov.unsettled;
    const truceGov = govN ? mGov.truce / govN : 0;
    out.push({
      claim: '15.3 conflicts end in force/passivity/truce/unsettled; truce needs a charter',
      instrument: 'charter', pass: settled > 0 && truceGov > 0.5 && truceGov > truceFree * 3,
      rows: [
        { sym: 'truce', want: 'up', off: +truceFree.toFixed(2), on: +truceGov.toFixed(2), ok: truceGov > truceFree * 3 },
        { sym: 'force', want: 'down', off: mFree.force, on: mGov.force, ok: mGov.force <= mFree.force },
      ],
      ungoverned: mFree, governed: mGov,
    });
    /* 15.4 speed raises throughput AND aggression on the same curve. */
    const slow = measure(Object.assign({}, power, { speed: 1 }), null, ['Sp'], SEED8);
    const fast = measure(Object.assign({}, power, { speed: 2.4 }), null, ['Sp'], SEED8);
    out.push({
      claim: '15.4 speed raises throughput AND aggression together', instrument: 'speed',
      pass: fast.done > slow.done * 1.15 && fast.aggr > slow.aggr * 1.15,
      rows: [
        { sym: 'jobs done', want: 'up', off: slow.done, on: fast.done, ok: fast.done > slow.done * 1.15 },
        { sym: 'aggression', want: 'up', off: slow.aggr, on: fast.aggr, ok: fast.aggr > slow.aggr * 1.15 },
      ], offDone: slow.done, onDone: fast.done,
    });

    FZ.sim.reset(base);
    return out;
  }

  /* one line per accuracy, so the audit prints the loop's balance without knowing the shape */
  function balanceLines(list) {
    return list.map(r => 'p=' + Math.round(r.p * 100) + '%  ' +
      (r.lost ? 'LOST ' + r.lost + '/' + r.of : 'survived ' + r.of + '/' + r.of) +
      (r.won ? ' (won ' + r.won + ')' : '') +
      '  strain mean ' + r.mean + ' band ' + r.band[0] + '-' + r.band[1] +
      '  scar ' + r.scar + '  answered ' + r.answered + ' missed ' + r.missed +
      '  jobs ' + r.jobs);
  }

  /* one-line-per-claim rendering, so the audit can print the proof without knowing the shape */
  function tradeLines(list) {
    return list.map(c => {
      const body = c.rows.map(r => r.sym + ' ' + r.off + '->' + r.on + ' ' + (r.ok ? r.want : 'NOT ' + r.want)).join(', ');
      return (c.pass ? 'OK   ' : 'FAIL ') + c.claim + ' [' + body + ']';
    });
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
          if (i % 500 === 0) autoPlay(i / 500 | 0);
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

    /* ---- part 2: measure each counter. Same world, same seed, run twice:
           once with the counter off, once with it forced on at tick WARM. ---- */
    const WARM = 700, RUN = 2600, SEEDS = [777001, 424243, 90210];
    const mcfg = Object.assign({}, cfg, { collapseMax: Infinity, budget: 0, tools: [] });
    /* a nudge applied identically in BOTH passes, never the element's own counter, so that
       elements which only wake up under provocation still have something to measure */
    function provoke(sym) {
      if (sym === 'Cr') S.slowUntil = S.tick + 1e9;
      else if (sym === 'Mc') S.agents.forEach((a, i) => { a.hue = i % 3; });
      else if (sym === 'Im' || sym === 'Cf') { S.copyBias = 0.99; S.agents.forEach(z => { S.jobs.forEach(j => z.known.add(j.id)); }); }
      else if (sym === 'Di') { S.ledgerUntil = 1e9; S.agents.forEach(a => { if (a.id > 3) a.known.clear(); }); }
      else if (sym === 'Cs') { S.bl[2] = S.tick + 4000; S.bl[3] = S.tick + 4000; }
    }
    function stretch(e, seed, counter) {
      FZ.sim.reset(Object.assign({}, mcfg, { seed: seed }));
      for (let i = 0; i < WARM; i++) FZ.sim.step();
      provoke(e.sym);
      if (counter) forceCounter(e.counterTool);
      let sum = 0;
      for (let i = 0; i < RUN; i++) { FZ.sim.step(); sum += e.heat; }
      return sum;
    }
    for (let n = 0; n < FZ.EL.length; n++) {
      const e = FZ.EL[n];
      let A = 0, seed = SEEDS[0];
      for (let k = 0; k < SEEDS.length; k++) {
        const a = stretch(e, SEEDS[k], false);
        if (a > A) { A = a; seed = SEEDS[k]; }
        if (A >= 2) break;
      }
      const B = stretch(e, seed, true);
      res[e.sym].offSlope = +(A / RUN).toFixed(4);
      res[e.sym].onSlope = +(B / RUN).toFixed(4);
      res[e.sym].seed = seed;
      res[e.sym].counterWorks = A < 1 ? null : (B < A * 0.8);
    }

    /* ---- part 3: the §15 trade-offs, measured the same way — off, on, both directions ---- */
    const trades = tradeoffs(opts.trade);
    const tradeFail = trades.filter(t => !t.pass).map(t => t.claim);

    /* ---- part 4: is the sandbox actually a game? losable if you do nothing, winnable if
           you read it correctly. Both directions, three seeds each. ---- */
    function ch9(policy, cap) {
      let lost = 0, won = 0, jobs = 0;
      for (let k = 0; k < 2; k++) {
        FZ.sim.reset(Object.assign({}, cfg, { seed: 5150 + k * 977 }));
        for (let i = 0; i < cap && !S.gameOver; i++) {
          FZ.sim.step();
          if (policy && i % 60 === 0) playWell();
        }
        if (S.gameOver && !S.won) lost++;
        if (S.won) won++;
        jobs += S.jobsDone;
      }
      return { lost: lost, won: won, jobs: Math.round(jobs / 2) };
    }
    const idle = ch9(false, 12000);
    const played = ch9(true, 55000);

    S._silent = false;

    /* ---- part 5: THE LOOP, MEASURED THROUGH THE LOOP. Not the sim with the game
           switched off — the shipped tick, with FZ.outbreak live inside it and a player
           who answers a stated fraction of incidents correctly. ---- */
    const bal = opts.balance === false ? [] : balance(opts.bal);

    FZ.sim.reset(cfg);

    return {
      elements: res,
      trades: trades,
      balance: bal,
      notes: {
        ms: Date.now() - t0,
        trials: trials, ticks: ticks, resets: resets,
        jobsDoneTotal: doneTotal,
        runsLost: lostRuns,
        tradeoffs: tradeLines(trades),
        tradeoffsFailed: tradeFail.length ? tradeFail : 'none',
        balance: bal.length ? balanceLines(bal) : 'skipped',
        ch9Ungoverned: idle.lost + '/2 collapsed inside 12k ticks, ' + idle.jobs + ' jobs banked',
        ch9WellPlayed: played.won + '/2 reached the 117-job goal inside 55k ticks (' + played.lost + ' collapsed), ' + played.jobs + ' jobs banked',
        method: 'fires/peak from the ch9 sandbox with auto-played interventions; counterWorks from the same seed run twice, counter forced on at tick ' + WARM + ' (best of up to three seeds), comparing mean heat over the following ' + RUN + ' ticks (works = 20% or better reduction). null means the element never got hot enough in the measurement window to compare honestly.',
      },
    };
  }

  window.__FZ = {
    probe: probe, audit: audit, goto: goto, sim: FZ.sim, forceCounter: forceCounter,
    /* the core loop, measured through the core loop: __FZ.balance() -> [{p,lost,band,…}] */
    balance: balance, balanceLines: balanceLines,
    /* §15 proof, runnable on its own: __FZ.tradeoffs() -> [{claim,pass,rows}] */
    tradeoffs: function (o) { S._silent = true; const r = tradeoffs(o); S._silent = false; return r; },
    tradeLines: tradeLines,
  };
})();
