# ANTBAT-GENIE — the theory before the program

This document contains no code. Following `THEORY.md`, the claim is Naur's: the
program is the theory held by whoever built it, and the file is a lossy
projection. `antbat-genie.html` does not exist yet. This is what it is, so that
the file can be checked against it rather than excavated out of it later.

The evidence is not speculative. It is four exported correspondence sessions
(`2026-08-19T01:59Z`, `02:31Z`, `02:57Z`, `03:04Z`), six builder HTMLs from
`Focus/Build/Sucks v4` through `Depot Clinic / Ant Lidar v14`, and
`OPERATIVE BUILDER — DEPOT WARD / REGISTERED LASER CT v10`.

---

## 0. What the archive actually shows

The `Correspondence` line is an objective-driven loop: a reference photograph is
the target, a critic returns a **suck score** 0–100, and the settings carry
`threshold: 15`. Below 15 the target has "survived"; above it, "target still
sucks." The loop's whole purpose is to walk that number down.

Here is every session in the archive:

| export | subject | cycles | parts | connections | final suck | threshold |
| --- | --- | --- | --- | --- | --- | --- |
| 01:59Z | pagoda on island | 7 | 92 | 0 | **96** | 15 |
| 02:31Z | lunar lander | 16 | 81 | 173 | **99** | 15 |
| 02:57Z | howl's castle | 6 | 46 | 60 | **100** | 15 |
| 03:04Z | clad cabin | 7 | 44 | 60 | **98** | 15 |

Four for four, the objective was not approached. It was not approached
*slowly* — it was not approached at all. The nearest any session came to 15 was
96. The 16-cycle lander session logged this trajectory:

```
10, 9, 9, 94, 88, 92, 96, 95, 91, 89, 91, 94, 97, 98, 99
```

Three cycles of near-success, then a permanent residence in the high nineties.
The castle session pinned at 100 for its final three cycles with
`focusAttempts: 4` and `criticRepeatSimilarity: 0.236` — the critic accusing the
same wall four times in slightly different words while the builder rebuilt it
four times and the number did not move.

Two further readings of the same table:

**The machinery built to make the loop converge coincided with worse numbers.**
The 01:59Z session predates `focus` entirely — its `scores` entries carry no
focus field. It scored 96 with 92 parts. Every later session has focus locking,
focus attempt counting, repeat-similarity detection, escalation counters, and a
`COMMIT_PROMPT` rescue builder for when "the cheap builder has encountered the
same resistance repeatedly." Those sessions have 44–81 parts and scores of
98, 99, and 100. Four subjects, four references, n=4 — this is not a controlled
result. It is, however, the only trend the archive contains, and it points the
wrong way for the theory the machinery was built on.

**And all four sessions produced buildings.** A 92-part pagoda with a landscaped
island. An 81-part lander with a 173-edge connection graph. A riveted castle
hull. The final critiques call these "a blunt stack of oversized blank boxes,"
"a chaotic set of disconnected gold rods," "utterly uncontrolled," "a gigantic
translucent void bounded by timber rails." Those are accurate descriptions of
failure against the reference and *inaccurate descriptions of what was made*.
Forty-four boxes and four cylinders arranged into a translucent cage bounded by
timber rails is a thing. It is not a cabin. It is a thing.

The suck score cannot see the difference between "not the cabin" and "nothing."
That is the whole problem, and it is not a tuning problem.

---

## 1. COLLECTOR DIAGNOSTIC

**The Abandoned Objective.**
`threshold: 15`. The reference photograph as target. The critic's standing order
to `PICK ONE THING` and the builder's standing order to `Stop after one coherent
construction gesture`. The escalation ladder, the repeat-similarity detector, the
`COMMIT_PROMPT` rescue path. The entire apparatus for driving one number down
against one picture. Deleted — not softened, not reweighted, not made optional
behind a settings toggle. The `#suck-score` element and every branch that reads
`state.currentScore` come out of the program.

