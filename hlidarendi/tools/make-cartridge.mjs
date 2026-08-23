// hlidarendi/tools/make-cartridge.mjs — emit hlidarendi.trig.json for
// unset-04-hartsoe-iii.html (THUNDER RIGS / Terrarium III).
//
// The trailer enters the standing world through the SAME admission pipeline an
// AI build uses: a fort entity carrying `function build(w, WG, THREE)` code,
// forged, certified, seated on the real land at its anchor (__groundY), and
// broadcast to peers. The geometry is generated from src/elements.js — the one
// element table — so the cartridge trailer and the HLIDARENDI page trailer can
// never disagree.
//
// Load it by dragging the .trig.json onto the running III page (loading is
// playing), or via the Garage once saved as a world.
import { EL, IN, DOOR_PLAN } from '../src/elements.js';
import { writeFileSync } from 'node:fs';

const MAT = { wall: '0xf2efe8', glass: '0xbcd6dd', floor: '0xc9b48a', fixture: '0xded2b8', frame: '0x6b6257', step: '0xb8ab91' };
const rows = EL.map(e => {
  const cx = +(((e.x0 + e.x1) / 2 - 50.5) * IN).toFixed(3);
  const cz = +(((e.y0 + e.y1) / 2 - 120) * IN).toFixed(3);
  const cy = +(((e.z0 + e.z1) / 2) * IN).toFixed(3);
  const sx = +((Math.abs(e.x1 - e.x0)) * IN).toFixed(3);
  const sy = +((Math.abs(e.z1 - e.z0)) * IN).toFixed(3);
  const sz = +((Math.abs(e.y1 - e.y0)) * IN).toFixed(3);
  return `[${cx},${cy},${cz},${sx},${sy},${sz},'${e.kind}'] /*${e.id}*/`;
});
const code = `function build(w, WG, THREE){
  /* HLIDARENDI - GUNNAR'S TRAILER. Generated from hlidarendi/src/elements.js,
     itself transcribed from gunnars-depot operative/ingold.js. Wall pieces are
     split around real openings: ${DOOR_PLAN.id} (wall ${DOOR_PLAN.wall}, plan ${DOOR_PLAN.from}..${DOOR_PLAN.to})
     is an actual hole with a header, the windows are glass. Every visible box
     is also the collision box: rendered wall = semantic wall = collision wall.
     ${EL.length} meshes, all within 3.2 units of the anchor; the host seats the
     whole structure on its own ground. */
  var M = {
    wall: WG.flat(${MAT.wall}, { rough: 0.9 }),
    glass: WG.lit(${MAT.glass}, 0.25),
    floor: WG.flat(${MAT.floor}, { rough: 0.95 }),
    fixture: WG.flat(${MAT.fixture}, { rough: 0.9 }),
    frame: WG.flat(${MAT.frame}, { rough: 0.8, metal: 0.3 }),
    step: WG.flat(${MAT.step}, { rough: 0.95 })
  };
  var E = [
    ${rows.join(',\n    ')}
  ];
  for (var i = 0; i < E.length; i++) {
    var e = E[i];
    var b = WG.box(e[3], e[4], e[5], M[e[6]] || M.wall);
    WG.put(b, e[0], e[1], e[2]);
    WG.solid(b, e[3], e[4], e[5]);
  }
  return w;
}`;
const doc = {
  format: 'thunder-rigs.cartridge/v1',
  meta: {
    id: 'hlidarendi',
    name: 'HLIÐARENDI — GUNNAR’S TRAILER',
    author: 'hlidarendi',
    created: new Date().toISOString(),
    engine: { min: '1.0.0' },
  },
  world: {
    // atmosphere only — the standing world (including a real imported place)
    // stays the authority; the trailer arrives as a fort ON it.
    atmosphere: { sky: '#b8cbd8', fog: '#c9d4d2', ground: '#8a9478' },
    objects: [],
    prompt: 'Gunnar’s trailer at Hliðarendi — a dwelling with a real door, standing on the place',
  },
  entities: [
    { kind: 'fort', id: 'structure-ingold', anchor: { x: 14, z: 6 }, code },
    { kind: 'ball', id: 'ball', at: { x: 9, z: 4 } },
    { kind: 'target', id: 'home-cup', at: { x: 11.5, z: 5.2 }, radius: 2, cup: true },
  ],
  rules: { mode: 'free-build' },
  net: { world: 'latest-wins', forts: 'accumulate' },
};
// mirror the page's structural admission checks so a bad cartridge never ships
const errs = [];
if (doc.world.code && doc.world.code.length > 32000) errs.push('world.code over 32k');
if (code.length > 20000) errs.push('fort code large: ' + code.length);
if (doc.entities.length > 64) errs.push('over 64 entities');
for (const c of [doc.world.atmosphere.sky, doc.world.atmosphere.fog, doc.world.atmosphere.ground])
  if (!/^#[0-9a-f]{6}$/i.test(c)) errs.push('bad atmosphere hex ' + c);
if (errs.length) { console.error('REJECTED:', errs); process.exit(1); }
const out = new URL('../hlidarendi.trig.json', import.meta.url).pathname;
writeFileSync(out, JSON.stringify(doc, null, 1));
console.log('wrote', out, JSON.stringify(doc).length, 'bytes · fort code', code.length, 'chars ·', EL.length, 'meshes');
