// LIVE WATER — Terrarium can sense hydrology without pretending the gauge IS the creek.
//
// This module is deliberately loaded beside app.js rather than imported into its
// canonical World machinery. It watches which real place is currently open,
// harvests nearby USGS Water observations on a patient clock, and registers one
// conversational BUS verb. No observation is admitted into PLACE here.

import { BUS } from '../core/bus.js';
import { Geonosis } from './geonosis.js';
import { harvestUSGSWater } from './adapters/usgs-water.js';
import { fetchNLDILinkage } from './adapters/usgs-nldi.js';
import { candidateWatercourseRelations } from './watercourse-relations.js';
import { upgradeNLDIMeasuresRelation } from './watercourse-network.js';

export const GEONOSIS = new Geonosis();

const STATE = {
  world: null,
  worldKey: null,
  status: 'IDLE',
  result: null,
  checkedAt: null,
  inFlight: null,
  nextAt: 0,
  error: null,
};

const REFRESH_MS = 15 * 60 * 1000;
const WORLD_WATCH_MS = 2000;
const SEARCH_PAD_M = 12000;

/**
 * Imported Terrarium metadata stores bbox as [south,west,north,east]. USGS OGC
 * expects [west,south,east,north]. Expand it enough to find nearby gauges, but
 * do not describe those gauges as being inside the Terrarium unless they are.
 */
export function worldWaterBBox(world, padM = SEARCH_PAD_M) {
  const b = world?.place?.meta?.bbox;
  if (!Array.isArray(b) || b.length !== 4 || !b.every((x) => Number.isFinite(Number(x)))) return null;
  const [south, west, north, east] = b.map(Number);
  const lat = (south + north) / 2;
  const dLat = Math.max(0, padM) / 111320;
  const dLon = Math.max(0, padM) / (111320 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return [west - dLon, south - dLat, east + dLon, north + dLat];
}

export function pointToLocal(world, geometry) {
  if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;
  const [lon, lat] = geometry.coordinates.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !world?.place?.projection?.toLocal) return null;
  return world.place.projection.toLocal(lat, lon);
}

function currentWorld() {
  try { return globalThis.CREO?.world?.() || null; } catch (_) { return null; }
}

function worldIdentity(world) {
  if (!world) return null;
  const b = world.place?.meta?.bbox;
  return `${world.place?.id || 'place'}|${world.place?.name || ''}|${Array.isArray(b) ? b.join(',') : 'synthetic'}`;
}

function linkageSummary(linkage) {
  return {
    siteId: linkage?.siteId || null,
    state: linkage?.state || 'UNKNOWN',
    siteComid: linkage?.siteComid || null,
    flowlineComid: linkage?.flowlineComid || null,
    comidMatch: !!linkage?.comidMatch,
    error: linkage?.error || null,
  };
}

/**
 * Try to turn local geometry candidates into network-backed `measures` edges.
 * This is deliberately optional and non-fatal: NLDI being unavailable cannot
 * make a valid USGS measurement disappear or become stale. All network evidence
 * is additive and remains in Geonosis.
 */
export async function linkWaterNetwork(result, world, {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 12000,
} = {}) {
  const out = { state: 'NO_CANDIDATE', linkages: [], attempts: [], measures: [] };
  const candidates = result?.relations || [];
  if (!candidates.length) return out;

  const candidateBySubject = new Map();
  for (const relation of candidates) {
    if (relation.kind !== 'candidate_measures') continue;
    if (!candidateBySubject.has(relation.from)) candidateBySubject.set(relation.from, []);
    candidateBySubject.get(relation.from).push(relation);
  }

  // One site can have streamflow and stage series. NLDI is a site/network lookup,
  // so ask it once per subject and let the network gate deduplicate mapped targets.
  const rowsBySubject = new Map();
  for (const row of result?.rows || []) {
    const observation = row?.observation;
    const subject = observation?.rawProperties?.subject;
    if (!subject || !candidateBySubject.has(subject) || rowsBySubject.has(subject)) continue;
    rowsBySubject.set(subject, row);
  }

  for (const [subject, row] of rowsBySubject) {
    const observation = row.observation;
    const siteId = observation.rawProperties?.monitoringLocationId;
    if (!siteId) {
      out.linkages.push({ siteId: null, subject, state: 'NO_SITE_ID' });
      continue;
    }
    const coords = observation.geometry?.type === 'Point' ? observation.geometry.coordinates : null;
    let linkage;
    try {
      linkage = await fetchNLDILinkage(GEONOSIS, {
        siteId, coords, retrievedAt: now, fetchImpl, timeoutMs,
      });
    } catch (error) {
      linkage = { state: 'UNAVAILABLE', siteId, error: String(error?.message || error) };
    }
    out.linkages.push({ subject, ...linkageSummary(linkage) });
    if (linkage.state !== 'LINKED') continue;

    let upgrade;
    try {
      upgrade = upgradeNLDIMeasuresRelation(GEONOSIS, world, observation, linkage, {
        candidates: candidateBySubject.get(subject),
      });
    } catch (error) {
      upgrade = { state: 'ERROR', relation: null, error: String(error?.message || error) };
    }
    out.attempts.push({
      subject, siteId, state: upgrade.state,
      target: upgrade.relation?.to || null,
      relationId: upgrade.relation?.id || null,
      error: upgrade.error || null,
    });
    if (upgrade.relation) out.measures.push(upgrade.relation);
  }

  if (out.measures.length) out.state = 'LINKED';
  else if (out.attempts.some((x) => x.state === 'AMBIGUOUS')) out.state = 'AMBIGUOUS';
  else if (out.linkages.some((x) => x.state === 'NETWORK_MISMATCH')) out.state = 'NETWORK_MISMATCH';
  else if (out.linkages.length && out.linkages.every((x) => ['UNAVAILABLE', 'FLOWLINE_UNAVAILABLE'].includes(x.state))) out.state = 'UNAVAILABLE';
  else if (out.linkages.some((x) => x.state === 'NOT_INDEXED')) out.state = 'NOT_INDEXED';
  else if (out.linkages.length) out.state = 'NO_NETWORK_MATCH';
  return out;
}

