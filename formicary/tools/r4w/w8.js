const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CH = +(process.argv[2] || 3);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(c => window.__FZ.goto(c), CH);
  await page.waitForTimeout(300);
  if (await page.locator('#gate button').count()) await page.click('#gate button');
  await page.waitForTimeout(300);
  const box = await page.locator('#field').boundingBox();
  const S = async () => await page.evaluate(() => ({
    budget: FZ.sim.state.budget, works: FZ.sim.state.works.length,
    ob: FZ.outbreak.list.map(o => ({ s: o.sym, st: o.state, x: Math.round(o.x), y: Math.round(o.y), ans: o.answers })),
    tag: ((document.querySelector('#tagLayer') || {}).innerText || '').replace(/\n/g, ' | '),
    act: ((document.querySelector('#act') || {}).innerText || '').replace(/\n/g, ' | '),
  }));
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(400); const s = await S(); if (s.ob.length) { console.log('OB', JSON.stringify(s)); break; } }
  await page.screenshot({ path: path.join(SHOTS, `r4W-ans${CH}-before.png`) });
  const s0 = await S(); const o = s0.ob[0];
  // find act button matching the right answer; just press the first
  const btns = await page.locator('#act button').count();
  console.log('act buttons', btns, s0.act);
  await page.locator('#act button').first().click();
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + o.x, box.y + o.y);
  await page.waitForTimeout(400);
  console.log('AFTER', JSON.stringify(await S()));
  await page.screenshot({ path: path.join(SHOTS, `r4W-ans${CH}-after.png`) });
  await page.waitForTimeout(3500);
  console.log('+3.5s', JSON.stringify(await S()));
  await page.screenshot({ path: path.join(SHOTS, `r4W-ans${CH}-settled.png`) });
  await browser.close();
})();
