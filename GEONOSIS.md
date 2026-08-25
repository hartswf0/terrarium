# GEONOSIS

> The world can be observed without every observation becoming the world.

Geonosis is Terrarium's perceptual membrane: the layer that receives heterogeneous external evidence, preserves its provenance and temporal state, derives contestable signals and temporary conditions, and only crosses into Terrarium's canonical `Place` through an explicit authored admission.

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
CONDITION
  ↓
DIFFERENCE
  ↓
INTERPRETANT        (next)
  ↓
STATEMENT           (next)

                   explicit admission only
GEONOSIS --------------------------------------→ TERRARIUM PLACE
                                                   ↓
                                                journal
                                                branches
                                                relations
```

Terrarium remains sovereign. `src/observe/` deliberately does not import `World` or `Place`, except `retain.js`, the one explicit membrane crossing.

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

### Condition

A temporary active state supported by evidence:

```text
creek → HIGH_FLOW
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

`catalog.js` contains a deliberately conservative first keyless core. Exact product/service terms still belong in each future adapter.

## ICOSA

ICOSA is the spatial address hierarchy, not entity identity.

Adapters may attach deepest known addresses such as:

```text
F08.031274
```

`Geonosis.byAddress('F08', { descendants: true })` finds descendants without physically duplicating every record into every ancestor cell. Higher-cell manifests/aggregates can be generated later.

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

Only its adapter/source policy changes. Observation, signal, condition and Terrarium semantics remain stable.

### A source becomes non-cacheable

Change retention to `EPHEMERAL` or `REFERENCE`. Future snapshots automatically retain citation stubs instead of payloads.

### A source disappears

Existing permitted snapshots remain dated evidence. New acquisition reports unavailable state. Absence is not inferred unless coverage is sufficient.

### A new actor arrives

DOG, HUMAN, CAR or CIVIC interpretation should consume conditions/signals, not provider APIs. The actor therefore never needs to know that heat came from NWS, stream stage from USGS, or a road from OSM.

## Tests

```sh
node tests/geonosis.mjs
```

The foundation tests pin:

- seeing does not mutate Terrarium;
- derived claims require evidence;
- source policy may forbid derivation;
- conditions expire;
- absence requires sufficient coverage;
- contestation preserves incompatible claims;
- rhythm can become rupture;
- ICOSA ancestor queries do not require duplicated records;
- snapshots obey retention policy;
- admission into `Place` is explicit and policy-gated.

## Next organs

Do not add a dashboard first.

The next implementation order is:

1. source adapter contract (`fetch → normalize → observations`);
2. one live environmental adapter (USGS Water or NWS);
3. one moving actor adapter (adsb.lol or GTFS-RT);
4. condition reducers (HIGH_FLOW, HEAT, ROAD_ACTIVE, etc.);
5. actor-specific INTERPRETANT;
6. Statements of Importance;
7. compiled ICOSA cell manifests for offline/mobile use.

The test is not how many feeds Terrarium can display. The test is whether external evidence can alter what beings encounter without erasing where that evidence came from.
