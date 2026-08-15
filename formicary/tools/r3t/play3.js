module.exports = async (page, shot, snap, L) => {
  const clickGate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(500); return true; }
    return false;
  };
  await clickGate(); await page.waitForTimeout(7000); await clickGate(); await clickGate();
  // ch2 playing
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(300);
    const s = await snap();
    if (s.act) { console.log('ACT APPEARED at ' + (i * 300) + 'ms into ch2: ' + JSON.stringify(s.act) + ' TAG=' + JSON.stringify(s.tag)); break; }
  }
  await shot('30ch2decision');
  await L('ch2decision');
  const dump = await page.evaluate(() => ({
    actHTML: document.getElementById('act').innerHTML.slice(0, 1200),
    tagHTML: document.getElementById('tagLayer').innerHTML.slice(0, 800),
    actBtns: [...document.querySelectorAll('#act button')].map(b => ({ t: b.innerText.replace(/\s+/g, ' '), r: b.getBoundingClientRect() })),
  }));
  console.log('DUMP ' + JSON.stringify(dump, null, 1).slice(0, 2500));
  // answer
  if (dump.actBtns.length) {
    await page.locator('#act button').first().click();
    await page.waitForTimeout(250); await shot('31answered'); await L('answered');
    await page.waitForTimeout(1500); await shot('32after'); await L('after');
  }
};
