// THE COMMONS — one BUS behind the one line.
//
// Law L3 of the standing world: SAYING IS NOT COMMITTING, and there is exactly
// one place where saying happens. Every organ — the rig, the atlas, the parts
// palette, a future game — extends the language by registering a verb here,
// never by growing its own parser. The console dispatches; it owns nothing.
//
// A verb is (name, test, run, help):
//   test(lower, raw) → falsy, or a match the run receives
//   run(match, ctx)  → a spoken reply (string), or undefined for "done"
// Registration order is precedence: first verb to match speaks.

export const BUS = {
  verbs: [],

  register(name, test, run, help) {
    this.verbs.push({ name, test, run, help });
    return () => { this.verbs = this.verbs.filter((v) => v.run !== run); };
  },

  /** One utterance in, one reply out — or null, meaning "not ours, pass it on". */
  dispatch(text, ctx = {}) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    for (const v of this.verbs) {
      let m = null;
      try { m = v.test(lower, raw); } catch (_) { /* a broken verb is a mute verb */ }
      if (m) {
        const out = v.run(m, ctx, raw);
        return out === undefined ? v.name : out;
      }
    }
    return null;
  },

  help() { return this.verbs.filter((v) => v.help).map((v) => v.help); },
};

if (typeof window !== 'undefined') window.BUS = BUS;