**The Novelty Bait.**
`chooseAntMove` — thirteen lines in v14 — already runs on novelty and already
disbelieves in consensus. Its terms, verbatim:

```
novelty       = 1.65 / (1 + visited[idx] * 0.7)      ← largest term
base          = diag.base[idx] * 1.18
gap flag      = gapFlag[idx] * 0.92
collision     = collisionFlag[idx] * 0.78
jitter        = Math.random() * 0.4
scent         = pheromone[idx] * 0.22                ← smallest term
recentPenalty = recent.includes(idx) ? 1.25 : 0      ← negative
```

An unvisited node scores 1.65 on novelty alone. A node soaked in trail from
every other ant contributes 0.22×. **Scent is weighted at one-seventh of
novelty, and being where an ant just was is a penalty.** Whoever tuned these
numbers built an anti-convergence agent, put it inside a convergence engine, and
never let it near the steering. The ants have been the stepping stone collectors
in this codebase the entire time. They were hired as a diagnostic subroutine and
their findings are handed to a critic that has already been told to pick one
thing.

The new compass is the vector these weights describe. Not "does this reduce
suck" — *has anyone been here, and if not, what happens there.*

**Deceptive Potential — the alien face eyes.**
`summarizeAntMetrics` returns a field called `unresolvedHot`:

```js
if (visited[i] === 0 && ((gapMarks[i]||0) > 0 || (collisionMarks[i]||0) > 0))
  unresolvedHot++;
```

Nodes that were flagged as gap or collision suspects **and that no ant ever
reached.** It is reported as `unresolvedHotPercent`, printed on a contact sheet,
and treated as a coverage complaint — the crawl's confession that it ran out of
steps.

It is not a complaint. It is a list of the most interesting locations in the
building, defined precisely as *places the evidence says are strange and that
nothing has yet been able to walk to.* An objective-driven system reads that as
incomplete coverage and lengthens the crawl. A collector reads it as an archive
and goes there on purpose.

`unresolvedHot` is the seed. Everything below grows out of treating that counter
as a destination register rather than an error bar.

---

## 2. The Objective Purge

What comes out, and why each removal is not a loss:

**The reference photograph as target.** It stays in the program as an *object* —
loadable, viewable, comparable — and loses its authority. It becomes one member
of the cohort, not the cohort's judge. `discoverDepotPatients` and
`exportCohortJSON` already treat the repository as a population; v14's comment
reads "A repository is a cohort." The clinic diagnoses each patient against a
reference. The archive keeps each patient because it is not like the others.

**The single accusation.** `CRITIC_PROMPT` says `PICK ONE THING`, `NO LIST`,
`NO VIBES`, and hands its accusation directly to the builder as the next prompt.
This is gradient descent implemented in English, and the castle session shows it
descending into the same wall four consecutive times. Antbat-genie has no
critic. Nothing in it is authorized to say what the building should have been.

**The threshold and its two states.** `'target survived · find next'` versus
`'target still sucks'` is a binary read of a continuous field, and the field is
where the information lives. See §7.

**The ordeals as punishment.** `runShakeOrdeal`, `runRainOrdeal`, `runDarkOrdeal`
disturb the world "to see what failed." They stay. Their verdict function goes.
A disturbance that produces an unexpected response is a finding regardless of
whether the response is bad.

**The middle ground, specifically.** v13 and v14 both keep a fallthrough verdict
in `classifyInverse`:

```js
return 'AMBIGUOUS · acquire another local scan before blaming structure or eye';
```

Five confident branches — eye failure likely, structure anomaly candidate, eye
still fucked, structure permeability candidate — and then the honest one, coded
as `else`. The `else` branch is the only one that reports the actual epistemic
state most of the time and the only one whose recommendation is *look again*. In
antbat-genie it is not the fallthrough. It is the normal case, and the five
confident verdicts become annotations on it.

---

