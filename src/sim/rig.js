// RIG v2 — the drivable body from THUNDER RIGS / unsettled-atlas, living on
// CREO's ground. THE PERFORMANCE THEORY (why v1 was boring): motion was
// expressed as world mutation, so every tick forced renderer.build() — the
// whole district re-tessellated per frame. v2 splits MOTION from CHANGE:
// the world's buffers freeze as designed ("not per frame"), and the rig is a
// ~40-triangle dynamic pass (renderer.setDynamic) rebuilt each tick for free.
// The undo journal is untouched — a passing vehicle is weather, not history.
// Height is only ever asked of world.place.groundAt (Class-A doctrine).
//
// V mount/dismount · W/S throttle · A/D steer · Shift boost · drag to look
// (the chase camera yields to you when slow, takes the wheel when fast).

const K = {};
let listening = false;
function listen() {
  if (listening) return; listening = true;
  addEventListener('keydown', (e) => { K[e.code] = true; });
  addEventListener('keyup', (e) => { K[e.code] = false; });
  addEventListener('blur', () => { for (const k in K) K[k] = false; });
}
const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');

// ── loading animation: any fetch in flight > 250 ms lights the arrival bar ──
(function fetchVeil() {
  if (typeof window === 'undefined') return;
  let inflight = 0, el = null, timer = 0;
  const show = () => {
    if (!el) {
      const st = document.createElement('style');
      st.textContent = '@keyframes rigload{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(st);
      el = document.createElement('div');
      el.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 20%,#6fe0c0 50%,transparent 80%);background-size:200% 100%;animation:rigload .9s linear infinite"></div>'
        + '<div id="rigload-card" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(10,14,18,.92);border:1px solid rgba(120,200,170,.4);border-radius:12px;padding:16px 22px;color:#cfe8dd;font:700 13px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.6)">◍ RAISING THE GROUND<div style="margin-top:6px;font-weight:500;font-size:10px;color:#8fb8a8">real elevation · buildings · contours</div></div>';
      el.style.cssText = 'z-index:99;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
  };
  const hide = () => { if (el) el.style.display = 'none'; };
  const of = window.fetch;
  window.fetch = function (...a) {
    inflight++; clearTimeout(timer); timer = setTimeout(() => { if (inflight > 0) show(); }, 250);
    return of.apply(this, a).finally(() => { inflight--; if (inflight <= 0) { inflight = 0; hide(); } });
  };
})();

// ── engine: a hum that answers the throttle (feedback is half the fun) ──────
// The browser will not let a page make sound before the person has touched it,
// and asking anyway — which the auto-mounted rig did, sixty times a second —
// fills the console with refusals. So the engine stays mute until one real
// gesture has been heard, then starts cleanly on the next tick.
let AC = null, osc = null, filt = null, gainN = null, heard = false;
if (typeof window !== 'undefined') {
  const arm = () => { heard = true; if (AC && AC.state === 'suspended') AC.resume(); };
  addEventListener('pointerdown', arm, true);
  addEventListener('keydown', arm, true);
}
// SOUND IS OFF UNTIL ASKED FOR, AND IT IS NOT A MOSQUITO.
//
// A raw sawtooth with a resonant filter at 58–400 Hz is, precisely, an insect:
// thin, buzzing, and rising into the ear with every throttle press. A motor
// heard from inside is mostly what you FEEL — low, soft, and dull. So: a
// triangle (no harsh upper harmonics), a fundamental that stays under 100 Hz,
// a lowpass that never opens past 240 Hz, no resonance, and a quarter of the
// gain. And it stays SILENT unless the driver turns it on, because a sound
// nobody asked for is a sound that is wrong by default.
let soundOn = false;
try { soundOn = localStorage.getItem('terrarium.sound') === 'on'; } catch (_) {}
export function setEngineSound(on) {
  soundOn = !!on;
  try { localStorage.setItem('terrarium.sound', on ? 'on' : 'off'); } catch (_) {}
  if (!on && gainN) gainN.gain.value = 0;
  return soundOn;
}
export const engineSoundOn = () => soundOn;

function engine(speed, on) {
  try {
    if (!on || !soundOn) { if (gainN) gainN.gain.value = 0; return; }
    if (!heard) return;
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      osc = AC.createOscillator(); osc.type = 'triangle';
      filt = AC.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.7;
      gainN = AC.createGain(); gainN.gain.value = 0;
      osc.connect(filt); filt.connect(gainN); gainN.connect(AC.destination); osc.start();
    }
    if (AC.state === 'suspended') AC.resume();
    const s = Math.abs(speed);
    // A motor at rest makes no sound. Level IS the throttle, and the pitch
    // barely moves — a rig is a chest note, not a whine.
    osc.frequency.value = 42 + Math.min(52, s * 1.5);
    filt.frequency.value = 120 + Math.min(120, s * 3);
    gainN.gain.setTargetAtTime(s < 0.5 ? 0 : Math.min(0.014, 0.004 + s * 0.0009), AC.currentTime, 0.12);
  } catch (_) {}
}

