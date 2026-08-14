/* TERRARIUM III durable session sidecar
 * PROVISIONAL. Persistence is never on the live world's critical path.
 */
(function terrariumIIIStore(global){
'use strict';
const TABLE='iii_artifacts';
const VERSION='iii-store-0.4-provisional';
const DB='terrarium-iii-store', QUEUE='queue', DBV=1;
const TYPES=new Set(['prompt','geometry','build','world_snapshot','avatar']);
const SESSION_ID=crypto.randomUUID?crypto.randomUUID():'s-'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const memory=new Map(), authMemory=new Map();
let dbp=null, client=null, clientKey='', userId='', authState='idle', flushP=null, retry=null;
let written=0, failed=0, captured=0, lastError='', lastWriteAt=0;
const RETRY=[1500,5000,15000,30000,60000]; let retryStep=0;

function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]&15,v=c==='x'?r:(r&3|8);return v.toString(16);});}
function emit(name,detail){try{global.dispatchEvent(new CustomEvent(name,{detail}));}catch(_){}}
function cfg(){const c=global.III_NET?.config?.()||{};return{url:String(c.url||'').replace(/\/+$/,''),key:String(c.key||'')}}
function projectRef(url){try{return new URL(url).hostname.split('.')[0]||'default'}catch(_){return'default'}}
function storage(name){try{return global[name]||null}catch(_){return null}}
function authStore(ref){const p='terrarium-iii-auth:'+ref+':';return{
 getItem(k){k=p+k;try{const v=storage('localStorage')?.getItem(k);if(v!=null)return v}catch(_){}try{const v=storage('sessionStorage')?.getItem(k);if(v!=null)return v}catch(_){}return authMemory.get(k)||null},
 setItem(k,v){k=p+k;v=String(v);try{storage('localStorage')?.setItem(k,v);authMemory.set(k,v);return}catch(_){}try{storage('sessionStorage')?.setItem(k,v);authMemory.set(k,v);return}catch(_){}authMemory.set(k,v)},
 removeItem(k){k=p+k;try{storage('localStorage')?.removeItem(k)}catch(_){}try{storage('sessionStorage')?.removeItem(k)}catch(_){}authMemory.delete(k)}
}}
function makeClient(){const c=cfg(),f=global.supabase?.createClient;if(typeof f!=='function')throw Error('SUPABASE CLIENT NOT AVAILABLE');if(!/^https?:\/\//.test(c.url)||c.key.length<20)throw Error('SUPABASE CONFIG NOT READY');const id=c.url+'|'+c.key;if(client&&clientKey===id)return client;clientKey=id;userId='';authState='idle';client=f(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:authStore(projectRef(c.url)),storageKey:'session'}});return client}
async function identity(){const sb=makeClient();authState='opening';let r=await sb.auth.getSession();if(r.error)throw r.error;let s=r.data?.session;if(!s?.user?.id){r=await sb.auth.signInAnonymously();if(r.error)throw r.error;s=r.data?.session}if(!s?.user?.id)throw Error('ANONYMOUS AUTH DID NOT RETURN A USER');userId=s.user.id;authState='ready';return{sb,userId}}
function openDB(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{if(!global.indexedDB)return rej(Error('INDEXEDDB UNAVAILABLE'));const q=indexedDB.open(DB,DBV);q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:'id'}).createIndex('created_at','created_at')};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}).catch(()=>null);return dbp}
async function put(r){memory.set(r.id,r);const d=await openDB();if(!d)return;await new Promise(res=>{const t=d.transaction(QUEUE,'readwrite');t.objectStore(QUEUE).put(r);t.oncomplete=t.onerror=t.onabort=()=>res()})}
async function del(id){memory.delete(id);const d=await openDB();if(!d)return;await new Promise(res=>{const t=d.transaction(QUEUE,'readwrite');t.objectStore(QUEUE).delete(id);t.oncomplete=t.onerror=t.onabort=()=>res()})}
async function listQueue(limit=30){const out=new Map(memory);const d=await openDB();if(d)await new Promise(res=>{const t=d.transaction(QUEUE,'readonly'),q=t.objectStore(QUEUE).index('created_at').openCursor();q.onsuccess=()=>{const c=q.result;if(!c||out.size>=limit)return res();out.set(c.value.id,c.value);c.continue()};q.onerror=()=>res()});return[...out.values()].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).slice(0,limit)}
function safe(v,max=1800000){if(v==null)return null;try{const s=JSON.stringify(v);if(s.length>max)return{omitted:true,chars:s.length};return JSON.parse(s)}catch(_){return null}}
function norm(i={}){const type=TYPES.has(i.artifact_type)?i.artifact_type:(TYPES.has(i.type)?i.type:'build');return{id:String(i.id||uuid()),created_at:i.created_at||new Date().toISOString(),artifact_type:type,room_code:String(i.room_code??i.roomCode??global.III_NET?.room??'').slice(0,64)||null,session_id:String(i.session_id??i.sessionId??SESSION_ID).slice(0,128),prompt:i.prompt==null?null:String(i.prompt).slice(0,20000),geometry_json:safe(i.geometry_json??i.geometry),metadata_json:safe(i.metadata_json??i.metadata,250000)||{},client_version:VERSION,parent_id:i.parent_id??i.parentId??null}}
function schedule(){if(retry||!navigator.onLine)return;const ms=RETRY[Math.min(retryStep++,RETRY.length-1)];retry=setTimeout(()=>{retry=null;flush().catch(()=>{})},ms)}
async function flush(){if(flushP)return flushP;flushP=(async()=>{const batch=await listQueue();if(!batch.length||!navigator.onLine)return{ok:true,flushed:0,remaining:batch.length};let who;try{who=await identity()}catch(e){authState='fault';failed++;lastError=String(e?.message||e);schedule();return{ok:false,error:lastError,remaining:batch.length}}let n=0;for(const q of batch){const row={...q,user_id:who.userId};const r=await who.sb.from(TABLE).insert(row);if(r.error&&String(r.error.code)!=='23505'){failed++;lastError=r.error.message||String(r.error);schedule();break}await del(q.id);n++;written++;lastWriteAt=Date.now()}if(n===batch.length)retryStep=0;const rem=(await listQueue()).length;if(rem)schedule();emit('terrarium:store-status',{ok:true,flushed:n,remaining:rem});return{ok:true,flushed:n,remaining:rem}})().finally(()=>flushP=null);return flushP}
async function recordArtifact(i){try{const r=norm(i);await put(r);queueMicrotask(()=>flush().catch(()=>{}));return{ok:true,id:r.id,queued:true}}catch(e){failed++;lastError=String(e?.message||e);return{ok:false,error:lastError}}}
const recordBuild=i=>recordArtifact({...i,artifact_type:'build'});
const recordWorldSnapshot=i=>recordArtifact({...i,artifact_type:'world_snapshot'});
const recordAvatar=i=>recordArtifact({...i,artifact_type:'avatar'});

