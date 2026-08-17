/* TERRARIUM III · PRODUCTIVE WORLDTEXT LANGUAGE
 * PROVISIONAL v0.2.
 *
 * Finite grammar, unbounded composition. No UI. The existing HELLO ritual,
 * FORGE compiler, WG admission, commit, multiplayer and persistence paths stay
 * authoritative. This sidecar only (1) teaches WORLD/DRAFT requests to compile
 * unfamiliar descriptions compositionally and (2) adds a few general geometric
 * verbs to each WG instance rather than adding noun-specific templates.
 */
(function installIIIWorldText(global){
'use strict';

const VERSION = 'iii-worldtext-0.2-productive';
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
let readyEventSent = false;
let wgOpsPatched = false;

function cleanText(v){
  return String(v == null ? '' : v).trim().slice(0, 12000);
}
function clampInt(v, lo, hi, fallback){
  v = Number(v);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback;
}
function num(v, fallback=0){ v=Number(v); return Number.isFinite(v)?v:fallback; }
function p3(v){
  if (Array.isArray(v)) return {x:num(v[0]),y:num(v[1]),z:num(v[2])};
  v=v||{}; return {x:num(v.x),y:num(v.y),z:num(v.z)};
}
function transformMesh(mesh, opts){
  opts=opts||{};
  mesh.position.set(num(opts.x),num(opts.y),num(opts.z));
  mesh.rotation.y=num(opts.ry);
  return mesh;
}
function visualMesh(THREE, wg, verts, indices, mat, opts, op){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  if(indices&&indices.length)geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);
  mesh.userData=Object.assign(mesh.userData||{},{_wgVisual:true,worldtextOp:op||'form'});
  transformMesh(mesh,opts);
  wg.root.add(mesh);
  return mesh;
}
function fanCaps(indices, ringCount, ringSize){
  // Triangulation is deliberately a convex fan. Complex concave profiles should
  // be decomposed into several forms: composition beats a brittle mega-boolean.
  if(ringSize<3)return;
  for(let i=1;i<ringSize-1;i++)indices.push(0,i+1,i);
  const b=(ringCount-1)*ringSize;
  for(let i=1;i<ringSize-1;i++)indices.push(b,b+i,b+i+1);
}

function installWGVerbs(wg, THREE){
  if(!wg||!THREE||wg.__iiiWorldTextOps===VERSION)return wg;

  wg.repeat=function repeat(count, fn){
    const n=clampInt(count,0,64,0),out=[];
    if(typeof fn!=='function')return out;
    for(let i=0;i<n;i++)out.push(fn(i,n));
    return out;
  };

  // PROFILE [[x,y], ...] carried through depth on local Z.
  wg.extrude=function extrude(profile, depth, mat, opts){
    const pts=(Array.isArray(profile)?profile:[]).slice(0,32).map(q=>[num(q&&q[0]),num(q&&q[1])]);
    if(pts.length<3)throw new Error('WG.extrude requires 3+ profile points');
    const d=Math.max(.02,Math.abs(num(depth,1))),z0=-d/2,z1=d/2,verts=[],idx=[],n=pts.length;
    for(const z of [z0,z1])for(const q of pts)verts.push(q[0],q[1],z);
    fanCaps(idx,2,n);
    for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(i,j,n+j,i,n+j,n+i);}
    return visualMesh(THREE,wg,verts,idx,mat,opts,'extrude');
  };

  // PROFILE [[radius,y], ...] rotated around local Y.
  wg.revolve=function revolve(profile, mat, opts){
    opts=opts||{};
    const prof=(Array.isArray(profile)?profile:[]).slice(0,32).map(q=>[Math.max(0,num(q&&q[0])),num(q&&q[1])]);
    if(prof.length<2)throw new Error('WG.revolve requires 2+ [radius,y] points');
    const seg=clampInt(opts.segments,6,48,16),verts=[],idx=[];
    for(const q of prof)for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;verts.push(Math.cos(a)*q[0],q[1],Math.sin(a)*q[0]);}
    for(let r=0;r<prof.length-1;r++)for(let i=0;i<seg;i++){const j=(i+1)%seg,a=r*seg+i,b=r*seg+j,c=(r+1)*seg+j,d=(r+1)*seg+i;idx.push(a,b,c,a,c,d);}
    return visualMesh(THREE,wg,verts,idx,mat,opts,'revolve');
  };

  // SECTIONS [{y,rx,rz,x?,z?}, ...] make a continuously changing elliptical body.
  wg.loft=function loft(sections, mat, opts){
    opts=opts||{};
    const ss=(Array.isArray(sections)?sections:[]).slice(0,24);
    if(ss.length<2)throw new Error('WG.loft requires 2+ sections');
    const seg=clampInt(opts.segments,6,32,12),verts=[],idx=[];
    for(const s0 of ss){const s=s0||{},rx=Math.max(.02,Math.abs(num(s.rx,1))),rz=Math.max(.02,Math.abs(num(s.rz,rx))),cx=num(s.x),cz=num(s.z),y=num(s.y);for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;verts.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);}}
    for(let r=0;r<ss.length-1;r++)for(let i=0;i<seg;i++){const j=(i+1)%seg,a=r*seg+i,b=r*seg+j,c=(r+1)*seg+j,d=(r+1)*seg+i;idx.push(a,b,c,a,c,d);}
    fanCaps(idx,ss.length,seg);
    return visualMesh(THREE,wg,verts,idx,mat,opts,'loft');
  };

  // PATH [[x,y,z], ...] carries an elliptical section along a 3D polyline.
  wg.sweep=function sweep(path, section, mat, opts){
    opts=opts||{}; section=(typeof section==='number'?{rx:section,ry:section}:section)||{};
    const pp=(Array.isArray(path)?path:[]).slice(0,32).map(p3);
    if(pp.length<2)throw new Error('WG.sweep requires 2+ path points');
    const seg=clampInt(opts.segments,6,24,10),rx=Math.max(.02,Math.abs(num(section.rx,1))),ry=Math.max(.02,Math.abs(num(section.ry,rx))),verts=[],idx=[];
    for(let k=0;k<pp.length;k++){
      const a=pp[Math.max(0,k-1)],b=pp[Math.min(pp.length-1,k+1)],tx=b.x-a.x,tz=b.z-a.z,L=Math.hypot(tx,tz),sx=L>1e-6?-tz/L:1,sz=L>1e-6?tx/L:0,c=pp[k];
      for(let i=0;i<seg;i++){const q=i/seg*Math.PI*2,side=Math.cos(q)*rx,up=Math.sin(q)*ry;verts.push(c.x+sx*side,c.y+up,c.z+sz*side);}
    }
    for(let r=0;r<pp.length-1;r++)for(let i=0;i<seg;i++){const j=(i+1)%seg,a=r*seg+i,b=r*seg+j,c=(r+1)*seg+j,d=(r+1)*seg+i;idx.push(a,b,c,a,c,d);}
    fanCaps(idx,pp.length,seg);
    return visualMesh(THREE,wg,verts,idx,mat,opts,'sweep');
  };

  // Constructive CUT for a rectangular host: build four legal pieces around a
  // rectangular aperture. The hole is real in both render and collision space.
  wg.cut=function cut(width,height,depth,opening,mat,opts){
    opts=opts||{}; opening=opening||{};
    const W=Math.max(.05,Math.abs(num(width,4))),H=Math.max(.05,Math.abs(num(height,4))),D=Math.max(.05,Math.abs(num(depth,.4)));
    const ow=Math.min(W-.02,Math.max(.05,Math.abs(num(opening.w,W*.35)))),oh=Math.min(H-.02,Math.max(.05,Math.abs(num(opening.h,H*.55))));
    const ox=Math.max(-W/2+ow/2,Math.min(W/2-ow/2,num(opening.x))),oy=Math.max(-H/2+oh/2,Math.min(H/2-oh/2,num(opening.y)));
    const left=-W/2,right=W/2,bottom=-H/2,top=H/2,ol=ox-ow/2,orr=ox+ow/2,ob=oy-oh/2,ot=oy+oh/2,parts=[];
    const ry=num(opts.ry),cr=Math.cos(ry),sr=Math.sin(ry),cx=num(opts.x),cy=num(opts.y),cz=num(opts.z),solid=opts.solid!==false;
    const add=(x0,x1,y0,y1)=>{const w=x1-x0,h=y1-y0;if(w<=.015||h<=.015)return;const lx=(x0+x1)/2,ly=(y0+y1)/2,m=wg.box(w,h,D,mat),x=cx+lx*cr,z=cz-lx*sr;wg.put(m,x,cy+ly,z,ry);if(solid)wg.solid(m,w,h,D);parts.push(m);};
    add(left,ol,bottom,top);add(orr,right,bottom,top);add(ol,orr,bottom,ob);add(ol,orr,ot,top);
    return parts;
  };

  Object.defineProperty(wg,'__iiiWorldTextOps',{value:VERSION,enumerable:false});
  return wg;
}

