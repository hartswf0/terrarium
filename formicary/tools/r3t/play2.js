module.exports = async (page, shot, snap, L) => {
  const clickGate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(500); return true; }
    return false;
  };
  await clickGate();            // BEGIN ch1
  await page.waitForTimeout(7000);
  await clickGate();            // NEXT after ch1
  await shot('20ch2gate');
  await L('ch2gate');
  await clickGate();            // BEGIN ch2
  // now play ch2: wait for outbreak, screenshot the tag+act, then answer
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    const s = await snap();
    if (s.outbreaks.length && s.outbreaks[0].state === 'burning') {
      console.log('T=' + (i * 400) + ' OUTBREAK ' + JSON.stringify(s.outbreaks) + ' TAG=' + JSON.stringify(s.tag) + ' ACT=' + JSON.stringify(s.act) + ' BTN=' + JSON.stringify(s.buttons));
      await shot('21ch2incident');
      break;
    }
  }
  await L('ch2burning');
  // answer it: click the tool button in #act
  const btns = await page.locator('#act button').count();
  console.log('ACT BUTTONS=' + btns);
  for (let i = 0; i < btns; i++) console.log('  btn' + i + ' = ' + JSON.stringify((await page.locator('#act button').nth(i).innerText()).replace(/\s+/g, ' ')));
  if (btns) {
    await page.locator('#act button').first().click();
    await page.waitForTimeout(300);
    await shot('22ch2answered');
    await L('ch2answered');
    await page.waitForTimeout(1200);
    await shot('23ch2after');
    await L('ch2after');
  }
};