## 3. Eight things already in the code that were built as plumbing and are actually the organism

### 3.1 The isotope was already running

```js
for (let i = 0; i < pheromone.length; i++) pheromone[i] *= .992;
```

One line — present identically in both `antLidarCrawlScan` and
`antLidarMetricsOnly` — executed once per crawl step, called evaporation. Solve
`0.992ⁿ = 0.5`: **n = 86.3 steps.** That is a half-life. The program has been
running a first-order decay constant on a deposited label for four versions
without anyone naming it as one. It is not a metaphor for radioisotope tracing.
It is the arithmetic of radioisotope tracing, with a different word on it.

Which means the radioisotope work does not begin by adding decay. It begins by
noticing decay is present, and asking the question decay makes available and
evaporation does not: **not where is the label now, but where did it go.**

### 3.2 The trail is deposited but never read as a transfer

Gösswald and Kloft fed ants ³²P and did not follow the ants. They counted the
label in the *rest of the colony* — in ants that never visited the source — and
recovered the trophallaxis network, the sharing graph, from the distribution of
a substance nobody watched move.

v14 deposits `0.06 + base[cur]*0.17` at each visited node and decays the whole
array. It never records a transfer. `pheromone[i]` is a scalar with no
provenance: at step 400 you know a node is hot and you do not know which ant, at
which step, carrying what finding, made it hot. The colony's entire social
structure is being computed and thrown away every frame.

**The primary new datum in antbat-genie is the labelled transfer**, and it is
one record:

```
{ from_node, to_node, step, caste, label_id, activity }
```

`label_id` identifies the *finding* — a specific gap suspicion, a specific
parity flip, a specific unreachable neighbor — not the ant. Ants are couriers.
The isotope is the finding, and it decays: an unrefreshed finding fades on an
86-step half-life whether or not anyone disproved it. A finding that stays hot is
one that independent couriers keep re-depositing, which is exactly the
`witnesses >= 3` condition that v10's `classifyInverse` already reaches for and
computes only for its top hotspot.

The output is not a heat map. It is a **label ledger**, and the question you ask
it is: *which findings travelled?* A defect that stays where it was found is
local. A defect whose label propagates across half the surface graph is
structural, and you learn that without any part of the program knowing what a
structure is.

### 3.3 `lostMoves` is a room detector wearing a failure costume

```js
const next = chooseAntMove(...);
totalMoves++;
if (next === cur) lostMoves++;
```

An ant with nowhere better to go stays put. It is counted, divided, reported as
`lostMovePercent`, and read as wasted computation.

A lost move happens when every one of a node's seven nearest neighbors is worse
than standing still — which means the ant is in a pocket of the surface
neighborhood graph with no continuation. That is not inefficiency. **That is the
signature of a boundary.** The surface stops there. Enough lost moves clustered
together and you have found an edge, a corner, an isolated shell, or a piece of
geometry that connects to nothing — a wall that is not attached to a house.

The 01:59Z pagoda has 92 parts and **zero connections**. Ninety-two pieces of
geometry with no declared relationship to each other. The critic called it
"floating gold rods and balls are disconnected nonsense." The lost-move counter
knew, in the geometry, without the reference, without the critic, and without a
word of English.

### 3.4 Parity already knows what a room is

`rutherfordLocalScan` counts unique intersections along each ray and sorts the
count by parity:

```js
if (n === 0)              transmitted++;   // passed clean through
else if (n % 2 === 1)     odd++;           // ended up inside something
else if (n >= 4)          dense++;         // nested layers
```

An odd number of surface crossings means the ray terminated inside solid.
`deepSectionMap` paints the same parity across three orthogonal planes and calls
it a CT surrogate. Both treat odd parity as a *defect* — non-manifold geometry,
a hole in the mesh.

