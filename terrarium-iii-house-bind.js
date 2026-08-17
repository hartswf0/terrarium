/* TERRARIUM III · HOUSE BIND / VISUAL CRITIC LOOP
 * PROVISIONAL v0.3
 *
 * A house is no longer considered finished because the source code looks
 * plausible. III compiles the current candidate in isolation, photographs the
 * rendered consequence from canonical architectural views, gives that image
 * back to the multimodal forge model, and asks it to repair the SAME program.
 *
 * MAKE -> COMPILE -> SEE -> CRITIQUE+REPAIR -> REPEAT -> existing FORGE cert.
 *
 * Architectural complexity and physics complexity are deliberately separate:
 * rich visible construction may use hundreds of meshes; collision is a small
 * proxy model of the walkable/supporting envelope.
 *
 * No new permanent UI. Progress temporarily occupies the existing proposal
 * strip; the final standing draft/apply path remains authoritative.
 */
(function installIIIHouseBind(global){
'use strict';

const VERSION = 'iii-house-bind-0.3-collision-split';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const MAX_PROMPT = 16000;
const MAX_SOURCE = 48000;
const HABITATION = /\b(house|home|dwelling|habitat|inhabitable|residence|residential|cabin|cottage|villa|lodge|hut|pavilion|building|architecture|architectural|castle|fortress|palace|temple|cathedral|mosque|mausoleum|shrine|pagoda|tower)\b/i;

let installs = 0;
let requests = 0;
let repairs = 0;
let fallbacks = 0;
let loopPasses = 4;
let lastError = '';
let lastPrompt = '';
let lastCode = '';
let lastBestScore = 0;
let lastWorst = '';
let lastLoopMs = 0;
let timer = 0;
let threePromise = null;
let renderer = null;
let workingTicker = 0;
let workingDots = 0;

function clean(v,n=MAX_PROMPT){ return String(v == null ? '' : v).trim().slice(0,n); }
function isHabitation(text){ return HABITATION.test(clean(text)); }
function errText(e){ return String(e && e.message || e || 'unknown failure').slice(0,600); }
function clamp(v,lo,hi){ v=Number(v); return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):lo; }
function round(v,n=1){ const p=10**n; return Math.round(Number(v||0)*p)/p; }

function getTHREE(){
  if(!threePromise) threePromise = import(THREE_URL);
  return threePromise;
}

/* aiForgeDraft chooses a GOLDEN_DRAFTS example synchronously before its first
   await. Visual house work deliberately disables that noun matcher: the image,
   current source and request are the evidence, not the nearest canned example. */
function requestWithoutGolden(request,prompt,image,fix){
  const old=global.GOLDEN_DRAFTS;
  let swapped=false;
  if(old&&typeof old.pick==='function'){
    try{ global.GOLDEN_DRAFTS=Object.assign({},old,{pick:()=>null}); swapped=true; }catch(_){ }
  }
  try{ return request(prompt,image,fix); }
  finally{ if(swapped){ try{ global.GOLDEN_DRAFTS=old; }catch(_){ } } }
}

function setProposalBusy(on){
  const ui=document.getElementById('proposal-ui');
  if(ui&&on) ui.classList.remove('gone');
  const buttons=[document.getElementById('btn-draft-reject'),document.getElementById('btn-draft-commit')];
  buttons.forEach(b=>{ if(!b)return; b.disabled=!!on; b.style.opacity=on?'.28':''; b.style.pointerEvents=on?'none':''; });
}
function setTitle(text){
  const t=document.getElementById('prop-title');
  if(t) t.textContent=String(text||'').toUpperCase();
}
function stopTicker(){ if(workingTicker){ clearInterval(workingTicker); workingTicker=0; } workingDots=0; }
function stage(name,pass,total,detail){
  const info={ version:VERSION, state:name, pass:pass||0, total:total||loopPasses, detail:detail||'', at:Date.now() };
  global.__houseLoopState=info;
  try{ document.dispatchEvent(new CustomEvent('iii-house-loop',{detail:info})); }catch(_){ }
  setProposalBusy(name!=='COMPLETE'&&name!=='FAULT'&&name!=='IDLE');
  stopTicker();
  const base=(pass?`PASS ${pass}/${total||loopPasses} · `:'')+name+(detail?` · ${detail}`:'');
  setTitle(base);
  if(name!=='COMPLETE'&&name!=='FAULT'&&name!=='IDLE'){
    workingTicker=setInterval(()=>{ workingDots=(workingDots+1)%4; setTitle(base+'.'.repeat(workingDots)); },420);
  }
}

const COLLISION_CONTRACT = `PHYSICS / VISUAL CONTRACT:\n`+
`- 120 is NOT a building-part limit. It is only the emergency ceiling for collision bodies.\n`+
`- Build the VISIBLE architecture first. Hundreds of visible meshes are allowed; target <=480 visible meshes.\n`+
`- Visible geometry is NON-COLLIDING by default. Never put WG.solid inside a generic visual add()/place() helper and never pass a true/solid flag on every repeated architectural part.\n`+
`- Then build a SECOND, coarse collision pass. Target roughly 24-80 collision bodies; never exceed 120.\n`+
`- Use WG.solid only for broad floor slabs, major wall runs, essential supports, stairs/landings and other bodily barriers. Roof tiles, fascia, rafters, rails, trim, panes, furniture, decorative panels, repeated cladding and small struts are visual-only unless collision is genuinely needed.\n`+
`- WG.surface ALSO registers collision. Use it sparingly for actual walkable proxy surfaces, not to label every visible floor or roof piece.\n`+
`- If using visual meshes made with WG.box/cyl/etc, put them under a visual THREE.Group and/or mark mesh.userData._wgVisual=true so the legacy harvest pass does not promote them into physics.\n`+
`- A certificate collision failure must be repaired by COARSENING COLLISION ONLY. Preserve the visible architecture.\n`;

function initialPrompt(raw){
  return `ORIGINAL REQUEST:\n${raw}\n\n`+
`HOUSE LOOP · INITIAL BUILD\n`+
`Build the requested structure as one coherent, inhabitable local WG construction. Do not match the noun to a known golden/template. Treat unfamiliar forms compositionally. The structure must preserve the request's governing morphology and negative spaces while also having believable human scale, a route from grade through a real opening, usable walking surfaces, support, enclosure/weather logic and coarse collision that does not seal passages.\n\n`+
COLLISION_CONTRACT+`\n`+
`GEOMETRY DISCIPLINE:\n`+
`- Do not begin a house by dropping a generic WG.deck/platform under it. Floors and foundations must follow the requested topology.\n`+
`- Do not add vehicle ramps, arena apparatus, beacons, glowing mascots, animated ornaments or gameplay machinery unless the request actually asks for them.\n`+
`- A ring/court/oculus is a real negative space. WG.cyl creates a FILLED cylinder/disc; it cannot be used as an oculus rim or annular roof because it closes the hole. Use WG.torus, segmented ring geometry, or deterministic THREE.BufferGeometry for annular forms.\n`+
`- Doors/windows are actual openings in wall geometry and collision, not dark rectangles pasted on a wall.\n`+
`- Shared dimensions, loops and local helpers should generate repeated architecture so a complex building does not require hundreds of handwritten calls.\n\n`+
`This is only the FIRST observable version. Prefer clear proportions and legible masses over decorative noise. Build near the local origin; the game sites the finished root later. Use compact helpers/data/loops and the installed WG productive verbs when useful.\n\n`+
`Return exactly the complete executable build(w,WG,THREE) function required by the standing forge contract. No markdown or prose.`;
}

function visualRepairPrompt(raw,code,metrics,pass,total,previousReview){
  const m=metrics||{};
  const prior=previousReview&&previousReview.worst?`\nPREVIOUS WORST DEFECT: ${previousReview.worst}\n`:'';
  return `ORIGINAL REQUEST:\n${raw}\n\n`+
`HOUSE LOOP · VISUAL REVIEW ${pass}/${total}\n`+
`You are looking at a CONTACT SHEET rendered from the CURRENT executable house below. The image is ground truth. Do not trust what the source intended when the render contradicts it.\n\n`+
`CURRENT MEASUREMENTS (meters, approximate): width=${round(m.width)}, depth=${round(m.depth)}, height=${round(m.height)}, minY=${round(m.minY)}, maxY=${round(m.maxY)}, meshes=${m.meshes||0}, collisionBodies=${m.solids==null?'?':m.solids}. A 1.75m human datum and ground/grid are visible in the sheet.\n`+
prior+
`CURRENT SOURCE:\n---\n${clean(code,MAX_SOURCE)}\n---\n\n`+
COLLISION_CONTRACT+`\n`+
`LOOK FIRST. Privately compare the render to the ORIGINAL REQUEST. Find the single highest-leverage defect, then repair the SAME structure. Check in this order:\n`+
`1 IDENTITY — would a viewer recognize the requested governing form without a label? Preserve or strengthen its topology/silhouette rather than replacing it with a generic house.\n`+
`2 SCALE — does it read as inhabitable architecture relative to the human datum, not a toy/sculpture/monument at the wrong scale? Entrances, floors, stairs and clearances must make bodily sense.\n`+
`3 MASS + VOID — are the important holes, courts, undercrofts, rings, branches or separations visually legible? A named oculus/court must remain physically open; never fill it with a cylinder/disc.\n`+
`4 ARRIVAL + CIRCULATION — can a person plausibly go grade -> landing/threshold -> real opening -> inhabited route?\n`+
`5 SUPPORT + WEATHER — does the form visibly meet the ground and resolve upper/weather surfaces coherently?\n`+
`6 COLLISION — collision bodies should be a coarse proxy model, not a second copy of every visible mesh. If collisionBodies approaches 80, simplify physics without simplifying appearance.\n\n`+
`Do NOT start over. Do NOT change everything at once. Make the smallest structural edits that fix the worst visible problem while retaining good parts of the current design. Reuse its helpers, dimensions and topology where possible.\n\n`+
`Inside the returned function, place one machine-readable comment near the top in exactly this form:\n`+
`/*III_REVIEW:{"score":0-100,"accept":true-or-false,"worst":"short defect"}*/\n`+
`Score the RENDERED building against the request after your proposed repair; accept only if no major identity/scale/inhabitation defect remains.\n\n`+
`Return exactly one complete corrected build(w,WG,THREE) function (the review comment is allowed inside it). No markdown or explanation outside the function.`;
}

function certificateRepairPrompt(raw,code,fix){
  const failure=clean(fix&&(fix.err||fix),1000);
  const collisionFailure=/solid|collision|ceiling|120/i.test(failure);
  return `ORIGINAL REQUEST:\n${raw}\n\n`+
`HOUSE LOOP · CERTIFICATE REPAIR\n`+
`The visually refined house below failed the standing III FORGE certificate. Repair THIS SAME design. Do not regenerate a different house and do not remove its important negative spaces merely to satisfy the checker.\n\n`+
`CERTIFICATE FAILURE:\n${failure}\n\n`+
`CURRENT SOURCE:\n---\n${clean(code,MAX_SOURCE)}\n---\n\n`+
COLLISION_CONTRACT+`\n`+
(collisionFailure?
`THIS IS A COLLISION-BUDGET REPAIR. Keep the visible meshes, dimensions, silhouette, rooms, openings, roof and detail. Remove WG.solid/WG.surface registration from repeated visual pieces and replace them with a much smaller set of broad collision proxies. Do not delete architecture to get under the limit. Aim for <=80 collision bodies.\n\n`:
`Repair only the concrete certificate defect. Do not redesign the building.\n\n`)+
`Return exactly one complete corrected build(w,WG,THREE) function. Preserve the existing design identity and scale while fixing the concrete certificate failure.`;
}

function parseReview(code){
  const s=String(code||'');
  const m=s.match(/\/\*III_REVIEW\s*:\s*(\{[\s\S]*?\})\s*\*\//i);
  if(!m) return {score:0,accept:false,worst:''};
  try{
    const x=JSON.parse(m[1]);
    return { score:clamp(x.score,0,100), accept:x.accept===true, worst:clean(x.worst,180) };
  }catch(_){ return {score:0,accept:false,worst:''}; }
}

async function previewCompile(source){
  const THREE=await getTHREE();
  const FORGE=global.FORGE,WGKIT=global.WGKIT;
  if(!FORGE||!WGKIT||typeof WGKIT.makeWG!=='function') throw new Error('forge/wg unavailable');
  const host={THREE,atmosphere:()=>{}};
  const wgA=WGKIT.makeWG(host);
  const s1=FORGE.compileEntry(String(source||''),{entry:'build',argNames:['w','WG','THREE'],args:[wgA.root,wgA,THREE],validate:()=>({ok:true}),budgetMs:250});
  try{ wgA.reset?.(); }catch(_){ }
  if(!s1||!s1.ok){ const e=s1?.attempts?.[0]?.err||'extract failed'; throw new Error(e); }
  const wg=WGKIT.makeWG(host);
  const s2=FORGE.compileEntry(s1.code,{entry:'build',argNames:['w','WG','THREE'],args:[wg.root,wg,THREE],validate:()=>({ok:true}),budgetMs:250});
  if(!s2||!s2.ok){ const e=s2?.attempts?.[0]?.err||'preview execution failed'; try{wg.reset?.();}catch(_){ } throw new Error(e); }
  try{ wg.sanitize?.(); }catch(_){ }
  try{ wg.harvest?.(); }catch(_){ }
  const cert=typeof WGKIT.validateDraft==='function'?WGKIT.validateDraft(wg):null;
  try{ wg.finish?.(); }catch(_){ }
  return {THREE,wg,root:wg.root,code:s1.code,cert};
}

function meshBounds(THREE,root){
  const box=new THREE.Box3(); let meshes=0;
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o||!o.isMesh||!o.geometry)return;
    meshes++;
    try{ if(!o.geometry.boundingBox)o.geometry.computeBoundingBox(); if(o.geometry.boundingBox)box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }catch(_){ }
  });
  if(box.isEmpty()||!Number.isFinite(box.min.x)) throw new Error('no visible mesh bounds');
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  return {box,center,size,meshes};
}

