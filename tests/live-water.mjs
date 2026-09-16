import assert from 'node:assert/strict';
import { Geonosis } from '../src/observe/geonosis.js';
import { makeProjection } from '../src/core/geom.js';
import { worldWaterBBox, pointToLocal, describeWater, refreshWater, GEONOSIS } from '../src/observe/live-water.js';

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

function world() {
  return {
    place: {
      id: 'atlanta-test',
      name: 'Atlanta Test',
      meta: { bbox: [33.74, -84.40, 33.76, -84.38] },
      projection: makeProjection(33.75, -84.39),
    },
  };
}

function feature({ time = '2026-08-25T13:45:00Z', value = '132', name = 'PEACHTREE CREEK AT ATLANTA' } = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-84.39, 33.75] },
    properties: {
      time_series_id: 'series-flow',
      monitoring_location_id: 'USGS-TEST',
      monitoring_location_name: name,
      parameter_code: '00060',
      time,
      value,
      unit_of_measure: 'ft^3/s',
      approval_status: 'Provisional',
    },
  };
}

function response(body) {
  return { ok: true, status: 200, async json() { return body; } };
}

console.log('\nLIVE WATER — sense, do not rewrite the world');

await test('Terrarium bbox is reordered for USGS and padded in real metres', () => {
  const b = worldWaterBBox(world(), 0);
  assert.deepEqual(b, [-84.40, 33.74, -84.38, 33.76]);
  const padded = worldWaterBBox(world(), 12000);
  assert.ok(padded[0] < -84.40 && padded[2] > -84.38);
  assert.ok(padded[1] < 33.74 && padded[3] > 33.76);
});

await test('a gauge point can enter local metres without becoming a PLACE entity', () => {
  const p = pointToLocal(world(), { type: 'Point', coordinates: [-84.39, 33.75] });
  assert.ok(Math.abs(p[0]) < 0.01 && Math.abs(p[1]) < 0.01);
});

await test('synthetic worlds refuse to invent a real sensor neighborhood', async () => {
  const result = await refreshWater({ place: { id: 'synthetic', name: 'Synthetic', meta: null } }, { now: NOW, force: true });
  assert.equal(result.state, 'NO_REAL_LOCATION');
});

await test('empty sensor coverage stays distinct from water absence in language', () => {
  const text = describeWater({ state: 'NO_GAUGE_COVERAGE', rows: [], conditions: [] }, new Geonosis());
  assert.match(text, /no streamflow or gage-height sensors/i);
  assert.match(text, /not evidence there is no water/i);
});

await test('unavailable source stays distinct from environmental absence', () => {
  const text = describeWater({ state: 'UNAVAILABLE' }, new Geonosis());
  assert.match(text, /unavailable/i);
  assert.match(text, /not evidence/i);
});

await test('the live bridge harvests nearby water but never receives a World mutation method', async () => {
  GEONOSIS.sources.clear();
  GEONOSIS.observations.clear();
  GEONOSIS.signals.clear();
  GEONOSIS.conditions.clear();
  let calls = 0;
  const latest = { type: 'FeatureCollection', features: [feature()] };
  const history = { type: 'FeatureCollection', features: [
    feature({ time: '2026-08-25T10:00:00Z', value: '100' }),
    feature({ time: '2026-08-25T11:00:00Z', value: '102' }),
    feature({ time: '2026-08-25T12:00:00Z', value: '130' }),
    feature({ time: '2026-08-25T13:00:00Z', value: '132' }),
  ] };
  const w = world();
  // There is intentionally no addEntity/transact method on this object. If the
  // live bridge tries to commit anything, this test will fail by throwing.
  const result = await refreshWater(w, {
    now: NOW,
    force: true,
    fetchImpl: async (url) => {
      calls++;
      return response(String(url).includes('/continuous/items') ? history : latest);
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.state, 'CURRENT');
  assert.equal(result.conditions[0].state, 'FLOW_RISING');
  assert.equal(GEONOSIS.conditions.size, 1);
});

await test('measured current water becomes concise place-language with provenance restraint', () => {
  const result = {
    state: 'CURRENT',
    rows: [...GEONOSIS.signals.values()].filter((s) => s.validFrom === Date.parse('2026-08-25T13:45:00Z')).map((signal) => ({ signal })),
    conditions: [...GEONOSIS.conditions.values()],
  };
  const text = describeWater(result, GEONOSIS);
  assert.match(text, /PEACHTREE CREEK AT ATLANTA/);
  assert.match(text, /streamflow 132 ft\^3\/s/);
  assert.match(text, /flow rising/);
  assert.match(text, /not flood-severity claims/i);
});

if (!process.exitCode) console.log(`\n${passed} live-water tests passed.`);
