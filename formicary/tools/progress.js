#!/usr/bin/env node
/* Renders formicary/progress.json -> progress.html (repo root). Static, self-contained,
   embeds screenshots as data URIs so it works over file:// and GitHub Pages alike. */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const ROOT = path.join(DIR, '..');
const st = JSON.parse(fs.readFileSync(path.join(DIR, 'progress.json'), 'utf8'));

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function img(rel) {
  if (!rel) return '';
  const p = path.join(DIR, 'shots', rel);
  if (!fs.existsSync(p)) return '';
  const b = fs.readFileSync(p);
  if (b.length > 900 * 1024) return '';
  return 'data:image/png;base64,' + b.toString('base64');
}
const VERDICT = { win: '#19e6c8', close: '#ffd23f', lose: '#ff2e2e', pending: '#3b82f6' };

const pieces = st.pieces.map(p => {
  const rounds = (p.rounds || []).slice().reverse().map(r => {
    const shots = (r.shots || []).map(s => {
      const d = img(s.file);
      return d ? `<figure><img src="${d}" alt="${esc(s.label)}"><figcaption>${esc(s.label)}</figcaption></figure>` : '';
    }).join('');
    return `<div class="round">
      <div class="rhead"><span class="rn">ROUND ${esc(r.n)}</span>
        <span class="verdict" style="border-color:${VERDICT[r.verdict] || '#3b82f6'};color:${VERDICT[r.verdict] || '#3b82f6'}">${esc((r.verdict || 'pending').toUpperCase())}</span>
        <span class="score">${r.score != null ? esc(r.score) + '/90' : ''}</span></div>
      ${r.built ? `<div class="lbl">BUILT</div><div class="body">${esc(r.built)}</div>` : ''}
      ${r.gap ? `<div class="lbl">BIGGEST REMAINING GAP</div><div class="body gap">${esc(r.gap)}</div>` : ''}
      ${r.laws ? `<div class="laws">${Object.entries(r.laws).map(([k, v]) => `<span class="law${v >= 8 ? ' ok' : ''}">${esc(k)} ${esc(v)}</span>`).join('')}</div>` : ''}
      ${shots ? `<div class="shots">${shots}</div>` : ''}
    </div>`;
  }).join('');
  const last = (p.rounds || [])[(p.rounds || []).length - 1] || {};
  return `<section class="piece">
    <h2><span class="pid">${esc(p.id)}</span> ${esc(p.name)}
      <span class="verdict" style="border-color:${VERDICT[last.verdict] || '#3b82f6'};color:${VERDICT[last.verdict] || '#3b82f6'}">${esc((last.verdict || 'pending').toUpperCase())}</span></h2>
    <p class="owns">${esc(p.owns)}</p>
    <p class="judged">JUDGED ON — ${esc(p.judged)}</p>
    ${rounds || '<div class="round"><div class="body">not started</div></div>'}
  </section>`;
}).join('');

const total = st.pieces.length;
const won = st.pieces.filter(p => (p.rounds || []).slice(-1)[0] && (p.rounds || []).slice(-1)[0].verdict === 'win').length;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FORMICARY — build progress</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;border-radius:0}
body{background:#fff;color:#000;font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.5;padding:16px;max-width:1100px;margin:0 auto}
h1{font-size:20px;letter-spacing:3px;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:6px}
.meta{font-size:11px;color:rgba(0,0,0,.6);margin-bottom:20px}
.tally{display:inline-block;border:2px solid #000;padding:4px 10px;font-weight:700;margin-right:8px}
.piece{border:2px solid #000;margin-bottom:18px}
h2{font-size:14px;letter-spacing:1.5px;padding:8px 10px;border-bottom:2px solid #000;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pid{border:2px solid #000;padding:1px 7px;font-weight:700}
.owns{font-size:11px;padding:6px 10px 2px;color:rgba(0,0,0,.65)}
.judged{font-size:11px;padding:0 10px 8px;border-bottom:1px solid rgba(0,0,0,.2)}
.round{padding:10px;border-bottom:1px solid rgba(0,0,0,.2)}
.rhead{display:flex;gap:10px;align-items:center;margin-bottom:6px;flex-wrap:wrap}
.rn{font-weight:700;letter-spacing:1px}
.score{font-size:11px;color:rgba(0,0,0,.6)}
.verdict{border:2px solid;padding:1px 8px;font-size:11px;font-weight:700;letter-spacing:1px}
.lbl{font-size:10px;letter-spacing:1.5px;margin-top:8px;color:rgba(0,0,0,.55)}
.body{font-size:12px;white-space:pre-wrap}
.gap{border-left:4px solid #ff2e2e;padding-left:8px}
.laws{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.law{border:1px solid #ff2e2e;color:#ff2e2e;padding:1px 6px;font-size:10px}
.law.ok{border-color:#19e6c8;color:#000;background:#19e6c8}
.shots{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:4px}
figure{flex:none;width:190px}
img{width:100%;border:1px solid #000;display:block}
figcaption{font-size:10px;padding-top:3px;color:rgba(0,0,0,.6)}
footer{font-size:11px;color:rgba(0,0,0,.55);margin-top:20px;border-top:1px solid #000;padding-top:8px}
</style></head><body>
<h1>FORMICARY — BUILD PROGRESS</h1>
<div class="meta">
  <span class="tally">${won} / ${total} PIECES WON</span>
  <span class="tally">ROUND ${esc(st.round || 1)}</span>
  updated ${esc(st.updated || '')}
</div>
<p class="meta">${esc(st.note || '')}</p>
${pieces}
<footer>Each piece is built by one sub-agent and judged by a separate critic with fresh context, which opens the real running build, scores it against the nine laws of The Evolution of Trust, and names the single biggest remaining gap. A piece is WON only when the critic honestly prefers ours.</footer>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'progress.html'), html);
console.log('progress.html written — ' + won + '/' + total + ' won, round ' + (st.round || 1));