function ensureRenderer(THREE){
  if(renderer) return renderer;
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
  renderer.setPixelRatio(1);
  renderer.setSize(512,512,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  return renderer;
}

function addDatum(THREE,scene,bounds){
  const {box,center,size}=bounds;
  const span=Math.max(6,size.x,size.z);
  const grid=new THREE.GridHelper(Math.max(span*2.2,12),12,0x5d6974,0x37404a);
  grid.position.set(center.x,box.min.y,center.z); scene.add(grid);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(span*2.4,14),Math.max(span*2.4,14)),new THREE.MeshStandardMaterial({color:0x6f756b,roughness:1,side:THREE.DoubleSide}));
  ground.rotation.x=-Math.PI/2; ground.position.set(center.x,box.min.y-0.015,center.z); scene.add(ground);
  // 1.75m human datum: capsule-like body + head, deliberately neutral and bright.
  const human=new THREE.Group();
  const mat=new THREE.MeshBasicMaterial({color:0xffffff});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.25,8),mat); body.position.y=.625;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),mat); head.position.y=1.47;
  human.add(body,head);
  human.position.set(box.min.x-.7,box.min.y,box.max.z+.35); scene.add(human);
}

function makeCamera(THREE,bounds,view){
  const {box,center,size}=bounds,aspect=1,FOV=38;
  const cam=new THREE.PerspectiveCamera(FOV,aspect,.05,10000);
  const h=Math.max(.5,size.y),span=Math.max(1,size.x,size.z,h*.9);
  const dist=Math.max(4,span/(2*Math.tan(FOV*Math.PI/360))*1.35);
  const eye=box.min.y+Math.min(Math.max(1.65,h*.32),Math.max(1.65,h*.7));
  if(view==='front') cam.position.set(center.x,eye,center.z-dist);
  else if(view==='plan') cam.position.set(center.x+.001,center.y+dist*1.25,center.z+.001);
  else if(view==='arrival') cam.position.set(center.x+size.x*.28,eye,center.z-dist*.78);
  else cam.position.set(center.x+dist*.58,box.min.y+h*.72,center.z-dist*.62);
  cam.lookAt(center.x,view==='plan'?center.y:box.min.y+Math.min(h*.45,4.5),center.z);
  return cam;
}