function patchWGKit(){
  const kit=global.WGKIT;
  if(!kit||typeof kit.makeWG!=='function')return false;
  if(kit.makeWG.__iiiWorldTextVersion===VERSION){wgOpsPatched=true;return true;}
  const base=kit.makeWG;
  const wrapped=function iiiWorldTextMakeWG(host){
    const wg=base.call(this,host);
    try{installWGVerbs(wg,host&&host.THREE);}catch(err){console.warn('[III WORLDTEXT] WG verbs',err);}
    return wg;
  };
  wrapped.__iiiWorldTextVersion=VERSION;
  wrapped.__iiiWorldTextBase=base;
  kit.makeWG=wrapped;
  wgOpsPatched=true;
  return true;
}

function productiveBrief(raw, domain){
  const scale = domain === 'world'
    ? 'This request is an ENTIRE PLACE. Preserve the WORLD domain bounds, spawn clearances, atmosphere and route obligations from the standing system contract.'
    : 'This request is ONE LOCAL CONSTRUCTION placed into the existing world. Keep the root local/identity and preserve the DRAFT domain bounds and solid budget from the standing system contract.';

  return `REQUEST: ${raw}\n\nPRODUCTIVE WORLDTEXT COMPILER MODE\n${scale}\n\nTreat the request as an open expression in a finite constructive language, NEVER as a lookup in a catalog of known object types. Unknown nouns, hybrids, metaphors and strange descriptions are not unsupported categories. Translate them into operations and relations. Do not ask for a new noun-specific primitive merely because the subject is unfamiliar.\n\nVERIFIED EXTRA WG VERBS\nThe runtime now also provides these general verbs, in addition to every WG capability in the standing system prompt:\n- WG.repeat(n,(i,n)=>...)\n- WG.extrude(profileXY, depth, material, {x,y,z,ry}) where profileXY is [[x,y],...]\n- WG.revolve(profileRY, material, {segments,x,y,z,ry}) where profileRY is [[radius,y],...]\n- WG.loft(sections, material, {segments,x,y,z,ry}) where sections are {y,rx,rz,x?,z?}\n- WG.sweep(pathXYZ, {rx,ry}, material, {segments,x,y,z,ry})\n- WG.cut(width,height,depth,{w,h,x,y},material,{x,y,z,ry,solid}) constructs a REAL rectangular aperture from separate host pieces.\nEXTRUDE/REVOLVE/LOFT/SWEEP are render-form operators marked visual-only: construct simpler WG.solid cells separately wherever collision is needed. WG.cut can produce both appearance and legal compound collision around its void.\n\nSILENT INTERPRETATION BEFORE CODE\n1. Extract the dominant topology: axis, loop, court, shell, stack, branch, field, procession, bridge, cluster, nested volumes, or another relation derivable from the request.\n2. Decompose the subject into a SMALL graph of masses, voids, paths, supports, openings and repeated relations. Preserve what would make the result recognizable without labels.\n3. If it is inhabitable, derive SPACE + PORTAL + SURFACE + SUPPORT: a real arrival, traversable opening, supported floor/route, circulation, enclosure and weather edge. Never make an inhabited request into a sealed sculpture.\n4. Choose only the constructive verbs actually needed from PROFILE, PATH, EXTRUDE, REVOLVE, SWEEP, LOFT, CUT, JOIN, REPEAT, BRANCH and TRANSFORM.\n5. Derive appearance and collision separately. Preserve large negative spaces, doors, passages, courts and undercrofts in the solid decomposition.\n\nCODE ECONOMY\nSpend output tokens on reusable local helpers, arrays/records, loops and derived measurements. A helper may call another helper. Prefer a compact generative program that emits many parts over a long list of nearly identical WG calls. Define helpers INSIDE build as required by the standing ABI. Do not output the interpretation, IR, commentary, markdown or TODOs: output only the exact build function demanded by the standing system prompt.\n\nSEMANTIC PRODUCTIVITY\nDo not solve metaphor by decorating a generic box. The source idea must alter topology, silhouette, relative scale, voids, circulation or assembly behavior. Do not special-case the noun by name. If a smooth/organic form is requested, use loft/sweep/revolve or repeated sections to preserve its governing morphology.\n\nRELATIONAL CHECK BEFORE FINISHING\nEvery major part should have a reason to be where it is: inside/around/between/through/above/below/touching/supported-by/open-to/connected-to/drains-to. For an inhabitable structure, confirm mentally that a route can actually enter and move through it and that collision geometry does not close its intended openings.\n\nNow compile the REQUEST. The standing output contract and WG safety/budget rules remain absolute.`;
}

