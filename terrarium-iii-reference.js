/* TERRARIUM III · REFERENCE FIRST / VISIBLE BUILD LOOP
 * PROVISIONAL v0.1
 *
 * Text is not allowed to jump directly into a hidden one-shot 3D build.
 * A habitation request first becomes a GPT Image 2 reference. The user can
 * approve it, revise it with a note, or cancel. The approved image then becomes
 * the visual target for a guided MAKE -> SEE -> SAY -> REPAIR loop. Every pass
 * is visible and persisted to Supabase.
 */
(function installIIIReference(global){
'use strict';

const VERSION='iii-reference-0.1-guided';
const IMAGE_MODEL='gpt-image-2';
const IMAGE_ENDPOINT='https://api.openai.com/v1/images/generations';
const IMAGE_EDIT_ENDPOINT='https://api.openai.com/v1/images/edits';
const RESPONSES_ENDPOINT='https://api.openai.com/v1/responses';
const IMAGE_KEY='terrarium.iii.reference.openai.key';
const AI_CONFIG_KEY='trig.ai.config.v2';
const REF_BUCKET='iii-reference-images';
const RENDER_BUCKET='iii-build-renders';
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const MAX_SOURCE=46000;
const DEFAULT_PASSES=5;

let installed=0, requests=0, imageCalls=0, criticCalls=0, repairs=0, uploads=0, failures=0;
let lastError='', timer=0, threePromise=null, renderer=null;
let currentBuild=null;
let guided=true;
let maxPasses=DEFAULT_PASSES;
let sbClient=null, sbKey='', sbUser='';
let ui=null;
let decisionResolve=null;
let decisionReject=null;

function clean(v,n=16000){return String(v==null?'':v).trim().slice(0,n)}
function errText(e){return clean(e&&e.message||e||'unknown failure',700)}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]&15,v=c==='x'?r:(r&3|8);return v.toString(16)})}
function round(v,n=1){const p=10**n;return Math.round(Number(v||0)*p)/p}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function getTHREE(){if(!threePromise)threePromise=import(THREE_URL);return threePromise}
function isHabitation(text){try{return global.III_HOUSE_BIND?.isHabitation?.(text)??/\b(house|home|dwelling|habitat|building|architecture|castle|fortress|palace|temple|cathedral|mosque|mausoleum|shrine|pagoda|tower|cabin|cottage|villa|lodge|hut|pavilion)\b/i.test(clean(text))}catch(_){return false}}

function browserStore(name){try{return global[name]||null}catch(_){return null}}
function projectRef(url){try{return new URL(url).hostname.split('.')[0]||'default'}catch(_){return'default'}}
function authStore(ref){const p='terrarium-iii-auth:'+ref+':';return{
  getItem(k){k=p+k;try{const v=browserStore('localStorage')?.getItem(k);if(v!=null)return v}catch(_){}try{return browserStore('sessionStorage')?.getItem(k)||null}catch(_){return null}},
  setItem(k,v){k=p+k;v=String(v);try{browserStore('localStorage')?.setItem(k,v);return}catch(_){}try{browserStore('sessionStorage')?.setItem(k,v)}catch(_){}},
  removeItem(k){k=p+k;try{browserStore('localStorage')?.removeItem(k)}catch(_){}try{browserStore('sessionStorage')?.removeItem(k)}catch(_){}}
}}
async function connection(){
  const c=global.III_NET?.config?.()||{},url=String(c.url||'').replace(/\/+$/,''),key=String(c.key||'');
  const create=global.supabase?.createClient;
  if(typeof create!=='function'||!/^https?:\/\//.test(url)||key.length<20)throw Error('SUPABASE NOT READY');
  const id=url+'|'+key;
  if(!sbClient||sbKey!==id){sbKey=id;sbUser='';sbClient=create(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:authStore(projectRef(url)),storageKey:'session'}})}
  let r=await sbClient.auth.getSession();if(r.error)throw r.error;let s=r.data?.session;
  if(!s?.user?.id){r=await sbClient.auth.signInAnonymously();if(r.error)throw r.error;s=r.data?.session}
  if(!s?.user?.id)throw Error('SUPABASE AUTH FAILED');sbUser=s.user.id;return{sb:sbClient,userId:sbUser}
}

function localAIConfig(){try{return JSON.parse(localStorage.getItem(AI_CONFIG_KEY)||'{}')||{}}catch(_){return{}}}
function referenceKey(){
  try{const direct=String(localStorage.getItem(IMAGE_KEY)||'').trim();if(direct.length>20)return direct}catch(_){}
  const c=localAIConfig();return c.provider==='openai'&&String(c.apiKey||'').trim().length>20?String(c.apiKey).trim():'';
}
function saveReferenceKey(key){key=clean(key,300);if(key.length<20)throw Error('OPENAI API KEY REQUIRED');localStorage.setItem(IMAGE_KEY,key);return true}
function clearReferenceKey(){try{localStorage.removeItem(IMAGE_KEY)}catch(_){}return true}
function criticModel(){const c=localAIConfig(),m=String(c.model||'');return c.provider==='openai'&&m&&!/^gpt-image/i.test(m)?m:'gpt-5.4-mini'}

function b64Blob(b64,type='image/png'){
  const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type})
}
function blobDataURL(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=()=>rej(r.error);r.readAsDataURL(blob)})}
async function dataURLBlob(url){const r=await fetch(url);return r.blob()}
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error('IMAGE DECODE FAILED'));i.src=src})}

