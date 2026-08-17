/* INCIDENT instrument: measure whether the ring holds the bodies for the whole fuse. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const CH = +arg('ch', 3);
  const MS = +arg('ms', 30000);
  const NAME = arg('name', 'r5I-m');
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate((c) => { window.__FZ.goto(c); }, CH);
  // dismiss any gate
  await page.waitForTimeout(400);
  try { const b = await page.$('#gate button'); if (b) await b.click(); } catch (e) { }
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    window.__M = { samples: [], events: [] };
    ['outbreak:open', 'outbreak:answered', 'outbreak:wrong', 'outbreak:landed'].forEach(n => {
      FZ.bus.on(n, d => window.__M.events.push({ n: n, sym: d && d.sym, t: FZ.sim.state.tick }));
    });
    window.__M.iv = setInterval(() => {
      const S = FZ.sim.state; if (!S) return;
      const L = (FZ.outbreak && FZ.outbreak.list) || [];
      L.forEach(o => {
        let n = 0;
        S.agents.forEach(a => { const dx = a.x - o.x, dy = a.y - o.y; if (dx * dx + dy * dy <= o.r * o.r) n++; });
        let jobs = 0;
        S.jobs.forEach(j => { if (j.done) return; const dx = j.x - o.x, dy = j.y - o.y; if (dx * dx + dy * dy <= o.r * o.r) jobs++; });
        window.__M.samples.push({
          id: o.id, sym: o.sym, st: o.state, tick: S.tick,
          age: S.tick - o.born, fuse: o.fuse, bodies: n, jobs: jobs,
          r: Math.round(o.r), kind: o.site && o.site.kind
        });
      });
      window.__M.last = { tick: S.tick, live: L.filter(o => o.state === 'burning').length, act: !!document.querySelector('#act') && document.querySelector('#act').children.length > 0 };
    }, 100);
  });

  const shotAt = (arg('shots', '') || '').split(',').filter(Boolean).map(Number);
  const t0 = Date.now();
  let si = 0;
  while (Date.now() - t0 < MS) {
    await page.waitForTimeout(250);
    if (si < shotAt.length && Date.now() - t0 >= shotAt[si]) {
      await page.screenshot({ path: path.join(SHOTS, NAME + '-' + (si + 1) + '.png') });
      si++;
    }
  }
  const M = await page.evaluate(() => { clearInterval(window.__M.iv); return { samples: window.__M.samples, events: window.__M.events }; });
  // per outbreak summary
  const byId = {};
  M.samples.forEach(s => { (byId[s.id] = byId[s.id] || []).push(s); });
  const rows = [];
  Object.keys(byId).forEach(id => {
    const ss = byId[id].filter(s => s.st === 'burning');
    if (!ss.length) return;
    const need = ['In', 'Cf', 'Dp', 'Fl', 'Im', 'Sp', 'Co', 'Mc', 'Tw', 'Es', 'Cl', 'Mm'].indexOf(ss[0].sym) > -1 ? 2 : 1;
    const empty = ss.filter(s => s.bodies === 0 && s.jobs === 0).length;
    const under = ss.filter(s => s.bodies < need).length;
    rows.push({
      id: +id, sym: ss[0].sym, kind: ss[0].kind, need,
      n: ss.length, minB: Math.min(...ss.map(s => s.bodies)), maxB: Math.max(...ss.map(s => s.bodies)),
      pctEmpty: Math.round(100 * empty / ss.length), pctUnder: Math.round(100 * under / ss.length),
      r: ss[0].r, fuseS: +(ss[0].fuse / 56).toFixed(1)
    });
  });
  console.log('CH', CH, 'PAGE ERRORS', perr.length ? perr : 'none');
  console.log('EVENTS', JSON.stringify(M.events));
  console.table ? console.table(rows) : 0;
  console.log(JSON.stringify(rows, null, 1));
  await browser.close();
})();
