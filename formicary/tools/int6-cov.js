/* contract coverage: answers on all 28, wrong-copy on all 28, mastery persistence,
   the guide gate, #act absence, and the 320/430 layout */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const perr = [], cerr = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type()==='error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);

  console.log(JSON.stringify(await page.evaluate(() => {
    const bad = { noAnswers: [], badAnswers: [], noWrong: [], noDetect: [], noCounteredBy: [], noGlyph: [], noFire: [], dupSym: [] };
    const KINDS = ['vary','charter','slow','lens','ledger','eject'];
    const seen = {};
    FZ.EL.forEach(e => {
      if (seen[e.sym]) bad.dupSym.push(e.sym); seen[e.sym] = 1;
      if (!e.answers || !e.answers.length) bad.noAnswers.push(e.sym);
      else e.answers.forEach(k => { if (KINDS.indexOf(k) < 0) bad.badAnswers.push(e.sym + ':' + k); });
      if (!(FZ.copy.wrong && FZ.copy.wrong[e.sym])) bad.noWrong.push(e.sym);
      if (!(FZ.copy.fire && FZ.copy.fire[e.sym])) bad.noFire.push(e.sym);
      if (typeof e.detect !== 'function') bad.noDetect.push(e.sym);
      if (typeof e.counteredBy !== 'function') bad.noCounteredBy.push(e.sym);
      if (!e.glyph) bad.noGlyph.push(e.sym);
    });
    return { n: FZ.EL.length, ...bad };
  }), null, 0));

  // mastery persistence
  await page.evaluate(() => { localStorage.removeItem('formicary.mastery'); });
  await page.evaluate(() => window.__FZ.goto(1));
  await page.waitForTimeout(200);
  await page.locator('#gate button.gtBtn').first().click();
  const box = await page.locator('#field').boundingBox();
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => {
      const S = FZ.sim.state;
      const b = (FZ.outbreak.list||[]).filter(o=>o.state==='burning')[0];
      return { w:S.w,h:S.h,bud:S.budget, burn: b?{x:b.x,y:b.y,answers:b.answers}:null,
               avail:[...document.querySelectorAll('#act button[data-kind]')].map(x=>x.getAttribute('data-kind')),
               gate: document.getElementById('gate').classList.contains('on') };
    });
    if (s.gate) break;
    if (s.burn) { const k = s.burn.answers.find(x=>s.avail.includes(x));
      if (k) { await page.click(`#act button[data-kind="${k}"]`,{timeout:1000}).catch(()=>{});
               await page.mouse.click(box.x+s.burn.x*(box.width/s.w), box.y+s.burn.y*(box.height/s.h)); } }
    await page.waitForTimeout(300);
  }
  const stored = await page.evaluate(() => localStorage.getItem('formicary.mastery'));
  console.log('MASTERY stored: ' + (stored||'NOTHING').slice(0,160));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(700);
  console.log('MASTERY after reload: ' + JSON.stringify(await page.evaluate(()=>FZ.outbreak.mastery)).slice(0,160));

  // the guide: openable between passages, refused while burning
  await page.evaluate(() => window.__FZ.goto(2));
  await page.waitForTimeout(300);
  console.log('GUIDE at gate: ' + JSON.stringify(await page.evaluate(() => {
    const m = document.getElementById('guideMark');
    const vis = e => { if(!e) return false; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&s.display!=='none'&&+s.opacity>0.02; };
    return { markVisible: vis(m) };
  })));
  await page.locator('#gate button.gtBtn').first().click();
  await page.waitForTimeout(6000);
  const gg = await page.evaluate(() => {
    const m = document.getElementById('guideMark'), g = document.getElementById('guide');
    const burning = (FZ.outbreak.list||[]).filter(o=>o.state==='burning').length;
    const vis = e => { if(!e) return false; const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&s.display!=='none'&&+s.opacity>0.02; };
    if (m) m.click();
    return { burning, markVisible: vis(m), guideOpenedWhileBurning: g.classList.contains('on') };
  });
  console.log('GUIDE during play: ' + JSON.stringify(gg));

  // #act absent when there is no decision (ch0)
  await page.evaluate(() => window.__FZ.goto(0));
  await page.waitForTimeout(200);
  await page.locator('#gate button.gtBtn').first().click();
  await page.waitForTimeout(2500);
  console.log('ACT in ch0: ' + JSON.stringify(await page.evaluate(() => {
    const a = document.getElementById('act');
    const r = a.getBoundingClientRect(); const s = getComputedStyle(a);
    return { h: Math.round(r.height), display: s.display, opacity: s.opacity, buttons: a.querySelectorAll('button').length };
  })));

  // narrow and wide layouts
  for (const w of [320, 430]) {
    const p2 = await browser.newPage({ viewport: { width: w, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p2.on('pageerror', e => perr.push('w'+w+': '+e.message));
    await p2.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
    await p2.waitForTimeout(600);
    await p2.evaluate(() => window.__FZ.goto(9));
    await p2.waitForTimeout(300);
    await p2.locator('#gate button.gtBtn').first().click().catch(()=>{});
    await p2.waitForTimeout(6000);
    const h = await p2.evaluate(() => {
      const r = { hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, small: [] };
      document.querySelectorAll('button').forEach(el => { const b = el.getBoundingClientRect();
        if (b.width>0&&b.height>0&&Math.min(b.width,b.height)<30) r.small.push((el.id||el.className)+' '+Math.round(b.width)+'x'+Math.round(b.height)); });
      return r;
    });
    await p2.screenshot({ path: path.join(SHOTS, `cov-w${w}.png`) });
    console.log(`W${w}: ` + JSON.stringify(h));
    await p2.close();
  }

  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,10).forEach(e=>console.log('  !! '+e));
  console.log('CONSOLE ERRORS: ' + (cerr.length||'none')); cerr.slice(0,10).forEach(e=>console.log('  ! '+e));
  await browser.close();
})();
