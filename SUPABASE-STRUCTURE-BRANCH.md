# TERRARIUM III — SUPABASE + STRUCTURE BRANCH OPERATIONS

**Branch:** `claude/formicary-evolution-trust-55vevd`  
**Primary live page:** `unset-04-hartsoe-iii.html`  
**Document snapshot:** 2026-08-22  
**Structure stack:** V4.1 structure draft  
**Persistence stack:** `iii-store-0.4-provisional`  
**Identity stack:** `iii-identity-0.2-ambient`  
**Garage stack:** `iii-garage-0.1-provisional`  
**Network stack:** provisional host-authoritative Supabase Realtime → WebRTC  
**Playtest stack:** `iii-playtest-0.1`

This document describes the **actual live Supabase schema and the actual Pages-serving branch**, with special attention to what is and is not proven about generated structures. It is intentionally more conservative than the UI. A feature appearing in the interface does not count as proven until its runtime and persistence path have been exercised end to end.

---

## 1. System in one diagram

```text
BROWSER
│
├─ PLAYER IDENTITY
│  └─ anonymous Supabase Auth
│     └─ iii_profiles
│
├─ DURABLE GAME MEMORY
│  └─ III_STORE
│     ├─ IndexedDB retry queue
│     └─ iii_artifacts
│        ├─ build
│        ├─ world_snapshot
│        └─ avatar  ← CURRENT DB CONSTRAINT BUG, see P0 below
│
├─ GARAGE
│  └─ reads own iii_artifacts
│     ├─ WORLDS
│     ├─ BUILDS
│     └─ RIGS
│
├─ MULTIPLAYER
│  ├─ Supabase Realtime = introduction/signalling desk only
│  └─ WebRTC = live game traffic
│     ├─ ordered reliable channel
│     └─ unordered/no-retransmit state channel
│
├─ PLAYTEST TELEMETRY
│  ├─ iii_playtest_sessions
│  └─ iii_playtest_events
│
└─ STRUCTURE AUTHORING V4
   ├─ iii_builds
   ├─ iii_reference_images
   ├─ iii_iterations
   ├─ iii_feedback
   ├─ iii_trace_events
   └─ private Storage
      ├─ iii-reference-images
      └─ iii-build-renders
```

The intended architectural split is important:

```text
PLAY PLANE
movement · state · controls · committed gameplay events
        ↓
      WebRTC

AUTHORING PLANE
image generation · reader · planner · code generation · critic · repair
Supabase persistence · playtest telemetry
        ↓
may be slow or retry without stopping play
```

A structure generation pass must never become a reason that another player cannot steer, move, or receive state.

---

# PART I — SUPABASE

## 2. Project and credentials

The browser configuration is read through `III_NET.config()` and shared by persistence/identity/structure sidecars.

The Pages branch contains a browser-public Supabase URL and **publishable** key. This is intentional. Never put a `service_role`, `sb_secret_...`, database password, or other privileged key in browser code.

Anonymous authentication is the normal identity model. Each browser receives a real `auth.users` UUID, and RLS policies use `auth.uid()` to isolate user-owned records.

### Important distinction

The multiplayer network client uses Supabase Realtime without persisting an auth session for signalling. The persistence, identity, playtest, and structure clients create authenticated anonymous sessions when database access is needed.

---

## 3. Live database inventory

The live project currently contains **nine** TERRARIUM tables:

1. `iii_profiles`
2. `iii_artifacts`
3. `iii_builds`
4. `iii_reference_images`
5. `iii_iterations`
6. `iii_feedback`
7. `iii_trace_events`
8. `iii_playtest_sessions`
9. `iii_playtest_events`

There are also two private Storage buckets:

- `iii-reference-images`
- `iii-build-renders`

### Critical repository drift

At the time of this snapshot, the branch contains only one SQL migration under `supabase/migrations/`:

```text
20260822_iii_multiplayer_playtest_telemetry.sql
```

The rest of the live schema exists in Supabase but is **not represented by migrations in this branch**. Therefore a fresh clone cannot recreate the current database from source control. This is a reproducibility and disaster-recovery problem and should be treated as a release blocker before calling the stack production-ready.