function wrapDomain(id){
  const engine=global.HELLO_ENGINE,current=engine&&engine.domains&&engine.domains[id];
  if(!current||typeof current.request!=='function')return false;
  if(current.__iiiWorldTextVersion===VERSION)return true;
  const base=current,baseRequest=current.request,wrapped=Object.assign({},current);
  wrapped.__iiiWorldTextVersion=VERSION;wrapped.__iiiWorldTextBase=base;
  wrapped.request=async function iiiProductiveRequest(text,image,fix){
    const raw=cleanText(text)||(id==='world'?'a coherent place':'a coherent construction'),prompt=productiveBrief(raw,id);
    requests++;lastRequest=raw;lastDomain=id;lastError='';
    try{return await baseRequest(prompt,image,fix);}
    catch(err){lastError=String(err&&err.message||err||'request failed');throw err;}
    finally{if(id==='draft')global.__lastDraftPrompt=raw.slice(0,20000);if(id==='world')global.__lastWorldPrompt=raw.slice(0,20000);global.__lastWorldTextRequest=raw;}
  };
  engine.domain(id,wrapped);installs++;return true;
}

function install(){
  const engine=global.HELLO_ENGINE;
  if(!engine||!engine.domains||typeof engine.domain!=='function')return false;
  const grammar=patchWGKit(),draft=wrapDomain('draft'),world=wrapDomain('world'),complete=grammar&&draft&&world;
  if(complete&&!readyEventSent){readyEventSent=true;global.dispatchEvent(new CustomEvent('terrarium:worldtext-ready',{detail:{version:VERSION,draft,world,wgOps:grammar}}));}
  return complete;
}
function arm(){
  if(install())return;let tries=0;
  timer=global.setInterval(()=>{tries++;if(install()||tries>=80){global.clearInterval(timer);timer=0;if(tries>=80&&!readyEventSent){lastError='WGKIT/WORLD/DRAFT did not all become available';console.warn('[III WORLDTEXT] install timed out');}}},250);
}
function stats(){return{version:VERSION,installs,requests,lastDomain:lastDomain||null,lastRequest:lastRequest||null,lastError:lastError||null,wgOps:wgOpsPatched,draft:global.HELLO_ENGINE?.domains?.draft?.__iiiWorldTextVersion===VERSION,world:global.HELLO_ENGINE?.domains?.world?.__iiiWorldTextVersion===VERSION};}

global.III_WORLDTEXT=Object.freeze({
  version:VERSION,basis:BASIS,relations:RELATIONS,
  compilePrompt:(text,domain='draft')=>productiveBrief(cleanText(text),domain==='world'?'world':'draft'),
  install,stats,
  diversityBattery:Object.freeze([
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
