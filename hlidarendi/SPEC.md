HLIÐARENDI — FIRST INHABITED TERRARIUM

Read MISSION.md first. It sits before this specification as the mission.

You are taking over an existing family of working prototypes and integrating them
into ONE runtime.

Do not redesign them from scratch.
Do not build another standalone demo.
Do not flatten working systems into decorative assets.
Do not create duplicate ground, collision, scene, time, or world authorities.

The target is HLIÐARENDI:

    HERO + DOG + STRUCTURE + PLACE

    HERO       = Everybody puppet
    DOG        = Argos autonomous dog
    STRUCTURE  = Ingold / Gunnar trailer
    PLACE      = Terrarium / Thunder Rigs standing world

HLIÐARENDI is the first complete inhabited situation in Terrarium:
a body, a dog, a dwelling, and a place that all agree about the same world.

======================================================================
0. HOST REPOSITORY
======================================================================

BUILD ON TOP OF:

https://github.com/hartswf0/terrarium

Study this architecture note before changing anything:

https://github.com/hartswf0/terrarium/blob/claude/formicary-evolution-trust-55vevd/SUPABASE-STRUCTURE-BRANCH.md

Create a NEW integration branch for HLIÐARENDI.
Do not destroy or rewrite existing experimental branches.

Terrarium is the host.

Terrarium owns:
- simulation clock
- world coordinates
- ground / terrain
- occupancy
- world collision
- structures
- props
- persistence
- rendering orchestration
- entity relationships

The actors do NOT own separate worlds.

======================================================================
1. SOURCE FILES — READ ALL BEFORE CODING
======================================================================

I am providing four source families.

A. HERO — EVERYBODY

Primary source:
    everybody-explorer-whole-body-v16.html

This is the current human baseline.

PRESERVE:
- whole-body contact-driven locomotion
- body-frame turning
- arm/body collision protection
- anatomical left/right leg lanes
- automatic whole-body response during MOVE and LOOK
- direct arm / leg / head puppet control
- MOVE + LOOK travel controls
- control "revolvers":
    active control becomes large
    inactive controls shrink but remain live
    automatic solver movement remains visible in the small controls
- free camera mode
- reset
- data bus
- currentBodyFrame
- HERO_ACTOR
- WORLD_BRIDGE concept

V16 already exposes:

    HERO_ACTOR
    ARGOS_ACTOR      <-- placeholder only; replace dog implementation
    EVERYBODY.integration
    setPlace()
    surfaceAt()
    snapshot()

Do not regress the controls.

A critical interaction rule is:

    using MOVE / LOOK:
        MOVE / LOOK enlarge
        limb controls shrink but remain visible and show automatic solver output

    using ARM / LEG / HEAD:
        selected puppet control enlarges
        travel controls store down

Nothing permanently disappears.

The controls are both INPUT and TELEMETRY.

When automatic walking swings an arm or places a foot,
the corresponding little controller should visibly show what the solver is doing.

B. DOG — ARGOS

There are THREE Argos ancestors.

Use them as donors, not competing finished applications.

ARGOS CORE =

    #3 GAME CONTRACT
    +
    #2 WORLD CONTRACT
    +
    #1 LATEST ANIMAL

1. LATEST ANIMAL / EMBODIMENT:
    [ATTACH the current living-animal Argos v2.3 file]

Take from it:
- current dog anatomy
- corrected paws
- corrected foreleg / hindleg behavior
- corrected lying/down posture
- jaw / mouth / modest teeth / tongue behavior
- actual paw contact
- contact-earned root movement
- whole-body gait
- footfall events
- expression through head / ears / tail / posture
- sound event separation
- stable character controls

DO NOT restore:
- inverted paws
- bird-like hind legs
- giant black tongue
- giant vampire teeth
- Hitler-mustache-like muzzle marking
- body color pulsing
- head spinning on startup
- locomotion where body is dragged while legs cycle

Hard law:

    NO TRACTION -> NO ACCELERATION / STEERING

A dog only earns locomotion through meaningful paw support.

2. WORLD CONTRACT:
    [ATTACH ARGOS unified half-dog]

Take from it:
- setTerrainSampler()
- setWalkable()
- setMoveTarget()
- setGazeTarget()
- world-object injection
- getState()
- serialize()
- restore()
- event subscription
- low / balanced / high quality modes

Its key principle is correct:

    the animal owns its motor system;
    the host supplies goals, terrain and walkability.

3. GAME CONTRACT:
    [ATTACH renderer-independent ARGOS half-dog / createArgos version]