But an ant walking a closed surface that crosses into an interior has flipped
parity, and it can know this locally, from its own step, with no global mesh
analysis and no room primitive anywhere in the program. **Interiority becomes a
property an agent discovers by walking, not a fact the model declares.** A room
in antbat-genie is not a box you place. It is a region from which parity does
not flip back, discovered by whoever wandered in.

This is the deceptive step stated most sharply: the parity-odd count was built as
a mesh-integrity error metric. It is a floor plan.

### 3.5 Every emitter in the system points inward from outside

The fly eye: 12 fixed stations on a shell, `diagnosticRigDescriptors()`.
The laser dogs: 6 agents on a sphere at `R = radius * 1.65`, moving, but always
on that sphere — `houndCandidatePositions` returns `center + dir * R` for every
candidate. The collector: an exterior receiver shell catching escaped photons.
The dome: `domeInwardEvidence(72)`.

Everything looks in from the outside. The ants are the only agents on the
surface, and they carry no light. v14's comment — "Every situated camera is an
emitter + receiver" — is true of all twelve cameras and none of the ants.

The user's instruction is to build **laser emitters along routes.** That is not
an added feature. It is the inversion of the program's entire optical
architecture: the ant deposits an emitter where it walked, so the trail stops
being a message to other ants and becomes *hardware for later*. Stigmergy
becomes instrumentation.

Consequences that follow without further invention:
- The emitter lattice is dense exactly where the ants found things interesting,
  because that is where the ants went. Instrument density is allocated by
  curiosity rather than by a Fibonacci sphere.
- An emitter inside a discovered interior illuminates from a position no
  exterior rig can occupy. The blind regions in `WORLD − TWIN` are blind because
  no shell station can see them. An ant that walked in can put a light there.
- Emitters see each other. `mutualCameraEdges` already computes which stations
  have clear line of sight; run it on a route lattice and the mutual-visibility
  graph is a map of the building's *interior connectivity* — which is the thing
  the connections field was supposed to hold and holds zero of in the pagoda.
- The building's own construction history becomes its sensor array. Where you
  built early, you can see well.

### 3.6 The bat has no ancestor here

`bat`, `echo`, `sonar`, `acoustic`, `radio`, `isotope`, `tracer`, `fuzzy`,
`genie` — zero occurrences across all six HTMLs. `pheromone` appears 20 times in
v14, `caste` 27 times in v10, `colony` 50 times. The formicary is mature. The
bat is genuinely new, and it should be, because it contradicts the optical
program on purpose.

Every existing instrument is a **position** epistemology: where is the camera,
what can it see, is this surface covered. The bat is a **delay** epistemology:
emit, wait, and let the return time say how far the void extends. A bat does not
need to see a room. It needs the room to take longer to answer than the wall
did.

And the program already asked for this and did not recognize the request.
`runDarkOrdeal` kills the lighting graph and checks what fails. It is filed as a
punishment — a stress test the building is supposed to survive. **Dark is the
bat's native medium.** The DARK ordeal is not a test the building failed. It is
the program asking, in the only vocabulary it had, for a sensor that does not
need light. That request has been sitting in the ordeal list unread since v8.

What the bat adds that no camera can: a camera reports *surface*. Time-of-flight
reports *the gap between surfaces* — volume, cavity, the size of the nothing.
The whole existing diagnostic suite measures skin. Not one instrument in v14
measures a room's dimension. The bat measures air.

### 3.7 Three castes, and the missing fourth

```js
function colonyCasteColor(c) {
  return c === 'seam'   ? 0xefbd4d   // amber
       : c === 'clash'  ? 0xff514b   // red
       : c === 'verify' ? 0xd85ce5   // magenta
       :                  0x2de2d0;  // cyan — unnamed
}
```

Seam, clash, verify — and a default cyan for ants that are none of those. Three
named castes, all three defined by a defect they are looking for. The unnamed
cyan caste is the largest population and has no job description.

Name it. The fourth caste is the one that is not looking for anything, and in a
program with no objective it is the senior caste. It goes to `unresolvedHot`. It
places emitters. It is the one whose findings have no category yet, which is the
definition of the only findings worth keeping.

