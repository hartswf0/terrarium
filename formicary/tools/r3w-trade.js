const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = '/home/user/terrarium/formicary/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, 'r3W-' + n + '.png') }); console.log('SHOT ' + n); };
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(400); await page.click('#gate button');
  // wait for a burning outbreak so the bar is present, then press TALLY (ledger)
  for (let i = 0; i < 60; i++) {
    const b = await page.$('#act button[data-kind="ledger"]');
    if (b && await b.isVisible()) {
      await b.click();
      await page.waitForTimeout(200);
      console.log('AFTER LEDGER tag=', JSON.stringify(await page.textContent('#tagLayer')));
      const st = await page.evaluate(() => window.__FZ.probe());
      console.log('trustBias', st.trustBias, 'narrator', JSON.stringify(st.narrator));
      await shot('trade-ledger');
      break;
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1200);
  for (let i = 0; i < 60; i++) {
    const b = await page.$('#act button[data-kind="lens"]');
    if (b && await b.isVisible()) {
      await b.click();
      await page.waitForTimeout(200);
      console.log('AFTER LENS tag=', JSON.stringify(await page.textContent('#tagLayer')));
      const st = await page.evaluate(() => window.__FZ.probe());
      console.log('trustBias', st.trustBias, 'narrator', JSON.stringify(st.narrator));
      await shot('trade-lens');
      break;
    }
    await page.waitForTimeout(300);
  }
  await browser.close();
})();