function referencePrompt(raw,note=''){
  return `Design one coherent, buildable ARCHITECTURAL REFERENCE for this request:\n\n${raw}\n\n`+
  `This image will become the visual contract for a later procedural 3D compiler. Show ONE building as a real inhabitable work of architecture, not a toy, diagram, sculpture pile, collage, exploded view, or concept sheet. Use a clear three-quarter exterior view at human eye level with a ground plane, a visible human-scale entrance, believable floors/clearances, and enough site context to read scale. Preserve the governing morphology, topology, voids, silhouette and metaphor of the request rather than putting decoration on a generic box. If the request implies a ring, branch, taper, animal, machine, monument, court, shell, bridge, etc., let that relation govern the actual building. No labels, no captions, no interface text.\n`+
  (note?`\nUSER REVISION NOTE:\n${note}\nRevise the SAME design intention in response to this note; preserve everything not contradicted by the note.`:'');
}
async function callImage(raw,note='',previousBlob=null){
  const key=referenceKey();if(!key)throw Error('GPT IMAGE 2 NEEDS AN OPENAI API KEY');imageCalls++;
  const prompt=referencePrompt(raw,note);
  let response;
  if(previousBlob){
    const form=new FormData();form.append('model',IMAGE_MODEL);form.append('prompt',prompt);form.append('image',previousBlob,'reference.png');form.append('size','1536x1024');form.append('quality','medium');form.append('output_format','png');
    response=await fetch(IMAGE_EDIT_ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+key},body:form});
  }else{
    response=await fetch(IMAGE_ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:IMAGE_MODEL,prompt,size:'1536x1024',quality:'medium',output_format:'png'})});
  }
  const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body?.error?.message||`IMAGE API ${response.status}`);
  const item=body?.data?.[0]||body?.output?.[0]||{};let blob=null;
  if(item.b64_json)blob=b64Blob(item.b64_json,'image/png');
  else if(body.b64_json)blob=b64Blob(body.b64_json,'image/png');
  else if(item.url){const r=await fetch(item.url);if(!r.ok)throw Error('IMAGE URL FETCH FAILED');blob=await r.blob()}
  if(!blob)throw Error('IMAGE API RETURNED NO IMAGE');
  return{blob,dataUrl:await blobDataURL(blob),model:IMAGE_MODEL,width:1536,height:1024,prompt};
}

function outputText(body){
  if(typeof body?.output_text==='string')return body.output_text;
  const out=[];for(const item of body?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&c.text)out.push(c.text);return out.join('\n');
}
async function callCritic(raw,compareDataUrl,metrics,pass,note=''){
  const key=referenceKey();if(!key)throw Error('OPENAI KEY REQUIRED FOR VISUAL CRITIC');criticCalls++;
  const prompt=`You are the visible architectural critic inside TERRARIUM. The attached comparison image contains the APPROVED TARGET REFERENCE and the CURRENT PROCEDURAL 3D RENDER. The target is the design contract. Judge consequence, not source-code intention.\n\nORIGINAL REQUEST:\n${raw}\n\nCURRENT METRICS (meters): ${JSON.stringify(metrics)}\n${note?`\nUSER NOTE:\n${note}\n`:''}\nPASS ${pass}.\n\nReturn ONLY one JSON object with exactly these keys:\n{"score":0-100,"accept":true|false,"saw":"literal description of what the current 3D render actually looks like","mismatch":"single highest-leverage difference between target and current","next_change":"one concrete structural change to make next","strengths":"what should be preserved"}\n\nScore target resemblance, governing topology/silhouette/voids, human scale, entrance/circulation, support and architectural coherence. Do not accept a loose scatter that only hints at the noun. Do not write code.`;
  const body={model:criticModel(),input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:compareDataUrl}]}],max_output_tokens:1000};
  const r=await fetch(RESPONSES_ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j?.error?.message||`CRITIC API ${r.status}`);
  let txt=outputText(j).trim().replace(/```json/gi,'').replace(/```/g,'');const a=txt.indexOf('{'),b=txt.lastIndexOf('}');if(a>=0&&b>a)txt=txt.slice(a,b+1);
  let x;try{x=JSON.parse(txt)}catch(_){throw Error('CRITIC RETURNED INVALID JSON')}
  return{score:Math.max(0,Math.min(100,Number(x.score)||0)),accept:x.accept===true,saw:clean(x.saw,700),mismatch:clean(x.mismatch,500),next_change:clean(x.next_change,500),strengths:clean(x.strengths,500)};
}

async function insert(table,row){const {sb}=await connection();const r=await sb.from(table).insert(row).select().single();if(r.error)throw r.error;return r.data}
async function upsert(table,row,onConflict){const {sb}=await connection();const r=await sb.from(table).upsert(row,{onConflict}).select().single();if(r.error)throw r.error;return r.data}
async function patch(table,id,changes){const {sb}=await connection();const r=await sb.from(table).update({...changes,updated_at:table==='iii_builds'?new Date().toISOString():undefined}).eq('id',id).select().maybeSingle();if(r.error)throw r.error;return r.data}
async function trace(buildId,phase,label,detail='',payload=null,refs={}){try{return await insert('iii_trace_events',{build_id:buildId,phase,label,detail:detail||null,payload_json:payload,iteration_id:refs.iteration_id||null,reference_image_id:refs.reference_image_id||null})}catch(e){console.warn('[III REF] trace',e);return null}}
async function feedback(buildId,kind,message,refs={}){try{return await insert('iii_feedback',{build_id:buildId,author_type:'user',kind,message:clean(message,6000),iteration_id:refs.iteration_id||null,reference_image_id:refs.reference_image_id||null})}catch(e){console.warn('[III REF] feedback',e);return null}}
async function upload(bucket,path,blob){const {sb}=await connection();const r=await sb.storage.from(bucket).upload(path,blob,{upsert:true,contentType:blob.type||'image/png',cacheControl:'3600'});if(r.error)throw r.error;uploads++;return path}
async function signed(bucket,path,seconds=86400){const {sb}=await connection();const r=await sb.storage.from(bucket).createSignedUrl(path,seconds);if(r.error)throw r.error;return r.data?.signedUrl||''}

