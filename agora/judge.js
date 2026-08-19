/* ============================================================================
   THE JUDGE — an external metric for the antbat experiment.

   The obvious objection to "the ants made the building better" is that the ants
   also decide what better means. So nothing in this file may come from
   antbat-genie.html. It builds its own scene, its own cameras and its own
   renderer, and it answers two questions the antbats never optimise:

   1. lintWorld() — ported verbatim from OPERATIVE BUILDER — FUCKED UNTIL PROVEN
      OTHERWISE (public/index.html). Same six rules, same severities, same
      severityFloor ladder. That program's own code, judging a scene it never saw.

   2. Can each part be SEEN? Six semantic views — FRONT BACK LEFT RIGHT TOP ENTRY,
      the brutal loop's own sensor policy — rendered with one flat colour per
      part, reading back which colours survive. This is the closest computable
      thing to what the correspondence critic was actually looking at, and no
      antbat instrument optimises it.

   One judgement call is unavoidable and is declared here rather than buried:
   the brutal loop's linter keys on a SEMANTIC kind (mass/floor/column/door/
   stair/path) which correspondence scenes do not carry — they carry a geometric
   kind (box/cylinder/cone/sphere) and a free-text role. The mapping below is
   applied identically to every arm of the experiment, so it cannot favour one.
   ========================================================================== */
