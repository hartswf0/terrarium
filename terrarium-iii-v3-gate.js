/* TERRARIUM III · ARCHITECTURE V3 SHARED ENTRY GATE
 * The in-world AGENT calls HELLO_ENGINE.say('draft', ...). A failed draft
 * normally falls through to GOLDEN_DRAFTS / legacy arena generation. Houses
 * must never take that fallback. This gate reasserts V3 at the shared entry.
 */
(function installIIIV3Gate(global){
'use strict';
const VERSION='iii-v3-gate-0.1';
let timer=0, installed=false, v3Request=null, rawSay=null, intercepts=0, blockedFallbacks=0, last=null;
const clean=(v,n=2000)=>String(v==null?'':v).trim().slice(0,n);
function isHouse(t){
  try{return global.III_HOUSE_BIND?.isHabitation?.(t)??/\b(house|home|dwelling|habitat|building|architecture|castle|fortress|palace|temple|cathedral|mosque|mausoleum|shrine|pagoda|tower|cabin|cottage|villa|lodge|hut|pavilion)\b/i.test(clean(t))}
  catch(_){return false}
}
function markUI(prompt){
  global.__iiiArchitectureV3LastIntercept={prompt:clean(prompt,500),domain:'draft',at:new Date().toISOString(),gate:VERSION};
  try{global.AICON?.log?.('V3 INTERCEPTED · '+clean(prompt,70),'ok')}catch(_){}
  const root=document.getElementById('iii-ref-flow');
  const title=document.getElementById('iii-ref-title');
  const status=document.getElementById('iii-ref-status');
  if(root){root.classList.add('show');root.style.display='flex'}
  if(title)title.textContent='V3 · INTERCEPTED';
  if(status)status.textContent='REFERENCE → SPEC → PLAN → WG. Legacy house fallback is blocked.';
}
function clearStaleDraft(){
  try{const d=global.__wgDraft;if(d?.wg?.root?.parent)d.wg.root.parent.remove(d.wg.root);try{d?.wg?.reset?.()}catch(_){}global.__wgDraft=null}catch(_){}
  try{document.getElementById('proposal-ui')?.classList.add('gone')}catch(_){}
  try{const c=document.getElementById('btn-draft-commit');if(c)c.disabled=true}catch(_){}
  global.__iiiReferenceProposalBuildId=null;
}
function reassertV3(engine){
  const d=engine?.domains?.draft;
  if(!d||typeof d.compile!=='function')return false;
  if(d.__iiiArchitectureV3&&typeof d.request==='function'){
    v3Request=d.request;
    return true;
  }
  if(typeof v3Request!=='function')return false;
  const patched=Object.assign({},d,{request:v3Request,__iiiArchitectureV3:'iii-architecture-v3.0',__iiiV3GateRestored:true});
  engine.domain('draft',patched);
  return true;
}
function install(){
  const engine=global.HELLO_ENGINE;
  const d=engine?.domains?.draft;
  if(!engine||typeof engine.say!=='function'||typeof engine.domain!=='function'||!d)return false;
  if(d.__iiiArchitectureV3&&typeof d.request==='function')v3Request=d.request;
  if(typeof v3Request!=='function')return false;
  if(engine.say?.__iiiV3Gate===VERSION){installed=true;return true}
  rawSay=engine.say.bind(engine);
  const gated=async function iiiV3SharedSay(domainId,text,imageDataUrl){
    const domain=String(domainId||'').toLowerCase();
    const prompt=clean(text,20000);
    if(domain!=='draft'||!isHouse(prompt))return rawSay(domainId,text,imageDataUrl);
    intercepts++;
    last={prompt:clean(prompt,500),at:new Date().toISOString()};
    clearStaleDraft();
    markUI(prompt);
    if(!reassertV3(engine)){
      blockedFallbacks++;
      clearStaleDraft();
      const msg='V3 ROUTER NOT READY · HOUSE BUILD STOPPED';
      try{global.AICON?.log?.(msg,'err')}catch(_){}
      return {ok:true,v3Stopped:true,err:msg,cert:{solids:0,meshes:0}};
    }
    let result;
    try{result=await rawSay('draft',prompt,imageDataUrl)}
    catch(err){
      blockedFallbacks++;
      clearStaleDraft();
      const msg='V3 FAULT · '+clean(err?.message||err,500);
      try{global.AICON?.log?.(msg,'err')}catch(_){}
      return {ok:true,v3Stopped:true,err:msg,cert:{solids:0,meshes:0}};
    }
    if(!result?.ok){
      blockedFallbacks++;
      clearStaleDraft();
      const msg='V3 STOPPED · '+clean(result?.err||'draft failed',500);
      try{global.AICON?.log?.(msg,'err')}catch(_){}
      const title=document.getElementById('iii-ref-title');
      const status=document.getElementById('iii-ref-status');
      if(title)title.textContent='V3 · STOPPED';
      if(status)status.textContent=msg+' · NO LEGACY FALLBACK WAS ALLOWED.';
      return {ok:true,v3Stopped:true,err:msg,cert:{solids:0,meshes:0}};
    }
    return result;
  };
  Object.defineProperty(gated,'__iiiV3Gate',{value:VERSION});
  engine.say=gated;
  installed=true;
  return true;
}
function arm(){if(install())return;let n=0;timer=setInterval(()=>{n++;if(install()||n>240){clearInterval(timer);timer=0}},250)}
arm();
global.III_V3_GATE=Object.freeze({version:VERSION,get stats(){return{installed,intercepts,blockedFallbacks,last,hasV3Request:typeof v3Request==='function',sayGated:global.HELLO_ENGINE?.say?.__iiiV3Gate===VERSION}}});
})(window);
