const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = '/home/user/terrarium/formicary/shots';
const WANT = (process.argv[2] || 'Rp,Tc,Cl,Pt,My,Cr').split(',');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(400);
  await page.click('#gate button');
  const seen = {};
  for (let i = 0; i < 900; i++) {
    const r = await page.evaluate(() => {
      const ob = window.FZ.outbreak; const o = ob && (ob.current() || ob.urgent());
      if (!o || o.state !== 'burning') return null;
      return { sym: o.sym, name: o.name, line: o.line };
    });
    if (r && WANT.indexOf(r.sym) >= 0 && !seen[r.sym]) {
      seen[r.sym] = 1;
      await page.screenshot({ path: path.join(SHOTS, 'r3W-body-' + r.sym + '.png') });
      console.log('BODY ' + r.sym + ' "' + r.name + '" / "' + r.line + '"');
      if (Object.keys(seen).length === WANT.length) break;
    }
    // keep the run alive: answer things that are not on the wanted list
    if (r && WANT.indexOf(r.sym) < 0) {
      const a = await page.evaluate(() => { const ob = window.FZ.outbreak; const o = ob.current() || ob.urgent(); return o && o.answers ? o.answers[0] : null; });
      if (a && a !== 'eject') { const b = await page.$(`#act button[data-kind="${a}"]`); if (b) { try { await b.click(); } catch (e) { } } }
    }
    const st = await page.evaluate(() => window.__FZ.probe());
    if (st.gameOver) { await page.evaluate(() => window.__FZ.goto(9)); await page.waitForTimeout(300); try { await page.click('#gate button'); } catch (e) { } }
    await page.waitForTimeout(180);
  }
  console.log('MISSING', WANT.filter(s => !seen[s]).join(',') || 'none');
  console.log('PAGE ERRORS', perr.length ? perr : 'none');
  await browser.close();
})();
