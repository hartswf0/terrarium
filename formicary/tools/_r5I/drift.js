const { chromium } = require('playwright');
const path=require('path');const ROOT='/home/user/terrarium';
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function arg(k,d){const i=process.argv.indexOf('--'+k);return i>-1?process.argv[i+1]:d;}
(async()=>{
 const CH=+arg('ch',9), MS=+arg('ms',40000);
 const b=await chromium.launch({executablePath:CHROME});
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await p.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'});
 await p.waitForTimeout(800);
 await p.evaluate(c=>window.__FZ.goto(c),CH); await p.waitForTimeout(500);
 try{const g=await p.$('#gate button'); if(g) await g.click();}catch(e){}
 await p.evaluate(()=>{ window.__D={}; window.__DI=setInterval(()=>{
   (FZ.outbreak.list||[]).filter(o=>o.state==='burning').forEach(o=>{
     const d=window.__D[o.id]=window.__D[o.id]||{sym:o.sym,pts:[]};
     d.pts.push([Math.round(o.x),Math.round(o.y),Math.round(o.r)]);
   });},100);});
 await p.waitForTimeout(MS);
 const D=await p.evaluate(()=>{clearInterval(window.__DI);return window.__D;});
 // drift over any 700ms window (7 samples) = the arm-then-tap gap
 const rows=[];
 Object.keys(D).forEach(id=>{const d=D[id];const pts=d.pts;let worst=0,worstFrac=0;
  for(let i=0;i+7<pts.length;i++){const a=pts[i],c=pts[i+7];
   const dd=Math.hypot(a[0]-c[0],a[1]-c[1]); if(dd>worst){worst=dd;worstFrac=dd/a[2];}}
  // also total travel start->end
  const tot = pts.length>1?Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1]):0;
  rows.push({sym:d.sym,samples:pts.length,r:pts[0][2],maxDrift700ms:Math.round(worst),fracOfR:+worstFrac.toFixed(2),totalTravel:Math.round(tot)});
 });
 console.table(rows);
 await b.close();
})();
