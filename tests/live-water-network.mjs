import assert from 'node:assert/strict';
import { makeProjection } from '../src/core/geom.js';
import { GEONOSIS, refreshWater, describeWater } from '../src/observe/live-water.js';

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

const NOW = Date.parse('2026-08-25T16:50:00Z');
const LON = -84.39, LAT = 33.75;

function reset() {
  GEONOSIS.sources.clear();
  GEONOSIS.observations.clear();
  GEONOSIS.signals.clear();
  GEONOSIS.conditions.clear();
  GEONOSIS.relations.clear();
  GEONOSIS.interpretants.clear();
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}
function fc(features) { return { type: 'FeatureCollection', features }; }
function waterFeature({
  series = 'series-flow', pcode = '00060', value = '132', unit = 'ft^3/s',
  time = '2026-08-25T16:45:00Z',
} = {}) {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates: [LON, LAT] },
    properties: {
      time_series_id: series,
      monitoring_location_id: 'USGS-TEST',
      monitoring_location_name: 'PEACHTREE CREEK AT ATLANTA',
      parameter_code: pcode, time, value, unit_of_measure: unit,
      approval_status: 'Provisional',
    },
  };
}
function nldiSite() {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates: [LON, LAT] },
    properties: {
      identifier: 'USGS-TEST', name: 'PEACHTREE CREEK AT ATLANTA',
      comid: 12345, reachcode: '03130002000123', measure: 42.5,
      source: 'nwissite', sourceName: 'NWIS Surface Water Sites',
    },
  };
}
function nldiFlow() {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[LON - .001, LAT], [LON, LAT], [LON + .001, LAT]] },
    properties: { comid: 12345, source: 'comid', sourceName: 'NHDPlusV2' },
  };
}
function world() {
  const creek = {
    id: 'osm_w101', type: 'water', subtype: 'stream', name: 'Peachtree Creek', network: 'drainage',
    path: [[-100, 0], [100, 0]], width: 3,
  };
  return {
    place: {
      id: 'atlanta-test', name: 'Atlanta Test',
      meta: { bbox: [33.74, -84.40, 33.76, -84.38] },
      projection: makeProjection(LAT, LON),
    },
    entities() { return [creek]; },
    get(id) { return id === creek.id ? creek : null; },
  };
}

console.log('\nLIVE WATER NETWORK — measured reach, still not hazard');

await test('two parameter series at one gauge produce one NLDI lookup and one network-linked measures relation', async () => {
  reset();
  const latest = fc([
    waterFeature(),
    waterFeature({ series: 'series-stage', pcode: '00065', value: '4.2', unit: 'ft' }),
  ]);
  const history = fc([
    waterFeature({ time: '2026-08-25T13:00:00Z', value: '100' }),
    waterFeature({ time: '2026-08-25T14:00:00Z', value: '104' }),
    waterFeature({ time: '2026-08-25T15:00:00Z', value: '126' }),
    waterFeature({ time: '2026-08-25T16:00:00Z', value: '132' }),
  ]);
  let waterCalls = 0, nldiSiteCalls = 0, nldiHydroCalls = 0;
  const fetchImpl = async (url) => {
    const s = String(url);
    if (s.includes('/nldi/linked-data/nwissite/')) { nldiSiteCalls++; return response(fc([nldiSite()])); }
    if (s.includes('/nldi/linked-data/hydrolocation')) { nldiHydroCalls++; return response(fc([nldiFlow()])); }
    waterCalls++;
    return response(s.includes('/continuous/items') ? history : latest);
  };

  const result = await refreshWater(world(), { now: NOW, force: true, fetchImpl });
  assert.equal(result.state, 'CURRENT');
  assert.equal(waterCalls, 2);
  assert.equal(nldiSiteCalls, 1, 'NLDI is a site lookup, not a per-parameter lookup');
  assert.equal(nldiHydroCalls, 1);
  assert.equal(result.relations.length, 2, 'flow and stage each preserve their own candidate evidence');
  assert.equal(result.network.state, 'LINKED');
  assert.equal(result.measures.length, 1, 'shared mapped target is deduplicated before the network decision');
  assert.equal(result.measures[0].kind, 'measures');
  assert.equal(result.measures[0].props.terrariumEntityId, 'osm_w101');
  assert.equal([...GEONOSIS.relations.values()].filter((r) => r.kind === 'measures').length, 1);
  const text = describeWater(result, GEONOSIS);
  assert.match(text, /network-linked through USGS NLDI\/NHDPlus/i);
  assert.match(text, /does not classify flood severity, hazard, or actor behavior/i);
});

await test('NLDI failure leaves current USGS measurements and candidate relations intact', async () => {
  reset();
  const latest = fc([waterFeature()]);
  const history = fc([]);
  const fetchImpl = async (url) => {
    const s = String(url);
    if (s.includes('/nldi/')) return response({}, 503);
    return response(s.includes('/continuous/items') ? history : latest);
  };
  const result = await refreshWater(world(), { now: NOW, force: true, fetchImpl });
  assert.equal(result.state, 'CURRENT');
  assert.equal(result.relations.length, 1);
  assert.equal(result.measures.length, 0);
  assert.equal(result.network.state, 'UNAVAILABLE');
  assert.equal(GEONOSIS.signals.size >= 1, true);
  const text = describeWater(result, GEONOSIS);
  assert.match(text, /NLDI network evidence was unavailable/i);
  assert.match(text, /proximity was not upgraded/i);
});

if (!process.exitCode) console.log(`\n${passed} live network tests passed.`);
