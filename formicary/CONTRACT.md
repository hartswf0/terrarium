# FORMICARY — FROZEN INTERFACE CONTRACT

**Read this completely before writing a line. Do not change any signature in this file.**
If you believe a signature is wrong, implement it as written and say so in your report.

The shipped deliverable is ONE self-contained file: `/home/user/terrarium/formicary.html`.
It is **generated** by `node formicary/build.js` from `formicary/src/*`.
**Never edit `formicary.html` directly.** Edit only the part files you own.

Parts, concatenated in this order:

| file | wrapped as | owner piece |
|---|---|---|
| `00-head.html` | raw | SHELL |
| `10-style.css` | `<style>` | SHELL |
| `15-body.html` | raw | SHELL |
| `20-copy.js` | `<script>` | VOICE |
| `30-elements.js` | `<script>` | SIM |
| `40-sim.js` | `<script>` | SIM |
| `50-render.js` | `<script>` | FIELD |
| `60-table.js` | `<script>` | TABLE |
| `70-controls.js` | `<script>` | CONTROLS |
| `80-chapters.js` | `<script>` | CHAPTERS |
| `90-boot.js` | `<script>` | CHAPTERS |
| `99-tail.html` | raw | SHELL |

Because they are concatenated into one scope in order, **a part may reference anything defined
in an earlier part at load time, and anything from a later part only inside a function called
after boot.** Do not use ES modules, `import`, or `export`. No build-time transpiling.

---

## 0. HARD CONSTRAINTS (build.js enforces; violating = build exits non-zero)

- No `border-radius` anywhere.
- No emoji / pictographic characters anywhere. Marks are drawn (SVG or canvas) only.
- Typeface: IBM Plex Mono.
- Colors: **only** `#000 #fff #19e6c8 #ffd23f #ff2e2e #3b82f6` (plus `#000000`/`#ffffff`).
  Greys must be `rgba(0,0,0,α)` / `rgba(255,255,255,α)`, never a new hex, never `hsl()`.
- All 28 elements are real detectors: live trigger, real effect on the sim, working counter.

---

## 1. GLOBAL

Exactly one global: `FZ`. `00-head.html` does **not** define it; `20-copy.js` opens with:

```js
window.FZ = window.FZ || {};
```

Every later part does `FZ.<slot> = ...`. Never declare a top-level `const`/`let` with a name
another part might also use. Prefix any unavoidable file-local top-level binding with the part
name (e.g. `const simRnd = ...`).

Also expose the debug/test surface (implemented in `40-sim.js`):

```js
window.__FZ = {
  probe(),                 // -> small JSON snapshot, see §6
  audit({trials,ticks}),   // -> Promise<report>, see §7
  goto(chapterIndex),      // jump straight to a chapter (test hook)
};
```

---

## 2. `FZ.bus` — event bus (defined in `20-copy.js`, first part to load)

```js
FZ.bus = {
  on(name, fn),      // subscribe
  emit(name, data),  // publish (synchronous)
};
```

Events (payload shapes are contractual):

| event | payload | emitted by |
|---|---|---|
| `fire` | `{sym, at:{x,y}, who:[agentIds], say:String}` | SIM, when a detector trips |
| `job:done` | `{x, y, value}` | SIM |
| `job:lost` | `{x, y, why:String}` | SIM (rollback / merge conflict) |
| `agent:hurt` | `{id, x, y}` | SIM (stun) |
| `intervene` | `{kind, ok:Boolean, msg:String, x, y}` | SIM (via `apply`) |
| `goal` | `{met:Boolean}` | SIM, when scenario goal reached |
| `lose` | `{why:String}` | SIM, when scenario lost |
| `chapter:enter` | `{index, cfg}` | CHAPTERS |
| `say` | `{text, tone}` | anyone — narrator line request; CHAPTERS renders it |

`tone` ∈ `'plain' | 'bad' | 'good' | 'name'`.

---

## 3. `FZ.copy` — all user-facing strings (`20-copy.js`, owned by VOICE)

No other part may contain a user-facing English sentence. Everything the player reads comes
from `FZ.copy`. Structure:

```js
FZ.copy = {
  ui: { … short labels … },
  tools: { vary:{label,hint,blurb}, charter:{…}, slow:{…}, lens:{…}, ledger:{…}, eject:{…} },
  chapters: [ { title, sub, beats:[…], win, lose, learn }, … ],   // see §5
  fire: { Co:"…", Si:"…", … },   // one plain sentence per element, present tense, ≤ 90 chars
  end: { … },
  about: { … },
};
```

