/* TERRARIUM III · GARAGE MEMORY
 * PROVISIONAL. Browser for durable worlds, builds and rigs in III_STORE.
 * Accessible before ritual completion; the old rig editor remains available.
 */
(function terrariumIIIGarage(global){
'use strict';

const VERSION='iii-garage-0.1-provisional';
let tab='world_snapshot';
let rows=[];
let busy=false;
let installed=false;
let modal=null;
let library=null;
let body=null;
let status=null;
let count=null;
let legacy=[];

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=s=>{try{return new Date(s).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){return String(s||'')}};
const bytes=v=>{try{const n=new Blob([JSON.stringify(v??null)]).size;return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB'}catch(_){return'—'}};
const labelFor=t=>t==='world_snapshot'?'WORLDS':t==='build'?'BUILDS':'RIGS';

function store(){return global.III_STORE}
function notify(s){try{global.notify?.(s)}catch(_){}}

function injectStyle(){
 if(document.getElementById('iii-garage-style'))return;
 const s=document.createElement('style');s.id='iii-garage-style';s.textContent=`
 #garage-modal{z-index:390!important;width:min(900px,96vw)!important;max-height:min(90vh,920px)!important;padding:14px!important;background:rgba(4,7,9,.97)!important;border-color:rgba(57,198,187,.52)!important;box-shadow:0 24px 80px #000!important}
 #garage-modal.iii-library-mode{gap:10px!important}
 #iii-garage-library{display:flex;flex-direction:column;gap:10px;min-height:0;flex:1 1 auto;color:#e8eef2}
 #iii-garage-top{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
 .iii-g-tab{height:34px;padding:0 13px;border:1px solid #26343d;border-radius:8px;background:#091016;color:#8697a2;font:800 10px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.12em;cursor:pointer}
 .iii-g-tab.on{border-color:#39c6bb;color:#b8fff7;background:#0b1b1c}
 .iii-g-spacer{flex:1}
 .iii-g-action{height:34px;padding:0 12px;border:1px solid #44515a;border-radius:8px;background:#0b1116;color:#dce6ea;font:800 9px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.09em;cursor:pointer}
 .iii-g-action.primary{border-color:#39c6bb;color:#9ff7ef}.iii-g-action:disabled{opacity:.4;cursor:default}
 #iii-g-meta{display:flex;align-items:center;gap:10px;min-height:22px;color:#71808a;font-size:9px;letter-spacing:.1em}
 #iii-g-status{margin-left:auto;text-align:right}
 #iii-g-body{min-height:180px;max-height:58vh;overflow:auto;overscroll-behavior:contain;padding:2px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 .iii-g-card{border:1px solid #1d2a31;border-radius:11px;background:linear-gradient(145deg,#0b1115,#070a0d);padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0;cursor:default}
 .iii-g-card:hover{border-color:#38525d}
 .iii-g-type{font-size:8px;letter-spacing:.19em;color:#39c6bb;font-weight:800}
 .iii-g-title{font-size:13px;line-height:1.28;font-weight:800;color:#f1f5f7;word-break:break-word}
 .iii-g-sub{font-size:9px;line-height:1.55;color:#81909a;word-break:break-word;min-height:28px}
 .iii-g-facts{display:flex;gap:8px;flex-wrap:wrap;font-size:8px;letter-spacing:.06em;color:#65747d}
 .iii-g-buttons{display:flex;gap:6px;margin-top:auto;flex-wrap:wrap}
 .iii-g-buttons button{height:31px;padding:0 10px;border:1px solid #34434c;border-radius:7px;background:#091016;color:#cbd6db;font:800 8px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.09em;cursor:pointer}
 .iii-g-buttons button.primary{border-color:#39c6bb;color:#9df5ed}
 .iii-g-empty{grid-column:1/-1;min-height:210px;border:1px dashed #26343c;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;color:#75838c;padding:28px;font-size:10px;line-height:1.7;letter-spacing:.06em}
 .iii-g-empty b{color:#dbe5e9;letter-spacing:.12em}
 #iii-g-detail{display:none;position:absolute;inset:58px 14px 14px;background:#070b0e;border:1px solid #31454f;border-radius:12px;z-index:4;padding:14px;overflow:auto}
 #iii-g-detail.show{display:block}.iii-g-detail-head{display:flex;gap:10px;align-items:center}.iii-g-detail-head b{font-size:12px;letter-spacing:.12em}.iii-g-detail-head button{margin-left:auto;background:#0b1116;border:1px solid #46545d;color:#dce5e9;border-radius:7px;height:30px;padding:0 10px;cursor:pointer}.iii-g-detail pre{white-space:pre-wrap;word-break:break-word;font:10px/1.55 'IBM Plex Mono',monospace;color:#a9b7be;background:#050708;border:1px solid #172128;border-radius:8px;padding:10px;margin-top:10px;user-select:text;-webkit-user-select:text}
 @media(max-width:700px){#garage-modal{inset:max(52px,env(safe-area-inset-top)) 8px max(10px,env(safe-area-inset-bottom)) 8px!important;transform:none!important;width:auto!important;max-height:none!important}#iii-g-body{grid-template-columns:1fr;max-height:none;flex:1}.iii-g-tab{padding:0 9px}.iii-g-action{padding:0 9px}}
 `;document.head.appendChild(s);
}

function setLegacyVisible(on){
 legacy.forEach(({el,display})=>{el.style.display=on?display:'none'});
 if(library){library.style.display='flex';const b=library.querySelector('#iii-g-body');const m=library.querySelector('#iii-g-meta');if(b)b.style.display=on?'none':'grid';if(m)m.style.display=on?'none':'flex'}
 modal?.classList.toggle('iii-library-mode',!on);
}

function makeShell(){
 modal=document.getElementById('garage-modal');if(!modal)return false;
 injectStyle();
 if(document.getElementById('iii-garage-library')){library=document.getElementById('iii-garage-library');return true}
 library=document.createElement('section');library.id='iii-garage-library';library.innerHTML=`
 <div id="iii-garage-top">
   <button class="iii-g-tab" data-t="world_snapshot">WORLDS</button>
   <button class="iii-g-tab" data-t="build">BUILDS</button>
   <button class="iii-g-tab" data-t="avatar">RIGS</button>
   <span class="iii-g-spacer"></span>
   <button class="iii-g-action" id="iii-g-capture">SAVE CURRENT</button>
   <button class="iii-g-action" id="iii-g-editor">EDIT CURRENT RIG</button>
   <button class="iii-g-action primary" id="iii-g-refresh">REFRESH</button>
 </div>
 <div id="iii-g-meta"><span id="iii-g-count">0 SAVED</span><span id="iii-g-version">${VERSION}</span><span id="iii-g-status">READY</span></div>
 <div id="iii-g-body"></div>
 <div id="iii-g-detail" class="iii-g-detail"></div>`;
 const header=modal.firstElementChild;header?.after(library);
 legacy=[...modal.children].filter(el=>el!==header&&el!==library).map(el=>({el,display:el.style.display||''}));
 body=library.querySelector('#iii-g-body');status=library.querySelector('#iii-g-status');count=library.querySelector('#iii-g-count');
 library.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;setLegacyVisible(false);refresh()}));
 library.querySelector('#iii-g-refresh').addEventListener('click',refresh);
 library.querySelector('#iii-g-capture').addEventListener('click',captureCurrent);
 library.querySelector('#iii-g-editor').addEventListener('click',openEditor);
 return true;
}

function setStatus(text){if(status)status.textContent=text}
function tabButtons(){library?.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===tab))}

