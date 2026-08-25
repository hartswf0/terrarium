import assert from 'node:assert/strict';
import { Geonosis } from '../src/observe/geonosis.js';
import { makeProjection } from '../src/core/geom.js';
import { candidateWatercourseRelations } from '../src/observe/watercourse-relations.js';
import { interpretCondition } from '../src/observe/interpret.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

const T0 = Date.parse('2026-08-25T14:00:00Z');

function geonosisAt(lon = -84.39, lat = 33.75, name = 'PEACHTREE CREEK AT ATLANTA') {
  const g = new Geonosis();
  g.registerSource({ id: 'usgs-water', acquisition: 'LIVE', retention: 'MIRROR', mayDerive: true, mayRedistribute: true });
  const o = g.observe({
    id: 'water-o1', provider: 'usgs-water', providerRecordId: 'series1',
    observedAt: T0, retrievedAt: T0, epistemic: 'MEASURED',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    rawProperties: {
      subject: 'usgs-water:site:TEST',
      monitoringLocationName: name,
    },
  });
  return { g, o };
}

function world(entities) {
  return {
    place: {
      id: 'atlanta-test', name: 'Atlanta Test', projection: makeProjection(33.75, -84.39),
    },
    entities() { return entities; },
  };
}

const creek = {
  id: 'osm_w101', type: 'water', subtype: 'stream', name: 'Peachtree Creek', network: 'drainage',
  path: [[-100, 0], [100, 0]], width: 3,
};

console.log('\nWATERCOURSE RELATIONS — geometry proposes, never certifies');

test('a gauge on mapped hydrography becomes a high-confidence candidate, not a confirmed relation', () => {
  const { g, o } = geonosisAt();
  const made = candidateWatercourseRelations(g, world([creek]), o);
  assert.equal(made.length, 1);
  assert.equal(made[0].kind, 'candidate_measures');
  assert.equal(made[0].epistemic, 'INFERRED');
  assert.ok(made[0].confidence >= 0.95);
  assert.equal(made[0].props.status, 'CANDIDATE');
  assert.equal(made[0].props.terrariumEntityId, 'osm_w101');
  assert.match(made[0].props.warning, /not hydrologic causality/i);
  assert.deepEqual(made[0].derivedFrom, ['water-o1']);
});

test('a distant gauge creates no local watercourse relation', () => {
  const { g, o } = geonosisAt(-84.30, 33.75);
  const made = candidateWatercourseRelations(g, world([creek]), o, { maxDistanceM: 250 });
  assert.equal(made.length, 0);
  assert.equal(g.relations.size, 0);
});

test('ambiguity remains visible as multiple ranked candidates', () => {
  const { g, o } = geonosisAt();
  const other = {
    id: 'osm_w202', type: 'water', subtype: 'stream', name: 'Side Channel', network: 'drainage',
    path: [[-100, 18], [100, 18]], width: 2,
  };
  const made = candidateWatercourseRelations(g, world([other, creek]), o, { limit: 3 });
  assert.equal(made.length, 2);
  assert.equal(made[0].props.terrariumEntityId, 'osm_w101');
  assert.equal(made[1].props.terrariumEntityId, 'osm_w202');
  assert.ok(made[0].confidence > made[1].confidence);
  assert.equal(made.every((r) => r.kind === 'candidate_measures'), true);
});

test('relation graph round-trips without importing the Terrarium entity', () => {
  const { g, o } = geonosisAt();
  candidateWatercourseRelations(g, world([creek]), o);
  const loaded = Geonosis.load(g.snapshot());
  assert.equal(loaded.relations.size, 1);
  const r = [...loaded.relations.values()][0];
  assert.equal(r.to, 'terrarium:atlanta-test:osm_w101');
  assert.equal(loaded.observations.size, 1);
});

test('candidate relation is not a legal actor-perception basis', () => {
  const { g, o } = geonosisAt();
  const r = candidateWatercourseRelations(g, world([creek]), o)[0];
  g.signal({
    id: 's1', subject: 'usgs-water:site:TEST', predicate: 'streamflow', value: 132,
    validFrom: T0, epistemic: 'MEASURED', derivedFrom: [o.id],
  });
  g.condition({
    id: 'c1', subject: 'usgs-water:site:TEST', state: 'FLOW_RISING', began: T0,
    lastSeen: T0, expiresAt: T0 + 60 * 60 * 1000, strength: 0.5,
    supportedBy: ['s1'], epistemic: 'DERIVED',
  });
  const x = interpretCondition(g, 'c1', {
    actor: 'argos', actorKind: 'DOG', basis: [{ kind: r.kind, relationId: r.id }], now: T0,
  });
  assert.equal(x, null, 'candidate_measures must not become perceptibility');
  assert.equal(g.interpretants.size, 0);
});

test('relations themselves require evidence and a declared basis', () => {
  const { g } = geonosisAt();
  assert.throws(() => g.relate({
    id: 'bad1', from: 'a', kind: 'near', to: 'b', epistemic: 'INFERRED',
    derivedFrom: ['missing'], basis: [{ kind: 'geometry' }],
  }), /missing evidence/);
  assert.throws(() => g.relate({
    id: 'bad2', from: 'a', kind: 'near', to: 'b', epistemic: 'INFERRED',
    derivedFrom: ['water-o1'], basis: [],
  }), /requires a declared basis/);
});

if (!process.exitCode) console.log(`\n${passed} watercourse relation tests passed.`);
