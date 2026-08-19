/* the controlled re-run (passage 5) and the ending gate, exercised explicitly */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('console', m => { if (m.type()==='error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil:'load' });
  await page.waitForTimeout(800);
  const box = await page.locator('#field').boundingBox();

  const gate = () => page.evaluate(() => {
    const g = document.getElementById('gate');
    return { on: g.classList.contains('on'),
             title: (g.querySelector('.gtTitle')||{}).textContent||'',
             win: (g.querySelector('.gtWin')||{}).textContent||'',
             ab: [...g.querySelectorAll('.abr')].map(r => r.textContent.trim().replace(/\s+/g,' ')),
             btns: [...g.querySelectorAll('button.gtBtn')].map(b=>b.textContent.trim()) };
  });

  // --- A/B: passage 5 -------------------------------------------------
  await page.evaluate(() => window.__FZ.goto(4));
  await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click();
  console.log('run 1 begun (no instruments)');
  for (let i=0;i<40;i++){ await page.waitForTimeout(1000); const g=await gate(); if (g.on){ console.log('GATE1 ' + JSON.stringify(g)); await page.screenshot({path:path.join(SHOTS,'ab-rerun.png')}); break; } }

  // press AGAIN -> run 2, with VARY. Play it: answer with vary.
  await page.locator('#gate button.gtBtn').first().click();
  await page.waitForTimeout(600);
  console.log('run 2 tools: ' + JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('#act button[data-kind]')].map(b=>b.getAttribute('data-kind')))));
  const t0 = Date.now();
  while (Date.now()-t0 < 60000) {
    const s = await page.evaluate(() => {
      const S = FZ.sim.state, g = document.getElementById('gate');
      const b = (FZ.outbreak.list||[]).filter(o=>o.state==='burning')[0];
      return { gate: g.classList.contains('on'), bud: S.budget, w:S.w, h:S.h,
               burn: b?{x:b.x,y:b.y,answers:b.answers,sym:b.sym}:null,
               avail: [...document.querySelectorAll('#act button[data-kind]')].map(x=>x.getAttribute('data-kind')) };
    });
    if (s.gate) break;
    // always try to spend VARY: the one variable of the experiment
    if (s.avail.includes('vary') && s.bud >= await page.evaluate(()=>FZ.sim.cost('vary'))) {
      const tx = s.burn ? s.burn.x : s.w/2, ty = s.burn ? s.burn.y : s.h/2;
      await page.click('#act button[data-kind="vary"]', {timeout:1200}).catch(()=>{});
      await page.mouse.click(box.x + tx*(box.width/s.w), box.y + ty*(box.height/s.h));
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(250);
  }
  const g2 = await gate();
  console.log('GATE2 ' + JSON.stringify(g2));
  await page.screenshot({path:path.join(SHOTS,'ab-after.png')});
  console.log('vary used: ' + await page.evaluate(()=>{ let n=0; return n; }));

  // --- the ending -----------------------------------------------------
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click();
  await page.waitForTimeout(1200);
  // force a loss to reach the ending gate
  await page.evaluate(() => { FZ.sim.state.collapse = FZ.sim.state.collapseMax; });
  for (let i=0;i<20;i++){ await page.waitForTimeout(700); const g=await gate(); if (g.on){ console.log('ENDGATE ' + JSON.stringify(g).slice(0,400)); await page.screenshot({path:path.join(SHOTS,'ab-end.png')}); break; } }

  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,10).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: ' + (cerr.length||'none')); cerr.slice(0,10).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
