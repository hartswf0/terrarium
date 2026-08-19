/* throughput probe: run one chapter with NO interventions and log crumbs over time */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CH = +(process.argv[2] || 3);
const MS = +(process.argv[3] || 90000);
const FILE = process.argv[4] || 'formicary.html';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, FILE), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(i => window.__FZ.goto(i), CH);
  await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
  const t0 = Date.now();
  const rows = [];
  while (Date.now() - t0 < MS) {
    await page.waitForTimeout(5000);
    const s = await page.evaluate(() => {
      const S = FZ.sim.state;
      const jl = S.jobs.map(j => ({ p: +(j.progress||0).toFixed(1), n: j.need, cl: j.claims ? j.claims.size : 0, lk: !!j.locked, po: !!j.poison }));
      return { t: S.tick, jd: S.jobsDone, jg: S.jobsGoal, col: Math.round(S.collapse),
               gate: document.getElementById('gate').classList.contains('on'),
               tempo: +(S.tempo||S.speedMul||1).toFixed(2), slow: S.slowUntil > S.tick,
               jobs: jl, agents: S.agents.length,
               ob: (FZ.outbreak.list||[]).map(o=>o.sym+':'+o.state).join('+') };
    });
    rows.push(s);
    console.log(`t=${s.t} crumbs=${s.jd}/${s.jg} strain=${s.col} tempo=${s.tempo} slow=${s.slow} gate=${s.gate} ob=${s.ob}`);
    console.log(`   jobs ${JSON.stringify(s.jobs)}`);
    if (s.gate) break;
  }
  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,6).forEach(e=>console.log('  !! '+e));
  await browser.close();
})();
