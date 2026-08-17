/* how many detector fires reach the incident layer, and how many become incidents */
const { chromium } = require('playwright');
function arg(k,d){const i=process.argv.indexOf('--'+k);return i>-1?process.argv[i+1]:d;}
(async () => {
  const ch=+arg('ch',9), secs=+arg('secs',60);
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  p.on('pageerror', e=>console.log('PERR',e.message));
  await p.goto('file:///home/user/terrarium/formicary.html',{waitUntil:'load'});
  await p.waitForTimeout(700);
  await p.evaluate(c=>window.__FZ.goto(c), ch);
  await p.waitForTimeout(400);
  try { await p.click('#gate button',{timeout:3000}); } catch(e){}
  await p.evaluate(()=>{ window.__F={}; window.__O=0; FZ.bus.on('fire',d=>{window.__F[d.sym]=(window.__F[d.sym]||0)+1;}); FZ.bus.on('outbreak:open',()=>{window.__O++;}); });
  await p.waitForTimeout(secs*1000);
  const r = await p.evaluate(()=>({fires:window.__F, opened:window.__O, tick:FZ.sim.state.tick, tools:FZ.sim.state.tools, cap:FZ.outbreak.cap}));
  const n = Object.values(r.fires).reduce((a,c)=>a+c,0);
  console.log('ticks',r.tick,'cap',r.cap,'tools',r.tools.join('/'));
  console.log('FIRES',n,JSON.stringify(r.fires));
  console.log('OPENED',r.opened);
  await b.close();
})();
