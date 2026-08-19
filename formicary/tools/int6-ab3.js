/* passage 5's controlled re-run: does the ONE variable change the outcome? */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const perr = [];
  for (const arm of ['A-no-vary','B-vary']) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', e => perr.push(arm+': '+e.message));
    await p.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
    await p.waitForTimeout(600);
    const r = await p.evaluate((useVary) => {
      const base = FZ.chapters.list[4].cfg;
      const cfg = {}; for (const k in base) cfg[k] = base[k];
      if (useVary) { cfg.tools = ['vary']; cfg.budget = 4; cfg.outbreakCap = 1; }
      let sf = 0; const fires = {};
      FZ.bus.on('fire', d => { if(!d||!d.sym)return; fires[d.sym]=(fires[d.sym]||0)+1; if(d.sym==='Sf') sf += (d.who&&d.who.length)||1; });
      FZ.sim.reset(cfg);
      const S = FZ.sim.state;
      const applies = [];
      for (let t = 0; t < 640; t++) {
        if (useVary && (t === 40 || t === 200 || t === 380)) {
          // put the seed where the bodies are, as a player would
          let cx = 0, cy = 0; S.agents.forEach(a=>{cx+=a.x;cy+=a.y;});
          applies.push(FZ.sim.apply('vary', cx/S.agents.length, cy/S.agents.length));
        }
        FZ.sim.step();
      }
      const hues = {}; S.agents.forEach(a => hues[a.hue]=(hues[a.hue]||0)+1);
      return { sf, applies, hues, budget: S.budget, jobs: S.jobsDone, fires };
    }, arm === 'B-vary');
    console.log(`${arm}: sfHit=${r.sf} jobs=${r.jobs} hues=${JSON.stringify(r.hues)} budget=${r.budget}`);
    console.log(`   applies ${JSON.stringify(r.applies)}`);
    console.log(`   fires ${JSON.stringify(r.fires)}`);
    await p.close();
  }
  console.log('PAGE ERRORS: ' + (perr.length||'none')); perr.slice(0,8).forEach(e=>console.log('  !! '+e));
  await browser.close();
})();
