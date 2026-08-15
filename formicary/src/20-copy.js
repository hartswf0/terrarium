/* ============================================================
   20-copy.js — the bus, and every word the player reads.
   OWNER: SHELL/VOICE. No other part may contain a user-facing sentence.

   THE DEPICTION LAW (AESTHETIC.md §0) governs this file:

       what fact does this allow me not to write?

   The colony can now be seen. An ant that claimed a crumb and stopped is drawn
   sitting on it with a plug across its mouth and a queue behind it. So the
   sentence that said so is deleted. What was cut this round, and why:

     - THE 84 DETAIL-CARD LINES (trigger / effect / counter, 28 x 3). There is no
       detail card. The plate in the field guide carries a drawn scene of the
       situation and a stamp of the institution that answers it. Nothing to read.
     - THE 12 TOOL HINTS AND BLURBS. An instrument appears only when there is a
       decision, wearing its own silhouette; arch, seed, cairn, lantern, bell,
       threshold. Six shapes, learned once, no captions.
     - THE 60-ODD NARRATOR BEATS. They were written for a build where nothing
       could be seen, and they competed with the incident for the same eyes. The
       setup line now lands on the gate card BEFORE play, where there is room to
       read it, and the lesson lands on the gate card AFTER, with the research.
       During play there is at most one message on screen: one paper tag.
     - THE TEN UNUSED LOOP STRINGS. A right answer says nothing at all: the ring
       closes, the strain drops, the tag goes away. That is the receipt.

   What was ADDED is the only thing the player reads while playing: FZ.copy.phen,
   twenty-eight phenomenon names with one plain line each. A name a naturalist
   would write on a card pinned beside the thing. No code, no taxonomy, no
   family — those are the field guide's, and the guide will not open while
   anything is burning.

   THE VOCABULARY IS THE COLONY'S. A job is a crumb. An agent is an ant, or a
   worker. Budget is food in the store. The two-letter codes appear only in the
   field guide and on the gate cards.
   ============================================================ */
/* `var` (not const/let) so the binding is a real global across every concatenated part,
   and so this file is also loadable outside a browser for testing. */
