/* r6W: film a chapter — screenshot every N ms while recording DOM message-count. */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = '/home/user/terrarium';
const SHOTS = path.join(ROOT, 'formicary/shots');
const CH = +(process.argv[2] || 2);
const N = +(process.argv[3] || 16);
const EVERY = +(process.argv[4] || 900);
const PREFIX = process.argv[5] || 'r6W';
const AUTOPLAY = process.argv[6] === 'play';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const perr = []; page.on('pageerror', e => perr.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'formicary.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(i => window.__FZ.goto(i), CH);
  await page.waitForTimeout(400);
  await page.locator('#gate button.gtBtn').first().click().catch(()=>{});
  const box = await page.locator('#field').boundingBox();
  for (let i = 0; i < N; i++) {
    if (AUTOPLAY) {
      const st = await page.evaluate(() => {
        const S = FZ.sim.state; const l = (FZ.outbreak.list||[]).filter(o=>o.state==='burning');
        const b = l[0]; const avail=[...document.querySelectorAll('#act button[data-kind]')].map(x=>x.getAttribute('data-kind'));
        return { b: b?{x:b.x,y:b.y,answers:b.answers}:null, avail, bud:S.budget };
      });
      if (st.b) { const k = st.b.answers.find(x=>st.avail.includes(x));
        if (k) { await page.locator(`#act button[data-kind="${k}"]`).first().click().catch(()=>{});
                 await page.mouse.click(box.x+st.b.x, box.y+st.b.y).catch(()=>{}); } }
    }
    const info = await page.evaluate(() => {
      const S = FZ.sim.state;
      const act = document.getElementById('act');
      const tags = [...document.querySelectorAll('#tagLayer *')].filter(e=>e.offsetParent!==null && (e.textContent||'').trim()).map(e=>(e.textContent||'').trim().slice(0,70));
      const burning = (FZ.outbreak.list||[]).filter(o=>o.state==='burning').map(o=>({s:o.sym,left:o.born+o.fuse-S.tick}));
      // count visible text blocks anywhere
      return { tick:S.tick, jd:S.jobsDone, jg:S.jobsGoal, bud:S.budget, col:Math.round(S.collapse),
        actVisible: !!(act && act.offsetParent!==null), actTxt: act?(act.textContent||'').replace(/\s+/g,' ').trim().slice(0,110):'',
        tags, burning, spd:S.speedMul, agents:S.agents.length };
    });
    const p = path.join(SHOTS, `${PREFIX}-c${CH}-f${String(i).padStart(2,'0')}.png`);
    await page.screenshot({path:p});
    console.log(i, JSON.stringify(info));
    await page.waitForTimeout(EVERY);
  }
  console.log('PERR', perr.slice(0,3));
  await browser.close();
})();
