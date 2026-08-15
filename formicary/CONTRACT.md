# FORMICARY — FROZEN INTERFACE CONTRACT

> **READ `AESTHETIC.md` FIRST.** It is CIVIC NATURALISM, the governing design law, and it
> **supersedes this document and the original hard rules wherever they conflict.** In
> particular: the black-and-white palette, the no-border-radius ban, the permanent 28-cell
> table and the permanent six-button tool bar are all **retired**. The Depiction Law —
> *what fact does this allow me not to write?* — outranks every instruction here.

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
| `45-outbreak.js` | `<script>` | PLAY |
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

Rebuilt for CIVIC NATURALISM (`AESTHETIC.md` §8). **The permanent HUD is abolished.** When
nothing requires the player's judgement, the colony owns the screen.

```
#app
  #crown      TOP — very quiet persistent state. Small mono, low contrast, no boxes.
              jobs done / food / colony strain. Nothing else, ever.
  #world      CENTRE — almost entirely colony. Grows to fill everything not otherwise used.
    #field      <canvas> — the nest. Tunnels, chambers, ants, brood, scars, weather.
    #tagLayer   at most ONE paper tag at a time, positioned near its incident
  #act        BOTTOM — EMPTY AND ABSENT unless there is a decision. One title, one
              plain line, one button. Then it disappears again.
  #guide      the field guide overlay (collected plates) — never open during a decision
  #gate       full-screen episode card (title / result / continue)
  #about      about overlay
```

**Rules that are part of the contract, not style notes:**

1. **At most one message on screen at any instant.** `#tagLayer` holds at most one tag;
   `#act` holds at most one prompt. There is no ticker, no narrator strip, no toast and no
   detail card during play. The old build showed four simultaneous explanations of two
   different failures — that is the defining bug this architecture exists to prevent.
2. **`#act` is absent, not empty and not disabled**, whenever there is no decision.
3. **The two-letter element code never renders inside `#world`, `#tagLayer` or `#act`.** Codes
   live only in `#guide` and `#gate`. Play-time text names the *phenomenon* ("STUCK CLAIM"),
   never the taxonomy.
4. **`#guide` cannot be opened while an incident is burning.** Theory is the reward for
   comprehension, never a thing competing with it.

Any part may add elements **inside** the container it owns. No part may remove or rename an id
listed above.

---

## 14. `FZ.outbreak` — THE CORE LOOP (`45-outbreak.js`, owned by PLAY)

**This is the most important part of the build.** Added after the first playtest verdict:
*"not very playable."* Read `REFERENCE-EOT.md` §2B before touching it.

Without this layer, a detector firing only warms a table cell — the player taps a button, sees
a toast, and nothing on screen changes. This layer turns every one of the 28 detectors into a
timed diagnosis the player must answer.

```js
FZ.outbreak = {
  list,                       // active outbreaks, read by FIELD and TABLE
  update(S),                  // called once per tick by the rAF loop, AFTER FZ.sim.step()
  tryAnswer(kind, x, y),      // -> {hit:Boolean, right:Boolean, sym, msg}
  mastery,                    // {sym: {answered, missed}} — persisted to localStorage
  reset(scenario),
};
```

An outbreak:

```js
{ sym, x, y, r,            // where it happened, and the radius an answer must land within
  born, fuse,              // tick born, ticks until it lands its damage
  say,                     // FZ.copy.fire[sym] — the plain sentence
  answers: ['charter'],    // tool kinds that resolve it (from the element)
  state }                  // 'burning' | 'answered' | 'landed'
```

Rules:

1. **Opening.** Subscribe to `fire`. An element that fires while it has no live outbreak opens
   one at `at`. Cap concurrent outbreaks by chapter (ch1–7: 1, ch8: 2, ch9: 3) so the player
   is pressured but never swamped.
2. **The fuse** must be short enough to be urgent and long enough to be answerable — start
   around 6 seconds of real time and **scale down with `S.speedMul`**. This is how `Sp` machine
   speed becomes the difficulty curve rather than a caption.
3. **Answering.** CONTROLS calls `tryAnswer(kind, x, y)` *before* `FZ.sim.apply`, so a correct
   answer can also refund or discount the tool's cost.
   - right tool, within `r`, before the fuse → `state='answered'`, strain refunded, small
     budget reward, `mastery[sym].answered++`, emit `outbreak:answered`.
   - wrong tool → do **not** resolve; emit `outbreak:wrong` with a plain sentence from
     `FZ.copy.wrong[sym]` explaining why that instrument does not address this failure. This
     is the teaching moment; make it generous, not punitive.
   - fuse expires → apply the element's real damage, `mastery[sym].missed++`, leave a scar
     mark, emit `outbreak:landed`.
