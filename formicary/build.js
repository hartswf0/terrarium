#!/usr/bin/env node
/* FORMICARY build — concatenates src parts into a single self-contained formicary.html.
   Purely mechanical. Never edit formicary.html directly; edit formicary/src/*. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, '..', 'formicary.html');

const ORDER = [
  ['00-head.html', 'raw'],
  ['10-style.css', 'css'],
  ['15-body.html', 'raw'],
  ['20-copy.js', 'js'],
  ['30-elements.js', 'js'],
  ['40-sim.js', 'js'],
  ['45-outbreak.js', 'js'],
  ['50-render.js', 'js'],
  ['60-table.js', 'js'],
  ['70-controls.js', 'js'],
  ['80-chapters.js', 'js'],
  ['90-boot.js', 'js'],
  ['99-tail.html', 'raw'],
];

let out = '';
for (const [file, kind] of ORDER) {
  const p = path.join(SRC, file);
  if (!fs.existsSync(p)) { console.error('MISSING PART: ' + file); process.exit(1); }
  const body = fs.readFileSync(p, 'utf8');
  if (kind === 'css') out += '<style>\n/* ===== ' + file + ' ===== */\n' + body + '\n</style>\n';
  else if (kind === 'js') out += '<script>\n/* ===== ' + file + ' ===== */\n' + body + '\n</' + 'script>\n';
  else out += body + '\n';
}

// ---- hard-constraint gate -------------------------------------------------
const errs = [];
if (/border-radius/i.test(out)) errs.push('border-radius appears in output');
// emoji / pictographic ranges
const EMOJI = /[‼-㊙\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
if (EMOJI.test(out)) errs.push('emoji/pictographic character in output');
const hexes = [...out.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase());
const ALLOWED = new Set(['#000', '#fff', '#000000', '#ffffff', '#19e6c8', '#ffd23f', '#ff2e2e', '#3b82f6']);
const bad = [...new Set(hexes.filter(h => !ALLOWED.has(h)))];
if (bad.length) errs.push('off-palette hex colors: ' + bad.join(' '));
if (/\b(hsl|hsla)\(/i.test(out)) errs.push('hsl() color found — palette must be literal');
if (!/IBM\+Plex\+Mono|IBM Plex Mono/.test(out)) errs.push('IBM Plex Mono missing');

fs.writeFileSync(OUT, out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
if (errs.length) {
  console.error('BUILD WROTE ' + OUT + ' (' + kb + ' KB) BUT VIOLATES CONSTRAINTS:');
  errs.forEach(e => console.error('  X ' + e));
  process.exit(2);
}
console.log('BUILD OK -> ' + OUT + ' (' + kb + ' KB)');
