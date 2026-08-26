// RETAIN — the membrane between seeing and committing.
//
// External observations do not enter PLACE by being fetched. Admission is an
// explicit authored deed, and only source policies that permit normalized
// persistence may carry source-derived geometry across this boundary.

import { observationEvidence } from './model.js';
import { retentionDecision } from './source-policy.js';

export function admitObservation(world, geonosis, observationId, opts = {}) {
  if (!world?.addEntity) throw new Error('admission requires a Terrarium World');
  const observation = geonosis?.observations?.get(observationId);
  if (!observation) throw new Error(`no Geonosis observation ${observationId}`);
  const policy = geonosis.sources.get(observation.provider);
  if (!policy) throw new Error(`no source policy for ${observation.provider}`);
  const decision = retentionDecision(policy);
  if (!decision.persistNormalized) {
    throw new Error(`source ${policy.id} is ${policy.retention}; retain testimony/reference, not its observation payload`);
  }
  if (typeof opts.localize !== 'function') {
    throw new Error('admission requires an explicit localize(observation, world) function');
  }

  const spatial = opts.localize(observation, world);
  if (!spatial || typeof spatial !== 'object') throw new Error('localizer returned no Terrarium geometry');
  if (!spatial.footprint && !spatial.path) {
    throw new Error('localizer must return a footprint or path in Terrarium metres');
  }

  const author = opts.author || 'observer';
  const extra = opts.entity || {};
  const evidence = [...(extra.evidence || []), observationEvidence(observation)];
  const props = {
    ...(extra.props || {}),
    geonosis: {
      observationId: observation.id,
      provider: observation.provider,
      providerRecordId: observation.providerRecordId,
    },
  };

  return world.addEntity({
    ...extra,
    ...spatial,
    type: spatial.type || extra.type || 'observation',
    name: spatial.name || extra.name || null,
    epistemic: extra.epistemic || 'OBSERVED',
    certainty: extra.certainty ?? 1,
    source: extra.source || observation.provider,
    author,
    evidence,
    props,
  }, {
    author,
    label: opts.label || `retain ${observation.provider} observation`,
  });
}
