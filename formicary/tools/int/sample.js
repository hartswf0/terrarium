/* sample one chapter over time: is there ever a tool bar / tag while something burns? */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };

(async () => {
  const CH = +arg('ch', 3), N = +arg('n', 24), EVERY = +arg('every', 700);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(k => window.__FZ.goto(k), CH);
  await page.waitForTimeout(300);
  const b = page.locator('#gate .gtBtn').first();
  if (await b.count()) await b.click();
  for (let i = 0; i < N; i++) {
    await page.waitForTimeout(EVERY);
    const s = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const shown = el => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && +cs.opacity > 0.01; };
      const S = FZ.sim.state, O = FZ.outbreak;
      let cur = null; try { cur = O.current() || O.urgent(); } catch (e) { cur = 'ERR'; }
      return {
        t: S.tick, phase: FZ.chapters.phase(),
        obs: (O.list || []).map(o => o.sym + ':' + o.state + '@' + o.x.toFixed(0) + ',' + o.y.toFixed(0) + (o.tagAt !== undefined ? ' tagAt' + o.tagAt : '')),
        cur: cur && cur.sym ? cur.sym : String(cur),
        act: shown(q('#act')), btns: document.querySelectorAll('#act button').length,
        tag: shown(q('.fztag')) || shown(q('#tagLayer > *')),
        tagTxt: (q('#tagLayer') && q('#tagLayer').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        jobs: S.jobsDone + '/' + S.jobsGoal, budget: S.budget, collapse: Math.round(S.collapse),
      };
    });
    console.log(JSON.stringify(s));
  }
  console.log('PAGE ERRORS: ' + (perr.length ? [...new Set(perr)].join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? [...new Set(cerr)].join(' | ') : 'none'));
  await browser.close();
})();
