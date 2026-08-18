const assert = require('node:assert/strict');
global.window = global;
require('../terrarium-iii-architecture-v4-support.js');

const audit = global.III_ARCH_SUPPORT_V4.codeAudit;

const rotten = `function build(w, WG, THREE){
  function add(mesh){ w.add(mesh); }
  WG.ridge(0,0,0,34,10,2.4);
  WG.crest(-16,-2,0,10,2.2,10);
  WG.bank(14,2,0,14,8,0.28);
  WG.mound(0,0,0,2);
  const skin = WG.loft([], WG.flat(0xffffff));
  add(skin);
  WG.tick(t=>{});
  return w;
}`;

const bad = audit(rotten, {});
assert.equal(bad.severe, true, 'world-like source must fail closed');
assert.deepEqual(new Set(bad.world), new Set(['ridge','crest','bank','mound']));
assert.ok(bad.unsupported.includes('loft'), 'invented WG.loft must be rejected');
assert.equal(bad.worldAdd, true, 'direct w.add must be detected');
assert.equal(bad.exactStructure, false, 'missing STRUCTURE root must be detected');
assert.equal(bad.ticks, 1, 'static animation must be visible to the audit');

const bounded = `function build(w, WG, THREE){
  const STRUCTURE = new THREE.Group();
  STRUCTURE.name='STRUCTURE';
  STRUCTURE.userData.kind='architecture';
  WG.root.add(STRUCTURE);
  const mesh=WG.box(8,3,6,WG.matte(WG.P.stone));
  WG.put(mesh,0,1.5,0,0);
  STRUCTURE.add(mesh);
  WG.solid(WG.box(8,3,.4,WG.matte(WG.P.stone)),8,3,.4,0,1.5,-3,0);
  return w;
}`;

const good = audit(bounded, {collision_strategy:'one major wall proxy'});
assert.equal(good.severe, false, 'bounded structure source should pass static contract');
assert.equal(good.world.length, 0);
assert.equal(good.unsupported.length, 0);
assert.equal(good.exactStructure, true);
assert.equal(good.worldAdd, false);

console.log('architecture-v4-source-contract: ok');
