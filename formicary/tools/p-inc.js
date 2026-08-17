/* PLAY's probe: wait for a named incident, screenshot it, and report what is
   physically inside its ring — nodes, tunnels, bodies. The whole question this
   round is whether the ring contains a BODY. */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = '/home/user/terrarium';
const SHOTS = '/home/user/terrarium/formicary/shots';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const want = (arg('sym', '') || '').split(',').filter(Boolean);
  const ch = +arg('ch', 2);
  const name = arg('name', 'p');
  const secs = +arg('secs', 40);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('pageerror', e => perr.push(e.message + ' :: ' + String(e.stack || '').split('\n').slice(0, 4).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(c => window.__FZ.goto(c), ch);
  await page.waitForTimeout(400);
  try { await page.click('#gate button', { timeout: 3000 }); } catch (e) { }
  await page.waitForTimeout(900);

  const seenSyms = {};
  let got = null;
  for (let i = 0; i < secs * 5; i++) {
    const r = await page.evaluate((wantList) => {
      const ob = window.FZ.outbreak, S = window.FZ.sim.state;
      if (!ob) return null;
      const o = ob.current() || ob.urgent();
      if (!o || o.state !== 'burning') return null;
      const N = S.nest.nodes, E = S.nest.edges;
      const inR = (x, y) => { const dx = x - o.x, dy = y - o.y; return dx * dx + dy * dy <= o.r * o.r; };
      const nodes = N.filter(n => inR(n.x, n.y)).map(n => n.kind + '#' + n.id + (n.gov ? '*' : '') + ':' + n.occ.length);
      const edges = E.filter(e => { const a = N[e.a], b = N[e.b]; return inR((a.x + b.x) / 2, (a.y + b.y) / 2); })
        .map(e => (e.dug ? 'tun' : 'face') + '#' + e.id + ':' + (e.occ.length + e.qa.length + e.qb.length));
      const ants = S.agents.filter(a => inR(a.x, a.y)).map(a => a.place + '/' + a.posture);
      return { sym: o.sym, name: o.name, line: o.line, x: Math.round(o.x), y: Math.round(o.y), r: Math.round(o.r),
               site: o.site ? o.site.kind + '#' + o.site.id : 'none', nodes, edges, ants,
               tick: S.tick, born: o.born, fuse: o.fuse };
    }, want);
    if (r) {
      seenSyms[r.sym] = (seenSyms[r.sym] || 0) + 1;
      if (!want.length || want.indexOf(r.sym) > -1) {
        if (r.tick - r.born > 60) { got = r; break; }
      }
    }
    await page.waitForTimeout(200);
  }
  if (got) {
    await page.waitForTimeout(500);
    console.log('INCIDENT ' + JSON.stringify(got, null, 1));
    await page.screenshot({ path: path.join(SHOTS, name + '-' + got.sym + '.png') });
    console.log('SHOT ' + path.join(SHOTS, name + '-' + got.sym + '.png'));
  } else {
    console.log('NO MATCHING INCIDENT. saw: ' + JSON.stringify(seenSyms));
    await page.screenshot({ path: path.join(SHOTS, name + '-none.png') });
  }
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? cerr.join(' | ') : 'none'));
  await browser.close();
})();
