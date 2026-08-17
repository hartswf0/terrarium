const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(900);
  // chapter 9: all 28 live
  await page.evaluate(() => { window.__FZ.goto(9); const b = document.querySelector('#gate .gtBtn'); if (b) b.click(); });
  await page.waitForTimeout(400);
  console.log('CH9 enabled=' + await page.evaluate(() => window.__FZ.probe().enabled.length));
  // refuse-to-open-while-burning check
  const burnCheck = await page.evaluate(async () => {
    const S = FZ.sim.state, O = FZ.outbreak;
    for (let k = 0; k < 4000 && !(O.list || []).some(o => o.state === 'burning'); k++) { FZ.sim.step(); O.update(S); }
    const burning = (O.list || []).some(o => o.state === 'burning');
    const opened = FZ.table.openGuide ? FZ.table.openGuide() : null;
    const on = document.querySelector('#guide').classList.contains('on');
    return { burning, opened, guideOn: on };
  });
  console.log('GUIDE-WHILE-BURNING ' + JSON.stringify(burnCheck));
  // now let it go quiet, then open
  const openRes = await page.evaluate(async () => {
    const S = FZ.sim.state, O = FZ.outbreak;
    const tools = FZ.chapters.list[9].cfg.tools || [];
    const NX = { eject: 1, charter: 1, vary: 1 };
    // play well for a while so plates get drawn/stamped
    for (let k = 0; k < 9000; k++) {
      FZ.sim.step(); O.update(S);
      let o = null; try { o = O.current() || O.urgent(); } catch (e) { }
      if (o && o.state === 'burning' && S.tick >= (o.tagAt || 0)) {
        const a2 = O.answersFor(o.sym).filter(x => tools.indexOf(x) >= 0);
        if (a2.length) { const kd = a2[a2.length - 1];
          if (S.budget >= FZ.sim.cost(kd)) { let a = null; try { a = O.tryAnswer(kd, o.x, o.y); } catch (e) { }
            if (!(NX[kd] && (!a || !a.hit))) FZ.sim.apply(kd, NX[kd] ? o.x : undefined, NX[kd] ? o.y : undefined); } }
      }
    }
    return { seen: Object.keys(O.mastery || {}).length };
  });
  console.log('AFTER PLAY ' + JSON.stringify(openRes));
  // force quiet then open the guide
  await page.evaluate(() => { FZ.outbreak.list.length = 0; FZ.table.openGuide(); });
  await page.waitForTimeout(500);
  const g = await page.evaluate(() => ({
    on: document.querySelector('#guide').classList.contains('on'),
    plates: document.querySelectorAll('#guide .pl').length,
    drawn: document.querySelectorAll('#guide .pl.dr').length,
    codes: [...document.querySelectorAll('#guide .pcode')].length,
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  console.log('GUIDE ' + JSON.stringify(g));
  await page.screenshot({ path: path.join(ROOT, 'formicary/shots/guide-ch9.png') });
  await page.evaluate(() => { const s = document.querySelector('#guide .gsc'); if (s) s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'formicary/shots/guide-ch9-end.png') });
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await browser.close();
})();
