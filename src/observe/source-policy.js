// SOURCE POLICY — access is not permission.
//
// Geonosis separates how a source is acquired from what Terrarium may retain.
// A keyless endpoint is not automatically mirrorable; a credentialed source is
// not automatically forbidden. Adapters must declare both dimensions.

export const ACQUISITION = Object.freeze(['LIVE', 'BULK', 'OPTIONAL_CREDENTIAL']);
export const RETENTION = Object.freeze(['EPHEMERAL', 'SNAPSHOT', 'MIRROR', 'REFERENCE']);

const ACQ = new Set(ACQUISITION);
const RET = new Set(RETENTION);

export function makeSourcePolicy(props) {
  const acquisition = props.acquisition || 'LIVE';
  const retention = props.retention || 'EPHEMERAL';
  if (!ACQ.has(acquisition)) throw new Error(`invalid acquisition policy ${acquisition}`);
  if (!RET.has(retention)) throw new Error(`invalid retention policy ${retention}`);
  if (!props.id) throw new Error('source policy id is required');
  return Object.freeze({
    id: String(props.id),
    name: props.name || String(props.id),
    acquisition,
    retention,
    keyRequired: !!props.keyRequired,
    license: props.license || null,
    attribution: props.attribution || null,
    sourceUrl: props.sourceUrl || null,
    mayRedistribute: props.mayRedistribute === true,
    mayDerive: props.mayDerive !== false,
    cacheTtlMs: Number.isFinite(props.cacheTtlMs) ? Math.max(0, props.cacheTtlMs) : null,
    notes: props.notes || null,
  });
}

/** What bytes, if any, may cross from the network into durable Geonosis storage. */
export function retentionDecision(policy) {
  switch (policy.retention) {
    case 'EPHEMERAL':
      return { persistRaw: false, persistNormalized: false, keepReference: true };
    case 'SNAPSHOT':
      return { persistRaw: false, persistNormalized: true, keepReference: true };
    case 'MIRROR':
      return { persistRaw: true, persistNormalized: true, keepReference: true };
    case 'REFERENCE':
      return { persistRaw: false, persistNormalized: false, keepReference: true };
    default:
      throw new Error(`unknown retention policy ${policy.retention}`);
  }
}

export function sourceAvailable(policy, credentials = {}) {
  if (!policy.keyRequired) return true;
  return !!credentials[policy.id];
}
