// THE RING — one instrument where there were five.
//
// The right-hand side had become a stack: three action buttons, a dock strip,
// the plan, a meter, a licence. Five rectangles arguing about a corner, and
// every popup menu landed on top of them. This is the same information as ONE
// object: the map at the centre, because the map is what you are steering by,
// and the acts arranged around its rim where a thumb already rests —
//
//        JUMP        (top)
//   FIRE      BOOST  (left / right)
//       DISMOUNT     (bottom, an eject notch — you leave once)
//
// The plan is not re-implemented: CREO's own #plan element is MOVED into the
// ring's centre and clipped round, so every behaviour it had (tap to travel,
// the neighbour window, the north needle) still belongs to it.
//
// And it gets out of the way: any open menu or palette fades it, `map off`
// stows it to a single dot, and film mode takes it with everything else.

import { press } from '../sim/rig.js';
import { BUS } from '../core/bus.js';

const SIZE = 244, C = SIZE / 2, RI = 82, RO = 118;
const RAD = Math.PI / 180;

const arc = (a0, a1) => {
  const p = (a, r) => [C + Math.cos(a * RAD) * r, C + Math.sin(a * RAD) * r];
  const [x0, y0] = p(a0, RO), [x1, y1] = p(a1, RO);
  const [x2, y2] = p(a1, RI), [x3, y3] = p(a0, RI);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${RO} ${RO} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${RI} ${RI} 0 ${big} 0 ${x3} ${y3}Z`;
};

// THE ACTS SIT UNDER THE THUMB. Spread to the cardinal points they were a
// compass rose, which is pretty and wrong: a thumb on a phone arrives at the
// TOP of this ring and stays there. So the three things you do while moving —
// fire, jump, boost — are three neighbouring segments across the top arc, and
// the right flank (where BOOST used to be) is where the MAP's own operations
// went, since that side is a glance, not a reflex. Eject stays at the foot,
// alone, because leaving should never be next to boosting.
const label = (a, r) => [C + Math.cos(a * RAD) * r, C + Math.sin(a * RAD) * r + 3];

// ROTATED INTO THE THUMB'S ARC. Across the top they were reachable only by
// lifting the hand; the reachable sweep on a held phone runs up the LEFT side
// from the foot of the ring. So the acts now occupy that flank, ordered by how
// often a hand wants them: BOOST nearest the foot (it is held), then JUMP,
// then FIRE. EJECT keeps the bottom, one gap away, so leaving is never the
// button you hit while accelerating.
const SEGMENTS = [
  { key: 'boost', label: 'BOOST', a0: 148, a1: 186, colour: '#ff5f5f', at: label(167, 100) },
  { key: 'jump', label: 'JUMP', a0: 190, a1: 228, colour: '#e8eef2', at: label(209, 100) },
  { key: 'fire', label: 'FIRE', a0: 232, a1: 270, colour: '#19e6c8', at: label(251, 100) },
  { key: 'dismount', label: 'EJECT', a0: 62, a1: 140, colour: '#9fb4ad', at: label(101, 100) },
];

// The plan's own tools, which the round clip had taken away: zoom, the whole
// place, and the ground you have not fetched yet. They ride the right flank as
// small buttons — reachable, but never mistaken for an act.
const MAP_OPS = [
  { glyph: '+', title: 'closer', at: -70, id: 'planIn' },
  { glyph: '−', title: 'wider', at: -46, id: 'planOut' },
  { glyph: '⛶', title: 'MAXIMISE the map — tap a neighbour to travel', at: -22, max: true },
  { glyph: '⊕', title: 'fetch neighbouring ground (X)', at: 2, id: 'exploreBtn' },
  { glyph: '⤢', title: 'frame the whole place (F)', at: 26, key: 'f' },
];

export function mountRing(S) {
  if (document.getElementById('rig-ring')) return null;
  const plan = document.getElementById('plan');
  if (!plan) return null;

  const css = document.createElement('style');
  css.textContent = `
    #rig-ring { position: fixed; right: 14px; bottom: 58px; width: ${SIZE}px; height: ${SIZE}px;
      z-index: 61; transition: opacity .18s, transform .18s; }
    #rig-ring svg { position: absolute; inset: 0; overflow: visible; }
    #rig-ring .seg { cursor: pointer; fill: rgba(10,14,18,.82); stroke: rgba(151,187,213,.22);
      stroke-width: 1; transition: fill .12s; }
    #rig-ring .seg:hover, #rig-ring .seg.down { fill: rgba(255,255,255,.10); }
    #rig-ring text { font: 800 9px/1 ui-monospace, monospace; letter-spacing: .12em;
      text-anchor: middle; dominant-baseline: middle; pointer-events: none; }
    #rig-ring .mapop { position: absolute; transform: translate(-50%, -50%);
      width: 26px; height: 26px; border-radius: 50%; cursor: pointer; padding: 0;
      border: 1px solid rgba(151,187,213,.3); background: rgba(10,14,18,.9); color: #cfe8dd;
      font: 700 13px/1 ui-monospace, monospace; }
    #rig-ring .mapop:hover { background: rgba(255,255,255,.14); }
    /* the map, round, in the middle — CREO's own plan, moved not rebuilt */
    #rig-ring #plan { position: absolute !important; left: ${C - 74}px !important; top: ${C - 74}px !important;
      right: auto !important; bottom: auto !important; width: 148px !important; height: 148px !important;
      border-radius: 50% !important; overflow: hidden !important;
      border: 2px solid rgba(180,200,210,.5) !important; box-shadow: 0 6px 22px rgba(0,0,0,.5);
      background: rgba(8,11,14,.9) !important; }
    #rig-ring #plan #planCanvas { width: 100% !important; height: 100% !important; }
    /* the plan's own tool buttons are not cockpit controls; the ring is */
    #rig-ring #plan > button { display: none !important; }
    /* THE CONTROLS ARE NEVER TAKEN AWAY. An earlier pass had the ring fade to
       12% whenever a menu opened — which solved the overlap by disabling the
       thing you steer with. Wrong trade: nothing may cover the ring and
       nothing may switch it off, so the MENUS moved instead (they drop from
       the line, see console.js) and the ring stays lit and live. */
    body.ring #rig-actions, body.ring #rig-dock { display: none !important; }
    body.ring-stowed #rig-ring { transform: scale(.34); opacity: .5; transform-origin: 82% 82%; }
    body.ring-stowed #rig-ring:hover { opacity: .9; }
    body.film #rig-ring { display: none !important; }
    body.map-max #rig-ring #plan {
      position: fixed !important; left: 50% !important; top: 50% !important;
      width: min(72vmin, 620px) !important; height: min(72vmin, 620px) !important;
      transform: translate(-50%, -50%) !important; z-index: 70 !important;
      border-width: 3px !important; box-shadow: 0 22px 70px rgba(0,0,0,.7);
    }
    body.map-max #rig-ring #plan > button { display: flex !important; }
    @media (max-width: 560px) { #rig-ring { transform: scale(.86); transform-origin: 100% 100%; } }
  `;
  document.head.appendChild(css);

  const ring = document.createElement('div');
  ring.id = 'rig-ring';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('width', SIZE);
  svg.setAttribute('height', SIZE);

  for (const seg of SEGMENTS) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', arc(seg.a0, seg.a1));
    path.setAttribute('class', 'seg');
    const act = () => {
      if (seg.key === 'dismount') {
        try { document.activeElement && document.activeElement.blur(); } catch (_) {}
        dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
      } else press(seg.key);
    };
    path.addEventListener('pointerdown', (e) => { e.preventDefault(); path.classList.add('down'); act(); });
    path.addEventListener('pointerup', () => path.classList.remove('down'));
    path.addEventListener('pointerleave', () => path.classList.remove('down'));
    svg.appendChild(path);

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', seg.at[0]);
    text.setAttribute('y', seg.at[1]);
    text.setAttribute('fill', seg.colour);
    text.textContent = seg.label;
    svg.appendChild(text);
  }
  // NORTH. A map you can turn is a map that must say which way is up, and the
  // round clip had cut off the plan's own corner needle. This one is drawn on
  // the ring itself, at the top of the map, where a compass belongs.
  const n = document.createElementNS(svgNS, 'path');
  const ny = C - 70;
  n.setAttribute('d', `M${C} ${ny - 7}L${C + 5} ${ny + 4}L${C} ${ny + 1}L${C - 5} ${ny + 4}Z`);
  n.setAttribute('fill', '#e86a4e');
  svg.appendChild(n);
  const nt = document.createElementNS(svgNS, 'text');
  nt.setAttribute('x', C); nt.setAttribute('y', ny + 13);
  nt.setAttribute('fill', 'rgba(232,238,242,.75)');
  nt.setAttribute('style', 'font:800 8px/1 ui-monospace,monospace;letter-spacing:.1em');
  nt.textContent = 'N';
  svg.appendChild(nt);

  ring.appendChild(svg);

  for (const op of MAP_OPS) {
    const b = document.createElement('button');
    b.textContent = op.glyph;
    b.title = op.title;
    b.className = 'mapop';
    const [x, y] = [C + Math.cos(op.at * RAD) * 100, C + Math.sin(op.at * RAD) * 100];
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      if (op.max) { maximise(!document.body.classList.contains('map-max')); return; }
      const target = op.id && document.getElementById(op.id);
      if (target) target.click();
      else if (op.key) dispatchEvent(new KeyboardEvent('keydown', { key: op.key, bubbles: true }));
      // A CONTROL MUST ANSWER AT ONCE. Zoom and explore only changed state and
      // then waited for the frame loop to notice — which, parked or throttled,
      // could be a long time, and reads as a dead button. The map redraws now.
      try { window.TERRA && window.TERRA.redrawPlan && window.TERRA.redrawPlan(); } catch (_) {}
      if (window.TERRA && window.TERRA.S) window.TERRA.S.dirty = true;
    });
    ring.appendChild(b);
  }

  // speed, written on the rim where a dial would have it
  const speed = document.createElement('div');
  speed.id = 'ring-speed';
  speed.style.cssText = 'position:absolute;left:0;right:0;top:' + (C + 58) + 'px;text-align:center;'
    + 'font:700 9px/1 ui-monospace,monospace;letter-spacing:.14em;color:#8fb8a8;pointer-events:none;';
  speed.textContent = '0 km/h';
  ring.appendChild(speed);

  document.body.appendChild(ring);
  ring.appendChild(plan);                 // the map takes the middle
  plan.hidden = false;
  document.body.classList.add('ring');

  // the map keeps its zoom: a wheel over it presses the plan's own buttons
  ring.addEventListener('wheel', (e) => {
    const b = document.getElementById(e.deltaY > 0 ? 'planOut' : 'planIn');
    if (b) { e.preventDefault(); b.click(); }
  }, { passive: false });

  // speed follows the rig without asking the frame for anything
  setInterval(() => {
    const s = document.querySelector('#rig-dock span');
    if (s) speed.textContent = s.textContent;
  }, 250);

  // MAXIMISE — the map big enough to read and to tap a neighbouring window on.
  // The ring keeps its acts; only the plan grows, centred over the world, and
  // the same button (or Escape) puts it back.
  const maximise = (on) => {
    document.body.classList.toggle('map-max', on);
    try { window.TERRA && window.TERRA.redrawPlan && window.TERRA.redrawPlan(); } catch (_) {}
    setTimeout(() => { try { window.TERRA.redrawPlan(); } catch (_) {} }, 60);
  };
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('map-max')) maximise(false);
  });
  BUS.register('maximise', (t) => /^(maximi[sz]e|big map|expand map)\b/.test(t),
    () => { maximise(!document.body.classList.contains('map-max')); return 'the map fills the frame — tap a neighbour, or Escape'; },
    'maximise — the map big, for choosing where to go');

  const stow = (on) => {
    document.body.classList.toggle('ring-stowed', on);
    try { localStorage.setItem('terrarium.ring', on ? 'stowed' : 'out'); } catch (_) {}
  };
  try { if (localStorage.getItem('terrarium.ring') === 'stowed') stow(true); } catch (_) {}

  BUS.register('map', (t) => /^(map|ring|plan)\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|hide|stow|no)\b/.test(raw.toLowerCase());
      stow(off);
      return off ? 'the ring is stowed — say map on to bring it back' : 'the ring is out';
    },
    'map off / on — stow the control ring');

  // M stows it too, because a hand on the keys should not need the line
  addEventListener('keydown', (e) => {
    if ((e.key === 'm' || e.key === 'M') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
      stow(!document.body.classList.contains('ring-stowed'));
    }
  });

  return { ring, stow };
}
