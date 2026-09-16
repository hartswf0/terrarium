# GEONOSIS

> The world can be observed without every observation becoming the world.

Geonosis is Terrarium's perceptual membrane: the layer that receives heterogeneous external evidence, preserves its provenance and temporal state, derives contestable signals, relations and temporary conditions, and only crosses into Terrarium's canonical `Place` through an explicit authored admission.

## Theory skeleton

```text
SOURCE
  ↓
SOURCE POLICY
  ↓
OBSERVATION
  ↓
SIGNAL
  ↓
RELATION
  ↓
CONDITION
  ↓
DIFFERENCE
  ↓
INTERPRETANT
  ↓
STATEMENT           (next)

                   explicit admission only
GEONOSIS --------------------------------------→ TERRARIUM PLACE
                                                   ↓
                                                journal
                                                branches
                                                relations
```

Terrarium remains sovereign. `src/observe/` deliberately does not import `World` or `Place`, except `retain.js`, the one explicit membrane crossing. Modules that compare external evidence with Terrarium geometry receive a world as a read-only argument; they do not mutate it.

## The primitives

### Observation

What a source actually supplied. It keeps provider identity, provider record ID, geometry, observation/retrieval times, provenance, license, source method, resolution, freshness, epistemic state, ICOSA addresses supplied by an adapter, and the source-shaped payload.

An observation is evidence. It is not automatically a Terrarium entity.

### Signal

A proposition supported by observations or other signals:

```text
subject + predicate + value
```

Signals cite `derivedFrom[]`. Missing evidence is an error. A source policy may also forbid derivation.

### Relation

An evidence-backed graph edge:

```text
from + kind + to
```

A relation carries epistemic state, confidence, evidence, declared basis, time and optional ICOSA address. Endpoints are identifiers, not proof. A Geonosis subject may therefore relate to a Terrarium entity without copying that entity into a second world model.

This is where uncertainty stays visible. `candidate_measures` is not `measures`; `near` is not `affects`; `inside the same cell` is not `governs`.

### Condition

A temporary active state supported by evidence:

```text
creek → FLOW_RISING
road → ACTIVE
shade → SPARSE
```

Conditions have `began`, `lastSeen`, `expiresAt`, strength and support. Expiry removes a current condition without fabricating a historical Terrarium deed.

### Difference

`difference.js` begins with deterministic operators:

- CHANGE
- ABSENCE
- SURPRISE
- MISMATCH
- LATENCY
- CONTESTATION
- RHYTHM
- RUPTURE

The model does not detect these. The model may later interpret them.

### Interpretant

What a condition means **for one actor**. Interpretants carry actor, actor kind, sign, value, valence, strength, evidence, expiry, and a declared relational `basis[]`.

No relation means no interpretation. A gauge that happens to be geographically near a dog does not become something the dog can perceive. A civic system does not govern a stream merely because they share a cell.

Current cautious water rules deliberately stop at attention/salience:

```text
FLOW_RISING
  + perceivable relation
      → DOG   water_motion_salience

FLOW_RISING
  + usedBy relation
      → HUMAN water_change_attention

FLOW_RISING
  + governs relation
      → CIVIC hydrologic_change_attention
```

They do **not** infer danger, safety, attraction, fear, or behavior. Those require additional relations and actor state.

## Source policy

Access is not permission.

Every adapter declares two independent axes:

```text
acquisition = LIVE | BULK | OPTIONAL_CREDENTIAL
retention   = EPHEMERAL | SNAPSHOT | MIRROR | REFERENCE
```

`Geonosis.snapshot()` obeys the retention law:

- `MIRROR` keeps the complete observation.
- `SNAPSHOT` keeps normalized observation geometry/provenance but strips source-shaped raw properties.
- `EPHEMERAL` and `REFERENCE` keep only a citation stub.

This means serialization itself cannot silently turn a live-only source into a cached dataset.

`catalog.js` contains a deliberately conservative first keyless core. Exact product/service terms still belong in each adapter.

## ICOSA

ICOSA is the spatial address hierarchy, not entity identity.

Adapters may attach deepest known addresses such as:

```text
F08.031274
```

`Geonosis.byAddress('F08.03', { descendants: true })` finds `F08.031274` without physically duplicating the record into every ancestor. ICOSA ancestry is face + refinement path, not filesystem segmentation.

No H3/S2 ontology is introduced here. If a provider arrives in H3/S2, that is ingest geometry to translate, not another sovereign spatial system.

## Admission law

`retain.js` contains the explicit Geonosis → Terrarium gate.