// ── the body: oriented boxes in the dynamic pass ────────────────────────────
const SWATCHES = [
  ['teal',   [0.10, 0.88, 0.76]], ['ember', [1.00, 0.32, 0.20]],
  ['amber',  [1.00, 0.80, 0.25]], ['violet', [0.66, 0.48, 0.92]],
  ['bone',   [0.94, 0.95, 0.96]], ['coal',  [0.12, 0.13, 0.16]],
];
function obox(B, C, F, Lt, U, sx, sy, sz, col) {
  const P = (x, y, z) => [C[0] + F[0] * x + Lt[0] * y + U[0] * z,
                          C[1] + F[1] * x + Lt[1] * y + U[1] * z,
                          C[2] + F[2] * x + Lt[2] * y + U[2] * z];
  const p = [P(-sx, -sy, -sz), P(sx, -sy, -sz), P(sx, sy, -sz), P(-sx, sy, -sz),
             P(-sx, -sy, sz),  P(sx, -sy, sz),  P(sx, sy, sz),  P(-sx, sy, sz)];
  B.quad(p[4], p[5], p[6], p[7], col, 1);   // +U
  B.quad(p[0], p[3], p[2], p[1], col, 1);   // −U
  B.quad(p[1], p[2], p[6], p[5], col, 1);   // +F
  B.quad(p[3], p[0], p[4], p[7], col, 1);   // −F
  B.quad(p[2], p[3], p[7], p[6], col, 1);   // +Lt
  B.quad(p[0], p[1], p[5], p[4], col, 1);   // −Lt
}

// ── DRIVE dock: mount, speed, and a HELLO-lite garage (pick your colour) ────
let dockEl = null, speedEl = null;
function dock(rig) {
  if (dockEl) { dockEl.style.display = 'flex'; return; }
  // THE DOCK JOINS THE MAP COLUMN. Mount, speed and paint were a bar across
  // the bottom-left, opposite the plan, with the thumb's whole reach between
  // them — and on a phone the middle of the screen (the world) was the only
  // place NOT holding a control. Everything that is an instrument now stacks
  // on the right: dismount, speed, paint, then the plan, then the meter.
  // A THIN STRIP, TUCKED UNDER THE MAP. Mount, speed and paint were a fat
  // panel floating in the middle of the right-hand side, in front of the
  // world, taking as much room as the map itself — for one button, one
  // number, and six squares that matter once. Now: one small mount/dismount
  // control, the speed, and a single dot that CYCLES the paint. Everything it
  // used to spend space saying is in the menu or on the line.
  dockEl = document.createElement('div');
  dockEl.id = 'rig-dock';
  dockEl.style.cssText = 'position:fixed;right:12px;bottom:66px;z-index:61;width:214px;box-sizing:border-box;'
    + 'display:flex;align-items:center;gap:6px;justify-content:space-between;'
    + 'background:rgba(10,14,18,.86);border:1px solid rgba(120,200,170,.28);border-radius:8px;padding:4px 7px;'
    + 'font:700 9px/1 ui-monospace,monospace;color:#cfe8dd;letter-spacing:.06em;';
  const btn = document.createElement('button');
  btn.textContent = 'DRIVE';
  btn.style.cssText = 'background:#6fe0c0;color:#06251c;border:0;border-radius:6px;'
    + 'font:800 9px/1 ui-monospace,monospace;letter-spacing:.08em;padding:5px 8px;cursor:pointer;';
  btn.addEventListener('click', () => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} dispatchEvent(new KeyboardEvent('keydown', { key: 'v' })); });
  dockEl.appendChild(btn);
  speedEl = document.createElement('span');
  speedEl.textContent = '0 km/h';
  speedEl.style.cssText = 'flex:1;text-align:right;color:#8fb8a8;font-weight:600;';
  dockEl.appendChild(speedEl);
  let ci = 0;
  const dot = document.createElement('button');
  dot.title = 'paint the rig';
  const paintDot = () => {
    const c = SWATCHES[ci][1];
    dot.style.background = 'rgb(' + c.map((v) => Math.round(v * 255)).join(',') + ')';
  };
  dot.style.cssText = 'width:15px;height:15px;border-radius:50%;border:1px solid rgba(255,255,255,.3);'
    + 'cursor:pointer;padding:0;flex:0 0 auto;';
  dot.addEventListener('click', () => { ci = (ci + 1) % SWATCHES.length; rig.color = SWATCHES[ci][1]; paintDot(); });
  paintDot();
  dockEl.appendChild(dot);
  document.body.appendChild(dockEl);
  rig._btn = btn;
}

// A KEY LIST IS NOT AN INTERFACE. The controls bar sat across the bottom of
// every frame forever, naming keys that a touch screen does not have, in front
// of the world it was describing. It now appears ONCE, briefly, on the first
// mount of a session — and never on a touch device, where the joystick and the
// buttons are the controls and a keyboard legend is a lie.
const TOUCH = typeof window !== 'undefined'
  && (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
let hintShown = false;
let hintEl = null;
function hint(text) {
  if (TOUCH) return;                       // the thumb already knows
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.id = 'rig-hint';
    hintEl.style.cssText = 'position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:60;'
      + 'background:rgba(10,14,18,.85);color:#cfe8dd;border:1px solid rgba(120,200,170,.4);border-radius:9px;'
      + 'font:600 11px/1.3 ui-monospace,monospace;letter-spacing:.04em;padding:7px 12px;pointer-events:none;';
    document.body.appendChild(hintEl);
  }
  hintEl.textContent = text;
  hintEl.style.display = text ? 'block' : 'none';
}

export function autoMount(world, cam) {
  if (!RIG.on && world && world.place) { try { RIG.enter(world, cam); } catch (e) { console.warn('autoMount', e); } }
}

