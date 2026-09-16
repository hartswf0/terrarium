import assert from 'node:assert/strict';
import { Geonosis } from '../src/observe/geonosis.js';
import { absence, contestation, mismatch, rhythm, rupture, surprise } from '../src/observe/difference.js';
import { admitObservation } from '../src/observe/retain.js';

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

function fixture() {
  const g = new Geonosis();
  g.registerSource({ id: 'open-snapshot', acquisition: 'LIVE', retention: 'SNAPSHOT', mayDerive: true, license: 'public-domain' });
  g.registerSource({ id: 'open-mirror', acquisition: 'BULK', retention: 'MIRROR', mayDerive: true, license: 'CC0' });
  g.registerSource({ id: 'ephemeral', acquisition: 'LIVE', retention: 'EPHEMERAL', mayDerive: true, license: 'provider-terms' });
  g.registerSource({ id: 'no-derive', acquisition: 'OPTIONAL_CREDENTIAL', retention: 'REFERENCE', mayDerive: false });
  return g;
}

console.log('\nGEONOSIS — evidence before world-state');

test('observing does not touch Terrarium World', () => {
  const g = fixture();
  let deeds = 0;
  const world = { addEntity() { deeds++; } };
  g.observe({ id: 'obs:1', provider: 'open-snapshot', providerRecordId: '1', geometry: { type: 'Point', coordinates: [-84, 33] } });
  assert.equal(deeds, 0);
  assert.equal(g.observations.size, 1);
  void world;
});

test('signals must cite evidence that exists', () => {
  const g = fixture();
  assert.throws(() => g.signal({ id: 'sig:bad', subject: 'x', predicate: 'hot', value: true, derivedFrom: ['missing'] }), /missing evidence/);
  g.observe({ id: 'obs:1', provider: 'open-snapshot' });
  const s = g.signal({ id: 'sig:1', subject: 'place:1', predicate: 'hot', value: true, derivedFrom: ['obs:1'] });
  assert.equal(s.epistemic, 'DERIVED');
});

test('source policy can forbid derivation even when data is reachable', () => {
  const g = fixture();
  g.observe({ id: 'obs:closed', provider: 'no-derive' });
  assert.throws(() => g.signal({ id: 'sig:closed', subject: 'x', predicate: 'classified', value: true, derivedFrom: ['obs:closed'] }), /forbids derived signals/);
});

test('conditions expire without creating history', () => {
  const g = fixture();
  g.observe({ id: 'obs:gauge', provider: 'open-snapshot' });
  g.signal({ id: 'sig:gauge', subject: 'creek', predicate: 'stage_m', value: 1.7, derivedFrom: ['obs:gauge'] });
  g.condition({ id: 'cond:creek', subject: 'creek', state: 'HIGH_FLOW', began: 1000, lastSeen: 1500, expiresAt: 2000, supportedBy: ['sig:gauge'] });
  assert.equal(g.conditions.size, 1);
  const expired = g.expire(2001);
  assert.equal(expired.length, 1);
  assert.equal(g.conditions.size, 0);
});

test('absence requires sufficient coverage', () => {
  assert.equal(absence({ expected: true, observed: false, coverage: 'UNKNOWN' }).active, false);
  assert.equal(absence({ expected: true, observed: false, coverage: 'SUFFICIENT' }).active, true);
});

test('mismatch and surprise remain deterministic', () => {
  assert.equal(mismatch('OPEN', 'CLOSED').active, true);
  assert.equal(surprise(31, 30, 2).active, false);
  assert.equal(surprise(35, 30, 2).active, true);
});

test('contestation preserves incompatible claims instead of choosing one', () => {
  const d = contestation([
    { id: 'a', predicate: 'road_open', value: true },
    { id: 'b', predicate: 'road_open', value: false },
  ]);
  assert.equal(d.active, true);
  assert.equal(d.conflicts[0].variants.length, 2);
});

