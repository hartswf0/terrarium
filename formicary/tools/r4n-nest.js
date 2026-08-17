const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = ROOT + '/formicary/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const ch = +(process.argv[2] || 6);
  await page.evaluate(c => window.__FZ.goto(c), ch);
  await page.waitForTimeout(500);
  await page.click('#gate button').catch(()=>{});
  await page.waitForTimeout(500);

  const geo = await page.evaluate(() => {
    const r = e => { const b = document.querySelector(e); if (!b) return null; const x = b.getBoundingClientRect(); return { t: Math.round(x.top), b: Math.round(x.bottom), l: Math.round(x.left), r: Math.round(x.right) }; };
    return { field: r('#field'), act: r('#act'), crown: r('#crown'), h: FZ.sim.state.h, w: FZ.sim.state.w };
  });
  console.log('GEO', JSON.stringify(geo));

  // sample over time
  const samples = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => {
      const S = FZ.sim.state;
      const N = window.__NESTDBG || null;
      const obs = (FZ.outbreak && FZ.outbreak.list || []).map(o => ({ sym: o.sym, x: Math.round(o.x), y: Math.round(o.y), st: o.state }));
      const actR = document.querySelector('#act');
      const ar = actR ? actR.getBoundingClientRect() : null;
      const fr = document.querySelector('#field').getBoundingClientRect();
      const p = window.__FZ.probe();
      return { t: S.tick, obs, actTop: ar && ar.height ? Math.round(ar.top - fr.top) : null, fieldH: Math.round(fr.height), nest: p.nest, tag: (document.querySelector('#tagLayer') || {}).innerText || '' };
    });
    samples.push(s);
  }
  const occl = samples.flatMap(s => s.obs.filter(o => s.actTop != null && o.y > s.actTop).map(o => ({ sym: o.sym, y: o.y, actTop: s.actTop })));
  console.log('FIELD H', samples[0].fieldH, 'actTop samples', [...new Set(samples.map(s => s.actTop))].join(','));
  console.log('OUTBREAK Ys', JSON.stringify([...new Set(samples.flatMap(s => s.obs.map(o => o.sym + '@' + o.y)))]));
  console.log('OCCLUDED', JSON.stringify(occl));
  console.log('DIGGING max', Math.max(...samples.map(s => s.nest.digging)), 'faces max', Math.max(...samples.map(s => s.nest.faces)));
  console.log('SOIL max', Math.max(...samples.map(s => s.nest.soil || 0)), 'surface max', Math.max(...samples.map(s => s.nest.where.surface)));
  console.log('WHERE last', JSON.stringify(samples[samples.length-1].nest.where));
  console.log('queued max', Math.max(...samples.map(s=>s.nest.queued)), 'headOn max', Math.max(...samples.map(s=>s.nest.headOn)), 'jammed max', Math.max(...samples.map(s=>s.nest.jammed)));
  console.log('PERR', perr.length ? perr.slice(0,4) : 'none');
  await b.close();
})();
