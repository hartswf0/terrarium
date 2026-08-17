/* TERRARIUM III · HOUSE BIND
 * PROVISIONAL v0.1
 *
 * Variety engineering, not noun matching:
 *   PASS A  description -> arbitrary expressive FORM
 *   PASS B  FORM SOURCE  -> architectural closure while preserving identity
 *   then the existing FORGE/WG certificate, proposal, commit, multiplayer and
 *   persistence paths remain authoritative.
 *
 * No UI. No rabbitHouse/carrotHouse/castle templates. A small habitation-intent
 * gate decides only WHETHER to bind architectural obligations, never WHAT FORM
 * the request should become.
 */
(function installIIIHouseBind(global){
'use strict';

const VERSION = 'iii-house-bind-0.1-two-pass';
const MAX_PROMPT = 12000;
const MAX_FORM_SOURCE = 30000;
const HABITATION = /\b(house|home|dwelling|habitat|inhabitable|residence|residential|cabin|cottage|villa|lodge|hut|pavilion|building|architecture|architectural|castle|fortress|palace|temple|cathedral|mosque|mausoleum|shrine|pagoda|tower)\b/i;

let installs = 0;
let boundRequests = 0;
let repairs = 0;
let fallbacks = 0;
let lastError = '';
let lastOriginal = '';
let lastFormCode = '';
let lastBoundCode = '';
let lastFormMs = 0;
let lastBindMs = 0;
let timer = 0;

function clean(v, n=MAX_PROMPT){ return String(v == null ? '' : v).trim().slice(0,n); }
function isHabitation(text){ return HABITATION.test(clean(text)); }
function errText(e){ return String(e && e.message || e || 'unknown failure').slice(0,500); }

/* aiForgeDraft chooses a GOLDEN_DRAFTS example synchronously before its first
   await. For HOUSE_BIND's two reasoning passes we temporarily replace only that
   selector during function entry, then immediately restore it. This removes the
   noun/keyword matcher from these passes without mutating the golden library or
   affecting the normal non-house build path. */
function requestWithoutGolden(request, prompt, image, fix){
  const old = global.GOLDEN_DRAFTS;
  let swapped = false;
  if (old && typeof old.pick === 'function') {
    try {
      global.GOLDEN_DRAFTS = Object.assign({}, old, { pick: () => null });
      swapped = true;
    } catch (_) {}
  }
  try { return request(prompt, image, fix); }
  finally { if (swapped) { try { global.GOLDEN_DRAFTS = old; } catch (_) {} } }
}

function formPassPrompt(raw){
  return `ORIGINAL REQUEST:\n${raw}\n\n` +
`HOUSE_BIND · PASS A / FREE FORM\n` +
`Generate the strongest spatial FORM that answers the request. This is intentionally BEFORE architecture. Do not solve "house" by choosing a known house type, floor-plan template, golden example, or keyword match. Do not add generic bedrooms, windows, furniture, porches, gables, or suburban house conventions merely because the request says house.\n\n` +
`The task is morphological imagination: preserve the source idea in topology, silhouette, masses, voids, relative scale, branching, taper, symmetry/asymmetry, posture and spatial rhythm. A rabbit-like request should earn its anatomy from relations; a carrot-like request should earn taper/crown/root relations; an unknown metaphor should invent an equally legible form. These are examples of reasoning, NOT categories or templates.\n\n` +
`Use the existing WG vocabulary and, when useful, the installed general verbs WG.extrude(profile,depth,mat,opts), WG.revolve(profile,mat,opts), WG.loft(sections,mat,opts), WG.sweep(path,section,mat,opts), and WG.repeat(n,fn). Build in LOCAL coordinates near the origin. Prefer compact helpers + data + loops. Preserve meaningful negative space.\n\n` +
`COLLISION DISCIPLINE FOR PASS A: this is a mass/form proposal, not the final physical house. Freeform shell/massing geometry should remain visual rather than becoming giant opaque collision volumes. Do not fill intended courts, holes, undercrofts or passages with broad WG.solid calls. A later architectural pass will derive legal walking/support collision.\n\n` +
`Return exactly the executable build(w,WG,THREE) function required by the standing forge contract. No prose, no markdown.`;
}

function bindPassPrompt(raw, formCode){
  const src = clean(formCode, MAX_FORM_SOURCE);
  return `ORIGINAL REQUEST:\n${raw}\n\n` +
`HOUSE_BIND · PASS B / ARCHITECTURAL CLOSURE\n` +
`Below is PASS A: the actual generated FORM. Treat this source as the protected design substrate. Do NOT identify it by matching it to a known house type. Do NOT throw it away and start over. Do NOT replace it with a rectangle, generic cabin, generic gable, or familiar typology. Read its actual geometry, helpers, dimensions, repetitions, masses and voids.\n\n` +
`PASS A SOURCE:\n---\n${src}\n---\n\n` +
`Rewrite the COMPLETE build(w,WG,THREE) function so that this SAME form becomes inhabitable. The operation is FORM -> ADDRESS -> BIND -> ASSEMBLE. Preserve the dominant topology and silhouette while adding the minimum architectural relationships necessary for habitation. Architecture is a closure over the form, not a second design from scratch.\n\n` +
`SILENT ADDRESS STEP\nInfer addressable regions from the code you were given: major masses, usable horizontal sections, boundaries, ground contacts, existing voids, likely entrances, vertical branches, repeated bays/segments and adjacency. Name/localize these with arrays/records/helpers in the rewritten program if useful. Derive dimensions from the existing form rather than inventing unrelated coordinates.\n\n` +
`UNIVERSAL HOUSE OBLIGATIONS\nBind only what the form needs:\n` +
`1 SUPPORT — occupied surfaces have a legible path to grade.\n` +
`2 SURFACE — at least one genuinely walkable inhabited floor/route lies within or through the form.\n` +
`3 ARRIVAL — grade connects to an entrance by threshold/landing and stair/ramp when required.\n` +
`4 PORTAL — an entrance is a REAL traversable opening/negative space, not a door-colored rectangle pasted onto an opaque collider.\n` +
`5 CIRCULATION — occupied regions that should communicate have a continuous route.\n` +
`6 ENCLOSURE — enough boundary exists to read as shelter without erasing the source form.\n` +
`7 WEATHER EDGE — resolve the upper/weather-facing boundary coherently; do not force a generic gable onto an alien form.\n` +
`8 WATER — where a roof/catchment makes drainage relevant, give water a credible low edge/destination.\n` +
`9 COLLISION — appearance may stay rich; collision must be coarse and must preserve doors, courts, tunnels, undercrofts and other intended negative space.\n\n` +
`ASSEMBLY RULE\nThink like a second-pass assembly system: supports, floor frames, opening frames, thresholds, stairs/ramps, rails, roof bearings and drains should derive from shared form measurements. Use local helper functions and loops. One helper may call another. Spend code on relationships, not repetitive primitive spam.\n\n` +
`IDENTITY INVARIANT\nIf the PASS A form were shown beside the resolved structure, a viewer should recognize them as the same design. Solve architectural defects by binding assemblies to the form, not by escaping into a new topology. Preserve important voids. Thin expressive regions need not become rooms; they may remain light towers, structure, canopy, chimneys, fins, ears, branches or other form-bearing elements as implied by their geometry.\n\n` +
`Use only capabilities allowed by the standing WG contract plus the installed general WorldText verbs. WG.cut(width,height,depth,{w,h,x,y},mat,{x,y,z,ry,solid}) may be used for rectangular compound walls with a REAL aperture. Freeform visual shell geometry and simplified legal collision may be separate representations. Stay inside the standing draft bounds and solid budget.\n\n` +
`Return exactly ONE complete corrected build(w,WG,THREE) function. No explanation, no IR dump, no markdown.`;
}

function repairPassPrompt(raw, code, fix){
  return `ORIGINAL REQUEST:\n${raw}\n\n` +
`HOUSE_BIND · CERTIFICATE REPAIR\n` +
`The already-bound house below failed the standing III certificate. Repair THIS resolved design; do not regenerate PASS A and do not change its topology merely to satisfy the checker.\n\n` +
`CERTIFICATE FAILURE:\n${clean(fix && (fix.err || fix),800)}\n\n` +
`BOUND SOURCE:\n---\n${clean(code,MAX_FORM_SOURCE)}\n---\n\n` +
`Return the complete repaired build(w,WG,THREE) function only. Preserve design identity and intended negative spaces while fixing the concrete certificate failure.`;
}

function underlyingRequest(domain){
  /* WorldText stores the domain it wrapped. Prefer that original aiForgeDraft
     request so HOUSE_BIND can run a genuine form pass instead of nesting the
     old one-shot "form + architecture" WorldText prompt inside itself. */
  const b = domain && domain.__iiiWorldTextBase;
  if (b && typeof b.request === 'function') return b.request;
  return domain && domain.request;
}

function wrapDraft(){
  const engine = global.HELLO_ENGINE;
  const current = engine && engine.domains && engine.domains.draft;
  if (!current || typeof current.request !== 'function' || typeof engine.domain !== 'function') return false;
  if (current.__iiiHouseBindVersion === VERSION) return true;

  /* Wait until the productive language sidecar has had a chance to register.
     HOUSE_BIND can still function without it, but waiting gives both passes the
     executable extrude/revolve/loft/sweep/cut vocabulary. */
  if (global.III_WORLDTEXT && current.__iiiWorldTextVersion !== global.III_WORLDTEXT.version) return false;

  const passThrough = current.request;
  const rawRequest = underlyingRequest(current);
  if (typeof rawRequest !== 'function') return false;
  const wrapped = Object.assign({}, current);
  wrapped.__iiiHouseBindVersion = VERSION;
  wrapped.__iiiHouseBindBase = current;

  wrapped.request = async function iiiHouseBindRequest(text, image, fix){
    const raw = clean(text) || 'a dwelling';
    if (!isHabitation(raw)) return passThrough(text, image, fix);

    boundRequests++;
    lastError = '';
    const t0 = performance.now();

    try {
      /* Repair retries operate on the SAME bound program. This is important:
         a syntax/solid/bounds repair must not silently invent a different house. */
      if (fix && lastBoundCode && lastOriginal === raw) {
        repairs++;
        const rp = repairPassPrompt(raw, lastBoundCode, fix);
        const repaired = await requestWithoutGolden(rawRequest, rp, image, fix);
        if (!clean(repaired)) throw new Error('empty repair reply');
        lastBoundCode = clean(repaired, 40000);
        lastBindMs = performance.now() - t0;
        return repaired;
      }

      const f0 = performance.now();
      const form = await requestWithoutGolden(rawRequest, formPassPrompt(raw), image, null);
      lastFormMs = performance.now() - f0;
      if (!clean(form)) throw new Error('PASS A returned no form code');
      lastFormCode = clean(form, 40000);

      const b0 = performance.now();
      const bound = await requestWithoutGolden(rawRequest, bindPassPrompt(raw, form), image, null);
      lastBindMs = performance.now() - b0;
      if (!clean(bound)) throw new Error('PASS B returned no bound code');

      lastOriginal = raw;
      lastBoundCode = clean(bound, 40000);
      global.__lastHouseBind = {
        version: VERSION,
        prompt: raw,
        formCode: lastFormCode,
        boundCode: lastBoundCode,
        formMs: lastFormMs,
        bindMs: lastBindMs
      };
      return bound;
    } catch (err) {
      lastError = errText(err);
      fallbacks++;
      console.warn('[III HOUSE BIND] two-pass bind failed; falling back to standing draft request', err);
      return await passThrough(raw, image, fix);
    } finally {
      /* aiForgeDraft sees our internal pass prompts; restore the human prompt so
         persistence, provenance, labels and Garage do not store compiler prose. */
      global.__lastDraftPrompt = raw.slice(0, 20000);
    }
  };

  engine.domain('draft', wrapped);
  installs++;
  return true;
}

function install(){ return wrapDraft(); }
function arm(){
  if (install()) return;
  let tries = 0;
  timer = global.setInterval(() => {
    tries++;
    if (install() || tries >= 100) {
      global.clearInterval(timer); timer = 0;
      if (tries >= 100 && !global.HELLO_ENGINE?.domains?.draft?.__iiiHouseBindVersion) {
        lastError = 'draft domain / WorldText layer did not become available';
        console.warn('[III HOUSE BIND] install timed out');
      }
    }
  }, 250);
}

function stats(){
  return {
    version: VERSION,
    installed: global.HELLO_ENGINE?.domains?.draft?.__iiiHouseBindVersion === VERSION,
    installs,
    boundRequests,
    repairs,
    fallbacks,
    lastPrompt: lastOriginal || null,
    lastFormChars: lastFormCode.length,
    lastBoundChars: lastBoundCode.length,
    lastFormMs: Math.round(lastFormMs),
    lastBindMs: Math.round(lastBindMs),
    lastError: lastError || null
  };
}

function last(){
  return lastOriginal ? {
    prompt: lastOriginal,
    formCode: lastFormCode,
    boundCode: lastBoundCode,
    formMs: lastFormMs,
    bindMs: lastBindMs
  } : null;
}

global.III_HOUSE_BIND = Object.freeze({
  version: VERSION,
  install,
  stats,
  last,
  isHabitation,
  formPrompt: (t) => formPassPrompt(clean(t)),
  bindPrompt: (t,code) => bindPassPrompt(clean(t),clean(code,MAX_FORM_SOURCE))
});

arm();
})(window);
