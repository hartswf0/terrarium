# TERRARIUM — theory of the program

*A terrarium is a real ecology, enclosed, observed, and intervened in — where the
intervention is part of the system and the observer is inside the glass.*

This document is the Naurian theory: the thing the program text is a projection
of. It has three parts: what the two parents actually are, **how the current
implementation has failed**, and what Terrarium must therefore be.

---

## 1 · The two parents, honestly inventoried

### CREO (the ground)
One authoritative world: `place.groundAt` as the sole height truth, journaled
entities via `transact` (undo/redo, labels), authors, branches, certification,
GeoJSON export, an operator that answers *from* the world. Change is rare,
deliberate, accountable. Rendering is all-or-nothing (`renderer.build`
re-tessellates the district), which is correct for its own theory of time.

### THUNDER RIGS / hw005 (the inhabitant — full inventory, not the cartoon)
Reading the actual file, unset is not "a driving game with an AI bar." It is
**eight organs**, most of which Terrarium has never seen:

1. **THE DOOR — the HELLO, WORLD ritual.** You may not enter the shared world
   until you have *made yourself* (a rig, by parts or by language) and *made a
   world*. `ritualComplete` is the single unlock token; multiplayer, garage,
   games are all gated behind it. Identity is made, not given.
2. **THE FORGE — language → geometry as law.** `FORGE.compile`: sanitize →
   strategy extraction → sandboxed execution (SHADOWED globals) → **certificate**
   (mesh/tri/time budgets) → one structured repair pass → the GOLDEN library as
   the deterministic floor (nine certified rigs, nine worlds, drafts,
   mechanics — prompt-matched by keywords, honestly labeled when they stand in
   for the model). Nothing enters the world without a certificate.
3. **THE LAW — admission beyond cost.** WORLDCERT (bounds, spawn clearance,
   drivability, connectivity, contrast — each violation carrying a *repair
   verdict*: clamp/cull/offset/relocate/recolor/reprompt) and the **CITY
   kernel**: one authoritative store of spatial truth with real footprint
   polygons, y-intervals, provenance (`osm|forge|user|golden`), transactions,
   and `canPlace` verdicts (FREE / COLLISION / RIGHT_OF_WAY / SUPPORTED /
   AIRSPACE_CONFLICT). Plus PARCELS (buildable lots derived from the standing
   city), ROADNET (streets as a welded graph with routing and access), and
   LOTBUILD (architecture designed *for* an envelope, entrance on the
   frontage). Prompts propose; geometry decides.
4. **THE ATLAS — Unsettled Atlas 05, the doctrine layer.** The program's own
   name. Operational, not decorative: the **sediment bed** (every pass of your
   wheels deposits a visible rut), **normalization pressure** 0–100 (rises when
   you re-drive your ruts, falls when you break ground, build, destroy,
   generate, or testify), the **gradient of access** (real drag on physics near
   one threshold), four named **thresholds** (first crossings logged as
   discoveries), **testimony** ("note: …" plants a standing sign), and the core
   verb **UNSETTLE** — every structure swaps into a deterministic alternative
   arrangement with amber ghosts at the abandoned positions and provenance tags
   raised; RESETTLE restores the given, *remembered, not inevitable*. Even the
   instruments alter what they measure: every model call lowers the pressure.
5. **THE COMMONS — one BUS.** Every prompt surface (SAY, director, chips,
   cartridges, twin beats) emits utterances into one verb surface;
   `BUS.register` lets cartridges and modes extend the language without
   touching the parser. One line, one mode chip, one menu of verbs that
   already exist.
6. **THE THEATRE — films as first-class.** TWIN (operator-twin films screened
   on an in-world drive-in; transcription into prompted performances), ABC
   CINEOSIS (a 21-image blueprint compiled to beats), the LEDGER (one row per
   film entity, placement sovereign, budget precomputed), the LIBRARY
   (everything generated is kept, pictured, re-placeable), CINE (camera reels,
   the shot river, REC to a real file). Cast become bots; films are *played*.
