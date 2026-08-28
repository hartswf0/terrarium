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
// the world's vertical datum is FIXED per land (set at boot and at /goto) so
// hauling the home never re-datums everything standing on the ground.
// THE GROUND IS ONE ARRAY, AND THE MESH IS ITS VIEW.
//
// The land you SEE is a triangle mesh. If the land you STAND on is a different
// function — a finer grid, a smoother interpolation, a pad blended live under
// a moving home — then the two disagree between the places they were checked,
// and a body standing on one is inside the other. On a hillside cut by gullies
// that gap is metres, and it is why a dog walking a hollow disappears into the
// drawn ground while every vertex-by-vertex test says the world is fine.
//
// So: ONE array, GROUND — the real hillside with the farmyard's levelled pad
// already baked into it — and ONE interpolation rule, the very triangles the
// renderer draws. The mesh is not an approximation of the ground; it IS the
// ground, and terrainH() reads the same triangle the eye is looking at.
// THE PAD IS A PLACE, NOT A PASSENGER: it belongs to the site the home was
// last set DOWN on, and it is re-baked with the mesh when the home lands.
const PAD={datum:0,x:TR.x,z:TR.z,h:0};
let GROUND=null;
function bakeGround(){
  const n=TERRAIN.n,res=TERRAIN.res;
  if(!GROUND||GROUND.length!==n*n)GROUND=new Float32Array(n*n);
  for(let j=0;j<n;j++){
    const z=(j-TERRAIN.cy)*res, rz=Math.max(0,Math.abs(z-PAD.z)-6.5);
    for(let i=0;i<n;i++){
      const x=(i-TERRAIN.cx)*res, rx=Math.max(0,Math.abs(x-PAD.x)-5.0);
      const r=Math.hypot(rx,rz),t=clamp(r/8.0,0,1),mask=t*t*(3-2*t);
      GROUND[j*n+i]=PAD.h*(1-mask)+TG[j*n+i]*mask-PAD.datum;
    }
  }
}
// three's PlaneGeometry splits every quad on the diagonal from (i,j+1) to
// (i+1,j). Reading the SAME triangle is what makes seen and felt identical.
function terrainH(x,z){
  const n=TERRAIN.n;
  const gi=clamp(TERRAIN.cx+x/TERRAIN.res,0,n-1.0001),gj=clamp(TERRAIN.cy+z/TERRAIN.res,0,n-1.0001);
  const i0=Math.floor(gi),j0=Math.floor(gj),fx=gi-i0,fz=gj-j0;
  const h00=GROUND[j0*n+i0],h10=GROUND[j0*n+i0+1],h01=GROUND[(j0+1)*n+i0],h11=GROUND[(j0+1)*n+i0+1];
  return fx+fz<=1 ? h00+fx*(h10-h00)+fz*(h01-h00)
                  : h11+(1-fx)*(h01-h11)+(1-fz)*(h10-h11);
}
function setPad(x,z){PAD.x=x;PAD.z=z;PAD.h=rawTerrain(x,z);bakeGround()}
PAD.datum=rawTerrain(TR.x,TR.z);setPad(TR.x,TR.z);
// STRUCTURE — the element table lives in src/elements.js: ONE authority for the
// standalone page and the thunder-rigs cartridge alike.
const DOOR={id:DOOR_PLAN.id,wall:DOOR_PLAN.wall,from:DOOR_PLAN.from,to:DOOR_PLAN.to,
  x:px2w(0),z0:py2w(DOOR_PLAN.from),z1:py2w(DOOR_PLAN.to)};
// world-space boxes derived ONCE from the same element list that is rendered
const SOLIDS=EL.map(e=>({id:e.id,kind:e.kind,
  min:[Math.min(px2w(e.x0),px2w(e.x1)),e.z0*IN,Math.min(py2w(e.y0),py2w(e.y1))],
  max:[Math.max(px2w(e.x0),px2w(e.x1)),e.z1*IN,Math.max(py2w(e.y0),py2w(e.y1))]}));