function css(){return `
#iii-ref-flow{position:fixed;z-index:335;inset:calc(max(10px,env(safe-area-inset-top)) + 52px) 8px max(150px,calc(env(safe-area-inset-bottom) + 142px)) 8px;background:rgba(5,7,9,.97);border:1px solid #19e6c8;display:none;flex-direction:column;overflow:hidden;color:#fff;font-family:"IBM Plex Mono",monospace;box-shadow:0 16px 50px #000b}
#iii-ref-flow.show{display:flex}#iii-ref-head{height:44px;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid #ffffff22;flex:0 0 auto}#iii-ref-title{font-size:10px;letter-spacing:.16em;font-weight:700;flex:1;color:#19e6c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#iii-ref-min{width:34px;height:30px;background:#000;border:1px solid #ffffff44;color:#fff;font:700 14px inherit}
#iii-ref-body{overflow:auto;overscroll-behavior:contain;padding:10px;flex:1}.iii-ref-kicker{font-size:8px;letter-spacing:.22em;color:#8c96a2;margin-bottom:6px}.iii-ref-image{display:block;width:100%;height:auto;max-height:44vh;object-fit:contain;background:#111;border:1px solid #ffffff20}.iii-ref-status{margin:8px 0;font-size:10px;line-height:1.45;color:#cbd5df}.iii-ref-note{width:100%;min-height:54px;resize:vertical;background:#07090b;border:1px solid #ffffff35;color:#fff;padding:8px;font:11px/1.35 inherit;outline:none}.iii-ref-note:focus{border-color:#19e6c8}.iii-ref-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.iii-ref-actions button{min-height:42px;background:#090b0e;border:1px solid #ffffff55;color:#fff;font:700 9px inherit;letter-spacing:.08em}.iii-ref-actions button.primary{background:#19e6c8;border-color:#19e6c8;color:#000}.iii-ref-actions button.warn{border-color:#ffd23f;color:#ffd23f}.iii-ref-actions button.danger{border-color:#ff2e2e;color:#ff8a8a}
#iii-ref-history{display:flex;gap:6px;overflow-x:auto;margin:8px 0}.iii-ref-thumb{width:74px;height:54px;object-fit:cover;border:1px solid #ffffff2b;flex:0 0 auto}.iii-ref-thumb.on{border-color:#19e6c8}.iii-pass{border-top:1px solid #ffffff22;margin-top:12px;padding-top:10px}.iii-pass-head{display:flex;justify-content:space-between;gap:8px;font-size:9px;letter-spacing:.12em;color:#19e6c8}.iii-pass img{width:100%;margin-top:7px;border:1px solid #ffffff20}.iii-pass p{font-size:10px;line-height:1.48;margin:7px 0;color:#d9e0e7}.iii-pass b{color:#fff}.iii-score{color:#ffd23f}.iii-ref-key{display:flex;gap:6px;margin-top:8px}.iii-ref-key input{flex:1;min-width:0;background:#07090b;border:1px solid #ffffff35;color:#fff;padding:8px;font:11px inherit}.iii-ref-key button{background:#19e6c8;color:#000;border:0;padding:0 10px;font:700 9px inherit}.iii-small{font-size:8px;line-height:1.45;color:#8d98a5;margin-top:5px}
#iii-ref-pin{display:none;position:fixed;z-index:90;left:10px;top:calc(max(10px,env(safe-area-inset-top)) + 54px);width:82px;background:#050709;border:1px solid #19e6c8;padding:3px;color:#fff;text-align:left;font:700 8px/1.2 "IBM Plex Mono",monospace}#iii-ref-pin.show{display:block}#iii-ref-pin img{width:74px;height:50px;display:block;object-fit:cover;margin-bottom:3px}
@media(min-width:760px){#iii-ref-flow{left:50%;right:auto;width:min(720px,calc(100vw - 24px));transform:translateX(-50%);bottom:16px}.iii-ref-image{max-height:52vh}}
`;}
function ensureUI(){
  if(ui)return ui;
  const style=document.createElement('style');style.textContent=css();document.head.appendChild(style);
  const root=document.createElement('section');root.id='iii-ref-flow';root.innerHTML=`<div id="iii-ref-head"><div id="iii-ref-title">REFERENCE</div><button id="iii-ref-min" aria-label="minimize">−</button></div><div id="iii-ref-body"><div class="iii-ref-kicker" id="iii-ref-kicker">WHAT III INTENDS TO BUILD</div><img class="iii-ref-image" id="iii-ref-image" alt="generated architectural reference"><div id="iii-ref-history"></div><div class="iii-ref-status" id="iii-ref-status"></div><div id="iii-ref-keybox" style="display:none"><div class="iii-ref-key"><input id="iii-ref-key" type="password" autocomplete="off" placeholder="OpenAI API key"><button id="iii-ref-savekey">USE KEY</button></div><div class="iii-small">GPT IMAGE 2 uses this key only from this browser. It is never written to Supabase.</div></div><textarea class="iii-ref-note" id="iii-ref-note" placeholder="Leave a note for the next pass…"></textarea><div class="iii-ref-actions" id="iii-ref-actions"></div><div id="iii-ref-passes"></div></div>`;
  document.body.appendChild(root);
  const pin=document.createElement('button');pin.id='iii-ref-pin';pin.innerHTML='<img alt="target"><span>TARGET</span>';document.body.appendChild(pin);
  const q=id=>root.querySelector('#'+id);
  ui={root,pin,title:q('iii-ref-title'),kicker:q('iii-ref-kicker'),image:q('iii-ref-image'),history:q('iii-ref-history'),status:q('iii-ref-status'),keybox:q('iii-ref-keybox'),key:q('iii-ref-key'),savekey:q('iii-ref-savekey'),note:q('iii-ref-note'),actions:q('iii-ref-actions'),passes:q('iii-ref-passes')};
  q('iii-ref-min').onclick=()=>{root.classList.remove('show');pin.classList.add('show')};pin.onclick=()=>{pin.classList.remove('show');root.classList.add('show')};
  ui.savekey.onclick=()=>{try{saveReferenceKey(ui.key.value);ui.key.value='';ui.keybox.style.display='none';ui.status.textContent='KEY READY · GENERATE AGAIN';ui.key.dispatchEvent(new Event('iii-key-ready'))}catch(e){ui.status.textContent=errText(e)}};
  return ui;
}
function showUI(){const u=ensureUI();u.pin.classList.remove('show');u.root.classList.add('show');return u}
function hideUI(){if(!ui)return;ui.root.classList.remove('show');ui.pin.classList.remove('show')}
function setActions(actions){const u=ensureUI();u.actions.innerHTML='';for(const a of actions){const b=document.createElement('button');b.textContent=a.label;b.className=a.kind||'';b.onclick=a.run;u.actions.appendChild(b)}}
function showKeyNeeded(retry){const u=showUI();u.title.textContent='REFERENCE · GPT IMAGE 2';u.kicker.textContent='OPENAI KEY REQUIRED';u.image.removeAttribute('src');u.status.textContent='Add an OpenAI API key to generate the architectural reference.';u.keybox.style.display='block';const h=()=>{u.key.removeEventListener('iii-key-ready',h);retry()};u.key.addEventListener('iii-key-ready',h);setActions([{label:'CANCEL',kind:'danger',run:()=>decisionReject?.(Error('REFERENCE CANCELLED'))}])}
function renderHistory(refs,active){const u=ensureUI();u.history.innerHTML='';for(const r of refs){const i=document.createElement('img');i.className='iii-ref-thumb'+(r.id===active?.id?' on':'');i.src=r.dataUrl;i.title='REFERENCE '+r.pass;i.onclick=()=>{u.image.src=r.dataUrl};u.history.appendChild(i)}}
function renderReference(ref,refs){const u=showUI();u.title.textContent=`REFERENCE ${ref.pass} · GPT IMAGE 2`;u.kicker.textContent='WHAT III INTENDS TO BUILD';u.image.src=ref.dataUrl;u.pin.querySelector('img').src=ref.dataUrl;u.status.textContent='Approve this visual intention before III spends 3D passes trying to realize it.';u.note.value='';u.keybox.style.display='none';renderHistory(refs,ref)}
function renderPass(passObj,targetDataUrl){
  const u=showUI();u.title.textContent=`BUILD PASS ${passObj.pass}/${maxPasses} · SCORE ${Math.round(passObj.critic.score)}`;u.kicker.textContent='TARGET ↔ CURRENT · WHAT THE CRITIC ACTUALLY SAW';u.image.src=passObj.compareDataUrl;u.pin.querySelector('img').src=targetDataUrl;
  u.status.innerHTML=`<b>SAW</b> · ${escapeHTML(passObj.critic.saw)}<br><br><b>MISMATCH</b> · ${escapeHTML(passObj.critic.mismatch)}<br><br><b>NEXT CHANGE</b> · ${escapeHTML(passObj.critic.next_change)}<br><br><span class="iii-score">SCORE ${Math.round(passObj.critic.score)} / 100</span>`;
  u.note.value='';
  const card=document.createElement('div');card.className='iii-pass';card.dataset.pass=passObj.pass;card.innerHTML=`<div class="iii-pass-head"><span>PASS ${passObj.pass}</span><span class="iii-score">${Math.round(passObj.critic.score)}/100</span></div><img src="${passObj.compareDataUrl}" alt="target and current comparison"><p><b>SAW</b> ${escapeHTML(passObj.critic.saw)}</p><p><b>MISMATCH</b> ${escapeHTML(passObj.critic.mismatch)}</p><p><b>NEXT</b> ${escapeHTML(passObj.critic.next_change)}</p>`;u.passes.prepend(card);
}
function escapeHTML(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function setWorking(label,detail=''){const u=showUI();u.title.textContent=label;u.status.textContent=detail;setActions([])}

function waitDecision(){return new Promise((res,rej)=>{decisionResolve=res;decisionReject=rej})}
function decide(v){const r=decisionResolve;decisionResolve=decisionReject=null;r?.(v)}
function rejectDecision(e){const r=decisionReject;decisionResolve=decisionReject=null;r?.(e)}

async function createBuild(raw){const row=await insert('iii_builds',{session_id:global.III_STORE?.sessionId||null,prompt:raw,mode:'house',status:'imaging',title:raw.slice(0,120)});currentBuild={id:row.id,prompt:raw,row,references:[],passes:[],approved:null,finalCode:'',best:null,startedAt:Date.now()};global.__iiiActiveBuildId=row.id;await trace(row.id,'imaging','Build opened','Reference-first pipeline started');return currentBuild}
async function saveReference(build,result,note='',status='draft',source='generated'){
  const who=await connection(),pass=build.references.length+1,ext=result.blob.type.includes('jpeg')?'jpg':'png',path=`${who.userId}/${build.id}/reference-${String(pass).padStart(3,'0')}.${ext}`;await upload(REF_BUCKET,path,result.blob);
  const row=await insert('iii_reference_images',{build_id:build.id,pass_index:pass,prompt_snapshot:build.prompt,note_snapshot:note||null,storage_path:path,model:source==='user'?'user-upload':result.model,width:result.width||null,height:result.height||null,status});
  const ref={...row,pass,blob:result.blob,dataUrl:result.dataUrl,path,source};build.references.push(ref);await trace(build.id,'imaging',`Reference ${pass} saved`,note||'',null,{reference_image_id:row.id});return ref
}
async function approveReference(build,ref){
  const {sb}=await connection();await sb.from('iii_reference_images').update({status:'rejected'}).eq('build_id',build.id).neq('id',ref.id);await sb.from('iii_reference_images').update({status:'approved'}).eq('id',ref.id);await patch('iii_builds',build.id,{approved_reference_id:ref.id,status:'building'});await feedback(build.id,'approval','Approved reference image',{reference_image_id:ref.id});await trace(build.id,'approved','Reference approved','3D realization may begin',null,{reference_image_id:ref.id});build.approved=ref;global.__iiiApprovedReference={buildId:build.id,id:ref.id,dataUrl:ref.dataUrl,path:ref.path,prompt:build.prompt};global.__iiiApprovedReferenceDataUrl=ref.dataUrl;return ref
}

async function referenceGate(build,initialImage){
  let firstResult=null;
  if(initialImage){const blob=await dataURLBlob(initialImage);firstResult={blob,dataUrl:initialImage,model:'user-upload',width:null,height:null};}
  while(true){
    if(!firstResult){
      if(!referenceKey()){
        await new Promise((resolve,reject)=>{decisionResolve=resolve;decisionReject=reject;showKeyNeeded(async()=>{try{resolve(true)}catch(e){reject(e)}});setActions([{label:'CANCEL',kind:'danger',run:()=>rejectDecision(Error('REFERENCE CANCELLED'))}])});
        if(!referenceKey())continue;
      }
      setWorking('IMAGING · GPT IMAGE 2','Generating the visual target before any 3D code is written…');await trace(build.id,'imaging','GPT Image 2 generating','Initial architectural reference');firstResult=await callImage(build.prompt,'',null);
    }
    const ref=await saveReference(build,firstResult,'','draft',initialImage?'user':'generated');renderReference(ref,build.references);
    setActions([
      {label:'APPROVE → BUILD',kind:'primary',run:()=>decide({action:'approve',ref})},
      {label:'REVISE IMAGE',kind:'warn',run:()=>decide({action:'revise',ref,note:clean(ui.note.value,5000)})},
      {label:'CANCEL',kind:'danger',run:()=>rejectDecision(Error('REFERENCE CANCELLED'))}
    ]);
    const d=await waitDecision();
    if(d.action==='approve'){if(clean(ui.note.value)){await feedback(build.id,'note',ui.note.value,{reference_image_id:ref.id})}await approveReference(build,ref);return ref}
    if(d.action==='revise'){
      const note=d.note||'Make the concept stronger, more coherent, and more buildable while preserving the same request.';await feedback(build.id,'note',note,{reference_image_id:ref.id});await trace(build.id,'imaging','Reference revision requested',note,null,{reference_image_id:ref.id});setWorking('REVISING IMAGE · GPT IMAGE 2',note);firstResult=await callImage(build.prompt,note,ref.blob);initialImage=null;continue;
    }
  }
}

function rawRequestFrom(domain){let d=domain;if(d?.__iiiHouseBindBase)d=d.__iiiHouseBindBase;if(d?.__iiiWorldTextBase)d=d.__iiiWorldTextBase;return typeof d?.request==='function'?d.request:null}
function requestWithoutGolden(request,prompt,image,fix){const old=global.GOLDEN_DRAFTS;let swapped=false;if(old&&typeof old.pick==='function'){try{global.GOLDEN_DRAFTS=Object.assign({},old,{pick:()=>null});swapped=true}catch(_){}}try{return request(prompt,image,fix)}finally{if(swapped)try{global.GOLDEN_DRAFTS=old}catch(_){}}}
function initial3DPrompt(raw){return `ORIGINAL REQUEST:\n${raw}\n\nREFERENCE-FIRST BUILD · INITIAL 3D REALIZATION\nThe attached image is the USER-APPROVED visual target. Build THAT design as one coherent inhabitable WG construction. Match its governing topology, silhouette, mass/void relation, proportions, scale, entrance and major assembly relationships rather than merely matching colors or adding symbolic decoration. The reference outranks generic house conventions.\n\nUse local coordinates near origin. Make human scale explicit through real floors, openings, arrival and circulation. Preserve important negative space in both appearance and collision. Use compact helpers/data/loops and the productive WG verbs. Return only the complete build(w,WG,THREE) function required by the standing forge contract.`}
function repairPrompt(raw,code,critic,note,pass){return `ORIGINAL REQUEST:\n${raw}\n\nREFERENCE-FIRST BUILD · REPAIR PASS ${pass}\nThe attached comparison shows the APPROVED TARGET and the CURRENT 3D result. Repair the SAME current program; do not start over.\n\nCRITIC SAW:\n${critic.saw}\n\nHIGHEST-LEVERAGE MISMATCH:\n${critic.mismatch}\n\nNEXT STRUCTURAL CHANGE:\n${critic.next_change}\n\nPRESERVE:\n${critic.strengths}\n${note?`\nUSER NOTE OVERRIDES/REFINES THE CRITIC:\n${note}\n`:''}\nCURRENT SOURCE:\n---\n${clean(code,MAX_SOURCE)}\n---\n\nMake the smallest coherent edits that move the rendered consequence toward the approved target while preserving good work. Keep human scale, real openings/circulation, support and collision legality. Return exactly one complete corrected build(w,WG,THREE) function and nothing else.`}
function certRepairPrompt(raw,code,fix){return `ORIGINAL REQUEST:\n${raw}\n\nREFERENCE-FIRST BUILD · CERTIFICATE REPAIR\nThe accepted visual design failed III's standing WG certificate: ${clean(fix?.err||fix,900)}. Repair this SAME source without changing the approved topology or closing intended voids.\n\nCURRENT SOURCE:\n${clean(code,MAX_SOURCE)}\n\nReturn the complete corrected build(w,WG,THREE) function only.`}

function meshBounds(THREE,root){const box=new THREE.Box3();let meshes=0;root.updateMatrixWorld(true);root.traverse(o=>{if(!o?.isMesh||!o.geometry)return;meshes++;try{if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(o.geometry.boundingBox)box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))}catch(_){}});if(box.isEmpty()||!Number.isFinite(box.min.x))throw Error('NO VISIBLE MESH BOUNDS');return{box,center:box.getCenter(new THREE.Vector3()),size:box.getSize(new THREE.Vector3()),meshes}}
function ensureRenderer(THREE){if(renderer)return renderer;renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});renderer.setPixelRatio(1);renderer.setSize(512,512,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;return renderer}
function datum(THREE,scene,b){const span=Math.max(6,b.size.x,b.size.z);const grid=new THREE.GridHelper(Math.max(12,span*2.2),12,0x5d6974,0x37404a);grid.position.set(b.center.x,b.box.min.y,b.center.z);scene.add(grid);const ground=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(14,span*2.4),Math.max(14,span*2.4)),new THREE.MeshStandardMaterial({color:0x6f756b,roughness:1,side:THREE.DoubleSide}));ground.rotation.x=-Math.PI/2;ground.position.set(b.center.x,b.box.min.y-.015,b.center.z);scene.add(ground);const h=new THREE.Group(),m=new THREE.MeshBasicMaterial({color:0xffffff}),body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.25,8),m),head=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),m);body.position.y=.625;head.position.y=1.47;h.add(body,head);h.position.set(b.box.min.x-.7,b.box.min.y,b.box.max.z+.35);scene.add(h)}
function cameraFor(THREE,b,view){const FOV=38,cam=new THREE.PerspectiveCamera(FOV,1,.05,10000),h=Math.max(.5,b.size.y),span=Math.max(1,b.size.x,b.size.z,h*.9),dist=Math.max(4,span/(2*Math.tan(FOV*Math.PI/360))*1.35),eye=b.box.min.y+Math.min(Math.max(1.65,h*.32),Math.max(1.65,h*.7));if(view==='front')cam.position.set(b.center.x,eye,b.center.z-dist);else if(view==='plan')cam.position.set(b.center.x+.001,b.center.y+dist*1.25,b.center.z+.001);else if(view==='arrival')cam.position.set(b.center.x+b.size.x*.28,eye,b.center.z-dist*.78);else cam.position.set(b.center.x+dist*.58,b.box.min.y+h*.72,b.center.z-dist*.62);cam.lookAt(b.center.x,view==='plan'?b.center.y:b.box.min.y+Math.min(h*.45,4.5),b.center.z);return cam}
async function contactSheet(compiled){
  const THREE=await getTHREE(),root=compiled.wg.root,b=meshBounds(THREE,root),r=ensureRenderer(THREE),sheet=document.createElement('canvas');sheet.width=1024;sheet.height=1024;const ctx=sheet.getContext('2d',{alpha:false});ctx.fillStyle='#101418';ctx.fillRect(0,0,1024,1024);const views=['hero','front','arrival','plan'],labels=['HERO','FRONT / SCALE','ARRIVAL / EYE','PLAN / VOID'],parent=root.parent;
  for(let i=0;i<4;i++){const s=new THREE.Scene();s.background=new THREE.Color(0x9aabba);s.add(new THREE.HemisphereLight(0xe6f2ff,0x566052,2));const sun=new THREE.DirectionalLight(0xfff0d4,2.5);sun.position.set(-30,60,40);s.add(sun);const fill=new THREE.DirectionalLight(0xb8d7ef,.9);fill.position.set(45,25,-35);s.add(fill);datum(THREE,s,b);s.add(root);r.render(s,cameraFor(THREE,b,views[i]));const x=(i%2)*512,y=Math.floor(i/2)*512;ctx.drawImage(r.domElement,x,y,512,512);ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x+10,y+10,190,28);ctx.fillStyle='#fff';ctx.font='700 15px monospace';ctx.fillText(labels[i],x+18,y+30);s.remove(root)}if(parent)parent.add(root);
  const metrics={width:round(b.size.x,2),depth:round(b.size.z,2),height:round(b.size.y,2),minY:round(b.box.min.y,2),maxY:round(b.box.max.y,2),meshes:b.meshes,solids:compiled.cert?.solids??compiled.wg?.pending?.length??null};ctx.fillStyle='rgba(0,0,0,.85)';ctx.fillRect(0,970,1024,54);ctx.fillStyle='#fff';ctx.font='700 15px monospace';ctx.fillText(`BBOX ${round(metrics.width)} × ${round(metrics.depth)} × ${round(metrics.height)} m · HUMAN 1.75m · MESH ${metrics.meshes} · SOLID ${metrics.solids??'?'}`,16,1002);return{dataUrl:sheet.toDataURL('image/jpeg',.84),metrics}
}
async function comparison(referenceDataUrl,currentDataUrl){const [ref,cur]=await Promise.all([loadImage(referenceDataUrl),loadImage(currentDataUrl)]),c=document.createElement('canvas');c.width=1536;c.height=1024;const x=c.getContext('2d',{alpha:false});x.fillStyle='#07090b';x.fillRect(0,0,c.width,c.height);function fit(img,left,top,w,h){const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;x.drawImage(img,left+(w-dw)/2,top+(h-dh)/2,dw,dh)}fit(ref,0,0,512,1024);fit(cur,512,0,1024,1024);x.fillStyle='rgba(0,0,0,.82)';x.fillRect(12,12,150,34);x.fillRect(530,12,170,34);x.fillStyle='#fff';x.font='700 18px monospace';x.fillText('TARGET',26,35);x.fillText('CURRENT 3D',544,35);x.strokeStyle='#19e6c8';x.lineWidth=3;x.beginPath();x.moveTo(512,0);x.lineTo(512,1024);x.stroke();return c.toDataURL('image/jpeg',.86)}

