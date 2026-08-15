/* ============================================================
   80-chapters.js — THE PASSAGES.  OWNER: CHAPTERS.
   FZ.chapters = { list, start(i), next(), retry(), index, phase(), update(S) }

   Ten passages in a colony's life. Each is a setup card, a short piece of play, and
   a naming card. Nothing else. Three rules govern every line of this file:

   HANDS ON THE COLONY, FAST.  The old opening asked a stranger to watch for forty
   seconds before anything was tappable. That is the moment a stranger checks whether
   they can skip. THE COLONY is now four or five seconds long — one pass of the store
   wall filling, and out. TWO AT ONCE hands over the meeting stone the instant the
   first double claim catches, which is inside two seconds of BEGIN. From the first
   tap to the player's first real decision is now about six seconds, not forty.

   ONE IDEA AT A TIME.  The enabled set is curated per passage. TWO AT ONCE runs on
   chapter 0 plus teach:['Co'] — exactly ONE of the twenty-eight is live, so the only
   thing that can happen is the thing the passage is about. THE MEETING STONE then
   widens to the whole coordination family under that same single instrument, which
   is a different idea: one institution answers many failures.

   PLAY FIRST, NAME SECOND, AND THE GATE IS WHERE THE NAMING HAPPENS.  During play
   there is no taxonomy anywhere — the tag names a phenomenon, and that is all
   (AESTHETIC §6, CONTRACT §12.3). The moment the passage ends, this file stamps the
   phenomena the player actually witnessed with their drawn mark, their two-letter
   code and their formal name, counts how many times each was seen, and rules the
   plate teal where the player answered it and red where it landed. Then the research.
   The code is a receipt for something the player already owns.

   Every sentence here comes from FZ.copy. This file invents no English; it renders
   marks, numerals and codes, which are instrumentation.

   DELETED THIS ROUND: the whole narrator apparatus — the beat script, the queue, the
   drain, the #say strip, the six-second hold that waited for lines that no longer
   exist before it would show a gate. VOICE emptied `beats` when the narrator strip
   was abolished; this file now stops pretending to have one. There is one message
   region and CONTROLS owns it.
   ============================================================ */
window.FZ = window.FZ || {};

