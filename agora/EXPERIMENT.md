# Do the antbats actually make the buildings better?

The objection writes itself: the ants decide what a defect is, then remove the
defects they defined. So the experiment is judged by something the antbats never
see, and run against a control that makes exactly the same edits in the wrong
places.

Harness: `agora/ab.mjs`. Judge: `agora/judge.js`. Raw output: `agora/ab-results.json`.

---

## The judge

**`lintWorld()`, ported verbatim** from `OPERATIVE BUILDER — FUCKED UNTIL PROVEN
OTHERWISE` — the same six rules, the same severities, the same `severityFloor`
ladder. That program's own code, judging scenes it never saw.

The port has one unavoidable judgement call and one adaptation, both declared in
the file and both applied identically to every arm:

- Its linter keys on a **semantic kind** (`mass`/`floor`/`column`/`door`/`stair`/
  `path`) which correspondence scenes do not carry. A regex maps role and id onto
  those kinds.
- Its `FLOATING` rule asks for a declared `supportId`. Correspondence scenes
  declare none — the pagoda declares zero connections across 92 parts. So three
  support modes are reported: **`declared`** (verbatim, `supportId` only),
  **`strict`** (a `supportId` *or* a declared connection), **`geometric`**
  (something is actually underneath and touching).

**Plus a visibility test the antbats have no instrument for.** Six semantic views
— FRONT BACK LEFT RIGHT TOP ENTRY, the brutal loop's own sensor policy — rendered
in an independent scene with one flat colour per part, reading back which colours
survive. This is the closest computable thing to what the correspondence critic
was actually looking at.

## The control

**Matched random.** The antbat arm's operations are recorded, and the identical
multiset is replayed onto randomly chosen parts, three times, mean reported.

This is the control that matters. It does not ask "is editing better than not
editing" — it asks whether **knowing where to edit** is worth anything.

Arms: `before`, `antbat full`, `antbat move` (no operation may create a part),
and a matched random control for each. Four buildings, three generations,
150 ant steps per generation.

---

## Run 1 was negative

The first run had no `GROUND_FLOATING` operation and its enclosure posts started
in mid-air. Result: antbat ≈ random on every building, and the lint count went
**up** in both arms — seed 5→23, pagoda 88→103, lander 12→25.

The per-rule table said why, and it was not subtle:

- Every additive operation put unsupported geometry into the air. `ENCLOSE_CAVITY`
  alone adds five posts, hanging. **The genie was manufacturing the exact defect
  class the ants exist to find.**
- `EXPOSE_BURIED` and `ENCLOSE_CAVITY` pushed parts under grade: `BELOW_GRADE`
  appears only in the antbat arm, 5 on the seed and 4 on the lander.
- And `FLOATING` — the commonest finding any outside linter makes about these
  buildings, **88 on the pagoda alone** — had no operation at all. The genie could
  not act on it.

Three changes followed: a `GROUND_FLOATING` operation that lowers the worst
offender until something is actually beneath it (a move, not an addition), posts
that run from grade to the top of the cavity so they hold something up, and a
clamp that stops any relocation pushing a part below its own half-height.

## Run 2

| building | arm | parts | strict | /part | declared | geometric | visible |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **seed** | before | 11 | 5 | 0.45 | 5 | 1 | 90.9% |
| | antbat full | 27 | **9** | 0.33 | **9** | **2** | 100.0% |
| | random full | 27 | 16.0 | 0.60 | 16.0 | 7.3 | 97.4% |
| | antbat move | 13 | 7 | 0.54 | 7 | **1** | 92.3% |
| | random move | 13 | **5.3** | 0.42 | 5.3 | 2.0 | 92.3% |
| **pagoda** | before | 92 | 88 | 0.96 | 88 | 18 | 98.9% |
| | antbat full | 112 | **88** | 0.79 | **91** | **18** | 97.3% |
| | random full | 112 | 107.3 | 0.96 | 107.3 | 28.7 | 97.3% |
| | antbat move | 92 | **83** | 0.90 | **85** | **13** | 98.9% |
| | random move | 92 | 88.0 | 0.96 | 88.0 | 17.3 | 99.3% |
| **lander** | before | 81 | 12 | 0.15 | 74 | 1 | 100.0% |
| | antbat full | 102 | **18** | 0.18 | **80** | **6** | 99.0% |
| | random full | 100 | 30.7 | 0.31 | 93.0 | 11.7 | 96.0% |
| | antbat move | 83 | **11** | 0.13 | **74** | 7 | 100.0% |
| | random move | 82 | 12.0 | 0.15 | 75.0 | **1.3** | 99.2% |
| **cabin** | before | 44 | 6 | 0.14 | 41 | 1 | 100.0% |
| | antbat full | 48 | **3** | 0.06 | **41** | **1** | 100.0% |
| | random full | 47 | 7.3 | 0.16 | 42.7 | 2.3 | 100.0% |
| | antbat move | 47 | **3** | 0.06 | **41** | **1** | 100.0% |
| | random move | 46 | 6.3 | 0.14 | 42.7 | 1.0 | 100.0% |

