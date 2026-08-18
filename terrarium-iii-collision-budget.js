/* TERRARIUM III · ARCHITECTURE COLLISION BUDGET
 * 120 is a physics safety ceiling, never an architectural part ceiling.
 * House drafts may render hundreds of meshes while collision is represented by
 * a much smaller proxy set. This is a runtime safety net for old/generated WG
 * source that still marks every visible architectural piece WG.solid().
 */
(function installIIIArchitectureCollisionBudget(global){
'use strict';
const VERSION='iii-architecture-collision-budget-0.2';
const HARD=120;
const HOUSE_TARGET=80;
const HOUSE_RE=/\b(house|home|dwelling|habitat|building|architecture|castle|fortress|palace|temple|cathedral|mosque|mausoleum|shrine|pagoda|tower|cabin|cottage|villa|lodge|hut|pavilion|donut)\b/i;
let installed=false,timer=0,demotions=0,last=null;
const n=v=>Math.max(0,Number(v)||0);
function houseDraft(){const prompt=String(global.__lastDraftPrompt||global.__iiiArchitectureV3LastIntercept?.prompt||'');return HOUSE_RE.test(prompt)}
function importance(entry,index){const d=entry?.dims||{};const l=Math.max(.01,n(d.l||d.x||1)),h=Math.max(.01,n(d.h||d.y||1)),w=Math.max(.01,n(d.w||d.z||1));const area=l*w,volume=l*h*w;const mesh=entry?.mesh;const surface=mesh?.userData?.surface?1:0;const slab=(h<=1.0&&area>=3)?1:0;const wall=(h>=1.6&&Math.min(l,w)<=1.4&&Math.max(l,w)>=2)?1:0;return surface*1e9+slab*2e8+wall*1e8+area*1e5+volume*100-index*.001}
function demote(wg,target){if(!wg||!Array.isArray(wg.pending)||wg.pending.length<=target)return null;const before=wg.pending.slice();const ranked=before.map((entry,index)=>({entry,index,score:importance(entry,index)})).sort((a,b)=>b.score-a.score);const keep=new Set(ranked.slice(0,target).map(x=>x.entry));const kept=[],dropped=[];for(const entry of before){if(keep.has(entry))kept.push(entry);else{dropped.push(entry);try{entry.mesh.userData._wgCollisionDemoted=true}catch(_){}}}wg.pending.splice(0,wg.pending.length,...kept);wg._iiiCollisionBudget={version:VERSION,before:before.length,after:kept.length,dropped:dropped.length,target};demotions++;last={before:before.length,after:kept.length,dropped:dropped.length,target,at:new Date().toISOString()};try{global.AICON?.log?.(`HOUSE COLLISION · ${before.length} → ${kept.length} bodies · visuals preserved`,'wrn')}catch(_){}return wg._iiiCollisionBudget}
function install(){const kit=global.WGKIT;if(!kit||typeof kit.validateDraft!=='function')return false;if(kit.validateDraft.__iiiCollisionBudget===VERSION){installed=true;return true}const raw=kit.validateDraft.bind(kit);const wrapped=function iiiValidateDraftCollisionBudget(wg){try{wg?.sanitize?.();wg?.harvest?.();if(houseDraft()&&Array.isArray(wg?.pending)&&wg.pending.length>HOUSE_TARGET)demote(wg,HOUSE_TARGET);else if(Array.isArray(wg?.pending)&&wg.pending.length>HARD)demote(wg,HARD)}catch(err){console.warn('[III COLLISION] budget pass',err)}return raw(wg)};Object.defineProperty(wrapped,'__iiiCollisionBudget',{value:VERSION});kit.validateDraft=wrapped;installed=true;return true}
function arm(){if(install())return;let tries=0;timer=setInterval(()=>{tries++;if(install()||tries>320){clearInterval(timer);timer=0}},250)}
arm();global.III_COLLISION_BUDGET=Object.freeze({version:VERSION,HARD,HOUSE_TARGET,get stats(){return{installed,demotions,last}}});
})(window);
