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

  await page.evaluate(() => window.__FZ.goto(3));
  await page.waitForTimeout(400);
  await page.click('#gate button');
  // play well briefly so plates get collected
  for (let i = 0; i < 45; i++) {
    const r = await page.evaluate(() => { const ob = window.FZ.outbreak; const o = ob && (ob.current() || ob.urgent()); return (o && o.state === 'burning') ? { sym: o.sym, a: o.answers } : null; });
    if (r && r.a && r.a[0] && r.a[0] !== 'eject') { const b = await page.$(`#act button[data-kind="${r.a[0]}"]`); if (b) { try { await b.click(); } catch (e) { } } }
    await page.waitForTimeout(300);
  }
  await shot('guide-before');
  console.log('markVisible', await page.locator('#guideMark').isVisible().catch(() => 'x'), 'text', await page.textContent('#guideMark').catch(() => ''));
  // wait for a lull so the mark is present
  for (let i = 0; i < 40; i++) {
    const burning = await page.evaluate(() => { const ob = window.FZ.outbreak; return !!(ob && (ob.current() || ob.urgent())); });
    const vis = await page.locator('#guideMark').isVisible().catch(() => false);
    if (!burning && vis) break;
    await page.waitForTimeout(300);
  }
  try {
    await page.click('#guideMark', { timeout: 3000 });
    await page.waitForTimeout(500);
    await shot('guide-open');
    const txt = await page.textContent('#guide');
    console.log('GUIDE TEXT', JSON.stringify(txt.slice(0, 700)));
    console.log('PLATES', await page.locator('#guide .pl').count(), 'DRAWN', await page.locator('#guide .pl.dr').count());
    // open one plate
    const p = page.locator('#guide .pl.dr').first();
    if (await p.count()) { await p.click(); await page.waitForTimeout(400); await shot('guide-plate'); }
    await page.evaluate(() => document.querySelector('#guide .gsc').scrollTop = 1200);
    await page.waitForTimeout(300);
    await shot('guide-scroll');
  } catch (e) { console.log('GUIDE OPEN FAILED', e.message.split('\n')[0]); }
  console.log('PAGE ERRORS', perr.length ? perr : 'none');
  await browser.close();
})();
