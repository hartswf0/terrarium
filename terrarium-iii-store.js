/* TERRARIUM III sidecar loader.
 * The durable store remains byte-for-byte in terrarium-iii-store-core.js.
 * Optional compiler/presentation sidecars must never block persistence OR one
 * another: a presentation failure must not prevent the architecture compiler.
 * Architecture loader stamp: 2026-08-17 collision-proxy pass.
 */
import './terrarium-iii-store-core.js';

const optional = async (src, label) => {
  try { return await import(src); }
  catch (err) { console.warn(`[III ${label}] optional sidecar unavailable`, err); return null; }
};

// Runtime physics policy is independent and should arm as early as possible.
optional('./terrarium-iii-collision-budget.js?v=0.2', 'COLLISION');

// Keep dependency order where useful, but swallow each failure individually so
// V3 + its shared-entry gate always get a chance to install.
(async () => {
  await optional('./terrarium-iii-worldtext.js', 'WORLDTEXT');
  await optional('./terrarium-iii-house-bind.js', 'HOUSE BIND');
  await optional('./terrarium-iii-reference.js', 'REFERENCE');
  await optional('./terrarium-iii-reference-guard.js', 'REFERENCE GUARD');
  await optional('./terrarium-iii-architecture-v3.js?v=3.0.2', 'ARCHITECTURE V3');
  await optional('./terrarium-iii-v3-gate.js?v=0.2', 'V3 GATE');
})();