for(const b of SOLIDS){b.climb=false;b.trailer=true} // furniture blocks; the floor is the floor
// A RIG DOES NOT COLLIDE WITH ITS OWN LOAD. While the home is hitched it
// travels WITH the rig, so its boxes must not shove the thing towing them —
// that feedback (drag the load into the cab, get pushed, get kicked) is what
// spins a tow rig out. The load stays solid for everyone else, always.
const TOW={skip:false};
// THE HOME HAS A BEARING. Its boxes live in the HOME'S OWN FRAME and never
// move; every query crosses into that frame and back. Rotation therefore costs
// nothing in accuracy — a circle is round in any frame, so the same exact
// axis-aligned test serves a home standing square or a home swung in behind a
// rig. This is what lets the load follow the tongue instead of crabbing.
const HOME_B=SOLIDS.filter(s=>s.kind==='wall'||s.kind==='glass'||s.kind==='fixture'||s.kind==='frame');
const TOPS=SOLIDS.filter(s=>s.kind==='step');
const BLOCKERS=[];                         // world-frame occupancy: OSM, forged builds
const TR0={x:TR.x,z:TR.z};
const DOOR0={x:DOOR.x,z0:DOOR.z0,z1:DOOR.z1};
const TRAILER={ox:0,oz:0,oy:0,yaw:0,cos:1,sin:0,pitch:0,roll:0,moveBowl:null,pivot:null};
// ONE HANDEDNESS. These transforms and the renderer's own rotation.y must be
// the SAME rotation — three maps a local +z to (sin y, cos y), so these do too.
// They used to be each other's mirror, and the frame was made self-consistent
// by STORING a mirrored yaw: collisions were then right in their own mirrored
// world while the drawn home swung the opposite way on every turn, by twice
// the hitch angle. That is what "the trailer jackknifes" looked like, and why
// the home met walls it was not touching. Seen home and felt home are now the
// same home at every bearing.
function homeOf(x,z){                      // world → the home's frame
  const dx=x-TR.x,dz=z-TR.z,c=TRAILER.cos,sn=TRAILER.sin;
  return{x:TR0.x+dx*c-dz*sn, z:TR0.z+dx*sn+dz*c};
}
function worldOf(hx,hz){                   // the home's frame → world
  const dx=hx-TR0.x,dz=hz-TR0.z,c=TRAILER.cos,sn=TRAILER.sin;
  return{x:TR.x+dx*c+dz*sn, z:TR.z-dx*sn+dz*c};
}
function worldDir(hx,hz){const c=TRAILER.cos,sn=TRAILER.sin;return{x:hx*c+hz*sn,z:-hx*sn+hz*c}}
function applyTrailerOffset(ox,oz,oy,yaw,pitch,roll){
  TRAILER.ox=ox;TRAILER.oz=oz;TRAILER.oy=oy;
  if(yaw!=null){TRAILER.yaw=yaw;TRAILER.cos=Math.cos(yaw);TRAILER.sin=Math.sin(yaw)}
  TRAILER.pitch=pitch||0;TRAILER.roll=roll||0;   // level on its jacks, leaning on the road
  TR.x=TR0.x+ox;TR.z=TR0.z+oz;
  if(TRAILER.pivot){TRAILER.pivot.position.set(TR.x,oy,TR.z);
    TRAILER.pivot.rotation.set(0,TRAILER.yaw,0);
    TRAILER.pivot.rotateX(TRAILER.pitch);TRAILER.pivot.rotateZ(TRAILER.roll)}
  const dm=worldOf(DOOR0.x,(DOOR0.z0+DOOR0.z1)/2),half=(DOOR0.z1-DOOR0.z0)/2;
  DOOR.x=dm.x;DOOR.z0=dm.z-half;DOOR.z1=dm.z+half;   // world convenience for radius checks
  if(TRAILER.moveBowl)TRAILER.moveBowl();
}
function trailerHitchWorld(){return worldOf(TR0.x,TR0.z-3.05)}   // the north tongue
function structSurface(x,z,forDog){
  const h=homeOf(x,z);
  const px=(h.x-TR0.x)/IN+50.5,py=(h.z-TR0.z)/IN+120;
  let base=null;
  if(px>WT&&px<96.5&&py>4.5&&py<235.5)base=DECK+TRAILER.oy;
  else if(px>-0.5&&px<=WT&&py>72&&py<108)base=DECK+TRAILER.oy; // door.entry threshold: the sill is part of the floor
  else for(const t of TOPS)if(h.x>=t.min[0]&&h.x<=t.max[0]&&h.z>=t.min[2]&&h.z<=t.max[2]){base=t.max[1]+TRAILER.oy;break}
  return base;
}
const PLACE={
  id:'place.hlidarendi',
  ground:{
    heightAt(x,z){const s=structSurface(x,z);return s!=null?s:terrainH(x,z)},
    heightAtDog(x,z){const s=structSurface(x,z,true);return s!=null?s:terrainH(x,z)},
    // wide enough to cross a facet: a normal read inside one triangle is a
    // step function, and a rig climbing on it would twitch at every edge
    normalAt(x,z){const d=1.1,h=this.heightAt,dx=(h(x+d,z)-h(x-d,z))/(2*d),dz=(h(x,z+d)-h(x,z-d))/(2*d),l=Math.hypot(dx,1,dz);return[-dx/l,1/l,-dz/l]}
  },
  heightAt(x,z){return this.ground.heightAt(x,z)},
  surfaceAt(x,z){return{y:this.ground.heightAt(x,z),normal:this.ground.normalAt(x,z)}},
  door:DOOR, solids:SOLIDS, structure:{id:'structure.ingold',datum:DECK,elements:EL,door:DOOR},
  // circle-vs-box occupancy in a height band; used by the hero root, foot
  // anchors and the ball — same boxes the renderer draws.
  _pushList(list,v,r,y0,y1,out,skipClimb){
    for(const b of list){
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
  pushOutCircle(v,r,y0,y1,out,skipClimb){
    this._pushList(BLOCKERS,v,r,y0,y1,out,skipClimb);
    if(!TOW.skip){                                   // the home, asked in its own frame
      const h=homeOf(v.x,v.z),hv={x:h.x,z:h.z};
      const o2=out?{hit:false,x:0,z:0,id:null}:null;
      this._pushList(HOME_B,hv,r,y0-TRAILER.oy,y1-TRAILER.oy,o2,skipClimb);
      if(hv.x!==h.x||hv.z!==h.z){const w=worldOf(hv.x,hv.z);v.x=w.x;v.z=w.z}
      if(o2&&o2.hit&&out){const d=worldDir(o2.x,o2.z);out.x=d.x;out.z=d.z;out.hit=true;out.id=o2.id}
    }
    return v;
  },
  dogWalkable(x,z){
    const gy=this.heightAt(x,z),y0=gy+.05,y1=gy+.62;
    for(const b of BLOCKERS){
      if(b.max[1]<y0||b.min[1]>y1)continue;
      if(x>b.min[0]-.14&&x<b.max[0]+.14&&z>b.min[2]-.14&&z<b.max[2]+.14)return false;
    }
    const h=homeOf(x,z),h0=y0-TRAILER.oy,h1=y1-TRAILER.oy;
    for(const b of HOME_B){
      if(b.max[1]<h0||b.min[1]>h1)continue;
      if(h.x>b.min[0]-.14&&h.x<b.max[0]+.14&&h.z>b.min[2]-.14&&h.z<b.max[2]+.14)return false;
    }
    return true;
  },
  // wall capsules for the hand/foot collision solver: derived from the SAME
  // boxes, only near the query point, stacked in the actor's height band.
  wallCapsulesNear(p,range){
    const caps=[],h=homeOf(p.x,p.z);
    const gather=(list,local)=>{
      const qx=local?h.x:p.x,qz=local?h.z:p.z,dy=local?TRAILER.oy:0;
      for(const b of list){
        const ex=b.max[0]-b.min[0],ez=b.max[2]-b.min[2];
        if(Math.min(ex,ez)>0.35)continue;   // thin solids only: walls and glass, never furniture slabs
        const cx=clamp(qx,b.min[0],b.max[0]),cz=clamp(qz,b.min[2],b.max[2]);
        if(Math.hypot(qx-cx,qz-cz)>range)continue;
        const longX=ex>=ez;
        const r=Math.min((longX?ez:ex)/2+.012,.14), y0=Math.min(b.min[1]+r,b.max[1]),y1=Math.max(y0,b.max[1]-r);
        const n=Math.min(3,Math.max(1,Math.round((y1-y0)/.5)+1));
        for(let i=0;i<n;i++){
          const y=n===1?(y0+y1)/2:y0+(y1-y0)*i/(n-1);
          const ax=longX?b.min[0]+r:(b.min[0]+b.max[0])/2, az=longX?(b.min[2]+b.max[2])/2:b.min[2]+r;
          const bx=longX?b.max[0]-r:(b.min[0]+b.max[0])/2, bz=longX?(b.min[2]+b.max[2])/2:b.max[2]-r;
          const A=local?worldOf(ax,az):{x:ax,z:az}, Bp=local?worldOf(bx,bz):{x:bx,z:bz};
          caps.push({name:b.id,a:new THREE.Vector3(A.x,y+dy,A.z),b:new THREE.Vector3(Bp.x,y+dy,Bp.z),r});
        }
      }
    };
    gather(BLOCKERS,false);
    gather(HOME_B,true);
    return caps;
  },
  query(kind,payload){
    if(kind==='door')return DOOR;
    if(kind==='structure')return this.structure;
    return null;
  }
};
WORLD_BRIDGE.setPlace(PLACE);
// ══ CONTACT — ONE GROUND, ASKED ONCE ═════════════════════════════════════
// NEVER SOLVE THE SAME PHYSICAL QUESTION TWICE. Four bodies stand on this
// hillside — hero, dog, rig, home — and each of them used to answer "where is
// the ground" in its own way: a centre sample here, a four-wheel average
// there, one single point under a six-metre house. Four answers to one
// question is precisely what "everything goes through the ground" feels
// like. There is one module now, and every body asks it.
//
// A BODY HAS EXTENT. One sample under the centre buries whatever half of the
// body is uphill, and an AVERAGE of four samples sinks the middle of the
// chassis into every crest it crosses. So a body poses against its own
// FOOTPRINT: the plane through its contacts gives pitch and roll, then the
// whole plane is lifted until NO contact is under the land. Nothing is ever
// inside the hill. The cost is a downhill wheel or paw riding light on steep
// ground, which is the honest geometry of a rigid body on a slope.
const CONTACT={
  ground(x,z){return terrainH(x,z)},                  // bare land
  height(x,z){return PLACE.ground.heightAt(x,z)},     // land, or the structure over it
  dogHeight(x,z){return PLACE.ground.heightAtDog(x,z)},
  // highest ground the footprint spans — for bodies posed level (a dog, a home on jacks)
  crest(f,x,z,yaw,hl,hw){
    const dx=Math.sin(yaw),dz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw);
    return Math.max(f(x,z),
      f(x+dx*hl,z+dz*hl),f(x-dx*hl,z-dz*hl),
      f(x+sx*hw,z+sz*hw),f(x-sx*hw,z-sz*hw));
  },
  // pose a rigid body of half-length hl, half-width hw: {y,pitch,roll}, where
  // y is the height at which no contact penetrates. tilt damps the lean.
  pose(f,x,z,yaw,hl,hw,tilt){
    const dx=Math.sin(yaw),dz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw);
    const hF=f(x+dx*hl,z+dz*hl),hB=f(x-dx*hl,z-dz*hl);
    const hL=f(x+sx*hw,z+sz*hw),hR=f(x-sx*hw,z-sz*hw);
    const k=tilt==null?.85:tilt;
    // local +z is the nose, local +x the L sample: rotateX lowers the nose by
    // hl·sin(pitch), rotateZ raises the L side by hw·sin(roll)
    const pitch=Math.atan2(hB-hF,2*hl)*k, roll=Math.atan2(hL-hR,2*hw)*k;
    const oF=-Math.sin(pitch)*hl,oB=Math.sin(pitch)*hl,oL=Math.sin(roll)*hw,oR=-Math.sin(roll)*hw;
    const y=Math.max(f(x,z),hF-oF,hB-oB,hL-oL,hR-oR);
    return{y,pitch,roll};
  },
  // apply a pose to a three.js group in the one order every body uses
  place(g,p,x,z,yaw,lift){
    g.position.set(x,p.y+(lift||0),z);
    g.rotation.set(0,yaw,0);
    g.rotateX(p.pitch);g.rotateZ(p.roll);
  }
};
// ---- terrain + structure views (meshes are views of world state, not authorities)
const worldGroup=new THREE.Group();scene.add(worldGroup);
let terrainMesh=null;
function buildTerrainMesh(){
  let keepMap=null;
  if(terrainMesh){keepMap=terrainMesh.material.map||null;worldGroup.remove(terrainMesh);terrainMesh.geometry.dispose();terrainMesh.material.dispose()}
  // ONE VERTEX PER HEIGHT. The plane's grid is the ground's grid — vertex
  // (ix,iy) lands exactly on node (ix,iy) — so the drawn surface is the same
  // piecewise-linear field terrainH() reads. Nothing is resampled, nothing
  // is approximated, and nothing can walk between the two.
  const NG=TERRAIN.n,N=NG-1,SZ=N*TERRAIN.res,g=new THREE.PlaneGeometry(SZ,SZ,N,N);g.rotateX(-Math.PI/2);
  const cxOff=SZ/2-TERRAIN.cx*TERRAIN.res,czOff=SZ/2-TERRAIN.cy*TERRAIN.res;
  g.translate(cxOff,0,czOff);
  const pos=g.attributes.position,col=[];
  const jit=(x,z)=>{const v=Math.sin(x*12.9898+z*78.233)*43758.5453;return v-Math.floor(v)};
  const at=(i,j)=>GROUND[clamp(j,0,NG-1)*NG+clamp(i,0,NG-1)];
  for(let i=0;i<pos.count;i++){
    const ix=i%NG,iy=(i/NG)|0;
    const x=pos.getX(i),z=pos.getZ(i),h=at(ix,iy);pos.setY(i,h);
    const d=TERRAIN.res,sl=Math.hypot(at(ix+1,iy)-at(ix-1,iy),at(ix,iy+1)-at(ix,iy-1))/(2*d);
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
  // a reshaped ground keeps its dressing: same land, same window, same texture
  if(keepMap&&buildTerrainMesh._keepDress){const m=terrainMesh.material;m.map=keepMap;m.vertexColors=false;m.color.set(0xffffff);m.needsUpdate=true}
  buildTerrainMesh._keepDress=false;
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
const trailerPivot=new THREE.Group();trailerPivot.name='STRUCTURE.INGOLD';worldGroup.add(trailerPivot);
// the members are drawn in the home's own frame; the pivot carries and turns them
const trailerGroup=new THREE.Group();trailerGroup.position.set(-TR0.x,0,-TR0.z);trailerPivot.add(trailerGroup);
TRAILER.pivot=trailerPivot;applyTrailerOffset(0,0,0,0);
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
    trailerGroup.add(mesh);
    structMeshes.push({box:Object.assign({kind:grp==='in'?'interior':'wall'},gAABB[grp]),grp,mesh,baseOpacity:material.opacity});
  }
  // the steps are HLIDARENDI's own addition (EL) — the way in, rendered too
  for(const b of SOLIDS){
    if(b.kind!=='step')continue;
    const g=new THREE.BoxGeometry(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]);
    const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xb8ab91,roughness:.95}));
    mesh.position.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);
    trailerGroup.add(mesh);
  }
}
// walls between the camera and the hero become see-through; same elements, one truth
function updateStructFade(){
  const hero=locomotion.root;
  const hh=homeOf(hero.x,hero.z),hc=homeOf(camera.position.x,camera.position.z);
  const cx=hc.x,cz=hc.z,hx=hh.x,hz=hh.z,hy=hero.y-TRAILER.oy;
  const home=insideShell(hero.x,hero.z);
  for(const s of structMeshes){
    let block=false;
    if(s.grp==='roof'){block=home}
    else if(home&&s.grp!=='in'){block=true}
    else if(s.grp!=='in'&&s.box.max[1]>hy+.9){
      for(let t=.12;t<.97;t+=.12){
        const x=lerp(cx,hx,t),z=lerp(cz,hz,t);
        if(x>s.box.min[0]-.08&&x<s.box.max[0]+.08&&z>s.box.min[2]-.08&&z<s.box.max[2]+.08){
          const y=lerp(camera.position.y-TRAILER.oy,hy+1.1,t);
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
  beacon:"function build(w,WG,THREE){var st=WG.matte(0x8a8880,.95);var b=WG.box(1,.5,1,st);WG.put(b,0,.25,0);WG.solid(b,1,.5,1);var p=WG.cyl(.09,2.6,WG.matte(0x8b7355,.9));WG.put(p,0,1.8,0);WG.solid(p,.2,2.6,.2);var l=WG.sphere(.22,WG.lit(0xffd75e,1.4));WG.put(l,0,3.2,0);return w}",
  trailer:"function build(w,WG,THREE){var sd=WG.matte(0xd8d5cc,.9),wd=WG.matte(0x8b7355,.9),mt=WG.matte(0x9aa0a4,.6),dk=WG.matte(0x1e2226,.9);var f=WG.box(2.6,.22,6.2,wd);WG.put(f,0,.5,0);WG.solid(f,2.6,.22,6.2);var wl=WG.box(.14,2.2,6.2,sd);WG.put(wl,-1.23,1.71,0);WG.solid(wl,.14,2.2,6.2);var wr1=WG.box(.14,2.2,2.4,sd);WG.put(wr1,1.23,1.71,-1.9);WG.solid(wr1,.14,2.2,2.4);var wr2=WG.box(.14,2.2,2.4,sd);WG.put(wr2,1.23,1.71,1.9);WG.solid(wr2,.14,2.2,2.4);var wf=WG.box(2.6,2.2,.14,sd);WG.put(wf,0,1.71,-3.03);WG.solid(wf,2.6,2.2,.14);var wb=WG.box(2.6,2.2,.14,sd);WG.put(wb,0,1.71,3.03);WG.solid(wb,2.6,2.2,.14);var li=WG.box(.14,.5,1.4,sd);WG.put(li,1.23,2.56,0);var r=WG.box(2.9,.12,6.6,mt);WG.put(r,0,2.92,0);WG.solid(r,2.9,.12,6.6);var w1=WG.box(.3,.8,.8,dk);WG.put(w1,-1.35,.4,1.6);var w2=WG.box(.3,.8,.8,dk);WG.put(w2,1.35,.4,1.6);var s1=WG.box(1.1,.18,.5,wd);WG.put(s1,1.75,.32,0);WG.solid(s1,1.1,.18,.5);return w}"
};
function standinFor(prompt){
  const p=String(prompt||'').toLowerCase();
  for(const k of Object.keys(STANDINS))if(p.includes(k))return k;
  if(/caravan|home|cabin|hut|shed|house|dwell/.test(p))return 'trailer';
  if(/wall|fence|fold|pen/.test(p))return 'sheepfold';
  if(/gate|arch|door/.test(p))return 'gate';
  if(/tower|watch|fort|keep/.test(p))return 'tower';
  if(/light|lamp|fire|beacon|star/.test(p))return 'beacon';
  return 'cairn';
}
// ══ THE AGENT LINE — one place the world talks to a model ════════════════
// A key typed into a chat command is not a setting, and a model that can only
// forge a cairn is not an agent. AI is the single seam: where the line goes,
// which dialect it speaks, which model answers — and every call in the page
// goes through AI.ask, so there is exactly one thing to configure and one
// thing to blame when it fails.
const AI={
  key:'',model:'claude-opus-5',base:'https://api.anthropic.com/v1/messages',dialect:'anthropic',
  load(){
    try{
      const raw=localStorage.getItem('hlidarendi.ai');
      if(raw)Object.assign(this,JSON.parse(raw));
      else{const k=localStorage.getItem('hlidarendi.ai.key');if(k)this.key=k}  // the old one-line key
    }catch(e){}
    if(!this.base)this.base='https://api.anthropic.com/v1/messages';
    if(!this.model)this.model='claude-opus-5';
    return this;
  },
  save(){try{localStorage.setItem('hlidarendi.ai',JSON.stringify(
    {key:this.key,model:this.model,base:this.base,dialect:this.dialect}));
    localStorage.removeItem('hlidarendi.ai.key')}catch(e){}return this},
  // DISCONNECT means disconnected: a custom endpoint counts as a line whether
  // or not a key was typed, so clearing the key alone would leave it open
  off(){this.key='';this.base='https://api.anthropic.com/v1/messages';this.dialect='anthropic';
    try{localStorage.removeItem('hlidarendi.ai');localStorage.removeItem('hlidarendi.ai.key')}catch(e){}},
  // a proxy may hold the key itself, so a custom endpoint counts as connected
  on(){return !!this.key||(this.dialect!=='anthropic'&&!!this.base)},
  headers(){
    const h={'content-type':'application/json'};
    if(this.dialect==='openai'){if(this.key)h['authorization']='Bearer '+this.key}
    else{if(this.key)h['x-api-key']=this.key;h['anthropic-version']='2023-06-01';
      if(this.dialect==='anthropic')h['anthropic-dangerous-direct-browser-access']='true'}
    return h;
  },
  body(system,user,maxTok){
    if(this.dialect==='openai')return{model:this.model,max_tokens:maxTok,
      messages:[{role:'system',content:system},{role:'user',content:user}]};
    return{model:this.model,max_tokens:maxTok,system,messages:[{role:'user',content:user}]};
  },
  // both shapes come home as plain text: an Anthropic content array or an
  // OpenAI choice. A gateway that answers either one works here unchanged.
  text(j){
    if(Array.isArray(j?.content))return j.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
    const c=j?.choices?.[0]?.message?.content;
    if(typeof c==='string')return c;
    if(Array.isArray(c))return c.map(b=>b.text||'').join('\n');
    return '';
  },
  async ask(system,user,maxTok){
    if(!this.on())throw new Error('no agent line — open AI and connect one');
    let r;
    try{r=await fetch(this.base,{method:'POST',headers:this.headers(),body:JSON.stringify(this.body(system,user,maxTok||1500))})}
    catch(e){throw new Error('the line did not open (network or CORS) — '+String(e.message||e).slice(0,80))}
    if(!r.ok){
      let d='';try{d=(await r.text()).slice(0,180)}catch(e){}
      throw new Error('HTTP '+r.status+(d?' — '+d:''));
    }
    const t=this.text(await r.json());
    if(!t)throw new Error('the model answered with nothing this page could read');
    return t;
  },
  async test(){
    const t=await this.ask('Reply with exactly: HLIDARENDI','say the word',32);
    return t.trim().slice(0,60);
  }
}.load();
const FORGE_SYS='You are a structure builder for HLIDARENDI, a small standing world. Reply with ONLY one JavaScript function, no fences, no prose:\nfunction build(w, WG, THREE){ ... return w; }\nOne focal structure at the origin. Vocabulary: WG.box(w,h,d,mat) WG.cyl(r,h,mat) WG.cone(r,h,mat) WG.sphere(r,mat) WG.torus(r,t,mat); materials WG.flat(hex,{rough,metal}) WG.matte(hex,rough) WG.lit(hex,intensity); WG.put(mesh,x,y,z,ry) places (y=0 is the ground); WG.solid(mesh,w,h,d) makes it collide; WG.rand(seed) for randomness. Under 60 meshes; every part within 12 units of the origin; scale in metres (a person is 1.7 tall).\nIf asked for a DWELLING (trailer, caravan, cabin, hut, shed): build it hollow and enterable — a raised floor about 0.4 high, four walls about 2.2 tall with a GAP at least 0.9 wide left in one wall for a door, a roof, and a step outside the gap. Make the walls thin (0.12-0.16) and WG.solid only the walls, floor and step, never the doorway.';
async function askForgeAI(prompt){
  if(!AI.on())return null;
  const text=await AI.ask(FORGE_SYS,'Design for: "'+String(prompt).slice(0,200)+'"',3000);
  const m=text.match(/function\s+build\s*\([\s\S]*\}/);
  return m?m[0]:null;
}
// ── THE WORLD AGENT ───────────────────────────────────────────────────────
// The forge only ever made statues. An agent that can see this world and act
// in it does so through the SAME doors a person uses — the slash commands and
// buttons that already exist — so it can do nothing you could not do yourself,
// and every one of its acts is a line in the log you can read afterwards.
const AGENT_ACTS={
  say:{n:'say',d:'a line spoken into the world log'},
  dog:{n:'dog',d:'words spoken TO ARGOS — he decides for himself whether to heed them'},
  build:{n:'build',d:'forge a structure or a rig from words, on the land ahead'},
  weather:{n:'weather',d:'dawn|day|dusk|night|fog|rain'},
  place:{n:'place',d:'travel: a place name anywhere on earth'},
  goto:{n:'goto',d:'travel: "lat lon"'},
  game:{n:'game',d:'striker|golf|ctf'},
  feed:{n:'feed',d:'fill the bowl, or hand-feed him if he is close'},
  ball:{n:'ball',d:'take or throw the ball'},
  stone:{n:'stone',d:'throw a stone'},
  hitch:{n:'hitch',d:'couple the rig to the home'},
  drop:{n:'drop',d:'set the home down here'},
  live:{n:'live',d:'read the live conditions on this land'},
  deed:{n:'deed',d:'keep a deed to this land under a name'}
};
function agentSystem(){
  const acts=Object.values(AGENT_ACTS).map(a=>a.n+' — '+a.d).join('\n');
  return 'You are the standing world of HLIÐARENDI, in Fljótshlíð, Iceland: a body (the walker), '+
  'a dog (ARGOS, who has his own mind and is never commanded, only spoken to), a dwelling (the Ingold '+
  'trailer, which can be hitched to a rig and hauled), and a place (real baked elevation, real imagery, '+
  'real quakes and aircraft overhead).\n'+
  'A human sentence reaches you as EVIDENCE about what they want, never as a command over the dog.\n'+
  'Reply with ONLY a JSON object, no fences, no prose outside it:\n'+
  '{"line":"one or two sentences in the world\'s voice — plain, concrete, never chirpy",'+
  '"do":[{"a":"<action>","p":"<argument>"}]}\n'+
  'Actions:\n'+acts+'\n'+
  'Use at most three actions. Use none at all if the sentence only wants an answer — the line alone is '+
  'a fine reply. Never invent an action name. Never claim to have done something you did not put in "do".';
}
function agentWorldState(){
  const d=argos.world.dog,r=locomotion.root,iv=argos.mind.iv||{};
  const geo=TERRAIN.geo?TERRAIN.geo.lat.toFixed(4)+', '+TERRAIN.geo.lon.toFixed(4):'Hlíðarendi (baked)';
  return JSON.stringify({
    land:geo, sky:WEATHER.current||'day',
    walker:{at:[+r.x.toFixed(1),+r.z.toFixed(1)],driving:!!TRUCK.on},
    rig:{at:[+TRUCK.x.toFixed(1),+TRUCK.z.toFixed(1)],hitched:!!TRUCK.hitched},
    home:{at:[+TR.x.toFixed(1),+TR.z.toFixed(1)]},
    argos:{at:[+d[0].toFixed(1),+d[2].toFixed(1)],doing:argos.state?.winner||'—',
      away:+Math.hypot(d[0]-r.x,d[2]-r.z).toFixed(1),
      hunger:+(iv.hunger||0).toFixed(2),thirst:+(iv.thirst||0).toFixed(2),
      fatigue:+(iv.fatigue||0).toFixed(2),happiness:+(iv.happiness||0).toFixed(2),
      carrying:!!argos.world.carrying},
    ball:ball.state, bowl:bowl.food?'filled':'empty', bond:+BOND.v.toFixed(2),
    built:FORGE.structures.length
  });
}
function agentDo(a,p){
  const t=String(p==null?'':p).trim();
  switch(a){
    case 'say':chat.line('world',t||'…');return 'said';
    case 'dog':{let prog=null;try{prog=argos.say(t)}catch(e){}
      chat.line('you','“'+t+'”');
      if(prog)chat.line('dog',prog.reading+(prog.cue?' · cue "'+prog.cue+'"':''));
      return 'spoke to argos';}
    case 'build':buildFromWords(t||'a cairn');return 'forging "'+(t||'a cairn')+'"';
    case 'weather':return WEATHER.set(t)?('the sky turns — '+t):'that sky is not one of this world\'s';
    case 'place':chat.say('/place '+t);return 'calling on '+t;
    case 'goto':chat.say('/goto '+t);return 'calling on '+t;
    case 'game':{const g=t.toLowerCase();
      if(g.startsWith('str')){STRIKER.toggle();return 'striker'}
      chat.say('/'+(g==='ctf'?'ctf':'golf'));return g;}
    case 'feed':return feedBowl()?'fed':'nothing to feed with from here';
    case 'ball':return (takeBall()||throwBall())?'the ball moves':'the ball is out of reach';
    case 'stone':return throwStone()?'a stone flies':'no stone thrown';
    case 'hitch':return hitchTrailer()?'hitched':'the rig is not at the tongue';
    case 'drop':unhitchTrailer();return 'the home stands here';
    case 'live':LIVE.refresh?.();return 'reading the land';
    case 'deed':chat.say('/deed '+(t||'this land'));return 'deed kept';
  }
  return null;
}
async function askAgent(text){
  chat.line('you','🗲 '+text);
  if(!AI.on()){
    chat.line('world','no agent line — open AI in the menu and connect one. Meanwhile the forge still answers: try “a watchtower”.');
    return false;
  }
  chat.line('world','…');
  const wait=$('#chatLog')?.lastElementChild;
  let out;
  try{out=await AI.ask(agentSystem(),'WORLD: '+agentWorldState()+'\n\nTHEY SAY: '+String(text).slice(0,600),1200)}
  catch(e){if(wait)wait.remove();chat.line('world','the agent line failed — '+String(e.message||e).slice(0,140));return false}
  if(wait)wait.remove();
  let j=null;
  try{const m=out.match(/\{[\s\S]*\}/);j=JSON.parse(m?m[0]:out)}catch(e){}
  if(!j){chat.line('world',out.slice(0,300));return true}
  if(j.line)chat.line('world',String(j.line).slice(0,400));
  const acts=Array.isArray(j.do)?j.do.slice(0,3):[];
  for(const it of acts){
    const a=String(it&&it.a||'').toLowerCase();
    if(!AGENT_ACTS[a]){chat.line('world','(the agent asked for “'+a+'”, which this world has no door for)');continue}
    let r=null;try{r=agentDo(a,it.p)}catch(e){r='that act failed — '+String(e.message||e).slice(0,60)}
    if(r)chat.line('world','▸ '+r);
  }
  updateWorldUI();
  return true;
}
async function buildFromWords(prompt){
  // a vehicle is not a statue: ask for one and a DRIVABLE rig rolls off the
  // line — or, at the wheel (or beside it), the words RESHAPE the rig itself,
  // the way the standing world's HELLO line does
  if(/\b(car|truck|rig|vehicle|van|jeep|buggy|lorry|pickup|racer)\b/i.test(String(prompt||''))){
    const wantNew=/\b(new|another|second|spawn|more)\b/i.test(String(prompt||''));
    const nearRig=Math.hypot(TRUCK.x-locomotion.root.x,TRUCK.z-locomotion.root.z)<4;
    if(!wantNew&&(TRUCK.on||nearRig))return restyleRig(prompt);
    return spawnVehicle(prompt);
  }
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
// ============================================================================
// GAMES — the standing world's sports, played with the bodies that live here.
// STRIKER is the dog's game; GOLF is the land's; CTF is played against the
// bond itself: Argos chases whoever runs, and the flag carrier runs.
// ============================================================================
const GAMES={mode:null,strokes:0,captures:0,steals:0,_stealCool:0,carrying:false,
  flag:null,hole:null,
  _mkFlag(c){const g=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,3.4,10),new THREE.MeshStandardMaterial({color:0x8b7355,roughness:.9}));
    pole.position.y=1.7;g.add(pole);
    const cloth=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.62),new THREE.MeshStandardMaterial({color:c,roughness:.7,side:THREE.DoubleSide}));
    cloth.position.set(.56,3.0,0);g.add(cloth);scene.add(g);return g},
  _spot(minD,maxD){const a=Math.random()*Math.PI*2,d=minD+Math.random()*(maxD-minD);
    const x=locomotion.root.x+Math.sin(a)*d,z=locomotion.root.z+Math.cos(a)*d;
    return{x,z,y:terrainH(x,z)}},
  start(mode){
    if(this.mode)this.end(true);
    this.mode=mode;
    if(mode==='golf'){
      this.strokes=0;
      const s=this._spot(55,95);
      this.hole=this.hole||this._mkFlag(0xd29a3a);
      this.hole.position.set(s.x,s.y,s.z);this.hole.visible=true;
      if(ball.state==='dog')return chat.line('world','Argos holds the ball — his choice. Win it back first.');
      chat.line('world','GOLF — the pin stands '+Math.hypot(s.x-locomotion.root.x,s.z-locomotion.root.z).toFixed(0)+' m out. Kicks, throws and launches all count as strokes.');
    }else if(mode==='ctf'){
      this.captures=0;this.steals=0;this.carrying=false;this._stealCool=0;
      const s=this._spot(60,100);
      this.flag=this.flag||this._mkFlag(0xc0392b);
      this.flag.position.set(s.x,s.y,s.z);this.flag.visible=true;
      chat.line('world','CAPTURE THE FLAG — it stands far out. Bring it home to the door. Argos hunts the carrier.');
    }
  },
  end(quiet){
    if(this.hole)this.hole.visible=false;
    if(this.flag)this.flag.visible=false;
    if(!quiet&&this.mode)chat.line('world',this.mode.toUpperCase()+' over — '+(this.mode==='golf'?this.strokes+' strokes':this.captures+' capture'+(this.captures===1?'':'s')+', '+this.steals+' steal'+(this.steals===1?'':'s')+' by Argos'));
    this.mode=null;this.carrying=false;
  },
  stroke(){if(this.mode==='golf')this.strokes++},
  step(dt){
    if(!this.mode)return;
    const r=locomotion.root;
    if(this.mode==='golf'&&this.hole){
      const d=Math.hypot(ball.p.x-this.hole.position.x,ball.p.z-this.hole.position.z);
      if(ball.state==='free'&&d<1.25&&ball.v.lengthSq()<.6){
        chat.line('world','⛳ HOLED in '+this.strokes+' stroke'+(this.strokes===1?'':'s')+' — the land keeps the score');
        buzz('holed',[20,40,20],800);this.end(true);this.mode=null;
      }
    }else if(this.mode==='ctf'&&this.flag){
      this._stealCool=Math.max(0,this._stealCool-dt);
      if(!this.carrying){
        if(Math.hypot(r.x-this.flag.position.x,r.z-this.flag.position.z)<2.2){
          this.carrying=true;buzz('flag',[10,26,10],500);
          chat.line('world','you carry the flag — run it home. Argos is coming.');
        }
      }else{
        // the flag rides the carrier — on foot or at the wheel
        this.flag.position.set(r.x,r.y+(TRUCK.on?2.9:2.3),r.z);
        const d=argos.world.dog,dd=Math.hypot(d[0]-r.x,d[2]-r.z);
        const chasing=argos.mind.winner==='FOLLOW'||argos.mind.winner==='FETCH';
        if(!TRUCK.on&&dd<1.15&&chasing&&this._stealCool<=0){
          this.carrying=false;this.steals++;this._stealCool=6;
          this.flag.position.set(r.x,terrainH(r.x,r.z),r.z);
          chat.line('dog','ARGOS STRIPS THE FLAG — he stands over it');buzz('steal',[18,30,18],600);
        }else if(Math.hypot(r.x-DOOR.x,r.z-(DOOR.z0+DOOR.z1)/2)<6){
          this.captures++;this.carrying=false;
          chat.line('world','🚩 CAPTURED — '+this.captures+' home. A new flag stands.');
          buzz('capture',[20,40,20],800);
          const s=this._spot(60,100);this.flag.position.set(s.x,s.y,s.z);
        }
      }
    }
  }
};
// ============================================================================
// THE LIVE CONDITIONS — a place that keeps its conditions visible. Keyless
// public feeds registered onto THIS ground through the same mercator meta the
// imagery uses: the quakes under Iceland (USGS, last 24 h, public domain) and
// the aircraft crossing the sky above you (adsb.lol). Distant contacts are
// PRESENTED, never faked — true bearing, true elevation angle, range squashed
// into the world's depth, the same law the dog's own nose already uses. What
// arrives is evidence, not spectacle: a quake close enough to feel shakes the
// ground and enters Argos's mind as a reason to come to you.
// ============================================================================
const LIVE={
  on:false,quakes:[],planes:[],shake:0,shakeT:0,shakeT0:1,_at:0,_busy:false,_seen:new Set(),
  group:null,
  init(){if(!this.group){this.group=new THREE.Group();this.group.name='LIVE.CONDITIONS';scene.add(this.group)}},
  present(d){const near=260,cap=1150;return d<=near?d:near+(cap-near)*(1-Math.exp(-(d-near)/60000))},
  clear(){this.init();for(const c of [...this.group.children]){this.group.remove(c);
    c.traverse&&c.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&o.material.dispose&&o.material.dispose()})}},
  toggle(){this.on=!this.on;this.init();this.group.visible=this.on;
    if(this.on){chat.line('world','listening to the land…');this.refresh()}
    else{this.clear();chat.line('world','the live conditions rest')}
    return this.on},
  async refresh(){
    if(this._busy||!TERRAIN.geo)return false;
    this._busy=true;this._at=performance.now();
    let got=0;
    try{this.quakes=await LIVING_GROUND.quakes(TERRAIN,600);got++}
    catch(e){chat.line('world','the seismograph line is closed here — '+String(e.message||e).slice(0,34))}
    try{this.planes=await LIVING_GROUND.aircraft(TERRAIN,180);got++}
    catch(e){chat.line('world','the sky line is closed here — '+String(e.message||e).slice(0,34))}
    this._busy=false;
    if(got){this.draw();
      chat.line('world','the land answers — '+this.quakes.length+' quake'+(this.quakes.length===1?'':'s')+' in 24 h, '
        +this.planes.length+' aircraft aloft · quakes © USGS · aircraft © adsb.lol');
      const q=this.quakes[0];
      if(q)chat.line('world','nearest tremor M'+q.mag.toFixed(1)+' · '+(q.d/1000).toFixed(0)+' km '+compass(q.brg)+' · '+q.place.slice(0,40));
    }
    return !!got;
  },
  draw(){
    this.clear();
    for(const q of this.quakes.slice(0,40)){
      const p=this.present(q.d),x=Math.sin(q.brg)*p,z=-Math.cos(q.brg)*p;
      const gy=terrainH(x,z);
      const m=q.mag,col=m>=5?0xc0392b:m>=3?0xa34f35:0xd29a3a;
      const g=new THREE.Group();
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1+m*0.5,.09,8,26),
        new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.1,roughness:.6,transparent:true,opacity:.95,fog:false}));
      ring.rotation.x=Math.PI/2;g.add(ring);
      const pin=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,1.2+m*1.1,8),
        new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.9,roughness:.7,fog:false}));
      pin.position.y=(1.2+m*1.1)/2;g.add(pin);
      // a presented contact keeps its apparent size: a reading you can read,
      // not a speck that vanishes with the range it stands for
      g.scale.setScalar(clamp(p/90,1,9));
      g.position.set(x,gy,z);g.userData.live={kind:'quake',q};this.group.add(g);
    }
    for(const a of this.planes.slice(0,60)){
      const p=this.present(a.d),k=p/Math.max(1,a.d);
      const x=Math.sin(a.brg)*p,z=-Math.cos(a.brg)*p;
      const y=terrainH(0,0)+Math.max(24,a.altM*k);
      const body=new THREE.Mesh(new THREE.ConeGeometry(1.5,6.5,4),
        new THREE.MeshStandardMaterial({color:0xe9e4d8,emissive:0xbcd6dd,emissiveIntensity:.8,roughness:.5,fog:false}));
      body.rotation.x=Math.PI/2;
      const wing=new THREE.Mesh(new THREE.BoxGeometry(9,.4,1.5),
        new THREE.MeshStandardMaterial({color:0xe9e4d8,emissive:0xbcd6dd,emissiveIntensity:.5,roughness:.6,fog:false}));
      const g=new THREE.Group();g.add(body);g.add(wing);
      g.scale.setScalar(clamp(p/110,1,9));
      g.position.set(x,y,z);g.rotation.y=a.track;
      g.userData.live={kind:'plane',a};this.group.add(g);
    }
  },
  tick(dt){
    // a tremor is not a flicker: it rolls through, then dies away
    if(this.shakeT>0){this.shakeT=Math.max(0,this.shakeT-dt);
      this.shake=this.shakeA*Math.pow(this.shakeT/this.shakeT0,1.7)}
    else this.shake=0;
    if(!this.on)return;
    if(!this._busy&&performance.now()-this._at>90000)this.refresh();
    // consequence: a tremor close enough to feel is felt — and he feels it too
    for(const q of this.quakes){
      if(q.d>80000||q.mag<3)continue;
      const id=q.time+':'+q.mag;if(this._seen.has(id))continue;
      this._seen.add(id);
      this.shakeA=Math.min(.55,(q.mag-2.5)*.16);
      this.shakeT0=this.shakeT=1.8+Math.max(0,q.mag-3)*.6;   // the roll, then the fade
      buzz('quake',[24,40,24],1200);
      chat.line('world','the ground moves — M'+q.mag.toFixed(1)+' '+(q.d/1000).toFixed(0)+' km '+compass(q.brg));
      try{argos.mind.prefs.FOLLOW=Math.max(argos.mind.prefs.FOLLOW||0,1.2);
        argos.mind.prefs.SLEEP=-.6;argos.mind.prefs.WANDER=-.4;
        argos.mind.iv.happiness=Math.max(0,(argos.mind.iv.happiness||0)-.15);
        chat.line('dog','WOOF')}catch(e){}
      break;
    }
  }
};
function compass(brg){const d=((brg*180/Math.PI)%360+360)%360;
  return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d/22.5)%16]}
