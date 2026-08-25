// USGS WATER — the first live organ of Geonosis.
//
// This adapter deliberately does NOT decide that a creek is dangerous, flooded,
// safe, or even present. It translates USGS measurements into evidence, signals,
// freshness state, and site-relative movement conditions. A successful empty
// response means NO_GAUGE_COVERAGE, never NO_WATER.
//
// Modern API contract (checked 2026-08-25):
//   latest-continuous = most recent observation per time series
//   continuous        = recent/full continuous history
// Parameter 00060 = discharge/streamflow. Parameter 00065 = gage height.

import { CORE_SOURCES } from '../catalog.js';

export const USGS_WATER_SOURCE_ID = 'usgs-water';
export const USGS_LATEST_COLLECTION = 'latest-continuous';
export const USGS_CONTINUOUS_COLLECTION = 'continuous';
export const DEFAULT_WATER_PARAMETERS = Object.freeze(['00060', '00065']);

export const WATER_PARAMETERS = Object.freeze({
  '00060': Object.freeze({ predicate: 'streamflow', label: 'Streamflow' }),
  '00065': Object.freeze({ predicate: 'gage_height', label: 'Gage height' }),
});

const BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections';
const USGS_POLICY = CORE_SOURCES.find((x) => x.id === USGS_WATER_SOURCE_ID);

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unique(values) { return [...new Set((values || []).filter(Boolean).map(String))]; }

function safeTime(value) {
  const t = value == null ? NaN : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function stablePart(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9._:-]+/g, '_');
}

function queryValue(values) {
  const list = unique(Array.isArray(values) ? values : [values]);
  return list.length ? list.join(',') : null;
}

/**
 * Build one modern USGS OGC API items request.
 * `bbox` is [west,south,east,north] in EPSG:4326.
 */
export function buildUSGSWaterUrl({
  collection = USGS_LATEST_COLLECTION,
  bbox = null,
  monitoringLocationIds = null,
  parameterCodes = DEFAULT_WATER_PARAMETERS,
  time = null,
  lastModified = null,
  limit = 5000,
} = {}) {
  if (![USGS_LATEST_COLLECTION, USGS_CONTINUOUS_COLLECTION].includes(collection)) {
    throw new Error(`unsupported USGS water collection ${collection}`);
  }
  const url = new URL(`${BASE}/${collection}/items`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('limit', String(Math.max(1, Math.min(50000, Number(limit) || 5000))));
  if (bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every((x) => Number.isFinite(Number(x)))) {
      throw new Error('USGS water bbox must be [west,south,east,north]');
    }
    url.searchParams.set('bbox', bbox.map(Number).join(','));
  }
  const sites = queryValue(monitoringLocationIds);
  const pcodes = queryValue(parameterCodes);
  if (sites) url.searchParams.set('monitoring_location_id', sites);
  if (pcodes) url.searchParams.set('parameter_code', pcodes);
  if (time) url.searchParams.set('time', String(time));
  if (lastModified) url.searchParams.set('last_modified', String(lastModified));
  return url.toString();
}

export function ensureUSGSWaterSource(geonosis) {
  if (!geonosis.sources.has(USGS_WATER_SOURCE_ID)) geonosis.registerSource(USGS_POLICY);
  return geonosis.sources.get(USGS_WATER_SOURCE_ID);
}

