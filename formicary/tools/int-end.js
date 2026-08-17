/* The two endings: win chapter 9, and lose chapter 9. Both must land on a real card. */
const { chromium } = require('playwright');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const mode = arg('mode', 'win');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__FZ.goto(9));
  await p.waitForTimeout(400);
  await p.locator('#gate .gtBtn').first().click().catch(() => { });
  await p.waitForTimeout(1500);

  if (mode === 'win') {
    await p.evaluate(() => { FZ.sim.state.jobsDone = FZ.sim.state.jobsGoal; });
  } else {
    await p.evaluate(() => { FZ.sim.state.collapse = FZ.sim.state.collapseMax + 10; });
  }
  for (let i = 0; i < 50; i++) {
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const g = document.getElementById('gate'); return g.classList.contains('on') && /good|bad/.test(g.className); });
    if (r) break;
  }
  await p.waitForTimeout(1200);
  const g = await p.evaluate(() => {
    const el = document.getElementById('gate');
    return {
      cls: el.className, phase: FZ.chapters.phase(),
      chars: (el.textContent || '').length,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
      btns: [...el.querySelectorAll('button')].map(x => x.textContent.trim()),
      scroll: el.scrollHeight + '/' + el.clientHeight,
    };
  });
  console.log(mode.toUpperCase() + ' ' + JSON.stringify(g, null, 1));
  await p.screenshot({ path: '/home/user/terrarium/formicary/shots/end-' + mode + '.png', fullPage: false });
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await b.close();
})();
