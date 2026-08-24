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
trailer with Argos nearby — at the real Hlíðarendi: the ground is a baked
kilometre of Fljótshlíð, Iceland (public AWS terrarium elevation tiles, farm
datum 189 m, the drop to the Markarfljót plain included), and the dwelling is
the FULL operative construction — 314 members from ingold.js's committed
operations: chassis, joists, studs, headers, rafters, sheathing, the door leaf
standing open, glazing, fixtures, water runs. The sky answers to words
(`/dawn /day /dusk /night /fog /rain`), and so does the world: **`/build
<words>`** forges a structure on the land ahead through the same
`build(w, WG, THREE)` admission Terrarium III's AI builder speaks — offline it
uses stand-ins (cairn, gate, tower, sheepfold, beacon); `/ai <key>` connects
the agent line to Claude so words design the structure. What you build is
REAL: its solids enter the world's occupancy (bodies, dog and ball all answer
to it), and it rides the save and the cartridge snapshot. **`/striker`**
turns the yard into a pitch — run into the ball to kick, and Argos plays for
himself, carrying to his own goal. **`/goto <lat> <lon>`** and **`/place <name>`** call on
the world landscape — live elevation for anywhere on earth, and THE LIVING
GROUND dresses it: satellite imagery (© Esri) painted onto the real heights,
roads and rivers inked from OpenStreetMap, buildings standing as real
occupancy the body, dog and ball all answer to. The page dresses itself at
boot too, where the network allows; the procedural moss is the honest
fallback where it is closed. `/forget` clears the save. The chrome is Thunder Rigs' own shell law, whole:
the header carries CAM · ▲ LAND · ● REC (records the canvas, the take saves
to your files) · ▶ PLAY · ≡. The yellow ▲ opens THE LAND — places load like
cartridges from a deed list (Gunnar's Hlíðarendi, Njáll's Bergþórshvoll,
Þórsmörk, Eyjafjallajökull, TERRA HERE by name, DRESS THE LAND, SAVE LAND).
The one line up top is SPEAK — words reach the dog and the terrarium — and
under the lightning 🗲 it becomes AGENT, summoning structures through the
forge; the dog's and the world's words fold beneath it as the log (▾). ≡
opens the full sectioned toolbars (PLAY: striker, say · BUILD: AI key, agent
+ quick stand-ins, world dress/goto/place · SYSTEM: the six skies, file,
sys, body), each group expanding from its toggle, III-style; ✕ or tapping
the world returns to a clean PLAY MODE, and ≡ lights amber when a line
closes. The citizens announce themselves — **Everybody**, **Argos**, and
**Ingold ▼** float as names projected over the actors and the dwelling
through the one camera. The travel stick lives in the drive corner,
bottom-left; FEED/JUMP/FIRE/BOOST sit bottom-right. MOVE/LOOK to travel; touch a limb control and it grows while
the others store; FIRE takes/throws the ball, FEED fills the bowl at the
galley, FILE keeps the situation across reloads. Argos decides for
himself — a throw enters his world as evidence, not as a command.

**THE RIG** — Thunder Rigs' gift stands in the yard: a truck. Walk to it and
DRIVE (or E) — the stick becomes the wheel, and because the driver IS the
hero root, the camera, the labels, the striker and the dog's whole
perception follow the wheel with no further hooks. Back it to the home's
south tongue and HITCH: the WHOLE dwelling — rendered members, collision
boxes, the door, the plan datum, the galley bowl — rides one offset behind
the rig, skid-style; DROP sets it down and the land levels under the new
site. The hauled home rides the save. **THE BOND** — companionship is
accumulated history, never a meter: feeding, delivered fetches and time
spent near him deepen it; what it buys is not obedience but a standing pull
— the deeper the bond, the sharper his nose reads your scent, and when you
range far he chooses, more and more often, to come. A new land (`/goto`,
`/place`) arrives with his mind fresh — fatigue shed, spirits up, leaning
FOLLOW — so he explores it with you instead of going back inside.

**[hlidarendi.trig.json](hlidarendi.trig.json)** — the same trailer as a
`thunder-rigs.cartridge/v1` for the real standing world. Open
[unset-04-hartsoe-iii.html](https://hartswf0.github.io/terrarium/unset-04-hartsoe-iii.html),
enter the field, and **drag the .trig.json onto the page** — loading is
playing. The trailer arrives as a fort through the same admission pipeline an
AI build uses (`function build(w, WG, THREE)`, forged, certified, seated on
the real land at its anchor by `__groundY`, broadcast to peers), with III's
own ball and a home cup beside the door. The fort code is generated by
[tools/make-cartridge.mjs](tools/make-cartridge.mjs) from
[src/elements.js](src/elements.js) — the one element table both builds share,
so the cartridge trailer and the page trailer can never disagree. The
standing world (including a real imported place) stays the authority; only
the atmosphere tints toward the hillside.

BOOT 0 holds in this build: one clock, one camera system, one authoritative
world. Both actors' feet query the same PLACE (terrain, deck, steps,
`door.entry` threshold); the trailer's rendered walls, collision boxes and
wall capsules derive from one element list; the dog earns every meter through
paw traction and enters the home through the same door the hero uses.
Rebuild with `./build.sh` (see [src/README.md](src/README.md)).

**Upstream — the real Terrarium hosts HLIÐARENDI.** The deeper direction is
the reverse of the standalone page: `unset-04-hartsoe-iii.html` now carries a
SPECIES seam (`window.III_HOST` / `window.III_SPECIES`, four small guarded
touches), and `terrarium-iii-hlidarendi.js` — a sidecar like
`terrarium-iii-net.js` — registers **Argos and Everybody as III's first legged species**: the body is
possessable (B key — the DRIVE stick walks it, the car becomes the intent
generator, and camera/MULTI/ball/dog all converge on it), and Argos is
seated on the real ground, tracking by scent at car-scale distances, playing
the real III ball back to the player through his own FETCH. The cartridge
places him via `{kind:'actor', species:'argos'}`. The architecture and the
phased plan for the walking body (possession-based) are in
[UPSTREAM.md](UPSTREAM.md).

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