---

## 4. `iii_profiles` — persistent player identity

One row per anonymous Supabase user.

| Column | Purpose |
|---|---|
| `user_id uuid PK` | `auth.users` identity |
| `display_name text` | current readable name |
| `generated_name text` | last system-generated two-part name |
| `name_origin text` | `generated` or `custom` |
| `dialect text` | naming vocabulary family |
| `energy text` | legacy-compatible INNER/SPIRIT term |
| `body text` | legacy-compatible OUTER/FORM term |
| `seed_json jsonb` | full SPIRIT × FORM seed |
| `created_at` | creation time |
| `updated_at` | last update |

Current seed shape is conceptually:

```json
{
  "grammar": "spirit×form",
  "dialect": "mountain",
  "spirit": "Flint",
  "form": "Cabin",
  "energy": "Flint",
  "body": "Cabin"
}
```

RLS allows an authenticated anonymous user to select, insert, and update only their own profile.

Two profile triggers matter:

- profile INSERT → backfill identity into the user's artifacts
- profile UPDATE → backfill identity into the user's artifacts

The UI intentionally does **not** maintain a permanent identity panel. Identity is ambient in HELLO/chat/network surfaces.

---

## 5. `iii_artifacts` — durable authored game memory

This is the general persistence ledger used by `III_STORE` and the Garage.

| Column | Purpose |
|---|---|
| `id uuid PK` | client-generated artifact id |
| `created_at` | client/server timestamp |
| `user_id uuid` | owning anonymous user |
| `room_code text` | multiplayer room if present |
| `session_id text` | local III_STORE browser session |
| `artifact_type text` | persistence type |
| `prompt text` | originating prompt |
| `geometry_json jsonb` | code, cartridge, rig, or geometry payload |
| `metadata_json jsonb` | certificate/source/reason metadata |
| `client_version text` | store version |
| `parent_id uuid` | artifact lineage |
| `actor_name text` | readable identity stamped by trigger |
| `identity_seed jsonb` | SPIRIT × FORM identity snapshot |

`III_STORE` currently recognizes:

```text
prompt
geometry
build
world_snapshot
avatar
```

The normal commit sequence is:

```text
accepted WG draft
  → recordBuild()
  → captureSession('commit', build.id)
      → world_snapshot
      → avatar if a vehicle/rig is present
  → asynchronous flush
```

### Durability behavior

`III_STORE` is the most robust persistence path in the branch:

```text
recordArtifact()
  → memory
  → IndexedDB queue
  → anonymous Supabase Auth
  → INSERT iii_artifacts
  → retry with backoff on failure
```

Persistence is intentionally **not** on the live world's critical path. A failed insert should not stop play or destroy the local world.

Payload guards:

- prompts are truncated to 20,000 chars
- JSON payloads are serialized defensively
- very large geometry is omitted rather than crashing the client
- retry queue survives ordinary transient network failure through IndexedDB

### P0: duplicate artifact-type CHECK constraints

The live database currently has **two** simultaneous type constraints:

```text
iii_artifacts_artifact_type_check
  prompt | geometry | build | world_snapshot

iii_artifacts_type_check
  prompt | geometry | build | world_snapshot | avatar
```

Because both constraints are enforced, `avatar` must satisfy the older constraint too and can therefore be rejected. The JavaScript thinks avatar persistence is legal, but the database can disagree.

This must be fixed by removing the obsolete constraint and keeping one canonical constraint.

---

## 6. Garage / Loadout persistence behavior

`terrarium-iii-garage.js` reads `iii_artifacts` through `III_STORE.listOwn()`.

Current categories:

```text
WORLDS → world_snapshot
BUILDS → build
RIGS   → avatar
```

Current actions:

- world → OPEN WORLD
- rig → EQUIP
- build → USE PROMPT
- any → INSPECT JSON
- SAVE CURRENT → capture complete cartridge + current rig

