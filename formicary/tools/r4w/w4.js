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
  await page.evaluate(() => window.__FZ.goto(3));
  await page.waitForTimeout(400);
  if (await page.locator('#gate button').count()) await page.click('#gate button');
  await page.waitForTimeout(600);

  const box = await page.locator('#field').boundingBox();
  const crop = async (name, cx, cy, s) => {
    await page.screenshot({ path: path.join(SHOTS, 'r4W-' + name + '.png'), clip: { x: box.x + Math.max(0, cx - s / 2), y: box.y + Math.max(0, cy - s / 2), width: s, height: s } });
    console.log('CROP ' + name);
  };

  let gotDig = 0, gotHead = 0, gotQ = 0;
  for (let i = 0; i < 140; i++) {
    await page.waitForTimeout(250);
    const d = await page.evaluate(() => {
      const S = FZ.sim.state;
      const digs = S.agents.filter(a => a.place === 'dig').map(a => [Math.round(a.x), Math.round(a.y)]);
      const heads = S.agents.filter(a => a.headOn).map(a => [Math.round(a.x), Math.round(a.y)]);
      const blocked = S.agents.filter(a => a.blockT > 20).map(a => [Math.round(a.x), Math.round(a.y)]);
      return { digs, heads, blocked, tick: S.tick };
    });
    if (d.digs.length && !gotDig) { gotDig = 1; await crop('dig', d.digs[0][0], d.digs[0][1], 170); console.log('dig at', d.digs[0]); }
    if (d.heads.length >= 2 && !gotHead) { gotHead = 1; await crop('headon', d.heads[0][0], d.heads[0][1], 170); console.log('headon', d.heads); }
    if (d.blocked.length >= 2 && !gotQ) { gotQ = 1; await crop('queue', d.blocked[0][0], d.blocked[0][1], 190); console.log('queue', d.blocked); }
    if (gotDig && gotHead && gotQ) break;
  }
  console.log('found', { gotDig, gotHead, gotQ });
  await browser.close();
})();
