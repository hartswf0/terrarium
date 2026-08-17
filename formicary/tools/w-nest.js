#!/usr/bin/env node
/* PIECE W harness — run the sandbox headless in the real build and report the nest.
 * node formicary/tools/w-nest.js [ticks] [chapter]
 * Prints, every quarter of the run: where the bodies are, what is dug, what is stuck.
 * `soil` must be 0 on every line, in every scenario (CONTRACT §16.4).
 */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  const ticks = +(process.argv[2] || 6000);
  const chap = process.argv[3] == null ? 9 : +process.argv[3];
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const out = await page.evaluate(({ ticks, chap }) => {
    const S = FZ.sim.state;
    const cfg = FZ.chapters && FZ.chapters.list && FZ.chapters.list[chap]
      ? FZ.chapters.list[chap].cfg : FZ.sim.defaults[chap];
    S._silent = true;
    const rows = [];
    let worstSoil = 0, seen = 0;
    for (let s = 0; s < 3; s++) {
      FZ.sim.reset(Object.assign({}, cfg, { seed: 900 + s * 131, goal: { jobs: 1e9 }, collapseMax: 1e9 }));
      for (let i = 0; i < ticks; i++) {
        FZ.sim.step();
        const c = __FZ.probe().nest;
        if (c.where.soil > worstSoil) worstSoil = c.where.soil;
        if (i % Math.round(ticks / 4) === 0 || i === ticks - 1) {
          rows.push({ seed: s, t: i, ...c.where, dug: c.tunnels, undug: c.undug,
            faces: c.faces, digging: c.digging, q: c.queued, ho: c.headOn,
            jam: c.jammed, sealed: c.sealedJobs, jobs: S.jobsDone, strain: +S.collapse.toFixed(0) });
        }
        seen++;
      }
    }
    S._silent = false;
    const hot = FZ.EL.filter(e => FZ.sim.enabled.has(e.sym)).map(e => e.sym + ':' + e.fires).join(' ');
    return { rows, worstSoil, seen, hot };
  }, { ticks, chap });

  const pace = await page.evaluate(() => {
    const S = FZ.sim.state, N = FZ.sim.nest;
    const lens = N.edges.map(e => e.len);
    const spine = N.edges.filter(e => e.cap > 1).reduce((s, e) => s + e.len, 0);
    const mean = lens.reduce((s, x) => s + x, 0) / lens.length;
    return { field: S.w + 'x' + S.h, nodes: N.nodes.length, edges: N.edges.length,
      spine: Math.round(spine), spineSec: +(spine / (1.15 * 60)).toFixed(1),
      lateral: Math.round(mean), lateralSec: +(mean / (1.15 * 60)).toFixed(1) };
  });
  console.log(`PACE  field ${pace.field}  ${pace.nodes} rooms  ${pace.edges} passages  ` +
    `spine ${pace.spine}px = ${pace.spineSec}s end to end  ` +
    `mean passage ${pace.lateral}px = ${pace.lateralSec}s`);

  for (const r of out.rows) {
    console.log(`s${r.seed} t${String(r.t).padStart(5)}  ch:${r.chamber} tun:${r.tunnel} dig:${r.dig} surf:${r.surface} SOIL:${r.soil}` +
      `  dug ${r.dug}/${r.dug + r.undug} faces:${r.faces} diggers:${r.digging}` +
      `  q:${r.q} headOn:${r.ho} jam:${r.jam} sealedJobs:${r.sealed}  jobs:${r.jobs} strain:${r.strain}`);
  }
  console.log('WORST SOIL OVER ' + out.seen + ' TICKS:', out.worstSoil);
  console.log('FIRES', out.hot);
  console.log('PAGE ERRORS:', perr.length ? perr.join(' | ') : 'none');
  await browser.close();
})();
