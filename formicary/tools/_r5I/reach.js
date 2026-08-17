/* Does a tap at the ring's OWN CENTRE, after N ms of hand travel, still hit? */
const { chromium } = require('playwright');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const CH = +arg('ch', 7), LAG = +arg('lag', 700), MS = +arg('ms', 40000);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.evaluate(c => window.__FZ.goto(c), CH); await p.waitForTimeout(500);
  try { const g = await p.$('#gate button'); if (g) await g.click(); } catch (e) { }
  const r = await p.evaluate(async (lag) => {
    const out = [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = Date.now();
    while (Date.now() - t0 < 38000) {
      await sleep(150);
      const c = FZ.outbreak.current();
      if (!c) continue;
      const S = FZ.sim.state;
      if (S.tick - c.born < 70) continue;
      const k = c.answers.filter(a => S.tools.indexOf(a) > -1 && ['charter', 'vary', 'eject'].indexOf(a) > -1)[0];
      if (!k) continue;
      const x = c.x, y = c.y, r0 = c.r, id = c.id, sym = c.sym;
      await sleep(lag);                       // the thumb travels
      const now = (FZ.outbreak.list || []).find(o => o.id === id);
      const moved = now ? Math.round(Math.hypot(now.x - x, now.y - y)) : -1;
      const a = FZ.outbreak.tryAnswer(k, x, y);   // tap exactly where the ring was
      out.push({ sym: sym, k: k, r: Math.round(r0), moved: moved, hit: !!(a && a.hit), right: !!(a && a.right), msg: (a && a.msg) || '' });
      await sleep(1200);
    }
    return out;
  }, LAG);
  let hit = 0;
  r.forEach(o => { if (o.hit) hit++; console.log(o.sym, o.k, 'r=' + o.r, 'ringMoved=' + o.moved + 'px', o.hit ? (o.right ? 'HIT/right' : 'HIT/wrong') : 'MISS -> ' + o.msg); });
  console.log('LAG', LAG, 'ms:', hit + '/' + r.length, 'taps at the ring\'s own centre still landed');
  await b.close();
})();