7. **THE ARENA — games as a registry.** FREE / GOLF / FLAG RUN (prep phase,
   overdrive, wreck scars, AI commander) / STRIKER / THE PARIS MODEL
   (physics-simulated courtroom bluffing) / HIDE & SNEAK (procedural rhetoric:
   appearance can be copied, agency must be inferred) — plus the MECHANIC
   FORGE: language → a whole new game mode, sandbox-compiled, with a golden
   floor. Game packages load from files over a bridge contract.
8. **THE ROOM — multiplayer as accumulation.** Worlds travel as *generation
   code* (peers re-forge the identical world), forts *accumulate* by id, the
   real city travels as *coordinates*, QR invites carry the place, late
   joiners get a re-push, combat is target-authoritative. Plus GEO: the Normal
   City (live OSM at true scale, citypacks that reload with no network,
   edge-travel to adjacent districts), pre-worn official roads feeding the
   sediment bed.

That is the parent. Anything calling itself an integration answers to this
inventory.

---

## 2 · THE FAILURE AUDIT — how creo-unset-04 has failed

Stated plainly, against the inventory above. The current build (rig.js,
build.js, house.js, console.js, imagery.js, perf.js on top of clean CREO3) is
real and works — driving, collisions, journaled destruction, the aerial, the
massed house, the instrument panel. But as an integration it has failed in ten
specific ways:

- **F1 · We ported the cockpit, not the constitution.** The deepest layer of
  unset is the FORGE pipeline — language → sandboxed code → certificate →
  admission → golden floor. Terrarium's AGENT mode pipes text to CREO's
  `#sayInput` with synthetic key events. There is no compile, no certificate,
  no repair pass, no golden library. The mouth exists; the forge behind it
  does not.
- **F2 · There is no Door.** Unset gates entry on making yourself and your
  world (`ritualComplete`). Terrarium auto-mounts a default rig into a default
  place. The HELLO, WORLD text and ritual are absent; identity is given, not
  made. The threshold that makes entering *mean* something is missing.
