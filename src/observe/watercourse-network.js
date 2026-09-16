// WATERCOURSE NETWORK — evidence can upgrade proximity, but only through a gate.
//
// candidate_measures says "this gauge is near this mapped water". NLDI adds a
// different fact: an NWIS site is indexed to a particular NHDPlusV2 reach. We
// emit `measures` only when the NLDI site and hydrolocation agree on COMID AND
// the Terrarium OSM path geometrically aligns with that NHD reach. Ambiguity is
// a result, not an invitation to pick the nearest line.

import * as G from '../core/geom.js';

function candidateDistance(relation) {
  const b = (relation?.basis || []).find((x) => x?.kind === 'geometry_proximity');
  return Number.isFinite(Number(b?.distanceM)) ? Number(b.distanceM) : Infinity;
}

function candidateNameMatch(relation) {
  const b = (relation?.basis || []).find((x) => x?.kind === 'geometry_proximity');
  return !!b?.nameMatch;
}

function entityById(world, id) {
  if (!id) return null;
  if (typeof world?.get === 'function') return world.get(id) || null;
  return (world?.entities?.() || []).find((e) => e.id === id) || null;
}

function geometryLines(geometry) {
  if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) return [geometry.coordinates];
  if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) return geometry.coordinates;
  return [];
}

function localizeLine(world, coordinates) {
  if (!world?.place?.projection?.toLocal) return [];
  const out = [];
  for (const pair of coordinates || []) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = Number(pair[0]), lat = Number(pair[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    out.push(world.place.projection.toLocal(lat, lon));
  }
  return out.length >= 2 ? out : [];
}

function samplePath(path, targetSamples = 48) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const segs = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = G.dist(path[i], path[i + 1]);
    if (d <= 0) continue;
    segs.push({ i, d, start: total, end: total + d });
    total += d;
  }
  if (!segs.length) return [path[0]];
  const n = Math.max(2, Math.min(96, targetSamples, Math.ceil(total / 8) + 1));
  const out = [];
  for (let k = 0; k < n; k++) {
    const at = total * (k / (n - 1));
    const seg = segs.find((s) => at <= s.end) || segs.at(-1);
    const t = seg.d ? Math.max(0, Math.min(1, (at - seg.start) / seg.d)) : 0;
    out.push(G.lerp2(path[seg.i], path[seg.i + 1], t));
  }
  return out;
}

function nearestToLines(point, lines) {
  let d = Infinity;
  for (const line of lines) {
    if (line.length < 2) continue;
    d = Math.min(d, G.closestOnRing(point, line, false).d);
  }
  return d;
}

/**
 * Compare a local Terrarium path with the NHD flowline geometry returned by
 * NLDI. Sampling the OSM path (rather than the whole NHD reach) avoids punishing
 * a small Terrarium window for not containing kilometres of upstream geometry.
 */
export function nhdAlignment(world, entity, flowlineGeometry, {
  thresholdM = 35,
} = {}) {
  if (!entity?.path?.length || entity.path.length < 2) return null;
  const lines = geometryLines(flowlineGeometry)
    .map((line) => localizeLine(world, line))
    .filter((line) => line.length >= 2);
  if (!lines.length) return null;
  const samples = samplePath(entity.path);
  const distances = samples.map((p) => nearestToLines(p, lines)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!distances.length) return null;
  const at = (q) => distances[Math.min(distances.length - 1, Math.floor((distances.length - 1) * q))];
  const within = distances.filter((d) => d <= thresholdM).length;
  return {
    samples: distances.length,
    medianM: at(0.5),
    p90M: at(0.9),
    maxM: distances.at(-1),
    coverageFraction: within / distances.length,
    thresholdM,
  };
}

function evaluateCandidate(world, candidate, linkage, opts) {
  const entity = entityById(world, candidate.props?.terrariumEntityId);
  if (!entity?.path?.length) return null;
  const alignment = nhdAlignment(world, entity, linkage.flowlineObservation?.geometry, {
    thresholdM: opts.maxAlignmentM,
  });
  if (!alignment) return null;
  const distanceM = candidateDistance(candidate);
  const nameMatch = candidateNameMatch(candidate);
  const alignmentStrength = Math.max(0, 1 - alignment.medianM / Math.max(1, opts.maxAlignmentM));
  const score = candidate.confidence * 0.42
    + alignmentStrength * 0.36
    + alignment.coverageFraction * 0.17
    + (nameMatch ? 0.05 : 0);
  const eligible = candidate.confidence >= opts.minCandidateConfidence
    && distanceM <= opts.maxGaugeDistanceM
    && alignment.medianM <= opts.maxAlignmentM
    && alignment.coverageFraction >= opts.minCoverageFraction;
  return { candidate, entity, alignment, distanceM, nameMatch, score, eligible };
}

/**
 * One NWIS site often publishes several parameter series at the same instant.
 * Each measurement observation may create a candidate edge to the same OSM
 * target. That is repeated evidence, not spatial ambiguity, so collapse by
 * relation target before deciding whether two different mapped channels compete.
 */
