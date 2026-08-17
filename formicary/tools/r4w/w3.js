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

  for (let c = 0; c < 10; c++) {
    await page.evaluate(i => window.__FZ.goto(i), c);
    await page.waitForTimeout(400);
    if (await page.locator('#gate button').count()) { await page.click('#gate button'); }
    await page.waitForTimeout(400);
    // sample soil + speed + fuse over 12s
    let soilMax = 0, samples = [], fuses = new Set(), tick0 = null, t0 = Date.now();
    let queuedMax = 0, jamMax = 0, digTot = 0, tunnels0 = null, tunnelsN = 0;
    // track agent 0 travel distance
    let track = [];
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(200);
      const d = await page.evaluate(() => {
        const S = FZ.sim.state, p = window.__FZ.probe();
        return {
          tick: S.tick, soil: p.nest.where.soil, queued: p.nest.queued, jammed: p.nest.jammed,
          tunnels: p.nest.tunnels, dig: p.nest.digging, speedMul: p.speedMul,
          fuses: (FZ.outbreak.list || []).map(o => o.fuse),
          a0: S.agents[0] ? [Math.round(S.agents[0].x), Math.round(S.agents[0].y)] : null,
          w: S.w, h: S.h, over: S.gameOver,
        };
      });
      if (tick0 === null) { tick0 = d.tick; tunnels0 = d.tunnels; }
      soilMax = Math.max(soilMax, d.soil); queuedMax = Math.max(queuedMax, d.queued);
      jamMax = Math.max(jamMax, d.jammed); tunnelsN = d.tunnels; digTot += d.dig;
      d.fuses.forEach(f => fuses.add(f));
      if (d.a0) track.push(d.a0);
      samples.push(d.tick);
      if (d.over) break;
    }
    const secs = (Date.now() - t0) / 1000;
    const tps = (samples[samples.length - 1] - tick0) / secs;
    // path length of agent 0
    let dist = 0; for (let i = 1; i < track.length; i++) dist += Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1]);
    const dim = await page.evaluate(() => [FZ.sim.state.w, FZ.sim.state.h]);
    console.log(`CH${c} tps=${tps.toFixed(1)} soilMax=${soilMax} queuedMax=${queuedMax} jamMax=${jamMax} tunnels ${tunnels0}->${tunnelsN} digSamples=${digTot} fuses=${[...fuses]} agent0 pxPerSec=${(dist / secs).toFixed(1)} field=${dim} crossSecs=${(dim[1] / (dist / secs)).toFixed(1)}`);
    await page.screenshot({ path: path.join(SHOTS, `r4W-tour-ch${c}.png`) });
  }
  console.log('ERRORS', perr.slice(0, 5));
  await browser.close();
})();
