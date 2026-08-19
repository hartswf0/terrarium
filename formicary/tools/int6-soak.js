/* long real-loop soak on the sandbox: errors, leaks, and whether it stays a game */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const MS = +(process.argv[2]||360000), ACC = +(process.argv[3]||0.75);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  const perr=[],cerr=[]; page.on('console',m=>{if(m.type()==='error')cerr.push(m.text());}); page.on('pageerror',e=>perr.push(e.message));
  await page.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'});
  await page.waitForTimeout(700);
  await page.evaluate(()=>window.__FZ.goto(9)); await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click();
  const box = await page.locator('#field').boundingBox();
  const t0=Date.now(); let taps=0, wrongs=0, lastLog=0, quietMax=0, lastDecision=Date.now();
  while (Date.now()-t0 < MS) {
    const s = await page.evaluate(()=>{
      const S=FZ.sim.state, g=document.getElementById('gate');
      const L=FZ.outbreak.list||[]; const b=L.filter(o=>o.state==='burning').sort((a,c)=>(a.born+a.fuse)-(c.born+c.fuse))[0];
      return { gate:g.classList.contains('on'), gateTxt:(g.textContent||'').trim().slice(0,80),
        jd:S.jobsDone, jg:S.jobsGoal, bud:S.budget, col:Math.round(S.collapse), tick:S.tick, w:S.w,h:S.h,
        beats: (FZ.render && FZ.render.__beats) || 0, obN:L.length,
        burn: b?{x:b.x,y:b.y,answers:b.answers,sym:b.sym}:null,
        avail:[...document.querySelectorAll('#act button[data-kind]')].map(x=>x.getAttribute('data-kind')),
        heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1e6) : -1 };
    });
    if (s.gate) { console.log('GATE reached: ' + s.gateTxt.replace(/\s+/g,' ')); break; }
    if (s.burn) {
      const q = Date.now()-lastDecision; if (q>quietMax) quietMax=q; lastDecision=Date.now();
      const right = s.burn.answers.find(k=>s.avail.includes(k));
      const pick = Math.random()<ACC ? right : s.avail[Math.floor(Math.random()*s.avail.length)];
      if (pick) { const c = await page.evaluate(k=>FZ.sim.cost(k),pick);
        if (s.bud>=c) { await page.click(`#act button[data-kind="${pick}"]`,{timeout:1000}).catch(()=>{});
          await page.mouse.click(box.x+s.burn.x*(box.width/s.w), box.y+s.burn.y*(box.height/s.h));
          taps++; if (pick!==right) wrongs++; await page.waitForTimeout(90); } }
    }
    if (Date.now()-lastLog > 30000) { lastLog=Date.now();
      console.log(`t=${s.tick} crumbs=${s.jd}/${s.jg} strain=${s.col} food=${s.bud} taps=${taps} wrong=${wrongs} ob=${s.obN} heap=${s.heap}MB errs=${perr.length}/${cerr.length}`); }
    await page.waitForTimeout(190);
  }
  const f = await page.evaluate(()=>{const S=FZ.sim.state;let a=0,m=0;const M=FZ.outbreak.mastery;for(const k in M){a+=M[k].answered||0;m+=M[k].missed||0;}
    return {jd:S.jobsDone,col:Math.round(S.collapse),tick:S.tick,answered:a,missed:m,syms:Object.keys(M).length};});
  console.log('FINAL ' + JSON.stringify(f) + ` taps=${taps} wrong=${wrongs} longestQuietMs=${quietMax}`);
  console.log('PAGE ERRORS: '+(perr.length||'none')); perr.slice(0,12).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: '+(cerr.length||'none')); cerr.slice(0,12).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
