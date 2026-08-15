module.exports = async (page, shot, snap, L) => {
  const gate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { const t = await page.locator('#gate.on button.gtBtn').first().innerText(); await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(500); return t; }
    return null;
  };
  // ch2: let a fuse EXPIRE to see damage land
  await gate(); await page.waitForTimeout(7000); await gate(); await gate();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(300);
    const s = await snap();
    if (s.outbreaks.length && s.outbreaks[0].state === 'landed') { console.log('LANDED at ' + i * 300); break; }
  }
  await shot('40landed'); await L('landed');
  await page.waitForTimeout(1200); await shot('41afterlanded'); await L('afterlanded');
  // now finish ch2 by answering everything until gate
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250);
    const g = await page.locator('#gate.on button.gtBtn').count();
    if (g) { const s = await snap(); console.log('CH2 GATE: ' + JSON.stringify(s.gate)); await shot('42ch2gate'); break; }
    const b = await page.locator('#act button').count();
    if (b) { await page.locator('#act button').first().click(); }
  }
};