---

## 4. `FZ.EL` — the 28 elements (`30-elements.js`, owned by SIM)

`FZ.EL` is an **array of 28** objects, in table order. `FZ.ELBY[sym]` indexes them.

```js
{
  sym:  'Co',                    // 2 chars, unique
  nm:   'Coordination failure',  // formal name
  col:  0,                       // 0 COORDINATION 1 CONFORMITY 2 EPISTEMICS 3 GOALS/POWER 4 META
  glyph: '<svg …>',              // drawn mark, viewBox 0 0 20 20, currentColor-friendly
  plain: '…',                    // ONE plain-language sentence (from FZ.copy where possible)
  trigger: '…', effect: '…', counter: '…',   // detail card text
  chapter: 2,                    // chapter index where this first becomes live
  heat: 0,                       // runtime, 0..1
  fires: 0,                      // runtime counter (audit reads this)
  who:  [],                      // runtime: agent ids currently implicated
  countered: false,              // runtime
  detect(S, api),                // REQUIRED. See below.
  counteredBy(S),                // REQUIRED. -> Boolean
}
```

`detect(S, api)` is called once per tick **only if the element is enabled in the current
scenario**. `S` is `FZ.sim.state`. `api` provides:

```js
api.heat(amount, {at, who, say})   // raise this element's heat; emits `fire` on a rising edge
api.dist(a,b)  api.jobById(id)  api.agentById(id)
api.rand()                          // seeded RNG — NEVER use Math.random in a detector
api.tick                            // current tick
```

Rules for every detector, no exceptions:

1. It must read live simulation state. No timers, no random-only firing.
2. It must have a **real consequence** — either it directly mutates the sim inside `detect`
   (e.g. drains job progress, stuns an agent, cancels a claim) or the sim reads its `heat`
   in a way that changes outcomes. State which, in a comment above the detector.
3. `counteredBy(S)` must return true when the player's counter is genuinely applied, and
   countered elements must cool measurably faster.
4. On a rising edge it must call `api.heat(...)` with `at` (a field coordinate) and a `say`
   string pulled from `FZ.copy.fire[sym]`. This is what makes the failure *visible and named*.

---

## 5. `FZ.sim` — simulation (`40-sim.js`, owned by SIM)

```js
FZ.sim = {
  state,                       // see §6
  reset(scenario),             // build a fresh world from a scenario config
  step(),                      // advance exactly one tick
  apply(kind, x, y),           // -> {ok:Boolean, msg:String}  kind ∈ vary|charter|slow|lens|ledger|eject
  cost(kind),                  // -> Number
  enabled,                     // Set<sym> of elements live this scenario
};
```

`FZ.sim.state` (`S`) fields — other parts read these and must not write them:

```
tick, jobsDone, jobsGoal, budget, collapse (0..100), collapseMax, speedMul,
lensOn, ledgerOn, slowUntil, gameOver, won,
agents:[ {id,x,y,vx,vy,hue,job,stun,flash,known:Set,
          corrigible,adversary,rival,locker,colluder,myopic,esc} ],
jobs:[ {id,x,y,value,progress,need,claims:Set,poison,revealed,victimHue,prereq,locked,flash} ],
charters:[ {x,y,r} ],
rumor: null | {x,y,until},
w, h                          // field dimensions in CSS px
```

**Scenario config** (produced by CHAPTERS, consumed by `reset`):

```js
{
  id:'ch3', teach:['In','Co'],          // elements enabled THIS scenario (plus always-on ones)
  tools:['charter'],                    // intervention kinds available
  agents:{ n:12, hues:[0], roles:{adversary:0,incorrigible:0,rivals:0,locker:0,colluders:0} },
  jobs:{ n:4, max:5, poison:0, prereq:false, spawnEvery:0 },
  goal:{ jobs:3 },                      // or {survive:ticks}
  budget:6,
  collapseMax:100,                      // Infinity => no collapse pressure
  speed:1,
  seed:1234,                            // deterministic
  force:{ … }                           // scenario-specific guarantees, SIM defines the vocabulary
}
```

`force` exists so a teaching chapter can **guarantee** the lesson happens. A chapter that
teaches coordination failure must reliably produce a coordination failure within seconds.

