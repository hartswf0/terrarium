# UPSTREAM — how HLIÐARENDI rides into the real Terrarium

The standalone `HLIDARENDI.html` proved the organism: a body, a dog, a
dwelling, a place, mutually consequential. But rebuilding Terrarium's organs
inside it — lookalike chrome, a re-implemented forge — was heading toward a
second Terrarium that would never have the real one's depth. The correction,
and the original spec's first line: **Terrarium is the host.** The real
`unset-04-hartsoe-iii.html` — its real AGENT/AI router, REC/CINE, MULTI,
GAMES, garage, cartridges, persistence — front *and* back, the exact ones.
This document is the port architecture.

## Why this is a real upstream problem, not a packaging problem

Reading III's actor code end to end shows one deep fact:

**Everything that moves in III is a car-physics chassis wearing a coded
body.** The player is `P` (pos/vel/yaw) driven by the car controller. Bots
are `deployBot({vcode})` — car physics under a forged body. CAST are "native
rig actors" whose forged bodies can be *possessed* (`__possess(id)`: "your
rig steps out, THEIR body becomes the one you drive — same physics, same
controls") or *botified* (`__castToBots`). Even the AI contract (`__RIG_SYS`)
asks for "a drivable car-scale rig, wheels grounded."

HLIÐARENDI's actors are categorically different: **legged**. A walking human
whose feet ask the ground per-step; a quadruped whose root motion is gated by
paw traction. No amount of vcode fits them into the vehicle ontology — they
need their own kind. So the upstream move is not "jam HLIÐARENDI in" and not
"rebuild III around it": it is to give III **one new first-class concept — the
SPECIES — and make HLIÐARENDI's actors its first two.**

## What was patched upstream (small, guarded, stock-safe)

Four touches in `unset-04-hartsoe-iii.html`, all inert without a sidecar:

1. **`window.III_HOST`** — one deliberate host surface (`THREE, scene,
   camera, renderer, groundY, P, B, notify`) instead of a forty-first ad-hoc
   `__global`. Exposes exactly what a species needs, no more.
2. **`window.III_SPECIES`** — the registry: `register({id, tick, spawn,
   serialize, restore})`. Species tick on the one clock — one line inside
   `frame()` before `renderer.render`.
3. **Cartridge dispatch** — `entities[]` of `kind:'actor'` route to
   `III_SPECIES.spawn(e)` by `species` id; unknown species fall into the
   existing `skipped` path, so cartridges stay loadable on stock pages.
4. **One sidecar tag** — `terrarium-iii-hlidarendi.js` loaded beside
   `terrarium-iii-net.js`, following III's own extension pattern: sidecar
   files talking to the page through window surfaces.

## Phase 0 — ARGOS, shipped and verified

`terrarium-iii-hlidarendi.js` = the ARGOS game contract (verbatim from the
vendored source, plus the ground-relative traction patch) + the species
integration. Verified headless against the patched page:

- registers as species `argos`, joins after the ritual (or after the player
  stands still on skip paths) — never before the field is real;
- **seats on III's real ground** (`__groundY`), CPU-skinned body/head/jaw
  rendered by III's renderer, all mind/gait/traction his own;
- **scale seam**: his mind lives in dog-metres; one boundary maps
  1 dog-metre = K III units (K=4) — group scale, ground queries, and targets
  all convert at that single seam;
- **scent**: beyond eyesight, targets are presented at a squashed distance in
  their true direction, so the signal strengthens as the real gap closes —
  he tracks the player and ball across car-scale distances under his own
  traction, never teleported;
- **he plays the real ball**: the III ball `B` is car-scale, so FETCH plays
  it *back toward the player* — reach it, nudge it home, chase it again.
  Verified: a pass rolled his way → FETCH won → he circled onto it → the
  ball left at velocity 12 toward `P`. Soccer with the dog, in the real III,
  through his own behaviour system;
- the HLIÐARENDI cartridge now carries `{kind:'actor', species:'argos'}`, so
  dragging `hlidarendi.trig.json` onto the patched page places him.

Regenerate the sidecar with `node hlidarendi/tools/make-iii-sidecar.mjs`.

## Phase 1 — EVERYBODY as a possessable species — SHIPPED

The travel core of V16 lives in the sidecar, freed from its instrument deck:
feet as world anchors, steps earned on per-foot `__groundY`, the root
following stance support (CONTACT DRIVES MOTION), anatomical lanes, analytic
two-bone leg IK, counter-rotating trunk and arm swing — a capsule body with
the V16 face, at its own scale seam (1 body-metre = 2 III units).

**Embodiment is a pin-and-diff on `P`, and it is what "towards each other"
means mechanically.** The car controller keeps running on the real stick but
becomes the intent generator: each frame the body reads the delta the car
tried to move from the pin, walks as far as its feet earn, and pins `P` back
onto itself. Because camera follow, MULTI, the ball, and the dog's
perception all read `P`, the entire host converges on the walking body with
zero further hooks — verified headless: embody (B key or the BODY chip),
walk under W, and Argos closes from 27 units to heel at 5.7 on his own.
ESC-equivalent: B again (or the chip, now reading RIG) releases back to the
rig, which reappears where the body stands — III's own possession semantics,
generalized across the species boundary.

## Phase 2 — the puppet instruments as a HUD deck

When embodied, the V16 revolvers (input *and* telemetry) mount as an optional
HUD module over III — the one affordance III's chrome lacks. Until then the
DRIVE stick walks the body in travel mode only.

## Phase 3 — species over the wire

III MULTI is host-authoritative WebRTC with a fast unordered state channel.
Species state (`serialize()`/`restore()` already in the contract) rides it:
the host runs the dog's mind, peers interpolate the posed skeleton — same
split III already uses for rigs. The trailer already travels as a fort.

## The living ground — one place stack, not two (the parasitism answer)

The standalone page walking on naked elevation while III wore the real place
was the tell: two ground stacks, one starved. `src/living-ground.js` is the
correction — ONE module owning the mercator math, the imagery dressing
(the same Esri World Imagery source III reads), Overpass ways inked onto the
terrain texture, and OSM buildings as occupancy, registered onto the baked
heights through `TERRAIN.geo`. The page consumes it at boot and on
`/goto`/`/place`; the registration was proven with labeled stub tiles
(north up, west left, seams continuous). The remaining unification — III's
importer and this module converging on one shared place library — is the
standing direction: the sidecar pattern is the vehicle, but the goal is
shared organs, not a rider on a host.

## Division of labour from here

- **`unset-04-hartsoe-iii.html`** — the game: shell, chrome, AI, games,
  multiplayer, persistence. Grows only the species seam.
- **`terrarium-iii-hlidarendi.js`** — HLIÐARENDI's citizens: the dog now,
  the body next, the bond between them after.
- **`hlidarendi/HLIDARENDI.html`** — stays the *organism lab*: the place the
  contracts are developed at 1:1 scale (real Hlíðarendi ground, the full
  operative trailer, the feed/fetch/save proofs) before organs graduate
  upstream. Not the product; the nursery.