export const RIG = {
  on: false, p: [0, 0], yaw: 0, v: 0, t: 0, saved: null, color: SWATCHES[0][1], r: null, jz: 0, vz: 0, _shots: [],

  toggle(world, cam) { this.on ? this.exit(world, cam) : this.enter(world, cam); },

  enter(world, cam) {
    listen(); dock(this);
    try { document.activeElement && document.activeElement.blur(); } catch (_) {}   // the wheel takes the keyboard from the say-bar
    const b = world.place.terrain ? world.place.terrain.bounds : [-50, -50, 50, 50];
    this.p = [Math.min(Math.max(cam.target[0], b[0] + 5), b[2] - 5),
              Math.min(Math.max(cam.target[1], b[1] + 5), b[3] - 5)];
    this.yaw = cam.yaw + Math.PI;              // start pointed away from the eye
    this.v = 0; this.t = performance.now();
    this.saved = { dist: cam.dist, pitch: cam.pitch };
    cam.dist = 52; cam.pitch = 0.44;
    this.on = true;
    if (this._btn) this._btn.textContent = 'DISMOUNT ✕';
    chrome(this); chromeShow(true);
    // once per session, then it gets out of the way
    if (!hintShown) {
      hintShown = true;
      hint('W/S · A/D · Space jump · F fire · Shift boost · V dismount');
      setTimeout(() => { try { hint(''); } catch (_) {} }, 6000);
    }
    engine(0, true);
  },

  exit(world, cam) {
    if (this.saved && cam) { cam.dist = this.saved.dist; cam.pitch = this.saved.pitch; }
    this.on = false;
    try { this.r && this.r.setDynamic(null); } catch (_) {}
    if (this._btn) this._btn.textContent = 'DRIVE ▸';
    if (speedEl) speedEl.textContent = '0 km/h';
    chromeShow(false);
    hint('');
    engine(0, false);
  },

  tick(world, cam) {
    if (!this.on) return false;
    const now = performance.now(); let dt = (now - this.t) / 1000; this.t = now;
    if (dt > 0.1) dt = 0.1;
    let th = typing() ? 0 : ((K.KeyW || K.ArrowUp) ? 1 : 0) - ((K.KeyS || K.ArrowDown) ? 1 : 0);
    let st = typing() ? 0 : ((K.KeyA || K.ArrowLeft) ? 1 : 0) - ((K.KeyD || K.ArrowRight) ? 1 : 0);
    if (JOY.active) { th = Math.max(-1, Math.min(1, th + JOY.y)); st = Math.max(-1, Math.min(1, st - JOY.x)); }
    const boost = BTN.boost || (!typing() && (K.ShiftLeft || K.ShiftRight));
    const vmax = boost ? 46 : 27;
    this.v += th * (boost ? 60 : 40) * dt;      // real punch
    this.v -= this.v * 0.8 * dt;
    // The wheels ride the ground AS DRAWN, not the smooth mathematical one:
    // between lattice points the two disagree by metres on a hillside, and the
    // difference is exactly the "clipping through the terrain" you could see.
    const g = (x, y) => (this._drawnGround && this._drawnGround(x, y)) ?? world.place.groundAt(x, y);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const slope = (g(this.p[0] + c * 2.2, this.p[1] + s * 2.2) - g(this.p[0], this.p[1])) / 2.2;
    this.v -= slope * 9.8 * 0.5 * dt * Math.sign(this.v || 1);   // the hill is real
    // JUMP — the ground can be left, and it comes back
    if ((BTN.jump || (!typing() && K.Space)) && this.jz <= 0) { this.vz = 7.4; this.jz = 0.01; blip(320, 0.08); }
    BTN.jump = false;
    if (this.jz > 0) { this.vz -= 20 * dt; this.jz += this.vz * dt; if (this.jz <= 0) { this.jz = 0; this.vz = 0; thud('land'); } }
    // FIRE — the shot is a world event: what it hits leaves the world, journaled
    if ((BTN.fire || (!typing() && K.KeyF)) && now - (this._fireAt || 0) > 260) { this._fireAt = now; fire(this, world); }
    if (this.v > vmax) this.v = vmax; if (this.v < -vmax * 0.4) this.v = -vmax * 0.4;
    const turn = st * 2.6 * dt * Math.min(1, Math.abs(this.v) / 3.5) * (this.v < 0 ? -1 : 1);
    this.yaw += turn;

    // DRIFT. A rig that turns instantly is a cursor. The body's heading now
    // leads its momentum: hard steering at speed builds SLIP — a sideways
    // velocity that carries you wide, decays as the tyres bite, and is what
    // makes a corner cost something. Boost feeds it, so the fastest line is
    // never the tightest one.
    // Tuned DOWN after driving it: the first pass threw the tail out on every
    // corner, which is a stunt, not a feel. Slip now needs real speed before
    // it appears at all (below ~9 m/s the tyres simply hold), builds a third
    // as fast, bites back harder, and tops out at a slide you can still steer.
    const grip = boost ? 4.0 : 5.4;
    const bite = Math.max(0, Math.min(1, (Math.abs(this.v) - 9) / 14));   // 0 under 9 m/s
    this.slip = (this.slip || 0) - turn * Math.abs(this.v) * bite * (boost ? 0.62 : 0.4);
    this.slip -= this.slip * Math.min(1, grip * dt);
    if (Math.abs(this.slip) > 11) this.slip = Math.sign(this.slip) * 11;
    this.drift = Math.min(1, Math.abs(this.slip) / 9);           // 0..1, how sideways
    // SOLIDS — gathered on a slow clock because the world is not what is
    // moving; only the rig is. One index query per 400 ms, then pure geometry.
    if (!this._solidsAt || now - this._solidsAt > 400
        || Math.hypot(this.p[0] - (this._solidsP ? this._solidsP[0] : 1e9), this.p[1] - (this._solidsP ? this._solidsP[1] : 1e9)) > 18) {
      this._solidsAt = now; this._solidsP = [this.p[0], this.p[1]];
      let near = [];
      try { near = world.near(this.p, 40).map(h => h.entity); } catch (_) {}
      this._solids = near.filter(e => e && e.footprint && e.collision === 'solid' && e.type !== 'terrain');
      this._ramps = near.filter(e => e && e.footprint && e.props && (e.props.part === 'ramp' || e.props.part === 'qpipe'));
    }
    const b = world.place.terrain ? world.place.terrain.bounds : [-50, -50, 50, 50];
    const px = this.p[0], py = this.p[1];
    const sideX = -Math.sin(this.yaw), sideY = Math.cos(this.yaw);
    const nx = px + Math.cos(this.yaw) * this.v * dt + sideX * (this.slip || 0) * dt;
    const ny = py + Math.sin(this.yaw) * this.v * dt + sideY * (this.slip || 0) * dt;
    this.p[0] = Math.min(Math.max(nx, b[0] + 2), b[2] - 2);
    this.p[1] = Math.min(Math.max(ny, b[1] + 2), b[3] - 2);
    if (this.p[0] !== nx || this.p[1] !== ny) this.v *= 0.4;     // the edge of the ground is the edge
    // RAMPS: unset's parts, ridden. Inside one your height follows its rise;
    // leaving the lip with speed throws you, which is the only reason to build one.
    let onRamp = false;
    for (const e of (this._ramps || [])) {
      if (!pointInRing([this.p[0], this.p[1]], e.footprint)) continue;
      const ry = (e.props && e.props.yaw) || 0;
      const dx = this.p[0] - (e.footprint.reduce((s, q) => s + q[0], 0) / e.footprint.length);
      const dy = this.p[1] - (e.footprint.reduce((s, q) => s + q[1], 0) / e.footprint.length);
      const along = dx * Math.cos(ry) + dy * Math.sin(ry);          // -l/2 .. +l/2
      const rise = (e.props && e.props.rise) || 3;
      const tRamp = Math.max(0, Math.min(1, along / 4.5 * 0.5 + 0.5));
      const want = rise * tRamp;
      this.jz = Math.max(this.jz, want); this.vz = Math.max(this.vz, 0);
      onRamp = true;
      if (tRamp > 0.86 && this.v > 7) { this.vz = 5.5 + this.v * 0.30; this.jz = Math.max(this.jz, want); blip(520, 0.09); }
    }
    if (onRamp && this.jz > 0 && this.vz <= 0) this.vz = 0.01;      // held up by the deck, not falling through it
    // a wall is a wall: you stop against it, and a jump clears a low one
    const zHere = g(this.p[0], this.p[1]) + (this.jz || 0);
    for (const e of (this._solids || [])) {
      if ((e.zTop ?? 0) < zHere + 0.2) continue;                 // driven over, not into
      // Only a step that ENTERS a solid is refused. If the rig is already
      // inside — spawned there, or the wall was built around it — every
      // direction would be refused and it would be walled in forever; the way
      // OUT must stay open. A door that only opens inward is a trap.
      const wasInside = pointInRing([px, py], e.footprint);
      if (wasInside) continue;                                   // escaping: allowed
      const from = [px, py], to = [this.p[0], this.p[1]];
      const crossed = stepHitsRing(from, to, e.footprint);
      if (!crossed && !pointInRing(to, e.footprint) && !bodyHitsRing(to, e.footprint)) continue;
      this.p[0] = px; this.p[1] = py;                            // refuse the step
      // A WALL IS A WALL, AND SPEED IS THE PRICE. Hitting one should throw you
      // back and cost you everything you had built up — the old knock read as
      // sliding into scenery. A hard crash also shoves the body clear so you
      // are never left grinding against a face you cannot leave.
      const speed = Math.abs(this.v);
      if (speed > 12) {
        this.v = -this.v * 0.5;
        const back = Math.sign(this.v) * 0.9;                    // shoved off the wall
        this.p[0] += Math.cos(this.yaw) * back;
        this.p[1] += Math.sin(this.yaw) * back;
        this._crashAt = now;                                     // the camera feels it
        thud('crash');
      } else if (speed > 4) { this.v = -this.v * 0.34; blip(88, 0.13); }
      else this.v *= -0.15;
      break;
    }
    const z = g(this.p[0], this.p[1]);
    // chase camera: target glides to the body; heading takes the yaw only at speed
    const k = Math.min(1, 9 * dt);
    cam.target[0] += (this.p[0] - cam.target[0]) * k;
    cam.target[1] += (this.p[1] - cam.target[1]) * k;
    cam.target[2] = (cam.target[2] || 0) + (z + 1.1 + (this.jz || 0) - (cam.target[2] || 0)) * k;
    const want = this.yaw + Math.PI;                            // eye sits behind the heading
    let d = want - cam.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    cam.yaw += d * Math.min(1, 2.4 * dt * Math.min(1, Math.abs(this.v) / 5));
    cam.dist += ((48 + Math.abs(this.v) * 0.7) - cam.dist) * Math.min(1, 3 * dt);
    // the tyres throw dust when they are working: sliding, or hard on the gas
    // SCUFF — the black mark a slide leaves ON the ground. Smoke says the
    // tyres are working; the scuff says where they worked, and it is what
    // makes a drift satisfying after the fact: you can see the line you took.
    if (Math.abs(this.slip || 0) > 2.2 && this.jz <= 0 && now - (this._scuffAt || 0) > 26) {
      this._scuffAt = now;
      const sc = this._scuff || (this._scuff = []);
      const cc = Math.cos(this.yaw), ss = Math.sin(this.yaw);
      for (const sgn of [-1, 1]) {
        sc.push({ x: this.p[0] - cc * 1.4 - ss * 0.95 * sgn, y: this.p[1] - ss * 1.4 + cc * 0.95 * sgn,
          z: z + 0.06, yaw: this.yaw, t: now, w: Math.min(1, Math.abs(this.slip) / 9) });
      }
      while (sc.length > 260) sc.shift();
    }
    // SMOKE, NOT A DUST STORM. Sliding earns it; merely moving does not. One
    // puff at a time, alternating wheels, and only while the tyres are truly
    // working — a thin trail you notice rather than a cloud you drive inside.
    const work = Math.abs(this.slip || 0) * 0.11 + (th > 0 && Math.abs(this.v) > 22 ? 0.5 : 0);
    if (work > 0.9 && this.jz <= 0 && now - (this._puffAt || 0) > 55) {
      this._puffAt = now;
      const dl = this._dust || (this._dust = []);
      if (dl.length < 34) {
        const back = -1.5, side = 0.95;
        const cc = Math.cos(this.yaw), ss = Math.sin(this.yaw);
        const sgn = (this._puffSide = -(this._puffSide || 1));
        dl.push({
          x: this.p[0] + cc * back - ss * side * sgn + (Math.random() - 0.5) * 0.4,
          y: this.p[1] + ss * back + cc * side * sgn + (Math.random() - 0.5) * 0.4,
          z: z + 0.1, t: now, p: Math.min(1, (work - 0.9) / 2.2),
        });
      }
    }
    // A CRASH IS FELT. For a third of a second after a hard impact the eye is
    // knocked about — the one thing that makes speed mean something, since a
    // wall that merely stops you teaches nothing about how fast you were going.
    if (this._crashAt && now - this._crashAt < 320) {
      const a = (1 - (now - this._crashAt) / 320) * 0.9;
      cam.target[0] += Math.sin(now * 0.09) * a;
      cam.target[1] += Math.cos(now * 0.11) * a;
      cam.target[2] += Math.sin(now * 0.13) * a * 0.5;
    }
    engine(this.v, true);
    if (speedEl) speedEl.textContent = Math.round(Math.abs(this.v) * 3.6) + ' km/h';
    return true;
  },

  // the body, drawn in the renderer's dynamic pass — the district's buffers sleep
  draw(renderer) {
    this.r = renderer;
    if (!this.on) { renderer.setDynamic(null); return; }
    const world = this._world; // set by app hook? no — we take ground from cached tick values
    const p = this.p, col = this.color;
    const z = this._z != null ? this._z : 0;
    // THE BODY LEANS INTO THE SLIDE. Drawing it square to its heading while it
    // travels sideways is what made fast driving read as sliding a sticker
    // across a map; a counter-steer of up to ~22° is the whole visual language
    // of drift, and it costs one angle.
    const yaw = this.yaw + Math.max(-0.17, Math.min(0.17, (this.slip || 0) * 0.011));
    const dust = this._dust || (this._dust = []);
    renderer.setDynamic((B) => {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const cp = Math.cos(this._pitch || 0), sp = Math.sin(this._pitch || 0);
      const F = [c * cp, s * cp, sp], Lt = [-s, c, 0], U = [-c * sp, -s * sp, cp];
      const at = (f, l, u) => [p[0] + F[0] * f + Lt[0] * l + U[0] * u,
                               p[1] + F[1] * f + Lt[1] * l + U[1] * u,
                               z + F[2] * f + Lt[2] * l + U[2] * u];
      const dark = [0.10, 0.11, 0.13], glass = [0.16, 0.35, 0.33], lamp = [1, 0.92, 0.6];
      obox(B, at(0, 0, 0.62), F, Lt, U, 2.05, 1.02, 0.34, col);          // body
      obox(B, at(-0.45, 0, 1.18), F, Lt, U, 1.02, 0.88, 0.26, glass);    // cabin
      obox(B, at(1.72, 0, 0.70), F, Lt, U, 0.30, 0.84, 0.10, lamp);      // nose lamp
      obox(B, at(-2.02, 0, 0.66), F, Lt, U, 0.06, 0.68, 0.09, [1, 0.3, 0.25]); // tail
      for (const [fx, ly] of [[1.32, 0.94], [1.32, -0.94], [-1.32, 0.94], [-1.32, -0.94]])
        obox(B, at(fx, ly, 0.38), F, Lt, U, 0.42, 0.22, 0.38, dark);     // wheels
      // the scuff first, so smoke drifts over it
      const scuff = this._scuff || [];
      const nowS = performance.now();
      for (let i = scuff.length - 1; i >= 0; i--) if (nowS - scuff[i].t > 4200) scuff.splice(i, 1);
      for (const k of scuff) {
        const age = (nowS - k.t) / 4200;
        const a = (1 - age) * 0.5 * k.w;
        const cc = Math.cos(k.yaw) * 0.75, ss = Math.sin(k.yaw) * 0.75;
        const wx = -Math.sin(k.yaw) * 0.2, wy = Math.cos(k.yaw) * 0.2;
        const p00 = [k.x - cc - wx, k.y - ss - wy], p10 = [k.x + cc - wx, k.y + ss - wy];
        const p11 = [k.x + cc + wx, k.y + ss + wy], p01 = [k.x - cc + wx, k.y - ss + wy];
        const col = [0.10, 0.09, 0.08];
        B.tri([p00[0], p00[1], k.z], [p10[0], p10[1], k.z], [p11[0], p11[1], k.z], [0, 0, 1], col, a);
        B.tri([p00[0], p00[1], k.z], [p11[0], p11[1], k.z], [p01[0], p01[1], k.z], [0, 0, 1], col, a);
      }

      // DUST. Thrown from the rear wheels when the tyres are working — hard
      // acceleration, or a slide. It is weather in the strictest sense: it
      // lives in the dynamic pass, is never journaled, and is gone in a second.
      const nowD = performance.now();
      for (let i = dust.length - 1; i >= 0; i--) if (nowD - dust[i].t > 900) dust.splice(i, 1);
      for (const d of dust) {
        const age = (nowD - d.t) / 900;
        const r = 0.26 + age * 0.95;                 // smaller, slower bloom
        const a = (1 - age) * (1 - age) * 0.22 * (0.35 + d.p);   // faint, fading fast
        const zz = d.z + age * 0.75;
        const g = 0.6 - age * 0.08;
        B.tri([d.x - r, d.y - r, zz], [d.x + r, d.y - r, zz], [d.x + r, d.y + r, zz], [0, 0, 1], [g, g - 0.04, g - 0.11], a);
        B.tri([d.x - r, d.y - r, zz], [d.x + r, d.y + r, zz], [d.x - r, d.y + r, zz], [0, 0, 1], [g, g - 0.04, g - 0.11], a);
      }

      // MUZZLE FLASH — a shot you can see leaving the gun. A tracer alone
      // reads as a scratch on the screen; the flash is what makes it fire.
      const nowF = performance.now();
      if (this._flashAt && nowF - this._flashAt < 90) {
        const k = 1 - (nowF - this._flashAt) / 90;
        obox(B, at(2.5, 0, 0.72), F, Lt, U, 0.5 + k * 0.7, 0.16 + k * 0.3, 0.16 + k * 0.3,
          [1, 0.86 + k * 0.14, 0.45 + k * 0.4]);
      }
      // IMPACT — a burst where the beam landed, so a hit is an event and not
      // merely an absence where a thing used to be.
      if (this._burst && nowF - this._burst.t < 260) {
        const k = 1 - (nowF - this._burst.t) / 260;
        const bp = this._burst.p, r = (1 - k) * 2.6 + 0.3;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) {
          B.tri([bp[0] + dx * r, bp[1] + dy * r, bp[2]],
            [bp[0] + dx * r * 0.6 - dy * 0.3, bp[1] + dy * r * 0.6 + dx * 0.3, bp[2] + 0.35],
            [bp[0] + dx * r * 0.6 + dy * 0.3, bp[1] + dy * r * 0.6 - dx * 0.3, bp[2] + 0.35],
            [0, 0, 1], [1, 0.72, 0.3], k * 0.85);
        }
      }

      const shots = this._shots || [], nowMs = performance.now();
      for (let i = shots.length - 1; i >= 0; i--) if (nowMs - shots[i].t > 260) shots.splice(i, 1);
      for (const sh of shots) {
        const D = [sh.b[0] - sh.a[0], sh.b[1] - sh.a[1], sh.b[2] - sh.a[2]];
        const len = Math.hypot(D[0], D[1], D[2]) || 1;
        const Fs = [D[0] / len, D[1] / len, D[2] / len];
        let Ls = [-Fs[1], Fs[0], 0]; const ll = Math.hypot(Ls[0], Ls[1]) || 1; Ls = [Ls[0] / ll, Ls[1] / ll, 0];
        const Us = [Fs[1] * Ls[2] - Fs[2] * Ls[1], Fs[2] * Ls[0] - Fs[0] * Ls[2], Fs[0] * Ls[1] - Fs[1] * Ls[0]];
        obox(B, [(sh.a[0] + sh.b[0]) / 2, (sh.a[1] + sh.b[1]) / 2, (sh.a[2] + sh.b[2]) / 2], Fs, Ls, Us, len / 2, 0.05, 0.05, [0.35, 1, 0.9]);
      }
    });
  },
};