THIS IS THE ARCHITECTURAL BASE FOR DOG.js.

Preserve its principle:

    desired intent in
        ->
    mind / arbitration
        ->
    motor
        ->
    gait / paw IK
        ->
    contact
        ->
    posed skeleton + events out

No renderer.
No DOM.
No separate game world.

It already has createArgos() and host/mind drive modes.

The final DOG.js should be an engine citizen, not an iframe or embedded Argos app.

C. STRUCTURE — INGOLD / GUNNAR TRAILER

Visual reference:

https://hartswf0.github.io/gunnars-depot.html/ingold-trailer.html

Primary operative implementation:
    gunnars-depot / operative / ingold.js
    and whatever modules it requires.

DO NOT turn the trailer into a dumb GLB and discard its semantics.

The trailer is an operative structure graph.

Preserve where possible:
- elements
- members
- openings
- door.entry
- fixtures
- joints
- support / bearing relations
- systems
- datum
- history
- construction trace
- serializable structure state

Create a STRUCTURE adapter that exposes the trailer to Terrarium as:

    kind: structure

    body:
        footprint
        datum
        height
        entrances

    operative:
        original Ingold structure data

    collision:
        DERIVED from the same structure elements

    affordances:
        enter
        exit
        reach
        sit
        sleep
        cook
        wash
        etc. where actually supported

CRITICAL:

    rendered wall
    semantic wall
    collision wall

must refer to the SAME element.

Do not create a second hand-authored "game trailer" around the actual trailer.

D. PLACE — TERRARIUM

Terrarium is reality.

There must be ONE answer to:

    What is here?
    How high is the surface?
    What occupies this point?
    Can this actor move here?
    What did this ray hit?

Provide a PLACE interface approximately like:

    surfaceAt(x,z)
        -> {
             point,
             normal,
             material,
             entity
           }

    heightAt(x,z)
    normalAt(x,z)

    raycast(...)
    sweepCapsule(...)
    overlap(...)

    walkable(actor,x,z)
    query(...)
    entity(id)

Adapt this to Terrarium's actual existing APIs rather than inventing unnecessary
parallel machinery.

======================================================================
2. THE CENTRAL INVARIANT
======================================================================

NEVER SOLVE THE SAME PHYSICAL QUESTION TWICE.

Authority table:

    world surface               -> PLACE
    terrain normal              -> PLACE
    world occupancy             -> PLACE

    trailer identity            -> STRUCTURE / Ingold
    trailer openings            -> STRUCTURE / Ingold
    trailer collision           -> derived from STRUCTURE

    Everybody world transform   -> HERO
    Everybody articulation      -> Everybody solver
    Everybody contacts          -> HERO against PLACE

    Argos world transform       -> DOG
    Argos articulation          -> Argos solver
    Argos paw contacts          -> DOG against PLACE

    ball position               -> PROP entity
    bowl position               -> PROP entity

Three.js meshes are views of world state.
They are not additional authorities.

======================================================================
3. GROUND / CONTACT LAW
======================================================================

Remove remaining assumptions that the real world is:

    y = 0

Flat y=0 may remain ONLY as a standalone fallback/test surface.

Everybody feet must query PLACE independently.

Argos paws must query PLACE independently.

The trailer must seat itself on PLACE.

The ball must collide with PLACE.

Ground querying must include NORMAL, not just height.

For Everybody:

    left foot  -> local surface
    right foot -> local surface

Use the two supports to infer a support plane and allow:
- slope adaptation
- stairs
- trailer floor
- uneven terrain

Do not use a global FOOT_GROUND_Y for behavioral decisions such as:
- sitting
- jumping
- grounded state

Measure each effector relative to its local surface.

For Argos:

    each paw
        ->
    local surface
        ->
    IK target
        ->
    planted/contact
        ->
    traction
        ->
    permitted root movement

No paws down means no magical translation.

======================================================================
4. BODY / WORLD COLLISION
======================================================================

Everybody already has substantial SELF collision.

Preserve:
- arms not passing through torso
- legs not crossing through one another
- automatic left/right anatomical lanes
- body-frame constraints rotate with the body

Add WORLD collision.

We need meaningful collision for:

    hand <-> counter
    hand <-> wall
    foot <-> stair
    foot <-> floor
    torso <-> wall
    head <-> ceiling

    Argos body <-> wall/cabinet
    Argos paws <-> surfaces
    Argos head <-> opening

    ball <-> terrain
    ball <-> trailer

Prefer collision proxies generated from authoritative semantic geometry.

