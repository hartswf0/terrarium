const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') perr.push('C:' + m.text()); });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, 'r4W-' + n + '.png') }); console.log('SHOT ' + n); };
  const P = async () => await page.evaluate(() => window.__FZ.probe());

  // dump DOM structure of gate + act
  console.log('GATE HTML:', (await page.evaluate(() => document.querySelector('#gate') ? document.querySelector('#gate').innerHTML : 'none')).slice(0, 800));
  console.log('BODY IDS:', await page.evaluate(() => [...document.querySelectorAll('#app > *')].map(e => e.id + ':' + (e.offsetHeight))));

  // tap begin
  await page.click('#gate button');
  await page.waitForTimeout(1200);
  await shot('ch1-a');
  console.log('P1', JSON.stringify(await P()).slice(0, 1200));
  await page.waitForTimeout(4000);
  await shot('ch1-b');
  const p2 = await P();
  console.log('P2 nest', JSON.stringify(p2.nest), 'tick', p2.tick, 'act', await page.evaluate(() => { const a = document.querySelector('#act'); return a ? (a.offsetHeight + '|' + a.innerText.replace(/\n/g, ' / ')) : 'none'; }));
  await page.waitForTimeout(6000);
  await shot('ch1-c');
  console.log('P3 nest', JSON.stringify((await P()).nest));
  console.log('ERRORS', perr);
  await browser.close();
})();
