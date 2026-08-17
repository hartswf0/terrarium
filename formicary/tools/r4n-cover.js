const { chromium } = require('playwright');
const ROOT = '/home/user/terrarium';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const res = { tagOverOb: 0, barOverOb: 0, barOverAnt: 0, tagOverAnt: 0, frames: 0, obFrames: 0, worst: [] };
  for (const ch of [7, 8, 9, 9]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(400);
    await page.click('#gate button').catch(() => { });
    for (let i = 0; i < 70; i++) {
      await page.waitForTimeout(300);
      const s = await page.evaluate(() => {
        const S = FZ.sim.state;
        const fr = document.querySelector('#field').getBoundingClientRect();
        const R = sel => { const e = document.querySelector(sel); if (!e || !e.firstChild) return null; const r = e.getBoundingClientRect(); if (!r.height) return null; return { t: r.top - fr.top, b: r.bottom - fr.top, l: r.left - fr.left, r: r.right - fr.left }; };
        const tag = R('.fztag'), act = R('#act');
        const O = (FZ.outbreak && FZ.outbreak.list || []).filter(o => o.state === 'burning').map(o => ({ s: o.sym, x: o.x, y: o.y, r: o.r }));
        const ants = S.agents.map(a => ({ x: a.x, y: a.y }));
        return { tag, act, O, ants };
      });
      res.frames++;
      if (s.O.length) res.obFrames++;
      const inBox = (x, y, B) => B && x >= B.l && x <= B.r && y >= B.t && y <= B.b;
      for (const o of s.O) {
        if (inBox(o.x, o.y, s.tag)) { res.tagOverOb++; res.worst.push('TAG covers ' + o.s + ' @' + Math.round(o.y)); }
        if (inBox(o.x, o.y, s.act)) { res.barOverOb++; res.worst.push('BAR covers ' + o.s + ' @' + Math.round(o.y)); }
      }
      for (const a of s.ants) {
        if (inBox(a.x, a.y, s.act)) res.barOverAnt++;
        if (inBox(a.x, a.y, s.tag)) res.tagOverAnt++;
      }
    }
  }
  console.log(JSON.stringify({ frames: res.frames, obFrames: res.obFrames, tagOverOb: res.tagOverOb, barOverOb: res.barOverOb, barOverAntFrames: res.barOverAnt, tagOverAntFrames: res.tagOverAnt }, null, 1));
  console.log('SAMPLES', JSON.stringify([...new Set(res.worst)].slice(0, 20)));
  await b.close();
})();
