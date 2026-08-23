// hlidarendi/tools/make-iii-sidecar.mjs — regenerate terrarium-iii-hlidarendi.js.
// Part 1 (the ARGOS game contract) comes verbatim from the vendored source of
// record plus the ground-relative traction patch; part 2 (the species
// integration) is kept from the current sidecar, split at the banner line.
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url).pathname;
const src = readFileSync(root + 'hlidarendi/sources/argos-half-dog.html', 'utf8');
let ar = src.slice(src.indexOf('/*==PURE-BEGIN==*/'), src.indexOf('/*==PURE-END==*/') + '/*==PURE-END==*/'.length);
const oldT = `    var padY = mApply(rig.nodes[key+"Pad"].world, [0,-0.005,0])[1];
    var on = padY <= LOCO.groundTol;`;
if (!ar.includes(oldT)) throw new Error('traction anchor missing');
ar = ar.replace(oldT, `    var padY = mApply(rig.nodes[key+"Pad"].world, [0,-0.005,0])[1];
    /* HLIDARENDI patch: pad measured against the dog's OWN ground (the root
       carries the terrain height), not absolute y=0 — traction on real hills. */
    var on = padY - (rig.root.t[1]||0) <= LOCO.groundTol;`);
const cur = readFileSync(root + 'terrarium-iii-hlidarendi.js', 'utf8');
const BANNER = '/* ═════';
const tail = cur.slice(cur.indexOf(BANNER));
if (!tail) throw new Error('integration banner missing in current sidecar');
const header = cur.slice(0, cur.indexOf('/*==PURE-BEGIN==*/'));
writeFileSync(root + 'terrarium-iii-hlidarendi.js', header + ar + '\n' + tail);
console.log('regenerated terrarium-iii-hlidarendi.js');
