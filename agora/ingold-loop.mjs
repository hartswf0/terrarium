/* ============================================================================
   THE INGOLD LOOP

   The correspondence loop asks: does it look like the photograph?
   This one asks: can a body get in, stand up and stay; can hands build it; will
   it survive being towed. Dwelling rather than resemblance.

       READ        agora/inhabit.js — collisions, envelope, headroom, door,
                   step, load path, road envelope
       WORST       one failure, ordered unbuildable > illegal > unusable >
                   uncomfortable. Never a list.
       REPAIR      one deterministic gesture. No model, no reference, no score.
       RE-READ     and again, until nothing fails — which is
                   NOT CURRENTLY UNINHABITABLE, never DONE.

   A repair that cannot be made without touching locked geometry is REFUSED and
   reported. A premise that cannot be satisfied is a finding about the premise.

       node agora/ingold-loop.mjs agora/trailer-finished.json out.json
   ========================================================================== */
import fs from 'fs';
import { createRequire } from 'module';
const require=createRequire(import.meta.url);
const INHABIT=require('./inhabit.js');
const {assess,aabb,STD}=INHABIT;

const inFile=process.argv[2]||'agora/trailer-finished.json';
const outFile=process.argv[3]||'agora/trailer-ingold.json';
const MAX_CYCLES=+(process.argv[4]||24);

const doc=JSON.parse(fs.readFileSync(inFile,'utf8'));
let parts=(doc.parts||doc.scene?.parts||doc).map(p=>JSON.parse(JSON.stringify(p)));
const locked=new Set(parts.filter(p=>p.locked).map(p=>p.id));

const byId=id=>parts.find(p=>p.id===id);
const nid=(k,c)=>`${k}-i${c}`;
const clone=p=>JSON.parse(JSON.stringify(p));

