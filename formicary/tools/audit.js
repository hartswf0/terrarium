#!/usr/bin/env node
/* FORMICARY detector audit — the objective gate for "all 28 elements are REAL detectors".
 *
 * Runs the sandbox headless at high speed across N seeded trials and reports, per element:
 *   fires   — how many times its trigger fired
 *   peak    — highest heat reached
 *   counter — whether its counter measurably reduced its heat when applied
 *
 * Requires the build to expose:
 *   window.__FZ.audit(opts) -> Promise<{elements:{SYM:{fires,peak,counterWorks}}, ...}>
 * or, minimally:
 *   window.__FZ.headless({ticks, seed, interventions}) -> report
 *
 * Usage: node formicary/tools/audit.js [--trials 6] [--ticks 40000]
 */
const { chromium } = require('playwright');
const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..', '..');
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }

(async () => {
  const trials = +arg('trials', 6), ticks = +arg('ticks', 40000);
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const ok = await page.evaluate(() => !!(window.__FZ && window.__FZ.audit));
  if (!ok) {
    console.log('AUDIT UNAVAILABLE: window.__FZ.audit is not exposed by the build.');
    if (perr.length) perr.slice(0, 5).forEach(e => console.log('  !! ' + e));
    await browser.close(); process.exit(3);
  }

  const rep = await page.evaluate(async ({ trials, ticks }) => await window.__FZ.audit({ trials, ticks }), { trials, ticks });
  await browser.close();

  const els = rep.elements || {};
  const syms = Object.keys(els);
  const dead = [], weak = [], nocounter = [];
  console.log('SYM  FIRES   PEAK   COUNTER');
  for (const s of syms) {
    const e = els[s];
    console.log(
      s.padEnd(5) + String(e.fires).padEnd(8) +
      (e.peak != null ? e.peak.toFixed(2) : '-').padEnd(7) +
      (e.counterWorks === true ? 'works' : e.counterWorks === false ? 'FAILS' : 'n/a')
    );
    if (!e.fires) dead.push(s);
    else if (e.fires < 3) weak.push(s);
    if (e.counterWorks === false) nocounter.push(s);
  }
  console.log('---');
  console.log('ELEMENTS DEFINED: ' + syms.length + ' (must be 28)');
  console.log('NEVER FIRED     : ' + (dead.length ? dead.join(' ') : 'none'));
  console.log('RARELY FIRED    : ' + (weak.length ? weak.join(' ') : 'none'));
  console.log('COUNTER BROKEN  : ' + (nocounter.length ? nocounter.join(' ') : 'none'));
  if (rep.notes) console.log('NOTES: ' + JSON.stringify(rep.notes));
  if (perr.length) { console.log('PAGE ERRORS:'); perr.slice(0, 8).forEach(e => console.log('  !! ' + e)); }
  const pass = syms.length === 28 && !dead.length && !nocounter.length && !perr.length;
  console.log(pass ? 'AUDIT: PASS' : 'AUDIT: FAIL');
  process.exit(pass ? 0 : 1);
})();
