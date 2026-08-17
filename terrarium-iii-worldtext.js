/* TERRARIUM III · PRODUCTIVE WORLDTEXT LANGUAGE
 * PROVISIONAL v0.1.
 *
 * This sidecar changes no renderer, compiler, commit path, multiplayer path or UI.
 * It wraps the existing HELLO_ENGINE world/draft request functions and gives the
 * model a finite compositional language for absorbing unfamiliar descriptions.
 * The existing WG/FORGE runtime remains the only target and the existing domain
 * compile/apply functions remain authoritative.
 */
(function installIIIWorldText(global){
'use strict';

const VERSION = 'iii-worldtext-0.1-productive';
const BASIS = Object.freeze([
  'PROFILE','PATH','FORM','SPACE','VOID','SURFACE','SUPPORT','PORTAL','ANCHOR',
  'EXTRUDE','REVOLVE','SWEEP','LOFT','CUT','JOIN','REPEAT','BRANCH','TRANSFORM'
]);
const RELATIONS = Object.freeze([
  'INSIDE','AROUND','BETWEEN','THROUGH','ABOVE','BELOW','TOUCHING',
  'SUPPORTED_BY','OPEN_TO','CONNECTED_TO','DRAINS_TO'
]);

let installs = 0;
let requests = 0;
let lastRequest = '';
let lastDomain = '';
let lastError = '';
let timer = 0;

function cleanText(v){
  return String(v == null ? '' : v).trim().slice(0, 12000);
}

function productiveBrief(raw, domain){
  const scale = domain === 'world'
    ? 'This request is an ENTIRE PLACE. Preserve the WORLD domain bounds, spawn clearances, atmosphere and route obligations from the standing system contract.'
    : 'This request is ONE LOCAL CONSTRUCTION placed into the existing world. Keep the root local/identity and preserve the DRAFT domain bounds and solid budget from the standing system contract.';

  return `REQUEST: ${raw}\n\nPRODUCTIVE WORLDTEXT COMPILER MODE\n${scale}\n\nTreat the request as an open expression in a finite constructive language, NEVER as a lookup in a catalog of known object types. Unknown nouns, hybrids, metaphors and strange descriptions are not unsupported categories. Translate them into operations and relations using the WG capabilities permitted by the standing system prompt. Do not ask for a new primitive merely because the subject is unfamiliar.\n\nSILENT INTERPRETATION BEFORE CODE\n1. Extract the dominant topology: axis, loop, court, shell, stack, branch, field, procession, bridge, cluster, nested volumes, or another relation derivable from the request.\n2. Decompose the subject into a SMALL graph of masses, voids, paths, supports, openings and repeated relations. Preserve what would make the result recognizable without labels.\n3. If it is inhabitable, derive SPACE + PORTAL + SURFACE + SUPPORT: a real arrival, traversable opening, supported floor/route, circulation, enclosure and weather edge. Never make an inhabited request into a sealed sculpture.\n4. Choose only the constructive verbs actually needed. Think in the basis PROFILE, PATH, EXTRUDE, REVOLVE, SWEEP, LOFT, CUT, JOIN, REPEAT, BRANCH and TRANSFORM. These are CONCEPTUAL operators: lower them using only the WG/THREE capabilities the standing system contract actually allows.\n5. Derive appearance and collision separately. Preserve large negative spaces, doors, passages, courts and undercrofts in the solid decomposition.\n\nLOWERING RULES\n- EXTRUDE = carry a section along an axis/path using repeated or stretched allowed atoms.\n- REVOLVE = organize sections/masses around an axis with rotational repetition.\n- SWEEP = carry a section or assembly along a line/arc/polyline by a loop.\n- LOFT = connect a sequence of changing sections with stepped/tapered allowed masses.\n- CUT = construct AROUND the intended void; never put an opaque collider through a door, gate, court or passage. Generic boolean CSG is not required.\n- REPEAT = loops + shared derived dimensions, not pasted primitive spam.\n- BRANCH = recursive/helper composition from a shared parent relation.\n- TRANSFORM = derive child placement from its parent/axis/path instead of unrelated guessed coordinates.\n\nCODE ECONOMY\nSpend output tokens on reusable local helpers, arrays/records, loops and derived measurements. A helper may call another helper. Prefer a compact generative program that emits many parts over a long list of nearly identical WG calls. Define helpers INSIDE build as required by the standing ABI. Do not output the interpretation, IR, commentary, markdown or TODOs: output only the exact build function demanded by the standing system prompt.\n\nSEMANTIC PRODUCTIVITY\nDo not solve metaphor by decorating a generic box. The source idea must alter topology, silhouette, relative scale, voids, circulation or assembly behavior. Do not special-case the noun by name. If a smooth/organic form cannot be exact with the allowed atoms, approximate its governing relations with repeated low-poly sections while preserving the recognizable topology.\n\nRELATIONAL CHECK BEFORE FINISHING\nEvery major part should have a reason to be where it is: inside/around/between/through/above/below/touching/supported-by/open-to/connected-to/drains-to. For an inhabitable structure, confirm mentally that a route can actually enter and move through it and that collision geometry does not close its intended openings.\n\nNow compile the REQUEST. The standing output contract and WG safety/budget rules remain absolute.`;
}

function wrapDomain(id){
  const engine = global.HELLO_ENGINE;
  const current = engine && engine.domains && engine.domains[id];
  if (!current || typeof current.request !== 'function') return false;
  if (current.__iiiWorldTextVersion === VERSION) return true;

  const base = current;
  const baseRequest = current.request;
  const wrapped = Object.assign({}, current);
  wrapped.__iiiWorldTextVersion = VERSION;
  wrapped.__iiiWorldTextBase = base;
  wrapped.request = async function iiiProductiveRequest(text, image, fix){
    const raw = cleanText(text) || (id === 'world' ? 'a coherent place' : 'a coherent construction');
    const prompt = productiveBrief(raw, id);
    requests++;
    lastRequest = raw;
    lastDomain = id;
    lastError = '';
    try {
      return await baseRequest(prompt, image, fix);
    } catch (err) {
      lastError = String(err && err.message || err || 'request failed');
      throw err;
    } finally {
      if (id === 'draft') global.__lastDraftPrompt = raw.slice(0, 20000);
      if (id === 'world') global.__lastWorldPrompt = raw.slice(0, 20000);
      global.__lastWorldTextRequest = raw;
    }
  };
  engine.domain(id, wrapped);
  installs++;
  return true;
}

function install(){
  const engine = global.HELLO_ENGINE;
  if (!engine || !engine.domains || typeof engine.domain !== 'function') return false;
  const draft = wrapDomain('draft');
  const world = wrapDomain('world');
  if (draft || world) {
    global.dispatchEvent(new CustomEvent('terrarium:worldtext-ready', {
      detail: { version: VERSION, draft, world }
    }));
    return true;
  }
  return false;
}

function arm(){
  if (install()) return;
  let tries = 0;
  timer = global.setInterval(() => {
    tries++;
    if (install() || tries >= 80) {
      global.clearInterval(timer);
      timer = 0;
      if (tries >= 80 && !global.HELLO_ENGINE) {
        lastError = 'HELLO_ENGINE did not become available';
        console.warn('[III WORLDTEXT] install timed out');
      }
    }
  }, 250);
}

function stats(){
  return {
    version: VERSION,
    installs,
    requests,
    lastDomain: lastDomain || null,
    lastRequest: lastRequest || null,
    lastError: lastError || null,
    draft: global.HELLO_ENGINE?.domains?.draft?.__iiiWorldTextVersion === VERSION,
    world: global.HELLO_ENGINE?.domains?.world?.__iiiWorldTextVersion === VERSION
  };
}

global.III_WORLDTEXT = Object.freeze({
  version: VERSION,
  basis: BASIS,
  relations: RELATIONS,
  compilePrompt: (text, domain='draft') => productiveBrief(cleanText(text), domain === 'world' ? 'world' : 'draft'),
  install,
  stats,
  diversityBattery: Object.freeze([
    'a narrow inhabitable stone tower with a stair spiraling upward',
    'a fortified dwelling enclosing a protected court with a real gate',
    'an inhabitable symmetrical marble mausoleum with one dominant dome and four corner towers',
    'a house whose spatial logic is a tapered root with a branching crown',
    'a house whose anatomy has a large body, smaller head, paired tall ears and grounded haunches',
    'a closed ring dwelling around an open rain garden',
    'a landed vessel whose hull has become rooms and whose undercroft remains open',
    'a bridge that is also a dwelling, with occupied rooms suspended beneath the crossing'
  ])
});

arm();
})(window);
