# HLIDARENDI.html — build source

`../HLIDARENDI.html` is one self-contained playable file (three.js bundled in,
no CDN). It is assembled from three parts by `../build.sh`:

- **`shell.html`** — the V16 Everybody HTML/CSS shell, retitled, with the
  BALL / FEED / SAVE buttons replacing the motion-import UI.
- **`elements.js`** — THE trailer element table (plan inches, walls split
  around real openings), transcribed from operative/ingold.js. One authority,
  two consumers: `main.js` renders and collides it in the standalone page;
  `../tools/make-cartridge.mjs` emits it as fort code for Terrarium III.
- **`main.js`** — the V16 Everybody module script, surgically fused:
  - `WORLD_BRIDGE.setPlace(PLACE)` — PLACE wraps a terrain heightfield plus
    the Ingold trailer (deck, walls split around real openings, `door.entry`
    with threshold and steps, windows as glass). One element list drives
    meshes, collision boxes, wall capsules and surface queries alike.
  - the placeholder V16 dog is replaced by the real ARGOS via
    `AR.createArgos()`: terrain/walkable wired to PLACE, mind mode, CPU-skinned
    mesh rendered by the host renderer, footfall/bark events surfaced.
  - ground-relative patches: pelvis clamps, sit/jump/grounded measurements and
    the camera all measure against the local surface, not `y = 0`.
  - fixes an upstream V16 bug: `const dt` reassigned in the touch path (froze
    the body solver on phones); now `let dt` with a non-negative clamp.
  - TRAILER SHIFT loop: take/throw ball (`argos.say('fetch the ball')` biases,
    never commands), feed bowl, dog fetch/carry/return, eat; save/restore of
    the inhabited situation via localStorage.
- **the AR module** — extracted verbatim at build time from
  `../sources/argos-half-dog.html` between the `==PURE-BEGIN==`/`==PURE-END==`
  markers. It is not duplicated here; the vendored source stays the source of
  record.

**SAY — the language seam.** The chat dock (SAY button on phones, open by
default on desktop) is the HELLO/WORLDTEXT line from the Terrarium base,
scoped rather than wholesale-ingested: spoken words are read offline by the
dog's own word rules and land on his mind as evidence (`argos.say`), slash
verbs address the world (`/save /reset /feed /ball /door`), and external
builders — the III chat-to-build pipeline, an LLM, a peer — plug in through
`HLIDARENDI.chat.register(handler)`: a handler that returns `true` claims the
utterance before the dog hears it. That registration point is where the III
structure compiler should eventually attach, keeping play offline-first.

Console API in the built page: `window.HLIDARENDI`
(`place`, `actors`, `argos`, `props`, `takeBall/throwBall/feedBowl`,
`save/restore`, `snapshot()` → `thunder-rigs.cartridge/v1`).
