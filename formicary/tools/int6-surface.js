/* is there ALWAYS an answerable surface while an incident burns past its tag delay? */
const { chromium } = require('playwright');
const path = require('path');
const ROOT='/home/user/terrarium';
const CH=+(process.argv[2]||2), MS=+(process.argv[3]||60000);
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const perr=[]; page.on('pageerror',e=>perr.push(e.message));
  await page.goto('file://'+path.join(ROOT,'formicary.html'),{waitUntil:'load'}); await page.waitForTimeout(700);
  await page.evaluate(c=>window.__FZ.goto(c),CH); await page.waitForTimeout(250);
  await page.locator('#gate button.gtBtn').first().click();
  await page.evaluate(()=>{
    window.__S={samples:0,burning:0,noSurface:0,noTag:0,worst:null};
    const tick=()=>{
      const S=FZ.sim.state, L=FZ.outbreak.list||[];
      const b=L.filter(o=>o.state==='burning' && S.tick-o.born>60);
      window.__S.samples++;
      if(b.length){
        window.__S.burning++;
        const kinds=[...document.querySelectorAll('#act button[data-kind]')].map(x=>x.getAttribute('data-kind'));
        const can=b.some(o=>o.answers.some(k=>kinds.indexOf(k)>-1));
        const tag=[...document.querySelectorAll('#tagLayer .fztag.on')].length;
        if(!can){ window.__S.noSurface++; if(!window.__S.worst) window.__S.worst={sym:b[0].sym,answers:b[0].answers,kinds,age:S.tick-b[0].born}; }
        if(!tag) window.__S.noTag++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(MS);
  console.log('ch'+CH+' '+JSON.stringify(await page.evaluate(()=>window.__S)));
  console.log('PAGE ERRORS: '+(perr.length||'none'));
  await browser.close();
})();
