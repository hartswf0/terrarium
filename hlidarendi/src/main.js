import * as THREE from 'three';
const AR=window.AR; // ARGOS half-dog game contract (PURE module, loaded before this bundle)
import {IN as EL_IN, WT, EL, DOOR_PLAN} from './elements.js';
import {TERRAIN} from './terrain-data.js';
import {LIVING_GROUND} from './living-ground.js';
import {MEMBERS} from './trailer-members.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $=s=>document.querySelector(s), canvas=$('#gl'), readout=$('#readout');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function resistedAxis(v,dead=.06,shape=1.9){const s=Math.sign(v),a=Math.abs(v);if(a<=dead)return 0;const n=(a-dead)/(1-dead);return s*(Math.tanh(n*shape)/Math.tanh(shape))}
function resistedHold(v,edge){return v*(1-.12*smoothstep(.45,1,Math.abs(edge||0)))}
function vec3Lerp(a,b,t){a.lerp(b,t);return a}
function clampVecStep(v,from,maxStep){const d=v.clone().sub(from),m=d.length();if(m>maxStep&&m>1e-9)v.copy(from).add(d.multiplyScalar(maxStep/m));return v}
function clampVel(vec,max){const m=vec.length();if(m>max&&m>1e-9)vec.multiplyScalar(max/m);return vec}
const HAND_FRONT_Z=.20; // camera is +Z: protected front working plane in front of the torso
const ANATOMY={skinPad:.018,upperArmR:.052,forearmR:.047,thighR:.066,shinR:.052,elbowMax:142,kneeMax:145};
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb8cbd8);
const camera=new THREE.PerspectiveCamera(38,1,.05,1400);camera.position.set(0,1.20,6.2);
const IS_TOUCH=(navigator.maxTouchPoints||0)>0||matchMedia('(pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:!IS_TOUCH,preserveDrawingBuffer:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,IS_TOUCH?1:1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
const controls=new OrbitControls(camera,canvas);controls.target.set(0,1.12,0);controls.enableDamping=true;controls.dampingFactor=.08;controls.enabled=false;controls.minDistance=1.5;controls.maxDistance=700;
const hemi=new THREE.HemisphereLight(0xffffff,0xd8d8d8,1.35);scene.add(hemi);
const dl=new THREE.DirectionalLight(0xffffff,1.25);dl.position.set(2,3,2);scene.add(dl);
const GROUND_Y=0;

// V16 — THUNDER RIGS / HLIÐARENDI integration seam.
// The explorer still runs standalone, but ground/world authority can now be
// injected without rewriting the body solver.  The flat stage is only fallback.
const WORLD_BRIDGE={
  place:null,
  setPlace(place){this.place=place||null;return this},
  surfaceAt(x,z){
    const P=this.place;
    try{
      if(P?.surfaceAt){const s=P.surfaceAt(x,z);if(Number.isFinite(s))return{y:s,normal:[0,1,0]};if(s&&Number.isFinite(s.y))return s}
      if(P?.groundAt){const y=P.groundAt(x,z);if(Number.isFinite(y))return{y,normal:[0,1,0]};if(y&&Number.isFinite(y.y))return y}
      if(P?.ground?.heightAt){const y=P.ground.heightAt(x,z),n=P.ground.normalAt?.(x,z);if(Number.isFinite(y))return{y,normal:n||[0,1,0]}}
      if(P?.heightAt){const y=P.heightAt(x,z);if(Number.isFinite(y))return{y,normal:[0,1,0]}}
    }catch(e){console.warn('PLACE surface query failed',e)}
    return{y:GROUND_Y,normal:[0,1,0]};
  },
  query(kind,payload){try{return this.place?.query?.(kind,payload)??null}catch(_){return null}}
};
function groundYAt(x,z){const s=WORLD_BRIDGE.surfaceAt(x,z);return Number.isFinite(s?.y)?s.y:GROUND_Y}

// ============================================================================
// HLIDARENDI — PLACE + STRUCTURE + PROPS.
// One world: terrain, the Ingold trailer, steps, ball and bowl all answer the
// same surface/occupancy questions. NEVER SOLVE THE SAME PHYSICAL QUESTION TWICE.
// ============================================================================
const IN=EL_IN;                                    // the trailer is authored in inches
const TR={x:2.4,z:0};                              // trailer datum in world (plan 50.5,120 maps here)
const DECK=15.75*IN, WALLTOP=106*IN;               // ingold SHELL: deckTop 15.75, wallTop 106
const px2w=px=>TR.x+(px-50.5)*IN, py2w=py=>TR.z+(py-120)*IN;
// REAL GROUND — Hlíðarendi, Fljótshlíð (see src/terrain-data.js). The farm
// datum is world origin; +x east, +z south; heights are metres above the farm.
let TG=(()=>{
  const bin=atob(TERRAIN.b64),n=TERRAIN.n,a=new Float32Array(n*n),scale=(TERRAIN.max-TERRAIN.min)/65535;
  for(let i=0;i<n*n;i++)a[i]=TERRAIN.min+((bin.charCodeAt(i*2))|(bin.charCodeAt(i*2+1)<<8))*scale;
  return a;
})();
function rawTerrain(x,z){
  const n=TERRAIN.n,gi=clamp(TERRAIN.cx+x/TERRAIN.res,0,n-1.001),gj=clamp(TERRAIN.cy+z/TERRAIN.res,0,n-1.001);
  const i0=Math.floor(gi),j0=Math.floor(gj),fx=gi-i0,fz=gj-j0;
  const h00=TG[j0*n+i0],h10=TG[j0*n+i0+1],h01=TG[(j0+1)*n+i0],h11=TG[(j0+1)*n+i0+1];
  return (h00*(1-fx)+h10*fx)*(1-fz)+(h01*(1-fx)+h11*fx)*fz;
}
function terrainH(x,z){
  // the farmyard is levelled: blend the real hillside to a flat pad under home
  const rx=Math.max(0,Math.abs(x-TR.x)-4.0),rz=Math.max(0,Math.abs(z-TR.z)-5.5);
  const r=Math.hypot(rx,rz),t=clamp(r/7.0,0,1),mask=t*t*(3-2*t);
  const pad=rawTerrain(TR.x,TR.z);
  return pad*(1-mask)+rawTerrain(x,z)*mask - pad; // datum: the pad is 0
}
// STRUCTURE — the element table lives in src/elements.js: ONE authority for the
// standalone page and the thunder-rigs cartridge alike.
const DOOR={id:DOOR_PLAN.id,wall:DOOR_PLAN.wall,from:DOOR_PLAN.from,to:DOOR_PLAN.to,
  x:px2w(0),z0:py2w(DOOR_PLAN.from),z1:py2w(DOOR_PLAN.to)};
// world-space boxes derived ONCE from the same element list that is rendered
const SOLIDS=EL.map(e=>({id:e.id,kind:e.kind,
  min:[Math.min(px2w(e.x0),px2w(e.x1)),e.z0*IN,Math.min(py2w(e.y0),py2w(e.y1))],
  max:[Math.max(px2w(e.x0),px2w(e.x1)),e.z1*IN,Math.max(py2w(e.y0),py2w(e.y1))]}));
for(const b of SOLIDS)b.climb=false; // furniture blocks; the floor is the floor
const BLOCKERS=SOLIDS.filter(s=>s.kind==='wall'||s.kind==='glass'||s.kind==='fixture'||s.kind==='frame');
const TOPS=SOLIDS.filter(s=>s.kind==='step');
function structSurface(x,z,forDog){
  const px=(x-TR.x)/IN+50.5,py=(z-TR.z)/IN+120;
  let base=null;
  if(px>WT&&px<96.5&&py>4.5&&py<235.5)base=DECK;
  else if(px>-0.5&&px<=WT&&py>72&&py<108)base=DECK; // door.entry threshold: the sill is part of the floor
  else for(const t of TOPS)if(x>=t.min[0]&&x<=t.max[0]&&z>=t.min[2]&&z<=t.max[2]){base=t.max[1];break}
  return base;
}
const PLACE={
  id:'place.hlidarendi',
  ground:{
    heightAt(x,z){const s=structSurface(x,z);return s!=null?s:terrainH(x,z)},
    heightAtDog(x,z){const s=structSurface(x,z,true);return s!=null?s:terrainH(x,z)},
    normalAt(x,z){const d=.14,h=this.heightAt,dx=(h(x+d,z)-h(x-d,z))/(2*d),dz=(h(x,z+d)-h(x,z-d))/(2*d),l=Math.hypot(dx,1,dz);return[-dx/l,1/l,-dz/l]}
  },
  heightAt(x,z){return this.ground.heightAt(x,z)},
  surfaceAt(x,z){return{y:this.ground.heightAt(x,z),normal:this.ground.normalAt(x,z)}},
  door:DOOR, solids:SOLIDS, structure:{id:'structure.ingold',datum:DECK,elements:EL,door:DOOR},
  // circle-vs-box occupancy in a height band; used by the hero root, foot
  // anchors and the ball — same boxes the renderer draws.
  pushOutCircle(v,r,y0,y1,out,skipClimb){
    for(const b of BLOCKERS){
      if(skipClimb&&b.climb)continue;
      if(b.max[1]<y0||b.min[1]>y1)continue;
      const cx=clamp(v.x,b.min[0],b.max[0]),cz=clamp(v.z,b.min[2],b.max[2]);
      let dx=v.x-cx,dz=v.z-cz,d=Math.hypot(dx,dz);
      if(d>=r)continue;
      if(d<1e-6){ // center inside: exit along smallest horizontal penetration
        const exL=v.x-b.min[0],exR=b.max[0]-v.x,ezL=v.z-b.min[2],ezR=b.max[2]-v.z;
        const m=Math.min(exL,exR,ezL,ezR);
        if(m===exL){dx=-1;dz=0}else if(m===exR){dx=1;dz=0}else if(m===ezL){dx=0;dz=-1}else{dx=0;dz=1}
        v.x=(dx?(dx<0?b.min[0]-r:b.max[0]+r):v.x);v.z=(dz?(dz<0?b.min[2]-r:b.max[2]+r):v.z);
      }else{v.x=cx+dx/d*r;v.z=cz+dz/d*r}
      if(out){out.x=dx;out.z=dz;out.hit=true;out.id=b.id}
    }
    return v;
  },
  dogWalkable(x,z){
    const gy=this.heightAt(x,z),y0=gy+.05,y1=gy+.62;
    for(const b of BLOCKERS){
      if(b.max[1]<y0||b.min[1]>y1)continue;
      if(x>b.min[0]-.14&&x<b.max[0]+.14&&z>b.min[2]-.14&&z<b.max[2]+.14)return false;
    }
    return true;
  },
  // wall capsules for the hand/foot collision solver: derived from the SAME
  // boxes, only near the query point, stacked in the actor's height band.
  wallCapsulesNear(p,range){
    const caps=[];
    for(const b of BLOCKERS){
      const ex=b.max[0]-b.min[0],ez=b.max[2]-b.min[2];
      if(Math.min(ex,ez)>0.35)continue;   // thin solids only: walls and glass, never furniture slabs
      const cx=clamp(p.x,b.min[0],b.max[0]),cz=clamp(p.z,b.min[2],b.max[2]);
      if(Math.hypot(p.x-cx,p.z-cz)>range)continue;
      const longX=ex>=ez;
      const r=Math.min((longX?ez:ex)/2+.012,.14), y0=Math.min(b.min[1]+r,b.max[1]),y1=Math.max(y0,b.max[1]-r);
      const n=Math.min(3,Math.max(1,Math.round((y1-y0)/.5)+1));
      for(let i=0;i<n;i++){
        const y=n===1?(y0+y1)/2:y0+(y1-y0)*i/(n-1);
        const a=longX?new THREE.Vector3(b.min[0]+r,y,(b.min[2]+b.max[2])/2):new THREE.Vector3((b.min[0]+b.max[0])/2,y,b.min[2]+r);
        const c=longX?new THREE.Vector3(b.max[0]-r,y,(b.min[2]+b.max[2])/2):new THREE.Vector3((b.min[0]+b.max[0])/2,y,b.max[2]-r);
        caps.push({name:b.id,a,b:c,r});
      }
    }
    return caps;
  },
  query(kind,payload){
    if(kind==='door')return DOOR;
    if(kind==='structure')return this.structure;
    return null;
  }
};
WORLD_BRIDGE.setPlace(PLACE);
// ---- terrain + structure views (meshes are views of world state, not authorities)
const worldGroup=new THREE.Group();scene.add(worldGroup);
let terrainMesh=null;
function buildTerrainMesh(){
  if(terrainMesh){worldGroup.remove(terrainMesh);terrainMesh.geometry.dispose();terrainMesh.material.dispose()}
  const SZ=TERRAIN.n*TERRAIN.res*0.96,N=150,g=new THREE.PlaneGeometry(SZ,SZ,N,N);g.rotateX(-Math.PI/2);
  const cxOff=(TERRAIN.n/2-TERRAIN.cx)*TERRAIN.res,czOff=(TERRAIN.n/2-TERRAIN.cy)*TERRAIN.res;
  g.translate(cxOff,0,czOff);
  const pos=g.attributes.position,col=[];
  const jit=(x,z)=>{const v=Math.sin(x*12.9898+z*78.233)*43758.5453;return v-Math.floor(v)};
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),h=terrainH(x,z);pos.setY(i,h);
    const d=2.4,sl=Math.hypot(terrainH(x+d,z)-terrainH(x-d,z),terrainH(x,z+d)-terrainH(x,z-d))/(2*d);
    const n=jit(x,z)*.05-.025;
    let r,gr,b;
    if(h<-46){r=.46;gr=.44;b=.39}                                   // Markarfljót outwash plain
    else if(sl>.52){r=.47;gr=.45;b=.42}                             // rock
    else{const t=clamp((h+46)/60,0,1);r=lerp(.40,.56,t);gr=lerp(.47,.56,t);b=lerp(.30,.40,t)} // moss→grass
    const shade=1-clamp(sl*.55,0,.28);
    col.push(clamp(r*shade+n,0,1),clamp(gr*shade+n,0,1),clamp(b*shade+n,0,1));
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  terrainMesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}));
  terrainMesh.userData.SZ=SZ;terrainMesh.userData.cxOff=cxOff;terrainMesh.userData.czOff=czOff;
  worldGroup.add(terrainMesh);
}
buildTerrainMesh();
// ---- THE LIVING GROUND — dress the baked heights with the real place:
// imagery + ways painted onto the terrain, buildings standing as occupancy.
// Runs when the network allows (Pages, local); the procedural moss is the
// honest fallback where it is closed (the artifact sandbox).
const OSM_BUILDINGS=[];
function clearOsmBuildings(){
  for(const b of OSM_BUILDINGS){worldGroup.remove(b.mesh);const i=BLOCKERS.indexOf(b.solid);if(i>=0)BLOCKERS.splice(i,1)}
  OSM_BUILDINGS.length=0;
}
async function dressWorld(){
  if(!TERRAIN.geo)throw new Error('no geographic registration');
  const img=await LIVING_GROUND.imagery(TERRAIN);
  try{const w=await LIVING_GROUND.ways(TERRAIN);LIVING_GROUND.drawWays(img,w);placeOsmBuildings(w.buildings)}
  catch(e){console.warn('[living ground] ways unavailable',e)}
  const tex=new THREE.CanvasTexture(img.canvas);
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  // register: window px 0..n over the window's metre extent; the mesh covers
  // the central 96%, so offset/repeat map mesh UVs into the window texture.
  const n=TERRAIN.n,res=TERRAIN.res,SZ=terrainMesh.userData.SZ;
  const meshX0=terrainMesh.userData.cxOff-SZ/2,meshZ0=terrainMesh.userData.czOff-SZ/2;
  const winX0=(0-TERRAIN.cx)*res,winZ0=(0-TERRAIN.cy)*res,winW=n*res;
  tex.repeat.set(SZ/winW,SZ/winW);
  tex.offset.set((meshX0-winX0)/winW,1-(meshZ0-winZ0)/winW-SZ/winW);
  const m=terrainMesh.material;
  m.map=tex;m.vertexColors=false;m.color.set(0xffffff);m.needsUpdate=true;
  return img.tiles;
}
function placeOsmBuildings(list){
  clearOsmBuildings();
  const res=TERRAIN.res;
  for(const b of list){
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for(const p of b.pts){
      const wx=(p[0]-TERRAIN.cx)*res,wz=(p[1]-TERRAIN.cy)*res;
      x0=Math.min(x0,wx);x1=Math.max(x1,wx);z0=Math.min(z0,wz);z1=Math.max(z1,wz);
    }
    const cx2=(x0+x1)/2,cz2=(z0+z1)/2,sx=x1-x0,szl=z1-z0;
    if(sx<1.5||szl<1.5||sx>60||szl>60)continue;
    if(Math.abs(cx2-TR.x)<9&&Math.abs(cz2-TR.z)<9)continue;   // the trailer keeps its yard
    const h=3.1,gy2=PLACE.heightAt(cx2,cz2);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,h,szl),
      new THREE.MeshStandardMaterial({color:0xd8d4cb,roughness:.9}));
    mesh.position.set(cx2,gy2+h/2,cz2);worldGroup.add(mesh);
    const solid={id:'osm.'+OSM_BUILDINGS.length,kind:'osm',climb:false,
      min:[cx2-sx/2,gy2,cz2-szl/2],max:[cx2+sx/2,gy2+h,cz2+szl/2]};
    BLOCKERS.push(solid);
    OSM_BUILDINGS.push({mesh,solid});
  }
}
// Members from the ACTUAL operative construction (src/trailer-members.js):
// chassis, joists, studs, headers, rafters, sheathing, door leaf, glazing,
// fixtures, water runs. Merged per fade-group + material; EL stays the coarse
// collision/surface authority for the same structure.
const MEMBER_MATS={concrete:0x97928a,steel:0x4a4f55,treated_wood:0x8b7355,plywood:0xc9b48a,
  engineered_lumber:0xa08a5f,siding:0xd8d5cc,corrugated_metal:0x9aa0a4,paint:0xe8e5da,
  wood:0xa0784a,glass:0xbcd6dd,tile:0xd8d8d0,stone:0x8a8880,fabric:0xc05a4a,polycarbonate:0xcfe0e4};
