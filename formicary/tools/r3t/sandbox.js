module.exports = async (page, shot, snap, L) => {
  const gate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(350); return true; }
    return false;
  };
  await page.evaluate(() => window.__FZ.goto(8));
  await page.waitForTimeout(350); await gate();
  for (let i = 0; i < 50; i++) { await page.waitForTimeout(250); if (i === 20) { await shot('80ch9speed'); await L('ch9'); } const n = await page.locator('#act button').count(); if (n) await page.locator('#act button').nth(0).click({ timeout: 1200 }).catch(() => { }); }
  await shot('81ch9late'); await L('ch9late');
  // sandbox
  await page.evaluate(() => window.__FZ.goto(9));
  await page.waitForTimeout(350);
  await shot('82sandboxgate'); await L('sandboxgate');
  await gate();
  await page.waitForTimeout(3000);
  await shot('83sandbox'); await L('sandbox');
  const hit = await page.evaluate(() => [...document.querySelectorAll('#act button,#aboutBtn,#guideMark,#gate button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.id).replace(/\s+/g, ' ').slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; }));
  console.log('HIT TARGETS ' + JSON.stringify(hit));
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); const n = await page.locator('#act button').count(); if (n) await page.locator('#act button').nth(0).click({ timeout: 1000 }).catch(() => { }); }
  await shot('84sandboxlate'); await L('sandboxlate');
};
