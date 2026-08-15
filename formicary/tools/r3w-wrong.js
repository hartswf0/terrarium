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
  await page.waitForTimeout(400);
  await page.click('#gate button');
  await page.waitForTimeout(1500);

  // find a burning outbreak, press a DELIBERATELY WRONG tool
  let done = 0;
  for (let i = 0; i < 80 && done < 3; i++) {
    const r = await page.evaluate(() => {
      const ob = window.FZ.outbreak; const o = ob && (ob.current() || ob.urgent());
      if (!o || o.state !== 'burning') return null;
      return { sym: o.sym, answers: o.answers, name: o.name, line: o.line };
    });
    if (r) {
      const all = ['charter', 'vary', 'slow', 'lens', 'ledger', 'eject'];
      const wrong = all.filter(k => r.answers.indexOf(k) < 0);
      // prefer a non-targeted wrong tool
      const kind = wrong.filter(k => k !== 'eject' && k !== 'charter' && k !== 'vary')[0] || wrong[0];
      const btn = await page.$(`#act button[data-kind="${kind}"]`);
      if (btn) {
        try {
          await btn.click();
          await page.waitForTimeout(250);
          const tag = await page.textContent('#tagLayer');
          const st = await page.evaluate(() => window.__FZ.probe());
          console.log(`WRONG ${kind} on ${r.sym} (${r.name}) -> tag="${tag}" budget=${st.budget}`);
          await shot('wrong-' + done);
          done++;
        } catch (e) { }
      }
    }
    await page.waitForTimeout(300);
  }
  console.log('PAGE ERRORS', perr.length ? perr : 'none');
  await browser.close();
})();