function memberGroup(lox,loy,loz,hix,hiy,hiz,kind){
  if(kind==='rafter'||kind==='flashing'||kind==='panel'||loz>=100)return 'roof';
  if(hix<=8)return 'W'; if(lox>=93)return 'E'; if(hiy<=8)return 'S'; if(loy>=232)return 'N';
  return 'in';
}
const structMeshes=[];
{
  const buckets={}; // group|material -> geometries
  const gAABB={};   // group -> world aabb
  for(const m of MEMBERS){
    let [id,kind,mat,layer,lox,loy,loz,hix,hiy,hiz]=m;
    // the door leaf STANDS OPEN — the way in must look like the way in.
    // Hinged at the south jamb, swung against the inside of wall W.
    if(kind==='leaf'){
      const wdt=hiy-loy,thk=hix-lox;
      lox=hix; hix=lox+wdt*0.98; hiy=loy+thk;
    }
    const grp=memberGroup(lox,loy,loz,hix,hiy,hiz,kind);
    const sx=Math.abs(px2w(hix)-px2w(lox)),sy=(hiz-loz)*IN,sz=Math.abs(py2w(hiy)-py2w(loy));
    if(sx<1e-4||sy<1e-4||sz<1e-4)continue;
    const g=new THREE.BoxGeometry(sx,sy,sz);
    g.translate((px2w(lox)+px2w(hix))/2,(loz+hiz)/2*IN,(py2w(loy)+py2w(hiy))/2);
    const key=grp+'|'+(kind==='glazing'?'glass':(mat||'wood'));
    (buckets[key]=buckets[key]||[]).push(g);
    const a=gAABB[grp]=gAABB[grp]||{min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9]};
    a.min[0]=Math.min(a.min[0],px2w(lox),px2w(hix));a.max[0]=Math.max(a.max[0],px2w(lox),px2w(hix));
    a.min[1]=Math.min(a.min[1],loz*IN);a.max[1]=Math.max(a.max[1],hiz*IN);
    a.min[2]=Math.min(a.min[2],py2w(loy),py2w(hiy));a.max[2]=Math.max(a.max[2],py2w(loy),py2w(hiy));
  }
  for(const key of Object.keys(buckets)){
    const [grp,mat]=key.split('|');
    const merged=mergeGeometries(buckets[key],false);
    const glass=mat==='glass'||mat==='polycarbonate';
    const material=new THREE.MeshStandardMaterial({color:MEMBER_MATS[mat]||0xb0a898,
      roughness:mat==='steel'||mat==='corrugated_metal'?.55:.9,metalness:mat==='steel'?.35:0,
      transparent:true,opacity:glass?.45:1});
    const mesh=new THREE.Mesh(merged,material);
    worldGroup.add(mesh);
    structMeshes.push({box:Object.assign({kind:grp==='in'?'interior':'wall'},gAABB[grp]),grp,mesh,baseOpacity:material.opacity});
  }
  // the steps are HLIDARENDI's own addition (EL) — the way in, rendered too
  for(const b of SOLIDS){
    if(b.kind!=='step')continue;
    const g=new THREE.BoxGeometry(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]);
    const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xb8ab91,roughness:.95}));
    mesh.position.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);
    worldGroup.add(mesh);
  }
}
// walls between the camera and the hero become see-through; same elements, one truth
function updateStructFade(){
  const hero=locomotion.root,cx=camera.position.x,cz=camera.position.z;
  const home=insideShell(hero.x,hero.z);
  for(const s of structMeshes){
    let block=false;
    if(s.grp==='roof'){block=home}
    else if(home&&s.grp!=='in'){block=true}
    else if(s.grp!=='in'&&s.box.max[1]>hero.y+.9){
      for(let t=.12;t<.97;t+=.12){
        const x=lerp(cx,hero.x,t),z=lerp(cz,hero.z,t);
        if(x>s.box.min[0]-.08&&x<s.box.max[0]+.08&&z>s.box.min[2]-.08&&z<s.box.max[2]+.08){
          const y=lerp(camera.position.y,hero.y+1.1,t);
          if(y>s.box.min[1]&&y<s.box.max[1]){block=true;break}
        }
      }
    }
    const want=block?Math.min(.15,s.baseOpacity):s.baseOpacity;
    s.mesh.material.opacity+=(want-s.mesh.material.opacity)*.25;
    s.mesh.material.depthWrite=s.mesh.material.opacity>.5;
  }
}
// ---- FORGE — build things in the world. The same contract Terrarium III's
// AI builder speaks: function build(w, WG, THREE), certified (mesh budget,
// bounds), seated on the real land at its anchor, and REAL afterwards — the
// solids enter the world's occupancy, so bodies, the dog and the ball all
// answer to what you built. Structures ride the save and the cartridge.
const FORGE={
  structures:[],budgetMeshes:60,bounds:12,
  _sandbox(anchorPt){
    const group=new THREE.Group();
    group.position.set(anchorPt.x,PLACE.heightAt(anchorPt.x,anchorPt.z),anchorPt.z);
    const reg={meshes:0,solids:[],err:null};
    const mat=(hex,o)=>new THREE.MeshStandardMaterial({color:hex,roughness:o&&o.rough!=null?o.rough:.9,metalness:o&&o.metal?o.metal:0});
    const WG={
      P:{ash:0x9aa0a4,moss:0x5f7748,stone:0x8a8880,wood:0x8b7355,snow:0xf0f2f4,volt:0xffd75e},
      box:(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m||mat(0xb0a89a)),
      cyl:(r,h,m,seg)=>new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||10),m||mat(0xb0a89a)),
      cone:(r,h,m,seg)=>new THREE.Mesh(new THREE.ConeGeometry(r,h,seg||10),m||mat(0xb0a89a)),
      sphere:(r,m)=>new THREE.Mesh(new THREE.SphereGeometry(r,12,9),m||mat(0xb0a89a)),
      torus:(r,t,m,seg)=>new THREE.Mesh(new THREE.TorusGeometry(r,t,8,seg||18),m||mat(0xb0a89a)),
      flat:mat, matte:(hex,r2)=>mat(hex,{rough:r2==null?.9:r2}),
      lit:(hex,i)=>{const m=mat(hex,{rough:.6});m.emissive=new THREE.Color(hex);m.emissiveIntensity=i==null?.6:i;return m},
      put:(mesh,x,y,z,ry)=>{
        if(reg.meshes>=FORGE.budgetMeshes){reg.err='over the '+FORGE.budgetMeshes+'-mesh budget';return mesh}
        if(Math.abs(x)>FORGE.bounds||Math.abs(z)>FORGE.bounds){reg.err='parts must stay within '+FORGE.bounds+' units of the anchor';return mesh}
        mesh.position.set(x,y,z);if(ry)mesh.rotation.y=ry;group.add(mesh);reg.meshes++;return mesh;
      },
      solid:(mesh,w,h,d)=>{reg.solids.push({mesh,w:w||2,h:h||2,d:d||2});return mesh},
      rand:seed=>{let t=(seed==null?9:seed)>>>0;return()=>{t+=0x6D2B79F5;let r2=Math.imul(t^t>>>15,1|t);r2^=r2+Math.imul(r2^r2>>>7,61|r2);return((r2^r2>>>14)>>>0)/4294967296}},
      tick:()=>{},atmosphere:()=>{}
    };
    return {group,WG,reg};
  },
  run(code,anchorPt,id){
    try{
      if(typeof code!=='string'||code.length>20000)return{ok:false,err:'code missing or over 20k'};
      const {group,WG,reg}=this._sandbox(anchorPt);
      const fn=new Function('w','WG','THREE','"use strict";return ('+code+')(w,WG,THREE)');
      fn({},WG,THREE);
      if(reg.err){group.traverse(o=>{o.geometry&&o.geometry.dispose()});return{ok:false,err:reg.err}}
      if(!reg.meshes)return{ok:false,err:'built nothing'};
      scene.add(group);group.updateMatrixWorld(true);
      const solids=[];
      for(const s2 of reg.solids){
        const p=s2.mesh.getWorldPosition(new THREE.Vector3());
        const b={id:(id||'forge')+'.'+solids.length,kind:'forged',
          min:[p.x-s2.w/2,p.y-s2.h/2,p.z-s2.d/2],max:[p.x+s2.w/2,p.y+s2.h/2,p.z+s2.d/2],climb:false};
        BLOCKERS.push(b);solids.push(b);
      }
      this.structures.push({id:id||('forge-'+(this.structures.length+1)),code,anchor:{x:anchorPt.x,z:anchorPt.z},group,solids});
      return {ok:true,meshes:reg.meshes,solids:solids.length};
    }catch(e){return{ok:false,err:String(e&&e.message||e).slice(0,120)}}
  },
  clearAll(){
    for(const st of this.structures){scene.remove(st.group);
      for(const b of st.solids){const i=BLOCKERS.indexOf(b);if(i>=0)BLOCKERS.splice(i,1)}}
    this.structures.length=0;
  }
};
// stand-in structures — the AGENT works offline the way III's does: "AI OFF,
// using stand-ins". Each is real forge code through the same admission.
const STANDINS={
  cairn:"function build(w,WG,THREE){var R=WG.rand(7),m=WG.matte(0x8a8880,.95);for(var i=0;i<9;i++){var s=.5-.045*i,b=WG.box(s+R()*.1,.22,s+R()*.1,m);WG.put(b,(R()-.5)*.14,.12+i*.2,(R()-.5)*.14,R()*.6);WG.solid(b,s,.22,s)}return w}",
  gate:"function build(w,WG,THREE){var wd=WG.matte(0x8b7355,.9);var p1=WG.box(.3,2.6,.3,wd);WG.put(p1,-1.1,1.3,0);WG.solid(p1,.3,2.6,.3);var p2=WG.box(.3,2.6,.3,wd);WG.put(p2,1.1,1.3,0);WG.solid(p2,.3,2.6,.3);var l=WG.box(2.9,.28,.34,wd);WG.put(l,0,2.72,0);WG.solid(l,2.9,.28,.34);var l2=WG.box(3.3,.2,.3,wd);WG.put(l2,0,3.05,0);return w}",
  tower:"function build(w,WG,THREE){var st=WG.matte(0x8a8880,.95),wd=WG.matte(0x8b7355,.9);for(var i=0;i<4;i++){var s=1.6-.22*i,b=WG.box(s,.9,s,st);WG.put(b,0,.45+i*.9,0);WG.solid(b,s,.9,s)}var d=WG.box(1.3,.14,1.3,wd);WG.put(d,0,3.75,0);WG.solid(d,1.3,.14,1.3);for(var k=0;k<4;k++){var px=(k%2?1:-1)*.55,pz=(k<2?1:-1)*.55,po=WG.box(.12,.7,.12,wd);WG.put(po,px,4.15,pz);WG.solid(po,.12,.7,.12)}var r=WG.cone(1.05,.8,WG.matte(0x6b6257,.8),4);WG.put(r,0,4.9,0,.785);return w}",
  sheepfold:"function build(w,WG,THREE){var st=WG.matte(0x8a8880,.95),R=WG.rand(3);for(var i=0;i<14;i++){var a=.4+i/14*5.2,x=Math.cos(a)*2.6,z=Math.sin(a)*2.6,b=WG.box(.6,.75+R()*.2,.35,st);WG.put(b,x,.4,z,-a);WG.solid(b,.6,.9,.35)}return w}",
  beacon:"function build(w,WG,THREE){var st=WG.matte(0x8a8880,.95);var b=WG.box(1,.5,1,st);WG.put(b,0,.25,0);WG.solid(b,1,.5,1);var p=WG.cyl(.09,2.6,WG.matte(0x8b7355,.9));WG.put(p,0,1.8,0);WG.solid(p,.2,2.6,.2);var l=WG.sphere(.22,WG.lit(0xffd75e,1.4));WG.put(l,0,3.2,0);return w}"
};
function standinFor(prompt){
  const p=String(prompt||'').toLowerCase();
  for(const k of Object.keys(STANDINS))if(p.includes(k))return k;
  if(/wall|fence|fold|pen/.test(p))return 'sheepfold';
  if(/gate|arch|door/.test(p))return 'gate';
  if(/tower|watch|fort|keep/.test(p))return 'tower';
  if(/light|lamp|fire|beacon|star/.test(p))return 'beacon';
  return 'cairn';
}
const FORGE_SYS='You are a structure builder for HLIDARENDI, a small standing world. Reply with ONLY one JavaScript function, no fences, no prose:\nfunction build(w, WG, THREE){ ... return w; }\nOne focal structure at the origin. Vocabulary: WG.box(w,h,d,mat) WG.cyl(r,h,mat) WG.cone(r,h,mat) WG.sphere(r,mat) WG.torus(r,t,mat); materials WG.flat(hex,{rough,metal}) WG.matte(hex,rough) WG.lit(hex,intensity); WG.put(mesh,x,y,z,ry) places (y=0 is the ground); WG.solid(mesh,w,h,d) makes it collide; WG.rand(seed) for randomness. Under 60 meshes; every part within 12 units of the origin; scale in metres (a person is 1.7 tall).';
async function askForgeAI(prompt){
  let key=null;try{key=localStorage.getItem('hlidarendi.ai.key')}catch(e){}
  if(!key)return null;
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
    headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-opus-5',max_tokens:3000,system:FORGE_SYS,
      messages:[{role:'user',content:'Design for: "'+String(prompt).slice(0,200)+'"'}]})});
  if(!r.ok)throw new Error('AI '+r.status);
  const j=await r.json();
  const text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
  const m=text.match(/function\s+build\s*\([\s\S]*\}/);
  return m?m[0]:null;
}
async function buildFromWords(prompt){
  const fwd=rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading);
  const at={x:locomotion.root.x+fwd.x*5,z:locomotion.root.z+fwd.z*5};
  let code=null,via='stand-in';
  try{code=await askForgeAI(prompt);if(code)via='claude'}catch(e){chat.line('world','the agent line failed ('+String(e.message||e).slice(0,60)+') — using a stand-in')}
  if(!code)code=STANDINS[standinFor(prompt)];
  const r=FORGE.run(code,at,'build-'+(FORGE.structures.length+1));
  if(r.ok)chat.line('world','built via '+via+' — '+r.meshes+' meshes, '+r.solids+' solid, standing on the land ahead of you');
  else chat.line('world','the forge refused: '+r.err);
  return r.ok;
}
// ---- STRIKER — the dog as the opposing agent, the yard as the pitch.
const STRIKER={on:false,heroGoal:null,dogGoal:null,score:[0,0],rings:[],
  goalR:1.4,
  toggle(){
    this.on=!this.on;
    if(this.on&&!this.rings.length){
      const mk=(z,c)=>{const g=new THREE.Mesh(new THREE.TorusGeometry(this.goalR,.06,8,24),new THREE.MeshStandardMaterial({color:c,roughness:.5}));
        g.rotation.x=Math.PI/2;scene.add(g);return g};
      this.rings=[mk(0,0x2878ff),mk(0,0xc05a4a)];
    }
    const cx=TR.x-5;
    this.heroGoal={x:cx,z:TR.z-8};this.dogGoal={x:cx,z:TR.z+8};
    if(this.rings.length){
      this.rings[0].position.set(this.heroGoal.x,PLACE.heightAt(this.heroGoal.x,this.heroGoal.z)+.08,this.heroGoal.z);
      this.rings[1].position.set(this.dogGoal.x,PLACE.heightAt(this.dogGoal.x,this.dogGoal.z)+.08,this.dogGoal.z);
      this.rings.forEach(r2=>r2.visible=this.on);
    }
    if(this.on){this.score=[0,0];ball.state='free';ball.p.set(cx,PLACE.heightAt(cx,TR.z)+ball.r,TR.z);ball.v.set(0,0,0);
      try{argos.say('fetch the ball, game on')}catch(e){}}
    return this.on;
  },
  step(){
    if(!this.on||ball.state!=='free')return;
    const inGoal=g=>Math.hypot(ball.p.x-g.x,ball.p.z-g.z)<this.goalR&&ball.v.lengthSq()<4;
    let scored=null;
    if(inGoal(this.heroGoal)){this.score[0]++;scored='YOU score — '+this.score[0]+' : '+this.score[1]}
    else if(inGoal(this.dogGoal)){this.score[1]++;scored='ARGOS scores — '+this.score[0]+' : '+this.score[1]}
    if(scored){chat.line('world',scored);buzz('goal',[20,40,20],600);
      const cx=TR.x-5;ball.p.set(cx,PLACE.heightAt(cx,TR.z)+ball.r,TR.z);ball.v.set(0,0,0)}
  }
};
// kicking is always on: run into the ball and it goes
function stepKick(){
  if(ball.state!=='free')return;
  const d=Math.hypot(ball.p.x-locomotion.root.x,ball.p.z-locomotion.root.z);
  if(d<.48&&explorer.speed>.6){
    const dir=rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading);
    ball.v.set(dir.x*(1.6+explorer.speed*.9),1.1+explorer.speed*.25,dir.z*(1.6+explorer.speed*.9));
    buzz('kick',[10,20,8],350);
  }
}
// ---- LOCATIONS — call on the world landscape. Fetches the same public
// terrarium elevation tiles the bake used; where the network is closed
// (the artifact sandbox), the baked Hlíðarendi stands.
async function gotoPlace(lat,lon){
  const z=14,n2=Math.pow(2,z),lr=lat*Math.PI/180;
  const xf=(lon+180)/360*n2,yf=(1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n2;
  const x0=Math.floor(xf),y0=Math.floor(yf);
  const cv=document.createElement('canvas');cv.width=512;cv.height=512;
  const cx2=cv.getContext('2d',{willReadFrequently:true});
  for(const dx of [0,1])for(const dy of [0,1]){
    const img=await new Promise((ok,bad)=>{const im=new Image();im.crossOrigin='anonymous';
      im.onload=()=>ok(im);im.onerror=()=>bad(new Error('tile fetch blocked'));
      im.src='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+z+'/'+(x0+dx)+'/'+(y0+dy)+'.png'});
    cx2.drawImage(img,dx*256,dy*256);
  }
  const px=cv.getContext('2d').getImageData(0,0,512,512).data;
  const H=(gx,gy)=>{const i=(gy*512+gx)*4;return px[i]*256+px[i+1]+px[i+2]/256-32768};
  const CX=(xf-x0)*256,CY=(yf-y0)*256,N=TERRAIN.n;
  const wx0=Math.floor(Math.max(0,Math.min(512-N,CX-N/2))),wy0=Math.floor(Math.max(0,Math.min(512-N,CY-N/2)));
  const base=H(Math.floor(CX),Math.floor(CY));
  const a=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++)a[j*N+i]=H(wx0+i,wy0+j)-base;
  TG=a;TERRAIN.res=156543.03*Math.cos(lr)/n2;TERRAIN.cx=CX-wx0;TERRAIN.cy=CY-wy0;
  TERRAIN.geo={lat,lon,z,tx:x0,ty:y0,wx:wx0,wy:wy0};
  buildTerrainMesh();
  dressWorld().then(t=>chat.line('world','dressed — '+t+' tiles · © Esri · © OpenStreetMap')).catch(()=>{});
  placeHero(0,0,locomotion.heading);argos.world.dog=[TR.x-2.1,0,TR.z-2.4];
  return true;
}
// ---- WEATHER — the sky over Fljótshlíð. An environmental system of its own:
// it changes light, fog and rain, never the bodies.
const WEATHER={
  presets:{
    dawn:{sky:0xd8b9a0,fog:0xd8c4b0,fogFar:520,hemi:[0xffe0c4,0x9a8a80,1.0],dl:[0xffc890,.9,[-3,1.2,2]],rain:false},
    day:{sky:0xb8cbd8,fog:0xc9d4d2,fogFar:900,hemi:[0xffffff,0xd8d8d8,1.35],dl:[0xffffff,1.25,[2,3,2]],rain:false},
    dusk:{sky:0xc9a888,fog:0xb9a89a,fogFar:600,hemi:[0xffd0a8,0x807a78,.9],dl:[0xff9c60,.8,[3,.9,-1]],rain:false},
    night:{sky:0x1a2230,fog:0x161d28,fogFar:380,hemi:[0x8098b8,0x303840,.42],dl:[0xaac4e8,.3,[2,3,2]],rain:false},
    fog:{sky:0xc4c9c6,fog:0xc4c9c6,fogFar:150,hemi:[0xe8e8e4,0xb8b8b0,.9],dl:[0xffffff,.5,[2,3,2]],rain:false},
    rain:{sky:0x707a80,fog:0x78827f,fogFar:320,hemi:[0xb8c0c0,0x788078,.8],dl:[0xc8d0d0,.55,[2,3,2]],rain:true}
  },
  current:'day',drops:null,
  set(name){
    const p=this.presets[name];if(!p)return false;
    this.current=name;
    scene.background=new THREE.Color(p.sky);
    scene.fog=new THREE.Fog(p.fog,30,p.fogFar);
    hemi.color.set(p.hemi[0]);hemi.groundColor.set(p.hemi[1]);hemi.intensity=p.hemi[2];
    dl.color.set(p.dl[0]);dl.intensity=p.dl[1];dl.position.set(...p.dl[2]);
    if(p.rain&&!this.drops)this.makeRain();
    if(this.drops)this.drops.visible=!!p.rain;
    return true;
  },
  makeRain(){
    const N=700,pos=new Float32Array(N*3);
    for(let i=0;i<N;i++){pos[i*3]=(Math.random()-.5)*44;pos[i*3+1]=Math.random()*16;pos[i*3+2]=(Math.random()-.5)*44}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,1*3));
    this.drops=new THREE.Points(g,new THREE.PointsMaterial({color:0x9fb2bd,size:.055,transparent:true,opacity:.7,depthWrite:false}));
    this.drops.frustumCulled=false;scene.add(this.drops);
  },
  step(dt){
    if(!this.drops||!this.drops.visible)return;
    const a=this.drops.geometry.attributes.position.array,hx=locomotion.root.x,hz=locomotion.root.z;
    for(let i=0;i<a.length;i+=3){
      a[i+1]-=dt*11;
      if(a[i+1]<groundYAt(a[i]+hx,a[i+2]+hz)-locomotion.root.y){a[i]=(Math.random()-.5)*44;a[i+1]=14+Math.random()*3;a[i+2]=(Math.random()-.5)*44}
    }
    this.drops.position.set(hx,locomotion.root.y,hz);
    this.drops.geometry.attributes.position.needsUpdate=true;
  }
};
WEATHER.set('day');
// ---- props: the ball and the bowl are entities of the one world
const ball={state:'free',p:new THREE.Vector3(px2w(34),DECK+.055,py2w(146)),v:new THREE.Vector3(),r:.055};
const bowl={p:new THREE.Vector3(px2w(66),DECK,py2w(102)),food:false,meal:0};
const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),new THREE.MeshStandardMaterial({color:0xa8392b,roughness:.7}));
scene.add(ballMesh);
const bowlMesh=new THREE.Mesh(new THREE.CylinderGeometry(.11,.085,.055,18,1,true),new THREE.MeshStandardMaterial({color:0x56606e,roughness:.6,side:THREE.DoubleSide}));
bowlMesh.position.copy(bowl.p).y+=.028;scene.add(bowlMesh);
const foodMesh=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.03,14),new THREE.MeshStandardMaterial({color:0x7a5a30,roughness:1}));
foodMesh.position.copy(bowl.p).y+=.035;foodMesh.visible=false;scene.add(foodMesh);
const _pushInfo={x:0,z:0,hit:false,id:''};
function stepBall(dt){
  if(ball.state==='hero'){rig.mesh.updateMatrixWorld(true);ball.p.copy(rig.by.rightHand.getWorldPosition(new THREE.Vector3()));ball.v.set(0,0,0)}
  else if(ball.state==='free'&&ball.v.lengthSq()>1e-6){
    const N=4,h=dt/N;
    for(let i=0;i<N;i++){
      ball.v.y-=9.8*h;ball.p.addScaledVector(ball.v,h);
      _pushInfo.hit=false;PLACE.pushOutCircle(ball.p,ball.r,ball.p.y-ball.r*.8,ball.p.y+ball.r*.8,_pushInfo);
      if(_pushInfo.hit){const n=new THREE.Vector3(_pushInfo.x,0,_pushInfo.z).normalize();const d=ball.v.dot(n);if(d<0)ball.v.addScaledVector(n,-1.6*d)}
      const gy=PLACE.heightAt(ball.p.x,ball.p.z);
      if(ball.p.y<gy+ball.r){ball.p.y=gy+ball.r;if(ball.v.y<0)ball.v.y*=-.42;ball.v.x*=.90;ball.v.z*=.90;
        if(Math.abs(ball.v.y)<.35&&ball.v.lengthSq()<.02){ball.v.set(0,0,0);break}}
    }
  }
  ballMesh.position.copy(ball.p);
  foodMesh.visible=bowl.food;
}
function throwBall(){
  if(ball.state!=='hero')return false;
  gameCommand('strike');
  rig.mesh.updateMatrixWorld(true);
  ball.state='free';ball.p.copy(rig.by.rightHand.getWorldPosition(new THREE.Vector3()));
  const dir=rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading);
  ball.v.set(dir.x*4.0,2.6,dir.z*4.0);buzz('throw',[12,26,10],400);
  try{argos.say('fetch the ball')}catch(e){}
  return true;
}
function takeBall(){
  if(ball.state!=='free')return false;
  const d=Math.hypot(ball.p.x-locomotion.root.x,ball.p.z-locomotion.root.z);
  if(d>1.05)return false;
  ball.state='hero';buzz('take',8,300);return true;
}
function feedBowl(){
  const d=Math.hypot(bowl.p.x-locomotion.root.x,bowl.p.z-locomotion.root.z);
  if(d>1.5||bowl.food)return false;
  bowl.food=true;bowl.meal=4;try{argos.say('dinner time, eat')}catch(e){}gameCommand('crouch',1);setTimeout(()=>gameCommand('crouch',0),650);buzz('feed',[8,20,8],400);return true;
}
// ---- one clock: the world advances inside the same tick as the body solver
let _fadeAcc=0,_uiAcc=0;
function worldStep(dt){
  locomotion.root.y=groundYAt(locomotion.root.x,locomotion.root.z);
  const gy=locomotion.root.y;
  for(let i=0;i<3;i++)PLACE.pushOutCircle(locomotion.root,.17,gy+.14,gy+1.55,null,false);
  // wedged in a seam (window/bench corner): give the step back rather than jitter
  worldStep._pr??=locomotion.root.clone();
  _pushInfo.hit=false;PLACE.pushOutCircle(locomotion.root,.155,gy+.14,gy+1.55,_pushInfo,false);
  if(_pushInfo.hit){locomotion.root.x=worldStep._pr.x;locomotion.root.z=worldStep._pr.z;
    locomotion.root.y=groundYAt(locomotion.root.x,locomotion.root.z)}
  worldStep._pr.copy(locomotion.root);
  for(const side of ['L','R']){const a=locomotion.footAnchor[side];PLACE.pushOutCircle(a,.07,a.y+.02,a.y+.42,null,false)}
  stepBall(dt);
  stepKick();
  STRIKER.step();
  WEATHER.step(dt);
  _fadeAcc+=dt;if(_fadeAcc>.05){_fadeAcc=0;updateStructFade()}
  _uiAcc+=dt;if(_uiAcc>.22){_uiAcc=0;updateWorldUI()}
}
function updateWorldUI(){
  const bb=$('#ballBtn'),fb=$('#feedBtn');if(!bb)return;
  const d=Math.hypot(ball.p.x-locomotion.root.x,ball.p.z-locomotion.root.z);
  bb.textContent=ball.state==='hero'?'THROW':ball.state==='dog'?'ARGOS':(d<=1.05?'TAKE':'FIRE');
  const sb2=$('#strikerBtn');if(sb2){sb2.textContent=STRIKER.on?'END':'PLAY';sb2.classList.toggle('on',STRIKER.on)}
  bb.classList.toggle('on',ball.state==='hero'||(ball.state==='free'&&d<=1.05));
  if(fb){const bd=Math.hypot(bowl.p.x-locomotion.root.x,bowl.p.z-locomotion.root.z);
    fb.textContent=bowl.food?'FED':'FEED';fb.classList.toggle('on',!bowl.food&&bd<=1.5)}
}
// move the whole standing hero (used by restore); every solver state travels together
function placeHero(x,z,heading){
  const dx=x-locomotion.root.x,dz=z-locomotion.root.z;
  const sh=new THREE.Vector3(dx,0,dz);
  for(const v of [locomotion.root,locomotion.rootGoal,locomotion.footAnchor.L,locomotion.footAnchor.R,
    dyn.leftHand.p,dyn.rightHand.p,dyn.pelvis.p,dynFeet.left.p,dynFeet.right.p,
    effective.leftHand,effective.rightHand,effective.leftFoot,effective.rightFoot,effective.pelvis,
    lastSafe.leftHand,lastSafe.rightHand,lastSafe.leftFoot,lastSafe.rightFoot,lastSafe.pelvis])v.add(sh);
  if(heading!=null){locomotion.heading=heading;locomotion.headingGoal=heading}
  locomotion.root.y=groundYAt(x,z);
}

const support=new THREE.Mesh(new THREE.RingGeometry(.17,.175,48),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide}));support.rotation.x=-Math.PI/2;support.position.y=GROUND_Y+.003;scene.add(support);


// ============================================================================
// DOG — the real ARGOS. The half-dog game contract (window.AR) owns mind,
// gaits, paw IK and traction; this host supplies terrain, walkability, the
// hero, the ball and the bowl — and renders the posed skeleton it hands back.
// NO TRACTION -> NO ACCELERATION / STEERING. The host never teleports him.
// ============================================================================
const DOG_SPAWN=[TR.x-2.1,0,TR.z-2.4];
const argos=AR.createArgos({});
argos.world.dog=DOG_SPAWN.slice();
argos.world.human=[0,0,0];
// The half-dog solves his stance against locally-flat ground. On the real
// hillside we answer terrain queries with the ground under his BODY, so his
// pads plant coherently and traction is truly earned; his root still rides
// the actual terrain height every step.
argos.setTerrain(()=>{const d=argos.world.dog;return PLACE.ground.heightAtDog(d[0],d[2])});
argos.setWalkable((x,z)=>PLACE.dogWalkable(x,z));
// --- skin: AR deforms its marching-tets surface on the CPU in world space;
//     three.js just displays it. Colors ride per-vertex from the dog's own palette.
const dogGroup=new THREE.Group();dogGroup.name='DOG.ARGOS';scene.add(dogGroup);
const dogExtraSkins=[AR.buildSkin(argos.rig,{region:'head'}),AR.buildSkin(argos.rig,{region:'jaw'})];
let dogSkinMeshes=[],dogFeatureMeshes=[];
function arGeoToThree(g){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(Array.from(g.pos),3));
  geo.setIndex(Array.from(g.idx));
  if(g.nrm&&g.nrm.length===g.pos.length)geo.setAttribute('normal',new THREE.Float32BufferAttribute(Array.from(g.nrm),3));
  else geo.computeVertexNormals();
  return geo;
}
const DOG_PALETTE=[[216,118,39],[244,224,189],[247,211,200],[27,24,22],[252,250,246],[90,50,25],[74,52,50],[249,247,240],[202,109,113],[217,152,141]];
function addSkinMesh(skin){
  if(!skin)return;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(skin.pos.length),3));
  geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(skin.nrm.length),3));
  const col=new Float32Array(skin.verts*3);
  for(let i=0;i<skin.verts;i++){const rgb=DOG_PALETTE[skin.mat[i]]||DOG_PALETTE[0];col[i*3]=rgb[0]/255;col[i*3+1]=rgb[1]/255;col[i*3+2]=rgb[2]/255}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.setIndex(Array.from(skin.idx));
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0}));
  mesh.frustumCulled=false;dogGroup.add(mesh);
  dogSkinMeshes.push({skin,mesh});
}
function buildDogVisual(){
  addSkinMesh(argos.skin);
  for(const sk of dogExtraSkins)addSkinMesh(sk);
  // features (eyes, teeth, tongue) are solids outside the fused skin: follow bone worlds
  const FEATURES=['leftEye','rightEye','leftIris','rightIris','leftPupil','rightPupil','upperTeeth','lowerTeeth','tongue','nose'];
  for(const name of FEATURES){
    const n=argos.rig.nodes[name];if(!n||!n.solid)continue;
    const rgb=DOG_PALETTE[n.mat]||DOG_PALETTE[3];
    const m=new THREE.Mesh(arGeoToThree(AR.geoForSolid(n.solid)),new THREE.MeshStandardMaterial({color:new THREE.Color(rgb[0]/255,rgb[1]/255,rgb[2]/255),roughness:.5}));
    m.matrixAutoUpdate=false;m.frustumCulled=false;dogGroup.add(m);
    dogFeatureMeshes.push({node:n,mesh:m});
  }
}
buildDogVisual();
function syncDogVisual(){
  for(const sk of dogExtraSkins)AR.skinDeform(argos.rig,sk);   // body skin deforms inside argos.tick
  for(const e of dogSkinMeshes){
    e.mesh.geometry.attributes.position.array.set(e.skin.pos);
    e.mesh.geometry.attributes.normal.array.set(e.skin.nrm);
    e.mesh.geometry.attributes.position.needsUpdate=true;
    e.mesh.geometry.attributes.normal.needsUpdate=true;
  }
  for(const f of dogFeatureMeshes){f.mesh.matrix.fromArray(f.node.world);f.mesh.matrixWorldNeedsUpdate=true}
}
// collision presence of the dog for the hero's limb solver: derived from the
// same posed skeleton that is rendered
function dogCollisionCapsules(){
  const N=argos.rig.nodes,W=n=>N[n]?new THREE.Vector3(N[n].world[12],N[n].world[13],N[n].world[14]):null;
  const chest=W('chest'),loin=W('loin'),head=W('head');
  const caps=[];
  if(chest&&loin)caps.push({name:'dog body',a:loin,b:chest,r:.17});
  if(head)caps.push({name:'dog head',a:head,b:head,r:.13});
  return caps;
}
const dogMind={look:new THREE.Vector3(),pointTarget:new THREE.Vector3(),interest:.5,obey:0};
function pointingFloorTarget(){
  let best=null,bestP=0;for(const side of ['L','R']){const st=pole?.[side];if(!st||st.point<=bestP)continue;const h=rig.by[side==='L'?'leftHand':'rightHand'].getWorldPosition(new THREE.Vector3()),sh=rig.by[side==='L'?'leftUpperArm':'rightUpperArm'].getWorldPosition(new THREE.Vector3()),d=h.clone().sub(sh).normalize();let q=h.clone();if(d.y<-.04){const k=(groundYAt(h.x,h.z)-h.y)/d.y;if(k>0&&k<5)q=h.clone().addScaledVector(d,k);else q.addScaledVector(d,1.4)}else q.addScaledVector(d,1.4);q.y=groundYAt(q.x,q.z);best={q,side};bestP=st.point}return best
}

function insideShell(x,z){
  const px=(x-TR.x)/IN+50.5,py=(z-TR.z)/IN+120;
  return px>0&&px<101&&py>0&&py<240;
}
const DOOR_MID=(DOOR.z0+DOOR.z1)/2;
function routeForDog(target){
  if(!target)return target;
  const d=argos.world.dog,di=insideShell(d[0],d[2]),ti=insideShell(target[0],target[2]);
  if(di===ti)return target;
  const nearDoor=Math.hypot(d[0]-DOOR.x,d[2]-DOOR_MID)<1.0;
  if(nearDoor)return [di?DOOR.x-0.85:DOOR.x+0.85,0,DOOR_MID];
  return [di?DOOR.x+0.55:DOOR.x-0.55,0,DOOR_MID];
}
let _dogEatT=0;
function updateDog(t,dt){
  const hero=locomotion.root;
  const heroP=STRIKER.on&&argos.world.carrying?[STRIKER.dogGoal.x,0,STRIKER.dogGoal.z]:[hero.x,0,hero.z];
  argos.world.human=routeForDog(heroP);
  const pt=pointingFloorTarget();
  if(pt){dogMind.pointTarget.copy(pt.q);argos.world.handPose='lure'}
  else argos.world.handPose=(ball.state==='hero'?'extended':'none');
  argos.world.ball=ball.state==='free'?routeForDog([ball.p.x,ball.p.y,ball.p.z]):null;
  argos.world.bowl=bowl.food?routeForDog([bowl.p.x,0,bowl.p.z]):null;
  const st=argos.tick(Math.min(dt,.05));
  const d=argos.world.dog;
  // host consequences: mouth meets ball, ball comes home, food is eaten.
  if(ball.state==='free'&&st.winner==='FETCH'&&Math.hypot(d[0]-ball.p.x,d[2]-ball.p.z)<.5){
    ball.state='dog';argos.world.carrying=true;buzz('dogtake',6,600);
  }
  if(ball.state==='dog'){
    const m=argos.rig.nodes.muzzle;if(m)ball.p.set(m.world[12],m.world[13]-.04,m.world[14]);
    const home=STRIKER.on?STRIKER.dogGoal:{x:hero.x,z:hero.z};
    if(Math.hypot(d[0]-home.x,d[2]-home.z)<1.25){
      argos.world.carrying=false;ball.state='free';
      const gy=PLACE.heightAt(ball.p.x,ball.p.z);ball.p.y=gy+ball.r;ball.v.set(0,0,0);
      buzz('dogdrop',[8,22,8],600);
    }
  }
  if(st.winner==='EAT'&&bowl.food&&Math.hypot(d[0]-bowl.p.x,d[2]-bowl.p.z)<.85){
    _dogEatT+=dt;argos.mind.iv.hunger=Math.max(0,argos.mind.iv.hunger-dt*.10);
    if(_dogEatT>bowl.meal||argos.mind.iv.hunger<0.3){bowl.food=false;_dogEatT=0}
  }
  for(const ev of argos.events)if(ev.type==='bark'){buzz('dogbark',[16,36,12],900);chat.line('dog','WOOF')}
  dogMind.interest=clamp(1-argos.mind.iv.fatigue,0,1);
  dogMind.obey=argos.world.handPose==='lure'?.8:0;
  dogMind.look.set(d[0],d[1],d[2]);
  syncDogVisual();
}
function argosReset(){
  argos.world.dog=DOG_SPAWN.slice();
  argos.world.carrying=false;argos.world.cue='';
  argos.loco.heading=0;argos.loco.speed=0;argos.loco.desiredSpeed=0;
  if(ball.state==='dog')ball.state='free';
}

const RIG=[
['hips',null,[0,.95,0]],['spine','hips',[0,1.06,0]],['chest','spine',[0,1.20,0]],['neck','chest',[0,1.44,0]],['head','neck',[0,1.52,0]],
['leftShoulder','chest',[.07,1.40,0]],['leftUpperArm','leftShoulder',[.16,1.40,0]],['leftLowerArm','leftUpperArm',[.42,1.40,0]],['leftHand','leftLowerArm',[.66,1.40,0]],
['rightShoulder','chest',[-.07,1.40,0]],['rightUpperArm','rightShoulder',[-.16,1.40,0]],['rightLowerArm','rightUpperArm',[-.42,1.40,0]],['rightHand','rightLowerArm',[-.66,1.40,0]],
['leftUpperLeg','hips',[.092,.92,0]],['leftLowerLeg','leftUpperLeg',[.092,.52,0]],['leftFoot','leftLowerLeg',[.092,.10,0]],
['rightUpperLeg','hips',[-.092,.92,0]],['rightLowerLeg','rightUpperLeg',[-.092,.52,0]],['rightFoot','rightLowerLeg',[-.092,.10,0]]
];
const SEG=[
['hips',[-.05,.95,0],[.05,.95,0],.118,.55],['spine',[0,1.06,0],[0,1.20,0],.102,.55],['chest',[0,1.20,0],[0,1.35,0],.112,.55],['neck',[0,1.42,0],[0,1.56,0],.047,.90],['head',[0,1.605,0],[0,1.665,0],.105,.10],
['leftShoulder',[.07,1.40,0],[.15,1.40,0],.052,.15],['leftUpperArm',[.16,1.40,0],[.42,1.40,0],.048,.30],['leftLowerArm',[.42,1.40,0],[.66,1.40,0],.042,.78],['leftHand',[.66,1.40,0],[.76,1.40,0],.055,.30],
['rightShoulder',[-.07,1.40,0],[-.15,1.40,0],.052,.15],['rightUpperArm',[-.16,1.40,0],[-.42,1.40,0],.048,.30],['rightLowerArm',[-.42,1.40,0],[-.66,1.40,0],.042,.78],['rightHand',[-.66,1.40,0],[-.76,1.40,0],.055,.30],
['leftUpperLeg',[.092,.92,0],[.092,.52,0],.064,.75],['leftLowerLeg',[.092,.52,0],[.092,.11,0],.052,.40],['leftFoot',[.092,.078,0],[.092,.078,.15],.050,.08],
['rightUpperLeg',[-.092,.92,0],[-.092,.52,0],.064,.75],['rightLowerLeg',[-.092,.52,0],[-.092,.11,0],.052,.40],['rightFoot',[-.092,.078,0],[-.092,.078,.15],.050,.08]
];
function makeRig(){
  const bones=[],by={};
  for(const [name,parent,w] of RIG){const b=new THREE.Bone();b.name=name;const pw=parent?by[parent]._w:[0,0,0];b.position.set(w[0]-pw[0],w[1]-pw[1],w[2]-pw[2]);b._bind=b.position.clone();b._w=w;if(parent)by[parent].add(b);bones.push(b);by[name]=b}
  const idx={};bones.forEach((b,i)=>idx[b.name]=i);const parts=[],up=new THREE.Vector3(0,1,0);
  for(const [bn,f,t,r,tone] of SEG){const a=new THREE.Vector3(...f),z=new THREE.Vector3(...t),d=z.clone().sub(a),len=Math.max(.001,d.length());const g=new THREE.CapsuleGeometry(r,len,5,12);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,d.clone().normalize()));g.translate(...a.clone().add(z).multiplyScalar(.5).toArray());const n=g.attributes.position.count,si=new Uint16Array(n*4),sw=new Float32Array(n*4),col=new Float32Array(n*3);const lin=tone<=.04045?tone/12.92:Math.pow((tone+.055)/1.055,2.4);for(let i=0;i<n;i++){si[i*4]=idx[bn];sw[i*4]=1;col[i*3]=col[i*3+1]=col[i*3+2]=lin}g.setAttribute('skinIndex',new THREE.BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));g.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(g)}
  const geo=mergeGeometries(parts,false),mat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0});const mesh=new THREE.SkinnedMesh(geo,mat);mesh.frustumCulled=false;mesh.add(by.hips);mesh.updateMatrixWorld(true);const skel=new THREE.Skeleton(bones);mesh.bind(skel);
  const og=geo.clone(),p=og.attributes.position,n=og.attributes.normal;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+n.getX(i)*.008,p.getY(i)+n.getY(i)*.008,p.getZ(i)+n.getZ(i)*.008);const outline=new THREE.SkinnedMesh(og,new THREE.MeshBasicMaterial({color:0x000000,side:THREE.BackSide}));outline.bind(skel,mesh.matrixWorld);outline.frustumCulled=false;
  return{mesh,outline,bones,by,skeleton:skel}
}
const rig=makeRig();scene.add(rig.mesh,rig.outline);

