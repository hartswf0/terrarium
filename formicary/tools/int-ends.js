/* Explicit: chapter 0 has no tool bar and no table; chapter 9 has all 28. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const perr=[]; p.on('pageerror', e=>perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html',{waitUntil:'load'});
  await p.waitForTimeout(800);
  for (const ch of [0,9]) {
    await p.evaluate(n=>window.__FZ.goto(n), ch);
    await p.waitForTimeout(400);
    await p.locator('#gate .gtBtn').first().click().catch(()=>{});
    await p.waitForTimeout(6000);
    const r = await p.evaluate(()=>{
      const act=document.getElementById('act'), gm=document.getElementById('guideMark');
      return {
        toolButtons: document.querySelectorAll('#act .fzact').length,
        actVisible: !!act && act.style.display!=='none' && act.offsetHeight>0,
        guideMarkVisible: !!gm && getComputedStyle(gm).display!=='none',
        guideOpen: document.getElementById('guide').classList.contains('on'),
        platesInDom: document.querySelectorAll('#guide .pl').length,
        platesDrawn: document.querySelectorAll('#guide .pl.dr').length,
        enabled: FZ.sim.enabled.size,
        cfgTools: FZ.chapters.list[FZ.chapters.index].cfg.tools,
      };
    });
    console.log('CH'+ch+' '+JSON.stringify(r));
    await p.screenshot({path:'/home/user/terrarium/formicary/shots/ends-ch'+ch+'.png'});
  }
  console.log('PAGE ERRORS: '+(perr.length?perr.join(' | '):'none'));
  await b.close();
})();
