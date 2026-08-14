/* ============================================================
   80-chapters.js — THE TEACHING SEQUENCE.  OWNER: CHAPTERS.
   FZ.chapters = { list, start(i), next(), retry(), index }

   Law 1 is the spine of this file: the player is never looking at a control, a cell
   or a readout they have not been taught. Tools arrive one at a time; the table is
   absent in chapter 0 and fills in a chapter at a time; each status readout appears
   in the chapter that earns it.

   The `enabled` set is curated per chapter through cfg.chapter + cfg.teach, so no
   failure is ever live before the instrument that answers it exists. (reset() enables
   everything with el.chapter <= cfg.chapter, union cfg.teach.)

   Every sentence here comes from FZ.copy. This file invents no English.
   ============================================================ */
window.FZ = window.FZ || {};

FZ.chapters = (function () {
  'use strict';

  var ALL6 = ['charter', 'vary', 'slow', 'lens', 'ledger', 'eject'];

  /* ---------------------------------------------------------------- scenarios
     One config per chapter. Chapter 4 has two: the same seed, twice, with one
     difference between them. */
  var CFG = [

    /* 0 — THE COLONY. no tools, no table, no failures. just read the field. */
    { id: 'ch0', chapter: 0, teach: [], tools: [], table: false,
      seed: 101, speed: 1, budget: 0, collapseMax: Infinity, outbreakCap: 0,
      agents: { n: 4, hues: [0, 1, 2] },
      jobs: { n: 2, max: 2, value: 5, spawnEvery: 130 },
      goal: { jobs: 4 }, force: {} },

    /* 1 — TWO AT ONCE. the first failure, and nothing you can do about it yet.
       The table itself arrives the moment the first failure is named — play first,
       name second, and the vocabulary appears as a receipt for what you just saw. */
    { id: 'ch1', chapter: 1, tools: [], table: false, tableOnFire: true,
      seed: 202, speed: 1, budget: 0, collapseMax: Infinity, outbreakCap: 0,
      agents: { n: 8, hues: [0, 1] },
      jobs: { n: 3, max: 3, value: 5, spawnEvery: 220 },
      goal: { jobs: 4 }, force: { coordination: true, pairEvery: 150 } },

    /* 2 — THE CHARTER. the first institution. Co Mc In Ow Lo, all answered by it. */
    { id: 'ch2', chapter: 2, tools: ['charter'], table: true,
      seed: 303, speed: 1, budget: 9, collapseMax: Infinity, outbreakCap: 1,
      agents: { n: 10, hues: [0, 1] },
      jobs: { n: 4, max: 4, value: 5, spawnEvery: 240 },
      goal: { jobs: 5 },
      force: { coordination: true, pairEvery: 170, lock: true, lockN: 2, overload: true } },

    /* 3 — THE STAMPEDE. conformity feeds flooding; the brake is the answer. */
    { id: 'ch3', chapter: 2, teach: ['Cf', 'Fl'], tools: ['slow', 'charter'], table: true,
      seed: 404, speed: 1, budget: 8, collapseMax: Infinity, outbreakCap: 1,
      agents: { n: 14, hues: [0, 1] },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 200 },
      goal: { jobs: 5 }, force: { stampede: true } },

    /* 4a — ONE FAMILY, run one. one lineage, one blind spot, no instruments. */
    { id: 'ch4', chapter: 0, teach: ['Mo', 'Lv', 'Sf'], tools: [], table: true,
      seed: 505, speed: 1, budget: 0, collapseMax: Infinity, outbreakCap: 0,
      agents: { n: 12 },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 260 },
      goal: { survive: 1050 },
      force: { monoculture: true, poison: true, poisonN: 2 } },

    /* 5 — THE LIAR. memory. */
    { id: 'ch5', chapter: 0, teach: ['Gu', 'Tc', 'Rp', 'Cs', 'Co', 'Mc', 'In'],
      tools: ['ledger', 'charter'], table: true,
      seed: 606, speed: 1, budget: 7, collapseMax: 140, outbreakCap: 1,
      agents: { n: 12, hues: [0, 1, 2] },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 280 },
      goal: { jobs: 5 },
      force: { rumor: true, lieEvery: 340, poison: true, coordination: true, pairEvery: 280 } },

    /* 6 — THE DARK. legibility. */
    { id: 'ch6', chapter: 0, teach: ['Mm', 'Hi', 'Di', 'Si', 'Co', 'Mc', 'In'],
      tools: ['lens', 'charter'], table: true,
      seed: 707, speed: 1, budget: 7, collapseMax: 140, outbreakCap: 1,
      agents: { n: 12, hues: [0, 1, 2] },
      jobs: { n: 6, max: 6, value: 5, spawnEvery: 240 },
      goal: { jobs: 5 },
      force: { silo: true, hidden: true, poison: true, dark: true, coordination: true, pairEvery: 240 } },

    /* 7 — THE SPOIL-SPORT. the last resort. opens with the lens already lit. */
    { id: 'ch7', chapter: 0, teach: ['Sa', 'Cr', 'Tw', 'Es', 'Cl', 'Lo', 'Co', 'In'],
      tools: ['eject', 'lens', 'slow', 'charter'], table: true, openLens: true,
      seed: 808, speed: 1, budget: 9, collapseMax: 140, outbreakCap: 1,
      agents: { n: 12, hues: [0, 1, 2] },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 240 },
      goal: { jobs: 5 },
      force: { saboteur: true, advN: 1, incorrigible: true, incN: 1, rivals: true, rivalN: 2,
               churn: true, lock: true, lockN: 1 } },

    /* 8 — MACHINE SPEED. everything learned so far, accelerating. */
    { id: 'ch8', chapter: 0,
      teach: ['Sp', 'Dp', 'My', 'Pt', 'Im', 'Cf', 'Fl', 'Co', 'Mc', 'In', 'Lo'],
      tools: ['slow', 'charter', 'lens', 'vary'], table: true,
      seed: 909, speed: 1, budget: 10, collapseMax: 120, outbreakCap: 2,
      agents: { n: 14, hues: [0, 1, 2] },
      jobs: { n: 6, max: 6, value: 5, spawnEvery: 180 },
      goal: { jobs: 8 },
      force: { speed: true, speedmax: 2.6, speedrate: 700, dependency: true, myopia: true,
               stampede: true, coordination: true, pairEvery: 200 } },

    /* 9 — THE FORMICARY. all twenty-eight, all six, 117 jobs. */
    { id: 'ch9', chapter: 9, all: true, tools: ALL6.slice(), table: true,
      seed: 1117, speed: 1.15, budget: 8, collapseMax: 100, outbreakCap: 3,
      agents: { n: 16, hues: [0, 0, 0, 0, 0, 0, 0, 1] },
      jobs: { n: 8, max: 9, value: 5, spawnEvery: 40 },
      goal: { jobs: 117 },
      force: {
        coordination: true, pairEvery: 230, stampede: true, poison: true, poisonN: 2,
        rumor: true, lieEvery: 520, saboteur: true, advN: 1, lock: true, lockN: 2,
        dependency: true, silo: true, hidden: true, overload: true,
        rivals: true, rivalN: 2, incorrigible: true, incN: 1, myopia: true, churn: true,
        speed: true, speedmax: 2.2, speedrate: 4200, dark: true, drift: true,
      } },
  ];

  /* 4b — the re-run. Identical seed, identical poison, identical length.
     The one difference is that VARY exists. */
  var CFG4B = (function () {
    var a = CFG[4], b = {};
    for (var k in a) b[k] = a[k];
    b.tools = ['vary'];
    b.budget = 4;
    b.outbreakCap = 1;
    return b;
  })();

  /* ------------------------------------------------------------------- state */
  var idx = 0, run = 0, phase = 'gate';
  var beats = [], queue = [], shownAt = 0, cur = null, pending = null, pendAt = 0;
  var abFires = [0, 0];              /* chapter 4: how hot Sf got, run 1 vs run 2 */
  var used = {};                     /* tools spent this run */
  var sfHit = 0;                     /* workers taken down by Sf this run */
  var counteredEver = {};
  var wired = false, built = false;
  var app = null, gate = null, sayEl = null, rail = null, titleEl = null, countEl = null, strip = null, aboutEl = null;
  var stripCells = null;
  var api;

  function C(i) { return (FZ.copy.chapters && FZ.copy.chapters[i]) || {}; }
  function ui(k) { return (FZ.copy.ui && FZ.copy.ui[k]) || ''; }
  function cfgFor(i, r) { return (i === 4 && r === 1) ? CFG4B : CFG[i]; }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* --------------------------------------------------------------- narrator */
  function enqueue(text, tone) {
    if (!text) return;
    if (cur && cur.text === text) return;
    for (var i = 0; i < queue.length; i++) if (queue[i].text === text) return;
    queue.push({ text: text, tone: tone || 'plain' });
  }
  function drain() {
    if (!queue.length || !sayEl) return;
    var now = performance.now();
    var hold = queue.length > 2 ? 1500 : 2600;
    if (cur && now - shownAt < hold) return;
    cur = queue.shift();
    shownAt = now;
    sayEl.textContent = cur.text;
    sayEl.setAttribute('data-tone', cur.tone);
    sayEl.classList.remove('in'); void sayEl.offsetWidth; sayEl.classList.add('in');
  }

  /* ------------------------------------------------------------------ beats */
  function loadBeats(i) {
    var src = C(i).beats || [];
    beats = src.map(function (b) { return { at: b.at, text: b.text, tone: b.tone, used: false, headAt: null }; });
    evc = {};
    queue.length = 0; cur = null; shownAt = 0;
    if (sayEl) { sayEl.textContent = ''; sayEl.removeAttribute('data-tone'); }
  }
  /* Beats are a script, not a set of independent triggers: only the next unspoken line
     can fire, so a line that assumes the one before it can never arrive first.
     Events (a detector firing, a tool being spent) are RECORDED rather than matched
     on the spot, so a beat still gets its trigger if it was not yet the head when the
     thing happened. A head beat whose trigger never comes at all is dropped after SKIP
     ticks, so the narrator can never go permanently silent. */
  var SKIP = 500;
  var evc = {};                      /* recorded, unconsumed triggers */

  function record(key) { evc[key] = (evc[key] || 0) + 1; pump(); }

  function match(at, S) {
    if (at === 'start') return 'start';
    if (!at || typeof at !== 'object') return false;
    if (at.tick != null) return S.tick >= at.tick;
    if (at.jobs != null) return S.jobsDone >= at.jobs;
    if (at.fire) return evc['fire:' + at.fire] > 0 ? 'fire:' + at.fire : false;
    if (at.tool) return evc['tool:' + at.tool] > 0 ? 'tool:' + at.tool : false;
    return false;
  }

  function pump() {
    var S = FZ.sim.state;
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i];
      if (b.used) continue;
      if (b.headAt == null) b.headAt = S.tick;
      var m = match(b.at, S);
      if (m) {
        b.used = true;
        if (typeof m === 'string' && evc[m]) evc[m]--;
        FZ.bus.emit('say', { text: b.text, tone: b.tone });
        return true;
      }
      if (S.tick - b.headAt < SKIP) return false;
      /* Overdue — but only drop it if it is actually blocking a line that could speak
         now. A trigger that is merely slow still gets to arrive. */
      var blocking = false;
      for (var j = i + 1; j < beats.length; j++) {
        if (!beats[j].used && match(beats[j].at, S)) { blocking = true; break; }
      }
      if (!blocking) return false;
      b.used = true;
    }
    return false;
  }

  /* ------------------------------------------------------------------- chrome */
  function buildChrome() {
    if (built) return;
    app = document.getElementById('app');
    gate = document.getElementById('gate');
    sayEl = document.getElementById('say');
    rail = document.getElementById('progressRail');
    titleEl = document.getElementById('chapTitle');
    countEl = document.getElementById('chapCount');
    strip = document.getElementById('statusStrip');
    aboutEl = document.getElementById('about');

    /* header: title + count + the about affordance, not front-loaded */
    var hdr = document.getElementById('hdr');
    if (hdr && titleEl && countEl && !document.getElementById('aboutBtn')) {
      var row = el('div', 'hrow');
      hdr.insertBefore(row, hdr.firstChild);
      row.appendChild(titleEl); row.appendChild(countEl);
      var ab = el('button', null, ui('about'));
      ab.id = 'aboutBtn'; ab.type = 'button';
      ab.addEventListener('click', function (e) { e.preventDefault(); openAbout(); });
      row.appendChild(ab);
    }

    if (rail && !rail.children.length) {
      for (var i = 0; i < CFG.length; i++) rail.appendChild(el('span', 'pg'));
    }

    if (strip && !strip.children.length) {
      stripCells = {};
      ['jobs', 'budget', 'collapse', 'speed'].forEach(function (k) {
        var c = el('div', 'st');
        c.appendChild(el('span', 'lb', ui(k)));
        if (k === 'collapse') {
          var m = el('span', 'mtr'); m.appendChild(el('i')); c.appendChild(m);
        }
        c.appendChild(el('b', null, ''));
        strip.appendChild(c);
        stripCells[k] = c;
      });
    }
    buildAbout();
    built = true;
  }

  function railTo(i) {
    if (!rail) return;
    for (var k = 0; k < rail.children.length; k++) {
      var n = rail.children[k];
      n.classList.toggle('done', k < i);
      n.classList.toggle('cur', k === i);
    }
  }

  /* ------------------------------------------------------------------- gates */
  function showGate(build, tone) {
    if (!gate) return;
    gate.textContent = '';
    build(gate);
    gate.className = 'on' + (tone ? ' ' + tone : '');
  }
  function hideGate() { if (gate) gate.classList.remove('on'); }

  function gateBtn(label, fn, alt) {
    var b = el('button', 'gtBtn' + (alt ? ' alt' : ''), label);
    b.type = 'button';
    b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
    return b;
  }

  function head(box, i, card) {
    var inn = el('div', 'gtIn' + (card ? ' card' : ''));
    if (card) {
      var w = el('div', 'gtWord');
      w.appendChild(el('div', 'wm', ui('title')));
      w.appendChild(el('div', 'wt', ui('tagline')));
      inn.appendChild(w);
    }
    inn.appendChild(el('div', 'gtNum', FZ.copy.ui.chapterOf(i + 1, CFG.length)));
    inn.appendChild(el('div', 'gtTitle', C(i).title || ''));
    inn.appendChild(el('div', 'gtSub', C(i).sub || ''));
    box.appendChild(inn);
    return inn;
  }

  function openGate(i) {
    phase = 'gate';
    showGate(function (box) {
      head(box, i, i === 0);
      box.appendChild(gateBtn(ui('begin'), function () { begin(i, 0); }));
    });
  }

  function learnBlock(inn, i) {
    inn.appendChild(el('div', 'gtHead', ui('learned')));
    inn.appendChild(el('div', 'gtBody', C(i).learn || ''));
  }

  function winGate(i) {
    phase = 'result';
    showGate(function (box) {
      var inn = head(box, i);
      inn.appendChild(el('div', 'gtWin', C(i).win || ''));
      learnBlock(inn, i);
      box.appendChild(gateBtn(ui('next'), function () { api.next(); }));
    }, 'good');
  }

  /* chapter 4, between the two runs and after them */
  function rerunGate() {
    phase = 'result';
    showGate(function (box) {
      var inn = head(box, 4);
      inn.appendChild(el('div', 'gtWin', C(4).win || ''));
      box.appendChild(gateBtn(ui('again'), function () { begin(4, 1); }));
    }, 'good');
  }
  /* one row per run: how hot Sf got, on the same heat scale the table has been
     showing all game. Same seed, same poison, one difference. */
  function abRow(n, sym, val, isB, scale) {
    var r = el('div', 'abr' + (isB ? ' b' : ''));
    r.appendChild(el('span', 'abn', String(n)));
    var e = FZ.ELBY ? FZ.ELBY[sym] : null;
    var g = el('span', 'abg');
    if (e && e.glyph) g.innerHTML = e.glyph;
    r.appendChild(g);
    r.appendChild(el('span', 'abs', sym));
    var bar = el('span', 'abb');
    var fill = el('i');
    fill.style.width = Math.max(0, Math.min(100, Math.round(val / (scale || 1) * 100))) + '%';
    bar.appendChild(fill);
    r.appendChild(bar);
    r.appendChild(el('span', 'abv', String(val)));
    return r;
  }
  function afterGate() {
    phase = 'result';
    showGate(function (box) {
      var inn = head(box, 4);
      var rr = C(4).rerun || {};
      inn.appendChild(el('div', 'gtWin', rr.after || ''));
      var ab = el('div', 'gtAB');
      var sc = Math.max(1, abFires[0], abFires[1]);
      ab.appendChild(abRow(1, 'Sf', abFires[0], false, sc));
      ab.appendChild(abRow(2, 'Sf', abFires[1], true, sc));
      inn.appendChild(ab);
      learnBlock(inn, 4);
      box.appendChild(gateBtn(ui('next'), function () { api.next(); }));
    }, 'good');
  }

  /* losing is information, not punishment: it names what killed you and re-runs */
  function loseGate(why) {
    phase = 'result';
    showGate(function (box) {
      var inn = head(box, idx);
      var sen = (FZ.copy.fire && FZ.copy.fire[why]) || '';
      inn.appendChild(el('div', 'gtWin', sen));
      box.appendChild(gateBtn(ui('retry'), function () { begin(idx, run); }));
    }, 'bad');
  }

  /* ------------------------------------------------------------------ ending */
  function postmortem(inn) {
    var live = [];
    for (var i = 0; i < FZ.EL.length; i++) {
      var e = FZ.EL[i];
      if (!FZ.sim.enabled.has(e.sym) || !e.fires) continue;
      live.push(e);
    }
    live.sort(function (a, b) { return b.fires - a.fires; });
    if (live.length) {
      inn.appendChild(el('div', 'gtHead', (FZ.copy.end && FZ.copy.end.postTitle) || ''));
      var l1 = el('div', 'gtList');
      live.slice(0, 5).forEach(function (e) { l1.appendChild(pmRow(e, e.fires)); });
      inn.appendChild(l1);
    }
    var never = live.filter(function (e) { return !counteredEver[e.sym]; });
    var same = never.slice(0, 5).every(function (e, k) { return live[k] === e; });
    if (never.length && !(same && never.length <= 5)) {
      inn.appendChild(el('div', 'gtHead', (FZ.copy.end && FZ.copy.end.unusedTitle) || ''));
      var l2 = el('div', 'gtList');
      never.slice(0, 5).forEach(function (e) { l2.appendChild(pmRow(e, e.fires)); });
      inn.appendChild(l2);
    }
  }
  function pmRow(e, v) {
    var r = el('div', 'pmr');
    var g = el('span', 'pmg');
    if (e.glyph) g.innerHTML = e.glyph;
    r.appendChild(g);
    r.appendChild(el('span', 'pms', e.sym));
    r.appendChild(el('span', 'pmn', e.nm || ''));
    r.appendChild(el('span', 'pmv', String(v)));
    return r;
  }
  function endGate(won) {
    phase = 'result';
    var E = FZ.copy.end || {};
    showGate(function (box) {
      var inn = el('div', 'gtIn');
      inn.appendChild(el('div', 'gtNum', FZ.copy.ui.chapterOf(CFG.length, CFG.length)));
      inn.appendChild(el('div', 'gtTitle', won ? (E.wonTitle || '') : (E.lostTitle || '')));
      inn.appendChild(el('div', 'gtSub', ui('tagline')));
      inn.appendChild(el('div', 'gtWin', won ? (E.wonBody || '') : (E.lostBody || '')));
      postmortem(inn);
      box.appendChild(inn);
      box.appendChild(gateBtn(E.again || ui('again'), function () { begin(9, 0); }));
      box.appendChild(gateBtn(ui('about'), function () { openAbout(); }, true));
    }, won ? 'good' : 'bad');
  }

  /* ------------------------------------------------------------------- about */
  function buildAbout() {
    if (!aboutEl || aboutEl.children.length) return;
    var A = FZ.copy.about || {};
    var inn = el('div', 'abIn');
    inn.appendChild(el('h1', null, ui('title')));
    inn.appendChild(el('div', 'abTag', ui('tagline')));
    (A.body || []).forEach(function (pair) {
      inn.appendChild(el('h2', null, pair[0]));
      inn.appendChild(el('p', null, pair[1]));
    });
    aboutEl.appendChild(inn);
    var b = el('button', 'gtBtn', ui('close'));
    b.type = 'button';
    b.addEventListener('click', function (e) { e.preventDefault(); aboutEl.classList.remove('on'); });
    aboutEl.appendChild(b);
  }
  function openAbout() { buildAbout(); if (aboutEl) aboutEl.classList.add('on'); }

  /* -------------------------------------------------------------- status strip */
  function stripFor(cfg) {
    if (!stripCells) return;
    show(stripCells.jobs, true);
    show(stripCells.budget, (cfg.tools || []).length > 0);
    show(stripCells.collapse, cfg.collapseMax !== Infinity);
    show(stripCells.speed, !!(cfg.force && cfg.force.speed));
  }
  function show(n, on) { if (n) n.style.display = on ? '' : 'none'; }

  function paintStrip(S) {
    if (!stripCells) return;
    var b;
    b = stripCells.jobs.lastChild;
    b.textContent = S.jobsGoal ? (S.jobsDone + '/' + S.jobsGoal) : String(S.jobsDone);
    b = stripCells.budget.lastChild;
    b.textContent = String(S.budget);
    if (stripCells.collapse.style.display !== 'none') {
      var f = Math.max(0, Math.min(1, S.collapse / (S.collapseMax || 100)));
      stripCells.collapse.querySelector('.mtr i').style.width = Math.round(f * 100) + '%';
      stripCells.collapse.classList.toggle('hot', f > 0.66);
      stripCells.collapse.lastChild.textContent = String(Math.round(f * 100));
    }
    if (stripCells.speed.style.display !== 'none') {
      stripCells.speed.lastChild.textContent = (S.tempo || S.speedMul || 1).toFixed(1);
      stripCells.speed.classList.toggle('fast', (S.tempo || 1) > 1.6);
    }
  }

  /* --------------------------------------------------------------- lifecycle */
  function wire() {
    if (wired) return;
    wired = true;
    FZ.bus.on('say', function (d) { if (d) enqueue(d.text, d.tone); });
    FZ.bus.on('fire', function (d) {
      if (!d || phase !== 'play') return;
      /* chapter 4 counts the bodies: how many workers one synchronized failure takes
         down at once is the whole difference between the two runs. */
      if (idx === 4 && d.sym === 'Sf') sfHit += (d.who && d.who.length) || 1;
      if (app && cfgFor(idx, run).tableOnFire) app.classList.remove('noTable');
      record('fire:' + d.sym);
    });
    FZ.bus.on('intervene', function (d) {
      if (!d || !d.ok) return;
      if (d.kind) used[d.kind] = (used[d.kind] || 0) + 1;
      if (phase === 'play') record('tool:' + d.kind);
    });
    FZ.bus.on('goal', function () { if (phase === 'play') won(); });
    FZ.bus.on('lose', function (d) { if (phase === 'play') lost(d && d.why); });
  }

  function begin(i, r) {
    buildChrome();
    wire();
    idx = i; run = r || 0;
    var cfg = cfgFor(i, run);

    pending = null;
    used = {};
    sfHit = 0;
    counteredEver = {};
    FZ.sim.reset(cfg);
    if (FZ.table) { FZ.table.close && FZ.table.close(); FZ.table.setEnabled(FZ.sim.enabled); }
    if (FZ.controls) FZ.controls.setAvailable(cfg.tools || []);
    if (FZ.outbreak && FZ.outbreak.reset) FZ.outbreak.reset(cfg);

    if (app) {
      app.classList.toggle('noTable', cfg.table === false);
      app.classList.toggle('noBar', !(cfg.tools || []).length);
    }
    if (titleEl) titleEl.textContent = C(i).title || '';
    if (countEl) countEl.textContent = FZ.copy.ui.chapterOf(i + 1, CFG.length);
    railTo(i);
    stripFor(cfg);

    loadBeats(i);
    hideGate();
    phase = 'play';

    /* chapter 7 opens with the lens already lit — the copy assumes you can see */
    if (cfg.openLens) FZ.sim.apply('lens');

    FZ.bus.emit('chapter:enter', { index: i, cfg: cfg });

    /* the re-run speaks its own opening line: same colony, one difference */
    if (i === 4 && run === 1) {
      var rr = C(4).rerun || {};
      FZ.bus.emit('say', { text: rr.intro || '', tone: 'name' });
    }
    pump();
    drain();
  }

  /* a gate never cuts the narrator off mid-thought: the world freezes on the deciding
     frame, the remaining lines are spoken, then the card comes up. */
  function after(fn) { pending = fn; pendAt = performance.now(); }

  function won() {
    phase = 'result';
    record('win');
    if (idx === 4) {
      abFires[run] = sfHit;
      after(run === 0 ? rerunGate : afterGate);
      return;
    }
    if (idx >= CFG.length - 1) { after(function () { endGate(true); }); return; }
    after(function () { winGate(idx); });
  }

  function lost(why) {
    phase = 'result';
    record('lose');
    if (idx >= CFG.length - 1) { after(function () { endGate(false); }); return; }
    after(function () { loseGate(why || 'In'); });
  }

  api = {
    list: CFG.map(function (c, i) { return { cfg: c, script: (C(i).beats || []) }; }),
    index: 0,
    phase: function () { return phase; },

    start: function (i) {
      buildChrome();
      wire();
      i = Math.max(0, Math.min(CFG.length - 1, i | 0));
      idx = i; run = 0; api.index = i;
      pending = null;
      var cfg = CFG[i];
      /* the gate is shown over a world that is already correct behind it */
      FZ.sim.reset(cfg);
      if (FZ.table) FZ.table.setEnabled(FZ.sim.enabled);
      if (FZ.controls) FZ.controls.setAvailable([]);
      if (app) {
        app.classList.toggle('noTable', cfg.table === false);
        app.classList.toggle('noBar', true);
      }
      if (titleEl) titleEl.textContent = C(i).title || '';
      if (countEl) countEl.textContent = FZ.copy.ui.chapterOf(i + 1, CFG.length);
      railTo(i);
      stripFor(cfg);
      openGate(i);
    },

    next: function () {
      if (idx >= CFG.length - 1) { api.start(idx); return; }
      api.start(idx + 1);
    },
    retry: function () { begin(idx, run); },

    /* called once per frame by the boot loop, after the sim has stepped */
    update: function (S) {
      api.index = idx;
      if (built) paintStrip(S);
      if (phase === 'play') {
        pump();
        /* the re-run only teaches if the one difference actually gets spent */
        if (idx === 4 && run === 1 && !used.vary && S.tick === 320) {
          FZ.bus.emit('say', { text: (C(4).rerun || {}).intro || '', tone: 'name' });
        }
        for (var i = 0; i < FZ.EL.length; i++) {
          var e = FZ.EL[i];
          if (e.countered && FZ.sim.enabled.has(e.sym)) counteredEver[e.sym] = 1;
        }
      }
      drain();
      if (pending) {
        var now = performance.now();
        var quiet = !queue.length && now - shownAt > 1500;
        if (quiet || now - pendAt > 6000) { var f = pending; pending = null; f(); }
      }
    },
  };
  return api;
})();