function uniqueCandidates(pool) {
  const byTarget = new Map();
  for (const candidate of pool || []) {
    const key = candidate.to || candidate.props?.terrariumEntityId || candidate.id;
    const prev = byTarget.get(key);
    if (!prev || candidate.confidence > prev.confidence
        || (candidate.confidence === prev.confidence && candidateDistance(candidate) < candidateDistance(prev))) {
      byTarget.set(key, candidate);
    }
  }
  return [...byTarget.values()];
}

/**
 * Upgrade one site's candidate relation to `measures` only when:
 *   1. NLDI itself has a coherent site↔flowline linkage (matching COMID),
 *   2. the OSM candidate is close to the gauge,
 *   3. the mapped OSM path aligns with the NHD flowline, and
 *   4. no equally plausible OSM candidate remains unresolved.
 *
 * The result is DERIVED rather than CONFIRMED: the USGS network link is
 * authoritative, but the target is still an OSM representation of the reach.
 */
export function upgradeNLDIMeasuresRelation(geonosis, world, measurementObservation, linkage, {
  candidates = null,
  maxAlignmentM = 35,
  maxGaugeDistanceM = 60,
  minCoverageFraction = 0.72,
  minCandidateConfidence = 0.65,
  ambiguityMargin = 0.08,
} = {}) {
  if (!measurementObservation) throw new Error('upgradeNLDIMeasuresRelation needs measurement evidence');
  if (!linkage || linkage.state !== 'LINKED' || !linkage.comidMatch) {
    return { state: linkage?.state || 'NO_LINKAGE', relation: null, evaluated: [] };
  }
  const subject = measurementObservation.rawProperties?.subject
    || measurementObservation.providerRecordId
    || measurementObservation.id;
  const rawPool = candidates || [...geonosis.relations.values()].filter((r) =>
    r.kind === 'candidate_measures' && r.from === subject
  );
  const pool = uniqueCandidates(rawPool);
  if (!pool.length) return { state: 'NO_CANDIDATE', relation: null, evaluated: [] };

  const opts = {
    maxAlignmentM, maxGaugeDistanceM, minCoverageFraction,
    minCandidateConfidence, ambiguityMargin,
  };
  const evaluated = pool.map((candidate) => evaluateCandidate(world, candidate, linkage, opts)).filter(Boolean);
  const eligible = evaluated.filter((x) => x.eligible).sort((a, b) => b.score - a.score);
  if (!eligible.length) return { state: 'NO_NETWORK_MATCH', relation: null, evaluated };

  const winner = eligible[0];
  const runner = eligible[1] || null;
  const uniquelyNamed = winner.nameMatch && !runner?.nameMatch;
  if (runner && !uniquelyNamed && winner.score - runner.score < ambiguityMargin) {
    return { state: 'AMBIGUOUS', relation: null, evaluated };
  }

  const site = linkage.siteObservation?.rawProperties || {};
  const confidence = Math.min(0.99, 0.72 + winner.score * 0.25);
  const relation = geonosis.relate({
    id: `relation:${subject}:measures:${winner.entity.id}:${linkage.siteComid}`,
    from: String(subject),
    kind: 'measures',
    to: winner.candidate.to,
    epistemic: 'DERIVED',
    confidence,
    derivedFrom: [
      winner.candidate.id,
      linkage.siteObservation.id,
      linkage.flowlineObservation.id,
    ],
    basis: [
      {
        kind: 'nldi_network_index',
        featureSource: 'nwissite',
        siteId: linkage.siteId,
        comid: linkage.siteComid,
        reachcode: site.reachcode || null,
        measure: site.measure ?? null,
      },
      {
        kind: 'comid_agreement',
        siteComid: linkage.siteComid,
        hydrolocationComid: linkage.flowlineComid,
      },
      {
        kind: 'nhd_osm_alignment',
        medianM: +winner.alignment.medianM.toFixed(2),
        p90M: +winner.alignment.p90M.toFixed(2),
        coverageFraction: +winner.alignment.coverageFraction.toFixed(3),
        thresholdM: maxAlignmentM,
      },
      {
        kind: 'gauge_osm_proximity',
        distanceM: +winner.distanceM.toFixed(2),
        nameMatch: winner.nameMatch,
      },
    ],
    validFrom: measurementObservation.observedAt,
    address: measurementObservation.address,
    props: {
      status: 'NETWORK_LINKED',
      terrariumEntityId: winner.entity.id,
      terrariumWorldId: world.place?.id || null,
      entityName: winner.entity.name || null,
      entitySubtype: winner.entity.subtype || null,
      nldiComid: linkage.siteComid,
      reachcode: site.reachcode || null,
      warning: 'USGS/NLDI links this gage to an NHDPlus reach and the mapped OSM path aligns with that reach; this licenses a measurement relation to the mapped segment, not flood severity, hazard, or actor behavior',
    },
  });
  return { state: 'MEASURES', relation, winner, evaluated };
}
