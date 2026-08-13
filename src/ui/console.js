// CONSOLE — one chat bar, one menu, ZERO private grammar.
//
// THE THEORY (L3, one BUS): there is ONE line and ONE menu; the MODE is a chip
// on the line, not a second bar; and the console PARSES NOTHING. Every verb it
// seems to know — drive, fire, a ramp, the aerial, a house, unsettle — is a
// registration on the COMMONS BUS (src/core/bus.js), which any organ can
// extend without touching this file. The menu is the same speech with buttons.
//
// AGENT  → CREO's operator: "a watchtower here", "why does this flood?"
// BUILD  → a shaped proposal phrased for the generators (tower/garden/drain…)
// SAY    → plain testimony about the place (CREO's note/say path)
// GAME   → whatever the BUS answers to — rig, parts, atlas, ground
//
// Replies come back on the line itself: the gate's verdicts, the atlas's
// pressure, "stepped 7 m clear" — the world answering, in words, where you
// spoke to it.

import { RIG, setEngineSound, engineSoundOn, press, setEffects, effectsOn } from '../sim/rig.js';
import { place as placePart, parse as parsePart, PARTS } from '../sim/build.js';
import { IMAGERY } from '../render/imagery.js';
import { house, parseHouse } from '../world/house.js';
import { BUS } from '../core/bus.js';
import { ATLAS } from '../sim/trace.js';
import { hasKey } from '../ai/operator.js';

const MODES = [
  ['AGENT', '#d8c9ff', 'rgba(159,122,234,.16)', 'rgba(159,122,234,.42)',
   'summon — a watchtower here · why does this flood? · three futures'],
  ['BUILD', '#ffd9a8', 'rgba(255,180,80,.14)', 'rgba(255,180,80,.40)',
   'build — a tower here · a garden · a drain along this path'],
  ['SAY',   '#9af0e6', 'rgba(57,198,187,.14)', 'rgba(57,198,187,.40)',
   'say — this floods when it rains · note: people cut through here'],
  ['GAME',  '#ffb4b4', 'rgba(216,75,78,.16)',  'rgba(216,75,78,.42)',
   'drive · a ramp · a house · unsettle · aerial · help'],
];

