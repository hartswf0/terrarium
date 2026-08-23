# HLIÐARENDI — INTEGRATION MAP (first pass)

This is the map SPEC.md §15 asks for, seeded from an actual reading of the host
repository and the vendored sources in `hlidarendi/sources/`. It records where
each contract already exists, so the implementing agent verifies seams instead
of inventing parallel machinery.

Reading order: `MISSION.md` → `SPEC.md` → this file → the sources.

---

## 1. Verified seams

These are not aspirations. Each one was located in the code as vendored.

### Terrarium already enforces "one ground"

`ground.js` states its own invariant:

```
I1  one ground — heightAt is the only height, triangles() derives from it
```

- `heightAt(x, y)` is the single height authority (`ground.js:82`).
- Slope/normal is derived from `heightAt` by central differences (`ground.js:110`).
- `conformance(ground, readers)` (`ground.js:215`) samples thousands of points
  and reports whether other readers agree with the ground.

**HLIÐARENDI use:** PLACE.heightAt / PLACE.normalAt wrap this. `conformance()`
is the ready-made acceptance instrument for SPEC §2: register HERO's foot
sampler, DOG's paw sampler, the STRUCTURE datum, and the ball's collision
sampler as `readers` and require agreement. "Never solve the same physical
question twice" becomes a runnable test, not a slogan.

### V16 already speaks Terrarium's cartridge format

- V16 `EVERYBODY.integration.snapshot()` emits
  `{format:'thunder-rigs.cartridge/v1', entities:[…], relations:[{from:'dog.argos', rel:'bonded-to', to:'hero.everybody'}]}`
  (`sources/everybody-explorer-whole-body-v16.html:1660`).
- Terrarium's `III_STORE` refuses to load a world snapshot unless
  `geometry_json.format === 'thunder-rigs.cartridge/v1'`
  (`terrarium-iii-store-core.js:47`).

**HLIÐARENDI use:** the persistence seam (SPEC §7, §10) already exists.
Extend the cartridge's `entities` and `relations` arrays with
`hero.everybody`, `dog.argos`, `structure.ingold`, props, and the
`inhabits` / `stands-on` relations. Do not invent a new format.

### V16's world bridge already accepts an external PLACE

`WORLD_BRIDGE.setPlace(place)` / `surfaceAt(x,z)`
(`sources/everybody-explorer-whole-body-v16.html:252-267`) accepts a `place`
whose `surfaceAt` returns either a number or `{y, normal}` and falls back to
flat `GROUND_Y` only when no place is set. The flat floor is already framed as
the fallback SPEC §3 demands.

**Gap to close:** the bridge is currently consulted around the root, not per
effector. SPEC §3 requires each foot to query PLACE independently. The bridge
is the right seam; the per-foot queries are the work.

### The vendored Argos is the game contract — and most of the world contract

`sources/argos-half-dog.html` is the renderer-independent build
("THE GAME CONTRACT", line ~2045): `createArgos()` returns
rig/mind/loco with:

- `setTerrain(fn)` and `setWalkable(fn)` — host supplies ground and occupancy
- `serialize()` / `restore()` — schema `argos/1`, carries internal variables,
  learned prefs, winner, posture
- `driveMode: "mind" | "host"` — Blumberg-style directability: in host mode
  the engine's `setDesire()` stands, but contact still arbitrates it
- `world: {dog, human, ball, bowl, handPose, carrying, cue}` — perception inputs
- `events` — footfalls, `blocked`, behaviour transitions, bark, pant
- `tick(dt)` — one externally clocked step; no internal rAF, no DOM

The traction law is implemented, not promised: a diagonal pair of planted paws
drives, one paw is a scramble, none is flight, and a step is only granted if
the host's `walkable()` allows it (`blocked` event otherwise).

**HLIÐARENDI use:** DOG.js = extract the `AR` namespace (exports bundled at
line ~2372) from this file. Wire `setTerrain` ← PLACE.heightAt,
`setWalkable` ← PLACE.walkable, `world.human` ← HERO_ACTOR.transform each
tick, and call `tick(dt)` from the one host clock.

