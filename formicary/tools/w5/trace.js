const { chromium } = require('playwright');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const ch = +arg('ch', 1), secs = +arg('secs', 30);
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = []; p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.evaluate(i => window.__FZ.goto(i), ch);
  await p.waitForTimeout(300);
  await p.evaluate(() => { const g = document.getElementById('gate'); const btn = g && g.querySelector('button'); if (btn) btn.click(); });
  await p.evaluate(() => {
    window.__L = [];
    window.__T = setInterval(() => {
      const S = FZ.sim.state;
      const en = FZ.EL.filter(e => FZ.sim.enabled.has(e.sym));
      window.__L.push(S.tick + ' ' + FZ.chapters.phase()
        + ' done=' + S.jobsDone + '/' + S.jobsGoal
        + ' burn=' + FZ.outbreak.list.filter(o => o.state === 'burning').map(o => o.sym).join('+')
        + ' urge=' + (S.urge == null ? '-' : S.urge.toFixed(2))
        + ' | ' + en.filter(e => e.heat > 0.02).map(e => e.sym + ':' + e.heat.toFixed(2) + (e.countered ? '*' : '')).join(' '));
    }, 400);
  });
  await p.waitForTimeout(secs * 1000);
  const r = await p.evaluate(() => { clearInterval(window.__T); return window.__L; });
  console.log(r.join('\n'));
  console.log('PAGE ERRORS:', perr.length ? perr.join('|') : 'none');
  await b.close();
})();
