#!/usr/bin/env node
/* FORMICARY probe — open the real running build, drive it, screenshot it, read its state.
 *
 * Usage:
 *   node formicary/tools/probe.js --name run1 --steps "shot:a,wait:1500,tap:#btnGo,shot:b"
 *   node formicary/tools/probe.js --name m --w 390 --h 844 --steps "..." --dump
 *
 * Steps (comma separated, executed in order):
 *   wait:MS              wait MS milliseconds of real time
 *   shot:LABEL           screenshot -> formicary/shots/<name>-LABEL.png
 *   full:LABEL           full-page screenshot
 *   tap:SELECTOR         click the first match of SELECTOR
 *   tapxy:X:Y            click canvas #field at field-local X,Y
 *   text:SELECTOR        print textContent of SELECTOR
 *   eval:EXPR            evaluate EXPR in the page and print the result
 *   exists:SELECTOR      print whether SELECTOR exists and is visible
 *   count:SELECTOR       print number of matches
 *
 * Flags: --w --h (viewport, default 390x844), --dump (print window.__FZ probe state),
 *        --file (path to html, default formicary.html), --scale (deviceScaleFactor)
 *
 * Always prints CONSOLE ERRORS and PAGE ERRORS. A build with page errors is broken.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, '..', 'shots');

function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
const has = k => process.argv.includes('--' + k);

(async () => {
  const name = arg('name', 'probe');
  const W = +arg('w', 390), H = +arg('h', 844);
  const file = arg('file', 'formicary.html');
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: +arg('scale', 2),
    isMobile: true, hasTouch: true,
  });

  const cerr = [], perr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));

  await page.goto('file://' + path.join(ROOT, file), { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const steps = (arg('steps', '') || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const s of steps) {
    const [op, ...rest] = s.split(':');
    const a = rest.join(':');
    try {
      if (op === 'wait') await page.waitForTimeout(+a);
      else if (op === 'shot') { const p = path.join(SHOTS, `${name}-${a}.png`); await page.screenshot({ path: p }); console.log('SHOT ' + p); }
      else if (op === 'full') { const p = path.join(SHOTS, `${name}-${a}.png`); await page.screenshot({ path: p, fullPage: true }); console.log('SHOT ' + p); }
      else if (op === 'tap') { await page.click(a, { timeout: 4000 }); console.log('TAP ' + a); }
      else if (op === 'tapxy') {
        const [x, y] = a.split(':').map(Number);
        const box = await page.locator('#field').boundingBox();
        if (!box) { console.log('TAPXY no #field'); continue; }
        await page.mouse.click(box.x + x, box.y + y);
        console.log(`TAPXY ${x},${y}`);
      }
      else if (op === 'text') console.log('TEXT ' + a + ' => ' + JSON.stringify((await page.textContent(a).catch(() => null) || '').trim().slice(0, 400)));
      else if (op === 'eval') console.log('EVAL ' + a + ' => ' + JSON.stringify(await page.evaluate(a).catch(e => 'ERR:' + e.message)));
      else if (op === 'exists') {
        const n = await page.locator(a).count();
        const vis = n ? await page.locator(a).first().isVisible().catch(() => false) : false;
        console.log(`EXISTS ${a} => count=${n} visible=${vis}`);
      }
      else if (op === 'count') console.log(`COUNT ${a} => ${await page.locator(a).count()}`);
      else console.log('UNKNOWN STEP ' + s);
    } catch (e) { console.log('STEP FAILED ' + s + ' :: ' + e.message.split('\n')[0]); }
  }

  if (has('dump')) {
    const st = await page.evaluate(() => (window.__FZ && window.__FZ.probe) ? window.__FZ.probe() : 'no __FZ.probe');
    console.log('STATE ' + JSON.stringify(st, null, 1));
  }

  // layout hygiene checks
  const hyg = await page.evaluate(() => {
    const r = { hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, small: [], radius: [] };
    document.querySelectorAll('button,[role=button],a,.tap,.cell').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && Math.min(b.width, b.height) < 30)
        r.small.push((el.id || el.className || el.tagName) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
    });
    document.querySelectorAll('*').forEach(el => {
      const br = getComputedStyle(el).borderRadius;
      if (br && br !== '0px' && !/^0px 0px 0px 0px$/.test(br)) r.radius.push((el.id || el.tagName) + ':' + br);
    });
    r.small = r.small.slice(0, 25); r.radius = r.radius.slice(0, 10);
    return r;
  });
  console.log('HYGIENE ' + JSON.stringify(hyg));

  if (perr.length) { console.log('PAGE ERRORS (' + perr.length + '):'); perr.slice(0, 12).forEach(e => console.log('  !! ' + e)); }
  else console.log('PAGE ERRORS: none');
  if (cerr.length) { console.log('CONSOLE ERRORS (' + cerr.length + '):'); cerr.slice(0, 12).forEach(e => console.log('  ! ' + e)); }
  else console.log('CONSOLE ERRORS: none');

  await browser.close();
})();
