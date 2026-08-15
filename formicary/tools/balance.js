#!/usr/bin/env node
/* FORMICARY balance harness — THE LOOP, MEASURED THROUGH THE LOOP.
 *
 * Runs the shipped tick headless (FZ.sim.step + FZ.outbreak.update, exactly as 90-boot.js
 * does) with a synthetic player who commits ONCE per incident and answers a stated
 * fraction of them correctly. Reports, per accuracy: survived or lost, the band strain
 * lived in, the residual scar its misses left, and the work it banked.
 *
 * The target: ~70% correct survives with strain oscillating in the 30-70 band;
 * ~50% correct loses outright.
 *
 * Usage: node formicary/tools/balance.js [--ticks 12000] [--chapter N] [--seeds 6]
 */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const ticks = +arg('ticks', 12000), nSeeds = +arg('seeds', 4);
  const chapter = arg('chapter', null);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const seeds = [8821, 33417, 55221, 7, 90210, 4242].slice(0, nSeeds);
  const lines = await page.evaluate(({ ticks, seeds, chapter }) => {
    const o = { ps: [1, 0.85, 0.7, 0.6, 0.5, 0.3, 0], seeds: seeds, ticks: ticks };
    if (chapter != null) o.chapter = +chapter;
    return window.__FZ.balanceLines(window.__FZ.balance(o));
  }, { ticks, seeds, chapter });
  await browser.close();

  lines.forEach(l => console.log(l));
  if (perr.length) { console.log('PAGE ERRORS:'); perr.slice(0, 6).forEach(e => console.log('  !! ' + e)); }
  process.exit(perr.length ? 1 : 0);
})();