async function saveIteration(build,pass,code,sheet,critic){const who=await connection(),blob=await dataURLBlob(sheet.dataUrl),path=`${who.userId}/${build.id}/pass-${String(pass).padStart(3,'0')}.jpg`;await upload(RENDER_BUCKET,path,blob);const row=await upsert('iii_iterations',{build_id:build.id,pass_index:pass,status:critic.accept?'accepted':'observed',code_text:clean(code,MAX_SOURCE),metrics_json:sheet.metrics,defects_json:critic,critic_summary:critic.mismatch,critic_score:critic.score,contact_sheet_path:path},'build_id,pass_index');await trace(build.id,'critiquing',`Pass ${pass} reviewed`,critic.mismatch,{score:critic.score,saw:critic.saw,next_change:critic.next_change},{iteration_id:row.id});return row}

async function guided3D(build,ref,rawRequest,compileFn){
  setWorking('BUILDING · PASS 1','Generating the first 3D realization from the approved image…');await trace(build.id,'building','Initial 3D generation','Approved reference attached');let code=await requestWithoutGolden(rawRequest,initial3DPrompt(build.prompt),ref.dataUrl,null);code=clean(code,MAX_SOURCE);if(!code)throw Error('INITIAL 3D BUILD RETURNED NO CODE');let best={score:-1,code,iterationId:null,pass:0};
  for(let pass=1;pass<=maxPasses;pass++){
    setWorking(`PASS ${pass}/${maxPasses} · OBSERVING`,'Compiling the current source and photographing what it actually became…');await trace(build.id,'observing',`Pass ${pass} rendering`);
    let compiled=compileFn(code);if(!compiled?.ok){await trace(build.id,'repairing',`Pass ${pass} certificate repair`,compiled?.err||'compile failed');code=clean(await requestWithoutGolden(rawRequest,certRepairPrompt(build.prompt,code,compiled?.fix||compiled),ref.dataUrl,compiled?.fix||null),MAX_SOURCE);compiled=compileFn(code);if(!compiled?.ok)throw Error(compiled?.err||'WG COMPILE FAILED')}
    const sheet=await contactSheet(compiled);try{compiled.wg?.reset?.()}catch(_){}
    const compare=await comparison(ref.dataUrl,sheet.dataUrl);setWorking(`PASS ${pass}/${maxPasses} · CRITIQUING`,'The critic is comparing the approved target against the rendered consequence…');
    const critic=await callCritic(build.prompt,compare,sheet.metrics,pass,'');const iteration=await saveIteration(build,pass,code,sheet,critic);const p={pass,code,sheet,compareDataUrl:compare,critic,iteration};build.passes.push(p);if(critic.score>best.score)best={score:critic.score,code,iterationId:iteration.id,pass};renderPass(p,ref.dataUrl);
    if(critic.accept)await trace(build.id,'approval',`Critic recommends accept at pass ${pass}`,critic.strengths,null,{iteration_id:iteration.id});
    if(!guided){if(critic.accept||pass===maxPasses)break;repairs++;setWorking(`PASS ${pass}/${maxPasses} · REPAIRING`,critic.next_change);code=clean(await requestWithoutGolden(rawRequest,repairPrompt(build.prompt,code,critic,'',pass),compare,null),MAX_SOURCE);continue}
    setActions([
      {label:critic.accept?'ACCEPT THIS':'ACCEPT CURRENT',kind:'primary',run:()=>decide({action:'accept',note:clean(ui.note.value,5000)})},
      {label:pass<maxPasses?'REVISE NEXT':'USE BEST',kind:'warn',run:()=>decide({action:pass<maxPasses?'revise':'best',note:clean(ui.note.value,5000)})},
      {label:'AUTO REMAINING',run:()=>decide({action:'auto',note:clean(ui.note.value,5000)})},
      {label:'CANCEL',kind:'danger',run:()=>rejectDecision(Error('BUILD CANCELLED'))}
    ]);
    const d=await waitDecision();const note=d.note||'';if(note){await feedback(build.id,'note',note,{iteration_id:iteration.id});await trace(build.id,'feedback',`User note on pass ${pass}`,note,null,{iteration_id:iteration.id})}
    if(d.action==='accept'){best={score:critic.score,code,iterationId:iteration.id,pass};break}
    if(d.action==='best'){code=best.code;break}
    if(d.action==='auto'){guided=false;if(pass===maxPasses)break}
    if(pass<maxPasses){repairs++;setWorking(`PASS ${pass}/${maxPasses} · REPAIRING`,note||critic.next_change);await trace(build.id,'repairing',`Repairing after pass ${pass}`,note||critic.next_change,null,{iteration_id:iteration.id});code=clean(await requestWithoutGolden(rawRequest,repairPrompt(build.prompt,code,critic,note,pass),compare,null),MAX_SOURCE);if(!code)throw Error('REPAIR RETURNED NO CODE')}
  }
  const final=best.score>=0?best:{score:0,code,iterationId:null,pass:0};build.finalCode=final.code;build.best=final;await patch('iii_builds',build.id,{accepted_iteration_id:final.iterationId,status:'ready_to_commit'});await trace(build.id,'complete','3D loop complete',`Best pass ${final.pass} · score ${Math.round(final.score)}`);setWorking('READY · BLUEPRINT','Returning the selected source to III for its standing certificate and COMMIT proposal…');await sleep(450);hideUI();return final.code
}

