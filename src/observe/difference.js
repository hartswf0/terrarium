// DIFFERENCE ENGINE — detect before interpreting.
//
// These operators do not narrate and do not call a model. They expose specific
// differences that an actor or later language layer may interpret.

function finite(v) { return Number.isFinite(Number(v)); }
function num(v) { return Number(v); }

export function change(previous, current, epsilon = 0) {
  if (!finite(previous) || !finite(current)) return { kind: 'CHANGE', active: false, reason: 'NON_NUMERIC' };
  const delta = num(current) - num(previous);
  return { kind: 'CHANGE', active: Math.abs(delta) > epsilon, previous: num(previous), current: num(current), delta };
}

export function absence({ expected = true, observed = false, coverage = 'SUFFICIENT' } = {}) {
  const sufficient = coverage === 'SUFFICIENT';
  return {
    kind: 'ABSENCE',
    active: !!expected && !observed && sufficient,
    expected: !!expected,
    observed: !!observed,
    coverage,
    reason: !sufficient ? 'INSUFFICIENT_COVERAGE' : null,
  };
}

export function surprise(observed, expected, tolerance = 0) {
  if (!finite(observed) || !finite(expected)) return { kind: 'SURPRISE', active: false, reason: 'NON_NUMERIC' };
  const deviation = num(observed) - num(expected);
  return { kind: 'SURPRISE', active: Math.abs(deviation) > tolerance, observed: num(observed), expected: num(expected), deviation, tolerance };
}

export function mismatch(declared, observed) {
  return { kind: 'MISMATCH', active: declared !== observed, declared, observed };
}

export function latency(physicalAt, recognizedAt, thresholdMs = 0) {
  const a = Number(physicalAt), b = Number(recognizedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { kind: 'LATENCY', active: false, reason: 'MISSING_TIME' };
  const delayMs = b - a;
  return { kind: 'LATENCY', active: delayMs > thresholdMs, physicalAt: a, recognizedAt: b, delayMs, thresholdMs };
}

export function contestation(claims = []) {
  const present = claims.filter((c) => c && c.predicate != null && 'value' in c);
  const byPredicate = new Map();
  for (const claim of present) {
    if (!byPredicate.has(claim.predicate)) byPredicate.set(claim.predicate, []);
    byPredicate.get(claim.predicate).push(claim);
  }
  const conflicts = [];
  for (const [predicate, group] of byPredicate) {
    const values = new Map();
    for (const claim of group) {
      const key = JSON.stringify(claim.value);
      if (!values.has(key)) values.set(key, []);
      values.get(key).push(claim.id || null);
    }
    if (values.size > 1) conflicts.push({ predicate, variants: [...values.entries()].map(([value, ids]) => ({ value: JSON.parse(value), ids })) });
  }
  return { kind: 'CONTESTATION', active: conflicts.length > 0, conflicts };
}

function median(values) {
  const a = values.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Detect a recurring interval. Samples are epoch-ms timestamps. */
export function rhythm(samples = [], { maxRelativeJitter = 0.25 } = {}) {
  const times = samples.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (times.length < 3) return { kind: 'RHYTHM', active: false, reason: 'TOO_FEW_SAMPLES' };
  const intervals = [];
  for (let i = 1; i < times.length; i++) if (times[i] > times[i - 1]) intervals.push(times[i] - times[i - 1]);
  if (intervals.length < 2) return { kind: 'RHYTHM', active: false, reason: 'TOO_FEW_INTERVALS' };
  const periodMs = median(intervals);
  const meanAbsError = intervals.reduce((s, x) => s + Math.abs(x - periodMs), 0) / intervals.length;
  const relativeJitter = periodMs > 0 ? meanAbsError / periodMs : Infinity;
  return { kind: 'RHYTHM', active: relativeJitter <= maxRelativeJitter, periodMs, relativeJitter, samples: times.length };
}

/** A previously learned rhythm whose next expected event has not arrived. */
export function rupture({ lastSeen, periodMs, now = Date.now(), grace = 0.5 } = {}) {
  const l = Number(lastSeen), p = Number(periodMs), n = Number(now);
  if (!Number.isFinite(l) || !Number.isFinite(p) || p <= 0 || !Number.isFinite(n)) {
    return { kind: 'RUPTURE', active: false, reason: 'MISSING_RHYTHM' };
  }
  const expectedBy = l + p * (1 + Math.max(0, grace));
  return { kind: 'RUPTURE', active: n > expectedBy, lastSeen: l, periodMs: p, expectedBy, lateByMs: Math.max(0, n - expectedBy) };
}
