/* integrator play harness — actually PLAY each chapter through the real UI:
   arm the right instrument from the burning outbreak's own answers list, tap the
   nest where it burns, and see whether the chapter's goal is reachable. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

const only = process.argv[2] ? process.argv[2].split(',').map(Number) : [0,1,2,3,4,5,6,7,8,9];
const BUDGET_MS = +(process.argv[3] || 120000);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  for (const c of only) {
    await page.evaluate(i => window.__FZ.goto(i), c);
    await page.waitForTimeout(300);
    await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
    await page.waitForTimeout(500);

    const t0 = Date.now();
    let answered = 0, missed = 0, wrong = 0, retries = 0, outcome = 'timeout', gateTxt = '';
    const box = await page.locator('#field').boundingBox();

    while (Date.now() - t0 < BUDGET_MS) {
      const st = await page.evaluate(() => {
        const S = FZ.sim.state;
        const g = document.getElementById('gate');
        const list = (FZ.outbreak && FZ.outbreak.list) || [];
        const burn = list.filter(o => o.state === 'burning')
                         .sort((a,b) => (a.born + a.fuse) - (b.born + b.fuse))[0];
        const avail = [...document.querySelectorAll('#act button[data-kind]')].map(b => b.getAttribute('data-kind'));
        return {
          phase: FZ.chapters.phase(), gateOn: g.classList.contains('on'),
          gateTxt: (g.textContent||'').trim().slice(0,120),
          jd: S.jobsDone, jg: S.jobsGoal, bud: S.budget, col: Math.round(S.collapse), tick: S.tick,
          w: S.w, h: S.h,
          burn: burn ? { sym: burn.sym, x: burn.x, y: burn.y, r: burn.r, answers: burn.answers } : null,
          avail,
          m: FZ.outbreak.mastery,
        };
      });

      if (st.gateOn) {
        outcome = st.phase === 'result' ? 'gate' : 'gate';
        gateTxt = st.gateTxt;
        break;
      }

      if (st.burn && st.burn.answers && st.burn.answers.length) {
        const kind = st.burn.answers.find(k => st.avail.includes(k));
        if (kind) {
          const cost = await page.evaluate(k => FZ.sim.cost(k), kind);
          if (st.bud >= cost) {
            await page.click(`#act button[data-kind="${kind}"]`, { timeout: 1500 }).catch(()=>{});
            // tap the field at the outbreak
            const px = box.x + st.burn.x * (box.width / st.w);
            const py = box.y + st.burn.y * (box.height / st.h);
            await page.mouse.click(px, py);
            await page.waitForTimeout(120);
          }
        }
      }
      await page.waitForTimeout(220);
    }

    const fin = await page.evaluate(() => {
      const S = FZ.sim.state;
      const g = document.getElementById('gate');
      return { jd: S.jobsDone, jg: S.jobsGoal, bud: S.budget, col: Math.round(S.collapse), tick: S.tick,
               gateOn: g.classList.contains('on'), gateTxt: (g.textContent||'').trim().slice(0,150),
               tone: g.className, won: S.won, over: S.gameOver,
               m: JSON.parse(JSON.stringify(FZ.outbreak.mastery||{})) };
    });
    let a=0,ms=0; for (const k in fin.m) { a += fin.m[k].answered||0; ms += fin.m[k].missed||0; }
    await page.screenshot({ path: path.join(SHOTS, `play-ch${c}.png`) });
    console.log(`ch${c}: ${fin.jd}/${fin.jg} crumbs  strain=${fin.col}  food=${fin.bud}  tick=${fin.tick}  gate=${fin.gateOn}[${fin.tone}]  answered=${a} missed=${ms}`);
    console.log(`      ${fin.gateTxt.replace(/\s+/g,' ')}`);
  }

  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,10).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: ' + (cerr.length||'none')); cerr.slice(0,10).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
