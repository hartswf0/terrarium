import assert from 'node:assert/strict';
import { Geonosis } from '../src/observe/geonosis.js';
import { interpretCondition, interpretForActors } from '../src/observe/interpret.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

const T0 = Date.parse('2026-08-25T14:00:00Z');

function fixture() {
  const g = new Geonosis();
  g.registerSource({
    id: 'test-water', name: 'Test Water', acquisition: 'LIVE', retention: 'MIRROR',
    mayDerive: true, mayRedistribute: true, license: 'test',
  });
  g.observe({
    id: 'o1', provider: 'test-water', providerRecordId: 'series1',
    observedAt: T0, retrievedAt: T0, epistemic: 'MEASURED',
    geometry: { type: 'Point', coordinates: [-84.4, 33.7] },
    rawProperties: {}, address: ['F08.0312'],
  });
  g.signal({
    id: 's1', subject: 'creek1', predicate: 'streamflow', value: 132,
    validFrom: T0, epistemic: 'MEASURED', derivedFrom: ['o1'], address: ['F08.0312'],
  });
  g.condition({
    id: 'c1', subject: 'creek1', state: 'FLOW_RISING', began: T0,
    lastSeen: T0 + 5 * 60 * 1000, expiresAt: T0 + 90 * 60 * 1000,
    strength: 0.42, supportedBy: ['s1'], epistemic: 'DERIVED', address: ['F08.0312'],
  });
  return g;
}

console.log('\nINTERPRETANTS — the same world means differently');

test('a condition alone does not manufacture meaning for an actor', () => {
  const g = fixture();
  const out = interpretCondition(g, 'c1', { actor: 'argos', actorKind: 'DOG', basis: [], now: T0 + 6 * 60 * 1000 });
  assert.equal(out, null);
  assert.equal(g.interpretants.size, 0);
});

test('unknown or misspelled relational bases are not permission', () => {
  const g = fixture();
  const out = interpretCondition(g, 'c1', {
    actor: 'argos', actorKind: 'DOG', basis: [{ kind: 'near-ish', distanceM: 8 }], now: T0 + 6 * 60 * 1000,
  });
  assert.equal(out, null);
});

test('one FLOW_RISING condition yields different cautious signs for dog, human and civic actors', () => {
  const g = fixture();
  const actors = [
    { actor: 'argos', actorKind: 'DOG', basis: [{ kind: 'perceivable', distanceM: 18 }] },
    { actor: 'walker', actorKind: 'HUMAN', basis: [{ kind: 'usedBy', relation: 'crossing' }] },
    { actor: 'stormwater', actorKind: 'CIVIC', basis: [{ kind: 'governs', relation: 'watershed' }] },
  ];
  const made = interpretForActors(g, 'c1', actors, { now: T0 + 6 * 60 * 1000 });
  assert.equal(made.length, 3);
  assert.equal(made[0].sign, 'water_motion_salience');
  assert.equal(made[1].sign, 'water_change_attention');
  assert.equal(made[2].sign, 'hydrologic_change_attention');
  assert.equal(new Set(made.map((x) => x.sign)).size, 3);
  for (const x of made) {
    assert.equal(x.derivedFrom[0], 'c1');
    assert.equal(x.strength, 0.42);
    assert.match(x.props.restraint, /no safety or behavioral claim/i);
  }
});

test('interpretants cannot cite evidence that Geonosis does not possess', () => {
  const g = fixture();
  assert.throws(() => g.interpret({
    id: 'bad', actor: 'argos', actorKind: 'DOG', subject: 'creek1', sign: 'mystery', value: true,
    derivedFrom: ['missing'], basis: [{ kind: 'perceivable' }], validFrom: T0,
  }), /missing evidence/);
});

test('interpretants inherit the condition expiry and disappear without a Terrarium deed', () => {
  const g = fixture();
  const x = interpretCondition(g, 'c1', {
    actor: 'argos', actorKind: 'DOG', basis: [{ kind: 'perceivable' }], now: T0 + 6 * 60 * 1000,
  });
  assert.equal(x.expiresAt, g.conditions.get('c1').expiresAt);
  const expired = g.expire(T0 + 91 * 60 * 1000);
  assert.ok(expired.some((r) => r.id === 'c1'));
  assert.ok(expired.some((r) => r.id === x.id));
  assert.equal(g.interpretants.size, 0);
});

test('actor and ICOSA queries can retrieve interpretations without duplicating them', () => {
  const g = fixture();
  const x = interpretCondition(g, 'c1', {
    actor: 'argos', actorKind: 'DOG', basis: [{ kind: 'perceivable' }], now: T0 + 6 * 60 * 1000,
  });
  assert.equal(g.byActor('argos')[0].id, x.id);
  assert.equal(g.byAddress('F08.03', { descendants: true }).interpretants[0].id, x.id);
});

test('interpretants survive a permitted Geonosis snapshot without becoming PLACE entities', () => {
  const g = fixture();
  interpretCondition(g, 'c1', {
    actor: 'argos', actorKind: 'DOG', basis: [{ kind: 'perceivable' }], now: T0 + 6 * 60 * 1000,
  });
  const loaded = Geonosis.load(g.snapshot());
  assert.equal(loaded.interpretants.size, 1);
  assert.equal(loaded.byActor('argos')[0].sign, 'water_motion_salience');
});

if (!process.exitCode) console.log(`\n${passed} interpretant tests passed.`);
