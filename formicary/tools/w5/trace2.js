/* trace one chapter WITH an attentive player, showing urge, jobs, cover and heats. */
const { chromium } = require('playwright');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const ch = +arg('ch', 1), secs = +arg('secs', 30), react = +arg('react', 100);
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const perr = []; p.on('pageerror', e => perr.push(e.message));
  await p.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.evaluate(i => window.__FZ.goto(i), ch);
  await p.waitForTimeout(300);
  await p.evaluate(() => { const g = document.getElementById('gate'); const btn = g && g.querySelector('button'); if (btn) btn.click(); });
  await p.evaluate((react) => {
    window.__L = []; const did = new Set();
    window.__T = setInterval(() => {
      const S = FZ.sim.state;
      if (FZ.chapters.phase() === 'play') {
        for (const o of FZ.outbreak.list) {
          if (o.state !== 'burning' || did.has(o.id) || S.tick - o.born < react) continue;
          did.add(o.id);
          let kind = null;
          for (const k of (o.answers || [])) if ((S.tools || []).indexOf(k) > -1) { kind = k; break; }
          if (!kind || S.budget < FZ.sim.cost(kind)) continue;
          let a = null; try { a = FZ.outbreak.tryAnswer(kind, o.x, o.y); } catch (e) { }
          if (a && a.hit) FZ.sim.apply(kind, o.x, o.y);
        }
      }
      const en = FZ.EL.filter(e => FZ.sim.enabled.has(e.sym));
      const covered = S.jobs.filter(j => !j.done && FZ.elh.cover(S, j.x, j.y)).length;
      window.__L.push(S.tick + ' ' + FZ.chapters.phase()
        + ' done=' + S.jobsDone + '/' + S.jobsGoal
        + ' burn=' + FZ.outbreak.list.filter(o => o.state === 'burning').map(o => o.sym).join('+')
        + ' urge=' + S.urge.toFixed(2) + ' calm=' + S.calm
        + ' jobs=' + S.jobs.filter(j => !j.done).length + '(cov ' + covered + ')'
        + ' stones=' + S.charters.length + ' slow=' + (S.tick < S.slowUntil ? 1 : 0)
        + ' cl=' + S.jobs.filter(j => !j.done).map(j => j.claims.size + '/' + [...j.claims].filter(id => { const a = S.agents.find(z => z.id === id); return a && a.place === 'chamber' && a.at === j.node; }).length + (FZ.elh.cover(S, j.x, j.y) ? 'C' : '')).join(',')
        + ' idle=' + S.agents.filter(a => !a.hold.length).length
        + ' pl=' + ['chamber', 'tunnel', 'dig', 'surface'].map(k => k[0] + S.agents.filter(a => a.place === k).length).join('')
        + ' j0=' + (S.jobs[0] ? [...S.jobs[0].claims].map(id => { const a = S.agents.find(z => z.id === id); return a ? a.place[0] + (a.at === S.jobs[0].node ? '!' : '') + (a.waitFor != null ? 'w' : '') : '?'; }).join(' ') : '')
        + ' | ' + en.filter(e => e.heat > 0.02).map(e => e.sym + ':' + e.heat.toFixed(2) + (e.countered ? '*' : '')).join(' '));
    }, 250);
  }, react);
  await p.waitForTimeout(secs * 1000);
  const r = await p.evaluate(() => { clearInterval(window.__T); return window.__L; });
  console.log(r.join('\n'));
  console.log('PAGE ERRORS:', perr.length ? perr.join('|') : 'none');
  await b.close();
})();
