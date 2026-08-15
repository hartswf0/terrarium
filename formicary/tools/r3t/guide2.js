module.exports = async (page, shot, snap, L) => {
  const gate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(400); return true; }
    return false;
  };
  await page.evaluate(() => window.__FZ.goto(2));
  await page.waitForTimeout(400); await gate();
  // answer everything for a while to build mastery, then open guide when nothing burns
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(250);
    if (await page.locator('#gate.on button.gtBtn').count()) break;
    const b = await page.locator('#act button').count();
    if (b) await page.locator('#act button').first().click({ timeout: 1500 }).catch(() => {});
  }
  const mk = await page.evaluate(() => { const b = document.querySelector('[id*=mark i], [class*=mark i]'); return b ? { id: b.id, cls: b.className, r: b.getBoundingClientRect(), t: b.innerText } : null; });
  console.log('MARK ' + JSON.stringify(mk));
  await shot('61ch3gate');
  await page.evaluate(() => { const b = document.querySelector('[id*=mark i], [class*=mark i]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await shot('62guideopen');
  const g = await page.evaluate(() => { const e = document.getElementById('guide'); return { cls: e.className }; });
  console.log('GUIDE ' + JSON.stringify(g));
  // try clicking a drawn plate
  const n = await page.locator('#guide .pl.dr').count();
  console.log('DRAWN PLATES ' + n);
  if (n) { await page.locator('#guide .pl.dr').first().click(); await page.waitForTimeout(400); await shot('63plate'); }
};