// pitch + height for the drawn body come from the same tick that moved it
const _tick = RIG.tick;
RIG.tick = function (world, cam) {
  const moved = _tick.call(this, world, cam);
  if (moved) {
    const g = (x, y) => (this._drawnGround && this._drawnGround(x, y)) ?? world.place.groundAt(x, y);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this._z = g(this.p[0], this.p[1]) + (this.jz || 0);
    this._pitch = Math.atan2(g(this.p[0] + c * 1.6, this.p[1] + s * 1.6)
                           - g(this.p[0] - c * 1.6, this.p[1] - s * 1.6), 3.2);
  }
  return moved;
};

// ═══ UNSET CHROME — the controls that made Thunder Rigs an instrument ═══════
// Joystick (drag to drive) · JUMP / FIRE / BOOST · the AGENT bar. Every verb
// lands on something REAL in CREO: BOOST is throttle law, JUMP is the rig's
// own air, FIRE removes the entity it hits THROUGH THE JOURNAL (undo restores
// it — destruction is an opinion the history can overrule), and the AGENT bar
// pipes straight into CREO's own say-operator: unset's mouth, CREO's mind.
const JOY = { x: 0, y: 0, active: false };
const BTN = { jump: false, fire: false, boost: false };

/**
 * PRESS A CONTROL BY NAME. The console's menu, palette and line all "pressed"
 * keys by dispatching KeyboardEvent({key:'f'}) — but the rig listens on
 * e.code, which a synthetic event of that shape does not carry. So FIRE from
 * anywhere except the physical F key or the on-screen button silently did
 * nothing. Speech should not have to imitate a keyboard: it asks for the verb.
 */
