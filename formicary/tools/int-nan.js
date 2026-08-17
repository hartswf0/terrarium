/* Cross-file field integrity: after a long ch9 run, no NaN/undefined in sim state,
   agents, jobs, nest geometry or outbreaks — the symptom of a renamed field that
   one builder writes and another reads. Also checks the detector api surface. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const perr=[]; p.on('pageerror', e=>perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html',{waitUntil:'load'});
  await p.waitForTimeout(800);
  await p.evaluate(()=>window.__FZ.goto(9));
  await p.waitForTimeout(400);
  await p.locator('#gate .gtBtn').first().click().catch(()=>{});
  await p.waitForTimeout(45000);
  const r = await p.evaluate(()=>{
    const S = FZ.sim.state, bad = [];
    const chk = (o, label, keys) => {
      keys.forEach(k=>{
        const v = o[k];
        if (v === undefined) bad.push(label+'.'+k+'=undefined');
        else if (typeof v === 'number' && !isFinite(v)) bad.push(label+'.'+k+'='+v);
      });
    };
    chk(S,'S',['tick','jobsDone','jobsGoal','budget','collapse','collapseMax','speedMul','w','h']);
    S.agents.forEach((a,i)=>{ if(i<40) chk(a,'agent'+i,['x','y','vx','vy','stun']); });
    S.jobs.forEach((j,i)=>{ if(i<40) chk(j,'job'+i,['x','y','value','progress','need']); });
    (FZ.outbreak.list||[]).forEach((o,i)=>chk(o,'ob'+i,['x','y','r','born','fuse']));
    FZ.EL.forEach(e=>{ if(!isFinite(e.heat)) bad.push('EL.'+e.sym+'.heat='+e.heat);
                       if(!isFinite(e.fires)) bad.push('EL.'+e.sym+'.fires='+e.fires); });
    const pr = window.__FZ.probe();
    const walk = (o,pre)=>{ for(const k in o){ const v=o[k];
      if (typeof v==='number' && !isFinite(v)) bad.push('probe.'+pre+k+'='+v);
      else if (v && typeof v==='object' && !Array.isArray(v)) walk(v,pre+k+'.'); } };
    walk(pr,'');
    return { bad: bad.slice(0,25), badCount: bad.length, tick:S.tick, done:S.jobsDone,
             agents:S.agents.length, jobs:S.jobs.length, obs:(FZ.outbreak.list||[]).length,
             soil: pr.nest.where.soil, firesTotal: FZ.EL.reduce((s,e)=>s+e.fires,0) };
  });
  console.log('INTEGRITY '+JSON.stringify(r,null,1));
  console.log('PAGE ERRORS: '+(perr.length?perr.join(' | '):'none'));
  await b.close();
})();
