/* End-to-end: play the real chapter chain through the real buttons, and check the
   contract rules that only show up while playing. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const SYMS = ['Co','Cf','Gu','Tw','Mo','Si','Lv','Cs','Sa','In','Mc','Sf','Hi','Lo','Sp','Dp','Fl','Tc','My','Mm','Ow','Cl','Di','Es','Pt','Im','Rp','Cr'];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(s => { window.__SYMS = s; }, SYMS);
  const START = +((process.argv.indexOf('--start') > -1) ? process.argv[process.argv.indexOf('--start') + 1] : 0);
  if (START) { await page.evaluate(k => window.__FZ.goto(k), START); await page.waitForTimeout(300); }

  const violations = [];
  const record = (tag, v) => { if (v && v.length) violations.push(tag + ': ' + v.join(' | ')); };

  const pressGate = async () => page.evaluate(() => {
    const g = document.querySelector('#gate');
    if (!g || !g.classList.contains('on')) return null;
    const b = g.querySelector('.gtBtn');
    if (!b) return null;
    const t = b.textContent.trim();
    b.click();
    return t;
  });

  for (let run = 0; run < 14; run++) {
    const at = await page.evaluate(() => FZ.chapters.index);
    const gbTxt = await pressGate();
    if (!gbTxt) { console.log('run' + run + ' NO GATE BUTTON (index=' + at + ') — stopping'); break; }
    await page.waitForTimeout(150);
    const i = at;

    // play to the goal in a tight in-page loop, sampling contract rules as we go
    const r = await page.evaluate(async () => {
      const S = FZ.sim.state, O = FZ.outbreak;
      let outcome = null;
      FZ.bus.on('goal', () => { if (!outcome) outcome = 'WIN'; });
      FZ.bus.on('lose', () => { if (!outcome) outcome = 'LOSE'; });
      const bad = { code: [], twoMsg: [], soil: [], guideHot: [] };
      const tools = FZ.chapters.list[FZ.chapters.index].cfg.tools || [];
      const NEEDS_XY = { eject: 1, charter: 1, vary: 1 };

      for (let k = 0; k < 25000 && !outcome && !S.gameOver; k++) {
        FZ.sim.step(); O.update(S);
        let o = null; try { o = O.current() || O.urgent(); } catch (e) { }
        if (o && o.state === 'burning' && S.tick >= (o.tagAt || 0)) {
          const ans = O.answersFor(o.sym).filter(x => tools.indexOf(x) >= 0);
          if (ans.length) {
            const kind = ans[ans.length - 1];
            if (S.budget >= FZ.sim.cost(kind)) {
              let a = null; try { a = O.tryAnswer(kind, o.x, o.y); } catch (e) { }
              if (!(NEEDS_XY[kind] && (!a || !a.hit)))
                FZ.sim.apply(kind, NEEDS_XY[kind] ? o.x : undefined, NEEDS_XY[kind] ? o.y : undefined);
            }
          }
        }
        if (k % 200 === 0) {
          // §12.3 no two-letter code in world/tag/act
          const txt = ['#world', '#tagLayer', '#act'].map(s => (document.querySelector(s) || {}).textContent || '').join(' ');
          window.__SYMS.forEach(sy => {
            if (new RegExp('(^|[^A-Za-z])' + sy + '([^A-Za-z]|$)').test(txt) && bad.code.indexOf(sy) < 0) bad.code.push(sy);
          });
          // §12.1 at most one message: one tag AND an act prompt with prose is two
          const tags = document.querySelectorAll('#tagLayer .fztag, #tagLayer > div').length;
          if (tags > 1) bad.twoMsg.push('tags=' + tags);
          // §12.4 guide must not be open while burning
          const g = document.querySelector('#guide');
          if (g && g.classList.contains('on') && (O.list || []).some(x => x.state === 'burning')) bad.guideHot.push('t' + S.tick);
          // §16.4 no ant inside solid soil
          const w = S.bodies && S.bodies.where;
          if (w && (w.soil | 0) > 0) bad.soil.push('t' + S.tick + ':' + w.soil);
        }
      }
      return {
        outcome: outcome || (S.won ? 'WIN' : (S.gameOver ? 'LOSE' : 'TIMEOUT')),
        jobs: S.jobsDone + '/' + S.jobsGoal, tick: S.tick, bad,
        phase: FZ.chapters.phase(),
      };
    });
    record('CH' + i + ' code-in-world', r.bad.code);
    record('CH' + i + ' two-messages', r.bad.twoMsg.slice(0, 3));
    record('CH' + i + ' ant-in-soil', r.bad.soil.slice(0, 3));
    record('CH' + i + ' guide-while-burning', r.bad.guideHot.slice(0, 3));

    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => ({
      phase: FZ.chapters.phase(),
      gateOn: (document.querySelector('#gate') || {}).className,
      btns: [...document.querySelectorAll('#gate .gtBtn')].map(b => b.textContent.trim()),
      gateTxt: ((document.querySelector('#gate') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
      idx: FZ.chapters.index,
    }));
    console.log('run' + run + ' CH' + i + ' begin="' + gbTxt + '" -> ' + r.outcome + ' jobs=' + r.jobs +
      ' phase=' + after.phase + ' gate=[' + after.btns.join(',') + '] "' + after.gateTxt + '"');

    if (after.phase !== 'result' && after.phase !== 'gate')
      console.log('  !! chapter ' + i + ' ended in phase ' + after.phase + ' with no gate');
    if (!after.btns.length)
      console.log('  !! chapter ' + i + ' produced NO continue button — the chain is broken here');
  }
  console.log('FINAL INDEX ' + await page.evaluate(() => FZ.chapters.index));

  console.log('--- CONTRACT VIOLATIONS ---');
  console.log(violations.length ? violations.join('\n') : 'none');
  console.log('PAGE ERRORS: ' + (perr.length ? [...new Set(perr)].slice(0, 10).join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? [...new Set(cerr)].slice(0, 10).join(' | ') : 'none'));
  await browser.close();
})();