export function press(name) {
  if (name === 'fire') { BTN.fire = true; setTimeout(() => { BTN.fire = false; }, 60); return true; }
  if (name === 'jump') { BTN.jump = true; return true; }
  if (name === 'boost') { BTN.boost = true; setTimeout(() => { BTN.boost = false; }, 900); return true; }
  return false;
}

/**
 * THE THUD. Effects are not the engine: a drone you did not ask for is noise,
 * but a shot with no sound is a shot that did not happen. So impacts, hits and
 * shots speak by default (they are transient and they are FEEDBACK), while the
 * motor stays silent until asked. Two envelopes stacked — a low body and a
 * short crack — because a single sine is a beep and a beep is not a weapon.
 */
let FX = true;
try { FX = localStorage.getItem('terrarium.fx') !== 'off'; } catch (_) {}
export function setEffects(on) {
  FX = !!on;
  try { localStorage.setItem('terrarium.fx', on ? 'on' : 'off'); } catch (_) {}
  return FX;
}
export const effectsOn = () => FX;

function ensureAC() {
  if (!AC && heard) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      osc = AC.createOscillator(); osc.type = 'triangle';
      filt = AC.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.7;
      gainN = AC.createGain(); gainN.gain.value = 0;
      osc.connect(filt); filt.connect(gainN); gainN.connect(AC.destination); osc.start();
    } catch (_) {}
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}

