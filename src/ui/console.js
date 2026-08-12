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

import { RIG } from '../sim/rig.js';
import { place as placePart, parse as parsePart, PARTS } from '../sim/build.js';
import { IMAGERY } from '../render/imagery.js';
import { house, parseHouse } from '../world/house.js';
import { BUS } from '../core/bus.js';
import { ATLAS } from '../sim/trace.js';

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
BUS.register('fire', (t) => /^(fire|shoot)\b/.test(t), () => { key('f'); return 'fired'; },
  'fire — the laser');
BUS.register('jump', (t) => /^jump\b/.test(t),
  () => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); return 'jumped'; },
  'jump');
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
  const cockpit = (on) => {
    document.body.classList.toggle('cockpit', on);
    try { localStorage.setItem('terrarium.cockpit', on ? '1' : ''); } catch (_) {}
  };
  let cockpitOn = true;
  try { cockpitOn = localStorage.getItem('terrarium.cockpit') !== ''; } catch (_) {}
  cockpit(cockpitOn);

  // ── the one line ─────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'rig-console';
  bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:62;display:flex;'
    + 'align-items:center;gap:8px;width:min(560px,92vw);background:rgba(10,14,18,.92);'
    + 'border:1px solid rgba(151,187,213,.25);border-radius:14px;padding:7px 9px;'
    + 'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);';

  let mi = 0;
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

  bar.append(chip, inp, send, burger);
  document.body.appendChild(bar);

  // ── the one menu: the same speech, with buttons ──────────────────────────
  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;top:56px;right:12px;z-index:63;display:none;flex-direction:column;gap:3px;'
    + 'width:196px;max-height:76vh;overflow:auto;background:rgba(10,14,18,.95);border:1px solid rgba(151,187,213,.25);'
    + 'border-radius:12px;padding:8px;backdrop-filter:blur(14px);box-shadow:0 14px 40px rgba(0,0,0,.55);';
  const section = (label) => {
    const h = document.createElement('div');
    h.textContent = label;
    h.style.cssText = 'font:800 8px/1 ui-monospace,monospace;letter-spacing:.28em;color:#7d8b95;padding:8px 6px 4px;';
    menu.appendChild(h);
  };
  const item = (label, hintText, fn) => {
    const b = document.createElement('button');
    b.innerHTML = '<span style="font:800 10px/1 ui-monospace,monospace;letter-spacing:.1em">' + label + '</span>'
      + '<span style="display:block;font:500 9px/1.3 system-ui,sans-serif;color:#7d8b95;margin-top:3px">' + hintText + '</span>';
    b.style.cssText = 'text-align:left;background:transparent;border:0;border-radius:8px;color:#cfe8dd;'
      + 'padding:7px 6px;cursor:pointer;';
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,.06)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
    b.addEventListener('click', () => { fn(); menu.style.display = 'none'; });
    menu.appendChild(b);
  };
  // a menu item IS an utterance — the BUS hears the button exactly as it would
  // hear the words, verdicts and all
  const speak = (text) => flash(BUS.dispatch(text, { S, RIG }) || '…');

  section('play');
  item('DRIVE / PARK', 'the rig — V', () => speak(RIG.on ? 'park' : 'drive'));
  item('FRAME ALL', 'see the whole place — F', () => key('f'));
  item('GO TO', 'fly to a building by name — G', () => key('g'));
  item('EXPLORE', 'fetch the neighbouring ground — X', () => key('x'));

  section('atlas · unsettled 05');
  item('UNSETTLE', 'the alternative arrangement — a branch', () => speak('unsettle'));
  item('RESETTLE', 'the given returns, remembered', () => speak('resettle'));
  item('PRESSURE', 'read the dock aloud', () => speak('pressure'));
  item('TESTIFY', 'say "note: …" on the line', () => { mi = 2; paintMode(); inp.value = 'note: '; inp.focus(); });

  section('parts · unset');
  for (const k of Object.keys(PARTS)) {
    const P = PARTS[k];
    item(P.name.toUpperCase(), P.hint + ' — placed ahead, gate willing', () => speak('a ' + k));
  }

  section('ground');
  item('LAND ANYWHERE', 'the whole Earth answers — land <place>', () => {
    mi = 3; paintMode(); inp.value = 'land '; inp.focus();
  });
  item('AERIAL ON', 'drape the real photograph — Esri', () => speak('aerial'));
  item('AERIAL OFF', 'back to the palette', () => speak('aerial off'));
  item('HOUSE', 'a massed house — wings, roof, deck', () => speak('a house'));

  section('build');
  item('DRAW AN AREA', 'a loop becomes a region — D', () => key('d'));
  item('SUMMON', 'ask the operator to build it', () => { mi = 0; paintMode(); inp.focus(); });
  item('PROPOSE A TOWER', 'a watchtower on this spot', () => say('a watchtower here'));
  item('PROPOSE A GARDEN', 'planting on open ground', () => say('a garden here'));
  item('DOES IT FLOOD?', 'run the water over this ground', () => say('does this flood?'));

  section('system');
  item('EXPORT', 'take the place away — GeoJSON', () => click('exportBtn'));
  item('UNDO', 'the world remembers', () => key('z'));
  item('CREO PANELS', 'show / hide the editor instruments', () => {
    cockpitOn = !cockpitOn; cockpit(cockpitOn);
    flash(cockpitOn ? 'cockpit — the instruments are stowed' : 'the editor instruments are out');
  });
  item('FILM MODE', 'a clean frame for recording — H toggles', () => film(true));
  item('HELP', 'every verb the commons knows', () => speak('help'));

  document.body.appendChild(menu);
  burger.addEventListener('click', () => {
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.style.display = 'none'; });

  // ── THE BUILD RAIL: unset's operational surface, standing on screen ──────
  // Thunder Rigs never made you open a menu to build — the parts were AT HAND
  // while you drove. The rail is the same speech as the line (every chip is a
  // BUS utterance, gate and all), pinned where your thumb already is.
  const rail = document.createElement('div');
  rail.id = 'build-rail';
  rail.style.cssText = 'position:fixed;right:10px;top:50%;transform:translateY(-58%);z-index:60;'
    + 'display:flex;flex-direction:column;gap:5px;';
  const railChip = (label, title, utter) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText = 'width:52px;padding:7px 4px;border-radius:9px;cursor:pointer;'
      + 'border:1px solid rgba(151,187,213,.28);background:rgba(10,14,18,.86);color:#cfe8dd;'
      + 'font:800 8px/1 ui-monospace,monospace;letter-spacing:.08em;backdrop-filter:blur(10px);';
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,180,80,.18)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(10,14,18,.86)'; });
    b.addEventListener('click', () => speak(utter));
    rail.appendChild(b);
    return b;
  };
  for (const k of Object.keys(PARTS)) railChip(PARTS[k].name.toUpperCase(), PARTS[k].hint, 'a ' + k);
  railChip('HOUSE', 'a massed house, gate willing', 'a house');
  railChip('NOTE', 'plant testimony here', 'note: I was here');
  railChip('UNDO', 'the world remembers', 'undo');
  document.body.appendChild(rail);
  BUS.register('undo', (t) => /^undo\b/.test(t), () => { key('z'); return 'undone'; }, 'undo — take the last deed back');
  BUS.register('rail', (t) => /^rail\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|hide|no)\b/.test(raw.toLowerCase());
      rail.style.display = off ? 'none' : 'flex';
      return off ? 'rail stowed' : 'rail out';
    }, 'rail off / on — the build chips');

  return { bar, menu, flash };
}
