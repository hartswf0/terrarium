const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
(async () => {
  const CH = +arg('ch', 0);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(k => { window.__FZ.goto(k); const b = document.querySelector('#gate .gtBtn'); if (b) b.click(); }, CH);
  await page.waitForTimeout(200);
  const r = await page.evaluate(async () => {
    const S = FZ.sim.state, O = FZ.outbreak; let outcome = null;
    FZ.bus.on('goal', () => outcome = outcome || 'WIN');
    FZ.bus.on('lose', () => outcome = outcome || 'LOSE');
    const tools = FZ.chapters.list[FZ.chapters.index].cfg.tools || [];
    const NX = { eject: 1, charter: 1, vary: 1 };
    for (let k = 0; k < 25000 && !outcome && !S.gameOver; k++) {
      FZ.sim.step(); O.update(S);
      let o = null; try { o = O.current() || O.urgent(); } catch (e) { }
      if (o && o.state === 'burning' && S.tick >= (o.tagAt || 0)) {
        const a2 = O.answersFor(o.sym).filter(x => tools.indexOf(x) >= 0);
        if (a2.length) { const kd = a2[a2.length - 1];
          if (S.budget >= FZ.sim.cost(kd)) { let a = null; try { a = O.tryAnswer(kd, o.x, o.y); } catch (e) { }
            if (!(NX[kd] && (!a || !a.hit))) FZ.sim.apply(kd, NX[kd] ? o.x : undefined, NX[kd] ? o.y : undefined); } }
      }
    }
    return { outcome, phase: FZ.chapters.phase(), won: S.won, jobs: S.jobsDone + '/' + S.jobsGoal };
  });
  console.log('PLAY ' + JSON.stringify(r));
  // give rAF a few frames to render the result gate
  for (const w of [100, 400, 1200]) {
    await page.waitForTimeout(w);
    const g = await page.evaluate(() => {
      const g = document.querySelector('#gate');
      return { cls: g.className, btns: [...g.querySelectorAll('.gtBtn')].map(b => b.textContent.trim()),
        txt: (g.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160), phase: FZ.chapters.phase() };
    });
    console.log('after+' + w + 'ms ' + JSON.stringify(g));
  }
  await page.screenshot({ path: path.join(ROOT, 'formicary/shots/wingate-ch' + CH + '.png') });
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await browser.close();
})();
