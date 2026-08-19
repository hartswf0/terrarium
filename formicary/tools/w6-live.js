#!/usr/bin/env node
/* PIECE W — watch the REAL page, at 390x844, and report whether the colony ever runs
 * out of something to point at while the player answers everything correctly. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, '..', 'shots');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const ch = +arg('ch', 9), secs = +arg('secs', 45), name = arg('name', 'w6live');
  const auto = arg('auto', '1') === '1';
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(c => { window.__FZ.goto(c); }, ch);
  await page.waitForTimeout(400);
  /* click through whatever gate the chapter opened with */
  for (let i = 0; i < 4; i++) {
    const b = await page.$('#gate button, #gate [role=button], #gate .btn');
    if (!b) break;
    try { await b.click({ timeout: 800 }); } catch (e) { break; }
    await page.waitForTimeout(500);
  }

  /* a synthetic competent player living in the page: answer every incident correctly */
  if (auto) await page.evaluate(() => {
    /* A COMPETENT HUMAN, NOT A ROBOT: it sees the incident, takes about seven hundred
       milliseconds to read it and move a thumb, then answers correctly. Anything faster
       hides exactly the gap we are measuring. */
    window.__w6 = { answered: 0, dry: 0, dryRun: 0, dryMax: 0, seen: {}, due: {},
                    hSum: 0, vSum: 0, nSum: 0, n: 0, burn: 0, ask: 0, t0: 0 };
    const REACT = 700;
    const tick = () => {
      const S = FZ.sim.state, W = window.__w6, now = performance.now();
      if (!W.t0) W.t0 = now;
      /* STOP MEASURING WHEN THE CHAPTER IS OVER. A win card is not dead time. */
      if (S.gameOver) { W.over = 1; return; }
      const L = (FZ.outbreak && FZ.outbreak.list) || [];
      for (let i = 0; i < L.length; i++) {
        const o = L[i];
        if (o.state !== 'burning') continue;
        if (!W.seen[o.id]) { W.seen[o.id] = 1; W.due[o.id] = now + REACT; continue; }
        if (now < W.due[o.id]) continue;
        W.due[o.id] = Infinity;
        const el = FZ.ELBY[o.sym], ans = (el && el.answers) || [];
        if (!ans.length) continue;
        const kind = ans[0];
        FZ.outbreak.tryAnswer(kind, o.x, o.y);
        S.budget = Math.max(S.budget, 4);
        FZ.sim.apply(kind, o.x, o.y);
        W.answered++;
      }
      const burning = L.some(o => o.state === 'burning');
      const D = S.distress;
      W.hSum += S.health; W.vSum += S.vigor; W.nSum += D.n; W.n++;
      if (burning) W.burn++;
      if (burning || D.n) W.ask++;
      /* THE DEAD SCREEN, measured honestly: nothing is being asked AND there is nothing
         physically wrong for the game to ask about next. */
      if (!burning && !D.n) { W.dry++; W.dryRun++; if (W.dryRun > W.dryMax) W.dryMax = W.dryRun; }
      else W.dryRun = 0;
      /* and the plain one the walkthrough complained about: no incident on screen */
      W.noInc = (W.noInc || 0) + (burning ? 0 : 1);
      W.gap = burning ? 0 : (W.gap || 0) + 1;
      if ((W.gap || 0) > (W.gapMax || 0)) W.gapMax = W.gap;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const marks = [Math.round(secs * 0.35), Math.round(secs * 0.7), secs];
  let last = 0;
  for (let i = 0; i < marks.length; i++) {
    await page.waitForTimeout((marks[i] - last) * 1000); last = marks[i];
    await page.screenshot({ path: path.join(SHOTS, name + '-' + String.fromCharCode(97 + i) + '.png') });
  }

  const r = await page.evaluate(() => {
    const S = FZ.sim.state, W = window.__w6 || {};
    return {
      tick: S.tick, jobsDone: S.jobsDone, strain: Math.round(S.collapse), scar: Math.round(S.scar),
      gameOver: S.gameOver, won: S.won,
      answered: W.answered, frames: W.n,
      pctIncidentOnScreen: W.n ? +(100 * W.burn / W.n).toFixed(1) : null,
      pctSomethingToAsk: W.n ? +(100 * W.ask / W.n).toFixed(1) : null,
      deadPct: W.n ? +(100 * W.dry / W.n).toFixed(1) : null,
      longestDeadFrames: W.dryMax,
      longestNoIncidentSecs: +((W.gapMax || 0) / 60).toFixed(1),
      health: W.n ? +(W.hSum / W.n).toFixed(2) : null,
      vigor: W.n ? +(W.vSum / W.n).toFixed(2) : null,
      sites: W.n ? +(W.nSum / W.n).toFixed(2) : null,
      speedMul: +S.speedMul.toFixed(2),
      distressNow: S.distress.sites.map(s => s.kind + ':' + s.why + ' ' + s.sev.toFixed(2)),
    };
  });
  console.log('ch' + ch, JSON.stringify(r, null, 1));
  console.log('PAGE ERRORS:', perr.length ? perr.join(' | ') : 'none');
  console.log('CONSOLE ERRORS:', cerr.length ? cerr.join(' | ') : 'none');
  await browser.close();
})();
