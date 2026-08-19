/* r6I — competent-player bot. Diagnoses correctly (reads o.answers), aims at the ring
   centre, and reports whether the answer LANDED. Also measures dead time. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const CH = +(process.argv[2] || 3);
const SECS = +(process.argv[3] || 45);
const REACT = +(process.argv[4] || 1200); // ms the "player" takes to think after the tag

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.evaluate(n => window.__FZ.goto(n), CH);
  await page.waitForTimeout(400);
  for (let i = 0; i < 3; i++) {
    const b = page.locator('.gtBtn').first();
    if (await b.count() && await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(300); }
  }
  await page.evaluate(() => {
    window.__E = [];
    ['outbreak:open','outbreak:answered','outbreak:wrong','outbreak:landed'].forEach(n =>
      FZ.bus.on(n, d => window.__E.push({ n, sym: d && d.sym, t: Date.now() })));
    window.__Q = []; // quiet sampler: is a decision on the table?
    setInterval(() => {
      const O = FZ.outbreak;
      const live = (O.list||[]).some(o => o.state === 'burning');
      window.__Q.push({ t: Date.now(), live });
    }, 100);
  });

  const box = await page.locator('#field').boundingBox();
  const log = [];
  const t0 = Date.now();
  const handled = new Set();
  while (Date.now() - t0 < SECS * 1000) {
    const target = await page.evaluate(() => {
      const O = FZ.outbreak, st = FZ.sim.state;
      if (!O || !st) return null;
      const o = (O.list||[]).filter(x => x.state === 'burning' && st.tick >= x.tagAt)[0];
      if (!o) return null;
      const btns = [...document.querySelectorAll('.fzact')].map(b => b.getAttribute('data-kind'));
      const pick = o.answers.filter(a => btns.includes(a))[0] || null;
      return { id: o.id, sym: o.sym, x: o.x, y: o.y, r: o.r, pick, btns,
        left: 1-(st.tick-o.born)/o.fuse, budget: st.budget, cost: pick?FZ.sim.cost(pick):0 };
    });
    if (!target || handled.has(target.id)) { await page.waitForTimeout(120); continue; }
    if (!target.pick) { log.push({ sym: target.sym, r: 'NO-INSTRUMENT', btns: target.btns }); handled.add(target.id); continue; }
    if (target.budget < target.cost) { log.push({ sym: target.sym, r: 'NO-BUDGET' }); handled.add(target.id); await page.waitForTimeout(200); continue; }
    handled.add(target.id);
    // press instrument
    const btn = page.locator(`.fzact[data-kind="${target.pick}"]`).first();
    if (!(await btn.count())) { log.push({ sym: target.sym, r: 'BTN-MISSING' }); continue; }
    await btn.click().catch(()=>{});
    await page.waitForTimeout(REACT);
    // re-read the ring centre AFTER thinking — this is what a real thumb aims at
    const now = await page.evaluate(id => {
      const o = (FZ.outbreak.list||[]).find(x => x.id === id);
      return o ? { x: o.x, y: o.y, state: o.state } : null;
    }, target.id);
    const aimAt = now && now.state === 'burning' ? now : target;
    await page.mouse.click(box.x + aimAt.x, box.y + aimAt.y);
    await page.waitForTimeout(250);
    const res = await page.evaluate(id => {
      const o = (FZ.outbreak.list||[]).find(x => x.id === id);
      const ev = window.__E.slice(-4);
      return { state: o ? o.state : 'gone', ev };
    }, target.id);
    log.push({ sym: target.sym, pick: target.pick,
      aimShift: Math.round(Math.hypot(aimAt.x-target.x, aimAt.y-target.y)),
      outcome: res.state, last: res.ev.map(e=>e.n+':'+e.sym).join(' ') });
  }
  const q = await page.evaluate(() => {
    const Q = window.__Q; let gaps = [], run = 0;
    Q.forEach(s => { if (!s.live) run += 100; else { if (run) gaps.push(run); run = 0; } });
    if (run) gaps.push(run);
    return { live: Q.filter(s=>s.live).length, total: Q.length, gaps: gaps.sort((a,b)=>b-a).slice(0,6),
      events: window.__E.map(e=>e.n.split(':')[1]+':'+e.sym) };
  });
  console.log('CH', CH, 'ATTEMPTS', log.length);
  log.forEach(l => console.log(' ', JSON.stringify(l)));
  const ans = q.events.filter(e=>e.startsWith('answered')).length;
  const lan = q.events.filter(e=>e.startsWith('landed')).length;
  const wro = q.events.filter(e=>e.startsWith('wrong')).length;
  console.log('ANSWERED', ans, 'LANDED', lan, 'WRONG', wro);
  console.log('DECISION ON TABLE', (100*q.live/q.total).toFixed(0)+'%', 'LONGEST QUIET(ms)', q.gaps);
  if (perr.length) console.log('PAGE ERRORS', perr.slice(0,5));
  await browser.close();
})();
