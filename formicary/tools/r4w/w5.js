const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__FZ.goto(0));
  await page.waitForTimeout(300);
  if (await page.locator('#gate button').count()) await page.click('#gate button');
  await page.waitForTimeout(400);
  const box = await page.locator('#field').boundingBox();

  // find an edge being dug, watch it
  let target = null, t0 = null;
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => {
      const S = FZ.sim.state;
      const a = S.agents.find(x => x.place === 'dig');
      if (!a) return null;
      return { id: a.id, e: a.digE, x: Math.round(a.x), y: Math.round(a.y), tick: S.tick,
               prog: (window.FZ.sim.nestDebug ? 0 : 0) };
    });
    if (d) { target = d; t0 = i; break; }
  }
  if (!target) { console.log('no dig found'); await browser.close(); return; }
  console.log('dig start', target);
  const cx = target.x, cy = target.y;
  const crop = async n => { await page.screenshot({ path: path.join(SHOTS, 'r4W-digwatch-' + n + '.png'), clip: { x: box.x + Math.max(0, cx - 110), y: box.y + Math.max(0, cy - 110), width: 220, height: 220 } }); };
  await crop('0');
  await page.waitForTimeout(2500); await crop('1');
  await page.waitForTimeout(2500); await crop('2');
  await page.waitForTimeout(4000); await crop('3');
  console.log('done');
  await browser.close();
})();