async function captureContactSheet(compiled){
  const {THREE,wg,root}=compiled;
  const bounds=meshBounds(THREE,root),r=ensureRenderer(THREE);
  const sheet=document.createElement('canvas'); sheet.width=1024; sheet.height=1024;
  const ctx=sheet.getContext('2d',{alpha:false}); ctx.fillStyle='#101418'; ctx.fillRect(0,0,1024,1024);
  const views=['hero','front','arrival','plan'];
  const labels=['HERO','FRONT / SCALE','ARRIVAL / EYE','PLAN / VOID'];
  const parent=root.parent;
  for(let i=0;i<views.length;i++){
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9aabba);
    scene.add(new THREE.HemisphereLight(0xe6f2ff,0x566052,2.0));
    const sun=new THREE.DirectionalLight(0xfff0d4,2.5); sun.position.set(-30,60,40); scene.add(sun);
    const fill=new THREE.DirectionalLight(0xb8d7ef,.9); fill.position.set(45,25,-35); scene.add(fill);
    addDatum(THREE,scene,bounds);
    scene.add(root);
    const cam=makeCamera(THREE,bounds,views[i]);
    r.render(scene,cam);
    const x=(i%2)*512,y=Math.floor(i/2)*512;
    ctx.drawImage(r.domElement,x,y,512,512);
    ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(x+12,y+12,190,28);
    ctx.fillStyle='#fff'; ctx.font='700 16px IBM Plex Mono, monospace'; ctx.fillText(labels[i],x+22,y+32);
    scene.remove(root);
  }
  if(parent) parent.add(root);
  const solids=compiled.cert&&compiled.cert.cert?compiled.cert.cert.solids:(wg&&wg.pending?wg.pending.length:null);
  const metrics={
    width:bounds.size.x,depth:bounds.size.z,height:bounds.size.y,
    minY:bounds.box.min.y,maxY:bounds.box.max.y,meshes:bounds.meshes,solids
  };
  ctx.fillStyle='rgba(0,0,0,.82)'; ctx.fillRect(0,972,1024,52);
  ctx.fillStyle='#fff'; ctx.font='700 15px IBM Plex Mono, monospace';
  ctx.fillText(`BBOX ${round(metrics.width)} × ${round(metrics.depth)} × ${round(metrics.height)} m   HUMAN 1.75 m   MESH ${metrics.meshes}   COLLISION ${metrics.solids==null?'?':metrics.solids}`,18,1003);
  return {image:sheet.toDataURL('image/jpeg',.82),metrics};
}

