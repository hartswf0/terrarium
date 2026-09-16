// WATERCOURSE RELATIONS — proximity proposes; it never certifies hydrology.
//
// A USGS gauge can be localized into Terrarium metres and compared with imported
// OSM hydrography. The result is a CANDIDATE relation only. It cannot drive the
// flood simulator or an actor interpretant until stronger evidence upgrades the
// relation elsewhere.

import * as G from '../core/geom.js';

function pointLocal(world, observation) {
  const geom = observation?.geometry;
  if (geom?.type !== 'Point' || !Array.isArray(geom.coordinates)) return null;
  const [lon, lat] = geom.coordinates.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !world?.place?.projection?.toLocal) return null;
  return world.place.projection.toLocal(lat, lon);
}

function hydroEntity(entity) {
  return entity && (
    entity.network === 'drainage'
    || entity.type === 'water'
    || entity.type === 'drain'
    || ['river', 'stream', 'canal', 'drain', 'ditch', 'brook', 'channel', 'reservoir', 'lake'].includes(entity.subtype)
  );
}

function distanceToEntity(point, entity) {
  if (entity.path?.length >= 2) return G.closestOnRing(point, entity.path, false).d;
  if (entity.footprint?.length >= 3) {
    if (G.pointInRing(point, entity.footprint)) return 0;
    return G.closestOnRing(point, entity.footprint, true).d;
  }
  return Infinity;
}

function normName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nameMatch(observation, entity) {
  const site = normName(observation.rawProperties?.monitoringLocationName);
  const name = normName(entity.name);
  return name.length >= 4 && (site.includes(name) || name.includes(site));
}

function proximityConfidence(distanceM, matchedName) {
  let c = distanceM <= 10 ? 0.95
    : distanceM <= 30 ? 0.85
      : distanceM <= 100 ? 0.65
        : distanceM <= 250 ? 0.45 : 0;
  if (matchedName) c = Math.min(0.98, c + 0.05);
  return c;
}

/**
 * Return and store ranked CANDIDATE gauge→Terrarium-water relations.
 * `maxDistanceM` is a candidate-search radius, never a statement that the gauge
 * measures that feature. The relation itself carries that warning.
 */
export function candidateWatercourseRelations(geonosis, world, observationOrId, {
  maxDistanceM = 250,
  limit = 3,
} = {}) {
  const observation = typeof observationOrId === 'string'
    ? geonosis.observations.get(observationOrId)
    : observationOrId;
  if (!observation) throw new Error('candidateWatercourseRelations needs an existing observation');
  const point = pointLocal(world, observation);
  if (!point) return [];

  const subject = observation.rawProperties?.subject || observation.providerRecordId || observation.id;
  const candidates = [];
  for (const entity of world?.entities?.() || []) {
    if (!hydroEntity(entity)) continue;
    const distanceM = distanceToEntity(point, entity);
    if (!Number.isFinite(distanceM) || distanceM > maxDistanceM) continue;
    const matchedName = nameMatch(observation, entity);
    candidates.push({ entity, distanceM, matchedName, confidence: proximityConfidence(distanceM, matchedName) });
  }
  candidates.sort((a, b) => b.confidence - a.confidence || a.distanceM - b.distanceM);

  return candidates.slice(0, Math.max(1, limit)).map(({ entity, distanceM, matchedName, confidence }) => {
    const target = `terrarium:${world.place?.id || 'place'}:${entity.id}`;
    return geonosis.relate({
      id: `relation:${observation.id}:candidate_measures:${entity.id}`,
      from: String(subject),
      kind: 'candidate_measures',
      to: target,
      epistemic: 'INFERRED',
      confidence,
      derivedFrom: [observation.id],
      basis: [{ kind: 'geometry_proximity', distanceM: +distanceM.toFixed(2), nameMatch: matchedName }],
      validFrom: observation.observedAt,
      address: observation.address,
      props: {
        status: 'CANDIDATE',
        terrariumEntityId: entity.id,
        terrariumWorldId: world.place?.id || null,
        entityType: entity.type,
        entitySubtype: entity.subtype || null,
        entityName: entity.name || null,
        warning: 'spatial proximity is not hydrologic causality; this relation cannot drive simulation or actor risk by itself',
      },
    });
  });
}
