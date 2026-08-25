// GEONOSIS — evidence before world-state.
//
// These records are deliberately NOT Terrarium entities. An external source may
// be visible to the world without being admitted into PLACE. Observation is what
// a source supplied; Signal is a proposition derived from evidence; Condition is
// a temporary state supported by signals. Crossing into the journal is a separate
// explicit operation in retain.js.

export const OBSERVATION_EPISTEMIC = Object.freeze([
  'OBSERVED', 'MEASURED', 'REPORTED', 'IMPORTED',
]);

export const SIGNAL_EPISTEMIC = Object.freeze([
  'OBSERVED', 'MEASURED', 'REPORTED', 'IMPORTED', 'DERIVED', 'INFERRED',
  'DISPUTED', 'CONFIRMED',
]);

export const PAYLOAD_STATE = Object.freeze(['FULL', 'NORMALIZED', 'REFERENCE']);

const OBS_SET = new Set(OBSERVATION_EPISTEMIC);
const SIG_SET = new Set(SIGNAL_EPISTEMIC);
const PAYLOAD_SET = new Set(PAYLOAD_STATE);

function required(value, name) {
  if (value === undefined || value === null || value === '') throw new Error(`Geonosis ${name} is required`);
  return value;
}

function time(value, name, allowNull = true) {
  if (value === undefined || value === null) {
    if (allowNull) return null;
    throw new Error(`Geonosis ${name} is required`);
  }
  const n = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(n)) throw new Error(`Geonosis ${name} is not a time`);
  return n;
}

function confidence(value = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error('Geonosis confidence must be between 0 and 1');
  return n;
}

function jsonCopy(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function list(value) { return Object.freeze([...(value || [])]); }

/** Exactly what an external source told us, with enough provenance to audit it. */
export function makeObservation(props) {
  const epistemic = props.epistemic || 'OBSERVED';
  const payloadState = props.payloadState || 'FULL';
  if (!OBS_SET.has(epistemic)) throw new Error(`invalid observation epistemic state ${epistemic}`);
  if (!PAYLOAD_SET.has(payloadState)) throw new Error(`invalid observation payload state ${payloadState}`);
  return Object.freeze({
    id: String(required(props.id, 'observation id')),
    provider: String(required(props.provider, 'provider')),
    providerRecordId: props.providerRecordId == null ? null : String(props.providerRecordId),
    geometry: jsonCopy(props.geometry),
    observedAt: time(props.observedAt, 'observedAt'),
    retrievedAt: time(props.retrievedAt ?? Date.now(), 'retrievedAt', false),
    rawProperties: jsonCopy(props.rawProperties || {}),
    sourceUrl: props.sourceUrl || null,
    license: props.license || null,
    method: props.method || 'api',
    resolution: jsonCopy(props.resolution),
    freshness: props.freshness || null,
    epistemic,
    payloadState,
    address: list(props.address),
  });
}

/** A contestable proposition supported by one or more observations/signals. */
export function makeSignal(props) {
  const epistemic = props.epistemic || 'DERIVED';
  if (!SIG_SET.has(epistemic)) throw new Error(`invalid signal epistemic state ${epistemic}`);
  return Object.freeze({
    id: String(required(props.id, 'signal id')),
    subject: String(required(props.subject, 'signal subject')),
    predicate: String(required(props.predicate, 'signal predicate')),
    value: jsonCopy(props.value),
    validFrom: time(props.validFrom, 'validFrom'),
    validTo: time(props.validTo, 'validTo'),
    epistemic,
    confidence: confidence(props.confidence),
    derivedFrom: list(props.derivedFrom),
    address: list(props.address),
    relations: list(props.relations),
  });
}

/** A currently active world-state supported by signals, but not yet a deed. */
export function makeCondition(props) {
  const epistemic = props.epistemic || 'DERIVED';
  if (!SIG_SET.has(epistemic)) throw new Error(`invalid condition epistemic state ${epistemic}`);
  const began = time(props.began ?? Date.now(), 'began', false);
  const lastSeen = time(props.lastSeen ?? began, 'lastSeen', false);
  const expiresAt = time(props.expiresAt, 'expiresAt');
  if (expiresAt != null && expiresAt < began) throw new Error('condition cannot expire before it began');
  return Object.freeze({
    id: String(required(props.id, 'condition id')),
    subject: String(required(props.subject, 'condition subject')),
    state: String(required(props.state, 'condition state')),
    began,
    lastSeen,
    strength: confidence(props.strength),
    supportedBy: list(props.supportedBy),
    expiresAt,
    epistemic,
    address: list(props.address),
    props: jsonCopy(props.props || {}),
  });
}

export function conditionAlive(condition, now = Date.now()) {
  return !condition.expiresAt || now <= condition.expiresAt;
}

export function observationEvidence(observation) {
  return {
    kind: 'observation',
    observationId: observation.id,
    provider: observation.provider,
    providerRecordId: observation.providerRecordId,
    observedAt: observation.observedAt,
    retrievedAt: observation.retrievedAt,
    sourceUrl: observation.sourceUrl,
    license: observation.license,
    payloadState: observation.payloadState,
  };
}
