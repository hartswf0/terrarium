# HLIÐARENDI × SILAS

## The Dog at the Threshold — a standing world for embodied human–animal agency

The right fusion is now clear: **Argos is the dog; Silas is the
architecture; Sámr, Homer's Argos, and Goodyear are the tests.**

HLIÐARENDI joins four things that were previously being developed
separately:

```text
HERO      — EVERYBODY
DOG       — ARGOS
STRUCTURE — INGOLD / Gunnar's trailer
PLACE     — TERRARIUM
```

They are not four assets. They are four mutually consequential inhabitants
or conditions of one standing world.

The project's fundamental equation remains:

**HERO + DOG + STRUCTURE + PLACE = HLIÐARENDI**

The existing project already establishes the central engineering law:

**Never solve the same physical question twice.**

There is one ground, one doorway, one ball, one human body, one dog body,
one history. Everybody's feet and Argos's paws ask the same PLACE what they
touch; the trailer derives collision and affordances from the same operative
structure that is rendered; objects persist as world entities rather than
duplicated game props.

But the project needs a second law:

**Never solve an intentional question by bypassing the creature.**

This is where Silas T. Dog joins HLIÐARENDI.

## I. The four dogs are not four characters

HLIÐARENDI should not contain Homer's Argos, Sámr, Goodyear, and Silas as
four literal dogs. They form a lineage of questions about what an artificial
animal would have to be.

**ARGOS — IDENTITY.** *Who are you?* Odysseus returns home disguised.
Representation says STRANGER. His dog says ODYSSEUS. Argos represents
recognition underneath changing appearance. The corresponding computational
requirement is not simply facial recognition. DOG must maintain continuity:
this is the same human; this is where they usually live; these objects
belong to our shared environment; these behaviors are characteristic of
them; this changed; this remained the same.

## II. Sámr — intention

*What do you mean to do?* Sámr distinguishes Gunnar's friends from his
enemies and is said to recognize whether a person means Gunnar well or ill.
The computational aspiration is therefore not `object detected at x,y,z`
but: *Who is this? What are they doing? Is this ordinary? What does it mean
for my human? What does it mean for our home?*

Useful perceptual distinctions: familiar/unfamiliar, approaching/departing,
calm/violent, offering/withholding, playing/threatening, calling/ignoring,
inside/outside, normal/anomalous.

The aim is not telepathy. It is situated inference accumulated through
history.

## III. Goodyear — trust

*Should I act with you?* Jeff can be programmed. Jeff can receive
instructions. Jeff can execute tasks. But Finch cannot program Goodyear's
trust in Jeff. The significant event is not `ROBOT EXECUTES FETCH`; it is
`DOG VOLUNTARILY RETURNS BALL TO ROBOT`.

Trust must not be a Boolean assigned by the designer. It should arise from
feeding, playing, touching, frightening, abandoning, protecting, helping,
waiting and returning. Relationship must be a changing historical structure.

The correct test is not *Can Argos run FETCH?* It is: *Has this become a
relationship in which Argos wants to fetch with this person?*

## IV. Silas — autonomy

The previous three dogs tell us what the artificial dog must be capable of
knowing. Silas tells us how to build the creature without destroying it in
the process.

Bruce Blumberg's Silas T. Dog confronted essentially the same architectural
problem in the MIT Media Lab's ALIVE project. Silas had internal
motivations, perceptual Releasing Mechanisms, competing behaviors and motor
skills. His head, ears and tail could expose what mattered to him.

The SIGGRAPH paper states the central principle directly:

**Autonomy and directability are not mutually exclusive.**

This becomes the missing architecture of HLIÐARENDI's DOG.

## V. Argos is the dog. Silas is the chassis of the mind.

Do not rename Argos to Silas. Do not put a Silas model beside Argos. Do not
make a "Silas mode." Instead:

```text
                         ARGOS
                           │
                 visible individual dog
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
       ARGOS             SÁMR            GOODYEAR
      identity         intention           trust
          │                │                 │
          └────────────────┼─────────────────┘
                           │
                        SILAS
                  autonomous runtime
                           │
                           ▼
                    PHYSICAL BODY
                           │
                           ▼
                        PLACE
```

ARGOS is the character. SILAS is the computational inheritance. SÁMR, ARGOS
and GOODYEAR are the behavioral standard. Silas is what turns the literary
lineage into executable architecture.

## VI. Rebuild DOG.js around Silas

The public Actor contract stays:

```text
ARGOS
    transform · body · paws · contacts
    perception · memory · drives · relationship
    sense(world) · choose() · act(dt, world) · serialize()
```

But internally, `choose()` should no longer mean a loose behavior tree. It
becomes a Silas-derived ecology:

