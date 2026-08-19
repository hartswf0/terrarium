#!/usr/bin/env node
/* PIECE W, round 6 — is the colony ever without something to point at?
 * Runs the sandbox headless through the REAL loop (outbreak live) with a synthetic
 * player at a given accuracy, and reports, per 100 ticks:
 *   distress.n   how many live structural complaints existed
 *   health/vigor the throttle
 *   dryN         ticks with ZERO distress sites AND no burning incident — the dead screen
 */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');

function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const p = +arg('p', 1), ticks = +arg('ticks', 9000), seed = +arg('seed', 4242), ch = +arg('ch', -1);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const out = await page.evaluate(({ p, ticks, seed, ch }) => {
    const S = FZ.sim.state;
    const L0 = (FZ.chapters && FZ.chapters.list && FZ.chapters.list.length) ? FZ.chapters.list : null;
    const pick = ch >= 0
      ? (L0 ? L0[Math.min(L0.length - 1, ch)].cfg : FZ.sim.defaults[Math.min(FZ.sim.defaults.length - 1, ch)])
      : (L0 ? L0[L0.length - 1].cfg : FZ.sim.defaults[FZ.sim.defaults.length - 1]);
    const cfg = JSON.parse(JSON.stringify(pick));
    cfg.collapseMax = 100; cfg.goal = { survive: ticks + 10 };
    cfg.seed = seed;
    S._silent = 'loop';
    if (FZ.chapters) FZ.chapters.phase = function () { return 'play'; };
    FZ.sim.reset(cfg);
    if (FZ.outbreak && FZ.outbreak.reset) FZ.outbreak.reset(cfg);
    if (FZ.outbreak) FZ.outbreak.cap = 3;

    let rs = 99991;
    const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };

    const seen = {};
    let dry = 0, dryRun = 0, dryMax = 0, hSum = 0, vSum = 0, nSum = 0, samples = 0, hMax = 0, hi = 0, vMax = 0;
    const whyN = {}, kindN = {};
    for (let t = 0; t < ticks && !S.gameOver; t++) {
      FZ.sim.step();
      if (FZ.outbreak && FZ.outbreak.update) FZ.outbreak.update(S);
      const L = FZ.outbreak ? FZ.outbreak.list : [];
      for (let i = 0; i < L.length; i++) {
        const o = L[i];
        if (o.state !== 'burning' || seen[o.id]) continue;
        seen[o.id] = 1;
        const el = FZ.ELBY[o.sym];
        const ans = (el && el.answers) || [];
        const ok = rnd() < p && ans.length;
        const kind = ok ? ans[0] : 'vary';
        FZ.outbreak.tryAnswer(kind, o.x, o.y);
        S.budget = Math.max(S.budget, 4);
        FZ.sim.apply(kind, o.x, o.y);
      }
      const burning = L.some(o => o.state === 'burning');
      const D = S.distress;
      if (t % 5 === 0) {
        samples++; hSum += S.health; vSum += S.vigor; nSum += D.n;
        if (S.health > hMax) hMax = S.health; if (S.vigor > vMax) vMax = S.vigor; if (S.health > 0.5) hi++;
        for (let i = 0; i < D.sites.length; i++) {
          whyN[D.sites[i].kind + ':' + D.sites[i].why] = (whyN[D.sites[i].kind + ':' + D.sites[i].why] || 0) + 1;
          kindN[D.sites[i].kind] = (kindN[D.sites[i].kind] || 0) + 1;
        }
      }
      if (!D.n && !burning) { dry++; dryRun++; if (dryRun > dryMax) dryMax = dryRun; } else dryRun = 0;
    }
    return {
      ticks: S.tick, over: S.gameOver, won: S.won, jobs: S.jobsDone,
      strain: Math.round(S.collapse), scar: Math.round(S.scar),
      health: +(hSum / samples).toFixed(2), vigor: +(vSum / samples).toFixed(2),
      sites: +(nSum / samples).toFixed(2),
      hMax: +hMax.toFixed(2), vMax: +vMax.toFixed(2), pctHealthy: +(100 * hi / samples).toFixed(1),
      speedMul: +S.speedMul.toFixed(2),
      dryPct: +(100 * dry / S.tick).toFixed(1), dryMax: dryMax,
      why: whyN, kind: kindN,
    };
  }, { p, ticks, seed, ch });

  console.log('p=' + p, JSON.stringify(out, null, 1));
  if (perr.length) console.log('PAGE ERRORS:', perr.join(' | '));
  await browser.close();
})();
