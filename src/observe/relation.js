// RELATION — evidence-backed edges between things Geonosis knows about or can name.
//
// Endpoints are identifiers, not proof. A relation earns its authority from
// epistemic state, confidence, evidence and basis. This lets Geonosis relate a
// source subject to a Terrarium entity without importing that entity into a
// second world model.

const EPISTEMIC = new Set([
  'OBSERVED', 'MEASURED', 'REPORTED', 'IMPORTED', 'DERIVED', 'INFERRED',
  'DISPUTED', 'CONFIRMED',
]);

function required(value, name) {
  if (value === undefined || value === null || value === '') throw new Error(`Geonosis relation ${name} is required`);
  return String(value);
}

function time(value, name) {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(n)) throw new Error(`Geonosis relation ${name} is not a time`);
  return n;
}

function confidence(value = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error('Geonosis relation confidence must be between 0 and 1');
  return n;
}

function copy(value) { return value == null ? {} : JSON.parse(JSON.stringify(value)); }
function list(value) { return Object.freeze([...(value || [])]); }

export function makeRelation(props) {
  const epistemic = props.epistemic || 'INFERRED';
  if (!EPISTEMIC.has(epistemic)) throw new Error(`invalid relation epistemic state ${epistemic}`);
  const validFrom = time(props.validFrom, 'validFrom');
  const validTo = time(props.validTo, 'validTo');
  if (validFrom != null && validTo != null && validTo < validFrom) {
    throw new Error('Geonosis relation cannot end before it begins');
  }
  const derivedFrom = list(props.derivedFrom);
  if (!derivedFrom.length) throw new Error('Geonosis relation requires evidence');
  const basis = list(props.basis);
  if (!basis.length) throw new Error('Geonosis relation requires a declared basis');
  return Object.freeze({
    id: required(props.id, 'id'),
    from: required(props.from, 'from'),
    kind: required(props.kind, 'kind'),
    to: required(props.to, 'to'),
    epistemic,
    confidence: confidence(props.confidence),
    derivedFrom,
    basis,
    validFrom,
    validTo,
    address: list(props.address),
    props: copy(props.props),
  });
}
