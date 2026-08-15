module.exports = async (page, shot, snap, L) => {
  const gate = async () => { const n = await page.locator('#gate.on button.gtBtn').count(); if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(300); return true; } return false; };
  await page.evaluate(() => window.__FZ.goto(6));   // ch7 THE DARK: lens + charter
  await page.waitForTimeout(300); await gate();
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => {
      const O = (window.FZ.outbreak.list || []).filter(o => o.state === 'burning');
      const b = [...document.querySelectorAll('#act button')].map(x => x.dataset.kind);
      if (!O.length || !b.length) return null;
      const a = (window.FZ.ELBY[O[0].sym] || {}).answers || [];
      return { sym: O[0].sym, wrong: b.find(x => !a.includes(x)), right: b.find(x => a.includes(x)) };
    });
    if (d && d.wrong) {
      console.log('OUTBREAK ' + d.sym + ' — deliberately using WRONG tool ' + d.wrong);
      await shot('a0before'); await L('before');
      await page.locator('#act button[data-kind=' + d.wrong + ']').click({ timeout: 1500 }).catch(() => { });
      await page.waitForTimeout(350);
      await shot('a1wrongmsg'); await L('wrongmsg');
      console.log('AFTER ' + JSON.stringify(await page.evaluate(() => ({ tag: document.getElementById('tagLayer').innerText.replace(/\s+/g, ' '), act: document.getElementById('act').innerText.replace(/\s+/g, ' '), ob: (window.FZ.outbreak.list || []).map(o => o.sym + ':' + o.state) }))));
      await page.waitForTimeout(1500); await shot('a2wrongmsg2');
      console.log('AFTER2 ' + JSON.stringify(await page.evaluate(() => ({ tag: document.getElementById('tagLayer').innerText.replace(/\s+/g, ' '), act: document.getElementById('act').innerText.replace(/\s+/g, ' ') }))));
      break;
    }
    const n = await page.locator('#act button').count();
    if (n) await page.locator('#act button').nth(0).click({ timeout: 1000 }).catch(() => { });
  }
};