(function(global){
'use strict';

const SEMANTIC = [
  [/\b(door|entry|entrance|gate|hatch|airlock)\b/i, 'door'],
  [/\b(stair|step)\b/i,                             'stair'],
  [/\b(path|walk|ramp|pave)\b/i,                    'path'],
  [/\b(floor|deck|slab|foundation|platform|terrace|base)\b/i, 'floor'],
  [/\b(column|post|pillar|leg|strut|mast|rail|frame)\b/i,     'column'],
];
function semanticKind(p){
  const t = ((p.id||'')+' '+(p.role||'')+' '+(p.kind||''));
  for(const [rx,k] of SEMANTIC) if(rx.test(t)) return k;
  return 'mass';
}

/* AABB for a correspondence part, without importing anyone's scene graph.
   Rotation is applied to the box corners so a rotated member is not understated. */
function aabbOf(p){
  const s=p.size||[1,1,1], pos=p.position||[0,0,0], rot=p.rotation||[0,0,0];
  let hx=(s[0]||0)/2, hy=(s[1]||0)/2, hz=(s[2]||0)/2;
  const k=(p.kind||'box').toLowerCase();
  if(k==='cylinder'||k==='cone'){ hx=(s[0]||0)/2; hz=(s[0]||0)/2; hy=(s[1]||0)/2 }
  if(k==='sphere'){ const r=Math.max(s[0]||0,s[1]||0,s[2]||0)/2; hx=hy=hz=r }
  const cs=[Math.cos(rot[0]||0),Math.cos(rot[1]||0),Math.cos(rot[2]||0)];
  const sn=[Math.sin(rot[0]||0),Math.sin(rot[1]||0),Math.sin(rot[2]||0)];
  // Rx then Ry then Rz, matching THREE's default 'XYZ' Euler order
  const m=[
    [cs[1]*cs[2], -cs[1]*sn[2], sn[1]],
    [sn[0]*sn[1]*cs[2]+cs[0]*sn[2], -sn[0]*sn[1]*sn[2]+cs[0]*cs[2], -sn[0]*cs[1]],
    [-cs[0]*sn[1]*cs[2]+sn[0]*sn[2], cs[0]*sn[1]*sn[2]+sn[0]*cs[2], cs[0]*cs[1]]
  ];
  const ex=Math.abs(m[0][0])*hx+Math.abs(m[0][1])*hy+Math.abs(m[0][2])*hz;
  const ey=Math.abs(m[1][0])*hx+Math.abs(m[1][1])*hy+Math.abs(m[1][2])*hz;
  const ez=Math.abs(m[2][0])*hx+Math.abs(m[2][1])*hy+Math.abs(m[2][2])*hz;
  return {min:{x:pos[0]-ex,y:pos[1]-ey,z:pos[2]-ez},max:{x:pos[0]+ex,y:pos[1]+ey,z:pos[2]+ez}};
}
function boxesOverlap(a,b,eps){
  eps=eps||0;
  return a.min.x-eps<=b.max.x && a.max.x+eps>=b.min.x &&
         a.min.y-eps<=b.max.y && a.max.y+eps>=b.min.y &&
         a.min.z-eps<=b.max.z && a.max.z+eps>=b.min.z;
}

/* ---- 1. lintWorld, verbatim rules ---------------------------------------- */
function lintWorld(parts,opts){
  opts=opts||{};
  const findings=[],items=parts||[];
  if(!items.length) findings.push({id:'EMPTY',severity:'critical',text:'world contains no building objects'});
  const kinds=items.map(semanticKind);
  const doors =items.filter((p,i)=>kinds[i]==='door');
  const stairs=items.filter((p,i)=>kinds[i]==='stair');
  const paths =items.filter((p,i)=>kinds[i]==='path');
  if(items.length>4 && !doors.length)
    findings.push({id:'NO_DOOR',severity:'high',text:'building has no semantic door'});
  if(doors.length && !stairs.length && !paths.length)
    findings.push({id:'DOOR_NO_ARRIVAL',severity:'high',text:'door exists but no stair/path object exists'});
  const known=new Set(items.map(p=>p.id));
  const boxes=items.map(aabbOf);
  for(let i=0;i<items.length;i++){
    const o=items[i],b=boxes[i];
    if(b.min.y<-0.25)
      findings.push({id:'BELOW_GRADE',severity:'medium',object:o.id,text:o.id+' penetrates below grade'});
    if(['mass','floor','column','stair','path'].includes(kinds[i]) && b.min.y>0.25 && !supported(o,i)){
      findings.push({id:'FLOATING',severity:'high',object:o.id,
        text:o.id+' has no support and floats '+b.min.y.toFixed(2)+' above grade'});
    }
    const sup=o.supportId||null;
    if(sup && !known.has(sup))
      findings.push({id:'BAD_SUPPORT',severity:'high',object:o.id,text:o.id+' references missing support '+sup});
  }
  function supported(o,i){
    /* The original reads a declared supportId. Correspondence scenes declare
       none at all — the pagoda declares zero connections across 92 parts — so a
       verbatim run would flag almost everything and measure nothing. Two modes,
       both reported, neither chosen for the antbats' benefit:
         strict     : the original rule. supportId or nothing.
         geometric  : something is actually underneath and touching.
       'geometric' shares a premise with one antbat instrument, so 'strict' and
       the visibility test below are the load-bearing numbers. */
    if(opts.support==='declared'){
      /* The original rule exactly: a declared supportId, nothing else. An agent
         cannot satisfy this by writing itself a connection, which the 'strict'
         mode below would accept and which the antbat relocation operation does
         in passing. Reported so that gaming is visible rather than assumed away. */
      return !!o.supportId;
    }
    if(opts.support==='geometric'){
      const b=boxes[i];
      for(let j=0;j<items.length;j++){
        if(j===i)continue;
        const c=boxes[j];
        if(c.max.y<=b.min.y+0.35 && c.max.y>=b.min.y-0.35 &&
           b.min.x-0.05<=c.max.x && b.max.x+0.05>=c.min.x &&
           b.min.z-0.05<=c.max.z && b.max.z+0.05>=c.min.z) return true;
      }
      return false;
    }
    return !!(o.supportId||(o.connections&&o.connections.length));
  }
  return findings.slice(0,400);
}
function severityFloor(findings){
  let n=0;
  for(const f of findings){
    if(f.severity==='critical')n=Math.max(n,95);
    else if(f.severity==='high')n=Math.max(n,75);
    else if(f.severity==='medium')n=Math.max(n,45);
    else n=Math.max(n,15);
  }
  return n;
}

/* ---- 2. can it be seen? -------------------------------------------------- */
const VIEWS=['FRONT','BACK','LEFT','RIGHT','TOP','ENTRY'];
function visibility(parts,THREE,px){
  px=px||420;
  if(!parts||!parts.length) return {seen:0,total:0,fraction:0,perView:{}};
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x000000);
  const group=new THREE.Group();
  parts.forEach((p,i)=>{
    const s=p.size||[1,1,1];
    let g;
    switch((p.kind||'box').toLowerCase()){
      case 'cylinder': g=new THREE.CylinderGeometry(s[0]/2,s[0]/2,s[1],14,1);break;
      case 'cone':     g=new THREE.ConeGeometry(s[0]/2,s[1],14,1);break;
      case 'sphere':   g=new THREE.SphereGeometry(Math.max(s[0],s[1],s[2])/2,14,10);break;
      default:         g=new THREE.BoxGeometry(s[0]||1,s[1]||1,s[2]||1);
    }
    /* id+1 encoded in r,g so it survives readback exactly */
    const id=i+1;
    const m=new THREE.MeshBasicMaterial({color:new THREE.Color((id&255)/255,((id>>8)&255)/255,0),
      side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(g,m);
    const pos=p.position||[0,0,0],rot=p.rotation||[0,0,0];
    mesh.position.set(pos[0]||0,pos[1]||0,pos[2]||0);
    mesh.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);
    group.add(mesh);
  });
  scene.add(group);
  const box=new THREE.Box3().setFromObject(group);
  const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const R=Math.max(0.5,size.length()/2);

  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1); renderer.setSize(px,px,false);
  if(THREE.NoToneMapping!==undefined) renderer.toneMapping=THREE.NoToneMapping;
  if(THREE.LinearEncoding!==undefined) renderer.outputEncoding=THREE.LinearEncoding;
  const cam=new THREE.PerspectiveCamera(45,1,R*0.01,R*20);
  const dirs={FRONT:[0,0,1],BACK:[0,0,-1],LEFT:[-1,0,0],RIGHT:[1,0,0],TOP:[0,1,0.001],ENTRY:[0.55,0.32,0.85]};
  const seen=new Set(),perView={},share={};
  const c2=document.createElement('canvas'); c2.width=px; c2.height=px;
  const x2=c2.getContext('2d',{willReadFrequently:true});
  for(const v of VIEWS){
    const d=dirs[v];
    const dir=new THREE.Vector3(d[0],d[1],d[2]).normalize();
    cam.position.copy(c).addScaledVector(dir,R*2.6);
    cam.lookAt(c); cam.updateProjectionMatrix();
    renderer.render(scene,cam);
    x2.clearRect(0,0,px,px);
    x2.drawImage(renderer.domElement,0,0);
    const data=x2.getImageData(0,0,px,px).data;
    const here=new Set(); let lit=0;
    for(let i=0;i<data.length;i+=4){
      const id=data[i]+(data[i+1]<<8);
      if(id>0&&id<=parts.length){ here.add(id); seen.add(id); lit++ }
    }
    perView[v]=here.size; share[v]=+(lit/(px*px)).toFixed(4);
  }
  renderer.dispose();
  group.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material)o.material.dispose() });
  return {seen:seen.size,total:parts.length,fraction:+(seen.size/parts.length).toFixed(4),
    perView,pixelShare:share,
    unseen:parts.map((p,i)=>seen.has(i+1)?null:p.id).filter(Boolean)};
}