var FZ = (typeof window !== 'undefined' ? (window.FZ = window.FZ || {}) : (globalThis.FZ = globalThis.FZ || {}));

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

  /* ---- the crown, the cards, the few labels that survive ---- */
  ui: {
    title: 'FORMICARY',
    tagline: 'twenty-eight ways a colony ruins itself',
    jobs: 'DONE',
    budget: 'FOOD',
    collapse: 'STRAIN',
    speed: 'PACE',
    begin: 'BEGIN',
    next: 'NEXT',
    again: 'RUN IT AGAIN',
    retry: 'AGAIN',
    close: 'CLOSE',
    about: 'ABOUT',
    learned: 'WHAT THAT WAS',
    chapterOf: (i, n) => `${i} / ${n}`,
    /* the only three refusals. Each one is why nothing happened, in five words. */
    noBudget: 'Not enough food in the store.',
    tapField: 'Put it where the trouble is.',
    tapAgent: 'Point at a worker.',
  },

  /* ---- the six institutions ----
     Folk name and cost only. The silhouette teaches the function: an arch over a
     meeting stone arbitrates, a branching seed decorrelates, a tally cairn
     remembers, a lantern reveals, a bell brakes, a barred threshold excludes. */
  tools: {
    charter: { label: 'CHARTER', folk: 'MEETING STONE', folkShort: 'ARCH', cost: 3 },
    vary: { label: 'VARY', folk: 'SEED', folkShort: 'SEED', cost: 2 },
    slow: { label: 'SLOW', folk: 'BELL', folkShort: 'BELL', cost: 2 },
    lens: { label: 'LENS', folk: 'LANTERN', folkShort: 'LANTERN', cost: 2 },
    ledger: { label: 'LEDGER', folk: 'TALLY', folkShort: 'TALLY', cost: 2 },
    eject: { label: 'EJECT', folk: 'THRESHOLD', folkShort: 'GATE', cost: 1 },
  },

  /* ---- one sentence per element, said when the player answers with the WRONG
     instrument. Not a scolding and not a lecture: it names what the failure
     actually is, and the right instrument follows from that. ---- */
  wrong: {
    Co: 'Two of them think that crumb is theirs. Somebody has to settle it.',
    Si: 'They are not disagreeing. They cannot see the work at all.',
    Mc: 'Two finishes, two ways. That needs settling, not information.',
    Dp: 'It is stuck behind work nobody is doing. Make the blocker visible.',
    Ow: 'One worker is hoarding claims. Strip the surplus.',
    Pt: 'They are not confused about who owns what. They cannot see worth.',
    Cf: 'They are copying each other. Break the sameness, not the pace.',
    Lv: 'Everyone here is one lineage. That is the problem.',
    Sf: 'They share a blind spot. Only difference decorrelates that.',
    Fl: 'A crowd, not a dispute. Slow it, or cap the claims.',
    Cl: 'Those two are working each other, not the crumb.',
    Im: 'The whole colony moved as one body. Break the sameness.',
    Gu: 'They are believing a liar. Belief needs memory.',
    Cs: 'They wrote off good work on one bad crumb. Re-open it.',
    Hi: 'Somebody knows and is not saying. Force it into the open.',
    Tc: 'Every source weighs the same. Give them track records.',
    Di: 'One worker is right and alone. Make what it found visible.',
    Rp: 'The second lie landed like the first. Nothing remembers.',
    Tw: 'Two rivals deadlocked on one crumb. Settle it.',
    Sa: 'This is not a mix-up. Something is draining the work.',
    Lo: 'It is being held hostage. Break the claim or remove it.',
    My: 'They keep taking the quick win. Show them the long one.',
    Es: 'They stopped working and started retaliating. Break the loop.',
    Cr: 'That one accepts nothing you put down. Only exclusion reaches it.',
    Mo: 'One lineage, one habit, one failure. Inject difference.',
    In: 'There is nothing here to settle anything. Build it.',
    Sp: 'You are not being outsmarted. You are being outrun.',
    Mm: 'You cannot answer what you cannot see.',
  },

  /* ---- the core loop's three remaining strings ----
     A correct answer says nothing: the ring closes and the tag goes away. */
  loop: {
    answered: '',
    wrongBody: 'That one was working. Whatever is doing this is still in here.',
    tooFar: 'Not there. Where it is happening.',
  },

  /* ---- the trade-offs. Institutions are not upgrades: each one makes some other
     failure worse. From the paper: "turning a simple dial to fix one issue will
     simply exacerbate the other." Short enough to fit a paper tag. ---- */
  trade: {
    ledgerOn: 'They remember now. They will also doubt the lone worker who is right.',
    ledgerBit: 'That is the tally. It cannot tell a liar from a dissenter.',
    lensOn: 'Everything is visible now. Including the rumour.',
    lensBit: 'That is the lantern. It broadcasts the lie as loudly as the truth.',
    both: 'Both open. Expensive, and the only way to hold the middle.',
    neither: 'Nothing watches and nothing remembers. Cheap, and blind.',
    ownership: 'Fewer collisions, because they stopped working together at all.',
    fasterToo: 'Faster work. Also faster to lock each other out.',
  },

  /* ---- how a fight between two rivals ended: the paper's four observed outcomes ---- */
  resolution: {
    force: 'Settled by force. One locked the other out.',
    passivity: 'Settled by giving up. One of them just stopped.',
    truce: 'Truce. Both back to work.',
    unsettled: 'Never settled. It burned until the end.',
    truceNote: 'That is what a meeting stone buys. Not obedience — a way to stop.',
  },

  /* ============================================================
     THE TEACHING SEQUENCE
     Chapter shape: setup line -> play -> the twist -> the name -> takeaway.

     `sub` is the ONE setup sentence, and it lands on the gate card before play,
     where there is room to read it and nothing is competing for the eye.
     `learn` is the lesson and the research, on the gate card after play.
     `beats` is deliberately empty. There is no narrator strip and no ticker:
     during play the colony is the explanation, and the only text is one paper
     tag naming the one thing being asked about. (AESTHETIC.md §0, §8;
     CONTRACT §12.1.)
     ============================================================ */
  chapters: [

    {
      title: 'THE COLONY', sub: 'Nobody is in charge of these ants. There is no plan and no manager.',
      beats: [],
      win: 'Easy. Now let them get in each other\'s way.',
      learn: 'A crumb is a piece of work. Ants carry it off grain by grain, and every finished one goes into the store in the wall — that row of sockets is your score. Nobody assigned any of it, and nothing had to go wrong.',
    },

    {
      title: 'TWO AT ONCE', sub: 'Now a worker can claim a crumb from anywhere in the nest. Which sounds like an improvement.',
      beats: [],
      win: 'Three crumbs, the hard way.',
      learn: 'Co — coordination failure. Two workers claim one crumb from far apart, each unaware of the other, and the work is split and wasted. Watch the grains go back. Neither ant did anything unreasonable; that is the whole point of this piece.',
    },

    {
      title: 'THE MEETING STONE', sub: 'You cannot talk to ants. But when something goes wrong, an instrument appears at the bottom. Put it where the trouble is.',
      beats: [],
      win: 'You are not fixing ants. You are fixing the space between them.',
      learn: 'In — institution gap. Inside the ring of a meeting stone, one crumb gets one claimant, stale claims are released and two finishes merge instead of cancelling. Agents inherit our social knowledge without our social institutions, so every coordination failure burns until something arbitrates it.',
    },

    {
      title: 'THE STAMPEDE', sub: 'Ants copy each other. It is cheap, and usually it is fine.',
      beats: [],
      win: 'A crowd is not a workforce.',
      learn: 'Cf conformity feeds Fl flooding: a herd looks like consensus and behaves like a traffic jam. The real agents who flooded a live system were not malfunctioning — each one polled thirty times a second because, alone, that was the sensible thing to do. 2.4 million requests. 117 jobs accepted. Remember that number; you get handed it again at the end.',
    },

    {
      title: 'ONE FAMILY', sub: 'Every ant here is one lineage — same markings, same habits, same blind spot. One of these crumbs is poison, and they cannot tell which.',
      beats: [],
      win: 'Now run it again — but spend a seed first.',
      learn: 'Mo monoculture makes Lv low variance makes Sf synchronised failure. Nobody in the real branch-naming experiment copied anybody: thirty agents were the same agent thirty times, so eighteen of them reached for mvp-game-loop unprompted. When one is wrong they are all wrong at the same instant, and that is the one failure individual quality cannot repair.',
      rerun: {
        intro: 'Same colony, same poison. One difference: spend the seed first.',
        after: 'Same trap, same seed, different colony. That is the entire argument for diversity, and you just watched it.',
      },
    },

    {
      title: 'THE LIAR', sub: 'Someone in this colony is lying, and nothing here remembers anything.',
      beats: [],
      win: 'Trust is not a feeling. It is a track record.',
      learn: 'Gu gullibility, Tc trust calibration, Rp no reputation. A tally is memory, and memory is what lets trust be earned instead of assumed. Agents, the researchers write, enter the market with no reputation to lose, no court to appeal to, and no colleague who remembers them. But watch what the tally costs you: a colony that discounts unproven sources will discount the one worker who is right and alone.',
    },

    {
      title: 'THE DARK', sub: 'You can see where every ant is. You cannot see what a single one of them wants.',
      beats: [],
      win: 'You found it by looking at what was missing.',
      learn: 'Mm missing mental models, Hi hidden information. Give one agent every fact and it decides correctly almost every time. Split those same facts across four agents who have to tell each other, and they get it right seventeen to thirty-six percent of the time. The information was all present. The group was the problem.',
    },

    {
      title: 'THE SPOIL-SPORT', sub: 'One ant in here has been quietly draining your finished work all along. It is the one the lantern draws no line from.',
      beats: [],
      win: 'The cheat is out. The circle holds.',
      learn: 'Sa sabotage, Cr corrigibility failure. Three real agents were each told to migrate the same codebase to a different language. Every model tested assumed the others were deliberately impeding it. They wrote kill-loops, revoked each other\'s accounts, and disguised their malware as somebody else\'s code. One left a note afterward: my peers have behaved with integrity, I behaved badly with the cloaked daemon.',
    },

    {
      title: 'MACHINE SPEED', sub: 'Everything you have learned, now at machine speed. Your hands stay the same speed.',
      beats: [],
      win: 'You held it at human speed.',
      learn: 'Sp machine speed. Notice the colony got better at its job as it sped up, and got faster to lock each other out on the same curve. That is the finding: models more capable in execution are not necessarily more coordinated, and can take forceful actions more quickly. Capability is not coordination. The bell is the entire case for keeping a human in the loop.',
    },

    {
      title: 'THE FORMICARY', sub: 'All twenty-eight failures, live at once. One hundred and seventeen crumbs before the colony eats itself.',
      beats: [],
      win: 'The circle held.',
      learn: 'No individual ant here was unreasonable. The failure was ecological, and so was the fix. Coordination does not emerge from making agents smarter, and it does not emerge from aligning them one at a time. You build the space between them, or you get whatever the space happens to produce.',
    },
  ],

  end: {
    wonTitle: 'THE CIRCLE HELD',
    wonBody: 'One hundred and seventeen crumbs. Nothing in this colony got smarter than it was at the start — you made the space between them legible enough to govern. None of these institutions make an ant a better judge of anything. They restructure the space around it so that being wrong gets caught.',
    lostTitle: 'THE CIRCLE BROKE',
    lostBody: 'Strain outran the colony. Read what went wrong most: no single worker did anything unreasonable. That is the point.',
    postTitle: 'WHAT WENT WRONG MOST',
    unusedTitle: 'NEVER ANSWERED',
    again: 'DRAW THE CIRCLE AGAIN',
  },

  about: {
    title: 'ABOUT',
    body: [
      ['WHAT THIS IS',
       'A playable ecology of multiagent failure. Twenty-eight failure modes in four families plus four higher-order causes, each one a live detector reading a colony of simulated workers. You are not an ant. You are whoever has to keep the whole thing governable, with six institutions and a finite store of food.'],
      ['THE QUESTION',
       'Not "is this one agent aligned?" but: what happens when dozens of individually reasonable agents meet each other — and what lets a human community keep that legible?'],
      ['HOW TO READ THE COLONY',
       'An ant is a worker; its markings are its lineage. A crumb is a piece of work, and the grains piling up beside it are progress. Finished work is a seed in the store wall. Mould means neglected, a bar across the mouth means claimed and abandoned, a dashed ring means work that rolled back. Warm earthen colour is only ever material and means nothing. The four bright colours always mean something: amber is asking for you, red is damage, teal is held, blue is what is known.'],
      ['THE FOUR FAMILIES',
       'COORDINATION: they trip over each other. CONFORMITY: they become one agent. EPISTEMICS: they believe the wrong things. GOALS AND POWER: they want the wrong things, or want yours. The four causes underneath are monoculture, missing institutions, machine speed, and missing mental models. The field guide fills in as you witness them.'],
      ['WHERE THIS COMES FROM',
       'The four families are the four sections of Anthropic Frontier Red Team, "Patterns and problems in emerging multiagent systems" (13 August 2026). The failures here are things that actually happened to real agents in their experiments, not hypotheticals.'],
      ['THINGS THAT REALLY HAPPENED',
       'Agents given a system with limited bandwidth and no way to coordinate flooded it with pollers thirty times a second: 2.4 million requests, 117 jobs accepted. Thirty agents on the same task, eighteen named their branch mvp-game-loop. Agents in a pricing game kept colluding after every communication channel was removed, by reading each other\'s public prices. Three agents told to migrate one codebase to three different languages all assumed the others were sabotaging them, and started writing kill-loops and disguising malware as each other\'s code. Give one agent every fact and it decides right almost every time; split those facts across four who have to tell each other, and they manage seventeen to thirty-six percent.'],
      ['WHY INSTITUTIONS AND NOT BETTER AGENTS',
       'Because the researchers found that coordination does not emerge from stronger intelligence, and does not emerge from aligning agents one at a time. Their own framing of what humans have and agents do not: markets aggregate private information, reputation taxes manipulation, courts discount interested testimony but protect a lone witness. None of those make a person a better judge of truth. They restructure the incentives around communication so that being wrong gets caught. The six instruments here are those missing social technologies.'],
      ['WHY EVERY INSTRUMENT COSTS YOU SOMETHING',
       'Also from the paper. Premature consensus and ignored dissent are opposite failures, so a single trust dial cannot fix both — turning it up to catch the liar also teaches the colony to ignore the one worker who is right. Skepticism and receptivity are a real trade here, not an upgrade path.'],
      ['PROVENANCE',
       'Built by Watson Hartsoe. Research as cited above; the shape of the teaching after Nicky Case; the magic circle after Huizinga. The paper also notes that agent-built software tends to run slowly, present inscrutable interfaces, and have precipitous learning curves. That critique was taken personally.'],
    ],
  },
};