Known limitation: a saved `build` is not yet a first-class reopenable structure object. The Garage can reuse its prompt or inspect its JSON, but there is not yet a dedicated **OPEN STRUCTURE / PLACE STRUCTURE** action that reconstructs the exact accepted WG building independently of a world snapshot.

---

# PART II — STRUCTURE AUTHORING DATABASE

## 7. `iii_builds` — one architecture transaction

This table is the root record for the reference-first structure pipeline.

Important columns:

| Column | Meaning |
|---|---|
| `id uuid PK` | build transaction |
| `user_id` | owner |
| `session_id text` | III_STORE browser session, not playtest session |
| `prompt text` | user request |
| `mode text` | currently structure/legacy house terminology |
| `status text` | pipeline state |
| `title text` | short title |
| `approved_reference_id` | accepted visual target |
| `accepted_iteration_id` | selected observed structure pass |
| `architectural_spec_json` | Reader output |
| `geometry_plan_json` | Planner output |
| `prompt_architecture_version` | prompt/compiler contract version |
| timestamps | lifecycle |

The database enforces:

```text
status = ready_to_commit or committed
REQUIRES accepted_iteration_id != null
```

There is also a trigger that validates the accepted iteration relationship.

This is the right invariant: generated source is not allowed to become a committed structure merely because the model produced code. A committed structure must point to an observed/selected iteration.

---

## 8. `iii_reference_images` — approved architectural target

Each reference belongs to a build and has a positive `pass_index`.

Stored data includes:

- build id
- reference pass number
- prompt snapshot
- optional note snapshot
- private Storage path
- model
- width / height
- status (`draft`, approved/rejected lifecycle)

`(build_id, pass_index)` is unique.

The current V4 path uses GPT Image for the reference image, asks the user to approve or revise it, and does not proceed to code before a reference is accepted.

---

## 9. `iii_iterations` — actual generated/observed structure passes

Each row is one code/render/critic pass.

Stored data includes:

- `build_id`
- positive `pass_index`
- generated `code_text`
- runtime/render `metrics_json`
- `defects_json`
- critic summary and numeric score
- private contact-sheet path
- architectural spec snapshot
- geometry plan snapshot
- status (`observed`, `accepted`, etc.)

`(build_id, pass_index)` is unique.

This is the most valuable table for later model/prompt research because it binds **the source program to its visible consequence and critic judgment**.

---

## 10. `iii_feedback` — explicit human correction

This records a human note against a build, reference image, or iteration.

Typical kinds used by V4 include:

```text
reference-note
reference-revision
reader-note
reader-correction
planner-note
planner-correction
source-note
certificate-note
observation-note
critic-note
```

This should be considered authored research data, not disposable UI text.

---

## 11. `iii_trace_events` — pipeline chronology

This is the chronological ledger of the structure compiler:

```text
reference generation
reference approval/rejection
reader
assumptions
plan
source audit
certificate
observation
critic
repair
selection
commit/fault
```

Columns can point to both a reference image and an iteration. This gives the system a real provenance chain instead of a single final output.

### Durability caveat

Unlike `III_STORE`, V4 structure tracing currently writes directly to Supabase through small `insert/update/upsert` helpers. Errors are logged and commonly degrade to `null`; there is **no IndexedDB retry journal for the architecture trace**.

Consequences:

- a successful local build can have an incomplete Supabase trace
- a temporary connection failure can lose feedback/trace rows
- the authoritative artifact store can be more complete than the research trace

For research-grade capture, structure tables need the same durable outbox semantics as `III_STORE`.

---

# PART III — STORAGE

## 12. Private image buckets

### `iii-reference-images`

Stores approved/rejected reference image passes.

### `iii-build-renders`

Stores observed rendered structure/contact-sheet images.

Both buckets are currently:

- private
- 10 MB file limit
- image MIME types: PNG, JPEG, WEBP

Object paths begin with the authenticated user's UUID:

```text
<user-id>/<build-id>/v4-reference-001.png
<user-id>/<build-id>/v4-pass-001.jpg
```

Storage RLS permits authenticated users to select/write/update/delete only objects in their own UUID-prefixed folder for these buckets.

---

