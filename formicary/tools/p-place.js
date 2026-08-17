/* PLAY: the answer gesture. Arm the instrument, watch the ghost land on the crossroads,
   put it down with a tap on the nest, watch the ring close. Three shots. */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = '/home/user/terrarium/formicary/shots';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const ch = +arg('ch', 2), name = arg('name', 'place');
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
  const shot = async n => { await page.screenshot({ path: path.join(SHOTS, name + '-' + n + '.png') }); console.log('SHOT ' + name + '-' + n); };

  // wait for a named incident with an action bar
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(200);
    const n = await page.locator('#act button').count();
    if (n) break;
  }
  await page.waitForTimeout(400);
  console.log('TAG ' + JSON.stringify(await page.textContent('.fztag')));
  await shot('a-incident');

  const want = (process.argv.indexOf('--kind') > -1) ? process.argv[process.argv.indexOf('--kind') + 1] : null;
  const kind = await page.evaluate((w) => {
    const b = (w && document.querySelector('#act button[data-kind="' + w + '"]')) || document.querySelector('#act button');
    return b ? b.getAttribute('data-kind') : null;
  }, want);
  console.log('INSTRUMENT ' + kind);
  await page.click(`#act button[data-kind="${kind}"]`);
  await page.waitForTimeout(350);
  console.log('ARMED ' + JSON.stringify(await page.evaluate(() => ({ armed: FZ.controls.armed, aim: FZ.controls.aim }))));
  console.log('TAG ' + JSON.stringify(await page.textContent('.fztag')));
  await shot('b-armed');

  // put it down ON the incident, by touching the nest
  const p = await page.evaluate(() => {
    const o = FZ.outbreak.current() || FZ.outbreak.urgent();
    const S = FZ.sim.state, f = document.getElementById('field').getBoundingClientRect();
    return o ? { x: f.left + o.x * f.width / S.w, y: f.top + o.y * f.height / S.h, sym: o.sym } : null;
  });
  if (p) {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(220);
    await shot('c-aiming');
    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('PLACED ' + p.sym + ' -> ' + JSON.stringify(await page.evaluate(() => {
      const l = FZ.outbreak.list.map(o => o.sym + ':' + o.state);
      return { list: l, works: FZ.sim.state.works.slice(-2), budget: FZ.sim.state.budget };
    })));
    await shot('d-answered');
  }
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  console.log('CONSOLE ERRORS: ' + (cerr.length ? cerr.join(' | ') : 'none'));
  await browser.close();
})();
