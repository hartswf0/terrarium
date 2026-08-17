/* Contract coverage: every element has answers, a fire line, a wrong line, a detector,
   a counteredBy, a glyph; mastery persists; guide holds 28 plates. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const out = { n: FZ.EL.length, noAnswers: [], noFire: [], noWrong: [], noDetect: [], noCounter: [], noGlyph: [], longFire: [], badAnswerKind: [], dupSym: [], noPlain: [] };
    const KINDS = ['vary', 'charter', 'slow', 'lens', 'ledger', 'eject'];
    const seen = {};
    FZ.EL.forEach(e => {
      if (seen[e.sym]) out.dupSym.push(e.sym); seen[e.sym] = 1;
      const a = (FZ.outbreak.answersFor ? FZ.outbreak.answersFor(e.sym) : e.answers) || [];
      if (!a.length) out.noAnswers.push(e.sym);
      a.forEach(k => { if (!KINDS.includes(k)) out.badAnswerKind.push(e.sym + ':' + k); });
      const f = FZ.copy.fire[e.sym];
      if (!f) out.noFire.push(e.sym); else if (f.length > 90) out.longFire.push(e.sym + '=' + f.length);
      if (!FZ.copy.wrong || !FZ.copy.wrong[e.sym]) out.noWrong.push(e.sym);
      if (typeof e.detect !== 'function') out.noDetect.push(e.sym);
      if (typeof e.counteredBy !== 'function') out.noCounter.push(e.sym);
      if (!e.glyph || !/svg/i.test(e.glyph)) out.noGlyph.push(e.sym);
      if (!e.plain) out.noPlain.push(e.sym);
    });
    return out;
  });
  console.log('COVERAGE ' + JSON.stringify(r, null, 1));

  // chapter 9: 28 plates in the guide, all enabled
  await p.evaluate(() => window.__FZ.goto(9));
  await p.waitForTimeout(500);
  await p.locator('#gate .gtBtn').first().click().catch(() => { });
  await p.waitForTimeout(1200);
  const g = await p.evaluate(() => {
    FZ.table.openGuide && FZ.table.openGuide();
    return { plates: document.querySelectorAll('#guide .pl').length, enabled: FZ.sim.enabled.size, tools: FZ.chapters.list[9].cfg.tools };
  });
  console.log('CH9 ' + JSON.stringify(g));

  // mastery persistence
  const m = await p.evaluate(() => { try { return { key: !!localStorage.getItem('formicary.mastery'), len: (localStorage.getItem('formicary.mastery') || '').length }; } catch (e) { return 'ERR ' + e.message; } });
  console.log('MASTERY ' + JSON.stringify(m));
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await b.close();
})();