test('rhythm can become rupture', () => {
  const r = rhythm([0, 1000, 2010, 3000, 4010]);
  assert.equal(r.active, true);
  assert.ok(r.periodMs >= 990 && r.periodMs <= 1010);
  const intact = rupture({ lastSeen: 4010, periodMs: r.periodMs, now: 5200, grace: 0.5 });
  const broken = rupture({ lastSeen: 4010, periodMs: r.periodMs, now: 7000, grace: 0.5 });
  assert.equal(intact.active, false);
  assert.equal(broken.active, true);
});

test('ICOSA address lookup can include descendants without duplicating records', () => {
  const g = fixture();
  g.observe({ id: 'obs:a', provider: 'open-snapshot', address: ['F08.0312'] });
  g.observe({ id: 'obs:b', provider: 'open-snapshot', address: ['F08.04'] });
  assert.equal(g.byAddress('F08.0312').observations.length, 1);
  assert.equal(g.byAddress('F08', { descendants: true }).observations.length, 2);
  assert.equal(g.byAddress('F08.03', { descendants: true }).observations.length, 1);
});

test('snapshot persistence obeys each source retention law', () => {
  const g = fixture();
  g.observe({
    id: 'obs:snap', provider: 'open-snapshot', geometry: { type: 'Point', coordinates: [1, 2] },
    rawProperties: { secretShapeOfProviderPayload: 7 }, address: ['F01.2'],
  });
  g.observe({
    id: 'obs:mirror', provider: 'open-mirror', geometry: { type: 'Point', coordinates: [3, 4] },
    rawProperties: { kept: true }, address: ['F02.1'],
  });
  g.observe({
    id: 'obs:eph', provider: 'ephemeral', geometry: { type: 'Point', coordinates: [5, 6] },
    rawProperties: { mustDisappear: true }, address: ['F03.1'],
  });
  g.signal({ id: 'sig:eph', subject: 'thing:eph', predicate: 'present', value: true, derivedFrom: ['obs:eph'] });

  const saved = JSON.parse(g.snapshot());
  const snap = saved.observations.find((x) => x.id === 'obs:snap');
  const mirror = saved.observations.find((x) => x.id === 'obs:mirror');
  const eph = saved.observations.find((x) => x.id === 'obs:eph');
  assert.equal(snap.payloadState, 'NORMALIZED');
  assert.deepEqual(snap.rawProperties, {});
  assert.deepEqual(snap.geometry.coordinates, [1, 2]);
  assert.equal(mirror.payloadState, 'FULL');
  assert.equal(mirror.rawProperties.kept, true);
  assert.equal(eph.payloadState, 'REFERENCE');
  assert.equal(eph.geometry, null);
  assert.deepEqual(eph.address, []);
  assert.deepEqual(eph.rawProperties, {});

  const loaded = Geonosis.load(JSON.stringify(saved));
  assert.equal(loaded.signals.get('sig:eph').value, true);
  assert.equal(loaded.observations.get('obs:eph').payloadState, 'REFERENCE');
});

test('admission into PLACE is explicit and source-policy gated', () => {
  const g = fixture();
  g.observe({ id: 'obs:keep', provider: 'open-snapshot', providerRecordId: 'K' });
  g.observe({ id: 'obs:eph', provider: 'ephemeral', providerRecordId: 'E' });
  const committed = [];
  const world = {
    addEntity(entity, meta) { committed.push({ entity, meta }); return entity; },
  };
  const entity = admitObservation(world, g, 'obs:keep', {
    author: 'tester',
    localize: () => ({ type: 'marker', footprint: [[0, 0], [1, 0], [1, 1]], zBase: 0, zTop: 1 }),
  });
  assert.equal(committed.length, 1);
  assert.equal(entity.source, 'open-snapshot');
  assert.equal(entity.evidence[0].observationId, 'obs:keep');
  assert.throws(() => admitObservation(world, g, 'obs:eph', {
    localize: () => ({ footprint: [[0, 0], [1, 0], [1, 1]] }),
  }), /retain testimony\/reference/);
  assert.equal(committed.length, 1);
});

if (!process.exitCode) console.log(`\n${passed} Geonosis tests passed.`);
