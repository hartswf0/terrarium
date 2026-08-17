const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const cerr=[], perr=[];
  page.on('console', m=>{ if(m.type()==='error') cerr.push(m.text()); });
  page.on('pageerror', e=>perr.push(e.message));
  await page.goto('file://'+path.join(ROOT,'formicary.html'), {waitUntil:'load'});
  await page.waitForTimeout(900);
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : [0,1,2,3,4,5,6,7,8,9];
  for (const i of only) {
    const before = perr.length;
    await page.evaluate(n=>window.__FZ.goto(n), i);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(()=>{
      const q=s=>document.querySelector(s);
      const st = window.__FZ.probe();
      const act = q('#act');
      const bar = document.querySelectorAll('#act button, #act .tool, [data-tool]');
      return {
        chapter: st.chapter, tick: st.tick, goal: st.jobsGoal, done: st.jobsDone,
        budget: st.budget, collapse: st.collapse, enabled: st.enabled.length,
        tools: st.tools, gameOver: st.gameOver, won: st.won,
        actHTML: act ? act.innerHTML.replace(/\s+/g,' ').slice(0,240) : null,
        actKids: act ? act.children.length : -1,
        toolBtns: [...document.querySelectorAll('[data-tool]')].map(e=>e.getAttribute('data-tool')),
        tags: document.querySelectorAll('#tagLayer > *').length,
        cells: document.querySelectorAll('#guide .cell, #guide [data-sym]').length,
        gateVis: q('#gate') ? getComputedStyle(q('#gate')).display : null,
        gateText: q('#gate') ? (q('#gate').textContent||'').replace(/\s+/g,' ').trim().slice(0,160) : null,
        chapTitle: (q('#chapTitle')||{}).textContent,
        nest: st.nest, bodies: st.bodies && st.bodies.weather,
      };
    });
    console.log('CH'+i+' '+JSON.stringify(info));
    await page.screenshot({ path: path.join(SHOTS, 'walk-ch'+i+'.png') });
    if (perr.length>before) console.log('  ERRORS IN CH'+i+': '+perr.slice(before).join(' | '));
  }
  console.log('PAGE ERRORS: '+(perr.length?perr.slice(0,10).join('\n  !! '):'none'));
  console.log('CONSOLE ERRORS: '+(cerr.length?cerr.slice(0,10).join('\n  ! '):'none'));
  await browser.close();
})();