4. **Every element declares its answer.** Add `answers: [kind…]` to each of the 28 element
   defs in `30-elements.js`. Every element must have at least one answering institution, and
   the mapping must be *learnable from the counter text the player can already read*.
5. **Mastery accumulates** across sessions in `localStorage` under `formicary.mastery`, and
   TABLE renders it — a cell the player has personally diagnosed is marked. This is L10.5.

Events emitted: `outbreak:open {sym,x,y,fuse}`, `outbreak:answered {sym,x,y}`,
`outbreak:wrong {sym,kind,msg}`, `outbreak:landed {sym,x,y}`.

FIELD draws the outbreak ring, its fuse, and its resolution. TABLE pulses and marks the cell.
CONTROLS routes answers. CHAPTERS sets the concurrency cap and may pre-script the first
outbreak of a teaching chapter so the lesson is guaranteed.

---

## 15. TRADE-OFFS — institutions are not upgrades (SIM + PLAY)

**Read `RESEARCH.md` §3 before implementing.** These are not balance knobs invented for
difficulty; each is a published finding from the source paper, and implementing them makes the
sim both more accurate and more playable at once.

Before this section, buying every institution was strictly good, so there was no decision. Now
every instrument costs you in a currency that is some other failure getting worse.

### 15.1 The trust dial has two ends

The paper: *"turning a simple dial to fix one issue will simply exacerbate the other. Human
trust ... isn't a single global value. Instead, it's conditional."*

- `S.ledgerOn` (skepticism up) suppresses `Gu` `Tc` `Rp`, and must **amplify** `Di` and `Cs` —
  a colony that discounts unproven sources also discounts the lone worker who happens to be right.
- `S.lensOn` (receptivity up) suppresses `Mm` `Hi` `Di` `Cs` `Pt` `My`, and must **amplify**
  `Gu` — a colony that broadcasts everything also broadcasts the rumour.
- Both on simultaneously holds the middle, costs double upkeep, and is the intended late-game
  strategy. Neither on is cheap and blind.

Implement as an explicit multiplier the detectors read, e.g. `S.trustBias` in `[-1, +1]`, so the
amplification is a real term in `detect()` and not a hidden constant.

### 15.2 Ownership is a fake fix for merge conflict

The paper: newer models "solved" merge conflict *"only by hardly working together at all."*
Whatever suppresses `Mc` by raising per-agent file ownership must raise `Si` and `Ow`. A CHARTER
is the only instrument that lowers `Mc` **without** paying in siloing — that is what makes it
worth three budget instead of two.

### 15.3 Conflicts resolve in four named ways

`Tw` and `Es` must terminate in one of the paper's four observed outcomes, visibly, rather than
silently cooling. Add `resolution` to the rival agents' state:

- `'force'` — one agent locks the other out (becomes an `Lo` lockout; the loser stops working)
- `'passivity'` — one agent gives up entirely and idles for a long period
- `'truce'` — both resume work; only reliably reachable under a CHARTER
- `'unsettled'` — burns until the scenario ends

Emit `conflict:resolved {mode, x, y}` so FIELD can draw which of the four happened and CHAPTERS
can speak to it. Truce is the good ending and is what the player is buying.

### 15.4 Capability is not coordination

The paper: *"Models more capable in execution are not necessarily more coordinated, and can take
forceful actions more quickly."*

`S.speedMul` must raise **both** throughput and aggression: agents complete work faster *and*
escalate, lock out and sabotage sooner. The colony becomes visibly more productive and more
dangerous on the same curve. Do not implement machine speed as a pure penalty — that is both
less true and less interesting than the real finding.

---

## 13. HOW TO WORK

1. `cd /home/user/terrarium && node formicary/build.js` — must print `BUILD OK`.
2. `node formicary/tools/probe.js --name me --steps "wait:2000,shot:a" --dump` — must print
   `PAGE ERRORS: none`.
3. `node formicary/tools/audit.js` — the sim gate.
4. Edit **only the files you own.** If you need a change in a file you don't own, write the
   request in your final report; do not edit it.
5. Screenshots land in `formicary/shots/`. Look at them with the Read tool. Actually look.
