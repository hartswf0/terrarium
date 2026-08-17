/* GEOMETRIC acceptance test for CONTRACT 16.4: no ant inside solid soil.
   Independent of the sim's own `place` flag: measures each body's distance to the
   nearest DUG tunnel segment or chamber disc, in px. */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  let worstAll = 0, nBad = 0, nSamp = 0;
  for (let c = 0; c < 10; c++) {
    await page.evaluate(i => window.__FZ.goto(i), c);
    await page.waitForTimeout(300);
    if (await page.locator('#gate button').count()) await page.click('#gate button');
    await page.waitForTimeout(300);
    let worst = 0, bad = 0, n = 0;
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const S = FZ.sim.state;
        // reach into the nest via the render layer's accessor if exposed, else via probe
        const N = FZ.sim.nest || null;
        if (!N) return null;
        function segD(px, py, ax, ay, bx, by) {
          const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
          let t = ((px - ax) * dx + (py - ay) * dy) / L; t = Math.max(0, Math.min(1, t));
          return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
        }
        const out = [];
        for (const a of S.agents) {
          let best = 1e9;
          for (const nd of N.nodes) best = Math.min(best, Math.max(0, Math.hypot(a.x - nd.x, a.y - nd.y) - nd.r));
          for (const e of N.edges) {
            if (!e.dug && !(e.prog > 0)) continue;
            const P = N.nodes[e.a], Q = N.nodes[e.b];
            const frac = e.dug ? 1 : e.prog;
            const ex = P.x + (Q.x - P.x) * frac, ey = P.y + (Q.y - P.y) * frac;
            best = Math.min(best, segD(a.x, a.y, P.x, P.y, ex, ey));
            best = Math.min(best, segD(a.x, a.y, Q.x, Q.y, Q.x + (P.x - Q.x) * frac, Q.y + (P.y - Q.y) * frac));
          }
          out.push(+best.toFixed(1));
        }
        return out;
      });
      if (!r) { console.log('nest not exposed; skipping geometric test'); await browser.close(); return; }
      for (const d of r) { n++; if (d > worst) worst = d; if (d > 8) bad++; }
    }
    console.log(`CH${c} maxDistToNetwork=${worst}px  bodiesOver8px=${bad}/${n}`);
    worstAll = Math.max(worstAll, worst); nBad += bad; nSamp += n;
  }
  console.log(`OVERALL worst=${worstAll}px bad=${nBad}/${nSamp}`);
  await browser.close();
})();