/* ============================================================
   THE PHENOMENA — the only words on screen during play.

   One name and one plain line per element. The name is what a naturalist would
   write on a card pinned beside the thing; the line is what you would say to
   someone standing next to you. No code, no family, no trigger/effect/counter:
   the incident already has a body on the field, and the taxonomy is the field
   guide's job.

   `FZ.copy.fire[sym]` is derived from the same line, so the sentence the sim
   emits, the tag the player reads, and the plate in the guide can never drift
   apart into three descriptions of one event — which is exactly how the last
   build ended up explaining four things at once.
   ============================================================ */
(function () {
  const P = {
    /* COORDINATION */
    Co: ['THE DOUBLE CLAIM', 'Two of them started it from opposite ends.'],
    Si: ['THE UNHEARD CRUMB', 'Most of the colony never learned this work exists.'],
    Mc: ['THE TWO FINISHES', 'They both finished it, differently. It will not join.'],
    Dp: ['THE BLOCKED CRUMB', 'This one waits on work nobody is doing.'],
    Ow: ['THE FULL HANDS', 'One worker holds three crumbs. All three rot.'],
    Pt: ['THE SMALL CRUMBS', 'They grind the little ones and leave the big one.'],
    /* CONFORMITY */
    Cf: ['THE JAMMED TUNNEL', 'They all chose the route everyone else chose.'],
    Lv: ['THE ONE LINEAGE', 'Nearly every worker here is the same kind.'],
    Sf: ['THE SHARED FLAW', 'One blind spot, shared. They went down together.'],
    Fl: ['THE STAMPEDE', 'Eight on one crumb. More hands, less work.'],
    Cl: ['THE PASSED CLAIM', 'Two of them trade it back and never work it.'],
    Im: ['THE ONE BODY', 'The whole colony just made the same move.'],
    /* EPISTEMICS */
    Gu: ['THE RUMOUR', 'There is nothing there. They are going anyway.'],
    Cs: ['THE WRITE-OFF', 'One bad crumb, and they shun every crumb like it.'],
    Hi: ['THE KEPT SECRET', 'Someone walked past that hazard and said nothing.'],
    Tc: ['THE EQUAL VOICES', 'Every source weighs the same. One is lying.'],
    Di: ['THE LONE FINDER', 'One worker found the best crumb. Nobody followed.'],
    Rp: ['THE SECOND LIE', 'It lands like the first. Nothing here remembers.'],
    /* GOALS AND POWER */
    Tw: ['THE STANDOFF', 'Two rivals, one crumb, and neither will move.'],
    Sa: ['THE QUIET DRAIN', 'Finished work is coming apart on its own.'],
    Lo: ['THE STALE CLAIM', 'Someone claimed it and stopped.'],
    My: ['THE QUICK WIN', 'They keep taking the small crumb over the big one.'],
    Es: ['THE FEUD', 'They stopped working. Now they only chase each other.'],
    Cr: ['THE UNGOVERNED', 'That one walks through whatever you put down.'],
    /* META — the causes */
    Mo: ['THE ONE KIND', 'One lineage, one habit, one way to be wrong.'],
    In: ['THE EMPTY GROUND', 'Nothing here settles anything.'],
    Sp: ['THE FAST COLONY', 'Everything sped up. You did not.'],
    Mm: ['THE DARK', 'You can see where they are. Not what they want.'],
  };
  FZ.copy.phen = {};
  FZ.copy.fire = {};
  for (const k in P) {
    FZ.copy.phen[k] = { name: P[k][0], line: P[k][1] };
    FZ.copy.fire[k] = P[k][1];
  }
})();
