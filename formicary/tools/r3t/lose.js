module.exports = async (page, shot, snap, L) => {
  const t0 = Date.now();
  // timing: first paint -> first sim-affecting decision, playing straight through as a human would
  const gate = async () => { const n = await page.locator('#gate.on button.gtBtn').count(); if (n) { await page.locator('#gate.on button.gtBtn').first().click(); return true; } return false; };
  console.log('t=0 page loaded, gate showing');
  await gate(); console.log('BEGIN tapped at t=' + (Date.now() - t0));
  let firstAct = null;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(150);
    if (await page.locator('#act button').count()) { firstAct = Date.now() - t0; break; }
    if (await page.locator('#gate.on button.gtBtn').count()) { const txt = await page.locator('#gate.on').innerText(); console.log('  gate at t=' + (Date.now() - t0) + ': ' + txt.replace(/\s+/g, ' ').slice(0, 70)); await page.waitForTimeout(1800); await gate(); }
  }
  console.log('FIRST ACTIONABLE DECISION at t=' + firstAct + 'ms (with 1.8s of reading per gate card)');
  // now go lose the sandbox
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(300); await gate();
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(200);
    const s = await snap();
    if (s.gate) { console.log('END GATE ' + JSON.stringify(s.gate).slice(0, 700)); await shot('95losegate'); break; }
  }
};
