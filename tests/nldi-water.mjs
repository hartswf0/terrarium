import assert from 'node:assert/strict';
import { Geonosis } from '../src/observe/geonosis.js';
import { makeProjection } from '../src/core/geom.js';
import {
  buildNLDISiteUrl, buildNLDIHydrolocationUrl, fetchNLDILinkage,
} from '../src/observe/adapters/usgs-nldi.js';
import { candidateWatercourseRelations } from '../src/observe/watercourse-relations.js';
import { nhdAlignment, upgradeNLDIMeasuresRelation } from '../src/observe/watercourse-network.js';

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

const NOW = Date.parse('2026-08-25T16:45:00Z');
const LON = -84.39, LAT = 33.75;

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}
function fc(features) { return { type: 'FeatureCollection', features }; }
function siteFeature(comid = 12345) {
  return {
    type: 'Feature', geometry: { type: 'Point', coordinates: [LON, LAT] },
    properties: {
      identifier: 'USGS-TEST', name: 'PEACHTREE CREEK AT ATLANTA',
      comid, reachcode: '03130002000123', measure: 42.5,
      source: 'nwissite', sourceName: 'NWIS Surface Water Sites',
    },
  };
}
function flowFeature(comid = 12345, yOffsetDeg = 0) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [[LON - 0.001, LAT + yOffsetDeg], [LON, LAT + yOffsetDeg], [LON + 0.001, LAT + yOffsetDeg]],
    },
    properties: { comid, source: 'comid', sourceName: 'NHDPlusV2' },
  };
}
function world(entities) {
  const list = entities;
  return {
    place: { id: 'atlanta-test', name: 'Atlanta Test', projection: makeProjection(LAT, LON) },
    entities() { return list; },
    get(id) { return list.find((e) => e.id === id) || null; },
  };
}
function measurement(g) {
  g.registerSource({ id: 'usgs-water', acquisition: 'LIVE', retention: 'MIRROR', mayDerive: true, mayRedistribute: true });
  return g.observe({
    id: 'water-o1', provider: 'usgs-water', providerRecordId: 'series1',
    observedAt: NOW, retrievedAt: NOW, epistemic: 'MEASURED',
    geometry: { type: 'Point', coordinates: [LON, LAT] },
    rawProperties: {
      subject: 'usgs-water:site:USGS-TEST', monitoringLocationId: 'USGS-TEST',
      monitoringLocationName: 'PEACHTREE CREEK AT ATLANTA',
    },
  });
}
const creek = {
  id: 'osm_w101', type: 'water', subtype: 'stream', name: 'Peachtree Creek', network: 'drainage',
  path: [[-100, 0], [100, 0]], width: 3,
};

console.log('\nNLDI WATER — network evidence earns a stronger relation');

await test('NLDI URLs use the current USGS API and GeoJSON mode', () => {
  assert.equal(buildNLDISiteUrl('TEST'), 'https://api.water.usgs.gov/nldi/linked-data/nwissite/TEST?f=json');
  const h = new URL(buildNLDIHydrolocationUrl([LON, LAT]));
  assert.equal(h.pathname, '/nldi/linked-data/hydrolocation');
  assert.equal(h.searchParams.get('f'), 'json');
  assert.equal(h.searchParams.get('coords'), `POINT(${LON} ${LAT})`);
});

await test('matching NLDI site and hydrolocation COMIDs become two auditable observations', async () => {
  const g = new Geonosis();
  let calls = 0;
  const linkage = await fetchNLDILinkage(g, {
    siteId: 'USGS-TEST', retrievedAt: NOW,
    fetchImpl: async (url) => {
      calls++;
      return String(url).includes('/hydrolocation') ? response(fc([flowFeature()])) : response(fc([siteFeature()]));
    },
  });
  assert.equal(calls, 2);
  assert.equal(linkage.state, 'LINKED');
  assert.equal(linkage.siteComid, '12345');
  assert.equal(linkage.flowlineComid, '12345');
  assert.equal(linkage.comidMatch, true);
  assert.equal(g.observations.size, 2);
  assert.equal(g.sources.get('usgs-nldi').retention, 'MIRROR');
  assert.equal(linkage.siteObservation.rawProperties.reachcode, '03130002000123');
});

