const { chromium } = require('playwright');
const path=require('path');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto('file:///home/user/terrarium/formicary.html',{waitUntil:'load'});
await p.waitForTimeout(800);
await p.evaluate(()=>window.__FZ.goto(2)); await p.waitForTimeout(300);
await p.locator('#gate .gtBtn').first().click().catch(()=>{});
for(let i=0;i<12;i++){
  await p.waitForTimeout(1500);
  const r = await p.evaluate(()=>{
    const tl=document.getElementById('tagLayer');
    return [...tl.children].map(c=>{const bb=c.getBoundingClientRect();return {id:c.id,cls:c.className,tag:c.tagName,vis:getComputedStyle(c).display+'/'+getComputedStyle(c).opacity,box:[Math.round(bb.x),Math.round(bb.y),Math.round(bb.width),Math.round(bb.height)],txt:(c.textContent||'').replace(/\s+/g,' ').trim().slice(0,60)};});
  });
  console.log(i+' '+JSON.stringify(r));
}
await b.close();})();
