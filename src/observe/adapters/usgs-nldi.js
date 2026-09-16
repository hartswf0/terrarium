// USGS NLDI — network evidence for deciding what a streamgage is actually linked to.
//
// NLDI indexes NWIS surface-water sites onto NHDPlusV2. This adapter turns that
// linkage into Geonosis evidence. It does not touch Terrarium PLACE and it does
// not decide that an OSM waterway is the measured reach; watercourse-network.js
// makes that separate comparison.

import { CORE_SOURCES } from '../catalog.js';

export const USGS_NLDI_SOURCE_ID = 'usgs-nldi';
export const NLDI_BASE = 'https://api.water.usgs.gov/nldi/linked-data';

const NLDI_POLICY = CORE_SOURCES.find((x) => x.id === USGS_NLDI_SOURCE_ID);

function stablePart(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9._:-]+/g, '_');
}

function normalizeSiteId(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (/^USGS-/i.test(s)) return `USGS-${s.slice(5)}`;
  if (/^\d+$/.test(s)) return `USGS-${s}`;
  return s;
}

function firstFeature(collection) {
  return Array.isArray(collection?.features) ? collection.features[0] || null : null;
}

function comidOf(feature) {
  const p = feature?.properties || {};
  const value = p.comid ?? p.nhdplus_comid ?? p.identifier;
  return value == null ? null : String(value);
}