/** A layered impact: body + crack + a breath of noise. */
function thud(kind) {
  if (!FX || !ensureAC()) return;
  const t0 = AC.currentTime;
  const tone = (type, f0, f1, peak, dur, delay = 0) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0 + delay);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, f1), t0 + delay + dur);
    g.gain.setValueAtTime(0.0001, t0 + delay);
    g.gain.exponentialRampToValueAtTime(peak, t0 + delay + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t0 + delay); o.stop(t0 + delay + dur + 0.02);
  };
  const noise = (peak, dur, cut) => {
    const n = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, n, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = AC.createBufferSource(); src.buffer = buf;
    const bp = AC.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = cut;
    const g = AC.createGain(); g.gain.value = peak;
    src.connect(bp); bp.connect(g); g.connect(AC.destination);
    src.start(t0);
  };
  if (kind === 'shot') { tone('square', 320, 90, 0.05, 0.09); noise(0.05, 0.09, 2600); }
  else if (kind === 'hit') { tone('triangle', 150, 42, 0.10, 0.34); noise(0.10, 0.22, 900); tone('sawtooth', 90, 30, 0.05, 0.26, 0.01); }
  else if (kind === 'crash') { tone('triangle', 110, 34, 0.12, 0.42); noise(0.13, 0.3, 700); }
  else if (kind === 'land') { tone('triangle', 90, 40, 0.05, 0.16); noise(0.04, 0.1, 500); }
}

