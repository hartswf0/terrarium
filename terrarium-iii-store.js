/* TERRARIUM III sidecar loader.
 * The durable store remains byte-for-byte in terrarium-iii-store-core.js.
 * Optional compiler/presentation sidecars must never block persistence.
 */
import './terrarium-iii-store-core.js';
import('./terrarium-iii-worldtext.js')
  .then(() => import('./terrarium-iii-house-bind.js'))
  .then(() => import('./terrarium-iii-reference.js'))
  .catch(err => console.warn('[III COMPILER] optional sidecar unavailable', err));