- **F3 · The Unsettled Atlas is entirely absent — and it is the TRACE tier we
  already named.** No sediment bed, no normalization pressure, no thresholds,
  no testimony, no unsettle/resettle, no atlas dock in the menu. This is the
  worst failure because CREO is the *natural home* for every one of these:
  CREO's say-operator already IS testimony; CREO's **branches** already ARE
  the alternative arrangement (unsettle = checkout an alt branch; resettle =
  return — with real history, better than unset's in-place swap); CREO's
  authors already ARE provenance tags. We failed to notice that the doctrine
  layer gets *stronger* in CREO, and shipped none of it.
- **F4 · The menu is a list, not the program.** Unset's rail carries PLAY
  (games catalog, bots, rooms, say, cine), BUILD (AI, parts, world), SYSTEM
  (files, export, undo), plus the atlas dock and the WHERE picker. Terrarium's
  burger has ~15 items and none of: games, bots, films, rooms, atlas,
  where-in-the-city. The affordance surface is perhaps a fifth of the parent's.
- **F5 · No admission law — the exact problem unset solved, ignored.** Unset
  built CITY/canPlace/PARCELS/ROADNET/LOTBUILD precisely so that generated
  things respect standing things (verdicts, lots, envelopes, right-of-way).
  Terrarium places parts and houses with *zero* verdict: a house can be dropped
  inside a real building, on a road, in the spawn. CREO has its own
  certification and `world.near` — we wired neither. Prompts currently decide;
  geometry does not.
- **F6 · WEATHER has no citizens; TRACE has no existence.** The dynamic pass
  (our one real architectural win) carries exactly one actor: the player's
  rig. No bots, no remote players, no ball. And TRACE — the bridge tier of our
  own triad — has no implementation, while unset's sediment bed is a complete
  reference implementation of it.
- **F7 · "One chat bar" is only true typographically.** CREO's own say bar
  still sits at the bottom; our console is a puppet that forwards to it. Unset
  converged on ONE std-line backed by a BUS with registerable verbs. We have
  no BUS: no way for a game, a cartridge, or the atlas to add a verb.
- **F8 · No play.** No win conditions, no games registry, no MODES mechanic
  forge, no films. The place can be driven but not *played*, and nothing can
  be made playable by language.
- **F9 · No room.** Unset ships world-as-code broadcast, fort accumulation,
  geo sync, QR invites. Terrarium has nothing multiplayer — even though we
  identified CREO's journal/branches/authors as the *better* merge model. The
  asset was named and then never used.
- **F10 · Hurdle #1 still stands, and it taxes everything above.** Every deed
  still costs a full district re-tessellation (`renderer.build` ignores its
  `changed` set; no worker; `reindex` is O(n)). Until a removal is a buffer
  memcpy, every organ above (fire, forts, films, unsettle) pays ~seconds per
  act on a real district. This is why every port so far has fought the engine.

The pattern across all ten: **we integrated at the surface (UI, physics) and
not at the level of law (admission), doctrine (atlas), or society (bus, room,
games).** The parent's real invention is that language-acts become *certified,
accountable world-acts*; we shipped language-acts that bypass certification
entirely.

---

## 3 · THE TERRARIUM THEORY, revised to absorb the parent

The triad stands, now with unset's organs mapped onto it:

- **WEATHER** — 60 Hz, no history, no author, never touches the world model.
  The rig, bots, remote players, projectiles in flight, film cameras, TWIN
  performances-in-progress. Renderer: the dynamic pass. Cost: O(1)/actor.
- **DEED** — rare, journaled, authored, certified. Every FORGE-certified
  build (world, fort, house, part), every testimony, every unsettle/resettle,
  every film-asset generation. In CREO a deed is a **transaction with a label,
  an author, and a certificate** — `world.transact` is unset's
  `CITY.begin(author, prompt) … commit()` made native.
- **TRACE** — weather that becomes deed by accumulation. The sediment bed and
  normalization pressure ARE this tier: driving deposits ruts (weather-cheap,
  canvas overlay), and at thresholds the accumulation is *committed* as a
  deed (a worn path entity, journaled, with the driver as author). Official
  roads arrive pre-worn. Pressure is the meter of the whole triad.

And the four organs Terrarium must grow, in order:

1. **THE DOOR.** The HELLO, WORLD ritual before the place: make your rig
   (parts or forge), name where you are (CREO's real geocoded places — better
   than unset's WHERE picker because the place is *real* by default), then
   enter. `ritualComplete` gates rooms and games.
2. **THE FORGE.** Port `FORGE.compile` + the golden libraries wholesale (they
   are dependency-free by design), but point admission at **CREO's own
   certification**: a forged structure becomes a set of journaled entities via
   one transaction, verdict-gated by `world.near` footprint checks (CREO's
   `canPlace`). The goldens become CREO bodies/entities. WORLDCERT's repair
   verdicts merge with CREO's certification — one law, two parents' checks.
3. **THE ATLAS.** Unsettled Atlas 05, fully present: sediment bed as a canvas
   layer over CREO's terrain (TRACE made visible); normalization pressure in
   the dock; thresholds at the place's real edges; **testimony = CREO's say**,
   surfaced as the atlas verb it always was; **unsettle = a CREO branch**
   holding the alternative arrangement, resettle = returning to main — with
   ghosts drawn from the branch diff. The menu carries the atlas dock and the
   five claims.
4. **THE COMMONS.** One BUS (registerable verbs) behind the one line; the
   games registry (golf against the real terrain, flag run across a real
   district, sneak among CREO's certified bodies); MODES for language-made
   mechanics; the room, where **deeds merge through CREO's journal and
   branches** — the merge model unset never had — and worlds travel as code.

**Prerequisite for all of it: hurdle #1.** Per-entity buffer segments (or a
worker build) so a deed costs milliseconds. Every organ above is throttled by
this one function until it falls.

The one-sentence theory: *Terrarium is CREO's accountable ground inhabited by
Thunder Rigs' society — where every act of language is forged, certified, and
journaled as a deed; every motion is weather; every repetition sediments into
trace; and the standing arrangement can always be questioned, because the
alternative is a branch the world remembers.*
