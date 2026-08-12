# TERRARIUM

> A small world held close enough to watch itself become alive.

Terrarium is accountable, conversational ground inhabited by a drivable body. Movement leaves traces. Language becomes world-action. The standing arrangement can be unsettled without erasing its history.

It brings together four related lines of work:

- [Unsettled Atlas](https://github.com/hartswf0/unsettled-atlas) contributes the doctrine: spatial arrangements are made, normalized, and therefore available to be questioned and reconstructed.
- [MOTOR](https://hartswf0.github.io/motor/) contributes the ground: CREO makes a place conversationally operable, while WORLDTEXT treats language as the dormant state of a world.
- [HELLO WORLD TEXT](https://hartswf0.github.io/hello-world-text/) contributes the threshold: the smallest piece of language that proves a world can be addressed, rendered, and entered. Its [source repository](https://github.com/hartswf0/hello-world-text) holds the larger development line.
- [Thunder Rigs / Unset 03](https://hartswf0.github.io/hello-world-text/unset-03.html) contributes the inhabitant and society: the body, forge, commons, theatre, arena, and room that make a world playable and shared.

TERRARIUM is the project that emerges where those systems meet.

## Enter

The [project landing page](https://hartswf0.github.io/terrarium/) presents two complementary builds:

### [Terrarium](https://hartswf0.github.io/terrarium/TERRARIUM.html)

The living-ground build. Import a real place; read its terrain, buildings, parcels, and water; talk to what is there; make accountable changes; and keep alternative futures as branches.

### [Unsettled Atlas × Thunder Rigs — Unset 04](https://hartswf0.github.io/terrarium/unset-04-hartsoe-jr.html)

The inhabited-world build. Make a rig, enter a synthetic world, drive, build, play, leave sediment, raise normalization pressure, and unsettle what began as given.

Both are browser-native. `TERRARIUM.html` is a self-contained build; `unset-04-hartsoe-jr.html` is a self-contained playable world.

## The model: weather, trace, deed

Terrarium separates three kinds of time:

1. **Weather** — motion without a ledger. Driving, looking, passing bodies, rain in flight, and other live events move at frame rate without rewriting the world.
2. **Trace** — repetition becoming ground. Ruts, habits, normalization pressure, and threshold crossings accumulate until motion becomes a condition the world can show.
3. **Deed** — accountable change. Buildings, testimony, branches, and commitments enter the journal with an author, provenance, consequences, and a path back.

This separation is what lets the world feel alive without making every movement permanent, and lets history emerge from activity instead of being added as decoration.

## What is here

- Real-place import with OpenStreetMap geometry and AWS Terrarium elevation
- Conversational selection, questioning, proposals, and testimony
- Journaled transactions with undo, redo, authorship, and export
- Parallel branches for alternative futures
- Flood, drainage, movement, shade, and consequence simulations
- A drivable body with collision, terrain response, and dynamic rendering
- Sediment, normalization pressure, thresholds, unsettle, and resettle
- Certified building placement and spatial admission rules
- Browser-local operation with no application server required

An API key is optional. The deterministic world, tools, simulation, driving, branches, and local record work without one. When a model is used, it works through the world's tools and proposals rather than becoming a second source of spatial truth.

## Run locally

```sh
python3 serve.py
```

Open <http://localhost:8000> for the landing page. The two builds are available at:

- <http://localhost:8000/TERRARIUM.html>
- <http://localhost:8000/unset-04-hartsoe-jr.html>

## Test

```sh
node tests/run.js
node tests/audit-geometry.mjs
```

## Project map

- `index.html` — sendable project landing page
- `TERRARIUM.html` — self-contained Terrarium build
- `unset-04-hartsoe-jr.html` — self-contained Unsettled Atlas × Thunder Rigs build
- `src/` — modular Terrarium source
- `places/` — included place records
- `tests/` — geometry, world, persistence, and professional-use tests
- `TERRARIUM.md` — the integration theory and failure audit
- `STANDING-WORLD.md` — the standing-world model
- `THEORY.md` — CREO's design doctrine

## Data and provenance

Imported place geometry is derived from OpenStreetMap and retains visible attribution. Elevation comes from the public AWS Terrarium tile set. The project keeps observed, imported, inferred, and generated material distinct so that an instrument does not quietly turn a source into a claim.

Software and project history: [github.com/hartswf0/terrarium](https://github.com/hartswf0/terrarium).