/**
 * Refresh the sensed water around one world. This is exported so tests and the
 * browser workbench can invoke it without waiting for the clock.
 */
export async function refreshWater(world = currentWorld(), {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  force = false,
  padM = SEARCH_PAD_M,
  networkLink = true,
} = {}) {
  if (!world) return { state: 'NO_WORLD' };
  const bbox = worldWaterBBox(world, padM);
  if (!bbox) {
    STATE.status = 'NO_REAL_LOCATION';
    STATE.result = { state: 'NO_REAL_LOCATION' };
    STATE.checkedAt = now;
    STATE.nextAt = now + REFRESH_MS;
    return STATE.result;
  }
  if (!force && STATE.inFlight) return STATE.inFlight;
  if (!force && now < STATE.nextAt && STATE.world === world && STATE.result) return STATE.result;

  STATE.world = world;
  STATE.worldKey = worldIdentity(world);
  STATE.status = 'LOADING';
  STATE.error = null;

  const task = harvestUSGSWater(GEONOSIS, {
    bbox,
    now,
    fetchImpl,
    // ICOSA assignment remains the Atlas's job and is deliberately not invented here.
    addressFor: null,
    trend: { relativeThreshold: 0.05, expiresAfterMs: 90 * 60 * 1000 },
  }).then(async (result) => {
    // Geometry may propose a gauge↔mapped-water relation. It may never certify
    // one. The relation type itself remains `candidate_measures` until network
    // evidence independently earns the stronger relation.
    result.relations = [];
    for (const row of result.rows || []) {
      result.relations.push(...candidateWatercourseRelations(GEONOSIS, world, row.observation));
    }

    result.network = networkLink
      ? await linkWaterNetwork(result, world, { now, fetchImpl })
      : { state: 'SKIPPED', linkages: [], attempts: [], measures: [] };
    result.measures = result.network.measures || [];

    STATE.result = result;
    STATE.status = result.state;
    STATE.checkedAt = now;
    STATE.nextAt = now + REFRESH_MS;
    return result;
  }).catch((error) => {
    STATE.status = 'UNAVAILABLE';
    STATE.error = String(error?.message || error);
    STATE.result = { state: 'UNAVAILABLE', error: STATE.error };
    STATE.checkedAt = now;
    STATE.nextAt = now + 60 * 1000;
    return STATE.result;
  }).finally(() => { STATE.inFlight = null; });

  STATE.inFlight = task;
  return task;
}

