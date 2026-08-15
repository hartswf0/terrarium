module.exports = async (page, shot, snap, L) => {
  const gate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(400); return true; }
    return false;
  };
  // ch4 THE STAMPEDE has slow + charter -> deliberately pick the wrong one
  await page.evaluate(() => window.__FZ.goto(3));
  await page.waitForTimeout(400); await gate();
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250);
    const n = await page.locator('#act button').count();
    if (n >= 1) {
      const labs = [];
      for (let k = 0; k < n; k++) labs.push((await page.locator('#act button').nth(k).innerText()).replace(/\s+/g, ' '));
      console.log('ACT OPTIONS ' + JSON.stringify(labs));
      await shot('70stampede'); await L('stampede');
      // pick the LAST option (likely the wrong one)
      await page.locator('#act button').nth(0).click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(400);
      await shot('71wrong'); await L('wrong');
      const t = await page.evaluate(() => ({ tag: document.getElementById('tagLayer').innerText.replace(/\s+/g, ' '), act: document.getElementById('act').innerText.replace(/\s+/g, ' ') }));
      console.log('AFTER WRONG ' + JSON.stringify(t));
      await page.waitForTimeout(1400); await shot('72wrong2');
      break;
    }
  }
};
