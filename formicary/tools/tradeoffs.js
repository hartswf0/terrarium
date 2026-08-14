#!/usr/bin/env node
/* FORMICARY trade-off proof — the objective gate for CONTRACT.md §15.
 *
 * Institutions are not upgrades. Each one is paid for in a currency that is some other
 * failure getting worse. This runs the same seeds twice — instrument off, instrument on —
 * and checks that the element the instrument is FOR went down and the element it is PAID
 * FOR IN went up. An unproven trade-off is not implemented.
 *
 * Usage: node formicary/tools/tradeoffs.js
 */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const ok = await page.evaluate(() => !!(window.__FZ && window.__FZ.tradeoffs));
  if (!ok) { console.log('TRADEOFFS UNAVAILABLE'); await browser.close(); process.exit(3); }

  const t0 = Date.now();
  const rep = await page.evaluate(() => window.__FZ.tradeoffs());
  await browser.close();

  let pass = true;
  for (const c of rep) {
    console.log((c.pass ? 'OK   ' : 'FAIL ') + c.claim);
    for (const r of c.rows) {
      console.log('       ' + String(r.sym).padEnd(11) + String(r.off).padEnd(9) + '-> ' +
        String(r.on).padEnd(9) + r.want + (r.ok ? '' : '   <-- NOT MET'));
    }
    if (c.ungoverned) console.log('       ungoverned ' + JSON.stringify(c.ungoverned) + '  governed ' + JSON.stringify(c.governed));
    if (!c.pass) pass = false;
  }
  console.log('---');
  console.log('ms: ' + (Date.now() - t0));
  if (perr.length) { console.log('PAGE ERRORS:'); perr.slice(0, 8).forEach(e => console.log('  !! ' + e)); }
  console.log(pass && !perr.length ? 'TRADEOFFS: PASS' : 'TRADEOFFS: FAIL');
  process.exit(pass && !perr.length ? 0 : 1);
})();
