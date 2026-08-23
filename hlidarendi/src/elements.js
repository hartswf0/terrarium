// hlidarendi/src/elements.js — THE trailer element table. One authority.
//
// Transcribed from gunnars-depot operative/ingold.js (SHELL / openings /
// interior, abridged): plan inches, x across the width 0..101, y along the
// length 0..240, z up from the ground datum. door.entry: wall W, 72..108,
// per the plan. Wall pieces are SPLIT around real openings, so the door is
// an actual hole and a window is glass, not a hole.
//
// Consumed by BOTH renderers: src/main.js (the standalone HLIDARENDI page)
// and tools/make-cartridge.mjs (the thunder-rigs.cartridge/v1 fort for
// unset-04-hartsoe-iii). Rendered wall, semantic wall and collision wall are
// the same row of this table wherever the trailer stands.
export const IN = 0.0254;
export const WT = 4.5;                 // wall thickness
export const DECK_IN = 15.75;          // ingold SHELL deckTop
export const WALLTOP_IN = 106;         // ingold SHELL wallTop
export const DOOR_PLAN = { id: 'door.entry', wall: 'W', from: 72, to: 108, headIn: DECK_IN + 80 };
const wallW = (id, y0, y1, z0, z1) => ({ id, kind: 'wall', x0: 0, x1: WT, y0, y1, z0, z1 });
const wallE = (id, y0, y1, z0, z1) => ({ id, kind: 'wall', x0: 96.5, x1: 101, y0, y1, z0, z1 });
const zFull = [DECK_IN, WALLTOP_IN];
export const EL = [
  { id: 'frame', kind: 'frame', x0: 6, x1: 95, y0: 2, y1: 238, z0: 5, z1: 14.2 },
  { id: 'deck', kind: 'floor', x0: 0, x1: 101, y0: 0, y1: 240, z0: 14.25, z1: 15.75 },
  wallW('wall.W.s', 4.5, 72, ...zFull), wallW('door.header', 72, 108, 80 + 15.75, 106), wallW('wall.W.m', 108, 128, ...zFull),
  wallW('win.dinette.sill', 128, 168, 15.75, 45.75), wallW('win.dinette.head', 128, 168, 75.75, 106),
  { id: 'win.dinette', kind: 'glass', x0: 1.5, x1: 3, y0: 128, y1: 168, z0: 45.75, z1: 75.75 },
  wallW('wall.W.n', 168, 235.5, ...zFull),
  wallE('wall.E.s', 4.5, 74, ...zFull), wallE('win.galley.sill', 74, 94, 15.75, 59.75), wallE('win.galley.head', 74, 94, 83.75, 106),
  { id: 'win.galley', kind: 'glass', x0: 98, x1: 99.5, y0: 74, y1: 94, z0: 59.75, z1: 83.75 },
  wallE('wall.E.n', 94, 235.5, ...zFull),
  { id: 'wall.N.w', kind: 'wall', x0: 0, x1: 30, y0: 235.5, y1: 240, z0: 15.75, z1: 106 },
  { id: 'win.bed.sill', kind: 'wall', x0: 30, x1: 70, y0: 235.5, y1: 240, z0: 15.75, z1: 41.75 },
  { id: 'win.bed.head', kind: 'wall', x0: 30, x1: 70, y0: 235.5, y1: 240, z0: 71.75, z1: 106 },
  { id: 'win.bed', kind: 'glass', x0: 30, x1: 70, y0: 237, y1: 238.5, z0: 41.75, z1: 71.75 },
  { id: 'wall.N.e', kind: 'wall', x0: 70, x1: 101, y0: 235.5, y1: 240, z0: 15.75, z1: 106 },
  { id: 'wall.S.w', kind: 'wall', x0: 0, x1: 62, y0: 0, y1: 4.5, z0: 15.75, z1: 106 },
  { id: 'win.bath.sill', kind: 'wall', x0: 62, x1: 86, y0: 0, y1: 4.5, z0: 15.75, z1: 51.75 },
  { id: 'win.bath.head', kind: 'wall', x0: 62, x1: 86, y0: 0, y1: 4.5, z0: 73.75, z1: 106 },
  { id: 'win.bath', kind: 'glass', x0: 62, x1: 86, y0: 1.5, y1: 3, z0: 51.75, z1: 73.75 },
  { id: 'wall.S.e', kind: 'wall', x0: 86, x1: 101, y0: 0, y1: 4.5, z0: 15.75, z1: 106 },
  { id: 'part.bath', kind: 'wall', x0: 4.5, x1: 58, y0: 60, y1: 64, z0: 15.75, z1: 96 },
  { id: 'fix.bed', kind: 'fixture', x0: 4.5, x1: 96.5, y0: 184, y1: 236, z0: 15.75, z1: 30.75 },
  { id: 'fix.galley', kind: 'fixture', x0: 74, x1: 96.5, y0: 64, y1: 112, z0: 15.75, z1: 51.75 },
  { id: 'fix.dinette', kind: 'fixture', x0: 4.5, x1: 26, y0: 118, y1: 176, z0: 15.75, z1: 30.75 },
  { id: 'step.hi', kind: 'step', x0: -15, x1: 0, y0: 76, y1: 104, z0: 0, z1: 10.5 },
  { id: 'step.lo', kind: 'step', x0: -30, x1: -15, y0: 76, y1: 104, z0: 0, z1: 5.25 },
];
