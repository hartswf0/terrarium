module.exports = async (page, shot, snap, L) => {
  const gate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(350); return true; }
    return false;
  };
  const rows = [];
  for (const ch of [1, 2, 3, 5, 6, 7, 8, 9]) {
    await page.evaluate(c => window.__FZ.goto(c), ch);
    await page.waitForTimeout(350); await gate();
    const seen = new Set();
    for (let i = 0; i < 110; i++) {
      await page.waitForTimeout(200);
      const d = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#act button')].map(b => b.dataset.kind);
        const O = (window.FZ.outbreak && window.FZ.outbreak.list || []).filter(o => o.state === 'burning');
        return { btns, obs: O.map(o => ({ sym: o.sym, ans: (window.FZ.ELBY[o.sym] || {}).answers })) };
      });
      if (d.btns.length && d.obs.length) {
        const key = d.obs[0].sym + '|' + d.btns.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          const right = d.btns.filter(k => (d.obs[0].ans || []).includes(k));
          rows.push({ ch: ch + 1, sym: d.obs[0].sym, offered: d.btns, right, nRight: right.length, n: d.btns.length });
        }
      }
      // answer with a right one to keep the game going
      const n2 = await page.locator('#act button').count();
      if (n2) await page.locator('#act button').first().click({ timeout: 1200 }).catch(() => { });
      if (await page.locator('#gate.on button.gtBtn').count()) break;
    }
  }
  console.log('DECISIONS');
  rows.forEach(r => console.log('  ch' + r.ch + ' ' + r.sym + ' offered=[' + r.offered + '] right=[' + r.right + '] ' + r.nRight + '/' + r.n));
  const trivial = rows.filter(r => r.nRight === r.n);
  console.log('TRIVIAL (every offered button is correct): ' + trivial.length + ' / ' + rows.length);
};
