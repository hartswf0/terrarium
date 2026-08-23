# HLIDARENDI.html — build source

`../HLIDARENDI.html` is one self-contained playable file (three.js bundled in,
no CDN). It is assembled from three parts by `../build.sh`:

- **`shell.html`** — the V16 Everybody HTML/CSS shell, retitled, with the
  BALL / FEED / SAVE buttons replacing the motion-import UI.
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

Console API in the built page: `window.HLIDARENDI`
(`place`, `actors`, `argos`, `props`, `takeBall/throwBall/feedBowl`,
`save/restore`, `snapshot()` → `thunder-rigs.cartridge/v1`).
