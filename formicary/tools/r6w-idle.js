/* r6W: play a chapter at ~100% accuracy and measure DEAD TIME:
   consecutive real-ms with no burning outbreak AND no act prompt. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT='/home/user/terrarium', SHOTS=path.join(ROOT,'formicary/shots');
const CH=+(process.argv[2]||9), MS=+(process.argv[3]||90000), PFX=process.argv[4]||'r6W';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const page=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const perr=[]; page.on('pageerror',e=>perr.push(e.message));
  await page.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'});
  await page.waitForTimeout(700);
  await page.evaluate(i=>window.__FZ.goto(i),CH); await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
  const box=await page.locator('#field').boundingBox();
  const t0=Date.now(); let idleStart=null; const idles=[]; let ans=0, deadShot=0, gate=null;
  const perTickMs=[]; let lastTick=null, lastT=null;
  while(Date.now()-t0<MS){
    const st=await page.evaluate(()=>{
      const S=FZ.sim.state, g=document.getElementById('gate');
      const l=(FZ.outbreak.list||[]).filter(o=>o.state==='burning');
      const a=document.getElementById('act'); const actOn=getComputedStyle(a).display!=='none';
      const avail=[...a.querySelectorAll('button[data-kind]')].map(x=>x.getAttribute('data-kind'));
      const tagOn=!!document.querySelector('#tagLayer .tag, #tagLayer > *');
      let A=0,M=0; for(const k in FZ.outbreak.mastery){A+=FZ.outbreak.mastery[k].answered||0;M+=FZ.outbreak.mastery[k].missed||0;}
      return {tick:S.tick,jd:S.jobsDone,jg:S.jobsGoal,bud:S.budget,col:Math.round(S.collapse),spd:S.speedMul,
        gateOn:g.classList.contains('on'), gateTxt:(g.textContent||'').replace(/\s+/g,' ').trim().slice(0,180),
        burn:l.map(o=>({s:o.sym,x:o.x,y:o.y,left:o.born+o.fuse-S.tick,ans:o.answers})),
        actOn, avail, tagOn, A, M};
    });
    const now=Date.now();
    if(lastTick!=null && st.tick>lastTick) perTickMs.push((now-lastT)/(st.tick-lastTick));
    lastTick=st.tick; lastT=now;
    if(st.gateOn){ gate=st.gateTxt; break; }
    const busy = st.burn.length>0 || st.actOn || st.tagOn;
    if(!busy){ if(idleStart==null) idleStart=now; }
    else { if(idleStart!=null){ idles.push(now-idleStart); idleStart=null; } }
    if(idleStart!=null && now-idleStart>4000 && deadShot<2){ deadShot++;
      await page.screenshot({path:path.join(SHOTS,`${PFX}-c${CH}-dead${deadShot}.png`)}); }
    for(const o of st.burn){
      const k=o.ans.find(x=>st.avail.includes(x));
      if(k){ const cost=await page.evaluate(kk=>FZ.sim.cost(kk),k);
        if(st.bud>=cost){ await page.locator(`#act button[data-kind="${k}"]`).first().click({timeout:1200}).catch(()=>{});
          await page.mouse.click(box.x+o.x, box.y+o.y).catch(()=>{}); ans++; break; } }
    }
    await page.waitForTimeout(120);
  }
  if(idleStart!=null) idles.push(Date.now()-idleStart);
  idles.sort((a,b)=>b-a);
  const fin=await page.evaluate(()=>{const S=FZ.sim.state;let A=0,M=0;for(const k in FZ.outbreak.mastery){A+=FZ.outbreak.mastery[k].answered||0;M+=FZ.outbreak.mastery[k].missed||0;}
    return {jd:S.jobsDone,jg:S.jobsGoal,col:Math.round(S.collapse),tick:S.tick,bud:S.budget,A,M,won:S.won,over:S.gameOver,spd:S.speedMul};});
  const mt=perTickMs.length?perTickMs.reduce((a,b)=>a+b)/perTickMs.length:0;
  console.log(`CH${CH} elapsed=${Date.now()-t0}ms taps=${ans} msPerTick=${mt.toFixed(1)} idleWindowsTop=${idles.slice(0,6).join(',')} totalIdle=${idles.reduce((a,b)=>a+b,0)}ms fin=${JSON.stringify(fin)}`);
  if(gate) console.log('GATE',JSON.stringify(gate));
  console.log('PERR',perr.slice(0,3));
  await b.close();
})();
