const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = '/home/user/terrarium/formicary/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, 'r3W-' + n + '.png') }); console.log('SHOT ' + n); };
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(400); await page.click('#gate button');
  // let it run ungoverned to collapse
  for (let i = 0; i < 80; i++) {
    const st = await page.evaluate(() => window.__FZ.probe());
    if (st.gameOver) { console.log('collapsed tick', st.tick, 'scars', st.bodies.scars); break; }
    await page.waitForTimeout(400);
  }
  await shot('reset-collapsed');
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(500);
  try { await page.click('#gate button'); } catch (e) { }
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => window.__FZ.probe());
  console.log('AFTER RESET', JSON.stringify({ tick: st.tick, jobs: st.jobsDone, scars: st.bodies.scars, works: st.bodies.works, collapse: st.collapse }));
  await shot('reset-fresh');
  console.log('PAGE ERRORS', perr.length ? perr : 'none');
  await browser.close();
})();