### The Ingold trailer is a genuine operative structure graph

`sources/operative/ingold.js` builds the trailer as committed operations
against a `World` (journal + checks + repairs), in stages:
`shell()` → `openings()` → `interior()` → `services()` → `repair()`.

- `door.entry` is an actual cut: wall `W`, from 72 to 108 in, with a header
  committed because "an interrupted stud carries nothing" (`ingold.js:70`).
- The datum is real: `w.datum.deckTop`, and every fixture is placed relative
  to the floor, not to a remembered number (`ingold.js:106-121`).
- Elements are queryable: `w.all({kind:…})`, `w.get(id)`, walls with
  `topPlateBot`, fixtures with `hostedBy`, systems with real bores and falls.

**HLIÐARENDI use:** STRUCTURE.js = an adapter that mounts the finished `World`
as a Terrarium entity of `kind: structure`, derives collision proxies from
`w.all(…)` on the same elements it renders, exposes `door.entry` as the
entrance affordance, and seats `datum.deckTop` on PLACE.heightAt. The
rendered wall, semantic wall, and collision wall are then literally the same
element — SPEC §1C's CRITICAL clause, satisfied by construction.

### Terrarium's structure/collision conventions already exist

`SUPABASE-STRUCTURE-BRANCH.md` (branch `claude/formicary-evolution-trust-55vevd`)
documents the standing contract:

- one `STRUCTURE` root group, `userData.kind = 'architecture'`, all authored
  meshes descend from it (§17)
- physics registered through `WG.solid` / `WG.surface`, budgeted by
  `III_COLLISION_BUDGET` with demotion above ~80 pending bodies (§18)
- §31's warning applies verbatim to HLIÐARENDI: collision demotion can
  silently close an opening. The Ingold adapter must certify after budget:
  **is `door.entry` still traversable?** If demotion closes the door, the
  level is broken (SPEC §9), whatever the body count says.

**HLIÐARENDI use:** register the trailer's derived proxies through the same
budgeted path rather than a second collision system, and add the
door-traversability check to the certificate.

---

## 2. Adapters, named once

Every historical system agreed on physics but not on conventions. Resolve each
mismatch in exactly one adapter, at the PLACE/actor boundary — never inside a
donor's solver.

| Mismatch | Details | Where resolved |
|---|---|---|
| Vertical axis | `ground.js` samples `heightAt(x, y)` on its own plane; V16 and Argos are three.js-style `(x, z) → y`; `operative/` places `[x, y, z-up]` in plan coordinates | PLACE adapter (one mapping, tested by `conformance()`) |
| Units | `operative/ingold.js` is in inches (`SHELL.width: 101`); Terrarium and the actors are metric-ish world units | STRUCTURE adapter, single scale factor at mount |
| Local origin | The trailer's `World` is in its own plan frame; Terrarium owns world coordinates | STRUCTURE adapter transform (footprint + datum on PLACE) |
| Clock | V16 and argos-half-dog each ran their own rAF as standalone pages | HLIDARENDI.step(dt) owns time; actors' `tick`/`step` are called, never self-scheduled |

---

## 3. Source systems — preserved / adapted / discarded

### EVERYBODY V16 (`sources/everybody-explorer-whole-body-v16.html`)

- **Preserved:** whole-body contact-driven locomotion, body-frame turning,
  self-collision lanes, control revolvers (input *and* telemetry),
  `currentBodyFrame`, data bus, `HERO_ACTOR` (`sense`/`step`/`serialize`),
  free camera, reset.
- **Adapted:** `WORLD_BRIDGE.setPlace` receives the real Terrarium PLACE;
  ground queries move from root-level to per-foot with normals; the page's
  control surface is extracted into CONTROL.js; its rAF authority yields to
  the host clock.
- **Discarded:** `ARGOS_ACTOR` placeholder and its embedded dog mind
  (line ~1648) — replaced by the real DOG; the standalone flat floor except
  as fallback/test surface.

### ARGOS (`sources/argos-half-dog.html`)

