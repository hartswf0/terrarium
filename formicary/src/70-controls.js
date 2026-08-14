/* ============================================================
   70-controls.js — THE SIX INSTITUTIONS ON A THUMB.  OWNER: CONTROLS.
   FZ.controls = { build(), setAvailable(kinds), paint(S), armed, aim }

   Rules obeyed here:
     - A tool the player has not been taught is ABSENT from the DOM, not disabled.
     - Targeted tools (vary/charter/eject) arm, show their hint, and preview where they
       will land via FZ.controls.aim, which 50-render.js draws. Untargeted tools
       (slow/lens/ledger) apply on the spot; lens and ledger are toggles with an on-state.
     - Every answer goes through FZ.outbreak.tryAnswer BEFORE FZ.sim.apply, so a correct
       diagnosis can be rewarded and a wrong instrument can teach.
     - All English comes from FZ.copy. This file invents none.
   ============================================================ */
window.FZ = window.FZ || {};

/* shared one-line message strip — defined here because CONTROLS loads first of the two
   parts that need it; CHAPTERS reuses it. */
FZ.ui = FZ.ui || {};
if (!FZ.ui.toast) {
  FZ.ui.toast = (function () {
    var node = null, t = 0;
    return function (msg, tone) {
      if (!node) node = document.getElementById('toast');
      if (!node || !msg) return;
      node.textContent = msg;
      node.className = 'on' + (tone ? ' ' + tone : '');
      clearTimeout(t);
      t = setTimeout(function () { node.className = ''; }, 2600);
    };
  })();
}

