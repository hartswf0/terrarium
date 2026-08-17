/* Integrator DOM contract checks: one message region, no codes in play surfaces,
   overlap detection in the crown, guide lockout during a burning incident. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const ch = +arg('ch', 2), ms = +arg('ms', 20000);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [];
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(n => window.__FZ.goto(n), ch);
  await page.waitForTimeout(300);
  const gb = page.locator('#gate .gtBtn').first();
  if (await gb.count()) await gb.click().catch(() => { });
  await page.waitForTimeout(500);

  const t0 = Date.now();
  const bad = { multiTag: 0, codeInPlay: [], overlaps: [], guideDuringBurn: 0, offscreen: [] };
  let samples = 0;
  while (Date.now() - t0 < ms) {
    const r = await page.evaluate(() => {
      const out = { tags: 0, codes: [], boxes: [], burning: 0, guideOpen: false, off: [] };
      const tl = document.getElementById('tagLayer');
      out.tags = tl ? tl.children.length : 0;
      const CODES = (window.FZ && FZ.EL) ? FZ.EL.map(e => e.sym) : [];
      ['world', 'tagLayer', 'act'].forEach(id => {
        const n = document.getElementById(id); if (!n) return;
        const t = (n.textContent || '');
        CODES.forEach(c => { if (new RegExp('(^|[^A-Za-z])' + c + '([^A-Za-z]|$)').test(t)) out.codes.push(id + ':' + c); });
      });
      out.burning = (FZ.outbreak && FZ.outbreak.list || []).filter(o => o.state === 'burning').length;
      const g = document.getElementById('guide');
      out.guideOpen = !!g && (g.classList.contains('on') || getComputedStyle(g).display !== 'none') && g.offsetHeight > 0;
      // crown geometry: every visible child box, plus any fixed top-right button
      const sel = '#crown *, #guideBtn, [id*=guide i][class*=btn i], #aboutBtn';
      const seen = new Set();
      document.querySelectorAll(sel).forEach(el => {
        if (!el.textContent && !el.querySelector('svg')) return;
        const b = el.getBoundingClientRect();
        if (b.width < 4 || b.height < 4) return;
        const key = (el.id || el.className) + '';
        if (seen.has(key)) return; seen.add(key);
        out.boxes.push({ k: key, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), txt: (el.textContent || '').trim().slice(0, 18) });
        if (b.right > window.innerWidth + 0.5 || b.left < -0.5) out.off.push(key + ' right=' + Math.round(b.right));
      });
      return out;
    });
    samples++;
    if (r.tags > 1) bad.multiTag++;
    r.codes.forEach(c => { if (!bad.codeInPlay.includes(c)) bad.codeInPlay.push(c); });
    if (r.guideOpen && r.burning > 0) bad.guideDuringBurn++;
    r.off.forEach(o => { if (!bad.offscreen.includes(o)) bad.offscreen.push(o); });
    // pairwise overlap among leaf crown boxes
    for (let i = 0; i < r.boxes.length; i++) for (let j = i + 1; j < r.boxes.length; j++) {
      const a = r.boxes[i], b = r.boxes[j];
      if (a.k.includes('hdr') || b.k.includes('hdr') || a.k.includes('crown') || b.k.includes('crown')) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 2 && oy > 2) {
        const key = a.k + ' ^ ' + b.k + ' [' + a.txt + '|' + b.txt + ']';
        if (!bad.overlaps.includes(key)) bad.overlaps.push(key);
      }
    }
    if (samples === 1) console.log('CROWN BOXES ' + JSON.stringify(r.boxes));
    await page.waitForTimeout(300);
  }
  console.log('CH' + ch + ' samples=' + samples + ' ' + JSON.stringify(bad, null, 1));
  console.log('PAGE ERRORS: ' + (perr.length ? perr.join(' | ') : 'none'));
  await browser.close();
})();
