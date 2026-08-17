/* ============================================================
   70-controls.js — RECOGNITION AND INTERVENTION.  OWNER: CONTROLS.
   FZ.controls = { build(), setAvailable(kinds), paint(S), armed, aim }

   This file owns the only two things the player ever reads during play, and there are
   never more than two of them, and only one of them is a sentence:

     #tagLayer   ONE paper tag, hung on a thread beside the incident it names. Two lines:
                 a phenomenon a naturalist would write on a card, and one plain sentence.
                 Its left edge IS the fuse — the tag burns down as the incident does, so
                 there is no separate clock anywhere on screen. No two-letter code, ever.

     #act        the contextual action surface. ABSENT — removed from the DOM, not
                 disabled, not empty — whenever there is no decision to make. It appears
                 when an incident has been named and disappears the moment it is settled.

   ABOLISHED THIS ROUND, and this is most of the work:
     - the permanent six-button tool bar (AESTHETIC.md §8). #bar is emptied and hidden.
     - the amber instruction rail (#aimHint). It paraphrased the tag.
     - the toast strip (#toast). Everything it said now arrives in the one tag region or
       is deleted; FZ.ui.toast is kept as a shim so nothing else breaks, and it writes
       into that same single region.
     - opening the taxonomy card on a field tap. A field tap with nothing in hand moves
       the tag to the incident you pointed at. Theory is the reward, not a popup.

   PUT BACK THIS ROUND, and it is the point of the round: THE NEST IS TAPPABLE. Arming
   an instrument and placing it on the colony is the answer gesture for every instrument
   that occupies ground — CHARTER, VARY and EJECT. A meeting stone is placed AT A
   CROSSROADS; a seed is placed ON A CROWD; a threshold is placed ON A BODY. snapAim()
   lands each one on the real feature nearest the thumb, so an ordinary tap is an exact
   placement and the preview shows where it will actually go.

   THE SIX INSTITUTIONS ARE FOLK TECHNOLOGY (AESTHETIC.md §5). Each is drawn as the thing
   an ant colony would build, and the silhouette teaches the function: an arch over a
   meeting stone arbitrates, a branching seed decorrelates, a cairn of tally-marked stones
   remembers, a lantern reveals, a bell brakes, a barred threshold excludes. The names are
   there while they are being learned and drop away once the player has answered enough
   incidents to know the shapes.

   All English is FZ.copy's. The two fallbacks in this file (folk names, and only if VOICE
   has not supplied them) are flagged in the report.
   ============================================================ */
window.FZ = window.FZ || {};

