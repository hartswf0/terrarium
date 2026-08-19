const { chromium } = require('playwright');
const path = require('path');
const ROOT='/home/user/terrarium', SHOTS=path.join(ROOT,'formicary/shots');
const CH=+(process.argv[2]||2), PFX=process.argv[3]||'r6W';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const page=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'});
  await page.waitForTimeout(700);
  await page.evaluate(i=>window.__FZ.goto(i),CH); await page.waitForTimeout(300);
  await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
  let n=0;
  for(let i=0;i<60 && n<3;i++){
    await page.waitForTimeout(500);
    const on=await page.evaluate(()=>getComputedStyle(document.getElementById('act')).display!=='none');
    if(on){ await page.screenshot({path:path.join(SHOTS,`${PFX}-c${CH}-act${n}.png`)});
      await page.screenshot({path:path.join(SHOTS,`${PFX}-c${CH}-actbot${n}.png`), clip:{x:0,y:660,width:390,height:184}});
      n++; await page.waitForTimeout(2500); }
  }
  console.log('shots',n);
  await b.close();
})();