// readable face; head orientation is now a solved target, never a pendulum.
const fcv=document.createElement('canvas');fcv.width=160;fcv.height=160;const fc=fcv.getContext('2d');function drawFace(){fc.clearRect(0,0,160,160);fc.fillStyle='#fff';fc.beginPath();fc.ellipse(80,82,64,70,0,0,Math.PI*2);fc.fill();fc.fillStyle='#000';fc.fillRect(30,49,38,8);fc.fillRect(92,49,38,8);for(const x of [49,111]){fc.beginPath();fc.arc(x,73,10,0,Math.PI*2);fc.fill()}fc.fillRect(76,73,8,34);fc.fillRect(68,102,24,7);fc.beginPath();fc.ellipse(80,122,23,7,0,0,Math.PI*2);fc.fill()}drawFace();const ftx=new THREE.CanvasTexture(fcv);const face=new THREE.Mesh(new THREE.PlaneGeometry(.205,.205),new THREE.MeshBasicMaterial({map:ftx,transparent:true}));face.position.set(0,.115,.109);rig.by.head.add(face);

const DEG=Math.PI/180;
function resetSkeleton(){for(const b of rig.bones){b.position.copy(b._bind);b.quaternion.identity()}rig.by.leftUpperArm.rotation.z=-68*DEG;rig.by.rightUpperArm.rotation.z=68*DEG;rig.by.leftLowerArm.rotation.y=-8*DEG;rig.by.rightLowerArm.rotation.y=8*DEG;rig.mesh.updateMatrixWorld(true)}
resetSkeleton();

