/* incident density harness — opens per chapter, close->open gaps, and whether the
   colony had anything answerable to offer during each gap. */
const { chromium } = require('playwright');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const chs = (arg('chs', '1,2,3,5,6,7,8,9')).split(',').map(Number);
  const secs = +arg('secs', 30);
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = []; p.on('pageerror', e => perr.push(e.message));
  p.on('console', m => { if (m.type() === 'error') perr.push('console:' + m.text()); });
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);

  for (const ch of chs) {
    await p.evaluate(i => window.__FZ.goto(i), ch);
    await p.waitForTimeout(300);
    await p.evaluate(() => { const g = document.getElementById('gate'); const btn = g && g.querySelector('button'); if (btn) btn.click(); });
    await p.waitForTimeout(150);
    await p.evaluate(() => {
      window.__L = []; window.__O = []; const seen = new Set();
      window.__T = setInterval(() => {
        const S = FZ.sim.state, L = FZ.outbreak.list;
        let burn = 0, closed = 0;
        for (const o of L) {
          if (o.state === 'burning') burn++;
          if (!seen.has(o.id)) { seen.add(o.id); window.__O.push({ t: S.tick, sym: o.sym, born: o.born, fuse: o.fuse }); }
        }
        // hottest answerable element the player holds an instrument for
        let best = 0, bs = '';
        const tools = new Set(S.tools || []);
        for (const e of FZ.EL) {
          if (!FZ.sim.enabled.has(e.sym)) continue;
          const ans = e.answers || [];
          if (!ans.some(k => tools.has(k))) continue;
          if (e.heat > best) { best = e.heat; bs = e.sym; }
        }
        window.__L.push({ t: S.tick, burn, best: +best.toFixed(2), bs, phase: FZ.chapters.phase() });
      }, 200);
    });
    await p.waitForTimeout(secs * 1000);
    const r = await p.evaluate(() => {
      clearInterval(window.__T);
      return { o: window.__O, l: window.__L, phase: FZ.chapters.phase(), tick: FZ.sim.state.tick, tools: FZ.sim.state.tools };
    });
    // ticks per second
    const L = r.l;
    const dt = L.length > 2 ? (L[L.length - 1].t - L[0].t) : 0;
    const secsRan = L.length > 2 ? (L.length - 1) * 0.2 : 1;
    const tps = dt / secsRan;
    const o = r.o;
    const gaps = [];
    for (let i = 1; i < o.length; i++) gaps.push(o[i].born - (o[i - 1].born + o[i - 1].fuse));
    // dead time: samples with burn==0
    const dead = L.filter(s => s.burn === 0 && s.phase === 'play').length;
    const play = L.filter(s => s.phase === 'play').length;
    const deadNothing = L.filter(s => s.burn === 0 && s.phase === 'play' && s.best < 0.10).length;
    console.log(`ch${ch}  tps=${tps.toFixed(0)}  opens=${o.length} in ${secs}s  = 1 per ${(secs / Math.max(1, o.length)).toFixed(1)}s`);
    console.log(`      syms: ${o.map(x => x.sym).join(' ')}`);
    console.log(`      close->open gaps (s): ${gaps.map(g => (g / Math.max(1, tps)).toFixed(1)).join(', ')}`);
    console.log(`      dead time ${(100 * dead / Math.max(1, play)).toFixed(0)}%  of which nothing-to-offer ${(100 * deadNothing / Math.max(1, play)).toFixed(0)}%   phase=${r.phase} tools=${(r.tools || []).join('/')}`);
  }
  console.log('PAGE ERRORS:', perr.length ? perr.slice(0, 4).join(' | ') : 'none');
  await b.close();
})();