function card(row){
 const meta=row.metadata_json||{};
 const title=row.artifact_type==='avatar'
   ? (meta.name||meta.rig_name||'SAVED RIG')
   : (row.prompt||meta.scene||meta.name||labelFor(row.artifact_type).slice(0,-1));
 let sub='';
 if(row.artifact_type==='world_snapshot') sub=meta.scene?('SCENE · '+meta.scene):'FULL TERRARIUM CARTRIDGE';
 else if(row.artifact_type==='build'){
   const c=meta.cert||{};sub=[c.meshes!=null?c.meshes+' meshes':'',c.solids!=null?c.solids+' solids':'',meta.source||''].filter(Boolean).join(' · ')||'AUTHORED BUILD';
 } else sub=[meta.source||'PLAYER RIG',meta.reason||''].filter(Boolean).join(' · ');
 const primary=row.artifact_type==='world_snapshot'?'<button class="primary" data-act="open">OPEN WORLD</button>':row.artifact_type==='avatar'?'<button class="primary" data-act="equip">EQUIP</button>':'<button class="primary" data-act="prompt">USE PROMPT</button>';
 return `<article class="iii-g-card" data-id="${esc(row.id)}">
  <div class="iii-g-type">${esc(labelFor(row.artifact_type).slice(0,-1))}</div>
  <div class="iii-g-title">${esc(title)}</div>
  <div class="iii-g-sub">${esc(sub)}</div>
  <div class="iii-g-facts"><span>${esc(when(row.created_at))}</span><span>${esc(bytes(row.geometry_json))}</span>${row.room_code?'<span>ROOM '+esc(row.room_code)+'</span>':''}</div>
  <div class="iii-g-buttons">${primary}<button data-act="inspect">INSPECT</button></div>
 </article>`;
}

function render(){
 tabButtons();if(count)count.textContent=rows.length+' SAVED';
 if(!rows.length){
   body.innerHTML=`<div class="iii-g-empty"><b>NO ${labelFor(tab)} SAVED YET</b><span>${tab==='world_snapshot'?'SAVE CURRENT stores the complete world cartridge and current rig.':tab==='avatar'?'Saving a session or rig revision creates a durable rig entry.':'Committed generated builds appear here automatically.'}</span>${tab==='world_snapshot'?'<button class="iii-g-action primary" id="iii-g-empty-save">SAVE CURRENT WORLD</button>':''}</div>`;
   body.querySelector('#iii-g-empty-save')?.addEventListener('click',captureCurrent);return;
 }
 body.innerHTML=rows.map(card).join('');
 body.querySelectorAll('.iii-g-card').forEach(el=>el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;act(el.dataset.id,b.dataset.act)}));
}