/** Normalize exactly one GeoJSON feature. No interpretation occurs here. */
export function normalizeUSGSWaterFeature(feature, {
  retrievedAt = Date.now(),
  addressFor = null,
} = {}) {
  const p = feature?.properties || {};
  const series = p.time_series_id || p.timeseries_id || feature?.id;
  const site = p.monitoring_location_id;
  const pcode = p.parameter_code;
  const observedAt = safeTime(p.time);
  if (!series || !site || !pcode || observedAt == null) return null;

  const geometry = feature?.geometry || null;
  const address = typeof addressFor === 'function'
    ? unique(addressFor({ geometry, properties: p, feature }) || [])
    : [];

  const observation = {
    id: `usgs-water:${stablePart(series)}:${observedAt}`,
    provider: USGS_WATER_SOURCE_ID,
    providerRecordId: String(series),
    geometry,
    observedAt,
    retrievedAt,
    method: 'api:latest-continuous',
    epistemic: 'MEASURED',
    license: 'U.S. public domain',
    sourceUrl: `${BASE}/${USGS_LATEST_COLLECTION}`,
    freshness: null,
    address,
    rawProperties: {
      subject: `usgs-water:site:${site}`,
      timeSeriesId: String(series),
      monitoringLocationId: String(site),
      monitoringLocationName: p.monitoring_location_name || null,
      parameterCode: String(pcode),
      value: p.value,
      unit: p.unit_of_measure || null,
      approvalStatus: p.approval_status || null,
      qualifier: p.qualifier || null,
      lastModified: p.last_modified || null,
      siteType: p.site_type || null,
      hydrologicUnitCode: p.hydrologic_unit_code || null,
      drainageArea: p.drainage_area ?? null,
    },
  };

  const spec = WATER_PARAMETERS[String(pcode)] || { predicate: `parameter_${pcode}`, label: `USGS parameter ${pcode}` };
  const numeric = finite(p.value);
  const signal = numeric == null ? null : {
    id: `signal:${observation.id}`,
    subject: observation.rawProperties.subject,
    predicate: spec.predicate,
    value: numeric,
    validFrom: observedAt,
    validTo: null,
    epistemic: 'MEASURED',
    confidence: 1,
    derivedFrom: [observation.id],
    address,
    relations: [{
      kind: 'measured_at',
      to: String(site),
      timeSeriesId: String(series),
      parameterCode: String(pcode),
      unit: p.unit_of_measure || null,
      approvalStatus: p.approval_status || null,
      qualifier: p.qualifier || null,
    }],
  };

  return { observation, signal, parameter: spec, site: String(site), series: String(series) };
}

/**
 * Insert a USGS FeatureCollection into Geonosis. Repeated records are idempotent
 * because their ids are series + observation time.
 */
export function ingestUSGSWaterCollection(geonosis, collection, opts = {}) {
  ensureUSGSWaterSource(geonosis);
  const features = Array.isArray(collection?.features) ? collection.features : [];
  const rows = [];
  for (const feature of features) {
    const row = normalizeUSGSWaterFeature(feature, opts);
    if (!row) continue;
    geonosis.observe(row.observation);
    if (row.signal) geonosis.signal(row.signal);
    rows.push(row);
  }
  return rows;
}

/**
 * Freshness is about sensor evidence, not water. Typical continuous stations are
 * often sampled at ~15 minute intervals, but telemetry can be delayed. The caller
 * owns `maxAgeMs`; this function never rewrites stale into absent.
 */
export function waterFreshness(rows, {
  now = Date.now(),
  maxAgeMs = 45 * 60 * 1000,
} = {}) {
  if (!rows.length) return { state: 'NO_GAUGE_COVERAGE', newestAt: null, oldestAt: null, count: 0 };
  const times = rows.map((r) => r.observation.observedAt).filter(Number.isFinite);
  if (!times.length) return { state: 'UNKNOWN', newestAt: null, oldestAt: null, count: rows.length };
  const newestAt = Math.max(...times), oldestAt = Math.min(...times);
  const stale = times.filter((t) => now - t > maxAgeMs).length;
  const state = stale === 0 ? 'CURRENT' : stale === times.length ? 'STALE' : 'PARTIAL_STALE';
  return { state, newestAt, oldestAt, count: rows.length, staleCount: stale, maxAgeMs };
}