/* ---------------------------- the repairs -------------------------------- */
const REPAIRS={

  /* A trailer whose wheels do not touch the road carries nothing. Everything
     moves down together — the relationship between the parts is not in doubt,
     only the assembly's relationship to the ground. */
  WHEELS_OFF_GROUND(r){
    const drop=r.wheels.clearance;
    if(!(drop>0.005)) return null;
    for(const p of parts) p.position=[p.position[0],+(p.position[1]-drop).toFixed(4),p.position[2]];
    return {op:'SET_DOWN',by:+drop.toFixed(3),
      text:`set the whole assembly down ${drop.toFixed(3)}m so the wheels reach the road`};
  },

  /* Two solids in one place. The smaller one moves along the axis it is least
     buried in, until the faces meet. */
  INTERPENETRATION(r){
    const key=w=>[w.a,w.b].sort().join('|');
    const pair=r.collisions.worst.find(w=>w.fractionOfSmaller>0.25&&!separated.has(key(w)));
    if(!pair){
      const stuck=r.collisions.worst.find(w=>w.fractionOfSmaller>0.25);
      return stuck?{refused:`${stuck.a} and ${stuck.b} have already been separated once and `+
        `are overlapping again — moving either one drives it into the other. Two parts want `+
        `the same place and a repair cannot decide which of them is wrong.`}:null;
    }
    separated.add(key(pair));
    const A=byId(pair.a),B=byId(pair.b);
    if(!A||!B) return null;
    const va=INHABIT.volumeOf(A), vb=INHABIT.volumeOf(B);
    let mover=va<=vb?A:B, anchor=va<=vb?B:A;
    if(locked.has(mover.id)){ if(locked.has(anchor.id))
        return {refused:`both ${A.id} and ${B.id} are locked; the collision is in given geometry`};
      [mover,anchor]=[anchor,mover]; }
    const ma=aabb(mover), an=aabb(anchor);
    let best=null;
    for(let i=0;i<3;i++){
      const push=an.max[i]-ma.min[i], pull=ma.max[i]-an.min[i];
      const d=Math.abs(push)<=Math.abs(pull)?push:-pull;
      if(!best||Math.abs(d)<Math.abs(best.d)) best={i,d};
    }
    const q=mover.position.slice();
    q[best.i]=+(q[best.i]+best.d*1.02).toFixed(4);
    mover.position=q;
    return {op:'SEPARATE',part:mover.id,from:anchor.id,axis:'xyz'[best.i],by:+best.d.toFixed(3),
      text:`moved ${mover.id} ${best.d.toFixed(3)}m in ${'xyz'[best.i]} clear of ${anchor.id}`};
  },

  /* Legal to tow, or it is a load and not a house. */
  OVER_WIDTH(r){
    const lim=STD.roadWidth/2;
    /* The widest element decides. Trimming everything else that happens to be
       over while the actual offender is locked is how the first version of this
       repair ground for six cycles, shaving a window sill to 5% of its width
       and never touching the wheel that was the problem. */
    const widest=byId(r.road.widest);
    if(widest && locked.has(widest.id)) return {refused:
      `the widest element in transit is ${widest.id}, locked chassis geometry at `+
      `${r.road.width.toFixed(2)}m across against a ${STD.roadWidth}m limit. `+
      `The given trailer is over width before anything is built on it. That is a `+
      `finding about the premise, and no repair here can reach it.`};
    const over=r.road.widthOver;
    if(over<=1e-4) return null;
    const did=[];
    for(const id of (r.road.overWidthParts||[])){
      const p=byId(id); if(!p||locked.has(id)) continue;
      const b=aabb(p), c=(b.min[2]+b.max[2])/2;
      if(Math.abs(c)>lim*0.9){
        /* its centre is already outside: shrinking about that centre never
           brings it in. It has to come inboard. */
        const move=(c>0?-1:1)*(Math.abs(c)-lim*0.6);
        p.position=[p.position[0],p.position[1],+(p.position[2]+move).toFixed(4)];
        did.push(`${id} moved ${move.toFixed(2)}m inboard`);
      } else {
        const half=(b.max[2]-b.min[2])/2;
        const excess=Math.max(b.max[2]-lim,-lim-b.min[2]);
        const scale=Math.max(0.25,(half-excess)/half);
        p.size=[p.size[0],p.size[1],+(p.size[2]*scale).toFixed(4)];
        did.push(`${id} narrowed ×${scale.toFixed(2)}`);
      }
    }
    if(!did.length) return null;
    return {op:'TRIM_TO_ENVELOPE',parts:did,
      text:`brought ${did.length} element(s) inside the ${STD.roadWidth}m towing width: ${did.join('; ')}`};
  },

  OVER_HEIGHT(r){
    const over=r.road.heightOver;
    const tall=parts.filter(p=>!locked.has(p.id)&&aabb(p).max[1]>STD.roadHeight-1e-4);
    if(!tall.length) return {refused:'the tallest element is locked'};
    for(const p of tall) p.position=[p.position[0],+(p.position[1]-over-0.01).toFixed(4),p.position[2]];
    return {op:'LOWER_TO_ENVELOPE',by:+over.toFixed(3),
      text:`lowered ${tall.length} element(s) ${over.toFixed(2)}m under the towing height`};
  },

  /* One 0.71m step is a wall with ambition. Replace it with a flight. */
  UNCLIMBABLE(r){
    const rise=r.step.totalRise;
    const n=Math.max(1,Math.ceil(rise/STD.riserMax));
    const each=rise/n, tread=Math.max(STD.treadMin,0.28);
    const old=parts.filter(p=>/stair|step|tread/i.test(p.id+' '+(p.role||'')));
    if(old.length>=n && r.step.maxRise<=STD.riserMax) return null;
    const door=parts.find(p=>/\bdoor\b/i.test(p.id+' '+(p.role||'')));
    const db=door?aabb(door):null;
    const cx=db?(db.min[0]+db.max[0])/2:0;
    const outward=db?(db.min[2]+db.max[2])/2<0?-1:1:-1;
    const face=db?(outward<0?db.min[2]:db.max[2]):0;
    const w=(db?db.max[0]-db.min[0]:0.9)+0.30;
    parts=parts.filter(p=>!old.includes(p));
    for(let i=0;i<n;i++){
      const top=each*(i+1), h=top;
      parts.push({id:nid('tread-'+(i+1),cycle),kind:'box',
        position:[+cx.toFixed(4),+(h/2).toFixed(4),+(face+outward*(tread*(n-i)-tread/2)).toFixed(4)],
        size:[+w.toFixed(3),+h.toFixed(4),+tread.toFixed(3)],rotation:[0,0,0],
        color:'#6f6a63',opacity:1,metalness:0.05,roughness:0.95,role:'stair',connections:['deck']});
    }
    return {op:'BUILD_STAIR',risers:n,riser:+each.toFixed(3),tread:+tread.toFixed(3),
      text:`replaced ${old.length||'no'} step with ${n} risers of ${each.toFixed(3)}m and ${tread.toFixed(2)}m treads`};
  },

  DOOR_TOO_SMALL(r){
    const door=byId(r.door.id); if(!door) return {refused:'no door to widen'};
    const b=aabb(door);
    const wIdx=(b.max[0]-b.min[0])>=(b.max[2]-b.min[2])?0:2;
    const cur=b.max[wIdx]-b.min[wIdx];
    const want=STD.doorClearW+0.03;
    if(cur>=want && (b.max[1]-b.min[1])>=STD.doorClearH) return null;
    const grow=want-cur;
    door.size=door.size.slice();
    door.size[wIdx]=+(door.size[wIdx]+grow).toFixed(4);
    door.size[1]=+Math.max(door.size[1],STD.doorClearH+0.01).toFixed(4);
    /* the opening has to grow with it, or the door is a picture of a door */
    const flank=parts.filter(p=>/front-clad-(left|right)/.test(p.id));
    for(const f of flank){
      f.size=f.size.slice(); f.size[wIdx]=+Math.max(0.05,f.size[wIdx]-grow/2).toFixed(4);
      f.position=f.position.slice();
      f.position[wIdx]=+(f.position[wIdx]+(f.position[wIdx]>door.position[wIdx]?grow/2:-grow/2)).toFixed(4);
    }
    return {op:'WIDEN_DOOR',by:+grow.toFixed(3),
      text:`widened ${door.id} by ${grow.toFixed(3)}m and pulled the flanking cladding back with it`};
  },

  /* Outside air is getting into what should be indoors. Close the gap between
     the top of the wall and the underside of the roof, and seat the door in the
     wall plane instead of hanging it outside. */
  NOT_ENCLOSED(r){
    /* The first version of this gave every attempt a fresh id, so three rounds
       of sealing produced three stacked blocks that then collided with each
       other and with the roof — the genie's ENCLOSE_CAVITY mistake, made again.
       One block per wall, updated in place, and it has to show progress. */
    if(sealAttempts>=2 && r.envelope.leakVolume>=lastLeak-0.5) return {refused:
      `two attempts at closing the shell have not reduced the leak below `+
      `${r.envelope.leakVolume}m³. The gap spans x ${r.envelope.leakBox?.min[0]}..`+
      `${r.envelope.leakBox?.max[0]}, y ${r.envelope.leakBox?.min[1]}..`+
      `${r.envelope.leakBox?.max[1]}, z ${r.envelope.leakBox?.min[2]}..`+
      `${r.envelope.leakBox?.max[2]} — the shell is open along its whole length, `+
      `which is a missing design decision about how wall meets roof, not a gap to plug.`};
    sealAttempts++; lastLeak=r.envelope.leakVolume;
    const plates=parts.filter(p=>/wall-plate/.test(p.id));
    if(!plates.length) return {refused:'no wall plate to seal against'};
    const done=[];
    const roofs=parts.filter(p=>/^roof/.test(p.id));
    if(roofs.length){
      const rb={min:Math.min(...roofs.map(p=>aabb(p).min[1])),max:Math.max(...roofs.map(p=>aabb(p).max[1]))};
      for(const pl of plates.filter(p=>/front|rear/.test(p.id))){
        const b=aabb(pl);
        const id='eave-block-'+(/front/.test(pl.id)?'front':'rear');   // stable
        const h=Math.max(0.05,rb.min-b.max[1]+0.25);
        const spec={position:[+((b.min[0]+b.max[0])/2).toFixed(4),+(b.max[1]+h/2).toFixed(4),
                    +((b.min[2]+b.max[2])/2).toFixed(4)],
          size:[+(b.max[0]-b.min[0]).toFixed(4),+h.toFixed(4),+(b.max[2]-b.min[2]).toFixed(4)]};
        const ex=byId(id);
        if(ex){ ex.position=spec.position; ex.size=spec.size; done.push(id+' (resized)') }
        else { parts.push({id,kind:'box',...spec,rotation:[0,0,0],color:'#2f2b27',
          opacity:1,metalness:0.05,roughness:0.9,role:'wall-cladding',connections:[pl.id]});
          done.push(id) }
      }
    }
    const door=parts.find(p=>/\bdoor\b/i.test(p.id+' '+(p.role||'')));
    const clad=parts.find(p=>/front-clad-left/.test(p.id));
    if(door&&clad&&Math.abs(door.position[2]-clad.position[2])>1e-3){
      door.position=[door.position[0],door.position[1],clad.position[2]];
      door.size=[door.size[0],door.size[1],+Math.max(door.size[2],clad.size[2]).toFixed(4)];
      done.push('seated '+door.id+' in the wall plane');
    }
    if(!done.length) return null;
    return {op:'CLOSE_ENVELOPE',added:done,
      text:`closed the shell: ${done.join(', ')}`};
  },

  LOW_HEADROOM(r){ return {refused:
    'headroom cannot be judged until the shell is closed; nothing to raise yet'} },
  TOO_DARK(){ return null },
  NO_LOAD_PATH(r){
    const orphan=r.loadPath.ungrounded.filter(id=>!locked.has(id));
    if(!orphan.length) return {refused:'every ungrounded part is locked chassis'};
    return null;
  }
};

