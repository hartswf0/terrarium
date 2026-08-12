// SINGLE FILE — TERRARIUM.html, the whole program as one artifact you can
// double-click. Build it the way it attaches: the file must carry everything
// the served app fetches — the stylesheet, every module, and the shipped
// worlds — because file:// has neither a server nor a fetch for local JSON.
//
//   node tools/single-file.mjs            → ../TERRARIUM.html (repo root)
//
// What goes in:
//   app.css                    → inlined <style>
//   places/*.json              → window.__SHIPPED_PLACES__ (imported.js reads
//                                this before it ever tries the network)
//   src/ui/app.js (bundled)    → one inline <script type="module">
//
// What stays out, honestly: the AI operator's API calls and OSM imports still
// need a network — they degrade gracefully, exactly as they do when offline.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'TERRARIUM.html');

// 1 · bundle every module into one script (esm keeps top-level await legal)
const bundle = join(root, 'tools', '.bundle.js');
// node:fs / node:zlib are the test-suite's and importer's node-side paths —
// the browser never calls them, so they stay external rather than bundled
execSync(`npx esbuild "${join(root, 'src/ui/app.js')}" --bundle --format=esm --outfile="${bundle}"`
  + ' --external:node:fs --external:node:zlib --log-level=warning', { stdio: 'inherit' });
const js = readFileSync(bundle, 'utf8');

// 2 · the shipped worlds, as the loader expects them
const placesDir = join(root, 'places');
const index = JSON.parse(readFileSync(join(placesDir, 'index.json'), 'utf8'));
const worlds = {};
for (const f of readdirSync(placesDir)) {
  if (f === 'index.json' || !f.endsWith('.json')) continue;
  worlds[f.replace(/\.json$/, '')] = readFileSync(join(placesDir, f), 'utf8');
}
const shipped = JSON.stringify({ index, worlds });

// 3 · assemble around the real index.html so the chrome never drifts
let html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'app.css'), 'utf8');
// Payloads go in via REPLACEMENT FUNCTIONS, never replacement strings: a
// string replacement interprets $& and friends, and this bundle genuinely
// contains "\\$&" (escapeRe) — which re-inserted the matched <script> tag into
// the middle of the code and ended the element four megabytes early.
html = html.replace('<title>CREO</title>', () => '<title>TERRARIUM</title>');
html = html.replace(/<link rel="stylesheet" href="app.css">/,
  () => '<style>\n' + css + '\n</style>');
// </script> or <!-- inside embedded JSON or code would end or derail the tag;
// the standard escapes keep the parser out without changing what JS sees
const arm = (s) => s.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
html = html.replace(/<script type="module" src="src\/ui\/app.js"><\/script>/,
  () => '<script>window.__SHIPPED_PLACES__ = ' + arm(shipped) + ';</script>\n'
  + '<script type="module">\n' + arm(js) + '\n</script>');

writeFileSync(out, html);
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`TERRARIUM.html — ${mb(html.length)} (code ${mb(js.length)}, worlds ${mb(shipped.length)}, ${Object.keys(worlds).length} places)`);
