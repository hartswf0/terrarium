const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
const SHOTS = ROOT + '/formicary/shots/';
const CH = +(process.argv[2] || 6);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 6, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(c => window.__FZ.goto(c), CH);
  await page.waitForTimeout(400);
  await page.click('#gate button').catch(() => { });
  await page.waitForTimeout(1200);

  const sealed = async () => page.evaluate(() => {
    const N = FZ.sim.state.nest; if (!N) return null;
    const fr = document.querySelector('#field').getBoundingClientRect();
    const S = FZ.sim.state;
    const kx = fr.width / S.w, ky = fr.height / S.h;
    const out = [];
    for (const n of N.nodes) {
      if (n.kind === 'surface') continue;
      if (n.comp !== N.main) out.push({ id: n.id, x: n.x * kx + fr.left, y: n.y * ky + fr.top });
    }
    return out;
  });

  let list = await sealed();
  console.log('SEALED', JSON.stringify(list));
  if (!list || !list.length) { console.log('none sealed'); await b.close(); return; }
  const t = list[0];
  const clip = (cx, cy, s) => ({ x: Math.max(0, Math.min(390 - s, cx - s / 2)), y: Math.max(0, Math.min(844 - s, cy - s / 2)), width: s, height: s });
  await page.screenshot({ path: SHOTS + 'wallA-sealed.png', clip: clip(t.x, t.y, 170) });
  console.log('SHOT wallA-sealed.png');

  // wait for it to open, capture the fall
  for (let i = 0; i < 400; i++) {
    await page.waitForTimeout(150);
    const now = await sealed();
    if (!now) break;
    if (!now.find(n => n.id === t.id)) {
      await page.screenshot({ path: SHOTS + 'wallB-fall1.png', clip: clip(t.x, t.y, 170) });
      await page.waitForTimeout(260);
      await page.screenshot({ path: SHOTS + 'wallB-fall2.png', clip: clip(t.x, t.y, 170) });
      await page.waitForTimeout(500);
      await page.screenshot({ path: SHOTS + 'wallB-fall3.png', clip: clip(t.x, t.y, 170) });
      console.log('SHOT fall at iter', i);
      break;
    }
  }
  console.log('PAGE ERRORS:', perr.length ? perr.join(' | ') : 'none');
  await b.close();
})();