### 3.8 The one instrument that already measures the instrument

`leakConvergenceScan` runs the same leak test at increasing ray density and asks
whether the answer stops moving:

```js
const stable = delta < Math.max(.25, last.escapePercent * .12)
            && spread < Math.max(.8, last.escapePercent * .25);
```

It reports `'persistent leak signal'` or `'sampling-dependent leak signal'`.
This is the only function in 240 KB of diagnostic code that measures its own
reliability instead of the building's quality, and it is the model for every
instrument in antbat-genie. Nothing gets to report a finding without reporting
whether the finding survives being measured differently.

---

## 4. The three animals

### ANT — deposits
Walks the surface. Cannot see. Knows its seven nearest neighbors, its own recent
history, and what it is carrying. Moves by novelty first, scent last. Deposits
labelled findings that decay on a half-life. Places emitters where it goes.
Discovers interiority by parity flip. Reports lost moves as boundaries.

The ant is the only agent that can be *somewhere*. Every other instrument in the
system is a viewpoint.

### BAT — interrogates
Flies. Emits into the dark and reads delay. Does not care about surfaces except
as the things that end a delay. Measures cavity, void, the unfilled. Hunts on
return-time anomaly: a return that is too late for the geometry it was aimed at
is a room nobody declared; a return that is too early is something in the way
that nothing built.

The bat's fitness is not coverage. It is **surprise per emission** — the
divergence between the delay it predicted from the current model and the delay
it got. A bat flying through a well-understood building learns nothing and its
emissions are wasted; a bat that keeps being surprised has found the part of the
building the model is wrong about. Follow the surprise.

The bat and the ant do not agree and are not made to agree. The ant knows the
skin. The bat knows the air. Where they disagree — the ant says solid, the bat's
delay says cavity — is the highest-value coordinate in the system, and there is
no arbitration step. The disagreement is the output.

### GENIE — grants
The genie is the recursion, and it is named genie for the reason the folktale
name is right: **a genie grants exactly what was asked and never what was
meant**, and the classic third wish is spent undoing the first two.

That is a precise description of the correspondence loop. Cycle 7 of the castle
session spends its wish undoing cycle 6. `focusAttempts: 4` is four wishes spent
on one wall. An objective-driven builder is a genie you keep wishing at.

Invert the direction of the wish. The genie in antbat-genie does not take a wish
and return a house. **It takes a house and returns the wish that house implies.**
Given a built thing and everything the ants and the bat found in it, the genie
answers: what was this trying to be, judged only from what it is? Not "how close
is this to the reference" — there is no reference — but "what does a building
with these cavities, these unreachable hot nodes, this parity structure, this
label-transfer graph, this pattern of lost moves, want next?"

Then that answer is built, and the whole thing runs again on the result. House →
implied wish → house′ → implied wish′. Recursion with no fixed point, which is
the point: a fixed point would be arrival.

The genie is why "recursively better house" needs no target. Better does not
mean closer to a picture. It means: **the next house is one the previous house
could not have been read as wanting.** Novelty measured against your own
lineage, not against a goal. That is the only definition of improvement that
survives having no objective, and it is sufficient.

---

## 5. Fuzzy: no defuzzification

The v14 diagnostic layer converts continuous evidence into crisp flags at every
step. `antNodeDiagnostics` alone:

```js
if (s.eyes === 0)  { score += 3.00; gapFlag[i] = 2 }
else if (s.eyes < 3) { score += 1.45; gapFlag[i] = 1 }
if (s.touches === 0) score += 2.35;
else if (s.touches === 1) score += 0.85;
if (dot < 0.55) mismatch++;
if (dot < 0.25) mismatch += 0.8;
if (e.dist < graph.meanNearest * 0.68) tooClose++;
if (rough > 0.45) { collisionFlag[i] = 1; score += 1.2 }
if (dense > 0.34) { collisionFlag[i] = 2; score += 1.0 }
```

