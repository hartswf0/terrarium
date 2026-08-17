const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__FZ.goto(1));
  await page.waitForTimeout(300);
  if (await page.locator('#gate button').count()) await page.click('#gate button');
  await page.waitForTimeout(300);
  const box = await page.locator('#field').boundingBox();
  const S = async () => await page.evaluate(() => ({
    budget: FZ.sim.state.budget,
    ob: FZ.outbreak.list.map(o => ({ s: o.sym, st: o.state, x: Math.round(o.x), y: Math.round(o.y), r: o.r, ans: o.answers })),
    act: (document.querySelector('#act') || {}).innerText || '',
    tag: (document.querySelector('#tagLayer') || {}).innerText || '',
    armed: FZ.controls.armed,
  }));

  console.log('BEFORE ANY TAP', JSON.stringify(await S()));
  // dead-tap test: tap empty soil with nothing armed
  await page.mouse.click(box.x + 60, box.y + 600);
  await page.waitForTimeout(400);
  console.log('AFTER SOIL TAP (nothing armed)', JSON.stringify(await S()));

  // wait for outbreak
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); const s = await S(); if (s.ob.length) { console.log('OUTBREAK', JSON.stringify(s)); break; } }
  await page.screenshot({ path: path.join(SHOTS, 'r4W-flow-1burn.png') });

  // tap the act button (arm), then tap far from the outbreak (wrong place)
  const btn = await page.locator('#act button').count();
  console.log('#act buttons', btn, await page.locator('#act').innerText());
  await page.click('#act button');
  await page.waitForTimeout(300);
  console.log('AFTER ARM', JSON.stringify(await S()));
  await page.screenshot({ path: path.join(SHOTS, 'r4W-flow-2armed.png') });

  const o = (await S()).ob[0];
  // wrong place first
  await page.mouse.click(box.x + 40, box.y + 60);
  await page.waitForTimeout(600);
  console.log('AFTER WRONG-PLACE TAP', JSON.stringify(await S()));
  await page.screenshot({ path: path.join(SHOTS, 'r4W-flow-3wrongplace.png') });

  // right place
  const s2 = await S();
  if (s2.armed == null && await page.locator('#act button').count()) await page.click('#act button');
  await page.waitForTimeout(200);
  const o2 = (await S()).ob[0];
  if (o2) {
    await page.mouse.click(box.x + o2.x, box.y + o2.y);
    await page.waitForTimeout(500);
    console.log('AFTER RIGHT-PLACE TAP', JSON.stringify(await S()));
    await page.screenshot({ path: path.join(SHOTS, 'r4W-flow-4answered.png') });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, 'r4W-flow-5after.png') });
    console.log('1.5s LATER', JSON.stringify(await S()));
  }
  console.log('ERR', perr.slice(0, 3));
  await browser.close();
})();