# PART IV — MULTIPLAYER + PLAYTEST DATA

## 13. Supabase is not carrying the game loop

`terrarium-iii-net.js` deliberately treats Supabase Realtime as an introduction/signalling desk.

After WebRTC negotiation:

- gameplay traffic moves browser-to-browser
- host is authoritative
- guests connect to host
- host relays guest messages to other guests
- room intentionally ends when host truly leaves

Current limits/configuration include:

```text
MAX_PEERS       8
CHUNK_SIZE      12,000 chars
MAX_BUFFER      2 MB
signal heartbeat 15 s
host-missing grace 8 s
peer retry      1.4 s
TURN            Cloudflare Worker endpoint
STUN fallback   stun.cloudflare.com:3478
```

Two data channels are created:

```text
terrarium-reliable
  ordered
  reliable
  discrete game events / commits / room control

terrarium-state
  unordered
  maxRetransmits: 0
  high-rate state traffic
```

Messages whose `type === 'state'` use the fast channel when they fit in one chunk. Larger messages fall back to the reliable path.

This is the correct basic architecture for a small family playtest. The structure compiler should not be moved into Supabase Realtime.

---

## 14. `iii_playtest_sessions`

One host-owned test session.

| Column | Meaning |
|---|---|
| `id uuid` | shared playtest id |
| `host_user_id` | host anonymous auth id |
| `room_code` | TERRARIUM room |
| `title` | test title |
| `app_version` | stack/version snapshot |
| `started_at` / `ended_at` | session boundaries |
| `metadata_json` | browser/network context |

Host RLS:

- host can insert own session
- host can select own session
- host can update own session

---

## 15. `iii_playtest_events`

Each browser writes its own event rows under the shared playtest session.

Fields include:

- session id
- anonymous user id
- WebRTC peer id
- readable actor name
- event type
- server timestamp
- client timestamp
- sequence number
- JSON payload

The telemetry sidecar samples:

- application RTT median/p95
- jitter
- ping loss
- FPS
- long-frame percentage
- peer count
- ICE/channel states
- reliable queue pressure
- reconnect/retry counters when exposed
- browser offline/online/visibility
- uncaught errors/rejections
- explicit user-entered reaction/lag/bug/idea notes

It intentionally does **not** copy raw chat into Supabase.

### Read model

A guest can read their own events. The host can read all events attached to a session the host owns.

### Known linkage gap

`iii_playtest_sessions.id` is **not currently a foreign key or first-class field on**:

- `iii_builds`
- `iii_artifacts`
- `iii_iterations`

`iii_builds.session_id` and `iii_artifacts.session_id` currently refer to the local III_STORE browser session string, not the multiplayer playtest UUID.

Therefore the database does not yet have a clean relational answer to:

> Which exact generated structure was brother A reacting to when he wrote “this doorway is confusing” or experienced a 300 ms hitch?

A near-term schema improvement should add `playtest_session_id` and/or explicit `build_id` / `artifact_id` references to relevant telemetry events.

---

# PART V — CURRENT STRUCTURE COMPILER

## 16. What V4 is trying to guarantee

The V4 path is not “prompt → random WG object.” It is a staged transaction:

```text
REQUEST
  ↓
REFERENCE IMAGE
  ↓ user approves visual intention
ARCHITECTURAL READER
  ↓ user can correct assumptions
IMMUTABLE SPEC
  ↓
GEOMETRY PLANNER
  ↓ user can correct assumptions
IMMUTABLE PLAN
  ↓
WG SOURCE BUILDER
  ↓
STATIC SOURCE AUDIT
  ↓
WG CERTIFICATE / COMPILE
  ↓
ACTUAL OFFSCREEN RENDER
  ↓
TARGET-vs-ACTUAL COMPARISON
  ↓
CRITIC
  ↓
REPAIR
  ↺ up to 5 observed passes
  ↓
USER SELECTS OBSERVED PASS
  ↓
ready_to_commit
  ↓
COMMIT
```

The finalizer blocks a later legacy HELLO repair from silently modifying an already observed V4 source. If a post-V4 external fix is requested, the branch deliberately fails closed instead of committing unobserved geometry.

