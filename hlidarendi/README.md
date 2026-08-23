# HLIÐARENDI

    A BODY
    A DOG
    A DWELLING
    A PLACE

held together by one world.

HLIÐARENDI is the first complete inhabited situation in Terrarium: the
Everybody puppet (HERO), the Argos autonomous dog (DOG), the Ingold/Gunnar
trailer (STRUCTURE), and the Terrarium standing world (PLACE), made mutually
consequential. Terrarium is the host and runtime — the other systems are
extracted as contracts into it, not embedded beside it.

## The mission patch

ARGOS — *Who are you?*
SÁMR — *What do you intend?*
GOODYEAR — *Should I trust you?*
SILAS — *Can I act with you without becoming your puppet?*

Then HLIÐARENDI asks the fifth question:

*Can we inhabit the same world long enough for those distinctions to matter?*

## Play

**[HLIDARENDI.html](HLIDARENDI.html)** — one self-contained file (three.js
bundled in, no network needed), phone-first. Everybody wakes beside the Ingold
trailer with Argos nearby. MOVE/LOOK to travel; touch a limb control and it
grows while the others store; BALL takes and throws, FEED fills the bowl at
the galley, SAVE keeps the situation across reloads. Argos decides for
himself — a throw enters his world as evidence, not as a command.

BOOT 0 holds in this build: one clock, one camera system, one authoritative
world. Both actors' feet query the same PLACE (terrain, deck, steps,
`door.entry` threshold); the trailer's rendered walls, collision boxes and
wall capsules derive from one element list; the dog earns every meter through
paw traction and enters the home through the same door the hero uses.
Rebuild with `./build.sh` (see [src/README.md](src/README.md)).

## Reading order

The mission sits before the engineering specification. It is not decoration:
it defines the kind of artificial life this is trying to make, and it is the
criterion for deciding what not to simplify away.

1. **[MISSION.md](MISSION.md)** — the lineage and the mission. Read first.
2. **[SPEC.md](SPEC.md)** — the engineering specification, unchanged, after
   the mission.
3. **[INTEGRATION-MAP.md](INTEGRATION-MAP.md)** — verified seams between the
   host repo and the sources: where each contract already exists, which
   adapters resolve axis/unit/clock mismatches, and the BOOT 0 order.

Two laws govern everything below them:

    NEVER SOLVE THE SAME PHYSICAL QUESTION TWICE.
    CONTACT DRIVES MOTION.

## Sources (`sources/`)

| File | Family | Role |
|---|---|---|
| `everybody-explorer-whole-body-v16.html` | HERO | Human baseline: whole-body locomotion, control revolvers, `HERO_ACTOR`, `WORLD_BRIDGE`, cartridge snapshot. Its dog is a placeholder to be replaced. |
| `argos-half-dog.html` | DOG | Renderer-independent game contract: `createArgos()`, traction-gated locomotion, mind/host drive modes, `setTerrain`/`setWalkable`/`serialize`/`restore`. The architectural base for DOG.js. |
| `ingold-trailer.html` + `operative/` | STRUCTURE | The trailer as an operative structure graph — committed operations, journal, `door.entry`, datum, fixtures, services. Vendored from [`hartswf0/gunnars-depot.html`](https://github.com/hartswf0/gunnars-depot.html); live reference at [ingold-trailer.html](https://hartswf0.github.io/gunnars-depot.html/ingold-trailer.html). |
| *(the host repo itself)* | PLACE | `ground.js` height/normal authority and `conformance()`, `III_STORE` persistence, `thunder-rigs.cartridge/v1`, structure/collision conventions per `SUPABASE-STRUCTURE-BRANCH.md`. |

Still to attach (Argos donors named in SPEC §1B): **Argos v2.3** (latest
animal — anatomy/locomotion) and the **unified half-dog** (remaining world-
contract features: `setMoveTarget`, `setGazeTarget`, `getState`, quality
modes). Until v2.3 lands, SPEC §1B's DO-NOT-RESTORE list guards the anatomy.

## First proof

    Everybody and Argos leave the trailer through the same door,
    cross the same ground,
    retrieve the same ball,
    and return home.
