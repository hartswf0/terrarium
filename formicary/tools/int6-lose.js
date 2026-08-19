/* the losing branch: loseGate names what killed you, RETRY re-runs the same passage.
   And the wrong-instrument teaching line. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT='/home/user/terrarium', SHOTS=path.join(ROOT,'formicary/shots');
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const perr=[],cerr=[]; page.on('console',m=>{if(m.type()==='error')cerr.push(m.text());}); page.on('pageerror',e=>perr.push(e.message));
  await page.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'}); await page.waitForTimeout(700);

  // --- lose passage 6 -------------------------------------------------
  await page.evaluate(()=>window.__FZ.goto(5)); await page.waitForTimeout(250);
  await page.locator('#gate button.gtBtn').first().click(); await page.waitForTimeout(2500);
  await page.evaluate(()=>{ FZ.sim.state.collapse = FZ.sim.state.collapseMax + 5; });
  for(let i=0;i<20;i++){ await page.waitForTimeout(600);
    const g=await page.evaluate(()=>{const g=document.getElementById('gate');
      return {on:g.classList.contains('on'),cls:g.className,title:(g.querySelector('.gtTitle')||{}).textContent||'',
        win:(g.querySelector('.gtWin')||{}).textContent||'',plates:g.querySelectorAll('.npl').length,
        btns:[...g.querySelectorAll('button.gtBtn')].map(b=>b.textContent.trim())};});
    if(g.on){ console.log('LOSEGATE '+JSON.stringify(g)); await page.screenshot({path:path.join(SHOTS,'lose-gate.png')}); break; } }
  // RETRY must re-run the SAME passage
  await page.locator('#gate button.gtBtn').first().click(); await page.waitForTimeout(1200);
  console.log('after RETRY: '+JSON.stringify(await page.evaluate(()=>({
    chap:FZ.chapters.index, phase:FZ.chapters.phase(), tick:FZ.sim.state.tick,
    collapse:Math.round(FZ.sim.state.collapse), gate:document.getElementById('gate').classList.contains('on'),
    tools:[...document.querySelectorAll('#act button[data-kind]')].map(b=>b.getAttribute('data-kind'))}))));

  // --- the wrong instrument teaches -----------------------------------
  await page.evaluate(()=>window.__FZ.goto(8)); await page.waitForTimeout(250);
  await page.locator('#gate button.gtBtn').first().click();
  const box=await page.locator('#field').boundingBox();
  let said=null, tries=0;
  const msgs=[]; await page.evaluate(()=>{ window.__W=[]; FZ.bus.on('outbreak:wrong', d=>window.__W.push(d)); });
  while(tries<40 && !said){
    const s=await page.evaluate(()=>{const S=FZ.sim.state;const b=(FZ.outbreak.list||[]).filter(o=>o.state==='burning')[0];
      return {w:S.w,h:S.h,bud:S.budget,burn:b?{x:b.x,y:b.y,answers:b.answers,sym:b.sym}:null,
        avail:[...document.querySelectorAll('#act button[data-kind]')].map(x=>x.getAttribute('data-kind'))};});
    if(s.burn){ const bad=s.avail.find(k=>s.burn.answers.indexOf(k)<0);
      if(bad){ await page.click(`#act button[data-kind="${bad}"]`,{timeout:1000}).catch(()=>{});
        await page.mouse.click(box.x+s.burn.x*(box.width/s.w),box.y+s.burn.y*(box.height/s.h));
        await page.waitForTimeout(400);
        const w=await page.evaluate(()=>window.__W.slice());
        if(w.length){ said=w[w.length-1]; } } }
    tries++; await page.waitForTimeout(250);
  }
  console.log('WRONG-TOOL event: '+JSON.stringify(said));
  console.log('one message region: '+JSON.stringify(await page.evaluate(()=>({
    tags:[...document.querySelectorAll('#tagLayer .fztag.on')].length,
    note:(document.querySelector('#act .fznote')||{}).textContent||null,
    actText:(document.getElementById('act').textContent||'').trim().slice(0,90)}))));
  await page.screenshot({path:path.join(SHOTS,'wrong-tool.png')});

  console.log('PAGE ERRORS: '+(perr.length||'none')); perr.slice(0,10).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: '+(cerr.length||'none')); cerr.slice(0,10).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
