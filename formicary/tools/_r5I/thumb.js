/* THUMB ERROR test: arm a targeted instrument, place it far from the incident. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k, d) { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; }
(async () => {
  const CH = +arg('ch', 1), NAME = arg('name', 'r5I-thumb'), N = +arg('n', 4);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(c => window.__FZ.goto(c), CH);
  await page.waitForTimeout(500);
  try { const b = await page.$('#gate button'); if (b) await b.click(); } catch (e) { }
  await page.waitForTimeout(400);
  const field = await page.$('#field');
  let done = 0, shots = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 45000 && done < N) {
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => {
      const L = (FZ.outbreak && FZ.outbreak.list) || [];
      const b = L.filter(x => x.state === 'burning')[0];
      if (!b) return null;
      const S = FZ.sim.state;
      if (S.tick - b.born < 70) return null;
      return { x: b.x, y: b.y, r: b.r, sym: b.sym, budget: S.budget, w: S.w, h: S.h, ans: b.answers, tools: S.tools };
    });
    if (!o) continue;
    const kind = o.ans.filter(a => o.tools.indexOf(a) > -1)[0];
    if (!kind || ['slow', 'lens', 'ledger'].indexOf(kind) > -1) { console.log('untargeted', kind); break; }
    const btn = await page.$('[data-kind="' + kind + '"]');
    if (!btn) { console.log('no button for', kind); break; }
    await btn.click(); await page.waitForTimeout(150);
    // place it as far from the incident as the field allows
    const fx = o.x < o.w / 2 ? o.w - 24 : 24;
    const fy = o.y < o.h / 2 ? o.h - 30 : 30;
    const box = await field.boundingBox();
    const sx = box.width / o.w, sy = box.height / o.h;
    await page.mouse.click(box.x + fx * sx, box.y + fy * sy);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      budget: FZ.sim.state.budget, armed: FZ.controls.armed,
      act: (document.querySelector('#act') || {}).textContent,
      tags: document.querySelectorAll('#tagLayer > *').length,
      gameOver: FZ.sim.state.gameOver
    }));
    console.log('#' + (++done), 'sym', o.sym, 'tool', kind, 'budgetBefore', o.budget, '-> after', after.budget,
      '| stillArmed', after.armed, '| gameOver', after.gameOver, '| act:', JSON.stringify((after.act || '').slice(0, 120)));
    if (shots < 2) await page.screenshot({ path: path.join(SHOTS, NAME + '-' + (++shots) + '.png') });
  }
  console.log('ERRORS', perr.length ? perr : 'none');
  await browser.close();
})();
