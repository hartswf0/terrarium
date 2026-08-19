/* A/B harness for the antbat experiment.  node agora/ab.mjs  (needs playwright,
   and a static server on 127.0.0.1:8811 serving the repository root)

   Three arms per building, judged only by agora/judge.js:
     none    — the building as the correspondence loop left it
     random  — the SAME multiset of operations the antbats chose, applied to
               randomly chosen parts. Controls for "any edit helps."
     antbat  — read, wish, operate, re-read, three generations
*/
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SP = process.env.SP;
const BUILDINGS = ['seed','pagoda','lander','cabin'];
const GENERATIONS = 3;
const ANT_STEPS = 150;
const RANDOM_REPEATS = 3;

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({viewport:{width:900,height:900}});
const page = await ctx.newPage();
await page.route('**/three.min.js', r =>
  r.fulfill({ path: SP+'/node_modules/three/build/three.min.js', contentType:'application/javascript' }));
const errs=[]; page.on('pageerror',e=>errs.push(e.message));

async function boot(which){
  await page.goto('http://127.0.0.1:8811/antbat-genie.html',{waitUntil:'load'});
  await page.waitForTimeout(2000);
  await page.addScriptTag({path:'agora/judge.js'});
  if(which!=='seed'){
    await page.setInputFiles('#file-in', SP+'/'+which+'.json');
    await page.waitForTimeout(2400);
  }
}
const judge = () => page.evaluate(()=>JUDGE.judge(state.house.parts,THREE,{px:420}));

const results={generatedAt:new Date().toISOString(),generations:GENERATIONS,antSteps:ANT_STEPS,
  randomRepeats:RANDOM_REPEATS,buildings:{}};

const RANDOM_OPS = (ops)=>{
      const P=state.house.parts, R=state.bounds.radius, C=state.bounds.center;
      const rnd=n=>Math.floor(Math.random()*n);
      const pick=()=>P[rnd(P.length)];
      const nid=k=>k+'-rnd-'+Math.random().toString(36).slice(2,6);
      const ext=p=>{const s=p.size||[1,1,1];return Math.max(s[0],s[1],s[2])};
      for(const op of ops){
        const a=pick(); if(!a) continue;
        const ap=a.position||[0,0,0];
        if(op==='RELOCATE_ORPHAN'){
          const b=pick(); if(!b||b.id===a.id)continue;
          const bp=b.position||[0,0,0];
          const d=[bp[0]-ap[0],bp[1]-ap[1],bp[2]-ap[2]];
          const L=Math.hypot(d[0],d[1],d[2])||1;
          const travel=Math.max(0,L-(ext(a)+ext(b))*0.5);
          a.position=[ap[0]+d[0]/L*travel,ap[1]+d[1]/L*travel,ap[2]+d[2]/L*travel];
        } else if(op==='EXPOSE_BURIED'){
          const d=[ap[0]-C.x,ap[1]-C.y,ap[2]-C.z];
          const L=Math.hypot(d[0],d[1],d[2])||1, travel=ext(a)*1.15;
          a.position=[ap[0]+d[0]/L*travel,ap[1]+d[1]/L*travel,ap[2]+d[2]/L*travel];
        } else if(op==='ADD_DOOR'){
          P.push({id:nid('door'),kind:'box',position:[ap[0],Math.max(0.5,R*0.16),ap[2]-R*0.02],
            size:[R*0.14,R*0.30,Math.max(0.12,R*0.03)],rotation:[0,0,0],color:'#2b2622',role:'door',
            opacity:1,metalness:0.05,roughness:0.9,connections:[]});
        } else if(op==='ADD_ARRIVAL'){
          P.push({id:nid('path'),kind:'box',position:[ap[0],0.06,ap[2]-R*0.22],
            size:[R*0.18,0.12,R*0.42],rotation:[0,0,0],color:'#6b6660',role:'path',
            opacity:1,metalness:0,roughness:1,connections:[]});
        } else if(op==='APERTURE'){
          if((a.kind||'box')!=='box'||!a.size)continue;
          const s=a.size.slice(),ax=s[0]>=s[2]?0:2;
          const gap=Math.max(0.4,Math.min(s[ax]*0.34,R*0.28)),half=(s[ax]-gap)/2;
          if(half<=0.15)continue;
          const i=P.indexOf(a); P.splice(i,1);
          for(const sign of [-1,1]){
            const q=JSON.parse(JSON.stringify(a));
            q.id=a.id+(sign<0?'-ra':'-rb'); q.size=s.slice(); q.size[ax]=half;
            q.position=ap.slice(); q.position[ax]=ap[ax]+sign*(half+gap)/2;
            P.splice(i,0,q);
          }
        } else if(op==='THICKEN'){
          if(!a.size)continue;
          const s=a.size.slice(),thin=s.indexOf(Math.min(...s));
          s[thin]=s[thin]*1.75; a.size=s;
        } else if(op==='ENCLOSE_CAVITY'){
          const c=[C.x+(Math.random()-0.5)*R,C.y+Math.random()*R*0.6,C.z+(Math.random()-0.5)*R];
          const r=R*0.25,t=Math.max(0.1,R*0.03);
          for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]])
            P.push({id:nid('post'),kind:'box',position:[c[0]+sx*r,c[1],c[2]+sz*r],
              size:[t*2,r*1.9,t*2],rotation:[0,0,0],color:'#7e8892',role:'structure',
              opacity:1,metalness:.05,roughness:.85,connections:[]});
          P.push({id:nid('lid'),kind:'box',position:[c[0],c[1]+r*0.95,c[2]],
            size:[r*2.2,t*2,r*2.2],rotation:[0,0,0],color:'#6f7a85',role:'structure',
            opacity:1,metalness:.05,roughness:.85,connections:[]});
        } else if(op==='BUILD_THE_AMBIGUITY'){
          P.push({id:nid('contested'),kind:'box',position:ap.slice(),
            size:[R*0.16,Math.max(0.08,R*0.02),R*0.16],rotation:[0,0,0],color:'#e6e2f2',
            role:'ambiguity',opacity:.72,metalness:0,roughness:.4,connections:[]});
        } else if(op==='ADD_MEMBER'){
          const b=pick(); if(!b)continue; const bp=b.position||[0,0,0];
          const mid=[(ap[0]+bp[0])/2,(ap[1]+bp[1])/2,(ap[2]+bp[2])/2];
          const L=Math.max(0.4,Math.hypot(bp[0]-ap[0],bp[1]-ap[1],bp[2]-ap[2]));
          P.push({id:nid('member'),kind:'cylinder',position:mid,
            size:[Math.max(0.12,R*0.035),L,Math.max(0.12,R*0.035)],rotation:[0,0,0],
            color:'#b7a26a',role:'structure',opacity:1,metalness:.1,roughness:.7,connections:[]});
        }
      }
};

