const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 5, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__FZ.goto(7));
  await page.waitForTimeout(300);
  await page.click('#gate button').catch(() => { });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const S = FZ.sim.state;
    const modes = ['truce', 'force', 'passivity', 'unsettled'];
    modes.forEach((m, i) => FZ.bus.emit('conflict:resolved', { mode: m, x: S.w * (0.2 + i * 0.2), y: S.h * 0.5 }));
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: ROOT + '/formicary/shots/ends.png', clip: { x: 20, y: 330, width: 350, height: 120 } });
  console.log('SHOT ends.png');
  console.log('PAGE ERRORS:', perr.length ? perr.join(' | ') : 'none');
  await b.close();
})();