/* ------------------------------ the loop --------------------------------- */
let cycle=0; const trace=[]; let stalls=0;
const separated=new Set();          // a pair is separated once, or it oscillates
let sealAttempts=0, lastLeak=Infinity;
console.log(`\nINGOLD LOOP · ${inFile} · ${parts.length} parts · ${locked.size} locked\n`);
let r=assess(parts,{cell:0.07});
console.log(`  cycle 0   ${r.failures.length} failures  [${r.failures.map(f=>f.id).join(' ')}]`);

while(cycle<MAX_CYCLES){
  if(r.habitable) break;
  cycle++;
  const worst=r.failures.find(f=>!trace.some(t=>t.refusedId===f.id));
  if(!worst){ console.log('  every remaining failure has been refused'); break }
  const fn=REPAIRS[worst.id];
  const before=r.failures.length;
  const res=fn?fn(r):null;
  if(!res){
    trace.push({cycle,failure:worst.id,refusedId:worst.id,note:'no repair available'});
    console.log(`  cycle ${cycle}   ${worst.id} — no repair available, moving on`);
    continue;
  }
  if(res.refused){
    trace.push({cycle,failure:worst.id,refusedId:worst.id,refused:res.refused});
    console.log(`  cycle ${cycle}   ${worst.id} — REFUSED: ${res.refused}`);
    continue;
  }
  r=assess(parts,{cell:0.07});
  trace.push({cycle,failure:worst.id,repair:res,after:r.failures.map(f=>f.id),parts:parts.length});
  const delta=r.failures.length-before;
  console.log(`  cycle ${cycle}   ${worst.id} → ${res.op}: ${res.text}`);
  console.log(`            ${r.failures.length} failures ${delta<0?'('+delta+')':delta>0?'(+'+delta+')':'(no change)'}  [${r.failures.map(f=>f.id).join(' ')}]`);
  if(delta>=0) stalls++; else stalls=0;
  if(stalls>=6){ console.log('  six repairs without progress — stopping rather than grinding'); break }
}

console.log(`\n  ${r.habitable?'NOT CURRENTLY UNINHABITABLE':r.failures.length+' failures remain'} after ${cycle} cycles`);
for(const f of r.failures) console.log(`    [${f.severity.toUpperCase()}] ${f.id} — ${f.text}`);
const refusals=trace.filter(t=>t.refused);
if(refusals.length){ console.log('\n  refused:');
  for(const t of refusals) console.log(`    ${t.failure} — ${t.refused}`); }

fs.writeFileSync(outFile,JSON.stringify({program:'antbat-genie',kind:'scene',
  note:`Produced by the Ingold loop from ${inFile} in ${cycle} cycles. Judged by dwelling, `+
       `not by resemblance: no reference image and no model were involved.`,
  ingold:{cycles:cycle,trace,final:{failures:r.failures,habitable:r.habitable,
    road:r.road,step:r.step,door:r.door,envelope:r.envelope,wheels:r.wheels,
    collisions:{gross:r.collisions.gross,moderate:r.collisions.moderate}}},
  parts},null,1));
console.log(`\n  wrote ${outFile}\n`);