function line(tag,j){
  return `  ${tag.padEnd(11)} parts ${String(j.parts).padStart(4)}  strict ${String(j.strict.findings).padStart(4)}`+
    ` (${j.strict.perPart.toFixed(2)}/part)  declared ${String(j.declared.findings).padStart(4)}`+
    `  geo ${String(j.geometric.findings).padStart(3)}  visible ${(j.visibility.fraction*100).toFixed(1)}%`;
}

for(const which of BUILDINGS){
  console.log('\n=== '+which+' ===');
  await boot(which);
  const before = await judge();
  console.log(line('before',before));
  const rec={before,arms:{}};

  for(const mode of ['full','move']){
    await boot(which);
    await page.evaluate(m=>{ state.moveOnly = (m==='move') }, mode);
    const opLog=[];
    for(let g=0;g<GENERATIONS;g++){
      await page.evaluate(async (n)=>{ for(let i=0;i<n;i++) tick(); renderFx(); }, ANT_STEPS);
      const ops = await page.evaluate(()=>{
        const b=state.generation; runGenie();
        const l=state.lineage[state.lineage.length-1];
        return {applied:state.generation>b, ops:(l&&l.ops||[]).map(o=>o.op),
          refused:(l&&l.refused||[]).length};
      });
      opLog.push(ops);
      if(ops.applied) await page.waitForTimeout(600);
    }
    const j = await judge();
    console.log(line('antbat '+mode,j)+'   ops ['+[...new Set(opLog.flatMap(o=>o.ops))].join(' ')+']');

    /* matched control: the same multiset of operations, random targets */
    const multiset=opLog.flatMap(o=>o.ops);
    const runs=[];
    for(let r=0;r<RANDOM_REPEATS;r++){
      await boot(which);
      await page.evaluate(RANDOM_OPS, multiset);
      runs.push(await judge());
    }
    const mean=f=>+(runs.reduce((a,x)=>a+f(x),0)/runs.length).toFixed(3);
    console.log(`  ${('random '+mode).padEnd(11)} parts ${String(mean(x=>x.parts)).padStart(4)}`+
      `  strict ${String(mean(x=>x.strict.findings)).padStart(4)} (${mean(x=>x.strict.perPart).toFixed(2)}/part)`+
      `  declared ${String(mean(x=>x.declared.findings)).padStart(4)}`+
      `  geo ${String(mean(x=>x.geometric.findings)).padStart(3)}`+
      `  visible ${(mean(x=>x.visibility.fraction)*100).toFixed(1)}%`);
    rec.arms[mode]={antbat:j,ops:opLog,random:{runs,mean:{
      parts:mean(x=>x.parts), strictFindings:mean(x=>x.strict.findings),
      strictPerPart:mean(x=>x.strict.perPart), declaredFindings:mean(x=>x.declared.findings),
      geoFindings:mean(x=>x.geometric.findings), visibility:mean(x=>x.visibility.fraction)}}};
  }
  results.buildings[which]=rec;
}
results.errors=errs.slice(0,10);
fs.writeFileSync('agora/ab-results.json',JSON.stringify(results,null,1));
console.log('\nwrote agora/ab-results.json · page errors:',errs.length?errs.slice(0,3):'none');
await browser.close();