Then `summarizeAntMetrics` cuts again — `gapMarks[i] >= 2` to count as a
suspect — and `classifyInverse` cuts a third time at `.045`, `.08`, `>= 3`,
`.46`, `.55`, `.72`, `.42`. Three rounds of crisp-ification between measurement
and report.

A node with `eyes = 3` and a node with `eyes = 30` are the same node after line
two. A normal-dot of 0.549 and one of 0.551 are different findings. **Every
threshold in this list is a place where a stepping stone was thrown away for
looking like the wrong thing**, and there are more than twenty of them before
anything reaches a human.

The rule for antbat-genie is one line: **carry the membership, never collapse
it.** A node's gap-ness is a number in [0,1] all the way to the render. Its
collision-ness is another. They are not combined into a severity. An ant is
80% seam and 30% verify simultaneously and is drawn as such. `AMBIGUOUS` is a
legitimate terminal state that never resolves and is not an error.

This is not softness for its own sake. Crisp thresholds are how an objective
smuggles itself back in after you delete it: the moment you write
`if (score > 0.45) it's a defect`, you have re-created a target with extra steps.
The fuzzy field is what makes the divergence in §4 possible — ant and bat can
only *disagree by degrees* if degrees survive.

---

## 6. What you see — picturing the ants

The existing renderer draws ants as a sphere plus a smaller offset sphere for a
head, sized at `0.0042 × scene diagonal`, colored by caste, with trail segments
at 26% opacity and a `setDrawRange(0, 0)` reveal. Keep the body. Change what the
scene is made of.

- **The ants are lit from inside their own history.** As routes accumulate
  emitters, the trail stops being a translucent line and becomes a strand of
  point lights. Early in a run the building is dark and a dozen crawling points
  are the only illumination. The picture of the building is literally built out
  of where the ants have been. Coverage is not a percentage on a contact sheet;
  it is how much of the model you can see.
- **Four castes, fuzzy-blended.** Not `caste === 'seam' ? amber : ...` but a
  weighted mix of amber/red/magenta/cyan by membership degree. An ant carrying an
  unresolved mixture is a color that has no name, and that is correct.
- **Labels glow and fade on their half-life.** A finding deposited at step 100
  is at half brightness by step 186 unless someone re-deposits. The building
  visibly forgets. Watching what *refuses* to fade is watching the real defects
  select themselves with no threshold anywhere.
- **The bat is a sweep, not a point.** Draw the emission cone and the return
  ring at the delay-implied radius. Where the return ring lands far outside the
  visible surface, draw the discrepancy — that is a cavity being asserted, and it
  should look like an assertion.
- **Lost moves are marked in place.** Every stalled step drops a small tick.
  Boundaries draw themselves as tick density, and a disconnected part shows up as
  a shape outlined entirely in ticks.
- **Parity-inside nodes render on the opposite face.** A node an ant reached
  from the interior is drawn with an inward normal. A building with discovered
  rooms looks different from one without, before anything has counted anything.

`makeColonyProjection` already flattens tracks and field onto two axes and rings
the top eight hotspots. Keep it and remove the ranking — the numbered circles are
a leaderboard, and a leaderboard is an objective with a nicer typeface.

---

## 7. What the program keeps

Not a score. A ledger. Everything below is per-run and appendable, and none of
it reduces:

```
labels[]     { label_id, origin_node, activity, born_step, kind_membership{} }
transfers[]  { label_id, from_node, to_node, step, caste_membership{} }
emitters[]   { node, placed_by, step, mutual_visibility[] }
delays[]     { from_emitter, direction, predicted, measured, surprise }
parity[]     { node, flips[], interior_membership }
stalls[]     { node, step, neighbor_states[] }
frontier[]   { node, why_interesting, still_unreached }   ← unresolvedHot, promoted
lineage[]    { house_id, parent_id, implied_wish, novelty_vs_ancestors }
```