```text
DOG.js
├── BODY         rig · paws · mouth · gaze · ears · tail · contacts
├── PERCEPTION   vision · sound · proximity · contact · human actions ·
│                object persistence · place / home state
├── RELEASERS    foodAvailable · waterAvailable · ballMoving · humanCalling ·
│                humanOffering · humanThreatening · strangerApproaching ·
│                homeEntered · anomalyDetected
├── INTERNALS    hunger · thirst · fatigue · play · socialNeed · curiosity ·
│                fear · arousal
├── RELATIONSHIP familiarity · attachment · trust · expectedCare ·
│                expectedThreat · interactionHistory
├── BEHAVIORS    EAT · DRINK · REST · FOLLOW · APPROACH · INVESTIGATE ·
│                PLAY · FETCH · RETURN · AVOID · ALERT · SEEK_CONTACT
├── ARBITRATION
├── MOTOR_INTENT
├── DOF_ARBITRATION
├── MOTOR_SKILLS
└── EXPRESSION
```

This is the crucial Silas insertion.

## VII. Releasing Mechanisms are the border between world and animal

Terrarium knows facts. DOG decides whether they matter.

PLACE may report:

```text
entity human.1 · distance 1.8 m · velocity toward dog · hand raised · volume 0.65
```

That is not yet meaning. A dog's Releasing Mechanisms transform world state
into something like:

```text
FAMILIAR_HUMAN_NEAR       .91
HUMAN_CALLING_ME          .76
POSSIBLE_PLAY_INVITATION  .63
THREAT                    .04
```

And an unknown rapid approach toward home could generate:

```text
STRANGER_APPROACHING_HOME .82
NOVELTY                   .74
THREAT                    .38
```

This is where the Sámr problem becomes executable. The world provides
evidence. The creature produces relevance.

## VIII. Behavior is an election

Every plausible behavior continuously asks: *How strongly should I happen
now?*

```text
behavior value =
    current need
  × environmental opportunity
  × learned expectation
  × relationship context
  × current interest
  + external direction
  - inhibition
```

Then behaviors compete. Not every frame should cause a revolution — the
current winner requires inertia, or Argos becomes `FETCH EAT FOLLOW FETCH
LOOK EAT` twenty times per second. Silas's architecture is useful precisely
because competition creates persistence. The animal appears to continue
doing something for a reason.

## IX. The player does not own the dog's action selector

This is a hard architectural invariant. When Everybody says "Argos, come,"
do not perform `argos.playAnimation("come")` — not even
`argos.behavior = FOLLOW`. Instead:

```text
WORDS → INTERPRETATION → HUMAN_CALLING → perceptual evidence →
behavioral bias → competition against hunger / fear / fatigue / curiosity /
play / relationship → winner
```

If FOLLOW wins, Argos comes. If he is frightened, he may hesitate. If he is
eating, he may glance toward the human without leaving the bowl. If
attachment is high and the situation is ordinary, he may immediately break
toward the person. If the caller is unfamiliar, the same words may produce
orientation rather than approach.

That is directability without puppetry. The current Argos runtime is already
unusually close to this principle: its language layer translates utterances
into pushes on internal variables and biases on behaviors; the language
model does not directly choose the physical action. Keep that. It is one of
the strongest parts of Argos.

## X. The body remains part of the mind

A behavior cannot merely select an animation. It must acquire bodily
resources. The current Argos runtime already implements a version of this:
the winning behavior claims its required degrees of freedom while secondary
behaviors can still command body parts the winner does not need — walking
toward water while still watching a ball. Preserve and deepen this.

```text
PRIMARY   EAT              claims locomotion · mouth · head-near-target
SECONDARY WATCH_HUMAN      claims eyes · partial neck
SECONDARY SOCIAL_EXCITEMENT claims tail
SECONDARY UNCERTAINTY      claims ears
```

Now the dog can eat while watching you, wagging because you approached,
while keeping its ears slightly uncertain. That is not animation polish.
That is the visible surface of competing motivations.

## XI. Learning alters the ecology, not replaces it

The later "No Bad Dogs" work integrated learning into Silas so the animal
could learn new useful contexts for existing behavior and new Releasing
Mechanisms predictive of meaningful events. Not `command "ball" = FETCH`,
but `cue + context + action → consequence`:

```text
human says "ball" + human holds ball + orient toward ball → play usually follows
Everybody picks up food can → food soon appears in bowl
```

Argos can begin moving toward the bowl before the food is poured. That is
the emergence of expectation. The artificial animal begins living not merely
in the present world, but in a world whose regularities it has learned.

The current Argos already contains a small temporal-credit system
associating recent cue/action pairs with reward. Do not throw that away.
Grow it toward the Silas model.

## XII. Silas changes the role of the LLM

The LLM is not Argos's brain. It is a translator, interpreter, occasional
reasoner, and possibly memory-retrieval mechanism available to the dog's
brain.

