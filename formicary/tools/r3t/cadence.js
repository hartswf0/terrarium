module.exports = async (page, shot, snap, L) => {
  const gate = async () => { const n = await page.locator('#gate.on button.gtBtn').count(); if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(300); return true; } return false; };
  for (const ch of [2, 6, 9]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(300); await gate();
    const t0 = Date.now(); const opens = [];
    await page.evaluate(() => { window.__opens = []; window.FZ.bus.on('outbreak:open', d => window.__opens.push(Date.now())); });
    for (let i = 0; i < 100; i++) {
      await page.waitForTimeout(150);
      if (await page.locator('#gate.on button.gtBtn').count()) break;
      const n = await page.locator('#act button').count();
      if (n) {
        // play WELL: pick the right kind
        const k = await page.evaluate(() => { const O = (window.FZ.outbreak.list || []).filter(o => o.state === 'burning'); if (!O.length) return null; const a = (window.FZ.ELBY[O[0].sym] || {}).answers || []; const b = [...document.querySelectorAll('#act button')].map(x => x.dataset.kind); return b.find(x => a.includes(x)) || null; });
        if (k) await page.locator('#act button[data-kind=' + k + ']').click({ timeout: 1000 }).catch(() => { });
      }
    }
    const o = await page.evaluate(() => window.__opens);
    const gaps = o.slice(1).map((t, i) => Math.round((t - o[i]) / 100) / 10);
    console.log('ch' + (ch + 1) + ' outbreaks in ' + Math.round((Date.now() - t0) / 1000) + 's: ' + o.length + '  gaps(s)=' + JSON.stringify(gaps));
  }
};