function pointCoords(feature) {
  if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return null;
  const [lon, lat] = feature.geometry.coordinates.map(Number);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

export function ensureUSGSNLDISource(geonosis) {
  if (!NLDI_POLICY) throw new Error('usgs-nldi source policy missing from catalog');
  if (!geonosis.sources.has(USGS_NLDI_SOURCE_ID)) geonosis.registerSource(NLDI_POLICY);
  return geonosis.sources.get(USGS_NLDI_SOURCE_ID);
}

export function buildNLDISiteUrl(siteId) {
  const id = normalizeSiteId(siteId);
  if (!id) throw new Error('NLDI site id is required');
  return `${NLDI_BASE}/nwissite/${encodeURIComponent(id)}?f=json`;
}

export function buildNLDIHydrolocationUrl(coords) {
  if (!Array.isArray(coords) || coords.length !== 2 || !coords.every((x) => Number.isFinite(Number(x)))) {
    throw new Error('NLDI hydrolocation needs [lon,lat]');
  }
  const [lon, lat] = coords.map(Number);
  const url = new URL(`${NLDI_BASE}/hydrolocation`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('coords', `POINT(${lon} ${lat})`);
  return url.toString();
}

export function normalizeNLDISiteFeature(feature, {
  retrievedAt = Date.now(),
  sourceUrl = null,
} = {}) {
  const p = feature?.properties || {};
  const identifier = normalizeSiteId(p.identifier || p.site_no || p.siteId);
  if (!identifier) return null;
  const comid = comidOf(feature);
  return {
    observation: {
      id: `usgs-nldi:site:${stablePart(identifier)}:${stablePart(comid || 'unlinked')}`,
      provider: USGS_NLDI_SOURCE_ID,
      providerRecordId: identifier,
      geometry: feature.geometry || null,
      observedAt: null,
      retrievedAt,
      method: 'api:nldi:nwissite',
      epistemic: 'IMPORTED',
      license: 'U.S. public domain',
      sourceUrl: sourceUrl || buildNLDISiteUrl(identifier),
      rawProperties: {
        subject: `usgs-water:site:${identifier}`,
        identifier,
        name: p.name || null,
        comid,
        reachcode: p.reachcode == null ? null : String(p.reachcode),
        measure: Number.isFinite(Number(p.measure)) ? Number(p.measure) : null,
        uri: p.uri || null,
        mainstem: p.mainstem || null,
        source: p.source || null,
        sourceName: p.sourceName || null,
      },
    },
    identifier,
    comid,
  };
}

export function normalizeNLDIFlowlineFeature(feature, {
  siteId,
  retrievedAt = Date.now(),
  sourceUrl = null,
} = {}) {
  const p = feature?.properties || {};
  const comid = comidOf(feature);
  if (!comid || !feature?.geometry) return null;
  const id = normalizeSiteId(siteId) || 'unknown-site';
  return {
    observation: {
      id: `usgs-nldi:flowline:${stablePart(comid)}`,
      provider: USGS_NLDI_SOURCE_ID,
      providerRecordId: comid,
      geometry: feature.geometry,
      observedAt: null,
      retrievedAt,
      method: 'api:nldi:hydrolocation',
      epistemic: 'IMPORTED',
      license: 'U.S. public domain',
      sourceUrl,
      rawProperties: {
        subject: `usgs-nldi:comid:${comid}`,
        siteId: id,
        comid,
        reachcode: p.reachcode == null ? null : String(p.reachcode),
        measure: Number.isFinite(Number(p.measure)) ? Number(p.measure) : null,
        source: p.source || null,
        sourceName: p.sourceName || null,
        type: p.type || null,
        uri: p.uri || null,
      },
    },
    comid,
  };
}

async function fetchJSON(url, { fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('NLDI needs fetch');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (response.status === 404) return { status: 404, json: null };
    if (!response.ok) throw new Error(`NLDI HTTP ${response.status}`);
    return { status: response.status, json: await response.json() };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Retrieve the authoritative NLDI record for one NWIS surface-water site and a
 * hydrolocated NHDPlusV2 flowline at that site's coordinate. A LINKED result
 * requires the site-index comid and hydrolocation comid to agree. Disagreement
 * is returned as NETWORK_MISMATCH, never papered over.
 */
export async function fetchNLDILinkage(geonosis, {
  siteId,
  coords = null,
  retrievedAt = Date.now(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 12000,
} = {}) {
  ensureUSGSNLDISource(geonosis);
  const identifier = normalizeSiteId(siteId);
  if (!identifier) return { state: 'NO_SITE_ID', siteId: null };

  const siteUrl = buildNLDISiteUrl(identifier);
  let sitePayload;
  try {
    sitePayload = await fetchJSON(siteUrl, { fetchImpl, timeoutMs });
  } catch (error) {
    return { state: 'UNAVAILABLE', siteId: identifier, error: error.message, siteUrl };
  }
  if (sitePayload.status === 404) return { state: 'NOT_INDEXED', siteId: identifier, siteUrl };
  const siteFeature = firstFeature(sitePayload.json);
  const siteRow = normalizeNLDISiteFeature(siteFeature, { retrievedAt, sourceUrl: siteUrl });
  if (!siteRow) return { state: 'NOT_INDEXED', siteId: identifier, siteUrl };
  const siteObservation = geonosis.observe(siteRow.observation);

  const at = pointCoords(siteFeature) || (Array.isArray(coords) ? coords.map(Number) : null);
  if (!at || !at.every(Number.isFinite)) {
    return {
      state: 'SITE_ONLY', siteId: identifier, siteObservation,
      siteComid: siteRow.comid, siteUrl,
    };
  }

  const flowlineUrl = buildNLDIHydrolocationUrl(at);
  let flowPayload;
  try {
    flowPayload = await fetchJSON(flowlineUrl, { fetchImpl, timeoutMs });
  } catch (error) {
    return {
      state: 'FLOWLINE_UNAVAILABLE', siteId: identifier, siteObservation,
      siteComid: siteRow.comid, siteUrl, flowlineUrl, error: error.message,
    };
  }
  if (flowPayload.status === 404) {
    return {
      state: 'NO_HYDROLOCATION', siteId: identifier, siteObservation,
      siteComid: siteRow.comid, siteUrl, flowlineUrl,
    };
  }
  const flowFeature = firstFeature(flowPayload.json);
  const flowRow = normalizeNLDIFlowlineFeature(flowFeature, {
    siteId: identifier, retrievedAt, sourceUrl: flowlineUrl,
  });
  if (!flowRow) {
    return {
      state: 'NO_HYDROLOCATION', siteId: identifier, siteObservation,
      siteComid: siteRow.comid, siteUrl, flowlineUrl,
    };
  }
  const flowlineObservation = geonosis.observe(flowRow.observation);
  const siteComid = siteRow.comid;
  const flowlineComid = flowRow.comid;
  const comidMatch = !!siteComid && !!flowlineComid && siteComid === flowlineComid;

  return {
    state: comidMatch ? 'LINKED' : 'NETWORK_MISMATCH',
    siteId: identifier,
    siteComid,
    flowlineComid,
    comidMatch,
    siteObservation,
    flowlineObservation,
    siteUrl,
    flowlineUrl,
  };
}
