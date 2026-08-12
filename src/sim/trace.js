// THE ATLAS — Unsettled Atlas 05, standing on CREO's ground.
//
// This is the TRACE tier of the standing world made real: weather that becomes
// deed by accumulation. Every pass of the wheels deposits a rut (weather-cheap,
// its own GPU mesh, never a rebuild); re-driving your own ruts raises the
// NORMALIZATION PRESSURE; breaking ground, building, destroying, testifying and
// unsettling lower it. Four thresholds wait at the compass edges of the place,
// and the first crossing of each is logged as a discovery.
//
// The two verbs the doctrine turns on:
//   UNSETTLE — the standing arrangement swaps into a deterministic alternative
//              (point-reflection about the place's centre — self-inverse, so it
//              is REMEMBERED, not invented). In CREO this is what it always
//              wanted to be: A BRANCH. The given arrangement stays untouched on
//              the home branch; amber ghosts hold the abandoned positions.
//   RESETTLE — return to the home branch. Remembered, not inevitable.
//
// Testimony is CREO's own observation entity — "note: …" plants a standing
// sign, journaled with you as its author. The say-operator always was the
// atlas's voice; here it is surfaced as the verb it was.

import * as G from '../core/geom.js';
import { BUS } from '../core/bus.js';

const MAX_STAMPS = 2600;

const A = {
  stamps: [],            // ring buffer of [x, y, yaw]
  head: 0,
  pressure: 38,
  lastLine: 'the ground is unmarked',
  thresholds: [],
  homeBranch: null,
  unsettled: false,
  _lastAt: null,
  _upAt: 0,
  _paintAt: 0,
  _bound: null,
};

function rise(n) { A.pressure = Math.min(100, A.pressure + n); }
function drop(n, why) {
  A.pressure = Math.max(0, A.pressure - n);
  if (why) { A.lastLine = why; paint(); }
}

function paint() {
  if (typeof document === 'undefined') return;
  let d = document.getElementById('atlas-dock');
  if (!d) {
    d = document.createElement('div');
    d.id = 'atlas-dock';
    d.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:61;min-width:200px;max-width:260px;'
      + 'background:rgba(10,14,18,.92);border:1px solid rgba(151,187,213,.25);border-radius:12px;'
      + 'padding:9px 11px;font:700 9px/1.45 ui-monospace,monospace;color:#cfe8dd;letter-spacing:.08em;'
      + 'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);pointer-events:none;';
    document.body.appendChild(d);
  }
  const p = Math.round(A.pressure);
  const tone = p > 66 ? '#df5a5d' : p > 33 ? '#ffb45e' : '#6fe0c0';
  d.innerHTML = 'UNSETTLED ATLAS 05' + (A.unsettled ? ' · <span style="color:#ffb45e">UNSETTLED</span>' : '')
    + '<div style="margin:6px 0 4px;height:4px;border-radius:2px;background:rgba(255,255,255,.08)">'
    + '<div style="width:' + p + '%;height:100%;border-radius:2px;background:' + tone + '"></div></div>'
    + 'NORMALIZATION ' + p
    + '<div style="margin-top:5px;color:#8d9aa5;font-weight:500;letter-spacing:.02em">' + A.lastLine + '</div>';
}