An observation may become a Terrarium deed only when:

1. the source retention policy permits normalized persistence;
2. a caller explicitly supplies `localize(observation, world)`;
3. that localizer returns Terrarium-metre footprint/path geometry;
4. an author is attached;
5. the original observation is retained as evidence.

EPHEMERAL/REFERENCE sources are refused at this gate. They can later support authored testimony/reference workflows, but their source-derived observation payload is not smuggled into `Place`.

## First living organ — USGS Water

`src/observe/adapters/usgs-water.js` is the first real live adapter.

It uses the modern USGS Water OGC API:

```text
latest-continuous  → newest streamflow / gage-height measurements
continuous         → recent history
```

The keyless core asks for parameter `00060` (streamflow/discharge) and `00065` (gage height). The adapter preserves measurement time, site/time-series identity, value, unit, approval status, qualifier, geometry, source URL and public-domain provenance.

It explicitly distinguishes:

```text
CURRENT
PARTIAL_STALE
STALE
NO_GAUGE_COVERAGE
UNAVAILABLE
```

`NO_GAUGE_COVERAGE` never means `NO_WATER`.

Recent history can derive temporary `FLOW_RISING`, `FLOW_FALLING`, `STAGE_RISING`, and `STAGE_FALLING` conditions. These are site-relative change detectors, **not flood-severity classifications**.

## Gauge ↔ mapped watercourse candidates

Terrarium already imports OSM rivers, streams, canals, drains and water polygons into local-metre geometry. `src/observe/watercourse-relations.js` can therefore compare a gauge point with the standing hydrography.

It deliberately produces only:

```text
USGS gauge
  ↓
candidate_measures
  ↓
Terrarium OSM water entity
```

The edge preserves:

- source observation evidence;
- local distance;
- optional name agreement;
- confidence;
- target Terrarium entity ID/type/subtype/name;
- `INFERRED` epistemic state;
- `CANDIDATE` status;
- an explicit warning that proximity is not hydrologic causality.

Ambiguous geometry remains several ranked candidate edges. Nothing silently picks the nearest creek as truth.

`candidate_measures` is intentionally **not** a legal interpretant basis and cannot drive `runWater`.

## Network-linked measurements — USGS NLDI

`src/observe/adapters/usgs-nldi.js` and `src/observe/watercourse-network.js` establish the stronger relation that proximity alone could not earn.

NLDI is a separate public-domain Geonosis source. It indexes NWIS surface-water sites onto the NHDPlusV2 hydrologic network and exposes site `comid`, reachcode, linear measure and hydrolocation flowline geometry.

The gate is deliberately conjunctive:

```text
USGS measurement site
        ↓
NLDI nwissite record
        ↓
site COMID
        =
hydrolocation COMID
        ↓
NHDPlus flowline geometry
        ≈
Terrarium OSM water path
        ↓
measures
```

A `measures` relation is emitted only when all of these hold:

1. NLDI knows the NWIS site;
2. the NLDI site record and hydrolocation agree on COMID;
3. a local OSM watercourse candidate is close enough to the gauge;
4. the OSM path aligns with the NHD flowline over enough of its local extent;
5. no equally plausible mapped channel remains unresolved.

The result is `DERIVED`, not `CONFIRMED`. USGS/NLDI is authoritative about the network linkage, but Terrarium's target remains an OSM representation of that reach.

`measures` therefore means:

> this mapped watercourse segment is the network-aligned representation of the reach measured by this gauge.

It still does **not** mean:

- flood severity;
- hazard;
- safe/unsafe crossing;
- upstream causality beyond the network evidence present;
- predicted local depth;
- dog fear, attraction or avoidance;
- permission to alter `runWater` without another explicit model bridge.

Several sensor parameter series at one site do not become fake spatial ambiguity. Candidate edges are deduplicated by mapped target before the network decision. Conversely, two distinct mapped channels with equally strong NHD alignment remain `AMBIGUOUS` and no `measures` edge is created.

Failure is also compositional. If NLDI is unavailable, the USGS measurement remains current and its `candidate_measures` edge remains evidence. One source cannot erase another source's valid observation.

## Terrarium live-water bridge

`src/observe/live-water.js` mounts beside `app.js`; it does not enter `World`.

For a real Terrarium:

```text
Place bbox
  ↓
nearby USGS search window
  ↓
Geonosis observations/signals/conditions
  ↓
candidate gauge↔watercourse relations
  ↓
optional NLDI/NHD network gate
  ↓
measures relation when earned
  ↓
BUS: “water now”
```