---

## 17. Structure runtime contract

Generated code must be one function:

```js
function build(w, WG, THREE){
  // helpers defined here
  return w;
}
```

The authored building must own one exact root:

```js
const STRUCTURE = new THREE.Group();
STRUCTURE.name = 'STRUCTURE';
STRUCTURE.userData.kind = 'architecture';
WG.root.add(STRUCTURE);
```

Every visible authored building mesh must descend from this root.

### Allowed building vocabulary

The structure compiler is based on the existing WG substrate:

```text
visual:
WG.box WG.cyl WG.cone WG.sphere WG.ico WG.torus WG.plane

materials:
WG.matte WG.paint WG.emiss WG.basic WG.flat WG.lit

transform:
WG.put

physics:
WG.solid WG.surface

metadata:
WG.thesis

THREE:
Group Vector3 BufferGeometry Float32BufferAttribute Mesh
+ deterministic local geometry/material operations
```

World verbs are explicitly forbidden in a structure build:

```text
WG.mound
WG.ridge
WG.crest
WG.bank
WG.deck
WG.quarterPipe
```

`WG.loft` is not a supported runtime verb. A required loft/sweep/revolve must be implemented locally using deterministic `THREE.BufferGeometry`.

A static building must not use `WG.tick`.

---

## 18. Geometry and physics budgets

Prompt/runtime intent:

```text
preferred visual meshes <= 480
hard visual ceiling      520

physics typical          3–20
complex target           <= 40
hard emergency ceiling   120
```

The runtime collision safety wrapper currently demotes structure collision proxies when `wg.pending` exceeds **80**, and non-structure collision proxies above 120.

This means there is currently a policy mismatch:

```text
prompt says complex structure should be <= 40 physics bodies
runtime safety net does not intervene until > 80
```

That is safe as an emergency ceiling but can mask mediocre generated physics. A structure with 60–80 bodies may compile even though it violates the architectural intent of coarse collision.

---

## 19. What the static source audit catches

Before render, V4 looks for:

- forbidden WORLD verbs
- unsupported WG verbs
- `WG.tick` in static architecture
- missing exact `STRUCTURE` root contract
- direct `w.add(...)`
- foreign `WG.root.add(...)`
- generic helpers that seem to register collision for every visual part
- high source-level `WG.solid` / `WG.surface` registration
- unjustified `WG.ramp`

Severe audit findings force a repair before observation.

### What the audit does **not** prove

A source passing the regex/static audit does not prove:

- openings are actually traversable
- floors are reachable
- stairs work
- roof geometry is coherent
- drainage works
- supports reach ground
- normals/winding are correct
- generated `BufferGeometry` is manifold
- collision proxies align with visible geometry
- the house reads like the approved reference
- the structure remains performant after commit into the full live world

Those still depend on compilation, rendering, critic judgment, and eventually gameplay tests.

---

# PART VI — KNOWN PROBLEMS ON THIS BRANCH

## 20. P0 — no current V4 end-to-end success is proven in Supabase

The live `iii_builds` table currently contains two build records, both with status `fault`. They are older `Donut house` attempts and have no accepted iteration. Their `prompt_architecture_version` is null, so they are **not evidence that the present V4.1 branch has completed its full pipeline**.

The historical trace includes this actual failure:

```text
Cannot read properties of undefined (reading 'set')
```

It occurred around rendering/certificate repair in the older reference-first pipeline.

Important interpretation:

- this is real historical failure evidence
- it is not enough to claim the current V4 code still fails at that exact line
- it does prove we should not call structure creation production-proven yet

Release condition: at least one simple, one medium, and one near-budget structure must produce:

```text
approved reference
spec
plan
accepted observed iteration
committed build
saved artifact/world snapshot
successful reload
multiplayer propagation
playtest telemetry
```

---

## 21. P0 — `avatar` persistence constraint conflict

See Section 5. The live DB has an obsolete type CHECK plus the newer avatar-aware CHECK. Until the old constraint is removed, RIG persistence can fail even while the JavaScript reports `avatar` as a supported type.