await test('NLDI COMID disagreement is surfaced and never upgraded away', async () => {
  const g = new Geonosis();
  const linkage = await fetchNLDILinkage(g, {
    siteId: 'USGS-TEST', retrievedAt: NOW,
    fetchImpl: async (url) => String(url).includes('/hydrolocation')
      ? response(fc([flowFeature(99999)])) : response(fc([siteFeature(12345)])),
  });
  assert.equal(linkage.state, 'NETWORK_MISMATCH');
  assert.equal(linkage.comidMatch, false);
});

await test('a site absent from NLDI is NOT_INDEXED rather than a fake negative hydrology claim', async () => {
  const g = new Geonosis();
  const linkage = await fetchNLDILinkage(g, {
    siteId: 'USGS-NOTTHERE', retrievedAt: NOW,
    fetchImpl: async () => response({}, 404),
  });
  assert.equal(linkage.state, 'NOT_INDEXED');
  assert.equal(g.observations.size, 0);
});

await test('NHD flowline geometry can be compared with Terrarium local metres', () => {
  const w = world([creek]);
  const a = nhdAlignment(w, creek, flowFeature().geometry, { thresholdM: 35 });
  assert.ok(a);
  assert.ok(a.medianM < 0.1);
  assert.equal(a.coverageFraction, 1);
});

await test('candidate_measures upgrades to DERIVED measures only after NLDI network agreement and geometry alignment', async () => {
  const g = new Geonosis();
  const o = measurement(g);
  const w = world([creek]);
  const candidate = candidateWatercourseRelations(g, w, o)[0];
  const linkage = await fetchNLDILinkage(g, {
    siteId: 'USGS-TEST', retrievedAt: NOW,
    fetchImpl: async (url) => String(url).includes('/hydrolocation')
      ? response(fc([flowFeature()])) : response(fc([siteFeature()])),
  });
  const out = upgradeNLDIMeasuresRelation(g, w, o, linkage, { candidates: [candidate] });
  assert.equal(out.state, 'MEASURES');
  assert.equal(out.relation.kind, 'measures');
  assert.equal(out.relation.epistemic, 'DERIVED');
  assert.equal(out.relation.props.status, 'NETWORK_LINKED');
  assert.equal(out.relation.props.nldiComid, '12345');
  assert.ok(out.relation.confidence > 0.9);
  assert.deepEqual(new Set(out.relation.derivedFrom), new Set([
    candidate.id, linkage.siteObservation.id, linkage.flowlineObservation.id,
  ]));
  assert.match(out.relation.props.warning, /not flood severity/i);
});

await test('two equally plausible mapped channels remain AMBIGUOUS instead of silently choosing one', async () => {
  const g = new Geonosis();
  const o = measurement(g);
  const a = { ...creek, id: 'osm_a', name: null, path: [[-100, -5], [100, -5]] };
  const b = { ...creek, id: 'osm_b', name: null, path: [[-100, 5], [100, 5]] };
  const w = world([a, b]);
  const candidates = candidateWatercourseRelations(g, w, o, { limit: 3 });
  const linkage = await fetchNLDILinkage(g, {
    siteId: 'USGS-TEST', retrievedAt: NOW,
    fetchImpl: async (url) => String(url).includes('/hydrolocation')
      ? response(fc([flowFeature()])) : response(fc([siteFeature()])),
  });
  const out = upgradeNLDIMeasuresRelation(g, w, o, linkage, { candidates });
  assert.equal(out.state, 'AMBIGUOUS');
  assert.equal(out.relation, null);
  assert.equal([...g.relations.values()].filter((r) => r.kind === 'measures').length, 0);
});

await test('an NHD flowline far from the mapped stream cannot upgrade proximity', async () => {
  const g = new Geonosis();
  const o = measurement(g);
  const w = world([creek]);
  const candidate = candidateWatercourseRelations(g, w, o)[0];
  const linkage = await fetchNLDILinkage(g, {
    siteId: 'USGS-TEST', retrievedAt: NOW,
    fetchImpl: async (url) => String(url).includes('/hydrolocation')
      ? response(fc([flowFeature(12345, 0.002)])) : response(fc([siteFeature()])),
  });
  const out = upgradeNLDIMeasuresRelation(g, w, o, linkage, { candidates: [candidate] });
  assert.equal(out.state, 'NO_NETWORK_MATCH');
  assert.equal(out.relation, null);
});

if (!process.exitCode) console.log(`\n${passed} NLDI/network tests passed.`);
