module.exports = async (page, shot, snap, L) => {
  const gate = async () => {
    const n = await page.locator('#gate.on button.gtBtn').count();
    if (n) { await page.locator('#gate.on button.gtBtn').first().click(); await page.waitForTimeout(400); return true; }
    return false;
  };
  // how does the guide open? find the trigger
  await page.evaluate(() => window.__FZ.goto(2));
  await page.waitForTimeout(500);
  await gate();
  await page.waitForTimeout(1500);
  const marks = await page.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.offsetParent && /guide|mark|plate/i.test(e.className + ' ' + e.id)).map(e => ({ id: e.id, cls: e.className, r: e.getBoundingClientRect(), txt: (e.innerText || '').slice(0, 40) })));
  console.log('GUIDE TRIGGERS ' + JSON.stringify(marks));
  // click the collected-plate mark bottom-right
  const m = await page.locator('#fzMark, .fzmark, #guideMark').count();
  console.log('markcount ' + m);
  await page.evaluate(() => { const b = document.querySelector('[id*=mark i], [class*=mark i]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await shot('60guide'); await L('guide');
  const g = await page.evaluate(() => { const e = document.getElementById('guide'); return { cls: e.className, txt: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 900) }; });
  console.log('GUIDE ' + JSON.stringify(g));
};