---

## 22. P0/P1 — database is not reproducible from this branch

Only the playtest migration is checked into `supabase/migrations`. The live architecture, identity, artifacts, triggers, constraints, RLS, and Storage setup are not represented as a complete migration history.

Before broader use:

- snapshot the complete live schema into migrations
- include trigger functions
- include RLS policies
- include Storage buckets/policies
- include indexes and constraints
- verify applying migrations to an empty project recreates the live contract

---

## 23. P1 — every non-empty AGENT draft is currently treated as architecture

In the current V4 runtime:

```js
function isHouse(t){ return clean(t).length > 0 }
```

This is intentionally fail-closed: it prevents strange structure requests such as dragons, worms, starships, or non-house architectural forms from escaping into the legacy world generator merely because they do not contain the word “house.”

The consequence is equally important: **every non-empty request routed through the draft domain becomes a STRUCTURE transaction**.

If the same draft domain is also expected to create a vehicle, prop, creature, machine, or other non-structure object, routing is currently too broad.

A robust next version needs explicit semantic intent at the domain boundary, not a keyword list and not “all text is a house.”

---

## 24. P1 — structure authoring is expensive and synchronous at the workflow level

Worst-case V4 can involve:

- image generation
- Reader LLM
- Planner LLM
- Builder LLM
- source repairs
- certificate repair
- up to five render/critic/repair passes
- Storage uploads
- Supabase trace writes
- repeated human approvals

That is excellent for a deliberate architectural gauntlet but is **not equivalent to an instant multiplayer build action**.

For real multiplayer use:

```text
player starts structure job
  ↓
live play continues
  ↓
job advances authoring stages asynchronously
  ↓
only accepted committed artifact is broadcast into shared world
```

Do not broadcast every critic/repair intermediate to every peer.

The observer has already been hardened so its four offscreen views yield across animation frames instead of performing all renders back-to-back in one JavaScript turn. This reduces hitches but does not make LLM/image authoring instantaneous.

---

## 25. P1 — architecture trace writes are fail-soft but not durable

The V4 database helpers intentionally return `null` after many Supabase failures so local building can continue. That is good for play, bad for research provenance.

Required hardening:

- one durable architecture outbox in IndexedDB
- idempotent event ids
- ordered retry
- explicit local `synced / pending / failed` status
- flush on reconnect / foreground / session end

The source program and the trace describing how it came to exist should have comparable durability.

---

## 26. P1 — playtest reaction data is not relationally bound to structure data

A brother can save a note such as:

```text
LAG · froze when the donut house appeared
REACTION · could not find the entrance
BUG · walked through the inner wall
```

But the event currently needs contextual JSON/manual inference to know which exact `iii_builds.id` or `iii_iterations.id` caused it.

Recommended change:

```text
iii_playtest_events
  + build_id uuid nullable
  + iteration_id uuid nullable
  + artifact_id uuid nullable
```

or a normalized event-target relation.

Also add `playtest_session_id` to structure/build artifact records when a playtest is active.

---

## 27. P1 — host visibility differs between telemetry and authored structure data

Playtest RLS intentionally allows the host to read all participant events in a host-owned session.

Structure tables (`iii_builds`, `iii_iterations`, `iii_feedback`, references, traces) are strictly user-owned under current RLS. If each brother creates structures under a different anonymous auth user, the host cannot query everybody's structure provenance with a normal browser client.

That may be the correct privacy default. If the research goal requires a shared corpus, add an explicit consent/session-sharing model rather than weakening all RLS or making tables public.

---

## 28. P1 — playtest table grants are broader than the intended API surface

The live Postgres grants for the new playtest tables currently expose more table-level privileges to `authenticated` than the migration text intends. RLS prevents operations for which no matching policy exists, so this is not equivalent to public delete access, but the privilege surface should still be tightened.

Preferred defense in depth:

```text
iii_playtest_sessions
  SELECT INSERT UPDATE only

iii_playtest_events
  SELECT INSERT only
```

RLS remains mandatory even after grant cleanup.