Do not perform expensive full-mesh collision when a simple derived capsule /
box / convex proxy provides the same gameplay fact.

Performance matters, especially on mobile / low-resource devices.

======================================================================
5. ONE SIMULATION CLOCK
======================================================================

Remove actor-owned requestAnimationFrame simulation authority.

Terrarium / HLIÐARENDI owns time.

Target conceptual loop:

    HLIDARENDI.step(dt)

        PLACE.update(dt)

        HERO.sense(PLACE)
        DOG.sense(PLACE)

        HERO determine intent
        DOG arbitrate behavior

        HERO.step(dt, PLACE)
        DOG.step(dt, PLACE)

        PROPS.step(dt, PLACE)

        shared collisions / interactions

        emit semantic events

        render

Use fixed or bounded simulation steps where appropriate.

Rendering frequency may differ from expensive IK / AI frequency.

Do NOT run an LLM in the inner animation loop.

======================================================================
6. DOG BEHAVIOR
======================================================================

Start SMALL.

Argos should be capable of:

    stand
    walk
    trot
    turn
    sit
    lie
    rise
    look
    follow
    investigate
    sniff
    bark
    eat
    fetch
    carry
    return
    rest
    alert

Perception should at least include:

    self
    HERO
    home / trailer
    ball
    bowl
    visible nearby entities
    pointed target
    relevant sounds
    internal variables

Preserve the Blumberg/Silas-inspired distinction:

    perception
        ->
    releasing mechanisms / opportunities
        ->
    competing behaviors
        ->
    motor arbitration
        ->
    motor skills

A human request biases behavior.
It does not need to collapse Argos into a puppet.

Directability and autonomy must coexist.

======================================================================
7. RELATIONSHIPS ARE FIRST-CLASS
======================================================================

HLIÐARENDI is not just entities.

Represent relationships such as:

    dog.argos
        bonded-to
    hero.everybody

    hero.everybody
        inhabits
    structure.ingold

    dog.argos
        inhabits
    structure.ingold

    structure.ingold
        stands-on
    place.main

Use the existing Terrarium cartridge/persistence architecture if possible.

Avoid prematurely creating a new incompatible cartridge format unless necessary.

======================================================================
8. CONTROL.js
======================================================================

Extract the successful V16 control surface rather than redesigning it.

Mobile-first.

Two side control revolvers / decks.

TRAVEL MODE:
    MOVE large
    LOOK large
    arm + leg controls small but alive

PUPPET MODE:
    selected arm/leg control large
    unused controls collapse
    nothing important disappears

HEAD remains directly controllable.

AUTO motion should visibly move the small controller indicators.

A player should be able to learn what the automatic motor system is doing
by watching the controllers.

Keep:

    CAM
    RST

Camera modes:

    FOLLOW HERO
    FOLLOW ARGOS   (can be added once basic integration works)
    FREE
    INSPECT

Do not bury the world in UI.
No dashboard.
No chart junk.
No permanent giant header.

======================================================================
9. FIRST GAME / ACCEPTANCE TEST
======================================================================

Do NOT begin by implementing many scenarios.

The first scenario is TRAILER SHIFT.

BOOT:

    Everybody wakes inside / beside Ingold trailer.
    Argos is nearby.

TASK:

    Everybody walks to food can.
    Picks it up.
    Uses can opener.
    Pours food into bowl.

    Argos perceives food.
    Walks to bowl using real paw contact.
    Eats.

    Everybody picks up ball.
    Walks through actual door.entry.
    Throws ball outside.

    Ball travels and lands on actual Terrarium surface.

    Argos sees / hears ball.
    FETCH behavior wins through the dog architecture.
    Argos exits through the same actual door.
    Runs across Terrarium.
    Reaches ball.
    Picks it up.
    Returns toward Everybody.

    Everybody crouches/reaches.
    Receives ball.

    Both return home.

This is the systems test.

No fake teleport success.

If Everybody has no valid foot support:
    he cannot walk.

If Argos has no paw support:
    he cannot drive his body.

If the door is not physically traversable:
    the level is broken.

If collision and visible geometry disagree:
    the level is broken.

======================================================================
10. SAVE / RELOAD TEST
======================================================================

After the scenario works:

SAVE.

Refresh/reload.

Restore:

    PLACE
    trailer
    Everybody
    Argos
    props
    dog internal state / learning where practical
    relationships

The success criterion is not:
    "the meshes came back."

It is:
    "the inhabited situation came back."

======================================================================
11. PERFORMANCE
======================================================================