function median(values) {
  const a = values.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * Detect a site-relative trend from recent measurements. This is NOT a flood
 * classification. The default 5% threshold is only an attention threshold for
 * "meaningfully different from the first half of this window" and is surfaced
 * in the condition props so downstream users can audit/change it.
 */
export function deriveWaterTrend(samples, {
  minSamples = 4,
  relativeThreshold = 0.05,
  absoluteThreshold = 0,
} = {}) {
  const rows = samples
    .map((x) => ({ time: Number(x.time), value: Number(x.value), support: x.support || null }))
    .filter((x) => Number.isFinite(x.time) && Number.isFinite(x.value))
    .sort((a, b) => a.time - b.time);
  if (rows.length < minSamples) return { active: false, reason: 'TOO_FEW_SAMPLES', samples: rows.length };

  const half = Math.floor(rows.length / 2);
  const before = median(rows.slice(0, half).map((x) => x.value));
  const after = median(rows.slice(half).map((x) => x.value));
  const delta = after - before;
  const scale = Math.max(Math.abs(before), Math.abs(after), 1e-12);
  const relative = Math.abs(delta) / scale;
  const active = Math.abs(delta) > absoluteThreshold && relative >= relativeThreshold;
  return {
    active,
    direction: !active ? 'STABLE' : delta > 0 ? 'RISING' : 'FALLING',
    before,
    after,
    delta,
    relativeChange: relative,
    startAt: rows[0].time,
    endAt: rows[rows.length - 1].time,
    samples: rows.length,
    supportedBy: rows.map((x) => x.support).filter(Boolean),
    relativeThreshold,
    absoluteThreshold,
  };
}

/** Turn recent history rows into temporary FLOW_RISING / STAGE_FALLING conditions. */
export function conditionWaterTrends(geonosis, rows, opts = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.signal) continue;
    const key = `${row.signal.subject}|${row.signal.predicate}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      time: row.observation.observedAt,
      value: row.signal.value,
      support: row.signal.id,
      row,
    });
  }

  const made = [];
  for (const group of groups.values()) {
    const trend = deriveWaterTrend(group, opts);
    if (!trend.active) continue;
    const last = group.slice().sort((a, b) => a.time - b.time).at(-1);
    const predicate = last.row.signal.predicate;
    const family = predicate === 'streamflow' ? 'FLOW' : predicate === 'gage_height' ? 'STAGE' : 'WATER';
    const state = `${family}_${trend.direction}`;
    const expiresAfterMs = Number.isFinite(opts.expiresAfterMs) ? Math.max(0, opts.expiresAfterMs) : 90 * 60 * 1000;
    const condition = geonosis.condition({
      id: `condition:${last.row.signal.subject}:${predicate}:${trend.endAt}`,
      subject: last.row.signal.subject,
      state,
      began: trend.startAt,
      lastSeen: trend.endAt,
      expiresAt: trend.endAt + expiresAfterMs,
      strength: Math.min(1, trend.relativeChange),
      supportedBy: trend.supportedBy,
      epistemic: 'DERIVED',
      address: last.row.signal.address,
      props: {
        predicate,
        before: trend.before,
        after: trend.after,
        delta: trend.delta,
        relativeChange: trend.relativeChange,
        relativeThreshold: trend.relativeThreshold,
        absoluteThreshold: trend.absoluteThreshold,
        classification: 'site-relative trend; not flood severity',
      },
    });
    made.push(condition);
  }
  return made;
}

async function fetchJSON(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('USGS water harvester needs fetch');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/geo+json, application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error(`USGS Water HTTP ${response.status}`);
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Keyless live harvest. The optional recent-history pass exists to make water a
 * process rather than a dashboard value. A failure returns UNAVAILABLE and does
 * not delete last-good Geonosis evidence.
 */
export async function harvestUSGSWater(geonosis, {
  bbox = null,
  monitoringLocationIds = null,
  parameterCodes = DEFAULT_WATER_PARAMETERS,
  lookback = 'PT6H',
  includeHistory = true,
  addressFor = null,
  now = Date.now(),
  maxAgeMs = 45 * 60 * 1000,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  trend = {},
} = {}) {
  ensureUSGSWaterSource(geonosis);
  const latestUrl = buildUSGSWaterUrl({ bbox, monitoringLocationIds, parameterCodes });
  let latestCollection;
  try {
    latestCollection = await fetchJSON(latestUrl, { fetchImpl, timeoutMs });
  } catch (error) {
    return { state: 'UNAVAILABLE', error: error.message, latestUrl, rows: [], conditions: [] };
  }

  const latestRows = ingestUSGSWaterCollection(geonosis, latestCollection, { retrievedAt: now, addressFor });
  const freshness = waterFreshness(latestRows, { now, maxAgeMs });
  if (!latestRows.length || !includeHistory) {
    return { state: freshness.state, freshness, latestUrl, rows: latestRows, historyRows: [], conditions: [] };
  }

  const sites = unique(latestRows.map((r) => r.site));
  const historyUrl = buildUSGSWaterUrl({
    collection: USGS_CONTINUOUS_COLLECTION,
    monitoringLocationIds: sites,
    parameterCodes,
    time: lookback,
    limit: 50000,
  });

  let historyRows = [];
  let historyState = 'CURRENT';
  try {
    const historyCollection = await fetchJSON(historyUrl, { fetchImpl, timeoutMs });
    historyRows = ingestUSGSWaterCollection(geonosis, historyCollection, { retrievedAt: now, addressFor });
  } catch (error) {
    historyState = 'UNAVAILABLE';
  }
  const conditions = historyRows.length ? conditionWaterTrends(geonosis, historyRows, trend) : [];
  return {
    state: freshness.state,
    freshness,
    historyState,
    latestUrl,
    historyUrl,
    rows: latestRows,
    historyRows,
    conditions,
  };
}
