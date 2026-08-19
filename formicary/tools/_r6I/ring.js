/* r6I ring-stability + answer-lands harness */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

const CH = +(process.argv[2] || 3);
const SECS = +(process.argv[3] || 45);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.evaluate(n => window.__FZ.goto(n), CH);
  await page.waitForTimeout(400);
  // dismiss gate
  for (let i = 0; i < 3; i++) {
    const b = await page.locator('.gtBtn').first();
    if (await b.count() && await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(300); }
  }
  // install sampler
  await page.evaluate(() => {
    window.__S = { samples: [], events: [] };
    const O = FZ.outbreak;
    ['outbreak:open','outbreak:answered','outbreak:wrong','outbreak:landed'].forEach(n =>
      FZ.bus.on(n, d => window.__S.events.push({ n, t: Date.now(), sym: d && d.sym, x: d && d.x, y: d && d.y })));
    setInterval(() => {
      const st = FZ.sim.state;
      const l = (O.list || []).filter(o => o.state === 'burning').map(o => ({
        id: o.id, sym: o.sym, x: Math.round(o.x), y: Math.round(o.y), r: Math.round(o.r),
        bodies: st.agents.filter(a => (a.x-o.x)**2 + (a.y-o.y)**2 <= o.r*o.r).length,
        tag: st.tick >= o.tagAt,
      }));
      window.__S.samples.push({ t: Date.now(), tick: st.tick, list: l });
    }, 50);
  });
  await page.waitForTimeout(SECS * 1000);
  const out = await page.evaluate(() => {
    const S = window.__S;
    // per-outbreak displacement analysis
    const byId = {};
    S.samples.forEach(s => s.list.forEach(o => {
      (byId[o.id] = byId[o.id] || { sym: o.sym, pts: [] }).pts.push({ t: s.t, x: o.x, y: o.y, r: o.r, bodies: o.bodies, tag: o.tag });
    }));
    const rings = Object.keys(byId).map(id => {
      const p = byId[id].pts;
      let maxStep = 0, max700 = 0, emptyTagged = 0, taggedFrames = 0;
      for (let i = 1; i < p.length; i++) {
        const d = Math.hypot(p[i].x - p[i-1].x, p[i].y - p[i-1].y);
        if (d > maxStep) maxStep = d;
      }
      for (let i = 0; i < p.length; i++) {
        for (let k = i+1; k < p.length && p[k].t - p[i].t <= 700; k++) {
          const d = Math.hypot(p[k].x - p[i].x, p[k].y - p[i].y);
          if (d > max700) max700 = d;
        }
        if (p[i].tag) { taggedFrames++; if (p[i].bodies === 0) emptyTagged++; }
      }
      const total = Math.hypot(p[p.length-1].x - p[0].x, p[p.length-1].y - p[0].y);
      const rr = p[0].r;
      return { id: +id, sym: byId[id].sym, frames: p.length, r: rr,
        maxStep: +maxStep.toFixed(1), max700: +max700.toFixed(1), max700_over_r: +(max700/rr).toFixed(2),
        netDrift: +total.toFixed(1), emptyTaggedFrames: emptyTagged, taggedFrames };
    });
    return { rings, events: S.events.map(e => e.n + ':' + e.sym), frames: S.samples.length,
      liveFrames: S.samples.filter(s => s.list.length).length };
  });
  console.log(JSON.stringify(out, null, 1));
  if (perr.length) console.log('PAGE ERRORS', perr.slice(0,5));
  await browser.close();
})();
