const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const out = { obY: [], occAnts: 0, totAnts: 0, actUp: 0, digging: 0, faces: 0, headOn: 0, queued: 0, soil: 0, surf: 0, where: {}, wear: 0, tags: new Set() };
  for (const ch of [5, 6, 7, 8, 9]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(400);
    await page.click('#gate button').catch(() => { });
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(400);
      const s = await page.evaluate(() => {
        const S = FZ.sim.state;
        const fr = document.querySelector('#field').getBoundingClientRect();
        const ae = document.querySelector('#act');
        const ar = ae && ae.firstChild ? ae.getBoundingClientRect() : null;
        const actTop = ar && ar.height ? ar.top - fr.top : null;
        const obs = (FZ.outbreak && FZ.outbreak.list || []).filter(o => o.state === 'burning').map(o => ({ s: o.sym, y: Math.round(o.y) }));
        const p = window.__FZ.probe();
        return {
          actTop, obs, nest: p.nest,
          ants: S.agents.map(a => Math.round(a.y)),
          tag: (document.querySelector('#tagLayer') || {}).innerText || ''
        };
      });
      out.obY.push(...s.obs.map(o => o.s + '@' + o.y + (s.actTop != null && o.y > s.actTop ? '!OCC' : '')));
      if (s.actTop != null) { out.actUp++; out.occAnts += s.ants.filter(y => y > s.actTop).length; out.totAnts += s.ants.length; }
      out.digging = Math.max(out.digging, s.nest.digging); out.faces = Math.max(out.faces, s.nest.faces);
      out.headOn = Math.max(out.headOn, s.nest.headOn); out.queued = Math.max(out.queued, s.nest.queued);
      out.soil = Math.max(out.soil, s.nest.where.soil); out.surf = Math.max(out.surf, s.nest.where.surface);
      out.wear = Math.max(out.wear, s.nest.wear);
      if (s.tag.trim()) out.tags.add(s.tag.replace(/\n/g, ' | '));
      for (const k in s.nest.where) out.where[k] = Math.max(out.where[k] || 0, s.nest.where[k]);
    }
    console.log('CH', ch, 'done');
  }
  console.log('OUTBREAK POSITIONS', JSON.stringify([...new Set(out.obY)]));
  console.log('OCCLUDED ANT-FRAMES', out.occAnts, 'of', out.totAnts, 'while act up in', out.actUp, 'frames');
  console.log('maxdig', out.digging, 'faces', out.faces, 'headOn', out.headOn, 'queued', out.queued, 'soil', out.soil, 'surface', out.surf, 'wear', out.wear);
  console.log('WHERE max', JSON.stringify(out.where));
  console.log('TAGS', JSON.stringify([...out.tags]));
  console.log('PERR', perr.length ? perr.slice(0, 5) : 'none');
  await b.close();
})();