function installCommitHooks(){document.addEventListener('click',e=>{const id=e.target?.id;if(!currentBuild||!['btn-draft-commit','btn-draft-reject'].includes(id))return;const b=currentBuild;setTimeout(async()=>{try{if(id==='btn-draft-commit'){await patch('iii_builds',b.id,{status:'committed'});await trace(b.id,'committed','Blueprint committed','The approved build entered the live world')}else{await patch('iii_builds',b.id,{status:'discarded'});await trace(b.id,'discarded','Blueprint discarded')}}catch(err){console.warn('[III REF] commit status',err)}},50)},true)}

function wrapDraft(){const engine=global.HELLO_ENGINE,current=engine?.domains?.draft;if(!current||typeof current.request!=='function'||typeof current.compile!=='function'||typeof engine.domain!=='function')return false;if(current.__iiiReferenceVersion===VERSION)return true;if(!current.__iiiHouseBindVersion)return false;const passThrough=current.request,rawRequest=rawRequestFrom(current),compileFn=current.compile;if(typeof rawRequest!=='function')return false;const wrapped=Object.assign({},current);wrapped.__iiiReferenceVersion=VERSION;wrapped.__iiiReferenceBase=current;
  wrapped.request=async function iiiReferenceFirstRequest(text,image,fix){const raw=clean(text)||'a dwelling';if(!isHabitation(raw))return passThrough(text,image,fix);requests++;lastError='';try{
      if(fix&&currentBuild?.finalCode){setWorking('CERTIFICATE REPAIR',clean(fix?.err||fix,100));const repaired=await requestWithoutGolden(rawRequest,certRepairPrompt(currentBuild.prompt,currentBuild.finalCode,fix),currentBuild.approved?.dataUrl||image,fix);currentBuild.finalCode=clean(repaired,MAX_SOURCE);return currentBuild.finalCode}
      const build=await createBuild(raw);ensureUI().passes.innerHTML='';guided=true;const ref=await referenceGate(build,image);const final=await guided3D(build,ref,rawRequest,compileFn);global.__lastDraftPrompt=raw.slice(0,20000);return final;
    }catch(err){failures++;lastError=errText(err);console.warn('[III REFERENCE] pipeline failed',err);if(currentBuild){try{await patch('iii_builds',currentBuild.id,{status:'fault'});await trace(currentBuild.id,'fault','Reference-first pipeline fault',lastError)}catch(_){}}showUI().status.textContent='FAULT · '+lastError;setActions([{label:'CLOSE',kind:'danger',run:()=>hideUI()}]);throw err}
  };engine.domain('draft',wrapped);installed++;return true}
