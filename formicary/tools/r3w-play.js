const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = '/home/user/terrarium/formicary/shots';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, 'r3W-' + n + '.png') }); console.log('SHOT ' + n); };
  const P = async () => await page.evaluate(() => window.__FZ.probe());

  // go to ch9, begin
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(500);
  await page.click('#gate button');
  await page.waitForTimeout(1200);

  // PLAY WELL: every 400ms, if an outbreak burns, press the right tool
  const log = [];
  for (let i = 0; i < 260; i++) {
    const r = await page.evaluate(() => {
      const ob = window.FZ.outbreak;
      const o = ob && (ob.current() || ob.urgent());
      if (!o) return null;
      return { sym: o.sym, answers: o.answers, name: o.name, line: o.line, state: o.state };
    });
    if (r && r.state === 'burning' && r.answers && r.answers.length) {
      const kind = r.answers[0];
      const btn = await page.$(`#act button[data-kind="${kind}"]`);
      if (btn) { try {
        if (kind === 'eject') {
          const pos = await page.evaluate(() => { const ob = window.FZ.outbreak; const o = ob.current() || ob.urgent(); const S = window.FZ.sim.state; const f = document.getElementById('field').getBoundingClientRect(); return { x: f.left + o.x * f.width / S.w, y: f.top + o.y * f.height / S.h }; });
          await btn.click();
          await page.mouse.click(pos.x, pos.y);
        } else {
          await btn.click();
        }
        log.push(r.sym + '->' + kind);
      } catch (e) { /* button vanished mid-tap */ } }
    }
    await page.waitForTimeout(300);
    if (i === 40) await shot('play-well-a');
    if (i === 120) await shot('play-well-b');
    const st = await P();
    if (st.gameOver) { console.log('GAMEOVER at loop ' + i + ' won=' + st.won); break; }
  }
  const fin = await P();
  console.log('WELL-PLAYED', JSON.stringify({ tick: fin.tick, jobs: fin.jobsDone, collapse: fin.collapse, scar: fin.scar, answered: fin.answered, missed: fin.missed, gameOver: fin.gameOver, won: fin.won }));
  await shot('play-well-end');
  console.log('ANSWERS', log.length, log.slice(0, 30).join(' '));
  console.log('PAGE ERRORS', perr.length ? perr : 'none');
  await browser.close();
})();
