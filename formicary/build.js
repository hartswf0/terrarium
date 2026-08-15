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

// ---- constraint gate ------------------------------------------------------
// Governed by formicary/AESTHETIC.md (CIVIC NATURALISM), which supersedes the original
// hard rules where they conflict. The border-radius ban is RETIRED: organic chambers,
// tunnels and paper cards are the point. The instrumentation register stays rectilinear,
// which is a rule of judgement and cannot be gated mechanically.
const errs = [];

// emoji / pictographic ranges — still banned, drawn marks only
const EMOJI = /[‼-㊙\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
if (EMOJI.test(out)) errs.push('emoji/pictographic character in output');

// Palette is split by register (AESTHETIC.md §2): MATERIAL is the world and never means
// anything; SIGNAL is the instrumentation and appears only when it means something.
const MATERIAL = ['#f5efe3', '#e9e0cd', '#e2d3b4', '#d3bf99', '#9d5130', '#82401f', '#6b3318', '#17150f', '#4a4335'];
const SIGNAL = ['#19e6c8', '#ffd23f', '#ff2e2e', '#3b82f6'];
const BASE = ['#000', '#fff', '#000000', '#ffffff'];
const ALLOWED = new Set([...MATERIAL, ...SIGNAL, ...BASE]);
const hexes = [...out.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase());
const bad = [...new Set(hexes.filter(h => !ALLOWED.has(h)))];
if (bad.length) errs.push('off-palette hex colors (see AESTHETIC.md §2): ' + bad.join(' '));
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