function blip(freq, dur) {
  try {
    if (!AC || !soundOn) return;
    const o = AC.createOscillator(), g2 = AC.createGain();
    // a square wave is the other insect; a triangle at a third the level
    // still reads as an impact without drilling into the ear
    o.type = 'triangle'; o.frequency.value = freq; g2.gain.value = 0.018;
    o.connect(g2); g2.connect(AC.destination); o.start();
    g2.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur + 0.02);
  } catch (_) {}
}

/** Do the segments a→b and c→d cross? The test a moving body needs. */
function segCross(a, b, c, d) {
  const s1x = b[0] - a[0], s1y = b[1] - a[1];
  const s2x = d[0] - c[0], s2y = d[1] - c[1];
  const den = -s2x * s1y + s1x * s2y;
  if (Math.abs(den) < 1e-9) return false;
  const s = (-s1y * (a[0] - c[0]) + s1x * (a[1] - c[1])) / den;
  const t = (s2x * (a[1] - c[1]) - s2y * (a[0] - c[0])) / den;
  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

/**
 * Does the step from a to b cross this wall? A CENTRE POINT INSIDE A FOOTPRINT
 * IS NOT A COLLISION TEST: at 46 m/s a frame moves the rig ~0.75 m and a panel
 * is 0.4 m thick, so the body arrived on the far side without ever having its
 * centre inside — which is exactly what "we go into walls" looked like. The
 * step is a segment, so the wall is asked whether the segment crossed it, and
 * the answer is the same at any speed.
 */
function stepHitsRing(a, b, ring) {
  for (let i = 0; i < ring.length; i++) {
    if (segCross(a, b, ring[i], ring[(i + 1) % ring.length])) return ring[i];
  }
  return null;
}

/** Distance from point p to segment a→b — the rig has a body, not a pinprick. */
function distToSeg(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const L = vx * vx + vy * vy;
  const t = L < 1e-9 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / L));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
}

/**
 * THE RIG IS 2.6 m LONG AND 1.6 m WIDE, and it was colliding as a single
 * point at its centre — so its nose and flanks slid visibly INTO walls before
 * anything stopped, which is exactly what "we go into walls" looks like. The
 * body is now a disc: a wall is hit when any edge comes within its radius.
 */
const BODY_R = 1.25;
function bodyHitsRing(to, ring) {
  for (let i = 0; i < ring.length; i++) {
    if (distToSeg(to, ring[i], ring[(i + 1) % ring.length]) < BODY_R) return true;
  }
  return false;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
  }
  return inside;
}
function fire(rig, world) {
  const c = Math.cos(rig.yaw), s = Math.sin(rig.yaw);
  const z0 = (rig._z != null ? rig._z : 0) + 0.9;
  const a = [rig.p[0] + c * 2.3, rig.p[1] + s * 2.3, z0];
  let hitP = null, hitE = null;
  // one index query, not 20: sweep candidates near the line, take the first the ray meets
  let cands = [];
  try { cands = world.near([rig.p[0] + c * 24, rig.p[1] + s * 24], 26).map(h => h.entity); } catch (_) {}
  // a fine step, because a panel is 0.4 m thick and a 3 m stride shot past it
  for (let d = 2.5; d <= 46 && !hitE; d += 1.1) {
    const x = rig.p[0] + c * d, y = rig.p[1] + s * d;
    for (const e of cands) {
      if (!e || e.type === 'terrain' || !e.footprint) continue;
      if ((e.zTop ?? 99) < z0 - 0.8 || (e.zBase ?? 0) > z0 + 2.5) continue;
      if (pointInRing([x, y], e.footprint)) { hitP = [x, y, z0]; hitE = e; break; }
    }
  }
  const end = hitP || [rig.p[0] + c * 46, rig.p[1] + s * 46, z0];
  rig._shots.push({ a, b: end, t: performance.now(), hit: !!hitE });
  rig._flashAt = performance.now();                       // muzzle
  if (hitE) rig._burst = { p: end, t: performance.now() };  // impact
  thud('shot');
  if (hitE) {
    try {
      world.removeEntity(hitE.id, { label: 'shot away: ' + (hitE.name || hitE.type) });
      if (!fire._pending) { fire._pending = true; requestAnimationFrame(() => { fire._pending = false; dispatchEvent(new CustomEvent('rig:worldchanged')); }); }
      thud('hit');
    } catch (_) {}
  }
}