function cart(){try{return global.__cart?.serialize?.()||null}catch(e){console.warn('[III STORE] cartridge snapshot',e);return null}}
function vehicleFromCart(c){return c?.entities?.find?.(e=>e?.kind==='vehicle')||null}
async function captureSession(reason='commit',parentId=null){const c=cart();if(!c)return{ok:false,error:'CARTRIDGE NOT READY'};const prompt=String(c.world?.prompt||global.__lastWorldPrompt||global.__lastDraftPrompt||'').slice(0,20000);const world=await recordWorldSnapshot({prompt,geometry:c,metadata:{source:'cartridge',reason,scene:c.meta?.name||null,parent_build:parentId}});const v=vehicleFromCart(c);let avatar=null;if(v)avatar=await recordAvatar({prompt:'PLAYER RIG',geometry:v.rig||v,metadata:{source:'cartridge-vehicle',reason,world_snapshot:world.id||null,at:v.at||null}});return{ok:true,world,avatar}}

async function listOwn({type=null,limit=100}={}){const who=await identity();let q=who.sb.from(TABLE).select('id,created_at,artifact_type,prompt,geometry_json,metadata_json,client_version,parent_id,session_id,room_code').order('created_at',{ascending:false}).limit(Math.max(1,Math.min(250,limit)));if(type)q=q.eq('artifact_type',type);const r=await q;if(r.error)throw r.error;return r.data||[]}
async function get(id){const who=await identity(),r=await who.sb.from(TABLE).select('*').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data}
async function loadWorld(id){const r=typeof id==='string'?await get(id):id;if(!r||r.artifact_type!=='world_snapshot')throw Error('NOT A WORLD SNAPSHOT');const c=r.geometry_json;if(!c||c.format!=='thunder-rigs.cartridge/v1')throw Error('SNAPSHOT HAS NO CARTRIDGE');if(typeof global.__ingestData==='function')return global.__ingestData(c,'SUPABASE '+r.id);return global.__cart?.load?.(c)}
async function loadAvatar(id){const r=typeof id==='string'?await get(id):id;if(!r||r.artifact_type!=='avatar')throw Error('NOT AN AVATAR');const rig=r.geometry_json?.rig||r.geometry_json;if(!rig)return false;const c=cart();if(!c)return false;const v=vehicleFromCart(c);if(!v)return false;v.rig=rig;return global.__cart?.load?.(c)}

