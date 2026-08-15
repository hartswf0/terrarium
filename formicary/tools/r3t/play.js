module.exports = async (page, shot, snap, L) => {
  // ch1 gate
  await L('gate1');
  await page.click('#gate button');
  await page.waitForTimeout(6500);
  await L('ch1-end');
  await shot('10ch1gate');
  // whatever gate is up now
  let s = await snap();
  if (s.gate) { await page.click('#gate button'); await page.waitForTimeout(400); }
  await L('ch2-start');
  // TWO AT ONCE: watch for outbreak
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(600);
    s = await snap();
    if (s.outbreaks.length || s.act) { console.log('INCIDENT at t=' + (i * 600 + 600)); break; }
  }
  await L('ch2-incident');
  await shot('11ch2incident');
  await page.waitForTimeout(900);
  await shot('12ch2incident2');
  await L('ch2-incident2');
};
