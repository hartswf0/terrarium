/* Does #guideMark collide with #aboutBtn (result/gate phase) or with #act (play phase)? */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);

  const snap = async label => {
    const r = await p.evaluate(() => {
      const box = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), disp: cs.display, vis: cs.visibility, z: cs.zIndex, on: e.className }; };
      const ov = (a, c) => { if (!a || !c || a.disp === 'none' || c.disp === 'none' || !a.w || !c.w) return 0; const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x); const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y); return ox > 0 && oy > 0 ? ox * oy : 0; };
      const gm = box('guideMark'), ab = box('aboutBtn'), ac = box('act'), gt = box('gate');
      return { phase: FZ.chapters.phase(), guideMark: gm, aboutBtn: ab, act: ac, gate: gt, ovAbout: ov(gm, ab), ovAct: ov(gm, ac) };
    });
    console.log(label + ' ' + JSON.stringify(r));
    return r;
  };

  await p.evaluate(() => window.__FZ.goto(2));
  await p.waitForTimeout(400);
  await snap('GATE  ');
  await p.locator('#gate .gtBtn').first().click().catch(() => { });
  // wait until an act bar is up
  for (let i = 0; i < 60; i++) {
    await p.waitForTimeout(400);
    const up = await p.evaluate(() => { const a = document.getElementById('act'); return !!a && a.style.display !== 'none' && a.offsetHeight > 0; });
    if (up) break;
  }
  await snap('PLAY  ');
  await p.screenshot({ path: '/home/user/terrarium/formicary/shots/corner-play.png' });
  // force result phase
  await p.evaluate(() => { FZ.sim.state.jobsDone = FZ.sim.state.jobsGoal; });
  await p.waitForTimeout(1200);
  await snap('RESULT');
  await p.screenshot({ path: '/home/user/terrarium/formicary/shots/corner-result.png' });
  await b.close();
})();
