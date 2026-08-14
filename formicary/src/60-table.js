/* ============================================================
   60-table.js — THE TAXONOMY.  OWNER: TABLE.
   FZ.table = { build(), setEnabled(set), paint(S), open(sym), close(), focus }

   The table is only worth its space if a lit cell tells you something you can
   act on. So: heat is a state you can read across the room, a cell you have not
   been taught is present but visibly unknown (the table fills in as a reward),
   and opening a cell points at the actual bodies on the field via `focus`,
   which 50-render.js reads.

   All English here comes from FZ.copy / FZ.EL. This file invents none.
   ============================================================ */
FZ.table = (function () {
  'use strict';

  var COL = ['#19e6c8', '#ffd23f', '#3b82f6', '#ff2e2e', '#ffffff']; /* family accents */
  var AMBER = '#ffd23f', RED = '#ff2e2e', TEAL = '#19e6c8';

  var api = null;
  var built = false;
  var wrap = null, tbl = null, metaRow = null, detail = null;
  var cells = new Map();          // sym -> {el, node, sy, nm, hb, fx, state, heat, ct, live, known}
  var known = new Set();          // cumulative: once taught, always readable
  var live = new Set();           // enabled this chapter
  var openSym = null;
  var lastPaint = 0, fitH = -1, fitT = 0;

  /* row marks for the detail card: when / what it costs / what answers it */
  var MK = {
    trig: '<svg viewBox="0 0 14 14" fill="none" stroke="' + AMBER + '" stroke-width="1.4"><path d="M0.5 7h3.5M10 7h3.5M7 0.5v3.5M7 10v3.5"/><rect x="4.5" y="4.5" width="5" height="5"/></svg>',
    eff: '<svg viewBox="0 0 14 14" fill="none" stroke="' + RED + '" stroke-width="1.4"><path d="M0.5 7h12M8 2.5L12.5 7 8 11.5"/></svg>',
    cnt: '<svg viewBox="0 0 14 14" fill="none" stroke="' + TEAL + '" stroke-width="1.4"><path d="M1.5 1.5h11v6.5L7 12.5 1.5 8z"/></svg>',
  };
  var PH = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10h12" stroke-dasharray="3 3"/></svg>';

  /* ---------------------------------------------------- theme-adaptive greys
     The page may be light or dark; greys must stay rgba(0,0,0,a)/rgba(255,255,255,a). */
  function inkOf() {
    var bg = '';
    try { bg = getComputedStyle(document.body).backgroundColor || ''; } catch (e) { }
    var m = bg.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return '0,0,0';
    var lum = (+m[1] * 0.299 + +m[2] * 0.587 + +m[3] * 0.114) / 255;
    return lum < 0.5 ? '255,255,255' : '0,0,0';
  }

  function css(ink) {
    var dark = ink.charAt(0) === '2';
    var page = dark ? '#000' : '#fff';
    var g = function (a) { return 'rgba(' + ink + ',' + a + ')'; };
    return [
      '#tableWrap{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '#etable{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;align-items:start}',
      '#etable .tcol{display:flex;flex-direction:column;gap:3px;padding-top:4px}',
      '#metaRow{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:6px;padding-top:4px;border-top:2px solid ' + g('.28') + '}',
      /* every cell rule carries the same #tableWrap .fzc prefix so state classes
         out-specify the base rule instead of losing to it */
      'W .fzc{position:relative;display:block;width:100%;height:var(--ch,43px);',
      'padding:3px 4px 5px;margin:0;text-align:left;overflow:hidden;cursor:pointer;',
      'background:' + g('.05') + ';border:1px solid ' + g('.13') + ';border-left:3px solid ' + g('.13') + ';',
      'color:' + g('.9') + ';font-family:inherit;-webkit-tap-highlight-color:transparent;',
      'transition:background .12s linear,border-color .12s linear,opacity .2s linear}',
      'W .fzc::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;background:' + AMBER + '}',
      'W .fzc .top{display:flex;align-items:center;gap:4px;height:16px}',
      'W .fzc .cgl{width:15px;height:15px;flex:0 0 15px;display:block;color:inherit}',
      'W .fzc .cgl svg{width:15px;height:15px;display:block}',
      'W .fzc .csy{font-size:13px;font-weight:700;letter-spacing:.02em;line-height:1;color:inherit}',
      'W .fzc .cnm{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;',
      'margin-top:1px;font-size:var(--nf,8px);line-height:1.1;letter-spacing:0;color:' + g('.55') + ';text-transform:uppercase}',
      '#tableWrap.hn .fzc .cnm{display:none}',
      '#tableWrap.l1 .fzc .cnm{-webkit-line-clamp:1}',
      'W .fzc .fx{position:absolute;right:14px;top:3px;font-size:8px;line-height:1;color:' + g('.4') + ';font-weight:700}',
      'W .fzc .hb{position:absolute;left:0;right:0;bottom:0;height:3px;background:' + g('.08') + '}',
      'W .fzc .hb i{display:block;height:100%;width:0%;background:' + g('.35') + ';transition:width .18s linear}',
      'W .fzc .ctm{position:absolute;right:0;top:0;width:12px;height:12px;background:' + TEAL + ';',
      'clip-path:polygon(100% 0,100% 100%,0 0);display:none}',
      'W .fzc.ct .ctm{display:block}',
      'W .fzc.warm{border-left-color:' + AMBER + '}W .fzc.warm::before{opacity:' + (dark ? '.1' : '.24') + '}',
      dark ? 'W .fzc.warm .csy,W .fzc.warm .cgl{color:' + AMBER + '}' : '',
      'W .fzc.warm .hb i{background:' + AMBER + '}',
      'W .fzc.hot{border-color:' + RED + '}',
      'W .fzc.hot::before{background:' + RED + ';opacity:' + (dark ? '.18' : '.14') + '}',
      'W .fzc.hot .csy,W .fzc.hot .cgl{color:' + RED + '}W .fzc.hot .hb i{background:' + RED + '}',
      /* an outbreak of this element is burning on the field right now */
      '@keyframes fzburn{0%{border-color:' + RED + '}50%{border-color:' + g('.15') + '}100%{border-color:' + RED + '}}',
      'W .fzc.brn{border-color:' + RED + ';animation:fzburn .8s linear infinite}',
      'W .fzc.brn::before{background:' + RED + ';opacity:' + (dark ? '.26' : '.2') + '}',
      'W .fzc.brn .csy,W .fzc.brn .cgl{color:' + RED + '}',
      /* one the player has personally diagnosed and answered */
      'W .fzc.mast{border-top:3px solid ' + TEAL + '}',
      'W .fzc.dorm{opacity:.6}',
      'W .fzc.lk{border-style:dashed;background:none}',
      'W .fzc.lk .csy,W .fzc.lk .cnm,W .fzc.lk .fx,W .fzc.lk .hb{visibility:hidden}',
      'W .fzc.lk .cgl{opacity:.15}',
      'W .fzc .ph{display:none}',
      'W .fzc.lk .ph{position:absolute;left:24px;top:7px;width:22px;height:3px;background:' + g('.2') + ';display:block}',
      'W .fzc.sel{border-color:' + g('.85') + ';background:' + g('.16') + '}',
      '@keyframes fzpulse{0%{box-shadow:inset 0 0 0 3px ' + RED + '}70%{box-shadow:inset 0 0 0 3px ' + RED + '}100%{box-shadow:inset 0 0 0 3px ' + g('0') + '}}',
      'W .fzc.pulse{animation:fzpulse .55s linear 1}',
      '@keyframes fznew{0%{background:' + g('.8') + '}100%{background:' + g('.05') + '}}',
      'W .fzc.fresh{animation:fznew 1.1s ease-out 1}',
      '@keyframes fzshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}',
      'W .fzc.no{animation:fzshake .22s linear 1}',
      /* --- detail card --- */
      '#detail{display:none;position:fixed;left:6px;right:6px;z-index:40;flex-direction:column;',
      'background:' + page + ';border:2px solid ' + g('.85') + ';overflow:hidden}',
      '#detail.on{display:flex}',
      '#detail .dtIn{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:9px 10px 10px}',
      '#detail .dtTop{display:flex;align-items:center;gap:7px;margin-bottom:7px}',
      '#detail .dtG{width:22px;height:22px;flex:0 0 22px;color:' + g('.95') + '}',
      '#detail .dtG svg{width:22px;height:22px;display:block}',
      '#detail .dtS{font-size:18px;font-weight:700;line-height:1;color:' + g('.95') + '}',
      '#detail .dtN{font-size:10px;line-height:1.2;letter-spacing:.03em;text-transform:uppercase;color:' + g('.6') + '}',
      '#detail .dtP{font-size:12.5px;line-height:1.35;color:' + g('.95') + ';margin-bottom:9px}',
      '#detail .dtR{display:flex;gap:7px;align-items:flex-start;margin-bottom:6px}',
      '#detail .dtM{width:14px;height:14px;flex:0 0 14px;margin-top:1px}',
      '#detail .dtM svg{width:14px;height:14px;display:block}',
      '#detail .dtT{font-size:10.5px;line-height:1.3;color:' + g('.72') + '}',
      '#detail .dtChip{display:inline-block;padding:1px 4px;margin-right:5px;border:1px solid ' + TEAL + ';',
      'color:' + g('.95') + ';font-size:9px;font-weight:700;letter-spacing:.1em;vertical-align:1px}',
      '#detail .dtH{display:flex;align-items:center;gap:6px;margin-top:9px}',
      '#detail .dtHb{flex:1 1 auto;height:6px;background:' + g('.1') + ';display:block}',
      '#detail .dtHb i{display:block;height:100%;width:0%;background:' + g('.35') + ';transition:width .2s linear}',
      '#detail .dtHb.warm i{background:' + AMBER + '}#detail .dtHb.hot i{background:' + RED + '}',
      '#detail .dtF{font-size:10px;font-weight:700;color:' + g('.6') + ';min-width:22px;text-align:right}',
      '#detail .dtC{width:12px;height:12px;background:' + TEAL + ';clip-path:polygon(100% 0,100% 100%,0 0);display:none}',
      '#detail.ct .dtC{display:block}',
      '#detail .dtX{flex:0 0 auto;display:block;width:100%;min-height:46px;border:0;border-top:2px solid ' + g('.85') + ';',
      'background:' + page + ';color:' + g('.95') + ';font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.12em;cursor:pointer}',
    ].join('').replace(/W \.fzc/g, '#tableWrap .fzc');
  }

  /* --------------------------------------------------------------- building */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function makeCell(e) {
    var b = el('button', 'cell fzc lk');
    b.type = 'button';
    b.setAttribute('data-sym', e.sym);
    /* family identity is the column's top rule; the cell's left rule belongs to heat */
    var top = el('div', 'top');
    var g = el('span', 'cgl', e.glyph || PH);
    var sy = el('span', 'csy'); sy.textContent = e.sym || '';
    top.appendChild(g); top.appendChild(sy);
    var nm = el('div', 'cnm'); nm.textContent = e.nm || '';
    var fx = el('span', 'fx'); fx.textContent = '';
    var hb = el('span', 'hb', '<i></i>');
    var ct = el('span', 'ctm');
    var ph = el('span', 'ph');
    b.appendChild(top); b.appendChild(nm); b.appendChild(fx); b.appendChild(hb); b.appendChild(ct); b.appendChild(ph);
    b.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (!known.has(e.sym)) { flashNo(b); return; }
      if (openSym === e.sym) api.close(); else api.open(e.sym);
    });
    cells.set(e.sym, { e: e, n: b, sy: sy, hb: hb.firstChild, fx: fx, st: '', h: -1, ct: null, lk: true, live: false });
    return b;
  }

  function flashNo(b) { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); }

  function plainOf(e) {
    return e.plain || ((FZ.copy && FZ.copy.fire) ? (FZ.copy.fire[e.sym] || '') : '');
  }

  function build() {
    if (built) return;
    if (!window.FZ || !FZ.EL || !FZ.EL.length) return;
    wrap = document.getElementById('tableWrap');
    tbl = document.getElementById('etable');
    detail = document.getElementById('detail');
    if (!tbl) return;

    var st = document.getElementById('fzTableCSS') || el('style');
    st.id = 'fzTableCSS';
    st.textContent = css(inkOf());
    document.head.appendChild(st);

    tbl.textContent = '';
    var colNodes = [];
    for (var c = 0; c < 4; c++) {
      var cn = el('div', 'tcol');
      cn.style.borderTop = '2px solid ' + COL[c];
      colNodes.push(cn); tbl.appendChild(cn);
    }
    metaRow = document.getElementById('metaRow');
    if (!metaRow) {
      metaRow = el('div');
      metaRow.id = 'metaRow';
      (wrap || tbl.parentNode || document.body).appendChild(metaRow);
    }
    metaRow.textContent = '';

    for (var i = 0; i < FZ.EL.length; i++) {
      var e = FZ.EL[i];
      var node = makeCell(e);
      if (e.col >= 0 && e.col <= 3) colNodes[e.col].appendChild(node);
      else metaRow.appendChild(node);
    }

    if (detail) {
      detail.textContent = '';
      var inn = el('div', 'dtIn');
      inn.innerHTML =
        '<div class="dtTop"><span class="dtG"></span><span class="dtS"></span><span class="dtN"></span><span class="dtC"></span></div>' +
        '<div class="dtP"></div>' +
        '<div class="dtR"><span class="dtM">' + MK.trig + '</span><span class="dtT" data-k="trigger"></span></div>' +
        '<div class="dtR"><span class="dtM">' + MK.eff + '</span><span class="dtT" data-k="effect"></span></div>' +
        '<div class="dtR"><span class="dtM">' + MK.cnt + '</span><span class="dtT" data-k="counter"><b class="dtChip"></b><span class="dtCt"></span></span></div>' +
        '<div class="dtH"><span class="dtHb"><i></i></span><span class="dtF"></span></div>';
      var x = el('button', 'dtX');
      x.type = 'button';
      x.textContent = (FZ.copy && FZ.copy.ui && FZ.copy.ui.close) ? FZ.copy.ui.close : '';
      x.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); api.close(); });
      detail.appendChild(inn); detail.appendChild(x);

      /* dismissible without precision: tap anywhere off the card, swipe it down, or Escape */
      var sy0 = 0;
      detail.addEventListener('pointerdown', function (ev) { sy0 = ev.clientY; });
      detail.addEventListener('pointerup', function (ev) { if (ev.clientY - sy0 > 46) api.close(); });
    }
    document.addEventListener('pointerdown', function (ev) {
      if (!openSym) return;
      var t = ev.target;
      if (t && t.closest && (t.closest('#detail') || t.closest('.cell'))) return;
      api.close();
    }, true);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && openSym) api.close(); });
    window.addEventListener('resize', function () { fitH = -1; fit(); if (openSym) place(); });

    if (FZ.bus) {
      FZ.bus.on('fire', function (d) { if (d && d.sym) pulse(d.sym); });
      FZ.bus.on('outbreak:open', function (d) { if (d && d.sym) pulse(d.sym); });
      FZ.bus.on('outbreak:answered', function (d) { if (d && d.sym) pulse(d.sym); });
    }

    built = true;
    setEnabled(live);
    fit();
  }

  function pulse(sym) {
    var c = cells.get(sym);
    if (!c) return;
    c.n.classList.remove('pulse'); void c.n.offsetWidth; c.n.classList.add('pulse');
  }

  /* -------------------------------------------------------------- knowledge */
  function setEnabled(set) {
    live = new Set();
    if (set) {
      if (typeof set.forEach === 'function') set.forEach(function (s) { live.add(s); });
      else if (Array.isArray(set)) set.forEach(function (s) { live.add(s); });
    }
    if (!built) return;
    cells.forEach(function (c, sym) {
      var isLive = live.has(sym);
      var fresh = isLive && !known.has(sym);
      if (isLive) known.add(sym);
      var isKnown = known.has(sym);
      c.live = isLive;
      c.n.classList.toggle('lk', !isKnown);
      c.n.classList.toggle('dorm', isKnown && !isLive);
      c.lk = !isKnown;
      if (fresh) { c.n.classList.remove('fresh'); void c.n.offsetWidth; c.n.classList.add('fresh'); }
    });
  }

  /* ------------------------------------------------------------- per frame */
  function paint(S) {
    if (!built) { build(); if (!built) return; }
    var t = performance.now();
    if (t - fitT > 500) { fitT = t; if (wrap && wrap.clientHeight !== fitH) { fitH = wrap.clientHeight; fit(); } }

    /* which cells are the player's live problem, and which has she already answered */
    var burn = null, ob = (window.FZ && FZ.outbreak) ? FZ.outbreak : null;
    if (ob && ob.list && ob.list.length) {
      burn = new Set();
      for (var b = 0; b < ob.list.length; b++) {
        var o = ob.list[b];
        if (o && o.sym && (!o.state || o.state === 'burning')) burn.add(o.sym);
      }
    }
    var mast = ob ? ob.mastery : null;
    cells.forEach(function (c) {
      var e = c.e;
      var h = typeof e.heat === 'number' ? e.heat : 0;
      if (h < 0) h = 0; if (h > 1) h = 1;
      var st = c.lk ? '' : h >= 0.55 ? 'hot' : h >= 0.18 ? 'warm' : '';
      if (st !== c.st) {
        c.n.classList.remove('hot', 'warm');
        if (st) c.n.classList.add(st);
        c.st = st;
      }
      if (Math.abs(h - c.h) > 0.03 || (h === 0 && c.h !== 0)) {
        c.hb.style.width = (c.lk ? 0 : Math.round(h * 100)) + '%';
        c.h = h;
      }
      var ct = !!e.countered && !c.lk;
      if (ct !== c.ct) { c.n.classList.toggle('ct', ct); c.ct = ct; }
      var f = e.fires || 0;
      if (f !== c.fv) { c.fx.textContent = (f && !c.lk) ? (f > 99 ? '99' : String(f)) : ''; c.fv = f; }

      var bn = !!(burn && burn.has(e.sym));
      if (bn !== c.bn) { c.n.classList.toggle('brn', bn); c.bn = bn; }
      var ms = !!(mast && mast[e.sym] && mast[e.sym].answered > 0) && !c.lk;
      if (ms !== c.ms) { c.n.classList.toggle('mast', ms); c.ms = ms; }
    });
    if (openSym && t - lastPaint > 120) { lastPaint = t; liveBits(); }
  }

  function liveBits() {
    if (!detail || !openSym) return;
    var e = FZ.ELBY ? FZ.ELBY[openSym] : null;
    if (!e) return;
    var h = Math.max(0, Math.min(1, e.heat || 0));
    var bar = detail.querySelector('.dtHb');
    if (bar) {
      bar.classList.toggle('hot', h >= 0.55);
      bar.classList.toggle('warm', h >= 0.18 && h < 0.55);
      bar.firstChild.style.width = Math.round(h * 100) + '%';
    }
    var f = detail.querySelector('.dtF');
    if (f) f.textContent = String(e.fires || 0);
    detail.classList.toggle('ct', !!e.countered);
  }

  /* ------------------------------------------------------------ detail card */
  /* The card hugs the bottom of the table region and grows upward only as far as
     its content needs — it can never reach the field. */
  function place() {
    if (!detail) return;
    var vh = window.innerHeight;
    var stage = document.getElementById('stage');
    var sb = stage ? stage.getBoundingClientRect().bottom : 0;
    var wb = wrap ? wrap.getBoundingClientRect() : null;
    var bottom = wb ? Math.max(4, vh - wb.bottom) : 4;
    detail.style.top = 'auto';
    detail.style.bottom = Math.round(bottom) + 'px';
    detail.style.maxHeight = Math.round(Math.max(150, (vh - bottom) - (sb + 6))) + 'px';
  }

  /* 28 cells have to fit the room they were given, without a scrollbar if possible. */
  function fit() {
    if (!built || !wrap || !tbl) return;
    var h = wrap.clientHeight;
    if (!h) return;
    var cs = getComputedStyle(wrap);
    var avail = h - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    var rows = 1;
    for (var i = 0; i < tbl.children.length; i++) rows = Math.max(rows, tbl.children[i].children.length);
    var per = Math.floor((avail - (rows - 1) * 3 - 16) / (rows + 1));
    per = Math.max(30, Math.min(52, per));
    wrap.style.setProperty('--ch', per + 'px');
    wrap.style.setProperty('--nf', (per >= 46 ? 8 : per >= 40 ? 7.6 : 7.2) + 'px');
    wrap.classList.toggle('l1', per < 42);
    wrap.classList.toggle('hn', per < 34);
  }

  function open(sym) {
    var c = cells.get(sym);
    if (!c || !detail) return;
    if (!known.has(sym)) { flashNo(c.n); return; }
    var e = c.e;
    openSym = sym;
    api.focus = sym;
    cells.forEach(function (o) { o.n.classList.toggle('sel', o.e.sym === sym); });
    var g = detail.querySelector('.dtG'); if (g) g.innerHTML = e.glyph || PH;
    var s = detail.querySelector('.dtS'); if (s) s.textContent = e.sym || '';
    var n = detail.querySelector('.dtN'); if (n) n.textContent = e.nm || '';
    var p = detail.querySelector('.dtP');
    if (p) p.textContent = plainOf(e);
    var rows = detail.querySelectorAll('.dtT');
    for (var i = 0; i < rows.length; i++) {
      var k = rows[i].getAttribute('data-k');
      if (k === 'counter') continue;
      var v = e[k] || '';
      if (v === plainOf(e)) v = '';           /* never say the same sentence twice */
      rows[i].textContent = v;
      rows[i].parentNode.style.display = v ? '' : 'none';
    }
    /* the counter row names the institution that answers this cell, by its tool label */
    var tk = e.counterTool, tool = (tk && FZ.copy && FZ.copy.tools) ? FZ.copy.tools[tk] : null;
    var chip = detail.querySelector('.dtChip'), ctx2 = detail.querySelector('.dtCt');
    if (chip) { chip.textContent = tool ? (tool.label || '') : ''; chip.style.display = tool ? '' : 'none'; }
    if (ctx2) ctx2.textContent = e.counter || (tool ? tool.blurb || '' : '');
    var crow = chip ? chip.closest('.dtR') : null;
    if (crow) crow.style.display = (tool || e.counter) ? '' : 'none';
    detail.classList.add('on');
    place();
    liveBits();
  }

  function close() {
    openSym = null;
    api.focus = null;
    if (detail) detail.classList.remove('on');
    cells.forEach(function (o) { o.n.classList.remove('sel'); });
  }

  api = {
    build: build,
    setEnabled: setEnabled,
    paint: paint,
    open: open,
    close: close,
    pulse: pulse,
    focus: null,
  };
  return api;
})();