// --- BODY CAPABILITY LAYER --------------------------------------------------
// A sparse inverse-reachability atlas, muscle/ligament-like angular resistance,
// and a small game action API. These sit underneath teleoperation rather than
// replacing the user's hand/foot targets.
const atlas={group:new THREE.Group(),on:false,built:false};scene.add(atlas.group);
function atlasClassify(p,shoulder){
  const d=p.distanceTo(shoulder),front=p.z;
  const torso=(Math.abs(p.x)<.18&&p.y>.72&&p.y<1.56&&p.z<.20);
  const headZone=(Math.abs(p.x)<.16&&p.y>1.45&&p.y<1.82&&p.z<.16);
  if(torso||headZone||d>.78||d<.10)return 4; // unreachable / self collision
  if(d<.49&&front>.02)return 1;              // arm only
  if(d<.62&&front>-.08)return 2;             // shoulder/chest assist
  if(d<.74)return 3;                         // pelvis / whole-body assist
  return 4;
}
function buildReachAtlas(){
  atlas.group.clear();
  rig.mesh.updateMatrixWorld(true);
  const ls=rig.by.leftUpperArm.getWorldPosition(new THREE.Vector3()),rs=rig.by.rightUpperArm.getWorldPosition(new THREE.Vector3());
  const pos=[],col=[];const C={1:new THREE.Color(0x2878ff),2:new THREE.Color(0x28b874),3:new THREE.Color(0xffb000),4:new THREE.Color(0xff3b30)};
  for(let y=.20;y<=1.95;y+=.11)for(let x=-.92;x<=.92;x+=.11)for(let z=-.28;z<=.98;z+=.11){
    const p=new THREE.Vector3(x,y,z),stage=Math.min(atlasClassify(p,ls),atlasClassify(p,rs));
    if(stage===4&&((x*x)+(z*z))>.82)continue; // keep red shell sparse
    pos.push(x,y,z);const c=C[stage];col.push(c.r,c.g,c.b);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const pts=new THREE.Points(g,new THREE.PointsMaterial({size:.026,vertexColors:true,transparent:true,opacity:.34,depthWrite:false,sizeAttenuation:true}));atlas.group.add(pts);atlas.built=true;
}
function setAtlas(on){atlas.on=!!on;if(atlas.on&&!atlas.built)buildReachAtlas();atlas.group.visible=atlas.on;$('#atlasLegend')?.classList.toggle('on',atlas.on);$('#atlasBtn')?.classList.toggle('on',atlas.on);return atlas.on}
atlas.group.visible=false;


// --- UNIFIED BODY DATA BUS -------------------------------------------------
// One schema for every source: controller, phone sensors, gamepad, imported
// animation, external pose/hand/face trackers, network peers and the solved
// body itself. Sources are timestamped and expire automatically.
const DATA_VERSION='EVERYBODY-DATA-1';
const dataBus={
  sources:new Map(),subscribers:new Set(),recording:false,frames:[],lastRecordAt:0,
  recordHz:20,maxFrames:20*60*10, // ten minutes at 20 Hz
  externalWeight:1,gamepadEnabled:false,network:null,broadcast:null,
  push(name,payload,opts={}){const now=performance.now(),entry={name,payload,confidence:clamp(opts.confidence??1,0,1),weight:clamp(opts.weight??1,0,1),ttl:opts.ttl??500,time:now};this.sources.set(name,entry);for(const fn of this.subscribers)try{fn(entry)}catch(_){}return entry},
  get(name){const e=this.sources.get(name);if(!e)return null;if(e.ttl!==Infinity&&performance.now()-e.time>e.ttl){this.sources.delete(name);return null}return e},
  active(){const out={};for(const k of [...this.sources.keys()]){const e=this.get(k);if(e)out[k]=e}return out},
  subscribe(fn){this.subscribers.add(fn);return()=>this.subscribers.delete(fn)},
  setWeight(w){this.externalWeight=clamp(Number(w)||0,0,1);return this.externalWeight},
  record(on=true){this.recording=!!on;if(this.recording){this.frames=[];this.lastRecordAt=0}return this.recording},
  clear(){this.frames.length=0},
  export(){return{version:DATA_VERSION,created:new Date().toISOString(),frames:this.frames.slice()}},
  download(name='everybody-data.json'){const blob=new Blob([JSON.stringify(this.export())],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},
  connectBroadcast(name='everybody-body'){try{this.broadcast?.close?.();this.broadcast=new BroadcastChannel(name);this.broadcast.onmessage=e=>this.push('network',e.data,{ttl:300,confidence:e.data?.confidence??1});return true}catch(_){return false}},
  connectWebSocket(url){try{this.network?.close?.();const ws=new WebSocket(url);ws.onmessage=e=>{try{this.push('network',JSON.parse(e.data),{ttl:300})}catch(_){}};this.network=ws;return ws}catch(_){return null}}
};
function vArr(v){return[v.x,v.y,v.z]}
function qArr(q){return[q.x,q.y,q.z,q.w]}
function jointAngleWorld(a,b,c){const A=rig.by[a].getWorldPosition(new THREE.Vector3()),B=rig.by[b].getWorldPosition(new THREE.Vector3()),C=rig.by[c].getWorldPosition(new THREE.Vector3()),u=A.sub(B).normalize(),v=C.sub(B).normalize();return Math.acos(clamp(u.dot(v),-1,1))/DEG}
function currentBodyFrame(){
  rig.mesh.updateMatrixWorld(true);
  const W=n=>rig.by[n].getWorldPosition(new THREE.Vector3()),Q=n=>rig.by[n].getWorldQuaternion(new THREE.Quaternion());
  const lh=W('leftHand'),rh=W('rightHand'),lf=W('leftFoot'),rf=W('rightFoot'),pel=W('hips'),head=W('head'),ls=W('leftUpperArm'),rs=W('rightUpperArm');
  return{
    t:performance.now(),positions:{pelvis:vArr(pel),head:vArr(head),leftHand:vArr(lh),rightHand:vArr(rh),leftFoot:vArr(lf),rightFoot:vArr(rf)},
    orientation:{pelvis:qArr(Q('hips')),head:qArr(Q('head')),leftHand:qArr(Q('leftHand')),rightHand:qArr(Q('rightHand')),leftFoot:qArr(Q('leftFoot')),rightFoot:qArr(Q('rightFoot'))},
    joints:{leftElbow:jointAngleWorld('leftUpperArm','leftLowerArm','leftHand'),rightElbow:jointAngleWorld('rightUpperArm','rightLowerArm','rightHand'),leftKnee:jointAngleWorld('leftUpperLeg','leftLowerLeg','leftFoot'),rightKnee:jointAngleWorld('rightUpperLeg','rightLowerLeg','rightFoot')},
    reach:{left:atlasClassify(lh,ls),right:atlasClassify(rh,rs)},contacts:{...contacts},limits:{...limits},game:{...game},motion:{active:motionPlayer.active,name:motionPlayer.name},
    inputs:{armL:{x:pole.L.x,y:pole.L.y,z:pole.L.wind,fieldX:pole.L.fieldX,fieldY:pole.L.fieldY,pinned:pole.L.pinned},armR:{x:pole.R.x,y:pole.R.y,z:pole.R.wind,fieldX:pole.R.fieldX,fieldY:pole.R.fieldY,pinned:pole.R.pinned},legL:{x:legCtl.L.x,y:legCtl.L.y,z:legCtl.L.wind,fieldX:legCtl.L.fieldX,fieldY:legCtl.L.fieldY,pinned:legCtl.L.pinned},legR:{x:legCtl.R.x,y:legCtl.R.y,z:legCtl.R.wind,fieldX:legCtl.R.fieldX,fieldY:legCtl.R.fieldY,pinned:legCtl.R.pinned},head:{x:headCtl.x,y:headCtl.y,roll:headCtl.wind,fieldX:headCtl.fieldX,fieldY:headCtl.fieldY}},
    device:{enabled:motion.enabled,pitch:motion.pitch,roll:motion.roll,source:motion.source,hasSample:motion.hasSample}
  }
}
function normalizeTarget(v){if(v?.isVector3)return v.clone();if(Array.isArray(v)&&v.length>=3)return new THREE.Vector3(+v[0]||0,+v[1]||0,+v[2]||0);if(v&&typeof v==='object')return new THREE.Vector3(+v.x||0,+v.y||0,+v.z||0);return null}
function externalTarget(name){
  const sources=['externalPose','hands','network','xr','mocap'];
  for(const src of sources){const e=dataBus.get(src),v=e?.payload?.targets?.[name]??e?.payload?.[name];const p=normalizeTarget(v);if(p)return{p,w:dataBus.externalWeight*e.weight*e.confidence,source:src}}
  return null
}
function blendExternalTargets(d){for(const name of ['pelvis','leftHand','rightHand','leftFoot','rightFoot']){const e=externalTarget(name);if(!e)continue;const w=clamp(e.w,0,1);d[name].lerp(e.p,w)}return d}
function poseWorldLandmarks(landmarks,opts={}){
  if(!landmarks||landmarks.length<29)return null;const V=i=>{const p=landmarks[i];return p?new THREE.Vector3(+p.x||0,+p.y||0,+p.z||0):null},avg=(a,b)=>a&&b?a.clone().add(b).multiplyScalar(.5):a||b;
  const hip=avg(V(23),V(24)),sh=avg(V(11),V(12));if(!hip||!sh)return null;const shoulderWidth=Math.max(.05,V(11)?.distanceTo(V(12))||.30),scale=(opts.scale||.32)/shoulderWidth,mirror=opts.mirror??true;
  const map=p=>{if(!p)return null;return[(mirror?-1:1)*(p.x-hip.x)*scale,.95-(p.y-hip.y)*scale,(opts.front??.22)-(p.z-hip.z)*scale]};
  const payload={targets:{pelvis:[0,.95,opts.pelvisZ||0],leftHand:map(V(15)),rightHand:map(V(16)),leftFoot:map(V(27)),rightFoot:map(V(28))},landmarks,format:'mediapipe-pose-world'};
  return pushPoseData(payload,{ttl:opts.ttl??180,confidence:opts.confidence??1,weight:opts.weight??1})
}
function handWorldLandmarks(side,landmarks,opts={}){if(!landmarks?.length)return null;const wrist=landmarks[0],tip=landmarks[9]||wrist;if(!wrist)return null;const p=tip;const target=[(opts.mirror??true?-1:1)*(+p.x||0)*(opts.scale||1),(.95-(+p.y||0)*(opts.scale||1)),(opts.front??.28)-(+p.z||0)*(opts.scale||1)];return pushHandData({targets:{[side==='L'?'leftHand':'rightHand']:target},landmarks,side},{ttl:opts.ttl??160,confidence:opts.confidence??1,weight:opts.weight??.7})}
const dataPlayback={active:false,frames:[],time:0,index:0,duration:0};
function playDataRecording(obj){if(!obj||obj.version!==DATA_VERSION||!Array.isArray(obj.frames)||!obj.frames.length)throw new Error('Not an EVERYBODY data recording');dataPlayback.frames=obj.frames;dataPlayback.time=0;dataPlayback.index=0;const t0=obj.frames[0]?.body?.t||0,t1=obj.frames.at(-1)?.body?.t||t0;dataPlayback.duration=Math.max(.01,(t1-t0)/1000);dataPlayback.active=true;stopMotion();return true}
function updateDataPlayback(dt){if(!dataPlayback.active)return;dataPlayback.time+=dt;const f=dataPlayback.frames[dataPlayback.index],t0=dataPlayback.frames[0]?.body?.t||0;while(dataPlayback.index<dataPlayback.frames.length-1&&((dataPlayback.frames[dataPlayback.index+1]?.body?.t||t0)-t0)/1000<=dataPlayback.time)dataPlayback.index++;const body=dataPlayback.frames[dataPlayback.index]?.body;if(body?.positions){dataBus.push('mocap',{targets:{pelvis:body.positions.pelvis,leftHand:body.positions.leftHand,rightHand:body.positions.rightHand,leftFoot:body.positions.leftFoot,rightFoot:body.positions.rightFoot},recorded:true},{ttl:100,weight:1})}if(dataPlayback.time>=dataPlayback.duration){dataPlayback.active=false;dataBus.sources.delete('mocap')}}
function pushPoseData(payload,opts={}){return dataBus.push('externalPose',payload,{ttl:opts.ttl??300,confidence:opts.confidence??1,weight:opts.weight??1})}
function pushHandData(payload,opts={}){return dataBus.push('hands',payload,{ttl:opts.ttl??250,confidence:opts.confidence??1,weight:opts.weight??1})}
function pushFaceData(payload,opts={}){return dataBus.push('face',payload,{ttl:opts.ttl??250,confidence:opts.confidence??1,weight:opts.weight??1})}
function pushXRData(payload,opts={}){return dataBus.push('xr',payload,{ttl:opts.ttl??120,confidence:opts.confidence??1,weight:opts.weight??1})}
function updateGamepads(){
  if(!dataBus.gamepadEnabled||!navigator.getGamepads)return;const gp=[...navigator.getGamepads()].find(Boolean);if(!gp)return;
  const a=gp.axes||[],b=gp.buttons||[];dataBus.push('gamepad',{id:gp.id,axes:[...a],buttons:b.map(x=>x.value),targets:null},{ttl:100});
  // Optional controller mapping: two sticks become the two arm pads while
  // triggers supply depth. It is OFF by default so a connected pad never steals control.
  if(dataBus.gamepadEnabled==='control'){
    pole.R.x=clamp(a[0]||0,-1,1);pole.R.y=clamp(-(a[1]||0),-1,1);pole.L.x=clamp(a[2]||0,-1,1);pole.L.y=clamp(-(a[3]||0),-1,1);
    pole.R.wind=clamp((b[7]?.value||0)-(b[6]?.value||0),-1,1);pole.L.wind=pole.R.wind;
    if(b[0]?.pressed)gameCommand('jump');game.guard=b[4]?.pressed||b[5]?.pressed?1:0;
  }
}
function updateDataBus(){
  updateGamepads();
  dataBus.push('controller',{pole,legCtl,headCtl},{ttl:80});
  if(motion.hasSample)dataBus.push('device',{pitch:motion.pitch,roll:motion.roll,rawBeta:motion.rawBeta,rawGamma:motion.rawGamma,source:motion.source},{ttl:180});
  dataBus.push('game',{...game},{ttl:80});if(motionPlayer.active)dataBus.push('animation',{name:motionPlayer.name,active:true},{ttl:80});
  const body=currentBodyFrame();dataBus.push('body',body,{ttl:80});
  if(dataBus.recording&&performance.now()-dataBus.lastRecordAt>=1000/dataBus.recordHz){dataBus.lastRecordAt=performance.now();dataBus.frames.push({body,sources:Object.fromEntries(Object.entries(dataBus.active()).filter(([k])=>k!=='body').map(([k,e])=>[k,{payload:e.payload,confidence:e.confidence,weight:e.weight}]))});if(dataBus.frames.length>dataBus.maxFrames)dataBus.frames.shift()}
}

const MUSCLE_PROFILE={
  hips:{speed:2.35,stiff:6.0},spine:{speed:2.65,stiff:6.5},chest:{speed:2.85,stiff:7.0},neck:{speed:3.15,stiff:7.5},head:{speed:3.55,stiff:8.0},
  leftShoulder:{speed:3.65,stiff:7.4},rightShoulder:{speed:3.65,stiff:7.4},leftUpperArm:{speed:4.05,stiff:8.0},rightUpperArm:{speed:4.05,stiff:8.0},
  leftLowerArm:{speed:5.05,stiff:9.2},rightLowerArm:{speed:5.05,stiff:9.2},leftHand:{speed:5.8,stiff:10.2},rightHand:{speed:5.8,stiff:10.2},
  leftUpperLeg:{speed:3.7,stiff:7.6},rightUpperLeg:{speed:3.7,stiff:7.6},leftLowerLeg:{speed:4.8,stiff:9.0},rightLowerLeg:{speed:4.8,stiff:9.0},leftFoot:{speed:5.2,stiff:9.4},rightFoot:{speed:5.2,stiff:9.4}
};
const musclePose={};
function resetMuscles(){for(const name of Object.keys(MUSCLE_PROFILE)){const b=rig.by[name];if(b)musclePose[name]=b.quaternion.clone()}}
function muscleFilterPose(dt){
  const cocontract=(contacts.leftHand||contacts.rightHand||pole.L.pinned||pole.R.pinned||legCtl.L.pinned||legCtl.R.pinned)?1.22:1;
  for(const [name,p] of Object.entries(MUSCLE_PROFILE)){
    const b=rig.by[name];if(!b)continue;const target=b.quaternion.clone(),q=musclePose[name]||(musclePose[name]=target.clone()),ang=q.angleTo(target);
    const alpha=1-Math.exp(-p.stiff*cocontract*dt),maxStep=p.speed*cocontract*dt,step=Math.min(1,alpha,ang>1e-6?maxStep/ang:1);
    q.slerp(target,step);b.quaternion.copy(q);
  }
  rig.mesh.updateMatrixWorld(true);
}
resetMuscles();

const game={state:'idle',t:0,run:0,crouch:0,hide:0,guard:0,jumpT:-1,strikeT:-1};
function gameCommand(name,value=1){
  name=String(name||'').toLowerCase();
  if(name==='run')game.run=clamp(value,0,1);else if(name==='walk')game.run=.45;else if(name==='stop'){game.run=game.crouch=game.hide=game.guard=0;game.jumpT=game.strikeT=-1}
  else if(name==='jump')game.jumpT=0;else if(name==='crouch')game.crouch=value?1:0;else if(name==='hide')game.hide=value?1:0;else if(name==='guard')game.guard=value?1:0;else if(name==='strike'||name==='fight')game.strikeT=0;
  game.state=name;return game.state;
}
function updateGame(dt){game.t+=dt;if(game.jumpT>=0){game.jumpT+=dt;if(game.jumpT>.82)game.jumpT=-1}if(game.strikeT>=0){game.strikeT+=dt;if(game.strikeT>.48)game.strikeT=-1}}
function gameOffsets(){
  const run=game.run,phase=game.t*(6+run*5),jump=game.jumpT<0?0:Math.sin(Math.PI*clamp(game.jumpT/.82,0,1)),strike=game.strikeT<0?0:Math.sin(Math.PI*clamp(game.strikeT/.48,0,1)),hide=Math.max(game.hide,game.crouch);
  return{run,phase,jump,strike,hide,guard:game.guard};
}

const motionPlayer={active:false,mixer:null,action:null,name:'none'};
// Motion-file import (GLTF/FBX/BVH retarget) is not part of the self-contained
// HLIDARENDI build; the contact gait and controllers are the motion system.
async function loadMotionFile(){throw new Error('MOTION IMPORT NOT IN THIS BUILD')}
function stopMotion(){motionPlayer.mixer?.stopAllAction();motionPlayer.active=false;$('#motionBtn')?.classList.remove('on');resetSkeleton();resetMuscles()}


// V12 · MOTOR PRIOR ----------------------------------------------------------
// Reuse the project's animation idea as a gross-motor prior. The hidden CC0 rig
// supplies coordinated pelvis/hands timing; contact feet and inverse IK remain
// authoritative, so animations never get to slide the character through space.
const MOTOR_PRIOR_URL='https://raw.githubusercontent.com/danvanderboom/Aetherium/main/samples/unity/Aphelion/Assets/ThirdParty/Quaternius/Animated/reclaimer-finn.gltf';
const motorPrior={ready:false,loading:false,error:'',root:null,mixer:null,clips:new Map(),nodes:{},action:null,current:'',scale:1,baseHip:new THREE.Vector3(),baseFootY:0,weight:0};
function motorNorm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function motorNode(...cands){for(const c of cands){const n=motorNorm(c);for(const [name,node] of Object.entries(motorPrior.nodes))if(motorNorm(name)===n||motorNorm(name).endsWith(n))return node}return null}
function motorIndex(root){motorPrior.nodes={};root.traverse(o=>{if(o.name)motorPrior.nodes[o.name]=o})}
function motorChoose(type){
  if(!motorPrior.ready)return false;const wanted=type==='RUN'?'Run':type==='WALK'||type==='TURN'?'Walk':'Idle';
  let clip=motorPrior.clips.get(wanted)||[...motorPrior.clips.entries()].find(([k])=>k.toLowerCase()===wanted.toLowerCase())?.[1];if(!clip)return false;
  if(motorPrior.current===wanted&&motorPrior.action)return true;
  motorPrior.action?.fadeOut(.12);const a=motorPrior.mixer.clipAction(clip);a.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(1).fadeIn(.12).play();
  motorPrior.action=a;motorPrior.current=wanted;return true
}
function motorCalibrate(){
  const hip=motorNode('Hips','Hip'),head=motorNode('Head'),lf=motorNode('Foot.L','FootL','LeftFoot'),rf=motorNode('Foot.R','FootR','RightFoot');if(!hip||!head)return;
  motorPrior.root.updateMatrixWorld(true);hip.getWorldPosition(motorPrior.baseHip);const hp=new THREE.Vector3();head.getWorldPosition(hp),fp=new THREE.Vector3();
  if(lf)lf.getWorldPosition(fp);else if(rf)rf.getWorldPosition(fp);else fp.set(0,motorPrior.baseHip.y-1,0);motorPrior.baseFootY=fp.y;motorPrior.scale=1.55/Math.max(.2,hp.y-fp.y)
}
async function loadMotorPrior(){/* external motion prior is not part of the
  self-contained build; the contact gait remains the whole motor authority */}
function updateMotorPrior(dt){
  if(!motorPrior.ready)return;motorChoose(locomotion.motorState);const pace=clamp(explorer.speed/RUN_SPEED,0,1),a=motorPrior.action;
  if(a)a.timeScale=locomotion.motorState==='RUN'?1.05+pace*.55:locomotion.motorState==='WALK'||locomotion.motorState==='TURN'?.78+pace*.45:.72;
  motorPrior.mixer.update(dt);motorPrior.root.updateMatrixWorld(true);motorPrior.weight=lerp(motorPrior.weight,locomotion.walking>.04||locomotion.turning?.72:.25,1-Math.exp(-dt*4.5))
}
function motorMapped(cands,pelvisNow,out=new THREE.Vector3()){
  if(!motorPrior.ready)return null;const hip=motorNode('Hips','Hip'),n=motorNode(...cands);if(!hip||!n)return null;const hp=new THREE.Vector3();hip.getWorldPosition(hp);n.getWorldPosition(out);out.sub(hp).multiplyScalar(motorPrior.scale);out.z*=-1;out=rotateLocalY(out,locomotion.heading);out.add(pelvisNow);return out
}
function motorPriorTargets(){
  if(!motorPrior.ready)return null;const hip=motorNode('Hips','Hip');if(!hip)return null;const hp=new THREE.Vector3();hip.getWorldPosition(hp);const delta=hp.clone().sub(motorPrior.baseHip).multiplyScalar(motorPrior.scale);delta.z*=-1;delta.copy(rotateLocalY(delta,locomotion.heading));
  const pelvis=rootBase(base.pelvis).add(delta);return{
    pelvis,
    leftHand:motorMapped(['Hand.L','HandL','LeftHand','mixamorigLeftHand'],pelvis),rightHand:motorMapped(['Hand.R','HandR','RightHand','mixamorigRightHand'],pelvis),
    leftFoot:motorMapped(['Foot.L','FootL','LeftFoot','mixamorigLeftFoot'],pelvis),rightFoot:motorMapped(['Foot.R','FootR','RightFoot','mixamorigRightFoot'],pelvis)
  }
}

const MODE={
  HOLD:{freq:13,damp:1.12,gravity:.05,orient:.55},
  PUPPET:{freq:8.6,damp:1.02,gravity:.38,orient:.38},
  LOOSE:{freq:5.2,damp:.82,gravity:1.05,orient:.24}
};
let mode='PUPPET',headLock=true,headLockQ=new THREE.Quaternion(),ink=false,view3d=false;
const motion={
  enabled:false,hasSample:false,orientationSeen:false,motionSeen:false,genericSeen:false,
  neutralBeta:0,neutralGamma:0,neutralAccelPitch:0,neutralAccelRoll:0,targetPitch:0,targetRoll:0,pitch:0,roll:0,
  rawBeta:0,rawGamma:0,rawAccelPitch:0,rawAccelRoll:0,sampleCount:0,lastSampleAt:0,source:'none',waitStarted:0,
  permissionState:'off',permissionDetail:'',genericSensor:null,genericError:'',
  nudge:{L:new THREE.Vector3(),R:new THREE.Vector3(),body:new THREE.Vector3()},
  sensorLabel:'tilt off'
};

function makePadState(kind){return{x:0,y:0,wind:0,radius:0,edge:0,over:0,point:0,overX:0,overY:0,faceX:0,faceY:0,shoulder:0,cube:0,basePX:0,basePY:0,fieldX:0,fieldY:0,fieldMag:0,fieldBand:0,kind,pinned:false,pinGateAt:0,pinTimer:null,pinAnchor:null,pinOriginX:0,pinOriginY:0,secX:0,secY:0,secMag:0,secOver:0,pointer:null,lastAngle:null,down:null,lastTap:0,wasPoint:false}}
const pole={L:makePadState('arm'),R:makePadState('arm'),chord:{depth:0,yaw:0,roll:0,lift:0,fieldX:0,fieldY:0,fieldSpread:0,fieldRoll:0}};
const legCtl={L:makePadState('leg'),R:makePadState('leg')};
const headCtl={x:0,y:0,wind:0,radius:0,edge:0,over:0,faceX:0,faceY:0,lead:0,basePX:0,basePY:0,fieldX:0,fieldY:0,fieldMag:0,fieldBand:0,homeX:innerWidth*.5,homeY:120,pointer:null,lastAngle:null,down:null,lastTap:0};
const headDyn={x:0,y:0,roll:0,lead:0,faceX:0,faceY:0};
rig.mesh.updateMatrixWorld(true);
const base={
  pelvis:rig.by.hips.getWorldPosition(new THREE.Vector3()),
  leftHand:rig.by.leftHand.getWorldPosition(new THREE.Vector3()),
  rightHand:rig.by.rightHand.getWorldPosition(new THREE.Vector3())
};
const manual={leftHand:null,rightHand:null,leftFoot:null,rightFoot:null,pelvis:null};
const dyn={
  leftHand:{p:base.leftHand.clone(),v:new THREE.Vector3()},
  rightHand:{p:base.rightHand.clone(),v:new THREE.Vector3()},
  pelvis:{p:base.pelvis.clone(),v:new THREE.Vector3()}
};
const bendMemory={leftHand:null,rightHand:null,leftFoot:null,rightFoot:null};
const feet={left:rig.by.leftFoot.getWorldPosition(new THREE.Vector3()),right:rig.by.rightFoot.getWorldPosition(new THREE.Vector3())};
const FOOT_GROUND_Y=(feet.left.y+feet.right.y)*.5;
const FOOT_DATUM=FOOT_GROUND_Y-GROUND_Y;
function footGroundYAt(x,z){return groundYAt(x,z)+FOOT_DATUM}
const dynFeet={left:{p:feet.left.clone(),v:new THREE.Vector3()},right:{p:feet.right.clone(),v:new THREE.Vector3()}};
const limits={leftHand:false,rightHand:false,leftFoot:false,rightFoot:false,pelvis:false,head:false};
const contacts={leftHand:false,rightHand:false,leftFoot:false,rightFoot:false,pelvis:false};
const effective={leftHand:base.leftHand.clone(),rightHand:base.rightHand.clone(),leftFoot:feet.left.clone(),rightFoot:feet.right.clone(),pelvis:base.pelvis.clone()};
const lastSafe={leftHand:base.leftHand.clone(),rightHand:base.rightHand.clone(),leftFoot:feet.left.clone(),rightFoot:feet.right.clone(),pelvis:base.pelvis.clone()};

// The four endpoints are the controls.  The root is not a fifth joystick:
// it is inferred from reach, balance and the support feet.
const locomotion={
  root:new THREE.Vector3(),rootGoal:new THREE.Vector3(),velocity:new THREE.Vector3(),
  footAnchor:{L:feet.left.clone(),R:feet.right.clone()},
  step:null,nextSide:'L',state:'STAND',bend:0,sit:0,jump:0,reach:0,
  stride:.22,stance:.092,heading:0,headingGoal:0,walking:0,phase:0,gaitHalf:-1,moveDir:new THREE.Vector3(0,0,1),
  // V12: gross motor is a body state. Heading is admitted by foot contact, not
  // by rotating the root.  The current stance/swing relationship is explicit.
  drive:0,turn:0,turnError:0,stanceSide:'L',contactDrive:0,
  motorState:'IDLE',motorBlend:0,turning:false,lastContactSide:'L'
};
// Explorer input is deliberately separate from animation.  It asks the same
// inverse-body solver to move its inferred root; the feet still have to catch it.
const explorer={
  keys:new Set(),move:new THREE.Vector3(),speed:0,run:false,lastMoveAt:0,
  touchMove:new THREE.Vector2(),touchLook:new THREE.Vector2(),touchMoveMag:0,touchLookMag:0,
  inputMag:0,movePointer:null,lookPointer:null,mobileNav:false,
  cameraYaw:0,cameraPitch:.06,cameraRadius:0,cameraEngaged:false,
  lookBodyYaw:0,lookBodyPitch:0,lookStrength:0
};
const WALK_SPEED=2.15,RUN_SPEED=4.10,CREEP_SPEED=.58;
function rotateLocalY(v,yaw){const c=Math.cos(yaw),sn=Math.sin(yaw);return new THREE.Vector3(v.x*c+v.z*sn,v.y,-v.x*sn+v.z*c)}
function rootBase(v){return rotateLocalY(v,locomotion.heading).add(locomotion.root)}
// V13 · anatomical travel lanes ------------------------------------------------
// The rig's +X is anatomical LEFT.  Every automatic foot target is expressed in
// the current body frame, not world X/Z, so turning can never swap the legs.
function bodyAxes(yaw=locomotion.heading){
  return{lateral:rotateLocalY(new THREE.Vector3(1,0,0),yaw).normalize(),forward:rotateLocalY(new THREE.Vector3(0,0,1),yaw).normalize()}
}
function footLaneTarget(side,p,root=locomotion.root,yaw=locomotion.heading,manualish=false){
  const q=p.clone(),{lateral,forward}=bodyAxes(yaw),rel=q.clone().sub(root),sgn=side==='L'?1:-1;
  const lat=rel.dot(lateral),fwd=rel.dot(forward),minLane=manualish?.045:.075,maxLane=manualish?.52:.34;
  const safeLat=sgn*clamp(sgn*lat,minLane,maxLane);
  q.copy(root).addScaledVector(lateral,safeLat).addScaledVector(forward,fwd);q.y=p.y;return q
}
function separateFeet(L,R,root=locomotion.root,yaw=locomotion.heading,minSep=.145){
  const {lateral}=bodyAxes(yaw);let sep=L.clone().sub(R).dot(lateral);
  if(sep>=minSep)return;
  const d=(minSep-sep)*.5;L.addScaledVector(lateral,d);R.addScaledVector(lateral,-d)
}
function explorerMoveVector(){
  let x=0,z=0,keyActive=false;
  if(explorer.keys.has('KeyW')||explorer.keys.has('ArrowUp')){z+=1;keyActive=true}if(explorer.keys.has('KeyS')||explorer.keys.has('ArrowDown')){z-=1;keyActive=true}if(explorer.keys.has('KeyD')||explorer.keys.has('ArrowRight')){x+=1;keyActive=true}if(explorer.keys.has('KeyA')||explorer.keys.has('ArrowLeft')){x-=1;keyActive=true}
  if(!keyActive&&explorer.touchMoveMag>.02){x=explorer.touchMove.x;z=explorer.touchMove.y}
  const mag=keyActive?1:clamp(Math.hypot(x,z),0,1);explorer.inputMag=mag;
  if(mag<.025)return new THREE.Vector3();
  const f=camera.getWorldDirection(new THREE.Vector3());f.y=0;if(f.lengthSq()<1e-6)f.set(0,0,-1);f.normalize();
  const r=f.clone().cross(new THREE.Vector3(0,1,0)).normalize();
  return f.multiplyScalar(z).add(r.multiplyScalar(x)).normalize();
}
function updateMobileLook(dt){
  const active=explorer.lookPointer!=null&&explorer.touchLookMag>.015;
  const targetStrength=active?explorer.touchLookMag:0;
  explorer.lookStrength=lerp(explorer.lookStrength,targetStrength,1-Math.exp(-dt*(active?14:7)));
  explorer.lookBodyYaw=lerp(explorer.lookBodyYaw,active?-explorer.touchLook.x*1.32:0,1-Math.exp(-dt*(active?12:6)));
  explorer.lookBodyPitch=lerp(explorer.lookBodyPitch,active?explorer.touchLook.y*.78:0,1-Math.exp(-dt*(active?12:6)));
  if(!active)return;
  explorer.cameraEngaged=true;
  const response=.30+.70*smoothstep(.05,1,explorer.touchLookMag);
  explorer.cameraYaw-=explorer.touchLook.x*dt*2.35*response;
  explorer.cameraPitch=clamp(explorer.cameraPitch-explorer.touchLook.y*dt*1.55*response,-.38,.52);
  // A strong look is not a detached camera orbit.  It spills through neck/chest
  // into the hips and finally turns the planted body when the player is standing.
  if(explorer.touchLookMag>.48){
    const spill=smoothstep(.48,1,explorer.touchLookMag);
    locomotion.headingGoal+=-explorer.touchLook.x*dt*(locomotion.walking>.12?.78:1.72)*spill;
  }
}
function syncMobileInstrumentVisibility(){
  const travelHeld=IS_TOUCH&&explorer.movePointer!=null&&explorer.touchMoveMag>.045;
  explorer.mobileNav=travelHeld;
  document.body.classList.toggle('navigating',travelHeld);
  document.body.classList.toggle('deck-using',IS_TOUCH&&(explorer.movePointer!=null||explorer.lookPointer!=null));
}
const deckRoles={L:['arm','move','leg'],R:['arm','look','leg']};
function setDeckActive(side,role){
  const deck=$(side==='L'?'#deckL':'#deckR');if(!deck||deck.dataset.active===role)return;
  const roles=deckRoles[side],idx=roles.indexOf(role);if(idx<0)return;deck.dataset.active=role;
  const ordered=[roles[(idx+roles.length-1)%roles.length],role,roles[(idx+1)%roles.length]];
  for(const r of ordered){const item=deck.querySelector(`[data-role="${r}"]`);if(item)deck.appendChild(item)}
  for(const item of deck.querySelectorAll('.deckItem')){const on=item.dataset.role===role;item.classList.toggle('active',on);item.classList.toggle('secondary',!on)}
}
const instrumentMode={mode:'travel',puppet:{L:'arm',R:'arm'}};
function enterTravelMode(){
  instrumentMode.mode='travel';document.body.classList.add('travel-mode');document.body.classList.remove('puppet-mode');
  setDeckActive('L','move');setDeckActive('R','look');
}
function enterPuppetMode(side=null,role=null){
  instrumentMode.mode='puppet';
  if(side&&(role==='arm'||role==='leg'))instrumentMode.puppet[side]=role;
  document.body.classList.add('puppet-mode');document.body.classList.remove('travel-mode');
  setDeckActive('L',instrumentMode.puppet.L);setDeckActive('R',instrumentMode.puppet.R);
}
function wholeBodyDrive(){
  const w=clamp(locomotion.walking,0,1),pace=clamp(explorer.speed/RUN_SPEED,0,1),phase=locomotion.phase;
  const sw=Math.sin(phase),cw=Math.cos(phase),double=Math.sin(phase*2),lift=Math.abs(double);
  const drive=clamp(locomotion.drive*w,0,1),turn=clamp(locomotion.turn,-1,1);
  // V12 keeps the trunk stacked.  A believable walk uses weight transfer and
  // counter-rotation, not a permanent forward fall.
  const walkLean=lerp(.010,.038,pace)*drive;
  return{w,pace,drive,turn,sw,cw,double,lift,
    pelvisBob:-lift*(.012+.018*pace)*drive,
    pelvisSide:cw*(.030+.018*pace)*drive,
    pelvisYaw:sw*(.050+.040*pace)*drive,
    chestYaw:-sw*(.085+.070*pace)*drive,
    shoulderSwing:sw*(.14+.18*pace)*drive*(1-Math.min(1,Math.abs(turn))*.72),
    forwardLean:walkLean,
    turnLean:turn*(.025+.032*drive),
    armSwing:(.13+.18*pace)*drive
  }
}
function ghostPoint(el,x,y,mag=1){const g=el?.querySelector('.autoNub');if(!g)return;const item=el.closest?.('.deckItem'),rad=item?(item.classList.contains('active')?29:11):17,m=Math.min(1,Math.hypot(x,y));g.style.opacity=String(.24+.70*clamp(mag,0,1));g.style.transform=`translate(-50%,-50%) translate(${clamp(x,-1,1)*rad}px,${clamp(-y,-1,1)*rad}px)`}
function updateControllerTelemetry(){
  if(!IS_TOUCH)return;
  const gait=locomotion.walking,gs=Math.sin(locomotion.phase),gc=Math.cos(locomotion.phase),amp=clamp(explorer.speed/RUN_SPEED,0,1)*gait;
  const turn=clamp(explorer.lookBodyYaw*explorer.lookStrength,-1,1),pitch=clamp(explorer.lookBodyPitch*explorer.lookStrength,-1,1);
  // The small instruments are a live explanation of the inverse solver. During
  // travel they show the virtual stick motions being generated for the limbs.
  const armSwing=gs*.72*amp,legL=Math.max(0,gs)*.86*amp,legR=Math.max(0,-gs)*.86*amp;
  ghostPoint($('#joyRA'),turn*.20,-armSwing+pitch*.10,amp+Math.abs(turn)*.35);
  ghostPoint($('#joyLA'),turn*.20, armSwing+pitch*.10,amp+Math.abs(turn)*.35);
  ghostPoint($('#joyRL'),turn*.15, legL+gc*.12*amp,amp+Math.abs(turn)*.25);
  ghostPoint($('#joyLL'),turn*.15, legR-gc*.12*amp,amp+Math.abs(turn)*.25);
  ghostPoint($('#joyH'),clamp(-turn*.78,-1,1),clamp(-pitch*.76,-1,1),Math.max(explorer.lookStrength,amp*.25));
}
enterTravelMode();
function updateExplorer(dt){
  updateMobileLook(dt);syncMobileInstrumentVisibility();
  const dir=explorerMoveVector(),moving=dir.lengthSq()>.01;explorer.move.lerp(dir,1-Math.exp(-dt*16));
  if(moving&&!locomotion.inputMoving)locomotion.stepClock=99;locomotion.inputMoving=moving;
  const keyRun=explorer.keys.has('ShiftLeft')||explorer.keys.has('ShiftRight');
  let targetDrive=0;
  if(moving){
    let targetSpeed;
    if(explorer.touchMoveMag>.02&&!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>explorer.keys.has(k))){
      const m=explorer.inputMag;
      targetSpeed=m<.28?lerp(CREEP_SPEED,WALK_SPEED*.72,smoothstep(.07,.28,m)):m<.78?lerp(WALK_SPEED*.72,WALK_SPEED,smoothstep(.28,.78,m)):lerp(WALK_SPEED,RUN_SPEED,smoothstep(.78,1,m));
      explorer.run=m>.82;targetDrive=m;
    }else{targetSpeed=keyRun?RUN_SPEED:WALK_SPEED;explorer.run=keyRun;targetDrive=1}
    if(explorer.boostHold){targetSpeed=RUN_SPEED;explorer.run=true;targetDrive=1}
    explorer.speed=lerp(explorer.speed,targetSpeed,1-Math.exp(-dt*10));explorer.lastMoveAt=performance.now();
    locomotion.moveDir.lerp(dir,1-Math.exp(-dt*12));if(locomotion.moveDir.lengthSq()>.0001)locomotion.moveDir.normalize();
    locomotion.headingGoal=Math.atan2(locomotion.moveDir.x,locomotion.moveDir.z);
    locomotion.walking=lerp(locomotion.walking,explorer.run?1:.78,1-Math.exp(-dt*11));game.run=explorer.run?1:.72;
    locomotion.phase=(locomotion.phase+dt*(4.35+explorer.speed*1.62))%(Math.PI*2);
  }else{
    explorer.speed=lerp(explorer.speed,0,1-Math.exp(-dt*12));locomotion.walking=lerp(locomotion.walking,0,1-Math.exp(-dt*9));game.run=lerp(game.run,0,1-Math.exp(-dt*12));
  }
  locomotion.drive=lerp(locomotion.drive,targetDrive,1-Math.exp(-dt*(moving?10:7)));
  locomotion.turnError=normAngle(locomotion.headingGoal-locomotion.heading);
  locomotion.turn=lerp(locomotion.turn,clamp(locomotion.turnError/(38*DEG),-1,1),1-Math.exp(-dt*8));
  // V12: do NOT rotate heading here.  The feet own heading changes.  A step or
  // pivot below transfers the turn through support -> pelvis -> trunk -> head.
}
function updateExplorerCamera(dt){
  if(view3d){controls.update();return}
  const radius=explorer.cameraRadius||(innerHeight>innerWidth?4.65:4.15);
  const target=new THREE.Vector3(locomotion.root.x,locomotion.root.y+1.03,locomotion.root.z+.02);
  if(!IS_TOUCH&&!explorer.cameraEngaged){
    const desired=new THREE.Vector3(target.x,locomotion.root.y+1.40,target.z+radius),k=1-Math.exp(-dt*6.0);
    camera.position.lerp(desired,k);controls.target.lerp(target,k);camera.lookAt(controls.target);return
  }
  const cp=Math.cos(explorer.cameraPitch),sp=Math.sin(explorer.cameraPitch),sy=Math.sin(explorer.cameraYaw),cy=Math.cos(explorer.cameraYaw);
  const desired=new THREE.Vector3(target.x+sy*cp*radius,target.y+sp*radius+.28,target.z+cy*cp*radius);
  const k=1-Math.exp(-dt*(explorer.touchLookMag>.02?13:7));camera.position.lerp(desired,k);controls.target.lerp(target,k);camera.lookAt(controls.target);
}


function footPadActive(side){const st=legCtl[side];return st.pointer!=null||st.pinned||st.fieldMag>.12||Math.abs(st.x)+Math.abs(st.y)+Math.abs(st.wind)>.16}
function handPadActive(side){const st=pole[side];return st.pointer!=null||st.pinned||st.fieldMag>.12||Math.abs(st.x)+Math.abs(st.y)+Math.abs(st.wind)>.16}
function smooth01(x){x=clamp(x,0,1);return x*x*(3-2*x)}
function lerpAngle(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*t}


function buzz(key,pattern=8,cool=150){const now=performance.now();buzz.last??={};if(now-(buzz.last[key]||0)<cool)return;buzz.last[key]=now;if(navigator.vibrate)navigator.vibrate(pattern)}
const hapticState={};
function edgeHaptic(id,active,pattern,cool=650,rearm=320){const now=performance.now(),s=hapticState[id]||(hapticState[id]={on:false,offAt:0});if(active){s.offAt=0;if(!s.on){buzz('edge-'+id,pattern,cool);s.on=true}}else if(s.on){if(!s.offAt)s.offAt=now;else if(now-s.offAt>rearm){s.on=false;s.offAt=0}}}
function updateHaptics(){
  const activeL=pole.L.pointer!=null||[...draggers.values()].some(d=>d.name==='leftHand');
  const activeR=pole.R.pointer!=null||[...draggers.values()].some(d=>d.name==='rightHand');
  edgeHaptic('contactL',activeL&&contacts.leftHand,[10],700,360);edgeHaptic('contactR',activeR&&contacts.rightHand,[10],700,360);
  edgeHaptic('limitL',activeL&&limits.leftHand,[22,34,12],1100,500);edgeHaptic('limitR',activeR&&limits.rightHand,[22,34,12],1100,500);
  edgeHaptic('limitPelvis',[...draggers.values()].some(d=>d.name==='pelvis')&&limits.pelvis,[28,38,12],1200,520);
  edgeHaptic('limitHead',headCtl.pointer!=null&&limits.head,[12,28,12],1000,460);
  edgeHaptic('pointL',pole.L.pointer!=null&&pole.L.point>.06,[7,18,18],850,400);edgeHaptic('pointR',pole.R.pointer!=null&&pole.R.point>.06,[7,18,18],850,400);
}
function spring(s,target,dt,freq,damp,gravity=0){const w=2*Math.PI*freq,oo=w*w,f=1+2*dt*damp*w,hoo=dt*oo,hhoo=dt*hoo,inv=1/(f+hhoo);s.v.y-=9.81*gravity*dt;const px=s.p.x,py=s.p.y,pz=s.p.z,vx=s.v.x,vy=s.v.y,vz=s.v.z;s.p.x=(f*px+dt*vx+hhoo*target.x)*inv;s.p.y=(f*py+dt*vy+hhoo*target.y)*inv;s.p.z=(f*pz+dt*vz+hhoo*target.z)*inv;s.v.x=(vx+hoo*(target.x-px))*inv;s.v.y=(vy+hoo*(target.y-py))*inv;s.v.z=(vz+hoo*(target.z-pz))*inv}
function poleWorld(side){
  const p=pole[side],sgn=side==='L'?-1:1,spread=(pole.R.x-pole.L.x)*.5;
  return rootBase(new THREE.Vector3(sgn*.48+p.x*.25+p.fieldX*.16,2.18+p.y*.34+p.fieldY*.18,spread*.20+p.wind*.24+p.fieldMag*.06))
}
function shoulderApertureTarget(side,st,commonDepth){
  const shoulder=rig.by[side==='L'?'leftUpperArm':'rightUpperArm'].getWorldPosition(new THREE.Vector3());
  const rest=rootBase(side==='L'?base.leftHand:base.rightHand);
  const restRay=rest.clone().sub(shoulder);if(restRay.lengthSq()<1e-6)restRay.set(side==='L'?1:-1,-1,0);restRay.normalize();
  // XY never disappears. Rings accumulate authority: inner = aim, outer = extend,
  // past rim = a folded joycube face that adds forwardness while preserving side/up.
  const sideExtra=st.faceX*.20*st.cube;
  const upExtra=st.faceY*.20*st.cube;
  const shoulderCarry=st.shoulder*.09;
  const t=rest.clone().add(new THREE.Vector3(
    st.x*(.24+shoulderCarry)+sideExtra,
    st.y*(.35+shoulderCarry)+upExtra,
    Math.max(HAND_FRONT_Z-rest.z,0)+commonDepth*.13+Math.min(st.radius,1.15)*.16+st.wind*.38+st.edge*.20+st.cube*.20+Math.abs(st.faceX)*.06*st.cube+Math.abs(st.faceY)*.06*st.cube
  )).add(restRay.multiplyScalar(st.edge*.12+st.shoulder*.05));
  const centerNeed=1-smoothstep(.13,.58,Math.abs(t.x)),torsoBand=1-smoothstep(.42,.78,Math.abs(t.y-1.28));
  t.z=Math.max(t.z,HAND_FRONT_Z+st.edge*.10+centerNeed*torsoBand*.22);
  if(st.point>.001){
    const toViewer=camera.position.clone().sub(shoulder).normalize();
    const viewerReach=shoulder.clone().add(toViewer.multiplyScalar(.54+.08*st.point));
    viewerReach.x+=st.x*.18+sideExtra*.65;
    viewerReach.y+=st.y*.20+upExtra*.65;
    // Pointing is now a soft bias, not a hostile override of side/up motion.
    t.lerp(viewerReach,st.point*.38);
  }
  return t
}
function poleDerived(){
  const L=pole.L,R=pole.R,LL=legCtl.L,RR=legCtl.R,avgY=(L.y+R.y)*.5,avgX=(L.x+R.x)*.5,diffY=L.y-R.y,diffX=L.x-R.x,g=gameOffsets();
  const depth=(R.x-L.x)*.5,windAvg=(L.wind+R.wind)*.5,windDiff=(L.wind-R.wind)*.5;
  const fieldX=(L.fieldX+R.fieldX)*.5,fieldY=(L.fieldY+R.fieldY)*.5,fieldSpread=(R.fieldX-L.fieldX)*.5,fieldRoll=(L.fieldY-R.fieldY)*.5;
  const legFieldX=(LL.fieldX+RR.fieldX)*.5,legFieldY=(LL.fieldY+RR.fieldY)*.5,legSpread=(RR.fieldX-LL.fieldX)*.5;
  pole.chord.depth=depth;pole.chord.yaw=avgX;pole.chord.roll=diffY*.5;pole.chord.lift=avgY;pole.chord.fieldX=fieldX;pole.chord.fieldY=fieldY;pole.chord.fieldSpread=fieldSpread;pole.chord.fieldRoll=fieldRoll;
  const baseCrouch=Math.min(smoothstep(.12,.82,Math.max(0,-LL.fieldY)),smoothstep(.12,.82,Math.max(0,-RR.fieldY)));
  const pinLegCrouch=((LL.pinned?LL.secY:0)+(RR.pinned?RR.secY:0))*.5;
  const crouch=clamp(baseCrouch+pinLegCrouch*.58+g.hide*.72,0,1);
  const kickL=LL.pinned?0:clamp(Math.max(0,LL.y)*.78+LL.over*.50+Math.max(0,LL.faceY)*.22,0,1),kickR=RR.pinned?0:clamp(Math.max(0,RR.y)*.78+RR.over*.50+Math.max(0,RR.faceY)*.22,0,1);
  const armPinLean=((L.pinned?L.secY:0)+(R.pinned?R.secY:0))*.5,armPinTwist=((L.pinned?L.secX:0)+(R.pinned?R.secX:0))*.5;
  const legPinSide=((LL.pinned?LL.secX:0)+(RR.pinned?RR.secX:0))*.5;
  const pelvis=rootBase(base.pelvis).add(new THREE.Vector3(avgX*.10+fieldX*.14+legFieldX*.08+legPinSide*.045+motion.roll*.18,avgY*.05+fieldY*.05+motion.nudge.body.y-crouch*.28+g.jump*.36+Math.abs(Math.sin(g.phase))*g.run*.018,depth*.07+windAvg*.07+motion.pitch*.30+motion.nudge.body.z+crouch*.035-legFieldY*.035+armPinLean*.035));
  pelvis.x+=(kickR-kickL)*.060+motion.nudge.body.x+armPinTwist*.025;
  let leftHand=shoulderApertureTarget('L',L,depth).add(new THREE.Vector3(L.fieldX*.16,L.fieldY*.16,L.fieldMag*.08)).add(motion.nudge.L),rightHand=shoulderApertureTarget('R',R,depth).add(new THREE.Vector3(R.fieldX*.16,R.fieldY*.16,R.fieldMag*.08)).add(motion.nudge.R);
  // Whole-body gait: idle arms counter-swing in the character's local frame.
  // A hand being manipulated keeps its authority and drops out of the walk cycle.
  if(locomotion.walking>.015){
    const gait=locomotion.walking,sw=Math.sin(locomotion.phase),lift=Math.abs(Math.sin(locomotion.phase*2));
    const pace=clamp(explorer.speed/RUN_SPEED,0,1),amp=lerp(.06,.11,pace)*gait,forwardBias=lerp(.10,.17,pace)*gait;
    // Keep both hands living in front of the torso. They still counter-swing, but
    // around a forward working shelf rather than behind the ribs.
    if(!manual.leftHand&&!handPadActive('L'))leftHand.add(rotateLocalY(new THREE.Vector3(sw*.024,-lift*.012,forwardBias-sw*amp),locomotion.heading));
    if(!manual.rightHand&&!handPadActive('R'))rightHand.add(rotateLocalY(new THREE.Vector3(-sw*.024,-lift*.012,forwardBias+sw*amp),locomotion.heading));
  }
  if(g.guard>.01||g.hide>.01){const q=Math.max(g.guard,g.hide);leftHand.lerp(rootBase(new THREE.Vector3(-.23,1.42,.36)),q*.75);rightHand.lerp(rootBase(new THREE.Vector3(.23,1.42,.36)),q*.75)}
  if(g.strike>.01)rightHand.lerp(rootBase(new THREE.Vector3(.12,1.40,.72)),g.strike*.88);
  if(L.pinned&&L.pinAnchor)leftHand=L.pinAnchor.clone();if(R.pinned&&R.pinAnchor)rightHand=R.pinAnchor.clone();
  function footIntent(side,st,kick){
    const key=side==='L'?'L':'R',anchor=locomotion.footAnchor[key].clone();
    // If the leg pad is idle, the foot is a planted world-space anchor.  This is
    // what lets an arm pull bend the body first, then pull a real step out of it.
    if(!footPadActive(key))return anchor;
    const f=rootBase(side==='L'?feet.left:feet.right),phase=g.phase+(side==='L'?0:Math.PI),stride=Math.sin(phase)*.22*g.run,lift=Math.max(0,Math.sin(phase))*.13*g.run;
    f.x+=st.x*.34+st.fieldX*.16;
    f.y+=clamp(Math.max(0,st.y)*.28+kick*.22+lift+g.jump*.08,0,.58);
    f.z+=kick*.44+st.wind*.36+Math.min(0,st.y)*.16+st.fieldY*.20+stride;
    f.y=Math.max(footGroundYAt(f.x,f.z),f.y);
    return f
  }
  let leftFoot=manual.leftFoot?manual.leftFoot.clone():footIntent('L',LL,kickL),rightFoot=manual.rightFoot?manual.rightFoot.clone():footIntent('R',RR,kickR);
  if(LL.pinned&&LL.pinAnchor)leftFoot=LL.pinAnchor.clone();if(RR.pinned&&RR.pinAnchor)rightFoot=RR.pinAnchor.clone();
  return{pelvis,leftHand,rightHand,leftFoot,rightFoot,crouch,kickL,kickR,avgY,avgX,diffY,diffX,depth,windAvg,windDiff,fieldX,fieldY,fieldSpread,fieldRoll,legFieldX,legFieldY,legSpread,leanFB:motion.pitch,leanLR:motion.roll}
}
function handCorridorTarget(name,p){
  const root=locomotion.root,side=name==='leftHand'?1:-1;
  const direct=name==='leftHand'?(!!manual.leftHand||handPadActive('L')):(!!manual.rightHand||handPadActive('R'));
  const local=rotateLocalY(p.clone().sub(root),-locomotion.heading);
  local.y=clamp(local.y,.08,2.18);
  local.x=clamp(local.x,-1.18,1.18);
  // FRONT is defined in the actor's frame, never world +Z.  This was the V14
  // turn bug: the body rotated while the hand safety plane stayed in world Z,
  // forcing the arms to cut through the chest to reach it.
  const centerNeed=1-smoothstep(.12,.58,Math.abs(local.x)),torsoBand=1-smoothstep(.43,.78,Math.abs(local.y-1.28));
  const turnGuard=(locomotion.turning||Math.abs(locomotion.turn)>.18)?(.07+.05*Math.min(1,Math.abs(locomotion.turn))):0;
  local.z=clamp(Math.max(local.z,HAND_FRONT_Z+centerNeed*torsoBand*.22+turnGuard),HAND_FRONT_Z,1.28);
  // Automatic gait arms have their own anatomical lane. Direct manipulation may
  // cross the midline, but an unattended walking arm never travels through the
  // sternum or swaps sides during a turn.
  if(!direct){const lane=.235+Math.abs(locomotion.turn)*.025;local.x=side*Math.max(side*local.x,lane)}
  return rotateLocalY(local,locomotion.heading).add(root)
}
function clampTarget(name,v){
  let hit=false;const root=locomotion.root;
  if(name==='pelvis'){
    const before=v.clone();v.x=clamp(v.x,root.x-.46,root.x+.46);v.y=clamp(v.y,root.y+.48,root.y+1.38);v.z=clamp(v.z,root.z-.52,root.z+.62);hit=before.distanceToSquared(v)>1e-10;
  }else if(name==='leftFoot'||name==='rightFoot'){
    const before=v.clone(),gy=footGroundYAt(v.x,v.z);v.y=clamp(v.y,gy,gy+.72);v.x=clamp(v.x,root.x-1.05,root.x+1.05);v.z=clamp(v.z,root.z-.86,root.z+1.18);
    v.copy(footLaneTarget(name==='leftFoot'?'L':'R',v,root,locomotion.heading,!!manual[name]));hit=before.distanceToSquared(v)>1e-10;
  }else{
    const before=v.clone();v.copy(handCorridorTarget(name,v));hit=before.distanceToSquared(v)>1e-10;
  }
  if(name in limits)limits[name]=hit;return v
}
function desiredTargets(){const d=poleDerived(),out={
  pelvis:clampTarget('pelvis',(manual.pelvis||d.pelvis).clone()),
  leftHand:clampTarget('leftHand',(manual.leftHand||d.leftHand).clone()),
  rightHand:clampTarget('rightHand',(manual.rightHand||d.rightHand).clone()),
  leftFoot:clampTarget('leftFoot',(manual.leftFoot||d.leftFoot).clone()),
  rightFoot:clampTarget('rightFoot',(manual.rightFoot||d.rightFoot).clone()),pole:d
};
  const freeL=!manual.leftHand&&!handPadActive('L'),freeR=!manual.rightHand&&!handPadActive('R');
  if(locomotion.walking>.035){
    const wb=wholeBodyDrive(),turn=wb.turn,turnAbs=Math.min(1,Math.abs(turn));
    const frontBase=.31+wb.drive*.055+turnAbs*.09,swing=Math.min(.095,wb.armSwing*.50)*(1-turnAbs*.72),wide=.345+turnAbs*.035;
    // During a turn the arms become quieter, wider and more forward.  The feet and
    // pelvis perform the turn; the arms counterbalance without sweeping through
    // the ribcage.
    if(freeL)out.leftHand=clampTarget('leftHand',rootBase(new THREE.Vector3(wide,1.08,frontBase-swing*wb.sw)));
    if(freeR)out.rightHand=clampTarget('rightHand',rootBase(new THREE.Vector3(-wide,1.08,frontBase+swing*wb.sw)));
  }else{
    // Natural standing default: relaxed arms beside the thighs, slightly forward,
    // not the old T-pose-derived horizontal return position.
    const turnAbs=Math.min(1,Math.abs(locomotion.turn));
    if(freeL)out.leftHand=clampTarget('leftHand',rootBase(new THREE.Vector3(.285+turnAbs*.025,.965,.245+turnAbs*.045)));
    if(freeR)out.rightHand=clampTarget('rightHand',rootBase(new THREE.Vector3(-.285-turnAbs*.025,.965,.245+turnAbs*.045)));
  }
  // Gross motor animation is a PRIOR, never the final pose.  It coordinates the
  // pelvis and free arms while the contact feet remain world-space anchors.
  const mp=motorPriorTargets();if(mp){const mw=motorPrior.weight;
    // The animation library is a rhythm/posture prior only. Horizontal pelvis,
    // feet and arm opposition stay under the contact gait until a fully audited
    // retargeted clip is selected.
    out.pelvis.y=lerp(out.pelvis.y,mp.pelvis.y,mw*.22);
    if(mp.leftHand&&!manual.leftHand&&!handPadActive('L'))out.leftHand.y=lerp(out.leftHand.y,mp.leftHand.y,mw*.14);
    if(mp.rightHand&&!manual.rightHand&&!handPadActive('R'))out.rightHand.y=lerp(out.rightHand.y,mp.rightHand.y,mw*.14);
  }
blendExternalTargets(out);out.pelvis=clampTarget('pelvis',out.pelvis);out.leftHand=clampTarget('leftHand',out.leftHand);out.rightHand=clampTarget('rightHand',out.rightHand);out.leftFoot=clampTarget('leftFoot',out.leftFoot);out.rightFoot=clampTarget('rightFoot',out.rightFoot);return out}

function setBoneToward(bone,localAxis,worldDir){const pq=bone.parent.getWorldQuaternion(new THREE.Quaternion()),dir=worldDir.clone().normalize().applyQuaternion(pq.clone().invert());bone.quaternion.setFromUnitVectors(localAxis,dir);bone.updateMatrixWorld(true)}
function setWorldQuat(bone,qWorld){const pq=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(pq.invert().multiply(qWorld));bone.updateMatrixWorld(true)}
function closestOnSegment(p,a,b){const ab=b.clone().sub(a),den=ab.lengthSq();if(den<1e-9)return a.clone();const u=clamp(p.clone().sub(a).dot(ab)/den,0,1);return a.clone().add(ab.multiplyScalar(u))}
function capsuleClearance(p,c){return p.distanceTo(closestOnSegment(p,c.a,c.b))-c.r}
function bodyCapsules(forName){
  rig.mesh.updateMatrixWorld(true);
  const V=n=>rig.by[n].getWorldPosition(new THREE.Vector3());
  const hips=V('hips'),spine=V('spine'),chest=V('chest'),neck=V('neck'),head=V('head'),lS=V('leftUpperArm'),rS=V('rightUpperArm'),lHip=V('leftUpperLeg'),rHip=V('rightUpperLeg');
  const caps=[
    {name:'pelvis skin',a:lHip.clone().lerp(rHip,.15),b:rHip.clone().lerp(lHip,.15),r:.115},
    {name:'abdomen skin',a:hips.clone().add(new THREE.Vector3(0,.07,0)),b:spine.clone().add(new THREE.Vector3(0,.05,0)),r:.145},
    {name:'chest skin',a:spine.clone().add(new THREE.Vector3(0,.06,0)),b:chest.clone().add(new THREE.Vector3(0,.10,0)),r:.165},
    {name:'shoulder skin',a:lS.clone().lerp(rS,.10),b:rS.clone().lerp(lS,.10),r:.090},
    {name:'neck skin',a:chest.clone().add(new THREE.Vector3(0,.08,0)),b:neck.clone(),r:.072},
    {name:'head skin',a:neck.clone().add(new THREE.Vector3(0,.03,0)),b:head.clone().add(new THREE.Vector3(0,.14,0)),r:.118}
  ];
  if(forName==='leftHand'||forName==='rightHand'){
    const opp=forName==='leftHand'?'right':'left',u=V(opp+'UpperArm'),m=V(opp+'LowerArm'),h=V(opp+'Hand');
    caps.push({name:'opposite upper arm',a:u,b:m,r:ANATOMY.upperArmR},{name:'opposite forearm',a:m,b:h,r:ANATOMY.forearmR},{name:'opposite hand',a:h,b:h,r:.060});
  }
  if(forName==='leftFoot'||forName==='rightFoot'){
    const opp=forName==='leftFoot'?'right':'left',u=V(opp+'UpperLeg'),m=V(opp+'LowerLeg'),f=V(opp+'Foot');
    caps.push({name:'opposite thigh',a:u,b:m,r:ANATOMY.thighR},{name:'opposite shin',a:m,b:f,r:ANATOMY.shinR});
  }
  if(forName==='leftHand'||forName==='rightHand'||forName==='leftFoot'||forName==='rightFoot')caps.push(...dogCollisionCapsules());
  return caps
}
function projectOutBody(name,p,pad=.060,caps=null){
  let q=p.clone(),hit=false,normal=new THREE.Vector3(),part='';caps=caps||bodyCapsules(name);
  for(let pass=0;pass<4;pass++){
    let worst=null,worstPen=0;
    for(const c of caps){const cp=closestOnSegment(q,c.a,c.b),d=q.clone().sub(cp),dist=d.length(),need=c.r+pad,pen=need-dist;if(pen>worstPen){if(dist<1e-7)d.set(name==='rightHand'?-1:1,0,0);else d.multiplyScalar(1/dist);worstPen=pen;worst={c,cp,n:d.clone()}}}
    if(!worst)break;q.copy(worst.cp).add(worst.n.multiplyScalar(worst.c.r+pad));normal.copy(worst.n);part=worst.c.name;hit=true
  }
  return{point:q,hit,normal,part}
}
function collisionAwareTarget(name,desired){
  if(name==='leftFoot')desired=footLaneTarget('L',desired,locomotion.root,locomotion.heading,!!manual.leftFoot||footPadActive('L'));
  if(name==='rightFoot')desired=footLaneTarget('R',desired,locomotion.root,locomotion.heading,!!manual.rightFoot||footPadActive('R'));
  const start=(lastSafe[name]||desired).clone(),delta=desired.clone().sub(start),caps=bodyCapsules(name);caps.push(...PLACE.wallCapsulesNear(start,1.7));let prev=start.clone(),contact=false,contactPart='';
  const pad=(name==='leftFoot'||name==='rightFoot') ? .048 : .060;
  const direct=(name==='leftHand'?(manual.leftHand||handPadActive('L')):name==='rightHand'?(manual.rightHand||handPadActive('R')):name==='leftFoot'?(manual.leftFoot||footPadActive('L')):name==='rightFoot'?(manual.rightFoot||footPadActive('R')):false);const steps=IS_TOUCH&&!direct?Math.max(2,Math.min(5,Math.ceil(delta.length()/.070))):Math.max(4,Math.min(18,Math.ceil(delta.length()/.030)));
  for(let i=1;i<=steps;i++){
    const raw=start.clone().lerp(desired,i/steps),pr=projectOutBody(name,raw,pad,caps);
    if(pr.hit){contact=true;contactPart=pr.part;const remain=desired.clone().sub(raw),into=remain.dot(pr.normal);if(into<0)remain.addScaledVector(pr.normal,-into);const slid=projectOutBody(name,pr.point.clone().add(remain.multiplyScalar(.88)),pad,caps);prev.copy(slid.point);break}
    prev.copy(raw)
  }
  const final=projectOutBody(name,prev,pad,caps);if(final.hit){contact=true;contactPart=final.part;prev.copy(final.point)}
  if(name==='leftHand'||name==='rightHand')prev.copy(handCorridorTarget(name,prev));
  if(name==='leftFoot'||name==='rightFoot'){const gy=footGroundYAt(prev.x,prev.z);if(prev.y<=gy+.004)contact=true;prev.y=Math.max(prev.y,gy)}
  contacts[name]=contact;lastSafe[name].copy(prev);return{point:prev,hit:contact,part:contactPart}
}
function limbClearance(A,E,T,caps,opt={}){
  const upperR=opt.anatomy==='leg'?ANATOMY.thighR:ANATOMY.upperArmR,lowerR=opt.anatomy==='leg'?ANATOMY.shinR:ANATOMY.forearmR;
  let best=Infinity;
  for(const u of (opt.fast?[.45,.78]:[.36,.56,.76,.92])){const p=A.clone().lerp(E,u);for(const c of caps)best=Math.min(best,capsuleClearance(p,c)-upperR-ANATOMY.skinPad)}
  for(const u of (opt.fast?[.24,.58,.88]:[.16,.36,.58,.80,.96])){const p=E.clone().lerp(T,u);for(const c of caps)best=Math.min(best,capsuleClearance(p,c)-lowerR-ANATOMY.skinPad)}
  return best
}
function anatomyCandidateAllowed(A,E,opt){
  const side=opt.side==='L'?1:-1,{lateral,forward}=bodyAxes(),rel=E.clone().sub(A),lat=rel.dot(lateral),fwd=rel.dot(forward);
  if(opt.anatomy==='arm'){
    // Free arms may swing, but the elbow is never allowed to solve behind the
    // ribcage or collapse across the sternum. Keep the arm in a forward/outward
    // working corridor so walking reads as contralateral swing, not body clipping.
    if(fwd<.015)return false;
    if(side*lat<.015)return false;
    if(E.y>A.y+.28||E.y<A.y-.46)return false;
  }else if(opt.anatomy==='leg'){
    // Knees may come near the midline, but never pass behind the opposite hip.
    if(fwd<-.040)return false;
    if(side*lat<-.035)return false;
  }
  return true
}
function solveTwoBone(rootBone,midBone,endBone,target,polePoint,opt={}){
  rootBone.parent.updateMatrixWorld(true);rootBone.updateMatrixWorld(true);midBone.updateMatrixWorld(true);endBone.updateMatrixWorld(true);
  const A=rootBone.getWorldPosition(new THREE.Vector3()),B=midBone.getWorldPosition(new THREE.Vector3()),C=endBone.getWorldPosition(new THREE.Vector3());
  const l1=A.distanceTo(B),l2=B.distanceTo(C),to=target.clone().sub(A),raw=to.length(),maxFlex=(opt.maxFlexDeg||(opt.anatomy==='leg'?ANATOMY.kneeMax:ANATOMY.elbowMax))*DEG,minFlex=(opt.minFlexDeg||3)*DEG;
  const flexMin=Math.sqrt(Math.max(0,l1*l1+l2*l2+2*l1*l2*Math.cos(maxFlex))),flexMax=Math.sqrt(Math.max(0,l1*l1+l2*l2+2*l1*l2*Math.cos(minFlex))),min=Math.max(Math.abs(l1-l2)+.001,flexMin),max=Math.min(l1+l2-.002,flexMax),d=clamp(raw,min,max);let limited=raw>max+.006||raw<min-.006;
  const dir=raw<1e-6?new THREE.Vector3(0,-1,0):to.normalize();let pv=polePoint.clone().sub(A);pv.sub(dir.clone().multiplyScalar(pv.dot(dir)));if(pv.lengthSq()<1e-7)pv.set(0,0,1);pv.normalize();
  const x=(l1*l1-l2*l2+d*d)/(2*d),y=Math.sqrt(Math.max(0,l1*l1-x*x));let joint=A.clone().add(dir.clone().multiplyScalar(x)).add(pv.clone().multiplyScalar(y));
  const memKey=opt.memoryKey||opt.avoid,prevBend=memKey?bendMemory[memKey]:null;
  if(opt.anatomy||opt.avoid){
    const avoidCaps=bodyCapsules(opt.avoid||memKey),angles=opt.fast?(opt.anatomy==='leg'?[-28,0,28]:[-38,0,38]):(opt.anatomy==='leg'?[-55,-38,-24,-12,0,12,24,38,55]:[-95,-72,-54,-38,-24,-12,0,12,24,38,54,72,95]);
    let bestE=null,bestB=null,best=-1e12;
    for(const deg of angles){
      const q=new THREE.Quaternion().setFromAxisAngle(dir,deg*DEG),pvr=pv.clone().applyQuaternion(q),E=A.clone().add(dir.clone().multiplyScalar(x)).add(pvr.clone().multiplyScalar(y));
      if(!anatomyCandidateAllowed(A,E,opt))continue;
      const clear=limbClearance(A,E,target,avoidCaps,opt),bend=pvr.clone().normalize(),side=opt.side==='L'?1:-1;
      const axes=bodyAxes(),rel=E.clone().sub(A),frontAmount=rel.dot(axes.forward),outAmount=side*rel.dot(axes.lateral);
      const frontBonus=clamp(frontAmount,-.02,.44)*1.75,outwardBonus=clamp(outAmount,-.03,.46)*1.35,continuity=prevBend?prevBend.dot(bend):0,poleAlign=bend.dot(pv);
      const chestPenalty=(opt.anatomy==='arm'&&frontAmount<.055?(.055-frontAmount)*28:0)+(opt.anatomy==='arm'&&outAmount<.045?(.045-outAmount)*22:0);
      const collisionPenalty=clear<0?120+Math.abs(clear)*900:0,anglePenalty=Math.abs(deg)*.00020;
      const score=clear*3.2+frontBonus+outwardBonus+continuity*.90+poleAlign*.28-collisionPenalty-anglePenalty-chestPenalty;
      if(score>best){best=score;bestE=E;bestB=bend.clone()}
    }
    if(bestE){joint=bestE;if(memKey)bendMemory[memKey]=(prevBend?prevBend.clone().lerp(bestB,.18):bestB.clone()).normalize()}
    else {limited=true}
  }else if(memKey)bendMemory[memKey]=(prevBend?prevBend.clone().lerp(pv,.18):pv.clone()).normalize();
  const bind1=midBone.position.clone().normalize(),bind2=endBone.position.clone().normalize();setBoneToward(rootBone,bind1,joint.clone().sub(A));midBone.updateMatrixWorld(true);const M=midBone.getWorldPosition(new THREE.Vector3());setBoneToward(midBone,bind2,target.clone().sub(M));
  return limited
}
function beginAutoStep(side,to,opt={}){
  const from=footLaneTarget(side,locomotion.footAnchor[side],locomotion.root,locomotion.heading,false),pace=clamp(explorer.speed/RUN_SPEED,0,1);
  const turnDelta=opt.turnDelta??clamp(locomotion.turnError,-26*DEG,26*DEG),pivot=!!opt.pivot;
  const safeTo=footLaneTarget(side,to,locomotion.root,locomotion.heading+turnDelta*.55,false);
  locomotion.step={side,from,to:safeTo,t:0,dur:pivot?lerp(.36,.29,pace):lerp(.40,.27,pace),pivot,
    headingFrom:locomotion.heading,headingTo:locomotion.heading+turnDelta};
  locomotion.nextSide=side==='L'?'R':'L';locomotion.stanceSide=side==='L'?'R':'L';locomotion.turning=pivot||Math.abs(turnDelta)>3*DEG;
}
function beginTurnStep(){
  if(locomotion.step)return false;const err=normAngle(locomotion.headingGoal-locomotion.heading);if(Math.abs(err)<12*DEG)return false;
  const side=err>0?'R':'L',angle=clamp(err,-32*DEG,32*DEG),from=locomotion.footAnchor[side].clone();
  const rel=from.clone().sub(locomotion.root);rel.y=0;if(rel.length()<.07)rel.copy(rotateLocalY(new THREE.Vector3(side==='L'?.12:-.12,0,.04),locomotion.heading));
  let to=locomotion.root.clone().add(rotateLocalY(rotateLocalY(rel,-locomotion.heading),locomotion.heading+angle));to.y=footGroundYAt(to.x,to.z);
  to.add(rotateLocalY(new THREE.Vector3(0,0,.06),locomotion.heading+angle*.5));
  to=footLaneTarget(side,to,locomotion.root,locomotion.heading+angle*.55,false);
  beginAutoStep(side,to,{pivot:true,turnDelta:angle});return true
}
function updateAutoStep(dt){
  const st=locomotion.step;if(!st)return;
  st.t+=dt;const u=clamp(st.t/st.dur,0,1),e=smooth01(u);let p=st.from.clone().lerp(st.to,e);
  // Every sample stays in its anatomical lane. This is stronger than collision
  // response: the left foot simply has no legal path through the right leg.
  p=footLaneTarget(st.side,p,locomotion.root,lerpAngle(st.headingFrom,st.headingTo,e),false);
  const arc=Math.pow(Math.sin(Math.PI*u),1.10);p.y=footGroundYAt(p.x,p.z)+arc*(st.pivot?.07:Math.min(.19,.08+st.from.distanceTo(st.to)*.17));
  locomotion.footAnchor[st.side].copy(p);
  const hu=smooth01(clamp((u-.10)/.84,0,1));locomotion.heading=lerpAngle(st.headingFrom,st.headingTo,hu);
  if(u>=1){
    locomotion.footAnchor[st.side].copy(footLaneTarget(st.side,st.to,locomotion.root,st.headingTo,false));
    locomotion.heading=st.headingTo;locomotion.lastContactSide=st.side;locomotion.stanceSide=st.side;
    locomotion.step=null;locomotion.turning=false;locomotion.stepClock=0
  }
}
function updateWholeBodyLocomotion(targets,dt){
  updateAutoStep(dt);
  if(manual.leftFoot||footPadActive('L'))locomotion.footAnchor.L.copy(targets.leftFoot);
  if(manual.rightFoot||footPadActive('R'))locomotion.footAnchor.R.copy(targets.rightFoot);
  const autoFeet=!manual.leftFoot&&!manual.rightFoot&&!footPadActive('L')&&!footPadActive('R');
  locomotion.turnError=normAngle(locomotion.headingGoal-locomotion.heading);

  // Standing LOOK becomes a real step-turn once the upper body would otherwise
  // exceed a comfortable twist.  Small glances remain head/chest only.
  if(autoFeet&&locomotion.walking<.07&&!locomotion.step&&Math.abs(locomotion.turnError)>14*DEG)beginTurnStep();

  // Clocked alternating gait.  A new step starts only after the previous foot
  // has made contact; frame-rate/phase jitter therefore cannot launch two feet
  // into the same corridor.  +X is anatomical LEFT, so L = +1 and R = -1.
  locomotion.stepClock??=0;
  if(autoFeet&&locomotion.walking>.10){
    if(!locomotion.step)locomotion.stepClock+=dt;
    const pace=clamp(explorer.speed/RUN_SPEED,0,1),interval=lerp(.46,.29,pace);
    if(!locomotion.step&&locomotion.stepClock>=interval){
      locomotion.stepClock=0;
      const side=locomotion.nextSide||'L',sgn=side==='L'?1:-1;
      const turnDelta=clamp(locomotion.turnError,-22*DEG,22*DEG),stepHeading=locomotion.heading+turnDelta*.45;
      const dir=rotateLocalY(new THREE.Vector3(0,0,1),stepHeading),lat=rotateLocalY(new THREE.Vector3(1,0,0),stepHeading);
      const stride=lerp(.34,.54,pace)*(explorer.inputMag<.32?.72:1);
      let to=locomotion.root.clone().add(dir.multiplyScalar(stride)).add(lat.multiplyScalar(sgn*(locomotion.stance+.018+Math.abs(locomotion.turn)*.012)));to.y=footGroundYAt(to.x,to.z);
      to=footLaneTarget(side,to,locomotion.root,stepHeading,false);beginAutoStep(side,to,{turnDelta});
    }
  }else if(locomotion.walking<.05){locomotion.gaitHalf=-1;locomotion.stepClock=0}

  rig.mesh.updateMatrixWorld(true);
  const ls=rig.by.leftUpperArm.getWorldPosition(new THREE.Vector3()),rs=rig.by.rightUpperArm.getWorldPosition(new THREE.Vector3());
  const handPull=new THREE.Vector3(),samples=[];
  for(const [side,t,sh,active] of [['L',targets.leftHand,ls,manual.leftHand||handPadActive('L')],['R',targets.rightHand,rs,manual.rightHand||handPadActive('R')]]){
    if(!active)continue;const d=t.clone().sub(sh),len=d.length(),over=Math.max(0,len-.55);if(over>.015){const h=new THREE.Vector3(d.x,0,d.z);if(h.lengthSq()>.0001){h.normalize().multiplyScalar(Math.min(.42,over*.72));handPull.add(h);samples.push(over)}}
  }
  if(samples.length>1)handPull.multiplyScalar(.62);

  const LA=locomotion.footAnchor.L,RA=locomotion.footAnchor.R,footMid=LA.clone().add(RA).multiplyScalar(.5);
  const supportGoal=new THREE.Vector3(footMid.x,0,footMid.z);
  const bothFeetDriven=(manual.leftFoot||footPadActive('L'))&&(manual.rightFoot||footPadActive('R'));
  if(bothFeetDriven){locomotion.rootGoal.x=lerp(locomotion.rootGoal.x,footMid.x,.25);locomotion.rootGoal.z=lerp(locomotion.rootGoal.z,footMid.z-.02,.25)}
  locomotion.rootGoal.addScaledVector(handPull,dt*2.9);

  // CONTACT DRIVES MOTION: when walking, root target is derived from the stance
  // foot and the destination of the swing foot.  The pelvis never races ahead
  // and asks the legs to catch it afterwards.
  if(autoFeet&&locomotion.walking>.04){
    if(locomotion.step){
      const st=locomotion.step,u=clamp(st.t/st.dur,0,1),stance=locomotion.footAnchor[st.side==='L'?'R':'L'];
      // Keep COM over stance through swing, then transfer decisively toward the
      // landing foot.  There is no backwards snap at heel strike.
      const transfer=smoothstep(.48,.98,u),rootTarget=stance.clone().lerp(st.to,.10+.58*transfer);
      rootTarget.y=0;locomotion.rootGoal.x=rootTarget.x;locomotion.rootGoal.z=rootTarget.z;locomotion.contactDrive=1;
    }else{
      const stance=locomotion.footAnchor[locomotion.stanceSide||locomotion.lastContactSide||'L'],other=locomotion.footAnchor[(locomotion.stanceSide||'L')==='L'?'R':'L'];
      const support=other.clone().lerp(stance,.64);locomotion.rootGoal.x=support.x;locomotion.rootGoal.z=support.z;locomotion.contactDrive=1;
    }
  }else locomotion.contactDrive=locomotion.step?1:0;

  const rootXZ=new THREE.Vector3(locomotion.root.x,0,locomotion.root.z),deltaGoal=locomotion.rootGoal.clone().sub(rootXZ);deltaGoal.y=0;
  if(deltaGoal.length()>.001){const max=(explorer.speed>0?Math.max(.65,explorer.speed*.92):.75)*dt;if(deltaGoal.length()>max)deltaGoal.setLength(max);locomotion.root.add(deltaGoal)}
  const supportDelta=new THREE.Vector3(locomotion.root.x-supportGoal.x,0,locomotion.root.z-supportGoal.z),supportDist=supportDelta.length();
  if(!locomotion.step&&supportDist>(locomotion.walking>.1?.13:.17)&&autoFeet){
    const dir=locomotion.walking>.08?locomotion.moveDir.clone():(supportDelta.lengthSq()>.0001?supportDelta.clone().normalize():rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading));
    const side=locomotion.nextSide,sgn=side==='L'?1:-1,sideVec=rotateLocalY(new THREE.Vector3(1,0,0),locomotion.heading),stride=.16+.26*clamp(locomotion.walking,0,1);
    let to=locomotion.root.clone().add(dir.multiplyScalar(stride)).add(sideVec.multiplyScalar(sgn*locomotion.stance));to.y=footGroundYAt(to.x,to.z);to=footLaneTarget(side,to,locomotion.root,locomotion.heading,false);beginAutoStep(side,to,{turnDelta:clamp(locomotion.turnError,-16*DEG,16*DEG)});
  }
  const supportMax=locomotion.walking>.55?.34:.30;if(supportDist>supportMax){const q=supportDelta.setLength(supportMax);locomotion.root.x=supportGoal.x+q.x;locomotion.root.z=supportGoal.z+q.z}

  const handLow=Math.min(targets.leftHand.y,targets.rightHand.y)-locomotion.root.y,handFront=Math.max(targets.leftHand.z-locomotion.root.z,targets.rightHand.z-locomotion.root.z);
  locomotion.bend=lerp(locomotion.bend,clamp((1.00-handLow)*1.15+Math.max(0,handFront-.55)*.45,0,1),1-Math.exp(-dt*7));
  const footForward=((targets.leftFoot.z+targets.rightFoot.z)*.5)-(locomotion.root.z+.04),feetLow=Math.max(targets.leftFoot.y-footGroundYAt(targets.leftFoot.x,targets.leftFoot.z),targets.rightFoot.y-footGroundYAt(targets.rightFoot.x,targets.rightFoot.z))<.05;
  locomotion.sit=lerp(locomotion.sit,feetLow?smoothstep(.24,.52,footForward):0,1-Math.exp(-dt*6));
  const bothLift=Math.min(targets.leftFoot.y-footGroundYAt(targets.leftFoot.x,targets.leftFoot.z),targets.rightFoot.y-footGroundYAt(targets.rightFoot.x,targets.rightFoot.z)),highReach=Math.max(targets.leftHand.y,targets.rightHand.y)-1.84-locomotion.root.y;
  locomotion.jump=lerp(locomotion.jump,clamp(smoothstep(.08,.30,bothLift)+Math.max(0,highReach)*1.1,0,1),1-Math.exp(-dt*9));
  locomotion.reach=lerp(locomotion.reach,clamp(samples.length?Math.max(...samples)*2.2:0,0,1),1-Math.exp(-dt*8));
  locomotion.motorState=locomotion.jump>.25?'JUMP':locomotion.sit>.35?'SIT':locomotion.walking>.55?(explorer.run?'RUN':'WALK'):locomotion.turning?'TURN':locomotion.walking>.08?'WALK':'IDLE';
  locomotion.state=locomotion.jump>.25?'JUMP':locomotion.sit>.35?'SIT':locomotion.turning?'TURN':locomotion.walking>.12?(explorer.run?'RUN':'WALK'):locomotion.step?'STEP':locomotion.bend>.28?'BEND':locomotion.reach>.18?'REACH':'STAND';
}
function bodySolveAssist(targets,P){
  const l=targets.leftHand.clone().sub(P),r=targets.rightHand.clone().sub(P),avgFront=Math.max(l.z,r.z,(l.z+r.z)*.5),reach=Math.max(l.length(),r.length());
  const frontNeed=clamp((avgFront-.30)*1.42+Math.max(0,reach-.58)*1.05,0,.46),lowNeed=locomotion.bend,sit=locomotion.sit,jump=locomotion.jump;
  const avgX=(targets.leftHand.x+targets.rightHand.x)*.5,lateral=clamp((avgX-P.x)*.30,-.12,.12);
  const crossL=clamp((targets.leftHand.x-(P.x-.03))/.22,0,1),crossR=clamp(((P.x+.03)-targets.rightHand.x)/.22,0,1),twist=clamp((crossL-crossR)*.30+(r.z-l.z)*.16,-.34,.34);
  const shoulderOpen=clamp(frontNeed*.035+Math.max(0,.52-(targets.rightHand.x-targets.leftHand.x))*.025,0,.052);
  // Reaching is hierarchical: scapula -> chest -> spine -> hips -> root/step.
  const pitch=frontNeed*.58+lowNeed*.26-sit*.10,spinePitch=frontNeed*.52+lowNeed*.44+sit*.22,chestPitch=frontNeed*.42+lowNeed*.38+sit*.28,scapulaForward=frontNeed*.105;
  const pelvisY=-lowNeed*.13-sit*.34+jump*.34;
  const pelvisZ=frontNeed*.15-sit*.13;
  return{pelvis:new THREE.Vector3(lateral,pelvisY,pelvisZ),hipPitch:pitch,spinePitch,chestPitch,twist,shoulderOpen,scapulaForward};
}
function activeAttentionTarget(targets){
  // Manual head input always has authority, but when it is idle the head behaves
  // like an explorer's attention system: point target > manipulated hand > travel.
  if(headCtl.pointer!=null||headCtl.fieldMag>.10)return null;
  const pt=pointingFloorTarget();if(pt)return pt.q.clone().add(new THREE.Vector3(0,.05,0));
  const lActive=!!manual.leftHand||handPadActive('L'),rActive=!!manual.rightHand||handPadActive('R');
  if(lActive&&rActive)return targets.leftHand.clone().add(targets.rightHand).multiplyScalar(.5);
  if(lActive)return targets.leftHand.clone();if(rActive)return targets.rightHand.clone();
  if(explorer.lookStrength>.05){
    const yaw=locomotion.heading+explorer.lookBodyYaw,pitch=explorer.lookBodyPitch;
    return locomotion.root.clone().add(rotateLocalY(new THREE.Vector3(0,1.34+pitch*.80,2.45),yaw));
  }
  if(locomotion.walking>.10){return locomotion.root.clone().add(locomotion.moveDir.clone().multiplyScalar(2.2)).add(new THREE.Vector3(0,1.34,0))}
  return locomotion.root.clone().add(rotateLocalY(new THREE.Vector3(0,1.38,2.2),locomotion.heading));
}
function solveAttentionHead(targets,manualYaw,manualPitch,manualRoll){
  rig.mesh.updateMatrixWorld(true);const headPos=rig.by.head.getWorldPosition(new THREE.Vector3()),autoTarget=headLock?activeAttentionTarget(targets):null;
  if(autoTarget){
    const dir=autoTarget.clone().sub(headPos);if(dir.lengthSq()>.0001){
      dir.normalize();const chestQ=rig.by.chest.getWorldQuaternion(new THREE.Quaternion()),localDir=dir.clone().applyQuaternion(chestQ.clone().invert());
      const yaw=clamp(Math.atan2(localDir.x,localDir.z),-62*DEG,62*DEG),pitch=clamp(-Math.atan2(localDir.y,Math.hypot(localDir.x,localDir.z)),-38*DEG,42*DEG);
      const y=clamp(yaw+manualYaw*.30,-64*DEG,64*DEG),p=clamp(pitch+manualPitch*.30,-40*DEG,44*DEG),r=clamp(manualRoll*.45,-16*DEG,16*DEG);
      rig.by.neck.rotation.set(p*.45,y*.38,r*.25);rig.mesh.updateMatrixWorld(true);
      const chestWorld=rig.by.chest.getWorldQuaternion(new THREE.Quaternion()),localQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(p*.72,y*.72,r,'YXZ'));
      setWorldQuat(rig.by.head,chestWorld.multiply(localQ));return true
    }
  }
  return false
}