export const ATLAS = {
  get pressure() { return A.pressure; },
  get unsettled() { return A.unsettled; },
  ghosts: [],            // abandoned footprints, drawn amber by the renderer

  /** Meet the place: thresholds at its compass edges, ears on its journal. */
  bind(world) {
    if (!world || A._bound === world) return;
    A._bound = world;
    A.homeBranch = world.branch;
    // a new place is new ground: the sediment, the ghosts and the unsettled
    // state belong to the world that made them, not to whoever comes next
    A.stamps = []; A.head = 0; A._lastAt = null;
    A.unsettled = false;
    this.ghosts = [];
    A.lastLine = 'the ground is unmarked';
    const b = world.place.terrain?.bounds;
    if (b) {
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      A.thresholds = [
        { name: 'the north threshold', x: cx, y: b[3], crossed: false },
        { name: 'the south threshold', x: cx, y: b[1], crossed: false },
        { name: 'the east threshold', x: b[2], y: cy, crossed: false },
        { name: 'the west threshold', x: b[0], y: cy, crossed: false },
      ];
    }
    // deeds move the needle: building and destroying both question the given
    world.on((kind, ev) => {
      const label = ev?.meta?.label || ev?.label || '';
      if (/^(add|build)/.test(label)) drop(2, 'ground broken — pressure falls');
      else if (/^(remove|destroy)/.test(label)) drop(2, 'the given removed — pressure falls');
    });
    paint();
  },

  /** Weather → trace. Called from the driving frame; costs a distance check. */
  tick(rig, world, renderer) {
    if (!rig?.on || !world) return;
    const p = rig.p;
    if (!A._lastAt) { A._lastAt = [p[0], p[1]]; return; }
    if (G.dist(p, A._lastAt) < 2.4) return;
    A._lastAt = [p[0], p[1]];

    // your own ruts normalize you; fresh ground resists a little
    let worn = false;
    for (let i = 0; i < A.stamps.length; i++) {
      const s = A.stamps[i];
      const dx = s[0] - p[0], dy = s[1] - p[1];
      if (dx * dx + dy * dy < 2.6) { worn = true; break; }
    }
    if (worn) rise(0.05); else A.pressure = Math.max(0, A.pressure - 0.012);

    const stamp = [p[0], p[1], rig.yaw];
    if (A.stamps.length < MAX_STAMPS) A.stamps.push(stamp);
    else { A.stamps[A.head] = stamp; A.head = (A.head + 1) % MAX_STAMPS; }

    for (const t of A.thresholds) {
      if (!t.crossed && G.dist([t.x, t.y], p) < 60) {
        t.crossed = true;
        drop(5, 'you crossed ' + t.name + ' — logged as a discovery');
      }
    }

    const now = Date.now();
    if (now - A._upAt > 400) { A._upAt = now; this.upload(renderer, world); }
    if (now - A._paintAt > 900) { A._paintAt = now; paint(); }
  },

  /** The sediment bed: two wheel-marks per stamp, on the drawn ground. */
  upload(renderer, world) {
    if (!renderer?.setTrace) return;
    const g = (x, y) => (renderer.drawnGroundAt?.(x, y) ?? world.place.groundAt(x, y)) + 0.125;
    const col = [0.16, 0.12, 0.09];
    renderer.setTrace((B) => {
      for (const [x, y, yaw] of A.stamps) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (const side of [-0.95, 0.95]) {
          const ox = -s * side, oy = c * side;
          const ax = x + ox - c * 1.4, ay = y + oy - s * 1.4;
          const bx = x + ox + c * 1.4, by = y + oy + s * 1.4;
          const wx = -s * 0.21, wy = c * 0.21;
          const p00 = [ax - wx, ay - wy], p10 = [bx - wx, by - wy];
          const p11 = [bx + wx, by + wy], p01 = [ax + wx, ay + wy];
          B.tri([p00[0], p00[1], g(p00[0], p00[1])], [p10[0], p10[1], g(p10[0], p10[1])],
            [p11[0], p11[1], g(p11[0], p11[1])], [0, 0, 1], col, 0.42);
          B.tri([p00[0], p00[1], g(p00[0], p00[1])], [p11[0], p11[1], g(p11[0], p11[1])],
            [p01[0], p01[1], g(p01[0], p01[1])], [0, 0, 1], col, 0.42);
        }
      }
    });
  },

  /** "note: …" — a standing sign, journaled, with you as its author. */
  testify(world, at, text) {
    const [x, y] = at;
    const ring = [[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]];
    const z = world.place.groundAt(x, y);
    world.addEntity({
      type: 'observation', name: text, footprint: ring,
      zBase: z, zTop: z + 0.2, collision: 'none',
      props: { testimony: true },
    }, { label: 'testimony', author: 'you' });
    drop(3, 'testimony planted — the place answers back');
    return 'noted — a sign stands here';
  },

  /**
   * UNSETTLE: the alternative arrangement, held on a branch. Built things and
   * the structures nearest the centre reflect about the place's centre — a
   * point reflection preserves winding and is its own inverse.
   */
  unsettle(world) {
    if (!world) return 'no world yet';
    if (A.unsettled) return 'already unsettled — say resettle to return';
    A.homeBranch = world.branch;
    const existed = world.place.branches.has('unsettled');
    if (!existed) {
      world.createBranch('unsettled', {
        name: 'Unsettled', parent: world.branch, author: 'atlas',
        note: 'the alternative arrangement — remembered, not inevitable',
      });
    }
    world.switchBranch('unsettled');
    A.unsettled = true;
    this.ghosts = [];
    if (!existed) {
      const b = world.place.terrain?.bounds;
      const cx = b ? (b[0] + b[2]) / 2 : 0, cy = b ? (b[1] + b[3]) / 2 : 0;
      const movable = world.entities()
        .filter((e) => e.props?.built
          || (e.type === 'structure' && G.dist(G.centroid(world.ringOf(e) || [[0, 0]]), [cx, cy]) < 350))
        .slice(0, 300);
      world.transact({ label: 'unsettle · the alternative arrangement', author: 'atlas' }, (j) => {
        for (const e of movable) {
          const ring = world.ringOf(e);
          if (!ring || ring.length < 3) continue;
          if (this.ghosts.length < 120) {
            this.ghosts.push({ id: 'ghost-' + e.id, type: e.type, footprint: ring.map((p) => p.slice()), zBase: e.zBase, zTop: e.zTop });
          }
          const alt = ring.map(([x, y]) => [2 * cx - x, 2 * cy - y]);
          const [ox, oy] = G.centroid(ring);
          const dz = world.place.groundAt(2 * cx - ox, 2 * cy - oy) - world.place.groundAt(ox, oy);
          j.mutate({
            op: 'update', branch: world.branch, id: e.id,
            patch: { footprint: alt, zBase: e.zBase + dz, zTop: e.zTop + dz },
          });
        }
      });
    }
    drop(8, 'the arrangement is questioned — ghosts hold the abandoned positions');
    paint();
    return 'unsettled — the standing arrangement is now one branch among others';
  },

  /** RESETTLE: the given returns. It was remembered the whole time. */
  resettle(world) {
    if (!world || !A.unsettled) return 'nothing is unsettled';
    world.switchBranch(A.homeBranch || 'main');
    A.unsettled = false;
    this.ghosts = [];
    rise(6);
    A.lastLine = 'the given arrangement returns — remembered, not inevitable';
    paint();
    return 'resettled — back on ' + world.branch;
  },
};

