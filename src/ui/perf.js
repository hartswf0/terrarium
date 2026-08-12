// PERF — the instrument panel. Asked for after a session spent inferring costs
// instead of reading them: LCP said the page loads in 0.14 s while INP said
// every interaction stalls 1.9 s, and only one of those matched the story we
// were telling ourselves. So: name the subsystems, time them, print numbers.
//
// Console:  PERF.report()   — a table of every named cost, worst first
//           PERF.loads()    — every fetch: url, ms, bytes (the load-time answer)
//           PERF.watch(120) — warn in-line whenever any call exceeds 120 ms
//           PERF.reset()
// Key:      P  prints the report without opening devtools' own panels.
//
// It measures; it never fixes. A number that disagrees with the theory is the
// point of having it.

const marks = new Map();   // label -> {n, total, max, last}
const loads = [];          // {url, ms, kb, at}
let warnOver = 0;

function note(label, ms) {
  let m = marks.get(label);
  if (!m) { m = { n: 0, total: 0, max: 0, last: 0 }; marks.set(label, m); }
  m.n++; m.total += ms; m.last = ms; if (ms > m.max) m.max = ms;
  if (warnOver && ms > warnOver) console.warn('[perf] ' + label + ' ' + ms.toFixed(1) + 'ms');
}

/** Time a method in place. The object keeps working; it just reports now. */
function wrap(obj, method, label) {
  if (!obj || typeof obj[method] !== 'function' || obj[method].__perf) return false;
  const orig = obj[method];
  const f = function (...a) {
    const t0 = performance.now();
    try { return orig.apply(this, a); } finally { note(label || method, performance.now() - t0); }
  };
  f.__perf = true;
  obj[method] = f;
  return true;
}

/** Fetches are the load-time question: which url, how long, how big. */
function watchFetch() {
  if (typeof window === 'undefined' || window.fetch.__perf) return;
  const of = window.fetch;
  const f = function (...a) {
    const url = String(a[0] && a[0].url ? a[0].url : a[0]).slice(0, 120);
    const t0 = performance.now();
    return of.apply(this, a).then(async (r) => {
      const ms = performance.now() - t0;
      let kb = 0;
      try { kb = +((+(r.headers.get('content-length') || 0)) / 1024).toFixed(1); } catch (_) {}
      loads.push({ url, ms: +ms.toFixed(0), kb, at: new Date().toLocaleTimeString() });
      note('fetch', ms);
      if (ms > 400) console.warn('[perf] slow fetch ' + ms.toFixed(0) + 'ms ' + url);
      return r;
    });
  };
  f.__perf = true;
  window.fetch = f;
}

export const PERF = {
  wrap, note,
  /** Instrument the parts we actually suspect. Safe to call more than once. */
  install({ renderer, world, app } = {}) {
    watchFetch();
    if (renderer) { wrap(renderer, 'build', 'renderer.build'); wrap(renderer, 'draw', 'renderer.draw'); }
    if (world) { wrap(world, 'reindex', 'world.reindex'); wrap(world, 'addEntity', 'world.addEntity'); wrap(world, 'removeEntity', 'world.removeEntity'); }
    if (app) for (const [o, m, l] of app) wrap(o, m, l);
    return this;
  },
  watch(ms = 120) { warnOver = ms; console.info('[perf] warning on anything over ' + ms + 'ms'); return this; },
  reset() { marks.clear(); loads.length = 0; return this; },
  loads() { console.table(loads.slice(-40)); return loads.length + ' fetches'; },
  report() {
    const rows = [...marks.entries()].map(([label, m]) => ({
      label, calls: m.n,
      'mean ms': +(m.total / m.n).toFixed(1),
      'worst ms': +m.max.toFixed(1),
      'last ms': +m.last.toFixed(1),
      'total ms': +m.total.toFixed(0),
    })).sort((a, b) => b['total ms'] - a['total ms']);
    console.table(rows);
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) console.info('[perf] page: dom ' + nav.domContentLoadedEventEnd.toFixed(0) + 'ms · load ' + nav.loadEventEnd.toFixed(0) + 'ms');
    return rows.length ? 'worst total: ' + rows[0].label : 'nothing measured yet';
  },
};

if (typeof window !== 'undefined') {
  window.PERF = PERF;
  addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) PERF.report();
  });
}
