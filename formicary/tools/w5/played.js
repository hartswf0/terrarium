/* THE ATTENTIVE PLAYER. Answers every incident correctly, `react` seconds after it opens,
   the way a competent human would — and reports how often a decision was actually on the
   table. This is the L10.1 measurement: a decision every few seconds, in every chapter. */
const { chromium } = require('playwright');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const chs = (arg('chs', '1,2,3,5,6,7,8,9')).split(',').map(Number);
  const secs = +arg('secs', 40);
  const react = +arg('react', 100);   /* ticks the player takes to read and answer */
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
    await p.waitForTimeout(120);
    await p.evaluate((react) => {
      window.__O = []; window.__S = []; window.__A = { ok: 0, no: 0 }; const seen = new Set(), did = new Set();
      window.__T = setInterval(() => {
        const S = FZ.sim.state, L = FZ.outbreak.list;
        if (FZ.chapters.phase() !== 'play') { window.__S.push({ t: S.tick, burn: 0, off: 1 }); return; }
        let burn = 0;
        for (const o of L) {
          if (o.state !== 'burning') continue;
          burn++;
          if (!seen.has(o.id)) { seen.add(o.id); window.__O.push({ t: o.born, sym: o.sym, fuse: o.fuse }); }
          if (S.tick - o.born < react || did.has(o.id)) continue;
          did.add(o.id);
          let kind = null;
          for (const k of (o.answers || [])) if ((S.tools || []).indexOf(k) > -1) { kind = k; break; }
          if (!kind || S.budget < FZ.sim.cost(kind)) continue;
          let a = null;
          try { a = FZ.outbreak.tryAnswer(kind, o.x, o.y); } catch (e) { }
          if (a && a.hit) { FZ.sim.apply(kind, o.x, o.y); if (a.right) window.__A.ok++; else window.__A.no++; }
        }
        window.__S.push({ t: S.tick, burn: burn, off: 0 });
      }, 100);
    }, react);
    await p.waitForTimeout(secs * 1000);
    const r = await p.evaluate(() => {
      clearInterval(window.__T);
      const S = FZ.sim.state;
      return { o: window.__O, s: window.__S, a: window.__A, phase: FZ.chapters.phase(), tick: S.tick, done: S.jobsDone + '/' + S.jobsGoal, strain: Math.round(S.collapse) };
    });
    const play = r.s.filter(x => !x.off);
    const playSecs = play.length * 0.1;
    const on = play.filter(x => x.burn > 0).length;
    const gaps = [];
    for (let i = 1; i < r.o.length; i++) gaps.push(((r.o[i].t - r.o[i - 1].t) / 56).toFixed(1));
    console.log(`ch${ch}  ${r.o.length} decisions in ${playSecs.toFixed(0)}s of play = 1 per ${(playSecs / Math.max(1, r.o.length)).toFixed(1)}s`
      + `   decision on the table ${(100 * on / Math.max(1, play.length)).toFixed(0)}% of ticks`);
    console.log(`      open->open (s): ${gaps.join(' ')}`);
    console.log(`      syms: ${r.o.map(x => x.sym).join(' ')}`);
    console.log(`      answered right ${r.a.ok} wrong ${r.a.no}   end=${r.phase} ${r.done} strain=${r.strain}`);
  }
  console.log('PAGE ERRORS:', perr.length ? perr.slice(0, 4).join(' | ') : 'none');
  await b.close();
})();
