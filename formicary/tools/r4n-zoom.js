const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
const SHOTS = ROOT + '/formicary/shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 6, isMobile: true, hasTouch: true });
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  let got = 0;
  for (const ch of [5, 6, 7, 8]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(400);
    await page.click('#gate button').catch(() => { });
    for (let i = 0; i < 120 && got < 4; i++) {
      await page.waitForTimeout(200);
      const spot = await page.evaluate(() => {
        const S = FZ.sim.state;
        const a = S.agents.find(a => a.place === 'dig');
        if (!a) return null;
        const fr = document.querySelector('#field').getBoundingClientRect();
        return { x: a.x + fr.left, y: a.y + fr.top };
      });
      if (spot) {
        got++;
        const p = SHOTS + 'r4N-zoomdig' + got + '.png';
        const cx = Math.max(0, Math.min(390 - 150, spot.x - 75)), cy = Math.max(0, Math.min(844 - 150, spot.y - 75));
        await page.screenshot({ path: p, clip: { x: cx, y: cy, width: 150, height: 150 } });
        console.log('SHOT', p, 'ch', ch, JSON.stringify(spot));
        await page.waitForTimeout(900);
      }
    }
    if (got >= 4) break;
  }
  if (!got) console.log('no dig found');
  await b.close();
})();
