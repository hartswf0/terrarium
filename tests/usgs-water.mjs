import assert from 'node:assert/strict';
import { Geonosis } from '../src/observe/geonosis.js';
import {
  buildUSGSWaterUrl,
  normalizeUSGSWaterFeature,
  ingestUSGSWaterCollection,
  waterFreshness,
  deriveWaterTrend,
  conditionWaterTrends,
  harvestUSGSWater,
} from '../src/observe/adapters/usgs-water.js';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

const NOW = Date.parse('2026-08-25T14:00:00Z');

function feature({
  id = 'f1',
  series = 'series-flow',
  site = 'USGS-02336000',
  pcode = '00060',
  time = '2026-08-25T13:45:00Z',
  value = '100',
  unit = 'ft^3/s',
  approval = 'Provisional',
  coordinates = [-84.42, 33.75],
} = {}) {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates },
    properties: {
      time_series_id: series,
      monitoring_location_id: site,
      monitoring_location_name: 'TEST CREEK AT TEST CITY',
      parameter_code: pcode,
      time,
      value,
      unit_of_measure: unit,
      approval_status: approval,
      qualifier: null,
      hydrologic_unit_code: '03130001',
    },
  };
}

function collection(features) { return { type: 'FeatureCollection', features }; }

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

console.log('\nUSGS WATER — observation becomes process');

await test('URL builder uses modern latest-continuous endpoint and keyless query parameters', () => {
  const url = new URL(buildUSGSWaterUrl({
    bbox: [-84.7, 33.4, -84.1, 34.1],
    parameterCodes: ['00060', '00065'],
  }));
  assert.equal(url.pathname, '/ogcapi/v0/collections/latest-continuous/items');
  assert.equal(url.searchParams.get('parameter_code'), '00060,00065');
  assert.equal(url.searchParams.get('bbox'), '-84.7,33.4,-84.1,34.1');
  assert.equal(url.searchParams.has('api_key'), false);
});

await test('one feature becomes immutable measurement evidence plus a numeric signal', () => {
  const row = normalizeUSGSWaterFeature(feature(), {
    retrievedAt: NOW,
    addressFor: () => ['F08.0312'],
  });
  assert.equal(row.observation.provider, 'usgs-water');
  assert.equal(row.observation.epistemic, 'MEASURED');
  assert.equal(row.observation.method, 'api:latest-continuous');
  assert.equal(row.observation.rawProperties.approvalStatus, 'Provisional');
  assert.deepEqual(row.observation.address, ['F08.0312']);
  assert.equal(row.signal.subject, 'usgs-water:site:USGS-02336000');
  assert.equal(row.signal.predicate, 'streamflow');
  assert.equal(row.signal.value, 100);
  assert.equal(row.signal.relations[0].unit, 'ft^3/s');
});

await test('malformed/non-numeric measurements do not become invented numeric claims', () => {
  const row = normalizeUSGSWaterFeature(feature({ value: 'Ice' }), { retrievedAt: NOW });
  assert.ok(row.observation, 'source evidence should still exist');
  assert.equal(row.signal, null, 'non-numeric value must not become a numeric signal');
});

await test('successful empty collection means no gauge coverage, not no water', () => {
  const g = new Geonosis();
  const rows = ingestUSGSWaterCollection(g, collection([]), { retrievedAt: NOW });
  const state = waterFreshness(rows, { now: NOW });
  assert.equal(rows.length, 0);
  assert.equal(state.state, 'NO_GAUGE_COVERAGE');
  assert.equal(g.signals.size, 0);
  assert.equal(g.conditions.size, 0);
});

await test('USGS Water source is public-domain and mirrorable, without requiring a key', () => {
  const g = new Geonosis();
  ingestUSGSWaterCollection(g, collection([feature()]), { retrievedAt: NOW });
  const source = g.sources.get('usgs-water');
  assert.equal(source.keyRequired, false);
  assert.equal(source.retention, 'MIRROR');
  assert.match(source.license, /public domain/i);
  const saved = JSON.parse(g.snapshot());
  assert.equal(saved.observations[0].payloadState, 'FULL');
});