This must remain viable on low-resource devices.

Principles:

- one renderer
- one world
- no duplicated hidden scenes
- cheap collision proxies
- fixed-step or throttled behavior updates
- expensive body solve may run slower than rendering on mobile
- behavior arbitration can run below rendering frequency
- event-driven perception where possible
- no LLM in inner loop
- adapt render quality separately from simulation correctness

Never sacrifice contact correctness to gain visual frame rate.

If necessary:
    60 fps render
    ~30–40 Hz expensive body solve
    ~10–15 Hz higher-level dog behavior

while keeping deterministic interpolation / contact state coherent.

======================================================================
12. VISUAL STYLE — AFTER EMBODIMENT
======================================================================

Do not start here.

Once the world works, support an optional render profile inspired by the
architectural-visualization / EACHOTHER / Niu-Lai material quality:

    visibly mapped material
    coarse flock / carpet / plaster feeling
    strong simple material contrast
    simple lighting
    state color as LEGIBLE evidence
    rain / atmosphere as separate environmental systems

Do not return to meaningless body-color pulsing.

If internal state is visualized, it must correspond to actual state.

Example debug render mode:

    happiness   -> warmth
    fatigue     -> desaturation
    aggression  -> contrast
    etc.

NORMAL gameplay should still let Argos look like Argos.

======================================================================
13. REPO TARGET
======================================================================

Aim toward approximately:

    hlidarendi/
        HLIDARENDI.js
        PLACE.js
        STRUCTURE.js
        HERO.js
        DOG.js
        CONTROL.js
        CAMERA.js
        COLLISION.js
        PROPS.js
        SCENARIO.js
        STYLE.js

Do not force this exact directory structure if Terrarium already has a cleaner
module organization.

Prefer fitting HLIÐARENDI into Terrarium over creating a foreign architecture
inside the repo.

======================================================================
14. FIRST MILESTONE ONLY
======================================================================

DO THIS BEFORE TRAILER SHIFT GAMEPLAY:

HLIÐARENDI BOOT 0

1. Terrarium renders.
2. Ingold exists as an actual structure in Terrarium.
3. Everybody exists as a HERO actor.
4. REAL Argos exists as a DOG actor.
5. There is no placeholder V16 dog.
6. Everybody's feet use Terrarium surfaces.
7. Argos's paws use Terrarium surfaces.
8. Both can move over uneven Terrarium ground.
9. Both can approach and pass through the actual Ingold door.
10. Collision comes from the same structure/world being rendered.
11. There is one camera system.
12. There is one simulation clock.
13. There is one authoritative world.

Only after BOOT 0 passes should you add:
    ball
    fetch
    food
    scenario state
    persistence

======================================================================
15. WORKING METHOD
======================================================================

FIRST:

Inspect the Terrarium repository and all supplied source files.

Identify existing APIs that already solve:
- world surface queries
- cartridges
- structures / body contract
- persistence
- rendering
- entity management
- collision

DO NOT implement replacements before verifying what exists.

Then write a short integration map:

    EXISTING TERRARIUM API
    -> HLIÐARENDI use

    SOURCE SYSTEM
    -> what is preserved
    -> what is adapted
    -> what is discarded

Then implement BOOT 0.

Continuously test in the actual rendered environment.

The proof is not that the code compiles.
The proof is that:

    BODY
    DOG
    STRUCTURE
    PLACE

visibly and physically inhabit one world.

======================================================================
16. HARD INVALID STATES
======================================================================

Treat these as bugs, not polish:

- foot through ground
- paw through ground
- dog floating
- dog root moving without traction
- human walking by dragging a root while feet fake a cycle
- arms through torso
- legs crossing/interpenetrating
- head spinning
- head/body decoupling during look
- automatic turn putting arms through body
- invisible or permanently lost controls
- visual trailer / collision trailer disagreement
- duplicate floors
- duplicate world clocks
- duplicate actor worlds
- fake door collision
- teleport fetch
- breaking low-resource operation

Do not progress to visual styling while these remain.

======================================================================
DEFINITION OF HLIÐARENDI
======================================================================

HLIÐARENDI is not an asset bundle.

It is:

    a body
    a dog
    a dwelling
    a place

held together by one world.

The central engineering principle is:

    NEVER SOLVE THE SAME PHYSICAL QUESTION TWICE.

The central embodied principle is:

    CONTACT DRIVES MOTION.

The first proof is:

    Everybody and Argos leave the trailer through the same door,
    cross the same ground,
    retrieve the same ball,
    and return home.

Build that.
