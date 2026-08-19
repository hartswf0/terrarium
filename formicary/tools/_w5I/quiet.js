/* PLAY WELL AND SEE WHAT HAPPENS.
   A bot that answers every incident CORRECTLY, then measures how long the screen is
   without a decision on it. The round-5 verdict was that answering correctly suppressed
   the sources of new incidents and the screen went empty. */
const { chromium } = require('playwright');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const CH = +arg('ch', 3), MS = +arg('ms', 45000);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.evaluate(c => window.__FZ.goto(c), CH); await p.waitForTimeout(500);
  try { const g = await p.$('#gate button'); if (g) await g.click(); } catch (e) { }
  const out = await p.evaluate(async (ms) => {
    const sleep = t => new Promise(r => setTimeout(r, t));
    const log = [], gaps = [], why = [];
    let quietFrom = Date.now(), answered = 0, wrong = 0, landed = 0;
    FZ.bus.on('outbreak:landed', () => landed++);
    FZ.bus.on('outbreak:wrong', () => wrong++);
    const t0 = Date.now();
    let seenAny = false;
    while (Date.now() - t0 < ms) {
      await sleep(80);
      const S = FZ.sim.state;
      if (S.gameOver) break;
      const anyRing = (FZ.outbreak.list || []).some(o => o.state === 'burning');
      if (!anyRing && seenAny && quietFrom && Date.now() - quietFrom > 3200) {
        try { why.push(JSON.stringify(FZ.outbreak.debug())); } catch (e) { }
      }
      if (anyRing && quietFrom) { const g = Date.now() - quietFrom; if (seenAny) gaps.push(g); quietFrom = 0; }
      const c = FZ.outbreak.current();
      if (!c) continue;
      seenAny = true;
      if (S.tick - c.born < 40) continue;
      const k = c.answers.filter(a => S.tools.indexOf(a) > -1)[0];
      if (!k) continue;
      if (S.budget < FZ.sim.cost(k)) { S.budget = FZ.sim.cost(k) + 1; }
      const a = FZ.outbreak.tryAnswer(k, c.x, c.y);
      const r = FZ.sim.apply(k, c.x, c.y);
      log.push(c.sym + ':' + k + (a && a.right ? ' right' : ' WRONG') + (r && r.ok ? '' : ' (refused)'));
      if (a && a.right) answered++;
      await sleep(60);
      if (!(FZ.outbreak.list || []).some(o => o.state === 'burning')) quietFrom = Date.now();
      window.__probeQuiet = window.__probeQuiet || [];
    }
    return { log, gaps, why: why.slice(0, 14), answered, wrong, landed, ticks: FZ.sim.state.tick };
  }, MS);
  console.log(out.log.join('\n'));
  const g = out.gaps;
  console.log('answered', out.answered, ' wrong', out.wrong, ' landed', out.landed);
  console.log('gaps(ms):', g.join(' '));
  console.log('max gap', g.length ? Math.max(...g) : 0, 'ms   mean', g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length) : 0, 'ms   n=' + g.length);
  console.log('WHY QUIET:\n' + (out.why||[]).join('\n'));
  console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