FZ.controls = (function () {
  'use strict';

  var ORDER = ['charter', 'vary', 'slow', 'lens', 'ledger', 'eject'];

  /* THE FOLK TECHNOLOGY. viewBox 0 0 24 24, stroke-only, currentColor.
     Read them as silhouettes at 26px on a phone: arch, seed, cairn, lantern, bell, gate. */
  var MARK = {
    /* meeting stone under a marked arch — ownership becomes visible, one claimant remains */
    charter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="square"><path d="M3.6 21.4V12a8.4 8.4 0 0116.8 0v9.4"/>' +
      '<path d="M7.9 21.4v-9.2a4.1 4.1 0 018.2 0v9.2"/>' +
      '<path d="M1.6 21.4h20.8"/><path d="M12 1.6v2.6"/></svg>',
    /* branching seed — one thing becomes several, going different ways */
    vary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="square"><path d="M12 21.4v-4.2"/><path d="M8.6 21.4h6.8"/>' +
      '<path d="M12 17.2c-1.5 0-2.6-1-2.6-2.3S10.5 12.6 12 12.6s2.6 1 2.6 2.3-1.1 2.3-2.6 2.3z"/>' +
      '<path d="M12 12.6V7.4M10.4 13.6L6.2 9.4M13.6 13.6l4.2-4.2"/>' +
      '<path d="M12 7.4V4.2M6.2 9.4V6.2M17.8 9.4V6.2"/></svg>',
    /* tally cairn — what happened here is written on the stones and stays written */
    ledger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="square"><path d="M2.5 21.4h19"/><path d="M4 15.4h16v6H4z"/>' +
      '<path d="M6.2 9.6h11.6v5.8H6.2z"/><path d="M8.4 4h7.2v5.6H8.4z"/>' +
      '<path d="M7 17v2.6M9.4 17v2.6M11.8 17v2.6M14.2 17v2.6M6.4 19.8l8.4-3.4"/></svg>',
    /* lantern — intention becomes visible in the dark */
    lens: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="square"><path d="M10 5.6a2 2 0 014 0v2"/>' +
      '<path d="M7 7.6h10v10H7z"/><path d="M5.6 17.6h12.8M5.6 7.6h12.8"/>' +
      '<path d="M12 10.6l2.2 2-2.2 2-2.2-2z"/>' +
      '<path d="M1.6 12.6h2.6M19.8 12.6h2.6M3.6 5.2l1.8 1.8M20.4 5.2l-1.8 1.8"/></svg>',
    /* bell — frantic motion becomes readable, everything drops to a pace hands can follow */
    slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="square"><path d="M6 17.4c0-6.4 1.8-9.4 6-9.4s6 3 6 9.4"/>' +
      '<path d="M4 17.4h16"/><path d="M12 5.6v2.4"/>' +
      '<path d="M12 3.2a1.4 1.4 0 010 2.8 1.4 1.4 0 010-2.8z"/>' +
      '<path d="M12 17.4v2.2"/><path d="M12 19.6a1.2 1.2 0 010 2.4 1.2 1.2 0 010-2.4z"/></svg>',
    /* guarded threshold — one destructive actor can no longer come back in */
    eject: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="square"><path d="M3.5 21.4V4.6h9v16.8"/><path d="M3.5 4.6h9"/>' +
      '<path d="M2 12.8h12"/><path d="M15.6 12.8h6.6"/><path d="M19 9.6l3.2 3.2-3.2 3.2"/></svg>',
  };

  /* folk names, used only until the silhouettes are learned. VOICE overrides with
     FZ.copy.tools[kind].folk. */
  var FOLK = {
    charter: 'MEETING STONE', vary: 'SEED', slow: 'BELL',
    lens: 'LANTERN', ledger: 'TALLY', eject: 'THRESHOLD',
  };
  /* the same thing, named short, for when the sandbox offers all six across a phone */
  var FOLK_TIGHT = {
    charter: 'ARCH', vary: 'SEED', slow: 'BELL',
    lens: 'LANTERN', ledger: 'TALLY', eject: 'GATE',
  };

  /* THE COLONY IS THE ANSWER SURFACE.
     Last round CHARTER and VARY auto-placed themselves at the focused incident, which
     meant the nest — eighty-five per cent of the screen — was inert to touch while the
     episode card was telling the player to put the stone where the trouble is. Every
     instrument that needs a coordinate is now ARMED, then PLACED with a tap on the nest,
     exactly as EJECT already worked.

     This is only meaningful because the nest is a movement graph (CONTRACT §16): a
     meeting stone goes AT A JUNCTION, and snapAim() below puts it on one, so the gesture
     the player makes is "this crossroads" and not "these coordinates". */
  var TARGETED = { eject: 1, charter: 1, vary: 1 };
  var NEEDS_XY = { eject: 1, charter: 1, vary: 1 };
  var LABELS_UNTIL = 6;               /* after this many answered, the shape is enough */
  var NOTE_MS = 2400;                 /* how long a correction owns the one message region */

  var field = null, tagLayer = null, act = null, actRow = null;
  var tagNode = null, tagName = null, tagLine = null, tagFuse = null, thread = null;
  var made = new Map();               /* kind -> button node */
  var have = [];                      /* kinds currently offered, in ORDER order */
  var avail = [];                     /* kinds this chapter has taught */
  var wired = false, built = false;
  var note = null;                    /* {text, tone, until} — the one transient message */
  var lastKey = '';
  var api;

  function copyTool(k) { return (FZ.copy && FZ.copy.tools && FZ.copy.tools[k]) || {}; }
  function ui(k) { return (FZ.copy && FZ.copy.ui && FZ.copy.ui[k]) || ''; }
  function loop(k) { return (FZ.copy && FZ.copy.loop && FZ.copy.loop[k]) || ''; }
  function folk(k, tight) {
    var c = copyTool(k);
    if (tight && (c.folkShort || FOLK_TIGHT[k])) return c.folkShort || FOLK_TIGHT[k];
    return c.folk || FOLK[k] || k.toUpperCase();
  }
  /* the one line an armed instrument says, and it is an instruction to touch the colony:
     "Put it where the trouble is." / "Point at a worker." Both already exist in FZ.copy,
     which is where every word in this build comes from. */
  function aimLine(kind) { return ui(kind === 'eject' ? 'tapAgent' : 'tapField'); }
  function S() { return FZ.sim ? FZ.sim.state : null; }
  function ob() { return FZ.outbreak || null; }
  function now() { return Date.now(); }

  /* ---------------------------------------------------------------- the paper */
  var CSS =
    '#bar{display:none!important}#toast{display:none!important}#aimHint{display:none!important}' +
    '#tagLayer{position:fixed;inset:0;z-index:40;pointer-events:none;font-family:inherit}' +
    '.fztag{position:absolute;width:230px;max-width:78vw;background:#f5efe3;color:#17150f;' +
    'border:1px solid rgba(0,0,0,.55);border-left:0;box-shadow:3px 4px 0 rgba(0,0,0,.28);' +
    'padding:8px 10px 9px 13px;opacity:0;transform:translateY(4px);' +
    'transition:opacity .16s ease-out,transform .16s ease-out}' +
    '.fztag.on{opacity:1;transform:none}' +
    '.fztag .fzfuse{position:absolute;left:0;bottom:0;width:4px;height:100%;background:#ffd23f}' +
    '.fztag.hot .fzfuse{background:#ff2e2e}' +
    '.fztag.note .fzfuse{background:#ff2e2e;height:100%}' +
    '.fztag .fzn{font-size:11.5px;font-weight:700;letter-spacing:.11em;line-height:1.2}' +
    '.fztag .fzl{font-size:11.5px;line-height:1.4;margin-top:5px;color:#4a4335}' +
    '.fztag.note .fzl{color:#17150f}' +
    '.fzthread{position:absolute;height:0;border-top:1px dashed rgba(0,0,0,.5);' +
    'transform-origin:0 0;opacity:0;transition:opacity .16s ease-out}' +
    '.fzthread.on{opacity:1}' +
    '#act{position:fixed;left:0;right:0;bottom:0;z-index:41;display:flex;gap:6px;' +
    'justify-content:center;align-items:flex-end;padding:10px 6px;' +
    'padding-bottom:calc(10px + env(safe-area-inset-bottom));font-family:inherit}' +
    '#act .fzrow{display:flex;gap:5px;justify-content:center;flex-wrap:nowrap;width:100%}' +
    '.fzact{position:relative;flex:1 1 0;min-width:0;max-width:112px;min-height:62px;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;' +
    'background:#f5efe3;color:#17150f;border:1.5px solid #17150f;' +
    'box-shadow:2px 3px 0 rgba(0,0,0,.4);padding:6px 3px 5px;cursor:pointer;' +
    'font-family:inherit;-webkit-tap-highlight-color:transparent;' +
    'animation:fzactin .2s ease-out 1}' +
    '.fzact svg{width:26px;height:26px;display:block}' +
    '.fzact .fzf{font-size:8px;letter-spacing:.02em;line-height:1;white-space:nowrap;' +
    'max-width:100%;overflow:hidden}' +
    '.fzact .fzc{position:absolute;top:2px;right:3px;font-size:8.5px;color:rgba(0,0,0,.45)}' +
    '.fzact.on{background:#17150f;color:#f5efe3;border-color:#17150f}' +
    '.fzact.on .fzc{color:rgba(255,255,255,.6)}' +
    '.fzact.poor{opacity:.34}' +
    '.fzact.live{box-shadow:2px 3px 0 rgba(0,0,0,.4),inset 0 -4px 0 #19e6c8}' +
    '.fzact:active{transform:translate(1px,1px);box-shadow:1px 2px 0 rgba(0,0,0,.4)}' +
    '@keyframes fzactin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';

  function ensure() {
    if (built) return;
    if (!document.getElementById('fzActCSS')) {
      var s = document.createElement('style');
      s.id = 'fzActCSS';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    var host = document.getElementById('app') || document.body;
    tagLayer = document.getElementById('tagLayer');
    if (!tagLayer) {
      tagLayer = document.createElement('div');
      tagLayer.id = 'tagLayer';
      host.appendChild(tagLayer);
    }
    thread = document.createElement('div');
    thread.className = 'fzthread';
    tagNode = document.createElement('div');
    tagNode.className = 'fztag';
    tagFuse = document.createElement('div'); tagFuse.className = 'fzfuse';
    tagName = document.createElement('div'); tagName.className = 'fzn';
    tagLine = document.createElement('div'); tagLine.className = 'fzl';
    tagNode.appendChild(tagFuse); tagNode.appendChild(tagName); tagNode.appendChild(tagLine);
    tagLayer.appendChild(thread);
    tagLayer.appendChild(tagNode);

    act = document.getElementById('act');
    if (!act) {
      act = document.createElement('div');
      act.id = 'act';
      host.appendChild(act);
    }
    actRow = document.createElement('div');
    actRow.className = 'fzrow';
    act.appendChild(actRow);
    act.style.display = 'none';
    built = true;
  }

  /* ------------------------------------------------------------- the buttons */
  function makeButton(kind) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fzact';
    b.setAttribute('data-kind', kind);
    b.setAttribute('aria-label', folk(kind));
    var g = document.createElement('span');
    g.className = 'fzg';
    g.innerHTML = MARK[kind] || '';
    var l = document.createElement('span');
    l.className = 'fzf';
    l.textContent = folk(kind);
    var c = document.createElement('span');
    c.className = 'fzc';
    c.textContent = String(FZ.sim ? FZ.sim.cost(kind) : 2);
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

  function burning() {
    var o = ob();
    if (!o) return null;
    try { return o.current() || o.urgent(); } catch (e) { return null; }
  }

  function press(kind) {
    var st = S();
    if (!st || !live()) return;
    if (st.budget < FZ.sim.cost(kind)) { say(ui('noBudget'), 'bad'); return; }
    if (TARGETED[kind]) {
      if (api.armed === kind) { disarm(); return; }
      api.armed = kind;
      note = null;                            /* the instrument in hand outranks old news */
      /* the instrument comes up already resting on the trouble, so the player can see
         what placing it would cover before touching anything — and can carry it
         somewhere else, which is the decision. */
      api.aim = null;
      var o = burning();
      if (o) {
        var p = snapAim(kind, o.x, o.y);
        if (kind !== 'eject' || p.x !== o.x || p.y !== o.y) api.aim = { kind: kind, x: p.x, y: p.y };
      }
      paint(st);
      return;
    }
    /* the bell, the lantern and the tally are rung, lit and kept for the WHOLE colony —
       there is nowhere to put them, so they need no gesture but the press. */
    disarm();
    var cur = burning();
    if (!cur && NEEDS_XY[kind]) return;       /* nowhere to put it and nothing to answer */
    commit(kind, cur ? cur.x : null, cur ? cur.y : null);
  }

  function disarm() {
    api.armed = null;
    api.aim = null;
  }

  function commit(kind, x, y) {
    var st = S();
    if (!st || !live()) return;
    if (st.budget < FZ.sim.cost(kind)) { say(ui('noBudget'), 'bad'); return; }

    /* the diagnosis is judged BEFORE the spend, so a right answer can be paid back and a
       wrong one can say what the failure actually is — including, for an expulsion, that
       the body you removed was not the one doing it. */
    var ans = null;
    if (ob() && ob().tryAnswer) {
      try { ans = ob().tryAnswer(kind, x, y); } catch (e) { ans = null; }
    }

    /* ------------------------------------------------------------------------------
       A THUMB ERROR MUST NOT END A CHAPTER.

       Measured on the shipped build: a critic armed the meeting stone, put it down three
       hundred and forty pixels from the incident, went from four food to one, and was
       then REFUSED the correct placement for lack of food. The chapter was over because
       a finger landed in the wrong place — and this is a phone, where a thumb is nine
       millimetres wide and the nest is three hundred and ninety.

       So a placement that lands inside no incident is not charged and not applied. It is
       not even a mistake: the instrument stays IN HAND, the one message region says where
       it belongs, and the player simply puts it down again. Being wrong about WHICH
       failure this is still costs — that is the lesson and it is priced. Missing with
       your thumb is not a diagnosis, so it is priced at nothing.
       ------------------------------------------------------------------------------ */
    if (NEEDS_XY[kind] && (!ans || !ans.hit)) {
      say((ans && ans.msg) || loop('tooFar') || aimLine(kind), 'bad');
      api.armed = kind;                        /* still in hand — try again, free */
      api.aim = null;
      paint(st);
      return;
    }

    var out = FZ.sim.apply(kind, NEEDS_XY[kind] ? x : undefined, NEEDS_XY[kind] ? y : undefined);

    /* nothing was spent -> say why, and never claim an answer that did not happen.
       A right answer says NOTHING: the ring visibly closes, the strain drops, the tag
       goes away. That is the whole receipt, and it is drawn, not written. */
    if (out && !out.ok) { if (out.msg) say(out.msg, 'bad'); }
    else if (ans && ans.hit && !ans.right && ans.msg) say(ans.msg, 'bad');
    else if (ans && !ans.hit && ans.msg) say(ans.msg, 'bad');
    paint(st);
  }

  /* ------------------------------------------------------------ where it lands
     A thumb is nine millimetres wide and the thing it is pointing at is a crossroads
     twelve pixels across. So the tap names a FEATURE, not a coordinate: the instrument
     is carried to the nearest thing it can actually be built on, and the preview is
     drawn there, so what the player sees before committing is what happens.

     This is forgiveness, not automation — the player still chooses WHICH crossroads,
     which crowd, which body, and choosing wrong is still wrong. */
  var SNAP_NODE = 62, SNAP_BODY = 74;

  function nearestNode(st, x, y, junctionBonus) {
    var N = (st.nest && st.nest.nodes) || [], E = (st.nest && st.nest.edges) || [];
    var best = null, bd = SNAP_NODE;
    for (var i = 0; i < N.length; i++) {
      var n = N[i];
      if (n.kind === 'surface') continue;
      var dx = n.x - x, dy = n.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (junctionBonus) {
        var ways = 0;
        for (var k = 0; k < n.edges.length; k++) { var e = E[n.edges[k]]; if (e && e.dug) ways++; }
        if (ways >= 3) d -= junctionBonus;
      }
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  function nearestBody(st, x, y, reach) {
    var best = null, bd = reach;
    for (var i = 0; i < st.agents.length; i++) {
      var a = st.agents[i], dx = a.x - x, dy = a.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  /* a tap inside a burning ring is an ANSWER, and nothing may carry it back out of the
     ring it was aimed at. Snapping is allowed to move the instrument to a feature; it is
     never allowed to turn a correct answer into a miss. */
  function inside(o, x, y) {
    if (!o) return false;
    var dx = o.x - x, dy = o.y - y;
    return dx * dx + dy * dy <= o.r * o.r;
  }
  function snapAim(kind, x, y) {
    var st = S();
    if (!st || x == null) return { x: x, y: y };
    var o = burning(), keep = inside(o, x, y), i, a, q;
    if (kind === 'charter') {
      /* the stone belongs on the ground it governs, and that ground is a crossroads */
      var n = nearestNode(st, x, y, 26);
      if (!n) return { x: x, y: y };
      if (keep && !inside(o, n.x, n.y)) return { x: x, y: y };
      return { x: n.x, y: n.y };
    }
    if (kind === 'vary') {
      /* a seed does nothing where there is nobody to take a different route */
      var R = (FZ.sim && FZ.sim.varyR) || 95, hit = false;
      for (i = 0; i < st.agents.length; i++) {
        a = st.agents[i];
        if (!a.corrigible) continue;
        var dx = a.x - x, dy = a.y - y;
        if (dx * dx + dy * dy < R * R * 0.81) { hit = true; break; }
      }
      if (hit) return { x: x, y: y };
      var best = null, bd = 170;
      for (i = 0; i < st.agents.length; i++) {
        a = st.agents[i];
        if (!a.corrigible) continue;
        if (keep && !inside(o, a.x, a.y)) continue;
        q = Math.sqrt((a.x - x) * (a.x - x) + (a.y - y) * (a.y - y));
        if (q < bd) { bd = q; best = a; }
      }
      return best ? { x: best.x, y: best.y } : { x: x, y: y };
    }
    if (kind === 'eject') {
      var b = nearestBody(st, x, y, SNAP_BODY);
      return b ? { x: b.x, y: b.y } : { x: x, y: y };
    }
    return { x: x, y: y };
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
      if (p && api.armed) { p = snapAim(api.armed, p.x, p.y); api.aim = { kind: api.armed, x: p.x, y: p.y }; }
    });
    field.addEventListener('pointermove', function (ev) {
      if (!down || !api.armed) return;
      ev.preventDefault();
      var p = toWorld(ev);
      if (p) { p = snapAim(api.armed, p.x, p.y); api.aim = { kind: api.armed, x: p.x, y: p.y }; }
    });
    function up(ev) {
      if (!down) return;
      down = false;
      try { field.releasePointerCapture(ev.pointerId); } catch (e) { }
      var p = toWorld(ev) || (api.aim ? { x: api.aim.x, y: api.aim.y } : null);
      var kind = api.armed;
      disarm();
      if (!p) return;
      if (kind) { var q = snapAim(kind, p.x, p.y); commit(kind, q.x, q.y); return; }
      /* no instrument in hand: the tap is a look. If two incidents are live, this is how
         the player chooses which one the tag is about. Nothing opens, nothing pops. */
      if (ob() && ob().focusAt) { try { ob().focusAt(p.x, p.y); } catch (e) { } }
    }
    field.addEventListener('pointerup', up);
    field.addEventListener('pointercancel', function () { down = false; api.aim = null; });
  }

  /* ------------------------------------------------------- the one message */
  /* Everything the game has to say arrives here and nowhere else. A second message does
     not queue behind this one, it replaces it: two explanations of the same instant were
     the defining bug of the last build. */
  function say(text, tone) {
    if (!text) return;
    note = { text: text, tone: tone || 'plain', until: now() + NOTE_MS };
  }

  function hideTag() {
    if (!tagNode) return;
    if (tagNode.classList.contains('on')) tagNode.classList.remove('on');
    if (thread.classList.contains('on')) thread.classList.remove('on');
  }

  /* hang the tag beside the thing, on a thread, and clamp it into the field.
     ax/ay are viewport px of the incident centre; rr is its radius in viewport px. */
  function place(ax, ay, rr, r) {
    var w = tagNode.offsetWidth || 230, h = tagNode.offsetHeight || 54;
    var lx = Math.round(Math.min(Math.max(ax - w / 2, r.left + 8), r.right - w - 8));
    var above = ay - rr - 16 - h;
    var below = ay + rr + 16;
    var ly;
    if (above >= r.top + 6) ly = Math.round(above);
    else if (below + h <= r.bottom - 6) ly = Math.round(below);
    else ly = Math.round(Math.min(Math.max(ay - h / 2, r.top + 6), r.bottom - h - 6));
    tagNode.style.left = lx + 'px';
    tagNode.style.top = ly + 'px';

    /* the thread leaves the tag from whichever edge faces the thing it is tied to, so a
       tag hanging beside an incident still visibly belongs to that incident and not to
       one of the others burning elsewhere */
    var cx = lx + w / 2, cy = ly + h / 2;
    var vx = ax - cx, vy = ay - cy;
    if (!vx && !vy) { thread.classList.remove('on'); return; }
    var t = Math.min(vx ? (w / 2) / Math.abs(vx) : Infinity, vy ? (h / 2) / Math.abs(vy) : Infinity);
    var tx = cx + vx * t, ty = cy + vy * t;
    var dx = ax - tx, dy = ay - ty;
    var len = Math.sqrt(dx * dx + dy * dy) - Math.min(rr * 0.6, 30);
    if (len < 6) { thread.classList.remove('on'); return; }
    thread.style.left = tx + 'px';
    thread.style.top = ty + 'px';
    thread.style.width = Math.round(len) + 'px';
    thread.style.transform = 'rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) + 'deg)';
    thread.classList.add('on');
  }

  function placeLoose(r) {
    var w = tagNode.offsetWidth || 230, h = tagNode.offsetHeight || 54;
    var bh = (act && act.style.display !== 'none') ? (act.offsetHeight || 0) : 0;
    tagNode.style.left = Math.round(r.left + (r.width - w) / 2) + 'px';
    tagNode.style.top = Math.round(Math.min(r.bottom, window.innerHeight) - bh - h - 14) + 'px';
    thread.classList.remove('on');
  }

  /* ---------------------------------------------------------------- painting */
  function paintButtons(st, show) {
    if (show) {
      var want = [], set = {};
      avail.forEach(function (k) { if (MARK[k]) set[k] = 1; });
      ORDER.forEach(function (k) { if (set[k]) want.push(k); });
      var changed = want.length !== have.length;
      if (!changed) for (var i = 0; i < want.length; i++) if (want[i] !== have[i]) { changed = true; break; }
      if (changed) {
        have.forEach(function (k) {
          if (set[k]) return;
          var b = made.get(k);
          if (b && b.parentNode) b.parentNode.removeChild(b);
        });
        want.forEach(function (k) {
          var b = made.get(k) || makeButton(k);
          actRow.appendChild(b);
        });
        have = want;
      }
      /* the label is scaffolding: it holds a name to the shape until the shape is known,
         and then it goes, because a learned silhouette needs no caption (AESTHETIC §5) */
      var labels = true;
      try { labels = !ob() || ob().answeredCount() < LABELS_UNTIL; } catch (e) { }
      var tight = have.length > 4;
      made.forEach(function (b, kind) {
        if (!b.parentNode) return;
        var armed = api.armed === kind;
        if (b.classList.contains('on') !== armed) b.classList.toggle('on', armed);
        var lab = b.querySelector('.fzf');
        if (lab) {
          lab.style.display = labels ? '' : 'none';
          var want = folk(kind, tight);
          if (lab.textContent !== want) lab.textContent = want;
        }
        if (!st) return;
        var poor = st.budget < FZ.sim.cost(kind);
        if (b.classList.contains('poor') !== poor) b.classList.toggle('poor', poor);
        var on = (kind === 'lens' && st.lensOn) || (kind === 'ledger' && st.ledgerOn) ||
          (kind === 'slow' && st.tick < st.slowUntil);
        if (b.classList.contains('live') !== on) b.classList.toggle('live', on);
      });
      if (act.style.display === 'none') act.style.display = '';
      return;
    }
    /* ABSENT, not disabled: no decision, no surface, the colony owns the screen. */
    if (act.style.display !== 'none') {
      act.style.display = 'none';
      have.forEach(function (k) { var b = made.get(k); if (b && b.parentNode) b.parentNode.removeChild(b); });
      have = [];
    }
  }

  function paint(st) {
    ensure();
    st = st || S();
    var playing = live();
    var o = playing ? burning() : null;
    if (o && st && st.tick < o.tagAt) o = null;      /* beat one: a body, and no words yet */
    if (note && now() > note.until) note = null;
    /* the incident settled itself while the instrument was in hand: put it down, or the
       surface it lives on vanishes and the next tap on the nest spends budget blind */
    if (api.armed && !o) disarm();

    paintButtons(st, !!(o && playing));

    /* THE ONE MESSAGE, chosen by a single priority so two can never coexist:
         1. a correction the player has just earned
         2. the instrument in her hand, and what it wants
         3. the incident that is burning
         4. nothing at all */
    var name = '', line = '', tone = '';
    if (note) { name = ''; line = note.text; tone = 'note'; }
    else if (api.armed) { name = o ? (o.name || '') : ''; line = aimLine(api.armed); }
    else if (o) { name = o.name || ''; line = o.line || ''; }

    if (!name && !line) { hideTag(); lastKey = ''; return; }

    var key = name + '' + line + '' + tone;
    if (key !== lastKey) {
      lastKey = key;
      tagName.textContent = name;
      tagName.style.display = name ? '' : 'none';
      tagLine.textContent = line;
      tagLine.style.display = line ? '' : 'none';
      tagNode.classList.toggle('note', tone === 'note');
    }

    /* the fuse is the tag's left edge. There is no other clock on screen. */
    var frac = 1;
    if (o && ob() && ob().left) { try { frac = ob().left(o); } catch (e) { frac = 1; } }
    if (tone === 'note') frac = 1;
    tagFuse.style.height = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    var hot = tone !== 'note' && frac < 0.34;
    if (tagNode.classList.contains('hot') !== hot) tagNode.classList.toggle('hot', hot);

    var r = field ? field.getBoundingClientRect() : null;
    if (o && r && r.width && st) {
      var sx = r.width / st.w, sy = r.height / st.h;
      place(r.left + o.x * sx, r.top + o.y * sy, o.r * Math.min(sx, sy), r);
    } else if (r && r.width) {
      placeLoose(r);
    }
    if (!tagNode.classList.contains('on')) tagNode.classList.add('on');
  }

  api = {
    armed: null,
    aim: null,

    build: function () {
      field = document.getElementById('field');
      ensure();
      wireField();
      var bar = document.getElementById('bar');
      if (bar) bar.innerHTML = '';
      if (FZ.bus) {
        FZ.bus.on('chapter:enter', function () { disarm(); note = null; });
        FZ.bus.on('lose', function () { disarm(); note = null; });
        FZ.bus.on('goal', function () { disarm(); note = null; });
        /* the correction is the teaching moment, and it is the ONLY thing said out loud */
        FZ.bus.on('outbreak:wrong', function (d) { if (d && d.msg) say(d.msg, 'bad'); });
      }
      paint(S());
    },

    /* ONLY these instruments are offered — and only while something is burning. */
    setAvailable: function (kinds) {
      avail = (kinds || []).filter(function (k) { return !!MARK[k]; });
      if (api.armed && avail.indexOf(api.armed) < 0) disarm();
      paint(S());
    },

    paint: paint,
    disarm: disarm,
    kinds: function () { return have.slice(); },
  };

  /* kept so nothing else in the build breaks reaching for it — but it writes into the one
     message region like everything else, never into a second strip. */
  FZ.ui = FZ.ui || {};
  FZ.ui.toast = function (msg, tone) { say(msg, tone); };

  return api;
})();