function solveRig(targets,dt){
  // root + balance: pelvis is authoritative but constrained by planted feet.
  const P=dyn.pelvis.p,avgX=targets.pole.avgX,avgY=targets.pole.avgY,diffY=targets.pole.diffY,leanFB=targets.pole.leanFB,leanLR=targets.pole.leanLR;
  const fX=targets.pole.fieldX||0,fY=targets.pole.fieldY||0,fSpread=targets.pole.fieldSpread||0,fRoll=targets.pole.fieldRoll||0;
  const assist=bodySolveAssist(targets,P),hipPos=P.clone().add(assist.pelvis);
  const wb=wholeBodyDrive(),gait=wb.w,gs=wb.sw,gc=wb.cw,gaitAmp=wb.drive;
  // Feed-forward whole-body gait. COM shift, rise/fall, counter-rotation and
  // turning happen from the same MOVE intention before limb IK is evaluated.
  const gaitOffset=rotateLocalY(new THREE.Vector3(wb.pelvisSide,wb.pelvisBob,gs*.016*gaitAmp),locomotion.heading);hipPos.add(gaitOffset);
  const lookYaw=explorer.lookBodyYaw*explorer.lookStrength,lookPitch=explorer.lookBodyPitch*explorer.lookStrength;
  const pinLX=pole.L.pinned?pole.L.secX:0,pinRX=pole.R.pinned?pole.R.secX:0,pinLY=pole.L.pinned?pole.L.secY:0,pinRY=pole.R.pinned?pole.R.secY:0;
  const pinLean=(pinLY+pinRY)*.5,pinTwist=(pinLX+pinRX)*.5,pinOpen=(pinLX-pinRX)*.5,pinOver=((pole.L.pinned?pole.L.secOver:0)+(pole.R.pinned?pole.R.secOver:0))*.5;
  const legLX=legCtl.L.pinned?legCtl.L.secX:0,legRX=legCtl.R.pinned?legCtl.R.secX:0,legLY=legCtl.L.pinned?legCtl.L.secY:0,legRY=legCtl.R.pinned?legCtl.R.secY:0,legPinLean=(legLY+legRY)*.5;
  // Walking and looking are whole-body states, not foot motion plus a turret.
  // Pelvis carries propulsion, spine/chest counter-rotate, and gaze spills down
  // the chain.  Manual effectors still override their individual limbs.
  const forwardLean=wb.forwardLean;
  rig.by.hips.position.set(hipPos.x,hipPos.y,hipPos.z);
  rig.by.hips.rotation.set(leanFB*.14+fY*.05+assist.hipPitch+pinLean*.06+pinOver*.07+forwardLean,locomotion.heading+avgX*.10+fX*.10+assist.twist*.24+pinTwist*.12+(legLX+legRX)*.035+wb.pelvisYaw+lookYaw*.22,-leanLR*.08-fRoll*.10+gc*.070*gaitAmp-wb.turnLean);
  rig.by.spine.rotation.set(-avgY*.10+leanFB*.46-fY*.10+assist.spinePitch+pinLean*.16+pinOver*.12+lookPitch*.11+forwardLean*.34,avgX*.16+fX*.18+assist.twist*.55+pinTwist*.24+wb.chestYaw*.55+lookYaw*.38,-diffY*.20-leanLR*.30-fRoll*.18-gc*.040*gaitAmp+wb.turnLean*.62);
  rig.by.chest.rotation.set(-avgY*.05+leanFB*.22-fY*.06+assist.chestPitch+pinLean*.26+pinOver*.18+lookPitch*.18-forwardLean*.18,avgX*.12+fX*.16+assist.twist*.78+pinTwist*.38+wb.chestYaw+lookYaw*.52+wb.turn*.12*gaitAmp,-diffY*.10-leanLR*.16-fRoll*.14+gc*.030*gaitAmp+wb.turnLean*.35);
  rig.by.leftShoulder.position.x=rig.by.leftShoulder._bind.x-Math.max(0,fSpread)*.025-assist.shoulderOpen-pinOpen*.026;rig.by.rightShoulder.position.x=rig.by.rightShoulder._bind.x+Math.max(0,fSpread)*.025+assist.shoulderOpen+pinOpen*.026;rig.by.leftShoulder.position.z=rig.by.leftShoulder._bind.z+assist.scapulaForward+pole.L.edge*.018;rig.by.rightShoulder.position.z=rig.by.rightShoulder._bind.z+assist.scapulaForward+pole.R.edge*.018;
  rig.by.leftShoulder.rotation.set(-pole.L.edge*.12-Math.max(0,pole.L.faceY)*.10-pinLY*.12,-pole.L.x*.16-pole.L.faceX*.08-pinLX*.10,clamp(pole.L.y*.17+pole.L.faceY*.10+pinLX*.08,-.32,.32));
  rig.by.rightShoulder.rotation.set(-pole.R.edge*.12-Math.max(0,pole.R.faceY)*.10-pinRY*.12,pole.R.x*.16+pole.R.faceX*.08+pinRX*.10,clamp(-pole.R.y*.17-pole.R.faceY*.10-pinRX*.08,-.32,.32));
  if(gait>.02){
    const shoulderSwing=wb.shoulderSwing;
    if(!manual.leftHand&&!handPadActive('L')){rig.by.leftShoulder.rotation.x+=shoulderSwing;rig.by.leftShoulder.rotation.z+=wb.turn*.035*gaitAmp}
    if(!manual.rightHand&&!handPadActive('R')){rig.by.rightShoulder.rotation.x-=shoulderSwing;rig.by.rightShoulder.rotation.z+=wb.turn*.035*gaitAmp}
  }
  rig.mesh.updateMatrixWorld(true);

  // Head should not keep rotating like a turret. Once local head motion fills up,
  // the remaining intention spills into neck -> chest -> spine -> hips.
  const hx=resistedHold(headDyn.x,headCtl.edge),hy=resistedHold(headDyn.y,headCtl.edge),hr=resistedHold(headDyn.roll,Math.abs(headCtl.wind));
  const hfx=headDyn.faceX||0,hfy=headDyn.faceY||0,hlead=headDyn.lead||0,hFieldX=headCtl.fieldX||0,hFieldY=headCtl.fieldY||0,hFieldMag=headCtl.fieldMag||0;
  const yawCmd=clamp(avgX*.30+hx*.82+hfx*.36+hFieldX*.24,-72*DEG,72*DEG),pitchCmd=clamp(-avgY*.22+hy*.76+hfy*.24-hFieldY*.18,-40*DEG,48*DEG),rollCmd=clamp(-diffY*.20+hr*.54+hFieldX*hFieldY*.08,-26*DEG,26*DEG);
  const headYaw=clamp(yawCmd,-28*DEG,28*DEG),headPitch=clamp(pitchCmd,-18*DEG,24*DEG),headRoll=clamp(rollCmd,-18*DEG,18*DEG);
  const overYaw=yawCmd-headYaw+hFieldX*.30,overPitch=pitchCmd-headPitch-hFieldY*.26,overRoll=rollCmd-headRoll+hFieldX*.06;
  limits.head=Math.abs(yawCmd)>.95*72*DEG||Math.abs(pitchCmd)>.95*48*DEG||Math.abs(rollCmd)>.95*26*DEG;
  rig.by.hips.rotation.x += overPitch*.12 + Math.max(0,-hlead)*.03 - hFieldY*.10*hFieldMag;
  rig.by.hips.rotation.y += overYaw*.15 + hFieldX*.10*hFieldMag;
  rig.by.hips.rotation.z += overRoll*.08;
  rig.by.spine.rotation.x += overPitch*.32 + hlead*.08 - hFieldY*.16*hFieldMag;
  rig.by.spine.rotation.y += overYaw*.38 + hFieldX*.16*hFieldMag;
  rig.by.spine.rotation.z += overRoll*.18;
  rig.by.chest.rotation.x += overPitch*.44 + hlead*.18 - hFieldY*.22*hFieldMag;
  rig.by.chest.rotation.y += overYaw*.50 + hFieldX*.20*hFieldMag;
  rig.by.chest.rotation.z += overRoll*.24;
  const qCmd=new THREE.Quaternion().setFromEuler(new THREE.Euler(headPitch,headYaw,headRoll,'XYZ'));
  rig.by.neck.position.set(rig.by.neck._bind.x+hfx*.014, rig.by.neck._bind.y+Math.max(0,hfy)*.010, rig.by.neck._bind.z+hlead*.048);
  rig.by.head.position.set(rig.by.head._bind.x, rig.by.head._bind.y+Math.max(0,hfy)*.006, rig.by.head._bind.z+hlead*.012);
  const attended=solveAttentionHead(targets,headYaw,headPitch,headRoll);
  if(!attended){rig.by.neck.rotation.set(headPitch*.54+overPitch*.10,headYaw*.42+overYaw*.06,headRoll*.28+overRoll*.05);rig.mesh.updateMatrixWorld(true);const chestWorld=rig.by.chest.getWorldQuaternion(new THREE.Quaternion()),manualQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(headPitch,headYaw,headRoll,'YXZ'));setWorldQuat(rig.by.head,chestWorld.multiply(manualQ))}

  // Collision-aware hands: free-space motion becomes tangent sliding on contact.
  const lCol=collisionAwareTarget('leftHand',dyn.leftHand.p.clone()),rCol=collisionAwareTarget('rightHand',dyn.rightHand.p.clone()),lT=lCol.point,rT=rCol.point;
  effective.leftHand.copy(lT);effective.rightHand.copy(rT);
  const lS=rig.by.leftUpperArm.getWorldPosition(new THREE.Vector3()),rS=rig.by.rightUpperArm.getWorldPosition(new THREE.Vector3());
  const lB=Math.max(pole.L.over,pole.L.edge*.65),rB=Math.max(pole.R.over,pole.R.edge*.65);
  // Outside travel is now accumulative: the elbow pole keeps side/up context
  // while gaining forwardness, so the stick behaves more like a joycube face.
  const axes=bodyAxes(),UP=new THREE.Vector3(0,1,0);
  let lPole=lS.clone().addScaledVector(axes.lateral,pole.L.overX*(.26+.12*pole.L.over)+pole.L.faceX*.10+pinLX*.18).addScaledVector(UP,-.18+pole.L.overY*(.26+.10*pole.L.over)+pole.L.faceY*.12-pinLY*.22).addScaledVector(axes.forward,.24+pole.L.over*.24+Math.abs(pole.L.faceX)*.05+Math.abs(pole.L.faceY)*.06+pinLY*.24);
  let rPole=rS.clone().addScaledVector(axes.lateral,pole.R.overX*(.26+.12*pole.R.over)+pole.R.faceX*.10+pinRX*.18).addScaledVector(UP,-.18+pole.R.overY*(.26+.10*pole.R.over)+pole.R.faceY*.12-pinRY*.22).addScaledVector(axes.forward,.24+pole.R.over*.24+Math.abs(pole.R.faceX)*.05+Math.abs(pole.R.faceY)*.06+pinRY*.24);
  const freeArmL=!manual.leftHand&&!handPadActive('L'),freeArmR=!manual.rightHand&&!handPadActive('R');
  if(freeArmL)lPole=lS.clone().addScaledVector(axes.lateral,.15).addScaledVector(UP,-.20).addScaledVector(axes.forward,.17);
  if(freeArmR)rPole=rS.clone().addScaledVector(axes.lateral,-.15).addScaledVector(UP,-.20).addScaledVector(axes.forward,.17);
  limits.leftHand=solveTwoBone(rig.by.leftUpperArm,rig.by.leftLowerArm,rig.by.leftHand,lT,lPole,{avoid:'leftHand',memoryKey:'leftHand',anatomy:'arm',side:'L',maxFlexDeg:ANATOMY.elbowMax,bendAuthority:lB,fast:IS_TOUCH&&!manual.leftHand&&!handPadActive('L')})||limits.leftHand;
  limits.rightHand=solveTwoBone(rig.by.rightUpperArm,rig.by.rightLowerArm,rig.by.rightHand,rT,rPole,{avoid:'rightHand',memoryKey:'rightHand',anatomy:'arm',side:'R',maxFlexDeg:ANATOMY.elbowMax,bendAuthority:rB,fast:IS_TOUCH&&!manual.rightHand&&!handPadActive('R')})||limits.rightHand;


  // Lower-body field: high pads leave feet planted; low pads give that side
  // a real foot target. Both pads low lower the pelvis, so crouch falls out of IK.
  rig.mesh.updateMatrixWorld(true);const lH=rig.by.leftUpperLeg.getWorldPosition(new THREE.Vector3()),rH=rig.by.rightUpperLeg.getWorldPosition(new THREE.Vector3());
  const legAxes=bodyAxes(),upAxis=new THREE.Vector3(0,1,0);
  const lKneePole=lH.clone().addScaledVector(legAxes.lateral,.055+legLX*.12).addScaledVector(upAxis,-legLY*.12).addScaledVector(legAxes.forward,.43+legLY*.22);
  const rKneePole=rH.clone().addScaledVector(legAxes.lateral,-.055+legRX*.12).addScaledVector(upAxis,-legRY*.12).addScaledVector(legAxes.forward,.43+legRY*.22);
  separateFeet(dynFeet.left.p,dynFeet.right.p,locomotion.root,locomotion.heading,.145);
  dynFeet.left.p.copy(footLaneTarget('L',dynFeet.left.p,locomotion.root,locomotion.heading,!!manual.leftFoot||footPadActive('L')));
  dynFeet.right.p.copy(footLaneTarget('R',dynFeet.right.p,locomotion.root,locomotion.heading,!!manual.rightFoot||footPadActive('R')));
  const lFootCol=collisionAwareTarget('leftFoot',dynFeet.left.p.clone()),rFootCol=collisionAwareTarget('rightFoot',dynFeet.right.p.clone());
  effective.leftFoot.copy(lFootCol.point);effective.rightFoot.copy(rFootCol.point);
  separateFeet(effective.leftFoot,effective.rightFoot,locomotion.root,locomotion.heading,.145);
  effective.leftFoot.copy(footLaneTarget('L',effective.leftFoot,locomotion.root,locomotion.heading,!!manual.leftFoot||footPadActive('L')));effective.rightFoot.copy(footLaneTarget('R',effective.rightFoot,locomotion.root,locomotion.heading,!!manual.rightFoot||footPadActive('R')));
  dynFeet.left.p.copy(effective.leftFoot);dynFeet.right.p.copy(effective.rightFoot);
  const lLim=solveTwoBone(rig.by.leftUpperLeg,rig.by.leftLowerLeg,rig.by.leftFoot,effective.leftFoot,lKneePole,{avoid:'leftFoot',memoryKey:'leftFoot',anatomy:'leg',side:'L',maxFlexDeg:ANATOMY.kneeMax,fast:IS_TOUCH&&locomotion.walking>.05&&!manual.leftFoot&&!footPadActive('L')});
  const rLim=solveTwoBone(rig.by.rightUpperLeg,rig.by.rightLowerLeg,rig.by.rightFoot,effective.rightFoot,rKneePole,{avoid:'rightFoot',memoryKey:'rightFoot',anatomy:'leg',side:'R',maxFlexDeg:ANATOMY.kneeMax,fast:IS_TOUCH&&locomotion.walking>.05&&!manual.rightFoot&&!footPadActive('R')});
  if(lLim||rLim)limits.pelvis=true;
  rig.by.leftFoot.rotation.x=clamp(-(targets.pole.kickL||0)*.20,-.22,.12);rig.by.rightFoot.rotation.x=clamp(-(targets.pole.kickR||0)*.20,-.22,.12);muscleFilterPose(dt);
}

