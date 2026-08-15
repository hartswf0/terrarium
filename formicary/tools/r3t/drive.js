const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');

const script = process.argv[2] || 'play';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + ROOT + '/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, 'r3T-' + n + '.png') }); console.log('SHOT ' + n); };
  const snap = async () => await page.evaluate(() => {
    const t = id => { const e = document.getElementById(id); return e ? (e.innerText || '').replace(/\s+/g, ' ').trim() : null; };
    const vis = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; };
    const p = window.__FZ.probe();
    return {
      chapter: p.chapter, tick: p.tick, done: p.jobsDone + '/' + p.jobsGoal, budget: p.budget, collapse: p.collapse,
      crown: t('crown'), tag: vis('tagLayer') ? t('tagLayer') : null, act: vis('act') ? t('act') : null,
      gate: vis('gate') ? t('gate') : null, guide: vis('guide') ? t('guide') : null,
      buttons: [...document.querySelectorAll('button,[role=button],.tool,#act *')].filter(e => e.offsetParent).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim() || e.className).filter(Boolean).slice(0, 20),
      outbreaks: (window.FZ.outbreak && window.FZ.outbreak.list || []).map(o => ({ sym: o.sym, state: o.state, x: Math.round(o.x), y: Math.round(o.y), fuse: o.fuse, born: o.born })),
      hot: p.hot,
    };
  });
  const L = async (lbl) => { const s = await snap(); console.log(lbl + ' ' + JSON.stringify(s)); return s; };

  global.page = page; global.shot = shot; global.snap = snap; global.L = L;
  const mod = require('/home/user/terrarium/formicary/tools/r3t/' + script + '.js');
  await mod(page, shot, snap, L);

  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? cerr.join(' | ') : 'none'));
  await browser.close();
})();