// ── the atlas speaks through the commons, like every other organ ────────────
const rigAt = (ctx) => {
  const R = ctx.RIG, S = ctx.S;
  if (R?.on) return [R.p[0], R.p[1]];
  return S?.cam ? [S.cam.target[0], S.cam.target[1]] : [0, 0];
};

BUS.register('testify',
  (t, raw) => raw.match(/^note[:,]\s*(.+)/i),
  (m, ctx) => { const out = ATLAS.testify(ctx.S.world, rigAt(ctx), m[1]); ctx.S.dirty = true; return out; },
  'note: <words> — plant testimony where you stand');

BUS.register('unsettle',
  (t) => /^unsettle\b/.test(t),
  (m, ctx) => { const out = ATLAS.unsettle(ctx.S.world); ctx.S.dirty = true; return out; },
  'unsettle — swap the arrangement for its alternative (a branch)');

BUS.register('resettle',
  (t) => /^resettle\b|^settle\b/.test(t),
  (m, ctx) => { const out = ATLAS.resettle(ctx.S.world); ctx.S.dirty = true; return out; },
  'resettle — return to the given arrangement');

BUS.register('pressure',
  (t) => /^(pressure|atlas)\b/.test(t),
  () => 'normalization ' + Math.round(A.pressure) + '/100 — '
    + A.thresholds.filter((t) => t.crossed).length + '/4 thresholds crossed',
  'pressure — read the atlas dock aloud');

if (typeof window !== 'undefined') window.ATLAS = ATLAS;
