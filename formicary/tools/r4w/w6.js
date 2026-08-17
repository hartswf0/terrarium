const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CH = +(process.argv[2] || 9), SECS = +(process.argv[3] || 60);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__log = { open: [], answered: [], landed: [], wrong: [] };
    FZ.bus.on('outbreak:open', d => window.__log.open.push({ s: d.sym, t: FZ.sim.state.tick, ms: Date.now() }));
    FZ.bus.on('outbreak:landed', d => window.__log.landed.push({ s: d.sym, t: FZ.sim.state.tick }));
    FZ.bus.on('outbreak:answered', d => window.__log.answered.push({ s: d.sym, t: FZ.sim.state.tick }));
  });
  await page.evaluate(c => window.__FZ.goto(c), CH);
  await page.waitForTimeout(400);
  if (await page.locator('#gate button').count()) await page.click('#gate button');
  await page.waitForTimeout(400);
  const start = Date.now();
  let shotLanded = 0;
  for (let i = 0; i < SECS; i++) {
    await page.waitForTimeout(1000);
    const d = await page.evaluate(() => ({
      n: window.__log.open.length, land: window.__log.landed.length,
      scars: FZ.sim.state.scars.length, collapse: Math.round(FZ.sim.state.collapse),
      over: FZ.sim.state.gameOver, tick: FZ.sim.state.tick,
      ob: FZ.outbreak.list.map(o => o.sym + ':' + o.state + ':' + (FZ.sim.state.tick - o.born) + '/' + o.fuse),
    }));
    if (d.land > 0 && !shotLanded) { shotLanded = 1; await page.screenshot({ path: path.join(SHOTS, `r4W-landed-ch${CH}.png`) }); console.log('SHOT landed'); }
    if (i % 5 === 0 || d.over) console.log(i + 's', JSON.stringify(d));
    if (d.over) { await page.screenshot({ path: path.join(SHOTS, `r4W-over-ch${CH}.png`) }); break; }
  }
  const secs = (Date.now() - start) / 1000;
  const L = await page.evaluate(() => window.__log);
  console.log(`CH${CH} over ${secs.toFixed(0)}s: opened=${L.open.length} landed=${L.landed.length} -> one decision every ${(secs / Math.max(1, L.open.length)).toFixed(1)}s`);
  console.log('syms', L.open.map(o => o.s).join(','));
  await page.screenshot({ path: path.join(SHOTS, `r4W-idle-ch${CH}.png`) });
  await browser.close();
})();
