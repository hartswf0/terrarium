const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__FZ.goto(5));
  await page.waitForTimeout(400);
  await page.click('#gate button').catch(() => { });
  // find internals
  const has = await page.evaluate(() => Object.keys(window).filter(k => /NEST|nest/i.test(k)));
  console.log('globals', JSON.stringify(has));
  // measure crossing speed: track one agent's path length per second
  let last = null;
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const S = FZ.sim.state;
      const p = window.__FZ.probe();
      return { tick: S.tick, a0: { x: Math.round(S.agents[0].x), y: Math.round(S.agents[0].y), pl: S.agents[0].place }, dig: p.nest.digging, undug: p.nest.undug, tunnels: p.nest.tunnels, wear: p.nest.wear };
    });
    if (last) {
      const d = Math.hypot(s.a0.x - last.a0.x, s.a0.y - last.a0.y);
      console.log(`t=${s.tick} dTicks=${s.tick - last.tick} ant0 moved ${d.toFixed(0)}px/s place=${s.a0.pl} dig=${s.dig} tunnels=${s.tunnels} undug=${s.undug}`);
    }
    last = s;
  }
  await b.close();
})();
