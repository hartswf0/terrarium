/* The SETTLE window: after an outcome, chapters hold the colony on screen for 600ms
   with the crown still up before raising the gate. Nothing may cover #aboutBtn then. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__FZ.goto(2));
  await p.waitForTimeout(400);
  await p.locator('#gate .gtBtn').first().click().catch(() => { });
  // let a few plates get collected so the mark has something to show
  await p.waitForTimeout(9000);
  await p.evaluate(() => { FZ.sim.state.jobsDone = FZ.sim.state.jobsGoal; });

  let hits = 0, samples = 0, shot = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 2500) {
    const r = await p.evaluate(() => {
      const gm = document.getElementById('guideMark'), ab = document.getElementById('aboutBtn');
      const crown = document.getElementById('crown'), gt = document.getElementById('gate');
      const crownUp = getComputedStyle(crown).visibility !== 'hidden';
      const gmOn = gm && getComputedStyle(gm).display !== 'none';
      if (!gmOn || !crownUp) return { bad: false, phase: FZ.chapters.phase(), crownUp, gmOn, gateOn: gt.classList.contains('on') };
      const a = gm.getBoundingClientRect(), c = ab.getBoundingClientRect();
      const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
      const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      return { bad: ox > 0 && oy > 0, phase: FZ.chapters.phase(), crownUp, gmOn, gateOn: gt.classList.contains('on'), mark: [Math.round(a.x), Math.round(a.y)], overlap: Math.round(Math.max(0, ox) * Math.max(0, oy)) };
    });
    samples++;
    if (r.bad) {
      hits++;
      if (!shot) { shot = true; await p.screenshot({ path: '/home/user/terrarium/formicary/shots/settle-collision.png' }); console.log('COLLISION ' + JSON.stringify(r)); }
    }
    await p.waitForTimeout(40);
  }
  console.log(`SETTLE WINDOW: ${samples} samples, ${hits} frames with guideMark over aboutBtn`);
  await p.screenshot({ path: '/home/user/terrarium/formicary/shots/settle-after.png' });
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await b.close();
})();
