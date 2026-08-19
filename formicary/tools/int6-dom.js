/* integrator DOM checks: ch0 bare, ch9 full guide, one-message rule */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const snap = () => page.evaluate(() => {
    const g = document.getElementById('guide');
    const act = document.getElementById('act');
    const tags = document.getElementById('tagLayer');
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.02; };
    return {
      chapter: FZ.chapters.index, phase: FZ.chapters.phase(),
      toolBtns: document.querySelectorAll('#act button, #bar button, .toolBtn').length,
      actVisible: vis(act), actKids: act ? act.children.length : -1,
      actHTMLlen: act ? act.innerHTML.length : -1,
      guideOn: g ? g.className : null, guideVisible: vis(g),
      plates: g ? g.querySelectorAll('.plate, .gpl, [data-sym]').length : -1,
      guideMark: !!document.getElementById('guideMark'),
      tagCount: tags ? tags.children.length : -1,
      tagVisible: vis(tags),
      enabled: FZ.sim.enabled.size,
    };
  });

  // ch0
  await page.evaluate(() => window.__FZ.goto(0));
  await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click();
  await page.waitForTimeout(2500);
  console.log('CH0 ' + JSON.stringify(await snap()));

  // ch9 — open the guide
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click();
  await page.waitForTimeout(1500);
  console.log('CH9 play ' + JSON.stringify(await snap()));
  const opened = await page.evaluate(() => { try { FZ.table.open ? FZ.table.open() : null; } catch(e){ return 'ERR '+e.message; } return 'ok'; });
  await page.waitForTimeout(500);
  const gs = await page.evaluate(() => {
    const g = document.getElementById('guide');
    const kids = g.querySelectorAll('*');
    const counts = {};
    kids.forEach(k => { const c = k.className && k.className.baseVal===undefined ? String(k.className) : ''; if(c) counts[c.split(' ')[0]] = (counts[c.split(' ')[0]]||0)+1; });
    return { open: g.className, counts };
  });
  console.log('CH9 guide open=' + opened + ' ' + JSON.stringify(gs));

  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,10).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: ' + (cerr.length||'none')); cerr.slice(0,10).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
