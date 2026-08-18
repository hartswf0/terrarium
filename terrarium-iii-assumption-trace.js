/* TERRARIUM III · ARCHITECTURE ASSUMPTION TRACE
 * Every architecture stage exposes what it is assuming before the next act.
 * The ledger distinguishes imposed rules, model inference, rendered evidence,
 * and warnings so a bad build can be stopped at the first false premise.
 */
(function installIIIAssumptionTrace(global){
'use strict';

const VERSION='iii-architecture-assumptions-0.1';
const POLL_MS=260;
let timer=0, installed=false, buildId=null, seq=0;
let history=[];
const persisted=new Set();
let sb=null,sbSig='';

const clean=(v,n=900)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=(v,n=900)=>{try{return clean(JSON.stringify(v),n)}catch(_){return clean(v,n)}};
const arr=v=>Array.isArray(v)?v:[];

function currentTitle(){return clean(document.getElementById('iii-ref-title')?.textContent||'',160).toUpperCase()}
function currentStatus(){return clean(document.getElementById('iii-ref-status')?.textContent||'',700)}
function passNo(title){const m=String(title||'').match(/PASS\s+(\d+)/i);return m?Number(m[1]):0}

function stage(title,c){
  if(/REFERENCE/.test(title)) return 'REFERENCE';
  if(/ARCHITECTURAL READER|ARCHITECTURAL SPEC/.test(title)) return 'READ';
  if(/GEOMETRY PLANNER|GEOMETRY PLAN/.test(title)) return 'PLAN';
  if(/WG BUILDER/.test(title)) return 'BUILD';
  if(/OBSERVING/.test(title)) return 'OBSERVE';
  if(/CRITIQUING|SCORE/.test(title)) return 'CRITIC';
  if(/REPAIRING/.test(title)) return 'REPAIR';
  if(/FAULT/.test(title)) return 'FAULT';
  if(c?.plan&&!c?.passes?.length) return 'BUILD';
  if(c?.spec&&!c?.plan) return 'PLAN';
  if(c?.reference&&!c?.spec) return 'READ';
  return 'REFERENCE';
}

function row(kind,name,value,basis=''){
  const v=clean(value,1000); if(!v)return null;
  return {kind,name:clean(name,80),value:v,basis:clean(basis,260)};
}
function rows(...xs){return xs.flat().filter(Boolean)}

function codeAudit(code){
  code=String(code||'');
  const world=[...code.matchAll(/WG\.(mound|ridge|crest|bank|deck|quarterPipe)\s*\(/g)].map(m=>m[1]);
  const ramps=(code.match(/WG\.ramp\s*\(/g)||[]).length;
  const ticks=(code.match(/WG\.tick\s*\(/g)||[]).length;
  const solids=(code.match(/WG\.solid\s*\(/g)||[]).length;
  const surfaces=(code.match(/WG\.surface\s*\(/g)||[]).length;
  const groups=(code.match(/new\s+THREE\.Group\s*\(/g)||[]).length;
  const namedStructure=/['"]STRUCTURE['"]|\.name\s*=\s*['"][^'"]*structure/i.test(code);
  const directPut=(code.match(/WG\.put\s*\(/g)||[]).length;
  return {world:[...new Set(world)],ramps,ticks,solids,surfaces,groups,namedStructure,directPut};
}

function referenceRows(c){
  return rows(
    row('system','BOUNDARY','One bounded inhabitable STRUCTURE is being designed. Terrain, roads, arena furniture, and surrounding world are outside the structure compiler.','compiler contract'),
    row('system','TARGET','The user-approved reference image is the visual target. It may be revised before architecture is read.','approval gate'),
    row('system','UNKNOWN','Topology, exact dimensions, support strategy, and primitive strategy remain provisional until the Reader and Planner infer them.','do not silently promote guesses to facts'),
    row('evidence','REQUEST',c?.request||'', 'user input')
  );
}

function readRows(c){
  const s=c?.spec||{};
  const inv=arr(s.invariants).map(x=>typeof x==='string'?x:json(x,220)).join(' · ');
  const forbid=arr(s.forbidden_translations).map(x=>typeof x==='string'?x:json(x,180)).join(' · ');
  return rows(
    row('inference','GOVERNING FIGURE',s?.governing_figure?.summary||json(s?.governing_figure||''),'model inference from approved image + request'),
    row('inference','TOPOLOGY',s?.topology?.summary||json(s?.topology||''),'model inference from approved image'),
    row('inference','SCALE',json(s?.scale||{}),'estimated from visual human-scale cues; not measured fact'),
    row('inference','ARRIVAL',json(s?.arrival||{}),'inferred entry/grade relationship'),
    row('inference','STRUCTURE',json(s?.structure||{}),'inferred support posture'),
    row('system','INVARIANTS',inv,'locked after Reader; repair should not move these goalposts'),
    row('system','FORBIDDEN TRANSLATIONS',forbid,'explicit anti-drift constraints')
  );
}

function planRows(c){
  const p=c?.plan||{};
  const ids=arr(p.assemblies).map(a=>a?.id||a?.name||a?.type).filter(Boolean).slice(0,18).join(' · ');
  return rows(
    row('inference','CONSTRUCTION THESIS',p.construction_thesis||'', 'Planner interpretation of immutable architectural spec'),
    row('inference','TARGET BOUNDS',json(p.target_bounds||{}),'planned dimensions; must later be checked against observed render'),
    row('inference','ASSEMBLIES',ids||`${arr(p.assemblies).length} assemblies`,'addressable building parts, not world objects'),
    row('inference','DEFINING VOIDS',json(p.void_strategy||[]),'voids are geometry and must remain open'),
    row('inference','PRIMITIVE STRATEGY',json(p.primitive_strategy||{}),'chosen representation for governing form'),
    row('inference','COLLISION STRATEGY',json(p.collision_strategy||{}),'physics is a coarse proxy, not a copy of visible parts'),
    row('system','FORBIDDEN MOVES',arr(p.forbidden_moves).map(x=>typeof x==='string'?x:json(x,180)).join(' · '),'locked anti-world / anti-fallback constraints')
  );
}

function buildRows(c){
  const p=c?.plan||{};
  const last=arr(c?.passes).at(-1);
  const audit=last?.code?codeAudit(last.code):null;
  const out=rows(
    row('system','STRUCTURE ROOT','All authored building geometry should belong to one bounded structure object before world placement.','structure compiler law'),
    row('system','WORLD VERBS','Terrain/world verbs are forbidden by default inside a building. Site/world generation happens after the structure is accepted.','structure ≠ world'),
    row('system','VISUAL / PHYSICS','Visible architecture may be rich; collision must be a small proxy model generated separately.','physics split'),
    row('inference','BUILD ORDER',arr(p.generation_order).map(x=>typeof x==='string'?x:json(x,120)).join(' → '),'geometry plan')
  );
  if(audit){
    out.push(row(audit.world.length?'warning':'evidence','WORLD VERBS FOUND',audit.world.length?audit.world.join(', '):'none','static source audit'));
    out.push(row(audit.ticks?'warning':'evidence','ANIMATION',audit.ticks?`${audit.ticks} WG.tick call(s)`:'none','static source audit'));
    out.push(row('evidence','PHYSICS REGISTRATIONS',`WG.solid ${audit.solids} · WG.surface ${audit.surfaces}`,'source occurrences; runtime bodies may differ'));
    out.push(row(audit.namedStructure?'evidence':'warning','BOUNDED STRUCTURE ROOT',audit.namedStructure?'named structure root detected':`not explicitly named; ${audit.groups} THREE.Group call(s)`,'static source audit'));
    out.push(row('evidence','DIRECT WG.PUT',`${audit.directPut} call(s)`,'many root-level puts can indicate world-like rather than bounded assembly'));
  }
  return out.filter(Boolean);
}

function observedRows(c,pass){
  const p=arr(c?.passes).find(x=>x.pass===pass)||arr(c?.passes).at(-1);
  const m=p?.metrics||{};
  const audit=p?.code?codeAudit(p.code):null;
  return rows(
    row('evidence','MEASURED BOUNDS',m.width!=null?`${m.width} × ${m.depth} × ${m.height} m · minY ${m.minY}`:'waiting for render','actual rendered geometry'),
    row('evidence','RENDER COMPLEXITY',m.meshes!=null?`${m.meshes} visible meshes`:'waiting','observer'),
    row('evidence','PHYSICS',m.solids!=null?`${m.solids} collision bodies`:'waiting','compiled WG consequence'),
    audit&&audit.world.length?row('warning','WORLD-LIKE SOURCE',`Uses ${audit.world.join(', ')}`,'building code is authoring terrain/world operations'):null
  );
}

function criticRows(c,pass){
  const p=arr(c?.passes).find(x=>x.pass===pass)||arr(c?.passes).at(-1),q=p?.critic||{};
  return rows(
    row('evidence','WHAT IT SAW',q.saw||'waiting for critic','multimodal comparison: approved target vs actual 3D'),
    row('inference','PRIMARY FAILURE',q.primary_failure||'waiting','critic diagnosis'),
    row('evidence','EVIDENCE',json(q.evidence||{}),'critic-reported view/evidence'),
    row('inference','NEXT CHANGE',json(q.next_change||{}),'proposed highest-leverage repair; not yet proven'),
    row('system','PRESERVE',arr(q.preserve).map(x=>typeof x==='string'?x:json(x,140)).join(' · '),'features repair is not allowed to regress'),
    row('evidence','SCORE / ACCEPT',q.score!=null?`${q.score}/100 · accept=${q.accept===true}`:'waiting','only a rendered pass may be judged')
  );
}

function repairRows(c,pass){
  const p=arr(c?.passes).find(x=>x.pass===pass)||arr(c?.passes).at(-1),q=p?.critic||{};
  return rows(
    row('inference','REPAIR HYPOTHESIS',json(q.next_change||{}),'critic proposal to be tested by the next render'),
    row('system','IMMUTABLE','Approved reference + architectural spec + geometry plan remain fixed during ordinary repair.','prevents moving the goalposts'),
    row('system','PROOF REQUIRED','The repair is not an improvement until the next observation demonstrates it.','consequence outranks intention')
  );
}

function payload(stageName,c,title){
  const pass=passNo(title)||arr(c?.passes).at(-1)?.pass||0;
  let rs=[];
  if(stageName==='REFERENCE')rs=referenceRows(c);
  else if(stageName==='READ')rs=readRows(c);
  else if(stageName==='PLAN')rs=planRows(c);
  else if(stageName==='BUILD')rs=buildRows(c);
  else if(stageName==='OBSERVE')rs=[...buildRows(c),...observedRows(c,pass)];
  else if(stageName==='CRITIC')rs=[...observedRows(c,pass),...criticRows(c,pass)];
  else if(stageName==='REPAIR')rs=repairRows(c,pass);
  else if(stageName==='FAULT')rs=rows(row('warning','FAULT',currentStatus()||'pipeline stopped','no later stage should be trusted'));
  return {version:VERSION,buildId:c?.id||null,request:c?.request||'',stage:stageName,pass,title,at:new Date().toISOString(),rows:rs};
}

function ensurePanel(){
  const flow=document.getElementById('iii-ref-flow'); if(!flow)return null;
  let panel=document.getElementById('iii-assumption-trace');
  if(!panel){
    panel=document.createElement('section'); panel.id='iii-assumption-trace';
    panel.style.cssText='order:0;margin:8px 0;border:1px solid #303942;background:#070a0d;padding:8px;font:10px/1.42 monospace;color:#e9eef2';
    const note=flow.querySelector('#iii-ref-note'); if(note)flow.insertBefore(panel,note); else flow.appendChild(panel);
  }
  return panel;
}
function color(kind){return kind==='warning'?'#ff5a54':kind==='inference'?'#e7b94f':kind==='evidence'?'#eef1f4':'#19e6c8'}
function render(active){
  const panel=ensurePanel(); if(!panel)return;
  const shown=history.slice(-10);
  panel.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px"><b style="letter-spacing:.18em;color:#19e6c8">ASSUMPTION TRACE</b><span style="color:#7f8a94">${esc(VERSION)}</span></div>`+
    shown.map((h,i)=>{
      const isActive=h.seq===active.seq;
      const body=h.rows.map(r=>`<div style="border-top:1px solid #1c232a;padding:5px 0"><div><b style="color:${color(r.kind)}">${esc(r.kind.toUpperCase())}</b> · <b>${esc(r.name)}</b></div><div style="color:#d9dfe4;margin-top:2px">${esc(r.value)}</div>${r.basis?`<div style="color:#75808a;margin-top:2px">basis · ${esc(r.basis)}</div>`:''}</div>`).join('');
      return `<details ${isActive?'open':''} style="border-top:1px solid ${isActive?'#19e6c8':'#252d34'};padding:5px 0"><summary style="cursor:pointer;color:${isActive?'#19e6c8':'#9aa5ae'}"><b>STEP ${esc(h.stage)}</b>${h.pass?` · PASS ${h.pass}`:''}</summary>${body||'<div style="color:#75808a;padding:5px 0">waiting for assumptions…</div>'}</details>`;
    }).join('');
}

async function connection(){
  try{
    const cfg=global.III_NET?.config?.()||{},url=String(cfg.url||'').replace(/\/+$/,''),key=String(cfg.key||''),create=global.supabase?.createClient;
    if(typeof create!=='function'||!url||key.length<20)return null;
    const sig=url+'|'+key;if(!sb||sbSig!==sig){sbSig=sig;sb=create(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})}
    const r=await sb.auth.getSession(); if(r.error||!r.data?.session?.user?.id)return null; return sb;
  }catch(_){return null}
}
async function persist(p){
  if(!p.buildId)return; const key=`${p.buildId}|${p.stage}|${p.pass}|${JSON.stringify(p.rows)}`; if(persisted.has(key))return; persisted.add(key);
  const client=await connection(); if(!client)return;
  const detail=p.rows.map(r=>`${r.kind}:${r.name}=${r.value}`).join(' | ').slice(0,4000);
  const r=await client.from('iii_trace_events').insert({build_id:p.buildId,phase:'assumption',label:`ASSUMPTIONS · ${p.stage}${p.pass?` · PASS ${p.pass}`:''}`,detail,payload_json:p}).select('id').maybeSingle();
  if(r.error)console.warn('[III ASSUMPTIONS persist]',r.error);
}

function tick(){
  const arch=global.III_ARCHITECTURE,c=arch?.current; if(!arch||!c){return}
  if(buildId!==c.id){buildId=c.id;history=[];persisted.clear();seq=0}
  const title=currentTitle(),s=stage(title,c),p=payload(s,c,title);
  const signature=JSON.stringify({stage:p.stage,pass:p.pass,rows:p.rows});
  const last=history.at(-1);
  if(!last||last.signature!==signature){
    const h={...p,seq:++seq,signature}; history.push(h); if(history.length>18)history.shift(); render(h); persist(p).catch(()=>{});
    global.__iiiAssumptionTrace=history.map(x=>({...x,signature:undefined}));
    try{document.dispatchEvent(new CustomEvent('iii-architecture-assumptions',{detail:p}))}catch(_){}
  }else render(last);
}
function install(){if(installed)return;installed=true;timer=setInterval(tick,POLL_MS);tick()}
install();
global.III_ASSUMPTIONS=Object.freeze({version:VERSION,get history(){return global.__iiiAssumptionTrace||[]},refresh:tick});
})(window);
