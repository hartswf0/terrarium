#!/usr/bin/env node
/* PIECE W — does each teaching chapter still produce its lesson within seconds?
 * A chapter that teaches coordination failure must reliably produce one, fast, at the
 * NEW tempo. Prints the tick (and the seconds) at which each taught element first fires.
 * node formicary/tools/w-teach.js [ticks]
 */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  const ticks = +(process.argv[2] || 3000);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + (process.argv[3] || path.join(ROOT, 'formicary.html')), { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const rows = await page.evaluate(({ ticks }) => {
    const S = FZ.sim.state, out = [];
    const list = (FZ.chapters && FZ.chapters.list) || FZ.sim.defaults.map(c => ({ cfg: c }));
    S._silent = true;
    for (let c = 0; c < list.length; c++) {
      const cfg = list[c].cfg || list[c];
      const teach = (cfg.teach || []).slice();
      if (!teach.length) { out.push({ ch: c, teach: [], first: {} }); continue; }
      const first = {}, sum = {};
      const seeds = [cfg.seed || 1, (cfg.seed || 1) + 77, (cfg.seed || 1) + 909];
      teach.forEach(s => { sum[s] = []; });
      for (let k = 0; k < seeds.length; k++) {
        FZ.sim.reset(Object.assign({}, cfg, { seed: seeds[k], goal: { jobs: 1e9 }, collapseMax: 1e9 }));
        const got = {};
        for (let i = 0; i < ticks; i++) {
          FZ.sim.step();
          for (let m = 0; m < teach.length; m++) {
            const e = FZ.ELBY[teach[m]];
            if (e && e.fires > 0 && got[teach[m]] === undefined) { got[teach[m]] = i; }
          }
        }
        teach.forEach(s => sum[s].push(got[s] === undefined ? -1 : got[s]));
      }
      teach.forEach(s => { first[s] = sum[s]; });
      out.push({ ch: c, teach: teach, first: first });
    }
    S._silent = false;
    return out;
  }, { ticks });

  for (const r of rows) {
    if (!r.teach.length) { console.log(`ch${r.ch}  (teaches nothing)`); continue; }
    const parts = r.teach.map(s => {
      const v = r.first[s];
      const txt = v.map(t => t < 0 ? 'never' : (t / 60).toFixed(1) + 's').join('/');
      return `${s} ${txt}`;
    });
    console.log(`ch${r.ch}  ` + parts.join('   '));
  }
  console.log('PAGE ERRORS:', perr.length ? perr.join(' | ') : 'none');
  await browser.close();
})();