FZ.controls = (function () {
  'use strict';

  var ORDER = ['charter', 'vary', 'slow', 'lens', 'ledger', 'eject'];
  var TARGETED = { vary: 1, charter: 1, eject: 1 };

  /* drawn marks — one per instrument, stroke-only, currentColor */
  var MARK = {
    charter: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<rect x="1.8" y="1.8" width="16.4" height="10.4" stroke-dasharray="3 2.4"/>' +
      '<path d="M5.4 1.8v2.2M14.6 1.8v2.2M5.4 12.2v-2.2M14.6 12.2v-2.2"/></svg>',
    vary: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<rect x="1.6" y="4.4" width="5" height="5"/><path d="M13 3.4l3.6 6.2H9.4z"/>' +
      '<path d="M9.6 1.6v10.8" stroke-dasharray="2 2"/></svg>',
    slow: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<path d="M1.6 7h9M7.2 3.6L10.6 7l-3.4 3.4"/><path d="M14.4 1.8v10.4M18 1.8v10.4"/></svg>',
    lens: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<path d="M10 2.4L17.6 7 10 11.6 2.4 7z"/><path d="M10 5.2v3.6M8.2 7h3.6"/></svg>',
    ledger: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<rect x="2.4" y="1.8" width="15.2" height="10.4"/><path d="M6.2 1.8v10.4M8.4 5h6.6M8.4 9h6.6"/></svg>',
    eject: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<path d="M11.2 1.8H2.4v10.4h8.8"/><path d="M7.4 7h10.2M14.6 4.2L17.6 7l-3 2.8"/></svg>',
  };

  var bar = null, field = null, hint = null;
  var made = new Map();          // kind -> button node
  var have = [];                 // kinds currently in the DOM, in ORDER order
  var wired = false;
  var api;

  function copyTool(k) { return (FZ.copy && FZ.copy.tools && FZ.copy.tools[k]) || {}; }
  function ui(k) { return (FZ.copy && FZ.copy.ui && FZ.copy.ui[k]) || ''; }
  function loop(k) { return (FZ.copy && FZ.copy.loop && FZ.copy.loop[k]) || ''; }
  function S() { return FZ.sim ? FZ.sim.state : null; }

  /* ------------------------------------------------------------- the buttons */
  function makeButton(kind) {
    var T = copyTool(kind);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool fresh';
    b.setAttribute('data-kind', kind);
    var g = document.createElement('span');
    g.className = 'tg';
    g.innerHTML = MARK[kind] || '';
    var l = document.createElement('span');
    l.className = 'tl';
    l.textContent = T.label || kind.toUpperCase();
    var c = document.createElement('span');
    c.className = 'tc';
    c.textContent = String(FZ.sim ? FZ.sim.cost(kind) : (T.cost || 2));
    b.appendChild(g); b.appendChild(l); b.appendChild(c);
    b.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      press(kind);
    });
    b.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    made.set(kind, b);
    return b;
  }

  /* the hands only work while the colony is running: once a chapter has been won or
     lost the result is being read, and a stray tap must not spend budget into it. */
  function live() {
    var st = S();
    if (!st || st.gameOver) return false;
    if (FZ.chapters && FZ.chapters.phase && FZ.chapters.phase() !== 'play') return false;
    return true;
  }

  function press(kind) {
    var st = S();
    if (!st || !live()) return;
    if (st.budget < FZ.sim.cost(kind)) { FZ.ui.toast(ui('noBudget'), 'bad'); return; }
    if (TARGETED[kind]) {
      if (api.armed === kind) { disarm(); return; }
      arm(kind);
      return;
    }
    disarm();
    commit(kind, null, null);
  }

  function arm(kind) {
    api.armed = kind;
    api.aim = null;
    if (hint) { hint.textContent = copyTool(kind).hint || ''; hint.classList.add('on'); }
    paintBar();
  }
  function disarm() {
    api.armed = null;
    api.aim = null;
    if (hint) { hint.classList.remove('on'); hint.textContent = ''; }
    paintBar();
  }

  /* --------------------------------------------------------------- the field */
  function toWorld(ev) {
    var st = S();
    if (!field || !st) return null;
    var r = field.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: (ev.clientX - r.left) * (st.w / r.width),
      y: (ev.clientY - r.top) * (st.h / r.height),
    };
  }

  /* where an untargeted instrument should be judged to have been aimed:
     at the outbreak it is answering, if one is burning. */
  function burning() {
    var L = (FZ.outbreak && FZ.outbreak.list) ? FZ.outbreak.list : null;
    if (!L || !L.length) return null;
    for (var i = 0; i < L.length; i++) if (!L[i].state || L[i].state === 'burning') return L[i];
    return null;
  }

  function commit(kind, x, y) {
    var st = S();
    if (!st || !live()) return;
    if (st.budget < FZ.sim.cost(kind)) { FZ.ui.toast(ui('noBudget'), 'bad'); return; }

    if (x == null) { var o = burning(); if (o) { x = o.x; y = o.y; } }

    var ans = null;
    if (FZ.outbreak && FZ.outbreak.tryAnswer) {
      try { ans = FZ.outbreak.tryAnswer(kind, x, y); } catch (e) { ans = null; }
    }
    var out = FZ.sim.apply(kind, TARGETED[kind] ? x : undefined, TARGETED[kind] ? y : undefined);

    if (ans && ans.hit && ans.right) FZ.ui.toast(ans.msg || loop('answered'), 'good');
    else if (ans && ans.hit && !ans.right) FZ.ui.toast(ans.msg || '', 'bad');
    else if (out && !out.ok && out.msg) FZ.ui.toast(out.msg, 'bad');
    else if (out && out.ok && !TARGETED[kind]) FZ.ui.toast(copyTool(kind).blurb || '', 'good');

    paintBar();
  }

  /* a plain tap with nothing armed is an inspection: it opens whatever the player
     just pointed at in the table, so "what is that" is always one tap away. */
  function inspect(p) {
    var L = (FZ.outbreak && FZ.outbreak.list) ? FZ.outbreak.list : null;
    var best = null, bd = Infinity;
    if (L) for (var i = 0; i < L.length; i++) {
      var o = L[i];
      if (o.x == null) continue;
      var dx = o.x - p.x, dy = o.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      var r = (o.r || 46) + 16;
      if (d < r && d < bd) { bd = d; best = o; }
    }
    if (!best) {
      /* nothing burning there — fall back to the hottest live element, so the tap
         still answers "what am I looking at". */
      var hot = null;
      if (FZ.EL && FZ.sim && FZ.sim.enabled) {
        for (var k = 0; k < FZ.EL.length; k++) {
          var e = FZ.EL[k];
          if (!FZ.sim.enabled.has(e.sym)) continue;
          if (!hot || e.heat > hot.heat) hot = e;
        }
      }
      if (hot && hot.heat > 0.12 && FZ.table && FZ.table.open) FZ.table.open(hot.sym);
      return;
    }
    if (FZ.table && FZ.table.open) FZ.table.open(best.sym);
  }

  function wireField() {
    if (wired || !field) return;
    wired = true;
    var down = false;

    field.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    field.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      down = true;
      try { field.setPointerCapture(ev.pointerId); } catch (e) { }
      var p = toWorld(ev);
      if (!p) return;
      if (api.armed) api.aim = { kind: api.armed, x: p.x, y: p.y };
    });
    field.addEventListener('pointermove', function (ev) {
      if (!down || !api.armed) return;
      ev.preventDefault();
      var p = toWorld(ev);
      if (p) api.aim = { kind: api.armed, x: p.x, y: p.y };
    });
    function up(ev) {
      if (!down) return;
      down = false;
      try { field.releasePointerCapture(ev.pointerId); } catch (e) { }
      var p = toWorld(ev) || (api.aim ? { x: api.aim.x, y: api.aim.y } : null);
      var kind = api.armed;
      disarm();
      if (!p) return;
      if (kind) commit(kind, p.x, p.y);
      else inspect(p);
    }
    field.addEventListener('pointerup', up);
    field.addEventListener('pointercancel', function () { down = false; api.aim = null; });
  }

  /* ---------------------------------------------------------------- painting */
  function paintBar() {
    var st = S();
    made.forEach(function (b, kind) {
      if (!b.parentNode) return;
      var armed = api.armed === kind;
      if (b.classList.contains('on') !== armed) b.classList.toggle('on', armed);
      if (!st) return;
      var poor = st.budget < FZ.sim.cost(kind);
      if (b.classList.contains('poor') !== poor) b.classList.toggle('poor', poor);
      var live = (kind === 'lens' && st.lensOn) || (kind === 'ledger' && st.ledgerOn) ||
        (kind === 'slow' && st.tick < st.slowUntil);
      if (b.classList.contains('live') !== live) b.classList.toggle('live', live);
    });
  }

  api = {
    armed: null,
    aim: null,

    build: function () {
      bar = document.getElementById('bar');
      field = document.getElementById('field');
      hint = document.getElementById('aimHint');
      wireField();
      if (FZ.bus) {
        FZ.bus.on('chapter:enter', function () { disarm(); });
        FZ.bus.on('lose', function () { disarm(); });
        FZ.bus.on('goal', function () { disarm(); });
      }
      paintBar();
    },

    /* ONLY these buttons exist. Absent, never greyed-out-forever. */
    setAvailable: function (kinds) {
      if (!bar) bar = document.getElementById('bar');
      if (!bar) return;
      var want = [];
      var set = {};
      (kinds || []).forEach(function (k) { if (MARK[k]) set[k] = 1; });
      ORDER.forEach(function (k) { if (set[k]) want.push(k); });

      if (api.armed && !set[api.armed]) disarm();

      /* remove what is no longer taught */
      have.forEach(function (k) {
        if (set[k]) return;
        var b = made.get(k);
        if (b && b.parentNode) b.parentNode.removeChild(b);
      });

      /* add and order what is */
      want.forEach(function (k) {
        var b = made.get(k) || makeButton(k);
        if (!b.parentNode) { b.classList.remove('fresh'); void b.offsetWidth; b.classList.add('fresh'); }
        bar.appendChild(b);                  /* appendChild re-orders an existing node */
      });
      have = want;
      paintBar();
    },

    paint: function (st) {
      paintBar();
      if (hint && api.armed && !hint.classList.contains('on')) hint.classList.add('on');
    },

    disarm: disarm,
    kinds: function () { return have.slice(); },
  };
  return api;
})();