**Against the matched control: the antbats win 7 of 8 on the strict lint and 6 of
7 on the geometric lint** (one tie). Same operations, same counts, different
targets — and the difference is measured by another program's rules.

That is the answer to "with or without ants." **Where an edit goes is worth
something, and the amount is measurable by someone who is not us.**

The `declared` column matters because `strict` counts a declared connection as
support, and `RELOCATE_ORPHAN` writes a connection when it moves a part — a
channel through which the genie could flatter itself. Under `declared`, which is
the original rule verbatim and cannot be written into, the antbats still beat
random on all four: 9 vs 16, 91 vs 107, 80 vs 93, 41 vs 42.7.

## Against doing nothing, it is mixed, and that is the honest headline

- **cabin: better.** 6 → 3 findings, 0.14 → 0.06 per part, `NO_DOOR` removed.
- **pagoda, move-only: better.** 88 → 83 strict and 18 → 13 geometric at the
  *same part count* — no addition, no dilution.
- **lander, move-only: better on strict** (12 → 11) **and worse on geometric**
  (1 → 7). Moving parts to clear what they were buried in lifted them off what
  they were sitting on.
- **seed: worse in raw count** (5 → 7 or 9) **and better per part** (0.45 → 0.33)
  **and better on visibility** (90.9% → 100%).

So: the ants beat a randomly-aimed version of themselves everywhere. They beat
*standing still* on two buildings clearly, one partially, and one not at all.

## The cabin's door

`ADD_DOOR` removed `NO_DOOR` and produced `DOOR_NO_ARRIVAL` — the judge now says
the door exists and nothing arrives at it. That is correct behaviour, and the
disagreement underneath it is real: the antbat's arrival vocabulary counts a
`deck`, the judge's does not. **The judge is probably right.** A deck is not an
arrival to a door.

## Cost

Across the four correspondence logs: **60 API calls, 59,541 KB of input, 1,158
seconds of model time** — and the cabin still had no door. The antbat reading of
the same four buildings is **zero API calls**, and it names `NO_DOOR` on all 44
parts in the first pass.

That is the only sense in which "easier to make the model better" was tested
here: cost, and the specificity of the accusation. `wall-n-a floats 2.10m with
nothing under it, lower it 2.10m` is a different kind of instruction from
`the entire long elevation is still a gigantic translucent void`. Whether an LLM
builder actually does better when handed the first is **not tested** — that needs
an API key and a re-run of the loop, and it is the obvious next experiment.

## Limits, stated plainly

- **n = 4 buildings, 3 generations, 3 random repeats.** No significance testing;
  7-of-8 is a count, not a p-value.
- **`severityFloor` was useless.** It is a maximum, so a single high finding pins
  it at 75, and it read 75 in every arm of every building. It cannot show partial
  improvement and should not have been expected to.
- **Visibility had no room to move.** These buildings are sparse and exploded;
  three of four were already at 100% before anything happened. Only the seed
  gained (90.9% → 100%).
- **The semantic-kind mapping is a judgement call.** Identical across arms, so it
  cannot favour one, but a different mapping would move the absolute numbers.
- **The random control replays operation *types*, not the antbats' exact
  displacement magnitudes.** A relocation aimed at nothing travels a different
  distance than one aimed at a neighbour.
- **Nothing here says the buildings are good.** It says a reading that names a
  part beats the same edit aimed at a random part, on another program's rules.