function enforceAnimationAnatomy(){
  rig.mesh.updateMatrixWorld(true);
  const V=n=>rig.by[n].getWorldPosition(new THREE.Vector3());
  let lh=projectOutBody('leftHand',V('leftHand'),.060).point,rh=projectOutBody('rightHand',V('rightHand'),.060).point,lf=V('leftFoot'),rf=V('rightFoot');
  const lS=V('leftUpperArm'),rS=V('rightUpperArm'),lH=V('leftUpperLeg'),rH=V('rightUpperLeg');
  solveTwoBone(rig.by.leftUpperArm,rig.by.leftLowerArm,rig.by.leftHand,lh,lS.clone().add(new THREE.Vector3(.22,-.18,.32)),{avoid:'leftHand',memoryKey:'leftHand',anatomy:'arm',side:'L',maxFlexDeg:ANATOMY.elbowMax});
  solveTwoBone(rig.by.rightUpperArm,rig.by.rightLowerArm,rig.by.rightHand,rh,rS.clone().add(new THREE.Vector3(-.22,-.18,.32)),{avoid:'rightHand',memoryKey:'rightHand',anatomy:'arm',side:'R',maxFlexDeg:ANATOMY.elbowMax});
  rig.mesh.updateMatrixWorld(true);
  solveTwoBone(rig.by.leftUpperLeg,rig.by.leftLowerLeg,rig.by.leftFoot,lf,lH.clone().add(new THREE.Vector3(.04,-.08,.40)),{avoid:'leftFoot',memoryKey:'leftFoot',anatomy:'leg',side:'L',maxFlexDeg:ANATOMY.kneeMax});
  solveTwoBone(rig.by.rightUpperLeg,rig.by.rightLowerLeg,rig.by.rightFoot,rf,rH.clone().add(new THREE.Vector3(-.04,-.08,.40)),{avoid:'rightFoot',memoryKey:'rightFoot',anatomy:'leg',side:'R',maxFlexDeg:ANATOMY.kneeMax});
  rig.mesh.updateMatrixWorld(true);
}

// T-controller visualization: controls are visible causes, not hidden forces.
const lineMat=new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.65}),lineGeo=()=>new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
function beam(a,b,w=.025){const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x000000}));scene.add(m);m.userData.update=()=>{const d=b().clone().sub(a()),mid=a().clone().add(b()).multiplyScalar(.5);m.position.copy(mid);m.scale.set(w,w,d.length());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize())};return m}
const leftPoleObj=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshBasicMaterial({color:0x000000})),rightPoleObj=leftPoleObj.clone();scene.add(leftPoleObj,rightPoleObj);
const beamLR=beam(()=>poleWorld('L'),()=>poleWorld('R'),.028),stem=beam(()=>poleWorld('L').clone().add(poleWorld('R')).multiplyScalar(.5),()=>poleWorld('L').clone().add(poleWorld('R')).multiplyScalar(.5).add(new THREE.Vector3(0,.28,0)),.018);
const causeLines=[];function causeLine(){const l=new THREE.Line(lineGeo(),lineMat.clone());scene.add(l);causeLines.push(l);return l}for(let i=0;i<5;i++)causeLine();
function setLine(l,a,b,color=0x000000,opacity=.55){const ar=l.geometry.attributes.position.array;ar[0]=a.x;ar[1]=a.y;ar[2]=a.z;ar[3]=b.x;ar[4]=b.y;ar[5]=b.z;l.geometry.attributes.position.needsUpdate=true;l.material.color.set(color);l.material.opacity=opacity}
const markerGeo=new THREE.RingGeometry(.072,.084,32),markerMat=new THREE.MeshBasicMaterial({color:0xff2e2e,side:THREE.DoubleSide,depthTest:false});
const markers={leftHand:new THREE.Mesh(markerGeo,markerMat.clone()),rightHand:new THREE.Mesh(markerGeo,markerMat.clone()),leftFoot:new THREE.Mesh(markerGeo,markerMat.clone()),rightFoot:new THREE.Mesh(markerGeo,markerMat.clone()),pelvis:new THREE.Mesh(new THREE.RingGeometry(.088,.098,28),new THREE.MeshBasicMaterial({color:0x19e6c8,side:THREE.DoubleSide,depthTest:false}))};
for(const [name,m] of Object.entries(markers)){scene.add(m);m.renderOrder=20;m.quaternion.copy(camera.quaternion);m.userData.semantic=name}
function updateViz(){
  const L=poleWorld('L'),R=poleWorld('R');leftPoleObj.position.copy(L);rightPoleObj.position.copy(R);beamLR.userData.update();stem.userData.update();
  const now=performance.now();updateViz._uiAt??=0;if(!IS_TOUCH||now-updateViz._uiAt>70){updateViz._uiAt=now;const stemTip=L.clone().add(R).multiplyScalar(.5).add(new THREE.Vector3(0,.46,0)),sp=stemTip.clone().project(camera),hsx=(sp.x*.5+.5)*innerWidth,hsy=(-sp.y*.5+.5)*innerHeight,hd=$('#headDock');const landscape=innerWidth>innerHeight;headCtl.homeX=clamp(hsx,52,innerWidth-52);headCtl.homeY=clamp(hsy+(landscape?52:32),landscape?150:180,innerHeight-(landscape?252:236));hd.style.left=`${headCtl.homeX+headCtl.basePX}px`;hd.style.top=`${headCtl.homeY+headCtl.basePY}px`;if(headCtl.pointer!=null||pole.L.pointer!=null||pole.R.pointer!=null||legCtl.L.pointer!=null||legCtl.R.pointer!=null||Math.abs(headCtl.basePX)+Math.abs(headCtl.basePY)+Math.abs(pole.L.basePX)+Math.abs(pole.R.basePX)+Math.abs(legCtl.L.basePX)+Math.abs(legCtl.R.basePX)>.5)updateAllFieldVisuals();}
  markers.leftHand.position.copy(effective.leftHand);markers.rightHand.position.copy(effective.rightHand);markers.leftFoot.position.copy(effective.leftFoot);markers.rightFoot.position.copy(effective.rightFoot);markers.pelvis.position.copy(dyn.pelvis.p);for(const m of Object.values(markers))m.quaternion.copy(camera.quaternion);
  for(const name of ['leftHand','rightHand','leftFoot','rightFoot'])markers[name].material.color.set(limits[name]?0x000000:contacts[name]?0xffb000:0xff2e2e);markers.pelvis.material.color.set(limits.pelvis?0xff2e2e:0x19e6c8);
  const ls=rig.by.leftShoulder.getWorldPosition(new THREE.Vector3()),rs=rig.by.rightShoulder.getWorldPosition(new THREE.Vector3()),head=rig.by.head.getWorldPosition(new THREE.Vector3()),lh=rig.by.leftHand.getWorldPosition(new THREE.Vector3()),rh=rig.by.rightHand.getWorldPosition(new THREE.Vector3());
  setLine(causeLines[0],L,ls);setLine(causeLines[1],R,rs);setLine(causeLines[2],L.clone().add(R).multiplyScalar(.5),head,limits.head?0xff2e2e:0x000000,.6);setLine(causeLines[3],lh,effective.leftHand,limits.leftHand?0xff2e2e:contacts.leftHand?0xffb000:0x19e6c8,.7);setLine(causeLines[4],rh,effective.rightHand,limits.rightHand?0xff2e2e:contacts.rightHand?0xffb000:0x19e6c8,.7)
}

function normAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function triggerNudge(key,dx,dy){
  const n=motion.nudge[key],body=motion.nudge.body;n.x+=clamp(dx,-1,1)*.18;n.y+=clamp(dy,-1,1)*.20;body.x+=clamp(dx,-1,1)*.035;body.y+=clamp(dy,-1,1)*.025;
  const el=$(key==='L'?'#joyLA':'#joyRA');el.classList.add('nudge');setTimeout(()=>el.classList.remove('nudge'),130);buzz('nudge-'+key,10)
}
function padIds(kind,key){const side=key==='L'?'L':'R',suffix=kind==='arm'?'A':'L';return{joy:'#joy'+side+suffix,nub:'#nub'+side+suffix,z:'#joyZ'+side+suffix,over:'#over'+side+suffix,line:'#fieldLine'+side+suffix,home:'#fieldHome'+side+suffix}}
function padState(kind,key){return kind==='arm'?pole[key]:legCtl[key]}
function updatePadUI(kind,key){const st=padState(kind,key),ids=padIds(kind,key),el=$(ids.joy),lab=$(ids.z);let mode=st.pinned?'PIN':kind==='arm'?'ARM':'LEG';if(!st.pinned&&kind==='arm'&&st.point>.02)mode='POINT';if(!st.pinned&&kind==='leg'&&(st.y>.30||st.over>.24))mode='KICK';const z=st.pinned?` · S ${st.secY.toFixed(2)}`:(Math.abs(st.wind)>.02?` · Z ${st.wind>=0?'+':''}${st.wind.toFixed(2)}`:' · Z 0.00');lab.textContent=mode+z;el.classList.toggle('wind',!st.pinned&&Math.abs(st.wind)>.04);el.classList.toggle('over',!st.pinned&&st.over>.02);el.classList.toggle('pointing',!st.pinned&&kind==='arm'&&st.point>.02);el.classList.toggle('pinned',st.pinned);$('#viewerAim').classList.toggle('on',pole.L.point>.02||pole.R.point>.02)}
function updateOverUI2(kind,key,dx,dy,max){const st=padState(kind,key),line=$(padIds(kind,key).over),len=Math.hypot(dx,dy)||1,ang=Math.atan2(dy,dx);if(st.over>.01){const extra=Math.min(max*1.25,Math.max(0,len-max));line.style.width=`${extra}px`;line.style.transform=`rotate(${ang}rad)`;line.style.opacity='.72'}else{line.style.width='0px';line.style.opacity='0'}updatePadUI(kind,key)}
function updateFieldState2(kind,key,el){const st=padState(kind,key),sx=Math.max(120,innerWidth*.30),sy=Math.max(150,innerHeight*.24);el.style.translate=`${st.basePX}px ${st.basePY}px`;st.fieldX=clamp(st.basePX/sx,-1,1);st.fieldY=clamp(-st.basePY/sy,-1,1);st.fieldMag=clamp(Math.hypot(st.fieldX,st.fieldY),0,1.35);const band=st.fieldMag>.90?3:st.fieldMag>.58?2:st.fieldMag>.25?1:0;if(band>st.fieldBand)buzz('field-'+kind+key+'-'+band,band===1?[5]:band===2?[7,18,7]:[10,20,10,20,10],700);st.fieldBand=band;el.classList.toggle('field1',band===1);el.classList.toggle('field2',band===2);el.classList.toggle('field3',band===3);updatePadUI(kind,key)}
function carryPadBase(kind,key,el,dx,dy,max){const st=padState(kind,key),len=Math.hypot(dx,dy)||1,excess=Math.max(0,len-max*1.06);if(excess<=0)return;const step=Math.min(18,excess*.20);st.basePX+=dx/len*step;st.basePY+=dy/len*step;const maxX=Math.min(innerWidth*.25,190),maxY=Math.min(innerHeight*.20,190);st.basePX=clamp(st.basePX,key==='L'?-maxX: -18,key==='L'?18:maxX);st.basePY=clamp(st.basePY,-maxY,maxY);updateFieldState2(kind,key,el)}
function updateHeadFieldState(){const sx=Math.max(120,innerWidth*.30),sy=Math.max(150,innerHeight*.24);headCtl.fieldX=clamp(headCtl.basePX/sx,-1,1);headCtl.fieldY=clamp(-headCtl.basePY/sy,-1,1);headCtl.fieldMag=clamp(Math.hypot(headCtl.fieldX,headCtl.fieldY),0,1.35);const band=headCtl.fieldMag>.90?3:headCtl.fieldMag>.58?2:headCtl.fieldMag>.25?1:0;if(band>headCtl.fieldBand)buzz('head-field-'+band,band===1?[5]:band===2?[7,18,7]:[10,20,10,20,10],700);headCtl.fieldBand=band;const j=$('#joyH');if(j){j.classList.toggle('field1',band===1);j.classList.toggle('field2',band===2);j.classList.toggle('field3',band===3)}updateHeadUI()}
function carryHeadBase(dx,dy,max){const len=Math.hypot(dx,dy)||1,excess=Math.max(0,len-max*1.06);if(excess<=0)return;const step=Math.min(18,excess*.20);headCtl.basePX+=dx/len*step;headCtl.basePY+=dy/len*step;const maxX=Math.min(innerWidth*.32,210),maxUp=Math.min(innerHeight*.18,170),maxDown=Math.min(innerHeight*.25,240);headCtl.basePX=clamp(headCtl.basePX,-maxX,maxX);headCtl.basePY=clamp(headCtl.basePY,-maxUp,maxDown);updateHeadFieldState()}
function relaxJoyBases(dt){for(const kind of ['arm','leg'])for(const key of ['L','R']){const st=padState(kind,key),el=$(padIds(kind,key).joy);if(st.pointer==null&&(Math.abs(st.basePX)>.05||Math.abs(st.basePY)>.05)){const k=Math.exp(-dt*3.6);st.basePX*=k;st.basePY*=k;if(Math.abs(st.basePX)<.2)st.basePX=0;if(Math.abs(st.basePY)<.2)st.basePY=0;updateFieldState2(kind,key,el)}}if(headCtl.pointer==null&&(Math.abs(headCtl.basePX)>.05||Math.abs(headCtl.basePY)>.05)){const k=Math.exp(-dt*3.4);headCtl.basePX*=k;headCtl.basePY*=k;if(Math.abs(headCtl.basePX)<.2)headCtl.basePX=0;if(Math.abs(headCtl.basePY)<.2)headCtl.basePY=0;updateHeadFieldState()}}
function updateFieldVisual2(kind,key){const st=padState(kind,key),ids=padIds(kind,key),el=$(ids.joy),line=$(ids.line),home=$(ids.home),r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,hx=cx-st.basePX,hy=cy-st.basePY,dx=cx-hx,dy=cy-hy,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);home.style.left=`${hx}px`;home.style.top=`${hy}px`;line.style.left=`${hx}px`;line.style.top=`${hy}px`;line.style.width=`${len}px`;line.style.transform=`rotate(${ang}rad)`;line.style.opacity=String(.10+.28*clamp(st.fieldMag,0,1))}
function updateHeadFieldVisual(){const el=$('#joyH'),line=$('#fieldLineH'),home=$('#fieldHomeH');if(!el||!line||!home)return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,hx=cx-headCtl.basePX,hy=cy-headCtl.basePY,dx=cx-hx,dy=cy-hy,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);home.style.left=`${hx}px`;home.style.top=`${hy}px`;line.style.left=`${hx}px`;line.style.top=`${hy}px`;line.style.width=`${len}px`;line.style.transform=`rotate(${ang}rad)`;line.style.opacity=String(.10+.28*clamp(headCtl.fieldMag,0,1))}
function updateAllFieldVisuals(){for(const kind of ['arm','leg'])for(const key of ['L','R'])updateFieldVisual2(kind,key);updateHeadFieldVisual()}
function pinTargetFor(kind,key){const bone=kind==='arm'?(key==='L'?rig.by.leftHand:rig.by.rightHand):(key==='L'?rig.by.leftFoot:rig.by.rightFoot);rig.mesh.updateMatrixWorld(true);return bone.getWorldPosition(new THREE.Vector3())}
function clearPin(kind,key,el,secnub){const st=padState(kind,key);if(st.pinTimer){clearTimeout(st.pinTimer);st.pinTimer=null}st.pinned=false;st.pinGateAt=0;st.pinAnchor=null;st.pinOriginX=st.pinOriginY=0;st.secX=st.secY=st.secMag=st.secOver=0;el.classList.remove('pinned','pinarming');if(secnub)secnub.style.transform='translate(-50%,-50%)';updatePadUI(kind,key)}
function setupPad(kind,key){
  const ids=padIds(kind,key),el=$(ids.joy),nub=$(ids.nub),st=padState(kind,key),secnub=el.querySelector('.secnub');
  function activatePin(e,cx,cy,max){if(st.pinned)return;if(st.pinTimer){clearTimeout(st.pinTimer);st.pinTimer=null}st.pinned=true;st.pinGateAt=0;st.point=0;st.pinAnchor=pinTargetFor(kind,key);st.pinOriginX=cx;st.pinOriginY=cy-max;st.secX=st.secY=st.secMag=st.secOver=0;el.classList.remove('pinarming');el.classList.add('pinned');nub.style.transform=`translate(-50%,-50%) translate(0px,${-max}px)`;buzz('pin-'+kind+key,[8,16,18],500);updatePadUI(kind,key)}
  function updateSecondary(e,cx,cy,max){const dx=e.clientX-st.pinOriginX,dy=Math.max(0,e.clientY-st.pinOriginY);st.secX=clamp(dx/(max*1.35),-1,1);st.secY=clamp(dy/(max*2.15),0,1);st.secMag=clamp(Math.hypot(st.secX,st.secY),0,1.25);st.secOver=smoothstep(.68,1,st.secMag);if(secnub)secnub.style.transform=`translate(-50%,-50%) translate(${st.secX*max*.72}px,${Math.min(max*2.05,dy)}px)`;updatePadUI(kind,key)}
  function update(e){
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=(r.width-38)/2,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy)||1,rawR=len/max,s=Math.min(1,1/rawR),nx=clamp(dx*s/max,-1,1),ny=clamp(-dy*s/max,-1,1),ax=dx/max,ay=-dy/max,ang=Math.atan2(dy,dx);
    if(st.pinned){updateSecondary(e,cx,cy,max);return}
    st.x=nx;st.y=ny;st.radius=Math.min(rawR,1.85);st.edge=clamp((rawR-.46)/.54,0,1);st.over=clamp((rawR-1)/1.10,0,1);st.cube=st.over;st.point=kind==='arm'?clamp((rawR-1.18)/.52,0,1):0;st.faceX=clamp(Math.abs(ax)-1,0,1.2)*Math.sign(ax);st.faceY=clamp(Math.abs(ay)-1,0,1.2)*Math.sign(ay);st.shoulder=kind==='arm'?clamp((rawR-.20)/.55,0,1)*(1-st.over*.35):0;st.overX=dx/len;st.overY=-dy/len;if(st.point>.03&&!st.wasPoint)st.wasPoint=true;else if(st.point<=.01)st.wasPoint=false;nub.style.transform=`translate(-50%,-50%) translate(${st.x*max}px,${-st.y*max}px)`;
    const topGate=ny>.82&&rawR>.72&&Math.abs(nx)<.58;
    if(topGate){if(!st.pinGateAt){st.pinGateAt=performance.now();el.classList.add('pinarming');const ex=e.clientX,ey=e.clientY;st.pinTimer=setTimeout(()=>{if(st.pointer!=null&&!st.pinned&&st.pinGateAt){activatePin({clientX:ex,clientY:ey},cx,cy,max)}},155)}}else{if(st.pinTimer){clearTimeout(st.pinTimer);st.pinTimer=null}st.pinGateAt=0;el.classList.remove('pinarming');carryPadBase(kind,key,el,dx,dy,max)}
    updateOverUI2(kind,key,dx,dy,max);
    if(!topGate&&st.down&&performance.now()-st.down.t>90&&rawR>.68&&st.lastAngle!=null){const da=normAngle(ang-st.lastAngle);if(Math.abs(da)<.52){st.wind=clamp(st.wind+da*.46,-1,1);updatePadUI(kind,key)}}st.lastAngle=ang
  }
  function release(e){if(st.pointer!==e.pointerId)return;const wasPinned=st.pinned,down=st.down,dur=down?performance.now()-down.t:999,dx=down?(e.clientX-down.x):0,dy=down?(e.clientY-down.y):0,r=el.getBoundingClientRect(),travel=Math.hypot(dx,dy),scale=Math.max(40,r.width*.42);if(!wasPinned&&kind==='arm'&&dur<285&&travel>scale*.62)triggerNudge(key,dx/scale,-dy/scale);else if(!wasPinned&&dur<190&&travel<14){const now=performance.now();if(now-st.lastTap<320){st.wind=0;updatePadUI(kind,key);buzz('wind-reset-'+kind+key,6)}st.lastTap=now}if(wasPinned)buzz('unpin-'+kind+key,5,220);clearPin(kind,key,el,secnub);st.pointer=null;st.x=st.y=st.radius=st.edge=st.over=st.point=st.faceX=st.faceY=st.shoulder=st.cube=st.overX=st.overY=0;st.wasPoint=false;st.lastAngle=null;st.down=null;nub.style.transform='translate(-50%,-50%)';updateOverUI2(kind,key,0,0,1)}
  el.addEventListener('pointerdown',e=>{enterPuppetMode(key==='R'?'L':'R',kind);st.pointer=e.pointerId;st.down={t:performance.now(),x:e.clientX,y:e.clientY};st.lastAngle=null;st.pinGateAt=0;el.setPointerCapture(e.pointerId);update(e)});el.addEventListener('pointermove',e=>{if(st.pointer===e.pointerId)update(e)});el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);updateFieldState2(kind,key,el);updatePadUI(kind,key)
}
setupPad('arm','L');setupPad('leg','L');setupPad('arm','R');setupPad('leg','R');
function updateHeadUI(){const z=$('#joyZH'),j=$('#joyH');if(!z||!j)return;const mode=headCtl.fieldMag>.58?'BODY':headCtl.fieldMag>.25?'TORSO':headCtl.lead>.08||headCtl.over>.08?'LOOK+':Math.hypot(headCtl.x,headCtl.y)>.08?'LOOK':'HEAD';const lim=headCtl.edge>.32?' RESIST':'';z.textContent=`${mode}${lim}${headCtl.fieldMag>.08?' · F '+headCtl.fieldMag.toFixed(2):''}${Math.abs(headCtl.wind)>.03?' · R '+(headCtl.wind>=0?'+':'')+headCtl.wind.toFixed(2):''}`;j.classList.toggle('wind',Math.abs(headCtl.wind)>.04);j.classList.toggle('over',headCtl.edge>.32)}
function setupHeadJoy(elId,nubId){
  const el=$(elId),nub=$(nubId);
  function update(e){
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=(r.width-30)/2,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy)||1,rawR=len/max,s=Math.min(1,1/rawR),nx=clamp(dx*s/max,-1,1),ny=clamp(-dy*s/max,-1,1),ax=dx/max,ay=-dy/max,ang=Math.atan2(dy,dx);
    headCtl.x=nx;headCtl.y=ny;headCtl.radius=Math.min(rawR,1.7);headCtl.edge=clamp((rawR-.54)/.46,0,1);headCtl.over=clamp((rawR-1)/.9,0,1);headCtl.faceX=clamp(Math.abs(ax)-1,0,1.2)*Math.sign(ax);headCtl.faceY=clamp(Math.abs(ay)-1,0,1.2)*Math.sign(ay);headCtl.lead=headCtl.over;
    nub.style.transform=`translate(-50%,-50%) translate(${headCtl.x*max}px,${-headCtl.y*max}px)`;carryHeadBase(dx,dy,max);
    if(headCtl.down&&performance.now()-headCtl.down.t>120&&rawR>.78&&headCtl.lastAngle!=null){const da=normAngle(ang-headCtl.lastAngle);if(Math.abs(da)<.42){headCtl.wind=clamp(headCtl.wind+da*.34,-1,1);updateHeadUI()}}
    headCtl.lastAngle=ang;updateHeadUI()
  }
  function release(e){
    if(headCtl.pointer!==e.pointerId)return;
    const down=headCtl.down,dur=down?performance.now()-down.t:999,dx=down?(e.clientX-down.x):0,dy=down?(e.clientY-down.y):0,travel=Math.hypot(dx,dy);
    if(dur<285&&travel>22){motion.nudge.body.x+=clamp(dx/70,-1,1)*.02;motion.nudge.body.y+=clamp(-dy/70,-1,1)*.02;buzz('head-flick',[6,14,6],180)}
    else if(dur<190&&travel<12){const now=performance.now();if(now-headCtl.lastTap<320){headCtl.wind=0;updateHeadUI();buzz('head-reset',6,180)}headCtl.lastTap=now}
    headCtl.pointer=null;headCtl.x=0;headCtl.y=0;headCtl.radius=0;headCtl.edge=0;headCtl.over=0;headCtl.faceX=0;headCtl.faceY=0;headCtl.lead=0;headCtl.lastAngle=null;headCtl.down=null;nub.style.transform='translate(-50%,-50%)';updateHeadUI()
  }
  el.addEventListener('pointerdown',e=>{enterPuppetMode();headCtl.pointer=e.pointerId;headCtl.down={t:performance.now(),x:e.clientX,y:e.clientY};headCtl.lastAngle=null;el.setPointerCapture(e.pointerId);buzz('head-grab',5,120);update(e)});
  el.addEventListener('pointermove',e=>{if(headCtl.pointer===e.pointerId)update(e)});el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release)
}
setupHeadJoy('#joyH','#nubH');updateHeadUI();

// Extra fingers acquire semantic targets. First finger = XY. A second finger
// on empty stage while a target is held = depth clutch for that target.
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),draggers=new Map(),depthClutches=new Map();
function mouseRay(e){mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;ray.setFromCamera(mouse,camera)}
function screenXY(v){const q=v.clone().project(camera);return{x:(q.x*.5+.5)*innerWidth,y:(-.5*q.y+.5)*innerHeight}}
function currentControlWorld(name){if(name==='leftHand')return effective.leftHand;if(name==='rightHand')return effective.rightHand;if(name==='leftFoot')return effective.leftFoot;if(name==='rightFoot')return effective.rightFoot;return dyn.pelvis.p}
function pickSemantic(e){const pts={leftHand:rig.by.leftHand.getWorldPosition(new THREE.Vector3()),rightHand:rig.by.rightHand.getWorldPosition(new THREE.Vector3()),leftFoot:rig.by.leftFoot.getWorldPosition(new THREE.Vector3()),rightFoot:rig.by.rightFoot.getWorldPosition(new THREE.Vector3()),pelvis:rig.by.hips.getWorldPosition(new THREE.Vector3())};let best=null,bd=126;for(const [name,v] of Object.entries(pts)){const s=screenXY(v),d=Math.hypot(e.clientX-s.x,e.clientY-s.y);if(d<bd){bd=d;best=name}}return best}
function primaryForName(name){for(const [id,d] of draggers)if(d.name===name)return{id,d};return null}
function latestPrimary(){const a=[...draggers.entries()];if(!a.length)return null;const [id,d]=a[a.length-1];return{id,d}}
canvas.addEventListener('pointerdown',e=>{
  if(controls.enabled)return;
  const name=pickSemantic(e),already=name&&[...draggers.values()].some(d=>d.name===name);
  if(name&&!already){
    mouseRay(e);const start=currentControlWorld(name).clone(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(),start),hit=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,hit))return;
    draggers.set(e.pointerId,{name,plane,offset:start.clone().sub(hit)});manual[name]=start.clone();canvas.setPointerCapture(e.pointerId);buzz('grab'+name,5);return
  }
  const primary=(name&&already?primaryForName(name):latestPrimary());if(primary){const cur=(manual[primary.d.name]||currentControlWorld(primary.d.name)).clone();depthClutches.set(e.pointerId,{primaryId:primary.id,name:primary.d.name,startY:e.clientY,startZ:cur.z});canvas.setPointerCapture(e.pointerId);buzz('depth-'+primary.d.name,4)}
});
canvas.addEventListener('pointermove',e=>{
  const zc=depthClutches.get(e.pointerId);if(zc){const cur=(manual[zc.name]||currentControlWorld(zc.name)).clone(),worldPerPx=.0042;cur.z=zc.startZ+(e.clientY-zc.startY)*worldPerPx;manual[zc.name]=clampTarget(zc.name,cur);return}
  const d=draggers.get(e.pointerId);if(!d)return;mouseRay(e);const p=new THREE.Vector3();if(!ray.ray.intersectPlane(d.plane,p))return;p.add(d.offset);if(manual[d.name])p.z=manual[d.name].z;manual[d.name]=clampTarget(d.name,p)
});
function releaseDirect(e){
  if(depthClutches.has(e.pointerId)){depthClutches.delete(e.pointerId);try{canvas.releasePointerCapture(e.pointerId)}catch(_){}return}
  const d=draggers.get(e.pointerId);if(!d)return;draggers.delete(e.pointerId);for(const [id,z] of [...depthClutches])if(z.primaryId===e.pointerId)depthClutches.delete(id);
  if(d.name==='leftFoot'&&manual.leftFoot)locomotion.footAnchor.L.copy(clampTarget('leftFoot',manual.leftFoot.clone()));
  if(d.name==='rightFoot'&&manual.rightFoot)locomotion.footAnchor.R.copy(clampTarget('rightFoot',manual.rightFoot.clone()));
  manual[d.name]=null;try{canvas.releasePointerCapture(e.pointerId)}catch(_){}
}
canvas.addEventListener('pointerup',releaseDirect);canvas.addEventListener('pointercancel',releaseDirect);

function screenAdjustedAxes(pitch,roll){
  let ang=0;try{ang=(screen.orientation&&Number.isFinite(screen.orientation.angle)?screen.orientation.angle:(Number(window.orientation)||0))%360}catch(_){ang=0}
  if(ang===90||ang===-270)return{pitch:-roll,roll:pitch};
  if(ang===270||ang===-90)return{pitch:roll,roll:-pitch};
  if(Math.abs(ang)===180)return{pitch:-pitch,roll:-roll};
  return{pitch,roll}
}
function tiltEmbedded(){try{return window.self!==window.top}catch(_){return true}}
function policyAllows(feature){
  const pp=document.permissionsPolicy||document.featurePolicy;
  if(!pp||typeof pp.allowsFeature!=='function')return true;
  try{return pp.allowsFeature(feature)}catch(_){return true}
}
function tiltContextDiagnostic(){
  if(!window.isSecureContext)return 'HTTPS REQUIRED';
  const acc=policyAllows('accelerometer'),gyro=policyAllows('gyroscope');
  if(!acc||!gyro)return tiltEmbedded()?'EMBED BLOCK':(!acc?'ACCEL BLOCKED':'GYRO BLOCKED');
  return '';
}
function openTiltTopLevel(){
  try{const w=window.open(location.href,'_blank','noopener');if(w){buzz('tilt-open',12);return true}}catch(_){ }
  return false
}
function bindTiltListeners(){
  if(bindTiltListeners.bound)return;
  window.addEventListener('deviceorientation',onDeviceOrientation,true);
  window.addEventListener('deviceorientationabsolute',onDeviceOrientation,true);
  window.addEventListener('devicemotion',onDeviceMotion,true);
  bindTiltListeners.bound=true;
}
function markTiltSample(source){
  motion.sampleCount++;motion.lastSampleAt=performance.now();motion.source=source;motion.hasSample=true;motion.sensorLabel='tilt live';motion.permissionState='live';
}
function onDeviceOrientation(e){
  if(!motion.enabled||e.beta==null||e.gamma==null)return;
  motion.orientationSeen=true;motion.rawBeta=e.beta;motion.rawGamma=e.gamma;
  if(!motion.hasSample){motion.neutralBeta=e.beta;motion.neutralGamma=e.gamma}
  const a=screenAdjustedAxes(clamp((e.beta-motion.neutralBeta)/16,-1,1),clamp((e.gamma-motion.neutralGamma)/16,-1,1));
  motion.targetPitch=a.pitch;motion.targetRoll=a.roll;markTiltSample('orientation')
}
function accelToTilt(x,y,z,source){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
  const ap=Math.atan2(z,-y||.0001),ar=Math.atan2(x,-y||.0001);motion.rawAccelPitch=ap;motion.rawAccelRoll=ar;
  if(!motion.motionSeen&&!motion.genericSeen){motion.neutralAccelPitch=ap;motion.neutralAccelRoll=ar}
  const ax=screenAdjustedAxes(clamp((ap-motion.neutralAccelPitch)/(16*DEG),-1,1),clamp((ar-motion.neutralAccelRoll)/(16*DEG),-1,1));
  // orientation wins when it is actively streaming; acceleration is the fallback.
  if(!motion.orientationSeen||performance.now()-motion.lastSampleAt>500){motion.targetPitch=ax.pitch;motion.targetRoll=ax.roll}
  markTiltSample(source)
}
function onDeviceMotion(e){
  if(!motion.enabled)return;
  const a=e.accelerationIncludingGravity;if(!a||a.x==null||a.y==null||a.z==null)return;
  if(!motion.motionSeen){motion.motionSeen=true;if(!motion.hasSample){const ap=Math.atan2(a.z,-a.y||.0001),ar=Math.atan2(a.x,-a.y||.0001);motion.neutralAccelPitch=ap;motion.neutralAccelRoll=ar}}
  accelToTilt(a.x,a.y,a.z,motion.orientationSeen?'orientation+motion':'accelerometer')
}
function stopGenericTiltSensor(){
  if(motion.genericSensor){try{motion.genericSensor.stop()}catch(_){ }motion.genericSensor=null}
}
function startGenericTiltSensor(){
  if(!motion.enabled||motion.hasSample||motion.genericSensor||!window.isSecureContext)return false;
  // Best Chromium path first: fused relative orientation (accelerometer + gyro,
  // no magnetometer), then fall back to raw gravity from Accelerometer.
  if(typeof RelativeOrientationSensor!=='undefined'){
    try{
      const sensor=new RelativeOrientationSensor({frequency:30,referenceFrame:'device'});motion.genericSensor=sensor;motion.genericError='';let neutralQ=null;
      sensor.addEventListener('reading',()=>{
        if(!motion.enabled||!sensor.quaternion)return;
        const q=new THREE.Quaternion(sensor.quaternion[0],sensor.quaternion[1],sensor.quaternion[2],sensor.quaternion[3]);
        if(!neutralQ){neutralQ=q.clone();motion.genericSeen=true}
        const dq=neutralQ.clone().invert().multiply(q),eu=new THREE.Euler().setFromQuaternion(dq,'YXZ'),ax=screenAdjustedAxes(clamp(eu.x/(16*DEG),-1,1),clamp(-eu.z/(16*DEG),-1,1));
        motion.targetPitch=ax.pitch;motion.targetRoll=ax.roll;markTiltSample('relative-orientation');updateTiltViz();
      });
      sensor.addEventListener('error',e=>{motion.genericError=e.error?.name||e.error?.message||'RELATIVE SENSOR ERROR';try{sensor.stop()}catch(_){ }motion.genericSensor=null;if(!motion.hasSample)startAccelerometerFallback();updateTiltViz();updateReadout()});
      sensor.start();motion.permissionDetail='trying relative orientation sensor';updateTiltViz();return true
    }catch(e){motion.genericError=e.name||e.message||String(e);motion.genericSensor=null}
  }
  return startAccelerometerFallback()
}
function startAccelerometerFallback(){
  if(!motion.enabled||motion.hasSample||motion.genericSensor||typeof Accelerometer==='undefined'||!window.isSecureContext)return false;
  try{
    const sensor=new Accelerometer({frequency:30,referenceFrame:'device'});motion.genericSensor=sensor;motion.genericError='';
    sensor.addEventListener('reading',()=>{
      if(!motion.enabled)return;
      if(!motion.genericSeen){motion.genericSeen=true;const ap=Math.atan2(sensor.z,-sensor.y||.0001),ar=Math.atan2(sensor.x,-sensor.y||.0001);motion.neutralAccelPitch=ap;motion.neutralAccelRoll=ar}
      accelToTilt(sensor.x,sensor.y,sensor.z,'generic-accelerometer');updateTiltViz();
    });
    sensor.addEventListener('error',e=>{motion.genericError=e.error?.name||e.error?.message||'GENERIC SENSOR ERROR';motion.genericSensor=null;updateTiltViz();updateReadout()});
    sensor.start();motion.permissionDetail='trying accelerometer fallback';updateTiltViz();return true;
  }catch(e){motion.genericError=e.name||e.message||String(e);motion.genericSensor=null;return false}
}
function updateTiltViz(){
  const box=$('#tiltViz'),dot=$('#tiltDot'),lab=$('#tiltState');
  if(!motion.enabled&&motion.permissionState==='off'){box.style.display='none';return}
  box.style.display='block';box.classList.remove('bad','wait');
  const age=performance.now()-motion.lastSampleAt,waitAge=performance.now()-motion.waitStarted;
  let state='WAIT';
  if(motion.permissionState==='asking'){box.classList.add('wait');state='ASK…'}
  else if(motion.permissionState==='denied'){box.classList.add('bad');state='DENIED'}
  else if(motion.permissionState==='insecure'){box.classList.add('bad');state='HTTPS'}
  else if(motion.permissionState==='policy'){box.classList.add('bad');state=tiltEmbedded()?'EMBED':'BLOCKED'}
  else if(motion.permissionState==='blocked'){box.classList.add('bad');state='OPEN ↗'}
  else if(!motion.hasSample){box.classList.add(waitAge>2200?'bad':'wait');state=waitAge>2200?(motion.genericError?'BLOCKED':'NO EVENTS'):'WAIT'}
  else if(age>1500){box.classList.add('bad');state='STALE'}
  else if(motion.source==='orientation')state='LIVE ORIENT';
  else if(motion.source==='relative-orientation')state='LIVE REL';
  else if(motion.source==='generic-accelerometer')state='LIVE SENSOR';
  else state='LIVE ACC';
  lab.textContent=state;dot.style.transform=`translate(${clamp(motion.roll,-1,1)*24}px,${clamp(motion.pitch,-1,1)*-12}px)`;
}
async function setTiltEnabled(on){
  if(!on){
    motion.enabled=false;motion.targetPitch=motion.targetRoll=0;motion.sensorLabel='tilt off';motion.permissionState='off';motion.permissionDetail='';stopGenericTiltSensor();
    $('#tiltBtn').classList.remove('on');$('#tiltBtn').textContent='TILT';updateTiltViz();updateReadout();return false
  }

  // This entire setup is entered directly from the TILT button's pointer/click.
  // Permission requests are CREATED before the first await so Safari keeps the
  // same user activation for both motion and orientation permission prompts.
  motion.permissionState='asking';motion.permissionDetail='requesting motion access';motion.waitStarted=performance.now();motion.enabled=true;
  $('#tiltBtn').classList.add('on');$('#tiltBtn').textContent='TILT ASK';updateTiltViz();updateReadout();

  const diag=tiltContextDiagnostic();
  if(diag==='HTTPS REQUIRED'){
    motion.enabled=false;motion.permissionState='insecure';motion.permissionDetail=diag;
    $('#tiltBtn').classList.remove('on');$('#tiltBtn').textContent='TILT HTTPS';updateTiltViz();updateReadout();return false
  }
  // Permissions-Policy diagnostics are advisory here. Still try every sensor
  // route: some browsers expose legacy events even when policy introspection is
  // incomplete. If all routes fail, offer a top-level escape from the embed.
  if(diag){motion.permissionDetail=diag+' — still trying';motion.permissionState='asking'}

  bindTiltListeners();
  try{
    const requests=[];
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      // Important: invoke now; do not await before invoking DeviceMotion below.
      requests.push(Promise.resolve(DeviceOrientationEvent.requestPermission()).then(v=>({kind:'orientation',value:v})));
    }
    if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
      requests.push(Promise.resolve(DeviceMotionEvent.requestPermission()).then(v=>({kind:'motion',value:v})));
    }
    const results=requests.length?await Promise.all(requests):[];
    const denied=results.find(r=>r.value!=='granted');
    if(denied)throw new Error(denied.kind+' permission '+denied.value);

    motion.enabled=true;motion.hasSample=false;motion.orientationSeen=false;motion.motionSeen=false;motion.genericSeen=false;motion.sampleCount=0;motion.lastSampleAt=0;motion.waitStarted=performance.now();motion.source='none';motion.genericError='';motion.permissionState='granted';motion.permissionDetail=results.length?'browser permission granted':'no explicit prompt required';
    $('#tiltBtn').classList.add('on');$('#tiltBtn').textContent='TILT WAIT';buzz('tilt-on',8);updateTiltViz();updateReadout();

    // Android Chrome often exposes the legacy events automatically. If they do
    // not arrive, try the Generic Sensor Accelerometer API as a second path.
    setTimeout(()=>{if(motion.enabled&&!motion.hasSample)startGenericTiltSensor()},850);
    setTimeout(()=>{if(motion.enabled&&!motion.hasSample){const blocked=tiltEmbedded()||!policyAllows('accelerometer')||!policyAllows('gyroscope');motion.permissionState=blocked?'blocked':'granted';$('#tiltBtn').textContent=blocked?'TILT OPEN↗':'TILT ?';motion.sensorLabel=blocked?'embedded/policy blocked':'no sensor events';motion.permissionDetail=blocked?'sensor blocked here — open top-level':'no sensor events';updateTiltViz();updateReadout()}},2400);
    return true
  }catch(e){
    motion.enabled=false;motion.permissionState='denied';motion.permissionDetail=String(e.message||e);stopGenericTiltSensor();
    $('#tiltBtn').classList.remove('on');$('#tiltBtn').textContent='TILT DENIED';updateTiltViz();updateReadout();return false
  }
}

function setupExplorerStick(sel,kind){
  const el=$(sel),nub=el?.querySelector('.navNub');if(!el||!nub)return;
  let pointer=null,cx=0,cy=0;
  const set=(e)=>{
    const r=el.getBoundingClientRect(),rad=Math.max(30,Math.min(r.width,r.height)*.34);let dx=e.clientX-cx,dy=e.clientY-cy,m=Math.hypot(dx,dy);if(m>rad){dx*=rad/m;dy*=rad/m;m=rad}
    const nx=dx/rad,ny=-dy/rad,mag=clamp(m/rad,0,1);nub.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    if(kind==='move'){explorer.touchMove.set(nx,ny);explorer.touchMoveMag=mag;explorer.movePointer=pointer;syncMobileInstrumentVisibility()}
    else{explorer.touchLook.set(nx,ny);explorer.touchLookMag=mag;explorer.lookPointer=pointer;explorer.cameraEngaged=true}
  };
  el.addEventListener('pointerdown',e=>{if(pointer!=null)return;enterTravelMode();pointer=e.pointerId;el.setPointerCapture(pointer);el.classList.add('live');const r=el.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;set(e);e.preventDefault()},{passive:false});
  el.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;set(e);e.preventDefault()},{passive:false});
  const end=e=>{if(e.pointerId!==pointer)return;pointer=null;el.classList.remove('live');nub.style.transform='translate(-50%,-50%)';if(kind==='move'){explorer.touchMove.set(0,0);explorer.touchMoveMag=0;explorer.movePointer=null;explorer.mobileNav=false;document.body.classList.remove('navigating','deck-using')}else{explorer.touchLook.set(0,0);explorer.touchLookMag=0;explorer.lookPointer=null}e.preventDefault()};
  el.addEventListener('pointerup',end,{passive:false});el.addEventListener('pointercancel',end,{passive:false});
}
setupExplorerStick('#navMove','move');setupExplorerStick('#navLook','look');
if(IS_TOUCH){setTimeout(()=>{document.body.classList.add('nav-awake');setTimeout(()=>document.body.classList.remove('nav-awake'),2600)},450)}

