/* Winnability harness: play every chapter headless with a competent policy,
   mirroring exactly what CONTROLS does on a tap (tryAnswer, then sim.apply). */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };

(async () => {
  const MAXT = +arg('ticks', 30000);
  const ACC = +arg('acc', 1);
  const only = arg('only', null);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const n = await page.evaluate(() => FZ.chapters.list.length);
  const chapters = only ? only.split('+').map(Number) : [...Array(n).keys()];

  for (const i of chapters) {
    const res = await page.evaluate(async ([ch, maxt, acc, prefer]) => {
      // start the chapter and force it into play phase via the real gate button
      window.__FZ.goto(ch);
      const b = document.querySelector('#gate .gtBtn');
      if (b) b.click();
      await new Promise(r => setTimeout(r, 120));

      const S = FZ.sim.state, O = FZ.outbreak;
      let outcome = null, why = '';
      const offG = FZ.bus.on('goal', d => { if (!outcome) outcome = 'WIN'; });
      const offL = FZ.bus.on('lose', d => { if (!outcome) { outcome = 'LOSE'; why = (d && d.why) || ''; } });

      let answered = 0, missed = 0, wrong = 0, spent = 0, refused = 0, t0 = S.tick;
      FZ.bus.on('outbreak:landed', () => missed++);

      const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();

      for (let k = 0; k < maxt && !outcome && !S.gameOver; k++) {
        FZ.sim.step();
        O.update(S);
        // policy: answer the current burning incident with a correct instrument
        let o = null;
        try { o = O.current() || O.urgent(); } catch (e) { }
        if (o && o.state === 'burning' && S.tick >= (o.tagAt || 0)) {
          const tools = FZ.chapters.list[ch].cfg.tools || [];
          let ans = O.answersFor(o.sym).filter(x => tools.indexOf(x) >= 0);
          if (ans.length) {
            let kind = prefer === 'last' ? ans[ans.length - 1] : ans[0];
            if (rnd() > acc) { // deliberate wrong answer
              const bad = tools.filter(x => ans.indexOf(x) < 0);
              if (bad.length) kind = bad[(rnd() * bad.length) | 0];
            }
            if (S.budget >= FZ.sim.cost(kind)) {
              const NEEDS_XY = { eject: 1, charter: 1, vary: 1 };
              let a = null;
              try { a = O.tryAnswer(kind, o.x, o.y); } catch (e) { }
              if (!(NEEDS_XY[kind] && (!a || !a.hit))) {
                const out = FZ.sim.apply(kind, NEEDS_XY[kind] ? o.x : undefined, NEEDS_XY[kind] ? o.y : undefined);
                if (out && out.ok) spent++; else refused++;
                if (a && a.right) answered++; else if (a && a.hit) wrong++;
              }
            }
          }
        }
      }
      return {
        ch, outcome: outcome || (S.won ? 'WIN' : (S.gameOver ? 'LOSE' : 'TIMEOUT')), why,
        ticks: S.tick - t0, jobs: S.jobsDone + '/' + S.jobsGoal,
        goal: JSON.stringify(FZ.chapters.list[ch].cfg.goal), tools: (FZ.chapters.list[ch].cfg.tools || []).join('+') || '-',
        budget: S.budget, collapse: Math.round(S.collapse),
        answered, wrong, missed, spent, refused,
      };
    }, [i, MAXT, ACC, arg("prefer","first")]);
    console.log('CH' + res.ch + '  ' + res.outcome.padEnd(8) + ' goal=' + res.goal.padEnd(18) +
      ' jobs=' + String(res.jobs).padEnd(8) + ' ticks=' + String(res.ticks).padEnd(7) +
      ' tools=' + res.tools.padEnd(28) + ' ans=' + res.answered + ' wrong=' + res.wrong +
      ' missed=' + res.missed + ' spent=' + res.spent + ' refused=' + res.refused +
      ' food=' + res.budget + ' strain=' + res.collapse + (res.why ? ' why=' + res.why : ''));
  }
  console.log('PAGE ERRORS: ' + (perr.length ? [...new Set(perr)].slice(0, 10).join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? [...new Set(cerr)].slice(0, 10).join(' | ') : 'none'));
  await browser.close();
})();
