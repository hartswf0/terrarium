const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  await page.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'});
  await page.waitForTimeout(700);
  await page.evaluate(()=>window.__FZ.goto(2)); await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
  for (let i=0;i<24;i++){
    await page.waitForTimeout(700);
    const r = await page.evaluate(()=>{
      const a=document.getElementById('act'); const t=document.getElementById('tagLayer');
      const rb=a.getBoundingClientRect(); const cs=getComputedStyle(a);
      const bt=a.querySelector('button');
      return { cls:a.className, rect:[Math.round(rb.x),Math.round(rb.y),Math.round(rb.width),Math.round(rb.height)],
        disp:cs.display, op:cs.opacity, vis:cs.visibility, tf:cs.transform, z:cs.zIndex, pos:cs.position,
        btnRect: bt? (()=>{const q=bt.getBoundingClientRect(); return [Math.round(q.x),Math.round(q.y),Math.round(q.width),Math.round(q.height)];})():null,
        txt:(a.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),
        burning:(FZ.outbreak.list||[]).filter(o=>o.state==='burning').length };
    });
    console.log(i, JSON.stringify(r));
  }
  await b.close();
})();
