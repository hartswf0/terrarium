// BUILD — unset's parts palette, made of CREO entities.
//
// ACKNOWLEDGING THAT UNSET BUILDS WITH DIFFERENT TOOLS. Unset's kit is BEAM /
// PANEL / RAMP / BLOCK / CYL / Q-PIPE: playground parts, placed by the metre,
// destroyed by a laser, meaningful only as a surface to drive on. CREO's kit is
// structure / wall / surface / road / tree: parts of a place, placed by
// argument, meaningful because they are somewhere real and someone is
// accountable for them. Those are different theories of what a part IS, and
// pretending otherwise is what makes an integration feel fake.
//
// So the palette is not ported — it is TRANSLATED. Each unset part becomes a
// real CREO entity (journaled, undoable, certified, exported with the place),
// carrying `props.part` so the rig's physics can still treat it as playground
// equipment. You get unset's verbs with CREO's accountability: a ramp you
// built is in the history, in the GeoJSON, and answerable to "who put this
// here?" — which is the whole reason to be in CREO at all.
//
// Every placement now passes THE GATE (src/law/gate.js): the world is asked
// before the part lands, and a COLLISION or RIGHT_OF_WAY verdict either steps
// the part forward (the OFFSET repair) or refuses it out loud. Prompts
// propose; geometry decides. And since hurdle #1 fell — the ground has its own
// buffers — a placement costs the part, not the district.

import { admit } from '../law/gate.js';

const D = Math.PI / 180;

// dims in metres, the way unset sized them (l = along heading, w = across)
export const PARTS = {
  ramp:   { l: 9,  w: 6,  h: 3.2, type: 'surface', name: 'Ramp',    collision: 'none',  hint: 'drive up it, take off' },
  qpipe:  { l: 6,  w: 7,  h: 5.0, type: 'surface', name: 'Q-pipe',  collision: 'none',  hint: 'a steeper launch' },
  block:  { l: 4,  w: 4,  h: 4,   type: 'structure', name: 'Block', collision: 'solid', hint: 'a solid cube' },
  beam:   { l: 8,  w: 1,  h: 1,   type: 'structure', name: 'Beam',  collision: 'solid', hint: 'a long bar' },
  panel:  { l: 8,  w: 0.4, h: 5,  type: 'wall',      name: 'Panel', collision: 'solid', hint: 'a standing sheet' },
  cyl:    { l: 3,  w: 3,  h: 7,   type: 'structure', name: 'Column', collision: 'solid', hint: 'a pillar' },
};

function ring(cx, cy, l, w, yaw, round) {
  const c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  if (round) {
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; out.push([cx + Math.cos(a) * l / 2, cy + Math.sin(a) * w / 2]); }
    return out;
  }
  for (const [dx, dy] of [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]])
    out.push([cx + dx * c - dy * s, cy + dx * s + dy * c]);
  return out;
}

/**
 * Place a part just ahead of the rig, facing the way it faces — unset's
 * "it appears where you are looking", but as a transaction with an author.
 */
export function place(world, kind, rig, opts = {}) {
  const P = PARTS[kind]; if (!P || !world) return null;
  const yaw = opts.yaw != null ? opts.yaw : (rig ? rig.yaw : 0);
  const ahead = opts.ahead != null ? opts.ahead : (P.l / 2 + 5);
  const ox = rig ? rig.p[0] : 0, oy = rig ? rig.p[1] : 0;
  const at = (extra) => [ox + Math.cos(yaw) * (ahead + extra), oy + Math.sin(yaw) * (ahead + extra)];

  // the gate: ask the world, step forward if refused, refuse out loud if held
  const z0 = world.place.groundAt(...at(0));
  const v = admit(world, (off) => {
    const [cx, cy] = at(off);
    return ring(cx, cy, P.l, P.w, yaw, kind === 'cyl');
  }, { zBase: z0, zTop: z0 + P.h, solid: P.collision === 'solid', tries: 3, step: Math.max(6, P.l * 0.8) });
  if (!v.ring) return { refused: v.verdict, message: v.message };

  const [cx, cy] = at(v.offset);
  const z = world.place.groundAt(cx, cy);
  const e = world.addEntity({
    type: P.type, name: P.name,
    footprint: v.ring,
    zBase: z, zTop: z + P.h,
    collision: P.collision,
    // the part keeps its playground identity so the rig can still use it,
    // while the world keeps it as an ordinary, answerable entity
    props: { part: kind, yaw, rise: P.h, built: true },
  }, { label: 'build ' + kind });
  if (e && v.offset) e.__offsetBy = v.offset;   // so the mouth can say "stepped forward"
  return e;
}

/** Words, because the one line should be able to say it too. */
export function parse(text) {
  const t = String(text || '').toLowerCase();
  for (const k of Object.keys(PARTS)) if (new RegExp('\\b' + k + '\\b').test(t)) return k;
  if (/\bramp|jump\b/.test(t)) return 'ramp';
  if (/\bhalfpipe|half-pipe|pipe|bowl\b/.test(t)) return 'qpipe';
  if (/\bwall|sheet|screen\b/.test(t)) return 'panel';
  if (/\bpillar|column|post\b/.test(t)) return 'cyl';
  if (/\bbar|girder|plank\b/.test(t)) return 'beam';
  if (/\bcube|box|crate\b/.test(t)) return 'block';
  return null;
}
