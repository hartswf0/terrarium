const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
const SHOTS = ROOT + '/formicary/shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  for (const ch of [5, 6, 7, 8, 9]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(400);
    await page.click('#gate button').catch(() => { });
    await page.waitForTimeout(9000);
    await page.evaluate(() => { const S = FZ.sim.state; });
    await page.screenshot({ path: SHOTS + 'look-ch' + ch + '.png' });
    console.log('SHOT look-ch' + ch + '.png');
  }
  console.log('PAGE ERRORS:', perr.length ? perr.join(' | ') : 'none');
  console.log('CONSOLE ERRORS:', cerr.length ? cerr.join(' | ') : 'none');
  await b.close();
})();
