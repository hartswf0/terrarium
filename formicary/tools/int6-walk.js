/* integrator chapter walk: for each chapter, goto, begin, play a while, report */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
const PLAY_MS = +(process.argv[3] || 20000);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cerr = [], perr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const chapters = only || [0,1,2,3,4,5,6,7,8,9];
  for (const c of chapters) {
    await page.evaluate(i => window.__FZ.goto(i), c);
    await page.waitForTimeout(400);
    // gate should be up; click BEGIN
    const gateTxt = await page.textContent('#gate').catch(()=> '');
    const btn = page.locator('#gate button.gtBtn').first();
    const nBtn = await page.locator('#gate button').count();
    await btn.click({ timeout: 3000 }).catch(e => console.log(`  ch${c} BEGIN click failed: ${e.message.split('\n')[0]}`));
    await page.waitForTimeout(600);
    const t0 = await page.evaluate(() => window.__FZ.probe());
    // sample during play
    const samples = [];
    const N = Math.round(PLAY_MS / 2000);
    for (let k = 0; k < N; k++) {
      await page.waitForTimeout(2000);
      const s = await page.evaluate(() => {
        const p = window.__FZ.probe();
        const ob = (FZ.outbreak && FZ.outbreak.list) || [];
        return { tick: p.tick, jd: p.jobsDone, jg: p.jobsGoal, bud: p.budget, col: p.collapse,
                 go: p.gameOver, won: p.won, phase: FZ.chapters.phase(),
                 tools: p.tools, en: (p.enabled||[]).length,
                 ob: ob.map(o => o.sym + ':' + o.state),
                 act: (document.getElementById('act').textContent||'').trim().slice(0,60),
                 actKids: document.getElementById('act').children.length,
                 tag: (document.getElementById('tagLayer').textContent||'').trim().slice(0,60),
                 gate: document.getElementById('gate').classList.contains('on'),
                 gateTxt: (document.getElementById('gate').textContent||'').trim().slice(0,90) };
      });
      samples.push(s);
      if (s.gate) break;
    }
    const last = samples[samples.length-1] || {};
    await page.screenshot({ path: path.join(SHOTS, `walk-ch${c}.png`) });
    console.log(`ch${c} tools=${JSON.stringify(t0.tools)} enabled=${(t0.enabled||[]).length} goal=${t0.jobsGoal} | end: tick=${last.tick} jobs=${last.jd}/${last.jg} bud=${last.bud} col=${last.col} phase=${last.phase} gate=${last.gate} :: ${last.gateTxt||''}`);
    console.log(`     ob trail: ${samples.map(s=>s.ob.join('+')||'-').join(' | ')}`);
    console.log(`     act: "${last.act}" kids=${last.actKids}  tag:"${last.tag}"`);
  }

  console.log('PAGE ERRORS: ' + (perr.length ? perr.length : 'none'));
  perr.slice(0,15).forEach(e => console.log('  !! ' + e));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? cerr.length : 'none'));
  cerr.slice(0,15).forEach(e => console.log('  ! ' + e));
  await browser.close();
})();
