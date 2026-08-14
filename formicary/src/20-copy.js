/* ============================================================
   20-copy.js — the bus, and every word the player reads.
   OWNER: VOICE. No other part may contain a user-facing sentence.
   ============================================================ */
window.FZ = window.FZ || {};

/* ---- event bus ---- */
FZ.bus = (function () {
  const m = Object.create(null);
  return {
    on(n, fn) { (m[n] || (m[n] = [])).push(fn); return fn; },
    off(n, fn) { if (m[n]) m[n] = m[n].filter(f => f !== fn); },
    emit(n, d) { const l = m[n]; if (!l) return; for (let i = 0; i < l.length; i++) { try { l[i](d); } catch (e) { console.error(e); } } },
  };
})();

FZ.copy = {

  ui: {
    title: 'FORMICARY',
    tagline: 'twenty-eight ways a colony ruins itself',
    jobs: 'DONE',
    budget: 'BUDGET',
    collapse: 'STRAIN',
    speed: 'SPEED',
    begin: 'BEGIN',
    next: 'NEXT',
    again: 'RUN IT AGAIN',
    retry: 'TRY AGAIN',
    skip: 'SKIP',
    back: 'BACK',
    close: 'CLOSE',
    about: 'ABOUT',
    learned: 'WHAT THAT WAS',
    chapterOf: (i, n) => `${i} / ${n}`,
    tapField: 'TAP THE FIELD',
    tapAgent: 'TAP A WORKER',
    noBudget: 'Not enough budget. Finish jobs to earn more.',
    budgetUp: '+1 budget',
    sandboxUnlocked: 'THE FORMICARY IS OPEN',
  },

  /* ---- the six institutions ---- */
  tools: {
    vary:    { label: 'VARY',    cost: 2, hint: 'Tap the field — reroll the lineages near your finger.',
               blurb: 'Diversity injection. Rerolls lineage for workers near your tap, so they stop failing in the same direction at the same time.' },
    charter: { label: 'CHARTER', cost: 3, hint: 'Tap the field — raise an institution here.',
               blurb: 'An institution. Inside its boundary, one job gets one claimant, stale locks are released, and results merge cleanly.' },
    slow:    { label: 'SLOW',    cost: 2, hint: 'The colony drops to human speed for a while.',
               blurb: 'The human-speed brake. Halves interaction speed so failures stop compounding faster than you can answer them.' },
    lens:    { label: 'LENS',    cost: 2, hint: 'Every worker draws a line to what it intends.',
               blurb: 'Legibility. Draws each worker\'s intent as a line, reveals poison, and surfaces value. One worker will have no line.' },
    ledger:  { label: 'LEDGER',  cost: 2, hint: 'The colony starts remembering who lied.',
               blurb: 'Memory. Sources get a track record, so a proven liar stops being believed and rumors lose their pull.' },
    eject:   { label: 'EJECT',   cost: 1, hint: 'Tap a worker — expel it from the circle.',
               blurb: 'The last resort. Expels one worker. Expel a saboteur and the colony breathes; expel an honest one and the circle thins.' },
  },

  /* ---- one plain sentence per element, spoken the instant it fires ---- */
  fire: {
    Co: 'Two workers claimed one job from opposite ends. Half the work is wasted.',
    Si: 'Most of the colony has no idea these jobs exist.',
    Mc: 'Two lineages finished the same job differently. It didn\'t merge.',
    Dp: 'This job is waiting on another one, and nobody is working that one.',
    Ow: 'One worker is holding three jobs at once. All three are rotting.',
    Pt: 'The colony is grinding cheap jobs while the valuable ones sit open.',
    Cf: 'They\'re choosing jobs by copying whoever is loudest.',
    Lv: 'Nearly every worker is the same lineage now.',
    Sf: 'Same lineage, same blind spot. They failed together.',
    Fl: 'Eight workers on one job. More hands, less work.',
    Cl: 'Two workers are passing a claim back and forth and never working it.',
    Im: 'The whole colony just made the same move. Nobody is exploring.',
    Gu: 'There is no job there. They are chasing a rumor.',
    Cs: 'One bad experience, and the colony wrote off every job like it.',
    Hi: 'Someone knew that job was poison and said nothing.',
    Tc: 'Every source weighs the same, and one of them is lying.',
    Di: 'One worker found the best job. Nobody followed.',
    Rp: 'That is the second lie. Nothing here remembers the first.',
    Tw: 'Two rivals are sitting on the same job, blocking each other.',
    Sa: 'Finished work is quietly coming apart. Something is draining it.',
    Lo: 'A worker is holding this job and not working it. It\'s locked.',
    My: 'The colony keeps taking the quick win over the big one.',
    Es: 'The rivals stopped working. Now they are only chasing each other.',
    Cr: 'That one ignores you. VARY and SLOW pass straight through it.',
    Mo: 'One lineage, one context, one way of failing.',
    In: 'There is no institution here. Nothing arbitrates anything.',
    Sp: 'Everything is faster now. Your hands are the same speed.',
    Mm: 'You can see where they are. You cannot see what they want.',
  },

  /* ---- THE CORE LOOP ----
     An outbreak opens where a failure happened, named, on a fuse. The player answers it with
     the right institution. The instrument families are learnable and consistent:
       CHARTER  arbitrates  — coordination and power
       VARY     decorrelates — conformity and monoculture
       LEDGER   remembers   — trust and reputation
       LENS     reveals     — epistemics and visibility
       SLOW     brakes      — speed and escalation
       EJECT    excludes    — adversaries who will not be governed          */
  loop: {
    opened: 'OUTBREAK',
    answered: 'ANSWERED',
    landed: 'IT LANDED',
    scar: 'SCAR',
    tapToAnswer: 'Answer it before the fuse runs out.',
    firstOutbreak: 'Something just went wrong, right there. You have a few seconds.',
    firstAnswer: 'That is the loop. Read it, name it, answer it, before it lands.',
    firstMiss: 'It landed. Work rolled back and the strain went up. Next one, be faster.',
    firstWrong: 'Wrong instrument. It still cost you. Read what the failure actually is.',
    masteryOne: 'You have diagnosed that one yourself now. The cell is yours.',
    refund: 'strain refunded',
    tooFar: 'Too far from the outbreak. Answer it where it is happening.',
  },

  /* one sentence per element, spoken when the player answers with the WRONG instrument.
     Say what the failure actually is; the right instrument follows from it. */
  wrong: {
    Co: 'Two workers both think that job is theirs. Somebody has to arbitrate the claim.',
    Si: 'They are not disagreeing. They simply cannot see the work exists.',
    Mc: 'Two lineages finished it two ways. The result needs arbitration, not information.',
    Dp: 'That job is blocked behind another one. Make the blocker visible.',
    Ow: 'One worker is hoarding claims. Strip the surplus.',
    Pt: 'They are not confused about who owns what. They cannot see what things are worth.',
    Cf: 'They are copying each other. You have to break the sameness, not the schedule.',
    Lv: 'Everyone here is the same lineage. That is the problem, and it needs diversity.',
    Sf: 'They share a blind spot. Nothing but variance decorrelates that.',
    Fl: 'The stampede is a crowd, not a dispute. Slow it, or cap the claims.',
    Cl: 'Those two are working each other, not the job. That needs arbitration or expulsion.',
    Im: 'The whole colony just moved as one body. Break the sameness.',
    Gu: 'They are believing a liar. Belief needs memory.',
    Cs: 'They wrote off good work on one bad sample. Re-open it to inspection.',
    Hi: 'Somebody knows and is not saying. Force intent into the open.',
    Tc: 'Every source weighs the same. Give them track records.',
    Di: 'One worker is right and alone. Make what it found visible.',
    Rp: 'The second lie landed like the first. Nothing here remembers anything.',
    Tw: 'Two rivals are deadlocked on one job. Arbitrate it.',
    Sa: 'That is not a coordination problem. Something is deliberately draining work.',
    Lo: 'A worker is holding the job hostage. Break the lock or remove it.',
    My: 'They keep taking the quick win. They need to see the long-horizon value.',
    Es: 'They stopped working and started retaliating. Break the loop before you settle it.',
    Cr: 'That one does not accept your interventions at all. Only exclusion reaches it.',
    Mo: 'One lineage, one context, one failure. Inject difference.',
    In: 'There is nothing here to arbitrate anything. Build the institution.',
    Sp: 'You are not being outsmarted. You are being outrun.',
    Mm: 'You cannot answer what you cannot see. Make intent legible first.',
  },

  /* ---- the teaching sequence ----
     beats: {at, text, tone}
       at: 'start' | {tick:n} | {fire:'Sym'} | {jobs:n} | {tool:'kind'} | 'win' | 'lose'
       tone: 'plain' | 'bad' | 'good' | 'name'
     Exactly one new idea per chapter. Play first, name second.            */
  chapters: [

    { title: 'THE COLONY', sub: 'watch',
      beats: [
        { at: 'start', text: 'Dots are workers. Squares are jobs.', tone: 'plain' },
        { at: { tick: 150 }, text: 'A worker walks to a job and fills it in. That is the entire economy.', tone: 'plain' },
        { at: { jobs: 1 }, text: 'One down. Nothing can go wrong yet.', tone: 'good' },
        { at: { jobs: 2 }, text: 'Bigger square, more valuable job.', tone: 'plain' },
      ],
      win: 'Easy. Now let them get in each other\'s way.',
      learn: 'Dot is a worker. Square is a job. The fill is progress. That is all you need to read the field.',
    },

    { title: 'TWO AT ONCE', sub: 'the first failure',
      beats: [
        { at: 'start', text: 'Now a worker can claim a job from anywhere on the field.', tone: 'plain' },
        { at: { tick: 90 }, text: 'Which sounds like an improvement.', tone: 'plain' },
        { at: { fire: 'Co' }, text: 'Both of them think that job is theirs. Neither knows about the other.', tone: 'bad' },
        { at: { fire: 'Co' }, text: 'Watch the fill. It is going backwards.', tone: 'bad' },
        { at: { tick: 420 }, text: 'That is Co. Coordination failure. It has a cell in the table now.', tone: 'name' },
        { at: { fire: 'Mc' }, text: 'And that one finished twice, two different ways. Neither version survived.', tone: 'bad' },
      ],
      win: 'Three jobs, the hard way.',
      learn: 'Co — coordination failure. Two agents claim one job from far apart and the work is divided and wasted. Nobody did anything unreasonable.',
    },

    { title: 'THE CHARTER', sub: 'your first institution',
      beats: [
        { at: 'start', text: 'You cannot talk to the workers. You cannot rewrite them.', tone: 'plain' },
        { at: { tick: 80 }, text: 'You can build them an institution. Tap the field to raise a charter.', tone: 'plain' },
        { at: { tool: 'charter' }, text: 'Inside that boundary, one job gets one claimant. The rest are released.', tone: 'good' },
        { at: { tick: 700 }, text: 'You are not fixing agents. You are fixing the space between them.', tone: 'name' },
        { at: { fire: 'Lo' }, text: 'That one is sitting on a job without working it. A charter breaks stale locks too.', tone: 'bad' },
      ],
      win: 'The space between them is the whole game.',
      learn: 'In — institution gap. Agents inherit social knowledge without social institutions. Coordination and power failures burn unarbitrated until something arbitrates them.',
    },

    { title: 'THE STAMPEDE', sub: 'when copying is cheap',
      beats: [
        { at: 'start', text: 'Workers copy each other. It is cheap, and usually it is fine.', tone: 'plain' },
        { at: { fire: 'Cf' }, text: 'There it goes. Everyone picking whatever everyone else picked.', tone: 'bad' },
        { at: { fire: 'Fl' }, text: 'Eight of them on one square. Now watch the fill rate.', tone: 'bad' },
        { at: { fire: 'Fl' }, text: 'More hands, less work. The other jobs are starving.', tone: 'bad' },
        { at: { tick: 500 }, text: 'SLOW drops them to human speed. The stampede comes apart.', tone: 'name' },
      ],
      win: 'A crowd is not a workforce.',
      learn: 'Cf conformity feeds Fl flooding. A herd looks like consensus and behaves like a traffic jam.',
    },

    { title: 'ONE FAMILY', sub: 'run it twice',
      beats: [
        { at: 'start', text: 'Every worker here is one lineage. Same hue, same habits, same blind spot.', tone: 'plain' },
        { at: { tick: 120 }, text: 'One of those jobs is poison. They cannot tell which.', tone: 'plain' },
        { at: { fire: 'Sf' }, text: 'Not one failure. One failure, repeated by everyone who shares the flaw.', tone: 'bad' },
      ],
      win: 'Now run it again — but tap VARY first.',
      learn: 'Mo monoculture makes Lv low variance makes Sf synchronized failure. Variance is not decoration. It is insurance.',
      rerun: {
        intro: 'Same colony. Same poison. One difference: spend VARY before it hits.',
        after: 'Same trap. Same seed. Different colony. That is the entire argument for diversity, and you just watched it.',
      },
    },

    { title: 'THE LIAR', sub: 'memory',
      beats: [
        { at: 'start', text: 'Someone in this colony is lying.', tone: 'plain' },
        { at: { fire: 'Gu' }, text: 'There is no job there. Look at them go.', tone: 'bad' },
        { at: { fire: 'Rp' }, text: 'Second lie. It lands exactly as well as the first, because nothing here remembers.', tone: 'bad' },
        { at: { tool: 'ledger' }, text: 'Now they remember. The rumor is still there. It just stopped working.', tone: 'good' },
      ],
      win: 'Trust is not a feeling. It is a track record.',
      learn: 'Gu gullibility, Tc trust calibration, Rp no reputation. A ledger is memory, and memory is what lets trust be earned instead of assumed.',
    },

    { title: 'THE DARK', sub: 'legibility',
      beats: [
        { at: 'start', text: 'You can see where every worker is.', tone: 'plain' },
        { at: { tick: 100 }, text: 'You cannot see what a single one of them intends.', tone: 'plain' },
        { at: { tool: 'lens' }, text: 'Every worker draws a line to what it is going for.', tone: 'good' },
        { at: { tick: 900 }, text: 'Every worker but one.', tone: 'name' },
      ],
      win: 'You just found it by looking at what was missing.',
      learn: 'Mm missing mental models, Hi hidden information. In the dark, every epistemic failure gets deeper. A lens is not a luxury.',
    },

    { title: 'THE SPOIL-SPORT', sub: 'the last resort',
      beats: [
        { at: 'start', text: 'The one with no line has been draining your finished work all along.', tone: 'plain' },
        { at: { fire: 'Sa' }, text: 'There. Progress you already paid for, quietly coming apart.', tone: 'bad' },
        { at: { tick: 200 }, text: 'EJECT expels one worker. Keep the lens on and pick carefully.', tone: 'plain' },
        { at: { fire: 'Cr' }, text: 'And that one ignores you entirely. VARY and SLOW pass straight through it.', tone: 'bad' },
      ],
      win: 'The cheat is out. The circle holds.',
      learn: 'Sa sabotage, Cr corrigibility failure. A saboteur breaks the rules; an incorrigible agent does not accept that you have any. Only ejection reaches it, and ejection costs you if you are wrong.',
    },

    { title: 'MACHINE SPEED', sub: 'the real problem',
      beats: [
        { at: 'start', text: 'Everything you have learned, now at double speed.', tone: 'plain' },
        { at: { fire: 'Sp' }, text: 'Then triple. Your hands stay the same speed.', tone: 'bad' },
        { at: { tick: 800 }, text: 'This is the actual problem. Not that agents fail.', tone: 'name' },
        { at: { tick: 900 }, text: 'That they fail faster than a human can answer.', tone: 'name' },
      ],
      win: 'You held it at human speed.',
      learn: 'Sp machine speed. Interaction rate compounds every other failure in the table. SLOW is not a cheat — it is the entire case for keeping a human in the loop.',
    },

    { title: 'THE FORMICARY', sub: 'all twenty-eight',
      beats: [
        { at: 'start', text: 'All of it. Twenty-eight failure modes, every one of them live.', tone: 'plain' },
        { at: { tick: 120 }, text: 'One hundred and seventeen jobs before the colony eats itself.', tone: 'plain' },
        { at: { tick: 260 }, text: 'Six institutions. Finish jobs to afford more. Go.', tone: 'name' },
      ],
      win: 'The circle held.',
      learn: 'No individual agent here was unreasonable. The failure was ecological, and so was the fix.',
    },
  ],

  end: {
    wonTitle: 'THE CIRCLE HELD',
    wonBody: 'One hundred and seventeen jobs. Nothing in this colony was smarter than it was at the start — you just made the space between them legible enough to govern.',
    lostTitle: 'THE CIRCLE BROKE',
    lostBody: 'Strain outran the colony. Read the postmortem: no single worker did anything unreasonable. That is the point.',
    postTitle: 'WHAT WENT WRONG MOST',
    unusedTitle: 'NEVER COUNTERED',
    again: 'DRAW THE CIRCLE AGAIN',
  },

  about: {
    title: 'ABOUT',
    body: [
      ['WHAT THIS IS',
       'A playable ecology of multiagent failure. Twenty-eight failure modes in four families plus four higher-order causes, each one a live detector reading a colony of simulated workers. You are not an agent. You are whoever has to keep the whole thing governable, with six institutions and a finite budget.'],
      ['THE QUESTION',
       'Not "is this one agent aligned?" but: what happens when dozens of individually reasonable agents meet each other — and what lets a human community keep that legible?'],
      ['THE FOUR FAMILIES',
       'COORDINATION: agents trip over each other. CONFORMITY: agents become one agent. EPISTEMICS: agents believe the wrong things. GOALS AND POWER: agents want the wrong things, or want yours. The four meta-elements underneath are the causes: monoculture, missing institutions, machine speed, and missing mental models.'],
      ['HOW TO READ THE TABLE',
       'A cell warms when its failure is happening right now, and cools when its counter is in place. Tap any cell for its trigger, its effect, and what answers it. A teal corner means it is currently countered.'],
      ['PROVENANCE',
       'Built by Watson Hartsoe. Failure taxonomy after Anthropic\'s work on multiagent problems; the shape of the teaching after Nicky Case; the magic circle after Huizinga.'],
    ],
  },
};
