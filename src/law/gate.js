// THE GATE — the world interrogates the act (law L2).
//
// This is the organ the failure audit called F5: unset built CITY.canPlace,
// PARCELS and right-of-way precisely so that generated things must answer to
// standing things, and the first integration ignored all of it — a house could
// be dropped inside a real building. The gate closes that hole with CREO's own
// facts: the spatial index answers who is near, the rings answer whether they
// overlap, and the verdict decides. Prompts propose; geometry decides.
//
// Verdicts, in the parent's own vocabulary:
//   FREE          — nothing stands against it
//   COLLISION     — it shares interior with a standing solid
//   RIGHT_OF_WAY  — it blocks a way people or water already use
//
// admit() adds the one repair unset applied most: OFFSET — step the act
// forward along its own bearing a few times before refusing outright.

import * as G from '../core/geom.js';

const BLOCKING = new Set(['structure', 'wall', 'tree']);
const WAYS = new Set(['road', 'path', 'stream', 'water', 'drain']);

export function canPlace(world, ring, opts = {}) {
  const { zBase = -Infinity, zTop = Infinity, ignore, solid = true } = opts;
  if (!world || !ring || ring.length < 3) return { verdict: 'FREE', message: '' };
  const c = G.centroid(ring);
  const r = Math.max(...ring.map((p) => G.dist(p, c)));
  let hits = [];
  try { hits = world.nearby(c, r + 26); } catch (_) { return { verdict: 'FREE', message: '' }; }
  let way = null;
  for (const { entity: e } of hits) {
    if (!e || (ignore && ignore(e))) continue;
    const eRing = world.ringOf(e);
    if (!eRing || eRing.length < 3) continue;
    if (BLOCKING.has(e.type) || e.collision === 'solid') {
      // clear above or clear below is not a collision — a deck may span a slope
      if (zTop <= e.zBase + 0.01 || zBase >= e.zTop - 0.01) continue;
      if (G.ringsIntersect(ring, eRing)) {
        return {
          verdict: 'COLLISION', against: e,
          message: `refused — that stands in ${e.name || e.type}` + (e.source ? ` (${e.source})` : ''),
        };
      }
    } else if (solid && WAYS.has(e.type) && G.ringsIntersect(ring, eRing)) {
      // only a SOLID act can block a way — a ramp is a surface the way keeps
      // flowing under; the right-of-way rule is about passage, not paint
      way = e;
    }
  }
  if (way) {
    return {
      verdict: 'RIGHT_OF_WAY', against: way,
      message: `refused — that blocks the ${way.name || way.type} (right of way)`,
    };
  }
  return { verdict: 'FREE', message: '' };
}

/**
 * The gate with one repair: try the act where it was asked, then stepped
 * forward along its bearing, before refusing. ringAt(offset) → the footprint
 * at that offset. Returns { verdict, ring | null, offset, message }.
 */
export function admit(world, ringAt, opts = {}) {
  const { tries = 3, step = 7 } = opts;
  let last = null;
  for (let i = 0; i < tries; i++) {
    const ring = ringAt(i * step);
    last = canPlace(world, ring, opts);
    if (last.verdict === 'FREE') return { ...last, ring, offset: i * step };
  }
  return { ...last, ring: null, offset: 0 };
}
