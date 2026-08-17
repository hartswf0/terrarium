/* Final integration sweep: the guide opens between episodes and is locked during a
   burning incident; frame rate under machine speed; long-run stability. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  p.on('pageerror', e => perr.push(e.message));
  p.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);

  // 1. guide at a gate: the mark must be present and must open
  await p.evaluate(() => window.__FZ.goto(5));
  await p.waitForTimeout(800);
  const atGate = await p.evaluate(() => {
    const m = document.getElementById('guideMark');
    const vis = m && getComputedStyle(m).display !== 'none';
    if (vis) m.click();
    const g = document.getElementById('guide');
    return { phase: FZ.chapters.phase(), markVisible: !!vis, guideOpened: g.classList.contains('on'), plates: document.querySelectorAll('#guide .pl').length, drawn: document.querySelectorAll('#guide .pl.dr').length };
  });
  console.log('GUIDE AT GATE ' + JSON.stringify(atGate));
  await p.evaluate(() => FZ.table.close && FZ.table.close());

  // 2. guide during a burning incident: the mark must be absent
  await p.locator('#gate .gtBtn').first().click().catch(() => { });
  let burnState = null;
  for (let i = 0; i < 90; i++) {
    await p.waitForTimeout(300);
    burnState = await p.evaluate(() => {
      const burning = (FZ.outbreak.list || []).filter(o => o.state === 'burning').length;
      const m = document.getElementById('guideMark');
      return { burning, markVisible: !!m && getComputedStyle(m).display !== 'none', guideOpen: document.getElementById('guide').classList.contains('on') };
    });
    if (burnState.burning > 0) break;
  }
  console.log('GUIDE WHILE BURNING ' + JSON.stringify(burnState));

  // 3. frame rate at machine speed (chapter 9)
  await p.evaluate(() => window.__FZ.goto(9));
  await p.waitForTimeout(400);
  await p.locator('#gate .gtBtn').first().click().catch(() => { });
  await p.waitForTimeout(1500);
  const fps = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    (function loop() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(loop); else res(Math.round(n / ((performance.now() - t0) / 1000))); })();
  }));
  console.log('FPS ch9 = ' + fps);

  // 4. long-run stability: 60s of unattended ch9
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) await p.waitForTimeout(2000);
  const st = await p.evaluate(() => { const s = window.__FZ.probe(); return { tick: s.tick, done: s.jobsDone, collapse: Math.round(s.collapse), soil: s.nest.where.soil, over: s.gameOver, phase: FZ.chapters.phase() }; });
  console.log('AFTER 60s UNATTENDED ' + JSON.stringify(st));
  console.log('PAGE ERRORS: ' + (perr.length ? perr.slice(0, 8).join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? cerr.slice(0, 8).join(' | ') : 'none'));
  await b.close();
})();