function arm(){if(wrapDraft())return;let n=0;timer=setInterval(()=>{n++;if(wrapDraft()||n>160){clearInterval(timer);timer=0;if(n>160)lastError='HOUSE BIND / DRAFT DOMAIN DID NOT BECOME READY'}},250)}

async function listBuilds(limit=30){const {sb}=await connection();const r=await sb.from('iii_builds').select('id,prompt,status,approved_reference_id,accepted_iteration_id,created_at,updated_at').order('created_at',{ascending:false}).limit(Math.max(1,Math.min(100,limit)));if(r.error)throw r.error;return r.data||[]}
async function buildTrace(id){const {sb}=await connection();const [a,b,c,d]=await Promise.all([sb.from('iii_builds').select('*').eq('id',id).maybeSingle(),sb.from('iii_reference_images').select('*').eq('build_id',id).order('pass_index'),sb.from('iii_iterations').select('*').eq('build_id',id).order('pass_index'),sb.from('iii_trace_events').select('*').eq('build_id',id).order('created_at')]);for(const x of [a,b,c,d])if(x.error)throw x.error;return{build:a.data,references:b.data||[],iterations:c.data||[],trace:d.data||[]}}
function stats(){return{version:VERSION,installed:global.HELLO_ENGINE?.domains?.draft?.__iiiReferenceVersion===VERSION,requests,imageCalls,criticCalls,repairs,uploads,failures,guided,maxPasses,currentBuildId:currentBuild?.id||null,currentStatus:currentBuild?.row?.status||null,references:currentBuild?.references?.length||0,passes:currentBuild?.passes?.length||0,bestScore:currentBuild?.best?.score??null,lastError:lastError||null,hasImageKey:!!referenceKey(),userId:sbUser||global.III_STORE?.userId||null}}
function show(){showUI();return true}function setGuided(v){guided=!!v;return guided}function setPasses(n){maxPasses=Math.max(1,Math.min(6,Number(n)|0));return maxPasses}

global.III_REFERENCE=Object.freeze({version:VERSION,stats,show,setGuided,setPasses,setOpenAIKey:saveReferenceKey,clearOpenAIKey:clearReferenceKey,listBuilds,buildTrace,get current(){return currentBuild}});
installCommitHooks();arm();
})(window);
