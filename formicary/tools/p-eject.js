/* PLAY: the expulsion. Arm the threshold, tap a BODY, and check the layer judged the
   body and not the distance — the round-one correctness fix, still true after arming. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(700);
  await p.evaluate(() => window.__FZ.goto(9));
  await p.waitForTimeout(400);
  try { await p.click('#gate button', { timeout: 3000 }); } catch (e) { }
  for (let i = 0; i < 300; i++) {
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const o = FZ.outbreak.current();
      if (!o) return null;
      const S = FZ.sim.state;
      // an honest worker inside the ring, and the real culprit
      const inR = a => (a.x - o.x) ** 2 + (a.y - o.y) ** 2 <= o.r * o.r;
      const honest = S.agents.find(a => inR(a) && !a.adversary && a.corrigible && !a.locker);
      const bad = S.agents.find(a => (o.who || []).indexOf(a.id) > -1) ||
        S.agents.find(a => a.adversary || !a.corrigible || a.locker);
      const f = document.getElementById('field').getBoundingClientRect();
      const pt = a => a ? { x: f.left + a.x * f.width / S.w, y: f.top + a.y * f.height / S.h } : null;
      return { sym: o.sym, honest: pt(honest), bad: pt(bad), n: S.agents.length };
    });
    if (!r || !r.honest) continue;
    console.log('INCIDENT ' + r.sym + ' answerable by eject; ' + r.n + ' workers');
    await p.click('#act button[data-kind="eject"]');
    await p.waitForTimeout(200);
    await p.mouse.click(r.honest.x, r.honest.y);
    await p.waitForTimeout(400);
    console.log('EXPELLED AN HONEST WORKER -> ' + JSON.stringify(await p.evaluate(() => ({
      tag: document.querySelector('.fztag').textContent,
      states: FZ.outbreak.list.map(o => o.sym + ':' + o.state),
    }))));
    break;
  }
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await b.close();
})();