async function visualLoop(raw,baseRequest,passThrough,image){
  const started=performance.now();
  global.__housePasses=[];
  lastBestScore=0; lastWorst='';
  stage('BUILDING',0,loopPasses,'FIRST FORM');
  let current=await requestWithoutGolden(passThrough,initialPrompt(raw),image,null);
  if(!clean(current)) throw new Error('initial build returned no code');
  current=clean(current,MAX_SOURCE);
  let bestCode=current,bestScore=0,previousReview={score:0,accept:false,worst:''};

  for(let pass=1;pass<=loopPasses;pass++){
    stage('OBSERVING',pass,loopPasses,'RENDERING');
    let compiled,shot;
    try{
      compiled=await previewCompile(current);
      shot=await captureContactSheet(compiled);
    }catch(err){
      global.__housePasses.push({pass,stage:'preview-failed',error:errText(err),code:current});
      try{ compiled?.wg?.reset?.(); }catch(_){ }
      lastError='preview '+errText(err);
      break;
    }

    const beforeReview=parseReview(current);
    global.__housePasses.push({pass,stage:'observed',image:shot.image,metrics:shot.metrics,review:beforeReview,code:current});
    try{ compiled.wg?.reset?.(); }catch(_){ }

    stage('CRITIQUING',pass,loopPasses,`${round(shot.metrics.width)}×${round(shot.metrics.depth)}×${round(shot.metrics.height)}M`);
    const prompt=visualRepairPrompt(raw,current,shot.metrics,pass,loopPasses,previousReview);
    const revised=await requestWithoutGolden(baseRequest,prompt,shot.image,null);
    if(!clean(revised)) throw new Error('visual repair returned no code');
    const candidate=clean(revised,MAX_SOURCE),review=parseReview(candidate);
    previousReview=review;
    if(review.worst) lastWorst=review.worst;
    global.__housePasses[global.__housePasses.length-1].resultReview=review;

    // A declared score gives the loop memory and rollback. If the model omits
    // the marker, retain the candidate but do not allow a missing score to erase
    // an already-scored best version.
    if(review.score>0){
      if(review.score>=bestScore){ bestScore=review.score; bestCode=candidate; }
    }else if(bestScore===0){ bestCode=candidate; }
    current=candidate;
    lastBestScore=bestScore;

    if(review.accept || review.score>=94){
      stage('COMPARING',pass,loopPasses,'ACCEPTED');
      bestCode=candidate;
      break;
    }
    stage('REPAIRING',pass,loopPasses,review.worst?review.worst.slice(0,34):'SAME HOUSE');
  }

  lastLoopMs=performance.now()-started;
  lastCode=clean(bestCode||current,MAX_SOURCE);
  global.__lastHouseBind={
    version:VERSION,prompt:raw,code:lastCode,passes:global.__housePasses,
    bestScore:lastBestScore,worst:lastWorst,loopMs:lastLoopMs
  };
  stage('COMPLETE',0,loopPasses,lastBestScore?`SCORE ${Math.round(lastBestScore)}`:'READY');
  setProposalBusy(false);
  return lastCode;
}

