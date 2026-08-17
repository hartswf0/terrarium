/* Integrator autoplayer: begin a chapter through the real UI and answer outbreaks
   with the correct instrument until the goal is met, lost, or the budget runs out. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const chapters = (arg('ch', '0,1,2,3,4,5,6,7,8,9')).split(',').map(Number);
  const budgetMs = +arg('ms', 60000);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cerr = [], perr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(900);

  for (const ch of chapters) {
    const before = perr.length;
    await page.evaluate(n => window.__FZ.goto(n), ch);
    await page.waitForTimeout(400);
    // begin through the real gate button
    const gb = page.locator('#gate .gtBtn').first();
    if (await gb.count()) await gb.click({ timeout: 4000 }).catch(e => console.log('  begin click failed: ' + e.message.split('\n')[0]));
    await page.waitForTimeout(600);

    const box = await page.locator('#field').boundingBox();
    const t0 = Date.now();
    let answered = 0, wrong = 0, missed = 0, toolsSeen = new Set(), sawAct = false, sawTag = false;
    let end = null;

    while (Date.now() - t0 < budgetMs) {
      const st = await page.evaluate(() => {
        const S = FZ.sim.state;
        const obs = (FZ.outbreak && FZ.outbreak.list || []).filter(o => o.state === 'burning')
          .map(o => ({ sym: o.sym, x: o.x, y: o.y, r: o.r, answers: o.answers }));
        const act = document.getElementById('act');
        return {
          tick: S.tick, done: S.jobsDone, goal: S.jobsGoal, budget: S.budget,
          collapse: S.collapse, gameOver: S.gameOver, won: S.won,
          phase: FZ.chapters.phase ? FZ.chapters.phase() : '?',
          obs,
          actVisible: !!act && act.style.display !== 'none' && act.offsetHeight > 0,
          btns: [...document.querySelectorAll('#act .fzact')].map(b => b.getAttribute('data-kind')),
          tags: document.querySelectorAll('#tagLayer > *').length,
          tagText: (document.getElementById('tagLayer') || {}).textContent ? document.getElementById('tagLayer').textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
        };
      });
      if (st.actVisible) sawAct = true;
      st.btns.forEach(b => toolsSeen.add(b));
      if (st.tagText) sawTag = true;
      if (st.gameOver || st.phase !== 'play') { end = st; break; }

      const o = st.obs[0];
      if (o && st.btns.length) {
        const want = (o.answers || []).find(k => st.btns.includes(k));
        if (want) {
          await page.click(`#act .fzact[data-kind="${want}"]`, { timeout: 2000 }).catch(() => { });
          await page.mouse.click(box.x + o.x, box.y + o.y);
          const res = await page.evaluate(s => {
            const m = FZ.outbreak.mastery[s] || {};
            return { a: m.answered | 0, m: m.missed | 0 };
          }, o.sym);
          answered = res.a;
        }
      }
      await page.waitForTimeout(220);
    }

    const fin = end || await page.evaluate(() => {
      const S = FZ.sim.state;
      return {
        tick: S.tick, done: S.jobsDone, goal: S.jobsGoal, budget: S.budget, collapse: S.collapse,
        gameOver: S.gameOver, won: S.won, phase: FZ.chapters.phase ? FZ.chapters.phase() : '?',
        gate: (document.getElementById('gate').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      };
    });
    const mast = await page.evaluate(() => {
      let a = 0, m = 0;
      for (const k in FZ.outbreak.mastery) { a += FZ.outbreak.mastery[k].answered | 0; m += FZ.outbreak.mastery[k].missed | 0; }
      return { a, m };
    });
    await page.screenshot({ path: path.join(SHOTS, 'play-ch' + ch + '.png') });
    console.log(`CH${ch} tick=${fin.tick} jobs=${fin.done}/${fin.goal} budget=${fin.budget} collapse=${Math.round(fin.collapse)} ` +
      `gameOver=${fin.gameOver} won=${fin.won} phase=${fin.phase} tools=[${[...toolsSeen].join(' ')}] ` +
      `act=${sawAct} tag=${sawTag} answered=${mast.a} missed=${mast.m}` + (fin.gate ? ` gate="${fin.gate}"` : ''));
    if (perr.length > before) console.log('  ERRORS: ' + perr.slice(before).join(' | '));
  }

  console.log('PAGE ERRORS: ' + (perr.length ? '\n  !! ' + perr.slice(0, 10).join('\n  !! ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? '\n  ! ' + cerr.slice(0, 10).join('\n  ! ') : 'none'));
  await browser.close();
})();