const say = (text) => {           // CREO's own line is the single destination
  const si = document.getElementById('sayInput');
  if (!si) return false;
  si.value = text;
  si.dispatchEvent(new Event('input', { bubbles: true }));
  si.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return true;
};
const click = (id) => { const b = document.getElementById(id); if (b) { b.click(); return true; } return false; };
const key = (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

// ── the rig's and the ground's verbs, registered like anyone else's ─────────
const houseSpot = (ctx) => {
  const S = ctx.S;
  const yaw = RIG.on ? RIG.yaw : (S.cam.yaw + Math.PI);
  const at = RIG.on ? [RIG.p[0] + Math.cos(yaw) * 16, RIG.p[1] + Math.sin(yaw) * 16]
                    : [S.cam.target[0], S.cam.target[1]];
  return { at, yaw };
};

BUS.register('drive', (t) => /^(drive|mount|get in)\b/.test(t),
  (m, ctx) => { if (!RIG.on) RIG.enter(ctx.S.world, ctx.S.cam); return 'driving'; },
  'drive — mount the rig');
BUS.register('park', (t) => /^(park|dismount|get out|stop)\b/.test(t),
  (m, ctx) => { if (RIG.on) RIG.exit(ctx.S.world, ctx.S.cam); return 'parked'; },
  'park — dismount');
BUS.register('fire', (t) => /^(fire|shoot|destroy)\b/.test(t),
  () => { press('fire'); return 'fired'; },
  'fire — the laser takes what it hits, and undo puts it back');
BUS.register('jump', (t) => /^jump\b/.test(t), () => { press('jump'); return 'jumped'; }, 'jump');
BUS.register('colour', (t) => t.match(/\b(teal|ember|amber|violet|bone|coal)\b/),
  (m) => {
    const map = { teal: [0.10, 0.88, 0.76], ember: [1, 0.32, 0.20], amber: [1, 0.80, 0.25],
      violet: [0.66, 0.48, 0.92], bone: [0.94, 0.95, 0.96], coal: [0.12, 0.13, 0.16] };
    RIG.color = map[m[1]]; return m[1];
  }, 'teal · ember · amber · violet · bone · coal — repaint the rig');

BUS.register('part',
  (t) => {
    const kind = parsePart(t);
    return kind && /\b(ramp|qpipe|block|beam|panel|cyl|build|place|drop|put|jump|pipe|wall|pillar|bar|cube)\b/.test(t)
      ? kind : null;
  },
  (kind, ctx) => {
    const r = placePart(ctx.S.world, kind, RIG);
    if (r && r.refused) return r.message;                       // the gate spoke
    if (!r) return 'nothing to place';
    return 'placed a ' + kind + (r.__offsetBy ? ' — stepped ' + Math.round(r.__offsetBy) + ' m clear' : '');
  },
  'a ramp · a block · a panel … — placed ahead, gate willing');

BUS.register('house',
  (t) => {
    const o = parseHouse(t);
    return o && /\b(house|home|cabin|cottage|shed|barn|lodge)\b/.test(t) ? o : null;
  },
  (o, ctx) => {
    const { at, yaw } = houseSpot(ctx);
    const made = house(ctx.S.world, at, yaw, o);
    if (made.refused) return made.message;                      // the gate spoke
    return 'a house of ' + made.length + ' parts'
      + (made.__offsetBy ? ' — stepped ' + Math.round(made.__offsetBy) + ' m clear' : '');
  },
  'a house · a big barn · a small cabin — massed, gated, journaled');

BUS.register('aerial', (t) => /\b(aerial|satellite|photo|imagery)\b/.test(t),
  (m, ctx, raw) => {
    if (/\b(off|hide|no)\b/.test(raw.toLowerCase())) {
      IMAGERY.off(); ctx.S.dirty = true; return 'aerial off — back to the palette';
    }
    IMAGERY.load(ctx.S.world).then((ok) => { if (ok) { ctx.S.dirty = true; dispatchEvent(new CustomEvent('rig:worldchanged')); } });
    return 'draping the aerial…';
  },
  'aerial on/off — the real photograph on the real ground');

BUS.register('labels', (t) => /^labels?\b/.test(t),
  (m, ctx, raw) => {
    ctx.S.labels = /\b(off|no|hide)\b/.test(raw.toLowerCase()) ? false : true;
    if (ctx.S.labels === false) { const h = document.getElementById('labels'); if (h) h.textContent = ''; }
    return ctx.S.labels === false ? 'labels off — just the place' : 'labels on';
  },
  'labels off / on — the name tags');

BUS.register('sound', (t) => /^(sound|audio|engine)\b/.test(t),
  (m, ctx, raw) => {
    const off = /\b(off|no|mute|stop)\b/.test(raw.toLowerCase());
    setEngineSound(!off);
    return off ? 'sound off' : 'sound on — a low motor, no mosquito';
  },
  'sound on / off — the engine (off by default)');

BUS.register('help', (t) => /^(help|verbs|\?)$/.test(t),
  () => { console.info('%c[BUS] ' + BUS.help().join('\n'), 'color:#6fe0c0'); return BUS.verbs.length + ' verbs — the full list is in the console'; },
  'help — list every verb the commons knows');

export function mountConsole(S) {
  if (document.getElementById('rig-console')) return;

  // ── COCKPIT MODE: the unset cockpit owns the screen ──────────────────────
  // The clutter complaint was right: two say-bars, a column of view icons and
  // five header chips is CREO's editor posture, not the HELLO, WORLD cockpit.
  // Default is the cockpit — one line, one menu, the dock, the wheel. CREO's
  // instruments stay one toggle away (they are still the organs underneath).
  const cockpitCss = document.createElement('style');
  cockpitCss.textContent = `
    body.cockpit #viewTools, body.cockpit #say,
    body.cockpit #whereAmI, body.cockpit #themeChip, body.cockpit #findChip,
    body.cockpit #setup { display: none !important; }
    /* The header row is GONE from the cockpit: the place is a chip on the line
       (◵), undo/redo and your name are in the menu, and the licence sits with
       the map it belongs to. Two rows fighting for the top of a phone screen
       was the whole problem — bounding them was treating a symptom. */
    body.cockpit #top { display: none !important; }
    /* Every edge, or none: overriding right/bottom while the sheet still set
       top/left stretched the licence into a 664px-tall invisible slab down the
       right of the world — a panel nobody could see and everybody could hit. */
    body.cockpit #attribution {
      top: auto !important; left: auto !important;
      right: 12px !important; bottom: 4px !important;
      width: 214px !important; max-width: 214px !important; height: auto !important;
      font-size: 8px !important; line-height: 1.3 !important; opacity: .5;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      pointer-events: none;
    }
    /* THE RIGHT COLUMN, pinned bottom-up: licence, meter, the thin dock, the
       plan, then the actions. Fixed offsets, so nothing floats into anything. */
    body.cockpit #plan { bottom: 100px !important; }

    /* EVERYTHING THAT SPEAKS COMES DOWN FROM THE LINE.
       CREO's panels — what you selected, a proposal, an answer, the futures —
       were anchored to the bottom-right, which is now where the ring lives, so
       they opened directly behind the biggest tool on screen. They belong to
       the bar (that is where the question was asked), so they drop from it,
       centred, and the bottom of the screen stays clear. */
    body.cockpit #tools, body.cockpit #proposal,
    body.cockpit #answer, body.cockpit #branches {
      left: 50% !important; right: auto !important;
      top: 66px !important; bottom: auto !important;
      transform: translateX(-50%) !important;
      width: min(560px, 92vw) !important; max-width: min(560px, 92vw) !important;
      max-height: min(62vh, 520px) !important; overflow: auto !important;
      border-radius: 14px !important; z-index: 64 !important;
    }
    body.cockpit #working {
      left: 50% !important; right: auto !important; transform: translateX(-50%) !important;
      top: 66px !important; bottom: auto !important; z-index: 65 !important;
    }
    /* The panels are bounded so they can never reach the ring's corner: they
       stop well above it, and the ring is never dimmed or disabled. */
    body.cockpit #tools, body.cockpit #proposal,
    body.cockpit #answer, body.cockpit #branches { max-height: min(58vh, 470px) !important; }

    /* ── EVERY MENU IS AN ARC ─────────────────────────────────────────────
       CREO's own lists — the place picker, the subject's actions — were tall
       rectangles dropped over the world. They are the same content as a curved
       strip: one row, scrolled sideways, hugging the line above it. Nothing
       here changes what they DO; it changes how much sky they take. */
    body.cockpit .menu.arc {
      position: fixed !important; top: 56px !important; left: 50% !important;
      transform: translateX(-50%) perspective(820px) rotateX(8deg) !important;
      transform-origin: 50% 0% !important; right: auto !important;
      display: flex !important; flex-direction: row !important;
      width: min(880px, 98vw) !important; max-width: none !important;
      max-height: none !important; height: auto !important;
      overflow-x: auto !important; overflow-y: visible !important;
      gap: 5px !important; padding: 9px 12px 12px !important;
      border-radius: 0 0 22px 22px !important;
      scrollbar-width: none;
      mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
    }
    body.cockpit .menu.arc::-webkit-scrollbar { display: none; }
    body.cockpit .menu.arc > button, body.cockpit .menu.arc > .menuLabel {
      flex: 0 0 auto !important; width: auto !important; max-width: 168px;
      border-radius: 10px !important; padding: 8px 10px !important;
      border: 1px solid rgba(151,187,213,.2) !important; background: rgba(10,14,18,.9) !important;
      transform-origin: 50% 140%; text-align: left !important; white-space: normal !important;
    }
    body.cockpit .menu.arc > .menuLabel {
      background: transparent !important; border: 0 !important; color: #7d8b95 !important;
      align-self: center; letter-spacing: .2em;
    }
    /* THE SEARCH PANEL stays a form (a text field is not a chip), but it drops
       from the line like everything else and is bounded so it never reaches the
       ring. "Take me anywhere…" opens this. */
    body.cockpit .menu.importPanel {
      position: fixed !important; top: 56px !important; left: 50% !important;
      transform: translateX(-50%) !important; right: auto !important;
      width: min(520px, 94vw) !important; max-height: min(60vh, 480px) !important;
      overflow: auto !important; border-radius: 14px !important; z-index: 66 !important;
    }
    /* THE KEY PANEL — where the AI features are switched on. It was hidden by
       cockpit mode with no way back except a menu item nobody could find. */
    body.cockpit #setup.show {
      display: block !important; position: fixed !important;
      top: 56px !important; left: 50% !important; transform: translateX(-50%) !important;
      right: auto !important; bottom: auto !important;
      width: min(460px, 94vw) !important; z-index: 67 !important;
    }
    /* the subject panel's actions become a swept row rather than a wrapped grid */
    body.cockpit #tools .row {
      display: flex !important; flex-wrap: nowrap !important; overflow-x: auto !important;
      gap: 5px !important; padding-bottom: 4px; scrollbar-width: none;
    }
    body.cockpit #tools .row::-webkit-scrollbar { display: none; }
    body.cockpit #tools .row > * { flex: 0 0 auto !important; }
    body.cockpit #tools .thread { max-height: 130px !important; overflow: auto !important; }
    /* FILM MODE — a clean frame for recording: everything but the world (and
       its labels, and the licence) steps aside. Say "film", or press H. */
    body.film #rig-console, body.film #build-rail, body.film #atlas-dock,
    body.film #top, body.film #plan, body.film #tools, body.film #toast,
    body.film #rig-dock, body.film #rig-hint, body.film #rig-chrome,
    body.film #frameOffer, body.film #exploreHint, body.film #working,
    body.film #waterLegend, body.film #youAreHere, body.film #say,
    body.film #viewTools, body.film #setup, body.film #crosshair,
    body.film #rig-reply { display: none !important; }
  `;
  document.head.appendChild(cockpitCss);
  const film = (on) => document.body.classList.toggle('film', on);
  addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
      film(!document.body.classList.contains('film'));
    }
  });
  BUS.register('film', (t) => /^(film|cinema|record)\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|end|stop)\b/.test(raw.toLowerCase());
      film(!off);
      return off ? 'the instruments return' : 'film — press H to bring the instruments back';
    },
    'film / film off — a clean frame for recording (H toggles)');
  // Stored as a WORD, not a falsy value. It was written as '' for off, which
  // is indistinguishable from "never set" in half the ways you can read it —
  // and one stray write left the editor's whole panel set on top of the world
  // with no way to tell whether that was a choice or a bug. Missing means on.
  const cockpit = (on) => {
    document.body.classList.toggle('cockpit', on);
    try { localStorage.setItem('terrarium.cockpit', on ? 'on' : 'off'); } catch (_) {}
  };
  let cockpitOn = true;
  try { cockpitOn = localStorage.getItem('terrarium.cockpit') !== 'off'; } catch (_) {}
  cockpit(cockpitOn);

  // ── the one line ─────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'rig-console';
  bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:62;display:flex;'
    + 'align-items:center;gap:8px;width:min(560px,92vw);background:rgba(10,14,18,.92);'
    + 'border:1px solid rgba(151,187,213,.25);border-radius:14px;padding:7px 9px;'
    + 'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);';

  // WHERE YOU ARE IS A CHIP ON THE LINE. CREO's header — place picker, author,
  // undo, redo, licence — was a second row competing with the bar for the top
  // of the screen, and on a narrow window it lost. The place becomes one small
  // map chip at the LEFT of the line (it opens the same picker), and the rest
  // of that row moves into the menu, where lists belong.
  let mi = 0;
  const placeBtn = document.createElement('button');
  placeBtn.title = 'where you are — tap for the places, or say: land <anywhere>';
  placeBtn.style.cssText = 'flex:0 0 auto;max-width:116px;overflow:hidden;text-overflow:ellipsis;'
    + 'white-space:nowrap;border-radius:8px;cursor:pointer;padding:7px 8px;'
    + 'border:1px solid rgba(151,187,213,.28);background:rgba(255,255,255,.05);color:#cfe8dd;'
    + 'font:700 9px/1 ui-monospace,monospace;letter-spacing:.06em;';
  const paintPlace = () => {
    const n = document.getElementById('placeName');
    placeBtn.textContent = '◵ ' + ((n && n.textContent) || 'PLACE').toUpperCase();
  };
  placeBtn.addEventListener('click', () => { const c = document.getElementById('placeChip'); if (c) c.click(); });
  paintPlace();
  const nameEl = document.getElementById('placeName');
  if (nameEl && typeof MutationObserver === 'function') {
    new MutationObserver(paintPlace).observe(nameEl, { childList: true, characterData: true, subtree: true });
  }

  const chip = document.createElement('button');
  chip.style.cssText = 'flex:0 0 auto;border-radius:8px;font:800 9px/1 ui-monospace,monospace;'
    + 'letter-spacing:.1em;padding:7px 9px;cursor:pointer;';
  const inp = document.createElement('input');
  inp.style.cssText = 'flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e8edf2;'
    + 'font:500 13px/1.2 system-ui,-apple-system,sans-serif;';
  const paintMode = () => {
    const [name, fg, bg, bd, ph] = MODES[mi];
    chip.textContent = name; chip.style.color = fg; chip.style.background = bg;
    chip.style.border = '1px solid ' + bd; inp.placeholder = ph;
  };
  chip.addEventListener('click', () => { mi = (mi + 1) % MODES.length; paintMode(); inp.focus(); });
  paintMode();

  // ── the reply line: where the world answers in words ─────────────────────
  const reply = document.createElement('div');
  reply.id = 'rig-reply';
  reply.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:61;'
    + 'max-width:min(540px,90vw);background:rgba(10,14,18,.88);border:1px solid rgba(151,187,213,.2);'
    + 'border-radius:9px;padding:6px 12px;color:#9af0e6;font:600 11px/1.4 ui-monospace,monospace;'
    + 'letter-spacing:.04em;opacity:0;transition:opacity .25s;pointer-events:none;';
  document.body.appendChild(reply);
  let replyT = 0;
  const flash = (text) => {
    if (!text) return;
    reply.textContent = String(text);
    reply.style.opacity = '1';
    clearTimeout(replyT);
    replyT = setTimeout(() => { reply.style.opacity = '0'; }, 3200);
  };

  const send = document.createElement('button');
  send.textContent = '➤';
  send.style.cssText = 'flex:0 0 auto;width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;'
    + 'background:#df5a5d;color:#fff;font-size:14px;';

  const go = () => {
    const text = inp.value.trim(); if (!text) return;
    const mode = MODES[mi][0];
    inp.value = '';
    // "note:" and "land" work from any mode — testimony and travel are not modal
    if (/^note[:,]/i.test(text) || /^(land|terra)\b/i.test(text) || mode === 'GAME') {
      const r = BUS.dispatch(text, { S, RIG });
      if (r !== null) { flash(r); return; }
      if (mode === 'GAME') { flash('the commons knows no such verb — try help'); return; }
    }
    // every other mode ends in CREO's own operator — one mind, many mouths
    say(mode === 'BUILD' ? text.replace(/^(build|make|put)\s+/i, '') : text);
  };
  send.addEventListener('click', go);
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
  // Tab cycles the mode — unset's muscle memory, one hand
  inp.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); chip.click(); } });

  const burger = document.createElement('button');
  burger.textContent = '≡';
  burger.style.cssText = 'flex:0 0 auto;width:32px;height:32px;border-radius:9px;cursor:pointer;'
    + 'border:1px solid rgba(151,187,213,.3);background:rgba(255,255,255,.05);color:#cfe8dd;font-size:15px;';

  bar.append(placeBtn, chip, inp, send, burger);
  document.body.appendChild(bar);

  // ── the one menu: the same speech, with buttons ──────────────────────────
  // THE ARC. A menu is a shelf, and a shelf across the middle of a windscreen
  // is a blindfold — every version of this so far covered the thing you were
  // driving. So the menu became an ARC along the top edge: two shallow rows of
  // chips that curve with the frame, scrolled sideways rather than stacked
  // downwards, never more than ~110px tall. The world keeps everything below.
  //
  // Row one is the SUBJECTS (place · build · record · view · ask); row two is
  // that subject's verbs. Both scroll horizontally, and every chip is still an
  // utterance on the BUS — the arc changed the shelf, not the language.
  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:63;display:none;'
    + 'flex-direction:column;gap:5px;width:min(760px,98vw);padding:0 2px;pointer-events:none;';

  const arcRow = (curve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:5px;overflow-x:auto;overflow-y:visible;padding:8px 10px 10px;'
      + 'scrollbar-width:none;-ms-overflow-style:none;pointer-events:auto;'
      + 'mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);'
      + '-webkit-mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);';
    wrap.dataset.curve = curve;
    return wrap;
  };
  // A REAL CURVE, NOT SKEWED BOXES. Rotating each chip a few degrees gave a
  // ragged, off-axis row — every edge fighting its neighbour, which is exactly
  // the "sloppy" of it. The strip is instead tipped into the screen as ONE
  // plane (perspective + rotateX), so the type stays crisp and axis-aligned
  // while the whole ribbon reads as curving away from you.
  const curveChips = (row) => {
    for (const k of row.children) k.style.transform = '';     // undo the old skew
    row.style.transformOrigin = '50% 0%';
    row.style.transform = 'perspective(820px) rotateX(8deg)';
  };

  // CREO'S OWN MENUS JOIN THE ARC. The place picker is built fresh by app.js
  // every time it opens, so it cannot be styled once — it is caught as it is
  // added to the page, given the arc class, and curved. The list of places is
  // now a strip you sweep along the top instead of a column down the world.
  if (typeof MutationObserver === 'function') {
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (!(n instanceof HTMLElement) || !n.classList.contains('menu')) continue;
          if (n.classList.contains('importPanel')) continue;   // a form, not a list
          n.classList.add('arc');     // the curve is in the sheet, not in a frame
        }
      }
    }).observe(document.body, { childList: true });
  }
  const subjects = arcRow('top');
  const verbs = arcRow('bottom');
  menu.append(subjects, verbs);

  const GROUPS = [];                 // [{ name, tint, items:[{label,hint,fn}] }]
  let current = null;
  const section = (label, tint) => { GROUPS.push({ name: label, tint: tint || '#9fb4ad', items: [] }); };
  const item = (label, hintText, fn) => {
    if (GROUPS.length) GROUPS[GROUPS.length - 1].items.push({ label, hint: hintText, fn });
  };
  const arcChip = (label, hint, tint, on, fn) => {
    const b = document.createElement('button');
    b.innerHTML = '<span style="font:800 9px/1 ui-monospace,monospace;letter-spacing:.12em">' + label + '</span>'
      + (hint ? '<span style="display:block;font:500 8px/1.25 system-ui,sans-serif;color:#8d9aa5;margin-top:3px;'
        + 'max-width:104px;white-space:normal">' + hint + '</span>' : '');
    b.style.cssText = 'flex:0 0 auto;text-align:left;border-radius:10px;cursor:pointer;padding:8px 10px;'
      + 'background:' + (on ? 'rgba(255,255,255,.12)' : 'rgba(10,14,18,.92)') + ';'
      + 'border:1px solid ' + (on ? tint : 'rgba(151,187,213,.22)') + ';color:' + (on ? tint : '#cfe8dd') + ';'
      + 'backdrop-filter:blur(12px);transition:transform .12s,background .12s;transform-origin:50% 120%;';
    b.addEventListener('click', fn);
    return b;
  };
  // WHERE THE KEY GOES. CREO's setup panel is the real thing (it stores the
  // key in this browser and never sends it anywhere else); cockpit mode hid it,
  // which left the AI features with no visible door at all. This is the door.
  const openKeyPanel = () => {
    const el = document.getElementById('setup');
    if (!el) return flash('no key panel in this build');
    el.hidden = false;
    el.classList.add('show');
    const done = document.getElementById('setupDone');
    const close = document.getElementById('setupClose');
    const hide = () => { el.classList.remove('show'); el.hidden = true; };
    if (done) done.onclick = hide;
    if (close) close.onclick = hide;
    setTimeout(() => { const k = document.getElementById('setupKey'); if (k) k.focus(); }, 60);
    flash('paste a key — it stays in this browser');
  };
  BUS.register('key', (t) => /^(key|api key|add a key|sign in)\b/.test(t),
    () => { openKeyPanel(); return 'the key panel is open — it stays in this browser'; },
    'key — where the AI features are switched on');

  const paintArc = () => {
    subjects.textContent = '';
    for (const g of GROUPS) {
      subjects.appendChild(arcChip(g.name.toUpperCase(), '', g.tint, g === current, () => {
        current = g === current ? null : g;
        paintArc();
      }));
    }
    verbs.textContent = '';
    verbs.style.display = current ? 'flex' : 'none';
    if (current) {
      for (const it of current.items) {
        verbs.appendChild(arcChip(it.label, it.hint, current.tint, false, () => {
          it.fn();
          menu.style.display = 'none'; markOpen();
        }));
      }
    }
    curveChips(subjects);
    if (current) curveChips(verbs);
  };
  // a menu item IS an utterance — the BUS hears the button exactly as it would
  // hear the words, verdicts and all
  const speak = (text) => flash(BUS.dispatch(text, { S, RIG }) || '…');

  // EVERY ITEM MUST CHANGE THE WORLD OR CHANGE WHAT YOU SEE OF IT.
  //
  // The old menu had thirty entries and most were furniture: the six parts and
  // HOUSE (the ⊞ palette owns those now), FRAME ALL and EXPLORE (the ring owns
  // those), PRESSURE (reads a meter that is on screen), SUMMON (focuses a text
  // box). Those are not operations, they are a list of nouns — which is why it
  // was unreadable and why nothing seemed to do anything. What is left either
  // moves the ground, changes the record, or changes what is drawn.
  section('place', '#6fe0c0');
  item('PLACES', 'everywhere in this browser', () => { const c = document.getElementById('placeChip'); if (c) c.click(); });
  item('LAND ANYWHERE', 'real ground — land <place>', () => { mi = 3; paintMode(); inp.value = 'land '; inp.focus(); });
  item('GO TO', 'fly to a building by name — G', () => key('g'));
  item('AERIAL', 'the real photograph, on / off', () => speak(IMAGERY.on ? 'aerial off' : 'aerial'));

  section('build', '#ffd9a8');
  item('TESTIFY', 'plant a standing note here', () => { mi = 2; paintMode(); inp.value = 'note: '; inp.focus(); });
  item('DRAW AN AREA', 'a loop becomes a region — D', () => key('d'));
  item('UNSETTLE', 'the alternative arrangement — a branch', () => speak('unsettle'));
  item('RESETTLE', 'the given returns, remembered', () => speak('resettle'));
  item('UNDO', 'the world remembers', () => key('z'));
  item('REDO', 'put it back', () => { const r = document.getElementById('redoBtn'); if (r) r.click(); });
  item('EXPORT', 'take the place away — GeoJSON', () => click('exportBtn'));
  item('YOUR NAME', 'who changed what', () => { const a = document.getElementById('authorChip'); if (a) a.click(); });

  section('view', '#9ec9ff');
  item('LABELS', 'name tags, on / off', () => speak(S.labels === false ? 'labels on' : 'labels off'));
  item('MAP', 'stow the ring — M', () => speak(document.body.classList.contains('ring-stowed') ? 'map on' : 'map off'));
  item('ENGINE', 'the motor drone — off by default', () => speak(engineSoundOn() ? 'sound off' : 'sound on'));
  item('EFFECTS', 'shots, hits, crashes — on', () => {
    const on = setEffects(!effectsOn());
    flash(on ? 'effects on — shots and crashes speak' : 'effects off');
  });
  item('FILM MODE', 'a clean frame for recording — H', () => film(true));
  item('CREO PANELS', 'the editor instruments, on / off', () => {
    cockpitOn = !cockpitOn; cockpit(cockpitOn);
    flash(cockpitOn ? 'cockpit — the instruments are stowed' : 'the editor instruments are out');
  });
  item('HELP', 'every verb the commons knows', () => speak('help'));

  // The operator's proposals only exist when it can think. Offering them
  // without a key is the definition of a dead operation.
  if (hasKey()) {
    section('ask', '#d8c9ff');
    item('PROPOSE A TOWER', 'a watchtower on this spot', () => say('a watchtower here'));
    item('DOES IT FLOOD?', 'run the water over this ground', () => say('does this flood?'));
    item('THE KEY', 'change or remove it — stays in this browser', () => openKeyPanel());
  } else {
    section('ask', '#d8c9ff');
    item('ADD A KEY', 'switch on the thinking — Anthropic or OpenAI', () => openKeyPanel());
  }

  document.body.appendChild(menu);
  burger.addEventListener('click', () => {
    const opening = menu.style.display === 'none' || !menu.style.display;
    if (opening) paintArc();
    menu.style.display = opening ? 'flex' : 'none';
    markOpen();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { menu.style.display = 'none'; markOpen(); } });
  addEventListener('pointerdown', (e) => {
    if (menu.style.display === 'flex' && !menu.contains(e.target) && e.target !== burger) {
      menu.style.display = 'none'; markOpen();
    }
  }, true);

  // ── THE BUILD RAIL: unset's operational surface, standing on screen ──────
  // Thunder Rigs never made you open a menu to build — the parts were AT HAND
  // while you drove. The rail is the same speech as the line (every chip is a
  // BUS utterance, gate and all), pinned where your thumb already is.
  // ONE CHIP, NOT NINE. The rail was a permanent column of nine buttons down
  // the right edge — a toolbar pretending to be a cockpit, in front of the
  // world, on every frame, whether or not you were building. It is now a
  // single BUILD chip that opens the palette when you mean to build and gets
  // out of the way when you do not. Same verbs, same gate, same BUS: what
  // changed is that the screen belongs to the place again.
  // THE PALETTE HANGS FROM THE LINE. A floating chip in the corner of the
  // world was still a thing in front of the world; and building is speech —
  // "a ramp" typed and RAMP tapped are the same utterance — so the handle
  // belongs ON the bar that speech already lives in, and the palette drops
  // beneath it like any menu. The world keeps its corners.
  const rail = document.createElement('div');
  rail.id = 'build-rail';
  rail.style.cssText = 'position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:63;'
    + 'display:flex;flex-direction:column;align-items:center;width:min(560px,92vw);';

  const railBtn = document.createElement('button');   // lives in the bar, below
  railBtn.textContent = '⊞';
  railBtn.title = 'the parts palette — ramps, blocks, a house, a note (B)';
  railBtn.style.cssText = 'flex:0 0 auto;width:32px;height:32px;border-radius:9px;cursor:pointer;'
    + 'border:1px solid rgba(255,180,80,.4);background:rgba(28,19,8,.86);color:#ffd9a8;'
    + 'font:700 15px/1 ui-monospace,monospace;';

  const palette = document.createElement('div');
  // the palette is an arc as well: one swept row of parts, not a grid slab
  palette.style.cssText = 'display:none;flex-direction:row;gap:5px;width:100%;overflow-x:auto;'
    + 'overflow-y:visible;scrollbar-width:none;padding:8px 10px 12px;'
    + 'background:rgba(10,14,18,.95);border:1px solid rgba(151,187,213,.25);border-radius:0 0 20px 20px;'
    + 'backdrop-filter:blur(12px);box-shadow:0 12px 34px rgba(0,0,0,.55);'
    + 'mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);'
    + '-webkit-mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);';
  const paletteBtn = (label, title, utter) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText = 'flex:0 0 auto;padding:9px 12px;border-radius:10px;cursor:pointer;'
      + 'border:1px solid rgba(151,187,213,.22);background:rgba(255,255,255,.04);color:#cfe8dd;'
      + 'font:800 8px/1 ui-monospace,monospace;letter-spacing:.1em;transform-origin:50% 140%;';
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,180,80,.18)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(255,255,255,.04)'; });
    b.addEventListener('click', () => speak(utter));
    palette.appendChild(b);
    return b;
  };
  for (const k of Object.keys(PARTS)) paletteBtn(PARTS[k].name.toUpperCase(), PARTS[k].hint, 'a ' + k);
  paletteBtn('HOUSE', 'a massed house, gate willing', 'a house');
  paletteBtn('NOTE', 'plant testimony here', 'note: I was here');
  paletteBtn('UNDO', 'the world remembers', 'undo');

  // whatever is open owns the screen: the ring fades while it is (see ring.js)
  const markOpen = () => document.body.classList.toggle('menu-open',
    palette.style.display !== 'none' || menu.style.display === 'flex');
  const showPalette = (on) => {
    palette.style.display = on ? 'flex' : 'none';
    if (on) requestAnimationFrame(() => curveChips(palette));
    railBtn.style.background = on ? 'rgba(255,180,80,.26)' : 'rgba(28,19,8,.86)';
    markOpen();
  };
  railBtn.addEventListener('click', () => showPalette(palette.style.display === 'none'));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') showPalette(false);
    // B opens the palette — the one key the cockpit adds, and it is a noun
    if ((e.key === 'b' || e.key === 'B') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
      showPalette(palette.style.display === 'none');
    }
  });
  rail.append(palette);                     // the handle itself sits in the bar
  document.body.appendChild(rail);
  bar.insertBefore(railBtn, burger);        // ⊞ beside the send arrow and menu
  BUS.register('undo', (t) => /^undo\b/.test(t), () => { key('z'); return 'undone'; }, 'undo — take the last deed back');
  BUS.register('rail', (t) => /^rail\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|hide|no)\b/.test(raw.toLowerCase());
      rail.style.display = off ? 'none' : 'grid';
      return off ? 'rail stowed' : 'rail out';
    }, 'rail off / on — the build chips');

  return { bar, menu, flash };
}
