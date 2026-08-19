/* integrator FULL SEQUENTIAL PLAYTHROUGH — no goto. Start at boot, play every
   passage through the real buttons, click every gate, reach the ending. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const TOTAL = +(process.argv[2] || 600000);
const ACC = +(process.argv[3] || 1);     /* fraction of incidents answered correctly */

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const box = await page.locator('#field').boundingBox();
  const t0 = Date.now();
  let gateClicks = 0, lastChap = -1, seenGates = [];
  let msgViolations = 0, soilMax = 0;

  while (Date.now() - t0 < TOTAL) {
    const st = await page.evaluate(() => {
      const S = FZ.sim.state, g = document.getElementById('gate');
      const list = (FZ.outbreak && FZ.outbreak.list) || [];
      const burn = list.filter(o => o.state === 'burning').sort((a,b)=>(a.born+a.fuse)-(b.born+b.fuse))[0];
      const btns = [...g.querySelectorAll('button.gtBtn')].map(b => b.textContent.trim());
      const tagOn = [...document.querySelectorAll('#tagLayer .fztag')].filter(t=>t.classList.contains('on')).length;
      const actOn = document.getElementById('act').classList.contains('on') ||
                    !!document.querySelector('#act .fzrow');
      const p = window.__FZ.probe();
      return {
        chap: FZ.chapters.index, phase: FZ.chapters.phase(),
        gateOn: g.classList.contains('on'), gateBtns: btns,
        gateHead: (g.querySelector('.gtTitle')||{}).textContent || '',
        jd: S.jobsDone, jg: S.jobsGoal, bud: S.budget, tick: S.tick,
        w: S.w, h: S.h,
        burn: burn ? { sym: burn.sym, x: burn.x, y: burn.y, answers: burn.answers } : null,
        avail: [...document.querySelectorAll('#act button[data-kind]')].map(b=>b.getAttribute('data-kind')),
        tagOn, actOn,
        soil: (p.nest && p.nest.where && p.nest.where.soil) || 0,
      };
    });

    soilMax = Math.max(soilMax, st.soil);
    if (st.tagOn > 1) msgViolations++;

    if (st.gateOn) {
      if (st.chap !== lastChap || seenGates.length === 0 ||
          seenGates[seenGates.length-1].t !== st.gateHead) {
        seenGates.push({ c: st.chap, t: st.gateHead, b: st.gateBtns.join('/') });
        console.log(`GATE ch${st.chap} "${st.gateHead}" [${st.gateBtns.join(' | ')}] crumbs=${st.jd}/${st.jg}`);
        await page.screenshot({ path: path.join(SHOTS, `run-g${gateClicks}.png`) });
      }
      lastChap = st.chap;
      // click the first (primary) gate button
      await page.locator('#gate button.gtBtn').first().click({ timeout: 3000 }).catch(()=>{});
      gateClicks++;
      if (gateClicks > 40) { console.log('too many gates, stopping'); break; }
      await page.waitForTimeout(600);
      continue;
    }

    if (st.burn && st.burn.answers && st.burn.answers.length) {
      const right = st.burn.answers.find(k => st.avail.includes(k));
      const pick = (Math.random() < ACC || !st.avail.length) ? right
                 : st.avail[Math.floor(Math.random()*st.avail.length)];
      if (pick) {
        const cost = await page.evaluate(k => FZ.sim.cost(k), pick);
        if (st.bud >= cost) {
          await page.click(`#act button[data-kind="${pick}"]`, { timeout: 1200 }).catch(()=>{});
          await page.mouse.click(box.x + st.burn.x * (box.width/st.w), box.y + st.burn.y * (box.height/st.h));
          await page.waitForTimeout(100);
        }
      }
    }
    await page.waitForTimeout(200);
  }

  console.log('--- gates seen: ' + seenGates.length + ' ---');
  seenGates.forEach(g => console.log(`  ch${g.c} ${g.t} [${g.b}]`));
  console.log('two-tags-at-once violations: ' + msgViolations);
  console.log('max ants in solid soil: ' + soilMax);
  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,12).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: ' + (cerr.length||'none')); cerr.slice(0,12).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