```text
                 LANGUAGE
                     │
          semantic interpretation
                     │
            DOG-WORLD PROGRAM
             /       |       \
       percept    drive      bias
       evidence   change   behavior
             \       |       /
              SILAS ECOLOGY
                     │
              action selection
                     │
                   BODY
```

Do not call an LLM every frame. Do not ask "What should the dog do next?"
Ask only when interpretation actually requires it: "What does this utterance
probably mean to this dog in this situation?" Then return the result to the
deterministic persistent runtime.

The animal keeps living after the language model stops speaking. That is the
difference between an LLM roleplaying a dog and a dog that can understand
some language.

## XIII. Silas also solves the director problem

Blumberg and collaborators wanted creatures that could participate in
authored experiences: multi-level direction, where external systems
influence behavior without seizing final motor control. HLIÐARENDI needs
exactly this because it is simultaneously simulation, game, story
environment, and embodied agent experiment.

```text
SCENARIO DIRECTOR
LEVEL 1 — WORLD       put ball somewhere interesting
LEVEL 2 — PERCEPTION  produce a sound / reveal an event
LEVEL 3 — MOTIVATION  increase interest in play
LEVEL 4 — BEHAVIOR    bias FETCH
LEVEL 5 — MOTOR       reserved for exceptional hard constraints
```

Higher intervention preserves more autonomy. Lower intervention produces
more control. A direction ladder rather than an on/off distinction between
simulation and scripting.

## XIV. The human obeys the same principle

Everybody is intentionally not a floating game camera. MOVE propagates
through feet, pelvis, spine, shoulders, arms and head; REACH involves hand,
elbow, shoulder, torso, balance and feet.

```text
EVERYBODY: INTENTION → WHOLE BODY → CONTACT → WORLD
ARGOS:     MOTIVATION → BEHAVIOR → WHOLE BODY → CONTACT → WORLD
```

Both must pass through bodies. Neither is allowed magical translation.

## XV. The complete HLIÐARENDI loop

```text
                         HLIÐARENDI
                              │
         ┌────────────────────┼────────────────────┐
     EVERYBODY              ARGOS                INGOLD
       human                 dog                 dwelling
         └────────────────────┼────────────────────┘
                              │
                          TERRARIUM
                         standing world
                              │
                     SHARED CONSEQUENCES
                              │
              ┌───────────────┴───────────────┐
          HUMAN SENSES                    DOG SENSES
                                              │
                                      RELEASING MECHANISMS
                                              │
                     ┌────────────────────────┼───────────────┐
                   DRIVES                RELATIONSHIP       MEMORY
                     └────────────────────────┼───────────────┘
                                        BEHAVIOR GROUPS
                                              │
                                          ARBITRATION
                                              │
                         ┌────────────────────┼─────────────┐
                      PRIMARY             SECONDARY      EXPRESSION
                         └────────────────────┼─────────────┘
                                         MOTOR SKILLS
                                              │
                                           PAWS/BODY
                                              │
                                           CONTACT
                                              │
                                           TERRARIUM
                                              └──────↺
```

This is the dog joining the world rather than being laid on top of it.

## XVI. The dog at the threshold is the central figure

Every dog stands at a boundary. Argos: stranger / rightful inhabitant. Sámr:
friend / threat. Goodyear: instruction / trust. Silas: direction / autonomy.

The dog makes transitions such as home/outside, friend/stranger,
command/request, puppet/agent and continuity/rupture observable.

**The dog is a sensory membrane through which relationships become
observable.** Not a mascot. Not an NPC. Not a chatbot with paws. A living
interpreter positioned between actor and world.

## XVII. The first game becomes a Silas experiment

Keep the tiny Trailer Shift acceptance test. Then add one thing.

**The Silas Test.** Do the same scenario twice and demand that it not
necessarily happen identically.

First run: Argos is rested, playful, relationship strong. THROW → immediate
fetch.

Second run: Argos is thirsty, just noticed water, relationship weaker.
THROW → looks at ball → looks at Everybody → goes to drink → perhaps later
investigates ball.

The second run is not failure. It is the first proof that Argos exists
between commands. The UI should make this intelligible:

```text
FETCH             0.63
DRINK             0.84  ← WINNER
FOLLOW            0.31
REST              0.08
```

Everybody can see why the dog "disobeyed." That is Silas.

## XVIII. The Goodyear Test

Repeat fetch across several interactions. Do not directly increment
`trust += 1`. Record experience. Over time, feeding, playing, safe touch,
successful exchanges and returning home alter expectations. Eventually Argos
begins anticipating play.

The test: does Argos bring the ball back because the implementation entered
a FETCH state, or because a relationship and motivational situation made
RETURN the winning behavior? The latter is HLIÐARENDI.

## XIX. The Argos Test