let chromeEl = null;
function chromeShow(on) { if (chromeEl) chromeEl.style.display = on ? 'block' : 'none'; }
function chrome(rig) {
  if (chromeEl) return;
  chromeEl = document.createElement('div');
  chromeEl.id = 'rig-chrome';
  chromeEl.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;font:700 11px/1 ui-monospace,monospace;';
  // joystick — bottom-left, drag anywhere on the pad
  const pad = document.createElement('div');
  pad.style.cssText = 'position:absolute;left:22px;bottom:96px;width:132px;height:132px;border-radius:50%;'
    + 'border:2px solid rgba(255,255,255,.35);background:rgba(10,14,18,.4);pointer-events:auto;touch-action:none;';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;'
    + 'transform:translate(-50%,-50%);border:1px solid #fff;background:rgba(255,255,255,.14);'
    + 'display:flex;align-items:center;justify-content:center;color:#cfe8dd;letter-spacing:.2em;font-size:9px;';
  knob.textContent = 'DRIVE';
  pad.appendChild(knob);
  const R = 46;
  const setJoy = (ev) => {
    const r = pad.getBoundingClientRect();
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1; if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    JOY.x = dx / R; JOY.y = -dy / R; JOY.active = true;
    knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
  };
  pad.addEventListener('pointerdown', (ev) => { pad.setPointerCapture(ev.pointerId); setJoy(ev); });
  pad.addEventListener('pointermove', (ev) => { if (JOY.active) setJoy(ev); });
  const joyEnd = () => { JOY.x = 0; JOY.y = 0; JOY.active = false; knob.style.transform = 'translate(-50%,-50%)'; };
  pad.addEventListener('pointerup', joyEnd); pad.addEventListener('pointercancel', joyEnd);
  chromeEl.appendChild(pad);
  // JUMP / FIRE / BOOST — bottom-right cluster, unset's colours
  const cluster = document.createElement('div');
  // The action cluster used to sit on top of the plan — two instruments in one
  // corner, the map unreadable behind three buttons. The right edge belongs to
  // the plan and its meter; the actions take the middle-bottom, beside them.
  // the action buttons hug the map column too — thumb-reachable on a phone,
  // and the centre of the screen stays the world
  // above the plan, hugging the same column — thumb-reachable, centre clear.
  // When the RING is mounted these become the ring's arcs and this is hidden.
  cluster.id = 'rig-actions';
  cluster.style.cssText = 'position:absolute;right:14px;bottom:302px;display:flex;align-items:flex-end;gap:10px;pointer-events:auto;';
  const mk = (label, size, border, colr, down, up) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;cursor:pointer;touch-action:none;'
      + 'border:2px solid ' + border + ';color:' + border + ';background:' + colr + ';'
      + 'font:800 12px/1 ui-monospace,monospace;letter-spacing:.08em;';
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); b.setPointerCapture(ev.pointerId); down(); });
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    cluster.appendChild(b); return b;
  };
  mk('JUMP', 62, '#fff', 'rgba(255,255,255,.12)', () => { BTN.jump = true; }, () => {});
  mk('FIRE', 72, '#19e6c8', 'rgba(25,230,200,.22)', () => { BTN.fire = true; }, () => { BTN.fire = false; });
  mk('BOOST', 82, '#ff2e2e', 'rgba(255,46,46,.22)', () => { BTN.boost = true; }, () => { BTN.boost = false; });
  chromeEl.appendChild(cluster);
  document.body.appendChild(chromeEl);
}

// ── the AGENT bar: unset's mouth wired to CREO's mind (the say-operator) ────
(function agentBar() {
  return;   // superseded by src/ui/console.js — one line, one menu
  if (typeof document === 'undefined') return;
  const make = () => {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:62;display:flex;'
      + 'align-items:center;gap:8px;width:min(520px,92vw);background:rgba(10,14,18,.9);'
      + 'border:1px solid rgba(151,187,213,.25);border-radius:14px;padding:7px 9px;';
    const chip = document.createElement('span');
    chip.textContent = 'AGENT';
    chip.style.cssText = 'flex:0 0 auto;color:#d8c9ff;background:rgba(159,122,234,.16);border:1px solid rgba(159,122,234,.4);'
      + 'border-radius:8px;font:800 9px/1 ui-monospace,monospace;letter-spacing:.1em;padding:6px 8px;';
    const inp = document.createElement('input');
    inp.placeholder = 'summon — a watchtower here · a garden · a drain · why does this flood?';
    inp.style.cssText = 'flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e8edf2;'
      + 'font:500 13px/1.2 system-ui,sans-serif;';
    const send = document.createElement('button');
    send.textContent = '➤';
    send.style.cssText = 'flex:0 0 auto;width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;'
      + 'background:#df5a5d;color:#fff;font-size:14px;';
    const go = () => {
      const text = inp.value.trim(); if (!text) return;
      const si = document.getElementById('sayInput');
      if (si) {
        si.value = text;
        si.dispatchEvent(new Event('input', { bubbles: true }));
        si.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        inp.value = '';
      }
    };
    send.addEventListener('click', go);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
    bar.append(chip, inp, send);
    document.body.appendChild(bar);
  };
  if (document.body) make(); else addEventListener('DOMContentLoaded', make);
})();