function judge(parts,THREE,opts){
  const strict=lintWorld(parts,{support:'strict'});
  const declared=lintWorld(parts,{support:'declared'});
  const geom  =lintWorld(parts,{support:'geometric'});
  const count=f=>{const c={};for(const x of f)c[x.id]=(c[x.id]||0)+1;return c};
  const vis=visibility(parts,THREE,(opts&&opts.px)||420);
  return {
    parts:parts.length,
    strict:{findings:strict.length,bySeverity:tally(strict),byRule:count(strict),floor:severityFloor(strict),
      perPart:+(strict.length/Math.max(1,parts.length)).toFixed(4)},
    declared:{findings:declared.length,byRule:count(declared),floor:severityFloor(declared),
      perPart:+(declared.length/Math.max(1,parts.length)).toFixed(4)},
    geometric:{findings:geom.length,bySeverity:tally(geom),byRule:count(geom),floor:severityFloor(geom),
      perPart:+(geom.length/Math.max(1,parts.length)).toFixed(4)},
    visibility:vis
  };
}
function tally(f){
  const t={critical:0,high:0,medium:0,low:0};
  for(const x of f) t[x.severity]=(t[x.severity]||0)+1;
  return t;
}

global.JUDGE={judge,lintWorld,severityFloor,visibility,aabbOf,semanticKind,VIEWS};
})(typeof window!=='undefined'?window:globalThis);
