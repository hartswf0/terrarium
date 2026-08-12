// HOUSE — massing, not a box.
//
// The Henry House reference reads as a building for one reason: it has PARTS.
// A main wing and a cross wing, a roof that overhangs, a deck that steps down,
// a chimney breaking the ridge. A single extruded prism can never read that way
// no matter how well it is coloured, and that — not texture, not polygon count
// — is why our buildings look like blocks.
//
// CREO renders prisms. So a house here is a SMALL FAMILY OF PRISMS, sized and
// stacked so the eye assembles a building out of them: walls, then two or three
// shrinking slabs standing in for the pitch, then the overhang, then the deck.
// Every part is an ordinary entity — journaled, undoable, exported, certified,
// seated on the real ground by groundAt — and all of them carry `props.house`
// so the whole building answers as one thing.
//
// This is the honest ceiling of the current renderer. A true pitched roof needs
// a mesh path (body.js can already read GLB; gl.js has nowhere to draw it), and
// that is the next real piece of work, named rather than faked.

import { admit } from '../law/gate.js';

const RAD = Math.PI / 180;

function ring(cx, cy, l, w, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  for (const [dx, dy] of [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]])
    out.push([cx + dx * c - dy * s, cy + dx * s + dy * c]);
  return out;
}
const fwd = (x, y, yaw, d, side = 0) =>
  [x + Math.cos(yaw) * d - Math.sin(yaw) * side, y + Math.sin(yaw) * d + Math.cos(yaw) * side];

/**
 * Put a house on the ground at a point, facing a bearing.
 * Returns the entities it made, newest first — the caller can undo them as one.
 */
export function house(world, at, yaw = 0, opts = {}) {
  if (!world) return [];
  const wingL = opts.length || 15, wingW = opts.width || 8;
  const wall = opts.wallHeight || 3.1;
  const pitch = opts.roof !== false;

  // THE GATE, before a single part lands: the whole massing is asked for at
  // once (an envelope covering wings and deck), stepped forward if the ground
  // is taken, refused out loud if it stays taken. A house inside a standing
  // building was failure F5; this is the law that ends it.
  const env = (off) => {
    const cx = at[0] + Math.cos(yaw) * off, cy = at[1] + Math.sin(yaw) * off;
    return ring(cx, cy, wingL * 1.25, wingW * 2.6, yaw);
  };
  const zAsk = world.place.groundAt(at[0], at[1]);
  const v = admit(world, env, { zBase: zAsk, zTop: zAsk + wall + 3, tries: 3, step: wingL * 0.9 });
  if (!v.ring) { const out = []; out.refused = v.verdict; out.message = v.message; return out; }
  const x = at[0] + Math.cos(yaw) * v.offset, y = at[1] + Math.sin(yaw) * v.offset;

  const z0 = world.place.groundAt(x, y);
  const id = 'house-' + Math.random().toString(36).slice(2, 7);
  const made = [];
  if (v.offset) made.__offsetBy = v.offset;

  const part = (name, type, cx, cy, l, w, base, top, collision, role) => {
    const e = world.addEntity({
      type, name,
      footprint: ring(cx, cy, l, w, yaw),
      zBase: base, zTop: top,
      collision,
      props: { house: id, role, yaw, built: true },
    }, { label: 'build house · ' + role });
    if (e) made.push(e);
    return e;
  };

  // ── the two wings: a long one, and a shorter one across it ──────────────
  part('House', 'structure', x, y, wingL, wingW, z0, z0 + wall, 'solid', 'main wing');
  const [cx2, cy2] = fwd(x, y, yaw, -wingL * 0.24, wingW * 0.62);
  part('Wing', 'structure', cx2, cy2, wingL * 0.55, wingW * 0.85, z0, z0 + wall * 0.94, 'solid', 'cross wing');

  // ── the roof: shrinking slabs read as a pitch, and the first one overhangs.
  //    An eave is what tells you a wall is a wall and not a screen.
  if (pitch) {
    const steps = opts.steps || 3, rise = (opts.roofHeight || 2.4) / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const over = i === 0 ? 0.9 : 0;                       // the eave
      part('Roof', 'structure', x, y,
        wingL * (1 - t * 0.34) + over, wingW * (1 - t * 0.52) + over,
        z0 + wall + i * rise, z0 + wall + (i + 1) * rise, 'solid', 'roof ' + (i + 1));
      part('Roof', 'structure', cx2, cy2,
        wingL * 0.55 * (1 - t * 0.34) + over, wingW * 0.85 * (1 - t * 0.52) + over,
        z0 + wall * 0.94 + i * rise, z0 + wall * 0.94 + (i + 1) * rise, 'solid', 'wing roof ' + (i + 1));
    }
    const [chx, chy] = fwd(x, y, yaw, -wingL * 0.3, -wingW * 0.2);
    part('Chimney', 'structure', chx, chy, 1.2, 1.2, z0 + wall, z0 + wall + 3.4, 'solid', 'chimney');
  }

  // ── the deck: the part of a house that meets the ground you drive on ─────
  const [dx, dy] = fwd(x, y, yaw, 0, -wingW * 0.86);
  part('Deck', 'surface', dx, dy, wingL * 0.72, wingW * 0.7, z0 - 0.12, z0 + 0.42, 'none', 'deck');

  return made;
}

/** Remove a whole house by the id every part carries. */
export function removeHouse(world, id) {
  const doomed = world.entities().filter((e) => e.props && e.props.house === id);
  for (const e of doomed) world.removeEntity(e.id, { label: 'remove house' });
  return doomed.length;
}

/** Words → a house, so the one line can build one. */
export function parseHouse(text) {
  const t = String(text || '').toLowerCase();
  if (!/\b(house|home|cabin|cottage|shed|barn|lodge)\b/.test(t)) return null;
  const o = {};
  if (/\b(big|large|long)\b/.test(t)) { o.length = 21; o.width = 10; }
  if (/\b(small|little|cabin|shed)\b/.test(t)) { o.length = 9; o.width = 6.5; o.roofHeight = 1.7; }
  if (/\b(flat|modern)\b/.test(t)) { o.roof = false; }
  if (/\b(barn|lodge|two.stor)/.test(t)) { o.wallHeight = 5.4; o.roofHeight = 3.2; }
  return o;
}