function captureDraft(){const proposal=document.getElementById('proposal-ui');if(!proposal||proposal.classList.contains('gone'))return null;const d=global.__wgDraft;if(d?.code)return{prompt:String(global.__lastDraftPrompt||'construction'),geometry:{format:'terrarium-wg-code',code:String(d.code),cert:d.cert||null},metadata:{source:'wg-blueprint',capture:'commit-boundary',cert:d.cert||null}};const ai=global.__ai?.last;if(ai&&(ai.reply||ai.prompt))return{prompt:String(ai.prompt||''),geometry:{format:'model-reply',task:ai.task||'arena',reply:String(ai.reply||'')},metadata:{source:'legacy-ai-blueprint',capture:'commit-boundary'}};return null}
function installCommit(){const attach=()=>{const b=document.getElementById('btn-draft-commit');if(!b||b.__iiiStore04)return false;b.__iiiStore04=true;b.addEventListener('click',()=>{const d=captureDraft();if(!d)return;setTimeout(async()=>{const p=document.getElementById('proposal-ui');if(!p?.classList.contains('gone'))return;captured++;const build=await recordBuild(d);await captureSession('commit',build.id).catch(()=>{})},0)},true);return true};if(!attach())document.addEventListener('DOMContentLoaded',attach,{once:true})}

// Forge bake guard: generated meshes may legally use material arrays. The old
// bake assumed one material and spammed clone errors. Normalize only for baking.
function installBakeGuard(){const old=global.__forgeBake;if(typeof old!=='function'||old.__iiiGuard)return;const wrapped=function(root){try{root?.traverse?.(m=>{if(!m?.isMesh||!m.material)return;if(Array.isArray(m.material)){const first=m.material.find(x=>x&&typeof x.clone==='function');if(first)m.material=first}})}catch(_){}return old(root)};wrapped.__iiiGuard=true;global.__forgeBake=wrapped}

// localStorage is allowed to fail; preserve loadout at least for the tab while
// Supabase/IndexedDB carry the durable copy.
function installLoadoutStorageShim(){let mem=null;const proto=global.Storage?.prototype;if(!proto||proto.__iiiLoadoutShim)return;const set=proto.setItem,get=proto.getItem;proto.setItem=function(k,v){try{return set.call(this,k,v)}catch(e){if(k!=='trig.loadout.v1')throw e;mem=String(v);try{global.sessionStorage&&set.call(global.sessionStorage,k,v)}catch(_){}console.warn('[loadout] localStorage full; using session + Supabase');}};proto.getItem=function(k){const v=get.call(this,k);if(v!=null||k!=='trig.loadout.v1')return v;try{return global.sessionStorage&&get.call(global.sessionStorage,k)||mem}catch(_){return mem}};proto.__iiiLoadoutShim=true}

async function ready(){await openDB();if((await listQueue()).length)queueMicrotask(()=>flush().catch(()=>{}));return{ok:true,pending:(await listQueue()).length}}
function stats(){return{version:VERSION,table:TABLE,sessionId:SESSION_ID,auth:authState,userId:userId||null,queued:memory.size,written,failed,captured,lastWriteAt:lastWriteAt||null,lastError:lastError||null}}

global.III_STORE={ready,flush,recordArtifact,recordBuild,recordWorldSnapshot,recordAvatar,captureSession,listOwn,get,loadWorld,loadAvatar,stats,get userId(){return userId||null},get sessionId(){return SESSION_ID}};
global.addEventListener('terrarium:artifact',e=>recordArtifact(e?.detail||{}).catch(()=>{}));global.addEventListener('online',()=>flush().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush().catch(()=>{})});
installLoadoutStorageShim();installCommit();setTimeout(()=>{installBakeGuard();ready().catch(()=>{})},0);setTimeout(installBakeGuard,1500);
})(window);