function underlyingRequest(domain){
  const b=domain&&domain.__iiiWorldTextBase;
  if(b&&typeof b.request==='function') return b.request;
  return domain&&domain.request;
}

function wrapDraft(){
  const engine=global.HELLO_ENGINE,current=engine&&engine.domains&&engine.domains.draft;
  if(!current||typeof current.request!=='function'||typeof engine.domain!=='function') return false;
  if(current.__iiiHouseBindVersion===VERSION) return true;
  if(global.III_WORLDTEXT&&current.__iiiWorldTextVersion!==global.III_WORLDTEXT.version) return false;

  const passThrough=current.request;
  const baseRequest=underlyingRequest(current);
  if(typeof baseRequest!=='function') return false;
  const wrapped=Object.assign({},current);
  wrapped.__iiiHouseBindVersion=VERSION;
  wrapped.__iiiHouseBindBase=current;

  wrapped.request=async function iiiHouseVisualLoopRequest(text,image,fix){
    const raw=clean(text)||'a dwelling';
    if(!isHabitation(raw)) return passThrough(text,image,fix);
    requests++; lastError=''; lastPrompt=raw;
    try{
      // Standing HELLO_ENGINE retries carry a concrete FORGE certificate failure.
      // Repair the visually-refined source rather than restarting the whole loop.
      if(fix&&lastCode){
        repairs++; stage('REPAIRING',0,loopPasses,'CERTIFICATE');
        const repaired=await requestWithoutGolden(baseRequest,certificateRepairPrompt(raw,lastCode,fix),image,null);
        if(!clean(repaired)) throw new Error('certificate repair returned no code');
        lastCode=clean(repaired,MAX_SOURCE);
        stage('COMPLETE',0,loopPasses,'CERTIFIED REPAIR'); setProposalBusy(false);
        return lastCode;
      }
      // New house request: never let stale source from a previous house become
      // the emergency return value for this one.
      lastCode='';
      return await visualLoop(raw,baseRequest,passThrough,image);
    }catch(err){
      lastError=errText(err); fallbacks++; stopTicker(); stage('FAULT',0,loopPasses,lastError.slice(0,48)); setProposalBusy(false);
      console.warn('[III HOUSE LOOP] visual loop failed; legacy/golden house fallback is blocked',err);
      // If this request produced an observed candidate, preserve that SAME house
      // for the standing certificate to evaluate. Never substitute a canned
      // golden/arena structure. Otherwise surface the failure to the outer gate.
      if(lastCode) return lastCode;
      throw err;
    }finally{
      global.__lastDraftPrompt=raw.slice(0,20000);
    }
  };

  engine.domain('draft',wrapped); installs++; return true;
}

