/* Lose path: play a chapter with NO interventions until it is lost, then take the
   retry offered by the gate and confirm the chapter actually restarts and is playable.
   Also samples nest.where.soil (CONTRACT 16.4: no ant may stand in undug soil). */
const { chromium } = require('playwright');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const ch = +arg('ch', 8), ms = +arg('ms', 90000);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  await p.evaluate(n => window.__FZ.goto(n), ch);
  await p.waitForTimeout(300);
  await p.locator('#gate .gtBtn').first().click().catch(() => { });

  let soilMax = 0, t0 = Date.now(), fin = null;
  while (Date.now() - t0 < ms) {
    const s = await p.evaluate(() => {
      const st = window.__FZ.probe();
      return { soil: st.nest.where.soil, phase: FZ.chapters.phase(), over: st.gameOver, won: st.won, done: st.jobsDone, goal: st.jobsGoal, collapse: st.collapse };
    });
    soilMax = Math.max(soilMax, s.soil);
    if (s.phase !== 'play') { fin = s; break; }
    await p.waitForTimeout(400);
  }
  console.log(`CH${ch} ungoverned -> ${JSON.stringify(fin)} soilMax=${soilMax}`);

  // the lose gate is shown after a beat; wait for it to actually paint
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(300);
    const ready = await p.evaluate(() => {
      const g = document.getElementById('gate');
      return g.classList.contains('on') && /bad|good/.test(g.className);
    });
    if (ready) break;
  }
  await p.waitForTimeout(600);

  // what does the gate offer, and does it restart?
  const gate = await p.evaluate(() => {
    const g = document.getElementById('gate');
    return { text: (g.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180), btns: [...g.querySelectorAll('button')].map(x => x.textContent.trim()) };
  });
  console.log('GATE ' + JSON.stringify(gate));
  await p.screenshot({ path: '/home/user/terrarium/formicary/shots/lose-ch' + ch + '.png' });

  const btns = await p.locator('#gate button').all();
  if (btns.length) {
    await btns[0].click().catch(e => console.log('retry click failed ' + e.message.split('\n')[0]));
    await p.waitForTimeout(2500);
    const after = await p.evaluate(() => {
      const st = window.__FZ.probe();
      return { chapter: st.chapter, tick: st.tick, done: st.jobsDone, goal: st.jobsGoal, over: st.gameOver, phase: FZ.chapters.phase(), gateOn: document.getElementById('gate').classList.contains('on') };
    });
    console.log('AFTER FIRST BUTTON ' + JSON.stringify(after));
  }
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await b.close();
})();
