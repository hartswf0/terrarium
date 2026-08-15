module.exports = async (page, shot, snap, L) => {
  const gate = async () => { const n = await page.locator('#gate.on button.gtBtn').count(); if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(350); return true; } return false; };
  await page.evaluate(() => window.__FZ.goto(7));
  await page.waitForTimeout(350); await gate();
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(250);
    const d = await page.evaluate(() => {
      const O = (window.FZ.outbreak.list || []).filter(o => o.state === 'burning');
      return { sym: O[0] && O[0].sym, kinds: [...document.querySelectorAll('#act button')].map(b => b.dataset.kind) };
    });
    if (d.sym === 'Sa' || d.sym === 'Cr') {
      console.log('SABOTAGE outbreak ' + d.sym + ' kinds=' + d.kinds);
      await shot('90sabotage'); await L('sabotage');
      await page.locator('#act button[data-kind=eject]').click({ timeout: 1500 }).catch(e => console.log('eject click fail'));
      await page.waitForTimeout(400);
      await shot('91ejectarmed'); await L('ejectarmed');
      const st = await page.evaluate(() => ({ armed: window.FZ.controls.armed, tag: document.getElementById('tagLayer').innerText.replace(/\s+/g, ' '), act: document.getElementById('act').innerText.replace(/\s+/g, ' ') }));
      console.log('ARMED STATE ' + JSON.stringify(st));
      break;
    }
    const n = await page.locator('#act button').count();
    if (n) await page.locator('#act button').nth(0).click({ timeout: 1000 }).catch(() => { });
  }
};
