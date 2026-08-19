/* ============================================================================
   INHABIT — does this thing work as a place to be, and can it be built?

   Everything before this judged the trailer as a picture: does it resemble the
   reference, can each part be seen, does a linter object. None of that asks
   whether two studs occupy the same cubic centimetre, whether a body fits
   through the door, whether the roof gets to the ground, or whether the thing
   is legal to tow.

   Pure geometry. No renderer, no THREE, no model. Runs in a page or under node:
       node agora/inhabit.js agora/trailer-finished.json
   ========================================================================== */
(function(global){
'use strict';

/* ---- dimensional standards, cited so they can be argued with --------------
   Towing envelope: US federal/state maxima — 8'6" wide, 13'6" high, measured
   from the ground. A tiny house on a trailer that exceeds either needs a permit
   for every mile it moves, which is the difference between a house and a load.
   Stair: IRC R311.7 — max riser 7 3/4", min tread 10". Door: IRC R311.2 — 32"
   clear width, 78" clear height. Headroom: IRC R305.1 — 7'0", and 6'8" over a
   portion. Light: IRC R303.1 — glazing not less than 8% of floor area.
   -------------------------------------------------------------------------- */
const STD = {
  roadWidth: 2.591, roadHeight: 4.115,
  riserMax: 0.1969, treadMin: 0.254,
  doorClearW: 0.813, doorClearH: 1.981,
  headroom: 2.134, headroomRelaxed: 2.032,
  glazingRatio: 0.08,
  egressArea: 0.53, egressMinDim: 0.508,
  bodyRadius: 0.25, passageMin: 0.559,
  collisionTol: 1e-4
};

/* ---- point-in-part, per primitive; a wheel is not its bounding box -------- */
function inv(rot){ return [-rot[0]||0,-rot[1]||0,-rot[2]||0] }
function rotY_XYZ(p,r){                     // apply Rz Ry Rx inverse (XYZ order)
  let [x,y,z]=p;
  const cz=Math.cos(-r[2]),sz=Math.sin(-r[2]); [x,y]=[x*cz-y*sz, x*sz+y*cz];
  const cy=Math.cos(-r[1]),sy=Math.sin(-r[1]); [x,z]=[x*cy+z*sy, -x*sy+z*cy];
  const cx=Math.cos(-r[0]),sx=Math.sin(-r[0]); [y,z]=[y*cx-z*sx, y*sx+z*cx];
  return [x,y,z];
}
function local(p,part){
  const q=part.position||[0,0,0], r=part.rotation||[0,0,0];
  return rotY_XYZ([p[0]-q[0],p[1]-q[1],p[2]-q[2]],r);
}
function inside(p,part){
  const s=part.size||[1,1,1], [x,y,z]=local(p,part);
  switch((part.kind||'box').toLowerCase()){
    case 'sphere':{ const r=Math.max(s[0],s[1],s[2])/2; return x*x+y*y+z*z<=r*r }
    case 'cylinder':{ const r=s[0]/2,h=s[1]/2; return Math.abs(y)<=h && x*x+z*z<=r*r }
    case 'cone':{ const r=s[0]/2,h=s[1]/2; if(Math.abs(y)>h)return false;
      const t=(h-y)/(2*h), rr=r*t; return x*x+z*z<=rr*rr }
    default: return Math.abs(x)<=s[0]/2 && Math.abs(y)<=s[1]/2 && Math.abs(z)<=s[2]/2;
  }
}
function aabb(part){
  const s=part.size||[1,1,1], q=part.position||[0,0,0], r=part.rotation||[0,0,0];
  let hx=s[0]/2, hy=s[1]/2, hz=s[2]/2;
  const k=(part.kind||'box').toLowerCase();
  if(k==='cylinder'||k==='cone'){ hx=hz=s[0]/2; hy=s[1]/2 }
  if(k==='sphere'){ const rr=Math.max(s[0],s[1],s[2])/2; hx=hy=hz=rr }
  const c=[Math.cos(r[0]||0),Math.cos(r[1]||0),Math.cos(r[2]||0)];
  const n=[Math.sin(r[0]||0),Math.sin(r[1]||0),Math.sin(r[2]||0)];
  const m=[[c[1]*c[2],-c[1]*n[2],n[1]],
           [n[0]*n[1]*c[2]+c[0]*n[2],-n[0]*n[1]*n[2]+c[0]*c[2],-n[0]*c[1]],
           [-c[0]*n[1]*c[2]+n[0]*n[2],c[0]*n[1]*n[2]+n[0]*c[2],c[0]*c[1]]];
  const e=[0,1,2].map(i=>Math.abs(m[i][0])*hx+Math.abs(m[i][1])*hy+Math.abs(m[i][2])*hz);
  return {min:[q[0]-e[0],q[1]-e[1],q[2]-e[2]],max:[q[0]+e[0],q[1]+e[1],q[2]+e[2]]};
}
function overlapBox(a,b){
  const lo=[0,1,2].map(i=>Math.max(a.min[i],b.min[i]));
  const hi=[0,1,2].map(i=>Math.min(a.max[i],b.max[i]));
  for(let i=0;i<3;i++) if(hi[i]<=lo[i]) return null;
  return {lo,hi,vol:(hi[0]-lo[0])*(hi[1]-lo[1])*(hi[2]-lo[2])};
}
function volumeOf(part){
  const s=part.size||[1,1,1], k=(part.kind||'box').toLowerCase();
  if(k==='cylinder') return Math.PI*(s[0]/2)**2*s[1];
  if(k==='cone')     return Math.PI*(s[0]/2)**2*s[1]/3;
  if(k==='sphere')   { const r=Math.max(s[0],s[1],s[2])/2; return 4/3*Math.PI*r**3 }
  return s[0]*s[1]*s[2];
}

/* ---- 1. COLLISION -------------------------------------------------------- */
function collisions(parts,opts){
  opts=opts||{};
  const boxes=parts.map(aabb), pairs=[];
  const N=Math.max(4,opts.samples||6);
  for(let i=0;i<parts.length;i++) for(let j=i+1;j<parts.length;j++){
    const ov=overlapBox(boxes[i],boxes[j]);
    if(!ov||ov.vol<=STD.collisionTol) continue;
    /* the AABBs overlapping is not interpenetration — sample the actual solids */
    let hit=0,tot=0;
    for(let a=0;a<N;a++) for(let b=0;b<N;b++) for(let c=0;c<N;c++){
      const p=[ov.lo[0]+(a+0.5)/N*(ov.hi[0]-ov.lo[0]),
               ov.lo[1]+(b+0.5)/N*(ov.hi[1]-ov.lo[1]),
               ov.lo[2]+(c+0.5)/N*(ov.hi[2]-ov.lo[2])];
      tot++; if(inside(p,parts[i])&&inside(p,parts[j])) hit++;
    }
    if(!hit) continue;
    const vol=ov.vol*hit/tot;
    const small=Math.min(volumeOf(parts[i]),volumeOf(parts[j]));
    pairs.push({a:parts[i].id,b:parts[j].id,volume:+vol.toFixed(6),
      fractionOfSmaller:+(vol/Math.max(1e-9,small)).toFixed(4)});
  }
  pairs.sort((x,y)=>y.fractionOfSmaller-x.fractionOfSmaller);
  /* Sheathing lapping a stud by a millimetre is a modelling tolerance. A gable
     80% inside a wall plate is two objects in one place. Tiered, not thresholded
     into a single verdict. */
  const gross=pairs.filter(p=>p.fractionOfSmaller>0.25);
  const moderate=pairs.filter(p=>p.fractionOfSmaller>0.05&&p.fractionOfSmaller<=0.25);
  const tolerance=pairs.filter(p=>p.fractionOfSmaller<=0.05);
  return {count:pairs.length,gross:gross.length,moderate:moderate.length,
    tolerance:tolerance.length,significant:gross.length+moderate.length,
    worst:pairs.slice(0,12),grossPairs:gross.slice(0,10),
    totalVolume:+pairs.reduce((s,p)=>s+p.volume,0).toFixed(5)};
}

/* ---- 2. the voxel body: envelope, headroom, standable floor -------------- */
function voxelize(parts,cell){
  const bs=parts.map(aabb);
  const lo=[0,1,2].map(i=>Math.min(...bs.map(b=>b.min[i]))-cell*2);
  const hi=[0,1,2].map(i=>Math.max(...bs.map(b=>b.max[i]))+cell*2);
  const n=[0,1,2].map(i=>Math.max(1,Math.ceil((hi[i]-lo[i])/cell)));
  const solid=new Uint8Array(n[0]*n[1]*n[2]);
  const owner=new Int32Array(n[0]*n[1]*n[2]).fill(-1);
  const idx=(a,b,c)=>(a*n[1]+b)*n[2]+c;
  parts.forEach((part,pi)=>{
    const bb=bs[pi];
    const a0=Math.max(0,Math.floor((bb.min[0]-lo[0])/cell)), a1=Math.min(n[0]-1,Math.ceil((bb.max[0]-lo[0])/cell));
    const b0=Math.max(0,Math.floor((bb.min[1]-lo[1])/cell)), b1=Math.min(n[1]-1,Math.ceil((bb.max[1]-lo[1])/cell));
    const c0=Math.max(0,Math.floor((bb.min[2]-lo[2])/cell)), c1=Math.min(n[2]-1,Math.ceil((bb.max[2]-lo[2])/cell));
    for(let a=a0;a<=a1;a++)for(let b=b0;b<=b1;b++)for(let c=c0;c<=c1;c++){
      const p=[lo[0]+(a+0.5)*cell,lo[1]+(b+0.5)*cell,lo[2]+(c+0.5)*cell];
      if(inside(p,part)){ const k=idx(a,b,c); solid[k]=1; if(owner[k]<0)owner[k]=pi }
    }
  });
  return {lo,hi,n,cell,solid,owner,idx,
    at:(a,b,c)=>(a<0||b<0||c<0||a>=n[0]||b>=n[1]||c>=n[2])?0:solid[idx(a,b,c)],
    world:(a,b,c)=>[lo[0]+(a+0.5)*cell,lo[1]+(b+0.5)*cell,lo[2]+(c+0.5)*cell]};
}
function floodExterior(V){
  const {n,idx,solid}=V, seen=new Uint8Array(solid.length), q=[0];
  seen[0]=1;
  const nb=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  while(q.length){
    const k=q.pop(), c=k%n[2], b=((k-c)/n[2])%n[1], a=Math.floor(k/(n[1]*n[2]));
    for(const [da,db,dc] of nb){
      const A=a+da,B=b+db,C=c+dc;
      if(A<0||B<0||C<0||A>=n[0]||B>=n[1]||C>=n[2])continue;
      const K=idx(A,B,C);
      if(seen[K]||solid[K])continue;
      seen[K]=1; q.push(K);
    }
  }
  return seen;
}

/* ---- 3. the dwelling report ---------------------------------------------- */
function assess(parts,opts){
  opts=opts||{};
  const cell=opts.cell||0.07;
  const out={standards:STD,parts:parts.length};

  out.collisions=collisions(parts,opts);

  const V=voxelize(parts,cell);
  const exterior=floodExterior(V);
  const {n,idx,solid}=V;

  /* interior air: not solid, not reachable from outside */
  let interiorCells=0;
  const interior=new Uint8Array(solid.length);
  for(let k=0;k<solid.length;k++) if(!solid[k]&&!exterior[k]){ interior[k]=1; interiorCells++ }
  /* Where the hole is, not just that there is one — a loop cannot repair
     'not enclosed'. Cells that ought to be indoors (above the deck, inside the
     sill rectangle) and are reachable from outside are leaks; clustered into
     boxes, they are the openings to close. */
  const sills=parts.filter(p=>/sill|deck/i.test(p.id)).map(aabb);
  const foot=sills.length?{
    x:[Math.min(...sills.map(b=>b.min[0])),Math.max(...sills.map(b=>b.max[0]))],
    z:[Math.min(...sills.map(b=>b.min[2])),Math.max(...sills.map(b=>b.max[2]))]}:null;
  const deckPart=parts.find(p=>/\bdeck\b/i.test(p.id));
  const deckTop=deckPart?aabb(deckPart).max[1]:0;
  const leaks=[];
  if(foot) for(let a=0;a<n[0];a++)for(let b=0;b<n[1];b++)for(let c=0;c<n[2];c++){
    const k=idx(a,b,c); if(solid[k]||!exterior[k])continue;
    const w=V.world(a,b,c);
    if(w[1]<=deckTop+cell||w[1]>V.hi[1]-cell)continue;
    if(w[0]<foot.x[0]||w[0]>foot.x[1]||w[2]<foot.z[0]||w[2]>foot.z[1])continue;
    leaks.push(w);
  }
  /* spreading a hundred thousand cells into Math.min overflows the stack */
  let leakBox=null;
  if(leaks.length){
    const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(const w of leaks) for(let i=0;i<3;i++){
      if(w[i]<mn[i])mn[i]=w[i]; if(w[i]>mx[i])mx[i]=w[i];
    }
    leakBox={min:mn.map(v=>+v.toFixed(3)),max:mx.map(v=>+v.toFixed(3))};
  }
  out.envelope={enclosedVolume:+(interiorCells*cell**3).toFixed(3),
    sealed:interiorCells>0,
    leakCells:leaks.length, leakVolume:+(leaks.length*cell**3).toFixed(3), leakBox,
    note:interiorCells? 'a volume exists that outside air cannot reach'
       : leaks.length? 'outside air reaches '+(+(leaks.length*cell**3).toFixed(2))+
         ' m³ of what should be indoors'
       : 'no enclosed volume and no shell to speak of'};

  /* the floor a body could stand on, and the head height over it */
  const deck=parts.find(p=>/\bdeck\b/i.test(p.id))||null;
  const floorY = deck ? aabb(deck).max[1] : 0;
  const fb=Math.round((floorY-V.lo[1])/cell);
  const cols=[]; let deckCells=0;
  for(let a=0;a<n[0];a++)for(let c=0;c<n[2];c++){
    let b=fb+1;
    if(V.at(a,b,c)) continue;                       // standing in a wall
    if(!interior[idx(a,b,c)]) continue;             // outdoors
    deckCells++;
    let h=0; while(b+h<n[1] && !V.at(a,b+h,c)) h++;
    cols.push({a,c,clear:h*cell});
  }
  const area=cell*cell;
  const clears=cols.map(x=>x.clear).sort((p,q)=>p-q);
  const q=f=>clears.length?clears[Math.min(clears.length-1,Math.floor(f*clears.length))]:0;
  out.headroom={
    interiorFloorArea:+(deckCells*area).toFixed(2),
    meanClear:+(clears.reduce((s,x)=>s+x,0)/Math.max(1,clears.length)).toFixed(3),
    minClear:+(clears[0]||0).toFixed(3), medianClear:+q(0.5).toFixed(3),
    areaOverFull:+(cols.filter(x=>x.clear>=STD.headroom).length*area).toFixed(2),
    areaOverRelaxed:+(cols.filter(x=>x.clear>=STD.headroomRelaxed).length*area).toFixed(2)
  };
  out.headroom.fractionFull = +(out.headroom.areaOverFull/Math.max(1e-9,out.headroom.interiorFloorArea)).toFixed(3);

  /* standable = a body of radius r fits, to shoulder height */
  const need=Math.round(STD.bodyRadius/cell), shoulder=Math.round(1.4/cell);
  const standable=cols.filter(x=>{
    if(x.clear<STD.headroomRelaxed) return false;
    for(let da=-need;da<=need;da++)for(let dc=-need;dc<=need;dc++){
      if(da*da+dc*dc>need*need) continue;
      for(let h=1;h<=shoulder;h+=Math.max(1,Math.round(0.3/cell)))
        if(V.at(x.a,fb+h,x.c+dc)||V.at(x.a+da,fb+h,x.c+dc)) return false;
    }
    return true;
  });
  out.floor={standableArea:+(standable.length*area).toFixed(2),
    fractionOfInterior:+(standable.length/Math.max(1,deckCells)).toFixed(3)};

  /* door, step, window — measured, then checked against the standards above */
  const door=parts.find(p=>/\bdoor\b/i.test((p.id||'')+' '+(p.role||'')));
  const steps=parts.filter(p=>/stair|step|tread/i.test((p.id||'')+' '+(p.role||'')));
  out.door=door?(()=>{
    const b=aabb(door), w=Math.min(b.max[0]-b.min[0],b.max[2]-b.min[2]);
    const wide=Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2]);
    const h=b.max[1]-b.min[1];
    return {id:door.id,clearWidth:+wide.toFixed(3),clearHeight:+h.toFixed(3),thickness:+w.toFixed(3),
      sillY:+b.min[1].toFixed(3),
      passesWidth:wide>=STD.doorClearW, passesHeight:h>=STD.doorClearH};
  })():{id:null,passesWidth:false,passesHeight:false};
  out.step=(()=>{
    if(!steps.length) return {count:0,totalRise:+floorY.toFixed(3),risers:0,
      riserHeight:+floorY.toFixed(3),passes:floorY<=STD.riserMax};
    const bs=steps.map(aabb).sort((a,b)=>a.max[1]-b.max[1]);
    const tops=[0,...bs.map(b=>+b.max[1].toFixed(3)),+floorY.toFixed(3)];
    const rises=[]; for(let i=1;i<tops.length;i++) if(tops[i]>tops[i-1]+1e-3) rises.push(+(tops[i]-tops[i-1]).toFixed(3));
    const treads=bs.map(b=>+Math.min(b.max[0]-b.min[0],b.max[2]-b.min[2]).toFixed(3));
    return {count:steps.length,ids:steps.map(s=>s.id),risers:rises.length,rises,
      maxRise:Math.max(...rises,0),treads,minTread:Math.min(...treads),
      totalRise:+floorY.toFixed(3),
      passes:Math.max(...rises,0)<=STD.riserMax && Math.min(...treads)>=STD.treadMin};
  })();
  const glaz=parts.filter(p=>/glaz|glass|window/i.test((p.id||'')+' '+(p.role||''))&&!/trim|sill|head/i.test(p.id));
  const gArea=glaz.reduce((s,p)=>{const b=aabb(p);
    const d=[b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]].sort((x,y)=>y-x);
    return s+d[0]*d[1]},0);
  const fa=out.headroom.interiorFloorArea;
  out.window={panes:glaz.length,glazingArea:+gArea.toFixed(3),floorArea:fa,
    ratio: fa>0.5 ? +(gArea/fa).toFixed(4) : null,
    passesLight: fa>0.5 ? gArea/fa>=STD.glazingRatio : null,
    note: fa>0.5 ? null : 'undecidable: there is no enclosed floor to light',
    sillHeights:glaz.map(p=>+(aabb(p).min[1]-floorY).toFixed(3))};

  /* load path: contact graph, and can each part reach the ground through it */
  const bs=parts.map(aabb), tol=0.02;
  const adj=parts.map(()=>[]);
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=bs[i],b=bs[j];
    const gap=Math.max(0,a.min[0]-b.max[0],b.min[0]-a.max[0])**2+
              Math.max(0,a.min[1]-b.max[1],b.min[1]-a.max[1])**2+
              Math.max(0,a.min[2]-b.max[2],b.min[2]-a.max[2])**2;
    if(Math.sqrt(gap)<=tol){ adj[i].push(j); adj[j].push(i) }
  }
  const grounded=new Uint8Array(parts.length), stack=[];
  parts.forEach((p,i)=>{ if(bs[i].min[1]<=0.05){ grounded[i]=1; stack.push(i) } });
  while(stack.length){ const i=stack.pop();
    for(const j of adj[i]) if(!grounded[j] && bs[j].min[1]>=bs[i].min[1]-0.5){ grounded[j]=1; stack.push(j) } }
  const wheels=parts.map((p,i)=>({p,i})).filter(o=>/wheel|tyre|tire/i.test(o.p.id));
  out.wheels={count:wheels.length,
    lowest:wheels.length?+Math.min(...wheels.map(o=>bs[o.i].min[1])).toFixed(3):null,
    clearance:wheels.length?+Math.min(...wheels.map(o=>bs[o.i].min[1])).toFixed(3):null,
    touching:wheels.filter(o=>bs[o.i].min[1]<=0.03).length,
    passes:wheels.length? wheels.every(o=>bs[o.i].min[1]<=0.03) : null};
  out.loadPath={grounded:grounded.reduce((s,x)=>s+x,0),total:parts.length,
    ungrounded:parts.filter((p,i)=>!grounded[i]).map(p=>p.id),
    isolated:parts.filter((p,i)=>!adj[i].length).map(p=>p.id)};

  /* it is a trailer. it has to be legal to move. */
  const inTransit=parts.map((p,i)=>i).filter(i=>!/stair|step|tread|awning|deck-ext/i
    .test((parts[i].id||'')+' '+(parts[i].role||'')));
  const tb=inTransit.map(i=>bs[i]);
  const all={min:[0,1,2].map(i=>Math.min(...tb.map(b=>b.min[i]))),
             max:[0,1,2].map(i=>Math.max(...tb.map(b=>b.max[i])))};
  const width=all.max[2]-all.min[2], height=all.max[1], length=all.max[0]-all.min[0];
  out.road={width:+width.toFixed(3),height:+height.toFixed(3),length:+length.toFixed(3),
    widthLimit:STD.roadWidth,heightLimit:STD.roadHeight,
    passesWidth:width<=STD.roadWidth, passesHeight:height<=STD.roadHeight,
    widthOver:+Math.max(0,width-STD.roadWidth).toFixed(3),
    heightOver:+Math.max(0,height-STD.roadHeight).toFixed(3),
    exempt:parts.length-inTransit.length,
    exemptNote:'steps and treads are excluded: the towing envelope measures what travels',
    widest:(()=>{let id=null,w=-1; for(const i of inTransit){
      const e=Math.max(bs[i].max[2],-bs[i].min[2]);
      if(e>w){w=e;id=parts[i].id} } return id})(),
    tallest:(()=>{let id=null,h=-1; for(const i of inTransit){
      if(bs[i].max[1]>h){h=bs[i].max[1];id=parts[i].id} } return id})(),
    overWidthParts:inTransit.filter(i=>bs[i].max[2]>STD.roadWidth/2+1e-4||
      bs[i].min[2]<-STD.roadWidth/2-1e-4).map(i=>parts[i].id)};

  /* one ordered list of what is wrong, worst first */
  const f=[];
  if(out.collisions.gross) f.push({id:'INTERPENETRATION',severity:'unbuildable',
    text:out.collisions.gross+' pairs grossly interpenetrate (worst: '+
      out.collisions.worst[0].a+' ∩ '+out.collisions.worst[0].b+', '+
      (out.collisions.worst[0].fractionOfSmaller*100).toFixed(0)+'% of the smaller part)'+
      (out.collisions.moderate?'; '+out.collisions.moderate+' more overlap 5–25%':'')});
  if(out.wheels.passes===false) f.push({id:'WHEELS_OFF_GROUND',severity:'unbuildable',
    text:'the trailer floats: its lowest wheel is '+out.wheels.clearance+
      'm above grade, so nothing it carries reaches the road'});
  if(out.loadPath.ungrounded.length) f.push({id:'NO_LOAD_PATH',severity:'unbuildable',
    text:out.loadPath.ungrounded.length+' parts have no contact chain to the ground: '+
      out.loadPath.ungrounded.slice(0,6).join(', ')});
  if(!out.road.passesWidth) f.push({id:'OVER_WIDTH',severity:'illegal',
    text:'‍'+out.road.width.toFixed(2)+'m wide, '+out.road.widthOver.toFixed(2)+
      'm over the towing limit — widest element '+out.road.widest});
  if(!out.road.passesHeight) f.push({id:'OVER_HEIGHT',severity:'illegal',
    text:out.road.height.toFixed(2)+'m tall, '+out.road.heightOver.toFixed(2)+
      'm over the towing limit — tallest element '+out.road.tallest});
  if(!out.step.passes) f.push({id:'UNCLIMBABLE',severity:'unusable',
    text:'rise to the floor is '+out.step.totalRise+'m in '+(out.step.risers||0)+
      ' riser(s); max riser is '+STD.riserMax+'m'});
  if(!out.door.passesWidth||!out.door.passesHeight) f.push({id:'DOOR_TOO_SMALL',severity:'unusable',
    text:'clear opening '+(out.door.clearWidth||0)+' × '+(out.door.clearHeight||0)+
      'm against '+STD.doorClearW+' × '+STD.doorClearH});
  if(!out.envelope.sealed) f.push({id:'NOT_ENCLOSED',severity:'unusable',
    text:out.envelope.note});
  if(out.headroom.fractionFull<0.5) f.push({id:'LOW_HEADROOM',severity:'uncomfortable',
    text:(out.headroom.fractionFull*100).toFixed(0)+'% of the floor has '+STD.headroom+'m over it'});
  if(out.window.passesLight===false) f.push({id:'TOO_DARK',severity:'uncomfortable',
    text:'glazing is '+(out.window.ratio*100).toFixed(1)+'% of floor area, against '+
      (STD.glazingRatio*100)+'% required'});
  const RANK={unbuildable:0,illegal:1,unusable:2,uncomfortable:3};
  f.sort((a,b)=>RANK[a.severity]-RANK[b.severity]);
  out.failures=f;
  out.habitable=f.length===0;
  return out;
}

