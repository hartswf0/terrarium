const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CH = +(process.argv[2] || 0);
const TAG = process.argv[3] || ('ch' + CH);
const SECS = +(process.argv[4] || 30);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(c => window.__FZ.goto(c), CH);
  await page.waitForTimeout(500);
  // dismiss gate if present
  const gb = await page.locator('#gate button').count();
  if (gb) { await page.click('#gate button'); await page.waitForTimeout(600); }

  let shotN = 0;
  const snap = async label => {
    await page.screenshot({ path: path.join(SHOTS, `r4W-${TAG}-${label}.png`) });
    console.log('SHOT ' + label);
  };
  const info = async () => await page.evaluate(() => {
    const p = window.__FZ.probe();
    const act = document.querySelector('#act');
    const tag = document.querySelector('#tagLayer');
    return {
      tick: p.tick, done: p.jobsDone + '/' + p.jobsGoal, budget: p.budget, collapse: p.collapse,
      nest: p.nest, ob: (window.FZ.outbreak && window.FZ.outbreak.list || []).map(o => ({ s: o.sym, st: o.state, fuse: o.fuse, born: o.born })),
      actH: act ? act.offsetHeight : -1, actTxt: act ? act.innerText.replace(/\n/g, ' | ') : '',
      tagTxt: tag ? tag.innerText.replace(/\n/g, ' | ') : '', msgCount: (act && act.offsetHeight > 0 ? 1 : 0) + (tag && tag.innerText.trim() ? 1 : 0),
      speedMul: p.speedMul,
    };
  });
  for (let i = 0; i < SECS; i++) {
    await page.waitForTimeout(1000);
    const d = await info();
    console.log(i + 's', JSON.stringify(d));
    if (d.ob.length && !global.__got) { global.__got = 1; await snap('burn'); }
    if (i === 3) await snap('a');
    if (i === Math.floor(SECS / 2)) await snap('mid');
  }
  await snap('end');
  console.log('ERRORS', perr.slice(0, 5));
  await browser.close();
})();
