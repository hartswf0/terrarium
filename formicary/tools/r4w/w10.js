const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__FZ.goto(8));
  await page.waitForTimeout(300);
  if (await page.locator('#gate button').count()) await page.click('#gate button');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(SHOTS, 'r4W-ch9-mid.png') });
  // open guide
  const gm = await page.locator('#guideMark').count();
  console.log('guideMark', gm, await page.evaluate(() => { const g = document.querySelector('#guideMark'); return g ? getComputedStyle(g).display + ' ' + g.offsetHeight : 'none'; }));
  if (gm) { await page.click('#guideMark', { force: true }); await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, 'r4W-guide.png') }); }
  console.log('guide vis', await page.evaluate(() => { const g = document.querySelector('#guide'); return g ? g.offsetHeight : -1; }));
  await browser.close();
})();