`frontier` is the register §1 identified as the seed. It is not an error count.
It is the to-do list, and a healthy run *grows* it — finding more places you
cannot reach yet is progress, because the alternative is a building with no
unreached interesting places, which is a building that has stopped.

`lineage` is the genie's memory and the only thing resembling a fitness measure
in the program: a house's novelty against its own ancestors. It is never
compared to a reference and never thresholded. It is recorded.

---

## 8. What antbat-genie will not do

- No reference-as-target, no suck score, no threshold, no "target survived."
- No single accusation, no focus lock, no escalation ladder, no rescue builder.
- No arbitration between the ant's surface and the bat's air. The disagreement
  is preserved and reported as a coordinate.
- No defuzzification before render.
- No hotspot leaderboard, no top-N, no ranking that implies the rest matter less.
- No stopping condition. A run ends when the operator stops watching.
- No claim that the resulting house is good. The claim is that it is not any of
  the previous ones, and that the ledger says exactly how.

---

## 9. THE DIVERGENT PHILOGYNY — stepping stones, unresolved

These do not converge. Each is developed far enough to be built and no further,
and none of them is required to justify itself against another.

**i. Parity as the only floor plan.** Delete every room concept and let
interiority be a walked discovery. A house whose rooms exist only because ants
flipped parity into them and could not flip back. Rooms with no doors declared —
doors are wherever parity flips easily. What is a corridor, in this definition?
A region of trivially flippable parity. What is a sealed void? A parity region no
ant has ever entered, which the bat's delay insists is there. That last case has
no name in any building vocabulary and it is the most interesting object the
system can produce.

**ii. The label ledger as social structure.** Run the transfer graph and ignore
the geometry entirely. Which findings travelled, through whom, and where did they
pool? A building described only by how its defects gossip. It should be possible
to identify structural members from the transfer graph alone, with the mesh
deleted — a load path is a thing many labels cross.

**iii. Instrument density allocated by curiosity.** Emitters land where ants went;
ants go where nobody has been; therefore the instrument is densest exactly where
the model was weakest, and the map of instrument density *is* a map of the
model's own historical ignorance. Print that map. It is a portrait of what the
program did not know, at the resolution of what it now does.

**iv. Ant/bat disagreement as a material.** Not a bug to arbitrate. Feed the
disagreement field to the genie as the primary input and see what a builder does
when its brief is "here is where two senses contradict each other." The output
would be a building made specifically of ambiguities. Nobody has asked for that
building. That is the argument for it.

**v. The genie run on its own transcripts.** Feed the genie a lineage instead of
a house and ask what the *sequence* implies. Second-order wish. It should be
possible to get a house that is the implied next member of a series, which is a
different object from the implied improvement of a member.

**vi. Decay tuned per finding rather than globally.** `.992` is one constant for
every label. Give a parity finding a long half-life and a coverage complaint a
short one and the ledger starts to have a *chemistry* — species of finding with
different persistences, competing for the same nodes. Nobody knows what that
does. That is the reason to do it.

**vii. The four sessions in the archive, rerun with no critic.** The pagoda, the
lander, the castle, the cabin — same builder, same models, references present as
objects and stripped of authority. Not to see whether they score better. To see
what forty-four boxes and four cylinders become when nothing is telling them they
are failing to be a cabin.

**viii. The unnamed cyan caste.** Still unnamed here, deliberately. It is the
caste with no defect to look for, and naming it now would give it one.

---

The archive contains four buildings that a number called failures at 96, 98, 99,
and 100. This document does not argue that the number was wrong. It argues that
the number was answering a question nobody needed answered, while
`unresolvedHot`, `lostMoves`, the parity histogram, and a decay constant with an
86-step half-life sat in the same file, unread, answering better ones.

The next move is not to fix the score. It is to go stand at one of the
unreachable hot nodes and see what is there.