function fmtValue(signal) {
  const relation = signal.relations?.find((r) => r.kind === 'measured_at');
  const unit = relation?.unit ? ` ${relation.unit}` : '';
  return `${Number(signal.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;
}

function siteName(subject, geonosis) {
  const rows = geonosis.bySubject(subject).observations;
  for (let i = rows.length - 1; i >= 0; i--) {
    const n = rows[i].rawProperties?.monitoringLocationName;
    if (n) return n;
  }
  return subject.replace(/^usgs-water:site:/, 'USGS ');
}

function networkNote(result) {
  const measures = result?.measures || [];
  if (measures.length) {
    return `\n${measures.length} gauge mapping${measures.length === 1 ? ' is' : 's are'} network-linked through USGS NLDI/NHDPlus. This identifies the mapped reach being measured; it still does not classify flood severity, hazard, or actor behavior.`;
  }
  if (!result?.relations?.length) return '';
  const state = result.network?.state;
  const candidate = `\n${result.relations.length} gauge-to-mapped-water alignment${result.relations.length === 1 ? ' is' : 's are'} still candidate relation${result.relations.length === 1 ? '' : 's'}.`;
  if (state === 'AMBIGUOUS') return `${candidate} NLDI found the gauge network, but multiple mapped channels remained plausible, so none was upgraded.`;
  if (state === 'NETWORK_MISMATCH') return `${candidate} NLDI site indexing and hydrolocation disagreed on COMID, so none was upgraded.`;
  if (state === 'UNAVAILABLE') return `${candidate} NLDI network evidence was unavailable, so proximity was not upgraded.`;
  if (state === 'NOT_INDEXED') return `${candidate} The gauge was not indexed in NLDI, so proximity was not upgraded.`;
  return `${candidate} Proximity is not hydrologic causality.`;
}

export function describeWater(result = STATE.result, geonosis = GEONOSIS) {
  if (!result) return 'Water sensing has not answered yet.';
  if (result.state === 'NO_WORLD') return 'There is no Terrarium open yet.';
  if (result.state === 'NO_REAL_LOCATION') return 'This is a synthetic place, so it has no real USGS water neighborhood to ask.';
  if (result.state === 'UNAVAILABLE') return 'USGS Water is unavailable right now. That is not evidence that the water is absent or unchanged.';
  if (result.state === 'NO_GAUGE_COVERAGE') return 'USGS answered, but there are no streamflow or gage-height sensors in the nearby search window. That is not evidence there is no water here.';

  const latest = result.rows || [];
  const bySubject = new Map();
  for (const row of latest) {
    if (!row.signal) continue;
    if (!bySubject.has(row.signal.subject)) bySubject.set(row.signal.subject, []);
    bySubject.get(row.signal.subject).push(row.signal);
  }

  const conditionBySubject = new Map();
  for (const condition of result.conditions || []) {
    if (!conditionBySubject.has(condition.subject)) conditionBySubject.set(condition.subject, []);
    conditionBySubject.get(condition.subject).push(condition);
  }

  const lines = [];
  for (const [subject, signals] of bySubject) {
    const values = signals.map((s) => `${s.predicate.replace(/_/g, ' ')} ${fmtValue(s)}`).join(' · ');
    const trends = (conditionBySubject.get(subject) || []).map((c) => c.state.replace(/_/g, ' ').toLowerCase());
    lines.push(`${siteName(subject, geonosis)} — ${values}${trends.length ? ` · ${trends.join(', ')}` : ''}`);
  }

  const prefix = result.state === 'STALE' ? 'USGS water observations are stale.'
    : result.state === 'PARTIAL_STALE' ? 'Some USGS water observations are stale.'
      : 'USGS water observations are current.';
  if (!lines.length) return `${prefix} The returned measurements did not contain numeric streamflow or gage-height values.`;
  return `${prefix}\n${lines.slice(0, 6).join('\n')}\nTrends are site-relative measurements, not flood-severity claims.${networkNote(result)}`;
}

BUS.register('water-now',
  (lower) => /^(?:water now|what(?:'s| is) the water doing|how(?:'s| is) the water|water status|river now|creek now)\??$/.exec(lower),
  () => {
    // BUS is synchronous by contract. Give an immediate state, then refresh in
    // the background of this browser turn; the next utterance sees the answer.
    // The promise is exposed through GEONOSIS_WATER.refresh for deliberate use.
    const world = currentWorld();
    if (STATE.world !== world || Date.now() >= STATE.nextAt) {
      refreshWater(world).catch(() => {});
      return STATE.result ? `${describeWater(STATE.result)}\nRefreshing now.` : 'Asking USGS Water now. Ask “water now” again when it answers.';
    }
    return describeWater(STATE.result);
  },
  'water now — current nearby USGS streamflow/gage observations; absence and stale data remain explicit');

function watchWorld() {
  const world = currentWorld();
  const key = worldIdentity(world);
  if (world && key !== STATE.worldKey) {
    STATE.world = world;
    STATE.worldKey = key;
    STATE.nextAt = 0;
    // Do not block boot. Real-place awareness arrives beside the world.
    refreshWater(world, { force: true }).catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  window.GEONOSIS = GEONOSIS;
  window.GEONOSIS_WATER = {
    STATE, refresh: refreshWater, linkNetwork: linkWaterNetwork,
    describe: describeWater, bbox: worldWaterBBox, pointToLocal,
  };
  setInterval(watchWorld, WORLD_WATCH_MS);
  setTimeout(watchWorld, 250);
}