Change Everybody. Different clothes. Different rendering. Perhaps eventually
another avatar representation driven by the same person. Does Argos maintain
continuity of the relationship?

```text
visual representation = changed
relationship identity = same
```

That is Homer entering the engine.

## XX. The Sámr Test

Introduce another actor. Do not give Argos `enemy = true`. Give him history
and perceptual evidence. The stranger approaches the home, acts abruptly,
touches possessions, behaves differently when Everybody is present, has no
established relationship. Argos may orient, approach cautiously, alert,
retreat, seek Everybody, or guard a boundary.

Now the dog is beginning to interpret what events mean for the shared
situation. That is Sámr entering the engine.

## XXI. The Silas Test (direction)

Let the director want something that the dog does not. The scenario wants
Argos outside. Argos wants food. The director should first try
`WORLD → interesting event outside`, then `PERCEPTION → cue`, then perhaps
`BEHAVIOR → PLAY bias`. Only as a last resort should it force locomotion.

Measure how much coercion was required. Now HLIÐARENDI has a quantitative
measure of directability without loss of autonomy. That is Silas entering
the engine.

## XXII. Revised repository ontology

```text
hlidarendi/
├── PLACE/       terrarium
├── STRUCTURE/   ingold
├── HERO/        everybody
├── DOG/
│   └── argos/
│       ├── body · locomotion · perception · releasers · internals ·
│       │   relationship · behaviors · arbitration · learning · expression
│       └── actor.js
├── SCENARIOS/   trailer-shift
├── RELATIONS/
└── HLIDARENDI.js
```

Do not create `DOG/argos + samr + goodyear + silas`. That misunderstands the
lineage. The three narrative dogs are specifications. Silas is architecture.
Argos is the implementation.

## XXIII. The five laws of HLIÐARENDI

**1. ONE STANDING WORLD.** Never solve the same physical question twice.
Everybody, Argos, Ingold and every prop inhabit the same PLACE.

**2. NO MAGIC ACTION.** Never shortcut intention directly into displacement
when embodiment can realize it. Feet and paws produce movement through
contact.

**3. NO MAGIC OBEDIENCE.** A request enters the creature's ecology; it does
not bypass it. Language biases action. It does not become action.

**4. RELATIONSHIP HAS HISTORY.** Identity, intention and trust emerge from
encounters across time. Do not store relationships as arbitrary labels when
they can be inferred from lived events.

**5. INTERNAL STATE MUST BECOME LEGIBLE.** The dog must show enough of its
reasons that independence does not look like randomness. Eyes. Head. Ears.
Tail. Posture. Gait. Proximity. Hesitation. Approach. Withdrawal. The body
is the explanation.

## XXIV. The project in one sentence

**HLIÐARENDI is a persistent standing world in which an embodied human, an
autonomous synthetic dog, an operative dwelling and a consequential
landscape acquire a history together.**

And the dog is where the research becomes testable. Homer asks whether it
knows who you are. Njáls saga asks whether it understands what others
intend. Finch asks whether it comes to trust you. Blumberg asks whether it
can do any of these things while remaining its own creature.

## XXV. The shortest possible form

```text
               WHAT MUST THE DOG KNOW?

          ARGOS        SÁMR        GOODYEAR
        identity    intention       trust
            \           |           /
                    SILAS
             HOW THE DOG LIVES
                       │
                     ARGOS
                       │
                     BODY
                       │
                     PLACE
```

Argos is no longer an animated dog with an AI layer. He becomes a descendant
of Silas living inside Hlíðarendi. And Hlíðarendi becomes the experiment
that Silas never had: not an autonomous animal on a demonstration floor, but
an animal that can acquire a human, a home, a place, and a history.

The key change is architectural, not literary. The 0.1 target says success
is a body, dog, dwelling and place finally agreeing about the same world.
**0.2 is the Silas threshold: the dog has something of its own to do, human
direction enters as evidence rather than motor control, and you can read the
resulting conflict in its body.**

That is the point where this stops being "Argos integrated into Terrarium"
and becomes a genuine synthetic-creature project.

## The donors now vendored (`argos/`)

- [`argos/ARGOSHALFDOGSCULPTEDv01.html`](argos/ARGOSHALFDOGSCULPTEDv01.html) —
  ARGOS · living animal runtime v2.3, the anatomy/locomotion donor SPEC §1B
  was waiting for.
- [`argos/argoshalfdogintegrated.html`](argos/argoshalfdogintegrated.html) —
  ARGOS · unified half-dog, the world-contract donor (`setMoveTarget`,
  `setGazeTarget`, `getState`, quality modes).
- [`argos/argos.html`](argos/argos.html) — ARGOS · half-dog, the game
  contract (identical to `sources/argos-half-dog.html`, the source of record
  the build extracts `window.AR` from).
