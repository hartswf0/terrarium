// INTERPRET — one condition, different worlds for different actors.
//
// An interpretant is licensed by a RELATION, not by a type label alone. A gauge
// near a dog is not automatically perceptible to the dog; a civic system does
// not automatically govern every stream. Callers must declare the basis that
// makes the condition consequential for this actor.

export const INTERPRETANT_BASES = Object.freeze([
  'perceivable', 'affects', 'usedBy', 'governs', 'serves', 'dependsOn', 'inside', 'crosses',
]);
const BASIS_SET = new Set(INTERPRETANT_BASES);

const WATER_RULES = Object.freeze({
  DOG: Object.freeze({
    FLOW_RISING: { sign: 'water_motion_salience', value: 'rising_flow', valence: 0 },
    FLOW_FALLING: { sign: 'water_motion_salience', value: 'falling_flow', valence: 0 },
    STAGE_RISING: { sign: 'water_edge_change', value: 'rising_stage', valence: 0 },
    STAGE_FALLING: { sign: 'water_edge_change', value: 'falling_stage', valence: 0 },
  }),
  HUMAN: Object.freeze({
    FLOW_RISING: { sign: 'water_change_attention', value: 'rising_flow', valence: 0 },
    FLOW_FALLING: { sign: 'water_change_attention', value: 'falling_flow', valence: 0 },
    STAGE_RISING: { sign: 'water_level_attention', value: 'rising_stage', valence: 0 },
    STAGE_FALLING: { sign: 'water_level_attention', value: 'falling_stage', valence: 0 },
  }),
  CIVIC: Object.freeze({
    FLOW_RISING: { sign: 'hydrologic_change_attention', value: 'rising_flow', valence: 0 },
    FLOW_FALLING: { sign: 'hydrologic_change_attention', value: 'falling_flow', valence: 0 },
    STAGE_RISING: { sign: 'hydrologic_change_attention', value: 'rising_stage', valence: 0 },
    STAGE_FALLING: { sign: 'hydrologic_change_attention', value: 'falling_stage', valence: 0 },
  }),
});

function normalizeBasis(basis) {
  const list = Array.isArray(basis) ? basis : basis ? [basis] : [];
  return list.map((b) => typeof b === 'string' ? { kind: b } : { ...b })
    .filter((b) => BASIS_SET.has(b.kind));
}

/**
 * Derive a single cautious actor-specific reading from one current condition.
 * Unknown actor/state combinations simply return null. This is a rule floor,
 * not an LLM invitation to improvise a meaning.
 */
export function interpretCondition(geonosis, conditionOrId, {
  actor,
  actorKind = 'ACTOR',
  basis = [],
  now = Date.now(),
} = {}) {
  const condition = typeof conditionOrId === 'string'
    ? geonosis.conditions.get(conditionOrId)
    : conditionOrId;
  if (!condition) throw new Error('interpretCondition needs an existing condition');
  const relations = normalizeBasis(basis);
  if (!relations.length) return null;

  const kind = String(actorKind || 'ACTOR').toUpperCase();
  const rule = WATER_RULES[kind]?.[condition.state];
  if (!rule) return null;

  // A consequence cannot outlive the condition that licensed it.
  const expiresAt = condition.expiresAt ?? null;
  const id = `interpretant:${String(actor)}:${condition.id}:${rule.sign}`;
  return geonosis.interpret({
    id,
    actor,
    actorKind: kind,
    subject: condition.subject,
    sign: rule.sign,
    value: rule.value,
    valence: rule.valence,
    strength: condition.strength,
    epistemic: 'INFERRED',
    derivedFrom: [condition.id],
    basis: relations,
    validFrom: Math.max(now, condition.began || now),
    expiresAt,
    address: condition.address,
    props: {
      condition: condition.state,
      rule: 'water-attention-v1',
      restraint: 'attention/salience only; no safety or behavioral claim without further relations',
    },
  });
}

/** One condition may be interpreted independently for several actors. */
export function interpretForActors(geonosis, conditionOrId, actors, opts = {}) {
  const made = [];
  for (const actor of actors || []) {
    const result = interpretCondition(geonosis, conditionOrId, { ...opts, ...actor });
    if (result) made.push(result);
  }
  return made;
}