async function refresh(){
 if(busy||!store()?.listOwn)return;busy=true;setStatus('SYNCING');tabButtons();
 try{rows=await store().listOwn({type:tab,limit:120});setStatus('SYNCED');render()}catch(e){console.warn('[III GARAGE] refresh',e);setStatus('SYNC FAILED');body.innerHTML='<div class="iii-g-empty"><b>GARAGE COULD NOT READ SUPABASE</b><span>'+esc(e?.message||e)+'</span></div>'}
 finally{busy=false}
}

function openLibrary(){
 if(!makeShell())return;
 modal.classList.add('show');setLegacyVisible(false);tabButtons();refresh();
 try{document.body.classList.add('iii-garage-open')}catch(_){}
}
function closeLibrary(){modal?.classList.remove('show');try{document.body.classList.remove('iii-garage-open')}catch(_){}}

async function captureCurrent(){
 if(busy||!store()?.captureSession)return;busy=true;setStatus('SAVING WORLD');
 try{const r=await store().captureSession('garage-save');await store().flush();setStatus(r?.ok?'SAVED':'NOT SAVED');notify(r?.ok?'WORLD + RIG SAVED':'WORLD COULD NOT BE SAVED');await refresh()}
 catch(e){console.warn('[III GARAGE] capture',e);setStatus('SAVE FAILED')}
 finally{busy=false}
}

function openEditor(){
 // Before ritual completion the HELLO builder *is* the rig editor. In-field,
 // preserve the legacy detailed garage editor.
 closeLibrary();
 const ritual=document.getElementById('ritual');
 const ritualVisible=ritual&&getComputedStyle(ritual).display!=='none'&&!ritual.classList.contains('gone');
 if(ritualVisible){document.getElementById('r-tab-hello')?.click();const i=document.getElementById('ritual-input');setTimeout(()=>i?.focus(),30);return}
 try{if(typeof global.openGarage==='function')global.openGarage()}catch(e){console.warn('[III GARAGE] legacy editor',e)}
}

async function act(id,action){
 const row=rows.find(r=>r.id===id);if(!row)return;
 try{
  if(action==='open'){
    setStatus('OPENING WORLD');await store().loadWorld(row);closeLibrary();notify('WORLD LOADED');
  }else if(action==='equip'){
    setStatus('EQUIPPING');await store().loadAvatar(row);closeLibrary();notify('RIG EQUIPPED');
  }else if(action==='prompt'){
    const input=document.getElementById('ritual-input');if(input){input.value=row.prompt||'';closeLibrary();document.getElementById('r-tab-hello')?.click();setTimeout(()=>{input.focus();input.select?.()},30)}
  }else if(action==='inspect') showDetail(row);
 }catch(e){console.warn('[III GARAGE] action',action,e);setStatus('ACTION FAILED');notify('GARAGE ACTION FAILED')}
}

function showDetail(row){
 const d=library.querySelector('#iii-g-detail');if(!d)return;
 const clean={id:row.id,created_at:row.created_at,type:row.artifact_type,prompt:row.prompt,room:row.room_code,session:row.session_id,metadata:row.metadata_json,geometry:row.geometry_json};
 d.innerHTML=`<div class="iii-g-detail-head"><b>${esc(labelFor(row.artifact_type).slice(0,-1))} · INSPECT</b><button id="iii-g-detail-close">CLOSE</button></div><pre>${esc(JSON.stringify(clean,null,2))}</pre>`;
 d.classList.add('show');d.querySelector('#iii-g-detail-close').onclick=()=>d.classList.remove('show');
}

function intercept(btn){
 if(!btn||btn.__iiiMemoryGarage)return;btn.__iiiMemoryGarage=true;
 // Capture phase wins before the legacy target listener, so the library can be
 // opened even while ritualComplete is false.
 btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openLibrary()},true);
}

function install(){
 if(installed)return;installed=true;if(!makeShell())return;
 intercept(document.getElementById('btn-open-garage'));
 intercept(document.getElementById('btn-mp-garage'));
 // The old X should close either the library or the legacy editor.
 document.getElementById('btn-garage-close')?.addEventListener('click',()=>{try{document.body.classList.remove('iii-garage-open')}catch(_){}},true);
 // A manual legacy SAVE creates a durable session/rig revision too.
 document.getElementById('btn-garage-save')?.addEventListener('click',()=>setTimeout(()=>store()?.captureSession?.('rig-save').catch(()=>{}),0));
 setLegacyVisible(false);modal.classList.remove('show');
 global.III_GARAGE={open:openLibrary,close:closeLibrary,refresh,version:VERSION,get tab(){return tab}};
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