- **Preserved:** the whole game contract (see §1 above) — mind arbitration,
  releasers, internal variables, traction-gated locomotion, footfall/blocked
  events, `serialize`/`restore`, mind/host drive modes.
- **Adapted:** terrain/walkable/human/ball/bowl injected from PLACE and the
  entity registry; extracted from HTML into DOG.js; per-paw surface queries
  gain normals from PLACE.
- **Discarded:** its canvas renderer, chat panel, DOM mind-inspector, own rAF.
- **Still to attach (donors named by SPEC §1B):**
  - **Argos v2.3 (latest animal)** — anatomy/locomotion donor. Not yet in
    `sources/`. Until it lands, the DO-NOT-RESTORE list in SPEC §1B is the
    guard against regressing to older anatomy.
  - **Unified half-dog (world contract)** — only needed for the pieces this
    file lacks: `setMoveTarget()`, `setGazeTarget()`, `getState()`, and
    low/balanced/high quality modes. `setTerrain`/`setWalkable`/`serialize`/
    `restore` are already present here.

### INGOLD (`sources/ingold-trailer.html` + `sources/operative/`)

- **Preserved:** the operative `World`, the journal of committed operations
  with reasons, stages `shell`/`openings`/`interior`/`services`/`repair`,
  `door.entry` and window cuts with headers, `datum.deckTop`, fixtures with
  `hostedBy` and systems, conditions/repairs, `baked.js` load/replay for a
  finished world.
- **Adapted:** mounted through the STRUCTURE adapter (kind, footprint, datum,
  entrances, affordances, derived collision); inches → world units; plan
  frame → world frame; seated on PLACE.
- **Discarded:** the page's own `View` camera and standalone presentation;
  none of the semantics.

### TERRARIUM (host repo)

- **Preserved:** `ground.js` as the height/normal authority plus its
  `conformance` instrument; `III_STORE` durable persistence and the
  `thunder-rigs.cartridge/v1` format; the `STRUCTURE` root and collision
  budget conventions; one renderer, one scene, one clock per page.
- **Adapted:** PLACE.js wraps ground + occupancy + entity registry behind the
  SPEC §1D interface; the cartridge gains hero/dog/structure entities and
  first-class relations.
- **Discarded:** nothing. Terrarium is the host; the actors' private worlds
  are what disappear.

---

## 4. BOOT 0 — first moves in order

1. **PLACE.js** — wrap `ground.js` (`heightAt`, derived `normalAt`) plus a
   walkability/occupancy query; fix axis convention here, once. Register a
   `conformance()` harness immediately.
2. **DOG.js** — extract `createArgos` from `sources/argos-half-dog.html`;
   wire terrain/walkable to PLACE; tick from the host clock; render its rig
   through the host renderer.
3. **HERO.js** — mount V16's actor: `WORLD_BRIDGE.setPlace(PLACE)`, then move
   ground queries per-foot with normals; delete the placeholder dog.
4. **STRUCTURE.js** — run `ingold.js` stages (or `baked.js` replay) to a
   finished `World`; mount as kind:structure; derive collision from the same
   elements; certify `door.entry` traversable after collision budgeting.
5. **HLIDARENDI.js** — one `step(dt)` in the order of SPEC §5; one camera;
   one renderer.
6. Then, and only then: ball, bowl, fetch, scenario state, persistence
   (SPEC §9–10), using the cartridge seam from §1 above.

---

## 5. Open items

- Attach the two missing Argos donors (v2.3 anatomy; unified world-contract
  features) into `sources/` when available.
- The live GitHub Pages trailer
  (https://hartswf0.github.io/gunnars-depot.html/ingold-trailer.html) is the
  visual reference; `sources/operative/` vendored here (from
  `hartswf0/gunnars-depot.html` @ shallow clone, 2026-08-23) is the operative
  implementation of record for this branch.
- `SUPABASE-STRUCTURE-BRANCH.md` notes an `iii_artifacts` avatar CHECK-
  constraint conflict (its §5/P0). If HLIÐARENDI persists rigs through
  `avatar` artifacts before that is fixed, saves can be rejected by the
  database while the client believes they succeeded.