### The field
`S.w`/`S.h` are set by boot from the canvas CSS size. Agents and jobs live in that space.
SIM must not touch the DOM or canvas.

---

## 6. `window.__FZ.probe()`

Returns a small JSON snapshot for tooling — no functions, no cycles:

```js
{ chapter, tick, jobsDone, jobsGoal, budget, collapse, agents, jobs,
  hot: [ {sym, heat, fires} … top 6 ],
  enabled: [syms], tools:[kinds], gameOver, won, narrator: "current narrator line" }
```

## 7. `window.__FZ.audit({trials, ticks})`

Runs the **full sandbox** (final chapter) headless, without rendering, `trials` times with
different seeds for `ticks` ticks each, applying a representative spread of interventions, and
returns:

```js
{ elements: { Co:{fires:Number, peak:Number, counterWorks:Boolean|null}, … all 28 },
  notes: {…} }
```

`counterWorks` must be measured, not asserted: run a stretch with the counter off, record heat
slope; run the same seed with the counter on, record heat slope; `true` if the counter
measurably reduces it. Return `null` only if the counter is not applicable headlessly, and
explain in `notes`.

The audit must complete in well under 60 seconds for `trials=6, ticks=40000`. Run the sim in a
tight loop, not on rAF.

---

## 8. `FZ.render` — canvas (`50-render.js`, owned by FIELD)

```js
FZ.render = {
  init(canvas),                 // store ctx, handle DPR
  resize(w,h),                  // CSS px
  draw(S),                      // draw one frame; pure read of S
};
```

FIELD subscribes to `fire`, `job:done`, `job:lost`, `agent:hurt` to draw transient causal marks.
FIELD owns everything inside `#field`. FIELD must not mutate `S`.

## 9. `FZ.table` — periodic table (`60-table.js`, owned by TABLE)

```js
FZ.table = {
  build(),            // create the cells inside #etable once
  setEnabled(set),    // which syms are live/known this chapter
  paint(S),           // per-frame cheap update
  open(sym),          // open the detail card for sym
  close(),
};
```

TABLE owns `#tableWrap`, `#etable`, `#detail`. It subscribes to `fire` to pulse cells.

## 10. `FZ.controls` — interventions & input (`70-controls.js`, owned by CONTROLS)

```js
FZ.controls = {
  build(),                 // create the tool bar inside #bar
  setAvailable(kinds),     // ONLY these tool buttons exist in the DOM (absent, not disabled)
  paint(S),
  armed,                   // current armed kind or null
};
```

CONTROLS owns `#bar`, arming state, and **all pointer input on `#field`** (it calls
`FZ.sim.apply`). It must not draw to the canvas; to show targeting affordances it sets
`FZ.controls.aim = {kind,x,y}` and FIELD draws it.

## 11. `FZ.chapters` — sequencing (`80-chapters.js`) and `90-boot.js`

```js
FZ.chapters = {
  list,                  // array of {cfg, script}
  start(i),              // reset sim, set tools/table, run the beat script
  next(), retry(),
  index,
};
```

`90-boot.js` wires DOM refs, sizes the canvas, starts the rAF loop, and calls
`FZ.chapters.start(0)`. The rAF loop is the ONLY place `FZ.sim.step()` is called during play.

---

## 12. DOM SKELETON (defined in `15-body.html`, owned by SHELL — ids are contractual)

```
#app
  #hdr        header strip
    #chapTitle  #chapCount  #progressRail
  #stage      the play area
    #field      <canvas>
    #aimHint    targeting hint over the field
    #ticker     the causal readout line
  #say        narrator panel (chapters write here)
  #tableWrap  > #etable  (+ #metaRow)
  #detail     element detail card (fixed)
  #bar        intervention bar
  #gate       full-screen chapter gate (title / result / continue)
  #about      about overlay
  #toast
```

Any part may add elements **inside** the container it owns. No part may remove or rename an id
listed above.

---

## 13. HOW TO WORK

1. `cd /home/user/terrarium && node formicary/build.js` — must print `BUILD OK`.
2. `node formicary/tools/probe.js --name me --steps "wait:2000,shot:a" --dump` — must print
   `PAGE ERRORS: none`.
3. `node formicary/tools/audit.js` — the sim gate.
4. Edit **only the files you own.** If you need a change in a file you don't own, write the
   request in your final report; do not edit it.
5. Screenshots land in `formicary/shots/`. Look at them with the Read tool. Actually look.