await test('freshness distinguishes current, partial stale, and stale without deleting evidence', () => {
  const current = { observation: { observedAt: NOW - 10 * 60 * 1000 } };
  const old = { observation: { observedAt: NOW - 2 * 60 * 60 * 1000 } };
  assert.equal(waterFreshness([current], { now: NOW }).state, 'CURRENT');
  assert.equal(waterFreshness([current, old], { now: NOW }).state, 'PARTIAL_STALE');
  assert.equal(waterFreshness([old], { now: NOW }).state, 'STALE');
});

await test('trend detector compares halves of a window and exposes its threshold', () => {
  const samples = [
    { time: 1, value: 100 }, { time: 2, value: 102 },
    { time: 3, value: 130 }, { time: 4, value: 132 },
  ];
  const rising = deriveWaterTrend(samples, { relativeThreshold: 0.05 });
  assert.equal(rising.active, true);
  assert.equal(rising.direction, 'RISING');
  assert.equal(rising.relativeThreshold, 0.05);

  const noise = deriveWaterTrend([
    { time: 1, value: 100 }, { time: 2, value: 101 },
    { time: 3, value: 101 }, { time: 4, value: 102 },
  ], { relativeThreshold: 0.05 });
  assert.equal(noise.active, false);
});

await test('recent history can become an expiring FLOW_RISING condition without claiming flood severity', () => {
  const g = new Geonosis();
  const times = ['10:00', '11:00', '12:00', '13:00'];
  const values = [100, 102, 130, 132];
  const rows = ingestUSGSWaterCollection(g, collection(times.map((hhmm, i) => feature({
    id: `h${i}`,
    time: `2026-08-25T${hhmm}:00Z`,
    value: String(values[i]),
  }))), { retrievedAt: NOW, collection: 'continuous' });
  const made = conditionWaterTrends(g, rows, { relativeThreshold: 0.05 });
  assert.equal(rows[0].observation.method, 'api:continuous');
  assert.equal(made.length, 1);
  assert.equal(made[0].state, 'FLOW_RISING');
  assert.match(made[0].props.classification, /not flood severity/);
  assert.ok(made[0].expiresAt > made[0].lastSeen);
});

await test('full harvester performs latest then history and leaves both as Geonosis, not PLACE deeds', async () => {
  const g = new Geonosis();
  let calls = 0;
  const latest = collection([feature({ time: '2026-08-25T13:45:00Z', value: '132' })]);
  const history = collection([
    feature({ id: 'a', time: '2026-08-25T10:00:00Z', value: '100' }),
    feature({ id: 'b', time: '2026-08-25T11:00:00Z', value: '102' }),
    feature({ id: 'c', time: '2026-08-25T12:00:00Z', value: '130' }),
    feature({ id: 'd', time: '2026-08-25T13:00:00Z', value: '132' }),
  ]);
  const fetchImpl = async (url) => {
    calls++;
    return fakeResponse(String(url).includes('/continuous/items') ? history : latest);
  };

  const result = await harvestUSGSWater(g, {
    bbox: [-84.7, 33.4, -84.1, 34.1],
    now: NOW,
    fetchImpl,
    trend: { relativeThreshold: 0.05 },
  });
  assert.equal(calls, 2);
  assert.equal(result.state, 'CURRENT');
  assert.equal(result.historyState, 'CURRENT');
  assert.equal(result.rows[0].observation.method, 'api:latest-continuous');
  assert.equal(result.historyRows[0].observation.method, 'api:continuous');
  assert.equal(result.conditions[0].state, 'FLOW_RISING');
  assert.ok(g.observations.size >= 4);
  assert.ok(g.signals.size >= 4);
});

await test('network failure is UNAVAILABLE and never reinterpreted as a successful zero', async () => {
  const g = new Geonosis();
  const result = await harvestUSGSWater(g, {
    bbox: [-84.7, 33.4, -84.1, 34.1],
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(result.state, 'UNAVAILABLE');
  assert.equal(g.observations.size, 0);
});

if (!process.exitCode) console.log(`\n${passed} USGS Water tests passed.`);
