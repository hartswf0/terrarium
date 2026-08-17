const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
const SHOTS = ROOT + '/formicary/shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const want = process.argv[2] || 'low';   // 'low' = outbreak under bar, 'dig' = someone digging
  let got = 0;
  for (const ch of [5, 6, 7, 8, 9]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(400);
    await page.click('#gate button').catch(() => { });
    for (let i = 0; i < 80 && got < 3; i++) {
      await page.waitForTimeout(250);
      const hit = await page.evaluate(w => {
        const fr = document.querySelector('#field').getBoundingClientRect();
        const ae = document.querySelector('#act');
        const ar = ae && ae.firstChild ? ae.getBoundingClientRect() : null;
        const actTop = ar && ar.height ? ar.top - fr.top : 1e9;
        const O = (FZ.outbreak && FZ.outbreak.list || []).filter(o => o.state === 'burning');
        if (w === 'low') return O.some(o => o.y > actTop - 40) ? 'ob@' + Math.round(O[0].y) + '_bar' + Math.round(actTop) : null;
        const n = window.__FZ.probe().nest;
        return n.digging > 0 ? 'dig' + n.digging + '_faces' + n.faces : null;
      }, want);
      if (hit) { got++; const p = SHOTS + 'r4N-' + want + got + '.png'; await page.screenshot({ path: p }); console.log('SHOT', p, hit, 'ch', ch); }
    }
    if (got >= 3) break;
  }
  if (!got) console.log('NONE FOUND for', want);
  await b.close();
})();
