/* PLAY's acceptance test for the round: DOES EVERY INCIDENT HAVE A BODY?
   Runs a chapter, subscribes to outbreak:open, and for every incident records what is
   physically inside the ring at the moment the paper tag is hung — bodies, rooms,
   passages, dig faces. An incident whose ring holds nothing is a Depiction Law failure
   and prints as EMPTY. */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const ch = +arg('ch', 9);
  const secs = +arg('secs', 60);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file:///home/user/terrarium/formicary.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(c => window.__FZ.goto(c), ch);
  await page.waitForTimeout(400);
  try { await page.click('#gate button', { timeout: 3000 }); } catch (e) { }

  await page.evaluate(() => {
    window.__BODY = [];
    const S = FZ.sim.state;
    const look = (o) => {
      const N = S.nest.nodes, E = S.nest.edges;
      const inR = (x, y) => { const dx = x - o.x, dy = y - o.y; return dx * dx + dy * dy <= o.r * o.r; };
      let ants = 0, rooms = 0, tuns = 0, faces = 0, crumbs = 0, ways = 0;
      for (const a of S.agents) if (inR(a.x, a.y)) ants++;
      for (const n of N) if (inR(n.x, n.y)) { rooms++; if (n.kind === 'junction') { let w = 0; for (const ei of n.edges) if (E[ei] && E[ei].dug) w++; ways = Math.max(ways, w); } }
      const segIn = (ax, ay, bx, by) => { for (let t = 0; t <= 1.001; t += 0.1) if (inR(ax + (bx - ax) * t, ay + (by - ay) * t)) return true; return false; };
      for (const e of E) { const a = N[e.a], b = N[e.b]; if (!segIn(a.x, a.y, b.x, b.y)) continue; if (e.dug) tuns++; else if (e.prog > 0.02) faces++; }
      for (const j of S.jobs) if (!j.done && inR(j.x, j.y)) crumbs++;
      return { ants, rooms, tuns, faces, crumbs, ways };
    };
    FZ.bus.on('outbreak:open', d => {
      const born = S.tick;
      const rec = { sym: d.sym, site: d.site ? d.site.kind : 'none', r: Math.round(d.r), at: look(d) };
      window.__BODY.push(rec);
      const t = setInterval(() => {
        if (S.tick - born < 80) return;
        clearInterval(t);
        const o = FZ.outbreak.list.find(z => z.sym === d.sym);
        rec.tag = look(o || d); rec.state = o ? (o.state+'/e'+o.emptyT+'/sid'+(o.site?o.site.kind+o.site.id:'-')+'/age'+(S.tick-o.born)+'/f'+o.fuse) : 'lost'; rec.dx = o ? Math.round(Math.hypot(o.x-d.x,o.y-d.y)) : -1;
      }, 60);
    });
  });

  /* how much of the time is there a decision on the table at all? A loop the player can
     look away from for thirty seconds is not a loop (REFERENCE-EOT L10.1). */
  let on = 0, samples = 0, dead = 0; const hist = {};
  for (let i = 0; i < secs * 5; i++) {
    await page.waitForTimeout(200);
    let b = await page.evaluate(() => {
      const L = FZ.outbreak.list, S = FZ.sim.state;
      let n = 0;
      for (const o of L) if (o.state === 'burning' && S.tick >= o.tagAt) n++;
      return { n: n, over: S.gameOver, phase: FZ.chapters.phase ? FZ.chapters.phase() : '?' };
    });
    if (b.over || b.phase !== 'play') { dead++; continue; }
    b = b.n;
    samples++; if (b > 0) on++;
    hist[Math.min(4, b)] = (hist[Math.min(4, b)] || 0) + 1;
  }
  console.log('DECISION ON SCREEN ' + Math.round(on / samples * 100) + '% of the time  concurrency ' + JSON.stringify(hist));
  const recs = await page.evaluate(() => window.__BODY);
  const rows = {};
  let empty = 0;
  for (const r of recs) {
    const t = r.tag || r.at;
    const body = t.ants > 0 || t.tuns > 0 || t.faces > 0 || t.crumbs > 0;
    if (!body) empty++;
    const k = r.sym;
    rows[k] = rows[k] || { n: 0, site: {}, ants: 0, empty: 0, r: 0, ways: 0 };
    rows[k].n++; rows[k].site[r.site] = (rows[k].site[r.site] || 0) + 1;
    rows[k].ants += t.ants; rows[k].r += r.r; rows[k].ways = Math.max(rows[k].ways, t.ways);
    if (!body) rows[k].empty++;
  }
  console.log('INCIDENTS ' + recs.length + '  EMPTY RINGS ' + empty);
  recs.forEach(r=>{const t=r.tag||r.at; if(!(t.ants>0||t.tuns>0||t.faces>0||t.crumbs>0)) console.log('  EMPTY:',r.sym,r.site,'state='+r.state,'drift='+r.dx,JSON.stringify(t),'atOpen='+JSON.stringify(r.at));});
  for (const k of Object.keys(rows).sort()) {
    const v = rows[k];
    console.log(`${k}  n=${v.n}  site=${Object.keys(v.site).map(s => s + 'x' + v.site[s]).join(',')}  ants/ring=${(v.ants / v.n).toFixed(1)}  r=${Math.round(v.r / v.n)}  empty=${v.empty}`);
  }
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? cerr.join(' | ') : 'none'));
  await browser.close();
})();