FZ.chapters = (function () {
  'use strict';

  var ALL6 = ['charter', 'vary', 'slow', 'lens', 'ledger', 'eject'];

  /* ---------------------------------------------------------------- scenarios
     One config per passage. Passage 5 has two: the same seed, twice, with exactly
     one difference between them. */
  var CFG = [

    /* 1 — THE COLONY.  No failures, no instruments, no reading. Four crumbs into the
       store wall and out, in about five seconds. This passage exists so the player
       knows what a crumb and a store socket ARE before anything breaks one; it is a
       held breath, not a chapter, and it must not outstay that. */
    { id: 'ch0', chapter: 0, teach: [], tools: [], table: false,
      seed: 101, speed: 1, budget: 0, collapseMax: Infinity, outbreakCap: 0,
      agents: { n: 8, hues: [0, 1, 2] },
      jobs: { n: 4, max: 4, value: 2, spawnEvery: 45 },
      goal: { jobs: 4 }, force: {} },

    /* 2 — TWO AT ONCE.  ONE element is live in the entire simulation: Co. A worker can
       now claim from anywhere, so two of them start the same crumb from opposite ends,
       and the sim guarantees the first pair at tick 40 — under a second. The meeting
       stone comes with it, because a decision the player cannot answer is not a
       decision, and because the fastest way to teach the verb of this whole game
       (put the instrument where the trouble is) is to let them do it immediately.
       Budget 4 is one stone and no slack: a right answer is refunded, a wrong place
       is not, and there is always another double claim coming. */
    { id: 'ch1', chapter: 0, teach: ['Co'], tools: ['charter'], table: false,
      seed: 202, speed: 1, budget: 4, collapseMax: Infinity, outbreakCap: 1,
      agents: { n: 7, hues: [0, 1] },
      jobs: { n: 3, max: 3, value: 9, spawnEvery: 150 },
      goal: { jobs: 3 }, force: { coordination: true, pairEvery: 140 } },

    /* 3 — THE MEETING STONE.  The same one instrument, now against the whole
       coordination family: Co Mc Ow Lo In. The new idea is not the arch, it is that
       one institution answers five different failures — and that the ground was
       empty before you built it. */
    { id: 'ch2', chapter: 2, tools: ['charter'], table: true,
      seed: 303, speed: 1, budget: 9, collapseMax: Infinity, outbreakCap: 1,
      agents: { n: 11, hues: [0, 1] },
      jobs: { n: 4, max: 4, value: 5, spawnEvery: 200 },
      goal: { jobs: 4 },
      force: { coordination: true, pairEvery: 130, lock: true, lockN: 2, overload: true } },

    /* 4 — THE STAMPEDE. Conformity feeds flooding; the brake is the answer. Narrowed to
       exactly those two elements — with the whole coordination family still live the
       arch kept answering first and the passage never taught its own lesson. */
    { id: 'ch3', chapter: 0, teach: ['Cf', 'Fl'], tools: ['slow', 'charter'], table: true,
      seed: 404, speed: 1, budget: 8, collapseMax: Infinity, outbreakCap: 1,
      agents: { n: 14, hues: [0, 1] },
      jobs: { n: 5, max: 6, value: 5, spawnEvery: 90 },
      goal: { jobs: 7 }, force: { stampede: true } },

    /* 5a — ONE FAMILY, run one. One lineage, one blind spot, no instruments. This is
       the control arm of the experiment and it is the only passage in the game where
       the player is deliberately given nothing to do, so it is kept to about ten
       seconds and the thing it is waiting for — the whole family falling over at the
       same instant — is unmissable when it lands. */
    { id: 'ch4', chapter: 0, teach: ['Mo', 'Lv', 'Sf'], tools: [], table: true,
      seed: 505, speed: 1, budget: 0, collapseMax: Infinity, outbreakCap: 0,
      agents: { n: 12 },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 200 },
      goal: { survive: 640 },
      force: { monoculture: true, poison: true, poisonN: 3 } },

    /* 6 — THE LIAR. memory. */
    { id: 'ch5', chapter: 0, teach: ['Gu', 'Tc', 'Rp', 'Cs', 'Co', 'Mc', 'In'],
      tools: ['ledger', 'charter'], table: true,
      seed: 606, speed: 1, budget: 7, collapseMax: 140, outbreakCap: 1,
      agents: { n: 12, hues: [0, 1, 2] },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 280 },
      goal: { jobs: 5 },
      force: { rumor: true, lieEvery: 340, poison: true, coordination: true, pairEvery: 280 } },

    /* 7 — THE DARK. legibility. */
    { id: 'ch6', chapter: 0, teach: ['Mm', 'Hi', 'Di', 'Si', 'Co', 'Mc', 'In'],
      tools: ['lens', 'charter'], table: true,
      seed: 707, speed: 1, budget: 7, collapseMax: 140, outbreakCap: 1,
      agents: { n: 12, hues: [0, 1, 2] },
      jobs: { n: 6, max: 6, value: 5, spawnEvery: 240 },
      goal: { jobs: 5 },
      force: { silo: true, hidden: true, poison: true, dark: true, coordination: true, pairEvery: 240 } },

    /* 8 — THE SPOIL-SPORT. the last resort. opens with the lens already lit. */
    { id: 'ch7', chapter: 0, teach: ['Sa', 'Cr', 'Tw', 'Es', 'Cl', 'Lo', 'Co', 'In'],
      tools: ['eject', 'lens', 'slow', 'charter'], table: true, openLens: true,
      seed: 808, speed: 1, budget: 9, collapseMax: 140, outbreakCap: 1,
      agents: { n: 12, hues: [0, 1, 2] },
      jobs: { n: 5, max: 5, value: 5, spawnEvery: 240 },
      goal: { jobs: 5 },
      force: { saboteur: true, advN: 1, incorrigible: true, incN: 1, rivals: true, rivalN: 2,
               churn: true, lock: true, lockN: 1 } },

    /* 9 — MACHINE SPEED. everything learned so far, accelerating. */
    { id: 'ch8', chapter: 0,
      teach: ['Sp', 'Dp', 'My', 'Pt', 'Im', 'Cf', 'Fl', 'Co', 'Mc', 'In', 'Lo'],
      tools: ['slow', 'charter', 'lens', 'vary'], table: true,
      seed: 909, speed: 1, budget: 10, collapseMax: 120, outbreakCap: 2,
      agents: { n: 14, hues: [0, 1, 2] },
      jobs: { n: 6, max: 6, value: 5, spawnEvery: 180 },
      goal: { jobs: 8 },
      force: { speed: true, speedmax: 2.6, speedrate: 700, dependency: true, myopia: true,
               stampede: true, coordination: true, pairEvery: 200 } },

    /* 10 — THE FORMICARY. all twenty-eight, all six, 117 crumbs. The sandbox is the
       reward and it arrives last, and everything learned is still true inside it. */
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

  /* 5b — THE RE-RUN.  Identical seed, identical lineage, identical poison, identical
     length. The ONE difference in the entire configuration is that the seed exists.
     This is the controlled experiment the whole standard is built on, so nothing else
     may drift: it is cloned from CFG[4] rather than written out again, and the diff
     below is the whole diff. */
  var AB_SEED = CFG[4].seed;
  var CFG4B = (function () {
    var a = CFG[4], b = {}, k;
    for (k in a) b[k] = a[k];
    b.tools = ['vary'];              /* <- the one variable */
    b.budget = 4;
    b.outbreakCap = 1;
    return b;
  })();

  /* ------------------------------------------------------------------- state */
  var idx = 0, run = 0, phase = 'gate';
  var pending = null, pendAt = 0;
  var witness = {}, ansd = {}, hit = {};   /* what the player saw, answered, was hit by */
  var used = {};                           /* instruments spent this run */
  var sfHit = 0;                           /* workers taken down together this run */
  var abFires = [0, 0];
  var abTries = 0;                         /* re-offers of the re-run, so it cannot loop */
  var counteredEver = {};
  var wired = false, built = false;
  var app = null, gate = null, rail = null, titleEl = null, countEl = null, strip = null, aboutEl = null;
  var stripCells = null;
  var api;

  /* the world visibly settles on the deciding frame before the paper comes down */
  var SETTLE = 600;

  function C(i) { return (FZ.copy.chapters && FZ.copy.chapters[i]) || {}; }
  function ui(k) { return (FZ.copy.ui && FZ.copy.ui[k]) || ''; }
  function phen(s) { return (FZ.copy.phen && FZ.copy.phen[s]) || {}; }
  function cfgFor(i, r) { return (i === 4 && r === 1) ? CFG4B : CFG[i]; }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* ------------------------------------------------------------------- chrome */
  /* The naming plate and the A/B rail are instrumentation: rectilinear, mono, tabular,
     and the only two signal colours on them are teal for held and red for landed. */
  var CSS =
    '.gtPlates{padding-top:9px;padding-bottom:4px}' +
    '.npl{display:flex;align-items:center;gap:10px;margin:0 -16px;' +
    'padding:9px 16px 9px 13px;border-left:3px solid rgba(0,0,0,.28);' +
    'border-bottom:1px solid rgba(0,0,0,.13)}' +
    '.npl.ok{border-left-color:#19e6c8}' +
    '.npl.hit{border-left-color:#ff2e2e}' +
    '.npl:last-child{border-bottom:0}' +
    '.npg{flex:0 0 auto;width:22px;height:22px;color:#17150f}' +
    '.npg svg{width:22px;height:22px;display:block}' +
    '.npt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}' +
    '.npn{font-size:11.5px;font-weight:700;letter-spacing:.11em;line-height:1.14}' +
    '.npc{font-size:9px;font-weight:500;letter-spacing:.14em;line-height:1.1;' +
    'color:rgba(0,0,0,.5);text-transform:uppercase}' +
    /* the two-letter code keeps its own casing — it is a symbol, not a word */
    '.npc .npk{font-weight:700;letter-spacing:.06em;text-transform:none;color:rgba(0,0,0,.66)}' +
    '.npv{flex:0 0 auto;min-width:16px;text-align:right;font-size:14px;font-weight:700;' +
    'font-variant-numeric:tabular-nums;color:rgba(0,0,0,.55)}' +
    '.gtAB .abk{flex:0 0 auto;font-size:9px;font-weight:500;letter-spacing:.1em;' +
    'color:rgba(0,0,0,.4);font-variant-numeric:tabular-nums}';

  function chromeCSS() {
    if (document.getElementById('fzGateCSS')) return;
    var s = document.createElement('style');
    s.id = 'fzGateCSS';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildChrome() {
    if (built) return;
    chromeCSS();
    app = document.getElementById('app');
    gate = document.getElementById('gate');
    rail = document.getElementById('progressRail');
    titleEl = document.getElementById('chapTitle');
    countEl = document.getElementById('chapCount');
    strip = document.getElementById('statusStrip');
    aboutEl = document.getElementById('about');

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

  /* ------------------------------------------------------------ the naming
     THE PAYOFF, not an interruption. The player has just spent thirty seconds
     watching a phenomenon and answering it by its body. Here it gets its drawn
     mark, its scientific code and its formal name — and a count of how many times
     it happened to this particular colony. The rule down the left edge is the
     verdict: teal where she answered it, red where it landed on her. */
  function witnessed() {
    var out = [], s, e;
    for (s in witness) {
      e = FZ.ELBY ? FZ.ELBY[s] : null;
      if (!e || !witness[s]) continue;
      out.push({ e: e, n: witness[s], ok: !!ansd[s], hit: !!hit[s] });
    }
    out.sort(function (a, b) { return (b.ok - a.ok) || (b.n - a.n); });
    return out.slice(0, 3);
  }

  function plateRow(r) {
    var row = el('div', 'npl' + (r.ok ? ' ok' : (r.hit ? ' hit' : '')));
    var g = el('span', 'npg');
    if (r.e.glyph) g.innerHTML = r.e.glyph;
    row.appendChild(g);
    var t = el('span', 'npt');
    t.appendChild(el('span', 'npn', phen(r.e.sym).name || r.e.nm || ''));
    var c = el('span', 'npc');
    c.appendChild(el('b', 'npk', r.e.sym));
    c.appendChild(document.createTextNode('  ' + (r.e.nm || '')));
    t.appendChild(c);
    row.appendChild(t);
    row.appendChild(el('span', 'npv', String(r.n)));
    return row;
  }

  /* the head is VOICE's 'WHAT THAT WAS'. It sits over the plate, because the plate IS
     what that was; the research paragraph reads on from it with no second label. */
  function learnBlock(inn, i) {
    var w = witnessed();
    inn.appendChild(el('div', 'gtHead', ui('learned')));
    if (w.length) {
      var box = el('div', 'gtPlates');
      w.forEach(function (r) { box.appendChild(plateRow(r)); });
      inn.appendChild(box);
    }
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

  /* ------------------------------------------------------- the controlled re-run
     One row per run, on one shared scale: how many workers went down in the same
     instant. Same seed stamped on both rows, same element, same length of run — so
     the only thing that can explain a shorter bar is the seed. */
  function abRow(n, val, isB, scale) {
    var r = el('div', 'abr' + (isB ? ' b' : ''));
    r.appendChild(el('span', 'abn', String(n)));
    var e = FZ.ELBY ? FZ.ELBY.Sf : null;
    var g = el('span', 'abg');
    if (e && e.glyph) g.innerHTML = e.glyph;
    r.appendChild(g);
    r.appendChild(el('span', 'abk', String(AB_SEED)));
    var bar = el('span', 'abb');
    var fill = el('i');
    fill.style.width = Math.max(val > 0 ? 3 : 0, Math.min(100, Math.round(val / (scale || 1) * 100))) + '%';
    bar.appendChild(fill);
    r.appendChild(bar);
    r.appendChild(el('span', 'abv', String(val)));
    return r;
  }

  /* between the two runs: what run one cost, and the one thing to change */
  function rerunGate() {
    phase = 'result';
    showGate(function (box) {
      var inn = head(box, 4);
      inn.appendChild(el('div', 'gtWin', C(4).win || ''));
      var ab = el('div', 'gtAB');
      ab.appendChild(abRow(1, abFires[0], false, Math.max(1, abFires[0])));
      inn.appendChild(ab);
      box.appendChild(gateBtn(ui('again'), function () { begin(4, 1); }));
    }, 'good');
  }

  function afterGate() {
    phase = 'result';
    showGate(function (box) {
      var inn = head(box, 4);
      var rr = C(4).rerun || {};
      inn.appendChild(el('div', 'gtWin', rr.after || ''));
      var ab = el('div', 'gtAB');
      var sc = Math.max(1, abFires[0], abFires[1]);
      ab.appendChild(abRow(1, abFires[0], false, sc));
      ab.appendChild(abRow(2, abFires[1], true, sc));
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
      var e = FZ.ELBY ? FZ.ELBY[why] : null;
      if (e) {
        var box2 = el('div', 'gtPlates');
        box2.appendChild(plateRow({ e: e, n: witness[why] || 1, ok: false, hit: true }));
        inn.appendChild(box2);
      }
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
    /* the second list only earns its space when it is not the first list again. An
       ungoverned run answers nothing, so the two are identical and one of them is noise. */
    var never = live.filter(function (e) { return !counteredEver[e.sym]; });
    var top = never.slice(0, 5);
    var same = top.length === Math.min(5, live.length) &&
      top.every(function (e, k) { return live[k] === e; });
    if (never.length && !same) {
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
    /* WHAT THE PLAYER ACTUALLY WITNESSED. Counted here, per run, from the live
       simulation — never asserted. The gate can only name what really happened. */
    FZ.bus.on('fire', function (d) {
      if (!d || !d.sym || phase !== 'play') return;
      witness[d.sym] = (witness[d.sym] || 0) + 1;
      /* the re-run counts bodies: how many workers one synchronized failure takes
         down at the same instant is the whole difference between the two runs. */
      if (idx === 4 && d.sym === 'Sf') sfHit += (d.who && d.who.length) || 1;
    });
    FZ.bus.on('outbreak:answered', function (d) { if (d && d.sym) ansd[d.sym] = 1; });
    FZ.bus.on('outbreak:landed', function (d) { if (d && d.sym) hit[d.sym] = 1; });
    FZ.bus.on('intervene', function (d) {
      if (!d || !d.ok || !d.kind) return;
      used[d.kind] = (used[d.kind] || 0) + 1;
    });
    FZ.bus.on('goal', function () { if (phase === 'play') won(); });
    FZ.bus.on('lose', function (d) { if (phase === 'play') lost(d && d.why); });
  }

  function begin(i, r) {
    buildChrome();
    wire();
    idx = i; run = r || 0; api.index = i;
    var cfg = cfgFor(i, run);

    pending = null;
    used = {};
    witness = {}; ansd = {}; hit = {};
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

    hideGate();
    phase = 'play';

    /* passage 8 opens with the lantern already lit — the copy assumes you can see */
    if (cfg.openLens) FZ.sim.apply('lens');

    FZ.bus.emit('chapter:enter', { index: i, cfg: cfg });
  }

  /* the world freezes on the deciding frame long enough to be read, then the paper
     comes down. No queue, no narrator, no six-second wait for lines that do not exist. */
  function after(fn) { pending = fn; pendAt = performance.now(); }

  function won() {
    phase = 'result';
    if (idx === 4) {
      abFires[run] = sfHit;
      if (run === 0) { after(rerunGate); return; }
      /* the re-run only teaches if the one difference was actually spent. If it was
         not, this was the same run twice and there is nothing to compare — offer it
         again rather than showing an empty comparison. */
      if (!used.vary && abTries < 2) { abTries++; after(rerunGate); return; }
      after(afterGate);
      return;
    }
    if (idx >= CFG.length - 1) { after(function () { endGate(true); }); return; }
    after(function () { winGate(idx); });
  }

  function lost(why) {
    phase = 'result';
    if (idx >= CFG.length - 1) { after(function () { endGate(false); }); return; }
    after(function () { loseGate(why || 'In'); });
  }

  api = {
    list: CFG.map(function (c, i) { return { cfg: c, script: [] }; }),
    index: 0,
    phase: function () { return phase; },

    start: function (i) {
      buildChrome();
      wire();
      i = Math.max(0, Math.min(CFG.length - 1, i | 0));
      idx = i; run = 0; api.index = i;
      pending = null;
      witness = {}; ansd = {}; hit = {};
      if (i !== 4) abTries = 0;
      var cfg = CFG[i];
      /* the gate is shown over a world that is already correct behind it */
      FZ.sim.reset(cfg);
      /* and over a world with nothing left burning in it. Without this the previous
         passage's live outbreak survives into the gate: FIELD keeps drawing a ring for
         an incident in a colony that no longer exists, and the field guide — which by
         contract may never open while something burns — can never be opened again for
         the rest of the run, including at the between-episode moment it exists for. */
      if (FZ.outbreak && FZ.outbreak.reset) FZ.outbreak.reset(cfg);
      if (FZ.table) { FZ.table.close && FZ.table.close(); FZ.table.setEnabled(FZ.sim.enabled); }
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
        for (var i = 0; i < FZ.EL.length; i++) {
          var e = FZ.EL[i];
          if (e.countered && FZ.sim.enabled.has(e.sym)) counteredEver[e.sym] = 1;
        }
      }
      if (pending && performance.now() - pendAt > SETTLE) {
        var f = pending; pending = null; f();
      }
    },
  };
  return api;
})();
