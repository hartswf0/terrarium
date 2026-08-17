/* full chapter walkthrough driver — dismisses the gate and actually plays */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = path.join(ROOT, 'formicary/shots');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };

(async () => {
  const PLAY = +arg('play', 12000);
  const only = arg('only', null);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cerr = [], perr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const n = await page.evaluate(() => FZ.chapters.list.length);
  const chapters = only ? only.split('+').map(Number) : [...Array(n).keys()];

  for (const i of chapters) {
    await page.evaluate(k => window.__FZ.goto(k), i);
    await page.waitForTimeout(500);
    // gate structure before begin
    const gate = await page.evaluate(() => {
      const g = document.querySelector('#gate');
      return { on: !!g && g.classList.contains('on'), btns: [...document.querySelectorAll('#gate .gtBtn')].map(b => b.textContent.trim()), txt: (g && g.textContent || '').trim().slice(0, 90) };
    });
    // press BEGIN
    const btn = page.locator('#gate .gtBtn').first();
    if (await btn.count()) await btn.click({ timeout: 3000 }).catch(e => console.log('CH' + i + ' BEGIN CLICK FAILED ' + e.message.split('\n')[0]));
    await page.waitForTimeout(PLAY);

    const snap = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const shown = el => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01; };
      const p = window.__FZ.probe();
      const S = FZ.sim.state;
      return {
        chapter: p.chapter, tick: p.tick, phase: FZ.chapters.phase(),
        tools: p.tools, enabled: p.enabled.length,
        jobs: p.jobsDone + '/' + p.jobsGoal, budget: p.budget, collapse: Math.round(p.collapse),
        gameOver: p.gameOver, won: p.won,
        actShown: shown(q('#act')), actBtns: [...document.querySelectorAll('#act button')].map(b => b.textContent.trim()).slice(0, 8),
        actTxt: (q('#act') && q('#act').textContent || '').trim().replace(/\s+/g, ' ').slice(0, 110),
        plates: document.querySelectorAll('#guide .pl').length,
        guideOn: shown(q('#guide')),
        tags: [...document.querySelectorAll('#tagLayer *')].filter(e => e.textContent && e.textContent.trim()).length,
        tagTxt: (q('#tagLayer') && q('#tagLayer').textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
        gateOn: shown(q('#gate')), gateTxt: (q('#gate') && q('#gate').textContent || '').trim().replace(/\s+/g, ' ').slice(0, 110),
        outbreaks: (FZ.outbreak && FZ.outbreak.list || []).map(o => o.sym + ':' + o.state),
        agents: S.agents.length, jobsN: S.jobs.length,
      };
    });
    console.log('CH' + i + ' GATE ' + JSON.stringify(gate));
    console.log('CH' + i + ' PLAY ' + JSON.stringify(snap));
    await page.screenshot({ path: path.join(SHOTS, 'w-ch' + i + '.png') });
  }

  console.log('PAGE ERRORS: ' + (perr.length ? '\n  !! ' + [...new Set(perr)].slice(0, 20).join('\n  !! ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? '\n  ! ' + [...new Set(cerr)].slice(0, 20).join('\n  ! ') : 'none'));
  await browser.close();
})();