global.INHABIT={assess,collisions,voxelize,aabb,inside,volumeOf,STD};
if(typeof module!=='undefined'&&module.exports) module.exports=global.INHABIT;
})(typeof window!=='undefined'?window:globalThis);

/* ---- CLI ----------------------------------------------------------------- */
if(typeof process!=='undefined'&&process.argv&&process.argv[1]&&/inhabit\.js$/.test(process.argv[1])){
  const fs=require('fs');
  const file=process.argv[2]||'agora/trailer-finished.json';
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  const parts=d.parts||(d.scene&&d.scene.parts)||d;
  const r=module.exports.assess(parts,{cell:+(process.argv[3]||0.07)});
  console.log('\n'+file+'  ·  '+r.parts+' parts');
  console.log('  collisions      '+r.collisions.gross+' gross · '+r.collisions.moderate+
    ' moderate · '+r.collisions.tolerance+' within tolerance  (of '+r.collisions.count+
    ' overlapping pairs, '+r.collisions.totalVolume+' m³)');
  for(const w of r.collisions.worst.slice(0,5))
    console.log('                    '+w.a+' ∩ '+w.b+'  '+(w.fractionOfSmaller*100).toFixed(1)+'% of smaller');
  console.log('  envelope        '+r.envelope.enclosedVolume+' m³ enclosed · '+r.envelope.note);
  if(r.envelope.leakBox) console.log('                    leak spans x '+r.envelope.leakBox.min[0]+
    '..'+r.envelope.leakBox.max[0]+'  y '+r.envelope.leakBox.min[1]+'..'+r.envelope.leakBox.max[1]+
    '  z '+r.envelope.leakBox.min[2]+'..'+r.envelope.leakBox.max[2]);
  console.log('  wheels          '+r.wheels.touching+'/'+r.wheels.count+' on the road'+
    (r.wheels.clearance!=null?' · lowest sits '+r.wheels.clearance+'m up':''));
  console.log('  floor           '+r.headroom.interiorFloorArea+' m² interior · '+
    r.floor.standableArea+' m² standable ('+(r.floor.fractionOfInterior*100).toFixed(0)+'%)');
  console.log('  headroom        median '+r.headroom.medianClear+'m · '+
    (r.headroom.fractionFull*100).toFixed(0)+'% of floor over '+r.standards.headroom+'m');
  console.log('  door            '+(r.door.id||'none')+'  '+(r.door.clearWidth||0)+' × '+
    (r.door.clearHeight||0)+'m  '+(r.door.passesWidth&&r.door.passesHeight?'ok':'FAILS'));
  console.log('  step            rise '+r.step.totalRise+'m in '+r.step.risers+' riser(s)  '+
    (r.step.passes?'ok':'FAILS'));
  console.log('  light           '+(r.window.ratio==null?'undecidable — no enclosed floor'
    :(r.window.ratio*100).toFixed(1)+'% glazing  '+(r.window.passesLight?'ok':'FAILS')));
  console.log('  load path       '+r.loadPath.grounded+'/'+r.loadPath.total+' reach the ground');
  if(r.loadPath.ungrounded.length) console.log('                    ungrounded: '+r.loadPath.ungrounded.join(', '));
  console.log('  road            '+r.road.width+' × '+r.road.height+' × '+r.road.length+
    'm  width '+(r.road.passesWidth?'ok':'OVER by '+r.road.widthOver+'m ('+r.road.widest+')')+
    ' · height '+(r.road.passesHeight?'ok':'OVER by '+r.road.heightOver+'m'));
  console.log('\n  VERDICT: '+(r.habitable?'habitable':r.failures.length+' failures'));
  for(const x of r.failures) console.log('    ['+x.severity.toUpperCase()+'] '+x.id+' — '+x.text);
}