The browser notices a changed world on a cheap clock and refreshes water on a patient 15-minute clock. Synthetic worlds refuse to invent a real sensor neighborhood. Gauge points can be transformed into Terrarium-local metres for spatial reasoning without becoming canonical entities.

The first visible interface is language, not a dashboard:

```text
water now
what is the water doing?
creek now
```

The answer names freshness, measured values and site-relative trends while preserving source absence/failure distinctions. It says whether gauge↔mapped-water relations are still candidates, ambiguous, network-mismatched, unavailable, not indexed, or network-linked through NLDI/NHDPlus.

## Weather, trace, deed

Geonosis clarifies Terrarium's existing time model:

```text
live observation / active condition      → WEATHER
repetition / learned rhythm              → TRACE
explicit retained observation/testimony  → DEED
slow standing imported state             → GROUND
```

Aircraft positions should not create journal transactions every few seconds. A learned flight corridor may become trace. A person explicitly retaining one encounter may create a deed.

## Change tests

### A source changes authentication

Only its adapter/source policy changes. Observation, signal, relation, condition, interpretant and Terrarium semantics remain stable.

### A source becomes non-cacheable

Change retention to `EPHEMERAL` or `REFERENCE`. Future snapshots automatically retain citation stubs instead of payloads.

### A source disappears

Existing permitted snapshots remain dated evidence. New acquisition reports unavailable state. Absence is not inferred unless coverage is sufficient.

### A new actor arrives

DOG, HUMAN, CAR or CIVIC interpretation consumes conditions/signals plus declared relations, not provider APIs. The actor never needs to know that stream stage came from USGS or a road from OSM.

### A gauge is near a creek

Geonosis may write `candidate_measures` with distance/confidence. It may not write `measures`, `affects`, `upstream_of`, flood depth, crossing danger or dog behavior from proximity alone.

### NLDI links the gauge to a reach

Geonosis may write `measures` only after COMID agreement plus NHD↔OSM geometry alignment and ambiguity checks. The stronger edge still does not become hazard, simulation output or actor behavior by itself.

### NLDI fails while USGS Water succeeds

The measurement remains current. Candidate geometry remains visible. Network linkage is marked unavailable and no stronger relation is fabricated.

## Tests

```sh
node tests/geonosis.mjs
node tests/usgs-water.mjs
node tests/live-water.mjs
node tests/interpretants.mjs
node tests/water-relations.mjs
node tests/nldi-water.mjs
node tests/live-water-network.mjs
```

GitHub Actions runs the same stack on Node 24.

The tests pin:

- seeing does not mutate Terrarium;
- derived claims require evidence;
- source policy may forbid derivation;
- conditions expire;
- absence requires sufficient coverage;
- contestation preserves incompatible claims;
- rhythm can become rupture;
- ICOSA ancestor queries do not require duplicated records;
- snapshots obey retention policy;
- admission into `Place` is explicit and policy-gated;
- USGS empty coverage is not water absence;
- stale, unavailable and current water remain distinct;
- nonnumeric sensor states do not become invented numbers;
- live water works without a World mutation surface;
- actor interpretation requires an explicit relational basis;
- one condition can yield distinct actor-specific signs;
- interpretants expire with the conditions that license them;
- gauge proximity produces candidate relations only;
- distant gauges produce no local relation;
- ambiguous hydrography stays ambiguous;
- candidate gauge relations cannot become actor perceptibility;
- NLDI site and hydrolocation COMIDs must agree;
- NHD flowline geometry must align with the mapped OSM path;
- network disagreement cannot be silently upgraded;
- duplicate parameter series do not create fake spatial ambiguity;
- equally plausible distinct mapped channels remain ambiguous;
- NLDI failure cannot erase or downgrade a valid USGS measurement;
- the live bridge can produce one network-linked `measures` edge without mutating PLACE.

## Next organs

Do not add a dashboard first.

The next implementation order is:

1. add an open weather/rain source so hydrology can acquire upstream causes;
2. relate rainfall cells/forecasts to watershed or catchment geometry rather than merely to nearby gauges;
3. add actor state/wants so interpretants can become real affordances rather than generic salience;
4. add one moving actor source (GTFS-RT or adsb.lol);
5. build Statements of Importance from deterministic difference + relation + interpretant structures;
6. compile ICOSA cell manifests for offline/mobile use.

The test is not how many feeds Terrarium can display. The test is whether external evidence can alter what beings encounter without erasing where that evidence came from.
