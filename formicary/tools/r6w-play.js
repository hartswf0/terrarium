/* r6W critic harness: play chapters as a competent player, log density/idle-gaps, shoot. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CH = process.argv[2] ? process.argv[2].split(',').map(Number) : [0];
const BUDGET = +(process.argv[3] || 90000);
const PREFIX = process.argv[4] || 'r6W';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = [], cerr = [];
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  for (const c of CH) {
    await page.evaluate(i => window.__FZ.goto(i), c);
    await page.waitForTimeout(400);
    await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
    await page.waitForTimeout(400);
    const t0 = Date.now();
    let answered=0, missed=0, wrong=0, outcome='timeout', gateTxt='';
    let lastEventT = Date.now(); let maxGap = 0; const gaps=[];
    let shots = 0;
    const box = await page.locator('#field').boundingBox();
    let prevAnswered = 0;
    while (Date.now() - t0 < BUDGET) {
      const st = await page.evaluate(() => {
        const S = FZ.sim.state;
        const g = document.getElementById('gate');
        const list = (FZ.outbreak && FZ.outbreak.list) || [];
        const burn = list.filter(o=>o.state==='burning').sort((a,b)=>(a.born+a.fuse)-(b.born+b.fuse))[0];
        const avail = [...document.querySelectorAll('#act button[data-kind]')].map(b=>b.getAttribute('data-kind'));
        const act = document.getElementById('act');
        const tags = [...document.querySelectorAll('#tagLayer .tag')].map(t=>(t.textContent||'').trim().slice(0,60));
        let tot=0; for (const k in FZ.outbreak.mastery) tot += (FZ.outbreak.mastery[k].answered||0);
        let mis=0; for (const k in FZ.outbreak.mastery) mis += (FZ.outbreak.mastery[k].missed||0);
        return { phase: FZ.chapters.phase(), gateOn: g.classList.contains('on'),
          gateTxt: (g.textContent||'').trim().slice(0,200),
          jd:S.jobsDone, jg:S.jobsGoal, bud:S.budget, col:Math.round(S.collapse), tick:S.tick,
          spd:S.speedMul,
          burn: burn?{sym:burn.sym,x:burn.x,y:burn.y,r:burn.r,answers:burn.answers,left:(burn.born+burn.fuse-S.tick)}:null,
          nBurn: list.filter(o=>o.state==='burning').length,
          avail, actOn: !!act && act.classList.contains('on'),
          actTxt: act? (act.textContent||'').trim().slice(0,120):'',
          tags, totAns: tot, totMiss: mis };
      });
      if (st.gateOn) { outcome='gate'; gateTxt=st.gateTxt; break; }
      if (st.burn) {
        const gap = Date.now()-lastEventT; if (gap>maxGap) maxGap=gap; gaps.push(gap); lastEventT=Date.now();
        if (shots < 2) { await page.screenshot({path: path.join(SHOTS, `${PREFIX}-ch${c}-burn${shots}.png`)}); shots++; }
        const kind = st.burn.answers.find(k=>st.avail.includes(k));
        if (kind) {
          const cost = await page.evaluate(k=>FZ.sim.cost(k), kind);
          if (st.bud >= cost) {
            await page.locator(`#act button[data-kind="${kind}"]`).first().click().catch(()=>{});
            await page.mouse.click(box.x + st.burn.x*box.width/st.jg*0 + st.burn.x, box.y + st.burn.y).catch(()=>{});
            await page.waitForTimeout(120);
            const after = await page.evaluate(()=>{ let t=0; for(const k in FZ.outbreak.mastery) t+=(FZ.outbreak.mastery[k].answered||0); return t; });
            if (after > st.totAns) { answered++;
              if (answered<=2) { await page.waitForTimeout(300); await page.screenshot({path: path.join(SHOTS, `${PREFIX}-ch${c}-after${answered}.png`)}); }
            }
          }
        }
      }
      await page.waitForTimeout(150);
    }
    const fin = await page.evaluate(()=>{ const S=FZ.sim.state; let a=0,m=0; for(const k in FZ.outbreak.mastery){a+=FZ.outbreak.mastery[k].answered||0;m+=FZ.outbreak.mastery[k].missed||0;}
      return {jd:S.jobsDone,jg:S.jobsGoal,col:Math.round(S.collapse),tick:S.tick,bud:S.budget,a,m,won:S.won,over:S.gameOver}; });
    console.log(`CH${c} outcome=${outcome} answered=${answered} maxIdleGapMs=${maxGap} fin=${JSON.stringify(fin)} gate=${JSON.stringify(gateTxt)}`);
  }
  console.log('PERR', perr.slice(0,5)); console.log('CERR', cerr.slice(0,5));
  await browser.close();
})();