// ---- THE STONE. FIRE must always answer. With the ball gone — carried off by
// the dog, stowed in the bed, lost over a ridge — you can still pick up a stone
// and throw it at the world, and the world answers back.
const STONE={p:new THREE.Vector3(),v:new THREE.Vector3(),live:false,r:.085,mesh:null};
{const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.085,0),
   new THREE.MeshStandardMaterial({color:0x8a8880,roughness:1}));
 m.visible=false;scene.add(m);STONE.mesh=m}
function throwStone(){
  const atWheel=TRUCK.on;
  rig.mesh.updateMatrixWorld(true);
  const from=atWheel?new THREE.Vector3(TRUCK.x,TRUCK.group.position.y+1.5,TRUCK.z)
                    :rig.by.rightHand.getWorldPosition(new THREE.Vector3());
  const dir=rotateLocalY(new THREE.Vector3(0,0,1),atWheel?TRUCK.yaw:locomotion.heading);
  STONE.p.copy(from).addScaledVector(dir,.35);
  const sp=atWheel?12+TRUCK.speed*.6:11.5;
  STONE.v.set(dir.x*sp,3.4,dir.z*sp);
  STONE.live=true;STONE.mesh.visible=true;STONE.mesh.position.copy(STONE.p);
  if(!atWheel)gameCommand('strike');
  buzz('stone',[10,22,8],320);
  return true;
}
STONE.step=function(dt){
  if(!this.live)return;
  this.v.y-=18*dt;
  const p=this.p.clone().addScaledVector(this.v,dt);
  const info={hit:false};
  PLACE.pushOutCircle(p,this.r,p.y-this.r,p.y+this.r,info,false);
  if(info.hit){
    chat.line('world','the stone strikes '+(info.id||'the wall')+' — it holds');
    this.v.multiplyScalar(-.28);buzz('stonehit',[14,26,10],260);
  }
  // a struck ball is a struck ball, whatever struck it
  if(ball.state==='free'&&Math.hypot(p.x-ball.p.x,p.z-ball.p.z)<.45&&Math.abs(p.y-ball.p.y)<.5){
    ball.v.addScaledVector(this.v,.55);ball.v.y=Math.max(ball.v.y,1.6);
    GAMES.stroke();chat.line('world','the stone knocks the ball on');
    try{argos.say('fetch the ball')}catch(e){}
    this.v.multiplyScalar(-.2);
  }
  const gy=PLACE.heightAt(p.x,p.z)+this.r;
  if(p.y<=gy){p.y=gy;this.v.y*=-.32;this.v.x*=.6;this.v.z*=.6;
    if(this.v.length()<.7){this.live=false}}
  this.p.copy(p);this.mesh.position.copy(p);
};
// kicking is always on: run into the ball and it goes — and the rig's bumper
// is a bigger boot than any foot
function stepKick(){
  if(ball.state!=='free')return;
  const d=Math.hypot(ball.p.x-locomotion.root.x,ball.p.z-locomotion.root.z);
  if(TRUCK.on)return; // at the wheel, the car law owns the ball
  if(d<.48&&explorer.speed>.6){
    const dir=rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading);
    ball.v.set(dir.x*(1.6+explorer.speed*.9),1.1+explorer.speed*.25,dir.z*(1.6+explorer.speed*.9));
    GAMES.stroke();
    buzz('kick',[10,20,8],350);
  }
}
// FIRE at the wheel: the bed launches its ball down the road — and Argos runs
function launchBall(){
  if(ball.state!=='rig')return false;
  const dx=Math.sin(TRUCK.yaw),dz=Math.cos(TRUCK.yaw);
  ball.state='free';
  ball.p.set(TRUCK.x+dx*2.8,TRUCK.group.position.y+1.5,TRUCK.z+dz*2.8);
  const sp=Math.abs(TRUCK.speed);
  ball.v.set(dx*(7+sp*.9),3.2,dz*(7+sp*.9));
  GAMES.stroke();
  buzz('launch',[14,30,12],500);
  try{argos.say('fetch the ball')}catch(e){}
  return true;
}
// ============================================================================
// THE RIG — Thunder Rigs' gift to the hillside: a truck. Board it and the
// stick drives; the driver IS the hero root, so the camera, the labels, the
// striker and the dog's whole perception follow the wheel with zero extra
// hooks. Back it to the home's south end and the dwelling itself can travel.
// ============================================================================
const TRUCK={x:TR0.x-8.5,z:TR0.z+7.5,yaw:Math.PI*.55,speed:0,on:false,hitched:false,group:null,wheels:[],driver:null};
// the driving eye's own state: where it stands relative to the rig
const CAMR={az:null,dist:12,high:5.0,hold:0};
function makeTruckBody(color,form){
  form=form||'classic';
  const g=new THREE.Group();g.name='RIG.TRUCK';
  const paint=new THREE.MeshStandardMaterial({color:color||0xb95d18,roughness:form==='racer'?.3:.55,metalness:form==='racer'?.4:.2});
  const dark=new THREE.MeshStandardMaterial({color:0x1e2226,roughness:.9});
  const glassM=new THREE.MeshStandardMaterial({color:0x9fc4cc,roughness:.25,metalness:.1,transparent:true,opacity:.5});
  const wr=form==='monster'?.66:form==='racer'?.36:.44;         // wheel radius
  const lift=form==='monster'?.5:form==='racer'?-.18:0;         // body lift
  if(form==='van'){
    const box2=new THREE.Mesh(new THREE.BoxGeometry(2.0,1.7,4.6),paint);box2.position.y=1.5+lift;g.add(box2);
    const win=new THREE.Mesh(new THREE.BoxGeometry(1.85,.5,1.2),glassM);win.position.set(0,1.85+lift,1.75);g.add(win);
  }else{
    const bed=new THREE.Mesh(new THREE.BoxGeometry(1.9,.5,form==='racer'?5.0:4.5),paint);bed.position.y=.92+lift;g.add(bed);
    const cab=new THREE.Mesh(new THREE.BoxGeometry(1.78,form==='racer'?.5:.72,1.7),paint);cab.position.set(0,(form==='racer'?1.32:1.5)+lift,.85);g.add(cab);
    const win=new THREE.Mesh(new THREE.BoxGeometry(1.6,.42,1.55),glassM);win.position.set(0,(form==='racer'?1.42:1.58)+lift,.85);g.add(win);
    if(form==='racer'){const spoiler=new THREE.Mesh(new THREE.BoxGeometry(1.9,.1,.5),dark);spoiler.position.set(0,1.5+lift,-2.35);g.add(spoiler)}
  }
  const grill=new THREE.Mesh(new THREE.BoxGeometry(1.7,.34,.2),dark);grill.position.set(0,.78+lift,form==='racer'?2.55:2.3);g.add(grill);
  const wheels=[];
  for(const [wx,wz] of [[-.98,1.5],[.98,1.5],[-.98,-1.5],[.98,-1.5]]){
    // a wheel turns about TWO joints: the kingpin steers, the hub rolls. One
    // mesh doing both is what makes wheels sit crooked.
    const pivot=new THREE.Group();pivot.position.set(wx,wr,wz);g.add(pivot);
    const w=new THREE.Mesh(new THREE.CylinderGeometry(wr,wr,.38,14),dark);
    w.geometry.rotateZ(Math.PI/2);pivot.add(w);
    wheels.push({pivot,mesh:w});
  }
  // the driver is seen at the wheel — a silhouette, present only when boarded
  const drv=new THREE.Group();
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.34,4,10),new THREE.MeshStandardMaterial({color:0x2a2d31,roughness:1}));
  torso.position.y=.28;drv.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),new THREE.MeshStandardMaterial({color:0x111214,roughness:1}));
  head.position.y=.66;drv.add(head);
  drv.position.set(0,1.28,.72);drv.visible=false;g.add(drv);
  scene.add(g);
  return{group:g,wheels,driver:drv};
}
{const b=makeTruckBody(0xb95d18);TRUCK.group=b.group;TRUCK.wheels=b.wheels;TRUCK.driver=b.driver}
// THE FLEET — rigs summoned by words stand parked until you take one. Only
// one rig is ever driven; boarding a parked one exchanges bodies with it.
const FLEET=[];
const RIG_COLORS=[0x2d6f8e,0x596650,0x8e2d3c,0xd29a3a,0x4a4f55];
function poseFleetRig(r){
  CONTACT.place(r.group,CONTACT.pose(CONTACT.ground,r.x,r.z,r.yaw,1.5,.95),r.x,r.z,r.yaw);
}
// words shape the machine, like the HELLO line shapes the rig in the
// standing world: color words paint it, form words rebuild it
function parseRigWords(p){
  p=String(p||'').toLowerCase();
  const C={red:0xc0392b,blue:0x2d6f8e,green:0x596650,black:0x22262a,white:0xd8d5cc,
    yellow:0xd2b53a,orange:0xb95d18,purple:0x6d5aa8,gold:0xd29a3a,grey:0x70726b,gray:0x70726b,pink:0xc26a8a};
  let color=null;for(const k of Object.keys(C))if(p.includes(k)){color=C[k];break}
  let form='classic';
  if(/race|racer|racing|sport|fast|low/.test(p))form='racer';
  else if(/monster|crawler|big wheel|offroad|off-road/.test(p))form='monster';
  else if(/van|bus|box/.test(p))form='van';
  return{color:color??0xb95d18,form};
}
function spawnVehicle(prompt){
  if(FLEET.length>=5){chat.line('world','the yard holds five rigs already — drive one');return false}
  const P2=parseRigWords(prompt);
  const fwd=rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading);
  const x=locomotion.root.x+fwd.x*6.5,z=locomotion.root.z+fwd.z*6.5;
  const b=makeTruckBody(P2.color??RIG_COLORS[FLEET.length%RIG_COLORS.length],P2.form);
  const r={x,z,yaw:locomotion.heading+Math.PI*.5,group:b.group,wheels:b.wheels,driver:b.driver,steerVis:0};
  FLEET.push(r);poseFleetRig(r);
  chat.line('world','a rig rolls off the line and stands ahead — walk to it and DRIVE');
  return true;
}
function restyleRig(prompt){
  const P2=parseRigWords(prompt);
  const b=makeTruckBody(P2.color,P2.form);
  scene.remove(TRUCK.group);
  TRUCK.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose&&o.material.dispose()});
  TRUCK.group=b.group;TRUCK.wheels=b.wheels;TRUCK.driver=b.driver;
  if(TRUCK.on&&TRUCK.driver)TRUCK.driver.visible=true;
  truckPlace();
  chat.line('world','the rig takes its new shape — '+P2.form+', same wheel in your hands');
  return true;
}
function nearestRig(){
  let best=TRUCK,bd=Math.hypot(TRUCK.x-locomotion.root.x,TRUCK.z-locomotion.root.z);
  for(const f of FLEET){const d=Math.hypot(f.x-locomotion.root.x,f.z-locomotion.root.z);if(d<bd){bd=d;best=f}}
  return{best,bd};
}
function adoptRig(f){ // exchange bodies: the fleet rig becomes THE rig, the old one parks
  const keep={x:TRUCK.x,z:TRUCK.z,yaw:TRUCK.yaw,group:TRUCK.group,wheels:TRUCK.wheels,driver:TRUCK.driver,steerVis:TRUCK.steerVis||0};
  TRUCK.x=f.x;TRUCK.z=f.z;TRUCK.yaw=f.yaw;TRUCK.group=f.group;TRUCK.wheels=f.wheels;TRUCK.driver=f.driver;TRUCK.steerVis=f.steerVis||0;
  f.x=keep.x;f.z=keep.z;f.yaw=keep.yaw;f.group=keep.group;f.wheels=keep.wheels;f.driver=keep.driver;f.steerVis=keep.steerVis;
  poseFleetRig(f);
}
function truckPlace(){
  // the rig sits ON the hill, not level above it and not sunk into it: the
  // four wheels give the pose, and TRUCK.y is the ground it actually stands
  // on — the same number the collision band is cut from, so the rig can no
  // longer be shoved through a wall it is visually above.
  const p=CONTACT.pose(CONTACT.ground,TRUCK.x,TRUCK.z,TRUCK.yaw,1.5,.95);
  TRUCK.y=p.y;TRUCK.pitch=p.pitch;TRUCK.roll=p.roll;
  CONTACT.place(TRUCK.group,p,TRUCK.x,TRUCK.z,TRUCK.yaw,TRUCK.airY||0);
}
function truckRear(){const dx=Math.sin(TRUCK.yaw),dz=Math.cos(TRUCK.yaw);return{x:TRUCK.x-dx*2.9,z:TRUCK.z-dz*2.9}}
function truckJump(){
  if(!TRUCK.on||(TRUCK.airY||0)>0.02||TRUCK.hitched)return;
  TRUCK.vy=11;TRUCK.airY=0.03;buzz('rigjump',[12,26,10],400); // III's leap, scaled to the hillside
}
function boardTruck(){
  if(TRUCK.on)return;
  const {best,bd}=nearestRig();
  if(bd>3.4)return;
  if(best!==TRUCK)adoptRig(best);
  TRUCK.on=true;TRUCK.speed=0;document.body.classList.add('driving');
  if(TRUCK.driver)TRUCK.driver.visible=true;
  rig.mesh.visible=false;rig.outline.visible=false;support.visible=false;
  window.__exitFreeCam?.();
  placeHero(TRUCK.x,TRUCK.z,TRUCK.yaw);
  // the eye takes its place behind the nose — the road ahead is the screen
  {CAMR.az=TRUCK.yaw+Math.PI+(TRUCK.hitched?0.62:0);CAMR.dist=TRUCK.hitched?20:12;CAMR.high=TRUCK.hitched?10:5.0;CAMR.hold=0;
   controls.target.set(TRUCK.x,TRUCK.group.position.y+1,TRUCK.z);
   camera.position.set(TRUCK.x+Math.sin(CAMR.az)*CAMR.dist,TRUCK.group.position.y+1+CAMR.high,TRUCK.z+Math.cos(CAMR.az)*CAMR.dist)}
  buzz('board',10,300);chat.line('world','the rig takes you — the stick points the way, momentum does the rest');
}
function exitTruck(){
  if(!TRUCK.on)return;
  TRUCK.on=false;TRUCK.speed=0;TRUCK.airY=0;TRUCK.vy=0;if(TRUCK.vel)TRUCK.vel.set(0,0,0);document.body.classList.remove('driving');
  if(TRUCK.driver)TRUCK.driver.visible=false;
  rig.mesh.visible=true;rig.outline.visible=true;support.visible=true;
  const px2=Math.cos(TRUCK.yaw),pz2=-Math.sin(TRUCK.yaw);
  placeHero(TRUCK.x+px2*1.9,TRUCK.z+pz2*1.9,TRUCK.yaw);
  chat.line('world','you step down — the rig waits');
}
// the tongue shows itself: an amber marker over the hitch point when a rig is near
const tongueMark=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),new THREE.MeshStandardMaterial({color:0xd29a3a,emissive:0xd29a3a,emissiveIntensity:.7,roughness:.4}));
tongueMark.visible=false;scene.add(tongueMark);
function hitchTrailer(){
  if(!TRUCK.on||TRUCK.hitched)return false;
  const h=trailerHitchWorld();
  if(Math.hypot(TRUCK.x-h.x,TRUCK.z-h.z)>7){chat.line('world','bring the rig to the home’s south tongue — the amber mark — to hitch');return false}
  TRUCK.hitched=true;buzz('hitch',[14,30,14],500);
  chat.line('world','HITCHED — the home rides the rig. DROP to set it down.');
  return true;
}
function unhitchTrailer(){
  if(!TRUCK.hitched)return;
  TRUCK.hitched=false;
  // the pad levels itself under the new site; the dressing stays
  setPad(TR.x,TR.z);                       // the site levels — pad, mesh and queries together
  buildTerrainMesh._keepDress=!!(terrainMesh&&terrainMesh.material.map);
  buildTerrainMesh();
  applyTrailerOffset(TRAILER.ox,TRAILER.oz,terrainH(TR.x,TR.z));
  buzz('unhitch',[10,24,10],500);
  chat.line('world','the home stands here now — the land levels under it');
}
function truckStep(dt){
  for(const f of FLEET)poseFleetRig(f);
  GAMES.step(dt);
  // the ball rides the rig: roll gently over it and the bed takes it
  if(ball.state==='rig'){
    const dx=Math.sin(TRUCK.yaw),dz=Math.cos(TRUCK.yaw);
    ball.p.set(TRUCK.x-dx*1.1,TRUCK.group.position.y+1.35,TRUCK.z-dz*1.1);ball.v.set(0,0,0);
  }
  if(!TRUCK.on){truckPlace();return}
  // ══ THUNDER RIGS' OWN CAR LAW, ported (unset-04: ACCEL/COAST/DRIVE_DRAG,
  // stick-owns-yaw, momentum drifts, climbing gets torque) ══
  TRUCK.vel=TRUCK.vel||new THREE.Vector3();
  const dir=explorerMoveVector(),mag=explorer.inputMag||0;
  // vertical life: JUMP lifts along the ground, gravity brings it home
  if((TRUCK.vy||0)!==0||(TRUCK.airY||0)>0){
    TRUCK.vy=(TRUCK.vy||0)-30*dt;
    TRUCK.airY=Math.max(0,(TRUCK.airY||0)+TRUCK.vy*dt);
    if(TRUCK.airY===0){if(TRUCK.vy<-3)buzz('rigland',[8,18,8],400);TRUCK.vy=0}
  }
  const grounded=(TRUCK.airY||0)<=0.02;
  const ACC=(explorer.boostHold?78:52)*(TRUCK.hitched?.55:1);
  const MAX=(explorer.boostHold?40:26)*(TRUCK.hitched?.55:1);
  if(grounded&&mag>0.1){
    const nn=PLACE.ground.normalAt(TRUCK.x,TRUCK.z);
    const proj=dir.clone().projectOnPlane(new THREE.Vector3(nn[0],nn[1],nn[2])).normalize();
    let slopeBoost=1;if(proj.y>0.05)slopeBoost=1+proj.y*3.5; // torque climbs the quarterpipe
    TRUCK.vel.addScaledVector(proj,ACC*mag*slopeBoost*dt);
  }
  if(grounded){const drag=mag<0.1?1.5:1.03;TRUCK.vel.multiplyScalar(Math.exp(-drag*dt))}
  else{TRUCK.vel.x*=Math.exp(-.2*dt);TRUCK.vel.z*=Math.exp(-.2*dt)}
  TRUCK.vel.y=0;
  const spd0=TRUCK.vel.length();if(spd0>MAX)TRUCK.vel.multiplyScalar(MAX/spd0);
  // the stick owns the nose; momentum owns the road
  if(mag>0.1){
    const want=Math.atan2(dir.x,dir.z);
    // light, the nose is the stick; loaded, six tonnes of house has an opinion
    TRUCK.yaw=TRUCK.hitched?lerpAngle(TRUCK.yaw,want,1-Math.exp(-dt*1.9)):want;
  }
  else if(Math.hypot(TRUCK.vel.x,TRUCK.vel.z)>0.5)TRUCK.yaw+=normAngle(Math.atan2(TRUCK.vel.x,TRUCK.vel.z)-TRUCK.yaw)*Math.min(1,10*dt);
  // integrate; walls answer with a bounce
  const v=new THREE.Vector3(TRUCK.x+TRUCK.vel.x*dt,0,TRUCK.z+TRUCK.vel.z*dt);
  // the band is cut from the rig's OWN contact height, footprint and all —
  // one sample under the axle let a wall pass clean through a rig parked on a
  // rise, because the wall's box and the rig's ground disagreed by a metre
  const gy=CONTACT.pose(CONTACT.ground,v.x,v.z,TRUCK.yaw,1.5,.95).y;const hitI={hit:false};
  TOW.skip=TRUCK.hitched;
  PLACE.pushOutCircle(v,1.15,gy+.25,gy+1.7,hitI);
  TOW.skip=false;
  if(hitI.hit){const nl=Math.hypot(hitI.x,hitI.z)||1,nx=hitI.x/nl,nz=hitI.z/nl;
    const vn=TRUCK.vel.x*nx+TRUCK.vel.z*nz;
    if(vn<0){TRUCK.vel.x-=1.4*vn*nx;TRUCK.vel.z-=1.4*vn*nz;if(-vn>6)buzz('rigwall',[10,22,10],400)}}
  TRUCK.x=v.x;TRUCK.z=v.z;
  TRUCK.speed=Math.hypot(TRUCK.vel.x,TRUCK.vel.z);
  // the ball answers the bumper with III's own law — or the bed takes it, gently
  if(ball.state==='free'){
    const N=new THREE.Vector3(ball.p.x-TRUCK.x,0,ball.p.z-TRUCK.z),bd2=N.length(),sum=1.5+ball.r;
    if(bd2<sum){
      const Nn=N.clone().divideScalar(bd2||1);
      const approach=Math.max(0,TRUCK.vel.dot(Nn));
      if(approach<3){ball.state='rig';buzz('stow',[8,18,8],500);chat.line('world','the bed takes the ball — FIRE launches it')}
      else{ball.p.set(TRUCK.x+Nn.x*(sum+.05),ball.p.y,TRUCK.z+Nn.z*(sum+.05));
        const power=3+approach*1.2;
        ball.v.set(Nn.x*power+TRUCK.vel.x*.4,2.2+approach*.12,Nn.z*power+TRUCK.vel.z*.4);
        GAMES.stroke();buzz('kick',[10,20,8],350)}
    }
  }
  // wheels tell the story: roll with speed, toe with the drift
  // the front wheels point where you ASK to go, not where the drift happens to be
  const askA=mag>0.1?normAngle(Math.atan2(dir.x,dir.z)-TRUCK.yaw):0;
  TRUCK.steerVis=lerp(TRUCK.steerVis||0,clamp(askA,-.52,.52),1-Math.exp(-dt*9));
  TRUCK.wheels[0].pivot.rotation.y=TRUCK.wheels[1].pivot.rotation.y=TRUCK.steerVis;
  for(const w of TRUCK.wheels)w.mesh.rotation.x+=TRUCK.speed*dt/.44;
  if(explorer.boostHold&&TRUCK.speed>8)buzz('rigboost',6,500);
  if(TRUCK.hitched){
    // A REAL TOW, not a shove: the tongue is inextensible, so the home's centre
    // trails the hitch at a fixed length and its nose always points AT the
    // hitch. That pursuit curve IS a trailer — and a body that always points at
    // the thing pulling it cannot jackknife.
    const h=truckRear(),L=3.05;
    let dx=h.x-TR.x,dz=h.z-TR.z,d=Math.hypot(dx,dz);
    if(d<1e-4){dx=Math.sin(TRUCK.yaw);dz=Math.cos(TRUCK.yaw);d=1}
    // THE TONGUE HAS A LIMIT. A pursuit curve alone cannot jackknife going
    // forward — but nothing in this world made the rig go forward. Push the
    // stick back and the car law swings the nose through 180°, the tongue
    // folds all the way onto the cab, and that IS the jackknife. A real
    // coupling stops at the fender.
    let psi=Math.atan2(dx,dz);                       // the home points at the hitch
    let theta=normAngle(psi-TRUCK.yaw);
    const LIM=1.22;                                  // 70° — steel meets steel
    let folded=0;
    if(theta>LIM){folded=theta-LIM;psi=TRUCK.yaw+LIM;theta=LIM}
    else if(theta<-LIM){folded=-LIM-theta;psi=TRUCK.yaw-LIM;theta=-LIM}
    const cx=h.x-Math.sin(psi)*L,cz=h.z-Math.cos(psi)*L;
    // THE LOAD PUSHES BACK. Six tonnes of house behind the axle is not
    // scenery: the further the tongue folds the harder it drags the nose
    // straight and the more speed it eats. Towing should feel like towing.
    const bite=Math.abs(theta)/LIM;
    TRUCK.yaw+=normAngle(psi-TRUCK.yaw)*Math.min(.5,dt*(2.2*bite+9*folded));
    TRUCK.vel.multiplyScalar(Math.exp(-dt*(.12+3.0*bite*bite)));   // straight costs little, folded costs plenty
    TRUCK.speed=Math.hypot(TRUCK.vel.x,TRUCK.vel.z);
    if(folded>.05&&TRUCK.speed>4)buzz('fold',[9,16,8],420);
    // the home rides the ground it is on, over its whole six metres, and
    // leans with the hill while it rolls — the jacks level it when it lands
    const tyaw=psi-Math.PI;                          // stored yaw: the home's tongue is its local -z
    const hp=CONTACT.pose(CONTACT.ground,cx,cz,tyaw,2.9,1.23,.5);
    applyTrailerOffset(cx-TR0.x,cz-TR0.z,hp.y,tyaw,hp.pitch,hp.roll);
  }
  // the load has had its say before anything is drawn or followed: pose, then
  // the driver IS the root — camera, dog, labels and striker all read this
  truckPlace();
  placeHero(TRUCK.x,TRUCK.z,TRUCK.yaw);
  locomotion.heading=TRUCK.yaw;locomotion.headingGoal=TRUCK.yaw;
  explorer.speed=Math.abs(TRUCK.speed);
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
  // the household arrives together: home to origin, new datum, rig and dog
  // in the yard, the ball at your feet — and a mind fresh for the new land
  if(TRUCK.hitched)TRUCK.hitched=false;
  applyTrailerOffset(0,0,0,0);
  PAD.datum=rawTerrain(TR.x,TR.z);setPad(TR.x,TR.z);   // new land: datum, pad, then the mesh
  buildTerrainMesh();
  dressWorld().then(t=>chat.line('world','dressed — '+t+' tiles · © Esri · © OpenStreetMap')).catch(()=>{});
  placeHero(0,0,locomotion.heading);
  seatDog(TR.x-2.1,TR.z-2.4);
  TRUCK.x=TR.x-8.5;TRUCK.z=TR.z+7.5;TRUCK.speed=0;truckPlace();
  if(ball.state!=='hero'){ball.state='free';ball.p.set(TR.x-4.2,terrainH(TR.x-4.2,TR.z-1)+ball.r,TR.z-1);ball.v.set(0,0,0)}
  argos.world.carrying=false;
  argos.mind.iv.fatigue=Math.min(argos.mind.iv.fatigue,.15);
  argos.mind.iv.happiness=Math.max(argos.mind.iv.happiness||0,.7);
  argos.mind.prefs.FOLLOW=Math.max(argos.mind.prefs.FOLLOW||0,.8);
  argos.mind.prefs.SLEEP=-.4;
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
{ // the galley travels with the home
  const BOWL0={x:bowl.p.x,z:bowl.p.z};
  TRAILER.moveBowl=()=>{const w=worldOf(BOWL0.x,BOWL0.z);
    bowl.p.set(w.x,DECK+TRAILER.oy,w.z);
    bowlMesh.position.copy(bowl.p);bowlMesh.position.y+=.028};
}
const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),new THREE.MeshStandardMaterial({color:0xa8392b,roughness:.7}));
scene.add(ballMesh);
const bowlMesh=new THREE.Mesh(new THREE.CylinderGeometry(.11,.085,.055,18,1,true),new THREE.MeshStandardMaterial({color:0x56606e,roughness:.6,side:THREE.DoubleSide}));
bowlMesh.position.copy(bowl.p).y+=.028;scene.add(bowlMesh);
const foodMesh=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.03,14),new THREE.MeshStandardMaterial({color:0x7a5a30,roughness:1}));
foodMesh.position.copy(bowl.p).y+=.035;foodMesh.visible=false;scene.add(foodMesh);
const _pushInfo={x:0,z:0,hit:false,id:''};
function stepBall(dt){
  if(ball.state==='hero'){rig.mesh.updateMatrixWorld(true);ball.p.copy(rig.by.rightHand.getWorldPosition(new THREE.Vector3()));ball.v.set(0,0,0)}
  else if(ball.state==='free'&&(ball.v.lengthSq()>1e-6||ball.p.y>PLACE.heightAt(ball.p.x,ball.p.z)+ball.r+1e-3)){
    // A BALL AT REST IS ONLY AT REST ON THE GROUND. Gating gravity on "already
    // moving" left a ball hanging in the air the instant the ground moved out
    // from under it, or wherever it was set down above the land — the world
    // quietly stopping the moment nothing was happening is exactly what a
    // world with no physics looks like. Now the ground is asked either way.
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
  else if(ball.state==='free'){ball.p.y=PLACE.heightAt(ball.p.x,ball.p.z)+ball.r}  // settled: it rides the ground
  ballMesh.position.copy(ball.p);
  foodMesh.visible=bowl.food;
}
function throwBall(){
  if(ball.state!=='hero')return false;
  gameCommand('strike');
  rig.mesh.updateMatrixWorld(true);
  ball.state='free';ball.p.copy(rig.by.rightHand.getWorldPosition(new THREE.Vector3()));
  const dir=rotateLocalY(new THREE.Vector3(0,0,1),locomotion.heading);
  ball.v.set(dir.x*4.0,2.6,dir.z*4.0);GAMES.stroke();buzz('throw',[12,26,10],400);
  try{argos.say('fetch the ball')}catch(e){}
  return true;
}
function takeBall(){
  if(ball.state!=='free')return false;
  const d=Math.hypot(ball.p.x-locomotion.root.x,ball.p.z-locomotion.root.z);
  if(d>1.35)return false;
  ball.state='hero';buzz('take',8,300);return true;
}
function feedBowl(){
  const bd=Math.hypot(bowl.p.x-locomotion.root.x,bowl.p.z-locomotion.root.z);
  if(bd<=1.8&&!bowl.food){
    bowl.food=true;bowl.meal=4;try{argos.say('dinner time, eat')}catch(e){}
    gameCommand('crouch',1);setTimeout(()=>gameCommand('crouch',0),650);buzz('feed',[8,20,8],400);
    chat.line('world','the bowl is filled — he will come when he wants it');return true;
  }
  // FROM THE HAND. The plainest bond there is, and it needs no galley: crouch,
  // hold it out, and he takes it. Feeding is the oldest argument for trust.
  const d=argos.world.dog,dd=Math.hypot(d[0]-locomotion.root.x,d[2]-locomotion.root.z);
  if(dd<=2.6){
    argos.mind.iv.hunger=Math.max(0,(argos.mind.iv.hunger||0)-.35);
    BOND.v=Math.min(1,BOND.v+.12);
    argos.mind.prefs.FOLLOW=Math.max(argos.mind.prefs.FOLLOW||0,1.0);
    try{argos.say('good dog, eat')}catch(e){}
    gameCommand('crouch',1);setTimeout(()=>gameCommand('crouch',0),650);buzz('feed',[8,20,8],400);
    chat.line('world','you feed him from your hand — he remembers this');
    chat.line('dog','WOOF');return true;
  }
  chat.line('world',bowl.food?'the bowl is already full — call him to it':'go to him, or to the galley bowl');
  return false;
}
// ---- one clock: the world advances inside the same tick as the body solver
let _fadeAcc=0,_uiAcc=0;
function worldStep(dt){
  truckStep(dt);
  locomotion.root.y=groundYAt(locomotion.root.x,locomotion.root.z);
  const gy=locomotion.root.y;
  worldStep._pr??=locomotion.root.clone();
  // At the wheel the body is cargo: the RIG's collision is the only authority.
  // Otherwise the walls the rig legitimately passes would shove the pinned body
  // every frame and the rollback would fight the pin — the world keeps turning,
  // only the walking body's own occupancy stands down.
  if(!TRUCK.on){
    for(let i=0;i<3;i++)PLACE.pushOutCircle(locomotion.root,.17,gy+.14,gy+1.55,null,false);
    // wedged in a seam (window/bench corner): give the step back rather than jitter
    _pushInfo.hit=false;PLACE.pushOutCircle(locomotion.root,.155,gy+.14,gy+1.55,_pushInfo,false);
    if(_pushInfo.hit){locomotion.root.x=worldStep._pr.x;locomotion.root.z=worldStep._pr.z;
      locomotion.root.y=groundYAt(locomotion.root.x,locomotion.root.z)}
    for(const side of ['L','R']){const a=locomotion.footAnchor[side];PLACE.pushOutCircle(a,.07,a.y+.02,a.y+.42,null,false)}
  }
  worldStep._pr.copy(locomotion.root);
  stepBall(dt);
  STONE.step(dt);
  stepKick();
  STRIKER.step();
  LIVE.tick(dt);
  WEATHER.step(dt);
  _fadeAcc+=dt;if(_fadeAcc>.05){_fadeAcc=0;updateStructFade()}
  _uiAcc+=dt;if(_uiAcc>.22){_uiAcc=0;updateWorldUI()}
}
function updateWorldUI(){
  const bb=$('#ballBtn'),fb=$('#feedBtn');if(!bb)return;
  const d=Math.hypot(ball.p.x-locomotion.root.x,ball.p.z-locomotion.root.z);
  bb.textContent=ball.state==='hero'?'THROW':ball.state==='dog'?'ARGOS':ball.state==='rig'?'LAUNCH':(d<=1.35?'TAKE':'FIRE');
  const sb2=$('#strikerBtn');if(sb2){sb2.textContent=STRIKER.on?'END':'PLAY';sb2.classList.toggle('on',STRIKER.on)}
  $('#golfBtn')?.classList.toggle('on',GAMES.mode==='golf');
  $('#ctfBtn')?.classList.toggle('on',GAMES.mode==='ctf');
  bb.classList.toggle('on',ball.state==='hero'||ball.state==='rig'||(ball.state==='free'&&d<=1.35));
  if(fb){const bd=Math.hypot(bowl.p.x-locomotion.root.x,bowl.p.z-locomotion.root.z);
    const dg=argos.world.dog,dd2=Math.hypot(dg[0]-locomotion.root.x,dg[2]-locomotion.root.z);
    fb.textContent=(dd2<=2.6)?'HAND':(bowl.food?'FED':'FEED');
    fb.classList.toggle('on',dd2<=2.6||(!bowl.food&&bd<=1.8))}
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
// SET HIM DOWN, NEVER SWAP HIM OUT. His runtime holds this very array — hand it
// a different one and he is severed from his own body: the mind keeps deciding
// while the legs answer to an array nobody reads. Move him in place, and seat
// him on the ground, or he has no contact to earn traction from.
// A BODY IS NOT A POINT AND A POSTURE IS NOT A CONSTANT. Standing, Argos
// reaches 3 cm below his root; SITTING, his haunches and rear pads go nearly
// 20 cm below it. Seat the root on the ground and the sit drives his back half
// into the hill — which is exactly what "the dog falls through the ground"
// looks like, and why it looked fine every time he was measured on his feet.
// dogLift() asks his OWN posed skeleton how far it currently reaches below the
// root, so the ground meets whatever part of him is lowest, always.
const DOG_PADS=Object.keys(argos.rig.nodes).filter(k=>/Pad$/.test(k));
const DOG_PAW=0.021;                               // the flesh under the pad node
let dogLiftV=DOG_PAW;
function dogLift(){
  // ASK THE POSE, NOT THE GAIT. Standing, the pads hang from the root and the
  // gap between them IS the posture — a sit puts the rear pads 0.19 below the
  // root, and that is exactly how deep his hindquarters used to be buried. In
  // a gait the foot solver pins the pads in the WORLD instead, so that gap
  // stops being a property of the pose: read it then and lift by it and the
  // measurement raises the root, which widens the gap, which raises the root.
  // So the posture is measured only while he is still; under way the plain
  // paw offset is what the foot solver already expects.
  const L=argos.loco;let target=DOG_PAW;
  if((L.speed||0)<0.08){
    const R=argos.rig,r0=R.root.t[1]||0;let drop=0;
    for(const k of DOG_PADS){const nd=R.nodes[k];if(nd){const v=r0-nd.world[13];if(v>drop)drop=v}}
    target=Math.min(.45,Math.max(0,drop))+DOG_PAW;
  }
  // rise fast, settle slow: a body may float for a moment on the way up out of
  // a sit, but it must never be let down into the hill ahead of its own legs
  dogLiftV+=(target-dogLiftV)*(target>dogLiftV?.40:.07);
  return dogLiftV;
}
function seatDog(x,z){
  const d=argos.world.dog;
  d[0]=x;d[2]=z;d[1]=CONTACT.crest(CONTACT.dogHeight,x,z,(argos.loco&&argos.loco.heading)||0,.52,.26)+dogLiftV;
  argos.loco.speed=0;argos.loco.desiredSpeed=0;
}
argos.world.human=[0,0,0];
// The half-dog solves his stance against locally-flat ground. On the real
// hillside we answer terrain queries with the ground under his BODY, so his
// pads plant coherently and traction is truly earned; his root still rides
// the actual terrain height every step.
// A BODY HAS WIDTH. One sample under his centre leaves the uphill half of him
// inside the hill — a quarter-metre buried on a real Fljótshlíð slope. He is
// posed level, so he must stand on the HIGHEST ground his own footprint spans:
// then nothing of him is ever inside the land, and the worst case is a paw a
// little light on the downhill side, which is what a real dog looks like.
argos.setTerrain(()=>{
  const d=argos.world.dog,hd=(argos.loco&&argos.loco.heading)||0;
  const lift=dogLift();
  argos.loco.groundDrop=lift;                      // the runtime plants pads against THIS
  const hi=CONTACT.crest(CONTACT.dogHeight,d[0],d[2],hd,.52,.26)+lift;
  // The centre alone buries his uphill half. Standing on the crest of his own
  // footprint means NO part of him is ever inside the land — the cost is a
  // downhill paw riding light on steep ground, which is the honest geometry of
  // a level-posed body on a hill, not a broken world. On flat ground every
  // sample agrees and this is exactly the ground.
  return hi;
});
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
  const h=homeOf(x,z);
  const px=(h.x-TR0.x)/IN+50.5,py=(h.z-TR0.z)/IN+120;
  return px>0&&px<101&&py>0&&py<240;
}
const DOOR_MID0=(DOOR0.z0+DOOR0.z1)/2;
function routeForDog(target){
  if(!target)return target;
  const d=argos.world.dog,di=insideShell(d[0],d[2]),ti=insideShell(target[0],target[2]);
  if(di===ti)return target;
  // HE HAS NO MAP — he steers at one point at a time. A doorway is a 0.9 m slot,
  // and you cannot enter a slot on the diagonal: so the way through is a funnel.
  // Get onto the door's lane first, THEN walk the lane through the opening.
  const hd=homeOf(d[0],d[2]),lane=DOOR_MID0;
  // the lane tolerance must exceed his own stop distance, or he deadlocks in
  // the band between "not lined up yet" and "close enough to stop walking"
  const inX=DOOR0.x+1.05,outX=DOOR0.x-1.05;
  let hx,hz=lane;
  if(Math.abs(hd.z-lane)>0.55){                 // off the lane: line up with the door
    hx=di?Math.min(Math.max(hd.x,inX),DOOR0.x+2.4)
         :Math.max(Math.min(hd.x,outX),DOOR0.x-2.4);
  }else hx=di?outX:inX;                         // on the lane: step through
  const w=worldOf(hx,hz);
  return [w.x,0,w.z];
}
let _dogEatT=0;
// ---- THE BOND — companionship as accumulated history, never a meter shown.
// Feeding, delivered fetches and time spent near him all deepen it; what it
// buys is not obedience but a standing pull toward you when you move off.
const BOND={v:.3,_t:0};
// scent: beyond eyesight a target is presented at a squashed distance in its
// TRUE direction — the signal strengthens as the real gap closes, so you are
// always in his world, however far you range. (Same law as the III seam.)
function scentSquash(target,near,cap){
  if(!target)return target;
  const d=argos.world.dog,dx=target[0]-d[0],dz=target[2]-d[2],ds=Math.hypot(dx,dz);
  near=near??3.6;cap=cap??4.6;
  if(ds<=near)return target;
  const p=near+(cap-near)*(1-Math.exp(-(ds-near)/30));
  return [d[0]+dx/ds*p,target[1],d[2]+dz/ds*p];
}
function updateDog(t,dt){
  const hero=locomotion.root;
  const heroP=STRIKER.on&&argos.world.carrying?[STRIKER.dogGoal.x,0,STRIKER.dogGoal.z]:[hero.x,0,hero.z];
  const routedHuman=routeForDog(heroP);
  // squash only when no door stands between them — routed waypoints stay exact.
  // The deeper the bond, the sharper his nose: your scent reads CLOSER, so
  // social behaviors keep real strength however far you range.
  const hCap=4.6-2.4*BOND.v,hNear=Math.max(1.6,hCap-1);
  argos.world.human=(routedHuman===heroP)?scentSquash(heroP,hNear,hCap):routedHuman;
  // companionship: near him the bond grows; far and moving, it pulls him after you
  BOND._t+=dt;
  const dd0=argos.world.dog,heroDist=Math.hypot(hero.x-dd0[0],hero.z-dd0[2]);
  if(heroDist<3)BOND.v=Math.min(1,BOND.v+dt*.004);
  BOND.v=Math.max(0,BOND.v-dt*.0004);
  if(BOND._t>1){BOND._t=0;
    const heroIn=insideShell(hero.x,hero.z),dogIn=insideShell(dd0[0],dd0[2]);
    // he does not LIVE in there. If you are out on the land and he is indoors,
    // being with you outweighs the couch — he takes the door and comes out.
    if(dogIn&&!heroIn){
      argos.mind.prefs.FOLLOW=Math.max(argos.mind.prefs.FOLLOW||0,1.3);
      argos.mind.prefs.SLEEP=-.7;argos.mind.prefs.SIT=-.5;argos.mind.prefs.WANDER=-.4;
      argos.mind.iv.fatigue=Math.min(argos.mind.iv.fatigue||0,.45);
    }
    // he ASKS to play: rested, fond of you, and a ball lying about
    if(!STRIKER.on&&ball.state==='free'&&BOND.v>.25&&(argos.mind.iv.fatigue||0)<.7){
      const bd2=Math.hypot(ball.p.x-dd0[0],ball.p.z-dd0[2]);
      if(bd2<34&&heroDist<30)argos.mind.prefs.FETCH=Math.max(argos.mind.prefs.FETCH||0,.7+BOND.v*.8);
    }
    // the play bow: near you, idle, ball in your hand — he invites the throw
    BOND._ask=(BOND._ask||0)+1;
    if(ball.state==='hero'&&heroDist<7&&BOND._ask>11&&(argos.mind.iv.fatigue||0)<.75){
      BOND._ask=0;argos.mind.prefs.FETCH=Math.max(argos.mind.prefs.FETCH||0,1.2);
      chat.line('dog','he drops into a play bow — throw it');buzz('bow',[8,16,8],2000);
    }
    if(heroDist>6&&!STRIKER.on){
      // the standing pull of the bond — a bias he re-smells every second,
      // stronger for every meal and every returned ball. Never a command:
      // hunger, fear and fatigue still get their vote.
      argos.mind.prefs.FOLLOW=Math.max(argos.mind.prefs.FOLLOW||0,.9+BOND.v*.6);
      argos.mind.prefs.WANDER=Math.min(argos.mind.prefs.WANDER||0,-.25);
      argos.mind.prefs.SLEEP=Math.min(argos.mind.prefs.SLEEP||0,-.3);
      argos.mind.prefs.SIT=Math.min(argos.mind.prefs.SIT||0,-.35);
      argos.mind.iv.happiness=Math.max(argos.mind.iv.happiness||0,.35+.3*BOND.v);
    }
  }
  const pt=pointingFloorTarget();
  if(pt){dogMind.pointTarget.copy(pt.q);argos.world.handPose='lure'}
  else argos.world.handPose=(ball.state==='hero'?'extended':'none');
  {const bp=[ball.p.x,ball.p.y,ball.p.z];const rb3=routeForDog(bp);
   argos.world.ball=ball.state==='free'?(rb3===bp?scentSquash(bp):rb3):null;}
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
    if(Math.hypot(d[0]-home.x,d[2]-home.z)<1.85){
      argos.world.carrying=false;ball.state='free';
      const gy=PLACE.heightAt(ball.p.x,ball.p.z);ball.p.y=gy+ball.r;ball.v.set(0,0,0);
      BOND.v=Math.min(1,BOND.v+.06); // he chose to bring it back — that counts
      buzz('dogdrop',[8,22,8],600);
    }
  }
  if(st.winner==='EAT'&&bowl.food&&Math.hypot(d[0]-bowl.p.x,d[2]-bowl.p.z)<.85){
    _dogEatT+=dt;argos.mind.iv.hunger=Math.max(0,argos.mind.iv.hunger-dt*.10);
    if(_dogEatT>bowl.meal||argos.mind.iv.hunger<0.3){bowl.food=false;_dogEatT=0;
      BOND.v=Math.min(1,BOND.v+.1)} // fed by your hand — remembered
  }
  for(const ev of argos.events)if(ev.type==='bark'){buzz('dogbark',[16,36,12],900);chat.line('dog','WOOF')}
  dogMind.interest=clamp(1-argos.mind.iv.fatigue,0,1);
  dogMind.obey=argos.world.handPose==='lure'?.8:0;
  dogMind.look.set(d[0],d[1],d[2]);
  syncDogVisual();
}
function argosReset(){
  seatDog(TR.x-2.1,TR.z-2.4);
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
  if(TRUCK.on){ // the stick belongs to the wheel; the body rides
    updateMobileLook(dt);syncMobileInstrumentVisibility();
    locomotion.inputMoving=false;
    locomotion.walking=lerp(locomotion.walking,0,1-Math.exp(-dt*9));
    locomotion.drive=lerp(locomotion.drive,0,1-Math.exp(-dt*7));
    game.run=lerp(game.run,0,1-Math.exp(-dt*12));
    return;
  }
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
  if(TRUCK.on){
    // THE DRIVING EYE — III's pan, with the one thing a driver needs: the
    // eye falls in BEHIND the nose whenever the rig is rolling, so the road
    // ahead is always the road on screen. Distance and height stay whatever
    // you chose; the LOOK stick re-aims and re-frames, and letting go lets
    // the eye swing back behind you.
    const target=new THREE.Vector3(TRUCK.x,TRUCK.group.position.y+1.0+(TRUCK.airY||0)*.6,TRUCK.z);
    CAMR.dist=CAMR.dist||12;CAMR.high=CAMR.high||5.0;
    // towing, the eye climbs and drops back so the load never becomes the view
    if((CAMR.hold||0)<=0){
      const wantD=TRUCK.hitched?20:12,wantH=TRUCK.hitched?10:5.0,ck=1-Math.exp(-dt*1.6);
      CAMR.dist=lerp(CAMR.dist,wantD,ck);CAMR.high=lerp(CAMR.high,wantH,ck);
    }
    if(explorer.touchLookMag>.02){
      CAMR.az=explorer.cameraYaw;
      CAMR.high=clamp(Math.sin(explorer.cameraPitch)*CAMR.dist+.4,1.2,CAMR.dist*.9);
      CAMR.hold=1.1;                                   // your framing stands a moment
    }else if((CAMR.hold=Math.max(0,(CAMR.hold||0)-dt))<=0&&TRUCK.speed>1.2){
      // realign only while moving — parked, the eye holds still and lets you look
      // towing, the eye rides off the shoulder: the road ahead, the rig, and
      // the load all in frame instead of a wall of trailer
      const behind=TRUCK.yaw+Math.PI+(TRUCK.hitched?0.62:0);
      CAMR.az=lerpAngle(CAMR.az??behind,behind,1-Math.exp(-dt*(1.1+TRUCK.speed*.10)));
    }
    if(CAMR.az==null)CAMR.az=TRUCK.yaw+Math.PI+(TRUCK.hitched?0.62:0);
    const desired=new THREE.Vector3(
      target.x+Math.sin(CAMR.az)*CAMR.dist,
      target.y+CAMR.high,
      target.z+Math.cos(CAMR.az)*CAMR.dist);
    camera.position.lerp(desired,1-Math.exp(-dt*5.5));
    controls.target.lerp(target,1-Math.exp(-dt*9));
    camera.lookAt(controls.target);
    return;
  }
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
  el.addEventListener('pointerdown',e=>{if(pointer!=null)return;if(kind==='move')window.__exitFreeCam?.();enterTravelMode();pointer=e.pointerId;el.setPointerCapture(pointer);el.classList.add('live');const r=el.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;set(e);e.preventDefault()},{passive:false});
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
// taking the drive stick means travelling: the free camera yields to the follow cam
window.__exitFreeCam=()=>{if(view3d)$('#viewBtn').click()};
$('#styleBtn').onclick=()=>{ink=!ink;$('#styleBtn').classList.toggle('on',ink);rig.mesh.material=ink?new THREE.MeshBasicMaterial({color:0x000000}):rig.mesh.userData.whiteMat;rig.outline.visible=!ink};
rig.mesh.userData.whiteMat=rig.mesh.material;
$('#resetBtn').onclick=()=>resetAll();$('#quickReset').onclick=()=>{if(view3d){view3d=false;controls.enabled=false;document.body.classList.remove('free-camera');$('#viewBtn').classList.remove('on');$('#viewBtn').textContent='CAM'}resetAll()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{stopMotion();mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('on',x.dataset.mode===mode));updateReadout()});
addEventListener('keydown',e=>{
  const ae=document.activeElement;if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')){if(e.code==='Escape')ae.blur();return}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){explorer.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault()}
  if(e.repeat)return;if(e.code==='Space'){e.preventDefault();TRUCK.on?truckJump():gameCommand('jump')}else if(e.key==='c'||e.key==='C')gameCommand('crouch',1);else if(e.key==='h'||e.key==='H')gameCommand('hide',1);else if(e.key==='g'||e.key==='G')gameCommand('guard',1);else if(e.key==='f'||e.key==='F')gameCommand('strike');else if(e.key==='v'||e.key==='V')$('#viewBtn').click();else if(e.key==='e'||e.key==='E'){if(TRUCK.on)exitTruck();else if(Math.hypot(TRUCK.x-locomotion.root.x,TRUCK.z-locomotion.root.z)<3.4)boardTruck()}
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
function tick(t){requestAnimationFrame(tick);let dt=Math.min(.025,Math.max(0,(t-last)/1000));last=t;updateExplorer(dt);worldStep(dt);updateMotorPrior(dt);support.position.x=locomotion.root.x;support.position.z=locomotion.root.z;support.position.y=groundYAt(locomotion.root.x,locomotion.root.z)+.003;updateDog(t,dt);updateExplorerCamera(dt); updateGame(dt);updateDataPlayback(dt);if(motionPlayer.active&&motionPlayer.mixer){motionPlayer.mixer.update(dt);enforceAnimationAnatomy();muscleFilterPose(dt);updateViz();const auxNow=performance.now();tick._auxAt??=0;if(!IS_TOUCH||auxNow-tick._auxAt>48){tick._auxAt=auxNow;updateDataBus();updateReadout()}window.__hudTick&&window.__hudTick();if(LIVE.shake>0){camera.position.x+=(Math.random()*2-1)*LIVE.shake;camera.position.y+=(Math.random()*2-1)*LIVE.shake*.6;camera.position.z+=(Math.random()*2-1)*LIVE.shake}renderer.render(scene,camera);return}
// Mobile renders every frame but solves the expensive collision-aware body at 40 Hz.
// This preserves responsive sticks/camera while cutting repeated IK/capsule work.
tick._solveAcc=(tick._solveAcc||0)+dt;if(IS_TOUCH&&tick._solveAcc<1/40){renderer.render(scene,camera);return}if(IS_TOUCH){dt=Math.min(.04,tick._solveAcc);tick._solveAcc=0}else tick._solveAcc=0;
relaxJoyBases(dt);const sm=1-Math.exp(-dt*5.5);motion.pitch=lerp(motion.pitch,motion.enabled?motion.targetPitch:0,sm);motion.roll=lerp(motion.roll,motion.enabled?motion.targetRoll:0,sm);const nd=Math.exp(-dt*8.5);motion.nudge.L.multiplyScalar(nd);motion.nudge.R.multiplyScalar(nd);motion.nudge.body.multiplyScalar(nd);const hs=1-Math.exp(-dt*(headCtl.pointer!=null?11.5:6.2));headDyn.x=lerp(headDyn.x,resistedAxis(headCtl.x,.05,2.0),hs);headDyn.y=lerp(headDyn.y,resistedAxis(headCtl.y,.05,2.0),hs);if(headCtl.pointer==null)headCtl.wind=lerp(headCtl.wind,0,1-Math.exp(-dt*4.1));headDyn.roll=lerp(headDyn.roll,resistedAxis(headCtl.wind,.02,1.7),1-Math.exp(-dt*5.4));headDyn.lead=lerp(headDyn.lead,headCtl.lead,1-Math.exp(-dt*(headCtl.pointer!=null?8.5:4.2)));headDyn.faceX=lerp(headDyn.faceX,headCtl.faceX,1-Math.exp(-dt*8.0));headDyn.faceY=lerp(headDyn.faceY,headCtl.faceY,1-Math.exp(-dt*8.0));limits.leftHand=limits.rightHand=limits.pelvis=limits.head=false;contacts.leftHand=contacts.rightHand=contacts.leftFoot=contacts.rightFoot=contacts.pelvis=false;let des=desiredTargets();updateWholeBodyLocomotion(des,dt);des=desiredTargets();const m=MODE[mode];const prevLH=dyn.leftHand.p.clone(),prevRH=dyn.rightHand.p.clone(),prevPel=dyn.pelvis.p.clone(),prevLF=dynFeet.left.p.clone(),prevRF=dynFeet.right.p.clone();spring(dyn.leftHand,des.leftHand,dt,m.freq*.82,Math.max(1.18,m.damp+.22),m.gravity);spring(dyn.rightHand,des.rightHand,dt,m.freq*.82,Math.max(1.18,m.damp+.22),m.gravity);spring(dyn.pelvis,des.pelvis,dt,m.freq+1.2,1.16,0);spring(dynFeet.left,des.leftFoot,dt,5.6,1.18,0);spring(dynFeet.right,des.rightFoot,dt,5.6,1.18,0);clampVecStep(dyn.leftHand.p,prevLH,0.88*dt);clampVecStep(dyn.rightHand.p,prevRH,0.88*dt);const travelSpeed=locomotion.walking>.08?Math.max(.9,explorer.speed):0;const pelvisStep=travelSpeed?Math.max(1.35,travelSpeed*1.18):.66,footStep=travelSpeed?Math.max(1.8,travelSpeed*1.65):.74;clampVecStep(dyn.pelvis.p,prevPel,pelvisStep*dt);clampVecStep(dynFeet.left.p,prevLF,footStep*dt);clampVecStep(dynFeet.right.p,prevRF,footStep*dt);clampVel(dyn.leftHand.v,1.45);clampVel(dyn.rightHand.v,1.45);clampVel(dyn.pelvis.v,travelSpeed?Math.max(1.6,travelSpeed*1.35):1.0);clampVel(dynFeet.left.v,travelSpeed?Math.max(2.0,travelSpeed*1.8):1.05);clampVel(dynFeet.right.v,travelSpeed?Math.max(2.0,travelSpeed*1.8):1.05);solveRig(des,dt);updateViz();tick._teleAt??=0;const teleNow=performance.now();if(!IS_TOUCH||teleNow-tick._teleAt>32){tick._teleAt=teleNow;updateControllerTelemetry()}tick._hapAt??=0;const hapNow=performance.now();if(!IS_TOUCH||!explorer.mobileNav||hapNow-tick._hapAt>66){tick._hapAt=hapNow;updateHaptics()}const auxNow=performance.now();tick._auxAt??=0;if(!IS_TOUCH||!explorer.mobileNav||auxNow-tick._auxAt>48){tick._auxAt=auxNow;updateDataBus();updateReadout()}window.__hudTick&&window.__hudTick();if(LIVE.shake>0){camera.position.x+=(Math.random()*2-1)*LIVE.shake;camera.position.y+=(Math.random()*2-1)*LIVE.shake*.6;camera.position.z+=(Math.random()*2-1)*LIVE.shake}renderer.render(scene,camera)}requestAnimationFrame(tick);


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
    ball:{state:(ball.state==='hero'||ball.state==='rig')?'free':ball.state,p:[ball.p.x,ball.p.y,ball.p.z],v:[ball.v.x,ball.v.y,ball.v.z]},
    bowl:{food:bowl.food,meal:bowl.meal},weather:WEATHER.current,
    bond:BOND.v,
    truck:{x:TRUCK.x,z:TRUCK.z,yaw:TRUCK.yaw,hitched:TRUCK.hitched},
    trailer:{ox:TRAILER.ox,oz:TRAILER.oz,yaw:TRAILER.yaw},
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
    if(typeof rec.bond==='number')BOND.v=clamp(rec.bond,0,1);
    if(rec.trailer&&(rec.trailer.ox||rec.trailer.oz)){
      setPad(TR0.x+rec.trailer.ox,TR0.z+rec.trailer.oz);
      const oy=rawTerrain(TR0.x+rec.trailer.ox,TR0.z+rec.trailer.oz)-PAD.datum;
      applyTrailerOffset(rec.trailer.ox,rec.trailer.oz,oy,rec.trailer.yaw||0);
      buildTerrainMesh._keepDress=!!(terrainMesh&&terrainMesh.material.map);
      buildTerrainMesh();
    }
    if(rec.truck){TRUCK.x=rec.truck.x;TRUCK.z=rec.truck.z;TRUCK.yaw=rec.truck.yaw||0;TRUCK.hitched=false;truckPlace()}
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
    if(who==='world'&&/closed|refus|failed|cannot|error/i.test(text)&&!document.body.classList.contains('diag-open'))
      $('#menuFab')?.classList.add('live');
    const log=$('#chatLog');if(!log)return;
    // the same word again is one line growing, not a wall: WOOF ×8
    const last=log.lastElementChild;
    if(last&&last.dataset.who===who&&last.dataset.raw===text){
      const n=(+last.dataset.n||1)+1;last.dataset.n=n;last.textContent=text+' ×'+n;
      log.scrollTop=log.scrollHeight;return;
    }
    const el=document.createElement('div');el.className='line '+who;el.textContent=text;
    el.dataset.who=who;el.dataset.raw=text;
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
      else if(cmd==='live'){r=null;LIVE.toggle()}
      else if(cmd==='what'||cmd==='todo'){r=null;tellWhat()}
      else if(cmd==='golf'){GAMES.mode==='golf'?GAMES.end():GAMES.start('golf');r=null}
      else if(cmd==='ctf'){GAMES.mode==='ctf'?GAMES.end():GAMES.start('ctf');r=null}
      else if(cmd==='deed'){const nm=text.slice(6).trim();
        if(!nm)r='say: /deed <a name for this land>';
        else if(!TERRAIN.geo)r='this land has no registration to keep';
        else{try{const ds=JSON.parse(localStorage.getItem('hlidarendi.deeds')||'[]');
          ds.push({name:nm.slice(0,28),lat:TERRAIN.geo.lat,lon:TERRAIN.geo.lon});
          localStorage.setItem('hlidarendi.deeds',JSON.stringify(ds.slice(-12)));
          window.__renderDeeds?.();r='▲ the deed is kept — "'+nm.slice(0,28)+'" stands in the land list'}
        catch(e){r='the deed could not be kept'}}}
      else if(cmd==='build'){const p2=text.slice(6).trim()||'cairn';buildFromWords(p2);
        r=/\b(car|truck|rig|vehicle|van|jeep|buggy|lorry|pickup|racer)\b/i.test(p2)?null:'forging "'+p2+'" on the land ahead…'}
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
        if(k2==='off'){AI.off();r='AI OFF — the agent uses stand-ins'}
        else if(!k2){window.__openAI?.();r='the agent line — endpoint, model and key'}
        else{AI.key=k2;AI.save();r='agent line configured — 🗲 AGENT mode and /build speak to it now'}
        window.__refreshAI?.()}
      else if(WEATHER.presets[cmd])r=WEATHER.set(cmd)?('the sky turns — '+cmd):'…';
      else if(cmd==='forget'){try{localStorage.removeItem('hlidarendi.v1')}catch(e){}r='forgotten — next visit starts fresh'}
      else if(cmd==='help')r='/what (what there is to do) · /build <words> (a tower, a trailer, a truck…) · games: /striker /golf /ctf · /live (quakes + aircraft on this land) · land: /place <name> /goto <lat> <lon> /deed <name> · /ai (open the agent line — Anthropic, a proxy, or any OpenAI-compatible gateway; then 🗲 AGENT turns a sentence into weather, land and errands) · /save /reset /feed /ball /forget · sky: /dawn /day /dusk /night /fog /rain · the RIG: DRIVE (or E), HITCH at the home’s tongue to haul, roll over the ball to stow it, FIRE launches';
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
// the log — the dog's and the world's words, folded under the one top line
const setLog=v=>{document.body.classList.toggle('log-open',v);$('#sayBtn')?.classList.toggle('on',v)};
const openLog=()=>setLog(true);
setLog(true);
chat.line('world','HLIÐARENDI — a body, a dog, a dwelling, a place. Speak, or /help.');
// WHAT IS THERE TO DO HERE. Not a quest log — a list of the consequential
// things this world actually supports, in the order they teach each other.
function tellWhat(){
  openLog();
  const lines=[
    'ARGOS — FEED near him (HAND) or fill the galley bowl; FIRE throws the ball, and he decides whether to fetch. Feeding and returned balls deepen the bond; a deep bond brings him after you across the whole land.',
    'THE RIG — DRIVE (or E) at the truck. It starts hitched to the home: haul it anywhere, DROP to set it down, and the land levels under the new site.',
    'BUILD — the 🗲 line forges structures: "a watchtower", "a caravan", "a stone cairn". Say "a red racer rig" at the wheel and the truck itself changes. /ai <key> lets Claude design them.',
    'THE LAND — ▲ opens the deeds: Gunnar\'s farm, Njáll\'s farm, Þórsmörk. /place <anywhere on earth>, then /deed <name> to keep it.',
    'GAMES — /striker (the dog plays for himself), /golf (a pin far out), /ctf (he hunts the flag carrier).',
    'LISTEN — /live shows the real quakes under Iceland and the aircraft overhead. A close tremor shakes the ground and sends him looking for you.'
  ];
  chat.line('world','WHAT THERE IS TO DO HERE —');
  for(const l of lines)chat.line('world','· '+l);
}
const on=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
// ---- THE SHELL — Thunder Rigs' header law: play mode vs menu mode ----------
// Default is PLAY MODE: a clean screen, just the world and the citizens.
// ≡ opens the sectioned toolbars (and the agent bar); ✕, ▶ PLAY, or tapping
// the world returns to play. ⚠ toggles the diagnostics readout and lights
// amber when the world reports a closed line. ● REC records the canvas.
{
  const body=document.body;
  const enterPlay=()=>{body.classList.add('play-mode');body.classList.remove('menu-open','land-open')};
  const openMenu=()=>{body.classList.remove('play-mode','land-open');body.classList.add('menu-open')};
  enterPlay();
  on('#menuFab',()=>{$('#menuFab')?.classList.remove('live');body.classList.contains('menu-open')?enterPlay():openMenu()});
  on('#playFab',enterPlay);
  document.querySelectorAll('.tb-toggle').forEach(b=>b.addEventListener('click',()=>{
    const t=document.getElementById(b.dataset.target);t?.classList.toggle('collapsed');
  }));
  $('#gl')?.addEventListener('pointerdown',()=>{if(body.classList.contains('menu-open')||body.classList.contains('land-open'))enterPlay()},true);
  on('#diagBtn',()=>{body.classList.toggle('diag-open');$('#menuFab')?.classList.remove('live')});
  // ▲ THE LAND — places load like cartridges: the deed list under the header
  on('#landBtn',()=>{
    if(body.classList.contains('land-open'))enterPlay();
    else{body.classList.remove('play-mode','menu-open');body.classList.add('land-open')}
  });
  $('#landMenu')?.addEventListener('click',e=>{
    const b=e.target.closest('.land-item');if(!b)return;
    enterPlay();openLog();
    const k=b.dataset.land;
    if(b.dataset.lat)chat.say('/goto '+b.dataset.lat+' '+b.dataset.lon);
    else if(k==='place'){const i=$('#agentSay');if(i){i.value='/place ';i.focus()}}
    else if(k==='dress'){chat.line('world','calling on the living ground…');
      dressWorld().then(t=>chat.line('world','dressed — '+t+' tiles · imagery © Esri · ways © OpenStreetMap'))
        .catch(e2=>chat.line('world','the imagery line is closed here — '+String(e2.message||e2).slice(0,40)))}
    else if(k==='live')LIVE.toggle();
    else if(k==='save'){saveWorld();chat.line('world','the land is kept')}
  });
  // deeds you keep yourself join the land list (/deed <name>)
  window.__renderDeeds=()=>{
    const menu=$('#landMenu');if(!menu)return;
    menu.querySelectorAll('.land-item.deed').forEach(el=>el.remove());
    let ds=[];try{ds=JSON.parse(localStorage.getItem('hlidarendi.deeds')||'[]')}catch(e){}
    const anchor=menu.querySelector('[data-land="place"]');
    for(const d2 of ds){
      const el=document.createElement('button');el.className='land-item deed';
      el.dataset.lat=d2.lat;el.dataset.lon=d2.lon;el.textContent='▲ '+d2.name+' — your deed';
      menu.insertBefore(el,anchor);
    }
  };
  window.__renderDeeds();
  // ● REC — the take is real: canvas capture through MediaRecorder, saved to
  // the player's files on stop. Honest about where the browser can't record.
  const rb=$('#recBtn');let mr=null,chunks=[];
  const canRec=!!(window.MediaRecorder&&renderer?.domElement?.captureStream);
  if(rb&&!canRec)rb.classList.add('dead');
  if(rb)rb.onclick=()=>{
    if(!canRec){chat.line('world','this browser cannot record the canvas');return}
    if(mr){mr.stop();return}
    try{
      const stream=renderer.domElement.captureStream(30);
      const mime=['video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
      mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks=[];
      mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
      mr.onstop=async()=>{
        const type=mr.mimeType||'video/webm';mr=null;rb.classList.remove('on');
        const blob=new Blob(chunks,{type}),name='hlidarendi-take'+(/mp4/.test(type)?'.mp4':'.webm');
        // hosted as an artifact, saves go through the viewer's confirmed
        // download surface; standing on its own page, a plain anchor serves.
        const dl=(window.claude&&typeof window.claude.use==='function')?await window.claude.use('downloads').catch(()=>null):null;
        if(dl){
          try{await dl.save({filename:name,data:blob});chat.line('world','the take is saved to your files')}
          catch(e){chat.line('world',e&&e.code==='declined'?'the take was let go':'the take could not be saved — '+String((e&&e.message)||e).slice(0,40))}
        }else{
          const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
          a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
          chat.line('world','the take is saved to your files');
        }
      };
      mr.start(250);rb.classList.add('on');chat.line('world','● recording — REC again to keep the take');
    }catch(e){mr=null;rb.classList.remove('on');chat.line('world','recording failed — '+String(e.message||e).slice(0,50))}
  };
}
// ---- the ONE LINE: speak to the dog and the terrarium, or — under the
// lightning — summon structures through the forge. The log folds beneath it.
{
  const ag=$('#agentSay'),st2=$('#agentStatus');
  const refreshAI=()=>{if(st2)st2.textContent=AI.on()
    ?'● AI ON · '+AI.model+' · '+(AI.dialect==='openai'?'gateway':AI.dialect==='anthropic'?'anthropic':'proxy')+' · tap to change'
    :'● AI OFF · stand-ins · tap to configure'};
  refreshAI();window.__refreshAI=refreshAI;
  // THE PANEL. Everything the line needs, in one place, with a TEST that says
  // what actually went wrong instead of failing quietly on the next sentence.
  const aiOut=(msg,cls)=>{const o2=$('#aiOut');if(!o2)return;o2.textContent=msg||'';o2.className=cls||''};
  const openAI=()=>{
    $('#aiDialect').value=AI.dialect;$('#aiBase').value=AI.base;
    $('#aiModel').value=AI.model;$('#aiKey').value=AI.key;
    aiOut(AI.on()?'connected — '+AI.base:'not connected');
    document.body.classList.add('ai-open');document.body.classList.remove('menu-open','land-open');
    setTimeout(()=>$('#aiKey')?.focus(),60);
  };
  window.__openAI=openAI;
  const readAI=()=>{AI.dialect=$('#aiDialect').value;AI.base=$('#aiBase').value.trim()||AI.base;
    AI.model=$('#aiModel').value.trim()||AI.model;AI.key=$('#aiKey').value.trim()};
  on('#aiDialect',null);
  $('#aiDialect')?.addEventListener('change',()=>{
    const d=$('#aiDialect').value,b=$('#aiBase');
    if(d==='anthropic')b.value='https://api.anthropic.com/v1/messages';
    else if(d==='openai'&&!/chat\/completions/.test(b.value))b.value='https://your-gateway.example/v1/chat/completions';
    else if(d==='anthropic-proxy'&&/api\.anthropic\.com/.test(b.value))b.value='https://your-proxy.example/v1/messages';
  });
  on('#aiSave',()=>{readAI();AI.save();refreshAI();
    chat.line('world',AI.on()?'the agent line is open — 🗲 AGENT mode speaks to it, /build forges through it':'the agent line is closed — stand-ins answer');
    document.body.classList.remove('ai-open')});
  on('#aiOff',()=>{AI.off();refreshAI();aiOut('disconnected — the stand-ins answer now');
    $('#aiKey').value='';$('#aiBase').value=AI.base;$('#aiDialect').value=AI.dialect});
  on('#aiTest',async()=>{readAI();aiOut('asking…');
    try{const t=await AI.test();aiOut('the line answers: '+t,'ok')}
    catch(e){aiOut(String(e.message||e),'bad')}
    refreshAI()});
  $('#aiPanel')?.addEventListener('pointerdown',e=>{if(e.target&&e.target.id==='aiPanel')document.body.classList.remove('ai-open')});
  let barMode='speak';
  const setBarMode=m=>{barMode=m;
    const tag=$('#agentTag');if(tag)tag.textContent=m==='agent'?'AGENT':'SPEAK';
    $('#modeBtn')?.classList.toggle('on',m==='agent');
    if(ag)ag.placeholder=m==='agent'?'ask the world — build a watchtower, turn the sky, take us to Þórsmörk…':'speak — words reach the dog and the terrarium · /help';
  };
  setBarMode('speak');
  on('#modeBtn',()=>setBarMode(barMode==='agent'?'speak':'agent'));
  on('#logBtn',()=>setLog(!document.body.classList.contains('log-open')));
  on('#sayBtn',()=>setLog(!document.body.classList.contains('log-open')));
  if(st2)st2.onclick=openAI;
  $('#agentForm')?.addEventListener('submit',e=>{
    e.preventDefault();const t=(ag?.value||'').trim();if(!t)return;ag.value='';
    openLog();
    if(barMode==='agent'&&t[0]!=='/')askAgent(t);
    else chat.say(t);
    if(IS_TOUCH)ag?.blur();
  });
  const prefill=v=>{setBarMode('speak');openLog();if(ag){ag.value=v;if(!IS_TOUCH)ag.focus()}};
  on('#buildBtn',()=>{setBarMode('agent');ag?.focus()});
  on('#speakBtn',()=>{setBarMode('speak');openLog();ag?.focus()});
  on('#aiBtn',()=>{window.__openAI?.()});
  on('#gotoBtn',()=>prefill('/goto 63.7422 -20.1080'));
  on('#placeBtn',()=>prefill('/place '));
  on('#dressBtn',()=>{openLog();chat.line('world','calling on the living ground…');
    dressWorld().then(t=>chat.line('world','dressed — '+t+' tiles · imagery © Esri · ways © OpenStreetMap'))
      .catch(e=>chat.line('world','the imagery line is closed here — '+String(e.message||e).slice(0,40)))});
  document.querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>{
    openLog();chat.line('you','⚒ '+b.dataset.build);buildFromWords(b.dataset.build);
  }));
  document.querySelectorAll('[data-sky]').forEach(b=>b.addEventListener('click',()=>{
    WEATHER.set(b.dataset.sky);chat.line('world','the sky turns — '+b.dataset.sky);
  }));
  on('#forgetBtn',()=>chat.say('/forget'));
  on('#rigBtn',()=>{TRUCK.on?exitTruck():boardTruck()});
  on('#hitchBtn',()=>{TRUCK.hitched?unhitchTrailer():hitchTrailer()});
  on('#jumpBtn',()=>{TRUCK.on?truckJump():gameCommand('jump')});
  const bb2=$('#boostBtn');
  if(bb2){const dn=e=>{e.preventDefault();explorer.boostHold=true;bb2.classList.add('on')};
    const up=()=>{explorer.boostHold=false;bb2.classList.remove('on')};
    bb2.addEventListener('pointerdown',dn);bb2.addEventListener('pointerup',up);bb2.addEventListener('pointercancel',up);bb2.addEventListener('pointerleave',up)}
  on('#strikerBtn',()=>chat.say('/striker'));
  on('#golfBtn',()=>chat.say('/golf'));
  on('#ctfBtn',()=>chat.say('/ctf'));
  on('#barMin',()=>document.body.classList.add('bar-min'));
  on('#barChip',()=>document.body.classList.remove('bar-min'));
}
on('#saveBtn',saveWorld);
on('#ballBtn',()=>{
  if(ball.state==='hero')throwBall();
  else if(ball.state==='rig'){
    if(TRUCK.on)launchBall();
    else if(Math.hypot(TRUCK.x-locomotion.root.x,TRUCK.z-locomotion.root.z)<2.4){ball.state='hero';buzz('take',8,300)}
    else{openLog();chat.line('world','the ball rides the rig — drive, or fetch it from the bed')}
  }
  else if(TRUCK.on&&ball.state==='free'&&Math.hypot(ball.p.x-TRUCK.x,ball.p.z-TRUCK.z)<3.5){
    ball.state='rig';buzz('stow',[8,18,8],500); // reach from the cab: the bed takes it
  }
  else if(!takeBall()){
    // no ball at hand? then a stone. FIRE is never a dead button.
    throwStone();
    if(ball.state==='dog')chat.line('world','Argos holds the ball — you throw a stone instead');
  }
  updateWorldUI();
});
on('#feedBtn',()=>{feedBowl();updateWorldUI()});
// ---- THE CITIZENS ANNOUNCE THEMSELVES — floating names over the actors and
// the dwelling (Everybody · Argos · Ingold ▼), projected through the one
// camera on the one clock. They dim with distance and hide behind you.
{
  const layer=document.createElement('div');layer.id='labels';document.body.appendChild(layer);
  const mk=(name,mark)=>{const d=document.createElement('div');d.className='elabel';
    d.innerHTML='<span>'+name+'</span>'+(mark?'<span class="mark">▼</span>':'');layer.appendChild(d);return d};
  const LBL={hero:mk('Everybody'),dog:mk('Argos'),home:mk('Ingold',true),rig:mk('Rig')};
  const pv=new THREE.Vector3();
  const put=(el,x,y,z,far)=>{
    pv.set(x,y,z).project(camera);
    const off=pv.z>1||pv.x<-1.1||pv.x>1.1||pv.y<-1.15||pv.y>1.15;
    el.style.display=off?'none':'flex';if(off)return;
    el.style.transform='translate('+(((pv.x*.5+.5)*innerWidth)|0)+'px,'+((((-pv.y*.5+.5)*innerHeight)|0))+'px) translate(-50%,-100%)';
    el.classList.toggle('dim',!!far);
  };
  window.__hudTick=()=>{
    const r=locomotion.root;
    put(LBL.hero,r.x,groundYAt(r.x,r.z)+2.15,r.z,false);
    const d=argos.world.dog,dd=Math.hypot(d[0]-r.x,d[2]-r.z);
    put(LBL.dog,d[0],PLACE.ground.heightAtDog(d[0],d[2])+1.05,d[2],dd>26);
    const hd=Math.hypot(TR.x-r.x,TR.z-r.z);
    put(LBL.home,TR.x,terrainH(TR.x,TR.z)+3.6,TR.z,hd>40);
    if(TRUCK.on)LBL.rig.style.display='none';
    else{const td=Math.hypot(TRUCK.x-r.x,TRUCK.z-r.z);put(LBL.rig,TRUCK.x,terrainH(TRUCK.x,TRUCK.z)+2.3,TRUCK.z,td>24)}
    // contextual chips: the rig offers itself, the tongue offers the hitch
    const rb3=$('#rigBtn'),hb3=$('#hitchBtn');
    if(rb3){const dT=Math.hypot(TRUCK.x-r.x,TRUCK.z-r.z);
      rb3.style.display=(TRUCK.on||dT<3.4)?'':'none';
      rb3.textContent=TRUCK.on?'EXIT':'DRIVE';rb3.classList.toggle('on',TRUCK.on)}
    if(hb3){let show=false;
      const hh=trailerHitchWorld();
      if(TRUCK.on){if(TRUCK.hitched)show=true;
        else show=Math.hypot(TRUCK.x-hh.x,TRUCK.z-hh.z)<7}
      hb3.style.display=show?'':'none';hb3.textContent=TRUCK.hitched?'DROP':'HITCH';
      // the tongue lights when a rig is near enough to matter
      tongueMark.visible=TRUCK.on&&!TRUCK.hitched&&Math.hypot(TRUCK.x-hh.x,TRUCK.z-hh.z)<20;
      if(tongueMark.visible)tongueMark.position.set(hh.x,PLACE.heightAt(hh.x,hh.z)+.85,hh.z)}
  };
}
// boot: hero wakes beside the trailer, on real ground, and the dog is nearby.
locomotion.root.y=groundYAt(locomotion.root.x,locomotion.root.z);
// the household starts COUPLED: the rig stands at the home's north tongue,
// nose to the open land, already hitched — take the wheel and the whole
// dwelling comes with you. (A save overrides this with where you left it.)
{
  TRUCK.yaw=Math.PI;                         // facing away from the home
  TRUCK.x=TR.x;TRUCK.z=TR.z-5.95;            // rear exactly on the tongue
  TRUCK.hitched=true;truckPlace();
  chat.line('world','the rig stands hitched at the home’s tongue — DRIVE and it all travels');
}
const remembered=restoreWorld();
if(!remembered)setTimeout(()=>{
  chat.line('world','You are at Hlíðarendi. The rig is hitched to your home; Argos is somewhere about.');
  chat.line('world','Say /what to see what this place is for — or just walk, and FEED him when you find him.');
},900);
updateWorldUI();
dressWorld().then(t=>{chat.line('world','the living ground answered — '+t+' imagery tiles, ways and buildings · imagery © Esri · ways © OpenStreetMap');})
  .catch(e=>{chat.line('world','the imagery line is closed here — procedural moss stands ('+String(e.message||e).slice(0,40)+')')});
window.HLIDARENDI={
  place:PLACE,structure:PLACE.structure,door:DOOR,weather:WEATHER,
  view:{camera,controls,scene},contact:CONTACT,
  actors:{hero:HERO_ACTOR,dog:ARGOS_ACTOR},argos,
  props:{ball,bowl},
  integration:INTEGRATION,
  save:saveWorld,restore:restoreWorld,takeBall,throwBall,feedBowl,placeHero,chat,
  forge:FORGE,build:buildFromWords,striker:STRIKER,goto:gotoPlace,ground:LIVING_GROUND,dress:dressWorld,
  truck:TRUCK,rig:{board:boardTruck,exit:exitTruck,hitch:hitchTrailer,drop:unhitchTrailer,spawn:spawnVehicle},fleet:FLEET,
  games:GAMES,live:LIVE,stone:STONE,seatDog,bond:BOND,trailerOffset:TRAILER,
  homeOf,worldOf,
  snapshot:()=>INTEGRATION.snapshot()
};