---

## 29. P1 — exact structure reopening is incomplete

A committed structure currently participates in several representations:

```text
V4 iii_iterations.code_text
III_STORE build artifact
world_snapshot cartridge
live WG/scene object
```

There is no single canonical `structure_artifact` record with a stable loader contract like:

```js
await III_STORE.loadStructure(id)
```

Until that exists, “the structure we accepted” can mean the V4 iteration, the later committed WG draft, or the copy embedded in a world snapshot.

The accepted observed iteration should become the canonical source artifact, with world placement recorded separately.

---

## 30. P1 — source audit is regex-based and can both miss and over-report

`codeAudit()` is deliberately lightweight. It scans source strings for patterns. This makes it fast and useful as a guard, but not a semantic parser.

Examples of possible blind spots:

- helper indirection hides a forbidden relationship
- generated geometry is legal syntax but geometrically wrong
- dynamic property access bypasses simple `WG.foo(` scanning
- comments/strings can occasionally resemble code patterns
- correct-looking root ownership can still attach descendants incorrectly later

Longer term, generated structures should be validated against runtime object ownership and a typed operation trace, not only source regex.

---

## 31. P1/P2 — collision budget can preserve visuals while silently changing physics

The collision-budget wrapper ranks registered pending collision bodies and demotes lower-priority entries when over budget. This is a useful safety net, but a structure can therefore render beautifully while its physics representation is silently simplified.

Every observed pass should expose:

```text
collision before
collision after
collision bodies demoted
doors/passages still open?
critical floor/stair/guard proxies retained?
```

A certificate should fail if demotion destroys an essential architectural relationship even though body count is safe.

---

## 32. P2 — image/reference inference is still a source of geometric ambiguity

The approved reference image is a visual contract, but one image cannot fully determine:

- hidden topology
- exact wall thickness
- unseen support
- interior circulation
- roof drainage on hidden faces
- dimensions
- structural system

V4 correctly exposes Reader/Planner assumptions to the user rather than silently calling them facts. The remaining issue is that an accepted image may be visually compelling but underdetermined for procedural realization.

For hard structures, future reference mode should support multiple approved views or a diagram/section without abandoning the single-building contract.

---

## 33. P2 — full-world performance is not the same as isolated observer performance

The observer photographs only the bounded `STRUCTURE`. That is the correct way to compare geometry to the target, but it excludes:

- the rest of the TERRARIUM world
- other players
- vehicles
- particles/effects
- multiplayer replication cost
- world collision pressure

A 480-mesh building can be acceptable in isolation and still create an unacceptable frame-time spike when committed into an already-heavy scene.

Every accepted structure needs a second **live-world performance certificate** after placement.

---

# PART VII — WHAT IS ALREADY STRONG

## 34. Existing pieces worth preserving

Do not throw away the current architecture while fixing the above.

Strong foundations already present:

- anonymous auth rather than privileged browser keys
- RLS on user-owned research/artifact tables
- private Storage buckets
- identity attached to durable artifacts
- IndexedDB-backed general artifact persistence
- host-authoritative WebRTC game topology
- Supabase used as signalling rather than game-state transport
- separate reliable and fast WebRTC channels
- explicit architecture reference approval
- Reader assumptions surfaced before planning
- Plan locked before source generation
- one bounded `STRUCTURE` root
- world verbs excluded from structure code
- visual/collision separation in prompt contract
- static source audit
- actual rendered observation
- target-vs-actual critic
- bounded repair passes
- accepted iteration required before commit
- finalizer blocks unobserved legacy repair
- offscreen observer yields between camera renders
- multiplayer telemetry writes asynchronously
- raw chat is not captured by the telemetry sidecar

The main task is now **hardening and joining the pieces**, not inventing another parallel system.

---

# PART VIII — RELEASE GATES

## 35. Minimum gate before brothers play structures together

Do not call the structure feature stable until all of these are green:

```text
DATABASE
[ ] remove obsolete iii_artifacts artifact-type constraint
[ ] commit complete Supabase schema/migrations to repo
[ ] verify clean-project migration replay
[ ] durable outbox for V4 traces/feedback
[ ] bind playtest session ↔ build ↔ iteration ↔ artifact

STRUCTURE
[ ] simple house reaches committed
[ ] medium unusual house reaches committed
[ ] near-budget showcase reaches committed
[ ] accepted structure reloads exactly
[ ] real openings remain traversable
[ ] stairs/floors/supports work in player physics
[ ] no direct world geometry leaks from STRUCTURE
[ ] no post-observation source mutation
[ ] live-world frame-time certificate passes

MULTIPLAYER
[ ] host sees committed structure
[ ] all guests receive same committed structure
[ ] guest joining late receives structure
[ ] reconnect returns to same committed world
[ ] structure authoring does not freeze movement
[ ] build propagation is discrete, not repair-pass spam
[ ] 30–60 minute soak test survives

RESEARCH CAPTURE
[ ] each participant has stable anonymous user id
[ ] explicit reaction notes reach Supabase
[ ] RTT/FPS/loss samples reach Supabase
[ ] response can be linked to exact build/iteration
[ ] failed writes remain queued and later flush
```

---

## 36. Recommended immediate order of work

1. **Fix the duplicate `iii_artifacts` type constraint.** This is a concrete live DB contradiction.
2. **Snapshot the entire current Supabase schema into repo migrations.** Stop accumulating invisible state.
3. **Run a current V4 golden structure end to end.** Do not infer readiness from standalone proofs or old Donut traces.
4. **Make the accepted iteration the canonical structure artifact.** Add exact reopen/place support.
5. **Join playtest session ids to builds/iterations/artifacts.** Make brother reactions analytically useful.
6. **Give architecture trace the same durable outbox semantics as `III_STORE`.**
7. **Run the North Carolina multiplayer matrix** while one player authors/commits a structure.
8. **Measure live-world hitch at commit**, not only network RTT and isolated rendering.
9. Only after these pass, consider raising visual complexity or player count.

---

# PART IX — USEFUL RUNTIME INSPECTION

## 37. Browser console

General persistence:

```js
III_STORE.stats()
await III_STORE.flush()
await III_STORE.listOwn({type:'build', limit:20})
await III_STORE.listOwn({type:'world_snapshot', limit:20})
```

Identity:

```js
III_IDENTITY.profile
III_IDENTITY.name
```

Network:

```js
III_NET.stats()
III_NET.config()
```

Playtest:

```js
III_PLAYTEST.stats()
III_PLAYTEST.open()
III_PLAYTEST.note('The structure commit hitched for a second', 'lag')
await III_PLAYTEST.flush()
```

Structure runtime:

```js
III_ARCH_RUNTIME_V4.VERSION
III_ARCH_RUNTIME_V4.state
III_ARCH_RUNTIME_V4.state.stats
III_COLLISION_BUDGET.stats
III_ARCH_V4_FINALIZER.stats
```

A useful playtest note should name the **consequence**, not the suspected implementation:

```text
GOOD:
"When the house appeared, steering froze for about a second."
"I could see the doorway but could not walk through it."
"The second floor looked reachable but the stairs blocked me."

LESS USEFUL:
"WebRTC is broken."
"The collider code is wrong."
```

The system should preserve observations first and diagnoses second.

---

# 38. Bottom line

The branch has the beginnings of a coherent research/game backend rather than a pile of unrelated saves:

```text
identity
→ authored artifact
→ visual reference
→ inferred spec
→ construction plan
→ generated program
→ observed result
→ criticism/repair
→ accepted artifact
→ world placement
→ multiplayer experience
→ human reaction + performance trace
```

But the current truth is stricter than the aspiration:

**Multiplayer networking is plausible for a small family game. General artifact persistence is reasonably defensive. Structure generation is architecturally much better specified than before, but the current V4 path is not yet end-to-end proven in the live database, its research trace is not yet durably queued, its data is not yet cleanly joined to playtest reactions, and the live schema contains at least one concrete persistence contradiction plus untracked schema drift.**

That is the correct baseline for the next hardening pass.