function lockHeadNow(){rig.mesh.updateMatrixWorld(true);headLockQ.copy(rig.by.head.getWorldQuaternion(new THREE.Quaternion()))}
$('#headBtn').onclick=()=>{headLock=!headLock;$('#headBtn').classList.toggle('on',headLock);$('#headBtn').textContent=headLock?'AUTO GAZE':'FREE HEAD';updateReadout()};
$('#tiltBtn').onclick=()=>{if(motion.permissionState==='blocked'||(motion.enabled&&!motion.hasSample&&tiltEmbedded())){if(openTiltTopLevel())return}setTiltEnabled(!motion.enabled)};
$('#viewBtn').onclick=()=>{view3d=!view3d;controls.enabled=view3d;document.body.classList.toggle('free-camera',view3d);const b=$('#viewBtn');b.classList.toggle('on',view3d);b.textContent=view3d?'FREE':'CAM';if(!view3d)fitPerformanceCamera();else{controls.target.set(locomotion.root.x,1.03,locomotion.root.z);controls.update()}};
$('#styleBtn').onclick=()=>{ink=!ink;$('#styleBtn').classList.toggle('on',ink);rig.mesh.material=ink?new THREE.MeshBasicMaterial({color:0x000000}):rig.mesh.userData.whiteMat;rig.outline.visible=!ink};
rig.mesh.userData.whiteMat=rig.mesh.material;
$('#resetBtn').onclick=()=>resetAll();$('#quickReset').onclick=()=>{if(view3d){view3d=false;controls.enabled=false;document.body.classList.remove('free-camera');$('#viewBtn').classList.remove('on');$('#viewBtn').textContent='CAM'}resetAll()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{stopMotion();mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('on',x.dataset.mode===mode));updateReadout()});
addEventListener('keydown',e=>{
  const ae=document.activeElement;if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')){if(e.code==='Escape')ae.blur();return}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){explorer.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault()}
  if(e.repeat)return;if(e.code==='Space'){e.preventDefault();gameCommand('jump')}else if(e.key==='c'||e.key==='C')gameCommand('crouch',1);else if(e.key==='h'||e.key==='H')gameCommand('hide',1);else if(e.key==='g'||e.key==='G')gameCommand('guard',1);else if(e.key==='f'||e.key==='F')gameCommand('strike');else if(e.key==='v'||e.key==='V')$('#viewBtn').click()
});
addEventListener('keyup',e=>{const ae=document.activeElement;if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))return;explorer.keys.delete(e.code);if(e.key==='c'||e.key==='C')gameCommand('crouch',0);else if(e.key==='h'||e.key==='H')gameCommand('hide',0);else if(e.key==='g'||e.key==='G')gameCommand('guard',0)});
addEventListener('blur',()=>explorer.keys.clear());
let lastReadoutAt=0;function updateReadout(){const now=performance.now();if(IS_TOUCH&&now-lastReadoutAt<110)return;lastReadoutAt=now;const contact=contacts.leftHand||contacts.rightHand||contacts.leftFoot||contacts.rightFoot;const state=contact?'CONTACT':locomotion.state;const ext=['externalPose','hands','mocap','xr','network'].find(k=>dataBus.get(k));readout.textContent=IS_TOUCH?`${state} · ${instrumentMode.mode==='travel'?'TRAVEL':'PUPPET'} · BODY DRIVE`:`${mode} · ${state}${ext?' · '+ext.toUpperCase():''} · WASD MOVE · SHIFT RUN · 4 EFFECTORS`;updateTiltViz()}
function resetAll(){resetSkeleton();for(const st of [pole.L,pole.R,legCtl.L,legCtl.R]){st.x=st.y=st.wind=st.radius=st.edge=st.over=st.point=st.faceX=st.faceY=st.shoulder=st.cube=st.overX=st.overY=st.basePX=st.basePY=st.fieldX=st.fieldY=st.fieldMag=0;st.fieldBand=0;st.pinned=false;st.pinGateAt=0;if(st.pinTimer){clearTimeout(st.pinTimer);st.pinTimer=null}st.pinAnchor=null;st.pinOriginX=st.pinOriginY=st.secX=st.secY=st.secMag=st.secOver=0;st.pointer=null;st.lastAngle=null;st.down=null;st.wasPoint=false}for(const kind of ['arm','leg'])for(const key of ['L','R']){const ids=padIds(kind,key),nub=$(ids.nub),el=$(ids.joy),sec=el?.querySelector('.secnub');if(nub)nub.style.transform='translate(-50%,-50%)';if(sec)sec.style.transform='translate(-50%,-50%)';el?.classList.remove('pinned','pinarming');updateFieldState2(kind,key,el);updatePadUI(kind,key)}headCtl.x=headCtl.y=headCtl.wind=headCtl.radius=headCtl.edge=headCtl.over=headCtl.faceX=headCtl.faceY=headCtl.lead=0;headCtl.basePX=headCtl.basePY=headCtl.fieldX=headCtl.fieldY=headCtl.fieldMag=0;headCtl.fieldBand=0;headCtl.pointer=null;headCtl.lastAngle=null;headCtl.down=null;headDyn.x=headDyn.y=headDyn.roll=headDyn.lead=headDyn.faceX=headDyn.faceY=0;updateHeadFieldState();const hN=$('#nubH');if(hN)hN.style.transform='translate(-50%,-50%)';motion.targetPitch=motion.targetRoll=motion.pitch=motion.roll=0;motion.nudge.L.set(0,0,0);motion.nudge.R.set(0,0,0);motion.nudge.body.set(0,0,0);for(const st of Object.values(dyn))st.v.set(0,0,0);for(const st of Object.values(dynFeet))st.v.set(0,0,0);dyn.leftHand.p.copy(base.leftHand);dyn.rightHand.p.copy(base.rightHand);dyn.pelvis.p.copy(base.pelvis);dynFeet.left.p.copy(feet.left);dynFeet.right.p.copy(feet.right);manual.leftHand=manual.rightHand=manual.leftFoot=manual.rightFoot=manual.pelvis=null;draggers.clear();depthClutches.clear();locomotion.root.set(0,0,0);locomotion.rootGoal.set(0,0,0);locomotion.heading=locomotion.headingGoal=0;locomotion.walking=0;locomotion.drive=locomotion.turn=locomotion.turnError=locomotion.contactDrive=0;locomotion.motorState='IDLE';locomotion.motorBlend=0;locomotion.turning=false;locomotion.lastContactSide='L';locomotion.moveDir.set(0,0,1);explorer.keys.clear();explorer.move.set(0,0,0);explorer.speed=0;explorer.run=false;explorer.touchMove.set(0,0);explorer.touchLook.set(0,0);explorer.touchMoveMag=explorer.touchLookMag=0;explorer.inputMag=0;explorer.movePointer=explorer.lookPointer=null;explorer.mobileNav=false;explorer.cameraYaw=0;explorer.cameraPitch=.06;explorer.cameraEngaged=false;explorer.lookBodyYaw=explorer.lookBodyPitch=explorer.lookStrength=0;document.body.classList.remove('navigating');locomotion.phase=0;locomotion.gaitHalf=-1;locomotion.stepClock=0;locomotion.inputMoving=false;instrumentMode.puppet.L=instrumentMode.puppet.R='arm';enterTravelMode();locomotion.footAnchor.L.copy(feet.left);locomotion.footAnchor.R.copy(feet.right);locomotion.step=null;locomotion.nextSide='L';locomotion.state='STAND';locomotion.bend=locomotion.sit=locomotion.jump=locomotion.reach=0;argosReset();ball.state='free';ball.p.set(px2w(34),DECK+ball.r,py2w(146));ball.v.set(0,0,0);bowl.food=false;_dogEatT=0;fitPerformanceCamera();limits.leftHand=limits.rightHand=limits.leftFoot=limits.rightFoot=limits.pelvis=limits.head=false;contacts.leftHand=contacts.rightHand=contacts.leftFoot=contacts.rightFoot=contacts.pelvis=false;effective.leftHand.copy(base.leftHand);effective.rightHand.copy(base.rightHand);effective.leftFoot.copy(feet.left);effective.rightFoot.copy(feet.right);effective.pelvis.copy(base.pelvis);lastSafe.leftHand.copy(base.leftHand);lastSafe.rightHand.copy(base.rightHand);lastSafe.leftFoot.copy(feet.left);lastSafe.rightFoot.copy(feet.right);lastSafe.pelvis.copy(base.pelvis);lockHeadNow();updateReadout()}


function fitPerformanceCamera(){
  const W=innerWidth,H=innerHeight;
  camera.aspect=W/H;camera.updateProjectionMatrix();
  const portrait=H>W,root=locomotion?.root||new THREE.Vector3();
  const radius=portrait?4.65:4.15;
  const target=new THREE.Vector3(root.x,root.y+1.03,root.z+.02);
  camera.position.set(root.x,root.y+(portrait?1.54:1.40),root.z+radius);
  camera.lookAt(target);controls.target.copy(target);
  camera.userData.performance={y:camera.position.y,z:radius};
  explorer.cameraRadius=radius;controls.minDistance=1.8;controls.maxDistance=700;controls.update();
}
function resize(){
  renderer.setSize(innerWidth,innerHeight,false);
  if(!view3d)fitPerformanceCamera();
  else{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
}
addEventListener('resize',resize);
if(window.visualViewport){visualViewport.addEventListener('resize',resize);visualViewport.addEventListener('scroll',resize);}
requestAnimationFrame(resize);
requestAnimationFrame(()=>{try{resize();rig.mesh.updateMatrixWorld(true);renderer.render(scene,camera)}catch(e){console.error('INITIAL RENDER',e)}});

let last=performance.now();lockHeadNow();
function tick(t){requestAnimationFrame(tick);let dt=Math.min(.025,Math.max(0,(t-last)/1000));last=t;updateExplorer(dt);worldStep(dt);updateMotorPrior(dt);support.position.x=locomotion.root.x;support.position.z=locomotion.root.z;support.position.y=groundYAt(locomotion.root.x,locomotion.root.z)+.003;updateDog(t,dt);updateExplorerCamera(dt); updateGame(dt);updateDataPlayback(dt);if(motionPlayer.active&&motionPlayer.mixer){motionPlayer.mixer.update(dt);enforceAnimationAnatomy();muscleFilterPose(dt);updateViz();const auxNow=performance.now();tick._auxAt??=0;if(!IS_TOUCH||auxNow-tick._auxAt>48){tick._auxAt=auxNow;updateDataBus();updateReadout()}renderer.render(scene,camera);return}
// Mobile renders every frame but solves the expensive collision-aware body at 40 Hz.
// This preserves responsive sticks/camera while cutting repeated IK/capsule work.
tick._solveAcc=(tick._solveAcc||0)+dt;if(IS_TOUCH&&tick._solveAcc<1/40){renderer.render(scene,camera);return}if(IS_TOUCH){dt=Math.min(.04,tick._solveAcc);tick._solveAcc=0}else tick._solveAcc=0;
relaxJoyBases(dt);const sm=1-Math.exp(-dt*5.5);motion.pitch=lerp(motion.pitch,motion.enabled?motion.targetPitch:0,sm);motion.roll=lerp(motion.roll,motion.enabled?motion.targetRoll:0,sm);const nd=Math.exp(-dt*8.5);motion.nudge.L.multiplyScalar(nd);motion.nudge.R.multiplyScalar(nd);motion.nudge.body.multiplyScalar(nd);const hs=1-Math.exp(-dt*(headCtl.pointer!=null?11.5:6.2));headDyn.x=lerp(headDyn.x,resistedAxis(headCtl.x,.05,2.0),hs);headDyn.y=lerp(headDyn.y,resistedAxis(headCtl.y,.05,2.0),hs);if(headCtl.pointer==null)headCtl.wind=lerp(headCtl.wind,0,1-Math.exp(-dt*4.1));headDyn.roll=lerp(headDyn.roll,resistedAxis(headCtl.wind,.02,1.7),1-Math.exp(-dt*5.4));headDyn.lead=lerp(headDyn.lead,headCtl.lead,1-Math.exp(-dt*(headCtl.pointer!=null?8.5:4.2)));headDyn.faceX=lerp(headDyn.faceX,headCtl.faceX,1-Math.exp(-dt*8.0));headDyn.faceY=lerp(headDyn.faceY,headCtl.faceY,1-Math.exp(-dt*8.0));limits.leftHand=limits.rightHand=limits.pelvis=limits.head=false;contacts.leftHand=contacts.rightHand=contacts.leftFoot=contacts.rightFoot=contacts.pelvis=false;let des=desiredTargets();updateWholeBodyLocomotion(des,dt);des=desiredTargets();const m=MODE[mode];const prevLH=dyn.leftHand.p.clone(),prevRH=dyn.rightHand.p.clone(),prevPel=dyn.pelvis.p.clone(),prevLF=dynFeet.left.p.clone(),prevRF=dynFeet.right.p.clone();spring(dyn.leftHand,des.leftHand,dt,m.freq*.82,Math.max(1.18,m.damp+.22),m.gravity);spring(dyn.rightHand,des.rightHand,dt,m.freq*.82,Math.max(1.18,m.damp+.22),m.gravity);spring(dyn.pelvis,des.pelvis,dt,m.freq+1.2,1.16,0);spring(dynFeet.left,des.leftFoot,dt,5.6,1.18,0);spring(dynFeet.right,des.rightFoot,dt,5.6,1.18,0);clampVecStep(dyn.leftHand.p,prevLH,0.88*dt);clampVecStep(dyn.rightHand.p,prevRH,0.88*dt);const travelSpeed=locomotion.walking>.08?Math.max(.9,explorer.speed):0;const pelvisStep=travelSpeed?Math.max(1.35,travelSpeed*1.18):.66,footStep=travelSpeed?Math.max(1.8,travelSpeed*1.65):.74;clampVecStep(dyn.pelvis.p,prevPel,pelvisStep*dt);clampVecStep(dynFeet.left.p,prevLF,footStep*dt);clampVecStep(dynFeet.right.p,prevRF,footStep*dt);clampVel(dyn.leftHand.v,1.45);clampVel(dyn.rightHand.v,1.45);clampVel(dyn.pelvis.v,travelSpeed?Math.max(1.6,travelSpeed*1.35):1.0);clampVel(dynFeet.left.v,travelSpeed?Math.max(2.0,travelSpeed*1.8):1.05);clampVel(dynFeet.right.v,travelSpeed?Math.max(2.0,travelSpeed*1.8):1.05);solveRig(des,dt);updateViz();tick._teleAt??=0;const teleNow=performance.now();if(!IS_TOUCH||teleNow-tick._teleAt>32){tick._teleAt=teleNow;updateControllerTelemetry()}tick._hapAt??=0;const hapNow=performance.now();if(!IS_TOUCH||!explorer.mobileNav||hapNow-tick._hapAt>66){tick._hapAt=hapNow;updateHaptics()}const auxNow=performance.now();tick._auxAt??=0;if(!IS_TOUCH||!explorer.mobileNav||auxNow-tick._auxAt>48){tick._auxAt=auxNow;updateDataBus();updateReadout()}renderer.render(scene,camera)}requestAnimationFrame(tick);


// ---------------------------------------------------------------------------
// ACTOR CONTRACTS — integration-ready views, not a second simulation.
// Terrarium/PLACE owns world surfaces and occupancy. Everybody owns articulation.
// ---------------------------------------------------------------------------
function heroTransform(){return{position:[locomotion.root.x,groundYAt(locomotion.root.x,locomotion.root.z),locomotion.root.z],heading:locomotion.heading}}
function heroIntent(){return{move:[explorer.move.x,explorer.move.y,explorer.move.z],speed:explorer.speed,run:explorer.run,look:[explorer.lookBodyYaw,explorer.lookBodyPitch],mode:instrumentMode.mode}}
const HERO_ACTOR={
  id:'hero.everybody',kind:'actor',species:'human',
  get transform(){return heroTransform()},
  get body(){return currentBodyFrame()},
  get pose(){return currentBodyFrame()},
  get contacts(){return{...contacts}},
  get intent(){return heroIntent()},
  controller:{travel:enterTravelMode,puppet:enterPuppetMode,reset:resetAll},
  sense(world){if(world)WORLD_BRIDGE.setPlace(world.place||world);return{surface:WORLD_BRIDGE.surfaceAt(locomotion.root.x,locomotion.root.z)}},
  step(dt,world){if(world)WORLD_BRIDGE.setPlace(world.place||world);return this.serialize()},
  interact(entity){return{actor:this.id,target:entity?.id||null,at:performance.now()}},
  serialize(){return{id:this.id,kind:this.kind,species:this.species,transform:this.transform,pose:currentBodyFrame(),intent:this.intent,contacts:{...contacts}}}
};
const ARGOS_ACTOR={
  id:'dog.argos',kind:'actor',species:'dog',
  get transform(){const d=argos.world.dog;return{position:[d[0],d[1],d[2]],heading:argos.loco.heading}},
  get state(){return argos.state},
  get perception(){return dogMind},
  api:argos,
  sense(world){if(world)WORLD_BRIDGE.setPlace(world.place||world);return{hero:HERO_ACTOR.transform,ball:argos.world.ball,bowl:argos.world.bowl}},
  step(dt){return argos.tick(dt)},
  serialize(){return{id:this.id,kind:this.kind,species:this.species,transform:this.transform,argos:argos.serialize()}},
  restore(rec){if(rec?.argos)argos.restore(rec.argos)}
};
const INTEGRATION={
  cartridge:'thunder-rigs.cartridge/v1',
  setPlace:place=>{WORLD_BRIDGE.setPlace(place);return INTEGRATION},
  surfaceAt:(x,z)=>WORLD_BRIDGE.surfaceAt(x,z),
  actors:{hero:HERO_ACTOR,dog:ARGOS_ACTOR},
  snapshot:()=>({format:'thunder-rigs.cartridge/v1',
    entities:[HERO_ACTOR.serialize(),ARGOS_ACTOR.serialize(),
      {id:'structure.ingold',kind:'structure',datum:DECK,door:DOOR,elements:EL.length},
      {id:'prop.ball',kind:'prop',state:ball.state,at:[ball.p.x,ball.p.y,ball.p.z],v:[ball.v.x,ball.v.y,ball.v.z]},
      {id:'prop.bowl',kind:'prop',food:bowl.food,meal:bowl.meal,at:[bowl.p.x,bowl.p.y,bowl.p.z]},
      ...FORGE.structures.map(st=>({kind:'fort',id:st.id,anchor:st.anchor,code:st.code}))],
    relations:[
      {from:'dog.argos',rel:'bonded-to',to:'hero.everybody'},
      {from:'hero.everybody',rel:'inhabits',to:'structure.ingold'},
      {from:'dog.argos',rel:'inhabits',to:'structure.ingold'},
      {from:'structure.ingold',rel:'stands-on',to:'place.hlidarendi'}]})
};

window.EVERYBODY={rig,mode:(m)=>{if(MODE[m])mode=m;return mode},head:(v)=>{if(v!==undefined)headLock=!!v;if(headLock)lockHeadNow();return headLock},tilt:setTiltEnabled,nudge:triggerNudge,atlas:{toggle:setAtlas,rebuild:()=>{atlas.built=false;buildReachAtlas();return atlas.group},sample:(x,y,z)=>{const p=new THREE.Vector3(x,y,z);rig.mesh.updateMatrixWorld(true);return{left:atlasClassify(p,rig.by.leftUpperArm.getWorldPosition(new THREE.Vector3())),right:atlasClassify(p,rig.by.rightUpperArm.getWorldPosition(new THREE.Vector3()))}}},game:{command:gameCommand,state:game},motion:{load:loadMotionFile,stop:stopMotion,state:motionPlayer},data:{bus:dataBus,push:(name,payload,opts)=>dataBus.push(name,payload,opts),pose:pushPoseData,poseWorldLandmarks,handWorldLandmarks,hands:pushHandData,face:pushFaceData,xr:pushXRData,playRecording:playDataRecording,snapshot:currentBodyFrame,record:on=>dataBus.record(on),download:name=>dataBus.download(name),setExternalWeight:w=>dataBus.setWeight(w),gamepad:(mode=true)=>dataBus.gamepadEnabled=mode,broadcast:name=>dataBus.connectBroadcast(name),websocket:url=>dataBus.connectWebSocket(url)},targets:{manual,dyn,dynFeet,pole,legCtl,headCtl,headDyn,effective,contacts,motion,locomotion},explorer,mobile:{touch:IS_TOUCH,move:explorer.touchMove,look:explorer.touchLook,setDeck:setDeckActive,travel:enterTravelMode,puppet:enterPuppetMode,instrument:instrumentMode},dog:{group:dogGroup,mind:dogMind,actor:ARGOS_ACTOR,api:argos},actor:HERO_ACTOR,integration:INTEGRATION,world:WORLD_BRIDGE,motor:{prior:motorPrior,load:loadMotorPrior},reset:resetAll};


// ============================================================================
// HLIDARENDI — persistence and boot. The success criterion is not that the
// meshes come back; it is that the inhabited situation comes back.
// ============================================================================
function saveWorld(){
  const rec={format:'hlidarendi.save/1',t:Date.now(),
    hero:{x:locomotion.root.x,z:locomotion.root.z,heading:locomotion.heading},
    argos:argos.serialize(),
    ball:{state:ball.state==='hero'?'free':ball.state,p:[ball.p.x,ball.p.y,ball.p.z],v:[ball.v.x,ball.v.y,ball.v.z]},
    bowl:{food:bowl.food,meal:bowl.meal},weather:WEATHER.current,
    forged:FORGE.structures.map(st=>({id:st.id,code:st.code,anchor:st.anchor})),
    cartridge:INTEGRATION.snapshot()};
  try{localStorage.setItem('hlidarendi.v1',JSON.stringify(rec));readout.textContent='SAVED · THE SITUATION KEEPS';buzz('save',[10,30,10],400);return true}
  catch(e){console.warn('save failed',e);readout.textContent='SAVE FAILED';return false}
}
function restoreWorld(){
  let rec=null;
  try{rec=JSON.parse(localStorage.getItem('hlidarendi.v1')||'null')}catch(e){return false}
  if(!rec||rec.format!=='hlidarendi.save/1')return false;
  try{
    argos.restore(rec.argos);
    if(rec.hero)placeHero(rec.hero.x,rec.hero.z,rec.hero.heading);
    if(rec.ball){ball.state=rec.ball.state;ball.p.set(...rec.ball.p);ball.v.set(...rec.ball.v);
      argos.world.carrying=ball.state==='dog'}
    if(rec.bowl){bowl.food=rec.bowl.food;bowl.meal=rec.bowl.meal}
    if(rec.weather)WEATHER.set(rec.weather);
    if(Array.isArray(rec.forged)){FORGE.clearAll();for(const st of rec.forged)FORGE.run(st.code,st.anchor,st.id)}
    readout.textContent='RESTORED · WELCOME HOME';
    return true;
  }catch(e){console.warn('restore failed',e);return false}
}
// ============================================================================
// SAY — language enters the world. This is the HELLO/WORLDTEXT seam from the
// Terrarium line: words are read, they land on the dog's mind as evidence
// (never as commands), and slash-verbs address the world. External builders
// (the III chat-to-build pipeline, an LLM, a peer) register handlers here
// instead of being wholesale ingested.
const chat={
  handlers:[],
  register(fn){if(typeof fn==='function')this.handlers.push(fn);return()=>{const i=this.handlers.indexOf(fn);if(i>=0)this.handlers.splice(i,1)}},
  line(who,text){
    const log=$('#chatLog');if(!log)return;
    const el=document.createElement('div');el.className='line '+who;el.textContent=text;
    log.appendChild(el);while(log.children.length>28)log.removeChild(log.firstChild);
    log.scrollTop=log.scrollHeight;
  },
  say(text){
    text=String(text||'').trim();if(!text)return null;
    chat.line('you',text);
    for(const h of chat.handlers){try{if(h(text)===true)return null}catch(e){console.warn('chat handler',e)}}
    if(text[0]==='/'){
      const cmd=text.slice(1).toLowerCase().split(/\s+/)[0];
      let r='nothing here answers to /'+cmd;
      if(cmd==='save')r=saveWorld()?'saved — the situation keeps':'save failed';
      else if(cmd==='reset'){resetAll();r='reset — home again'}
      else if(cmd==='feed')r=feedBowl()?'the bowl is full':'stand by the bowl first (or it is already full)';
      else if(cmd==='ball')r=ball.state==='hero'?(throwBall()?'thrown':'…'):(takeBall()?'you have the ball':'the ball is not at hand');
      else if(cmd==='door')r='door.entry — wall W, plan 72..108, the only way in';
      else if(cmd==='build'){const p2=text.slice(6).trim()||'cairn';buildFromWords(p2);r='forging "'+p2+'" on the land ahead…'}
      else if(cmd==='striker')r=STRIKER.toggle()?'STRIKER — first to score; run into the ball to kick; Argos plays for himself':'match over — '+STRIKER.score[0]+' : '+STRIKER.score[1];
      else if(cmd==='goto'){const m2=text.match(/goto\s+(-?[\d.]+)[ ,]+(-?[\d.]+)/);
        if(m2){r='calling on the landscape at '+m2[1]+', '+m2[2]+'…';gotoPlace(+m2[1],+m2[2]).then(()=>chat.line('world','the land answered — a new place stands under home')).catch(e=>chat.line('world','the network here is closed — Hlíðarendi stands ('+String(e.message||e).slice(0,50)+')'))}
        else r='say: /goto <lat> <lon>'}
      else if(cmd==='place'){const nm=text.slice(7).trim();
        if(nm){r='asking the atlas for "'+nm+'"…';
          LIVING_GROUND.geocode(nm).then(g=>{chat.line('world','found '+g.name.split(',')[0]+' — calling on the landscape…');return gotoPlace(g.lat,g.lon)})
            .then(()=>chat.line('world','a new place stands under home'))
            .catch(e=>chat.line('world','the atlas line is closed — '+String(e.message||e).slice(0,50)))}
        else r='say: /place <somewhere on earth>'}
      else if(cmd==='ai'){const k2=text.slice(4).trim();
        if(k2==='off'||!k2){try{localStorage.removeItem('hlidarendi.ai.key')}catch(e){}r='AI OFF — the agent uses stand-ins'}
        else{try{localStorage.setItem('hlidarendi.ai.key',k2)}catch(e){}r='agent line configured — /build speaks to Claude now'}window.__refreshAI?.()}
      else if(WEATHER.presets[cmd])r=WEATHER.set(cmd)?('the sky turns — '+cmd):'…';
      else if(cmd==='forget'){try{localStorage.removeItem('hlidarendi.v1')}catch(e){}r='forgotten — next visit starts fresh'}
      else if(cmd==='help')r='/build <words> /striker /place <name> /goto <lat> <lon> /ai <key|off> · /save /reset /feed /ball /door /forget · sky: /dawn /day /dusk /night /fog /rain';
      chat.line('world',r);updateWorldUI();return null;
    }
    let prog=null;
    try{prog=argos.say(text)}catch(e){console.warn(e)}
    if(prog){
      const biased=Object.keys(prog.prefer||{});
      chat.line('dog',prog.reading+(prog.cue?' · cue "'+prog.cue+'"':'')+(biased.length?' · leans '+biased.join(', '):''));
    }
    return prog;
  }
};
{
  const form=$('#chatForm'),input=$('#chatSay'),wrap=$('#chatWrap'),btn=$('#sayBtn');
  if(form&&input){form.addEventListener('submit',e=>{e.preventDefault();chat.say(input.value);input.value='';if(IS_TOUCH)input.blur()})}
  const setChat=on2=>{wrap?.classList.toggle('on',on2);btn?.classList.toggle('on',on2)};
  if(btn)btn.onclick=()=>setChat(!wrap.classList.contains('on'));
  setChat(!IS_TOUCH);
  chat.line('world','HLIÐARENDI — a body, a dog, a dwelling, a place. Speak, or /help.');
}
const on=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
on('#railToggle',()=>$('#rail')?.classList.toggle('open'));
if(IS_TOUCH)$('#rail')?.addEventListener('click',e=>{if(e.target.classList?.contains('rb'))setTimeout(()=>$('#rail')?.classList.remove('open'),150)});
// ---- the AGENT bar: words become structures through the forge
{
  const ag=$('#agentSay'),st2=$('#agentStatus');
  const refreshAI=()=>{let k=null;try{k=localStorage.getItem('hlidarendi.ai.key')}catch(e){}
    if(st2)st2.textContent=k?'● AI ON · claude-opus-5 · say /ai off to disconnect':'● AI OFF · stand-ins · say /ai <key> to connect'};
  refreshAI();window.__refreshAI=refreshAI;
  $('#agentForm')?.addEventListener('submit',e=>{
    e.preventDefault();const t=(ag?.value||'').trim();if(!t)return;ag.value='';
    chat.line('you','⚒ '+t);buildFromWords(t);if(IS_TOUCH)ag?.blur();
  });
  on('#buildBtn',()=>ag?.focus());
  on('#jumpBtn',()=>gameCommand('jump'));
  const bb2=$('#boostBtn');
  if(bb2){const dn=e=>{e.preventDefault();explorer.boostHold=true;bb2.classList.add('on')};
    const up=()=>{explorer.boostHold=false;bb2.classList.remove('on')};
    bb2.addEventListener('pointerdown',dn);bb2.addEventListener('pointerup',up);bb2.addEventListener('pointercancel',up);bb2.addEventListener('pointerleave',up)}
  on('#strikerBtn',()=>chat.say('/striker'));
  on('#aiBtn',()=>{const i=$('#chatSay');$('#chatWrap')?.classList.add('on');$('#sayBtn')?.classList.add('on');if(i){i.value='/ai ';i.focus()}});
  on('#worldBtn',()=>{const i=$('#chatSay');$('#chatWrap')?.classList.add('on');$('#sayBtn')?.classList.add('on');if(i){i.value='/goto 63.7422 -20.1080';if(!IS_TOUCH)i.focus()}});
  const SKYS=['day','dusk','night','fog','rain','dawn'];let skyI=0;
  on('#skyBtn',()=>{skyI=(skyI+1)%SKYS.length;WEATHER.set(SKYS[skyI]);chat.line('world','the sky turns — '+SKYS[skyI])});
}
on('#saveBtn',saveWorld);
on('#ballBtn',()=>{if(ball.state==='hero')throwBall();else takeBall();updateWorldUI()});
on('#feedBtn',()=>{feedBowl();updateWorldUI()});
// boot: hero wakes beside the trailer, on real ground, and the dog is nearby.
locomotion.root.y=groundYAt(locomotion.root.x,locomotion.root.z);
restoreWorld();
updateWorldUI();
dressWorld().then(t=>{chat.line('world','the living ground answered — '+t+' imagery tiles, ways and buildings · imagery © Esri · ways © OpenStreetMap');})
  .catch(e=>{chat.line('world','the imagery line is closed here — procedural moss stands ('+String(e.message||e).slice(0,40)+')')});
window.HLIDARENDI={
  place:PLACE,structure:PLACE.structure,door:DOOR,weather:WEATHER,
  view:{camera,controls},
  actors:{hero:HERO_ACTOR,dog:ARGOS_ACTOR},argos,
  props:{ball,bowl},
  integration:INTEGRATION,
  save:saveWorld,restore:restoreWorld,takeBall,throwBall,feedBowl,placeHero,chat,
  forge:FORGE,build:buildFromWords,striker:STRIKER,goto:gotoPlace,ground:LIVING_GROUND,dress:dressWorld,
  snapshot:()=>INTEGRATION.snapshot()
};