function install(){ return wrapDraft(); }
function arm(){
  if(install()) return;
  let tries=0;
  timer=global.setInterval(()=>{
    tries++;
    if(install()||tries>=120){
      global.clearInterval(timer); timer=0;
      if(tries>=120&&!global.HELLO_ENGINE?.domains?.draft?.__iiiHouseBindVersion){
        lastError='draft domain / WorldText layer did not become available';
        console.warn('[III HOUSE LOOP] install timed out');
      }
    }
  },250);
}
function setPasses(n){ loopPasses=Math.max(0,Math.min(6,Number(n)|0)); return loopPasses; }
function stats(){
  return {
    version:VERSION,
    installed:global.HELLO_ENGINE?.domains?.draft?.__iiiHouseBindVersion===VERSION,
    installs,requests,repairs,fallbacks,passes:loopPasses,lastPrompt:lastPrompt||null,
    lastBestScore:Math.round(lastBestScore),lastWorst:lastWorst||null,lastLoopMs:Math.round(lastLoopMs),
    observedPasses:Array.isArray(global.__housePasses)?global.__housePasses.length:0,lastError:lastError||null
  };
}
function last(){ return global.__lastHouseBind||null; }
function passes(){ return Array.isArray(global.__housePasses)?global.__housePasses:[]; }

const api=Object.freeze({version:VERSION,install,stats,last,passes,isHabitation,setPasses});
global.III_HOUSE_BIND=api;
global.III_HOUSE_LOOP=api;
global.__setHouseLoopPasses=setPasses;
arm();
})(window);
