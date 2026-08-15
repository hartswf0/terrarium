module.exports = async (page, shot, snap, L) => {
  const gate = async (label) => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { const t = await page.locator('#gate.on button.gtBtn').first().innerText(); await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(500); console.log('CLICKED GATE BTN ' + JSON.stringify(t)); return t; }
    return null;
  };
  await page.evaluate(() => window.__FZ.goto(4));
  await page.waitForTimeout(600);
  await shot('50abgate'); await L('abgate');
  await gate();  // BEGIN run 1
  // run 1 lasts survive:640 ticks
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(400);
    const s = await snap();
    if (s.gate) break;
    if (i === 8) { await shot('51run1mid'); await L('run1mid'); }
  }
  await shot('52rerungate'); await L('rerungate');
  await gate();  // AGAIN -> run 2
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(400);
    const s = await snap();
    if (s.gate) break;
    if (i === 6) { await shot('53run2mid'); await L('run2mid'); }
    const b = await page.locator('#act button').count();
    if (b) { await page.locator('#act button').first().click(); console.log('answered run2'); }
  }
  await shot('54aftergate'); await L('aftergate');
};
