// src/sim/rig.js
var K = {};
var listening = false;
function listen() {
  if (listening) return;
  listening = true;
  addEventListener("keydown", (e) => {
    K[e.code] = true;
  });
  addEventListener("keyup", (e) => {
    K[e.code] = false;
  });
  addEventListener("blur", () => {
    for (const k in K) K[k] = false;
  });
}
var typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || "");
(function fetchVeil() {
  if (typeof window === "undefined") return;
  let inflight = 0, el = null, timer = 0;
  const show2 = () => {
    if (!el) {
      const st = document.createElement("style");
      st.textContent = "@keyframes rigload{0%{background-position:200% 0}100%{background-position:-200% 0}}";
      document.head.appendChild(st);
      el = document.createElement("div");
      el.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 20%,#6fe0c0 50%,transparent 80%);background-size:200% 100%;animation:rigload .9s linear infinite"></div><div id="rigload-card" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(10,14,18,.92);border:1px solid rgba(120,200,170,.4);border-radius:12px;padding:16px 22px;color:#cfe8dd;font:700 13px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.6)">\u25CD RAISING THE GROUND<div style="margin-top:6px;font-weight:500;font-size:10px;color:#8fb8a8">real elevation \xB7 buildings \xB7 contours</div></div>';
      el.style.cssText = "z-index:99;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.style.display = "block";
  };
  const hide2 = () => {
    if (el) el.style.display = "none";
  };
  const of = window.fetch;
  window.fetch = function(...a) {
    inflight++;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (inflight > 0) show2();
    }, 250);
    return of.apply(this, a).finally(() => {
      inflight--;
      if (inflight <= 0) {
        inflight = 0;
        hide2();
      }
    });
  };
})();
var AC = null;
var osc = null;
var filt = null;
var gainN = null;
var heard = false;
if (typeof window !== "undefined") {
  const arm = () => {
    heard = true;
    if (AC && AC.state === "suspended") AC.resume();
  };
  addEventListener("pointerdown", arm, true);
  addEventListener("keydown", arm, true);
}
var soundOn = false;
try {
  soundOn = localStorage.getItem("terrarium.sound") === "on";
} catch (_) {
}
function setEngineSound(on) {
  soundOn = !!on;
  try {
    localStorage.setItem("terrarium.sound", on ? "on" : "off");
  } catch (_) {
  }
  if (!on && gainN) gainN.gain.value = 0;
  return soundOn;
}
var engineSoundOn = () => soundOn;
function engine(speed, on) {
  try {
    if (!on || !soundOn) {
      if (gainN) gainN.gain.value = 0;
      return;
    }
    if (!heard) return;
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      osc = AC.createOscillator();
      osc.type = "triangle";
      filt = AC.createBiquadFilter();
      filt.type = "lowpass";
      filt.Q.value = 0.7;
      gainN = AC.createGain();
      gainN.gain.value = 0;
      osc.connect(filt);
      filt.connect(gainN);
      gainN.connect(AC.destination);
      osc.start();
    }
    if (AC.state === "suspended") AC.resume();
    const s = Math.abs(speed);
    osc.frequency.value = 42 + Math.min(52, s * 1.5);
    filt.frequency.value = 120 + Math.min(120, s * 3);
    gainN.gain.setTargetAtTime(s < 0.5 ? 0 : Math.min(0.014, 4e-3 + s * 9e-4), AC.currentTime, 0.12);
  } catch (_) {
  }
}
var SWATCHES = [
  ["teal", [0.1, 0.88, 0.76]],
  ["ember", [1, 0.32, 0.2]],
  ["amber", [1, 0.8, 0.25]],
  ["violet", [0.66, 0.48, 0.92]],
  ["bone", [0.94, 0.95, 0.96]],
  ["coal", [0.12, 0.13, 0.16]]
];
function obox(B, C2, F, Lt, U, sx, sy, sz, col) {
  const P = (x, y, z) => [
    C2[0] + F[0] * x + Lt[0] * y + U[0] * z,
    C2[1] + F[1] * x + Lt[1] * y + U[1] * z,
    C2[2] + F[2] * x + Lt[2] * y + U[2] * z
  ];
  const p = [
    P(-sx, -sy, -sz),
    P(sx, -sy, -sz),
    P(sx, sy, -sz),
    P(-sx, sy, -sz),
    P(-sx, -sy, sz),
    P(sx, -sy, sz),
    P(sx, sy, sz),
    P(-sx, sy, sz)
  ];
  B.quad(p[4], p[5], p[6], p[7], col, 1);
  B.quad(p[0], p[3], p[2], p[1], col, 1);
  B.quad(p[1], p[2], p[6], p[5], col, 1);
  B.quad(p[3], p[0], p[4], p[7], col, 1);
  B.quad(p[2], p[3], p[7], p[6], col, 1);
  B.quad(p[0], p[1], p[5], p[4], col, 1);
}
var dockEl = null;
var speedEl = null;
function dock(rig) {
  if (dockEl) {
    dockEl.style.display = "flex";
    return;
  }
  dockEl = document.createElement("div");
  dockEl.id = "rig-dock";
  dockEl.style.cssText = "position:fixed;right:12px;bottom:66px;z-index:61;width:214px;box-sizing:border-box;display:flex;align-items:center;gap:6px;justify-content:space-between;background:rgba(10,14,18,.86);border:1px solid rgba(120,200,170,.28);border-radius:8px;padding:4px 7px;font:700 9px/1 ui-monospace,monospace;color:#cfe8dd;letter-spacing:.06em;";
  const btn = document.createElement("button");
  btn.textContent = "DRIVE";
  btn.style.cssText = "background:#6fe0c0;color:#06251c;border:0;border-radius:6px;font:800 9px/1 ui-monospace,monospace;letter-spacing:.08em;padding:5px 8px;cursor:pointer;";
  btn.addEventListener("click", () => {
    try {
      document.activeElement && document.activeElement.blur();
    } catch (_) {
    }
    dispatchEvent(new KeyboardEvent("keydown", { key: "v" }));
  });
  dockEl.appendChild(btn);
  speedEl = document.createElement("span");
  speedEl.textContent = "0 km/h";
  speedEl.style.cssText = "flex:1;text-align:right;color:#8fb8a8;font-weight:600;";
  dockEl.appendChild(speedEl);
  let ci = 0;
  const dot2 = document.createElement("button");
  dot2.title = "paint the rig";
  const paintDot = () => {
    const c = SWATCHES[ci][1];
    dot2.style.background = "rgb(" + c.map((v) => Math.round(v * 255)).join(",") + ")";
  };
  dot2.style.cssText = "width:15px;height:15px;border-radius:50%;border:1px solid rgba(255,255,255,.3);cursor:pointer;padding:0;flex:0 0 auto;";
  dot2.addEventListener("click", () => {
    ci = (ci + 1) % SWATCHES.length;
    rig.color = SWATCHES[ci][1];
    paintDot();
  });
  paintDot();
  dockEl.appendChild(dot2);
  document.body.appendChild(dockEl);
  rig._btn = btn;
}
var TOUCH = typeof window !== "undefined" && (navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches);
var hintShown = false;
var hintEl = null;
function hint(text) {
  if (TOUCH) return;
  if (!hintEl) {
    hintEl = document.createElement("div");
    hintEl.id = "rig-hint";
    hintEl.style.cssText = "position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:60;background:rgba(10,14,18,.85);color:#cfe8dd;border:1px solid rgba(120,200,170,.4);border-radius:9px;font:600 11px/1.3 ui-monospace,monospace;letter-spacing:.04em;padding:7px 12px;pointer-events:none;";
    document.body.appendChild(hintEl);
  }
  hintEl.textContent = text;
  hintEl.style.display = text ? "block" : "none";
}
function autoMount(world, cam) {
  if (!RIG.on && world && world.place) {
    try {
      RIG.enter(world, cam);
    } catch (e) {
      console.warn("autoMount", e);
    }
  }
}
var RIG = {
  on: false,
  p: [0, 0],
  yaw: 0,
  v: 0,
  t: 0,
  saved: null,
  color: SWATCHES[0][1],
  r: null,
  jz: 0,
  vz: 0,
  _shots: [],
  toggle(world, cam) {
    this.on ? this.exit(world, cam) : this.enter(world, cam);
  },
  enter(world, cam) {
    listen();
    dock(this);
    try {
      document.activeElement && document.activeElement.blur();
    } catch (_) {
    }
    const b = world.place.terrain ? world.place.terrain.bounds : [-50, -50, 50, 50];
    this.p = [
      Math.min(Math.max(cam.target[0], b[0] + 5), b[2] - 5),
      Math.min(Math.max(cam.target[1], b[1] + 5), b[3] - 5)
    ];
    this.yaw = cam.yaw + Math.PI;
    this.v = 0;
    this.t = performance.now();
    this.saved = { dist: cam.dist, pitch: cam.pitch };
    cam.dist = 52;
    cam.pitch = 0.44;
    this.on = true;
    if (this._btn) this._btn.textContent = "DISMOUNT \u2715";
    chrome(this);
    chromeShow(true);
    if (!hintShown) {
      hintShown = true;
      hint("W/S \xB7 A/D \xB7 Space jump \xB7 F fire \xB7 Shift boost \xB7 V dismount");
      setTimeout(() => {
        try {
          hint("");
        } catch (_) {
        }
      }, 6e3);
    }
    engine(0, true);
  },
  exit(world, cam) {
    if (this.saved && cam) {
      cam.dist = this.saved.dist;
      cam.pitch = this.saved.pitch;
    }
    this.on = false;
    try {
      this.r && this.r.setDynamic(null);
    } catch (_) {
    }
    if (this._btn) this._btn.textContent = "DRIVE \u25B8";
    if (speedEl) speedEl.textContent = "0 km/h";
    chromeShow(false);
    hint("");
    engine(0, false);
  },
  tick(world, cam) {
    if (!this.on) return false;
    const now = performance.now();
    let dt = (now - this.t) / 1e3;
    this.t = now;
    if (dt > 0.1) dt = 0.1;
    let th = typing() ? 0 : (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
    let st = typing() ? 0 : (K.KeyA || K.ArrowLeft ? 1 : 0) - (K.KeyD || K.ArrowRight ? 1 : 0);
    if (JOY.active) {
      th = Math.max(-1, Math.min(1, th + JOY.y));
      st = Math.max(-1, Math.min(1, st - JOY.x));
    }
    const boost = BTN.boost || !typing() && (K.ShiftLeft || K.ShiftRight);
    const vmax = boost ? 46 : 27;
    this.v += th * (boost ? 60 : 40) * dt;
    this.v -= this.v * 0.8 * dt;
    const g = (x, y) => (this._drawnGround && this._drawnGround(x, y)) ?? world.place.groundAt(x, y);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const slope = (g(this.p[0] + c * 2.2, this.p[1] + s * 2.2) - g(this.p[0], this.p[1])) / 2.2;
    this.v -= slope * 9.8 * 0.5 * dt * Math.sign(this.v || 1);
    if ((BTN.jump || !typing() && K.Space) && this.jz <= 0) {
      this.vz = 7.4;
      this.jz = 0.01;
      blip(320, 0.08);
    }
    BTN.jump = false;
    if (this.jz > 0) {
      this.vz -= 20 * dt;
      this.jz += this.vz * dt;
      if (this.jz <= 0) {
        this.jz = 0;
        this.vz = 0;
        thud("land");
      }
    }
    if ((BTN.fire || !typing() && K.KeyF) && now - (this._fireAt || 0) > 260) {
      this._fireAt = now;
      fire(this, world);
    }
    if (this.v > vmax) this.v = vmax;
    if (this.v < -vmax * 0.4) this.v = -vmax * 0.4;
    const turn = st * 2.6 * dt * Math.min(1, Math.abs(this.v) / 3.5) * (this.v < 0 ? -1 : 1);
    this.yaw += turn;
    const grip = boost ? 4 : 5.4;
    const bite = Math.max(0, Math.min(1, (Math.abs(this.v) - 9) / 14));
    this.slip = (this.slip || 0) - turn * Math.abs(this.v) * bite * (boost ? 0.62 : 0.4);
    this.slip -= this.slip * Math.min(1, grip * dt);
    if (Math.abs(this.slip) > 11) this.slip = Math.sign(this.slip) * 11;
    this.drift = Math.min(1, Math.abs(this.slip) / 9);
    if (!this._solidsAt || now - this._solidsAt > 400 || Math.hypot(this.p[0] - (this._solidsP ? this._solidsP[0] : 1e9), this.p[1] - (this._solidsP ? this._solidsP[1] : 1e9)) > 18) {
      this._solidsAt = now;
      this._solidsP = [this.p[0], this.p[1]];
      let near = [];
      try {
        near = world.near(this.p, 40).map((h) => h.entity);
      } catch (_) {
      }
      this._solids = near.filter((e) => e && e.footprint && e.collision === "solid" && e.type !== "terrain");
      this._ramps = near.filter((e) => e && e.footprint && e.props && (e.props.part === "ramp" || e.props.part === "qpipe"));
    }
    const b = world.place.terrain ? world.place.terrain.bounds : [-50, -50, 50, 50];
    const px = this.p[0], py = this.p[1];
    const sideX = -Math.sin(this.yaw), sideY = Math.cos(this.yaw);
    const nx = px + Math.cos(this.yaw) * this.v * dt + sideX * (this.slip || 0) * dt;
    const ny = py + Math.sin(this.yaw) * this.v * dt + sideY * (this.slip || 0) * dt;
    this.p[0] = Math.min(Math.max(nx, b[0] + 2), b[2] - 2);
    this.p[1] = Math.min(Math.max(ny, b[1] + 2), b[3] - 2);
    if (this.p[0] !== nx || this.p[1] !== ny) this.v *= 0.4;
    let onRamp = false;
    for (const e of this._ramps || []) {
      if (!pointInRing([this.p[0], this.p[1]], e.footprint)) continue;
      const ry = e.props && e.props.yaw || 0;
      const dx = this.p[0] - e.footprint.reduce((s2, q) => s2 + q[0], 0) / e.footprint.length;
      const dy = this.p[1] - e.footprint.reduce((s2, q) => s2 + q[1], 0) / e.footprint.length;
      const along = dx * Math.cos(ry) + dy * Math.sin(ry);
      const rise2 = e.props && e.props.rise || 3;
      const tRamp = Math.max(0, Math.min(1, along / 4.5 * 0.5 + 0.5));
      const want2 = rise2 * tRamp;
      this.jz = Math.max(this.jz, want2);
      this.vz = Math.max(this.vz, 0);
      onRamp = true;
      if (tRamp > 0.86 && this.v > 7) {
        this.vz = 5.5 + this.v * 0.3;
        this.jz = Math.max(this.jz, want2);
        blip(520, 0.09);
      }
    }
    if (onRamp && this.jz > 0 && this.vz <= 0) this.vz = 0.01;
    const zHere = g(this.p[0], this.p[1]) + (this.jz || 0);
    for (const e of this._solids || []) {
      if ((e.zTop ?? 0) < zHere + 0.2) continue;
      const wasInside = pointInRing([px, py], e.footprint);
      if (wasInside) continue;
      const from = [px, py], to = [this.p[0], this.p[1]];
      const crossed = stepHitsRing(from, to, e.footprint);
      if (!crossed && !pointInRing(to, e.footprint) && !bodyHitsRing(to, e.footprint)) continue;
      this.p[0] = px;
      this.p[1] = py;
      const speed = Math.abs(this.v);
      if (speed > 12) {
        this.v = -this.v * 0.5;
        const back = Math.sign(this.v) * 0.9;
        this.p[0] += Math.cos(this.yaw) * back;
        this.p[1] += Math.sin(this.yaw) * back;
        this._crashAt = now;
        thud("crash");
      } else if (speed > 4) {
        this.v = -this.v * 0.34;
        blip(88, 0.13);
      } else this.v *= -0.15;
      break;
    }
    const z = g(this.p[0], this.p[1]);
    const k = Math.min(1, 9 * dt);
    cam.target[0] += (this.p[0] - cam.target[0]) * k;
    cam.target[1] += (this.p[1] - cam.target[1]) * k;
    cam.target[2] = (cam.target[2] || 0) + (z + 1.1 + (this.jz || 0) - (cam.target[2] || 0)) * k;
    const want = this.yaw + Math.PI;
    let d = want - cam.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    cam.yaw += d * Math.min(1, 2.4 * dt * Math.min(1, Math.abs(this.v) / 5));
    cam.dist += (48 + Math.abs(this.v) * 0.7 - cam.dist) * Math.min(1, 3 * dt);
    if (Math.abs(this.slip || 0) > 2.2 && this.jz <= 0 && now - (this._scuffAt || 0) > 26) {
      this._scuffAt = now;
      const sc = this._scuff || (this._scuff = []);
      const cc = Math.cos(this.yaw), ss = Math.sin(this.yaw);
      for (const sgn of [-1, 1]) {
        sc.push({
          x: this.p[0] - cc * 1.4 - ss * 0.95 * sgn,
          y: this.p[1] - ss * 1.4 + cc * 0.95 * sgn,
          z: z + 0.06,
          yaw: this.yaw,
          t: now,
          w: Math.min(1, Math.abs(this.slip) / 9)
        });
      }
      while (sc.length > 260) sc.shift();
    }
    const work = Math.abs(this.slip || 0) * 0.11 + (th > 0 && Math.abs(this.v) > 22 ? 0.5 : 0);
    if (work > 0.9 && this.jz <= 0 && now - (this._puffAt || 0) > 55) {
      this._puffAt = now;
      const dl = this._dust || (this._dust = []);
      if (dl.length < 34) {
        const back = -1.5, side = 0.95;
        const cc = Math.cos(this.yaw), ss = Math.sin(this.yaw);
        const sgn = this._puffSide = -(this._puffSide || 1);
        dl.push({
          x: this.p[0] + cc * back - ss * side * sgn + (Math.random() - 0.5) * 0.4,
          y: this.p[1] + ss * back + cc * side * sgn + (Math.random() - 0.5) * 0.4,
          z: z + 0.1,
          t: now,
          p: Math.min(1, (work - 0.9) / 2.2)
        });
      }
    }
    if (this._crashAt && now - this._crashAt < 320) {
      const a = (1 - (now - this._crashAt) / 320) * 0.9;
      cam.target[0] += Math.sin(now * 0.09) * a;
      cam.target[1] += Math.cos(now * 0.11) * a;
      cam.target[2] += Math.sin(now * 0.13) * a * 0.5;
    }
    engine(this.v, true);
    if (speedEl) speedEl.textContent = Math.round(Math.abs(this.v) * 3.6) + " km/h";
    return true;
  },
  // the body, drawn in the renderer's dynamic pass — the district's buffers sleep
  draw(renderer2) {
    this.r = renderer2;
    if (!this.on) {
      renderer2.setDynamic(null);
      return;
    }
    const world = this._world;
    const p = this.p, col = this.color;
    const z = this._z != null ? this._z : 0;
    const yaw = this.yaw + Math.max(-0.17, Math.min(0.17, (this.slip || 0) * 0.011));
    const dust = this._dust || (this._dust = []);
    renderer2.setDynamic((B) => {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const cp = Math.cos(this._pitch || 0), sp = Math.sin(this._pitch || 0);
      const F = [c * cp, s * cp, sp], Lt = [-s, c, 0], U = [-c * sp, -s * sp, cp];
      const at = (f2, l, u) => [
        p[0] + F[0] * f2 + Lt[0] * l + U[0] * u,
        p[1] + F[1] * f2 + Lt[1] * l + U[1] * u,
        z + F[2] * f2 + Lt[2] * l + U[2] * u
      ];
      const dark = [0.1, 0.11, 0.13], glass = [0.16, 0.35, 0.33], lamp = [1, 0.92, 0.6];
      obox(B, at(0, 0, 0.62), F, Lt, U, 2.05, 1.02, 0.34, col);
      obox(B, at(-0.45, 0, 1.18), F, Lt, U, 1.02, 0.88, 0.26, glass);
      obox(B, at(1.72, 0, 0.7), F, Lt, U, 0.3, 0.84, 0.1, lamp);
      obox(B, at(-2.02, 0, 0.66), F, Lt, U, 0.06, 0.68, 0.09, [1, 0.3, 0.25]);
      for (const [fx, ly] of [[1.32, 0.94], [1.32, -0.94], [-1.32, 0.94], [-1.32, -0.94]])
        obox(B, at(fx, ly, 0.38), F, Lt, U, 0.42, 0.22, 0.38, dark);
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
        const col2 = [0.1, 0.09, 0.08];
        B.tri([p00[0], p00[1], k.z], [p10[0], p10[1], k.z], [p11[0], p11[1], k.z], [0, 0, 1], col2, a);
        B.tri([p00[0], p00[1], k.z], [p11[0], p11[1], k.z], [p01[0], p01[1], k.z], [0, 0, 1], col2, a);
      }
      const nowD = performance.now();
      for (let i = dust.length - 1; i >= 0; i--) if (nowD - dust[i].t > 900) dust.splice(i, 1);
      for (const d of dust) {
        const age = (nowD - d.t) / 900;
        const r = 0.26 + age * 0.95;
        const a = (1 - age) * (1 - age) * 0.22 * (0.35 + d.p);
        const zz = d.z + age * 0.75;
        const g = 0.6 - age * 0.08;
        B.tri([d.x - r, d.y - r, zz], [d.x + r, d.y - r, zz], [d.x + r, d.y + r, zz], [0, 0, 1], [g, g - 0.04, g - 0.11], a);
        B.tri([d.x - r, d.y - r, zz], [d.x + r, d.y + r, zz], [d.x - r, d.y + r, zz], [0, 0, 1], [g, g - 0.04, g - 0.11], a);
      }
      const nowF = performance.now();
      if (this._flashAt && nowF - this._flashAt < 90) {
        const k = 1 - (nowF - this._flashAt) / 90;
        obox(
          B,
          at(2.5, 0, 0.72),
          F,
          Lt,
          U,
          0.5 + k * 0.7,
          0.16 + k * 0.3,
          0.16 + k * 0.3,
          [1, 0.86 + k * 0.14, 0.45 + k * 0.4]
        );
      }
      if (this._burst && nowF - this._burst.t < 260) {
        const k = 1 - (nowF - this._burst.t) / 260;
        const bp = this._burst.p, r = (1 - k) * 2.6 + 0.3;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) {
          B.tri(
            [bp[0] + dx * r, bp[1] + dy * r, bp[2]],
            [bp[0] + dx * r * 0.6 - dy * 0.3, bp[1] + dy * r * 0.6 + dx * 0.3, bp[2] + 0.35],
            [bp[0] + dx * r * 0.6 + dy * 0.3, bp[1] + dy * r * 0.6 - dx * 0.3, bp[2] + 0.35],
            [0, 0, 1],
            [1, 0.72, 0.3],
            k * 0.85
          );
        }
      }
      const shots = this._shots || [], nowMs = performance.now();
      for (let i = shots.length - 1; i >= 0; i--) if (nowMs - shots[i].t > 260) shots.splice(i, 1);
      for (const sh of shots) {
        const D2 = [sh.b[0] - sh.a[0], sh.b[1] - sh.a[1], sh.b[2] - sh.a[2]];
        const len2 = Math.hypot(D2[0], D2[1], D2[2]) || 1;
        const Fs = [D2[0] / len2, D2[1] / len2, D2[2] / len2];
        let Ls = [-Fs[1], Fs[0], 0];
        const ll = Math.hypot(Ls[0], Ls[1]) || 1;
        Ls = [Ls[0] / ll, Ls[1] / ll, 0];
        const Us = [Fs[1] * Ls[2] - Fs[2] * Ls[1], Fs[2] * Ls[0] - Fs[0] * Ls[2], Fs[0] * Ls[1] - Fs[1] * Ls[0]];
        obox(B, [(sh.a[0] + sh.b[0]) / 2, (sh.a[1] + sh.b[1]) / 2, (sh.a[2] + sh.b[2]) / 2], Fs, Ls, Us, len2 / 2, 0.05, 0.05, [0.35, 1, 0.9]);
      }
    });
  }
};
var _tick = RIG.tick;
RIG.tick = function(world, cam) {
  const moved = _tick.call(this, world, cam);
  if (moved) {
    const g = (x, y) => (this._drawnGround && this._drawnGround(x, y)) ?? world.place.groundAt(x, y);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this._z = g(this.p[0], this.p[1]) + (this.jz || 0);
    this._pitch = Math.atan2(g(this.p[0] + c * 1.6, this.p[1] + s * 1.6) - g(this.p[0] - c * 1.6, this.p[1] - s * 1.6), 3.2);
  }
  return moved;
};
var JOY = { x: 0, y: 0, active: false };
var BTN = { jump: false, fire: false, boost: false };
function press(name) {
  if (name === "fire") {
    BTN.fire = true;
    setTimeout(() => {
      BTN.fire = false;
    }, 60);
    return true;
  }
  if (name === "jump") {
    BTN.jump = true;
    return true;
  }
  if (name === "boost") {
    BTN.boost = true;
    setTimeout(() => {
      BTN.boost = false;
    }, 900);
    return true;
  }
  return false;
}
var FX = true;
try {
  FX = localStorage.getItem("terrarium.fx") !== "off";
} catch (_) {
}
function setEffects(on) {
  FX = !!on;
  try {
    localStorage.setItem("terrarium.fx", on ? "on" : "off");
  } catch (_) {
  }
  return FX;
}
var effectsOn = () => FX;
function ensureAC() {
  if (!AC && heard) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      osc = AC.createOscillator();
      osc.type = "triangle";
      filt = AC.createBiquadFilter();
      filt.type = "lowpass";
      filt.Q.value = 0.7;
      gainN = AC.createGain();
      gainN.gain.value = 0;
      osc.connect(filt);
      filt.connect(gainN);
      gainN.connect(AC.destination);
      osc.start();
    } catch (_) {
    }
  }
  if (AC && AC.state === "suspended") AC.resume();
  return AC;
}
function thud(kind) {
  if (!FX || !ensureAC()) return;
  const t0 = AC.currentTime;
  const tone = (type, f0, f1, peak, dur, delay = 0) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0 + delay);
    o.frequency.exponentialRampToValueAtTime(Math.max(24, f1), t0 + delay + dur);
    g.gain.setValueAtTime(1e-4, t0 + delay);
    g.gain.exponentialRampToValueAtTime(peak, t0 + delay + 8e-3);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + delay + dur);
    o.connect(g);
    g.connect(AC.destination);
    o.start(t0 + delay);
    o.stop(t0 + delay + dur + 0.02);
  };
  const noise = (peak, dur, cut) => {
    const n = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, n, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = AC.createBufferSource();
    src.buffer = buf;
    const bp = AC.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = cut;
    const g = AC.createGain();
    g.gain.value = peak;
    src.connect(bp);
    bp.connect(g);
    g.connect(AC.destination);
    src.start(t0);
  };
  if (kind === "shot") {
    tone("square", 320, 90, 0.05, 0.09);
    noise(0.05, 0.09, 2600);
  } else if (kind === "hit") {
    tone("triangle", 150, 42, 0.1, 0.34);
    noise(0.1, 0.22, 900);
    tone("sawtooth", 90, 30, 0.05, 0.26, 0.01);
  } else if (kind === "crash") {
    tone("triangle", 110, 34, 0.12, 0.42);
    noise(0.13, 0.3, 700);
  } else if (kind === "land") {
    tone("triangle", 90, 40, 0.05, 0.16);
    noise(0.04, 0.1, 500);
  }
}
function blip(freq, dur) {
  try {
    if (!AC || !soundOn) return;
    const o = AC.createOscillator(), g2 = AC.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g2.gain.value = 0.018;
    o.connect(g2);
    g2.connect(AC.destination);
    o.start();
    g2.gain.exponentialRampToValueAtTime(1e-4, AC.currentTime + dur);
    o.stop(AC.currentTime + dur + 0.02);
  } catch (_) {
  }
}
function segCross(a, b, c, d) {
  const s1x = b[0] - a[0], s1y = b[1] - a[1];
  const s2x = d[0] - c[0], s2y = d[1] - c[1];
  const den = -s2x * s1y + s1x * s2y;
  if (Math.abs(den) < 1e-9) return false;
  const s = (-s1y * (a[0] - c[0]) + s1x * (a[1] - c[1])) / den;
  const t = (s2x * (a[1] - c[1]) - s2y * (a[0] - c[0])) / den;
  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}
function stepHitsRing(a, b, ring3) {
  for (let i = 0; i < ring3.length; i++) {
    if (segCross(a, b, ring3[i], ring3[(i + 1) % ring3.length])) return ring3[i];
  }
  return null;
}
function distToSeg(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const L = vx * vx + vy * vy;
  const t = L < 1e-9 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / L));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
}
var BODY_R = 1.25;
function bodyHitsRing(to, ring3) {
  for (let i = 0; i < ring3.length; i++) {
    if (distToSeg(to, ring3[i], ring3[(i + 1) % ring3.length]) < BODY_R) return true;
  }
  return false;
}
function pointInRing(p, ring3) {
  let inside = false;
  for (let i = 0, j = ring3.length - 1; i < ring3.length; j = i++) {
    const xi = ring3[i][0], yi = ring3[i][1], xj = ring3[j][0], yj = ring3[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}
function fire(rig, world) {
  const c = Math.cos(rig.yaw), s = Math.sin(rig.yaw);
  const z0 = (rig._z != null ? rig._z : 0) + 0.9;
  const a = [rig.p[0] + c * 2.3, rig.p[1] + s * 2.3, z0];
  let hitP = null, hitE = null;
  let cands = [];
  try {
    cands = world.near([rig.p[0] + c * 24, rig.p[1] + s * 24], 26).map((h) => h.entity);
  } catch (_) {
  }
  for (let d = 2.5; d <= 46 && !hitE; d += 1.1) {
    const x = rig.p[0] + c * d, y = rig.p[1] + s * d;
    for (const e of cands) {
      if (!e || e.type === "terrain" || !e.footprint) continue;
      if ((e.zTop ?? 99) < z0 - 0.8 || (e.zBase ?? 0) > z0 + 2.5) continue;
      if (pointInRing([x, y], e.footprint)) {
        hitP = [x, y, z0];
        hitE = e;
        break;
      }
    }
  }
  const end = hitP || [rig.p[0] + c * 46, rig.p[1] + s * 46, z0];
  rig._shots.push({ a, b: end, t: performance.now(), hit: !!hitE });
  rig._flashAt = performance.now();
  if (hitE) rig._burst = { p: end, t: performance.now() };
  thud("shot");
  if (hitE) {
    try {
      world.removeEntity(hitE.id, { label: "shot away: " + (hitE.name || hitE.type) });
      if (!fire._pending) {
        fire._pending = true;
        requestAnimationFrame(() => {
          fire._pending = false;
          dispatchEvent(new CustomEvent("rig:worldchanged"));
        });
      }
      thud("hit");
    } catch (_) {
    }
  }
}
var chromeEl = null;
function chromeShow(on) {
  if (chromeEl) chromeEl.style.display = on ? "block" : "none";
}
function chrome(rig) {
  if (chromeEl) return;
  chromeEl = document.createElement("div");
  chromeEl.id = "rig-chrome";
  chromeEl.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;font:700 11px/1 ui-monospace,monospace;";
  const pad = document.createElement("div");
  pad.style.cssText = "position:absolute;left:22px;bottom:96px;width:132px;height:132px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(10,14,18,.4);pointer-events:auto;touch-action:none;";
  const knob = document.createElement("div");
  knob.style.cssText = "position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;transform:translate(-50%,-50%);border:1px solid #fff;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;color:#cfe8dd;letter-spacing:.2em;font-size:9px;";
  knob.textContent = "DRIVE";
  pad.appendChild(knob);
  const R = 46;
  const setJoy = (ev) => {
    const r = pad.getBoundingClientRect();
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    if (d > R) {
      dx = dx / d * R;
      dy = dy / d * R;
    }
    JOY.x = dx / R;
    JOY.y = -dy / R;
    JOY.active = true;
    knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
  };
  pad.addEventListener("pointerdown", (ev) => {
    pad.setPointerCapture(ev.pointerId);
    setJoy(ev);
  });
  pad.addEventListener("pointermove", (ev) => {
    if (JOY.active) setJoy(ev);
  });
  const joyEnd = () => {
    JOY.x = 0;
    JOY.y = 0;
    JOY.active = false;
    knob.style.transform = "translate(-50%,-50%)";
  };
  pad.addEventListener("pointerup", joyEnd);
  pad.addEventListener("pointercancel", joyEnd);
  chromeEl.appendChild(pad);
  const cluster = document.createElement("div");
  cluster.id = "rig-actions";
  cluster.style.cssText = "position:absolute;right:14px;bottom:302px;display:flex;align-items:flex-end;gap:10px;pointer-events:auto;";
  const mk = (label3, size, border, colr, down, up) => {
    const b = document.createElement("button");
    b.textContent = label3;
    b.style.cssText = "width:" + size + "px;height:" + size + "px;border-radius:50%;cursor:pointer;touch-action:none;border:2px solid " + border + ";color:" + border + ";background:" + colr + ";font:800 12px/1 ui-monospace,monospace;letter-spacing:.08em;";
    b.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      b.setPointerCapture(ev.pointerId);
      down();
    });
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    cluster.appendChild(b);
    return b;
  };
  mk("JUMP", 62, "#fff", "rgba(255,255,255,.12)", () => {
    BTN.jump = true;
  }, () => {
  });
  mk("FIRE", 72, "#19e6c8", "rgba(25,230,200,.22)", () => {
    BTN.fire = true;
  }, () => {
    BTN.fire = false;
  });
  mk("BOOST", 82, "#ff2e2e", "rgba(255,46,46,.22)", () => {
    BTN.boost = true;
  }, () => {
    BTN.boost = false;
  });
  chromeEl.appendChild(cluster);
  document.body.appendChild(chromeEl);
}
(function agentBar() {
  return;
  if (typeof document === "undefined") return;
  const make = () => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:62;display:flex;align-items:center;gap:8px;width:min(520px,92vw);background:rgba(10,14,18,.9);border:1px solid rgba(151,187,213,.25);border-radius:14px;padding:7px 9px;";
    const chip = document.createElement("span");
    chip.textContent = "AGENT";
    chip.style.cssText = "flex:0 0 auto;color:#d8c9ff;background:rgba(159,122,234,.16);border:1px solid rgba(159,122,234,.4);border-radius:8px;font:800 9px/1 ui-monospace,monospace;letter-spacing:.1em;padding:6px 8px;";
    const inp = document.createElement("input");
    inp.placeholder = "summon \u2014 a watchtower here \xB7 a garden \xB7 a drain \xB7 why does this flood?";
    inp.style.cssText = "flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e8edf2;font:500 13px/1.2 system-ui,sans-serif;";
    const send = document.createElement("button");
    send.textContent = "\u27A4";
    send.style.cssText = "flex:0 0 auto;width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;background:#df5a5d;color:#fff;font-size:14px;";
    const go = () => {
      const text = inp.value.trim();
      if (!text) return;
      const si = document.getElementById("sayInput");
      if (si) {
        si.value = text;
        si.dispatchEvent(new Event("input", { bubbles: true }));
        si.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        inp.value = "";
      }
    };
    send.addEventListener("click", go);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
      e.stopPropagation();
    });
    bar.append(chip, inp, send);
    document.body.appendChild(bar);
  };
  if (document.body) make();
  else addEventListener("DOMContentLoaded", make);
})();

// src/core/geom.js
var add = (a, b) => [a[0] + b[0], a[1] + b[1]];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
var mul = (a, s) => [a[0] * s, a[1] * s];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1];
var cross = (a, b) => a[0] * b[1] - a[1] * b[0];
var len = (a) => Math.hypot(a[0], a[1]);
var dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
var norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
var perp = (a) => [-a[1], a[0]];
var lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function signedArea(ring3) {
  let s = 0;
  for (let i = 0, n = ring3.length; i < n; i++) {
    const a = ring3[i], b = ring3[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
var area = (ring3) => Math.abs(signedArea(ring3));
function ensureCCW(ring3) {
  return signedArea(ring3) < 0 ? ring3.slice().reverse() : ring3.slice();
}
function centroid(ring3) {
  const a2 = signedArea(ring3) * 2;
  if (Math.abs(a2) < 1e-12) {
    let x2 = 0, y2 = 0;
    for (const p of ring3) {
      x2 += p[0];
      y2 += p[1];
    }
    return [x2 / ring3.length, y2 / ring3.length];
  }
  let x = 0, y = 0;
  for (let i = 0, n = ring3.length; i < n; i++) {
    const p = ring3[i], q = ring3[(i + 1) % n];
    const f2 = p[0] * q[1] - q[0] * p[1];
    x += (p[0] + q[0]) * f2;
    y += (p[1] + q[1]) * f2;
  }
  return [x / (3 * a2), y / (3 * a2)];
}
function perimeter(ring3, closed = true) {
  let s = 0;
  const n = ring3.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) s += dist(ring3[i], ring3[(i + 1) % n]);
  return s;
}
function bbox(ring3) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring3) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}
var bboxOverlap = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
function pointInRing2(pt, ring3) {
  let inside = false;
  for (let i = 0, n = ring3.length, j = n - 1; i < n; j = i++) {
    const a = ring3[i], b = ring3[j];
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function segIntersect(p1, p2, p3, p4) {
  const d1 = sub(p2, p1), d2 = sub(p4, p3);
  const den = cross(d1, d2);
  const dp = sub(p3, p1);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(dp, d2) / den;
  const u = cross(dp, d1) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { point: [p1[0] + d1[0] * t, p1[1] + d1[1] * t], t, u };
}
function closestPointOnSeg(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return { point: a.slice(), t: 0, d: dist(p, a) };
  let t = dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const q = [a[0] + ab[0] * t, a[1] + ab[1] * t];
  return { point: q, t, d: dist(p, q) };
}
function closestOnRing(p, ring3, closed = true) {
  let best = { d: Infinity };
  const n = ring3.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const r = closestPointOnSeg(p, ring3[i], ring3[(i + 1) % n]);
    if (r.d < best.d) best = { ...r, i };
  }
  return best;
}
function ringsIntersect(A2, B) {
  if (!bboxOverlap(bbox(A2), bbox(B))) return false;
  for (let i = 0, n = A2.length; i < n; i++) {
    for (let j = 0, m = B.length; j < m; j++) {
      if (segIntersect(A2[i], A2[(i + 1) % n], B[j], B[(j + 1) % m])) return true;
    }
  }
  return pointInRing2(A2[0], B) || pointInRing2(B[0], A2);
}
var ringContains = (outer, inner) => inner.every((p) => pointInRing2(p, outer));
function ringDistance(A2, B) {
  if (ringsIntersect(A2, B)) return 0;
  let best = Infinity;
  for (const p of A2) {
    const r = closestOnRing(p, B);
    if (r.d < best) best = r.d;
  }
  for (const p of B) {
    const r = closestOnRing(p, A2);
    if (r.d < best) best = r.d;
  }
  return best;
}
function polylineCrossesRing(line2, ring3) {
  for (let i = 0; i < line2.length - 1; i++) {
    for (let j = 0, m = ring3.length; j < m; j++) {
      if (segIntersect(line2[i], line2[i + 1], ring3[j], ring3[(j + 1) % m])) return true;
    }
  }
  return line2.some((p) => pointInRing2(p, ring3));
}
function scaleInFrame(ring3, angle, sx, sy, origin) {
  const o = origin || centroid(ring3);
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const ci = Math.cos(angle), si = Math.sin(angle);
  return ring3.map(([x, y]) => {
    const dx = x - o[0], dy = y - o[1];
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    const px = lx * sx, py = ly * sy;
    return [o[0] + px * ci - py * si, o[1] + px * si + py * ci];
  });
}
function orientedBounds(ring3) {
  const hull = convexHull(ring3);
  if (hull.length < 3) {
    const bb = bbox(ring3);
    return { angle: 0, width: bb[2] - bb[0], depth: bb[3] - bb[1], center: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2] };
  }
  let best = null;
  for (let i = 0, n = hull.length; i < n; i++) {
    const e = norm(sub(hull[(i + 1) % n], hull[i]));
    const p = perp(e);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of hull) {
      const u = dot(q, e), v = dot(q, p);
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const a = (u1 - u0) * (v1 - v0);
    if (!best || a < best.a) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = {
        a,
        angle: Math.atan2(e[1], e[0]),
        width: u1 - u0,
        depth: v1 - v0,
        center: [e[0] * cu + p[0] * cv, e[1] * cu + p[1] * cv]
      };
    }
  }
  return best;
}
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const half = (src) => {
    const out = [];
    for (const p of src) {
      while (out.length >= 2 && cross(sub(out[out.length - 1], out[out.length - 2]), sub(p, out[out.length - 2])) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return half(pts).concat(half(pts.slice().reverse()));
}
function offsetRing(ring3, d) {
  const n = ring3.length;
  const ccw = ensureCCW(ring3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = ccw[(i - 1 + n) % n], cur = ccw[i], next = ccw[(i + 1) % n];
    const n1 = perp(norm(sub(cur, prev)));
    const n2 = perp(norm(sub(next, cur)));
    let m = norm([(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2]);
    const cosHalf = Math.max(0.2, dot(m, n1));
    out.push([cur[0] - m[0] * d / cosHalf, cur[1] - m[1] * d / cosHalf]);
  }
  return out;
}
function bufferPolyline(line2, halfWidth) {
  const left = [], right = [];
  for (let i = 0; i < line2.length; i++) {
    const a = line2[Math.max(0, i - 1)], b = line2[Math.min(line2.length - 1, i + 1)];
    const t = norm(sub(b, a));
    const p = perp(t);
    left.push([line2[i][0] + p[0] * halfWidth, line2[i][1] + p[1] * halfWidth]);
    right.push([line2[i][0] - p[0] * halfWidth, line2[i][1] - p[1] * halfWidth]);
  }
  return left.concat(right.reverse());
}
function rectRing(cx, cy, w, d, angle = 0) {
  const hw = w / 2, hd = d / 2;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
function circleRing(cx, cy, r, segments = 24) {
  const out = [];
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
function selfIntersects(ring3) {
  const n = ring3.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segIntersect(ring3[i], ring3[(i + 1) % n], ring3[j], ring3[(j + 1) % n])) return true;
    }
  }
  return false;
}
function cleanRing(ring3, tol = 1) {
  if (!ring3 || ring3.length < 3) return { ring: null, repaired: false, why: "too few points" };
  let out = [ring3[0]];
  for (let i = 1; i < ring3.length; i++) {
    if (dist(ring3[i], out[out.length - 1]) >= tol) out.push(ring3[i]);
  }
  if (out.length > 3 && dist(out[0], out[out.length - 1]) < tol) out.pop();
  if (out.length < 3) return { ring: null, repaired: false, why: "the loop was too small" };
  for (let pass = 0; pass < 2 && out.length > 4; pass++) {
    const keep = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const spike = dist(a, b) + dist(b, c) > dist(a, c) * 6;
      if (!spike) keep.push(b);
    }
    if (keep.length >= 3 && keep.length < out.length) out = keep;
    else break;
  }
  if (!selfIntersects(out)) return { ring: out, repaired: false };
  const hull = convexHull(out);
  if (hull.length >= 3) return { ring: hull, repaired: true, why: "the loop crossed itself, so its outline was used" };
  return { ring: null, repaired: false, why: "that shape could not be read as an area" };
}
function resample(line2, step) {
  if (line2.length < 2) return line2.slice();
  const out = [line2[0]];
  let carry = 0;
  for (let i = 0; i < line2.length - 1; i++) {
    const a = line2[i], b = line2[i + 1];
    let d = dist(a, b);
    let t = carry;
    while (t + step <= d) {
      t += step;
      out.push(lerp2(a, b, t / d));
    }
    carry = t - d;
  }
  const last = line2[line2.length - 1];
  if (dist(out[out.length - 1], last) > 1e-6) out.push(last);
  return out;
}
function triangulate(ring3) {
  const n = ring3.length;
  if (n < 3) return [];
  const ccw = signedArea(ring3) > 0;
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(ccw ? i : n - 1 - i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n + 64) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
      const a = ring3[i0], b = ring3[i1], c = ring3[i2];
      if (cross(sub(b, a), sub(c, b)) <= 0) continue;
      let ok = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTri(ring3[j], a, b, c)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      tris.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
}
function pointInTri(p, a, b, c) {
  const d1 = cross(sub(b, a), sub(p, a));
  const d2 = cross(sub(c, b), sub(p, b));
  const d3 = cross(sub(a, c), sub(p, c));
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function snapPoint(p, rings, tol = 1.2, lastPoint = null) {
  let best = null;
  const consider = (point, kind, meta) => {
    const d = dist(p, point);
    if (d <= tol && (!best || d < best.d)) best = { point, kind, d, ...meta };
  };
  for (const { id, ring: ring3, closed = true } of rings) {
    const bb = bbox(ring3);
    if (p[0] < bb[0] - tol || p[0] > bb[2] + tol || p[1] < bb[1] - tol || p[1] > bb[3] + tol) continue;
    for (let i = 0, n2 = ring3.length; i < n2; i++) consider(ring3[i], "vertex", { id, i });
    const n = ring3.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = ring3[i], b = ring3[(i + 1) % n];
      consider(lerp2(a, b, 0.5), "midpoint", { id, i });
      const r = closestPointOnSeg(p, a, b);
      if (r.t > 0.02 && r.t < 0.98) consider(r.point, "edge", { id, i });
    }
  }
  if (lastPoint) {
    if (Math.abs(p[0] - lastPoint[0]) <= tol) consider([lastPoint[0], p[1]], "axis-y", {});
    if (Math.abs(p[1] - lastPoint[1]) <= tol) consider([p[0], lastPoint[1]], "axis-x", {});
  }
  return best;
}
function makeProjection(anchorLat, anchorLon) {
  const R = 6378137;
  const mPerDegLat = Math.PI / 180 * R;
  const mPerDegLon = mPerDegLat * Math.cos(anchorLat * Math.PI / 180);
  return {
    anchor: [anchorLat, anchorLon],
    toLocal: (lat, lon) => [(lon - anchorLon) * mPerDegLon, (lat - anchorLat) * mPerDegLat],
    toWGS84: (x, y) => [anchorLat + y / mPerDegLat, anchorLon + x / mPerDegLon]
  };
}
function tileRing(ring3, cell = 12, grid = null) {
  if (!ring3 || ring3.length < 3) return [];
  if (grid) return tileToGrid(ring3, cell, grid[0], grid[1]);
  const b = bbox(ring3);
  const w = b[2] - b[0], h = b[3] - b[1];
  if (w <= cell && h <= cell) return [ring3];
  const MAX_CELLS = 1024;
  let nx = Math.max(1, Math.ceil(w / cell));
  let ny = Math.max(1, Math.ceil(h / cell));
  if (nx * ny > MAX_CELLS) {
    const k = Math.sqrt(nx * ny / MAX_CELLS);
    nx = Math.max(1, Math.round(nx / k));
    ny = Math.max(1, Math.round(ny / k));
  }
  const out = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x0 = b[0] + w * i / nx, x1 = b[0] + w * (i + 1) / nx;
      const y0 = b[1] + h * j / ny, y1 = b[1] + h * (j + 1) / ny;
      const piece = dedupeRing(clipToRect(ring3, x0, y0, x1, y1));
      if (piece.length >= 3 && Math.abs(area(piece)) > 1e-3) out.push(piece);
    }
  }
  return out.length ? out : [ring3];
}
function dedupeRing(ring3, eps = 1e-6) {
  const out = [];
  for (const p of ring3) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps) out.pop();
    else break;
  }
  return out;
}
function clipToRect(ring3, x0, y0, x1, y1) {
  const edges = [
    (p) => p[0] >= x0,
    (p) => p[0] <= x1,
    (p) => p[1] >= y0,
    (p) => p[1] <= y1
  ];
  const cut = [
    (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])],
    (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]
  ];
  let poly = ring3;
  for (let e = 0; e < 4 && poly.length; e++) {
    const inside = edges[e], intersect = cut[e];
    const next = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = inside(cur), prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) next.push(intersect(prev, cur));
        next.push(cur);
      } else if (prevIn) next.push(intersect(prev, cur));
    }
    poly = next;
  }
  return poly;
}
function groundSpan(ring3, groundAt, samples = 6) {
  let lo = Infinity, hi = -Infinity;
  const take = (x, y) => {
    const z = groundAt(x, y);
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  };
  for (const p of ring3) take(p[0], p[1]);
  const b = bbox(ring3);
  for (let i = 0; i <= samples; i++) {
    for (let j = 0; j <= samples; j++) {
      const x = b[0] + (b[2] - b[0]) * i / samples;
      const y = b[1] + (b[3] - b[1]) * j / samples;
      if (pointInRing2([x, y], ring3)) take(x, y);
    }
  }
  return isFinite(lo) ? { lo, hi } : null;
}
function tileToGrid(ring3, span, ox, oy) {
  const b = bbox(ring3);
  const i0 = Math.floor((b[0] - ox) / span), i1 = Math.floor((b[2] - ox) / span);
  const j0 = Math.floor((b[1] - oy) / span), j1 = Math.floor((b[3] - oy) / span);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4096) return tileRing(ring3, span * 2);
  const out = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const x0 = ox + i * span, y0 = oy + j * span;
      const cellPiece = dedupeRing(clipToRect(ring3, x0, y0, x0 + span, y0 + span));
      if (cellPiece.length < 3) continue;
      for (const side of [1, -1]) {
        const half = dedupeRing(clipHalfPlane(cellPiece, x0, y0, side));
        if (half.length >= 3 && Math.abs(area(half)) > 1e-3) out.push(half);
      }
    }
  }
  return out.length ? out : [ring3];
}
function clipHalfPlane(ring3, x0, y0, side) {
  const f2 = (p) => side * (p[1] - y0 - (p[0] - x0));
  const out = [];
  for (let i = 0; i < ring3.length; i++) {
    const cur = ring3[i], prev = ring3[(i + ring3.length - 1) % ring3.length];
    const fc = f2(cur), fp = f2(prev);
    if (fc <= 0) {
      if (fp > 0) out.push(lerpTo(prev, cur, fp / (fp - fc)));
      out.push(cur);
    } else if (fp <= 0) {
      out.push(lerpTo(prev, cur, fp / (fp - fc)));
    }
  }
  return out;
}
var lerpTo = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// src/law/gate.js
var BLOCKING = /* @__PURE__ */ new Set(["structure", "wall", "tree"]);
var WAYS = /* @__PURE__ */ new Set(["road", "path", "stream", "water", "drain"]);
function canPlace(world, ring3, opts = {}) {
  const { zBase = -Infinity, zTop = Infinity, ignore, solid = true } = opts;
  if (!world || !ring3 || ring3.length < 3) return { verdict: "FREE", message: "" };
  const c = centroid(ring3);
  const r = Math.max(...ring3.map((p) => dist(p, c)));
  let hits = [];
  try {
    hits = world.nearby(c, r + 26);
  } catch (_) {
    return { verdict: "FREE", message: "" };
  }
  let way = null;
  for (const { entity: e } of hits) {
    if (!e || ignore && ignore(e)) continue;
    const eRing = world.ringOf(e);
    if (!eRing || eRing.length < 3) continue;
    if (BLOCKING.has(e.type) || e.collision === "solid") {
      if (zTop <= e.zBase + 0.01 || zBase >= e.zTop - 0.01) continue;
      if (ringsIntersect(ring3, eRing)) {
        return {
          verdict: "COLLISION",
          against: e,
          message: `refused \u2014 that stands in ${e.name || e.type}` + (e.source ? ` (${e.source})` : "")
        };
      }
    } else if (solid && WAYS.has(e.type) && ringsIntersect(ring3, eRing)) {
      way = e;
    }
  }
  if (way) {
    return {
      verdict: "RIGHT_OF_WAY",
      against: way,
      message: `refused \u2014 that blocks the ${way.name || way.type} (right of way)`
    };
  }
  return { verdict: "FREE", message: "" };
}
function admit(world, ringAt, opts = {}) {
  const { tries = 3, step = 7 } = opts;
  let last = null;
  for (let i = 0; i < tries; i++) {
    const ring3 = ringAt(i * step);
    last = canPlace(world, ring3, opts);
    if (last.verdict === "FREE") return { ...last, ring: ring3, offset: i * step };
  }
  return { ...last, ring: null, offset: 0 };
}

// src/sim/build.js
var D = Math.PI / 180;
var PARTS = {
  ramp: { l: 9, w: 6, h: 3.2, type: "surface", name: "Ramp", collision: "none", hint: "drive up it, take off" },
  qpipe: { l: 6, w: 7, h: 5, type: "surface", name: "Q-pipe", collision: "none", hint: "a steeper launch" },
  block: { l: 4, w: 4, h: 4, type: "structure", name: "Block", collision: "solid", hint: "a solid cube" },
  beam: { l: 8, w: 1, h: 1, type: "structure", name: "Beam", collision: "solid", hint: "a long bar" },
  panel: { l: 8, w: 0.4, h: 5, type: "wall", name: "Panel", collision: "solid", hint: "a standing sheet" },
  cyl: { l: 3, w: 3, h: 7, type: "structure", name: "Column", collision: "solid", hint: "a pillar" }
};
function ring(cx, cy, l, w, yaw, round2) {
  const c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  if (round2) {
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      out.push([cx + Math.cos(a) * l / 2, cy + Math.sin(a) * w / 2]);
    }
    return out;
  }
  for (const [dx, dy] of [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]])
    out.push([cx + dx * c - dy * s, cy + dx * s + dy * c]);
  return out;
}
function place(world, kind, rig, opts = {}) {
  const P = PARTS[kind];
  if (!P || !world) return null;
  const yaw = opts.yaw != null ? opts.yaw : rig ? rig.yaw : 0;
  const ahead = opts.ahead != null ? opts.ahead : P.l / 2 + 5;
  const ox = rig ? rig.p[0] : 0, oy = rig ? rig.p[1] : 0;
  const at = (extra) => [ox + Math.cos(yaw) * (ahead + extra), oy + Math.sin(yaw) * (ahead + extra)];
  const z0 = world.place.groundAt(...at(0));
  const v = admit(world, (off) => {
    const [cx2, cy2] = at(off);
    return ring(cx2, cy2, P.l, P.w, yaw, kind === "cyl");
  }, { zBase: z0, zTop: z0 + P.h, solid: P.collision === "solid", tries: 3, step: Math.max(6, P.l * 0.8) });
  if (!v.ring) return { refused: v.verdict, message: v.message };
  const [cx, cy] = at(v.offset);
  const z = world.place.groundAt(cx, cy);
  const e = world.addEntity({
    type: P.type,
    name: P.name,
    footprint: v.ring,
    zBase: z,
    zTop: z + P.h,
    collision: P.collision,
    // the part keeps its playground identity so the rig can still use it,
    // while the world keeps it as an ordinary, answerable entity
    props: { part: kind, yaw, rise: P.h, built: true }
  }, { label: "build " + kind });
  if (e && v.offset) e.__offsetBy = v.offset;
  return e;
}
function parse(text) {
  const t = String(text || "").toLowerCase();
  for (const k of Object.keys(PARTS)) if (new RegExp("\\b" + k + "\\b").test(t)) return k;
  if (/\bramp|jump\b/.test(t)) return "ramp";
  if (/\bhalfpipe|half-pipe|pipe|bowl\b/.test(t)) return "qpipe";
  if (/\bwall|sheet|screen\b/.test(t)) return "panel";
  if (/\bpillar|column|post\b/.test(t)) return "cyl";
  if (/\bbar|girder|plank\b/.test(t)) return "beam";
  if (/\bcube|box|crate\b/.test(t)) return "block";
  return null;
}

// src/render/imagery.js
var ATTRIB = "Aerial: Esri World Imagery \u2014 Esri, Maxar, Earthstar Geographics";
var URL2 = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
var t2x = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
var t2y = (lat, z) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z);
var load = (u) => new Promise((res, rej) => {
  const i = new Image();
  i.crossOrigin = "anonymous";
  i.onload = () => res(i);
  i.onerror = () => rej(new Error("tile"));
  i.src = u;
});
var S = { on: false, px: null, w: 0, h: 0, x0: 0, y0: 0, x1: 0, y1: 0, warm: 0, rev: 0 };
var IMAGERY2 = {
  attribution: ATTRIB,
  get on() {
    return S.on;
  },
  get rev() {
    return S.rev;
  },
  // bumps per load, so the ground cache notices
  /** Fetch the aerial covering this world's bbox and index it in LOCAL metres. */
  async load(world, z = 17) {
    let bbox2 = world?.place?.meta?.bbox;
    const P = world?.place?.projection;
    if (!bbox2 && P && typeof P.toWGS84 === "function" && world?.place?.terrain) {
      const b2 = world.place.terrain.bounds;
      const nw = P.toWGS84(b2[0], b2[3]), se = P.toWGS84(b2[2], b2[1]);
      if (nw && se && isFinite(nw[0]) && isFinite(se[0])) {
        bbox2 = [
          Math.min(nw[0], se[0]),
          Math.min(nw[1], se[1]),
          Math.max(nw[0], se[0]),
          Math.max(nw[1], se[1])
        ];
      }
    }
    if (!bbox2 && (world?.place?.anchor || P?.anchor) && world?.place?.terrain) {
      const [lat, lon] = world.place.anchor || P.anchor, b2 = world.place.terrain.bounds;
      const dLat = (b2[3] - b2[1]) / 2 / 111320;
      const dLon = (b2[2] - b2[0]) / 2 / (111320 * Math.cos(lat * Math.PI / 180) || 1);
      bbox2 = [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
    }
    if (!bbox2) console.warn("[imagery] no bbox, no projection inverse \u2014 cannot place the photograph");
    if (!bbox2 || !P) {
      console.warn("[imagery] this place knows no coordinates \u2014 nothing to drape");
      return false;
    }
    const [s, w, n, e] = bbox2;
    let tx0 = Math.floor(t2x(w, z)), tx1 = Math.floor(t2x(e, z));
    let ty0 = Math.floor(t2y(n, z)), ty1 = Math.floor(t2y(s, z));
    while ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 16 && z > 13) {
      z--;
      tx0 = Math.floor(t2x(w, z));
      tx1 = Math.floor(t2x(e, z));
      ty0 = Math.floor(t2y(n, z));
      ty1 = Math.floor(t2y(s, z));
    }
    const cv = document.createElement("canvas");
    cv.width = (tx1 - tx0 + 1) * 256;
    cv.height = (ty1 - ty0 + 1) * 256;
    const g = cv.getContext("2d", { willReadFrequently: true });
    let got = 0;
    for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) {
      try {
        g.drawImage(await load(URL2.replace("{z}", z).replace("{x}", x).replace("{y}", y)), (x - tx0) * 256, (y - ty0) * 256);
        got++;
      } catch (_) {
      }
    }
    if (!got) {
      console.warn("[imagery] no tiles arrived");
      return false;
    }
    const geo = (tx, ty) => {
      const nn = Math.pow(2, z);
      return [Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / nn))) * 180 / Math.PI, tx / nn * 360 - 180];
    };
    const [latA, lonA] = geo(tx0, ty0);
    const [latB, lonB] = geo(tx1 + 1, ty1 + 1);
    const a = P.toLocal(latA, lonA), b = P.toLocal(latB, lonB);
    S.px = g.getImageData(0, 0, cv.width, cv.height).data;
    S.w = cv.width;
    S.h = cv.height;
    S.x0 = Math.min(a[0], b[0]);
    S.x1 = Math.max(a[0], b[0]);
    S.y0 = Math.min(a[1], b[1]);
    S.y1 = Math.max(a[1], b[1]);
    S.flipY = a[1] > b[1];
    S.on = true;
    S.rev++;
    console.info("%c[imagery] " + got + " tiles at z" + z + " \xB7 " + ATTRIB, "color:#6fe0c0");
    return true;
  },
  /**
   * The colour of the ground at a world point, or null if the photo does not
   * reach it — null means "you answer", so CREO's palette still owns the edges.
   */
  sample(x, y) {
    if (!S.on) return null;
    const u = (x - S.x0) / (S.x1 - S.x0);
    let v = (y - S.y0) / (S.y1 - S.y0);
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    if (S.flipY) v = 1 - v;
    const px = Math.min(S.w - 1, u * S.w | 0), py = Math.min(S.h - 1, v * S.h | 0);
    const i = (py * S.w + px) * 4;
    if (S.px[i + 3] === 0) return null;
    const k = 1 / 255 * 1.06;
    return [Math.min(1, S.px[i] * k), Math.min(1, S.px[i + 1] * k), Math.min(1, S.px[i + 2] * k)];
  },
  off() {
    S.on = false;
    S.px = null;
  }
};
if (typeof window !== "undefined") window.IMAGERY = IMAGERY2;

// src/world/house.js
var RAD = Math.PI / 180;
function ring2(cx, cy, l, w, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  for (const [dx, dy] of [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]])
    out.push([cx + dx * c - dy * s, cy + dx * s + dy * c]);
  return out;
}
var fwd = (x, y, yaw, d, side = 0) => [x + Math.cos(yaw) * d - Math.sin(yaw) * side, y + Math.sin(yaw) * d + Math.cos(yaw) * side];
function house(world, at, yaw = 0, opts = {}) {
  if (!world) return [];
  const wingL = opts.length || 15, wingW = opts.width || 8;
  const wall = opts.wallHeight || 3.1;
  const pitch = opts.roof !== false;
  const env = (off) => {
    const cx = at[0] + Math.cos(yaw) * off, cy = at[1] + Math.sin(yaw) * off;
    return ring2(cx, cy, wingL * 1.25, wingW * 2.6, yaw);
  };
  const zAsk = world.place.groundAt(at[0], at[1]);
  const v = admit(world, env, { zBase: zAsk, zTop: zAsk + wall + 3, tries: 3, step: wingL * 0.9 });
  if (!v.ring) {
    const out = [];
    out.refused = v.verdict;
    out.message = v.message;
    return out;
  }
  const x = at[0] + Math.cos(yaw) * v.offset, y = at[1] + Math.sin(yaw) * v.offset;
  const z0 = world.place.groundAt(x, y);
  const id = "house-" + Math.random().toString(36).slice(2, 7);
  const made = [];
  if (v.offset) made.__offsetBy = v.offset;
  const part = (name, type, cx, cy, l, w, base, top, collision, role) => {
    const e = world.addEntity({
      type,
      name,
      footprint: ring2(cx, cy, l, w, yaw),
      zBase: base,
      zTop: top,
      collision,
      props: { house: id, role, yaw, built: true }
    }, { label: "build house \xB7 " + role });
    if (e) made.push(e);
    return e;
  };
  part("House", "structure", x, y, wingL, wingW, z0, z0 + wall, "solid", "main wing");
  const [cx2, cy2] = fwd(x, y, yaw, -wingL * 0.24, wingW * 0.62);
  part("Wing", "structure", cx2, cy2, wingL * 0.55, wingW * 0.85, z0, z0 + wall * 0.94, "solid", "cross wing");
  if (pitch) {
    const steps = opts.steps || 3, rise2 = (opts.roofHeight || 2.4) / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const over = i === 0 ? 0.9 : 0;
      part(
        "Roof",
        "structure",
        x,
        y,
        wingL * (1 - t * 0.34) + over,
        wingW * (1 - t * 0.52) + over,
        z0 + wall + i * rise2,
        z0 + wall + (i + 1) * rise2,
        "solid",
        "roof " + (i + 1)
      );
      part(
        "Roof",
        "structure",
        cx2,
        cy2,
        wingL * 0.55 * (1 - t * 0.34) + over,
        wingW * 0.85 * (1 - t * 0.52) + over,
        z0 + wall * 0.94 + i * rise2,
        z0 + wall * 0.94 + (i + 1) * rise2,
        "solid",
        "wing roof " + (i + 1)
      );
    }
    const [chx, chy] = fwd(x, y, yaw, -wingL * 0.3, -wingW * 0.2);
    part("Chimney", "structure", chx, chy, 1.2, 1.2, z0 + wall, z0 + wall + 3.4, "solid", "chimney");
  }
  const [dx, dy] = fwd(x, y, yaw, 0, -wingW * 0.86);
  part("Deck", "surface", dx, dy, wingL * 0.72, wingW * 0.7, z0 - 0.12, z0 + 0.42, "none", "deck");
  return made;
}
function parseHouse(text) {
  const t = String(text || "").toLowerCase();
  if (!/\b(house|home|cabin|cottage|shed|barn|lodge)\b/.test(t)) return null;
  const o = {};
  if (/\b(big|large|long)\b/.test(t)) {
    o.length = 21;
    o.width = 10;
  }
  if (/\b(small|little|cabin|shed)\b/.test(t)) {
    o.length = 9;
    o.width = 6.5;
    o.roofHeight = 1.7;
  }
  if (/\b(flat|modern)\b/.test(t)) {
    o.roof = false;
  }
  if (/\b(barn|lodge|two.stor)/.test(t)) {
    o.wallHeight = 5.4;
    o.roofHeight = 3.2;
  }
  return o;
}

// src/core/bus.js
var BUS = {
  verbs: [],
  register(name, test, run, help) {
    this.verbs.push({ name, test, run, help });
    return () => {
      this.verbs = this.verbs.filter((v) => v.run !== run);
    };
  },
  /** One utterance in, one reply out — or null, meaning "not ours, pass it on". */
  dispatch(text, ctx = {}) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    for (const v of this.verbs) {
      let m = null;
      try {
        m = v.test(lower, raw);
      } catch (_) {
      }
      if (m) {
        const out = v.run(m, ctx, raw);
        return out === void 0 ? v.name : out;
      }
    }
    return null;
  },
  help() {
    return this.verbs.filter((v) => v.help).map((v) => v.help);
  }
};
if (typeof window !== "undefined") window.BUS = BUS;

// src/sim/trace.js
var MAX_STAMPS = 1400;
var A = {
  xyz: new Float32Array(MAX_STAMPS * 3),
  n: 0,
  // how many stamps are live
  coarse: 1,
  // metres of history each stamp now stands for
  head: 0,
  pressure: 38,
  lastLine: "the ground is unmarked",
  thresholds: [],
  homeBranch: null,
  unsettled: false,
  _lastAt: null,
  _upAt: 0,
  _paintAt: 0,
  _bound: null
};
function rise(n) {
  A.pressure = Math.min(100, A.pressure + n);
}
function drop(n, why) {
  A.pressure = Math.max(0, A.pressure - n);
  if (why) {
    A.lastLine = why;
    paint();
  }
}
function paint() {
  if (typeof document === "undefined") return;
  let d = document.getElementById("atlas-dock");
  if (!d) {
    d = document.createElement("div");
    d.id = "atlas-dock";
    d.style.cssText = "position:fixed;right:12px;bottom:10px;z-index:61;width:214px;font:700 8px/1.3 ui-monospace,monospace;color:#9fb4ad;letter-spacing:.14em;pointer-events:none;text-align:left;";
    document.body.appendChild(d);
  }
  d.style.width = "214px";
  d.style.right = "12px";
  d.style.bottom = "30px";
  const p = Math.round(A.pressure);
  const tone = p > 66 ? "#df5a5d" : p > 33 ? "#ffb45e" : "#6fe0c0";
  d.innerHTML = '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.10);overflow:hidden"><div style="width:' + p + "%;height:100%;background:" + tone + '"></div></div><div style="display:flex;justify-content:space-between;margin-top:4px"><span>NORMALIZATION ' + p + (A.unsettled ? ' \xB7 <span style="color:#ffb45e">UNSETTLED</span>' : "") + '</span></div><div style="font:500 9px/1.35 system-ui,sans-serif;letter-spacing:.01em;color:#7d8b95;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + A.lastLine + "</div>";
}
var ATLAS = {
  get pressure() {
    return A.pressure;
  },
  get unsettled() {
    return A.unsettled;
  },
  ghosts: [],
  // abandoned footprints, drawn amber by the renderer
  /** Meet the place: thresholds at its compass edges, ears on its journal. */
  bind(world) {
    if (!world || A._bound === world) return;
    A._bound = world;
    A.homeBranch = world.branch;
    A.n = 0;
    A.head = 0;
    A.coarse = 1;
    A._lastAt = null;
    A.unsettled = false;
    this.ghosts = [];
    A.lastLine = "the ground is unmarked";
    const b = world.place.terrain?.bounds;
    if (b) {
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      A.thresholds = [
        { name: "the north threshold", x: cx, y: b[3], crossed: false },
        { name: "the south threshold", x: cx, y: b[1], crossed: false },
        { name: "the east threshold", x: b[2], y: cy, crossed: false },
        { name: "the west threshold", x: b[0], y: cy, crossed: false }
      ];
    }
    world.on((kind, ev) => {
      const label3 = ev?.meta?.label || ev?.label || "";
      if (/^(add|build)/.test(label3)) drop(2, "ground broken \u2014 pressure falls");
      else if (/^(remove|destroy)/.test(label3)) drop(2, "the given removed \u2014 pressure falls");
    });
    paint();
  },
  /** Weather → trace. Called from the driving frame; costs a distance check. */
  tick(rig, world, renderer2) {
    if (!rig?.on || !world) return;
    const p = rig.p;
    if (!A._lastAt) {
      A._lastAt = [p[0], p[1]];
      return;
    }
    if (dist(p, A._lastAt) < 2.4) return;
    A._lastAt = [p[0], p[1]];
    let worn = false;
    for (let i = Math.max(0, A.n - 220); i < A.n; i++) {
      const dx = A.xyz[i * 3] - p[0], dy = A.xyz[i * 3 + 1] - p[1];
      if (dx * dx + dy * dy < 2.6) {
        worn = true;
        break;
      }
    }
    if (worn) rise(0.05);
    else A.pressure = Math.max(0, A.pressure - 0.012);
    if (A.n >= MAX_STAMPS) {
      let w = 0;
      for (let r = 0; r < A.n; r += 2, w++) {
        A.xyz[w * 3] = A.xyz[r * 3];
        A.xyz[w * 3 + 1] = A.xyz[r * 3 + 1];
        A.xyz[w * 3 + 2] = A.xyz[r * 3 + 2];
      }
      A.n = w;
      A.coarse *= 2;
    }
    A.xyz[A.n * 3] = p[0];
    A.xyz[A.n * 3 + 1] = p[1];
    A.xyz[A.n * 3 + 2] = rig.yaw;
    A.n++;
    for (const t of A.thresholds) {
      if (!t.crossed && dist([t.x, t.y], p) < 60) {
        t.crossed = true;
        drop(5, "you crossed " + t.name + " \u2014 logged as a discovery");
      }
    }
    const now = Date.now();
    if (now - A._upAt > 400) {
      A._upAt = now;
      this.upload(renderer2, world);
    }
    if (now - A._paintAt > 900) {
      A._paintAt = now;
      paint();
    }
  },
  /** The sediment bed: two wheel-marks per stamp, on the drawn ground. */
  upload(renderer2, world) {
    if (!renderer2?.setTrace) return;
    const g = (x, y) => (renderer2.drawnGroundAt?.(x, y) ?? world.place.groundAt(x, y)) + 0.125;
    const col = [0.16, 0.12, 0.09];
    renderer2.setTrace((B) => {
      for (let i = 0; i < A.n; i++) {
        const x = A.xyz[i * 3], y = A.xyz[i * 3 + 1], yaw = A.xyz[i * 3 + 2];
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (const side of [-0.95, 0.95]) {
          const ox = -s * side, oy = c * side;
          const ax = x + ox - c * 1.4, ay = y + oy - s * 1.4;
          const bx = x + ox + c * 1.4, by = y + oy + s * 1.4;
          const wx = -s * 0.21, wy = c * 0.21;
          const p00 = [ax - wx, ay - wy], p10 = [bx - wx, by - wy];
          const p11 = [bx + wx, by + wy], p01 = [ax + wx, ay + wy];
          B.tri(
            [p00[0], p00[1], g(p00[0], p00[1])],
            [p10[0], p10[1], g(p10[0], p10[1])],
            [p11[0], p11[1], g(p11[0], p11[1])],
            [0, 0, 1],
            col,
            0.42
          );
          B.tri(
            [p00[0], p00[1], g(p00[0], p00[1])],
            [p11[0], p11[1], g(p11[0], p11[1])],
            [p01[0], p01[1], g(p01[0], p01[1])],
            [0, 0, 1],
            col,
            0.42
          );
        }
      }
    });
  },
  /** "note: …" — a standing sign, journaled, with you as its author. */
  testify(world, at, text) {
    const [x, y] = at;
    const ring3 = [[x - 1.6, y - 1.6], [x + 1.6, y - 1.6], [x + 1.6, y + 1.6], [x - 1.6, y + 1.6]];
    const z = world.place.groundAt(x, y);
    world.addEntity({
      type: "observation",
      name: text,
      footprint: ring3,
      zBase: z,
      zTop: z + 0.2,
      collision: "none",
      props: { testimony: true }
    }, { label: "testimony", author: "you" });
    drop(3, "testimony planted \u2014 the place answers back");
    return "noted \u2014 a sign stands here";
  },
  /**
   * UNSETTLE: the alternative arrangement, held on a branch. Built things and
   * the structures nearest the centre reflect about the place's centre — a
   * point reflection preserves winding and is its own inverse.
   */
  unsettle(world) {
    if (!world) return "no world yet";
    if (A.unsettled) return "already unsettled \u2014 say resettle to return";
    A.homeBranch = world.branch;
    const existed = world.place.branches.has("unsettled");
    if (!existed) {
      world.createBranch("unsettled", {
        name: "Unsettled",
        parent: world.branch,
        author: "atlas",
        note: "the alternative arrangement \u2014 remembered, not inevitable"
      });
    }
    world.switchBranch("unsettled");
    A.unsettled = true;
    this.ghosts = [];
    if (!existed) {
      const b = world.place.terrain?.bounds;
      const cx = b ? (b[0] + b[2]) / 2 : 0, cy = b ? (b[1] + b[3]) / 2 : 0;
      const movable = world.entities().filter((e) => e.props?.built || e.type === "structure" && dist(centroid(world.ringOf(e) || [[0, 0]]), [cx, cy]) < 350).slice(0, 300);
      world.transact({ label: "unsettle \xB7 the alternative arrangement", author: "atlas" }, (j) => {
        for (const e of movable) {
          const ring3 = world.ringOf(e);
          if (!ring3 || ring3.length < 3) continue;
          if (this.ghosts.length < 120) {
            this.ghosts.push({ id: "ghost-" + e.id, type: e.type, footprint: ring3.map((p) => p.slice()), zBase: e.zBase, zTop: e.zTop });
          }
          const alt = ring3.map(([x, y]) => [2 * cx - x, 2 * cy - y]);
          const [ox, oy] = centroid(ring3);
          const dz = world.place.groundAt(2 * cx - ox, 2 * cy - oy) - world.place.groundAt(ox, oy);
          j.mutate({
            op: "update",
            branch: world.branch,
            id: e.id,
            patch: { footprint: alt, zBase: e.zBase + dz, zTop: e.zTop + dz }
          });
        }
      });
    }
    drop(8, "the arrangement is questioned \u2014 ghosts hold the abandoned positions");
    paint();
    return "unsettled \u2014 the standing arrangement is now one branch among others";
  },
  /** RESETTLE: the given returns. It was remembered the whole time. */
  resettle(world) {
    if (!world || !A.unsettled) return "nothing is unsettled";
    world.switchBranch(A.homeBranch || "main");
    A.unsettled = false;
    this.ghosts = [];
    rise(6);
    A.lastLine = "the given arrangement returns \u2014 remembered, not inevitable";
    paint();
    return "resettled \u2014 back on " + world.branch;
  }
};
var rigAt = (ctx) => {
  const R = ctx.RIG, S3 = ctx.S;
  if (R?.on) return [R.p[0], R.p[1]];
  return S3?.cam ? [S3.cam.target[0], S3.cam.target[1]] : [0, 0];
};
BUS.register(
  "testify",
  (t, raw) => raw.match(/^note[:,]\s*(.+)/i),
  (m, ctx) => {
    const out = ATLAS.testify(ctx.S.world, rigAt(ctx), m[1]);
    ctx.S.dirty = true;
    return out;
  },
  "note: <words> \u2014 plant testimony where you stand"
);
BUS.register(
  "unsettle",
  (t) => /^unsettle\b/.test(t),
  (m, ctx) => {
    const out = ATLAS.unsettle(ctx.S.world);
    ctx.S.dirty = true;
    return out;
  },
  "unsettle \u2014 swap the arrangement for its alternative (a branch)"
);
BUS.register(
  "resettle",
  (t) => /^resettle\b|^settle\b/.test(t),
  (m, ctx) => {
    const out = ATLAS.resettle(ctx.S.world);
    ctx.S.dirty = true;
    return out;
  },
  "resettle \u2014 return to the given arrangement"
);
BUS.register(
  "pressure",
  (t) => /^(pressure|atlas)\b/.test(t),
  () => "normalization " + Math.round(A.pressure) + "/100 \u2014 " + A.thresholds.filter((t) => t.crossed).length + "/4 thresholds crossed",
  "pressure \u2014 read the atlas dock aloud"
);
if (typeof window !== "undefined") window.ATLAS = ATLAS;

// src/ai/operator.js
var KEY_STORE = "creo.ai.key";
var CFG_STORE = "creo.ai.config";
var STALE_DEFAULTS = /* @__PURE__ */ new Set(["gpt-4o-mini", "gpt-4o", "gpt-4", "gpt-3.5-turbo"]);
function getConfig() {
  try {
    const cfg = { key: localStorage.getItem(KEY_STORE) || "", ...JSON.parse(localStorage.getItem(CFG_STORE) || "{}") };
    if (cfg.model && STALE_DEFAULTS.has(cfg.model) && !cfg.modelChosen) cfg.model = "";
    if (cfg.api && !cfg.apiV2) {
      delete cfg.api;
    }
    return cfg;
  } catch {
    return { key: "" };
  }
}
function setConfig(patch = {}) {
  if (patch.key !== void 0) localStorage.setItem(KEY_STORE, patch.key);
  const cfg = getConfig();
  const next = {
    baseURL: patch.baseURL ?? cfg.baseURL ?? "https://api.openai.com/v1",
    // No hardcoded default model. Whatever the endpoint reports is the truth;
    // shipping a stale id was why an old model was the only thing on offer.
    model: patch.model ?? cfg.model ?? "",
    // once a model is picked from the endpoint's own list it is a real choice
    modelChosen: patch.model ? true : cfg.modelChosen ?? false,
    provider: patch.provider ?? cfg.provider ?? "openai",
    apiV2: true,
    dropped: patch.dropped ?? cfg.dropped ?? [],
    effort: patch.effort ?? cfg.effort ?? "medium",
    vision: patch.vision ?? cfg.vision ?? "auto",
    api: patch.api ?? cfg.api ?? "auto"
  };
  localStorage.setItem(CFG_STORE, JSON.stringify(next));
  return next;
}
function effortFor(text, fallback = "medium") {
  const t = String(text).toLowerCase();
  if (/^(select|show|hide|zoom|go to|take me|look)/.test(t)) return "low";
  if (/(why|what happens|compare|best|solve|flood|instead|without)/.test(t)) return "high";
  if (/(build|move|plant|drain|connect|remove|put|add)/.test(t)) return "medium";
  return fallback;
}
var telemetry = [];
var hasKey = () => !!getConfig().key;
async function listModels() {
  const { key: key2, baseURL, provider } = getConfig();
  if (!key2) throw new Error("no key configured");
  if (provider === "anthropic") {
    const r2 = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key2, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
    });
    if (!r2.ok) throw new Error(`${r2.status}: ${(await r2.text()).slice(0, 120)}`);
    return (await r2.json()).data.map((m) => m.id).sort();
  }
  const r = await fetch(`${(baseURL || "https://api.openai.com/v1").replace(/\/$/, "")}/models`, {
    headers: { authorization: `Bearer ${key2}` }
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`);
  return (await r.json()).data.map((m) => m.id).sort();
}
async function complete({ system, prompt, image = null, effort = null }) {
  const cfg = getConfig();
  const { key: key2, baseURL, model, provider } = cfg;
  if (!key2) throw new Error("no API key configured");
  if (!model) throw new Error("no model chosen \u2014 open the panel and pick one from your endpoint");
  const started = performance.now();
  const record = (api, usage) => {
    telemetry.push({
      at: Date.now(),
      model,
      api,
      effort: effort || cfg.effort,
      ms: Math.round(performance.now() - started),
      inTokens: usage?.input_tokens ?? usage?.prompt_tokens ?? null,
      outTokens: usage?.output_tokens ?? usage?.completion_tokens ?? null,
      vision: !!image
    });
  };
  if (provider === "anthropic") {
    const content2 = [{ type: "text", text: prompt }];
    if (image) content2.unshift({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.split(",")[1] } });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key2, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: 2e3, temperature: 0, system, messages: [{ role: "user", content: content2 }] })
    });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    record("messages", j.usage);
    return j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  }
  const base = (baseURL || "https://api.openai.com/v1").replace(/\/$/, "");
  const content = [{ type: "input_text", text: prompt }];
  if (image) content.push({ type: "input_image", image_url: image, detail: "low" });
  const dropped = new Set(cfg.dropped || []);
  function prune(body) {
    const out = { ...body };
    for (const k of dropped) deleteDeep(out, k);
    return out;
  }
  function deleteDeep(obj, path) {
    const parts = path.split(".");
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      o = o?.[parts[i]];
      if (!o) return;
    }
    delete o[parts[parts.length - 1]];
  }
  async function post(url, body, tries = 4) {
    for (let attempt = 0; attempt < tries; attempt++) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key2}` },
        body: JSON.stringify(prune(body))
      });
      if (r.ok) return r;
      const text = await r.text();
      if (r.status !== 400) return { ...r, ok: false, status: r.status, _text: text };
      const fix = repairFor(text, body);
      if (!fix) return { ok: false, status: 400, _text: text };
      if (fix.rename) {
        body[fix.rename[1]] = body[fix.rename[0]];
      }
      dropped.add(fix.drop);
      setConfig({ dropped: [...dropped] });
      console.warn(`[CREO] ${model} refuses "${fix.drop}" \u2014 dropping it and retrying`);
    }
    return { ok: false, status: 400, _text: "gave up repairing the request" };
  }
  const responsesBody = {
    model,
    instructions: system,
    input: [{ role: "user", content }],
    ...effort || cfg.effort ? { reasoning: { effort: effort || cfg.effort } } : {},
    text: { verbosity: "low" }
  };
  if (cfg.api !== "chat") {
    let r = null;
    try {
      r = await post(`${base}/responses`, responsesBody);
    } catch {
      r = null;
    }
    if (r && r.ok) {
      const j = await r.json();
      record("responses", j.usage);
      if (cfg.api !== "responses") setConfig({ api: "responses" });
      const text = j.output_text ?? (j.output || []).flatMap((o) => (o.content || []).filter((c) => c.type === "output_text").map((c) => c.text)).join("");
      if (text) return text;
    } else if (r && r.status === 400) {
      throw new Error(`400: ${String(r._text).slice(0, 200)}`);
    } else if (r && r.status && r.status !== 404) {
      throw new Error(`${r.status}: ${String(r._text).slice(0, 200)}`);
    } else {
      setConfig({ api: "chat" });
    }
  }
  const msgContent = image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image, detail: "low" } }] : prompt;
  const r2 = await post(`${base}/chat/completions`, {
    model,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: msgContent }]
  });
  if (!r2.ok) throw new Error(`${r2.status}: ${String(r2._text).slice(0, 200)}`);
  const j2 = await r2.json();
  record("chat", j2.usage);
  return j2.choices[0].message.content;
}
function repairFor(errorText, body = {}) {
  let msg = errorText;
  try {
    msg = JSON.parse(errorText).error?.message || errorText;
  } catch {
  }
  const lower = String(msg).toLowerCase();
  const named = String(errorText).match(/"param"\s*:\s*"([^"]+)"/)?.[1] || lower.match(/unsupported (?:value|parameter): '([^']+)'/)?.[1] || lower.match(/unknown parameter: '([^']+)'/)?.[1] || lower.match(/'([a-z_.]+)' is not supported/)?.[1] || lower.match(/unsupported_(?:value|parameter).*'([a-z_.]+)'/)?.[1];
  if (named === "max_tokens" || /use ['"]?max_completion_tokens/.test(lower)) {
    return { drop: "max_tokens", rename: ["max_tokens", "max_completion_tokens"] };
  }
  if (named && has(body, named)) return { drop: named };
  if (named === "verbosity" || /verbosity/.test(lower)) return { drop: "text.verbosity" };
  if (/reasoning/.test(lower) && has(body, "reasoning")) return { drop: "reasoning" };
  if (/response_format|json_object/.test(lower)) return { drop: "response_format" };
  if (/temperature/.test(lower)) return { drop: "temperature" };
  return null;
}
var has = (obj, path) => {
  let o = obj;
  for (const part of String(path).split(".")) {
    if (!o || !(part in o)) return false;
    o = o[part];
  }
  return true;
};
function digest(world, { camera, selection = [], pointer = null, limit = 90 }) {
  const focus = [camera.target[0], camera.target[1]];
  const radius = Math.max(80, camera.dist * 0.9);
  const near = world.index.near(focus, radius);
  const seen = /* @__PURE__ */ new Set();
  const rows = [];
  for (const hit of near) {
    if (rows.length >= limit) break;
    const e = world.get(hit.id);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    if (["opening", "furniture", "room"].includes(e.type)) continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    const c = centroid(ring3);
    const ob = orientedBounds(ring3);
    rows.push({
      id: e.id,
      type: e.type + (e.subtype ? `/${e.subtype}` : ""),
      name: e.name && e.name !== "Building" ? e.name : void 0,
      use: e.use || void 0,
      at: [Math.round(c[0]), Math.round(c[1])],
      size: `${ob.width.toFixed(0)}x${ob.depth.toFixed(0)}m`,
      height: e.zTop - e.zBase > 0.4 ? `${(e.zTop - e.zBase).toFixed(0)}m` : void 0,
      said: e.type === "observation" ? e.evidence?.[0]?.text || e.name : void 0
    });
  }
  const b = world.place.bounds();
  return {
    place: world.place.name,
    bounds: { x: [Math.round(b[0]), Math.round(b[2])], y: [Math.round(b[1]), Math.round(b[3])] },
    units: "metres, local grid; +x is east, +y is north",
    camera: { looking_at: [Math.round(focus[0]), Math.round(focus[1])], height_of_view: Math.round(camera.dist) },
    selection,
    pointer: pointer ? [Math.round(pointer[0]), Math.round(pointer[1])] : null,
    ground: world.place.terrain ? { relief_m: +Math.max(...world.place.terrain.data).toFixed(1) } : null,
    nearby: rows,
    truncated: near.length > rows.length ? `${near.length - rows.length} more things not listed` : void 0
  };
}
var SYSTEM = `You operate a spatial design tool called CREO. You are not drawing geometry and you are not deciding what is true about the place \u2014 you are working the interface the way a person works it with their hands.

You will be given the user's request and a digest of what is currently in view: named things with ids, positions in metres on a local grid, and sizes.

Return ONLY a JSON object of this shape:
{"reasoning":"<one short sentence>","operations":[ ... ]}

Each operation is one of:
  {"op":"look","at":[x,y],"distance":<metres>}          move the view
  {"op":"point","at":[x,y]}                              tap a location
  {"op":"select","ids":["..."]}                          select existing things by id
  {"op":"circle","points":[[x,y],[x,y],...]}             draw a closed area (4-12 points)
  {"op":"line","points":[[x,y],[x,y],...]}               trace a route (2-12 points)
  {"op":"say","text":"<an ordinary sentence>"}           speak to the place
  {"op":"note","at":[x,y],"text":"<what you observed>"}  leave an observation

Rules you must follow:
- Every id must appear in the digest. Never invent one.
- Every coordinate must lie inside the stated bounds.
- Prefer selecting a named thing over circling near it.
- A "circle" is for an AREA the request is about; a "line" is for a ROUTE.
- Put the gesture BEFORE the sentence: circle or select first, then say. The tool resolves "this" and "here" from what you just indicated.
- Sentences must be plain English of the kind a resident would use: "this floods when it rains", "we need a drain here", "there should be trees here", "connect these", "why is this here?".
- Do not propose more than one intervention per request.
- If the request cannot be grounded in what is in view, return an empty operations list and say why in reasoning.`;
var OPS = /* @__PURE__ */ new Set(["look", "point", "select", "circle", "line", "say", "note"]);
function validate(world, ops, digestObj) {
  const known = new Set(digestObj.nearby.map((r) => r.id));
  const b = world.place.bounds();
  const inBounds = ([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= b[0] - 50 && x <= b[2] + 50 && y >= b[1] - 50 && y <= b[3] + 50;
  const ok = [];
  const refused = [];
  for (const raw of ops || []) {
    const op = raw && raw.op;
    if (!OPS.has(op)) {
      refused.push({ raw, why: `unknown operation "${op}"` });
      continue;
    }
    if (op === "select") {
      const ids = (raw.ids || []).filter((id) => world.get(id));
      const bad = (raw.ids || []).filter((id) => !world.get(id));
      if (bad.length) refused.push({ raw, why: `no such thing: ${bad.join(", ")}` });
      if (!ids.length) continue;
      if (ids.some((id) => !known.has(id))) refused.push({ raw, why: "selected something that was not in view" });
      ok.push({ op: "select", ids });
      continue;
    }
    if (op === "point" || op === "note" || op === "look") {
      if (!Array.isArray(raw.at) || !inBounds(raw.at)) {
        refused.push({ raw, why: "point is outside this place" });
        continue;
      }
      ok.push({ ...raw, at: [Number(raw.at[0]), Number(raw.at[1])] });
      continue;
    }
    if (op === "circle" || op === "line") {
      const pts = (raw.points || []).filter((p) => Array.isArray(p) && inBounds(p)).map((p) => [Number(p[0]), Number(p[1])]);
      if (pts.length < (op === "circle" ? 3 : 2)) {
        refused.push({ raw, why: "not enough points inside this place" });
        continue;
      }
      if (op === "circle" && area(pts) < 4) {
        refused.push({ raw, why: "that area is too small to mean anything" });
        continue;
      }
      ok.push({ op, points: pts.slice(0, 12) });
      continue;
    }
    if (op === "say") {
      const text = String(raw.text || "").trim();
      if (!text) {
        refused.push({ raw, why: "empty sentence" });
        continue;
      }
      if (text.length > 200) {
        refused.push({ raw, why: "sentence too long to be an utterance" });
        continue;
      }
      ok.push({ op: "say", text });
    }
  }
  return { operations: ok, refused };
}
async function proposeOperations(world, request, view, opts = {}) {
  const cfg = getConfig();
  const d = digest(world, view);
  const visionMode = opts.vision || cfg.vision;
  const wantsVision = visionMode === "always" || visionMode === "auto" && (view.selection?.length || view.pointer || /\b(this|that|here|there|looks|see|behind|beside|left|right)\b/i.test(request));
  const prompt = [
    `Request: ${request}`,
    opts.findings ? `
What CREO has already established by looking:
${opts.findings}` : "",
    opts.critique ? `
A previous attempt was rejected. The single largest problem was:
${opts.critique}
Address that.` : "",
    "",
    "What is in view:",
    JSON.stringify(d, null, 1)
  ].filter(Boolean).join("\n");
  const raw = await complete({
    system: SYSTEM,
    prompt,
    image: wantsVision ? view.image || null : null,
    effort: opts.effort || effortFor(request, cfg.effort)
  });
  let parsed;
  try {
    parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
  } catch {
    const m = /\{[\s\S]*\}/.exec(raw);
    if (!m) throw new Error("the model did not return JSON");
    parsed = JSON.parse(m[0]);
  }
  const { operations, refused } = validate(world, parsed.operations, d);
  return { reasoning: String(parsed.reasoning || "").slice(0, 240), operations, refused, digest: d, raw };
}
var CRITIC_SYSTEM = `You are an independent reviewer of a proposed change to a real place.

You did not make this proposal and you must not assume it is good. You are shown the goal, the hard constraints, what the world's own models measured, and an image of the result as a participant would see it.

Judge only what is in front of you. You have not been told the proposer's reasoning and must not imagine it.

Return ONLY JSON:
{"verdict":"PASS"|"FAIL","largestProblem":"<one sentence, or empty if PASS>","whatAParticipantWouldSee":"<one sentence>"}

FAIL if any hard constraint is broken, if a measured consequence got worse, or if a participant looking at the image could not tell what changed or why. Say the single largest problem, not a list.`;
async function critique({ goal, constraints = [], metrics = [], image = null, effort = "max" }) {
  const prompt = [
    `Goal: ${goal}`,
    constraints.length ? `Hard constraints:
${constraints.map((c) => `- ${c}`).join("\n")}` : "Hard constraints: none stated.",
    metrics.length ? `What the world's models measured:
${metrics.map((m) => `- ${m.label}: ${m.before} \u2192 ${m.after}`).join("\n")}` : "No measurements available.",
    image ? "An image of the result is attached." : "No image is available; judge on the measurements alone."
  ].join("\n\n");
  const raw = await complete({ system: CRITIC_SYSTEM, prompt, image, effort });
  try {
    return JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
  } catch {
    const m = /\{[\s\S]*\}/.exec(raw);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
      }
    }
    return { verdict: "FAIL", largestProblem: "the reviewer did not return a usable judgement", whatAParticipantWouldSee: "" };
  }
}

// src/ui/console.js
var MODES = [
  [
    "AGENT",
    "#d8c9ff",
    "rgba(159,122,234,.16)",
    "rgba(159,122,234,.42)",
    "summon \u2014 a watchtower here \xB7 why does this flood? \xB7 three futures"
  ],
  [
    "BUILD",
    "#ffd9a8",
    "rgba(255,180,80,.14)",
    "rgba(255,180,80,.40)",
    "build \u2014 a tower here \xB7 a garden \xB7 a drain along this path"
  ],
  [
    "SAY",
    "#9af0e6",
    "rgba(57,198,187,.14)",
    "rgba(57,198,187,.40)",
    "say \u2014 this floods when it rains \xB7 note: people cut through here"
  ],
  [
    "GAME",
    "#ffb4b4",
    "rgba(216,75,78,.16)",
    "rgba(216,75,78,.42)",
    "drive \xB7 a ramp \xB7 a house \xB7 unsettle \xB7 aerial \xB7 help"
  ]
];
var say = (text) => {
  const si = document.getElementById("sayInput");
  if (!si) return false;
  si.value = text;
  si.dispatchEvent(new Event("input", { bubbles: true }));
  si.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  return true;
};
var click = (id) => {
  const b = document.getElementById(id);
  if (b) {
    b.click();
    return true;
  }
  return false;
};
var key = (k) => dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
var houseSpot = (ctx) => {
  const S3 = ctx.S;
  const yaw = RIG.on ? RIG.yaw : S3.cam.yaw + Math.PI;
  const at = RIG.on ? [RIG.p[0] + Math.cos(yaw) * 16, RIG.p[1] + Math.sin(yaw) * 16] : [S3.cam.target[0], S3.cam.target[1]];
  return { at, yaw };
};
BUS.register(
  "drive",
  (t) => /^(drive|mount|get in)\b/.test(t),
  (m, ctx) => {
    if (!RIG.on) RIG.enter(ctx.S.world, ctx.S.cam);
    return "driving";
  },
  "drive \u2014 mount the rig"
);
BUS.register(
  "park",
  (t) => /^(park|dismount|get out|stop)\b/.test(t),
  (m, ctx) => {
    if (RIG.on) RIG.exit(ctx.S.world, ctx.S.cam);
    return "parked";
  },
  "park \u2014 dismount"
);
BUS.register(
  "fire",
  (t) => /^(fire|shoot|destroy)\b/.test(t),
  () => {
    press("fire");
    return "fired";
  },
  "fire \u2014 the laser takes what it hits, and undo puts it back"
);
BUS.register("jump", (t) => /^jump\b/.test(t), () => {
  press("jump");
  return "jumped";
}, "jump");
BUS.register(
  "colour",
  (t) => t.match(/\b(teal|ember|amber|violet|bone|coal)\b/),
  (m) => {
    const map = {
      teal: [0.1, 0.88, 0.76],
      ember: [1, 0.32, 0.2],
      amber: [1, 0.8, 0.25],
      violet: [0.66, 0.48, 0.92],
      bone: [0.94, 0.95, 0.96],
      coal: [0.12, 0.13, 0.16]
    };
    RIG.color = map[m[1]];
    return m[1];
  },
  "teal \xB7 ember \xB7 amber \xB7 violet \xB7 bone \xB7 coal \u2014 repaint the rig"
);
BUS.register(
  "part",
  (t) => {
    const kind = parse(t);
    return kind && /\b(ramp|qpipe|block|beam|panel|cyl|build|place|drop|put|jump|pipe|wall|pillar|bar|cube)\b/.test(t) ? kind : null;
  },
  (kind, ctx) => {
    const r = place(ctx.S.world, kind, RIG);
    if (r && r.refused) return r.message;
    if (!r) return "nothing to place";
    return "placed a " + kind + (r.__offsetBy ? " \u2014 stepped " + Math.round(r.__offsetBy) + " m clear" : "");
  },
  "a ramp \xB7 a block \xB7 a panel \u2026 \u2014 placed ahead, gate willing"
);
BUS.register(
  "house",
  (t) => {
    const o = parseHouse(t);
    return o && /\b(house|home|cabin|cottage|shed|barn|lodge)\b/.test(t) ? o : null;
  },
  (o, ctx) => {
    const { at, yaw } = houseSpot(ctx);
    const made = house(ctx.S.world, at, yaw, o);
    if (made.refused) return made.message;
    return "a house of " + made.length + " parts" + (made.__offsetBy ? " \u2014 stepped " + Math.round(made.__offsetBy) + " m clear" : "");
  },
  "a house \xB7 a big barn \xB7 a small cabin \u2014 massed, gated, journaled"
);
BUS.register(
  "aerial",
  (t) => /\b(aerial|satellite|photo|imagery)\b/.test(t),
  (m, ctx, raw) => {
    if (/\b(off|hide|no)\b/.test(raw.toLowerCase())) {
      IMAGERY2.off();
      ctx.S.dirty = true;
      return "aerial off \u2014 back to the palette";
    }
    IMAGERY2.load(ctx.S.world).then((ok) => {
      if (ok) {
        ctx.S.dirty = true;
        dispatchEvent(new CustomEvent("rig:worldchanged"));
      }
    });
    return "draping the aerial\u2026";
  },
  "aerial on/off \u2014 the real photograph on the real ground"
);
BUS.register(
  "labels",
  (t) => /^labels?\b/.test(t),
  (m, ctx, raw) => {
    ctx.S.labels = /\b(off|no|hide)\b/.test(raw.toLowerCase()) ? false : true;
    if (ctx.S.labels === false) {
      const h = document.getElementById("labels");
      if (h) h.textContent = "";
    }
    return ctx.S.labels === false ? "labels off \u2014 just the place" : "labels on";
  },
  "labels off / on \u2014 the name tags"
);
BUS.register(
  "sound",
  (t) => /^(sound|audio|engine)\b/.test(t),
  (m, ctx, raw) => {
    const off = /\b(off|no|mute|stop)\b/.test(raw.toLowerCase());
    setEngineSound(!off);
    return off ? "sound off" : "sound on \u2014 a low motor, no mosquito";
  },
  "sound on / off \u2014 the engine (off by default)"
);
BUS.register(
  "help",
  (t) => /^(help|verbs|\?)$/.test(t),
  () => {
    console.info("%c[BUS] " + BUS.help().join("\n"), "color:#6fe0c0");
    return BUS.verbs.length + " verbs \u2014 the full list is in the console";
  },
  "help \u2014 list every verb the commons knows"
);
function mountConsole(S3) {
  if (document.getElementById("rig-console")) return;
  const cockpitCss = document.createElement("style");
  cockpitCss.textContent = `
    body.cockpit #viewTools, body.cockpit #say,
    body.cockpit #whereAmI, body.cockpit #themeChip, body.cockpit #findChip,
    body.cockpit #setup { display: none !important; }
    /* The header row is GONE from the cockpit: the place is a chip on the line
       (\u25F5), undo/redo and your name are in the menu, and the licence sits with
       the map it belongs to. Two rows fighting for the top of a phone screen
       was the whole problem \u2014 bounding them was treating a symptom. */
    body.cockpit #top { display: none !important; }
    /* Every edge, or none: overriding right/bottom while the sheet still set
       top/left stretched the licence into a 664px-tall invisible slab down the
       right of the world \u2014 a panel nobody could see and everybody could hit. */
    body.cockpit #attribution {
      top: auto !important; left: auto !important;
      right: 12px !important; bottom: 4px !important;
      width: 214px !important; max-width: 214px !important; height: auto !important;
      font-size: 8px !important; line-height: 1.3 !important; opacity: .5;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      pointer-events: none;
    }
    /* THE RIGHT COLUMN, pinned bottom-up: licence, meter, the thin dock, the
       plan, then the actions. Fixed offsets, so nothing floats into anything. */
    body.cockpit #plan { bottom: 100px !important; }

    /* EVERYTHING THAT SPEAKS COMES DOWN FROM THE LINE.
       CREO's panels \u2014 what you selected, a proposal, an answer, the futures \u2014
       were anchored to the bottom-right, which is now where the ring lives, so
       they opened directly behind the biggest tool on screen. They belong to
       the bar (that is where the question was asked), so they drop from it,
       centred, and the bottom of the screen stays clear. */
    body.cockpit #tools, body.cockpit #proposal,
    body.cockpit #answer, body.cockpit #branches {
      left: 50% !important; right: auto !important;
      top: 66px !important; bottom: auto !important;
      transform: translateX(-50%) !important;
      width: min(560px, 92vw) !important; max-width: min(560px, 92vw) !important;
      max-height: min(62vh, 520px) !important; overflow: auto !important;
      border-radius: 14px !important; z-index: 64 !important;
    }
    body.cockpit #working {
      left: 50% !important; right: auto !important; transform: translateX(-50%) !important;
      top: 66px !important; bottom: auto !important; z-index: 65 !important;
    }
    /* The panels are bounded so they can never reach the ring's corner: they
       stop well above it, and the ring is never dimmed or disabled. */
    body.cockpit #tools, body.cockpit #proposal,
    body.cockpit #answer, body.cockpit #branches { max-height: min(58vh, 470px) !important; }

    /* \u2500\u2500 EVERY MENU IS AN ARC \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
       CREO's own lists \u2014 the place picker, the subject's actions \u2014 were tall
       rectangles dropped over the world. They are the same content as a curved
       strip: one row, scrolled sideways, hugging the line above it. Nothing
       here changes what they DO; it changes how much sky they take. */
    body.cockpit .menu.arc {
      position: fixed !important; top: 56px !important; left: 50% !important;
      transform: translateX(-50%) perspective(820px) rotateX(8deg) !important;
      transform-origin: 50% 0% !important; right: auto !important;
      display: flex !important; flex-direction: row !important;
      width: min(880px, 98vw) !important; max-width: none !important;
      max-height: none !important; height: auto !important;
      overflow-x: auto !important; overflow-y: visible !important;
      gap: 5px !important; padding: 9px 12px 12px !important;
      border-radius: 0 0 22px 22px !important;
      scrollbar-width: none;
      mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
    }
    body.cockpit .menu.arc::-webkit-scrollbar { display: none; }
    body.cockpit .menu.arc > button, body.cockpit .menu.arc > .menuLabel {
      flex: 0 0 auto !important; width: auto !important; max-width: 168px;
      border-radius: 10px !important; padding: 8px 10px !important;
      border: 1px solid rgba(151,187,213,.2) !important; background: rgba(10,14,18,.9) !important;
      transform-origin: 50% 140%; text-align: left !important; white-space: normal !important;
    }
    body.cockpit .menu.arc > .menuLabel {
      background: transparent !important; border: 0 !important; color: #7d8b95 !important;
      align-self: center; letter-spacing: .2em;
    }
    /* THE SEARCH PANEL stays a form (a text field is not a chip), but it drops
       from the line like everything else and is bounded so it never reaches the
       ring. "Take me anywhere\u2026" opens this. */
    body.cockpit .menu.importPanel {
      position: fixed !important; top: 56px !important; left: 50% !important;
      transform: translateX(-50%) !important; right: auto !important;
      width: min(520px, 94vw) !important; max-height: min(60vh, 480px) !important;
      overflow: auto !important; border-radius: 14px !important; z-index: 66 !important;
    }
    /* THE KEY PANEL \u2014 where the AI features are switched on. It was hidden by
       cockpit mode with no way back except a menu item nobody could find. */
    body.cockpit #setup.show {
      display: block !important; position: fixed !important;
      top: 56px !important; left: 50% !important; transform: translateX(-50%) !important;
      right: auto !important; bottom: auto !important;
      width: min(460px, 94vw) !important; z-index: 67 !important;
    }
    /* the subject panel's actions become a swept row rather than a wrapped grid */
    body.cockpit #tools .row {
      display: flex !important; flex-wrap: nowrap !important; overflow-x: auto !important;
      gap: 5px !important; padding-bottom: 4px; scrollbar-width: none;
    }
    body.cockpit #tools .row::-webkit-scrollbar { display: none; }
    body.cockpit #tools .row > * { flex: 0 0 auto !important; }
    body.cockpit #tools .thread { max-height: 130px !important; overflow: auto !important; }
    /* FILM MODE \u2014 a clean frame for recording: everything but the world (and
       its labels, and the licence) steps aside. Say "film", or press H. */
    body.film #rig-console, body.film #build-rail, body.film #atlas-dock,
    body.film #top, body.film #plan, body.film #tools, body.film #toast,
    body.film #rig-dock, body.film #rig-hint, body.film #rig-chrome,
    body.film #frameOffer, body.film #exploreHint, body.film #working,
    body.film #waterLegend, body.film #youAreHere, body.film #say,
    body.film #viewTools, body.film #setup, body.film #crosshair,
    body.film #rig-reply { display: none !important; }
  `;
  document.head.appendChild(cockpitCss);
  const film = (on) => document.body.classList.toggle("film", on);
  addEventListener("keydown", (e) => {
    if ((e.key === "h" || e.key === "H") && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
      film(!document.body.classList.contains("film"));
    }
  });
  BUS.register(
    "film",
    (t) => /^(film|cinema|record)\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|end|stop)\b/.test(raw.toLowerCase());
      film(!off);
      return off ? "the instruments return" : "film \u2014 press H to bring the instruments back";
    },
    "film / film off \u2014 a clean frame for recording (H toggles)"
  );
  const cockpit = (on) => {
    document.body.classList.toggle("cockpit", on);
    try {
      localStorage.setItem("terrarium.cockpit", on ? "on" : "off");
    } catch (_) {
    }
  };
  let cockpitOn = true;
  try {
    cockpitOn = localStorage.getItem("terrarium.cockpit") !== "off";
  } catch (_) {
  }
  cockpit(cockpitOn);
  const bar = document.createElement("div");
  bar.id = "rig-console";
  bar.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:62;display:flex;align-items:center;gap:8px;width:min(560px,92vw);background:rgba(10,14,18,.92);border:1px solid rgba(151,187,213,.25);border-radius:14px;padding:7px 9px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);";
  let mi = 0;
  const placeBtn = document.createElement("button");
  placeBtn.title = "where you are \u2014 tap for the places, or say: land <anywhere>";
  placeBtn.style.cssText = "flex:0 0 auto;max-width:116px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:8px;cursor:pointer;padding:7px 8px;border:1px solid rgba(151,187,213,.28);background:rgba(255,255,255,.05);color:#cfe8dd;font:700 9px/1 ui-monospace,monospace;letter-spacing:.06em;";
  const paintPlace = () => {
    const n = document.getElementById("placeName");
    placeBtn.textContent = "\u25F5 " + (n && n.textContent || "PLACE").toUpperCase();
  };
  placeBtn.addEventListener("click", () => {
    const c = document.getElementById("placeChip");
    if (c) c.click();
  });
  paintPlace();
  const nameEl = document.getElementById("placeName");
  if (nameEl && typeof MutationObserver === "function") {
    new MutationObserver(paintPlace).observe(nameEl, { childList: true, characterData: true, subtree: true });
  }
  const keyBtn = document.createElement("button");
  keyBtn.textContent = "\u2726";
  const paintKey = () => {
    const on = hasKey();
    keyBtn.title = on ? "the AI key \u2014 change or remove it" : "ADD AN API KEY to switch on the thinking";
    keyBtn.style.background = on ? "rgba(255,255,255,.05)" : "rgba(159,122,234,.24)";
    keyBtn.style.borderColor = on ? "rgba(151,187,213,.28)" : "rgba(159,122,234,.7)";
    keyBtn.style.color = on ? "#8d9aa5" : "#d8c9ff";
  };
  keyBtn.style.cssText = "flex:0 0 auto;width:30px;height:30px;border-radius:8px;cursor:pointer;border:1px solid rgba(159,122,234,.7);background:rgba(159,122,234,.24);color:#d8c9ff;font:700 13px/1 ui-monospace,monospace;";
  keyBtn.addEventListener("click", () => openKeyPanel());
  const chip = document.createElement("button");
  chip.style.cssText = "flex:0 0 auto;border-radius:8px;font:800 9px/1 ui-monospace,monospace;letter-spacing:.1em;padding:7px 9px;cursor:pointer;";
  const inp = document.createElement("input");
  inp.style.cssText = "flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e8edf2;font:500 13px/1.2 system-ui,-apple-system,sans-serif;";
  const paintMode = () => {
    const [name, fg, bg, bd, ph] = MODES[mi];
    chip.textContent = name;
    chip.style.color = fg;
    chip.style.background = bg;
    chip.style.border = "1px solid " + bd;
    inp.placeholder = ph;
  };
  chip.addEventListener("click", () => {
    mi = (mi + 1) % MODES.length;
    paintMode();
    inp.focus();
  });
  paintMode();
  const reply = document.createElement("div");
  reply.id = "rig-reply";
  reply.style.cssText = "position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:61;max-width:min(540px,90vw);background:rgba(10,14,18,.88);border:1px solid rgba(151,187,213,.2);border-radius:9px;padding:6px 12px;color:#9af0e6;font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.04em;opacity:0;transition:opacity .25s;pointer-events:none;";
  document.body.appendChild(reply);
  let replyT = 0;
  const flash = (text) => {
    if (!text) return;
    reply.textContent = String(text);
    reply.style.opacity = "1";
    clearTimeout(replyT);
    replyT = setTimeout(() => {
      reply.style.opacity = "0";
    }, 3200);
  };
  const send = document.createElement("button");
  send.textContent = "\u27A4";
  send.style.cssText = "flex:0 0 auto;width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;background:#df5a5d;color:#fff;font-size:14px;";
  const go = () => {
    const text = inp.value.trim();
    if (!text) return;
    const mode = MODES[mi][0];
    inp.value = "";
    if (/^note[:,]/i.test(text) || /^(land|terra)\b/i.test(text) || mode === "GAME") {
      const r = BUS.dispatch(text, { S: S3, RIG });
      if (r !== null) {
        flash(r);
        return;
      }
      if (mode === "GAME") {
        flash("the commons knows no such verb \u2014 try help");
        return;
      }
    }
    if ((mode === "AGENT" || mode === "BUILD") && !hasKey()) {
      flash("no key yet \u2014 the \u2726 on this line switches the thinking on");
      openKeyPanel();
      return;
    }
    say(mode === "BUILD" ? text.replace(/^(build|make|put)\s+/i, "") : text);
  };
  send.addEventListener("click", go);
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") go();
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      chip.click();
    }
  });
  const burger = document.createElement("button");
  burger.textContent = "\u2261";
  burger.style.cssText = "flex:0 0 auto;width:32px;height:32px;border-radius:9px;cursor:pointer;border:1px solid rgba(151,187,213,.3);background:rgba(255,255,255,.05);color:#cfe8dd;font-size:15px;";
  paintKey();
  bar.append(placeBtn, chip, inp, keyBtn, send, burger);
  document.body.appendChild(bar);
  const menu = document.createElement("div");
  menu.style.cssText = "position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:63;display:none;flex-direction:column;gap:5px;width:min(760px,98vw);padding:0 2px;pointer-events:none;";
  const arcRow = (curve) => {
    const wrap2 = document.createElement("div");
    wrap2.style.cssText = "display:flex;gap:5px;overflow-x:auto;overflow-y:visible;padding:8px 10px 10px;scrollbar-width:none;-ms-overflow-style:none;pointer-events:auto;mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);";
    wrap2.dataset.curve = curve;
    return wrap2;
  };
  const curveChips = (row) => {
    for (const k of row.children) k.style.transform = "";
    row.style.transformOrigin = "50% 0%";
    row.style.transform = "perspective(820px) rotateX(8deg)";
  };
  if (typeof MutationObserver === "function") {
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (!(n instanceof HTMLElement) || !n.classList.contains("menu")) continue;
          if (n.classList.contains("importPanel")) continue;
          n.classList.add("arc");
        }
      }
    }).observe(document.body, { childList: true });
  }
  const subjects = arcRow("top");
  const verbs = arcRow("bottom");
  menu.append(subjects, verbs);
  const GROUPS = [];
  let current = null;
  const section = (label3, tint) => {
    GROUPS.push({ name: label3, tint: tint || "#9fb4ad", items: [] });
  };
  const item = (label3, hintText, fn) => {
    if (GROUPS.length) GROUPS[GROUPS.length - 1].items.push({ label: label3, hint: hintText, fn });
  };
  const arcChip = (label3, hint2, tint, on, fn) => {
    const b = document.createElement("button");
    b.innerHTML = '<span style="font:800 9px/1 ui-monospace,monospace;letter-spacing:.12em">' + label3 + "</span>" + (hint2 ? '<span style="display:block;font:500 8px/1.25 system-ui,sans-serif;color:#8d9aa5;margin-top:3px;max-width:104px;white-space:normal">' + hint2 + "</span>" : "");
    b.style.cssText = "flex:0 0 auto;text-align:left;border-radius:10px;cursor:pointer;padding:8px 10px;background:" + (on ? "rgba(255,255,255,.12)" : "rgba(10,14,18,.92)") + ";border:1px solid " + (on ? tint : "rgba(151,187,213,.22)") + ";color:" + (on ? tint : "#cfe8dd") + ";backdrop-filter:blur(12px);transition:transform .12s,background .12s;transform-origin:50% 120%;";
    b.addEventListener("click", fn);
    return b;
  };
  const openKeyPanel = () => {
    const el = document.getElementById("setup");
    if (!el) return flash("no key panel in this build");
    el.hidden = false;
    el.classList.add("show");
    const done = document.getElementById("setupDone");
    const close = document.getElementById("setupClose");
    const hide2 = () => {
      el.classList.remove("show");
      el.hidden = true;
      try {
        paintKey();
      } catch (_) {
      }
    };
    if (done) done.onclick = hide2;
    if (close) close.onclick = hide2;
    setTimeout(() => {
      const k = document.getElementById("setupKey");
      if (k) k.focus();
    }, 60);
    flash("paste a key \u2014 it stays in this browser");
  };
  BUS.register(
    "key",
    (t) => /^(key|api key|add a key|sign in)\b/.test(t),
    () => {
      openKeyPanel();
      return "the key panel is open \u2014 it stays in this browser";
    },
    "key \u2014 where the AI features are switched on"
  );
  const paintArc = () => {
    subjects.textContent = "";
    for (const g of GROUPS) {
      subjects.appendChild(arcChip(g.name.toUpperCase(), "", g.tint, g === current, () => {
        current = g === current ? null : g;
        paintArc();
      }));
    }
    verbs.textContent = "";
    verbs.style.display = current ? "flex" : "none";
    if (current) {
      for (const it of current.items) {
        verbs.appendChild(arcChip(it.label, it.hint, current.tint, false, () => {
          it.fn();
          menu.style.display = "none";
          markOpen();
        }));
      }
    }
    curveChips(subjects);
    if (current) curveChips(verbs);
  };
  const speak = (text) => flash(BUS.dispatch(text, { S: S3, RIG }) || "\u2026");
  section("place", "#6fe0c0");
  item("PLACES", "everywhere in this browser", () => {
    const c = document.getElementById("placeChip");
    if (c) c.click();
  });
  item("LAND ANYWHERE", "real ground \u2014 land <place>", () => {
    mi = 3;
    paintMode();
    inp.value = "land ";
    inp.focus();
  });
  item("GO TO", "fly to a building by name \u2014 G", () => key("g"));
  item("AERIAL", "the real photograph, on / off", () => speak(IMAGERY2.on ? "aerial off" : "aerial"));
  section("build", "#ffd9a8");
  item("TESTIFY", "plant a standing note here", () => {
    mi = 2;
    paintMode();
    inp.value = "note: ";
    inp.focus();
  });
  item("DRAW AN AREA", "a loop becomes a region \u2014 D", () => key("d"));
  item("UNSETTLE", "the alternative arrangement \u2014 a branch", () => speak("unsettle"));
  item("RESETTLE", "the given returns, remembered", () => speak("resettle"));
  item("UNDO", "the world remembers", () => key("z"));
  item("REDO", "put it back", () => {
    const r = document.getElementById("redoBtn");
    if (r) r.click();
  });
  item("EXPORT", "take the place away \u2014 GeoJSON", () => click("exportBtn"));
  item("YOUR NAME", "who changed what", () => {
    const a = document.getElementById("authorChip");
    if (a) a.click();
  });
  section("view", "#9ec9ff");
  item("LABELS", "name tags, on / off", () => speak(S3.labels === false ? "labels on" : "labels off"));
  item("MAP", "stow the ring \u2014 M", () => speak(document.body.classList.contains("ring-stowed") ? "map on" : "map off"));
  item("ENGINE", "the motor drone \u2014 off by default", () => speak(engineSoundOn() ? "sound off" : "sound on"));
  item("EFFECTS", "shots, hits, crashes \u2014 on", () => {
    const on = setEffects(!effectsOn());
    flash(on ? "effects on \u2014 shots and crashes speak" : "effects off");
  });
  item("FILM MODE", "a clean frame for recording \u2014 H", () => film(true));
  item("CREO PANELS", "the editor instruments, on / off", () => {
    cockpitOn = !cockpitOn;
    cockpit(cockpitOn);
    flash(cockpitOn ? "cockpit \u2014 the instruments are stowed" : "the editor instruments are out");
  });
  item("HELP", "every verb the commons knows", () => speak("help"));
  if (hasKey()) {
    section("ask", "#d8c9ff");
    item("PROPOSE A TOWER", "a watchtower on this spot", () => say("a watchtower here"));
    item("DOES IT FLOOD?", "run the water over this ground", () => say("does this flood?"));
    item("THE KEY", "change or remove it \u2014 stays in this browser", () => openKeyPanel());
  } else {
    section("ask", "#d8c9ff");
    item("ADD A KEY", "switch on the thinking \u2014 Anthropic or OpenAI", () => openKeyPanel());
  }
  document.body.appendChild(menu);
  burger.addEventListener("click", () => {
    const opening = menu.style.display === "none" || !menu.style.display;
    if (opening) paintArc();
    menu.style.display = opening ? "flex" : "none";
    markOpen();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.style.display = "none";
      markOpen();
    }
  });
  addEventListener("pointerdown", (e) => {
    if (menu.style.display === "flex" && !menu.contains(e.target) && e.target !== burger) {
      menu.style.display = "none";
      markOpen();
    }
  }, true);
  const rail = document.createElement("div");
  rail.id = "build-rail";
  rail.style.cssText = "position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:63;display:flex;flex-direction:column;align-items:center;width:min(560px,92vw);";
  const railBtn = document.createElement("button");
  railBtn.textContent = "\u229E";
  railBtn.title = "the parts palette \u2014 ramps, blocks, a house, a note (B)";
  railBtn.style.cssText = "flex:0 0 auto;width:32px;height:32px;border-radius:9px;cursor:pointer;border:1px solid rgba(255,180,80,.4);background:rgba(28,19,8,.86);color:#ffd9a8;font:700 15px/1 ui-monospace,monospace;";
  const palette = document.createElement("div");
  palette.style.cssText = "display:none;flex-direction:row;gap:5px;width:100%;overflow-x:auto;overflow-y:visible;scrollbar-width:none;padding:8px 10px 12px;background:rgba(10,14,18,.95);border:1px solid rgba(151,187,213,.25);border-radius:0 0 20px 20px;backdrop-filter:blur(12px);box-shadow:0 12px 34px rgba(0,0,0,.55);mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);";
  const paletteBtn = (label3, title, utter) => {
    const b = document.createElement("button");
    b.textContent = label3;
    b.title = title;
    b.style.cssText = "flex:0 0 auto;padding:9px 12px;border-radius:10px;cursor:pointer;border:1px solid rgba(151,187,213,.22);background:rgba(255,255,255,.04);color:#cfe8dd;font:800 8px/1 ui-monospace,monospace;letter-spacing:.1em;transform-origin:50% 140%;";
    b.addEventListener("mouseenter", () => {
      b.style.background = "rgba(255,180,80,.18)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "rgba(255,255,255,.04)";
    });
    b.addEventListener("click", () => speak(utter));
    palette.appendChild(b);
    return b;
  };
  for (const k of Object.keys(PARTS)) paletteBtn(PARTS[k].name.toUpperCase(), PARTS[k].hint, "a " + k);
  paletteBtn("HOUSE", "a massed house, gate willing", "a house");
  paletteBtn("NOTE", "plant testimony here", "note: I was here");
  paletteBtn("UNDO", "the world remembers", "undo");
  const markOpen = () => document.body.classList.toggle(
    "menu-open",
    palette.style.display !== "none" || menu.style.display === "flex"
  );
  const showPalette = (on) => {
    palette.style.display = on ? "flex" : "none";
    if (on) requestAnimationFrame(() => curveChips(palette));
    railBtn.style.background = on ? "rgba(255,180,80,.26)" : "rgba(28,19,8,.86)";
    markOpen();
  };
  railBtn.addEventListener("click", () => showPalette(palette.style.display === "none"));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") showPalette(false);
    if ((e.key === "b" || e.key === "B") && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
      showPalette(palette.style.display === "none");
    }
  });
  rail.append(palette);
  document.body.appendChild(rail);
  bar.insertBefore(railBtn, burger);
  BUS.register("undo", (t) => /^undo\b/.test(t), () => {
    key("z");
    return "undone";
  }, "undo \u2014 take the last deed back");
  BUS.register(
    "rail",
    (t) => /^rail\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|hide|no)\b/.test(raw.toLowerCase());
      rail.style.display = off ? "none" : "grid";
      return off ? "rail stowed" : "rail out";
    },
    "rail off / on \u2014 the build chips"
  );
  return { bar, menu, flash };
}

// src/ui/door.js
var KEY = "terrarium.door";
var SWATCHES2 = [
  ["teal", [0.1, 0.88, 0.76]],
  ["ember", [1, 0.32, 0.2]],
  ["amber", [1, 0.8, 0.25]],
  ["violet", [0.66, 0.48, 0.92]],
  ["bone", [0.94, 0.95, 0.96]],
  ["coal", [0.12, 0.13, 0.16]]
];
function mountDoor(S3, enterWorld) {
  const waitThen = (fn) => {
    const t = setInterval(() => {
      if (S3.world && S3.world.place && S3.cam) {
        clearInterval(t);
        fn();
      }
    }, 250);
  };
  let remembered = null;
  try {
    remembered = localStorage.getItem(KEY);
  } catch (_) {
  }
  if (remembered) {
    waitThen(enterWorld);
    return null;
  }
  const veil = document.createElement("div");
  veil.id = "terrarium-door";
  veil.style.cssText = "position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(6,9,12,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);";
  const card = document.createElement("div");
  card.style.cssText = "width:min(430px,92vw);background:rgba(12,17,22,.97);border:1px solid rgba(151,187,213,.3);border-radius:16px;padding:26px 28px;color:#e8edf2;font:500 13px/1.5 system-ui,-apple-system,sans-serif;";
  card.innerHTML = '<div style="font:800 10px/1 ui-monospace,monospace;letter-spacing:.34em;color:#6fe0c0">HELLO, WORLD</div><div style="font:800 22px/1.2 ui-monospace,monospace;margin:10px 0 2px">TERRARIUM</div><div id="door-place" style="color:#8d9aa5;font:600 10px/1.4 ui-monospace,monospace;letter-spacing:.08em">finding the ground\u2026</div><div style="margin:16px 0 6px;color:#8d9aa5;font-size:11px">Name your rig. It will carry your deeds.</div>';
  const nameInp = document.createElement("input");
  nameInp.placeholder = "rig name";
  nameInp.value = "WANDERER";
  nameInp.style.cssText = "width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);color:#e8edf2;border:1px solid rgba(151,187,213,.3);border-radius:9px;padding:9px 11px;outline:0;font:700 12px/1 ui-monospace,monospace;letter-spacing:.12em;";
  card.appendChild(nameInp);
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;margin:12px 0 18px;";
  let chosen = SWATCHES2[0][1];
  for (const [label3, rgb] of SWATCHES2) {
    const b = document.createElement("button");
    b.title = label3;
    b.style.cssText = "width:30px;height:30px;border-radius:50%;cursor:pointer;border:2px solid transparent;background:rgb(" + rgb.map((v) => Math.round(v * 255)).join(",") + ");";
    if (label3 === "teal") b.style.borderColor = "#fff";
    b.addEventListener("click", () => {
      chosen = rgb;
      for (const o of row.children) o.style.borderColor = "transparent";
      b.style.borderColor = "#fff";
    });
    row.appendChild(b);
  }
  card.appendChild(row);
  const go = document.createElement("button");
  go.textContent = "ENTER THE TERRARIUM";
  go.style.cssText = "width:100%;padding:12px;border:0;border-radius:10px;cursor:pointer;background:#df5a5d;color:#fff;font:800 11px/1 ui-monospace,monospace;letter-spacing:.22em;";
  card.appendChild(go);
  const fine = document.createElement("div");
  fine.style.cssText = "margin-top:12px;color:#5d6b75;font-size:10px;line-height:1.5;";
  fine.textContent = "Entering is a deed: the world will remember what you build, say and unsettle here.";
  card.appendChild(fine);
  veil.appendChild(card);
  document.body.appendChild(veil);
  const intro = setInterval(() => {
    const nm = S3.world?.place?.name;
    if (nm) {
      clearInterval(intro);
      card.querySelector("#door-place").textContent = "you are at " + nm.toUpperCase();
    }
  }, 250);
  go.addEventListener("click", () => {
    RIG.color = chosen;
    RIG.name = (nameInp.value || "WANDERER").trim().slice(0, 24);
    try {
      localStorage.setItem(KEY, JSON.stringify({ name: RIG.name, at: (/* @__PURE__ */ new Date()).toISOString() }));
    } catch (_) {
    }
    clearInterval(intro);
    veil.remove();
    waitThen(enterWorld);
  });
  return veil;
}

// src/ui/ring.js
var SIZE = 244;
var C = SIZE / 2;
var RI = 82;
var RO = 118;
var RAD2 = Math.PI / 180;
var arc = (a0, a1) => {
  const p = (a, r) => [C + Math.cos(a * RAD2) * r, C + Math.sin(a * RAD2) * r];
  const [x0, y0] = p(a0, RO), [x1, y1] = p(a1, RO);
  const [x2, y2] = p(a1, RI), [x3, y3] = p(a0, RI);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${RO} ${RO} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${RI} ${RI} 0 ${big} 0 ${x3} ${y3}Z`;
};
var label = (a, r) => [C + Math.cos(a * RAD2) * r, C + Math.sin(a * RAD2) * r + 3];
var SEGMENTS = [
  { key: "boost", label: "BOOST", a0: 148, a1: 186, colour: "#ff5f5f", at: label(167, 100) },
  { key: "jump", label: "JUMP", a0: 190, a1: 228, colour: "#e8eef2", at: label(209, 100) },
  { key: "fire", label: "FIRE", a0: 232, a1: 270, colour: "#19e6c8", at: label(251, 100) },
  { key: "dismount", label: "EJECT", a0: 62, a1: 140, colour: "#9fb4ad", at: label(101, 100) }
];
var MAP_OPS = [
  { glyph: "+", title: "closer", at: -70, id: "planIn" },
  { glyph: "\u2212", title: "wider", at: -46, id: "planOut" },
  { glyph: "\u26F6", title: "MAXIMISE the map \u2014 tap a neighbour to travel", at: -22, max: true },
  { glyph: "\u2295", title: "fetch neighbouring ground (X)", at: 2, id: "exploreBtn" },
  { glyph: "\u2922", title: "frame the whole place (F)", at: 26, key: "f" }
];
function mountRing(S3) {
  if (document.getElementById("rig-ring")) return null;
  const plan2 = document.getElementById("plan");
  if (!plan2) return null;
  const css = document.createElement("style");
  css.textContent = `
    #rig-ring { position: fixed; right: 14px; bottom: 58px; width: ${SIZE}px; height: ${SIZE}px;
      z-index: 61; transition: opacity .18s, transform .18s; }
    #rig-ring svg { position: absolute; inset: 0; overflow: visible; }
    #rig-ring .seg { cursor: pointer; fill: rgba(10,14,18,.82); stroke: rgba(151,187,213,.22);
      stroke-width: 1; transition: fill .12s; }
    #rig-ring .seg:hover, #rig-ring .seg.down { fill: rgba(255,255,255,.10); }
    #rig-ring text { font: 800 9px/1 ui-monospace, monospace; letter-spacing: .12em;
      text-anchor: middle; dominant-baseline: middle; pointer-events: none; }
    #rig-ring .mapop { position: absolute; transform: translate(-50%, -50%);
      width: 26px; height: 26px; border-radius: 50%; cursor: pointer; padding: 0;
      border: 1px solid rgba(151,187,213,.3); background: rgba(10,14,18,.9); color: #cfe8dd;
      font: 700 13px/1 ui-monospace, monospace; }
    #rig-ring .mapop:hover { background: rgba(255,255,255,.14); }
    /* the map, round, in the middle \u2014 CREO's own plan, moved not rebuilt */
    #rig-ring #plan { position: absolute !important; left: ${C - 74}px !important; top: ${C - 74}px !important;
      right: auto !important; bottom: auto !important; width: 148px !important; height: 148px !important;
      border-radius: 50% !important; overflow: hidden !important;
      border: 2px solid rgba(180,200,210,.5) !important; box-shadow: 0 6px 22px rgba(0,0,0,.5);
      background: rgba(8,11,14,.9) !important; }
    #rig-ring #plan #planCanvas { width: 100% !important; height: 100% !important; }
    /* the plan's own tool buttons are not cockpit controls; the ring is */
    #rig-ring #plan > button { display: none !important; }
    /* THE CONTROLS ARE NEVER TAKEN AWAY. An earlier pass had the ring fade to
       12% whenever a menu opened \u2014 which solved the overlap by disabling the
       thing you steer with. Wrong trade: nothing may cover the ring and
       nothing may switch it off, so the MENUS moved instead (they drop from
       the line, see console.js) and the ring stays lit and live. */
    body.ring #rig-actions, body.ring #rig-dock { display: none !important; }
    body.ring-stowed #rig-ring { transform: scale(.34); opacity: .5; transform-origin: 82% 82%; }
    body.ring-stowed #rig-ring:hover { opacity: .9; }
    body.film #rig-ring { display: none !important; }
    body.map-max #rig-ring #plan {
      position: fixed !important; left: 50% !important; top: 50% !important;
      width: min(72vmin, 620px) !important; height: min(72vmin, 620px) !important;
      transform: translate(-50%, -50%) !important; z-index: 70 !important;
      border-width: 3px !important; box-shadow: 0 22px 70px rgba(0,0,0,.7);
    }
    body.map-max #rig-ring #plan > button { display: flex !important; }
    @media (max-width: 560px) { #rig-ring { transform: scale(.86); transform-origin: 100% 100%; } }
  `;
  document.head.appendChild(css);
  const ring3 = document.createElement("div");
  ring3.id = "rig-ring";
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("width", SIZE);
  svg.setAttribute("height", SIZE);
  for (const seg of SEGMENTS) {
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", arc(seg.a0, seg.a1));
    path.setAttribute("class", "seg");
    const act = () => {
      if (seg.key === "dismount") {
        try {
          document.activeElement && document.activeElement.blur();
        } catch (_) {
        }
        dispatchEvent(new KeyboardEvent("keydown", { key: "v" }));
      } else press(seg.key);
    };
    path.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      path.classList.add("down");
      act();
    });
    path.addEventListener("pointerup", () => path.classList.remove("down"));
    path.addEventListener("pointerleave", () => path.classList.remove("down"));
    svg.appendChild(path);
    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", seg.at[0]);
    text.setAttribute("y", seg.at[1]);
    text.setAttribute("fill", seg.colour);
    text.textContent = seg.label;
    svg.appendChild(text);
  }
  const n = document.createElementNS(svgNS, "path");
  const ny = C - 70;
  n.setAttribute("d", `M${C} ${ny - 7}L${C + 5} ${ny + 4}L${C} ${ny + 1}L${C - 5} ${ny + 4}Z`);
  n.setAttribute("fill", "#e86a4e");
  svg.appendChild(n);
  const nt = document.createElementNS(svgNS, "text");
  nt.setAttribute("x", C);
  nt.setAttribute("y", ny + 13);
  nt.setAttribute("fill", "rgba(232,238,242,.75)");
  nt.setAttribute("style", "font:800 8px/1 ui-monospace,monospace;letter-spacing:.1em");
  nt.textContent = "N";
  svg.appendChild(nt);
  ring3.appendChild(svg);
  for (const op of MAP_OPS) {
    const b = document.createElement("button");
    b.textContent = op.glyph;
    b.title = op.title;
    b.className = "mapop";
    const [x, y] = [C + Math.cos(op.at * RAD2) * 100, C + Math.sin(op.at * RAD2) * 100];
    b.style.left = x + "px";
    b.style.top = y + "px";
    b.addEventListener("click", (e) => {
      e.preventDefault();
      if (op.max) {
        maximise(!document.body.classList.contains("map-max"));
        return;
      }
      const target = op.id && document.getElementById(op.id);
      if (target) target.click();
      else if (op.key) dispatchEvent(new KeyboardEvent("keydown", { key: op.key, bubbles: true }));
      try {
        window.TERRA && window.TERRA.redrawPlan && window.TERRA.redrawPlan();
      } catch (_) {
      }
      if (window.TERRA && window.TERRA.S) window.TERRA.S.dirty = true;
    });
    ring3.appendChild(b);
  }
  const speed = document.createElement("div");
  speed.id = "ring-speed";
  speed.style.cssText = "position:absolute;left:0;right:0;top:" + (C + 58) + "px;text-align:center;font:700 9px/1 ui-monospace,monospace;letter-spacing:.14em;color:#8fb8a8;pointer-events:none;";
  speed.textContent = "0 km/h";
  ring3.appendChild(speed);
  document.body.appendChild(ring3);
  ring3.appendChild(plan2);
  plan2.hidden = false;
  document.body.classList.add("ring");
  ring3.addEventListener("wheel", (e) => {
    const b = document.getElementById(e.deltaY > 0 ? "planOut" : "planIn");
    if (b) {
      e.preventDefault();
      b.click();
    }
  }, { passive: false });
  setInterval(() => {
    const s = document.querySelector("#rig-dock span");
    if (s) speed.textContent = s.textContent;
  }, 250);
  const maximise = (on) => {
    document.body.classList.toggle("map-max", on);
    try {
      window.TERRA && window.TERRA.redrawPlan && window.TERRA.redrawPlan();
    } catch (_) {
    }
    setTimeout(() => {
      try {
        window.TERRA.redrawPlan();
      } catch (_) {
      }
    }, 60);
  };
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("map-max")) maximise(false);
  });
  BUS.register(
    "maximise",
    (t) => /^(maximi[sz]e|big map|expand map)\b/.test(t),
    () => {
      maximise(!document.body.classList.contains("map-max"));
      return "the map fills the frame \u2014 tap a neighbour, or Escape";
    },
    "maximise \u2014 the map big, for choosing where to go"
  );
  const stow = (on) => {
    document.body.classList.toggle("ring-stowed", on);
    try {
      localStorage.setItem("terrarium.ring", on ? "stowed" : "out");
    } catch (_) {
    }
  };
  try {
    if (localStorage.getItem("terrarium.ring") === "stowed") stow(true);
  } catch (_) {
  }
  BUS.register(
    "map",
    (t) => /^(map|ring|plan)\b/.test(t),
    (m, ctx, raw) => {
      const off = /\b(off|hide|stow|no)\b/.test(raw.toLowerCase());
      stow(off);
      return off ? "the ring is stowed \u2014 say map on to bring it back" : "the ring is out";
    },
    "map off / on \u2014 stow the control ring"
  );
  addEventListener("keydown", (e) => {
    if ((e.key === "m" || e.key === "M") && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
      stow(!document.body.classList.contains("ring-stowed"));
    }
  });
  return { ring: ring3, stow };
}

// src/import/geocode.js
var NOMINATIM = "https://nominatim.openstreetmap.org";
var UA = "CREO/0.1 (place import; github.com/hartswf0/motor)";
var MIN_GAP_MS = 1100;
var lastCall = 0;
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function polite(url, fetchImpl) {
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  return res.json();
}
function bboxMetres(bbox2) {
  const [s, w, n, e] = bbox2;
  const mid = (s + n) / 2 * (Math.PI / 180);
  return {
    height: (n - s) * 111320,
    width: (e - w) * 111320 * Math.cos(mid)
  };
}
function windowAround(bbox2, metres = 900) {
  const [s, w, n, e] = bbox2;
  const lat = (s + n) / 2, lon = (w + e) / 2;
  const dLat = metres / 2 / 111320;
  const dLon = metres / 2 / (111320 * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
}
async function geocode(query, { limit = 5, fetchImpl = fetch } = {}) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=${limit}&addressdetails=1&polygon_geojson=0`;
  const results = await polite(url, fetchImpl);
  return results.map((r) => {
    const bb = r.boundingbox.map(Number);
    const bbox2 = [bb[0], bb[2], bb[1], bb[3]];
    const span = bboxMetres(bbox2);
    const a = r.address || {};
    return {
      name: r.display_name,
      short: [
        a.neighbourhood || a.suburb || a.village || a.town || a.city_district || r.name,
        a.city || a.county,
        a.country
      ].filter(Boolean).join(", ") || r.display_name,
      bbox: bbox2,
      lat: Number(r.lat),
      lon: Number(r.lon),
      kind: `${r.category}/${r.type}`,
      importance: r.importance,
      span: { width: Math.round(span.width), height: Math.round(span.height) },
      osm: r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : null
    };
  });
}
function parseCoordinates(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const at = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || raw.match(/[?&](?:q|ll|center|mlat)=(-?\d+(?:\.\d+)?)[,%2C]+\s*(-?\d+(?:\.\d+)?)/i) || raw.match(/^geo:(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (at) return finish(Number(at[1]), Number(at[2]), "a map link");
  const dms = /(\d+(?:\.\d+)?)\s*[°d:]\s*(?:(\d+(?:\.\d+)?)\s*['′m:]\s*)?(?:(\d+(?:\.\d+)?)\s*["″s]?\s*)?([NSEW])/gi;
  const found = [...raw.matchAll(dms)];
  if (found.length === 2) {
    const val = (m) => {
      const deg = Number(m[1]) + Number(m[2] || 0) / 60 + Number(m[3] || 0) / 3600;
      return /[SW]/i.test(m[4]) ? -deg : deg;
    };
    const a = { v: val(found[0]), ns: /[NS]/i.test(found[0][4]) };
    const b = { v: val(found[1]), ns: /[NS]/i.test(found[1][4]) };
    const lat = a.ns ? a.v : b.v, lon = a.ns ? b.v : a.v;
    return finish(lat, lon, "degrees, minutes and seconds");
  }
  const dec = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[,;\s]+\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i);
  if (dec) {
    let lat = Number(dec[1]), lon = Number(dec[3]);
    if (dec[2] && /S/i.test(dec[2])) lat = -Math.abs(lat);
    if (dec[4] && /W/i.test(dec[4])) lon = -Math.abs(lon);
    if (dec[2] && /[EW]/i.test(dec[2])) return finish(lon, lat, "decimal degrees");
    return finish(lat, lon, "decimal degrees");
  }
  return null;
}
function finish(lat, lon, how) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    lat,
    lon,
    how,
    label: `${Math.abs(lat).toFixed(5)}\xB0${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(5)}\xB0${lon < 0 ? "W" : "E"}`
  };
}
function coordinatePlace(at, metres = 900) {
  const dLat = metres / 2 / 111320;
  const dLon = metres / 2 / (111320 * Math.max(0.05, Math.cos(at.lat * Math.PI / 180)));
  const bbox2 = [at.lat - dLat, at.lon - dLon, at.lat + dLat, at.lon + dLon];
  return {
    name: at.label,
    short: at.label,
    bbox: bbox2,
    lat: at.lat,
    lon: at.lon,
    kind: "coordinate/point",
    importance: 1,
    span: { width: Math.round(metres), height: Math.round(metres) },
    osm: null,
    windowed: true,
    coordinate: at,
    why: `${at.label} \u2014 read as ${at.how}, ${metres} m around it`,
    alternatives: []
  };
}
async function resolvePlace(query, { metres = 900, fetchImpl = fetch } = {}) {
  const at = parseCoordinates(query);
  if (at) return coordinatePlace(at, metres);
  const hits = await geocode(query, { fetchImpl });
  if (!hits.length) throw new Error(`nothing found for \u201C${query}\u201D`);
  const best = hits[0];
  const tooBig = best.span.width > metres * 1.6 || best.span.height > metres * 1.6;
  const tooSmall = best.span.width < metres * 0.25 && best.span.height < metres * 0.25;
  return {
    ...best,
    bbox: tooBig || tooSmall ? windowAround(best.bbox, metres) : best.bbox,
    windowed: tooBig || tooSmall,
    why: tooBig ? `${best.short} is ${best.span.width}\xD7${best.span.height} m \u2014 larger than one place; taking a ${metres} m window at its centre` : tooSmall ? `${best.short} is only ${best.span.width}\xD7${best.span.height} m \u2014 taking a ${metres} m window around it` : null,
    alternatives: hits.slice(1)
  };
}

// src/ui/perf.js
var marks = /* @__PURE__ */ new Map();
var loads = [];
var warnOver = 0;
function note(label3, ms) {
  let m = marks.get(label3);
  if (!m) {
    m = { n: 0, total: 0, max: 0, last: 0 };
    marks.set(label3, m);
  }
  m.n++;
  m.total += ms;
  m.last = ms;
  if (ms > m.max) m.max = ms;
  if (warnOver && ms > warnOver) console.warn("[perf] " + label3 + " " + ms.toFixed(1) + "ms");
}
function wrap(obj, method, label3) {
  if (!obj || typeof obj[method] !== "function" || obj[method].__perf) return false;
  const orig = obj[method];
  const f2 = function(...a) {
    const t0 = performance.now();
    try {
      return orig.apply(this, a);
    } finally {
      note(label3 || method, performance.now() - t0);
    }
  };
  f2.__perf = true;
  obj[method] = f2;
  return true;
}
function watchFetch() {
  if (typeof window === "undefined" || window.fetch.__perf) return;
  const of = window.fetch;
  const f2 = function(...a) {
    const url = String(a[0] && a[0].url ? a[0].url : a[0]).slice(0, 120);
    const t0 = performance.now();
    return of.apply(this, a).then(async (r) => {
      const ms = performance.now() - t0;
      let kb = 0;
      try {
        kb = +(+(r.headers.get("content-length") || 0) / 1024).toFixed(1);
      } catch (_) {
      }
      loads.push({ url, ms: +ms.toFixed(0), kb, at: (/* @__PURE__ */ new Date()).toLocaleTimeString() });
      note("fetch", ms);
      if (ms > 400) console.warn("[perf] slow fetch " + ms.toFixed(0) + "ms " + url);
      return r;
    });
  };
  f2.__perf = true;
  window.fetch = f2;
}
var PERF = {
  wrap,
  note,
  /** Instrument the parts we actually suspect. Safe to call more than once. */
  install({ renderer: renderer2, world, app } = {}) {
    watchFetch();
    if (renderer2) {
      wrap(renderer2, "build", "renderer.build");
      wrap(renderer2, "draw", "renderer.draw");
    }
    if (world) {
      wrap(world, "reindex", "world.reindex");
      wrap(world, "addEntity", "world.addEntity");
      wrap(world, "removeEntity", "world.removeEntity");
    }
    if (app) for (const [o, m, l] of app) wrap(o, m, l);
    return this;
  },
  watch(ms = 120) {
    warnOver = ms;
    console.info("[perf] warning on anything over " + ms + "ms");
    return this;
  },
  reset() {
    marks.clear();
    loads.length = 0;
    return this;
  },
  loads() {
    console.table(loads.slice(-40));
    return loads.length + " fetches";
  },
  report() {
    const rows = [...marks.entries()].map(([label3, m]) => ({
      label: label3,
      calls: m.n,
      "mean ms": +(m.total / m.n).toFixed(1),
      "worst ms": +m.max.toFixed(1),
      "last ms": +m.last.toFixed(1),
      "total ms": +m.total.toFixed(0)
    })).sort((a, b) => b["total ms"] - a["total ms"]);
    console.table(rows);
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) console.info("[perf] page: dom " + nav.domContentLoadedEventEnd.toFixed(0) + "ms \xB7 load " + nav.loadEventEnd.toFixed(0) + "ms");
    return rows.length ? "worst total: " + rows[0].label : "nothing measured yet";
  }
};
if (typeof window !== "undefined") {
  window.PERF = PERF;
  addEventListener("keydown", (e) => {
    if ((e.key === "p" || e.key === "P") && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) PERF.report();
  });
}

// src/core/place.js
function makeEntity(props) {
  return {
    id: props.id,
    type: props.type,
    // structure | room | road | path | rail | drain | water | tree | surface | region | parcel | observation | marker | opening | wall | furniture …
    name: props.name || null,
    footprint: props.footprint || null,
    // [[x,y], …] closed ring, metres
    path: props.path || null,
    // [[x,y], …] open polyline, metres
    width: props.width ?? null,
    // for path-like entities
    zBase: props.zBase ?? 0,
    // metres above local datum
    zTop: props.zTop ?? (props.zBase ?? 0),
    // vertical interval, not a bounding box
    parent: props.parent || null,
    children: props.children || [],
    // semantics
    subtype: props.subtype || null,
    use: props.use || null,
    material: props.material || null,
    network: props.network || null,
    // 'streets' | 'paths' | 'drainage' | …
    nodes: props.nodes || null,
    // network endpoints [aId, bId]
    // epistemics + provenance (§19: every object can answer "why are you here?")
    epistemic: props.epistemic || "IMPORTED",
    certainty: props.certainty ?? 1,
    source: props.source || "seed",
    author: props.author || "system",
    createdBy: props.createdBy || null,
    // event id
    createdAt: props.createdAt ?? 0,
    // logical tick, never wall clock
    evidence: props.evidence || [],
    // {kind:'utterance'|'photo'|'measure'|'sim', …}
    // world state
    status: props.status || "ACTIVE",
    // ACTIVE | GHOST | REMOVED | ARCHIVED
    branch: props.branch || "AS_IS",
    collision: props.collision || "solid",
    // solid | soft | none
    sim: props.sim || {},
    // permeability, roughness, capacity …
    tags: props.tags || [],
    style: props.style || null,
    // free-form but declared
    props: props.props || {}
  };
}
function formatId(type, n) {
  return `${type}_${n.toString(36).padStart(3, "0")}`;
}
function makeBranch(id, { name, parent = null, note: note2 = "", author = "system", createdAt = 0 }) {
  return { id, name: name || id, parent, note: note2, author, createdAt, status: "OPEN" };
}
var Place = class _Place {
  constructor({ id = "place", name = "Place", anchor = [0, 0], seed = 1 } = {}) {
    this.id = id;
    this.name = name;
    this.seed = seed;
    this.projection = makeProjection(anchor[0], anchor[1]);
    this.entities = /* @__PURE__ */ new Map();
    this.overlays = /* @__PURE__ */ new Map();
    this.branches = /* @__PURE__ */ new Map();
    this.relations = [];
    this.terrain = null;
    this.tick = 0;
    this.landmarks = /* @__PURE__ */ new Map();
    this.uid = 0;
    this.meta = null;
    const root = makeBranch("AS_IS", { name: "As it is" });
    this.branches.set("AS_IS", root);
    this.overlays.set("AS_IS", /* @__PURE__ */ new Map());
    this.activeBranch = "AS_IS";
  }
  /** Next id for this place. Deterministic per place, unique within it. */
  newId(type) {
    return formatId(type, ++this.uid);
  }
  // ------------------------------------------------------------- branches ---
  branchChain(branchId = this.activeBranch) {
    const chain = [];
    let b = this.branches.get(branchId);
    while (b) {
      chain.unshift(b.id);
      b = b.parent ? this.branches.get(b.parent) : null;
    }
    return chain;
  }
  createBranch(id, opts) {
    const b = makeBranch(id, { parent: opts.parent ?? this.activeBranch, ...opts });
    this.branches.set(id, b);
    this.overlays.set(id, /* @__PURE__ */ new Map());
    return b;
  }
  setActiveBranch(id) {
    if (!this.branches.has(id)) throw new Error(`no branch ${id}`);
    this.activeBranch = id;
  }
  // ------------------------------------------------------------- entities ---
  /** Resolve an entity as seen from a branch (overlay chain, nearest wins). */
  get(id, branchId = this.activeBranch) {
    const chain = this.branchChain(branchId);
    for (let i = chain.length - 1; i >= 0; i--) {
      const ov = this.overlays.get(chain[i]);
      if (ov && ov.has(id)) {
        const e = ov.get(id);
        return e === null ? null : e;
      }
    }
    return this.entities.get(id) || null;
  }
  /** Every visible entity in a branch, base + overlays, removals applied. */
  all(branchId = this.activeBranch) {
    const chain = this.branchChain(branchId);
    const out = new Map(this.entities);
    for (const bid of chain) {
      const ov = this.overlays.get(bid);
      if (!ov) continue;
      for (const [id, e] of ov) {
        if (e === null) out.delete(id);
        else out.set(id, e);
      }
    }
    const list = [];
    for (const e of out.values()) if (e.status !== "REMOVED" && e.status !== "ARCHIVED") list.push(e);
    return list;
  }
  /** Write an entity into a branch overlay (AS_IS writes to the base map). */
  put(entity, branchId = this.activeBranch) {
    if (!entity || typeof entity.id !== "string" || !entity.id) {
      throw new Error(`cannot store an entity without an id (type ${entity?.type})`);
    }
    if (branchId === "AS_IS") this.entities.set(entity.id, entity);
    else this.overlays.get(branchId).set(entity.id, entity);
    return entity;
  }
  remove(id, branchId = this.activeBranch) {
    if (branchId === "AS_IS") {
      const e = this.entities.get(id);
      if (e) this.entities.set(id, { ...e, status: "REMOVED" });
    } else {
      this.overlays.get(branchId).set(id, null);
    }
  }
  byType(type, branchId = this.activeBranch) {
    return this.all(branchId).filter((e) => e.type === type);
  }
  // ------------------------------------------------------------ relations ---
  relate(from, kind, to, meta = {}) {
    this.relations.push({ from, kind, to, derived: false, ...meta });
  }
  relationsOf(id) {
    return this.relations.filter((r) => r.from === id || r.to === id);
  }
  clearDerivedRelations() {
    this.relations = this.relations.filter((r) => !r.derived);
  }
  // -------------------------------------------------------------- geometry --
  /** Working ring for any entity — path-like entities are buffered to their width. */
  ringOf(e) {
    if (e.footprint) return e.footprint;
    if (e.path) return bufferPolyline(e.path, (e.width || 2) / 2);
    return null;
  }
  groundAt(x, y) {
    return this.terrain ? this.terrain.heightAt(x, y) : 0;
  }
  bounds(branchId = this.activeBranch) {
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const e of this.all(branchId)) {
      const ring3 = this.ringOf(e);
      if (!ring3) continue;
      const b = bbox(ring3);
      bb = [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])];
    }
    if (!isFinite(bb[0])) return this.terrain ? this.terrain.bounds : [-50, -50, 50, 50];
    return bb;
  }
  // ------------------------------------------------------- serialisation ----
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      seed: this.seed,
      tick: this.tick,
      anchor: this.projection.anchor,
      activeBranch: this.activeBranch,
      terrain: this.terrain ? this.terrain.toJSON() : null,
      entities: [...this.entities.values()],
      overlays: [...this.overlays.entries()].map(([bid, m]) => [bid, [...m.entries()]]),
      branches: [...this.branches.values()],
      relations: this.relations,
      landmarks: [...this.landmarks.entries()],
      // Where this place came from and under what licence travels WITH it.
      // Losing it on save would strip the attribution ODbL requires.
      meta: this.meta || null,
      uid: this.uid
    };
  }
  static fromJSON(json, HeightfieldCtor) {
    const p = new _Place({ id: json.id, name: json.name, anchor: json.anchor, seed: json.seed });
    p.tick = json.tick;
    p.entities = new Map(json.entities.map((e) => [e.id, e]));
    p.branches = new Map(json.branches.map((b) => [b.id, b]));
    p.overlays = new Map(json.overlays.map(([bid, entries]) => [bid, new Map(entries)]));
    p.relations = json.relations;
    p.landmarks = new Map(json.landmarks);
    p.activeBranch = json.activeBranch;
    if (json.terrain && HeightfieldCtor) p.terrain = HeightfieldCtor.fromJSON(json.terrain);
    p.uid = json.uid || 0;
    p.meta = json.meta || null;
    return p;
  }
};
var MEASURED = 0;
var INTERPOLATED = 1;
var SETTLED = 2;
var PROV_NAMES = ["measured", "interpolated", "settled"];
var Heightfield = class _Heightfield {
  constructor(bounds, cell, data = null, provenance = null) {
    if (!(cell > 0) || !Number.isFinite(cell)) throw new Error("a ground needs a positive cell size");
    this.bounds = bounds;
    this.cell = cell;
    this.nx = Math.max(2, Math.round((bounds[2] - bounds[0]) / cell) + 1);
    this.ny = Math.max(2, Math.round((bounds[3] - bounds[1]) / cell) + 1);
    this.data = data || new Float32Array(this.nx * this.ny);
    this.prov = provenance || new Uint8Array(this.nx * this.ny).fill(MEASURED);
  }
  idx(i, j) {
    return j * this.nx + i;
  }
  at(i, j) {
    const ii = Math.max(0, Math.min(this.nx - 1, i));
    const jj = Math.max(0, Math.min(this.ny - 1, j));
    return this.data[this.idx(ii, jj)];
  }
  /** I1 — the only height. Planar, on the diagonal `triangles()` uses. */
  heightAt(x, y) {
    const fx = (x - this.bounds[0]) / this.cell;
    const fy = (y - this.bounds[1]) / this.cell;
    const i = Math.floor(fx), j = Math.floor(fy);
    const u = fx - i, v = fy - j;
    const h00 = this.at(i, j), h10 = this.at(i + 1, j);
    const h11 = this.at(i + 1, j + 1), h01 = this.at(i, j + 1);
    return v <= u ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
  }
  /** The surface as drawn — derived from heightAt's rule, never parallel to it. */
  *triangles(step = 1) {
    for (let j = 0; j + step < this.ny; j += step) {
      for (let i = 0; i + step < this.nx; i += step) {
        const x0 = this.bounds[0] + i * this.cell, y0 = this.bounds[1] + j * this.cell;
        const x1 = x0 + this.cell * step, y1 = y0 + this.cell * step;
        const a = [x0, y0, this.at(i, j)];
        const b = [x1, y0, this.at(i + step, j)];
        const c = [x1, y1, this.at(i + step, j + step)];
        const d = [x0, y1, this.at(i, j + step)];
        yield [a, b, c];
        yield [a, c, d];
      }
    }
  }
  slopeAt(x, y) {
    const d = this.cell;
    const dzdx = (this.heightAt(x + d, y) - this.heightAt(x - d, y)) / (2 * d);
    const dzdy = (this.heightAt(x, y + d) - this.heightAt(x, y - d)) / (2 * d);
    return { dzdx, dzdy, grade: Math.hypot(dzdx, dzdy) };
  }
  normalAt(x, y) {
    const s = this.slopeAt(x, y);
    const len2 = Math.hypot(s.dzdx, s.dzdy, 1);
    return [-s.dzdx / len2, -s.dzdy / len2, 1 / len2];
  }
  // ---------------------------------------------------- I2 and I3 ----------
  /** The smallest thing this ground can record, as opposed to compute. */
  finestRepresentable() {
    return this.cell * 2;
  }
  provenanceAt(x, y) {
    const fx = (x - this.bounds[0]) / this.cell, fy = (y - this.bounds[1]) / this.cell;
    const i = Math.floor(fx), j = Math.floor(fy);
    let worst = MEASURED;
    for (const [di, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const ii = Math.max(0, Math.min(this.nx - 1, i + di));
      const jj = Math.max(0, Math.min(this.ny - 1, j + dj));
      worst = Math.max(worst, this.prov[this.idx(ii, jj)]);
    }
    return PROV_NAMES[worst];
  }
  isMeasured(x, y) {
    return this.provenanceAt(x, y) === "measured";
  }
  /**
   * Make the ground able to hold an intervention of a given size, or refuse.
   * Adds no information — every new value is interpolation of the same samples —
   * but adds the capacity to be changed, which is what a building pad needs.
   */
  refineFor(sizeM, { maxSamples = 4e6 } = {}) {
    if (this.finestRepresentable() <= sizeM) return { refined: false, reason: "already fine enough", field: this };
    const want = sizeM / 4;
    const nx = Math.round((this.bounds[2] - this.bounds[0]) / want) + 1;
    const ny = Math.round((this.bounds[3] - this.bounds[1]) / want) + 1;
    if (nx * ny > maxSamples) {
      return {
        refined: false,
        refused: true,
        field: this,
        reason: `recording ${sizeM} m detail here needs ${(nx * ny / 1e6).toFixed(1)}M samples`
      };
    }
    const fine = new _Heightfield(this.bounds, want);
    for (let j = 0; j < fine.ny; j++) {
      for (let i = 0; i < fine.nx; i++) {
        const x = fine.bounds[0] + i * fine.cell, y = fine.bounds[1] + j * fine.cell;
        const k = fine.idx(i, j);
        fine.data[k] = this.heightAt(x, y);
        const onOld = Math.abs((x - this.bounds[0]) / this.cell % 1) < 1e-9 && Math.abs((y - this.bounds[1]) / this.cell % 1) < 1e-9;
        fine.prov[k] = onOld && this.isMeasured(x, y) ? MEASURED : INTERPOLATED;
      }
    }
    return { refined: true, field: fine, from: this.cell, cell: fine.cell, samples: fine.data.length };
  }
  /** Reshape the ground, recording that it was reshaped rather than found. */
  settle(inside, heightFor) {
    const before = [];
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = this.bounds[0] + i * this.cell, y = this.bounds[1] + j * this.cell;
        if (!inside(x, y)) continue;
        const k = this.idx(i, j);
        const target = heightFor(x, y, this.data[k]);
        if (target === null || Math.abs(target - this.data[k]) < 1e-4) continue;
        before.push([k, this.data[k], this.prov[k]]);
        this.data[k] = target;
        this.prov[k] = SETTLED;
      }
    }
    this.__lo = void 0;
    return {
      changed: before.length,
      restore: () => {
        for (const [k, z, p] of before) {
          this.data[k] = z;
          this.prov[k] = p;
        }
        this.__lo = void 0;
      }
    };
  }
  /**
   * Heights are numbers, not prose.
   *
   * Written as a JSON array, 133,225 samples became 2.4 MB of decimal text —
   * three megabytes to download before a site would open, for data that is
   * 533 KB of Float32. They are stored as bytes now and the file is a quarter
   * of the size. The old array form is still read, because places saved before
   * this exist and should not become unopenable.
   */
  toJSON() {
    return {
      bounds: this.bounds,
      cell: this.cell,
      f32: b64FromBytes(new Uint8Array(this.data.buffer, this.data.byteOffset, this.data.byteLength)),
      p8: b64FromBytes(this.prov)
    };
  }
  static fromJSON(j) {
    if (j.f32) {
      const bytes = bytesFromB64(j.f32);
      const data = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      return new _Heightfield(j.bounds, j.cell, data, j.p8 ? bytesFromB64(j.p8) : null);
    }
    return new _Heightfield(
      j.bounds,
      j.cell,
      Float32Array.from(j.data),
      j.prov ? Uint8Array.from(j.prov) : null
    );
  }
};
function b64FromBytes(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  }
  return btoa(s);
}
function bytesFromB64(b64) {
  if (typeof Buffer !== "undefined") {
    const b = Buffer.from(b64, "base64");
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength).slice();
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// src/core/tx.js
var clone = (v) => v === null || v === void 0 ? v : JSON.parse(JSON.stringify(v));
var Journal = class {
  constructor(place2) {
    this.place = place2;
    this.events = [];
    this.cursor = 0;
    this.nextEventId = 1;
    this.listeners = /* @__PURE__ */ new Set();
    this.open = null;
  }
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(kind, payload) {
    for (const fn of this.listeners) fn(kind, payload);
  }
  begin(meta = {}) {
    if (this.open) throw new Error("transaction already open");
    this.open = {
      id: `ev_${this.nextEventId}`,
      tick: this.place.tick + 1,
      author: meta.author || "anon",
      branch: meta.branch || this.place.activeBranch,
      label: meta.label || "change",
      intent: meta.intent || null,
      // the interpreted operation
      utterance: meta.utterance || null,
      // the ORIGINAL human expression, untranslated
      mutations: []
    };
    return this.open;
  }
  /** Record + apply one primitive mutation. */
  mutate(m) {
    if (!this.open) throw new Error("no open transaction");
    const applied = this._apply(m);
    this.open.mutations.push(applied);
    return applied;
  }
  commit() {
    if (!this.open) throw new Error("no open transaction");
    const ev = this.open;
    this.open = null;
    if (!ev.mutations.length) return null;
    this.events.length = this.cursor;
    this.events.push(ev);
    this.cursor = this.events.length;
    this.nextEventId++;
    this.place.tick = ev.tick;
    this.emit("commit", ev);
    return ev;
  }
  abort() {
    if (!this.open) return;
    const ev = this.open;
    this.open = null;
    for (let i = ev.mutations.length - 1; i >= 0; i--) this._invert(ev.mutations[i]);
    this.emit("abort", ev);
  }
  /** Convenience: run a function inside a transaction. */
  transact(meta, fn) {
    this.begin(meta);
    try {
      const r = fn(this);
      const ev = this.commit();
      return { event: ev, result: r };
    } catch (err) {
      this.abort();
      throw err;
    }
  }
  // ------------------------------------------------------------ primitives --
  _apply(m) {
    const p = this.place;
    switch (m.op) {
      case "add": {
        const branch = m.branch || p.activeBranch;
        const e = makeEntity(m.entity);
        m.before = clone(p.get(e.id, branch));
        p.put(e, branch);
        m.after = clone(e);
        return m;
      }
      case "update": {
        const branch = m.branch || p.activeBranch;
        const cur = p.get(m.id, branch);
        if (!cur) throw new Error(`update: no entity ${m.id}`);
        m.before = clone(cur);
        const next = { ...clone(cur), ...clone(m.patch) };
        p.put(next, branch);
        m.after = clone(next);
        return m;
      }
      case "remove": {
        const branch = m.branch || p.activeBranch;
        m.before = clone(p.get(m.id, branch));
        p.remove(m.id, branch);
        return m;
      }
      case "relate": {
        p.relations.push({ from: m.from, kind: m.kind, to: m.to, derived: false, author: m.author || null, note: m.note || null });
        return m;
      }
      case "unrelate": {
        const i = p.relations.findIndex((r) => r.from === m.from && r.kind === m.kind && r.to === m.to);
        m.before = i >= 0 ? clone(p.relations[i]) : null;
        if (i >= 0) p.relations.splice(i, 1);
        return m;
      }
      case "branch": {
        p.createBranch(m.branchId, { name: m.name, parent: m.parent, note: m.note, author: m.author });
        return m;
      }
      case "setActiveBranch": {
        m.before = p.activeBranch;
        p.setActiveBranch(m.branchId);
        return m;
      }
      default:
        throw new Error(`unknown mutation ${m.op}`);
    }
  }
  _invert(m) {
    const p = this.place;
    const branch = m.branch || p.activeBranch;
    switch (m.op) {
      case "add":
        if (m.before) p.put(clone(m.before), branch);
        else p.remove(m.after.id, branch);
        break;
      case "update":
        p.put(clone(m.before), branch);
        break;
      case "remove":
        if (m.before) p.put(clone(m.before), branch);
        break;
      case "relate": {
        const i = p.relations.findIndex((r) => r.from === m.from && r.kind === m.kind && r.to === m.to && !r.derived);
        if (i >= 0) p.relations.splice(i, 1);
        break;
      }
      case "unrelate":
        if (m.before) p.relations.push(clone(m.before));
        break;
      case "branch": {
        const fallback = m.parent && p.branches.has(m.parent) ? m.parent : "AS_IS";
        const orphaned = [];
        for (const [id, b] of p.branches) if (b.parent === m.branchId) orphaned.push(id);
        for (const id of orphaned) p.branches.get(id).parent = fallback;
        p.branches.delete(m.branchId);
        p.overlays.delete(m.branchId);
        if (p.activeBranch === m.branchId) p.activeBranch = fallback;
        break;
      }
      case "setActiveBranch":
        p.setActiveBranch(m.before);
        break;
    }
  }
  // ------------------------------------------------------------ undo/redo ---
  canUndo() {
    return this.cursor > 0;
  }
  canRedo() {
    return this.cursor < this.events.length;
  }
  undo() {
    if (!this.canUndo()) return null;
    const ev = this.events[--this.cursor];
    for (let i = ev.mutations.length - 1; i >= 0; i--) this._invert(ev.mutations[i]);
    this.place.tick = this.cursor > 0 ? this.events[this.cursor - 1].tick : 0;
    this.emit("undo", ev);
    return ev;
  }
  redo() {
    if (!this.canRedo()) return null;
    const ev = this.events[this.cursor++];
    for (const m of ev.mutations) this._apply(m);
    this.place.tick = ev.tick;
    this.emit("redo", ev);
    return ev;
  }
  // ---------------------------------------------------------- provenance ----
  /** §19 — "why are you here?" answered from the log, not from a debug panel. */
  historyOf(entityId) {
    const out = [];
    for (let i = 0; i < this.cursor; i++) {
      const ev = this.events[i];
      for (const m of ev.mutations) {
        const touches = m.op === "add" && m.after?.id === entityId || (m.op === "update" || m.op === "remove") && m.id === entityId || (m.op === "relate" || m.op === "unrelate") && (m.from === entityId || m.to === entityId);
        if (touches) {
          out.push({ event: ev, mutation: m });
          break;
        }
      }
    }
    return out;
  }
  changedSince(tick, branch = null) {
    const ids = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.cursor; i++) {
      const ev = this.events[i];
      if (ev.tick <= tick) continue;
      if (branch && ev.branch !== branch) continue;
      for (const m of ev.mutations) {
        if (m.op === "add") ids.add(m.after.id);
        else if (m.op === "update" || m.op === "remove") ids.add(m.id);
      }
    }
    return [...ids];
  }
  toJSON() {
    return { events: this.events.slice(0, this.cursor), cursor: this.cursor, nextEventId: this.nextEventId };
  }
  loadJSON(j) {
    this.events = j.events;
    this.cursor = j.cursor;
    this.nextEventId = j.nextEventId;
  }
};

// src/core/spatialindex.js
var SpatialIndex = class {
  constructor(cell = 16, cellBudget = 4e4) {
    this.cell = cell;
    this.cellBudget = cellBudget;
    this.cells = /* @__PURE__ */ new Map();
    this.boxes = /* @__PURE__ */ new Map();
    this.rings = /* @__PURE__ */ new Map();
    this.z = /* @__PURE__ */ new Map();
    this.huge = /* @__PURE__ */ new Set();
  }
  key(i, j) {
    return `${i},${j}`;
  }
  /**
   * Cells covered by a box. An entity whose footprint is 10 000 km across would
   * otherwise ask for billions of grid cells and take the tab down with it —
   * so anything past the budget is held in an oversize list and tested directly.
   * The index degrades; it does not die.
   */
  *cellsFor(bb) {
    if (!Number.isFinite(bb[0]) || !Number.isFinite(bb[1]) || !Number.isFinite(bb[2]) || !Number.isFinite(bb[3])) return;
    const i0 = Math.floor(bb[0] / this.cell), i1 = Math.floor(bb[2] / this.cell);
    const j0 = Math.floor(bb[1] / this.cell), j1 = Math.floor(bb[3] / this.cell);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > this.cellBudget) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) yield this.key(i, j);
  }
  oversized(bb) {
    const i0 = Math.floor(bb[0] / this.cell), i1 = Math.floor(bb[2] / this.cell);
    const j0 = Math.floor(bb[1] / this.cell), j1 = Math.floor(bb[3] / this.cell);
    return !Number.isFinite(bb[0]) || (i1 - i0 + 1) * (j1 - j0 + 1) > this.cellBudget;
  }
  insert(id, ring3, zBase = 0, zTop = 0) {
    this.removeId(id);
    const bb = bbox(ring3);
    this.boxes.set(id, bb);
    this.rings.set(id, ring3);
    this.z.set(id, [zBase, zTop]);
    if (this.oversized(bb)) {
      this.huge.add(id);
      return;
    }
    for (const k of this.cellsFor(bb)) {
      let s = this.cells.get(k);
      if (!s) this.cells.set(k, s = /* @__PURE__ */ new Set());
      s.add(id);
    }
  }
  removeId(id) {
    const bb = this.boxes.get(id);
    if (!bb) return;
    for (const k of this.cellsFor(bb)) this.cells.get(k)?.delete(id);
    this.huge.delete(id);
    this.boxes.delete(id);
    this.rings.delete(id);
    this.z.delete(id);
  }
  clear() {
    this.cells.clear();
    this.boxes.clear();
    this.rings.clear();
    this.z.clear();
    this.huge.clear();
  }
  /** Rebuild from a branch view of the place. */
  rebuild(place2, branchId) {
    this.clear();
    for (const e of place2.all(branchId)) {
      const ring3 = place2.ringOf(e);
      if (ring3 && ring3.length >= 3) this.insert(e.id, ring3, e.zBase, e.zTop);
    }
    return this;
  }
  candidates(bb) {
    const out = new Set(this.huge);
    if (this.oversized(bb)) {
      for (const id of this.boxes.keys()) out.add(id);
      return out;
    }
    for (const k of this.cellsFor(bb)) {
      const s = this.cells.get(k);
      if (s) for (const id of s) out.add(id);
    }
    return out;
  }
  /** Ids whose real polygon contains the point. */
  atPoint(pt) {
    const bb = [pt[0], pt[1], pt[0], pt[1]];
    const out = [];
    for (const id of this.candidates(bb)) {
      const ring3 = this.rings.get(id);
      if (ring3 && pointInRing2(pt, ring3)) out.push(id);
    }
    return out;
  }
  /** Ids whose real polygon is within `r` metres of the point. */
  near(pt, r) {
    const bb = [pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r];
    const out = [];
    for (const id of this.candidates(bb)) {
      const ring3 = this.rings.get(id);
      if (!ring3) continue;
      if (pointInRing2(pt, ring3)) {
        out.push({ id, d: 0 });
        continue;
      }
      const c = closestOnRing(pt, ring3);
      if (c.d <= r) out.push({ id, d: c.d });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  /** Ids whose real polygon overlaps the query ring, with vertical-interval test. */
  overlapping(ring3, zBase = -Infinity, zTop = Infinity, exclude = /* @__PURE__ */ new Set()) {
    const bb = bbox(ring3);
    const out = [];
    for (const id of this.candidates(bb)) {
      if (exclude.has(id)) continue;
      const other = this.rings.get(id);
      if (!other) continue;
      if (!ringsIntersect(ring3, other)) continue;
      const [zb, zt] = this.z.get(id) || [0, 0];
      const vertical = !(zTop <= zb + 1e-6 || zt <= zBase + 1e-6);
      if (vertical) out.push(id);
    }
    return out;
  }
  /** Everything inside a query ring (fully contained). */
  within(ring3) {
    const bb = bbox(ring3);
    const out = [];
    for (const id of this.candidates(bb)) {
      const other = this.rings.get(id);
      if (other && ringContains(ring3, other)) out.push(id);
    }
    return out;
  }
  ringFor(id) {
    return this.rings.get(id) || null;
  }
  size() {
    return this.boxes.size;
  }
};

// src/core/relations.js
var NETWORK_TYPES = /* @__PURE__ */ new Set(["road", "path", "drain", "stream"]);
var TOUCH_TOL = 0.35;
var BESIDE_TOL = 6;
function deriveRelations(place2, index, branchId = place2.activeBranch) {
  place2.clearDerivedRelations();
  const ents = place2.all(branchId);
  const ringOf = /* @__PURE__ */ new Map();
  for (const e of ents) {
    const r = place2.ringOf(e);
    if (r && r.length >= 3) ringOf.set(e.id, r);
  }
  const push = (from, kind, to, extra = {}) => place2.relations.push({ from, kind, to, derived: true, ...extra });
  for (const a of ents) {
    const ra = ringOf.get(a.id);
    if (!ra) continue;
    const bbA = bbox(ra);
    const pad = [bbA[0] - BESIDE_TOL, bbA[1] - BESIDE_TOL, bbA[2] + BESIDE_TOL, bbA[3] + BESIDE_TOL];
    for (const bid of index.candidates(pad)) {
      if (bid === a.id) continue;
      const b = place2.get(bid, branchId);
      if (!b) continue;
      const rb = ringOf.get(bid);
      if (!rb) continue;
      if (a.id > b.id && !NETWORK_TYPES.has(a.type)) continue;
      const overlaps = ringsIntersect(ra, rb);
      const d = overlaps ? 0 : ringDistance(ra, rb);
      if (overlaps) {
        if (ringContains(rb, ra) && a.zBase >= b.zBase - 0.01 && a.zTop <= b.zTop + 0.01) {
          push(a.id, "inside", b.id);
          push(b.id, "contains", a.id);
        } else if (ringContains(ra, rb) && b.zBase >= a.zBase - 0.01 && b.zTop <= a.zTop + 0.01) {
          push(b.id, "inside", a.id);
          push(a.id, "contains", b.id);
        }
        if (Math.abs(a.zBase - b.zTop) < 0.2) {
          push(a.id, "above", b.id);
          push(b.id, "below", a.id);
          push(b.id, "supports", a.id);
          push(a.id, "supportedBy", b.id);
        } else if (Math.abs(b.zBase - a.zTop) < 0.2) {
          push(b.id, "above", a.id);
          push(a.id, "below", b.id);
          push(a.id, "supports", b.id);
          push(b.id, "supportedBy", a.id);
        } else if (a.zBase > b.zTop) {
          push(a.id, "above", b.id);
          push(b.id, "below", a.id);
        } else if (b.zBase > a.zTop) {
          push(b.id, "above", a.id);
          push(a.id, "below", b.id);
        }
        if (NETWORK_TYPES.has(b.type) && a.collision === "solid" && a.zBase < b.zTop + 2 && a.zTop > b.zBase) {
          push(a.id, "blocks", b.id);
        }
        if (NETWORK_TYPES.has(a.type) && b.collision === "solid" && b.zBase < a.zTop + 2 && b.zTop > a.zBase) {
          push(b.id, "blocks", a.id);
        }
        if (NETWORK_TYPES.has(a.type) && NETWORK_TYPES.has(b.type)) {
          if (a.network === b.network) {
            push(a.id, "connectedTo", b.id);
            push(b.id, "connectedTo", a.id);
          } else {
            push(a.id, "crosses", b.id);
            push(b.id, "crosses", a.id);
          }
        }
      } else if (d <= TOUCH_TOL) {
        push(a.id, "touches", b.id);
        push(b.id, "touches", a.id);
        if (Math.abs(a.zBase - b.zTop) < 0.2) {
          push(b.id, "supports", a.id);
          push(a.id, "supportedBy", b.id);
        }
        if (Math.abs(b.zBase - a.zTop) < 0.2) {
          push(a.id, "supports", b.id);
          push(b.id, "supportedBy", a.id);
        }
      } else if (d <= BESIDE_TOL) {
        push(a.id, "beside", b.id, { distance: +d.toFixed(2) });
        push(b.id, "beside", a.id, { distance: +d.toFixed(2) });
      }
    }
    if (place2.terrain && a.zBase <= place2.groundAt(...centroid(ra)) + 0.25 && a.type !== "terrain") {
      push(a.id, "supportedBy", "terrain");
    }
    if (place2.terrain && (a.type === "surface" || a.type === "road" || a.type === "path" || a.type === "region")) {
      const c = centroid(ra);
      const s = place2.terrain.slopeAt(c[0], c[1]);
      if (s.grade > 2e-3) {
        const step = 3;
        const target = [c[0] - s.dzdx / s.grade * step, c[1] - s.dzdy / s.grade * step];
        for (const hit of index.near(target, 1.5)) {
          if (hit.id === a.id) continue;
          const t = place2.get(hit.id, branchId);
          if (t && (t.type === "drain" || t.type === "water" || t.type === "stream")) {
            push(a.id, "drainsTo", hit.id);
            break;
          }
        }
      }
    }
  }
  return place2.relations;
}
function describeRelations(place2, id, limit = 12) {
  const rels = place2.relationsOf(id);
  const byKind = /* @__PURE__ */ new Map();
  for (const r of rels) {
    const outgoing = r.from === id;
    const kind = outgoing ? r.kind : inverseOf(r.kind);
    const other = outgoing ? r.to : r.from;
    if (!byKind.has(kind)) byKind.set(kind, /* @__PURE__ */ new Set());
    byKind.get(kind).add(other);
  }
  const out = [];
  for (const [kind, set] of byKind) {
    out.push({ kind, ids: [...set].slice(0, limit) });
  }
  return out;
}
var INVERSE = {
  inside: "contains",
  contains: "inside",
  above: "below",
  below: "above",
  supports: "supportedBy",
  supportedBy: "supports",
  blocks: "blockedBy",
  drainsTo: "drainedFrom",
  proposedBy: "proposed",
  derivedFrom: "derived"
};
var inverseOf = (k) => INVERSE[k] || k;
function supportFor(place2, index, ring3, zBase, excludeId = null, branchId = place2.activeBranch) {
  const c = centroid(ring3);
  const ground = place2.groundAt(c[0], c[1]);
  if (zBase <= ground + 0.3) return { supported: true, by: "terrain", gap: 0 };
  let best = null;
  for (const id of index.overlapping(ring3, zBase - 0.6, zBase + 0.01, new Set([excludeId].filter(Boolean)))) {
    const e = place2.get(id, branchId);
    if (!e || e.collision === "none") continue;
    const gap = zBase - e.zTop;
    if (gap >= -0.05 && gap < 0.6 && (!best || gap < best.gap)) best = { supported: true, by: id, gap };
  }
  return best || { supported: false, by: null, gap: zBase - ground };
}

// src/core/world.js
var World = class _World {
  constructor(place2) {
    this.place = place2;
    this.journal = new Journal(place2);
    this.index = new SpatialIndex(16);
    this.dirty = true;
    this.observers = /* @__PURE__ */ new Set();
    this.journal.on((kind, ev) => {
      if (kind === "commit" && this.applyIncremental(ev)) this._relDirty = true;
      else this.dirty = true;
      this.notify(kind, ev);
    });
    this.reindex();
  }
  /** True when the event was simple enough to apply to the index directly. */
  applyIncremental(ev) {
    if (this.dirty || !ev || !Array.isArray(ev.mutations)) return false;
    if (!ev.mutations.every((m) => m.op === "add" || m.op === "update" || m.op === "remove")) return false;
    for (const m of ev.mutations) {
      if (m.op === "remove") {
        this.index.removeId(m.id);
        continue;
      }
      const e = m.after;
      const ring3 = e && this.place.ringOf(e);
      if (ring3 && ring3.length >= 3) this.index.insert(e.id, ring3, e.zBase, e.zTop);
      else if (e) this.index.removeId(e.id);
    }
    return true;
  }
  on(fn) {
    this.observers.add(fn);
    return () => this.observers.delete(fn);
  }
  notify(kind, payload) {
    for (const fn of this.observers) fn(kind, payload);
  }
  reindex(force = false) {
    if (this.dirty || force) {
      this.index.rebuild(this.place, this.place.activeBranch);
      deriveRelations(this.place, this.index, this.place.activeBranch);
      this.dirty = false;
      this._relDirty = false;
      this._relAt = Date.now();
      return this.index;
    }
    if (this._relDirty) {
      const big = this.index.boxes.size > 3e3;
      if (!big || Date.now() - (this._relAt || 0) > 2e3) {
        this._relAt = Date.now();
        this._relDirty = false;
        deriveRelations(this.place, this.index, this.place.activeBranch);
      }
    }
    return this.index;
  }
  get branch() {
    return this.place.activeBranch;
  }
  /** Read-side helpers used by every other subsystem. */
  entities() {
    return this.place.all(this.branch);
  }
  get(id) {
    return this.place.get(id, this.branch);
  }
  ringOf(e) {
    return this.place.ringOf(e);
  }
  entityAt(pt) {
    this.reindex();
    const ids = this.index.atPoint(pt);
    if (!ids.length) return null;
    let best = null;
    for (const id of ids) {
      const e = this.get(id);
      if (!e) continue;
      if (!best || e.zTop > best.zTop || e.zTop === best.zTop && e.type !== "surface") best = e;
    }
    return best;
  }
  nearby(pt, r = 20) {
    this.reindex();
    return this.index.near(pt, r).map((h) => ({ entity: this.get(h.id), d: h.d })).filter((h) => h.entity);
  }
  /**
   * Alias. The rig has been calling `world.near` inside a try/catch since it
   * arrived, and the catch swallowed the ReferenceError — so its solids query
   * ran on luck. The name it reached for now answers.
   */
  near(pt, r) {
    return this.nearby(pt, r);
  }
  /** Run a transaction, then keep index + relations in step. */
  transact(meta, fn) {
    const out = this.journal.transact(meta, fn);
    this.dirty = true;
    this.reindex();
    return out;
  }
  addEntity(props, meta = {}) {
    const id = props.id || this.place.newId(props.type);
    let created = null;
    this.transact({ label: meta.label || `add ${props.type}`, ...meta }, (j) => {
      created = j.mutate({ op: "add", branch: meta.branch || this.branch, entity: { ...props, id, createdAt: this.place.tick + 1 } }).after;
    });
    return this.get(id) || created;
  }
  updateEntity(id, patch, meta = {}) {
    this.transact({ label: meta.label || `edit ${id}`, ...meta }, (j) => {
      j.mutate({ op: "update", branch: meta.branch || this.branch, id, patch });
    });
    return this.get(id);
  }
  removeEntity(id, meta = {}) {
    this.transact({ label: meta.label || `remove ${id}`, ...meta }, (j) => {
      j.mutate({ op: "remove", branch: meta.branch || this.branch, id });
    });
  }
  undo() {
    const e = this.journal.undo();
    this.dirty = true;
    this.reindex();
    return e;
  }
  redo() {
    const e = this.journal.redo();
    this.dirty = true;
    this.reindex();
    return e;
  }
  // ------------------------------------------------------------- branches ---
  createBranch(id, opts = {}) {
    this.transact({ label: `branch ${opts.name || id}`, author: opts.author }, (j) => {
      j.mutate({ op: "branch", branchId: id, name: opts.name, parent: opts.parent ?? this.branch, note: opts.note, author: opts.author });
    });
    return this.place.branches.get(id);
  }
  switchBranch(id) {
    if (id === this.branch) return;
    this.place.setActiveBranch(id);
    this.dirty = true;
    this.reindex();
    this.notify("branch", id);
  }
  /** Read a branch without switching to it — needed for side-by-side compare. */
  view(branchId) {
    const prev = this.place.activeBranch;
    this.place.activeBranch = branchId;
    const idx = new SpatialIndex(16).rebuild(this.place, branchId);
    const list = this.place.all(branchId);
    this.place.activeBranch = prev;
    return { entities: list, index: idx, branchId };
  }
  // -------------------------------------------------------------- persist ---
  save() {
    return JSON.stringify({
      version: 1,
      place: this.place.toJSON(),
      journal: this.journal.toJSON()
    });
  }
  static load(text) {
    const j = JSON.parse(text);
    const place2 = Place.fromJSON(j.place, Heightfield);
    const w = new _World(place2);
    w.journal.loadJSON(j.journal);
    w.dirty = true;
    w.reindex();
    return w;
  }
  /**
   * Stable fingerprint — the instrument the save/reload and undo invariants are
   * measured with. It must therefore be sensitive to everything a person could
   * lose: not only geometry, but who made a thing, what it is made of, whether
   * it is solid, what it cites as evidence, and every vertex. An instrument that
   * calls "City Hall" and "prank shed" the same world is not evidence of
   * anything.
   */
  fingerprint() {
    const ents = this.place.all(this.branch).slice().sort((a, b) => a.id < b.id ? -1 : 1).map((e) => {
      const ring3 = this.place.ringOf(e);
      const geom = ring3 ? ring3.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(" ") : "-";
      const semantic = [
        e.id,
        e.type,
        e.subtype,
        e.name,
        e.status,
        e.epistemic,
        e.certainty,
        e.author,
        e.source,
        e.material,
        e.use,
        e.collision,
        e.network,
        e.parent,
        e.width,
        (e.tags || []).join("+")
      ].join("|");
      const deep = hash(JSON.stringify([e.props || {}, e.sim || {}, e.evidence || []]));
      return `${semantic}|${e.zBase.toFixed(3)}|${e.zTop.toFixed(3)}|${hash(geom)}|${deep}`;
    });
    const rels = this.place.relations.map((r) => `${r.from}-${r.kind}->${r.to}${r.derived ? "*" : ""}|${r.author || ""}|${r.note || ""}|${r.distance ?? ""}`).sort().join(";");
    const branches = [...this.place.branches.values()].map((b) => `${b.id}<${b.parent || "-"}>${b.name}${b.status}`).sort().join(";");
    return `${ents.join("\n")}
#rel ${hash(rels)}
#branches ${hash(branches)}
#tick ${this.place.tick}
#branch ${this.branch}`;
  }
};
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// src/core/rng.js
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function stream(name, seed = 0) {
  return mulberry32(hashString(name) ^ seed >>> 0);
}

// src/world/generate.js
function alignmentAt(world, pt, radius = 30) {
  let best = null;
  for (const hit of world.nearby(pt, radius)) {
    const e = hit.entity;
    if (!["road", "path", "structure", "wall", "parcel"].includes(e.type)) continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    if (e.path) {
      const c = closestOnRing(pt, e.path, false);
      const i = Math.min(c.i ?? 0, e.path.length - 2);
      const d = norm(sub(e.path[i + 1], e.path[i]));
      const score = hit.d + (e.type === "road" ? 0 : 4);
      if (!best || score < best.score) best = { angle: Math.atan2(d[1], d[0]), score, from: e.id };
    } else {
      const ob = orientedBounds(ring3);
      const score = hit.d + (e.type === "structure" ? 1 : 6);
      if (!best || score < best.score) best = { angle: ob.angle, score, from: e.id };
    }
  }
  return best || { angle: 0, score: Infinity, from: null };
}
function findPlacement(world, {
  region = null,
  point = null,
  size = [4, 4],
  zBase = 0,
  avoidTypes = ["structure", "wall", "water", "tree"],
  keepClearOf = [],
  corridors = [],
  prefer = "open",
  samples = 14,
  seedName = "placement"
}) {
  const index = world.reindex();
  const rnd = stream(seedName, world.place.seed);
  const bb = region ? bbox(region) : [point[0] - 25, point[1] - 25, point[0] + 25, point[1] + 25];
  const align = alignmentAt(world, point || centroid(region));
  const candidates = [];
  const nx = samples, ny = samples;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const jitter = (rnd() - 0.5) * 0.6;
      const x = bb[0] + (i + 0.5) / nx * (bb[2] - bb[0]) + jitter;
      const y = bb[1] + (j + 0.5) / ny * (bb[3] - bb[1]) + jitter;
      if (region && !pointInRing2([x, y], region)) continue;
      for (const angle of [align.angle, align.angle + Math.PI / 2]) {
        const ring3 = rectRing(x, y, size[0], size[1], angle);
        const zHere = zBase || world.place.groundAt(x, y);
        const hits = index.overlapping(ring3, zHere - 1.5, zHere + 2.5);
        let blocked = false, penalty = 0;
        for (const id of hits) {
          const e = world.get(id);
          if (!e) continue;
          if (avoidTypes.includes(e.type)) {
            blocked = true;
            break;
          }
          if (e.type === "road" || e.type === "path" || e.type === "drain") {
            blocked = true;
            break;
          }
          penalty += 2;
        }
        if (blocked) continue;
        if (keepClearOf.some((kid) => {
          const k = world.get(kid);
          if (!k) return false;
          const kr = world.ringOf(k);
          return kr && ringsIntersect(ring3, kr);
        })) continue;
        if (corridors.some((c2) => ringsIntersect(ring3, c2.ring))) continue;
        const c = [x, y];
        const slope = world.place.terrain ? world.place.terrain.slopeAt(x, y).grade : 0;
        const near = index.near(c, 18);
        let dStruct = 18, dNet = 18;
        for (const h of near) {
          const e = world.get(h.id);
          if (!e) continue;
          if (e.type === "structure") dStruct = Math.min(dStruct, h.d);
          if (e.type === "road" || e.type === "path") dNet = Math.min(dNet, h.d);
        }
        let score = 0;
        score += Math.min(dStruct, 10) * 1.2;
        score += (18 - Math.min(dNet, 18)) * 0.8;
        score -= slope * 40;
        score -= penalty;
        if (prefer === "downhill" && world.place.terrain) score -= world.place.terrain.heightAt(x, y) * 3;
        if (prefer === "center" && region) score -= dist(c, centroid(region)) * 0.6;
        if (prefer === "edge" && region) score += closestOnRing(c, region).d * -0.4;
        candidates.push({ center: c, angle, ring: ring3, score, slope, dStruct, dNet });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
function windowCorridors(world, ids, depth = 6) {
  const out = [];
  for (const id of ids) {
    const e = world.get(id);
    if (!e || e.type !== "opening") continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    const c = centroid(ring3);
    const n = e.props?.normal || [0, 1];
    const w = e.props?.width || 1.2;
    const t = perp(n);
    const corridor = [
      [c[0] - t[0] * w, c[1] - t[1] * w],
      [c[0] + t[0] * w, c[1] + t[1] * w],
      [c[0] + t[0] * w + n[0] * depth, c[1] + t[1] * w + n[1] * depth],
      [c[0] - t[0] * w + n[0] * depth, c[1] - t[1] * w + n[1] * depth]
    ];
    out.push({ ring: corridor, ownerId: id, label: `daylight to ${e.name || id}`, zBase: e.zBase, zTop: e.zTop });
  }
  return out;
}
var GENERATORS = {
  greenhouse(world, ctx) {
    const size = ctx.dimensions ? [ctx.dimensions.width, ctx.dimensions.depth || ctx.dimensions.width * 0.6] : [6, 3.5];
    return placeBox(world, ctx, {
      size,
      height: 2.6,
      type: "structure",
      subtype: "greenhouse",
      name: "Greenhouse",
      material: "glass",
      use: "growing",
      sim: { permeability: 0, roughness: 0.02 }
    });
  },
  building(world, ctx) {
    const size = ctx.dimensions ? [ctx.dimensions.width, ctx.dimensions.depth || ctx.dimensions.width] : [7, 6];
    return placeBox(world, ctx, { size, height: ctx.dimensions?.height || 3.2, type: "structure", name: "New structure", material: "block" });
  },
  bench(world, ctx) {
    return placeBox(world, ctx, { size: [1.8, 0.5], height: 0.45, type: "bench", name: "Bench", collision: "soft" });
  },
  light(world, ctx) {
    return placeBox(world, ctx, { size: [0.3, 0.3], height: 5, type: "light", name: "Street light", collision: "soft", props: { lumens: 6e3, radius: 9 } });
  },
  market(world, ctx) {
    return placeBox(world, ctx, { size: [3, 2.4], height: 2.4, type: "market", name: "Stall", use: "trade" });
  },
  wall(world, ctx) {
    return placeBox(world, ctx, { size: [6, 0.3], height: 2.2, type: "wall", name: "Wall" });
  },
  tree(world, ctx) {
    const n = Math.max(1, Math.min(60, ctx.count || 5));
    const region = ctx.region || circleRing(ctx.point[0], ctx.point[1], 8, 20);
    const rnd = stream(`trees:${ctx.seed}`, world.place.seed);
    const out = [];
    const placed = [];
    const bb = bbox(region);
    let guard = 0;
    while (out.length < n && guard++ < n * 120) {
      const x = bb[0] + rnd() * (bb[2] - bb[0]);
      const y = bb[1] + rnd() * (bb[3] - bb[1]);
      if (!pointInRing2([x, y], region)) continue;
      if (placed.some((p) => dist(p, [x, y]) < 3.2)) continue;
      const canopy = 2.2 + rnd() * 1.4;
      const ring3 = circleRing(x, y, canopy, 12);
      const blocked = world.index.overlapping(ring3, 0, 6).some((id) => {
        const e = world.get(id);
        return e && ["structure", "wall", "road", "path", "drain", "water", "tree"].includes(e.type);
      });
      if (blocked) continue;
      placed.push([x, y]);
      out.push({
        type: "tree",
        name: "Tree",
        footprint: ring3,
        zBase: world.place.groundAt(x, y),
        zTop: world.place.groundAt(x, y) + 4 + rnd() * 3,
        collision: "soft",
        sim: { canopy: Math.PI * canopy * canopy, permeability: 0.7 },
        props: { canopyRadius: canopy, planted: true }
      });
    }
    return out;
  },
  garden(world, ctx) {
    const region = ctx.region || circleRing(ctx.point[0], ctx.point[1], 7, 24);
    let ring3 = shrinkToFree(world, region, ["structure", "wall", "road", "water"]);
    if (!ring3) {
      const bb = bbox(region);
      const w = bb[2] - bb[0], d = bb[3] - bb[1];
      for (const f2 of [0.6, 0.45, 0.3, 0.2]) {
        const cand = findPlacement(world, {
          region,
          point: centroid(region),
          size: [w * f2, d * f2],
          seedName: `garden:${ctx.seed}`,
          prefer: "center",
          samples: 10
        })[0];
        if (cand) {
          ring3 = cand.ring;
          break;
        }
      }
    }
    if (!ring3) return [];
    const z = world.place.groundAt(...centroid(ring3));
    return [{
      type: "surface",
      subtype: "garden",
      name: "Community garden",
      footprint: ring3,
      zBase: z,
      zTop: z + 0.15,
      collision: "none",
      use: "growing",
      sim: { permeability: 0.85, roughness: 0.3 }
    }];
  },
  swale(world, ctx) {
    return trench(world, ctx, { name: "Swale", subtype: "swale", width: ctx.dimensions?.width || 2.4, depth: 0.45, permeability: 0.9, roughness: 0.25, reach: 60, infiltrate: true });
  },
  drain(world, ctx) {
    return trench(world, ctx, { name: "Drain", subtype: null, width: ctx.dimensions?.width || 1.2, depth: ctx.dimensions?.height || 1, permeability: 0.05, roughness: 0.012, reach: 140 });
  },
  path(world, ctx) {
    const width = ctx.dimensions?.width || 1.5;
    const line2 = ctx.line || walkableLine(world, ctx.point, ctx.region, width / 2 + 0.3);
    const z = world.place.groundAt(...line2[0]);
    return [{
      type: "path",
      name: "Path",
      network: "paths",
      path: line2,
      width,
      zBase: z,
      zTop: z + 0.05,
      collision: "none",
      sim: { permeability: 0.2, roughness: 0.02 }
    }];
  },
  bridge(world, ctx) {
    const [aId, bId] = ctx.ids || [];
    const a = world.get(aId), b = world.get(bId);
    if (!a || !b) return [];
    const ca = centroid(world.ringOf(a)), cb = centroid(world.ringOf(b));
    const pa = closestOnRing(cb, world.ringOf(a)).point;
    const pb = closestOnRing(ca, world.ringOf(b)).point;
    const width = ctx.dimensions?.width || 1.8;
    const deck = Math.min(a.zTop, b.zTop) - 0.15;
    return [{
      type: "bridge",
      name: "Connection",
      network: "paths",
      path: [pa, pb],
      width,
      zBase: deck,
      zTop: deck + 1.1,
      collision: "soft",
      needsSupport: false,
      sim: { roughness: 0.02 },
      props: { ends: [a.id, b.id], span: dist(pa, pb) }
    }];
  }
};
GENERATORS.greenhouse.onRoof = true;
function trench(world, ctx, spec) {
  const start = ctx.line ? ctx.line[0] : freeStart(world, ctx.point, spec.width / 2 + 0.4, ctx.region);
  const zGround = world.place.groundAt(start[0], start[1]);
  let line2 = ctx.line;
  let outfall = null;
  const clearance = spec.width / 2 + 0.4;
  if (!line2) {
    outfall = findOutfall(world, start, spec.reach, zGround);
    if (outfall) line2 = routeAcross(world, start, outfall.point, { clearance });
    else if (spec.infiltrate) line2 = contourLine(world, start, 30, clearance);
    else line2 = downhillLine(world, start, Math.min(spec.reach, 30));
  }
  const zEndGround = world.place.groundAt(line2[line2.length - 1][0], line2[line2.length - 1][1]);
  const invertStart = zGround - spec.depth;
  const invertEnd = outfall ? Math.min(outfall.z, invertStart - 0.05) : Math.min(zEndGround - spec.depth, invertStart - perimeter(line2, false) * 5e-3);
  return [{
    type: "drain",
    subtype: spec.subtype,
    name: spec.name,
    network: "drainage",
    path: line2,
    width: spec.width,
    zBase: Math.min(invertStart, invertEnd),
    zTop: Math.max(zGround, zEndGround),
    collision: "none",
    sim: { capacity: spec.width * spec.depth, permeability: spec.permeability, roughness: spec.roughness },
    props: { depth: spec.depth, invert: [invertStart, invertEnd], outfall: outfall?.id || null }
  }];
}
function contourLine(world, at, length, clearance = 0) {
  const t = world.place.terrain;
  let dir = [1, 0];
  if (t) {
    const s = t.slopeAt(at[0], at[1]);
    if (s.grade > 1e-4) dir = norm(perp([s.dzdx / s.grade, s.dzdy / s.grade]));
  }
  const a = freeStart(world, [at[0] - dir[0] * length / 2, at[1] - dir[1] * length / 2], clearance);
  const b = freeStart(world, [at[0] + dir[0] * length / 2, at[1] + dir[1] * length / 2], clearance);
  return routeAcross(world, a, b, { climbPenalty: 2, clearance });
}
function freeStart(world, at, clearance, region = null) {
  const occupied = (p) => {
    const z = world.place.groundAt(p[0], p[1]);
    const probe = circleRing(p[0], p[1], Math.max(0.6, clearance), 10);
    return world.index.overlapping(probe, z - 1.5, z + 3).some((id) => {
      const e = world.get(id);
      return e && e.collision === "solid";
    });
  };
  if (!occupied(at)) return at.slice();
  for (let r = 2; r <= 24; r += 2) {
    for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI * 2;
      const p = [at[0] + Math.cos(ang) * r, at[1] + Math.sin(ang) * r];
      if (region && !pointInRing2(p, region)) continue;
      if (!occupied(p)) return p;
    }
  }
  return at.slice();
}
function findOutfall(world, from, reach, zHere) {
  let best = null;
  for (const e of world.entities()) {
    if (!["drain", "stream", "water"].includes(e.type)) continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    const c = e.path ? closestOnRing(from, e.path, false) : closestOnRing(from, ring3);
    if (c.d > reach) continue;
    const z = e.props?.invert ? Math.min(...e.props.invert) : e.zBase;
    if (z > zHere - 0.15) continue;
    const score = c.d + (z - zHere) * 6;
    if (!best || score < best.score) best = { id: e.id, point: c.point, z, d: c.d, score };
  }
  return best;
}
function routeAcross(world, start, goal, opts = {}) {
  const want = opts.clearance || 0;
  for (const clearance of [want, want * 0.5, 0]) {
    const r = routeOnce(world, start, goal, { ...opts, clearance });
    if (r) return r;
  }
  return [start.slice(), goal.slice()];
}
function routeOnce(world, start, goal, { cell = 2.5, avoid = ["structure", "wall"], climbPenalty = 14, clearance = 0 } = {}) {
  const b = world.place.bounds();
  const x0 = Math.min(b[0], start[0], goal[0]) - cell, y0 = Math.min(b[1], start[1], goal[1]) - cell;
  const nx = Math.ceil((Math.max(b[2], start[0], goal[0]) + cell - x0) / cell);
  const ny = Math.ceil((Math.max(b[3], start[1], goal[1]) + cell - y0) / cell);
  const cx = (i) => x0 + (i + 0.5) * cell, cy = (j) => y0 + (j + 0.5) * cell;
  const idx = (i, j) => j * nx + i;
  const blocked = new Uint8Array(nx * ny);
  for (const e of world.entities()) {
    if (!avoid.includes(e.type)) continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    const pad = clearance + cell * 0.5;
    const rb = bbox(ring3);
    for (let j = Math.max(0, Math.floor((rb[1] - pad - y0) / cell)); j <= Math.min(ny - 1, Math.ceil((rb[3] + pad - y0) / cell)); j++) {
      for (let i = Math.max(0, Math.floor((rb[0] - pad - x0) / cell)); i <= Math.min(nx - 1, Math.ceil((rb[2] + pad - x0) / cell)); i++) {
        const p = [cx(i), cy(j)];
        if (pointInRing2(p, ring3) || closestOnRing(p, ring3).d <= pad) blocked[idx(i, j)] = 1;
      }
    }
  }
  const si = Math.max(0, Math.min(nx - 1, Math.floor((start[0] - x0) / cell)));
  const sj = Math.max(0, Math.min(ny - 1, Math.floor((start[1] - y0) / cell)));
  const gi = Math.max(0, Math.min(nx - 1, Math.floor((goal[0] - x0) / cell)));
  const gj = Math.max(0, Math.min(ny - 1, Math.floor((goal[1] - y0) / cell)));
  blocked[idx(si, sj)] = 0;
  blocked[idx(gi, gj)] = 0;
  const h = (i, j) => Math.hypot(cx(i) - goal[0], cy(j) - goal[1]);
  const g = new Float64Array(nx * ny).fill(Infinity);
  const from = new Int32Array(nx * ny).fill(-1);
  const open2 = new MinHeap();
  open2.push(h(si, sj), idx(si, sj));
  g[idx(si, sj)] = 0;
  const closed = new Uint8Array(nx * ny);
  let found = false;
  let guard = 0;
  while (open2.size && guard++ < nx * ny * 8) {
    const u = open2.pop();
    if (closed[u]) continue;
    closed[u] = 1;
    if (u === idx(gi, gj)) {
      found = true;
      break;
    }
    const ui = u % nx, uj = (u - ui) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const vi = ui + di, vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= nx || vj >= ny) continue;
      const v = idx(vi, vj);
      if (blocked[v] || closed[v]) continue;
      const step = Math.hypot(di, dj) * cell;
      const climb = Math.max(0, world.place.groundAt(cx(vi), cy(vj)) - world.place.groundAt(cx(ui), cy(uj)));
      const ng = g[u] + step + climb * climbPenalty;
      if (ng < g[v]) {
        g[v] = ng;
        from[v] = u;
        open2.push(ng + h(vi, vj), v);
      }
    }
  }
  if (!found) return null;
  const pts = [];
  let cur = idx(gi, gj);
  while (cur !== -1) {
    const i = cur % nx, j = (cur - i) / nx;
    pts.unshift([cx(i), cy(j)]);
    cur = from[cur];
  }
  pts[0] = start.slice();
  pts[pts.length - 1] = goal.slice();
  const clear = (a, b2) => {
    const n = Math.max(2, Math.ceil(dist(a, b2) / (cell * 0.5)));
    for (let s = 0; s <= n; s++) {
      const p = lerp2(a, b2, s / n);
      const i = Math.floor((p[0] - x0) / cell), j = Math.floor((p[1] - y0) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      if (blocked[idx(i, j)]) return false;
    }
    return true;
  };
  return simplifyRoute(pts, cell * 0.6, clear);
}
var MinHeap = class {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.v.length;
  }
  push(key2, val) {
    this.k.push(key2);
    this.v.push(val);
    let i = this.v.length - 1;
    while (i > 0) {
      const p = i - 1 >> 1;
      if (this.k[p] <= this.k[i]) break;
      [this.k[p], this.k[i]] = [this.k[i], this.k[p]];
      [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
      i = p;
    }
  }
  pop() {
    const top = this.v[0];
    const lk = this.k.pop(), lv = this.v.pop();
    if (this.v.length) {
      this.k[0] = lk;
      this.v[0] = lv;
      let i = 0;
      for (; ; ) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.v.length && this.k[l] < this.k[m]) m = l;
        if (r < this.v.length && this.k[r] < this.k[m]) m = r;
        if (m === i) break;
        [this.k[m], this.k[i]] = [this.k[i], this.k[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return top;
  }
};
function simplifyRoute(pts, tol, clear = () => true) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const d = Math.abs(cross(sub(b, a), sub(c, a))) / Math.max(1e-6, dist(a, c));
    if (d > tol || !clear(a, c)) out.push(b);
  }
  const last = pts[pts.length - 1];
  if (!clear(out[out.length - 1], last)) out.push(pts[pts.length - 2]);
  out.push(last);
  return out;
}
function placeBox(world, ctx, spec) {
  const onRoof = ctx.onRoof && ctx.roofOf;
  if (onRoof) {
    const host = world.get(ctx.roofOf);
    const roof = world.ringOf(host);
    const inner = offsetRing(roof, -0.6);
    const cands2 = findPlacement(world, {
      region: inner,
      point: ctx.point || centroid(inner),
      size: spec.size,
      zBase: host.zTop,
      avoidTypes: ["structure"],
      corridors: ctx.corridors || [],
      keepClearOf: ctx.keepClearOf || [],
      seedName: `roof:${ctx.seed}`,
      prefer: "center"
    });
    const pick3 = cands2[0];
    const ring4 = pick3 ? pick3.ring : rectRing(...centroid(inner), spec.size[0], spec.size[1], orientedBounds(roof).angle);
    return [{
      ...spec,
      footprint: ring4,
      zBase: host.zTop,
      zTop: host.zTop + spec.height,
      parent: host.id,
      props: { ...spec.props || {}, onRoofOf: host.id },
      alternatives: cands2.slice(1, 4).map((c) => c.ring)
    }];
  }
  const exact = !ctx.region && ctx.point;
  const cands = exact ? [] : findPlacement(world, {
    region: ctx.region,
    point: ctx.point,
    size: spec.size,
    zBase: ctx.zBase ?? 0,
    corridors: ctx.corridors || [],
    keepClearOf: ctx.keepClearOf || [],
    seedName: `place:${ctx.seed}`,
    prefer: ctx.prefer || "open"
  });
  const pick2 = cands[0];
  const center = pick2 ? pick2.center : ctx.point || centroid(ctx.region);
  const angle = pick2 ? pick2.angle : alignmentAt(world, center).angle;
  const ring3 = pick2 ? pick2.ring : rectRing(center[0], center[1], spec.size[0], spec.size[1], angle);
  const z = ctx.zBase ?? world.place.groundAt(center[0], center[1]);
  return [{
    ...spec,
    footprint: ring3,
    zBase: z,
    zTop: z + spec.height,
    alternatives: cands.slice(1, 4).map((c) => c.ring),
    placementScore: pick2?.score ?? null
  }];
}
function downhillLine(world, start, length, step = 3) {
  const t = world.place.terrain;
  if (!t) return [start.slice(), [start[0] + length, start[1]]];
  const pts = [start.slice()];
  let p = start.slice();
  let h = t.heightAt(p[0], p[1]);
  let dir = null;
  for (let i = 0; i < Math.round(length / step); i++) {
    const s = t.slopeAt(p[0], p[1]);
    if (s.grade < 1e-5) break;
    const grad = [-s.dzdx / s.grade, -s.dzdy / s.grade];
    let d = dir ? norm([grad[0] * 0.45 + dir[0] * 0.55, grad[1] * 0.45 + dir[1] * 0.55]) : grad;
    let q = [p[0] + d[0] * step, p[1] + d[1] * step];
    let hq = t.heightAt(q[0], q[1]);
    if (hq >= h - 1e-4) {
      d = grad;
      q = [p[0] + d[0] * step, p[1] + d[1] * step];
      hq = t.heightAt(q[0], q[1]);
      if (hq >= h - 1e-4) break;
    }
    dir = d;
    p = q;
    h = hq;
    pts.push(p.slice());
  }
  if (pts.length >= 2) return pts;
  let best = null;
  for (let a = 0; a < 24; a++) {
    const ang = a / 24 * Math.PI * 2;
    const q = [start[0] + Math.cos(ang) * length, start[1] + Math.sin(ang) * length];
    const hq = t.heightAt(q[0], q[1]);
    if (!best || hq < best.h) best = { q, h: hq };
  }
  return [start.slice(), best.q];
}
function walkableLine(world, start, region, clearance) {
  const a = alignmentAt(world, start).angle;
  const bb = region ? bbox(region) : null;
  const half = bb ? Math.max(6, Math.min(bb[2] - bb[0], bb[3] - bb[1]) * 0.36) : 9;
  const from = freeStart(world, [start[0] - Math.cos(a) * half, start[1] - Math.sin(a) * half], clearance, region);
  const to = freeStart(world, [start[0] + Math.cos(a) * half, start[1] + Math.sin(a) * half], clearance, region);
  return routeAcross(world, from, to, { clearance, climbPenalty: 4 });
}
function shrinkToFree(world, region, avoid) {
  const c = centroid(region);
  const ground = world.place.groundAt(c[0], c[1]);
  for (const inset of [0, 0.5, 1.5, 3]) {
    const ring3 = inset ? offsetRing(region, -inset) : region;
    if (area(ring3) < 2) continue;
    const bad = world.index.overlapping(ring3, ground - 2, ground + 4).some((id) => {
      const e = world.get(id);
      return e && avoid.includes(e.type);
    });
    if (!bad) return ring3;
  }
  return null;
}

// src/places/index.js
var PLACES = [
  { key: "settlement", name: "Baba Dogo \u2014 dense settlement", scale: "neighbourhood", anchor: [-1.2361, 36.8791] },
  { key: "house", name: "One house \u2014 rooms and openings", scale: "building", anchor: [-1.236, 36.878] },
  { key: "block", name: "City block", scale: "district", anchor: [40.7128, -74.006] },
  { key: "school", name: "School and its yard", scale: "campus", anchor: [-1.29, 36.82] },
  { key: "rural", name: "Rural road and farms", scale: "landscape", anchor: [-0.6, 37.2] },
  { key: "forest", name: "Forest and clearing", scale: "landscape", anchor: [45.5, -122.6] },
  { key: "coast", name: "Coastline", scale: "landscape", anchor: [-4.04, 39.67] },
  { key: "field", name: "Empty field", scale: "landscape", anchor: [52.37, 4.9] },
  { key: "fiction", name: "A place that does not exist", scale: "invented", anchor: [0, 0] }
];
function buildPlace(key2 = "settlement") {
  const def = PLACES.find((p) => p.key === key2) || PLACES[0];
  const place2 = new Place({ id: def.key, name: def.name, anchor: def.anchor, seed: hash2(def.key) });
  const rnd = stream(`terrain:${def.key}`, place2.seed);
  const builders = { settlement, house: house2, block, school, rural, forest, coast, field, fiction };
  const world = builders[def.key](place2, rnd);
  world.reindex(true);
  return world;
}
var hash2 = (s) => [...s].reduce((h, c) => h * 31 + c.charCodeAt(0) >>> 0, 7);
function terrainFor(place2, bounds, cell, fn) {
  const hf = new Heightfield(bounds, cell);
  for (let j = 0; j < hf.ny; j++) {
    for (let i = 0; i < hf.nx; i++) {
      const x = bounds[0] + i * cell, y = bounds[1] + j * cell;
      hf.data[hf.idx(i, j)] = fn(x, y);
    }
  }
  place2.terrain = hf;
  return hf;
}
function smoothNoise(rnd, octaves = 3) {
  const grids = [];
  for (let o = 0; o < octaves; o++) {
    const n = 4 << o;
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    grids.push({ n, g });
  }
  return (u, v) => {
    let sum = 0, amp = 1, norm2 = 0;
    for (const { n, g } of grids) {
      const x = u * (n - 1), y = v * (n - 1);
      const i = Math.max(0, Math.min(n - 2, Math.floor(x))), j = Math.max(0, Math.min(n - 2, Math.floor(y)));
      const tx = x - i, ty = y - j;
      const s = (t) => t * t * (3 - 2 * t);
      const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
      const v1 = a + (b - a) * s(tx), v2 = c + (d - c) * s(tx);
      sum += (v1 + (v2 - v1) * s(ty)) * amp;
      norm2 += amp;
      amp *= 0.45;
    }
    return sum / norm2;
  };
}
function add2(world, spec) {
  const e = makeEntity({ id: spec.id || world.place.newId(spec.type), source: "seed", epistemic: spec.epistemic || "IMPORTED", ...spec });
  world.place.put(e, "AS_IS");
  return e;
}
function structure(world, cx, cy, w, d, angle, h, extra = {}) {
  const ring3 = rectRing(cx, cy, w, d, angle);
  const z = world.place.groundAt(cx, cy);
  return add2(world, {
    type: "structure",
    footprint: ring3,
    zBase: z,
    zTop: z + h,
    material: "block",
    collision: "solid",
    sim: { permeability: 0, roughness: 0.02 },
    ...extra
  });
}
function line(world, type, pts, width, extra = {}) {
  const z = world.place.groundAt(pts[0][0], pts[0][1]);
  return add2(world, {
    type,
    path: pts,
    width,
    zBase: z,
    zTop: z + (type === "drain" ? 0 : 0.05),
    network: type === "drain" ? "drainage" : type === "road" ? "streets" : "paths",
    collision: "none",
    sim: { permeability: type === "drain" ? 0.05 : 0.2, roughness: 0.02, capacity: type === "drain" ? width * 0.8 : 0 },
    ...extra
  });
}
function trees(world, region, n, seedName, minGap = 4) {
  const rnd = stream(seedName, world.place.seed);
  const bb = bbox(region);
  const placed = [];
  let guard = 0;
  while (placed.length < n && guard++ < n * 200) {
    const x = bb[0] + rnd() * (bb[2] - bb[0]);
    const y = bb[1] + rnd() * (bb[3] - bb[1]);
    if (!pointInRing2([x, y], region)) continue;
    if (placed.some((p) => dist(p, [x, y]) < minGap)) continue;
    const r = 2 + rnd() * 2;
    const z = world.place.groundAt(x, y);
    add2(world, {
      type: "tree",
      name: "Tree",
      footprint: circleRing(x, y, r, 12),
      zBase: z,
      zTop: z + 5 + rnd() * 5,
      collision: "soft",
      sim: { canopy: Math.PI * r * r, permeability: 0.7 },
      props: { canopyRadius: r }
    });
    placed.push([x, y]);
  }
  return placed;
}
function windowsOn(world, host, sides = [0, 2], perSide = 2) {
  const ring3 = world.place.ringOf(host);
  const out = [];
  for (const s of sides) {
    const a = ring3[s % ring3.length], b = ring3[(s + 1) % ring3.length];
    const dir = norm(sub(b, a));
    const n = norm(perp(dir));
    const outward = pointsOutward(ring3, lerp2(a, b, 0.5), n) ? n : mul(n, -1);
    for (let k = 1; k <= perSide; k++) {
      const t = k / (perSide + 1);
      const c = lerp2(a, b, t);
      const w = 1.1;
      const wr = [
        [c[0] - dir[0] * w / 2, c[1] - dir[1] * w / 2],
        [c[0] + dir[0] * w / 2, c[1] + dir[1] * w / 2],
        [c[0] + dir[0] * w / 2 + outward[0] * 0.15, c[1] + dir[1] * w / 2 + outward[1] * 0.15],
        [c[0] - dir[0] * w / 2 + outward[0] * 0.15, c[1] - dir[1] * w / 2 + outward[1] * 0.15]
      ];
      out.push(add2(world, {
        type: "opening",
        subtype: "window",
        name: `Window`,
        footprint: wr,
        zBase: host.zTop - 1.6,
        zTop: host.zTop - 0.4,
        parent: host.id,
        collision: "none",
        props: { normal: outward, width: w }
      }));
    }
  }
  return out;
}
function pointsOutward(ring3, from, n) {
  const probe = [from[0] + n[0] * 0.4, from[1] + n[1] * 0.4];
  return !pointInRing2(probe, ring3);
}
function settlement(place2, rnd) {
  const B = [-90, -70, 90, 70];
  const noise = smoothNoise(rnd, 3);
  terrainFor(place2, B, 2, (x, y) => {
    const u = (x - B[0]) / (B[2] - B[0]), v = (y - B[1]) / (B[3] - B[1]);
    const bowl = 0.9 * Math.exp(-((x + 18) ** 2 / 900 + (y - 6) ** 2 / 700));
    const fall = (B[2] - x) / (B[2] - B[0]) * 1.8;
    return 3.2 + fall - bowl * 1.6 + noise(u, v) * 0.5;
  });
  const world = new World(place2);
  place2.landmarks.set("river", [86, 10]);
  place2.landmarks.set("main road", [0, -58]);
  line(world, "road", [[-88, -56], [-20, -54], [30, -52], [88, -50]], 7, { name: "Baba Dogo Road", use: "through traffic" });
  line(world, "road", [[-60, -53], [-58, -10], [-56, 34]], 5, { name: "Side lane" });
  add2(world, {
    type: "stream",
    name: "Drainage channel",
    network: "drainage",
    path: [[84, -46], [86, 0], [88, 44]],
    width: 5,
    zBase: 1.2,
    zTop: 2.2,
    collision: "none",
    sim: { capacity: 4, permeability: 0.1 }
  });
  line(world, "drain", [[30, -50], [46, -34], [62, -20], [80, -6]], 1.2, { name: "Roadside drain", props: { depth: 0.8 } });
  const rows = [
    { y: -34, n: 9, x0: -76, gap: 15, d: 7, h: 3 },
    { y: -16, n: 9, x0: -72, gap: 15, d: 7, h: 3.2 },
    { y: 4, n: 8, x0: -66, gap: 16, d: 8, h: 3.4 },
    { y: 24, n: 8, x0: -70, gap: 16, d: 7, h: 3 },
    { y: 44, n: 7, x0: -62, gap: 17, d: 7, h: 3.1 }
  ];
  let houseIdx = 0;
  const houses = [];
  for (const r of rows) {
    for (let i = 0; i < r.n; i++) {
      const x = r.x0 + i * r.gap + (rnd() - 0.5) * 2.2;
      const y = r.y + (rnd() - 0.5) * 2;
      const w = 8 + rnd() * 3;
      const s = structure(world, x, y, w, r.d, (rnd() - 0.5) * 0.08, r.h + rnd() * 0.5, {
        name: `House ${++houseIdx}`,
        use: "dwelling",
        material: rnd() > 0.5 ? "iron sheet" : "block"
      });
      houses.push(s);
    }
    line(world, "path", [[-80, r.y + 9], [-20, r.y + 10], [40, r.y + 9], [80, r.y + 8]], 2.2, { name: `Lane ${r.y}` });
  }
  for (const x of [-40, 0, 40]) {
    const pts = routeAcross(world, [x, -52], [x + 1, 56], { cell: 2.5 });
    line(world, "path", pts, 1.8, { name: `Cross path ${x}` });
  }
  add2(world, {
    type: "surface",
    subtype: "open ground",
    name: "Open ground",
    footprint: circleRing(-18, 6, 16, 20),
    zBase: place2.groundAt(-18, 6) - 0.05,
    zTop: place2.groundAt(-18, 6),
    collision: "none",
    sim: { permeability: 0.25, roughness: 0.05 },
    use: "informal market on Saturdays"
  });
  for (let i = 0; i < 6; i++) {
    structure(world, -34 + i * 5.5, -44 + i % 2 * 2, 3, 2.4, 0, 2.4, { type: "market", name: `Stall ${i + 1}`, use: "trade" });
  }
  trees(world, circleRing(46, 26, 26, 16), 14, "settlement:trees", 6);
  trees(world, rectRing(-70, 50, 40, 20, 0), 6, "settlement:trees2", 6);
  for (const h of [houses[13], houses[14], houses[22]]) if (h) windowsOn(world, h, [0, 2], 2);
  const lane = world.entities().find((e) => e.name === "Cross path 0");
  if (lane) {
    add2(world, {
      type: "observation",
      name: "This has not been passable for two years",
      footprint: circleRing(1, 20, 5, 16),
      zBase: place2.groundAt(1, 20),
      zTop: place2.groundAt(1, 20) + 0.02,
      collision: "none",
      epistemic: "DISPUTED",
      author: "Joseph",
      certainty: 0.9,
      evidence: [{ kind: "utterance", text: "that hasn\u2019t been passable for years", lang: "en" }],
      props: { about: [lane.id], condition: "movement" }
    });
    place2.relations.push({ from: "Joseph", kind: "disputedBy", to: lane.id, derived: false });
  }
  return world;
}
function house2(place2, rnd) {
  const B = [-14, -12, 14, 12];
  terrainFor(place2, B, 1, () => 0);
  const world = new World(place2);
  const shell = structure(world, 0, 0, 12, 9, 0, 3, { name: "House", use: "dwelling" });
  const rooms = [
    { n: "Main room", x: -2.6, y: 1.4, w: 6.4, d: 5.6 },
    { n: "Kitchen", x: 3.6, y: 2.2, w: 4.2, d: 4 },
    { n: "Bedroom", x: 3.4, y: -2.6, w: 4.6, d: 3.6 },
    { n: "Store", x: -3.8, y: -3, w: 3.6, d: 2.8 }
  ];
  for (const r of rooms) {
    add2(world, {
      type: "room",
      name: r.n,
      footprint: rectRing(r.x, r.y, r.w, r.d, 0),
      zBase: 0.05,
      zTop: 2.7,
      parent: shell.id,
      collision: "none",
      use: r.n.toLowerCase()
    });
  }
  add2(world, { type: "wall", name: "Partition", footprint: rectRing(0.9, 0, 0.2, 8.4, 0), zBase: 0, zTop: 2.7, parent: shell.id, collision: "solid" });
  windowsOn(world, shell, [0, 1, 2], 2);
  add2(world, { type: "opening", subtype: "door", name: "Front door", footprint: rectRing(-4, -4.5, 1, 0.25, 0), zBase: 0, zTop: 2.1, parent: shell.id, collision: "none", props: { normal: [0, -1], width: 1 } });
  for (const f2 of [
    { n: "Table", x: -2.4, y: 1.2, w: 1.6, d: 0.9, h: 0.75 },
    { n: "Bed", x: 3.4, y: -2.6, w: 1.9, d: 1.4, h: 0.5 },
    { n: "Stove", x: 4.8, y: 3.4, w: 0.7, d: 0.6, h: 0.9 }
  ]) {
    add2(world, { type: "furniture", name: f2.n, footprint: rectRing(f2.x, f2.y, f2.w, f2.d, 0), zBase: 0.05, zTop: 0.05 + f2.h, collision: "soft", parent: shell.id });
  }
  line(world, "path", [[-4, -6], [-4, -11]], 1.1, { name: "Front path" });
  trees(world, circleRing(8, -7, 4, 12), 2, "house:trees", 3);
  return world;
}
function block(place2, rnd) {
  const B = [-120, -100, 120, 100];
  const noise = smoothNoise(rnd, 2);
  terrainFor(place2, B, 3, (x, y) => 8 + noise((x - B[0]) / 240, (y - B[1]) / 200) * 1.2 - x * 4e-3);
  const world = new World(place2);
  place2.landmarks.set("avenue", [0, -92]);
  for (const y of [-92, -20, 52]) line(world, "road", [[-118, y], [0, y + 2], [118, y]], 12, { name: `Street ${y}`, use: "traffic" });
  for (const x of [-96, -30, 36, 100]) line(world, "road", [[x, -98], [x + 2, 0], [x, 98]], 9, { name: `Avenue ${x}` });
  let n = 0;
  for (const [cx, cy] of [[-63, -56], [3, -56], [68, -56], [-63, 16], [3, 16], [68, 16], [-63, 76], [3, 76]]) {
    const w = 44 + rnd() * 10, d = 40 + rnd() * 8;
    const s = structure(world, cx, cy, w, d, 0, 12 + rnd() * 28, { name: `Block ${++n}`, use: n % 3 === 0 ? "commercial" : "residential" });
    add2(world, { type: "parcel", name: `Parcel ${n}`, footprint: rectRing(cx, cy, w + 8, d + 8, 0), zBase: 0, zTop: 0.01, collision: "none", props: { airspace: true, airspaceLimit: 45 } });
    if (n <= 2) windowsOn(world, s, [0, 2], 3);
  }
  for (const y of [-84, -12, 60]) line(world, "path", [[-116, y], [116, y - 1]], 3.5, { name: `Sidewalk ${y}` });
  trees(world, rectRing(0, -84, 220, 6, 0), 18, "block:trees", 9);
  return world;
}
function school(place2, rnd) {
  const B = [-70, -60, 70, 60];
  const noise = smoothNoise(rnd, 2);
  terrainFor(place2, B, 2, (x, y) => 2 + noise((x + 70) / 140, (y + 60) / 120) * 0.8 + y * 6e-3);
  const world = new World(place2);
  for (let i = 0; i < 3; i++) {
    const s = structure(world, -34 + i * 26, 28, 22, 9, 0, 3.6, { name: `Classroom block ${i + 1}`, use: "teaching" });
    windowsOn(world, s, [0, 2], 3);
  }
  structure(world, 34, -4, 14, 10, 0, 4.2, { name: "Hall", use: "assembly" });
  add2(world, { type: "surface", subtype: "yard", name: "Yard", footprint: rectRing(-8, -18, 78, 40, 0), zBase: 1.6, zTop: 1.62, collision: "none", sim: { permeability: 0.15, roughness: 0.03 }, use: "play" });
  line(world, "road", [[-68, -52], [68, -50]], 7, { name: "School road" });
  line(world, "path", [[-34, 22], [-30, -6], [-28, -46]], 2.2, { name: "Main walk" });
  line(world, "path", [[-14, 22], [10, 0], [34, -10]], 1.6, { name: "Yard path" });
  line(world, "drain", [[-60, -40], [-20, -44], [30, -47], [66, -49]], 0.9, { name: "Yard drain", props: { depth: 0.6 } });
  trees(world, rectRing(0, -44, 100, 10, 0), 10, "school:trees", 7);
  return world;
}
function rural(place2, rnd) {
  const B = [-200, -160, 200, 160];
  const noise = smoothNoise(rnd, 3);
  terrainFor(place2, B, 5, (x, y) => 40 + noise((x + 200) / 400, (y + 160) / 320) * 14 - Math.abs(y + 40) * 0.02);
  const world = new World(place2);
  place2.landmarks.set("river", [0, -140]);
  line(world, "road", [[-198, 30], [-60, 12], [70, -8], [198, -26]], 6, { name: "Rural road", material: "murram" });
  add2(world, { type: "stream", name: "River", network: "drainage", path: [[-198, -140], [-40, -128], [90, -136], [198, -150]], width: 12, zBase: 20, zTop: 22, collision: "none", sim: { capacity: 12 } });
  for (let i = 0; i < 5; i++) {
    const x = -150 + i * 70 + rnd() * 20, y = 60 + rnd() * 50;
    structure(world, x, y, 10, 8, rnd() * 0.4, 3.2, { name: `Farmhouse ${i + 1}`, use: "dwelling" });
    add2(world, { type: "parcel", name: `Field ${i + 1}`, footprint: rectRing(x, y - 46, 62, 62, 0), zBase: 0, zTop: 0.01, collision: "none", use: "cultivation" });
    line(world, "path", [[x, y - 6], [x + 4, 20]], 2.5, { name: `Farm track ${i + 1}` });
  }
  trees(world, rectRing(-40, -100, 260, 40, 0), 26, "rural:trees", 12);
  return world;
}
function forest(place2, rnd) {
  const B = [-120, -120, 120, 120];
  const noise = smoothNoise(rnd, 4);
  terrainFor(place2, B, 3, (x, y) => 200 + noise((x + 120) / 240, (y + 120) / 240) * 26 - Math.hypot(x + 30, y - 20) * 0.05);
  const world = new World(place2);
  place2.landmarks.set("creek", [-30, 100]);
  add2(world, { type: "stream", name: "Creek", network: "drainage", path: [[-100, 108], [-30, 96], [40, 104], [110, 92]], width: 3, zBase: 196, zTop: 197, collision: "none", sim: { capacity: 2.5 } });
  line(world, "path", [[-110, -60], [-40, -20], [20, 20], [90, 70]], 1.2, { name: "Trail", material: "dirt" });
  add2(world, { type: "surface", subtype: "clearing", name: "Clearing", footprint: circleRing(-30, 20, 26, 24), zBase: 198, zTop: 198.02, collision: "none", sim: { permeability: 0.8, roughness: 0.4 } });
  trees(world, rectRing(0, 0, 230, 230, 0), 130, "forest:trees", 8);
  structure(world, -28, 18, 4, 3, 0.3, 2.4, { name: "Shelter", material: "timber", use: "shelter" });
  return world;
}
function coast(place2, rnd) {
  const B = [-160, -120, 160, 120];
  const noise = smoothNoise(rnd, 3);
  terrainFor(place2, B, 3, (x, y) => {
    const shore = y * 0.06 + Math.sin(x / 40) * 3;
    return Math.max(-2, shore + noise((x + 160) / 320, (y + 120) / 240) * 2.4);
  });
  const world = new World(place2);
  place2.landmarks.set("sea", [0, -110]);
  add2(world, { type: "water", name: "Sea", footprint: [[-160, -120], [160, -120], [160, -34], [-160, -46]], zBase: -2, zTop: 0, collision: "none", sim: { capacity: 999 } });
  line(world, "road", [[-158, 44], [0, 36], [158, 42]], 6, { name: "Coast road" });
  line(world, "path", [[-120, 8], [-20, -2], [90, 6]], 1.6, { name: "Beach path" });
  for (let i = 0; i < 7; i++) {
    const x = -120 + i * 38 + rnd() * 10;
    structure(world, x, 58 + rnd() * 16, 9, 7, rnd() * 0.3, 3.2, { name: `Beach house ${i + 1}`, use: "dwelling" });
  }
  trees(world, rectRing(0, 20, 280, 26, 0), 22, "coast:trees", 10);
  return world;
}
function field(place2, rnd) {
  const B = [-80, -80, 80, 80];
  const noise = smoothNoise(rnd, 2);
  terrainFor(place2, B, 3, (x, y) => 12 + noise((x + 80) / 160, (y + 80) / 160) * 1.4 - y * 0.01);
  const world = new World(place2);
  line(world, "road", [[-78, -72], [78, -70]], 5, { name: "Field road" });
  add2(world, { type: "parcel", name: "The field", footprint: rectRing(0, 4, 140, 120, 0), zBase: 0, zTop: 0.01, collision: "none", use: "unbuilt" });
  trees(world, circleRing(-58, 56, 10, 14), 3, "field:trees", 6);
  return world;
}
function fiction(place2, rnd) {
  const B = [-100, -100, 100, 100];
  const noise = smoothNoise(rnd, 4);
  terrainFor(place2, B, 2.5, (x, y) => {
    const r = Math.hypot(x, y);
    return 20 + Math.sin(r / 9) * 4 * Math.exp(-r / 90) + noise((x + 100) / 200, (y + 100) / 200) * 6;
  });
  const world = new World(place2);
  place2.landmarks.set("the well", [0, 0]);
  add2(world, { type: "water", name: "The well", footprint: circleRing(0, 0, 6, 24), zBase: 14, zTop: 18, collision: "none", sim: { capacity: 20 } });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const r = 34 + i % 3 * 12;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    structure(world, x, y, 7 + i % 3 * 2, 7, a, 4 + i % 4 * 2.5, { name: `Tower ${i + 1}`, material: "stone", use: "unknown" });
    line(world, "path", [[Math.cos(a) * 8, Math.sin(a) * 8], [x, y]], 1.6, { name: `Spoke ${i + 1}` });
  }
  add2(world, { type: "path", name: "Ring walk", network: "paths", path: circleRing(0, 0, 46, 28).concat([circleRing(0, 0, 46, 28)[0]]), width: 2, zBase: place2.groundAt(46, 0), zTop: place2.groundAt(46, 0) + 0.05, collision: "none" });
  trees(world, circleRing(0, 0, 90, 24), 30, "fiction:trees", 9);
  return world;
}

// src/places/imported.js
var cache = null;
var shipped = () => typeof window !== "undefined" && window.__SHIPPED_PLACES__ || null;
async function listImported(base = "./places") {
  if (cache) return cache;
  const s = shipped();
  if (s?.index) return cache = s.index.map((p) => ({ ...p, imported: true }));
  try {
    const res = await fetch(`${base}/index.json`, { cache: "no-store" });
    if (!res.ok) return cache = [];
    const list = await res.json();
    return cache = list.map((p) => ({ ...p, imported: true }));
  } catch {
    return cache = [];
  }
}
async function loadImported(key2, base = "./places") {
  const s = shipped();
  if (s?.worlds?.[key2]) return World.load(s.worlds[key2]);
  const res = await fetch(`${base}/${key2}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`no imported place "${key2}"`);
  return World.load(await res.text());
}
function attribution(world) {
  const m = world.place.meta;
  if (!m?.source) return null;
  return `${world.place.name} \u2014 ${m.licence}. Fetched ${m.fetchedAt?.slice(0, 10)}. Elevation: ${m.elevation}.`;
}

// src/import/osm.js
function localBounds(projection, bbox2) {
  const a = projection.toLocal(bbox2[0], bbox2[1]);
  const b = projection.toLocal(bbox2[2], bbox2[3]);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}
var MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];
function overpassQuery(bbox2) {
  const b = bbox2.join(",");
  return `[out:json][timeout:90];
(
  way["building"](${b});
  relation["building"](${b});
  way["highway"](${b});
  way["waterway"](${b});
  relation["waterway"](${b});
  way["natural"~"water|wood|scrub|wetland|bay|strait|beach|coastline"](${b});
  relation["natural"~"water|wetland|bay"](${b});
  way["landuse"~"reservoir|basin"](${b});
  way["landuse"](${b});
  way["barrier"~"wall|fence|retaining_wall"](${b});
  way["railway"](${b});
  way["leisure"](${b});
  node["natural"="tree"](${b});
  node["amenity"](${b});
  node["shop"](${b});
  node["tourism"](${b});
  node["highway"="bus_stop"](${b});
  node["place"](${b});
);
out geom tags;`;
}
var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchOSM(bbox2, opts = {}) {
  const { mirrors = MIRRORS, fetchImpl = fetch, rounds = 4, log = () => {
  } } = opts;
  let lastError = null;
  for (let round2 = 0; round2 < rounds; round2++) {
    for (const url of mirrors) {
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "CREO/0.1 (place import; github.com/hartswf0/motor)"
          },
          body: new URLSearchParams({ data: (opts.query || overpassQuery)(bbox2) })
        });
        if (res.status === 429 || res.status === 504 || res.status === 503) {
          lastError = new Error(`${new URL(url).host} \u2192 ${res.status}`);
          log(`${new URL(url).host} is busy (${res.status})`);
          continue;
        }
        if (!res.ok) {
          lastError = new Error(`${new URL(url).host} \u2192 ${res.status}`);
          continue;
        }
        const json = await res.json();
        if (!json.elements) {
          lastError = new Error(`${new URL(url).host} \u2192 no elements`);
          continue;
        }
        return { json, mirror: url };
      } catch (err) {
        lastError = err;
        log(`${new URL(url).host}: ${err.message.slice(0, 60)}`);
      }
    }
    if (round2 < rounds - 1) {
      const wait = 8e3 * (round2 + 1);
      log(`all mirrors busy; waiting ${wait / 1e3}s before retrying`);
      await sleep2(wait);
    }
  }
  throw new Error(`every Overpass mirror failed after ${rounds} rounds: ${lastError?.message || "unknown"}`);
}
var ROAD_WIDTH = {
  motorway: 14,
  trunk: 12,
  primary: 10,
  secondary: 8.5,
  tertiary: 7,
  unclassified: 5.5,
  residential: 5.5,
  service: 4,
  living_street: 5,
  pedestrian: 4,
  footway: 1.8,
  path: 1.4,
  track: 3.2,
  cycleway: 2,
  steps: 1.6
};
var PATH_KINDS = /* @__PURE__ */ new Set(["footway", "path", "pedestrian", "steps", "cycleway", "track"]);
var WATERWAY_KIND = {
  river: "river",
  stream: "stream",
  canal: "canal",
  drain: "drain",
  ditch: "ditch",
  brook: "stream",
  tidal_channel: "channel"
};
function waterKind(tags) {
  if (tags.natural === "coastline") return "coastline";
  if (tags.natural === "bay" || tags.natural === "strait") return "bay";
  if (tags.landuse === "reservoir" || tags.landuse === "basin") return "reservoir";
  if (tags.natural === "wetland") return "wetland";
  if (tags.natural === "water") return tags.water || "lake";
  if (tags.waterway) return WATERWAY_KIND[tags.waterway] || "stream";
  return null;
}
var IS_DRAINAGE = /* @__PURE__ */ new Set(["drain", "ditch", "canal"]);
function buildingHeight(tags) {
  const h = parseFloat(tags["height"] || tags["building:height"]);
  if (Number.isFinite(h) && h > 0) return { height: h, basis: "height tag" };
  const levels = parseFloat(tags["building:levels"] || tags["levels"]);
  if (Number.isFinite(levels) && levels > 0) return { height: levels * 3.1, basis: `${levels} levels \xD7 3.1 m` };
  const kind = tags["building"];
  const guess = { house: 4, residential: 6, apartments: 12, hut: 2.6, shed: 2.6, garage: 2.6, industrial: 8, warehouse: 8, commercial: 7, retail: 6, school: 7, church: 9, roof: 3 }[kind];
  return { height: guess ?? 5, basis: "assumed from building type \u2014 no height in OSM" };
}
function osmToPlace(osm, { key: key2, name, bbox: bbox2, terrain = null, fetchedAt = null, mirror = null }) {
  const anchor = [(bbox2[0] + bbox2[2]) / 2, (bbox2[1] + bbox2[3]) / 2];
  const place2 = new Place({ id: key2, name, anchor, seed: 1 });
  place2.meta = {
    source: "OpenStreetMap",
    licence: "ODbL \u2014 \xA9 OpenStreetMap contributors",
    bbox: bbox2,
    fetchedAt,
    mirror,
    elevation: terrain ? terrain.attribution : "none \u2014 treated as flat",
    relief: terrain ? terrain.relief : 0,
    datum: terrain ? terrain.datum : null
  };
  const P = place2.projection;
  const cm = (v) => Math.round(v * 100) / 100;
  const toLocal = (n) => {
    const [x, y] = P.toLocal(n.lat, n.lon);
    return [cm(x), cm(y)];
  };
  const bounds = localBounds(P, bbox2);
  const pad = 0.06 * Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  const window_ = [bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad];
  place2.terrain = terrain ? terrain.heightfield : new Heightfield(bounds, 10);
  const world = new World(place2);
  const stats2 = { buildings: 0, roads: 0, paths: 0, water: 0, surfaces: 0, trees: 0, walls: 0, skipped: 0 };
  const coastlines = [];
  const KEEP_TAGS = [
    "name",
    "building",
    "building:levels",
    "height",
    "roof:shape",
    "roof:height",
    "building:colour",
    "building:material",
    "highway",
    "waterway",
    "natural",
    "water",
    "landuse",
    "surface",
    "width",
    "lanes",
    "amenity",
    "shop",
    "barrier",
    "railway",
    "addr:street",
    "addr:housenumber"
  ];
  const slimTags = (tags = {}) => {
    const out = {};
    for (const k of KEEP_TAGS) if (tags[k] !== void 0) out[k] = tags[k];
    return out;
  };
  const add3 = (spec, el) => {
    const { id: specId, ...rest } = spec;
    const e = makeEntity({
      id: specId || `osm_${el.type[0]}${el.id}`,
      source: "OpenStreetMap",
      epistemic: "IMPORTED",
      author: "OpenStreetMap contributors",
      evidence: [{ kind: "osm", ref: `${el.type}/${el.id}`, fetchedAt }],
      props: { osm: { type: el.type, id: el.id, tags: slimTags(el.tags) } },
      ...rest
    });
    place2.put(e, "AS_IS");
    return e;
  };
  for (const el of osm.elements) {
    const tags = el.tags || {};
    if (el.type === "node") {
      const poiKind = tags.amenity || tags.shop || tags.tourism || (tags.highway === "bus_stop" ? "bus stop" : null) || tags.place;
      if (poiKind && tags.natural !== "tree") {
        const [x, y] = toLocal(el);
        if (!inWindow([x, y], window_)) {
          stats2.skipped++;
          continue;
        }
        const z = place2.groundAt(x, y);
        add3({
          type: "marker",
          subtype: String(poiKind),
          name: tags.name || String(poiKind).replace(/_/g, " "),
          footprint: circleRing(x, y, 1.1, 8),
          zBase: z,
          zTop: z + 2.2,
          collision: "none",
          use: String(poiKind).replace(/_/g, " "),
          props: { poi: true, osm: { type: el.type, id: el.id, tags: slimTags(tags) } }
        }, el);
        stats2.markers = (stats2.markers || 0) + 1;
        continue;
      }
      if (tags.natural === "tree") {
        const [x, y] = toLocal(el);
        const z = place2.groundAt(x, y);
        add3({
          type: "tree",
          name: tags.species || "Tree",
          footprint: circleRing(x, y, 2.6, 12),
          zBase: z,
          zTop: z + 7,
          collision: "soft",
          sim: { canopy: 21, permeability: 0.7 },
          props: { canopyRadius: 2.6 }
        }, el);
        stats2.trees++;
      }
      continue;
    }
    if (el.type === "relation") {
      const outers = (el.members || []).filter((m) => m.role !== "inner" && m.geometry && m.geometry.length > 2);
      if (!outers.length) {
        stats2.skipped++;
        continue;
      }
      const kind = waterKind(tags);
      for (const [mi, m] of outers.entries()) {
        const ringM = dedupeRing2(m.geometry.map(toLocal));
        if (ringM.length < 3) continue;
        const trimmedM = clipRing(ringM, window_);
        if (!trimmedM || area(trimmedM) < 6) continue;
        const cM = centroid(trimmedM);
        const zM = place2.groundAt(cM[0], cM[1]);
        if (kind) {
          add3({
            id: `osm_r${el.id}_${mi}`,
            type: "water",
            subtype: kind,
            name: tags.name || null,
            footprint: trimmedM,
            zBase: zM - depthFor(kind),
            zTop: zM,
            collision: "none",
            network: IS_DRAINAGE.has(kind) ? "drainage" : null,
            sim: { capacity: 999, permeability: 0.02 }
          }, el);
          stats2.water++;
        } else if (tags.building) {
          add3({
            id: `osm_r${el.id}_${mi}`,
            type: "structure",
            name: tags.name || "Building",
            footprint: trimmedM,
            ...(() => {
              const sp = groundSpan(trimmedM, (x, y) => place2.groundAt(x, y)) || { lo: zM, hi: zM };
              const hgt = buildingHeight(tags).height;
              return { zBase: sp.lo, zTop: sp.hi + hgt, height: hgt, groundFall: +(sp.hi - sp.lo).toFixed(2) };
            })(),
            collision: "solid",
            sim: { permeability: 0, roughness: 0.02 },
            props: { heightBasis: buildingHeight(tags).basis, osm: { type: el.type, id: el.id, tags: slimTags(tags) } }
          }, el);
          stats2.buildings++;
        }
      }
      continue;
    }
    const geom = el.geometry;
    if (!geom || geom.length < 2) {
      stats2.skipped++;
      continue;
    }
    const fullLine = geom.map(toLocal);
    const line2 = fullLine;
    const closed = geom.length > 2 && Math.abs(geom[0].lat - geom.at(-1).lat) < 1e-9 && Math.abs(geom[0].lon - geom.at(-1).lon) < 1e-9;
    const ring3 = closed ? dedupeRing2(line2) : null;
    if (tags.building || tags["building:part"]) {
      if (!ring3 || ring3.length < 3 || area(ring3) < 2) {
        stats2.skipped++;
        continue;
      }
      const c0 = centroid(ring3);
      if (!inWindow(c0, window_)) {
        stats2.skipped++;
        continue;
      }
      const trimmed = clipRing(ring3, window_);
      if (!trimmed || area(trimmed) < 2) {
        stats2.skipped++;
        continue;
      }
      const c = centroid(trimmed);
      const { height, basis } = buildingHeight(tags);
      const span = groundSpan(trimmed, (x, y) => place2.groundAt(x, y)) || { lo: place2.groundAt(c[0], c[1]), hi: place2.groundAt(c[0], c[1]) };
      const fall = span.hi - span.lo;
      const roofH = parseFloat(tags["roof:height"]);
      const roof = {
        shape: tags["roof:shape"] || null,
        // A roof's height is part of the building's, not on top of it.
        height: Number.isFinite(roofH) ? Math.min(roofH, height * 0.6) : null,
        colour: tags["roof:colour"] || null,
        material: tags["roof:material"] || null
      };
      const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || null;
      add3({
        type: "structure",
        name: tags.name || address || "Building",
        footprint: trimmed,
        zBase: span.lo,
        zTop: span.hi + height,
        // the height it was given, kept apart from the extent it now occupies
        height,
        groundFall: +fall.toFixed(2),
        use: tags.amenity || tags.shop || tags.office || tags.building,
        material: tags["building:material"] || tags["building"] || null,
        collision: "solid",
        sim: { permeability: 0, roughness: 0.02 },
        props: {
          heightBasis: basis,
          roof,
          address,
          colour: tags["building:colour"] || null,
          levels: parseFloat(tags["building:levels"]) || null,
          osm: { type: el.type, id: el.id, tags: slimTags(tags) }
        }
      }, el);
      stats2.buildings++;
      continue;
    }
    if (tags.railway && !tags.highway) {
      const pieces = clipToBox(fullLine, window_);
      if (!pieces.length) {
        stats2.skipped++;
        continue;
      }
      const line3 = pieces[0];
      const z = place2.groundAt(line3[0][0], line3[0][1]);
      add3({
        type: "rail",
        name: tags.name || tags.railway.replace(/_/g, " "),
        path: line3,
        width: tags.railway === "tram" ? 3 : 4.5,
        zBase: z,
        zTop: z + 0.3,
        network: "rail",
        collision: "none"
      }, el);
      stats2.rail = (stats2.rail || 0) + 1;
      continue;
    }
    if (tags.highway) {
      const isPath = PATH_KINDS.has(tags.highway);
      const width = parseFloat(tags.width) || (parseFloat(tags.lanes) ? parseFloat(tags.lanes) * 3.2 : null) || ROAD_WIDTH[tags.highway] || 5;
      const pieces = clipToBox(fullLine, window_);
      if (!pieces.length) {
        stats2.skipped++;
        continue;
      }
      for (const [pi, piece] of pieces.entries()) {
        const z = place2.groundAt(piece[0][0], piece[0][1]);
        add3({
          // An unnamed lane is unnamed. Calling it "residential" would put a
          // street name in the world that nobody uses.
          id: pieces.length > 1 ? `osm_${el.type[0]}${el.id}_${pi}` : void 0,
          type: isPath ? "path" : "road",
          name: tags.name || null,
          path: piece,
          width,
          zBase: z,
          zTop: z + 0.05,
          network: isPath ? "paths" : "streets",
          use: tags.highway.replace(/_/g, " "),
          collision: "none",
          sim: { permeability: tags.surface === "unpaved" || tags.surface === "ground" ? 0.4 : 0.15, roughness: 0.02 },
          props: { surface: tags.surface || null, osm: { type: el.type, id: el.id, tags: slimTags(tags) } }
        }, el);
        isPath ? stats2.paths++ : stats2.roads++;
      }
      continue;
    }
    if (tags.natural === "coastline") {
      coastlines.push(fullLine);
      stats2.water++;
      continue;
    }
    if (tags.waterway) {
      const width = parseFloat(tags.width) || (tags.waterway === "river" ? 12 : tags.waterway === "stream" ? 3 : 1.5);
      const pieces = clipToBox(fullLine, window_);
      if (!pieces.length) {
        stats2.skipped++;
        continue;
      }
      for (const line22 of pieces) {
        const z = place2.groundAt(line22[0][0], line22[0][1]);
        const kind = waterKind(tags) || "stream";
        add3({
          type: IS_DRAINAGE.has(kind) && kind !== "canal" ? "drain" : "water",
          subtype: kind,
          name: tags.name || null,
          use: tags.waterway,
          path: line22,
          width,
          zBase: z - depthFor(kind),
          zTop: z,
          network: "drainage",
          collision: "none",
          sim: { capacity: width * 0.8, permeability: 0.1 }
        }, el);
        stats2.water++;
      }
      continue;
    }
    if (ring3 && ring3.length >= 3 && area(ring3) > 4) {
      const trimmed = clipRing(ring3, window_);
      if (!trimmed || area(trimmed) < 4) {
        stats2.skipped++;
        continue;
      }
      const c = centroid(trimmed);
      const z = place2.groundAt(c[0], c[1]);
      const areaKind = waterKind(tags);
      if (areaKind) {
        add3({
          type: "water",
          subtype: areaKind,
          name: tags.name || null,
          footprint: trimmed,
          zBase: z - depthFor(areaKind),
          zTop: z,
          collision: "none",
          network: IS_DRAINAGE.has(areaKind) ? "drainage" : null,
          sim: { capacity: 999, permeability: 0.02 }
        }, el);
        stats2.water++;
      } else if (tags.barrier) {
        const wallSpan = groundSpan(trimmed, (x, y) => place2.groundAt(x, y)) || { lo: z, hi: z };
        add3({ type: "wall", name: tags.barrier, footprint: trimmed, zBase: wallSpan.lo, zTop: wallSpan.hi + 2, collision: "solid" }, el);
        stats2.walls++;
      } else {
        const permeable = /grass|wood|forest|meadow|scrub|farmland|park|recreation|cemetery|allotments|village_green/.test(`${tags.landuse} ${tags.natural} ${tags.leisure}`);
        add3({
          type: "surface",
          subtype: tags.landuse || tags.natural || "ground",
          name: tags.name || tags.landuse || tags.natural || "Ground",
          footprint: trimmed,
          zBase: z - 0.02,
          zTop: z,
          collision: "none",
          sim: { permeability: permeable ? 0.7 : 0.2, roughness: permeable ? 0.3 : 0.05 }
        }, el);
        stats2.surfaces++;
      }
      continue;
    }
    if (tags.barrier && fullLine.length >= 2) {
      const pieces = clipToBox(fullLine, window_);
      if (!pieces.length) {
        stats2.skipped++;
        continue;
      }
      const z = place2.groundAt(pieces[0][0][0], pieces[0][0][1]);
      add3({ type: "wall", name: tags.barrier, path: pieces[0], width: 0.3, zBase: z, zTop: z + 2, collision: "solid" }, el);
      stats2.walls++;
      continue;
    }
    stats2.skipped++;
  }
  if (coastlines.length) {
    const sea = seaFromCoastlines(coastlines, window_);
    for (const [i, ring3] of sea.entries()) {
      const c = centroid(ring3);
      add3({
        id: `sea_${i}`,
        type: "water",
        subtype: "ocean",
        name: "Sea",
        footprint: ring3,
        zBase: -4,
        zTop: 0,
        collision: "none",
        sim: { capacity: 9999, permeability: 0 },
        props: { derivedFrom: "natural=coastline" }
      }, { type: "way", id: `coast${i}`, tags: { natural: "coastline" } });
    }
    if (sea.length) stats2.ocean = sea.length;
  }
  for (const e of place2.entities.values()) {
    const ring3 = place2.ringOf(e);
    if (!ring3 || !e.name || e.name === "Building") continue;
    if (!["stream", "water", "road"].includes(e.type)) continue;
    place2.landmarks.set(e.name.toLowerCase(), centroid(ring3));
  }
  world.dirty = true;
  world.reindex(true);
  return { world, stats: stats2 };
}
var inWindow = (p, box) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];
function clipRing(ring3, box) {
  const edges = [
    { inside: (p) => p[0] >= box[0], cut: (a, b) => cutX(a, b, box[0]) },
    { inside: (p) => p[0] <= box[2], cut: (a, b) => cutX(a, b, box[2]) },
    { inside: (p) => p[1] >= box[1], cut: (a, b) => cutY(a, b, box[1]) },
    { inside: (p) => p[1] <= box[3], cut: (a, b) => cutY(a, b, box[3]) }
  ];
  let out = ring3;
  for (const e of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i - 1 + input.length) % input.length];
      const cin = e.inside(cur), pin = e.inside(prev);
      if (cin) {
        if (!pin) out.push(e.cut(prev, cur));
        out.push(cur);
      } else if (pin) out.push(e.cut(prev, cur));
    }
    if (!out.length) return null;
  }
  return out.length >= 3 ? out : null;
}
var cutX = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0] || 1e-9)];
var cutY = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1] || 1e-9), y];
function clipToBox(line2, box) {
  const runs = [];
  let cur = [];
  const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const push = (p) => {
    if (!cur.length || !near(cur[cur.length - 1], p)) cur.push(p);
  };
  for (let i = 0; i < line2.length - 1; i++) {
    const clipped = clipSegment(line2[i], line2[i + 1], box);
    if (!clipped) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
      continue;
    }
    const [a, b] = clipped;
    if (cur.length && !near(cur[cur.length - 1], a)) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
    }
    push(a);
    push(b);
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}
function clipSegment(p0, p1, box) {
  let t0 = 0, t1 = 1;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const tests = [[-dx, p0[0] - box[0]], [dx, box[2] - p0[0]], [-dy, p0[1] - box[1]], [dy, box[3] - p0[1]]];
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    [p0[0] + dx * t0, p0[1] + dy * t0],
    [p0[0] + dx * t1, p0[1] + dy * t1]
  ];
}
function depthFor(kind) {
  return {
    ocean: 4,
    lake: 3,
    pond: 1.2,
    reservoir: 4,
    river: 2.5,
    canal: 2,
    stream: 0.8,
    drain: 0.8,
    ditch: 0.6,
    wetland: 0.2,
    bay: 4,
    channel: 1.5
  }[kind] ?? 1;
}
function seaFromCoastlines(rawLines, box) {
  const lines = stitch(rawLines, 1);
  const out = [];
  for (const full of lines) {
    for (const piece of clipToBox(full, box)) {
      if (piece.length < 2) continue;
      const a = piece[0], b = piece[piece.length - 1];
      if (dist(a, b) < 1) continue;
      const ext = piece.slice();
      if (!onBoundary(ext[0], box)) {
        const p = toEdge(ext[0], norm(sub(ext[0], ext[1])), box);
        if (!p) continue;
        ext.unshift(p);
      }
      if (!onBoundary(ext[ext.length - 1], box)) {
        const p = toEdge(ext[ext.length - 1], norm(sub(ext[ext.length - 1], ext[ext.length - 2])), box);
        if (!p) continue;
        ext.push(p);
      }
      piece.length = 0;
      piece.push(...ext);
      const mid = Math.floor(piece.length / 2);
      const p0 = piece[Math.max(0, mid - 1)], p1 = piece[Math.min(piece.length - 1, mid + 1)];
      const dir = norm(sub(p1, p0));
      if (!Number.isFinite(dir[0])) continue;
      const starboard = [dir[1], -dir[0]];
      const probe = [piece[mid][0] + starboard[0] * 2, piece[mid][1] + starboard[1] * 2];
      for (const way of [1, -1]) {
        const ring3 = piece.concat(boundaryPath(b, a, box, way));
        if (ring3.length < 3) continue;
        if (area(ring3) < 50) continue;
        if (pointInRing2(probe, ring3)) {
          out.push(ensureCCW(ring3));
          break;
        }
      }
    }
  }
  return out;
}
function stitch(lines, tol) {
  const pool = lines.map((l) => l.slice()).filter((l) => l.length >= 2);
  const out = [];
  const near = (a, b) => dist(a, b) <= tol;
  while (pool.length) {
    let cur = pool.pop();
    let joined = true;
    while (joined) {
      joined = false;
      for (let i = 0; i < pool.length; i++) {
        const other = pool[i];
        const [cs, ce] = [cur[0], cur[cur.length - 1]];
        const [os, oe] = [other[0], other[other.length - 1]];
        if (near(ce, os)) {
          cur = cur.concat(other.slice(1));
        } else if (near(ce, oe)) {
          cur = cur.concat(other.slice(0, -1).reverse());
        } else if (near(cs, oe)) {
          cur = other.slice(0, -1).concat(cur);
        } else if (near(cs, os)) {
          cur = other.slice(1).reverse().concat(cur);
        } else continue;
        pool.splice(i, 1);
        joined = true;
        break;
      }
    }
    out.push(cur);
  }
  return out;
}
var onBoundary = (p, box, tol = 0.5) => Math.abs(p[0] - box[0]) < tol || Math.abs(p[0] - box[2]) < tol || Math.abs(p[1] - box[1]) < tol || Math.abs(p[1] - box[3]) < tol;
function toEdge(p, dir, box) {
  if (!Number.isFinite(dir[0]) || dir[0] === 0 && dir[1] === 0) return null;
  const ts = [];
  if (dir[0] !== 0) {
    ts.push((box[0] - p[0]) / dir[0], (box[2] - p[0]) / dir[0]);
  }
  if (dir[1] !== 0) {
    ts.push((box[1] - p[1]) / dir[1], (box[3] - p[1]) / dir[1]);
  }
  const t = ts.filter((v) => v > 1e-6).sort((a, b) => a - b)[0];
  if (!Number.isFinite(t)) return null;
  return [p[0] + dir[0] * t, p[1] + dir[1] * t];
}
function perimeterT(p, box) {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0 || 1, h = y1 - y0 || 1;
  if (Math.abs(p[1] - y0) <= Math.abs(p[1] - y1) && Math.abs(p[1] - y0) < 1) return (p[0] - x0) / w;
  if (Math.abs(p[0] - x1) < 1) return 1 + (p[1] - y0) / h;
  if (Math.abs(p[1] - y1) < 1) return 2 + (x1 - p[0]) / w;
  return 3 + (y1 - p[1]) / h;
}
function boundaryPath(from, to, box, direction) {
  const [x0, y0, x1, y1] = box;
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  let t = perimeterT(from, box);
  const target = perimeterT(to, box);
  const path = [];
  for (let n = 0; n < 5; n++) {
    const next = direction > 0 ? Math.floor(t) + 1 : Math.ceil(t) - 1;
    const reached = direction > 0 ? target > t && target <= next || target < t && next >= 4 && target + 4 <= next : target < t && target >= next || target > t && next <= 0 && target - 4 >= next;
    if (reached) break;
    const idx = (next % 4 + 4) % 4;
    path.push(corners[idx]);
    t = (next % 4 + 4) % 4;
  }
  return path;
}
function dedupeRing2(line2) {
  const out = [];
  for (const p of line2) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1e-6) out.push(p);
  }
  if (out.length > 2 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
}
function skeletonQuery(bbox2) {
  const b = `${bbox2[0]},${bbox2[1]},${bbox2[2]},${bbox2[3]}`;
  return `[out:json][timeout:40];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${b});
  way["waterway"~"^(river|stream)$"](${b});
  way["natural"="water"](${b});
  node["place"~"^(city|town|village|hamlet)$"](${b});
);
out geom qt;`;
}
var SKELETON_RANK = {
  motorway: 0,
  trunk: 1,
  primary: 2,
  secondary: 3,
  tertiary: 4
};
function toSkeleton(json, projection) {
  const ways = [], places = [];
  for (const el of json.elements || []) {
    const tags = el.tags || {};
    if (el.type === "node" && tags.place) {
      const [x, y] = projection.toLocal(el.lat, el.lon);
      places.push({ at: [Math.round(x), Math.round(y)], name: tags.name || null, kind: tags.place });
      continue;
    }
    if (!el.geometry || el.geometry.length < 2) continue;
    const line2 = el.geometry.map((g) => projection.toLocal(g.lat, g.lon).map((v) => Math.round(v)));
    if (tags.highway) {
      ways.push({ line: line2, kind: "road", rank: SKELETON_RANK[tags.highway] ?? 5, name: tags.name || null });
    } else if (tags.waterway || tags.natural === "water") {
      ways.push({ line: line2, kind: "water", rank: 6, name: tags.name || null, area: tags.natural === "water" });
    }
  }
  return {
    ways,
    places,
    note: "for finding your way, not for measuring: major ways only, no buildings"
  };
}

// src/import/terrain.js
var TILE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
var SIZE2 = 256;
var lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
var lat2y = (lat, z) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z;
var pixelMetres = (lat, z) => 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
function chooseZoom(lat, targetM = 20, max = 14) {
  for (let z = max; z >= 8; z--) if (pixelMetres(lat, z) >= targetM) return z;
  return max;
}
async function sampleTerrain(bbox2, projection, bounds, {
  zoom = null,
  fetchImpl = fetch,
  decode = null,
  log = () => {
  },
  maxTiles = 16
} = {}) {
  const [s, w, n, e] = bbox2;
  const midLat = (s + n) / 2;
  let z = zoom ?? chooseZoom(midLat, 20);
  let x0, x1, y0, y1;
  for (; ; ) {
    x0 = Math.floor(lon2x(w, z));
    x1 = Math.floor(lon2x(e, z));
    y0 = Math.floor(lat2y(n, z));
    y1 = Math.floor(lat2y(s, z));
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count <= maxTiles || z <= 8) break;
    z--;
  }
  const decoder = decode || (typeof document !== "undefined" ? decodeInBrowser : await nodeDecoder());
  const tiles = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      log(`terrain tile ${tiles.length + 1}/${(x1 - x0 + 1) * (y1 - y0 + 1)} (z${z})`);
      try {
        tiles.push({ tx, ty, px: await decoder(`${TILE}/${z}/${tx}/${ty}.png`, fetchImpl) });
      } catch (err) {
        log(`tile ${tx},${ty} unavailable (${String(err.message).slice(0, 40)}) \u2014 treated as flat`);
      }
    }
  }
  if (!tiles.length) throw new Error("no terrain tiles could be read");
  const heightAtLatLon = (lat, lon) => {
    const fx = lon2x(lon, z), fy = lat2y(lat, z);
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const tile = tiles.find((t) => t.tx === tx && t.ty === ty);
    if (!tile) return null;
    const u = (fx - tx) * SIZE2, v = (fy - ty) * SIZE2;
    const i0 = Math.max(0, Math.min(SIZE2 - 1, Math.floor(u)));
    const j0 = Math.max(0, Math.min(SIZE2 - 1, Math.floor(v)));
    const i1 = Math.min(SIZE2 - 1, i0 + 1), j1 = Math.min(SIZE2 - 1, j0 + 1);
    const du = u - i0, dv = v - j0;
    const at = (i, j) => tile.px[j * SIZE2 + i];
    const a = at(i0, j0), b = at(i1, j0), c = at(i0, j1), d = at(i1, j1);
    return (a * (1 - du) + b * du) * (1 - dv) + (c * (1 - du) + d * du) * dv;
  };
  const cell = Math.max(6, pixelMetres(midLat, z));
  const hf = new Heightfield(bounds, cell);
  const raw = new Float32Array(hf.nx * hf.ny);
  let lo = Infinity, hi = -Infinity, missing = 0;
  for (let j = 0; j < hf.ny; j++) {
    for (let i = 0; i < hf.nx; i++) {
      const x = bounds[0] + i * cell, y = bounds[1] + j * cell;
      const [lat, lon] = projection.toWGS84(x, y);
      const h = heightAtLatLon(lat, lon);
      if (h === null) {
        missing++;
        raw[hf.idx(i, j)] = NaN;
        continue;
      }
      raw[hf.idx(i, j)] = h;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  if (!isFinite(lo)) throw new Error("terrain tiles covered none of this place");
  for (let k = 0; k < raw.length; k++) hf.data[k] = Number.isNaN(raw[k]) ? 0 : raw[k] - lo;
  return {
    heightfield: hf,
    datum: lo,
    relief: +(hi - lo).toFixed(1),
    zoom: z,
    tiles: tiles.length,
    attribution: `terrarium z${z} (~${pixelMetres(midLat, z).toFixed(0)} m/px) via AWS open data \u2014 relief ${(hi - lo).toFixed(1)} m${missing ? `, ${missing} cells outside tile coverage` : ""}`
  };
}
async function decodeInBrowser(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error("tile load failed"));
    img.src = url;
  });
  const canvas2 = document.createElement("canvas");
  canvas2.width = SIZE2;
  canvas2.height = SIZE2;
  const ctx = canvas2.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SIZE2, SIZE2);
  const d = ctx.getImageData(0, 0, SIZE2, SIZE2).data;
  const out = new Float32Array(SIZE2 * SIZE2);
  for (let k = 0, p = 0; k < out.length; k++, p += 4) {
    out[k] = d[p] * 256 + d[p + 1] + d[p + 2] / 256 - 32768;
  }
  return out;
}
async function nodeDecoder() {
  const { inflateSync } = await import("node:zlib");
  return async (url, fetchImpl) => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`tile ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return decodePNGHeights(buf, inflateSync);
  };
}
function decodePNGHeights(buf, inflateSync) {
  if (buf.readUInt32BE(0) !== 2303741511) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, depth = 0, colour = 0;
  const idat = [];
  while (pos < buf.length) {
    const len2 = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len2);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      if (depth !== 8 || colour !== 2 && colour !== 6) throw new Error(`unsupported PNG (depth ${depth}, colour ${colour})`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len2;
  }
  const channels = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += a + b >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
  }
  const out = new Float32Array(width * height);
  for (let k = 0; k < out.length; k++) {
    const p = k * channels;
    out[k] = px[p] * 256 + px[p + 1] + px[p + 2] / 256 - 32768;
  }
  return out;
}

// src/import/place.js
var MAX_SPAN_M = 2500;
function slug(s) {
  const str = String(s || "");
  const cut = str.lastIndexOf("\xB7");
  if (cut > 0) {
    const head = plainSlug(str.slice(0, cut)).slice(0, 34);
    const tail = plainSlug(str.slice(cut + 1));
    return tail ? `${head}-${tail}` : head;
  }
  return plainSlug(str);
}
function plainSlug(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "place";
}
async function importPlace(opts = {}) {
  const log = opts.log || (() => {
  });
  const fetchImpl = opts.fetchImpl || fetch;
  const metres = opts.metres || 900;
  let bbox2 = opts.bbox;
  let name = opts.name;
  let resolved = null;
  if (!bbox2) {
    if (!opts.query) throw new Error("give a place name or a bounding box");
    log(`looking up \u201C${opts.query}\u201D\u2026`);
    resolved = await resolvePlace(opts.query, { metres, fetchImpl });
    bbox2 = resolved.bbox;
    name = name || resolved.short;
    if (resolved.why) log(resolved.why);
    if (resolved.alternatives.length) {
      log(`other matches: ${resolved.alternatives.slice(0, 3).map((a) => a.short).join(" \xB7 ")}`);
    }
  }
  const span = bboxMetres(bbox2);
  if (span.width > MAX_SPAN_M || span.height > MAX_SPAN_M) {
    const shrunk = windowAround(bbox2, MAX_SPAN_M);
    log(`that area is ${Math.round(span.width)}\xD7${Math.round(span.height)} m \u2014 narrowing to ${MAX_SPAN_M} m so Overpass is not asked for a city`);
    bbox2 = shrunk;
  }
  const key2 = opts.key || slug(name || opts.query);
  const GROUND_MULTIPLE = 8;
  let terrain = null;
  const projection = makeProjection((bbox2[0] + bbox2[2]) / 2, (bbox2[1] + bbox2[3]) / 2);
  const detailBounds = localBounds(projection, bbox2);
  if (opts.terrain !== false) {
    const wide = windowAround(bbox2, Math.min(
      MAX_SPAN_M * GROUND_MULTIPLE,
      Math.max(bboxMetres(bbox2).width, bboxMetres(bbox2).height) * GROUND_MULTIPLE
    ));
    for (const [attempt, box] of [["wide", wide], ["just the window", bbox2]]) {
      try {
        terrain = await sampleTerrain(box, projection, localBounds(projection, box), { fetchImpl, log });
        log(`terrain: ${terrain.attribution}`);
        if (attempt === "wide") {
          const m = Math.round(bboxMetres(box).width);
          log(`ground carried out to ${m} m so there is landform to navigate by`);
        }
        break;
      } catch (err) {
        if (attempt === "wide") {
          log(`wide ground unavailable (${String(err.message).slice(0, 50)}) \u2014 trying just the window`);
          continue;
        }
        log(`terrain unavailable (${String(err.message).slice(0, 70)}) \u2014 the ground will be level`);
      }
    }
  }
  if (opts.onGround && terrain) {
    try {
      const { world: bare } = osmToPlace(
        { elements: [] },
        { key: key2, name: name || key2, bbox: bbox2, terrain, fetchedAt: (/* @__PURE__ */ new Date()).toISOString(), mirror: null }
      );
      bare.place.meta.detailBounds = detailBounds;
      bare.place.meta.anchor = projection.anchor;
      bare.place.meta.pending = "reading what is built here\u2026";
      opts.onGround(bare);
    } catch (err) {
      log(`could not open the ground early (${String(err.message).slice(0, 40)})`);
    }
  }
  log("reading OpenStreetMap\u2026");
  const { json, mirror } = await fetchOSM(bbox2, { fetchImpl, log });
  log(`${json.elements.length} OSM elements`);
  if (!json.elements.length) {
    log("nobody has mapped this yet \u2014 opening the ground alone");
  }
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  const { world, stats: stats2 } = osmToPlace(json, { key: key2, name: name || key2, bbox: bbox2, terrain, fetchedAt, mirror });
  world.place.meta.geocoded = resolved ? { query: opts.query, match: resolved.name, osm: resolved.osm } : null;
  world.place.meta.detailBounds = detailBounds;
  world.place.meta.detailBBox = bbox2;
  world.place.meta.anchor = projection.anchor;
  if (terrain && opts.skeleton !== false) {
    try {
      const wideBBox = windowAround(bbox2, Math.round(terrain.heightfield ? terrain.heightfield.bounds[2] - terrain.heightfield.bounds[0] : bboxMetres(bbox2).width));
      log("reading the main roads and rivers around it\u2026");
      const { json: sk } = await fetchOSM(wideBBox, { fetchImpl, log, rounds: 1, query: skeletonQuery });
      world.place.meta.skeleton = toSkeleton(sk, projection);
      const s2 = world.place.meta.skeleton;
      log(`around you: ${s2.ways.filter((w) => w.kind === "road").length} main roads, ${s2.ways.filter((w) => w.kind === "water").length} watercourses, ${s2.places.length} named places`);
    } catch (err) {
      log(`no wider context (${String(err.message).slice(0, 50)}) \u2014 the plan will show ground only`);
    }
  }
  const built = Object.values(stats2).reduce((a, b) => a + b, 0) - (stats2.skipped || 0);
  if (!built && !terrain) {
    throw new Error("nothing here at all \u2014 no map data and no elevation for this spot");
  }
  world.place.meta.sparse = !stats2.buildings && !stats2.roads;
  if (world.place.meta.sparse) {
    log("OpenStreetMap has nothing built here \u2014 opening the ground itself");
  }
  log(`built: ${Object.entries(stats2).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  return { world, stats: stats2, bbox: bbox2, key: key2, name: name || key2, resolved, fetchedAt, span };
}

// src/ui/importui.js
var DB = "creo-places";
var STORE = "worlds";
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return null;
  }
}
var cachePut = (key2, value) => idb("readwrite", (s) => s.put(value, key2));
var cacheGet = (key2) => idb("readonly", (s) => s.get(key2));
var cacheKeys = () => idb("readonly", (s) => s.getAllKeys());
var cacheDel = (key2) => idb("readwrite", (s) => s.delete(key2));
async function pruneCache(keep = 14, protectKey = null) {
  const keys = await cacheKeys() || [];
  const rows = [];
  for (const k of keys) {
    if (String(k).startsWith("autosave.")) continue;
    const rec = await cacheGet(k);
    if (rec?.meta) rows.push({ key: k, at: Date.parse(rec.meta.fetchedAt || "") || 0 });
  }
  if (rows.length <= keep) return [];
  rows.sort((a, b) => a.at - b.at);
  const doomed = rows.slice(0, rows.length - keep).filter((r) => r.key !== protectKey);
  for (const d of doomed) await cacheDel(d.key);
  return doomed.map((d) => d.key);
}
async function listCached() {
  const keys = await cacheKeys() || [];
  const out = [];
  for (const k of keys) {
    const rec = await cacheGet(k);
    if (rec?.meta) out.push({ ...rec.meta, key: k, cached: true });
  }
  return out;
}
async function loadCached(key2) {
  const rec = await cacheGet(key2);
  if (!rec) throw new Error(`not cached: ${key2}`);
  return World.load(rec.payload);
}
function openImportPanel({ anchorEl, onLoaded, toast: toast2 }) {
  document.querySelector(".importPanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "menu importPanel";
  const r = anchorEl.getBoundingClientRect();
  panel.style.left = `${Math.max(8, r.left)}px`;
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.width = "min(380px, calc(100vw - 24px))";
  const label3 = document.createElement("div");
  label3.className = "menuLabel";
  label3.textContent = "Take me anywhere \u2014 a name, a coordinate, or a pasted map link";
  const input = document.createElement("input");
  input.className = "nameInput";
  input.placeholder = "a street, a village \u2014 or 25.7867, -80.1750";
  input.setAttribute("aria-label", "Search for a place");
  const status = document.createElement("div");
  status.className = "importStatus";
  const results = document.createElement("div");
  panel.append(label3, input, status, results);
  document.body.append(panel);
  input.focus();
  const say2 = (m) => {
    status.textContent = m;
  };
  let searching = false;
  async function search() {
    const q = input.value.trim();
    if (!q || searching) return;
    searching = true;
    results.replaceChildren();
    say2("searching\u2026");
    const at = parseCoordinates(q);
    if (at) {
      say2(`${at.label} \u2014 read as ${at.how}`);
      const b = document.createElement("button");
      b.innerHTML = `Go to ${escapeHTML(at.label)}<span class="sub">exact coordinate \xB7 900 m around it</span>`;
      b.onclick = () => pull(coordinatePlace(at, 900));
      results.append(b);
      searching = false;
      return;
    }
    try {
      const hits = await geocode(q, { limit: 6 });
      if (!hits.length) {
        say2(`nothing found for \u201C${q}\u201D`);
        searching = false;
        return;
      }
      say2(hits.length === 1 ? "one match" : `${hits.length} matches \u2014 which one?`);
      for (const h of hits) {
        const b = document.createElement("button");
        b.innerHTML = `${escapeHTML(h.short)}<span class="sub">${h.kind.replace("/", " \xB7 ")} \u2014 ${h.span.width}\xD7${h.span.height} m</span>`;
        b.onclick = () => pull(h);
        results.append(b);
      }
    } catch (err) {
      say2(`the geocoder is unavailable (${String(err.message).slice(0, 60)})`);
    }
    searching = false;
  }
  async function pull(hit) {
    results.replaceChildren();
    input.disabled = true;
    const lines = [];
    const log = (m) => {
      lines.push(m);
      say2(lines.slice(-2).join(" \xB7 "));
    };
    try {
      const { world, key: key2, name, stats: stats2 } = await importPlace({
        query: hit.short,
        bbox: hit.bbox,
        name: hit.short,
        metres: 900,
        log,
        // the ground arrives in seconds and Overpass can take minutes: stand on
        // the hill now, and let what is built on it appear when it appears
        onGround: (bare) => {
          panel.remove();
          onLoaded(bare, `${slug(hit.short)}-ground`, hit.short);
          toast2("The ground is here. Reading what is built on it\u2026");
        }
      });
      say2("saving\u2026");
      const payload = world.save();
      await cachePut(key2, {
        payload,
        meta: {
          key: key2,
          name,
          counts: stats2,
          relief: world.place.meta?.relief || 0,
          bbox: world.place.meta?.bbox,
          fetchedAt: world.place.meta?.fetchedAt,
          source: "OpenStreetMap (ODbL)"
        }
      });
      panel.remove();
      onLoaded(world, key2, name);
      toast2(world.place.meta?.sparse ? `${name} \u2014 nothing is mapped here yet. The ground is real: ${world.place.meta?.relief || 0} m of relief. Draw and say what belongs.` : `${name} \u2014 ${stats2.buildings} buildings, ${stats2.roads + stats2.paths} ways, ${world.place.meta?.relief || 0} m relief.`);
    } catch (err) {
      input.disabled = false;
      say2(String(err.message).slice(0, 160));
    }
  }
  input.onkeydown = (e) => {
    if (e.key === "Enter") search();
    if (e.key === "Escape") panel.remove();
  };
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!panel.contains(e.target)) {
      panel.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
  return panel;
}
var escapeHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function reframe(world, { camera, at = null, metres, log = () => {
} }) {
  const bbox2 = world.place.meta?.bbox;
  if (!bbox2) throw new Error("this place does not remember where in the world it is");
  const [south, west, north, east] = bbox2;
  const midLat = (south + north) / 2;
  const b = world.place.terrain?.bounds || world.place.bounds();
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const px = at ? at[0] : camera?.target?.[0] ?? cx;
  const py = at ? at[1] : camera?.target?.[1] ?? cy;
  const dx = px - cx;
  const dy = py - cy;
  const lat = (south + north) / 2 + dy / 111320;
  const lon = (west + east) / 2 + dx / (111320 * Math.max(0.05, Math.cos(midLat * Math.PI / 180)));
  const dLat = metres / 2 / 111320;
  const dLon = metres / 2 / (111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  log(`re-cutting ${metres} m around ${Math.abs(lat).toFixed(5)}\xB0${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(5)}\xB0${lon < 0 ? "W" : "E"}`);
  return { bbox: [lat - dLat, lon - dLon, lat + dLat, lon + dLon], lat, lon, metres };
}
function openReframePanel({ anchorEl, world, camera, currentMetres = 900, onLoaded, toast: toast2 }) {
  document.querySelector(".importPanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "menu importPanel";
  const r = anchorEl.getBoundingClientRect();
  panel.style.left = `${Math.max(8, r.left)}px`;
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.width = "min(380px, calc(100vw - 24px))";
  const label3 = document.createElement("div");
  label3.className = "menuLabel";
  label3.textContent = "Show more ground, around where you are looking";
  const status = document.createElement("div");
  status.className = "importStatus";
  const results = document.createElement("div");
  panel.append(label3, status, results);
  document.body.append(panel);
  const say2 = (m) => {
    status.textContent = m;
  };
  say2(`this window is about ${Math.round(currentMetres)} m across`);
  for (const metres of [currentMetres * 1.5, currentMetres * 2.5, currentMetres * 4].map((m) => Math.round(m / 100) * 100)) {
    const b = document.createElement("button");
    b.innerHTML = `${metres} m across<span class="sub">${(metres / currentMetres).toFixed(1)}\xD7 this window, centred where you are looking</span>`;
    b.onclick = () => pull(metres);
    results.append(b);
  }
  const same = document.createElement("button");
  same.innerHTML = `Move the window here<span class="sub">same ${Math.round(currentMetres)} m, re-centred on your view</span>`;
  same.onclick = () => pull(Math.round(currentMetres));
  results.append(same);
  async function pull(metres) {
    results.replaceChildren();
    const lines = [];
    const log = (m) => {
      lines.push(m);
      say2(lines.slice(-2).join(" \xB7 "));
    };
    try {
      const { bbox: bbox2 } = reframe(world, { camera, metres, log });
      const base = (world.place.name || "here").split(" \u2014 ")[0];
      const { world: next, key: key2, name, stats: stats2 } = await importPlace({
        bbox: bbox2,
        name: `${base} \xB7 ${metres} m`,
        metres,
        log
      });
      say2("saving\u2026");
      await cachePut(key2, {
        payload: next.save(),
        meta: {
          key: key2,
          name,
          counts: stats2,
          relief: next.place.meta?.relief || 0,
          bbox: next.place.meta?.bbox,
          fetchedAt: next.place.meta?.fetchedAt,
          source: "OpenStreetMap (ODbL)"
        }
      });
      panel.remove();
      onLoaded(next, key2, name);
      toast2(`${metres} m across \u2014 ${stats2.buildings || 0} buildings, ${next.place.meta?.relief || 0} m relief.`);
    } catch (err) {
      say2(String(err.message).slice(0, 160));
    }
  }
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!panel.contains(e.target)) {
      panel.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
  return panel;
}
async function previewGround(world, { span = 3, log = () => {
} } = {}) {
  const bbox2 = world.place.meta?.bbox;
  if (!bbox2) throw new Error("this place does not remember where in the world it is");
  const [s, w, n, e] = bbox2;
  const dLat = (n - s) * ((span - 1) / 2);
  const dLon = (e - w) * ((span - 1) / 2);
  const wide = [s - dLat, w - dLon, n + dLat, e + dLon];
  const projection = makeProjection((wide[0] + wide[2]) / 2, (wide[1] + wide[3]) / 2);
  log("looking at the ground around you\u2026");
  const sampled = await sampleTerrain(wide, projection, localBounds(projection, wide), { log });
  const field2 = sampled.heightfield;
  if (!field2) throw new Error("no elevation is published for this ground");
  const centre = projection.toLocal((s + n) / 2, (w + e) / 2);
  const half = world.place.terrain ? [
    (world.place.terrain.bounds[2] - world.place.terrain.bounds[0]) / 2,
    (world.place.terrain.bounds[3] - world.place.terrain.bounds[1]) / 2
  ] : [450, 450];
  return { field: field2, centre, half, span, bbox: wide, relief: sampled.relief, tiles: sampled.tiles };
}

// src/ai/modes.js
var MODES2 = {
  fast: {
    key: "fast",
    label: "Fast",
    hint: "answer from what is in view",
    effort: "low",
    vision: "never",
    investigate: false,
    gauntlet: false
  },
  think: {
    key: "think",
    label: "Think",
    hint: "look at the world first",
    effort: "medium",
    vision: "auto",
    investigate: false,
    gauntlet: false
  },
  deep: {
    key: "deep",
    label: "Deep",
    hint: "trace what connects to what, and simulate",
    effort: "high",
    vision: "auto",
    investigate: true,
    gauntlet: false
  },
  gauntlet: {
    key: "gauntlet",
    label: "Gauntlet",
    hint: "build it, test it, let a critic attack it",
    effort: "high",
    vision: "always",
    investigate: true,
    gauntlet: true,
    critic: { effort: "max", vision: "always" }
  }
};
var MODE_ORDER = ["fast", "think", "deep", "gauntlet"];
function routeMode(intent, { hasCompetingConstraints = false } = {}) {
  const text = String(intent.original || "").toLowerCase();
  if (/\b(best|optimal|figure out|work out)\b/.test(text) || /\bwithout (?:losing|removing|touching|changing|affecting)\b/.test(text) || /\b(but|while|and) (?:still )?(?:keep|keeping|preserve|preserving|leave|leaving)\b/.test(text) || /\binstead of\b/.test(text) || hasCompetingConstraints || (intent.constraints || []).length > 1) {
    return "gauntlet";
  }
  if (!["SIMULATE", "BRANCH", "MERGE"].includes(intent.operation) && /^(select|choose|pick|hide|zoom|go to|take me|look at|centre|center|focus on)\b/.test(text)) {
    return "fast";
  }
  switch (intent.operation) {
    case "ASK":
      return ["why", "why-not", "what-blocks", "where-fit", "compare"].includes(intent.question?.kind) ? "deep" : "fast";
    case "SIMULATE":
    case "BRANCH":
    case "MERGE":
      return "deep";
    case "PROPOSE":
    case "MODIFY":
    case "RELATE":
      return "think";
    case "OBSERVE":
    case "MEASURE":
    case "PRESERVE":
    case "REMOVE":
      return "fast";
    default:
      return "think";
  }
}
var STEP_LABELS = {
  reading: "reading the place",
  terrain: "looking at the ground",
  water: "following the water",
  drains: "checking the drains",
  routes: "checking who walks here",
  relations: "tracing what connects to what",
  rain: "testing heavy rain",
  asking: "thinking it through",
  building: "making a proposal",
  rendering: "looking at the result",
  critic: "challenging it",
  revising: "trying again"
};

// src/sim/water.js
var WATER_MODEL = {
  name: "shallow routing v2",
  assumptions: {
    rainfall_mm: { light: 12, heavy: 45, extreme: 90 },
    duration_min: 60,
    infiltration_mm_per_h_default: 6,
    infiltration_mm_per_h_permeable: 60,
    steps: 120,
    cell_m: 1.5,
    reports: "peak depth during the event, not the steady state after it",
    note: 'A rainfall EVENT, not an equilibrium. Rain is applied over the stated duration and routed by steepest descent each step; what is reported is the worst moment, because that is what "it fills with water" describes. Steady state is the wrong question here: this ground drains eventually, and the complaint is about the hour it takes. No momentum, no pipe hydraulics. Comparative, not absolute: the direction of a change is robust, its magnitude is resolution-dependent. Always compare two runs on one grid.'
  }
};
function waterFrame(world, extraRings = [], cell = 1.5, pad = 6) {
  const bb = world.place.bounds().slice();
  for (const ring3 of extraRings) {
    if (!ring3 || !ring3.length) continue;
    const r = bbox(ring3);
    bb[0] = Math.min(bb[0], r[0]);
    bb[1] = Math.min(bb[1], r[1]);
    bb[2] = Math.max(bb[2], r[2]);
    bb[3] = Math.max(bb[3], r[3]);
  }
  const x0 = Math.floor((bb[0] - pad) / cell) * cell;
  const y0 = Math.floor((bb[1] - pad) / cell) * cell;
  return {
    cell,
    x0,
    y0,
    nx: Math.max(8, Math.ceil((bb[2] + pad - x0) / cell)),
    ny: Math.max(8, Math.ceil((bb[3] + pad - y0) / cell))
  };
}
function runWater(world, { rain = "heavy", cell = 1.5, steps = null, frame: frame2 = null } = {}) {
  const place2 = world.place;
  const grid = frame2 || waterFrame(world, [], cell);
  cell = grid.cell;
  const x0 = grid.x0, y0 = grid.y0, nx = grid.nx, ny = grid.ny;
  const nSteps = steps || WATER_MODEL.assumptions.steps;
  const n = nx * ny;
  const elev = new Float32Array(n);
  const perm = new Float32Array(n).fill(WATER_MODEL.assumptions.infiltration_mm_per_h_default);
  const solid = new Uint8Array(n);
  const sink = new Float32Array(n);
  const sinkId = new Array(n).fill(null);
  const at = (i, j) => j * nx + i;
  const cx = (i) => x0 + (i + 0.5) * cell;
  const cy = (j) => y0 + (j + 0.5) * cell;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) elev[at(i, j)] = place2.groundAt(cx(i), cy(j));
  }
  for (const e of world.entities()) {
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    const halfW = e.path ? Math.max((e.width || 1) / 2, cell * 0.55) : 0;
    const covers = e.path ? (p) => closestOnRing(p, e.path, false).d <= halfW : (p) => pointInRing2(p, ring3);
    const rb = bbox(ring3);
    const i0 = Math.max(0, Math.floor((rb[0] - x0 - halfW) / cell)), i1 = Math.min(nx - 1, Math.ceil((rb[2] - x0 + halfW) / cell));
    const j0 = Math.max(0, Math.floor((rb[1] - y0 - halfW) / cell)), j1 = Math.min(ny - 1, Math.ceil((rb[3] - y0 + halfW) / cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const p = [cx(i), cy(j)];
        if (!covers(p)) continue;
        const k = at(i, j);
        if (e.type === "structure" || e.type === "wall") {
          solid[k] = 1;
          elev[k] = Math.max(elev[k], e.zTop);
        } else if (e.type === "drain" || e.type === "stream") {
          elev[k] = Math.min(elev[k], invertAt(e, p));
          sink[k] = (e.sim?.capacity ?? 0.4) * cell * 0.12;
          sinkId[k] = e.id;
          perm[k] = Math.max(perm[k], (e.sim?.permeability ?? 0.1) * 100);
        } else if (e.type === "water") {
          sink[k] = 99;
          sinkId[k] = e.id;
        } else if (e.sim?.permeability != null) {
          perm[k] = Math.max(perm[k], e.sim.permeability * WATER_MODEL.assumptions.infiltration_mm_per_h_permeable);
        }
      }
    }
  }
  const mm = WATER_MODEL.assumptions.rainfall_mm[rain] ?? WATER_MODEL.assumptions.rainfall_mm.heavy;
  const hours = WATER_MODEL.assumptions.duration_min / 60;
  const depth = new Float32Array(n);
  const infiltrated = new Float32Array(n);
  const peak = new Float32Array(n);
  const rainPerStep = mm / 1e3 / nSteps;
  const absorbedBy = /* @__PURE__ */ new Map();
  const flux = new Float32Array(n);
  for (let it = 0; it < nSteps; it++) {
    for (let k = 0; k < n; k++) if (!solid[k]) depth[k] += rainPerStep;
    for (let k = 0; k < n; k++) {
      if (depth[k] <= 0) continue;
      const cap = perm[k] / 1e3 * (hours / nSteps);
      const take = Math.min(depth[k], cap);
      depth[k] -= take;
      infiltrated[k] += take;
    }
    for (let k = 0; k < n; k++) {
      if (sink[k] > 0 && depth[k] > 0) {
        const take = Math.min(depth[k], sink[k]);
        depth[k] -= take;
        if (sinkId[k]) absorbedBy.set(sinkId[k], (absorbedBy.get(sinkId[k]) || 0) + take * cell * cell);
      }
    }
    const next = Float32Array.from(depth);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = at(i, j);
        const d = depth[k];
        if (d <= 1e-5 || solid[k]) continue;
        const h = elev[k] + d;
        let bestK = -1, bestDrop = 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const k2 = at(ii, jj);
          if (solid[k2]) continue;
          const h2 = elev[k2] + depth[k2];
          const drop2 = h - h2;
          if (drop2 > bestDrop) {
            bestDrop = drop2;
            bestK = k2;
          }
        }
        if (bestK >= 0) {
          const move = Math.min(d, bestDrop / 2) * 0.55;
          next[k] -= move;
          next[bestK] += move;
          flux[k] += move;
        }
      }
    }
    depth.set(next);
    for (let k = 0; k < n; k++) if (depth[k] > peak[k]) peak[k] = depth[k];
  }
  const residual = Float32Array.from(depth);
  depth.set(peak);
  let maxDepth = 0, floodedArea = 0, volume = 0;
  const cellArea = cell * cell;
  for (let k = 0; k < n; k++) {
    if (depth[k] > maxDepth) maxDepth = depth[k];
    if (depth[k] > 0.05) floodedArea += cellArea;
    volume += depth[k] * cellArea;
  }
  const ponds = findPonds(depth, nx, ny, 0.05);
  const exposure = /* @__PURE__ */ new Map();
  for (const e of world.entities()) {
    if (e.type !== "structure" && e.type !== "market" && e.type !== "path" && e.type !== "road") continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    let worst = 0, wet = 0, cells = 0;
    const rb = bbox(ring3);
    const i0 = Math.max(0, Math.floor((rb[0] - x0) / cell) - 1), i1 = Math.min(nx - 1, Math.ceil((rb[2] - x0) / cell) + 1);
    const j0 = Math.max(0, Math.floor((rb[1] - y0) / cell) - 1), j1 = Math.min(ny - 1, Math.ceil((rb[3] - y0) / cell) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const p = [cx(i), cy(j)];
      if (!pointInRing2(p, ring3)) continue;
      cells++;
      const d = depth[at(i, j)];
      worst = Math.max(worst, d);
      if (d > 0.05) wet++;
    }
    if (cells) exposure.set(e.id, { maxDepth: worst, wetFraction: wet / cells });
  }
  return {
    model: WATER_MODEL,
    rain,
    cell,
    frame: grid,
    bounds: [x0, y0, x0 + nx * cell, y0 + ny * cell],
    steps: nSteps,
    residual,
    nx,
    ny,
    depth,
    flux,
    elev,
    solid,
    maxDepth,
    floodedArea,
    volume,
    pondCount: ponds.length,
    ponds,
    absorbedBy: [...absorbedBy.entries()].map(([id, v]) => ({ id, m3: v })),
    exposure,
    depthAt(x, y) {
      const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return 0;
      return depth[j * nx + i];
    }
  };
}
function invertAt(e, p) {
  const inv = e.props?.invert;
  if (!inv || !e.path || e.path.length < 2) return e.zBase;
  let total = 0;
  const segs = [];
  for (let i = 0; i < e.path.length - 1; i++) {
    const d = dist(e.path[i], e.path[i + 1]);
    segs.push(d);
    total += d;
  }
  const c = closestOnRing(p, e.path, false);
  let before = 0;
  for (let i = 0; i < (c.i ?? 0); i++) before += segs[i];
  const along = before + (segs[c.i ?? 0] || 0) * (c.t ?? 0);
  const f2 = total > 0 ? Math.max(0, Math.min(1, along / total)) : 0;
  return inv[0] + (inv[1] - inv[0]) * f2;
}
function findPonds(depth, nx, ny, threshold) {
  const seen = new Uint8Array(nx * ny);
  const ponds = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (seen[k] || depth[k] <= threshold) continue;
      const stack = [k];
      seen[k] = 1;
      let cells = 0, max = 0, sx = 0, sy = 0;
      while (stack.length) {
        const c = stack.pop();
        const ci = c % nx, cj = (c - ci) / nx;
        cells++;
        sx += ci;
        sy += cj;
        if (depth[c] > max) max = depth[c];
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = ci + di, jj = cj + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const k2 = jj * nx + ii;
          if (seen[k2] || depth[k2] <= threshold) continue;
          seen[k2] = 1;
          stack.push(k2);
        }
      }
      if (cells >= 3) ponds.push({ cells, maxDepth: max, i: sx / cells, j: sy / cells });
    }
  }
  return ponds.sort((a, b) => b.cells - a.cells);
}
function compareWater(a, b) {
  if (a.cell !== b.cell || a.nx !== b.nx || a.ny !== b.ny || Math.abs(a.bounds[0] - b.bounds[0]) > 1e-9 || Math.abs(a.bounds[1] - b.bounds[1]) > 1e-9) {
    throw new Error("compareWater: runs are on different grids \u2014 pass a shared frame to runWater()");
  }
  return {
    floodedAreaDelta: b.floodedArea - a.floodedArea,
    floodedAreaPct: a.floodedArea > 0 ? (a.floodedArea - b.floodedArea) / a.floodedArea * 100 : 0,
    maxDepthDelta: b.maxDepth - a.maxDepth,
    volumeDelta: b.volume - a.volume
  };
}

// src/sim/movement.js
var NETWORK_TYPES2 = /* @__PURE__ */ new Set(["road", "path", "drain", "bridge", "stream"]);
var SNAP = 2.6;
function buildGraph(world, { include = ["road", "path", "bridge"], blockers = null } = {}) {
  const nodes = [];
  const edges = [];
  const byOwner = /* @__PURE__ */ new Map();
  const solids = (blockers || world.entities().filter((e) => e.collision === "solid" && e.type !== "terrain")).map((e) => ({ id: e.id, ring: world.ringOf(e), zBase: e.zBase, zTop: e.zTop })).filter((s) => s.ring);
  for (const e of world.entities()) {
    if (!include.includes(e.type)) continue;
    const line2 = e.path || spineOf(world.ringOf(e));
    if (!line2 || line2.length < 2) continue;
    const pts = resample(line2, 2.2);
    const ids = [];
    for (const p of pts) {
      const z = e.type === "bridge" ? e.zBase : world.place.groundAt(p[0], p[1]);
      ids.push(nodes.push({ p, z, ownerId: e.id }) - 1);
    }
    byOwner.set(e.id, ids);
    for (let i = 0; i < ids.length - 1; i++) {
      const a = nodes[ids[i]], b = nodes[ids[i + 1]];
      const seg = [a.p, b.p];
      const blockedBy = solids.find((s) => Math.abs(s.zBase - a.z) < 2.2 && s.zTop > a.z && polylineCrossesRing(seg, s.ring));
      edges.push({ a: ids[i], b: ids[i + 1], w: dist(a.p, b.p), ownerId: e.id, blockedBy: blockedBy?.id || null });
    }
  }
  const widthOf = /* @__PURE__ */ new Map();
  for (const e of world.entities()) if (include.includes(e.type)) widthOf.set(e.id, (e.width || 2) / 2);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].ownerId === nodes[j].ownerId) continue;
      const d = dist(nodes[i].p, nodes[j].p);
      const reach = SNAP + (widthOf.get(nodes[i].ownerId) || 0) + (widthOf.get(nodes[j].ownerId) || 0);
      if (d > reach) continue;
      if (Math.abs(nodes[i].z - nodes[j].z) > 1.6) continue;
      edges.push({ a: i, b: j, w: d, ownerId: null, blockedBy: null, junction: true });
    }
  }
  const adj = /* @__PURE__ */ new Map();
  for (const [k, e] of edges.entries()) {
    if (e.blockedBy) continue;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a).push({ to: e.b, w: e.w, edge: k });
    adj.get(e.b).push({ to: e.a, w: e.w, edge: k });
  }
  return { nodes, edges, adj, byOwner, nearest: (p) => nearestNode(nodes, p) };
}
function spineOf(ring3) {
  if (!ring3) return null;
  const ob = orientedBounds(ring3);
  const d = [Math.cos(ob.angle), Math.sin(ob.angle)];
  const h = ob.width / 2;
  return [[ob.center[0] - d[0] * h, ob.center[1] - d[1] * h], [ob.center[0] + d[0] * h, ob.center[1] + d[1] * h]];
}
function nearestNode(nodes, p) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = dist(nodes[i].p, p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { index: best, d: bd };
}
function reachability(world, seed, opts = {}) {
  const graph = opts.graph || buildGraph(world, opts);
  const start = graph.nearest(seed);
  if (start.index < 0) return { reached: 0, total: graph.nodes.length, fraction: 0, graph, unreachable: [] };
  const seen = /* @__PURE__ */ new Set([start.index]);
  const stack = [start.index];
  while (stack.length) {
    const u = stack.pop();
    for (const nb of graph.adj.get(u) || []) if (!seen.has(nb.to)) {
      seen.add(nb.to);
      stack.push(nb.to);
    }
  }
  const unreachable = /* @__PURE__ */ new Map();
  graph.nodes.forEach((nd, i) => {
    if (!seen.has(i) && nd.ownerId) unreachable.set(nd.ownerId, (unreachable.get(nd.ownerId) || 0) + 1);
  });
  return {
    reached: seen.size,
    total: graph.nodes.length,
    fraction: graph.nodes.length ? seen.size / graph.nodes.length : 0,
    graph,
    seen,
    unreachable: [...unreachable.entries()].map(([id, n]) => ({ id, nodes: n }))
  };
}
function obstruction(world, ring3, zBase, zTop) {
  const out = [];
  for (const e of world.entities()) {
    if (!NETWORK_TYPES2.has(e.type)) continue;
    const r = world.ringOf(e);
    if (!r || !ringsIntersect(ring3, r)) continue;
    if (zBase >= e.zTop + 2.2 || zTop <= e.zBase) continue;
    const line2 = e.path || spineOf(r);
    const crossed = line2 ? polylineCrossesRing(line2, ring3) : true;
    out.push({ id: e.id, name: e.name || e.id, type: e.type, severed: crossed });
  }
  return out;
}

// src/ai/investigate.js
var PART_TYPES = /* @__PURE__ */ new Set(["opening", "furniture", "room", "wall"]);
async function investigate(world, situation, onStep = () => {
}) {
  const findings = [];
  const focus = (situation.focus || []).map((id) => world.get(id)).filter(Boolean);
  const at = situation.point || (focus[0] ? centroid(world.ringOf(focus[0])) : null);
  const say2 = (kind, text, visual = {}) => {
    findings.push({ kind, text, ...visual });
    onStep(kind, { text, ...visual });
  };
  const pause = () => new Promise((r) => setTimeout(r, 120));
  if (at) {
    const near = world.nearby(at, 60).filter((h) => !PART_TYPES.has(h.entity.type)).slice(0, 12);
    const names = near.map((h) => h.entity.name || h.entity.use || h.entity.type);
    say2("reading", `${near.length} things within 60 m: ${[...new Set(names)].slice(0, 6).join(", ")}.`, {
      highlight: near.map((h) => h.entity.id)
    });
    await pause();
  }
  if (at && world.place.terrain) {
    const slope = world.place.terrain.slopeAt(at[0], at[1]);
    const here = world.place.groundAt(at[0], at[1]);
    let lowest = { z: Infinity, p: null };
    for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI * 2;
      const p = [at[0] + Math.cos(ang) * 60, at[1] + Math.sin(ang) * 60];
      const z = world.place.groundAt(p[0], p[1]);
      if (z < lowest.z) lowest = { z, p };
    }
    const drop2 = here - lowest.z;
    say2(
      "terrain",
      slope.grade < 5e-3 ? `The ground here is almost flat (${(slope.grade * 100).toFixed(1)}%), so nothing drains itself.` : drop2 <= 0.05 ? `The ground falls ${(slope.grade * 100).toFixed(1)}%, but this spot is the lowest ground within 60 m \u2014 water arriving here has nowhere further to go.` : `The ground falls ${(slope.grade * 100).toFixed(1)}% and the lowest ground within 60 m is ${drop2.toFixed(1)} m below.`,
      { trace: lowest.p && drop2 > 0.05 ? [[at, lowest.p]] : [] }
    );
    await pause();
  }
  const waters = world.entities().filter((e) => ["water", "stream", "drain"].includes(e.type));
  if (at && waters.length) {
    const nearWater = waters.map((e) => ({ e, d: ringDistance(world.ringOf(e), circleRing(at[0], at[1], 3, 8)) })).filter((x) => x.d < 250).sort((a, b) => a.d - b.d).slice(0, 4);
    if (nearWater.length) {
      say2(
        "water",
        nearWater.map((x) => `${x.e.name || x.e.subtype || x.e.type} ${x.d < 1 ? "runs through here" : `${x.d.toFixed(0)} m away`}`).join("; ") + ".",
        { highlight: nearWater.map((x) => x.e.id) }
      );
      await pause();
    }
    const drains = waters.filter((e) => e.type === "drain" || ["drain", "ditch", "canal"].includes(e.subtype));
    if (drains.length) {
      say2("drains", `${drains.length} constructed drain${drains.length === 1 ? "" : "s"} in this place.`, {
        highlight: drains.map((e) => e.id)
      });
      await pause();
    }
  }
  for (const e of focus.slice(0, 2)) {
    const rels = describeRelations(world.place, e.id).filter((r) => r.ids.length);
    if (!rels.length) continue;
    say2(
      "relations",
      `${e.name || e.type}: ${rels.slice(0, 4).map((r) => `${r.kind} ${r.ids.length}`).join(", ")}.`,
      { highlight: rels.flatMap((r) => r.ids).slice(0, 30) }
    );
    await pause();
  }
  if (at) {
    const probe = circleRing(at[0], at[1], 8, 12);
    const blocked = obstruction(world, probe, world.place.groundAt(at[0], at[1]), world.place.groundAt(at[0], at[1]) + 3);
    if (blocked.length) {
      say2("routes", `Anything built here meets ${blocked.map((b) => b.name).join(", ")}.`, {
        highlight: blocked.map((b) => b.id)
      });
      await pause();
    }
  }
  let water = null;
  try {
    water = runWater(world, { rain: "heavy" });
    const wet = [...water.exposure.entries()].filter(([, v]) => v.maxDepth > 0.05);
    const nearHere = at ? wet.filter(([id]) => {
      const e = world.get(id);
      const r = e && world.ringOf(e);
      return r && dist(centroid(r), at) < 150;
    }) : wet;
    say2(
      "rain",
      `In ${water.model.assumptions.rainfall_mm.heavy} mm of rain: ${water.floodedArea.toFixed(0)} m\xB2 over 5 cm, deepest ${(water.maxDepth * 100).toFixed(0)} cm` + (nearHere.length ? `, ${nearHere.length} built things wet near here.` : "."),
      { overlay: { kind: "water", water }, highlight: nearHere.map(([id]) => id).slice(0, 20) }
    );
  } catch {
  }
  return { findings, water };
}
function summarise(findings) {
  return findings.map((f2) => `- ${f2.text}`).join("\n");
}

// src/ui/chrome.js
var LAYERS = [
  { key: "buildings", label: "Buildings", types: ["structure", "wall", "room", "furniture"] },
  { key: "streets", label: "Streets & paths", types: ["road", "path", "rail", "bridge"] },
  { key: "water", label: "Rivers, ponds & sea", types: ["water", "stream", "drain"] },
  { key: "ground", label: "Land use", types: ["surface", "parcel", "region"] },
  { key: "nature", label: "Trees", types: ["tree"] },
  { key: "places", label: "Shops & stops", types: ["marker"] },
  { key: "notes", label: "What people said", types: ["observation"] },
  { key: "contours", label: "Contour lines", types: [] }
];
function hiddenTypes(off) {
  const out = /* @__PURE__ */ new Set();
  for (const l of LAYERS) if (off.has(l.key)) for (const t of l.types) out.add(t);
  return out;
}
function openLayers({ anchorEl, off, onChange, labelsOn, onLabels }) {
  document.querySelector(".layerPanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "menu layerPanel";
  const r = anchorEl.getBoundingClientRect();
  panel.style.right = "12px";
  panel.style.top = `${r.bottom + 8}px`;
  const head = document.createElement("div");
  head.className = "menuLabel";
  head.textContent = "What to show";
  panel.append(head);
  for (const l of LAYERS) {
    const row = document.createElement("button");
    const on = !off.has(l.key);
    row.className = on ? "on" : "";
    row.innerHTML = `<span class="tick">${on ? "\u25CF" : "\u25CB"}</span> ${l.label}`;
    row.onclick = () => {
      if (off.has(l.key)) off.delete(l.key);
      else off.add(l.key);
      const nowOn = !off.has(l.key);
      row.className = nowOn ? "on" : "";
      row.querySelector(".tick").textContent = nowOn ? "\u25CF" : "\u25CB";
      onChange();
    };
    panel.append(row);
  }
  const lab = document.createElement("button");
  const setLab = () => {
    lab.className = labelsOn() ? "on" : "";
    lab.innerHTML = `<span class="tick">${labelsOn() ? "\u25CF" : "\u25CB"}</span> Names on the map`;
  };
  lab.onclick = () => {
    onLabels();
    setLab();
  };
  setLab();
  panel.append(lab);
  document.body.append(panel);
  setTimeout(() => document.addEventListener("pointerdown", function offClick(e) {
    if (!panel.contains(e.target) && e.target !== anchorEl) {
      panel.remove();
      document.removeEventListener("pointerdown", offClick);
    }
  }), 0);
  return panel;
}
var Minimap = class {
  constructor(canvas2, { onGo, onExplore = null }) {
    this.canvas = canvas2;
    this.ctx = canvas2.getContext("2d");
    this.onGo = onGo;
    this.onExplore = onExplore;
    this.explore = false;
    this.pick = null;
    this.loaded = /* @__PURE__ */ new Set();
    this.preview = null;
    this.out = 1;
    this.bounds = null;
    this.dragging = false;
    const toWorld = (ev) => {
      const r = canvas2.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width;
      const py = (ev.clientY - r.top) / r.height;
      const b = this.bounds;
      if (!b) return null;
      return [b[0] + px * (b[2] - b[0]), b[3] - py * (b[3] - b[1])];
    };
    canvas2.addEventListener("pointerdown", (ev) => {
      this.dragging = true;
      try {
        canvas2.setPointerCapture(ev.pointerId);
      } catch {
      }
      const p = toWorld(ev);
      if (!p) return;
      if (this.explore) {
        this.choose(p);
        return;
      }
      onGo(p);
    });
    canvas2.addEventListener("pointermove", (ev) => {
      if (!this.dragging || this.explore) return;
      const p = toWorld(ev);
      if (p) onGo(p);
    });
    canvas2.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    canvas2.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  /**
   * The ground around you, shaded, drawn behind everything else — so choosing a
   * neighbouring window is choosing a visible ridge or valley rather than one of
   * eight identical empty boxes.
   */
  drawPreview(g, X, Y, scale, pb) {
    const { field: field2, centre, half } = this.preview;
    const t = field2;
    let lo = Infinity, hi = -Infinity;
    if (t.__plo === void 0) {
      const sorted = Float32Array.from(t.data).sort();
      t.__plo = sorted[Math.floor(sorted.length * 0.02)];
      t.__phi = sorted[Math.floor(sorted.length * 0.98)];
    }
    lo = t.__plo;
    hi = Math.max(t.__phi, t.__plo + 1);
    const cx = (pb[0] + pb[2]) / 2, cy = (pb[1] + pb[3]) / 2;
    const toPlace = (px, py) => [cx + (px - centre[0]), cy + (py - centre[1])];
    const step = Math.max(1, Math.floor(t.nx / 90));
    for (let j = 0; j + step < t.ny; j += step) {
      for (let i = 0; i + step < t.nx; i += step) {
        const h = t.at(i, j);
        const f2 = Math.max(0, Math.min(1, (h - lo) / (hi - lo)));
        const dzdx = (t.at(i + step, j) - t.at(i, j)) / (t.cell * step);
        const dzdy = (t.at(i, j + step) - t.at(i, j)) / (t.cell * step);
        const lit = Math.max(0, Math.min(1, 0.5 + (dzdx * 0.6 + dzdy * 0.5)));
        const v = 0.1 + f2 * 0.16 + lit * 0.16;
        const x0 = t.bounds[0] + i * t.cell, y0 = t.bounds[1] + j * t.cell;
        const a = toPlace(x0, y0);
        const b = toPlace(x0 + t.cell * step, y0 + t.cell * step);
        g.fillStyle = `rgb(${Math.round(v * 255)},${Math.round(v * 262)},${Math.round(v * 250)})`;
        g.fillRect(X(a[0]), Y(b[1]), Math.max(1, (b[0] - a[0]) * scale), Math.max(1, (b[1] - a[1]) * scale));
      }
    }
  }
  /**
   * Shaded relief for the plan: height as tone, slope as light.
   *
   * Sampled at the PLAN's resolution rather than the ground's — about 140 cells
   * across, whatever the ground happens to be — so this costs the same on a 900 m
   * window as on fourteen kilometres, and a person zooming out does not pay for
   * detail they cannot see.
   */
  drawRelief(g, t, X, Y, scale) {
    const day = document.body.classList.contains("day");
    const px = Math.max(1, Math.min(6, (t.bounds[2] - t.bounds[0]) * scale / 140));
    const stepX = px / scale, stepY = px / scale;
    if (t.__plo === void 0) {
      const sorted = Float32Array.from(t.data).sort();
      t.__plo = sorted[Math.floor(sorted.length * 0.02)];
      t.__phi = sorted[Math.floor(sorted.length * 0.98)];
    }
    const lo = t.__plo, hi = Math.max(t.__phi, t.__plo + 1);
    for (let y = t.bounds[1]; y < t.bounds[3]; y += stepY) {
      for (let x = t.bounds[0]; x < t.bounds[2]; x += stepX) {
        const h = t.heightAt(x, y);
        const f2 = Math.max(0, Math.min(1, (h - lo) / (hi - lo)));
        const dzdx = (t.heightAt(x + stepX, y) - h) / stepX;
        const dzdy = (t.heightAt(x, y + stepY) - h) / stepY;
        const lit = Math.max(0, Math.min(1, 0.55 + (dzdx * 22 + dzdy * 18)));
        const v = 0.09 + f2 * 0.2 + lit * 0.22;
        g.fillStyle = day ? `rgb(${Math.round(255 - v * 150)},${Math.round(254 - v * 150)},${Math.round(248 - v * 155)})` : `rgb(${Math.round(v * 244)},${Math.round(v * 252)},${Math.round(v * 236)})`;
        g.fillRect(X(x), Y(y + stepY), px + 1, px + 1);
      }
    }
  }
  /**
   * The skeleton: enough of the wider world to know where you are.
   *
   * Ranked, so a motorway reads before a lane and the eye finds the structure
   * of the country rather than a mat of equal lines. Named places are what
   * actually orient a person — "that is Butler, so the lake is north" — so they
   * are drawn last and never hidden.
   */
  drawSkeleton(g, sk, X, Y, scale) {
    const day = document.body.classList.contains("day");
    g.save();
    for (const w of sk.ways) {
      if (w.kind === "water") {
        g.strokeStyle = day ? "rgba(40,110,170,.6)" : "rgba(90,170,220,.55)";
        g.lineWidth = w.area ? 0.8 : 0.7;
      } else {
        const strength = 0.75 - w.rank * 0.11;
        g.strokeStyle = day ? `rgba(150,105,20,${Math.max(0.28, strength)})` : `rgba(250,225,150,${Math.max(0.18, strength)})`;
        g.lineWidth = Math.max(0.6, 1.9 - w.rank * 0.32);
      }
      g.beginPath();
      g.moveTo(X(w.line[0][0]), Y(w.line[0][1]));
      for (let i = 1; i < w.line.length; i++) g.lineTo(X(w.line[i][0]), Y(w.line[i][1]));
      g.stroke();
    }
    g.font = "9px ui-sans-serif, system-ui, sans-serif";
    for (const p of sk.places) {
      const x = X(p.at[0]), y = Y(p.at[1]);
      g.fillStyle = day ? "rgba(20,22,26,.85)" : "rgba(255,255,255,.9)";
      g.beginPath();
      g.arc(x, y, p.kind === "town" || p.kind === "city" ? 2.6 : 1.8, 0, 7);
      g.fill();
      if (p.name) {
        const w2 = g.measureText(p.name).width;
        g.fillStyle = day ? "rgba(252,251,249,.82)" : "rgba(0,0,0,.65)";
        g.fillRect(x + 4, y - 7, w2 + 4, 11);
        g.fillStyle = day ? "rgba(20,22,26,.95)" : "rgba(255,255,255,.92)";
        g.fillText(p.name, x + 6, y + 1.5);
      }
    }
    g.restore();
  }
  /** Which neighbouring window a point on the plan falls in. */
  choose(p) {
    const b = this.placeBounds;
    if (!b) return;
    const w = b[2] - b[0], h = b[3] - b[1];
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    const i = Math.max(-1, Math.min(1, Math.round((p[0] - cx) / w)));
    const j = Math.max(-1, Math.min(1, Math.round((p[1] - cy) / h)));
    this.pick = i === 0 && j === 0 ? null : [i, j];
    this.onExplore?.("pick", this.pick);
  }
  /** Pull the plan out or in. Ground beyond what is loaded is simply absent. */
  zoom(by) {
    const from = Number.isFinite(this.out) ? this.out : 1;
    this.out = Math.max(1, Math.min(8, from * by));
    return this.out;
  }
  /** Step the choice with the keyboard, for anyone who cannot aim a drag. */
  step(di, dj) {
    const [i, j] = this.pick || [0, 0];
    const ni = Math.max(-1, Math.min(1, i + di));
    const nj = Math.max(-1, Math.min(1, j + dj));
    this.pick = ni === 0 && nj === 0 ? null : [ni, nj];
    this.onExplore?.("pick", this.pick);
  }
  draw(world, { camera, selection, hidden }) {
    const c = this.canvas;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const pb = world.place.terrain?.bounds || world.place.bounds();
    const detail = world.place.meta?.detailBounds || null;
    const grow = (this.explore ? 1.6 : 0) + (this.out - 1);
    const b = grow ? [
      pb[0] - (pb[2] - pb[0]) * grow,
      pb[1] - (pb[3] - pb[1]) * grow,
      pb[2] + (pb[2] - pb[0]) * grow,
      pb[3] + (pb[3] - pb[1]) * grow
    ] : pb;
    const bw = b[2] - b[0], bh = b[3] - b[1];
    const pad = 6;
    const scale = Math.min((w - pad * 2) / Math.max(1, bw), (h - pad * 2) / Math.max(1, bh));
    const ox = (w - bw * scale) / 2 - b[0] * scale;
    const oy = (h - bh * scale) / 2 + b[3] * scale;
    this.bounds = [
      (0 - ox) / scale,
      (oy - h) / scale,
      (w - ox) / scale,
      oy / scale
    ];
    const X = (x) => x * scale + ox;
    const Y = (y) => oy - y * scale;
    if (world.place.terrain) this.drawRelief(g, world.place.terrain, X, Y, scale);
    if (world.place.meta?.skeleton) this.drawSkeleton(g, world.place.meta.skeleton, X, Y, scale);
    else {
      g.fillStyle = "rgba(255,255,255,.045)";
      g.fillRect(X(pb[0]), Y(pb[3]), (pb[2] - pb[0]) * scale, (pb[3] - pb[1]) * scale);
    }
    const drawRing = (ring3, fill, stroke) => {
      g.beginPath();
      g.moveTo(X(ring3[0][0]), Y(ring3[0][1]));
      for (let i = 1; i < ring3.length; i++) g.lineTo(X(ring3[i][0]), Y(ring3[i][1]));
      g.closePath();
      if (fill) {
        g.fillStyle = fill;
        g.fill();
      }
      if (stroke) {
        g.strokeStyle = stroke;
        g.stroke();
      }
    };
    const stamp = [
      world.place.tick,
      world.branch,
      w,
      h,
      Math.round(scale * 1e4),
      Math.round(X(0)),
      Math.round(Y(0)),
      [...hidden].sort().join(",")
    ].join("|");
    if (this._layerStamp !== stamp) {
      if (!this._layer) this._layer = document.createElement("canvas");
      const lc = this._layer;
      if (lc.width !== w * dpr || lc.height !== h * dpr) {
        lc.width = w * dpr;
        lc.height = h * dpr;
      }
      const lg = lc.getContext("2d");
      lg.setTransform(dpr, 0, 0, dpr, 0, 0);
      lg.clearRect(0, 0, w, h);
      const ringTo = (ctx, ring3, fill) => {
        ctx.beginPath();
        ctx.moveTo(X(ring3[0][0]), Y(ring3[0][1]));
        for (let i = 1; i < ring3.length; i++) ctx.lineTo(X(ring3[i][0]), Y(ring3[i][1]));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      for (const e of world.entities()) {
        if (hidden.has(e.type)) continue;
        const ring3 = world.ringOf(e);
        if (!ring3) continue;
        if (e.type === "surface" || e.type === "parcel") ringTo(lg, ring3, "rgba(120,150,110,.16)");
        else if (e.type === "water" || e.type === "stream") ringTo(lg, ring3, "rgba(90,150,200,.5)");
      }
      lg.lineWidth = 1;
      lg.strokeStyle = "rgba(220,225,230,.30)";
      lg.beginPath();
      for (const e of world.entities()) {
        if (hidden.has(e.type)) continue;
        if (e.type !== "road" && e.type !== "path" && e.type !== "rail") continue;
        const line2 = e.path;
        if (!line2 || line2.length < 2) continue;
        lg.moveTo(X(line2[0][0]), Y(line2[0][1]));
        for (let i = 1; i < line2.length; i++) lg.lineTo(X(line2[i][0]), Y(line2[i][1]));
      }
      lg.stroke();
      lg.fillStyle = "rgba(200,190,175,.55)";
      for (const e of world.entities()) {
        if (hidden.has(e.type) || e.type !== "structure") continue;
        const r = bbox(world.ringOf(e));
        lg.fillRect(X(r[0]), Y(r[3]), Math.max(1, (r[2] - r[0]) * scale), Math.max(1, (r[3] - r[1]) * scale));
      }
      this._layerStamp = stamp;
    }
    g.drawImage(this._layer, 0, 0, w, h);
    if (!hidden.has("observation")) {
      g.fillStyle = "#f3c25e";
      for (const e of world.entities()) {
        if (e.type !== "observation") continue;
        const c2 = centroid(world.ringOf(e));
        g.beginPath();
        g.arc(X(c2[0]), Y(c2[1]), 2.6, 0, 7);
        g.fill();
      }
    }
    for (const id of selection) {
      const e = world.get(id);
      const ring3 = e && world.ringOf(e);
      if (!ring3) continue;
      const c2 = centroid(ring3);
      g.strokeStyle = "#ffe98c";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(X(c2[0]), Y(c2[1]), 5, 0, 7);
      g.stroke();
    }
    if (detail) {
      g.save();
      g.strokeStyle = document.body.classList.contains("day") ? "rgba(20,22,26,.55)" : "rgba(255,255,255,.5)";
      g.lineWidth = 1.25;
      g.strokeRect(X(detail[0]), Y(detail[3]), (detail[2] - detail[0]) * scale, (detail[3] - detail[1]) * scale);
      g.restore();
    }
    this.placeBounds = detail || pb;
    if (this.explore && this.preview) this.drawPreview(g, X, Y, scale, pb);
    if (this.explore) {
      const w2 = pb[2] - pb[0], h2 = pb[3] - pb[1];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const x0 = pb[0] + i * w2, y0 = pb[1] + j * h2;
          const px = X(x0), py = Y(y0 + h2);
          const pw = w2 * scale, ph = h2 * scale;
          const here = this.loaded.has(`${i},${j}`);
          const picked = this.pick && this.pick[0] === i && this.pick[1] === j;
          g.save();
          g.lineWidth = picked ? 1.8 : 1;
          if (picked) {
            g.fillStyle = "rgba(88,217,196,.20)";
            g.fillRect(px, py, pw, ph);
            g.strokeStyle = "#58d9c4";
          } else {
            g.setLineDash([3, 3]);
            g.strokeStyle = here ? "rgba(140,220,200,.55)" : "rgba(255,255,255,.20)";
          }
          g.strokeRect(px, py, pw, ph);
          g.restore();
          if (here) {
            g.fillStyle = "rgba(140,220,200,.85)";
            g.beginPath();
            g.arc(px + pw / 2, py + ph / 2, 2.4, 0, 7);
            g.fill();
          }
        }
      }
      g.save();
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 1.5;
      g.strokeRect(X(pb[0]), Y(pb[3]), w2 * scale, h2 * scale);
      g.restore();
    }
    const t = camera.target;
    const half = 0.42;
    const reach = Math.max(18, camera.dist * 0.85) * scale;
    g.fillStyle = "rgba(88,217,196,.20)";
    g.strokeStyle = "rgba(88,217,196,.85)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X(t[0]), Y(t[1]));
    for (let a = -half; a <= half; a += half / 6) {
      const dir = camera.yaw + Math.PI + a;
      g.lineTo(X(t[0] + Math.cos(dir) * reach * -1), Y(t[1] + Math.sin(dir) * reach * -1));
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#58d9c4";
    g.beginPath();
    g.arc(X(t[0]), Y(t[1]), 3, 0, 7);
    g.fill();
    g.save();
    const dayN = document.body.classList.contains("day");
    g.strokeStyle = dayN ? "rgba(20,22,26,.7)" : "rgba(255,255,255,.75)";
    g.fillStyle = dayN ? "rgba(20,22,26,.85)" : "rgba(255,255,255,.9)";
    g.lineWidth = 1.2;
    const nx = w - 14, ny = h - 20;
    g.beginPath();
    g.moveTo(nx, ny + 9);
    g.lineTo(nx, ny - 6);
    g.stroke();
    g.beginPath();
    g.moveTo(nx, ny - 9);
    g.lineTo(nx - 3.2, ny - 3);
    g.lineTo(nx + 3.2, ny - 3);
    g.closePath();
    g.fill();
    g.font = "bold 8px ui-sans-serif, system-ui, sans-serif";
    g.fillText("N", nx - 2.8, ny + 17);
    g.restore();
  }
};
var HELP = [
  ["Move around", "Drag the map to move. Scroll or pinch to zoom \u2014 it zooms toward where you point."],
  ["Turn the view", "Right-drag, or hold Shift and drag. Two fingers twist to turn on a touchscreen."],
  ["Go to a building", "Press <b>G</b> or \u2315 and type its name. It flies there and hands it to you, ready to talk about."],
  ["Explore around", "Press <b>X</b> or \u2295 on the plan. Tap a neighbouring window, or use the <b>arrows</b>, then press the button. Nothing is fetched until you say so, and ground you already have opens instantly."],
  ["Lost?", "Press <b>F</b>, or the \u2922 button, to see the whole place again. The small plan shows where you are \u2014 tap it to go there."],
  ["Choose something", "Tap it. Its name and size appear, with things you can do to it."],
  ["Say something", "Tap the bar and speak plainly: <i>\u201Cthis floods when it rains\u201D</i>, <i>\u201Cwe need a drain here\u201D</i>, <i>\u201Cwhy is this here?\u201D</i>"],
  ["Leave a note", "Tap a spot, then <b>Note here</b>. What you write stays on that spot, with your name on it."],
  ["Draw an area", "Press <b>D</b> or \u25CC, then drag a loop. Draw a line instead and it becomes a route."],
  ["Let it help", "Press \u2726 and describe what you want. It will circle, select and speak on your behalf \u2014 you still approve everything."],
  ["What is this?", 'Terrarium combines <a href="https://github.com/hartswf0/unsettled-atlas" target="_blank" rel="noopener noreferrer">Unsettled Atlas</a> with <a href="https://hartswf0.github.io/motor/" target="_blank" rel="noopener noreferrer">MOTOR</a>: accountable ground, a drivable body, and traces that can unsettle the standing world.'],
  ["Keyboard", "<b>arrows</b> move \xB7 <b>shift+arrows</b> turn and zoom \xB7 <b>Enter</b> choose what the crosshair is on \xB7 <b>N</b> note \xB7 <b>D</b> draw \xB7 <b>L</b> names \xB7 <b>M</b> plan \xB7 <b>F</b> fit \xB7 <b>?</b> this"]
];
function openHelp() {
  document.querySelector(".helpOverlay")?.remove();
  const o = document.createElement("div");
  o.className = "helpOverlay";
  const box = document.createElement("div");
  box.className = "helpBox";
  box.innerHTML = `<h2>Using this</h2>${HELP.map(([k, v]) => `<div class="helpRow"><b>${k}</b><span>${v}</span></div>`).join("")}`;
  const close = document.createElement("button");
  close.className = "btn primary";
  close.textContent = "Got it";
  close.onclick = () => {
    o.remove();
    localStorage.setItem("creo.seenHelp", "1");
  };
  box.append(close);
  o.append(box);
  o.onclick = (e) => {
    if (e.target === o) close.click();
  };
  document.body.append(o);
  return o;
}
var shouldShowHelp = () => !localStorage.getItem("creo.seenHelp");

// src/world/export.js
var round = (v, p = 9) => +v.toFixed(p);
function toGeoJSON(world, opts = {}) {
  const branch = opts.branch || world.branch;
  const view = branch === world.branch ? { entities: world.entities() } : world.view(branch);
  const proj = world.place.projection;
  const features = [];
  for (const e of view.entities) {
    if (e.type === "observation" && opts.includeObservations === false) continue;
    const geometry = geometryOf(world, e, proj);
    if (!geometry) continue;
    features.push({
      type: "Feature",
      id: e.id,
      geometry,
      properties: {
        id: e.id,
        type: e.type,
        subtype: e.subtype,
        name: e.name,
        use: e.use,
        material: e.material,
        network: e.network,
        parent: e.parent,
        // vertical interval, in metres above the local datum
        z_base: round(e.zBase, 3),
        z_top: round(e.zTop, 3),
        height: round(e.zTop - e.zBase, 3),
        width_m: e.width ?? null,
        area_m2: e.footprint || e.path ? round(area(world.place.ringOf(e)), 2) : null,
        // epistemics travel with the geometry: this is the point of the model
        epistemic: e.epistemic,
        certainty: e.certainty,
        status: e.status,
        author: e.author,
        source: e.source,
        branch,
        said: e.evidence?.find((v) => v.kind === "utterance")?.text || null,
        said_lang: e.evidence?.find((v) => v.kind === "utterance")?.lang || null,
        disputed_by: world.place.relations.filter((r) => r.kind === "disputedBy" && r.to === e.id).map((r) => r.from).join(", ") || null,
        preserved: world.place.relations.some((r) => r.kind === "preserves" && r.to === e.id) || null
      }
    });
  }
  return {
    type: "FeatureCollection",
    name: `${world.place.name} \u2014 ${world.place.branches.get(branch)?.name || branch}`,
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    metadata: {
      place: world.place.id,
      anchor: { lat: proj.anchor[0], lon: proj.anchor[1] },
      branch,
      tick: world.place.tick,
      generator: "CREO",
      note: "Local ENU metres re-projected to WGS84 about the anchor. Vertical values remain metres above the local datum."
    },
    features
  };
}
function geometryOf(world, e, proj) {
  const toLonLat = ([x, y]) => {
    const [lat, lon] = proj.toWGS84(x, y);
    return [round(lon), round(lat)];
  };
  if (e.path && !e.footprint) {
    return { type: "LineString", coordinates: e.path.map(toLonLat) };
  }
  const ring3 = world.place.ringOf(e);
  if (!ring3 || ring3.length < 3) return null;
  const closed = ring3.concat([ring3[0]]);
  return { type: "Polygon", coordinates: [closed.map(toLonLat)] };
}
function fromGeoJSON(fc, world) {
  const proj = world.place.projection;
  return fc.features.map((f2) => {
    const coords = f2.geometry.type === "Polygon" ? f2.geometry.coordinates[0] : f2.geometry.coordinates;
    const local = coords.map(([lon, lat]) => proj.toLocal(lat, lon));
    if (f2.geometry.type === "Polygon") local.pop();
    return { id: f2.id, properties: f2.properties, local };
  });
}

// src/lang/deixis.js
var TYPE_FOR_THING = {
  tree: ["tree"],
  building: ["structure"],
  room: ["room"],
  road: ["road"],
  path: ["path"],
  drain: ["drain"],
  water: ["water", "stream"],
  wall: ["wall"],
  market: ["market"],
  garden: ["garden", "surface"],
  bench: ["bench"],
  light: ["light"],
  car: ["car"],
  roof: ["roof"],
  window: ["opening"],
  people: ["person"],
  greenhouse: ["structure"],
  bridge: ["bridge"],
  swale: ["swale"],
  floor: ["structure"]
};
function makeContext(world, overrides = {}) {
  return {
    world,
    selection: { ids: [], ring: null, stroke: null, points: [] },
    pointer: null,
    // last tapped world point [x,y]
    camera: null,
    // { eye:[x,y,z], target:[x,y,z] }
    participant: null,
    // { id, position:[x,y] } — GPS / avatar
    utterances: [],
    // most recent last
    ...overrides
  };
}
function viewDir(ctx) {
  const c = ctx.camera;
  if (!c) return [0, 1];
  const d = [c.target[0] - c.eye[0], c.target[1] - c.eye[1]];
  return len(d) < 1e-6 ? [0, 1] : norm(d);
}
function anchorOf(world, e) {
  const ring3 = world.ringOf(e);
  return ring3 ? centroid(ring3) : [0, 0];
}
function radiusOf(world, e) {
  const ring3 = world.ringOf(e);
  if (!ring3) return 1;
  const c = centroid(ring3);
  return Math.max(...ring3.map((p) => dist(p, c)));
}
var has2 = (tagged, t) => tagged.tokens.some((h) => h.token === t);
function resolveReference(tagged, ctx) {
  const w = ctx.world;
  const sel = ctx.selection || {};
  const basis = [];
  const none = (reason, candidates = [], question = "Which one do you mean?") => ({
    kind: "none",
    ids: [],
    point: null,
    ring: null,
    line: null,
    basis,
    confidence: 0,
    ambiguity: { reason, candidates, question }
  });
  const selEntities = (sel.ids || []).map((id) => w.get(id)).filter(Boolean);
  const lastResolved = [...ctx.utterances || []].reverse().find((u) => u.resolved && u.resolved.kind !== "none")?.resolved || null;
  if (has2(tagged, "DEIXIS.before") && lastResolved) {
    basis.push("utterance-history");
    return { ...lastResolved, basis, confidence: 0.8, ambiguity: null };
  }
  if (has2(tagged, "DEIXIS.between")) {
    const pair = selEntities.length >= 2 ? selEntities.slice(0, 2) : (lastResolved?.ids || []).map((id) => w.get(id)).filter(Boolean).slice(0, 2);
    if (pair.length === 2) {
      basis.push(selEntities.length >= 2 ? "selection" : "utterance-history");
      const a = anchorOf(w, pair[0]), b = anchorOf(w, pair[1]);
      const mid = lerp2(a, b, 0.5);
      const gap = dist(a, b);
      const dir = norm(sub(b, a));
      const p = perp(dir);
      const halfW = Math.max(2, gap / 2 - Math.max(radiusOf(w, pair[0]), radiusOf(w, pair[1])) * 0.4);
      const halfD = Math.max(3, (radiusOf(w, pair[0]) + radiusOf(w, pair[1])) / 2);
      const ring3 = [
        [mid[0] - dir[0] * halfW - p[0] * halfD, mid[1] - dir[1] * halfW - p[1] * halfD],
        [mid[0] + dir[0] * halfW - p[0] * halfD, mid[1] + dir[1] * halfW - p[1] * halfD],
        [mid[0] + dir[0] * halfW + p[0] * halfD, mid[1] + dir[1] * halfW + p[1] * halfD],
        [mid[0] - dir[0] * halfW + p[0] * halfD, mid[1] - dir[1] * halfW + p[1] * halfD]
      ];
      return { kind: "region", ids: pair.map((e) => e.id), point: mid, ring: ring3, line: null, basis, confidence: 0.85, ambiguity: null };
    }
    return none("between needs two referents", sel.ids || [], "Between which two things?");
  }
  if (has2(tagged, "DEIXIS.behind") || has2(tagged, "DEIXIS.front")) {
    const ref = selEntities[0] || (ctx.pointer ? w.entityAt(ctx.pointer) : null) || (lastResolved?.ids?.[0] ? w.get(lastResolved.ids[0]) : null);
    if (!ref) return none("behind/in-front needs a referent", [], "Behind what?");
    basis.push(selEntities[0] ? "selection" : "pointer", "camera");
    const c = anchorOf(w, ref);
    const away = viewDir(ctx);
    const sign = has2(tagged, "DEIXIS.behind") ? 1 : -1;
    const r = radiusOf(w, ref);
    const p = [c[0] + away[0] * sign * (r + 4), c[1] + away[1] * sign * (r + 4)];
    return { kind: "point", ids: [ref.id], point: p, ring: circleRing(p[0], p[1], Math.max(4, r * 0.8), 20), line: null, basis, confidence: 0.75, ambiguity: null };
  }
  if (has2(tagged, "DEIXIS.along")) {
    if (sel.stroke && sel.stroke.length >= 2) {
      basis.push("gesture-stroke");
      return { kind: "polyline", ids: [], point: centroid(sel.stroke), ring: null, line: sel.stroke, basis, confidence: 0.9, ambiguity: null };
    }
    const ref = selEntities.find((e) => e.path) || null;
    if (ref) {
      basis.push("selection");
      return { kind: "polyline", ids: [ref.id], point: anchorOf(w, ref), ring: null, line: ref.path, basis, confidence: 0.8, ambiguity: null };
    }
    return none("along needs a drawn line or a linear referent", [], "Along where? Draw the line.");
  }
  if (has2(tagged, "DEIXIS.around")) {
    const ref = selEntities[0] || (ctx.pointer ? w.entityAt(ctx.pointer) : null);
    if (ref) {
      basis.push(selEntities[0] ? "selection" : "pointer");
      const c = anchorOf(w, ref);
      const r = radiusOf(w, ref);
      return { kind: "region", ids: [ref.id], point: c, ring: circleRing(c[0], c[1], r + 6, 28), line: null, basis, confidence: 0.8, ambiguity: null };
    }
    return none("around needs a referent", [], "Around what?");
  }
  if (has2(tagged, "DEIXIS.next")) {
    const refId = selEntities[0]?.id || lastResolved?.ids?.[0];
    const ref = refId ? w.get(refId) : null;
    if (ref) {
      basis.push("scene-graph", refId === selEntities[0]?.id ? "selection" : "utterance-history");
      const c = anchorOf(w, ref);
      const near = w.nearby(c, 25).filter((h) => h.entity.id !== ref.id && h.entity.type === ref.type);
      if (near.length) {
        const pick2 = near[0].entity;
        return { kind: "entities", ids: [pick2.id], point: anchorOf(w, pick2), ring: w.ringOf(pick2), line: null, basis, confidence: 0.65, ambiguity: null };
      }
    }
    return none("next-to has no anchor", [], "Next to which one?");
  }
  if (has2(tagged, "DEIXIS.toward")) {
    const name = [...w.place.landmarks.keys()].find((k) => tagged.norm.includes(k.toLowerCase()));
    if (name) {
      basis.push("landmark");
      const p = w.place.landmarks.get(name);
      const from = selEntities[0] ? anchorOf(w, selEntities[0]) : ctx.pointer || ctx.participant?.position || [0, 0];
      const dir = norm(sub(p, from));
      const at = [from[0] + dir[0] * 12, from[1] + dir[1] * 12];
      return { kind: "point", ids: selEntities.map((e) => e.id), point: at, ring: circleRing(at[0], at[1], 6, 20), line: [from, p], basis, confidence: 0.7, ambiguity: null, landmark: name };
    }
  }
  if (has2(tagged, "DEIXIS.far") && has2(tagged, "DEIXIS.corner")) {
    const ring3 = sel.ring || (selEntities[0] ? w.ringOf(selEntities[0]) : null);
    if (ring3 && ctx.camera) {
      basis.push("camera", sel.ring ? "gesture-region" : "selection");
      const eye2 = [ctx.camera.eye[0], ctx.camera.eye[1]];
      let far = ring3[0], bestD = -1;
      for (const p of ring3) {
        const d = dist(p, eye2);
        if (d > bestD) {
          bestD = d;
          far = p;
        }
      }
      return { kind: "point", ids: [], point: far, ring: circleRing(far[0], far[1], 4, 16), line: null, basis, confidence: 0.7, ambiguity: null };
    }
  }
  if (has2(tagged, "DEIXIS.these")) {
    if (selEntities.length >= 1) {
      basis.push("selection");
      return { kind: "entities", ids: selEntities.map((e) => e.id), point: centroid(selEntities.map((e) => anchorOf(w, e))), ring: null, line: null, basis, confidence: selEntities.length >= 2 ? 0.95 : 0.6, ambiguity: null };
    }
    if (sel.ring) {
      basis.push("gesture-region");
      const ids = w.index.within(sel.ring);
      return { kind: "region", ids, point: centroid(sel.ring), ring: sel.ring, line: null, basis, confidence: 0.85, ambiguity: null };
    }
    return none("plural reference with nothing selected", [], "Which ones? Tap or circle them.");
  }
  if (has2(tagged, "DEIXIS.this")) {
    if (selEntities.length === 1) {
      basis.push("selection");
      const e = selEntities[0];
      return { kind: "entities", ids: [e.id], point: anchorOf(w, e), ring: w.ringOf(e), line: null, basis, confidence: 0.95, ambiguity: null };
    }
    if (selEntities.length > 1) {
      basis.push("selection");
      return { kind: "entities", ids: selEntities.map((e) => e.id), point: centroid(selEntities.map((e) => anchorOf(w, e))), ring: null, line: null, basis, confidence: 0.6, ambiguity: null };
    }
    if (ctx.pointer) {
      const e = w.entityAt(ctx.pointer);
      basis.push("pointer");
      if (e) return { kind: "entities", ids: [e.id], point: anchorOf(w, e), ring: w.ringOf(e), line: null, basis, confidence: 0.85, ambiguity: null };
      return { kind: "point", ids: [], point: ctx.pointer, ring: circleRing(ctx.pointer[0], ctx.pointer[1], 4, 16), line: null, basis, confidence: 0.6, ambiguity: null };
    }
    if (sel.ring) {
      basis.push("gesture-region");
      return { kind: "region", ids: w.index.within(sel.ring), point: centroid(sel.ring), ring: sel.ring, line: null, basis, confidence: 0.8, ambiguity: null };
    }
    if (sel.stroke && sel.stroke.length >= 2) {
      basis.push("gesture-stroke");
      return { kind: "polyline", ids: [], point: centroid(sel.stroke), ring: null, line: sel.stroke, basis, confidence: 0.75, ambiguity: null };
    }
    return none('"this" with nothing selected and nothing pointed at', [], "Tap the thing you mean.");
  }
  if (has2(tagged, "DEIXIS.here") || has2(tagged, "DEIXIS.there")) {
    const distal = has2(tagged, "DEIXIS.there") && !has2(tagged, "DEIXIS.here");
    if (sel.ring) {
      basis.push("gesture-region");
      return { kind: "region", ids: w.index.within(sel.ring), point: centroid(sel.ring), ring: sel.ring, line: null, basis, confidence: 0.9, ambiguity: null };
    }
    if (sel.stroke && sel.stroke.length >= 2) {
      basis.push("gesture-stroke");
      return { kind: "polyline", ids: [], point: centroid(sel.stroke), ring: null, line: sel.stroke, basis, confidence: 0.85, ambiguity: null };
    }
    if (ctx.pointer) {
      basis.push("pointer");
      const r = distal ? 8 : 5;
      const under = w.entityAt(ctx.pointer);
      const ids = selEntities.length ? selEntities.map((e) => e.id) : under ? [under.id] : [];
      if (ids.length) basis.push(selEntities.length ? "selection" : "entity-under-pointer");
      return { kind: "point", ids, point: ctx.pointer, ring: circleRing(ctx.pointer[0], ctx.pointer[1], r, 20), line: null, basis, confidence: 0.8, ambiguity: null };
    }
    if (selEntities.length) {
      basis.push("selection");
      const c = centroid(selEntities.map((e) => anchorOf(w, e)));
      return { kind: "point", ids: selEntities.map((e) => e.id), point: c, ring: circleRing(c[0], c[1], 6, 20), line: null, basis, confidence: 0.7, ambiguity: null };
    }
    if (!distal && ctx.participant) {
      basis.push("gps");
      const p = ctx.participant.position;
      return { kind: "point", ids: [], point: p, ring: circleRing(p[0], p[1], 6, 20), line: null, basis, confidence: 0.6, ambiguity: null };
    }
    return none('"here" with no gesture, selection or position', [], "Where? Tap the map.");
  }
  if (selEntities.length) {
    basis.push("selection");
    return { kind: "entities", ids: selEntities.map((e) => e.id), point: centroid(selEntities.map((e) => anchorOf(w, e))), ring: selEntities.length === 1 ? w.ringOf(selEntities[0]) : null, line: null, basis, confidence: 0.7, ambiguity: null };
  }
  if (sel.ring) {
    basis.push("gesture-region");
    return { kind: "region", ids: w.index.within(sel.ring), point: centroid(sel.ring), ring: sel.ring, line: null, basis, confidence: 0.8, ambiguity: null };
  }
  if (sel.stroke && sel.stroke.length >= 2) {
    basis.push("gesture-stroke");
    return { kind: "polyline", ids: [], point: centroid(sel.stroke), ring: null, line: sel.stroke, basis, confidence: 0.8, ambiguity: null };
  }
  if (ctx.pointer) {
    basis.push("pointer");
    const e = w.entityAt(ctx.pointer);
    if (e) return { kind: "entities", ids: [e.id], point: anchorOf(w, e), ring: w.ringOf(e), line: null, basis, confidence: 0.6, ambiguity: null };
    return { kind: "point", ids: [], point: ctx.pointer, ring: circleRing(ctx.pointer[0], ctx.pointer[1], 5, 16), line: null, basis, confidence: 0.5, ambiguity: null };
  }
  return none("nothing indicated", [], "Tap, draw, or circle the part of the place you mean.");
}
function filterByThing(ref, thing, ctx) {
  if (!thing) return ref;
  const types = TYPE_FOR_THING[thing];
  if (!types) return ref;
  const w = ctx.world;
  let pool = ref.ids;
  if ((ref.kind === "region" || ref.kind === "point") && ref.ring) pool = w.index.within(ref.ring).concat(w.index.overlapping(ref.ring));
  const ids = [...new Set(pool)].filter((id) => {
    const e = w.get(id);
    return e && (types.includes(e.type) || e.subtype && types.includes(e.subtype));
  });
  if (!ids.length) return ref;
  return { ...ref, kind: "entities", ids, thingFiltered: thing };
}
function explainReference(ref, world) {
  const names = ref.ids.map((id) => world.get(id)?.name || id);
  const basis = ref.basis.join(" + ") || "nothing";
  if (ref.kind === "none") return `couldn't tell what you meant \u2014 ${ref.ambiguity.reason}`;
  if (ref.kind === "entities") return `${names.join(", ")} \u2014 from ${basis}`;
  if (ref.kind === "region") return `an area of ${area(ref.ring).toFixed(0)} m\xB2 \u2014 from ${basis}`;
  if (ref.kind === "polyline") return `a ${perimeter(ref.line, false).toFixed(1)} m line \u2014 from ${basis}`;
  return `a point at ${ref.point.map((v) => v.toFixed(1)).join(", ")} \u2014 from ${basis}`;
}

// src/world/body.js
function boxBody({ id = "box", name = "Building", width = 8, depth = 6, height = 3 }) {
  const w = width / 2, d = depth / 2;
  return {
    id,
    name,
    footprint: [[-w, -d], [w, -d], [w, d], [-w, d]],
    height,
    datum: 0,
    entrances: [[0, -d]],
    appearance: { kind: "prism" },
    source: { kind: "dimensions", width, depth, height }
  };
}
var GLB_MAGIC = 1179937895;
var CHUNK_JSON = 1313821514;
var CHUNK_BIN = 5130562;
function readGLB(buffer) {
  const dv = new DataView(buffer);
  if (dv.byteLength < 12 || dv.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("not a .glb file");
  }
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`glTF version ${version} is not supported \u2014 this reads glTF 2.0`);
  let json = null, bin = null;
  let at = 12;
  while (at + 8 <= dv.byteLength) {
    const len2 = dv.getUint32(at, true);
    const type = dv.getUint32(at + 4, true);
    const start = at + 8;
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, len2)));
    else if (type === CHUNK_BIN) bin = new Uint8Array(buffer, start, len2);
    at = start + len2 + (4 - len2 % 4) % 4;
  }
  if (!json) throw new Error("this .glb has no JSON chunk");
  const points = [];
  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene?.nodes ?? json.nodes?.map((_, i) => i) ?? [];
  for (const n of roots) walkNode(json, bin, n, IDENTITY, points);
  if (!points.length) throw new Error("this model has no geometry to measure");
  return { points, json };
}
var IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function walkNode(json, bin, index, parent, out) {
  const node = json.nodes?.[index];
  if (!node) return;
  const local = node.matrix ? node.matrix : trs(node);
  const world = multiply(parent, local);
  if (node.mesh !== void 0) {
    for (const prim of json.meshes[node.mesh]?.primitives || []) {
      const acc = prim.attributes?.POSITION;
      if (acc === void 0) continue;
      readPositions(json, bin, acc, world, out);
    }
  }
  for (const child of node.children || []) walkNode(json, bin, child, world, out);
}
function trs(node) {
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const [x, y, z, w] = r;
  const m = [
    (1 - 2 * (y * y + z * z)) * s[0],
    2 * (x * y + z * w) * s[0],
    2 * (x * z - y * w) * s[0],
    0,
    2 * (x * y - z * w) * s[1],
    (1 - 2 * (x * x + z * z)) * s[1],
    2 * (y * z + x * w) * s[1],
    0,
    2 * (x * z + y * w) * s[2],
    2 * (y * z - x * w) * s[2],
    (1 - 2 * (x * x + y * y)) * s[2],
    0,
    t[0],
    t[1],
    t[2],
    1
  ];
  return m;
}
function multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) o[i * 4 + j] += b[i * 4 + k] * a[k * 4 + j];
    }
  }
  return o;
}
var COMPONENT = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
function readPositions(json, bin, accessorIndex, world, out) {
  const acc = json.accessors[accessorIndex];
  if (!acc || acc.type !== "VEC3") return;
  if (acc.componentType !== 5126) return;
  const view = json.bufferViews[acc.bufferView];
  if (!view || !bin) return;
  const stride = view.byteStride || 3 * COMPONENT[acc.componentType];
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    if (o + 12 > dv.byteLength) break;
    const x = dv.getFloat32(o, true);
    const y = dv.getFloat32(o + 4, true);
    const z = dv.getFloat32(o + 8, true);
    const wx = world[0] * x + world[4] * y + world[8] * z + world[12];
    const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
    const wz = world[2] * x + world[6] * y + world[10] * z + world[14];
    out.push([wx, -wz, wy]);
  }
}
function bodyFromModel(points, { id, name = "Model", url = null, skirt = 0.6 } = {}) {
  let lo = Infinity, hi = -Infinity;
  for (const p of points) {
    if (p[2] < lo) lo = p[2];
    if (p[2] > hi) hi = p[2];
  }
  const height = hi - lo;
  const cut = lo + Math.max(0.4, height * 0.1);
  const low = points.filter((p) => p[2] <= cut).map((p) => [p[0], p[1]]);
  const ring3 = convexHull(low.length >= 3 ? low : points.map((p) => [p[0], p[1]]));
  if (!ring3 || ring3.length < 3) throw new Error("this model has no footprint to sit on");
  const c = centroid(ring3);
  const footprint = ring3.map((p) => [p[0] - c[0], p[1] - c[1]]);
  return {
    id: id || `model-${Math.abs(hashOf(url || name))}`,
    name,
    footprint,
    height,
    datum: lo,
    // the mid-point of the longest edge, as a first guess at the way in
    entrances: [longestEdgeMid(footprint)],
    appearance: { kind: url ? "glb" : "points", url, offset: [-c[0], -c[1], -lo] },
    source: { kind: "glb", url, vertices: points.length, raw: { lo, hi } }
  };
}
function longestEdgeMid(ring3) {
  let best = 0, at = [0, 0];
  for (let i = 0; i < ring3.length; i++) {
    const a = ring3[i], b = ring3[(i + 1) % ring3.length];
    const d = dist(a, b);
    if (d > best) {
      best = d;
      at = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
  }
  return at;
}
function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
function footprintAt(body, at, rotation = 0) {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return body.footprint.map(([x, y]) => [
    at[0] + x * cos - y * sin,
    at[1] + x * sin + y * cos
  ]);
}
function entrancesAt(body, at, rotation = 0) {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return (body.entrances || []).map(([x, y]) => [
    at[0] + x * cos - y * sin,
    at[1] + x * sin + y * cos
  ]);
}

// src/world/seat.js
function planSeat(world, body, at, {
  rotation = 0,
  level = "balanced",
  batter = 0.5,
  apron = 1.2
} = {}) {
  const t = world.place.terrain;
  if (!t) throw new Error("there is no ground here to seat anything on");
  const ring3 = footprintAt(body, at, rotation);
  const pad = apron > 0 ? offsetRing(ring3, apron) : ring3;
  const span = groundSpan(pad, (x, y) => world.place.groundAt(x, y), 8);
  if (!span) throw new Error("this footprint does not fall on the ground");
  const samples = sampleGround(world, pad, t.cell / 2);
  const floor = typeof level === "number" ? level : level === "cut" ? span.lo : level === "fill" ? span.hi : median(samples);
  const MAX_REACH = 30;
  const want = Math.max(0.5, Math.abs(span.hi - span.lo)) / Math.max(0.05, batter);
  const reach = Math.min(MAX_REACH, want);
  const retained = want > MAX_REACH ? +(want - MAX_REACH).toFixed(1) : 0;
  const outer = offsetRing(pad, reach);
  const cellArea = t.cell / 2 * (t.cell / 2);
  let cut = 0, fill = 0, disturbed = 0;
  for (const s of sampleGround(world, outer, t.cell / 2, true)) {
    const target = targetHeight(s.p, pad, floor, batter, s.z);
    if (target === null) continue;
    const d = target - s.z;
    if (Math.abs(d) < 0.02) continue;
    disturbed += cellArea;
    if (d < 0) cut += -d * cellArea;
    else fill += d * cellArea;
  }
  const grade = Math.max(0, span.hi - span.lo);
  return {
    body,
    at,
    rotation,
    floor,
    batter,
    apron,
    ring: ring3,
    pad,
    outer,
    ground: span,
    naturalFall: grade,
    cut,
    fill,
    balance: fill - cut,
    disturbedArea: disturbed,
    // how much fall the batter could not absorb: what a wall would have to hold
    retained: retained * batter,
    // what a person actually needs told
    reads: `${body.name}: floor at ${floor.toFixed(1)} m on ground falling ${grade.toFixed(1)} m \u2014 ${Math.round(cut)} m\xB3 cut, ${Math.round(fill)} m\xB3 fill, ${Math.round(disturbed)} m\xB2 of ground disturbed.` + (retained ? ` The slope cannot absorb ${(retained * batter).toFixed(1)} m of it \u2014 that is a retaining wall, or a different site.` : ""),
    entrances: entrancesAt(body, at, rotation)
  };
}
function targetHeight(p, pad, floor, batter, natural) {
  if (pointInRing2(p, pad)) return floor;
  const d = ringDistance(pad, circleRing(p[0], p[1], 0.01, 4));
  const blended = floor + (natural > floor ? d * batter : -d * batter);
  if (natural > floor) return Math.min(natural, blended);
  return Math.max(natural, blended);
}
function sampleGround(world, ring3, step, keepPoints = false) {
  const b = bbox(ring3);
  const out = [];
  if (!(step > 0) || !isFinite(b[0]) || !isFinite(b[2])) return out;
  const MAX = 4e4;
  for (let y = b[1]; y <= b[3]; y += step) {
    for (let x = b[0]; x <= b[2]; x += step) {
      if (out.length >= MAX) return out;
      if (!pointInRing2([x, y], ring3)) continue;
      const z = world.place.groundAt(x, y);
      out.push(keepPoints ? { p: [x, y], z } : z);
    }
  }
  return out;
}
function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function refineTerrain(place2, targetCell = 3, around = null, radius = 90) {
  const t = place2.terrain;
  if (!t) throw new Error("there is no ground here to refine");
  if (t.cell <= targetCell * 1.2) return { refined: false, cell: t.cell, samples: t.data.length };
  const bounds = around ? [around[0] - radius, around[1] - radius, around[0] + radius, around[1] + radius] : t.bounds;
  const clipped = [
    Math.max(t.bounds[0], bounds[0]),
    Math.max(t.bounds[1], bounds[1]),
    Math.min(t.bounds[2], bounds[2]),
    Math.min(t.bounds[3], bounds[3])
  ];
  const wanted = ((clipped[2] - clipped[0]) / targetCell + 1) * ((clipped[3] - clipped[1]) / targetCell + 1);
  const MAX = 4e5;
  if (wanted > MAX) {
    return {
      refined: false,
      refused: true,
      cell: t.cell,
      reason: `recording ${targetCell} m detail over ${Math.round(clipped[2] - clipped[0])} m needs ${Math.round(wanted / 1e3)}k samples \u2014 ask for a smaller area`
    };
  }
  const Heightfield2 = t.constructor;
  const fine = new Heightfield2(clipped, targetCell);
  for (let j = 0; j < fine.ny; j++) {
    for (let i = 0; i < fine.nx; i++) {
      const x = fine.bounds[0] + i * fine.cell, y = fine.bounds[1] + j * fine.cell;
      const k = fine.idx(i, j);
      fine.data[k] = t.heightAt(x, y);
      fine.prov[k] = 1;
    }
  }
  place2.terrain = fine;
  place2.coarseGround = t;
  place2.meta = place2.meta || {};
  place2.meta.refined = {
    from: +t.cell.toFixed(1),
    to: targetCell,
    over: `${Math.round(clipped[2] - clipped[0])}\xD7${Math.round(clipped[3] - clipped[1])} m`,
    note: "heights between the original samples are interpolation, not survey"
  };
  return { refined: true, from: t.cell, cell: fine.cell, samples: fine.data.length, bounds: clipped };
}
function settleGround(world, seat) {
  const t = world.place.terrain;
  const b = bbox(seat.outer);
  const before = [];
  const i0 = Math.max(0, Math.floor((b[0] - t.bounds[0]) / t.cell));
  const i1 = Math.min(t.nx - 1, Math.ceil((b[2] - t.bounds[0]) / t.cell));
  const j0 = Math.max(0, Math.floor((b[1] - t.bounds[1]) / t.cell));
  const j1 = Math.min(t.ny - 1, Math.ceil((b[3] - t.bounds[1]) / t.cell));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = t.bounds[0] + i * t.cell, y = t.bounds[1] + j * t.cell;
      const k = j * t.nx + i;
      const natural = t.data[k];
      if (!pointInRing2([x, y], seat.outer)) continue;
      const target = targetHeight([x, y], seat.pad, seat.floor, seat.batter, natural);
      if (target === null || Math.abs(target - natural) < 0.01) continue;
      before.push([k, natural]);
      t.data[k] = target;
    }
  }
  t.__lo = void 0;
  return { restore: () => {
    for (const [k, z] of before) t.data[k] = z;
    t.__lo = void 0;
  }, changed: before.length };
}
function disturbances(world, seat) {
  const out = [];
  for (const e of world.entities()) {
    const r = world.ringOf(e);
    if (!r || r.length < 3) continue;
    const c = centroid(r);
    const inside = pointInRing2(c, seat.outer);
    const crosses = inside || r.some((p) => pointInRing2(p, seat.outer));
    if (!crosses) continue;
    const under = pointInRing2(c, seat.pad);
    out.push({
      id: e.id,
      name: e.name || e.use || e.type,
      type: e.type,
      how: under ? "stands where the building goes" : "is in the disturbed ground around it",
      // for a way, how far its ground moves is the number that matters
      moves: e.type === "road" || e.type === "path" ? +(targetHeight(c, seat.pad, seat.floor, seat.batter, world.place.groundAt(c[0], c[1])) - world.place.groundAt(c[0], c[1])).toFixed(2) : null
    });
  }
  return out.sort((a, b) => Math.abs(b.moves || 0) - Math.abs(a.moves || 0));
}

// src/lang/lexicon.js
var TERMS = {
  // --- deictic ---------------------------------------------------------------
  "DEIXIS.this": { en: ["this", "that", "it"], sw: ["hii", "hiyo", "ile"], es: ["esto", "esta", "este", "eso"], pt: ["isto", "isso", "este"], fr: ["ceci", "cela", "\xE7a"] },
  "DEIXIS.these": { en: ["these", "those", "them", "both"], sw: ["hizi", "hizo", "zile"], es: ["estos", "estas", "esos", "ambos"], pt: ["estes", "esses", "ambos"], fr: ["ces", "ceux"] },
  "DEIXIS.here": { en: ["here"], sw: ["hapa"], es: ["aqui", "aqu\xED", "ac\xE1"], pt: ["aqui", "c\xE1"], fr: ["ici"] },
  "DEIXIS.there": { en: ["there"], sw: ["pale", "huko"], es: ["alli", "all\xED", "ahi", "ah\xED"], pt: ["ali", "l\xE1"], fr: ["l\xE0"] },
  "DEIXIS.behind": { en: ["behind"], sw: ["nyuma", "nyuma ya"], es: ["detras", "detr\xE1s"], pt: ["atras", "atr\xE1s"], fr: ["derriere", "derri\xE8re"] },
  "DEIXIS.front": { en: ["in front of", "front of"], sw: ["mbele", "mbele ya"], es: ["delante", "frente"], pt: ["frente"], fr: ["devant"] },
  "DEIXIS.between": { en: ["between"], sw: ["kati", "kati ya"], es: ["entre"], pt: ["entre"], fr: ["entre"] },
  "DEIXIS.along": { en: ["along"], sw: ["kando", "kando ya"], es: ["a lo largo"], pt: ["ao longo"], fr: ["le long"] },
  "DEIXIS.around": { en: ["around"], sw: ["kuzunguka"], es: ["alrededor"], pt: ["ao redor"], fr: ["autour"] },
  "DEIXIS.toward": { en: ["toward", "towards"], sw: ["kuelekea"], es: ["hacia"], pt: ["em direcao", "em dire\xE7\xE3o"], fr: ["vers"] },
  "DEIXIS.far": { en: ["far", "farthest", "furthest"], sw: ["mbali"], es: ["lejano", "lejos"], pt: ["distante"], fr: ["loin"] },
  "DEIXIS.next": { en: ["next to", "beside", "adjacent"], sw: ["karibu na", "jirani"], es: ["al lado", "junto"], pt: ["ao lado"], fr: ["a cote", "\xE0 c\xF4t\xE9"] },
  "DEIXIS.before": { en: ["where we were before", "before"], sw: ["tulipokuwa"], es: ["donde estabamos", "donde est\xE1bamos"], pt: ["onde estavamos"], fr: ["ou nous etions"] },
  "DEIXIS.corner": { en: ["corner"], sw: ["kona"], es: ["esquina"], pt: ["canto"], fr: ["coin"] },
  // --- verbs / operations ----------------------------------------------------
  "OP.observe": { en: ["floods", "flood", "floods here", "is flooded", "collects", "gathers", "happens", "always", "gets", "smells", "is dark", "unsafe", "noisy", "dusty", "fills with", "fills up", "stands here", "never dries"], sw: ["inafurika", "mafuriko", "giza", "hatari", "inajaa"], es: ["inunda", "inunda aqui", "se inunda", "se llena", "oscuro", "peligroso"], pt: ["alaga", "inunda", "enche", "escuro"], fr: ["inonde", "se remplit", "sombre"] },
  "OP.walk": { en: ["walk", "walks", "walk here", "pass", "go through", "shortcut"], sw: ["tembea", "wanapita"], es: ["caminan", "pasan", "atajo"], pt: ["caminham", "passam", "atalho"], fr: ["marchent", "passent"] },
  "OP.propose": { en: ["should be", "should have", "put", "add", "build", "plant", "make a", "we need", "need a", "want a", "lets", "let's", "create"], sw: ["tuweke", "panda", "jenga", "tunahitaji", "weka"], es: ["deberia", "deber\xEDa", "poner", "construir", "plantar", "necesitamos", "agregar"], pt: ["deveria", "colocar", "construir", "plantar", "precisamos"], fr: ["devrait", "mettre", "construire", "planter"] },
  // Comparatives live in the Q.* families only. Listing "taller" here as well
  // meant the tagger's first match masked the other, so "make this 3 m taller"
  // lost its axis and applied the number to width.
  "OP.modify": { en: ["make this", "make it", "raise", "lower", "widen", "narrow", "extend", "move", "rotate", "set"], sw: ["ongeza", "punguza", "panua", "sogeza"], es: ["hacer", "subir", "bajar", "ampliar", "mover"], pt: ["aumentar", "baixar", "alargar", "mover"], fr: ["augmenter", "elargir", "deplacer"] },
  "OP.relate": { en: ["connect", "join together", "join"], sw: ["unganisha"], es: ["conectar", "unir"], pt: ["conectar", "unir"], fr: ["relier", "connecter"] },
  "OP.preserve": { en: ["keep", "preserve", "protect", "save", "dont touch", "don't touch", "leave"], sw: ["acha", "hifadhi", "linda"], es: ["mantener", "conservar", "proteger", "dejar"], pt: ["manter", "preservar", "deixar"], fr: ["garder", "preserver", "laisser"] },
  "OP.remove": { en: ["remove", "delete", "take out", "demolish", "clear out", "no more"], sw: ["ondoa", "bomoa"], es: ["quitar", "eliminar", "demoler"], pt: ["remover", "demolir"], fr: ["enlever", "supprimer"] },
  "OP.branch": { en: ["show", "what if", "imagine", "as if", "version", "option", "alternative", "futures", "future"], sw: ["onyesha", "kama", "chaguo"], es: ["mostrar", "que pasa si", "imagina", "opcion", "opci\xF3n"], pt: ["mostrar", "e se", "imagine", "opcao"], fr: ["montre", "et si", "imagine", "option"] },
  // Weather and time-of-day belong to Q.rain / Q.night; duplicating them here
  // swallowed the very phrases that trigger the simulation.
  "OP.simulate": { en: ["what happens", "simulate", "test it", "years pass", "years", "grow"], sw: ["miaka"], es: ["anos", "a\xF1os", "simular"], pt: ["anos", "simular"], fr: ["ans", "simuler"] },
  "OP.ask": { en: ["what", "why", "who", "where", "which", "how many", "how much", "compare", "can", "is there"], sw: ["nini", "kwanini", "nani", "wapi", "ngapi"], es: ["que", "qu\xE9", "por que", "quien", "qui\xE9n", "donde", "d\xF3nde", "cuanto", "comparar"], pt: ["que", "porque", "quem", "onde", "quantos"], fr: ["quoi", "pourquoi", "qui", "ou", "o\xF9", "combien"] },
  "OP.measure": { en: ["how long", "how wide", "how far", "measure", "area of", "distance"], sw: ["umbali", "pima"], es: ["distancia", "medir", "area"], pt: ["distancia", "medir"], fr: ["distance", "mesurer"] },
  // --- things ---------------------------------------------------------------
  "THING.tree": { en: ["tree", "trees", "shade tree"], sw: ["mti", "miti"], es: ["arbol", "\xE1rbol", "arboles", "\xE1rboles"], pt: ["arvore", "\xE1rvores"], fr: ["arbre", "arbres"] },
  "THING.garden": { en: ["garden", "community garden", "rain garden", "planting"], sw: ["bustani", "shamba"], es: ["jardin", "jard\xEDn", "huerto"], pt: ["jardim", "horta"], fr: ["jardin"] },
  "THING.drain": { en: ["drain", "ditch", "channel", "culvert", "gutter"], sw: ["mtaro", "mfereji"], es: ["drenaje", "canal", "zanja"], pt: ["dreno", "canal", "vala"], fr: ["drain", "canal", "fosse"] },
  "THING.swale": { en: ["swale", "bioswale", "soakaway"], sw: ["mtaro wa maji"], es: ["cuneta verde"], pt: ["vala verde"], fr: ["noue"] },
  "THING.path": { en: ["path", "walkway", "footpath", "sidewalk", "pavement"], sw: ["njia", "kijia"], es: ["sendero", "acera", "camino"], pt: ["caminho", "calcada"], fr: ["chemin", "trottoir"] },
  "THING.road": { en: ["road", "street", "lane"], sw: ["barabara", "mtaa"], es: ["calle", "carretera"], pt: ["rua", "estrada"], fr: ["rue", "route"] },
  "THING.building": { en: ["building", "buildings", "house", "houses", "structure", "shed"], sw: ["jengo", "majengo", "nyumba"], es: ["edificio", "casa", "casas"], pt: ["edificio", "casa"], fr: ["batiment", "b\xE2timent", "maison"] },
  "THING.room": { en: ["room", "rooms"], sw: ["chumba", "vyumba"], es: ["cuarto", "habitacion"], pt: ["quarto", "sala"], fr: ["piece", "pi\xE8ce", "salle"] },
  "THING.floor": { en: ["floor", "storey", "story", "level"], sw: ["ghorofa"], es: ["piso", "planta"], pt: ["andar", "piso"], fr: ["etage", "\xE9tage"] },
  "THING.greenhouse": { en: ["greenhouse", "glasshouse"], sw: ["kitalu"], es: ["invernadero"], pt: ["estufa"], fr: ["serre"] },
  "THING.bridge": { en: ["bridge", "walkway", "link"], sw: ["daraja"], es: ["puente"], pt: ["ponte"], fr: ["pont"] },
  "THING.bench": { en: ["bench", "seat", "seating"], sw: ["benchi", "kiti"], es: ["banco"], pt: ["banco"], fr: ["banc"] },
  "THING.light": { en: ["light", "lamp", "streetlight", "lighting"], sw: ["taa"], es: ["luz", "farola"], pt: ["luz", "poste"], fr: ["lampadaire", "lumiere"] },
  "THING.water": { en: ["water", "pond", "river", "stream", "channel"], sw: ["maji", "mto"], es: ["agua", "rio", "r\xEDo"], pt: ["agua", "rio"], fr: ["eau", "riviere"] },
  "THING.wall": { en: ["wall", "fence"], sw: ["ukuta", "uzio"], es: ["muro", "pared", "valla"], pt: ["muro", "parede"], fr: ["mur", "cloture"] },
  "THING.car": { en: ["car", "cars", "parking", "traffic", "vehicles"], sw: ["gari", "magari"], es: ["coche", "coches", "autos", "trafico"], pt: ["carro", "carros"], fr: ["voiture", "voitures"] },
  "THING.market": { en: ["market", "stall", "stalls", "kiosk", "shop"], sw: ["soko", "kibanda", "duka"], es: ["mercado", "puesto", "tienda"], pt: ["mercado", "banca"], fr: ["marche", "march\xE9", "etal"] },
  "THING.roof": { en: ["roof", "rooftop"], sw: ["paa"], es: ["techo", "azotea"], pt: ["telhado"], fr: ["toit"] },
  "THING.window": { en: ["window", "windows"], sw: ["dirisha", "madirisha"], es: ["ventana", "ventanas"], pt: ["janela"], fr: ["fenetre", "fen\xEAtre"] },
  "THING.people": { en: ["people", "children", "kids", "women", "residents", "everyone"], sw: ["watu", "watoto", "wanawake"], es: ["gente", "ninos", "ni\xF1os", "personas"], pt: ["pessoas", "criancas"], fr: ["gens", "enfants"] },
  // --- qualifiers -----------------------------------------------------------
  "Q.tall": { en: ["tall", "taller", "high", "higher"], sw: ["refu", "juu"], es: ["alto", "mas alto", "m\xE1s alto"], pt: ["alto"], fr: ["haut"] },
  "Q.wide": { en: ["wide", "wider", "broad"], sw: ["pana"], es: ["ancho"], pt: ["largo"], fr: ["large"] },
  "Q.deep": { en: ["deep", "deeper"], sw: ["kina"], es: ["profundo"], pt: ["fundo"], fr: ["profond"] },
  "Q.long": { en: ["long", "longer"], sw: ["urefu"], es: ["largo"], pt: ["comprido"], fr: ["long"] },
  "Q.twice": { en: ["twice", "double"], sw: ["mara mbili"], es: ["doble"], pt: ["dobro"], fr: ["double"] },
  "Q.half": { en: ["half"], sw: ["nusu"], es: ["mitad"], pt: ["metade"], fr: ["moitie"] },
  "Q.not": { en: ["not", "dont", "don't", "without", "except", "but not", "avoid"], sw: ["bila", "usiweke", "lakini si"], es: ["sin", "no", "excepto", "evitar"], pt: ["sem", "nao", "exceto"], fr: ["sans", "pas", "sauf"] },
  "Q.block": { en: ["block", "blocks", "blocking", "cover", "covering", "obstruct"], sw: ["ziba", "funga"], es: ["bloquear", "tapar"], pt: ["bloquear", "tapar"], fr: ["bloquer", "couvrir"] },
  "Q.all": { en: ["everything", "all", "every"], sw: ["yote", "kila"], es: ["todo", "todos"], pt: ["tudo", "todos"], fr: ["tout", "tous"] },
  "Q.night": { en: ["night", "at night", "dark"], sw: ["usiku"], es: ["noche"], pt: ["noite"], fr: ["nuit"] },
  "Q.rain": { en: ["rain", "raining", "heavy rain", "storm", "wet"], sw: ["mvua"], es: ["lluvia", "tormenta"], pt: ["chuva"], fr: ["pluie"] },
  "Q.radical": { en: ["radically different", "radical", "different", "very different"], sw: ["tofauti"], es: ["diferentes", "radicalmente"], pt: ["diferentes"], fr: ["differents"] }
};
var INDEX = [];
for (const [token, byLang] of Object.entries(TERMS)) {
  for (const [lang, forms] of Object.entries(byLang)) {
    for (const form of forms) INDEX.push({ form: form.toLowerCase(), token, lang, n: form.split(/\s+/).length });
  }
}
INDEX.sort((a, b) => b.form.length - a.form.length);
function normalize(text) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/(\d)[.,](\d)/g, "$1\xB7$2").replace(/[.,!?;:()"]/g, " ").replace(/·/g, ".").replace(/\s+/g, " ").trim();
}
function tag(text) {
  const original = text;
  const norm2 = normalize(text);
  const hits = [];
  const langVotes = /* @__PURE__ */ new Map();
  let masked = ` ${norm2} `;
  for (const entry of INDEX) {
    const needle = ` ${entry.form} `;
    let at = masked.indexOf(needle);
    if (at === -1) {
      const re = new RegExp(`(?<=\\s)${escapeRe(entry.form)}(?=\\s)`);
      const m = masked.match(re);
      at = m ? m.index : -1;
    }
    if (at >= 0) {
      hits.push({ token: entry.token, form: entry.form, at, lang: entry.lang });
      langVotes.set(entry.lang, (langVotes.get(entry.lang) || 0) + entry.n);
      masked = masked.slice(0, at) + " ".repeat(entry.form.length) + masked.slice(at + entry.form.length);
    }
  }
  hits.sort((a, b) => a.at - b.at);
  let lang = "en", bestVotes = 0;
  for (const [l, v] of langVotes) if (v > bestVotes) {
    bestVotes = v;
    lang = l;
  }
  return { original, norm: norm2, tokens: hits, lang, has: (t) => hits.some((h) => h.token === t) };
}
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twenty: 20,
  thirty: 30,
  fifty: 50,
  hundred: 100,
  moja: 1,
  mbili: 2,
  tatu: 3,
  nne: 4,
  tano: 5,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  veinte: 20
};
function quantities(text) {
  const out = [];
  const norm2 = normalize(text);
  const re = /(-?\d+(?:\.\d+)?)\s*(m|metre|metres|meter|meters|cm|mm|km|ft|feet|%|percent|deg|degrees|°|m2|sqm|m²)?/g;
  let m;
  while (m = re.exec(norm2)) {
    const v = parseFloat(m[1]);
    const unit = (m[2] || "").replace("metres", "m").replace("metre", "m").replace("meters", "m").replace("meter", "m");
    let metres = v;
    if (unit === "cm") metres = v / 100;
    else if (unit === "mm") metres = v / 1e3;
    else if (unit === "km") metres = v * 1e3;
    else if (unit === "ft" || unit === "feet") metres = v * 0.3048;
    out.push({ value: v, unit: unit || null, metres, at: m.index });
  }
  for (const [w, v] of Object.entries(WORD_NUMBERS)) {
    const i = ` ${norm2} `.indexOf(` ${w} `);
    if (i >= 0) out.push({ value: v, unit: null, metres: v, at: i, word: w });
  }
  return out.sort((a, b) => a.at - b.at);
}
function thingOf(tagged) {
  const t = tagged.tokens.find((h) => h.token.startsWith("THING."));
  return t ? t.token.slice(6) : null;
}
function things(tagged) {
  return tagged.tokens.filter((h) => h.token.startsWith("THING.")).map((h) => h.token.slice(6));
}

// src/lang/interpret.js
var _interpreter = null;
var has3 = (t, tok) => t.tokens.some((h) => h.token === tok);
function interpret(text, ctx) {
  if (_interpreter) return _interpreter(text, ctx, ruleInterpret);
  return ruleInterpret(text, ctx);
}
function ruleInterpret(text, ctx) {
  const tagged = tag(text);
  const qty = quantities(text);
  const nouns = things(tagged);
  const thing = thingOf(tagged);
  const norm2 = tagged.norm;
  let reference = resolveReference(tagged, ctx);
  if (thing && (has3(tagged, "DEIXIS.these") || has3(tagged, "DEIXIS.this") || reference.kind === "region")) {
    reference = filterByThing(reference, thing, ctx);
  }
  const intent = {
    original: text,
    // never translated, never overwritten (§24)
    lang: tagged.lang,
    norm: norm2,
    tagged,
    operation: null,
    secondary: null,
    reference,
    thing,
    things: nouns,
    quantities: qty,
    constraints: [],
    question: null,
    confidence: 0.5,
    needs: [],
    notes: []
  };
  const isQuestion = /\?\s*$/.test(text.trim()) || /^(what|why|who|where|which|how|can|is|does|nini|kwanini|nani|wapi|que|qué|por que|quien|donde|cuanto|quoi|pourquoi|combien)\b/.test(norm2) || /\b(compare|comparar|difference between|what changed|tell me about|who made)\b/.test(norm2);
  const wantsScenario = /\b(what happens|what if|as if|et si|e se|que pasa si|itakuwaje)\b/.test(norm2);
  if (isQuestion && !wantsScenario) {
    intent.operation = "ASK";
    intent.question = classifyQuestion(norm2, tagged);
    intent.confidence = 0.8;
    return finish2(intent, ctx);
  }
  if (has3(tagged, "OP.measure")) {
    intent.operation = "MEASURE";
    intent.confidence = 0.8;
    return finish2(intent, ctx);
  }
  if (/\b(combine|merge|mix|take .* from)\b/.test(norm2) && /\bfrom\b/.test(norm2)) {
    intent.operation = "MERGE";
    intent.secondary = "GRAFT";
    intent.grafts = parseGrafts(norm2, nouns);
    intent.confidence = intent.grafts.length ? 0.8 : 0.4;
    if (!intent.grafts.length) intent.needs.push("which branches to combine");
    return finish2(intent, ctx);
  }
  const hasScenarioSubject = has3(tagged, "Q.rain") || has3(tagged, "Q.night") || /\byears?\b|\bgrow\b|miaka|anos|años|\bans\b|\bsimulate\b|\bsimular\b/.test(norm2);
  const scenarioAsk = hasScenarioSubject && (wantsScenario || has3(tagged, "OP.simulate") || /\b(show|run|simulate|onyesha|mostrar|montre|muestra)\b/.test(norm2));
  if (scenarioAsk && !has3(tagged, "OP.observe")) {
    const isTemporal = /\byears?\b|\bgrow\b|\bafter\b|miaka|anos|años|ans/.test(norm2);
    if (!(has3(tagged, "OP.branch") && has3(tagged, "Q.not"))) {
      intent.operation = "SIMULATE";
      intent.secondary = isTemporal ? "TEMPORAL" : has3(tagged, "Q.rain") ? "WATER" : has3(tagged, "Q.night") ? "LIGHT" : "WATER";
      intent.scenario = {
        rain: has3(tagged, "Q.rain") ? "heavy" : null,
        night: has3(tagged, "Q.night") || null,
        years: isTemporal ? qty.find((q) => !q.unit)?.value ?? 1 : null
      };
      intent.confidence = 0.8;
      return finish2(intent, ctx);
    }
  }
  if ((has3(tagged, "OP.branch") || wantsScenario) && (/\b(what if|as if|option|alternative|futures?|version|without|e se|et si|que pasa si)\b/.test(norm2) || has3(tagged, "Q.radical"))) {
    const subtractive = has3(tagged, "Q.not") || has3(tagged, "OP.remove") || /\b(without|sin|sem|sans|bila)\b/.test(norm2);
    intent.operation = "BRANCH";
    intent.secondary = subtractive ? "TRANSFORM" : "DIVERGE";
    const n = qty.find((q) => !q.unit && q.value >= 2 && q.value <= 8);
    intent.count = n ? Math.round(n.value) : has3(tagged, "Q.radical") ? 3 : 1;
    if (subtractive && thing) intent.removeThing = thing;
    intent.confidence = 0.8;
    return finish2(intent, ctx);
  }
  if (has3(tagged, "OP.preserve")) {
    intent.operation = "PRESERVE";
    intent.confidence = 0.85;
    const exceptAt = norm2.search(/\b(except|but not|apart from|lakini si|excepto|sauf)\b/);
    if (exceptAt >= 0 || has3(tagged, "Q.all") && has3(tagged, "Q.not")) {
      intent.secondary = "REMOVE";
      intent.scope = has3(tagged, "Q.all") ? "all" : "selection";
      intent.exceptFrom = exceptAt;
    }
    return finish2(intent, ctx);
  }
  if (has3(tagged, "OP.remove") && !has3(tagged, "OP.propose")) {
    intent.operation = "REMOVE";
    intent.confidence = 0.8;
    return finish2(intent, ctx);
  }
  if (has3(tagged, "OP.relate")) {
    intent.operation = "RELATE";
    intent.secondary = "BRIDGE";
    intent.confidence = reference.ids.length >= 2 ? 0.9 : 0.5;
    if (reference.ids.length < 2) intent.needs.push("two things to connect");
    return finish2(intent, ctx);
  }
  if (has3(tagged, "OP.walk") && /\b(actually|really|people|children|kids|watu|gente)\b/.test(norm2)) {
    intent.operation = "OBSERVE";
    intent.secondary = "ROUTE";
    intent.confidence = 0.85;
    return finish2(intent, ctx);
  }
  if (has3(tagged, "OP.observe") && !has3(tagged, "OP.propose")) {
    intent.operation = "OBSERVE";
    intent.secondary = "CONDITION";
    intent.condition = conditionOf(norm2, tagged);
    intent.confidence = 0.85;
    return finish2(intent, ctx);
  }
  const comparative = has3(tagged, "Q.tall") || has3(tagged, "Q.wide") || has3(tagged, "Q.deep") || has3(tagged, "Q.long") || /\b(bigger|smaller|taller|shorter|wider|narrower|higher|lower)\b/.test(norm2);
  const explicitDim = qty.some((q) => q.unit === "m" || q.unit === "cm" || q.unit === "ft");
  if ((has3(tagged, "OP.modify") || comparative || explicitDim || /\bcontinue\b/.test(norm2)) && reference.ids.length) {
    intent.operation = "MODIFY";
    if (/\bcontinue\b/.test(norm2)) intent.secondary = "CONTINUE";
    else if (has3(tagged, "Q.tall") || /\bfloor|storey|story|ghorofa|piso|andar|etage\b/.test(norm2)) intent.secondary = "EXTRUDE";
    else if (has3(tagged, "Q.wide")) intent.secondary = "WIDEN";
    else if (has3(tagged, "Q.deep")) intent.secondary = "DEEPEN";
    else if (/\bmove|sogeza|mover|deplacer\b/.test(norm2)) intent.secondary = "MOVE";
    else intent.secondary = "SET";
    intent.magnitude = magnitudeOf(tagged, qty, norm2);
    intent.confidence = 0.85;
    return finish2(intent, ctx);
  }
  const declarative = /\b(is|are|was|were|isn't|aren't|fills|filling|floods|gets|got|becomes|comes|goes|stays|stands|always|never|every|when|whenever|because|used to|there is|there are)\b/.test(norm2) || /\b(kuna|iko|ni|hakuna|hay|está|esta|son|há|ha|il y a|c'est)\b/.test(norm2);
  const elliptical = norm2.split(" ").length <= 4 && thing && !declarative;
  if (has3(tagged, "OP.propose") || elliptical) {
    intent.operation = "PROPOSE";
    intent.secondary = thing === "tree" || thing === "garden" ? "PLANT" : "PLACE";
    intent.count = countOf(qty, thing);
    intent.dimensions = dimensionsOf(qty);
    intent.confidence = thing ? 0.8 : 0.45;
    if (!thing) intent.needs.push("what to put there");
    return finish2(intent, ctx);
  }
  intent.operation = "OBSERVE";
  intent.secondary = "CONDITION";
  intent.condition = conditionOf(norm2, tagged);
  intent.confidence = 0.45;
  intent.notes.push("understood as a general observation");
  return finish2(intent, ctx);
}
function finish2(intent, ctx) {
  const norm2 = intent.norm;
  if (/\b(dont|don't|do not|without|avoid|but not|usiweke|sin|sans|bila)\b/.test(norm2) && /\b(block|blocks|blocking|cover|covering|obstruct|shade|ziba|bloquear|tapar|bloquer)\b/.test(norm2)) {
    const targetThing = lastThingAfter(norm2, /\b(block|blocks|blocking|cover|covering|obstruct|ziba|bloquear|bloquer)\b/, intent.things);
    intent.constraints.push({
      kind: "DONT_BLOCK",
      thing: targetThing || null,
      raw: norm2.slice(norm2.search(/\b(dont|don't|do not|without|avoid|but not)\b/))
    });
  }
  if (/\b(keep|preserve|protect|acha|mantener|garder)\b/.test(norm2) && intent.operation !== "PRESERVE") {
    intent.constraints.push({ kind: "PRESERVE", thing: lastThingAfter(norm2, /\b(keep|preserve|protect)\b/, intent.things) || null });
  }
  if (intent.reference.kind === "none") {
    intent.needs.push("a reference \u2014 " + intent.reference.ambiguity.question);
    intent.confidence = Math.min(intent.confidence, 0.3);
  }
  intent.explanation = explainReference(intent.reference, ctx.world);
  return intent;
}
function classifyQuestion(norm2, tagged) {
  if (/\bwhy\b|kwanini|por que|pourquoi/.test(norm2)) {
    if (/\bcan'?t|cannot|can not|no puedo/.test(norm2)) return { kind: "why-not", raw: norm2 };
    return { kind: "why", raw: norm2 };
  }
  if (/\bwho\b|nani|quien|quem|qui\b/.test(norm2)) return { kind: "who", raw: norm2 };
  if (/\bcompare\b|comparar/.test(norm2)) return { kind: "compare", raw: norm2 };
  if (/\bwhat changed|what is different|what's different|que cambio/.test(norm2)) return { kind: "changed", raw: norm2 };
  if (/\bwhere can|where could|fit\b/.test(norm2)) return { kind: "where-fit", raw: norm2 };
  if (/\bwhat blocks|blocks this|what is blocking/.test(norm2)) return { kind: "what-blocks", raw: norm2 };
  if (/\bwhat would this remove|what does this remove/.test(norm2)) return { kind: "what-removes", raw: norm2 };
  if (/\bhow many|how much|ngapi|cuanto|combien/.test(norm2)) return { kind: "how-many", raw: norm2 };
  if (/\bwhere\b|wapi|donde|où/.test(norm2)) return { kind: "where", raw: norm2 };
  if (/\bwhich\b|floods?|flood|shade|dark|disputed/.test(norm2)) return { kind: "which", raw: norm2 };
  return { kind: "what", raw: norm2 };
}
function conditionOf(norm2, tagged) {
  if (/\bflood|water|maji|inunda|alaga|mafuriko|mvua\b/.test(norm2)) return "flooding";
  if (/\bdark|night|giza|oscuro|noite\b/.test(norm2)) return "darkness";
  if (/\bnoise|noisy|loud\b/.test(norm2)) return "noise";
  if (/\bdust|dusty\b/.test(norm2)) return "dust";
  if (/\bunsafe|danger|hatari|peligroso\b/.test(norm2)) return "safety";
  if (/\bsell|market|trade|soko\b/.test(norm2)) return "use";
  if (/\bwalk|pass|njia|shortcut\b/.test(norm2)) return "movement";
  return "general";
}
function magnitudeOf(tagged, qty, norm2) {
  const abs = qty.find((q) => q.unit === "m" || q.unit === "cm" || q.unit === "ft");
  const comparative = /\b(taller|shorter|wider|narrower|higher|lower|deeper|longer|bigger|smaller|more|less)\b/.test(norm2);
  if (abs && comparative) return { kind: "delta", metres: abs.metres * (/\b(shorter|narrower|lower|smaller|less)\b/.test(norm2) ? -1 : 1), raw: `${abs.value}${abs.unit || ""}` };
  if (abs) return { kind: "absolute", metres: abs.metres, raw: `${abs.value}${abs.unit || ""}` };
  if (has3(tagged, "Q.twice") || /\bdouble\b/.test(norm2)) return { kind: "factor", factor: 2 };
  if (has3(tagged, "Q.half")) return { kind: "factor", factor: 0.5 };
  const floors = /\b(\d+)\s*(floor|storey|story|level|ghorofa|piso|andar)/.exec(norm2);
  if (floors) return { kind: "floors", floors: parseInt(floors[1], 10) };
  if (/\banother (floor|storey|story|level)\b|\bone more (floor|storey)\b/.test(norm2)) return { kind: "floors", floors: 1 };
  const n = qty.find((q) => !q.unit);
  if (n && /\btimes\b/.test(norm2)) return { kind: "factor", factor: n.value };
  return { kind: "step", step: /\bsmaller|shorter|lower|narrow/.test(norm2) ? -1 : 1 };
}
function countOf(qty, thing) {
  const n = qty.find((q) => !q.unit && q.value >= 1 && q.value <= 200);
  if (n) return Math.round(n.value);
  return thing === "tree" ? 5 : 1;
}
function dimensionsOf(qty) {
  const dims = qty.filter((q) => q.unit === "m" || q.unit === "cm" || q.unit === "ft").map((q) => q.metres);
  if (!dims.length) return null;
  return { width: dims[0], depth: dims[1] ?? null, height: dims[2] ?? null, raw: dims };
}
function lastThingAfter(norm2, re, nouns) {
  const m = re.exec(norm2);
  if (!m) return nouns[nouns.length - 1] || null;
  const tail = norm2.slice(m.index);
  for (const n of nouns) if (tail.includes(n) || tail.includes(n + "s")) return n;
  return nouns[nouns.length - 1] || null;
}
function parseGrafts(norm2, nouns) {
  const out = [];
  const re = /(?:the\s+)?([a-z]+)\s+from\s+([a-z0-9_ ]+?)(?=[,]|\s+and\b|$)/g;
  let m;
  while (m = re.exec(norm2)) {
    out.push({ thing: m[1].replace(/s$/, ""), branchHint: m[2].trim() });
  }
  return out;
}

// src/world/certificate.js
var NETWORK_TYPES3 = /* @__PURE__ */ new Set(["road", "path", "drain", "stream"]);
var MIN_CLEARANCE = { path: 1.2, road: 2.5, drain: 0.6, door: 0.9 };
var HEAD_CLEARANCE = 2.2;
function certify(world, ghosts, opts = {}) {
  const findings = [];
  const ignore = new Set(opts.ignore || []);
  const ghostIds = new Set(ghosts.map((g) => g.id));
  const index = world.reindex();
  for (const g of ghosts) {
    const ring3 = world.place.ringOf(g);
    if (!ring3 || ring3.length < 3) {
      findings.push(f("AMBIGUOUS_REFERENCE", "error", g.id, [], "This proposal has no usable footprint."));
      continue;
    }
    if (area(ring3) < 0.05) {
      findings.push(f("AMBIGUOUS_REFERENCE", "error", g.id, [], "Footprint is degenerate (< 0.05 m\xB2)."));
      continue;
    }
    if (opts.region) {
      const outside = ring3.filter((p) => !pointInRing2(p, opts.region)).length;
      if (outside === ring3.length) {
        findings.push(f("OUTSIDE_REGION", "error", g.id, [], "Falls entirely outside the area you indicated."));
      } else if (outside > 0) {
        findings.push(f("OUTSIDE_REGION", "warning", g.id, [], `${outside} of ${ring3.length} corners fall outside the area you indicated.`));
      }
    }
    {
      const hits = index.overlapping(ring3, g.zBase - 0.4, Math.max(g.zTop, g.zBase + 0.4), /* @__PURE__ */ new Set([...ghostIds, ...ignore]));
      for (const id of hits) {
        const other = world.get(id);
        if (!other || other.collision === "none") continue;
        if (NETWORK_TYPES3.has(other.type)) continue;
        if (other.type === "surface" || other.type === "region" || other.type === "observation") continue;
        const otherRing = world.ringOf(other);
        const overlapArea = approxOverlapArea(ring3, otherRing);
        if (other.type === "tree") {
          findings.push(f(
            "REQUIRES_REMOVAL",
            "warning",
            g.id,
            [id],
            `Requires removal of ${label2(other)}.`,
            { area: overlapArea }
          ));
          continue;
        }
        if (g.collision === "none") {
          const ghostArea = area(ring3);
          const serious = overlapArea > 2 || overlapArea > ghostArea * 0.08;
          findings.push(f(
            "REQUIRES_REMOVAL",
            serious ? "error" : "warning",
            g.id,
            [id],
            serious ? `That ground is occupied by ${label2(other)} \u2014 ${overlapArea.toFixed(1)} m\xB2 of this lies on top of a building.` : `Clips the corner of ${label2(other)} by ${overlapArea.toFixed(2)} m\xB2 \u2014 worth adjusting on site.`,
            { area: overlapArea }
          ));
        } else {
          findings.push(f(
            "COLLISION",
            "error",
            g.id,
            [id],
            `Intersects existing structure ${label2(other)} over ${overlapArea.toFixed(1)} m\xB2.`,
            { area: overlapArea }
          ));
        }
      }
    }
    if (g.zBase > 0.31 && g.type !== "bridge" && g.needsSupport !== false) {
      const sup = supportFor(world.place, index, ring3, g.zBase, g.id, world.branch);
      if (!sup.supported) {
        findings.push(f(
          "UNSUPPORTED",
          "error",
          g.id,
          [],
          `Base sits ${sup.gap.toFixed(2)} m above the ground with nothing under it.`,
          { gap: sup.gap }
        ));
      }
    }
    if (g.type === "bridge") {
      const ends = g.props?.ends || [];
      const missing = ends.filter((id) => !world.get(id));
      if (missing.length) findings.push(f("UNSUPPORTED", "error", g.id, missing, "One end of this connection lands on nothing."));
    }
    for (const other of world.entities()) {
      if (ghostIds.has(other.id) || ignore.has(other.id)) continue;
      if (!NETWORK_TYPES3.has(other.type)) continue;
      const otherRing = world.ringOf(other);
      if (!otherRing || !ringsIntersect(ring3, otherRing)) continue;
      const at = crossingPoint(world, ring3, otherRing);
      const gz = zSpanAt(world, g, at);
      const oz = zSpanAt(world, other, at);
      const clearsOver = gz[0] >= oz[1] + HEAD_CLEARANCE;
      const clearsUnder = gz[1] <= oz[0] - 0.05;
      if (clearsOver || clearsUnder) {
        if (clearsOver && g.zBase < other.zTop + HEAD_CLEARANCE + 0.4) {
          findings.push(f(
            "INSUFFICIENT_CLEARANCE",
            "warning",
            g.id,
            [other.id],
            `Only ${(g.zBase - other.zTop).toFixed(2)} m of headroom over ${label2(other)}.`,
            { clearance: g.zBase - other.zTop }
          ));
        }
        continue;
      }
      if (g.network && g.network === other.network) continue;
      if (g.collision === "none") {
        if (g.type === "drain" && (other.type === "road" || other.type === "path")) {
          findings.push(f(
            "ROUTE_CONFLICT",
            "warning",
            g.id,
            [other.id],
            `Crosses ${label2(other)} \u2014 needs a culvert or a crossing here.`
          ));
        }
        continue;
      }
      const used = other.props?.usedBy || other.use;
      findings.push(f(
        other.type === "drain" || other.type === "stream" ? "WATER_CONFLICT" : "BLOCKS_ACCESS",
        "error",
        g.id,
        [other.id],
        other.type === "drain" || other.type === "stream" ? `Blocks ${label2(other)} \u2014 water arriving here has nowhere to go.` : `Blocks ${label2(other)}${used ? ` used by ${used}` : ""}.`
      ));
    }
    for (const hit of index.near(centroid(ring3), 12)) {
      if (ghostIds.has(hit.id) || ignore.has(hit.id)) continue;
      const other = world.get(hit.id);
      if (!other || !NETWORK_TYPES3.has(other.type)) continue;
      const otherRing = world.ringOf(other);
      const d = ringDistance(ring3, otherRing);
      const need = MIN_CLEARANCE[other.type] ?? 1;
      if (d > 0 && d < need) {
        findings.push(f(
          "INSUFFICIENT_CLEARANCE",
          "warning",
          g.id,
          [other.id],
          `Leaves only ${d.toFixed(2)} m beside ${label2(other)} (${need} m needed).`,
          { clearance: d, need }
        ));
      }
    }
    for (const other of world.entities()) {
      if (ghostIds.has(other.id) || ignore.has(other.id)) continue;
      if (other.type !== "parcel" && other.type !== "region") continue;
      const otherRing = world.ringOf(other);
      if (!otherRing || !ringsIntersect(ring3, otherRing)) continue;
      const claimed = world.place.relations.find((r) => r.to === other.id && (r.kind === "claimedBy" || r.kind === "ownedBy"));
      if (claimed && g.author && claimed.from !== g.author) {
        findings.push(f(
          "RIGHT_OF_WAY_CONFLICT",
          "warning",
          g.id,
          [other.id],
          `Extends into ${label2(other)}, claimed by ${claimed.from}.`
        ));
      }
      if (other.props?.airspace && g.zTop > (other.props.airspaceLimit ?? 0)) {
        findings.push(f(
          "AIRSPACE_CONFLICT",
          "warning",
          g.id,
          [other.id],
          `Rises ${(g.zTop - other.props.airspaceLimit).toFixed(1)} m above the height limit for ${label2(other)}.`
        ));
      }
    }
    for (const c of opts.constraints || []) {
      if (c.kind === "DONT_BLOCK" && c.corridors) {
        for (const corr of c.corridors) {
          if (ringsIntersect(ring3, corr.ring) && g.zTop > corr.zBase && g.zBase < corr.zTop) {
            findings.push(f(
              "BLOCKS_ACCESS",
              "error",
              g.id,
              [corr.ownerId],
              `Blocks ${corr.label} \u2014 you asked for that to stay clear.`,
              { constraint: true }
            ));
          }
        }
      }
      if (c.kind === "PRESERVE" && c.ids) {
        for (const id of c.ids) {
          const keep = world.get(id);
          if (!keep) continue;
          const kr = world.ringOf(keep);
          if (kr && ringsIntersect(ring3, kr)) {
            findings.push(f(
              "REQUIRES_REMOVAL",
              "error",
              g.id,
              [id],
              `Would remove ${label2(keep)}, which you asked to keep.`,
              { constraint: true }
            ));
          }
        }
      }
    }
    if (NETWORK_TYPES3.has(g.type)) {
      const touching = world.entities().filter((o) => {
        if (ghostIds.has(o.id) || !NETWORK_TYPES3.has(o.type)) return false;
        const or = world.ringOf(o);
        return or && ringDistance(ring3, or) < 1;
      });
      if (!touching.length) {
        findings.push(f(
          "DISCONNECTED",
          "warning",
          g.id,
          [],
          `This ${g.type} does not meet any existing ${g.network || "network"} \u2014 it would be decoration, not infrastructure.`
        ));
      }
      if (g.type === "drain" && g.path) {
        const t = world.place.terrain;
        const inv = g.props?.invert || (t ? [t.heightAt(...g.path[0]) - (g.props?.depth ?? 0), t.heightAt(...g.path[g.path.length - 1]) - (g.props?.depth ?? 0)] : null);
        if (inv && inv[1] > inv[0] + 0.02) {
          findings.push(f(
            "WATER_CONFLICT",
            "error",
            g.id,
            [],
            `Runs uphill: the outlet invert is ${(inv[1] - inv[0]).toFixed(2)} m above the inlet.`,
            { rise: inv[1] - inv[0] }
          ));
        }
        if (inv && !g.props?.outfall && g.subtype !== "swale") {
          findings.push(f(
            "WATER_CONFLICT",
            "warning",
            g.id,
            [],
            "No outfall found within reach \u2014 this collects water but does not take it anywhere."
          ));
        }
      }
    }
  }
  if (!findings.length) findings.push(f("VALID", "info", ghosts[0]?.id || null, [], "Spatially valid: no collision, supported, nothing blocked."));
  const valid = !findings.some((x) => x.severity === "error");
  return { valid, findings, ghosts };
}
function f(code, severity, entity, others, message, measure = null) {
  return { code, severity, entity, others, message, measure };
}
function crossingPoint(world, a, b) {
  for (let i = 0, n = a.length; i < n; i++) {
    for (let j = 0, m = b.length; j < m; j++) {
      const hit = segIntersect(a[i], a[(i + 1) % n], b[j], b[(j + 1) % m]);
      if (hit) return hit.point;
    }
  }
  return area(a) <= area(b) ? centroid(a) : centroid(b);
}
function zSpanAt(world, e, point) {
  if (!e.path || e.path.length < 2) return [e.zBase, e.zTop];
  const inv = e.props?.invert;
  const ground = world.place.terrain ? world.place.groundAt(point[0], point[1]) : e.zTop;
  if (!inv) return [Math.min(e.zBase, ground), Math.max(e.zTop, ground)];
  let total = 0;
  const segs = [];
  for (let i = 0; i < e.path.length - 1; i++) {
    const d = dist(e.path[i], e.path[i + 1]);
    segs.push(d);
    total += d;
  }
  const c = closestOnRing(point, e.path, false);
  let before = 0;
  for (let i = 0; i < (c.i ?? 0); i++) before += segs[i];
  const along = before + (segs[c.i ?? 0] || 0) * (c.t ?? 0);
  const frac = total > 0 ? Math.max(0, Math.min(1, along / total)) : 0;
  const bed = inv[0] + (inv[1] - inv[0]) * frac;
  return [bed, ground];
}
function label2(e) {
  if (!e) return "something";
  return e.name ? `${e.name} (${e.id})` : `${e.type} ${e.id}`;
}
function approxOverlapArea(a, b) {
  const bb = [
    Math.max(bbox(a)[0], bbox(b)[0]),
    Math.max(bbox(a)[1], bbox(b)[1]),
    Math.min(bbox(a)[2], bbox(b)[2]),
    Math.min(bbox(a)[3], bbox(b)[3])
  ];
  if (bb[2] <= bb[0] || bb[3] <= bb[1]) return 0;
  const n = 24;
  const dx = (bb[2] - bb[0]) / n, dy = (bb[3] - bb[1]) / n;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = [bb[0] + (i + 0.5) * dx, bb[1] + (j + 0.5) * dy];
      if (pointInRing2(p, a) && pointInRing2(p, b)) hits++;
    }
  }
  return hits / (n * n) * (bb[2] - bb[0]) * (bb[3] - bb[1]);
}
function summarize(cert) {
  const order = { error: 0, warning: 1, info: 2 };
  return cert.findings.slice().sort((a, b) => order[a.severity] - order[b.severity]);
}

// src/world/ops.js
var planSeq = 0;
function plan(world, intent, ctx = {}) {
  const id = `plan_${++planSeq}`;
  const base = {
    id,
    intent,
    kind: intent.operation,
    title: "",
    summary: "",
    ghosts: [],
    removals: [],
    relations: [],
    branchOps: [],
    region: intent.reference.ring || null,
    corridors: [],
    alternatives: [],
    answer: null,
    simulation: null,
    autoCommit: false,
    needs: intent.needs.slice()
  };
  if (intent.reference.kind === "none" && !["ASK", "SIMULATE", "MERGE", "BRANCH"].includes(intent.operation)) {
    return {
      ...base,
      title: "Which part of the place do you mean?",
      summary: intent.reference.ambiguity.question,
      certificate: { valid: false, findings: [{ code: "AMBIGUOUS_REFERENCE", severity: "error", entity: null, others: [], message: intent.reference.ambiguity.reason }] }
    };
  }
  switch (intent.operation) {
    case "OBSERVE":
      return finish3(world, planObserve(world, intent, base, ctx));
    case "PROPOSE":
      return finish3(world, planPropose(world, intent, base, ctx));
    case "MODIFY":
      return finish3(world, planModify(world, intent, base, ctx));
    case "RELATE":
      return finish3(world, planRelate(world, intent, base, ctx));
    case "PRESERVE":
      return finish3(world, planPreserve(world, intent, base, ctx));
    case "REMOVE":
      return finish3(world, planRemove(world, intent, base, ctx));
    case "BRANCH":
      return finish3(world, planBranch(world, intent, base, ctx));
    case "MERGE":
      return finish3(world, planMerge(world, intent, base, ctx));
    case "SIMULATE":
      return finish3(world, planSimulate(world, intent, base, ctx));
    case "MEASURE":
      return finish3(world, planMeasure(world, intent, base, ctx));
    default:
      return finish3(world, { ...base, title: "Not understood", summary: intent.original });
  }
}
function finish3(world, p) {
  if (!p.certificate) {
    p.certificate = p.ghosts.length ? certify(world, p.ghosts, { region: p.region, constraints: p.constraints || [] }) : { valid: true, findings: [] };
  }
  return p;
}
function planObserve(world, intent, base) {
  const ref = intent.reference;
  const author = intent.author || "you";
  if (intent.secondary === "ROUTE" && (ref.line || ref.kind === "polyline")) {
    const line2 = ref.line;
    const id2 = world.place.newId("route");
    return {
      ...base,
      title: "People actually walk here",
      summary: `A ${perimeter(line2, false).toFixed(0)} m desire line recorded as observed movement.`,
      autoCommit: true,
      ghosts: [{
        id: id2,
        type: "path",
        subtype: "desire-line",
        name: "Observed route",
        network: "paths",
        path: line2,
        width: 1.1,
        zBase: world.place.groundAt(...line2[0]),
        zTop: world.place.groundAt(...line2[0]) + 0.02,
        collision: "none",
        epistemic: "OBSERVED",
        certainty: 0.7,
        author,
        evidence: [{ kind: "utterance", text: intent.original, lang: intent.lang }],
        sim: { desire: 1 }
      }]
    };
  }
  const ring3 = ref.ring || (ref.point ? circleRing(ref.point[0], ref.point[1], 4, 20) : null);
  const anchor = ref.point || centroid(ring3);
  const id = world.place.newId("obs");
  const about = ref.ids.slice();
  return {
    ...base,
    title: `Observation: ${intent.condition || "about this place"}`,
    summary: `"${intent.original}" recorded here${about.length ? `, about ${about.join(", ")}` : ""}.`,
    autoCommit: true,
    ghosts: [{
      id,
      type: "observation",
      name: intent.original.slice(0, 60),
      footprint: ring3,
      zBase: world.place.groundAt(...anchor),
      zTop: world.place.groundAt(...anchor) + 0.02,
      collision: "none",
      epistemic: "OBSERVED",
      certainty: 0.8,
      author,
      subtype: intent.condition,
      evidence: [{ kind: "utterance", text: intent.original, lang: intent.lang, basis: ref.basis }],
      props: { condition: intent.condition, about }
    }],
    relations: about.map((t) => ({ from: id, kind: "usedBy", to: t }))
  };
}
function planPropose(world, intent, base, ctx) {
  const ref = intent.reference;
  const thing = intent.thing || "building";
  const gen = GENERATORS[thing] || GENERATORS.building;
  const author = intent.author || "you";
  const corridors = [];
  const keepClearOf = [];
  for (const c of intent.constraints) {
    if (c.kind === "DONT_BLOCK") {
      const targets = resolveConstraintTargets(world, c, ref);
      corridors.push(...windowCorridors(world, targets.filter((id) => world.get(id)?.type === "opening")));
      keepClearOf.push(...targets.filter((id) => world.get(id)?.type !== "opening"));
    }
    if (c.kind === "PRESERVE") keepClearOf.push(...resolveConstraintTargets(world, c, ref));
  }
  const host = ref.ids.map((i) => world.get(i)).find((e) => e && e.type === "structure");
  const onRoof = !!host && (gen.onRoof || /roof|rooftop|paa|techo|telhado|toit/.test(intent.norm));
  const searchRegion = ref.kind === "region" ? ref.ring : null;
  const genCtx = {
    region: searchRegion,
    point: ref.point,
    ids: ref.ids,
    line: ref.line,
    count: intent.count,
    dimensions: intent.dimensions,
    corridors,
    keepClearOf,
    onRoof,
    roofOf: host?.id,
    seed: `${intent.norm}|${world.place.tick}`,
    zBase: onRoof ? host.zTop : void 0
  };
  const specs = gen(world, genCtx);
  if (!specs.length) {
    return {
      ...base,
      title: `Nowhere for a ${thing} here`,
      summary: "The area you indicated is fully occupied by things that would have to be removed first.",
      certificate: { valid: false, findings: [{ code: "REQUIRES_RELOCATION", severity: "error", entity: null, others: ref.ids, message: "No free ground in the indicated area." }] }
    };
  }
  const ghosts = specs.map((s, i) => ({
    ...s,
    id: s.id || world.place.newId(s.type),
    status: "GHOST",
    epistemic: "PROPOSED",
    certainty: 0.6,
    author,
    evidence: [{ kind: "utterance", text: intent.original, lang: intent.lang, basis: ref.basis }],
    props: { ...s.props || {}, proposalIndex: i }
  }));
  const constraints = intent.constraints.map((c) => ({
    ...c,
    corridors: c.kind === "DONT_BLOCK" ? corridors : void 0,
    ids: c.kind === "PRESERVE" ? keepClearOf : void 0
  }));
  const cert = certify(world, ghosts, { region: searchRegion, constraints });
  const alternatives = [];
  const alt = ghosts[0]?.alternatives || [];
  alt.slice(0, 2).forEach((ring3, i) => {
    const g = { ...ghosts[0], id: world.place.newId(ghosts[0].type), footprint: ring3 };
    alternatives.push({ id: `alt_${i}`, label: `Alternative ${String.fromCharCode(66 + i)}`, ghosts: [g], certificate: certify(world, [g], { region: searchRegion, constraints }) });
  });
  return {
    ...base,
    title: `Proposed: ${ghosts.length > 1 ? `${ghosts.length} ${thing}s` : ghosts[0].name || thing}`,
    summary: describeGhosts(world, ghosts, onRoof ? `on the roof of ${host.name || host.id}` : null),
    ghosts,
    certificate: cert,
    alternatives,
    constraints,
    corridors
  };
}
function resolveConstraintTargets(world, c, ref) {
  const wanted = c.thing;
  const pool = /* @__PURE__ */ new Set();
  for (const id of ref.ids) {
    const e = world.get(id);
    if (!e) continue;
    pool.add(id);
    for (const child of world.entities()) if (child.parent === id) pool.add(child.id);
  }
  if (!wanted) return [...pool];
  const typeMap = { window: "opening", roof: "roof", tree: "tree", path: "path", road: "road", people: "path", door: "opening" };
  const t = typeMap[wanted] || wanted;
  const filtered = [...pool].filter((id) => world.get(id)?.type === t);
  if (filtered.length) return filtered;
  const near = ref.point ? world.nearby(ref.point, 25) : [];
  return near.filter((h) => h.entity.type === t).map((h) => h.entity.id);
}
function planModify(world, intent, base) {
  const ids = intent.reference.ids;
  if (!ids.length) return { ...base, title: "Nothing to change", summary: "Select the thing you want to change." };
  const mag = intent.magnitude || { kind: "step", step: 1 };
  const ghosts = [];
  const patches = [];
  const b = world.place.bounds();
  const extent = Math.max(b[2] - b[0], b[3] - b[1]);
  const maxDim = Math.max(120, extent * 3);
  const clamps = [];
  const limit = (v, what) => {
    const c = Math.max(0.05, Math.min(maxDim, v));
    if (Math.abs(c - v) > 1e-6) clamps.push({ what, asked: v, used: c });
    return c;
  };
  for (const id of ids) {
    const e = world.get(id);
    if (!e) continue;
    const ring3 = world.ringOf(e);
    const height = e.zTop - e.zBase;
    let patch = null;
    if (intent.secondary === "EXTRUDE") {
      let newH = height;
      if (mag.kind === "absolute") newH = mag.metres;
      else if (mag.kind === "delta") newH = height + mag.metres;
      else if (mag.kind === "factor") newH = height * mag.factor;
      else if (mag.kind === "floors") newH = height + mag.floors * 3;
      else newH = height + (mag.step || 1) * 3;
      patch = { zTop: e.zBase + limit(Math.max(0.3, newH), "height") };
    } else if (intent.secondary === "WIDEN") {
      if (e.path) {
        const w = mag.kind === "absolute" ? mag.metres : mag.kind === "delta" ? (e.width || 1) + mag.metres : mag.kind === "factor" ? (e.width || 1) * mag.factor : (e.width || 1) + 0.5 * (mag.step || 1);
        patch = { width: limit(Math.max(0.2, w), "width") };
      } else {
        const ob = orientedBounds(ring3);
        const target = limit(mag.kind === "absolute" ? mag.metres : mag.kind === "delta" ? ob.width + mag.metres : mag.kind === "factor" ? ob.width * mag.factor : ob.width + 1, "width");
        const s = target / Math.max(1e-3, ob.width);
        patch = { footprint: scaleInFrame(ring3, ob.angle, s, 1, ob.center) };
      }
    } else if (intent.secondary === "DEEPEN") {
      const d = limit(mag.kind === "absolute" ? mag.metres : mag.kind === "delta" ? e.zTop - e.zBase + mag.metres : e.zTop - e.zBase + 0.3, "depth");
      patch = { zBase: e.zTop - Math.max(0.05, d), props: { ...e.props || {}, depth: d } };
    } else if (intent.secondary === "MOVE") {
      const to = intent.reference.point;
      if (to) {
        const c = centroid(ring3);
        const delta = sub(to, c);
        patch = e.path ? { path: e.path.map((p) => add(p, delta)) } : { footprint: ring3.map((p) => add(p, delta)) };
      }
    } else if (intent.secondary === "CONTINUE") {
      const ob = orientedBounds(ring3);
      const dir = [Math.cos(ob.angle), Math.sin(ob.angle)];
      const n = intent.count || 2;
      for (let i = 1; i <= n; i++) {
        const off = mul(dir, (ob.width + 1.5) * i);
        ghosts.push({
          ...structuredCloneLite(e),
          id: world.place.newId(e.type),
          name: `${e.name || e.type} (continued ${i})`,
          footprint: ring3.map((p) => add(p, off)),
          status: "GHOST",
          epistemic: "PROPOSED",
          evidence: [{ kind: "utterance", text: intent.original, basis: ["current-geometry", ...intent.reference.basis] }],
          props: { ...e.props || {}, continuedFrom: e.id }
        });
      }
      continue;
    } else if (mag.kind === "absolute" || mag.kind === "delta") {
      if (e.path) patch = { width: limit(mag.metres, "width") };
      else {
        const ob = orientedBounds(ring3);
        const s = limit(mag.metres, "size") / Math.max(1e-3, ob.width);
        patch = { footprint: scaleInFrame(ring3, ob.angle, s, s, ob.center) };
      }
    } else {
      patch = { zTop: e.zBase + limit(Math.max(0.3, height * (mag.factor || 1 + 0.25 * (mag.step || 1))), "height") };
    }
    if (patch) {
      patches.push({ id, patch });
      ghosts.push({ ...structuredCloneLite(e), ...patch, status: "GHOST", epistemic: "PROPOSED", props: { ...e.props || {}, modifies: id } });
    }
  }
  const cert = certify(world, ghosts, { ignore: patches.map((p) => p.id) });
  for (const c of clamps) {
    cert.findings.unshift({
      code: "REQUIRES_RELOCATION",
      severity: "warning",
      entity: ids[0],
      others: [],
      message: `You asked for ${c.asked.toLocaleString()} m of ${c.what}; this place is about ${Math.round(extent)} m across, so it was capped at ${c.used.toFixed(1)} m.`
    });
  }
  return {
    ...base,
    title: modifyTitle(intent, ghosts.length),
    summary: describeGhosts(world, ghosts),
    ghosts,
    patches,
    certificate: cert,
    clamps
  };
}
function modifyTitle(intent, n) {
  const m = intent.magnitude;
  if (m?.kind === "absolute") return `Set to ${m.raw}`;
  if (m?.kind === "factor") return `${m.factor === 2 ? "Double" : `\xD7${m.factor}`} \u2014 ${n} thing${n === 1 ? "" : "s"}`;
  if (m?.kind === "floors") return `Add ${m.floors} floor${m.floors === 1 ? "" : "s"}`;
  if (intent.secondary === "CONTINUE") return "Continue the pattern";
  return "Change";
}
function planRelate(world, intent, base) {
  const ids = intent.reference.ids.slice(0, 2);
  if (ids.length < 2) return { ...base, title: "Connect what to what?", summary: 'Select two things, then say "connect these".' };
  const specs = GENERATORS.bridge(world, { ids, dimensions: intent.dimensions });
  const ghosts = specs.map((s) => ({
    ...s,
    id: world.place.newId("bridge"),
    status: "GHOST",
    epistemic: "PROPOSED",
    author: intent.author || "you",
    evidence: [{ kind: "utterance", text: intent.original, basis: intent.reference.basis }]
  }));
  const cert = certify(world, ghosts);
  return {
    ...base,
    title: "Connection proposed",
    summary: `${ghosts[0].props.span.toFixed(1)} m span at ${ghosts[0].zBase.toFixed(2)} m, ${ghosts[0].width} m wide.`,
    ghosts,
    certificate: cert,
    relations: [
      { from: ghosts[0].id, kind: "connectedTo", to: ids[0] },
      { from: ghosts[0].id, kind: "connectedTo", to: ids[1] }
    ]
  };
}
function planPreserve(world, intent, base) {
  const ref = intent.reference;
  let keep = ref.ids.slice();
  if (!keep.length && ref.ring) keep = world.index.within(ref.ring);
  const removals = [];
  if (intent.secondary === "REMOVE") {
    const exceptIds = ref.ids.length ? ref.ids : [];
    removals.push(...exceptIds);
    keep = world.entities().filter((e) => !exceptIds.includes(e.id) && e.type !== "observation").map((e) => e.id);
  }
  return {
    ...base,
    title: removals.length ? `Keep everything except ${removals.length} thing${removals.length === 1 ? "" : "s"}` : `Keep ${keep.length} thing${keep.length === 1 ? "" : "s"}`,
    summary: removals.length ? `${removals.map((id) => world.get(id)?.name || id).join(", ")} would be removed. Everything else becomes protected.` : "These become protected: later proposals that would remove them will be refused, not silently moved.",
    removals,
    preserve: keep,
    relations: keep.map((id) => ({ from: "preservation", kind: "preserves", to: id })),
    certificate: removals.length ? { valid: true, findings: removals.map((id) => ({ code: "REQUIRES_REMOVAL", severity: "warning", entity: id, others: [], message: `Removes ${world.get(id)?.name || id}.` })) } : { valid: true, findings: [{ code: "VALID", severity: "info", entity: null, others: [], message: `${keep.length} entities protected.` }] }
  };
}
function planRemove(world, intent, base) {
  let ids = intent.reference.ids.slice();
  if (intent.thing && intent.reference.ring) {
    const typeMap = { car: "car", tree: "tree", wall: "wall", building: "structure", market: "market" };
    const t = typeMap[intent.thing];
    ids = world.index.within(intent.reference.ring).filter((id) => world.get(id)?.type === t);
  }
  if (!ids.length) return { ...base, title: "Remove what?", summary: "Select what should go." };
  const protectedIds = ids.filter((id) => world.place.relations.some((r) => r.kind === "preserves" && r.to === id));
  const findings = ids.map((id) => ({
    code: "REQUIRES_REMOVAL",
    severity: protectedIds.includes(id) ? "error" : "warning",
    entity: id,
    others: [],
    message: protectedIds.includes(id) ? `${world.get(id)?.name || id} is protected \u2014 someone asked to keep it.` : `Removes ${world.get(id)?.name || id}.`
  }));
  return {
    ...base,
    title: `Remove ${ids.length} thing${ids.length === 1 ? "" : "s"}`,
    summary: ids.map((id) => world.get(id)?.name || id).join(", "),
    removals: ids,
    certificate: { valid: protectedIds.length === 0, findings }
  };
}
var STRATEGIES = [
  { key: "drain", label: "Drainage first", thing: "drain", note: "Move the water out fast along the steepest line." },
  { key: "absorb", label: "Absorb it here", thing: "swale", note: "Slow and soak: a swale and planting instead of a pipe." },
  { key: "shift", label: "Move what floods", thing: "garden", note: "Leave the low ground to the water and re-use it." },
  { key: "connect", label: "Reorganise movement", thing: "path", note: "Keep people out of the water rather than water out of people." }
];
var DRY_STRATEGIES = [
  { key: "shade", label: "Shade and planting", thing: "tree", note: "Trees first: cooler ground, slower runoff, somewhere to stand." },
  { key: "access", label: "Better ways through", thing: "path", note: "A route where people already want to walk." },
  { key: "commons", label: "Common ground", thing: "garden", note: "Hold the open space as something shared before it is taken." },
  { key: "build", label: "Build on it", thing: "building", note: "Use the space: one more structure, placed where it fits." }
];
function planBranch(world, intent, base) {
  const ref = intent.reference;
  const count = Math.max(1, Math.min(4, intent.count || 1));
  const branchOps = [];
  if (intent.secondary === "TRANSFORM") {
    const thing = intent.removeThing || intent.thing;
    const typeMap = { car: "car", tree: "tree", wall: "wall", building: "structure", market: "market" };
    const t = typeMap[thing] || thing;
    const region2 = ref.ring || world.place.bounds();
    const ids = world.entities().filter((e) => e.type === t && (!ref.ring || pointInRing2(centroid(world.ringOf(e) || [[0, 0]]), ref.ring))).map((e) => e.id);
    const bid = `AS_IF_no_${t}_${world.place.tick}`;
    branchOps.push({ kind: "create", id: bid, name: `Without ${thing}`, note: intent.original, removals: ids });
    return {
      ...base,
      title: `As-if: without ${thing}`,
      summary: `${ids.length} ${thing}${ids.length === 1 ? "" : "s"} set aside in a new branch. The current place is untouched.`,
      branchOps,
      certificate: { valid: true, findings: [{ code: "VALID", severity: "info", entity: null, others: ids, message: `${ids.length} entities differ from ${world.branch}.` }] }
    };
  }
  const region = ref.ring || (ref.point ? circleRing(ref.point[0], ref.point[1], 18, 24) : boundsRing(world));
  const ordered = strategiesFor(world, region);
  const picks = [];
  const rejected = [];
  for (const s of ordered) {
    if (picks.length >= count) break;
    const gen = GENERATORS[s.thing];
    const ctx2 = {
      region,
      point: ref.point || centroid(region),
      count: s.thing === "tree" ? 8 : 1,
      seed: `${s.key}|${intent.norm}`
    };
    const specs = gen(world, ctx2).map((sp) => ({
      ...sp,
      id: world.place.newId(sp.type),
      status: "GHOST",
      epistemic: "PROPOSED",
      author: intent.author || "you",
      evidence: [{ kind: "utterance", text: intent.original, basis: ref.basis }],
      props: { ...sp.props || {}, strategy: s.key }
    }));
    if (!specs.length) {
      rejected.push({ s, why: "nothing could be placed in the area you indicated" });
      continue;
    }
    const cert = certify(world, specs, { region });
    if (!cert.valid) {
      rejected.push({ s, why: cert.findings.find((x) => x.severity === "error").message });
      continue;
    }
    const bid = `AS_IF_${s.key}_${world.place.tick}_${picks.length}`;
    picks.push(s);
    branchOps.push({ kind: "create", id: bid, name: s.label, note: s.note, ghosts: specs, certificate: cert });
  }
  const findings = picks.length ? [{ code: "VALID", severity: "info", entity: null, others: [], message: `${picks.length} branches will coexist with ${world.branch}.` }] : [{ code: "REQUIRES_RELOCATION", severity: "error", entity: null, others: [], message: "No strategy could be placed here without removing something." }];
  for (const r of rejected) {
    findings.push({ code: "REQUIRES_RELOCATION", severity: "warning", entity: null, others: [], message: `"${r.s.label}" was not offered: ${r.why}` });
  }
  return {
    ...base,
    title: picks.length ? `${picks.length} futures for this place` : "No future fits here yet",
    summary: picks.map((s) => `${s.label}: ${s.note}`).join("  \xB7  "),
    branchOps,
    region,
    certificate: { valid: picks.length > 0, findings }
  };
}
function strategiesFor(world, region) {
  let wet = false;
  try {
    const w = runWater(world, { rain: "heavy" });
    const c = centroid(region);
    const r = Math.max(...region.map((p) => dist(p, c)));
    for (const pond of w.ponds) {
      const px = w.bounds[0] + pond.i * w.cell, py = w.bounds[1] + pond.j * w.cell;
      if (dist([px, py], c) <= r + 6 && pond.maxDepth > 0.06) {
        wet = true;
        break;
      }
    }
  } catch {
  }
  const testimony = world.entities().some((e) => e.type === "observation" && e.props?.condition === "flooding" && pointInRing2(centroid(world.ringOf(e) || [[1e9, 1e9]]), region));
  return wet || testimony ? STRATEGIES : DRY_STRATEGIES;
}
function planMerge(world, intent, base) {
  const grafts = [];
  const typeMap = { tree: "tree", building: "structure", path: "path", drain: "drain", garden: "surface", swale: "drain", bench: "bench" };
  for (const g of intent.grafts || []) {
    const branch = matchBranch(world, g.branchHint);
    if (!branch) continue;
    const t = typeMap[g.thing] || g.thing;
    const view = world.view(branch.id);
    const baseIds = new Set(world.view("AS_IS").entities.map((e) => e.id));
    const ids = view.entities.filter((e) => e.type === t && !baseIds.has(e.id)).map((e) => e.id);
    grafts.push({ branch: branch.id, branchName: branch.name, thing: g.thing, type: t, ids });
  }
  if (!grafts.length) {
    return {
      ...base,
      title: "Which branches?",
      summary: 'Name the options to combine, e.g. "combine the trees from A and the drain from B".',
      certificate: { valid: false, findings: [{ code: "AMBIGUOUS_REFERENCE", severity: "error", entity: null, others: [], message: "No branch matched." }] }
    };
  }
  const bid = `MERGED_${world.place.tick}`;
  return {
    ...base,
    title: "Merged branch",
    summary: grafts.map((g) => `${g.ids.length} ${g.thing}${g.ids.length === 1 ? "" : "s"} from ${g.branchName}`).join(" + "),
    branchOps: [{ kind: "create", id: bid, name: "Merged option", note: intent.original, grafts }],
    certificate: { valid: true, findings: [{ code: "VALID", severity: "info", entity: null, others: [], message: `Grafts ${grafts.reduce((n, g) => n + g.ids.length, 0)} entities.` }] }
  };
}
function matchBranch(world, hint2) {
  const h = (hint2 || "").trim().toLowerCase();
  if (!h) return null;
  const all = [...world.place.branches.values()];
  return all.find((b) => b.name.toLowerCase() === h) || all.find((b) => b.id.toLowerCase() === h) || all.find((b) => b.name.toLowerCase().includes(h) || h.includes(b.name.toLowerCase())) || all.find((b) => b.id.toLowerCase().endsWith(`_${h}`) || b.name.toLowerCase().endsWith(` ${h}`)) || null;
}
function planSimulate(world, intent, base) {
  const scenario = intent.scenario || {};
  const sim = {};
  if (scenario.rain || intent.secondary === "WATER") sim.water = runWater(world, { rain: scenario.rain || "heavy" });
  if (intent.secondary === "TEMPORAL") sim.years = scenario.years || 1;
  if (scenario.night || intent.secondary === "LIGHT") sim.night = true;
  return {
    ...base,
    title: intent.secondary === "TEMPORAL" ? `${sim.years} year${sim.years === 1 ? "" : "s"} pass` : sim.night ? "At night" : "Heavy rain",
    summary: sim.water ? `${sim.water.pondCount} places hold water; deepest ${sim.water.maxDepth.toFixed(2)} m; ${sim.water.floodedArea.toFixed(0)} m\xB2 over 5 cm.` : "Scenario applied to the current branch.",
    simulation: sim,
    autoCommit: false,
    certificate: { valid: true, findings: [{ code: "VALID", severity: "info", entity: null, others: [], message: "Simulation does not change the world." }] }
  };
}
function planMeasure(world, intent, base) {
  const ref = intent.reference;
  const parts = [];
  for (const id of ref.ids) {
    const e = world.get(id);
    if (!e) continue;
    const ring3 = world.ringOf(e);
    const ob = orientedBounds(ring3);
    parts.push({
      id,
      name: e.name || id,
      area: area(ring3),
      width: ob.width,
      depth: ob.depth,
      height: e.zTop - e.zBase,
      length: e.path ? perimeter(e.path, false) : perimeter(ring3)
    });
  }
  if (ref.ring && !parts.length) parts.push({ id: null, name: "area", area: area(ref.ring), perimeter: perimeter(ref.ring) });
  if (ref.line) parts.push({ id: null, name: "line", length: perimeter(ref.line, false) });
  return {
    ...base,
    title: "Measurement",
    summary: parts.map((p) => [
      p.area != null ? `${p.name}: ${p.area.toFixed(1)} m\xB2` : null,
      p.width != null ? `${p.width.toFixed(2)} \xD7 ${p.depth.toFixed(2)} m` : null,
      p.height ? `${p.height.toFixed(2)} m high` : null,
      p.length ? `${p.length.toFixed(1)} m long` : null
    ].filter(Boolean).join(", ")).join(" \xB7 ") || "Nothing measurable selected.",
    answer: { kind: "measure", parts },
    certificate: { valid: true, findings: [] }
  };
}
function commitPlan(world, p, meta = {}) {
  const author = meta.author || p.intent?.author || "you";
  const label3 = p.title || "change";
  let createdBranches = [];
  const out = world.transact({
    label: label3,
    author,
    intent: p.intent ? { operation: p.intent.operation, secondary: p.intent.secondary, thing: p.intent.thing, confidence: p.intent.confidence } : null,
    utterance: p.intent ? { text: p.intent.original, lang: p.intent.lang } : null
  }, (j) => {
    for (const op of p.branchOps || []) {
      if (op.kind !== "create") continue;
      j.mutate({ op: "branch", branchId: op.id, name: op.name, parent: world.branch, note: op.note, author });
      createdBranches.push(op.id);
      for (const g of op.ghosts || []) {
        j.mutate({ op: "add", branch: op.id, entity: { ...stripGhost(g), createdBy: j.open.id } });
      }
      for (const id of op.removals || []) j.mutate({ op: "remove", branch: op.id, id });
      for (const graft of op.grafts || []) {
        for (const id of graft.ids) {
          const e = world.place.get(id, graft.branch);
          if (e) j.mutate({ op: "add", branch: op.id, entity: { ...e, props: { ...e.props || {}, graftedFrom: graft.branch } } });
        }
      }
    }
    for (const g of p.ghosts || []) {
      if (p.patches?.some((x) => x.id === g.props?.modifies)) continue;
      j.mutate({ op: "add", entity: { ...stripGhost(g), createdBy: j.open.id } });
    }
    for (const patch of p.patches || []) j.mutate({ op: "update", id: patch.id, patch: patch.patch });
    for (const id of p.removals || []) j.mutate({ op: "remove", id });
    for (const r of p.relations || []) if (world.get(r.to)) j.mutate({ op: "relate", from: r.from, kind: r.kind, to: r.to, author });
    for (const id of p.preserve || []) j.mutate({ op: "relate", from: author, kind: "preserves", to: id, author });
  });
  return { ...out, branches: createdBranches };
}
function stripGhost(g) {
  const { alternatives, placementScore, needsSupport, ...rest } = g;
  return { ...rest, status: "ACTIVE" };
}
function structuredCloneLite(o) {
  return JSON.parse(JSON.stringify(o));
}
function boundsRing(world) {
  const b = world.place.bounds();
  return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
}
function describeGhosts(world, ghosts, where) {
  if (!ghosts.length) return "";
  const g = ghosts[0];
  const ring3 = world.place.ringOf(g);
  const parts = [];
  if (ghosts.length > 1) parts.push(`${ghosts.length} items`);
  if (ring3) {
    const ob = orientedBounds(ring3);
    parts.push(`${ob.width.toFixed(1)} \xD7 ${ob.depth.toFixed(1)} m`);
    parts.push(`${area(ring3).toFixed(0)} m\xB2`);
  }
  if (g.zTop - g.zBase > 0.05) parts.push(`${(g.zTop - g.zBase).toFixed(2)} m high`);
  if (g.path) parts.push(`${perimeter(g.path, false).toFixed(1)} m long`);
  if (where) parts.push(where);
  return parts.join(" \xB7 ");
}

// src/sim/shade.js
function sunFor(hour, latitudeDeg = 0) {
  const h = (hour - 12) / 12 * Math.PI;
  const altitude = Math.max(0, Math.cos(h) * (Math.PI / 2 - Math.abs(latitudeDeg * Math.PI / 180) * 0.6));
  const azimuth = h + Math.PI / 2;
  return { altitude, azimuth, up: Math.sin(altitude), dir: [Math.cos(azimuth), Math.sin(azimuth)] };
}
function shadows(world, hour = 15) {
  const sun = sunFor(hour);
  if (sun.up <= 0.02) return { sun, polys: [], night: true };
  const polys = [];
  for (const e of world.entities()) {
    const h = e.zTop - e.zBase;
    if (h < 0.6) continue;
    if (!["structure", "tree", "wall", "bridge", "market"].includes(e.type)) continue;
    const ring3 = world.ringOf(e);
    if (!ring3) continue;
    const L = h / Math.tan(Math.max(0.08, sun.altitude));
    const off = [-sun.dir[0] * L, -sun.dir[1] * L];
    const moved = ring3.map((p) => [p[0] + off[0], p[1] + off[1]]);
    polys.push({ id: e.id, ring: convexHull(ring3.concat(moved)), length: L, opacity: e.type === "tree" ? 0.55 : 0.85 });
  }
  return { sun, polys, night: false };
}
function shadeCoverage(world, region, hour = 15, cell = 1.5) {
  const { polys } = shadows(world, hour);
  const bb = bbox(region);
  let total = 0, shaded = 0;
  const hot = [];
  for (let y = bb[1]; y <= bb[3]; y += cell) {
    for (let x = bb[0]; x <= bb[2]; x += cell) {
      const p = [x, y];
      if (!pointInRing2(p, region)) continue;
      total++;
      if (polys.some((s) => pointInRing2(p, s.ring))) shaded++;
      else hot.push(p);
    }
  }
  return { fraction: total ? shaded / total : 0, area: total * cell * cell, unshaded: hot, hour };
}
function nightCoverage(world, cell = 3) {
  const lamps = world.entities().filter((e) => e.type === "light");
  const dark = [];
  let lit = 0, total = 0;
  for (const e of world.entities()) {
    if (e.type !== "path" && e.type !== "road") continue;
    const line2 = e.path || [];
    for (const p of resample(line2, cell)) {
      total++;
      const near = lamps.some((l) => {
        const c = centroid(world.ringOf(l) || [[0, 0]]);
        return dist(c, p) <= (l.props?.radius || 9);
      });
      if (near) lit++;
      else dark.push({ p, ownerId: e.id });
    }
  }
  return { fraction: total ? lit / total : 0, dark, total };
}

// src/world/query.js
function ask(world, intent, ctx = {}) {
  const q = intent.question || { kind: "what" };
  const ref = intent.reference;
  const ids = ref.ids || [];
  const empty = { text: "", highlight: [], trace: [], rows: [], overlay: null, compare: null };
  switch (q.kind) {
    // ---------------------------------------------------------------- why ---
    case "why": {
      if (!ids.length && ref.point) {
        const under = world.entityAt(ref.point);
        if (under) ids.push(under.id);
      }
      if (!ids.length) return { ...empty, text: 'Point at something and ask again \u2014 "why are you here?" is a question to an object.' };
      const rows = [];
      const highlight = [...ids];
      for (const id of ids) {
        const e = world.get(id);
        if (!e) continue;
        const hist = world.journal.historyOf(id);
        const first = hist[0];
        rows.push({
          id,
          name: label2(e),
          who: e.author || "unknown",
          when: first ? `tick ${first.event.tick}` : "seeded with the place",
          how: first?.event.utterance ? `"${first.event.utterance.text}"` : first?.event.label || "imported",
          source: e.source,
          epistemic: e.epistemic,
          certainty: e.certainty,
          branch: first?.event.branch || e.branch,
          evidence: (e.evidence || []).map((v) => v.kind).join(", ") || "none",
          relations: describeRelations(world.place, id).map((r) => `${r.kind} ${r.ids.join(", ")}`),
          changes: hist.length
        });
        for (const r of describeRelations(world.place, id)) highlight.push(...r.ids);
      }
      return {
        ...empty,
        text: rows.map((r) => `${r.name} \u2014 ${r.epistemic.toLowerCase()}, by ${r.who}, ${r.when}. ${r.how}. ${r.changes} change${r.changes === 1 ? "" : "s"} since.`).join("\n"),
        rows,
        highlight: [...new Set(highlight)]
      };
    }
    // ------------------------------------------------------------ why-not ---
    case "why-not": {
      const point = ref.point || (ids[0] ? centroid(world.ringOf(world.get(ids[0]))) : null);
      if (!point) return { ...empty, text: "Point where you wanted it." };
      const probe = ctx.probeSize || [5, 4];
      const cands = findPlacement(world, { point, size: probe, samples: 6, seedName: "why-not" });
      const ring3 = rectRing(point[0], point[1], probe[0], probe[1], 0);
      const ground = world.place.groundAt(point[0], point[1]);
      const blockers = world.index.overlapping(ring3, ground - 0.5, ground + 4).map((id) => world.get(id)).filter(Boolean);
      const blocked = obstruction(world, ring3, ground - 0.5, ground + 3);
      const reasons = [];
      for (const b of blockers) reasons.push(`${label2(b)} is already there (${b.type})`);
      for (const b of blocked) reasons.push(`it would ${b.severed ? "sever" : "narrow"} ${b.name}`);
      if (world.place.terrain) {
        const s = world.place.terrain.slopeAt(point[0], point[1]);
        if (s.grade > 0.18) reasons.push(`the ground falls ${(s.grade * 100).toFixed(0)}% here`);
      }
      return {
        ...empty,
        text: reasons.length ? `Because ${reasons.join("; and ")}.${cands[0] ? ` The nearest place it does fit is ${dist(cands[0].center, point).toFixed(1)} m away.` : ""}` : "Nothing stops it \u2014 that spot is clear.",
        highlight: blockers.map((b) => b.id).concat(blocked.map((b) => b.id)),
        trace: cands[0] ? [[point, cands[0].center]] : [],
        overlay: { kind: "probe", ring: ring3, ok: !reasons.length, alternative: cands[0]?.ring || null }
      };
    }
    // ---------------------------------------------------------------- who ---
    case "who": {
      const targets = ids.length ? ids : world.journal.changedSince(Math.max(0, world.place.tick - 12));
      const byAuthor = /* @__PURE__ */ new Map();
      for (const id of targets) {
        const hist = world.journal.historyOf(id);
        for (const h of hist) {
          const a = h.event.author;
          if (!byAuthor.has(a)) byAuthor.set(a, []);
          byAuthor.get(a).push({ id, label: h.event.label, utterance: h.event.utterance?.text || null, tick: h.event.tick });
        }
      }
      return {
        ...empty,
        text: byAuthor.size ? [...byAuthor.entries()].map(([a, list]) => `${a}: ${list.length} change${list.length === 1 ? "" : "s"} \u2014 ${[...new Set(list.map((l) => l.label))].slice(0, 3).join("; ")}`).join("\n") : "Nobody has changed this yet \u2014 it came with the place.",
        rows: [...byAuthor.entries()].map(([a, list]) => ({ author: a, changes: list })),
        highlight: targets
      };
    }
    // ------------------------------------------------------------ changed ---
    case "changed": {
      const since = ctx.sinceTick ?? Math.max(0, world.place.tick - 10);
      const changed = world.journal.changedSince(since, world.branch);
      return {
        ...empty,
        text: changed.length ? `${changed.length} things changed since tick ${since}.` : "Nothing has changed here.",
        highlight: changed,
        rows: changed.map((id) => {
          const h = world.journal.historyOf(id).slice(-1)[0];
          return { id, name: label2(world.get(id)), by: h?.event.author, what: h?.event.label, said: h?.event.utterance?.text || null };
        })
      };
    }
    // ---------------------------------------------------------- what-blocks --
    case "what-blocks": {
      const target = ids[0] ? world.get(ids[0]) : null;
      if (!target) return { ...empty, text: "Select the path you mean." };
      const blockers = world.place.relations.filter((r) => r.kind === "blocks" && r.to === target.id).map((r) => r.from);
      const graph = buildGraph(world);
      const severed = graph.edges.filter((e) => e.ownerId === target.id && e.blockedBy);
      const ids2 = [...new Set(blockers.concat(severed.map((s) => s.blockedBy)))];
      return {
        ...empty,
        text: ids2.length ? `${ids2.map((id) => label2(world.get(id))).join(", ")} ${ids2.length === 1 ? "blocks" : "block"} ${label2(target)}.` : `Nothing blocks ${label2(target)} \u2014 it runs clear.`,
        highlight: ids2.concat([target.id]),
        trace: severed.map((s) => [graph.nodes[s.a].p, graph.nodes[s.b].p])
      };
    }
    // ---------------------------------------------------------- where-fit ---
    case "where-fit": {
      const size = ctx.probeSize || (intent.dimensions ? [intent.dimensions.width, intent.dimensions.depth || intent.dimensions.width] : [5, 4]);
      const region = ref.ring || null;
      const point = ref.point || (region ? centroid(region) : centroid([[0, 0]]));
      const cands = findPlacement(world, { region, point, size, samples: 18, seedName: "where-fit" }).slice(0, 12);
      return {
        ...empty,
        text: cands.length ? `${cands.length} places where ${size[0]} \xD7 ${size[1]} m fits without removing anything.` : `Nowhere here fits ${size[0]} \xD7 ${size[1]} m without removing something.`,
        overlay: { kind: "fits", rings: cands.map((c) => c.ring) },
        highlight: []
      };
    }
    // -------------------------------------------------------- what-removes ---
    case "what-removes": {
      const ring3 = ref.ring || (ids[0] ? world.ringOf(world.get(ids[0])) : null);
      if (!ring3) return { ...empty, text: "Circle the area you mean." };
      const hit = world.index.overlapping(ring3, -1, 99).map((id) => world.get(id)).filter((e) => e && e.type !== "observation" && e.type !== "surface");
      return {
        ...empty,
        text: hit.length ? `It would remove ${hit.map((e) => label2(e)).join(", ")}.` : "It would remove nothing.",
        highlight: hit.map((e) => e.id),
        rows: hit.map((e) => ({ id: e.id, name: label2(e), type: e.type, area: area(world.ringOf(e)).toFixed(1) }))
      };
    }
    // --------------------------------------------------------------- which ---
    case "which": {
      const norm2 = q.raw;
      if (/flood|water|maji|inunda/.test(norm2)) {
        const w = runWater(world, { rain: "heavy" });
        const wet = [...w.exposure.entries()].filter(([, v]) => v.maxDepth > 0.05);
        return {
          ...empty,
          text: `${w.pondCount} places hold water in ${w.model.assumptions.rainfall_mm.heavy} mm rain; ${wet.length} built things get wet; deepest ${w.maxDepth.toFixed(2)} m.`,
          highlight: wet.map(([id]) => id),
          overlay: { kind: "water", water: w },
          rows: wet.map(([id, v]) => ({ id, name: label2(world.get(id)), depth: `${v.maxDepth.toFixed(2)} m`, wet: `${(v.wetFraction * 100).toFixed(0)}%` }))
        };
      }
      if (/shade|shadow|sun|hot/.test(norm2)) {
        const region = ref.ring || boundsRing2(world);
        const s = shadeCoverage(world, region, 14);
        return { ...empty, text: `${(s.fraction * 100).toFixed(0)}% of this area is shaded at 2pm.`, overlay: { kind: "shade", hour: 14, unshaded: s.unshaded } };
      }
      if (/dark|night|light/.test(norm2)) {
        const n = nightCoverage(world);
        return { ...empty, text: `${(n.fraction * 100).toFixed(0)}% of the walkable network is lit at night.`, overlay: { kind: "dark", points: n.dark.map((d) => d.p) } };
      }
      if (/disputed|contested|argu/.test(norm2)) {
        const disputed = world.entities().filter((e) => e.epistemic === "DISPUTED").concat(world.place.relations.filter((r) => r.kind === "disputedBy").map((r) => world.get(r.to)).filter(Boolean));
        return { ...empty, text: disputed.length ? `${disputed.length} things are disputed here.` : "Nothing is currently disputed.", highlight: disputed.map((e) => e.id) };
      }
      return whatIsHere(world, ref, empty);
    }
    // ------------------------------------------------------------ how-many ---
    case "how-many": {
      const pool = ref.ring ? world.index.within(ref.ring).map((id) => world.get(id)) : world.entities();
      const counts = /* @__PURE__ */ new Map();
      for (const e of pool) if (e) counts.set(e.type, (counts.get(e.type) || 0) + 1);
      return {
        ...empty,
        text: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}${n === 1 ? "" : "s"}`).join(", "),
        rows: [...counts.entries()].map(([type, n]) => ({ type, n })),
        highlight: pool.filter(Boolean).map((e) => e.id)
      };
    }
    // ------------------------------------------------------------- compare ---
    case "compare": {
      const branches = ctx.compareBranches || [...world.place.branches.keys()].slice(0, 6);
      const rows = branches.map((bid) => {
        const view = world.view(bid);
        const prev = world.place.activeBranch;
        world.place.activeBranch = bid;
        world.dirty = true;
        world.reindex();
        const w = runWater(world, { rain: "heavy" });
        const acc = reachability(world, seedOf(world));
        world.place.activeBranch = prev;
        world.dirty = true;
        world.reindex();
        return {
          branch: bid,
          name: world.place.branches.get(bid)?.name || bid,
          entities: view.entities.length,
          flooded: `${w.floodedArea.toFixed(0)} m\xB2`,
          maxDepth: `${w.maxDepth.toFixed(2)} m`,
          connectivity: `${(acc.fraction * 100).toFixed(0)}%`
        };
      });
      return { ...empty, text: rows.map((r) => `${r.name}: ${r.flooded} flooded, ${r.maxDepth} deepest, ${r.connectivity} connected`).join("\n"), rows, compare: { branches, rows } };
    }
    case "where": {
      const thing = intent.thing;
      const pool = world.entities().filter((e) => !thing || e.type === thing || e.subtype === thing);
      return { ...empty, text: `${pool.length} found.`, highlight: pool.map((e) => e.id) };
    }
    default:
      return whatIsHere(world, ref, empty);
  }
}
function whatIsHere(world, ref, empty) {
  const ids = ref.ids?.length ? ref.ids : ref.ring ? world.index.within(ref.ring) : ref.point ? world.index.near(ref.point, 10).map((h) => h.id) : [];
  const ents = ids.map((id) => world.get(id)).filter(Boolean);
  if (!ents.length) return { ...empty, text: "Nothing is recorded there yet. Say something about it and there will be." };
  const obs = ents.filter((e) => e.type === "observation");
  const rest = ents.filter((e) => e.type !== "observation");
  const lines = [];
  if (rest.length) lines.push(rest.map((e) => label2(e)).join(", "));
  for (const o of obs) lines.push(`someone said: "${o.evidence?.[0]?.text || o.name}" (${o.author})`);
  return { ...empty, text: lines.join("\n"), highlight: ents.map((e) => e.id), rows: ents.map((e) => ({ id: e.id, type: e.type, epistemic: e.epistemic, author: e.author })) };
}
function boundsRing2(world) {
  const b = world.place.bounds();
  return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
}
function seedOf(world) {
  const net = world.entities().find((e) => (e.type === "road" || e.type === "path") && e.path);
  if (net) return net.path[0];
  const b = world.place.bounds();
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

// src/sim/consequence.js
var scratchSeq = 0;
function withGhosts(world, ghosts, removals, fn) {
  const place2 = world.place;
  const prev = place2.activeBranch;
  const sid = `__scratch_${++scratchSeq}`;
  place2.branches.set(sid, makeBranch(sid, { name: "scratch", parent: prev }));
  place2.overlays.set(sid, /* @__PURE__ */ new Map());
  place2.activeBranch = sid;
  for (const g of ghosts || []) place2.put({ ...g, status: "ACTIVE" }, sid);
  for (const id of removals || []) place2.remove(id, sid);
  world.dirty = true;
  world.reindex();
  try {
    return fn(world);
  } finally {
    place2.activeBranch = prev;
    place2.branches.delete(sid);
    place2.overlays.delete(sid);
    world.dirty = true;
    world.reindex();
  }
}
function consequenceOf(world, plan2, opts = {}) {
  const ghosts = plan2.ghosts || [];
  const removals = plan2.removals || [];
  const patches = plan2.patches || [];
  const effective = ghosts.filter((g) => !g.props?.modifies).concat(patches.map((p) => ({ ...world.get(p.id), ...p.patch })));
  const effectiveRemovals = removals.concat(patches.map((p) => p.id));
  if (!effective.length && !removals.length) return { metrics: [], quantities: {}, water: null, access: null };
  const region = plan2.region || regionAround(world, effective, removals);
  const seed = seedPoint(world);
  const ghostRings = effective.map((g) => world.place.ringOf(g)).filter(Boolean);
  const frame2 = waterFrame(world, ghostRings, opts.cell || 1.5);
  const before = runWater(world, { rain: opts.rain || "heavy", frame: frame2 });
  const after = withGhosts(world, effective, effectiveRemovals, (w) => runWater(w, { rain: opts.rain || "heavy", frame: frame2 }));
  const dw = compareWater(before, after);
  const accessBefore = reachability(world, seed);
  const accessAfter = withGhosts(world, effective, effectiveRemovals, (w) => reachability(w, seed));
  let shade = null;
  if (region) {
    const sb = shadeCoverage(world, region, opts.hour ?? 14);
    const sa = withGhosts(world, effective, effectiveRemovals, (w) => shadeCoverage(w, region, opts.hour ?? 14));
    shade = { before: sb.fraction, after: sa.fraction };
  }
  const cert = plan2.certificate || { findings: [] };
  const removedTrees = /* @__PURE__ */ new Set();
  const affectedStructures = /* @__PURE__ */ new Set();
  for (const f2 of cert.findings) {
    for (const id of f2.others || []) {
      const e = world.get(id);
      if (!e) continue;
      if (e.type === "tree" && (f2.code === "REQUIRES_REMOVAL" || f2.code === "COLLISION")) removedTrees.add(id);
      if (e.type === "structure" && (f2.code === "COLLISION" || f2.code === "REQUIRES_REMOVAL")) affectedStructures.add(id);
    }
  }
  for (const id of removals) {
    const e = world.get(id);
    if (e?.type === "tree") removedTrees.add(id);
    if (e?.type === "structure") affectedStructures.add(id);
  }
  const metrics = [];
  if (before.floodedArea > 0 || after.floodedArea > 0) {
    metrics.push({
      key: "flooding",
      label: "Flooded area (> 5 cm)",
      before: `${before.floodedArea.toFixed(0)} m\xB2`,
      after: `${after.floodedArea.toFixed(0)} m\xB2`,
      delta: dw.floodedAreaPct,
      good: dw.floodedAreaPct > 1,
      bad: dw.floodedAreaPct < -1,
      basis: `${before.model.name}, ${before.model.assumptions.rainfall_mm[opts.rain || "heavy"]} mm over ${before.model.assumptions.duration_min} min, peak depth, ${frame2.cell} m grid, ${before.steps} steps \u2014 direction is robust, magnitude is resolution-dependent`
    });
    metrics.push({
      key: "depth",
      label: "Deepest water",
      before: `${before.maxDepth.toFixed(2)} m`,
      after: `${after.maxDepth.toFixed(2)} m`,
      delta: -dw.maxDepthDelta * 100,
      good: dw.maxDepthDelta < -5e-3,
      bad: dw.maxDepthDelta > 5e-3,
      basis: "same run"
    });
  }
  metrics.push({
    key: "access",
    label: "Path connectivity",
    before: `${(accessBefore.fraction * 100).toFixed(0)}%`,
    after: `${(accessAfter.fraction * 100).toFixed(0)}%`,
    delta: (accessAfter.fraction - accessBefore.fraction) * 100,
    good: accessAfter.fraction >= accessBefore.fraction - 1e-6,
    bad: accessAfter.fraction < accessBefore.fraction - 1e-6,
    basis: "network graph from the same seed point"
  });
  if (shade) {
    metrics.push({
      key: "shade",
      label: "Shade at 2pm",
      before: `${(shade.before * 100).toFixed(0)}%`,
      after: `${(shade.after * 100).toFixed(0)}%`,
      delta: (shade.after - shade.before) * 100,
      good: shade.after > shade.before,
      bad: false,
      basis: "hard shadow projection"
    });
  }
  if (affectedStructures.size) {
    metrics.push({ key: "structures", label: "Structures affected", before: "0", after: String(affectedStructures.size), delta: -affectedStructures.size, bad: true, basis: "certificate" });
  }
  if (removedTrees.size) {
    metrics.push({ key: "trees", label: "Trees removed", before: "0", after: String(removedTrees.size), delta: -removedTrees.size, bad: true, basis: "certificate" });
  }
  return {
    metrics,
    quantities: quantitiesFor(world, effective),
    water: { before, after, delta: dw },
    access: { before: accessBefore.fraction, after: accessAfter.fraction, newlyUnreachable: accessAfter.unreachable },
    affected: { structures: [...affectedStructures], trees: [...removedTrees] }
  };
}
function quantitiesFor(world, ghosts) {
  let earthwork = 0, gravel = 0, plants = 0, length = 0, footprint = 0, glazing = 0, wallArea = 0;
  for (const g of ghosts) {
    const ring3 = world.place.ringOf(g);
    if (!ring3) continue;
    const a = area(ring3);
    footprint += a;
    if (g.type === "drain") {
      const L = g.path ? perimeter(g.path, false) : perimeter(ring3) / 2;
      const depth = g.props?.depth ?? g.zTop - g.zBase;
      length += L;
      earthwork += L * (g.width || 1) * depth;
      gravel += L * (g.width || 1) * 0.15;
    } else if (g.type === "path" || g.type === "road") {
      const L = g.path ? perimeter(g.path, false) : perimeter(ring3) / 2;
      length += L;
      gravel += L * (g.width || 1.5) * 0.12;
      earthwork += L * (g.width || 1.5) * 0.1;
    } else if (g.type === "tree") {
      plants += 1;
    } else if (g.subtype === "garden") {
      plants += Math.round(a / 1.5);
      earthwork += a * 0.15;
    } else if (g.type === "structure") {
      const h = g.zTop - g.zBase;
      wallArea += perimeter(ring3) * h;
      if (g.material === "glass") glazing += perimeter(ring3) * h + a;
      earthwork += a * 0.3;
    }
  }
  const round2 = (v, p = 1) => +v.toFixed(p);
  return {
    earthwork_m3: round2(earthwork),
    gravel_m3: round2(gravel),
    plants,
    length_m: round2(length),
    footprint_m2: round2(footprint),
    glazing_m2: round2(glazing),
    wall_m2: round2(wallArea)
  };
}
function regionAround(world, ghosts, removals) {
  const rings = [];
  for (const g of ghosts) {
    const r = world.place.ringOf(g);
    if (r) rings.push(r);
  }
  for (const id of removals) {
    const e = world.get(id);
    const r = e && world.ringOf(e);
    if (r) rings.push(r);
  }
  if (!rings.length) return null;
  const pts = rings.flat();
  const bb = bbox(pts);
  const pad = 12;
  return [[bb[0] - pad, bb[1] - pad], [bb[2] + pad, bb[1] - pad], [bb[2] + pad, bb[3] + pad], [bb[0] - pad, bb[3] + pad]];
}
function seedPoint(world) {
  const net = world.entities().find((e) => (e.type === "road" || e.type === "path") && e.path);
  if (net) return net.path[0];
  const b = world.place.bounds();
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

// src/render/gl.js
var VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
uniform mat4 uViewProj;
uniform vec3 uSun;
uniform float uLift;   // the rise: entities slide up out of the ground on arrival
out vec4 vColor;
out float vFog;
uniform float uFogFar;
out vec3 vWorld;
void main() {
  vec4 clip = uViewProj * vec4(aPos.x, aPos.y, aPos.z + uLift, 1.0);
  gl_Position = clip;
  float lambert = max(dot(normalize(aNormal), normalize(uSun)), 0.0);
  float ambient = 0.66 + 0.14 * aNormal.z;
  vColor = vec4(aColor.rgb * (ambient + 0.46 * lambert), aColor.a);
  vFog = clamp(clip.w / uFogFar, 0.0, 1.0);
  vWorld = aPos;
}`;
var FRAG = `#version 300 es
precision highp float;
in vec4 vColor;
in float vFog;
in vec3 vWorld;
uniform vec4 uFog;
out vec4 outColor;
void main() {
  vec3 c = mix(vColor.rgb, uFog.rgb, vFog * uFog.a);
  outColor = vec4(c, vColor.a);
}`;
var LINE_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
uniform mat4 uViewProj;
uniform float uLift;
out vec4 vColor;
void main() { gl_Position = uViewProj * vec4(aPos.x, aPos.y, aPos.z + uLift, 1.0); vColor = aColor; }`;
var LINE_FRAG = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vColor; }`;
var DARK = {
  // A tenth of the scale between low ground and high is not enough to see a
  // hill by, and this was the original — which is a large part of why the dark
  // view read as a featureless wash for so long. Widened to a quarter.
  ground: [0.2, 0.2, 0.18],
  groundHigh: [0.5, 0.48, 0.41],
  structure: [0.62, 0.58, 0.52],
  roof: [0.52, 0.46, 0.41],
  iron: [0.55, 0.42, 0.36],
  room: [0.7, 0.68, 0.63],
  wall: [0.58, 0.56, 0.52],
  road: [0.3, 0.29, 0.28],
  path: [0.46, 0.43, 0.38],
  drain: [0.25, 0.36, 0.44],
  water: [0.2, 0.42, 0.56],
  waterEdge: [0.44, 0.78, 0.98],
  boundary: [0.95, 0.35, 0.25],
  tree: [0.28, 0.44, 0.26],
  treeTrunk: [0.3, 0.25, 0.2],
  surface: [0.4, 0.44, 0.31],
  market: [0.64, 0.52, 0.34],
  bench: [0.5, 0.4, 0.3],
  light: [0.72, 0.7, 0.6],
  observation: [0.95, 0.72, 0.25],
  disputed: [0.9, 0.45, 0.3],
  contour: [0.98, 0.94, 0.82],
  contourIndex: [1, 0.86, 0.52],
  bridge: [0.6, 0.55, 0.48],
  furniture: [0.62, 0.55, 0.45],
  opening: [0.85, 0.9, 0.95],
  parcel: [0.4, 0.4, 0.36],
  car: [0.45, 0.48, 0.52],
  ghost: [0.35, 0.85, 0.75],
  ghostBad: [0.95, 0.42, 0.38],
  select: [1, 0.95, 0.55],
  highlight: [0.45, 0.85, 1],
  preserve: [0.55, 0.95, 0.6],
  sky: [0.055, 0.063, 0.078]
};
var BLACK = {
  ...DARK,
  sky: [0, 0, 0],
  ground: [0.1, 0.1, 0.11],
  groundHigh: [0.3, 0.3, 0.31],
  structure: [0.42, 0.4, 0.38],
  road: [0.2, 0.2, 0.21],
  water: [0.1, 0.34, 0.52],
  waterEdge: [0.35, 0.72, 0.98],
  contour: [0.7, 0.66, 0.52],
  contourIndex: [1, 0.82, 0.42]
};
var LIGHT = {
  ...DARK,
  sky: [0.88, 0.9, 0.92],
  ground: [0.66, 0.65, 0.6],
  groundHigh: [0.92, 0.9, 0.85],
  structure: [0.7, 0.66, 0.6],
  road: [0.55, 0.54, 0.52],
  path: [0.68, 0.65, 0.6],
  water: [0.4, 0.6, 0.75],
  waterEdge: [0.16, 0.42, 0.64],
  tree: [0.38, 0.52, 0.34],
  treeTrunk: [0.42, 0.33, 0.25],
  contour: [0.28, 0.24, 0.16],
  contourIndex: [0.42, 0.27, 0.06],
  boundary: [0.72, 0.1, 0.05],
  select: [0.08, 0.4, 0.36],
  highlight: [0.82, 0.42, 0.08],
  observation: [0.68, 0.42, 0.04],
  preserve: [0.13, 0.42, 0.28],
  disputed: [0.72, 0.22, 0.12]
};
var PARCHMENT = {
  ...LIGHT,
  sky: [0.93, 0.9, 0.83],
  ground: [0.74, 0.68, 0.56],
  groundHigh: [0.94, 0.9, 0.8],
  structure: [0.66, 0.58, 0.46],
  road: [0.56, 0.5, 0.41],
  path: [0.7, 0.64, 0.52],
  water: [0.46, 0.6, 0.66],
  waterEdge: [0.2, 0.4, 0.5],
  tree: [0.45, 0.51, 0.33],
  contour: [0.4, 0.29, 0.15],
  contourIndex: [0.32, 0.18, 0.04],
  select: [0.2, 0.36, 0.28],
  highlight: [0.7, 0.36, 0.08]
};
var INK = {
  ...LIGHT,
  sky: [0.965, 0.962, 0.955],
  ground: [0.8, 0.795, 0.78],
  groundHigh: [0.985, 0.982, 0.975],
  structure: [0.7, 0.69, 0.67],
  road: [0.52, 0.51, 0.5],
  path: [0.72, 0.71, 0.69],
  water: [0.7, 0.8, 0.87],
  waterEdge: [0.08, 0.3, 0.55],
  tree: [0.66, 0.72, 0.62],
  contour: [0.18, 0.16, 0.12],
  contourIndex: [0.05, 0.04, 0.02],
  select: [0.02, 0.34, 0.3],
  highlight: [0.8, 0.3, 0.02]
};
var THEME_LIST = [
  { key: "dark", label: "Night", swatch: "#1a1d22" },
  { key: "black", label: "Black", swatch: "#000000" },
  { key: "light", label: "Daylight", swatch: "#d8d6cf" },
  { key: "parchment", label: "Parchment", swatch: "#d8caa8" },
  { key: "ink", label: "Ink", swatch: "#f4f3f0" }
];
var BY_NAME = { dark: DARK, black: BLACK, light: LIGHT, parchment: PARCHMENT, ink: INK };
var PALETTE = { ...DARK };
var isLight = (name) => ["light", "parchment", "ink"].includes(name);
function setTheme(name) {
  const next = BY_NAME[name] || DARK;
  for (const k of Object.keys(PALETTE)) delete PALETTE[k];
  Object.assign(PALETTE, next);
  return BY_NAME[name] ? name : "dark";
}
var TYPE_COLOR = {
  structure: "structure",
  room: "room",
  wall: "wall",
  road: "road",
  path: "path",
  drain: "drain",
  stream: "water",
  water: "water",
  tree: "tree",
  surface: "surface",
  market: "market",
  bench: "bench",
  light: "light",
  observation: "observation",
  bridge: "bridge",
  furniture: "furniture",
  opening: "opening",
  parcel: "parcel",
  car: "car"
};
var Renderer = class {
  constructor(canvas2) {
    this.canvas = canvas2;
    const gl = canvas2.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL2 is required");
    this.gl = gl;
    this.prog = link(gl, VERT, FRAG);
    this.lineProg = link(gl, LINE_VERT, LINE_FRAG);
    this.solid = makeMesh(gl, 3);
    this.trans = makeMesh(gl, 3);
    this.lines = makeLineMesh(gl);
    this.dyn = makeMesh(gl);
    this.ground = makeMesh(gl, 3);
    this.groundLines = makeLineMesh(gl);
    this.traceMesh = makeMesh(gl, 3);
    this._groundKey = null;
    this._groundTris = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    this.fidelity = "high";
    this.dprCap = 2;
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap ?? 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return [w, h];
  }
  /**
   * Rebuild geometry from the model. Called when the world changes — not per
   * frame — so a thousand entities cost nothing to look at.
   */
  build(world, opts = {}) {
    const {
      ghosts = [],
      selection = /* @__PURE__ */ new Set(),
      highlight = /* @__PURE__ */ new Set(),
      overlay = null,
      preserved = /* @__PURE__ */ new Set(),
      changed = /* @__PURE__ */ new Set(),
      fidelity = "high",
      hour = 14,
      cutawayAt = null,
      hidden = /* @__PURE__ */ new Set(),
      metresPerPixel = 0.25,
      camera = null
    } = opts;
    if (camera) this.cam = camera;
    this.fidelity = fidelity;
    const S3 = new Builder();
    const T = new Builder();
    const L = new LineBuilder();
    const terr = world.place.terrain;
    if (terr) {
      const wantContours = fidelity !== "symbolic" && opts.contours !== false;
      const water = overlay?.kind === "water" ? overlay.water : null;
      const reach = Math.max(600, (this.cam?.dist || 800) * 3.2);
      const key2 = [
        fidelity,
        wantContours ? 1 : 0,
        typeof IMAGERY !== "undefined" && IMAGERY.on ? IMAGERY.rev || 1 : 0,
        Math.round((this.cam?.target?.[0] ?? 0) / 240),
        Math.round((this.cam?.target?.[1] ?? 0) / 240),
        Math.round(reach / 480),
        PALETTE.sky.join(",")
      ].join("|");
      this._groundQ = key2.split("|").slice(3, 6).join("|");
      if (key2 !== this._groundKey || terr !== this._groundTerrain || water !== this._groundWater) {
        const GS = new Builder(), GL2 = new LineBuilder();
        this.buildTerrain(GS, world, overlay, fidelity);
        this.contourInterval = 0;
        if (wantContours) this.buildContours(GL2, world, fidelity);
        this.ground.upload(GS);
        this.groundLines.upload(GL2);
        this._groundKey = key2;
        this._groundTerrain = terr;
        this._groundWater = water;
        this._groundTris = GS.count / 3;
      }
    } else if (this._groundTerrain) {
      this.ground.upload(new Builder());
      this.groundLines.upload(new LineBuilder());
      this._groundKey = null;
      this._groundTerrain = null;
      this._groundTris = 0;
    }
    const ents = world.entities();
    const detail = { high: 0, medium: 1, low: 2, symbolic: 3 }[fidelity];
    const surf = surfaceOf(world.place.terrain, fidelity);
    this.surface = surf;
    const ground = (x, y) => surfaceHeight(surf, x, y);
    const cell = surf ? surf.span : 12;
    const grid = surf ? [surf.ox, surf.oy] : null;
    const flatOffset = (e) => FLAT_ORDER[e.type] ?? FLAT_ORDER.default;
    const epoch = [
      detail,
      cutawayAt ? Math.round(cutawayAt[0]) + "," + Math.round(cutawayAt[1]) : "",
      Math.round(metresPerPixel * 4),
      // water widening answers to the zoom
      PALETTE.sky.join(",")
    ].join("|");
    if (!this._entCache || this._entSurf !== surf || this._entEpoch !== epoch) {
      this._entCache = /* @__PURE__ */ new WeakMap();
      this._entSurf = surf;
      this._entEpoch = epoch;
    }
    const NOCACHE = /* @__PURE__ */ new Set();
    const around = opts.around || null;
    const near2 = around ? around.r * around.r : 0;
    const far2 = around ? (around.farR || around.r * 3) * (around.farR || around.r * 3) : 0;
    for (const e of ents) {
      if (hidden.has(e.type)) continue;
      if (!visibleAt(e, detail)) continue;
      const ring3 = world.ringOf(e);
      if (!ring3 || ring3.length < 3) continue;
      if (around) {
        const bb = world.index?.boxes?.get(e.id);
        let d2;
        if (bb) {
          const dx = Math.max(bb[0] - around.center[0], 0, around.center[0] - bb[2]);
          const dy = Math.max(bb[1] - around.center[1], 0, around.center[1] - bb[3]);
          d2 = dx * dx + dy * dy;
        } else {
          const dx = ring3[0][0] - around.center[0], dy = ring3[0][1] - around.center[1];
          d2 = dx * dx + dy * dy;
        }
        if (d2 > near2 && (d2 > far2 || e.type !== "structure" || e.zTop - e.zBase < 34)) continue;
      }
      const col = colorFor(e);
      const sel = selection.has(e.id);
      const hi = highlight.has(e.id);
      const cached = NOCACHE.has(e.type) ? null : this._entCache.get(e);
      if (cached) {
        S3.append(cached.s);
        T.append(cached.t);
        L.append(cached.l);
      } else {
        const sMark = S3.mark(), tMark = T.mark(), lMark = L.mark();
        if (e.type === "tree") {
          this.buildTree(S3, e, ring3, detail);
        } else if (e.type === "observation") {
          T.draped(ring3, ground, flatOffset(e) + 0.02, col, 0.18, cell, grid);
          L.ring(ring3, e.zTop + 0.06, col, 0.95);
          this.buildPin(S3, L, e, ring3);
        } else if (e.type === "parcel") {
          const lift = flatOffset(e) + 0.35;
          L.ring(ring3, 0, PALETTE.boundary, 1, ground, lift);
          L.ring(ring3, 0, PALETTE.boundary, 0.55, ground, lift + 0.9);
        } else if (e.type === "water" || e.type === "stream") {
          const ob = orientedBounds(ring3);
          const narrow = Math.min(ob.width, ob.depth);
          const wantAcross = metresPerPixel * 5;
          const drawn = narrow < wantAcross ? offsetRing(ring3, Math.min(12, (wantAcross - narrow) / 2)) : ring3;
          S3.draped(drawn, ground, flatOffset(e), col, 1, cell, grid);
          L.ring(drawn, 0, PALETTE.waterEdge, 0.9, ground, flatOffset(e) + 0.05);
        } else if (isFlat(e)) {
          S3.draped(ring3, ground, flatOffset(e), col, 1, cell, grid);
        } else {
          const cutaway = cutawayAt && e.type === "structure" && pointInRing2(cutawayAt, ring3);
          const shape = e.props?.roof?.shape;
          const wantsRoof = !cutaway && e.type === "structure" && detail <= 1 && shape && shape !== "flat";
          if (wantsRoof) {
            const rh = roofHeightFor(e, ring3);
            const eaves = Math.max(e.zBase + 0.4, e.zTop - rh);
            S3.prism(ring3, e.zBase, eaves, col, col, 1, false);
            S3.roof(ring3, eaves, eaves + rh, shape, roofColorFor(e));
          } else {
            S3.prism(ring3, e.zBase, e.zTop, col, roofColorFor(e), 1, !cutaway);
          }
          if (cutaway) L.ring(ring3, e.zTop, [1, 1, 1], 0.28);
        }
        if (!NOCACHE.has(e.type)) this._entCache.set(e, { s: S3.since(sMark), t: T.since(tMark), l: L.since(lMark) });
      }
      if (sel) L.ring(ring3, e.zTop + 0.06, PALETTE.select, 1);
      else if (hi) L.ring(ring3, e.zTop + 0.06, PALETTE.highlight, 1);
      else if (preserved.has(e.id)) L.ring(ring3, e.zTop + 0.05, PALETTE.preserve, 0.85);
      else if (changed.has(e.id)) L.ring(ring3, e.zTop + 0.05, [0.6, 0.8, 1], 0.5);
      else if (e.epistemic === "DISPUTED") L.ring(ring3, e.zTop + 0.05, PALETTE.disputed, 0.9);
      else if (detail === 0 && (e.type === "structure" || e.type === "room")) L.ring(ring3, e.zTop + 0.02, [0, 0, 0], 0.22);
    }
    for (const g of ghosts) {
      const ring3 = world.place.ringOf(g);
      if (!ring3 || ring3.length < 3) continue;
      const bad = g.__invalid;
      const col = bad ? PALETTE.ghostBad : PALETTE.ghost;
      if (isFlat(g)) T.draped(ring3, ground, flatOffset(g) + 0.04, col, 0.42, cell, grid);
      else T.prism(ring3, g.zBase, g.zTop, col, col, 0.38);
      L.ring(ring3, g.zTop + 0.08, col, 1);
      L.ring(ring3, g.zBase + 0.02, col, 0.5);
      for (const p of ring3) L.segment([p[0], p[1], g.zBase], [p[0], p[1], g.zTop], col, 0.5);
    }
    if (overlay) this.buildOverlay(T, L, world, overlay);
    this.solid.upload(S3);
    this.trans.upload(T);
    this.lines.upload(L);
    this.stats = { entities: ents.length, tris: S3.count / 3 + T.count / 3 + this._groundTris };
    return this.stats;
  }
  /**
   * The ground, shaded as ground rather than as facets.
   *
   * Every terrain quad carried a single face normal, so each 31 m cell caught
   * the light as one flat plate and a hillside read as crazy paving. The
   * heightfield knows its own slope at every point, so the normal is taken from
   * that instead: same triangles, same cost, a surface that curves.
   */
  terrainNormal(t, i, j, step) {
    const d = t.cell * step;
    const dzdx = (t.at(i + step, j) - t.at(i - step, j)) / (2 * d);
    const dzdy = (t.at(i, j + step) - t.at(i, j - step)) / (2 * d);
    const len2 = Math.hypot(dzdx, dzdy, 1);
    return [-dzdx / len2, -dzdy / len2, 1 / len2];
  }
  buildTerrain(B, world, overlay, fidelity) {
    const t = world.place.terrain;
    const surf = surfaceOf(t, fidelity);
    const water = overlay?.kind === "water" ? overlay.water : null;
    const { span, ox, oy } = surf;
    const reach = Math.max(600, (this.cam?.dist || 800) * 3.2);
    const cx = this.cam?.target?.[0] ?? (t.bounds[0] + t.bounds[2]) / 2;
    const cy = this.cam?.target?.[1] ?? (t.bounds[1] + t.bounds[3]) / 2;
    const i0 = Math.max(0, Math.floor((cx - reach - ox) / span));
    const i1 = Math.min(surf.nx, Math.ceil((cx + reach - ox) / span));
    const j0 = Math.max(0, Math.floor((cy - reach - oy) / span));
    const j1 = Math.min(surf.ny, Math.ceil((cy + reach - oy) / span));
    const BUDGET = fidelity === "high" ? 26e4 : fidelity === "medium" ? 14e4 : fidelity === "low" ? 7e4 : 4e4;
    const stride = Math.max(1, Math.ceil(Math.sqrt((i1 - i0) * (j1 - j0) * 2 / BUDGET)));
    const nrm = (i, j) => {
      const d = span;
      const dzdx = (surf.at(i + 1, j) - surf.at(i - 1, j)) / (2 * d);
      const dzdy = (surf.at(i, j + 1) - surf.at(i, j - 1)) / (2 * d);
      const len2 = Math.hypot(dzdx, dzdy, 1);
      return [-dzdx / len2, -dzdy / len2, 1 / len2];
    };
    for (let j = j0; j + stride <= j1; j += stride) {
      for (let i = i0; i + stride <= i1; i += stride) {
        const x0 = ox + i * span, y0 = oy + j * span;
        const x1 = x0 + span * stride, y1 = y0 + span * stride;
        const h00 = surf.at(i, j), h10 = surf.at(i + stride, j);
        const h11 = surf.at(i + stride, j + stride), h01 = surf.at(i, j + stride);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const c = typeof IMAGERY !== "undefined" && IMAGERY.on && IMAGERY.sample(mx, my) || terrainColor((h00 + h11) / 2, t, water, mx, my);
        const n00 = nrm(i, j), n10 = nrm(i + stride, j);
        const n11 = nrm(i + stride, j + stride), n01 = nrm(i, j + stride);
        B.tri([x0, y0, h00], [x1, y0, h10], [x1, y1, h11], n00, c, 1, n10, n11);
        B.tri([x0, y0, h00], [x1, y1, h11], [x0, y1, h01], n00, c, 1, n11, n01);
      }
    }
  }
  /**
   * CONTOURS — the one drawing convention that makes ground legible.
   *
   * A shaded surface tells you where the light is, not where the hill is. On
   * 281 m of relief a hillside reads as a flat wash, and no one can judge a site
   * from it. Contours give the eye something to count: spacing IS steepness,
   * closed rings ARE summits and hollows, and both survive any camera angle.
   *
   * The interval is chosen from the actual relief so a flat delta gets metre
   * lines and a mountain gets fifties, and every fifth line is drawn heavier —
   * the index contour, which is how a map is read.
   */
  buildContours(L, world, fidelity) {
    const t = world.place.terrain;
    if (!t) return;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < t.data.length; k++) {
      const v = t.data[k];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const relief = hi - lo;
    if (!isFinite(relief) || relief < 1.5) return;
    const raw = relief / 25;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const interval = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= raw) || 10 * pow;
    const surf = surfaceOf(t, fidelity);
    const first = Math.ceil(lo / interval) * interval;
    const seg = (tri, level, col, alpha) => {
      const hit = [];
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3];
        if (a[2] < level === b[2] < level) continue;
        const f2 = (level - a[2]) / (b[2] - a[2]);
        hit.push([a[0] + (b[0] - a[0]) * f2, a[1] + (b[1] - a[1]) * f2]);
      }
      if (hit.length !== 2) return;
      L.segment([hit[0][0], hit[0][1], level + 0.12], [hit[1][0], hit[1][1], level + 0.12], col, alpha);
    };
    for (let level = first; level <= hi; level += interval) {
      const isIndex = Math.abs(level / interval % 5) < 1e-3;
      const col = isIndex ? PALETTE.contourIndex : PALETTE.contour;
      const alpha = isIndex ? 0.85 : 0.42;
      for (let j = 0; j < surf.ny; j++) {
        for (let i = 0; i < surf.nx; i++) {
          const x0 = surf.ox + i * surf.span, y0 = surf.oy + j * surf.span;
          const x1 = x0 + surf.span, y1 = y0 + surf.span;
          const p00 = [x0, y0, surf.at(i, j)];
          const p10 = [x1, y0, surf.at(i + 1, j)];
          const p11 = [x1, y1, surf.at(i + 1, j + 1)];
          const p01 = [x0, y1, surf.at(i, j + 1)];
          seg([p00, p10, p11], level, col, alpha);
          seg([p00, p11, p01], level, col, alpha);
        }
      }
    }
    this.contourInterval = interval;
  }
  buildTree(B, e, ring3, detail) {
    const c = centroid(ring3);
    const r = e.props?.canopyRadius || 2.5;
    const top = e.zTop, base = e.zBase;
    if (detail >= 2) {
      B.polygon(ring3, base + 0.05, PALETTE.tree, 1);
      return;
    }
    B.prism(circleRing(c[0], c[1], r * 0.14, 6), base, base + (top - base) * 0.45, PALETTE.treeTrunk, PALETTE.treeTrunk);
    const canopyBase = base + (top - base) * 0.4;
    const seg = detail === 0 ? 10 : 6;
    B.cone(c, r, canopyBase, top, PALETTE.tree, seg);
  }
  buildPin(B, L, e, ring3) {
    const c = centroid(ring3);
    const h = e.zTop + 2.6;
    L.segment([c[0], c[1], e.zTop], [c[0], c[1], h], PALETTE.observation, 1);
    B.prism(circleRing(c[0], c[1], 0.45, 8), h, h + 0.9, PALETTE.observation, PALETTE.observation);
  }
  buildOverlay(T, L, world, overlay) {
    if (overlay.kind === "water" && overlay.water) {
      const w = overlay.water;
      for (let j = 0; j < w.ny; j++) {
        for (let i = 0; i < w.nx; i++) {
          const d = w.depth[j * w.nx + i];
          if (d <= 0.05) continue;
          const x = w.bounds[0] + i * w.cell, y = w.bounds[1] + j * w.cell;
          const z = w.elev[j * w.nx + i] + d;
          const t = Math.min(1, d / 0.5);
          const col = [
            0.42 - 0.3 * t,
            0.72 - 0.36 * t,
            0.92 - 0.2 * t
          ];
          T.quad([x, y, z], [x + w.cell, y, z], [x + w.cell, y + w.cell, z], [x, y + w.cell, z], col, 0.3 + 0.45 * t);
        }
      }
    }
    if (overlay.kind === "shade") {
      for (const p of overlay.unshaded || []) {
        const z = world.place.groundAt(p[0], p[1]) + 0.04;
        T.quad([p[0] - 0.7, p[1] - 0.7, z], [p[0] + 0.7, p[1] - 0.7, z], [p[0] + 0.7, p[1] + 0.7, z], [p[0] - 0.7, p[1] + 0.7, z], [0.95, 0.75, 0.35], 0.3);
      }
    }
    if (overlay.kind === "dark") {
      for (const p of overlay.points || []) {
        const z = world.place.groundAt(p[0], p[1]) + 0.04;
        T.quad([p[0] - 1, p[1] - 1, z], [p[0] + 1, p[1] - 1, z], [p[0] + 1, p[1] + 1, z], [p[0] - 1, p[1] + 1, z], [0.2, 0.25, 0.5], 0.5);
      }
    }
    if (overlay.kind === "fits") {
      for (const ring3 of overlay.rings || []) {
        const z = world.place.groundAt(...centroid(ring3)) + 0.06;
        T.polygon(ring3, z, PALETTE.preserve, 0.2);
        L.ring(ring3, z + 0.01, PALETTE.preserve, 0.7);
      }
    }
    if (overlay.kind === "probe") {
      const z = world.place.groundAt(...centroid(overlay.ring)) + 0.08;
      T.polygon(overlay.ring, z, overlay.ok ? PALETTE.preserve : PALETTE.ghostBad, 0.3);
      L.ring(overlay.ring, z + 0.01, overlay.ok ? PALETTE.preserve : PALETTE.ghostBad, 1);
      if (overlay.alternative) L.ring(overlay.alternative, z + 0.01, PALETTE.preserve, 0.9);
    }
    for (const corr of overlay.corridors || []) {
      const z = corr.zBase ?? 0;
      T.polygon(corr.ring, z + 0.05, [0.95, 0.9, 0.6], 0.16);
      L.ring(corr.ring, z + 0.06, [0.95, 0.9, 0.6], 0.6);
    }
    for (const tr of overlay.trace || []) {
      for (let i = 0; i < tr.length - 1; i++) {
        const a = tr[i], b = tr[i + 1];
        L.segment([a[0], a[1], world.place.groundAt(a[0], a[1]) + 0.4], [b[0], b[1], world.place.groundAt(b[0], b[1]) + 0.4], PALETTE.highlight, 1);
      }
    }
    if (overlay.stroke) {
      const s = overlay.stroke;
      const h = overlay.strokeHeights || null;
      const surf = this.surface;
      const zAt = (p, i) => h && h[i] != null ? h[i] : surf ? surfaceHeight(surf, p[0], p[1]) : world.place.groundAt(p[0], p[1]);
      if (overlay.strokeClosed && s.length > 2 && surf) {
        T.draped(
          s,
          (x, y) => surfaceHeight(surf, x, y),
          0.18,
          PALETTE.select,
          0.16,
          surf.span,
          [surf.ox, surf.oy]
        );
      } else if (overlay.strokeClosed && s.length > 2) {
        T.polygon(s, world.place.groundAt(...centroid(s)) + 0.18, PALETTE.select, 0.16);
      }
      const last = overlay.strokeClosed && s.length > 2 ? s.length : s.length - 1;
      for (let i = 0; i < last; i++) {
        const a = s[i], b = s[(i + 1) % s.length];
        const steps = Math.max(1, Math.min(24, Math.round(dist(a, b) / 3)));
        for (let k = 0; k < steps; k++) {
          const t0 = k / steps, t1 = (k + 1) / steps;
          const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
          const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
          const z0 = steps === 1 ? zAt(a, i) : surf ? surfaceHeight(surf, p0[0], p0[1]) : world.place.groundAt(p0[0], p0[1]);
          const z1 = steps === 1 ? zAt(b, (i + 1) % s.length) : surf ? surfaceHeight(surf, p1[0], p1[1]) : world.place.groundAt(p1[0], p1[1]);
          L.segment([p0[0], p0[1], z0 + 0.22], [p1[0], p1[1], z1 + 0.22], PALETTE.select, 1);
        }
      }
    }
  }
  /** Motion is not change: a moving body redraws without rebuilding the world. */
  setDynamic(fn) {
    const B = new Builder();
    if (fn) fn(B);
    this.dyn.upload(B);
  }
  /** Sediment is not a deed either: the ruts upload on their own throttle. */
  setTrace(fn) {
    const B = new Builder();
    if (fn) fn(B);
    this.traceMesh.upload(B);
  }
  /** The height of the ground AS DRAWN — what anything lying on it must agree with. */
  drawnGroundAt(x, y) {
    return this.surface ? surfaceHeight(this.surface, x, y) : null;
  }
  /**
   * Has the camera driven out of the ground window this mesh was built for?
   * The old failure: you could drive off the edge of the BUILT ground into
   * blank sky, because nothing while driving ever re-windowed the terrain.
   * Now the driving frame asks this on a slow clock and rebuilds when true —
   * which is affordable precisely because the ground has its own buffers.
   */
  groundStale(cam) {
    if (!this._groundTerrain || !cam) return false;
    const reach = Math.max(600, (cam.dist || 800) * 3.2);
    const q = [
      Math.round((cam.target?.[0] ?? 0) / 240),
      Math.round((cam.target?.[1] ?? 0) / 240),
      Math.round(reach / 480)
    ].join("|");
    return q !== this._groundQ;
  }
  /** THE RISE — a new place's entities slide up out of the ground (1.4 s). */
  beginRise() {
    this.riseAt = performance.now();
  }
  rising() {
    return this.riseAt && performance.now() - this.riseAt < 1400;
  }
  _lift() {
    if (!this.riseAt) return 0;
    const k = Math.min(1, (performance.now() - this.riseAt) / 1400);
    const ease = 1 - Math.pow(1 - k, 3);
    return -46 * (1 - ease);
  }
  draw(viewProj2, sun = [0.4, -0.6, 0.9]) {
    const gl = this.gl;
    const [w, h] = this.resize();
    gl.clearColor(PALETTE.sky[0], PALETTE.sky[1], PALETTE.sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, "uViewProj"), false, viewProj2);
    gl.uniform3fv(gl.getUniformLocation(this.prog, "uSun"), sun);
    const far = Math.max(1200, this.cam?.dist ? this.cam.dist * 4.5 : 3e3);
    gl.uniform1f(gl.getUniformLocation(this.prog, "uFogFar"), far);
    gl.uniform4f(
      gl.getUniformLocation(this.prog, "uFog"),
      PALETTE.sky[0],
      PALETTE.sky[1],
      PALETTE.sky[2],
      0.55
    );
    const lift = this._lift();
    const uLift = gl.getUniformLocation(this.prog, "uLift");
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1f(uLift, 0);
    this.ground.draw(gl);
    gl.uniform1f(uLift, lift);
    this.solid.draw(gl);
    gl.uniform1f(uLift, 0);
    this.dyn.draw(gl);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(uLift, lift);
    this.trans.draw(gl);
    gl.uniform1f(uLift, 0);
    this.traceMesh.draw(gl);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(this.lineProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProg, "uViewProj"), false, viewProj2);
    const uLift2 = gl.getUniformLocation(this.lineProg, "uLift");
    gl.uniform1f(uLift2, 0);
    this.groundLines.draw(gl);
    gl.uniform1f(uLift2, lift);
    this.lines.draw(gl);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
};
function visibleAt(e, detail) {
  if (detail === 0) return true;
  if (detail === 1) return !["opening", "furniture"].includes(e.type);
  if (detail === 2) return !["opening", "furniture", "bench", "light", "room"].includes(e.type);
  return ["structure", "road", "water", "stream", "parcel", "observation", "drain"].includes(e.type);
}
var isFlat = (e) => ["path", "road", "surface", "parcel", "observation", "drain", "water", "stream"].includes(e.type) || e.zTop - e.zBase < 0.12;
var CSS_COLOURS = {
  white: [0.92, 0.91, 0.88],
  grey: [0.55, 0.55, 0.54],
  gray: [0.55, 0.55, 0.54],
  black: [0.16, 0.16, 0.17],
  red: [0.55, 0.24, 0.2],
  brown: [0.42, 0.3, 0.22],
  beige: [0.78, 0.71, 0.58],
  cream: [0.86, 0.82, 0.7],
  yellow: [0.8, 0.7, 0.36],
  orange: [0.72, 0.46, 0.24],
  green: [0.34, 0.45, 0.3],
  blue: [0.32, 0.42, 0.55],
  pink: [0.78, 0.62, 0.6],
  sandstone: [0.74, 0.66, 0.5],
  terracotta: [0.62, 0.35, 0.25]
};
var MATERIAL_COLOURS = {
  brick: [0.52, 0.34, 0.29],
  concrete: [0.62, 0.61, 0.59],
  glass: [0.42, 0.55, 0.6],
  stone: [0.63, 0.6, 0.55],
  wood: [0.48, 0.36, 0.25],
  timber: [0.48, 0.36, 0.25],
  "iron sheet": [0.55, 0.42, 0.36],
  metal: [0.55, 0.56, 0.58],
  plaster: [0.78, 0.74, 0.66],
  cement_block: [0.66, 0.64, 0.6],
  mud: [0.48, 0.38, 0.28],
  thatch: [0.6, 0.5, 0.32],
  tile: [0.55, 0.32, 0.26],
  roof_tiles: [0.55, 0.32, 0.26],
  slate: [0.32, 0.34, 0.38],
  copper: [0.35, 0.55, 0.48],
  zinc: [0.6, 0.62, 0.63],
  tin: [0.58, 0.56, 0.54]
};
var FLAT_ORDER = {
  surface: 0.03,
  parcel: 0.03,
  water: 0.06,
  stream: 0.06,
  drain: 0.06,
  path: 0.09,
  road: 0.11,
  observation: 0.14,
  default: 0.03
};
function surfaceOf(t, fidelity = "high") {
  if (!t) return null;
  const want = { high: 8, medium: 12, low: 24, symbolic: 40 }[fidelity] ?? 12;
  const sub2 = Math.max(1, Math.min(3, Math.round(t.cell / want)));
  const span = t.cell / sub2;
  return {
    t,
    span,
    sub: sub2,
    ox: t.bounds[0],
    oy: t.bounds[1],
    nx: (t.nx - 1) * sub2,
    ny: (t.ny - 1) * sub2,
    at: (i, j) => t.heightAt(t.bounds[0] + i * span, t.bounds[1] + j * span)
  };
}
function surfaceHeight(surf, x, y) {
  if (!surf) return 0;
  const fx = (x - surf.ox) / surf.span, fy = (y - surf.oy) / surf.span;
  const i = Math.floor(fx), j = Math.floor(fy);
  const u = fx - i, v = fy - j;
  const h00 = surf.at(i, j), h10 = surf.at(i + 1, j);
  const h11 = surf.at(i + 1, j + 1), h01 = surf.at(i, j + 1);
  return v <= u ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
}
function parseColour(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (CSS_COLOURS[s]) return CSS_COLOURS[s];
  const hex = /^#?([0-9a-f]{6})$/.exec(s);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  return null;
}
function vary(base, seed, amount = 0.09) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) % 1e3 / 1e3 - 0.5;
  const g = (h >>> 7 >>> 0) % 1e3 / 1e3 - 0.5;
  const b = (h >>> 13 >>> 0) % 1e3 / 1e3 - 0.5;
  return [
    Math.max(0.05, Math.min(1, base[0] + r * amount)),
    Math.max(0.05, Math.min(1, base[1] + g * amount)),
    Math.max(0.05, Math.min(1, base[2] + b * amount))
  ];
}
var WATER_COLOURS = {
  ocean: [0.11, 0.3, 0.5],
  bay: [0.12, 0.32, 0.52],
  lake: [0.14, 0.36, 0.56],
  reservoir: [0.13, 0.34, 0.54],
  pond: [0.17, 0.4, 0.58],
  river: [0.16, 0.4, 0.6],
  canal: [0.18, 0.42, 0.58],
  stream: [0.22, 0.48, 0.64],
  channel: [0.2, 0.45, 0.62],
  drain: [0.25, 0.36, 0.44],
  ditch: [0.26, 0.38, 0.44],
  wetland: [0.28, 0.44, 0.44],
  coastline: [0.14, 0.36, 0.56]
};
function colorFor(e) {
  if (e.epistemic === "DISPUTED") return PALETTE.disputed;
  if (e.type === "water" || e.type === "stream") {
    return WATER_COLOURS[e.subtype] || PALETTE.water;
  }
  if (e.type === "structure") {
    const stated = parseColour(e.props?.colour);
    if (stated) return stated;
    const mat = MATERIAL_COLOURS[String(e.material || "").toLowerCase()];
    if (mat) return vary(mat, e.id, 0.07);
    return vary(PALETTE.structure, e.id, 0.13);
  }
  if (e.type === "marker") return [0.85, 0.72, 0.42];
  if (e.type === "rail") return [0.36, 0.35, 0.34];
  if (e.type === "structure" && e.material === "iron sheet") return PALETTE.iron;
  if (e.subtype === "garden") return [0.33, 0.48, 0.28];
  if (e.subtype === "swale") return [0.3, 0.45, 0.4];
  if (e.subtype === "desire-line") return [0.55, 0.48, 0.3];
  if (e.material === "glass") return [0.55, 0.75, 0.78];
  return PALETTE[TYPE_COLOR[e.type]] || [0.5, 0.5, 0.5];
}
function roofColorFor(e) {
  if (e.type !== "structure") return colorFor(e);
  const stated = parseColour(e.props?.roof?.colour);
  if (stated) return stated;
  const mat = MATERIAL_COLOURS[String(e.props?.roof?.material || "").toLowerCase()];
  if (mat) return vary(mat, `${e.id}r`, 0.06);
  const wall = colorFor(e);
  return [wall[0] * 0.78, wall[1] * 0.76, wall[2] * 0.74];
}
function roofHeightFor(e, ring3) {
  const stated = e.props?.roof?.height;
  if (Number.isFinite(stated) && stated > 0) return stated;
  const ob = orientedBounds(ring3);
  return Math.max(1.2, Math.min(4.5, Math.min(ob.width, ob.depth) * 0.28));
}
function terrainColor(h, t, water, x, y) {
  if (t.__lo === void 0) {
    const sorted = Float32Array.from(t.data).sort();
    t.__lo = sorted[Math.floor(sorted.length * 0.05)];
    t.__hi = sorted[Math.floor(sorted.length * 0.95)];
    if (t.__hi - t.__lo < 1) {
      t.__lo -= 0.5;
      t.__hi += 0.5;
    }
  }
  const f2 = Math.max(0, Math.min(1, (h - t.__lo) / (t.__hi - t.__lo)));
  const base = [
    PALETTE.ground[0] + (PALETTE.groundHigh[0] - PALETTE.ground[0]) * f2,
    PALETTE.ground[1] + (PALETTE.groundHigh[1] - PALETTE.ground[1]) * f2,
    PALETTE.ground[2] + (PALETTE.groundHigh[2] - PALETTE.ground[2]) * f2
  ];
  return base;
}
var Builder = class {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.count = 0;
  }
  /** The cache's three verbs: remember where an entity began, take its slice, put a slice back. */
  mark() {
    return [this.pos.length, this.col.length, this.count];
  }
  since(m) {
    return { pos: this.pos.slice(m[0]), nrm: this.nrm.slice(m[0]), col: this.col.slice(m[1]), count: this.count - m[2] };
  }
  append(seg) {
    for (let i = 0; i < seg.pos.length; i++) this.pos.push(seg.pos[i]);
    for (let i = 0; i < seg.nrm.length; i++) this.nrm.push(seg.nrm[i]);
    for (let i = 0; i < seg.col.length; i++) this.col.push(seg.col[i]);
    this.count += seg.count;
  }
  vert(p, n, c, a) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2], a);
    this.count++;
  }
  /** nb and nc are optional: give all three and the triangle shades smoothly. */
  tri(a, b, c, n, col, alpha, nb = null, nc = null) {
    this.vert(a, n, col, alpha);
    this.vert(b, nb || n, col, alpha);
    this.vert(c, nc || n, col, alpha);
  }
  quad(a, b, c, d, col, alpha) {
    const n = normalOf(a, b, c);
    this.tri(a, b, c, n, col, alpha);
    this.tri(a, c, d, n, col, alpha);
  }
  /**
   * A polygon that follows the ground rather than hovering at one height.
   * The ring is cut into terrain-sized pieces first, so the surface bends with
   * the hill instead of spanning it: a road across a slope was being drawn at
   * the height of its first vertex, which on a steep place put it a hundred
   * metres inside the hillside.
   */
  draped(ring3, groundAt, offset, col, alpha = 1, cell = 12, grid = null) {
    for (const piece of tileRing(ring3, cell, grid)) {
      const idx = triangulate(piece);
      for (let i = 0; i < idx.length; i += 3) {
        const p = [piece[idx[i]], piece[idx[i + 1]], piece[idx[i + 2]]];
        const v = p.map((q) => [q[0], q[1], groundAt(q[0], q[1]) + offset]);
        this.tri(v[0], v[1], v[2], normalOf(v[0], v[1], v[2]), col, alpha);
      }
    }
  }
  polygon(ring3, z, col, alpha) {
    const idx = triangulate(ring3);
    for (let i = 0; i < idx.length; i += 3) {
      const a = [ring3[idx[i]][0], ring3[idx[i]][1], z];
      const b = [ring3[idx[i + 1]][0], ring3[idx[i + 1]][1], z];
      const c = [ring3[idx[i + 2]][0], ring3[idx[i + 2]][1], z];
      this.tri(a, b, c, [0, 0, 1], col, alpha);
    }
  }
  prism(ring3, zBase, zTop, sideCol, topCol, alpha = 1, withTop = true) {
    const ccw = ensureCCW(ring3);
    const n = ccw.length;
    for (let i = 0; i < n; i++) {
      const a = ccw[i], b = ccw[(i + 1) % n];
      const e = norm(sub(b, a));
      const nrm = [e[1], -e[0], 0];
      this.quad([a[0], a[1], zBase], [b[0], b[1], zBase], [b[0], b[1], zTop], [a[0], a[1], zTop], sideCol, alpha);
      void nrm;
    }
    if (withTop) this.polygon(ccw, zTop, topCol, alpha);
  }
  /**
   * A roof with a shape, from the tags OSM actually carries. Gabled and hipped
   * roofs are built against the footprint's own long axis, so a building at
   * 31° to north gets a ridge at 31°, not one aligned to the world.
   */
  roof(ring3, zEaves, zApex, shape, col) {
    const ccw = ensureCCW(ring3);
    const ob = orientedBounds(ccw);
    const dir = [Math.cos(ob.angle), Math.sin(ob.angle)];
    const long = ob.width >= ob.depth;
    const axis = long ? dir : perp(dir);
    const halfLen = (long ? ob.width : ob.depth) / 2;
    if (shape === "pyramidal" || shape === "dome" || shape === "onion" || shape === "conical") {
      const apex = [ob.center[0], ob.center[1], zApex];
      for (let i = 0, n = ccw.length; i < n; i++) {
        const a = ccw[i], b = ccw[(i + 1) % n];
        this.tri([a[0], a[1], zEaves], [b[0], b[1], zEaves], apex, normalOf([a[0], a[1], zEaves], [b[0], b[1], zEaves], apex), col, 1);
      }
      return;
    }
    if (shape === "skillion" || shape === "lean_to" || shape === "shed") {
      const across = long ? perp(dir) : dir;
      const proj = ccw.map((p) => dot(sub(p, ob.center), across));
      const lo = Math.min(...proj), hi = Math.max(...proj);
      const zOf = (p) => zEaves + (zApex - zEaves) * ((dot(sub(p, ob.center), across) - lo) / Math.max(1e-6, hi - lo));
      const idx = triangulate(ccw);
      for (let i = 0; i < idx.length; i += 3) {
        const a = ccw[idx[i]], b = ccw[idx[i + 1]], c = ccw[idx[i + 2]];
        const A2 = [a[0], a[1], zOf(a)], B = [b[0], b[1], zOf(b)], C2 = [c[0], c[1], zOf(c)];
        this.tri(A2, B, C2, normalOf(A2, B, C2), col, 1);
      }
      for (let i = 0, n = ccw.length; i < n; i++) {
        const a = ccw[i], b = ccw[(i + 1) % n];
        this.quad([a[0], a[1], zEaves], [b[0], b[1], zEaves], [b[0], b[1], zOf(b)], [a[0], a[1], zOf(a)], col, 1);
      }
      return;
    }
    const inset = shape === "hipped" || shape === "half-hipped" ? Math.min(halfLen * 0.55, (long ? ob.depth : ob.width) / 2) : 0;
    const r0 = [ob.center[0] - axis[0] * (halfLen - inset), ob.center[1] - axis[1] * (halfLen - inset), zApex];
    const r1 = [ob.center[0] + axis[0] * (halfLen - inset), ob.center[1] + axis[1] * (halfLen - inset), zApex];
    const onRidge = (p) => {
      const t = Math.max(0, Math.min(1, dot(sub(p, [r0[0], r0[1]]), axis) / Math.max(1e-6, 2 * (halfLen - inset))));
      return [r0[0] + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t, zApex];
    };
    for (let i = 0, n = ccw.length; i < n; i++) {
      const a = ccw[i], b = ccw[(i + 1) % n];
      const A2 = [a[0], a[1], zEaves], B = [b[0], b[1], zEaves];
      const ra = onRidge(a), rb = onRidge(b);
      if (dist([ra[0], ra[1]], [rb[0], rb[1]]) < 0.05) {
        this.tri(A2, B, ra, normalOf(A2, B, ra), col, 1);
      } else {
        this.quad(A2, B, rb, ra, col, 1);
      }
    }
  }
  cone(c, r, zBase, zTop, col, seg) {
    const apex = [c[0], c[1], zTop];
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const p0 = [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r, zBase];
      const p1 = [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r, zBase];
      this.tri(p0, p1, apex, normalOf(p0, p1, apex), col, 1);
      this.tri(p1, p0, [c[0], c[1], zBase], [0, 0, -1], col, 1);
    }
  }
};
var LineBuilder = class {
  constructor() {
    this.pos = [];
    this.col = [];
    this.count = 0;
  }
  mark() {
    return [this.pos.length, this.col.length, this.count];
  }
  since(m) {
    return { pos: this.pos.slice(m[0]), col: this.col.slice(m[1]), count: this.count - m[2] };
  }
  append(seg) {
    for (let i = 0; i < seg.pos.length; i++) this.pos.push(seg.pos[i]);
    for (let i = 0; i < seg.col.length; i++) this.col.push(seg.col[i]);
    this.count += seg.count;
  }
  segment(a, b, col, alpha) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.col.push(col[0], col[1], col[2], alpha, col[0], col[1], col[2], alpha);
    this.count += 2;
  }
  ring(r, z, col, alpha, groundAt = null, offset = 0) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      const za = groundAt ? groundAt(a[0], a[1]) + offset : z;
      const zb = groundAt ? groundAt(b[0], b[1]) + offset : z;
      this.segment([a[0], a[1], za], [b[0], b[1], zb], col, alpha);
    }
  }
};
function normalOf(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}
function makeMesh(gl) {
  const vao = gl.createVertexArray();
  const pos = gl.createBuffer(), nrm = gl.createBuffer(), col = gl.createBuffer();
  gl.bindVertexArray(vao);
  bindAttr(gl, pos, 0, 3);
  bindAttr(gl, nrm, 1, 3);
  bindAttr(gl, col, 2, 4);
  gl.bindVertexArray(null);
  return {
    vao,
    pos,
    nrm,
    col,
    count: 0,
    upload(b) {
      gl.bindBuffer(gl.ARRAY_BUFFER, pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.pos), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, nrm);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.nrm), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, col);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.col), gl.DYNAMIC_DRAW);
      this.count = b.count;
    },
    draw(g) {
      if (!this.count) return;
      g.bindVertexArray(vao);
      g.drawArrays(g.TRIANGLES, 0, this.count);
      g.bindVertexArray(null);
    }
  };
}
function makeLineMesh(gl) {
  const vao = gl.createVertexArray();
  const pos = gl.createBuffer(), col = gl.createBuffer();
  gl.bindVertexArray(vao);
  bindAttr(gl, pos, 0, 3);
  bindAttr(gl, col, 1, 4);
  gl.bindVertexArray(null);
  return {
    vao,
    count: 0,
    upload(b) {
      gl.bindBuffer(gl.ARRAY_BUFFER, pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.pos), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, col);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.col), gl.DYNAMIC_DRAW);
      this.count = b.count;
    },
    draw(g) {
      if (!this.count) return;
      g.bindVertexArray(vao);
      g.drawArrays(g.LINES, 0, this.count);
      g.bindVertexArray(null);
    }
  };
}
function bindAttr(gl, buf, loc, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}
function link(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
function perspective(fovy, aspect, near, far) {
  const f2 = 1 / Math.tan(fovy / 2);
  return new Float32Array([
    f2 / aspect,
    0,
    0,
    0,
    0,
    f2,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    2 * far * near / (near - far),
    0
  ]);
}
function lookAt(eye2, center, up = [0, 0, 1]) {
  const z = normalize3(sub3(eye2, center));
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot3(x, eye2),
    -dot3(y, eye2),
    -dot3(z, eye2),
    1
  ]);
}
function multiply2(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      out[i * 4 + j] = s;
    }
  }
  return out;
}
var sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var normalize3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function screenRay(x, y, width, height, eye2, target, fovy, aspect) {
  const ndcX = x / width * 2 - 1;
  const ndcY = 1 - y / height * 2;
  const forward = normalize3(sub3(target, eye2));
  const right = normalize3(cross3(forward, [0, 0, 1]));
  const up = cross3(right, forward);
  const th = Math.tan(fovy / 2);
  const dir = normalize3([
    forward[0] + right[0] * ndcX * th * aspect + up[0] * ndcY * th,
    forward[1] + right[1] * ndcX * th * aspect + up[1] * ndcY * th,
    forward[2] + right[2] * ndcX * th * aspect + up[2] * ndcY * th
  ]);
  return { origin: eye2, dir };
}

// src/render/pick.js
function rayToGround(world, ray, maxDist = 4e3) {
  const t = world.place.terrain;
  if (!t) {
    if (Math.abs(ray.dir[2]) < 1e-6) return null;
    const s = -ray.origin[2] / ray.dir[2];
    return s > 0 ? [ray.origin[0] + ray.dir[0] * s, ray.origin[1] + ray.dir[1] * s] : null;
  }
  let prev = 0, prevH = ray.origin[2] - t.heightAt(ray.origin[0], ray.origin[1]);
  const step = 2.5;
  for (let s = step; s < maxDist; s += step) {
    const p = [ray.origin[0] + ray.dir[0] * s, ray.origin[1] + ray.dir[1] * s, ray.origin[2] + ray.dir[2] * s];
    const h = p[2] - t.heightAt(p[0], p[1]);
    if (h <= 0 && prevH > 0) {
      let lo = prev, hi = s;
      for (let k = 0; k < 24; k++) {
        const m2 = (lo + hi) / 2;
        const q = [ray.origin[0] + ray.dir[0] * m2, ray.origin[1] + ray.dir[1] * m2, ray.origin[2] + ray.dir[2] * m2];
        if (q[2] - t.heightAt(q[0], q[1]) > 0) lo = m2;
        else hi = m2;
      }
      const m = (lo + hi) / 2;
      return [ray.origin[0] + ray.dir[0] * m, ray.origin[1] + ray.dir[1] * m];
    }
    prev = s;
    prevH = h;
  }
  return null;
}
function pick(world, ray, { fidelity = "high" } = {}) {
  const ground = rayToGround(world, ray);
  let best = null;
  for (const e of world.entities()) {
    if (e.type === "opening" && fidelity !== "high") continue;
    const ring3 = world.ringOf(e);
    if (!ring3 || ring3.length < 3) continue;
    for (const z of [e.zTop, e.zBase]) {
      if (Math.abs(ray.dir[2]) < 1e-9) continue;
      const s = (z - ray.origin[2]) / ray.dir[2];
      if (s <= 0.1) continue;
      const p = [ray.origin[0] + ray.dir[0] * s, ray.origin[1] + ray.dir[1] * s];
      if (!pointInRing2(p, ring3)) continue;
      if (!best || s < best.distance) best = { entity: e, point: p, distance: s, onRoof: z === e.zTop && e.zTop > e.zBase + 0.5 };
      break;
    }
  }
  if (ground) {
    const gz = world.place.groundAt(ground[0], ground[1]);
    const gs = Math.hypot(ground[0] - ray.origin[0], ground[1] - ray.origin[1], gz - ray.origin[2]);
    if (!best || gs < best.distance) {
      const flat = world.index.atPoint(ground).map((id) => world.get(id)).filter((e) => e && e.zTop - e.zBase < 0.6).sort((a, b) => b.zTop - a.zTop)[0] || null;
      best = { entity: flat, point: ground, distance: gs, onRoof: false };
    }
  }
  return best || { entity: null, point: null, onRoof: false, distance: Infinity };
}

// src/ui/app.js
var $ = (id) => document.getElementById(id);
var canvas = $("world");
var MOBILE = matchMedia("(pointer: coarse)").matches || innerWidth < 760;
var DPR_CAP = MOBILE ? 1.35 : 1.8;
var S2 = {
  world: null,
  placeKey: "settlement",
  author: localStorage.getItem("creo.author") || "",
  gps: null,
  selection: /* @__PURE__ */ new Set(),
  highlight: /* @__PURE__ */ new Set(),
  preserved: /* @__PURE__ */ new Set(),
  pointer: null,
  stroke: null,
  strokeClosed: false,
  mode: "select",
  // select | draw
  plan: null,
  altIndex: -1,
  overlay: null,
  utterances: [],
  cam: { target: [0, 0, 0], dist: 150, yaw: -Math.PI / 2, pitch: 0.72 },
  fidelity: "high",
  dragging: null,
  dirty: true,
  compare: false,
  // NOT `mode`: that is the drawing tool above. These two shared a name and the
  // second quietly won, so pressing D set the assistant's commitment to "draw"
  // and every later read of it threw. One word, two meanings, no error.
  commitment: "auto",
  actingAs: null,
  busy: false,
  abort: false,
  labels: true,
  layersOff: /* @__PURE__ */ new Set(),
  // NOT `plan` — that name already means the current proposal, and clearing a
  // proposal was switching the minimap off.
  showPlan: true
};
var renderer = new Renderer(canvas);
renderer.dprCap = DPR_CAP;
function eye() {
  const { target, dist: dist2, yaw, pitch } = S2.cam;
  return [
    target[0] + Math.cos(yaw) * Math.cos(pitch) * dist2,
    target[1] + Math.sin(yaw) * Math.cos(pitch) * dist2,
    target[2] + Math.sin(pitch) * dist2
  ];
}
var FOV = 0.85;
function viewProj() {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  return multiply2(perspective(FOV, aspect, 0.5, 6e3), lookAt(eye(), S2.cam.target));
}
function rayAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return screenRay(clientX - r.left, clientY - r.top, r.width, r.height, eye(), S2.cam.target, FOV, r.width / r.height);
}
function project(p) {
  const m = viewProj();
  const v = [p[0], p[1], p[2] ?? 0, 1];
  const o = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) o[i] = m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3];
  if (o[3] <= 0.01) return null;
  const r = canvas.getBoundingClientRect();
  return [(o[0] / o[3] * 0.5 + 0.5) * r.width, (1 - (o[1] / o[3] * 0.5 + 0.5)) * r.height];
}
function frameWorld() {
  const b = S2.world.place.bounds();
  S2.cam.target = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, S2.world.place.groundAt((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)];
  S2.cam.dist = Math.max(45, Math.hypot(b[2] - b[0], b[3] - b[1]) * 0.75);
  S2.cam.yaw = -Math.PI / 2.1;
  S2.cam.pitch = 0.66;
  updateFidelity();
}
function updateFidelity() {
  const n = S2.world.index.boxes.size;
  if (RIG.on) {
    const rank = { high: 0, medium: 1, low: 2, symbolic: 3 };
    const floor = n > 25e3 ? "low" : n > 2500 ? "medium" : "high";
    if ((rank[floor] ?? 0) > (rank[S2.fidelity] ?? 0)) {
      S2.fidelity = floor;
      S2.dirty = true;
    }
    return;
  }
  const d = S2.cam.dist;
  const t = S2.world.place.terrain;
  const across = t ? t.bounds[2] - t.bounds[0] : 900;
  const near = Math.max(260, across * 0.06);
  let f2 = "high";
  if (d > near || n > 2500) f2 = "medium";
  if (d > near * 2.7 || n > 8e3) f2 = "low";
  if (d > near * 7) f2 = "symbolic";
  if (f2 !== S2.fidelity) {
    S2.fidelity = f2;
    S2.dirty = true;
  }
}
function rebuild() {
  if (!S2.world) return;
  if (rebuild._world !== S2.world) {
    rebuild._world = S2.world;
    renderer.beginRise();
    renderer.setTrace(null);
    RIG._drawnGround = (x, y) => renderer.drawnGroundAt(x, y);
    ATLAS.bind(S2.world);
  }
  const changed = new Set(S2.world.journal.changedSince(Math.max(0, S2.world.place.tick - 2)));
  const ghosts = ATLAS.ghosts.length ? [...currentGhosts(), ...ATLAS.ghosts] : currentGhosts();
  renderer.build(S2.world, {
    ghosts,
    selection: S2.selection,
    highlight: S2.highlight,
    preserved: S2.preserved,
    changed,
    fidelity: S2.fidelity,
    hidden: hiddenTypes(S2.layersOff),
    contours: !S2.layersOff.has("contours"),
    // how much ground one pixel covers, so a three-metre creek can be drawn
    // wide enough to exist on screen
    metresPerPixel: 2 * S2.cam.dist * Math.tan(0.55 / 2) / Math.max(1, canvas.clientHeight),
    camera: S2.cam,
    // downtown-sized places draw a window of attention, not the whole city
    around: S2.world.index.boxes.size > 8e3 ? {
      center: RIG.on ? [RIG.p[0], RIG.p[1]] : [S2.cam.target[0], S2.cam.target[1]],
      r: RIG.on ? 480 : Math.max(650, S2.cam.dist * 1.6),
      farR: RIG.on ? 1900 : Math.max(2400, S2.cam.dist * 4)
    } : null,
    // Close in on a building and its roof comes off, so the rooms inside are
    // the thing you are working with.
    cutawayAt: S2.cam.dist < 45 ? [S2.cam.target[0], S2.cam.target[1]] : null,
    overlay: {
      ...S2.overlay || {},
      kind: S2.overlay?.kind,
      stroke: S2.stroke,
      strokeHeights: S2.strokeHeights,
      strokeClosed: S2.strokeClosed,
      corridors: S2.plan?.corridors || [],
      trace: S2.overlay?.trace || []
    }
  });
  S2.dirty = false;
}
function currentGhosts() {
  if (!S2.plan) return [];
  const src = S2.altIndex >= 0 ? S2.plan.alternatives[S2.altIndex] : S2.plan;
  const cert = src.certificate;
  const bad = new Set((cert?.findings || []).filter((f2) => f2.severity === "error").map((f2) => f2.entity));
  return (src.ghosts || []).map((g) => ({ ...g, __invalid: bad.has(g.id) }));
}
var minimap = null;
var frameErrors = 0;
var planDirty = true;
var lastInputAt = 0;
var stats = { drawn: 0, skipped: 0, labels: 0 };
function remember(key2, value) {
  try {
    localStorage.setItem(key2, value);
    return true;
  } catch (err) {
    console.warn(`[CREO] could not remember ${key2}: ${err.name}`);
    return false;
  }
}
function invalidate({ plan: plan2 = false } = {}) {
  S2.dirty = true;
  if (plan2) planDirty = true;
}
var animating = () => Date.now() - lastInputAt < 220;
function frame() {
  try {
    if (!S2.world) {
      requestAnimationFrame(frame);
      return;
    }
    if (RIG.on) {
      RIG.tick(S2.world, S2.cam);
      ATLAS.tick(RIG, S2.world, renderer);
      RIG.draw(renderer);
      if (S2.dirty) rebuild();
      renderer.draw(viewProj());
      if (Date.now() - (frame._mapAt || 0) > 500) {
        frame._mapAt = Date.now();
        if (renderer.groundStale(S2.cam)) S2.dirty = true;
        updateFidelity();
        const tb = S2.world.place.meta?.detailBounds || S2.world.place.terrain?.bounds;
        if (tb && Date.now() - _edgeAt > 3e3) {
          const di = RIG.p[0] <= tb[0] + 6 ? -1 : RIG.p[0] >= tb[2] - 6 ? 1 : 0;
          const dj = RIG.p[1] <= tb[1] + 6 ? -1 : RIG.p[1] >= tb[3] - 6 ? 1 : 0;
          if (di || dj) {
            _edgeAt = Date.now();
            crossEdge([di, dj]);
          }
        }
        if (minimap && S2.showPlan) {
          try {
            minimap.draw(S2.world, { camera: S2.cam, selection: S2.selection, hidden: hiddenTypes(S2.layersOff) });
          } catch (_) {
          }
        }
      }
      if (Date.now() - (frame._labelsAt || 0) > 1200) {
        frame._labelsAt = Date.now();
        try {
          labelPlan = gatherLabels();
        } catch (_) {
        }
      }
      try {
        placeLabels(labelPlan);
      } catch (_) {
      }
      requestAnimationFrame(frame);
      return;
    }
    if (!S2.dirty && !animating() && !renderer.rising()) {
      stats.skipped++;
      requestAnimationFrame(frame);
      return;
    }
    if (S2.dirty) rebuild();
    renderer.draw(viewProj());
    drawLabels();
    stats.drawn++;
    if (Date.now() - (frame._gsAt || 0) > 600) {
      frame._gsAt = Date.now();
      if (S2.world.index.boxes.size > 8e3 && renderer.groundStale(S2.cam)) S2.dirty = true;
    }
    if (minimap && S2.showPlan && planDirty) {
      minimap.draw(S2.world, { camera: S2.cam, selection: S2.selection, hidden: hiddenTypes(S2.layersOff) });
      planDirty = false;
    }
  } catch (err) {
    if (frameErrors++ < 3) {
      console.error("frame failed:", err);
      toast(`Something went wrong drawing this: ${String(err.message).slice(0, 80)}`);
    }
    if (frameErrors === 4) console.error("further frame errors suppressed");
  }
  requestAnimationFrame(frame);
}
var LABEL_JUNK = /^(bench(es)?|waste ?basket|waste ?bin|recycling|post ?box|mail ?box|bicycle parking|bike rack|toilets?|drinking water|water fountain|vending machine|atm|bollard|bin|charging station|parcel locker|fire hydrant|street ?lamp|manhole|telephone|payphone|grit bin|ground|terrain|building|house|hut|shed|roof|wall|structure|surface|area|region|yes|no|entrance|door|window|path|track|footway|service|driveway|parking|parking space|garden|grass|tree|water|stream|drain|room|floor|unnamed|untitled)$/i;
var labelPlan = [];
function drawLabels(gather = true) {
  if (gather) labelPlan = gatherLabels();
  placeLabels(labelPlan);
}
function gatherLabels() {
  const wanted = [];
  const w = S2.world;
  if (S2.fidelity !== "symbolic" && (RIG.on || w.index.boxes.size > 1500)) {
    if (S2.labels !== false) {
      const center = RIG.on ? [RIG.p[0], RIG.p[1]] : [S2.cam.target[0], S2.cam.target[1]];
      const radius = RIG.on ? 250 : Math.min(650, S2.cam.dist * 1.2);
      let hits = [];
      try {
        hits = w.nearby(center, radius);
      } catch (_) {
      }
      hits.sort((a, b) => a.d - b.d);
      const CAP = RIG.on ? 8 : 12;
      const quiet = RIG.on;
      const seenStreet = /* @__PURE__ */ new Set();
      for (const { entity: e } of hits) {
        if (wanted.length >= CAP) break;
        if (!e || !e.name) continue;
        if (quiet && e.type === "marker") continue;
        if (e.props?.part || e.props?.house || e.props?.built) continue;
        if (e.type === "observation") {
          wanted.push({ id: e.id, text: e.evidence?.[0]?.text || e.name, at: [...centroid(w.ringOf(e)), e.zTop + 3.6], cls: "obs" });
        } else if (e.type === "marker") {
          if (LABEL_JUNK.test(e.name)) continue;
          const c = centroid(w.ringOf(e));
          wanted.push({ id: `poi_${e.id}`, text: e.name, at: [c[0], c[1], e.zTop + 0.8], cls: "poi" });
        } else if ((e.type === "structure" || e.type === "surface") && !e.props?.built) {
          const r2 = w.ringOf(e);
          if (!r2) continue;
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          for (const p of r2) {
            if (p[0] < x0) x0 = p[0];
            if (p[0] > x1) x1 = p[0];
            if (p[1] < y0) y0 = p[1];
            if (p[1] > y1) y1 = p[1];
          }
          const minArea = quiet ? 9e3 : 2600, minTall = quiet ? 60 : 35;
          if ((x1 - x0) * (y1 - y0) < minArea && e.zTop - e.zBase < minTall) continue;
          if (LABEL_JUNK.test(e.name)) continue;
          wanted.push({ id: `lm_${e.id}`, text: e.name, at: [(x0 + x1) / 2, (y0 + y1) / 2, e.zTop + 2], cls: "poi" });
        } else if ((e.type === "road" || e.type === "path") && !seenStreet.has(e.name)) {
          seenStreet.add(e.name);
          const line2 = e.path;
          const mid = line2 && line2.length > 1 ? line2[Math.floor(line2.length / 2)] : centroid(w.ringOf(e) || [[0, 0]]);
          wanted.push({ id: `st_${e.id}`, text: e.name, at: [mid[0], mid[1], w.place.groundAt(mid[0], mid[1]) + 0.6], cls: "street" });
        }
      }
    }
  } else if (S2.fidelity !== "symbolic") {
    for (const e of w.entities()) {
      if (e.type === "observation") wanted.push({ id: e.id, text: e.evidence?.[0]?.text || e.name, at: [...centroid(w.ringOf(e)), e.zTop + 3.6], cls: "obs" });
    }
    if (S2.labels !== false && S2.cam.dist < 700) {
      const streets = /* @__PURE__ */ new Map();
      for (const e of w.entities()) {
        if (!["road", "path", "rail", "stream"].includes(e.type)) continue;
        if (!e.name) continue;
        const line2 = e.path;
        if (!line2 || line2.length < 2) continue;
        const len2 = perimeter(line2, false);
        if (len2 < S2.cam.dist * 0.12) continue;
        const best = streets.get(e.name);
        if (!best || len2 > best.len) {
          const mid = line2.length > 2 ? line2[Math.floor(line2.length / 2)] : lerp2(line2[0], line2[1], 0.5);
          streets.set(e.name, { len: len2, mid, id: e.id });
        }
      }
      for (const [name, st] of streets) {
        wanted.push({ id: `st_${st.id}`, text: name, at: [st.mid[0], st.mid[1], w.place.groundAt(st.mid[0], st.mid[1]) + 0.6], cls: "street" });
      }
    }
    if (S2.labels !== false && S2.cam.dist < 260) {
      const hiddenNow = hiddenTypes(S2.layersOff);
      for (const e of w.entities()) {
        if (e.type !== "marker" || hiddenNow.has("marker")) continue;
        const c = centroid(w.ringOf(e));
        wanted.push({ id: `poi_${e.id}`, text: e.name, at: [c[0], c[1], e.zTop + 0.8], cls: "poi" });
      }
    }
  }
  for (const id of S2.selection) {
    const e = w.get(id);
    if (!e) continue;
    const ring3 = w.ringOf(e);
    if (!ring3) continue;
    wanted.push({ id: `sel_${id}`, text: labelFor(e), at: [...centroid(ring3), e.zTop + 1.2], cls: "sel" });
  }
  return wanted;
}
function placeLabels(wanted) {
  const host = $("labels");
  const placed = [];
  const blocked = [
    { x0: 0, y0: 0, x1: 260, y1: 108 },
    // place chip + licence
    { x0: innerWidth - 220, y0: 0, x1: innerWidth, y1: 260 },
    // name, undo, view tools
    { x0: innerWidth - 230, y0: innerHeight - 260, x1: innerWidth, y1: innerHeight },
    // the plan
    { x0: 0, y0: innerHeight - 110, x1: innerWidth, y1: innerHeight }
    // the say bar
  ];
  const inChrome = (x, y) => blocked.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1);
  const rank = { sel: 0, obs: 1, sticker: 2, poi: 3, street: 4 };
  wanted.sort((a, b) => (rank[a.cls] ?? 9) - (rank[b.cls] ?? 9));
  const limit = MOBILE ? 26 : 70;
  let used = 0;
  for (const l of wanted) {
    if (used >= limit) break;
    const p = project(l.at);
    if (!p || p[0] < -100 || p[0] > innerWidth + 100 || p[1] < 0 || p[1] > innerHeight) continue;
    if (inChrome(p[0], p[1])) continue;
    let y = p[1];
    for (let guard = 0; guard < 12; guard++) {
      const clash = placed.find((q) => Math.abs(q[0] - p[0]) < 150 && Math.abs(q[1] - y) < 22);
      if (!clash) break;
      y -= 24;
    }
    placed.push([p[0], y]);
    let d = host.children[used];
    if (!d) {
      d = document.createElement("div");
      host.append(d);
    }
    const cls = `label ${l.cls}`;
    if (d.className !== cls) d.className = cls;
    if (d.textContent !== l.text) d.textContent = l.text;
    d.style.transform = `translate(-50%,-100%) translate(${p[0]}px,${y}px)`;
    d.hidden = false;
    used++;
  }
  for (let i = used; i < host.children.length; i++) host.children[i].hidden = true;
  stats.labels = used;
}
function heightOf(e) {
  const ring3 = S2.world.ringOf(e);
  const span = ring3 && ring3.length >= 3 ? groundSpan(ring3, (x, y) => S2.world.place.groundAt(x, y)) : null;
  const extent = e.zTop - e.zBase;
  if (!span) return { height: extent, fall: 0 };
  const fall = Math.max(0, span.hi - span.lo);
  return { height: Math.max(0, e.zTop - span.hi), fall, extent };
}
function labelFor(e) {
  const ring3 = S2.world.ringOf(e);
  const bits = [e.name || (e.use ? `${e.use}` : e.type)];
  if (ring3) {
    const ob = orientedBounds(ring3);
    bits.push(`${ob.width.toFixed(1)}\xD7${ob.depth.toFixed(1)} m`);
  }
  const { height, fall } = heightOf(e);
  if (height > 0.2) bits.push(`${height.toFixed(1)} m high`);
  if (fall > 0.5) bits.push(`on ground falling ${fall.toFixed(1)} m`);
  return bits.join(" \xB7 ");
}
var pointers = /* @__PURE__ */ new Map();
var gesture = null;
canvas.addEventListener("pointerdown", (ev) => {
  lastInputAt = Date.now();
  canvas.setPointerCapture(ev.pointerId);
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t: Date.now() });
  if (pointers.size === 1) {
    if (S2.mode === "draw") {
      if (!drawable(ev.clientX, ev.clientY)) return;
      const d = drawPoint(ev.clientX, ev.clientY);
      if (d) {
        S2.stroke = [d.p];
        S2.strokeHeights = [d.z];
        S2.strokeClosed = false;
        gesture = "draw";
        S2.dirty = true;
      }
      return;
    }
    const hit = pick(S2.world, rayAt(ev.clientX, ev.clientY), { fidelity: S2.fidelity });
    if (hit.entity && S2.selection.has(hit.entity.id)) {
      gesture = "move";
      S2.dragging = { id: hit.entity.id, from: hit.point, ring0: S2.world.ringOf(hit.entity), path0: hit.entity.path };
      return;
    }
    if (ev.button === 2 || ev.shiftKey || ev.ctrlKey || ev.altKey) gesture = "orbit";
    else {
      const grab = rayToGround(S2.world, rayAt(ev.clientX, ev.clientY));
      gesture = grab ? { kind: "pan", grab } : "orbit";
    }
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = {
      kind: "pinch",
      d0: Math.hypot(a.x - b.x, a.y - b.y),
      dist0: S2.cam.dist,
      mid: [(a.x + b.x) / 2, (a.y + b.y) / 2],
      angle0: Math.atan2(b.y - a.y, b.x - a.x),
      yaw0: S2.cam.yaw
    };
  }
});
canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
canvas.addEventListener("pointermove", (ev) => {
  const pt = pointers.get(ev.pointerId);
  if (!pt) return;
  lastInputAt = Date.now();
  const dx = ev.clientX - pt.x, dy = ev.clientY - pt.y;
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  if (gesture === "draw" && S2.stroke) {
    if (!drawable(ev.clientX, ev.clientY)) return;
    const d = drawPoint(ev.clientX, ev.clientY);
    if (d && dist(d.p, S2.stroke[S2.stroke.length - 1]) > 0.8) {
      S2.stroke.push(d.p);
      (S2.strokeHeights ||= []).push(d.z);
      S2.dirty = true;
    }
    return;
  }
  if (gesture === "move" && S2.dragging) {
    const p = rayToGround(S2.world, rayAt(ev.clientX, ev.clientY));
    if (p) dragTo(p);
    return;
  }
  if (gesture && gesture.kind === "pan" && pointers.size === 1) {
    const now = rayToGround(S2.world, rayAt(ev.clientX, ev.clientY));
    if (now) {
      S2.cam.target[0] += gesture.grab[0] - now[0];
      S2.cam.target[1] += gesture.grab[1] - now[1];
      clampCamera();
    }
    return;
  }
  if (gesture === "orbit" && pointers.size === 1) {
    S2.cam.yaw -= dx * 6e-3;
    S2.cam.pitch = Math.max(0.14, Math.min(1.45, S2.cam.pitch + dy * 5e-3));
    clampCamera();
    return;
  }
  if (gesture && gesture.kind === "pinch" && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    S2.cam.dist = Math.max(12, Math.min(4e3, gesture.dist0 * (gesture.d0 / Math.max(1, d))));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    S2.cam.yaw = gesture.yaw0 - (angle - gesture.angle0);
    const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    panBy(mid[0] - gesture.mid[0], mid[1] - gesture.mid[1]);
    gesture.mid = mid;
    clampCamera();
    updateFidelity();
  }
});
canvas.addEventListener("pointerup", (ev) => {
  const pt = pointers.get(ev.pointerId);
  pointers.delete(ev.pointerId);
  if (!pt) return;
  const moved = Math.hypot(ev.clientX - pt.x0, ev.clientY - pt.y0);
  if (gesture === "draw" && S2.stroke) {
    if (S2.stroke.length > 3 && dist(S2.stroke[0], S2.stroke[S2.stroke.length - 1]) < Math.max(6, perimeter(S2.stroke, false) * 0.22)) {
      const cleaned = cleanRing(S2.stroke, Math.max(0.8, S2.cam.dist * 4e-3));
      if (!cleaned.ring) {
        S2.stroke = null;
        S2.strokeClosed = false;
        S2.dirty = true;
        toast(cleaned.why || "That did not read as an area \u2014 try a rounder loop.");
        setMode("select");
        return;
      }
      S2.stroke = cleaned.ring;
      S2.strokeClosed = true;
      toast(`${area(S2.stroke).toFixed(0)} m\xB2 selected${cleaned.repaired ? ` \u2014 ${cleaned.why}` : ""}. Now say what about it, or press Note here.`);
    } else {
      S2.strokeClosed = false;
      S2.stroke = resample(S2.stroke, Math.max(1, S2.cam.dist * 6e-3));
      toast(`Line: ${perimeter(S2.stroke, false).toFixed(0)} m. Now say what about it.`);
    }
    setMode("select");
    S2.dirty = true;
    showTools();
  } else if (gesture === "move" && S2.dragging) {
    commitDrag();
  } else if (moved < 6 && Date.now() - pt.t < 700 && pointers.size === 0) {
    tap(ev.clientX, ev.clientY, ev.shiftKey);
  }
  if (pointers.size === 0) gesture = null;
});
canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  lastInputAt = Date.now();
  const before = rayToGround(S2.world, rayAt(ev.clientX, ev.clientY));
  S2.cam.dist = Math.max(12, Math.min(4e3, S2.cam.dist * (1 + Math.sign(ev.deltaY) * 0.11)));
  const after = rayToGround(S2.world, rayAt(ev.clientX, ev.clientY));
  if (before && after) {
    S2.cam.target[0] += before[0] - after[0];
    S2.cam.target[1] += before[1] - after[1];
  }
  clampCamera();
  updateFidelity();
}, { passive: false });
function clampCamera() {
  const b = S2.world.place.terrain?.bounds || S2.world.place.bounds();
  const margin = Math.max(80, Math.hypot(b[2] - b[0], b[3] - b[1]) * 0.15);
  S2.cam.target[0] = Math.max(b[0] - margin, Math.min(b[2] + margin, S2.cam.target[0]));
  S2.cam.target[1] = Math.max(b[1] - margin, Math.min(b[3] + margin, S2.cam.target[1]));
  S2.cam.target[2] = S2.world.place.groundAt(S2.cam.target[0], S2.cam.target[1]);
  S2.cam.pitch = Math.max(0.14, Math.min(1.45, S2.cam.pitch));
  planDirty = true;
  updateOrientation();
  clearTimeout(clampCamera._settle);
  clampCamera._settle = setTimeout(reviewFrame, 400);
  const e = eye();
  const floor = S2.world.place.groundAt(e[0], e[1]) + 3;
  if (e[2] < floor) S2.cam.pitch = Math.min(1.45, S2.cam.pitch + (floor - e[2]) / Math.max(20, S2.cam.dist));
  S2.dirty = true;
  lastInputAt = Date.now();
}
function frameAll() {
  frameWorld();
  toast("Showing the whole place.");
}
function panBy(dx, dy) {
  const scale = S2.cam.dist * 22e-4;
  const yaw = S2.cam.yaw;
  S2.cam.target[0] += (Math.sin(yaw) * dx + Math.cos(yaw) * dy) * scale;
  S2.cam.target[1] += (-Math.cos(yaw) * dx + Math.sin(yaw) * dy) * scale;
  clampCamera();
}
function drawPoint(x, y) {
  const hit = pick(S2.world, rayAt(x, y), { fidelity: S2.fidelity });
  if (hit?.point) {
    return { p: [hit.point[0], hit.point[1]], z: hit.entity ? hit.entity.zTop : null };
  }
  const p = rayToGround(S2.world, rayAt(x, y));
  return p ? { p, z: null } : null;
}
function groundScaleAt(x, y) {
  const a = rayToGround(S2.world, rayAt(x, y));
  const b = rayToGround(S2.world, rayAt(x, y - 1));
  if (!a || !b) return Infinity;
  return dist(a, b);
}
var scaleLimit = () => Math.max(0.5, S2.cam.dist / 220);
var refusedAt = 0;
function drawable(x, y) {
  const scale = groundScaleAt(x, y);
  if (scale <= scaleLimit()) return true;
  if (Date.now() - refusedAt > 2500) {
    refusedAt = Date.now();
    toast(`Too oblique to draw up there \u2014 one pixel is ${scale.toFixed(0)} m of ground. Tilt down, or come closer.`);
  }
  return false;
}
function tap(x, y, additive) {
  const hit = pick(S2.world, rayAt(x, y), { fidelity: S2.fidelity });
  S2.pointer = hit.point;
  if (inHand && hit.point) {
    placeInHand(hit.point);
    inHand = null;
    $("dropBtn")?.classList.remove("on");
    return;
  }
  if (hit.entity) {
    if (additive) {
      S2.selection.has(hit.entity.id) ? S2.selection.delete(hit.entity.id) : S2.selection.add(hit.entity.id);
    } else S2.selection = /* @__PURE__ */ new Set([hit.entity.id]);
  } else if (!additive) {
    S2.selection.clear();
  }
  S2.dirty = true;
  showTools();
}
function dragTo(p) {
  const d = S2.dragging;
  const delta = sub(p, d.from);
  const e = S2.world.get(d.id);
  if (!e) return;
  const patch = d.path0 ? { path: d.path0.map((q) => add(q, delta)) } : { footprint: snapRing(d.ring0.map((q) => add(q, delta)), d.id) };
  S2.world.place.put({ ...e, ...patch }, S2.world.branch);
  S2.world.dirty = true;
  S2.world.reindex();
  S2.dirty = true;
}
function snapRing(ring3, excludeId) {
  const near = [];
  for (const other of S2.world.entities()) {
    if (other.id === excludeId) continue;
    const r = S2.world.ringOf(other);
    if (!r) continue;
    if (ringDistance(ring3, r) > 4) continue;
    near.push({ id: other.id, ring: r, closed: !other.path });
  }
  if (!near.length) return ring3;
  let bestDelta = null, bestD = Infinity;
  for (const p of ring3) {
    const s = snapPoint(p, near, 1.1);
    if (s && s.d < bestD) {
      bestD = s.d;
      bestDelta = sub(s.point, p);
    }
  }
  return bestDelta ? ring3.map((p) => add(p, bestDelta)) : ring3;
}
function commitDrag() {
  const d = S2.dragging;
  S2.dragging = null;
  if (!d) return;
  const e = S2.world.get(d.id);
  const patch = e.path ? { path: e.path } : { footprint: e.footprint };
  S2.world.place.put({ ...e, ...d.path0 ? { path: d.path0 } : { footprint: d.ring0 } }, S2.world.branch);
  S2.world.updateEntity(d.id, patch, { label: `move ${e.name || e.type}`, author: S2.author || "unsigned" });
  refreshChrome();
  showTools();
}
function context() {
  return makeContext(S2.world, {
    selection: {
      ids: [...S2.selection],
      ring: S2.strokeClosed ? S2.stroke : null,
      stroke: S2.strokeClosed ? null : S2.stroke
    },
    pointer: S2.pointer,
    camera: { eye: eye(), target: S2.cam.target },
    // Only a real position counts as one. Passing the camera target here meant
    // "here" silently resolved to wherever the view happened to be pointing,
    // and put a bench inside somebody's bedroom.
    participant: S2.gps ? { id: S2.author, position: S2.gps } : null,
    utterances: S2.utterances
  });
}
function trySeatBySaying(text) {
  const t = String(text).toLowerCase();
  if (!/\b(put|place|drop|set|site|seat)\b/.test(t)) return false;
  if (!/\b(house|building|model|henry|cabin|shed|barn|home)\b/.test(t)) return false;
  const at = S2.pointer || S2.stroke && centroid(S2.stroke) || [S2.cam.target[0], S2.cam.target[1]];
  if (!inHand) {
    const m = t.match(/(\d+(?:\.\d+)?)\s*(?:m|metre|meter)?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/);
    inHand = boxBody({
      name: /henry/.test(t) ? "Henry House" : "House",
      width: m ? parseFloat(m[1]) : 12,
      depth: m ? parseFloat(m[2]) : 8,
      height: /storey|story|two/.test(t) ? 6 : 3.2
    });
  }
  const level = /\bcut\b|\binto the (hill|slope)\b/.test(t) ? "cut" : /\bfill\b|\bon a plinth\b|\braise\b/.test(t) ? "fill" : "balanced";
  return placeInHand(at, { level });
}
function saySomething(text) {
  if (trySeatBySaying(text)) return;
  if (!text.trim()) return;
  const ctx = context();
  const intent = interpret(text, ctx);
  intent.author = S2.actingAs || S2.author || "unsigned";
  S2.utterances.push({ text, resolved: intent.reference, tick: S2.world.place.tick });
  if (intent.operation === "ASK") {
    const answer = ask(S2.world, intent, {});
    showAnswer(intent, answer);
    return;
  }
  const p = plan(S2.world, intent, ctx);
  S2.plan = p;
  S2.altIndex = -1;
  if (p.simulation) {
    S2.overlay = p.simulation.water ? { kind: "water", water: p.simulation.water } : p.simulation.night ? { kind: "dark", points: [] } : null;
    toast(`${p.title} \u2014 ${p.summary}`);
    S2.plan = null;
    S2.dirty = true;
    return;
  }
  if (p.certificate && !p.certificate.valid && !p.ghosts?.length && !p.branchOps?.length) {
    toast(p.summary || "Not sure what you meant \u2014 tap or draw first.");
    S2.plan = null;
    return;
  }
  if (p.autoCommit) {
    commitPlan(S2.world, p, { author: S2.author || "unsigned" });
    S2.plan = null;
    S2.stroke = null;
    toast(intent.secondary === "ROUTE" ? "Route recorded where people walk." : "Recorded here.");
    refreshChrome();
    S2.dirty = true;
    return;
  }
  showProposal(p);
}
$("sayInput").addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter") return;
  const v = ev.target.value;
  ev.target.value = "";
  if (!v.trim()) return;
  if (!hasKey()) {
    saySomething(v);
    return;
  }
  const once = ev.metaKey ? "gauntlet" : ev.altKey ? "deep" : ev.shiftKey ? "think" : null;
  const previous = S2.commitment;
  if (once) S2.commitment = once;
  runAssistant(v).finally(() => {
    S2.commitment = previous;
  });
});
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var recog = null;
$("micBtn").addEventListener("click", () => {
  if (!SR) {
    toast("No speech here \u2014 type it, or draw it.");
    $("sayInput").focus();
    return;
  }
  if (recog) {
    recog.stop();
    return;
  }
  recog = new SR();
  recog.lang = navigator.language || "en-US";
  recog.interimResults = false;
  recog.onresult = (e) => {
    const t = e.results[0][0].transcript;
    $("sayInput").value = t;
    saySomething(t);
  };
  recog.onend = () => {
    recog = null;
    $("micBtn").classList.remove("on");
  };
  recog.start();
  $("micBtn").classList.add("on");
});
function showWorking(mode, step) {
  $("working").hidden = false;
  $("workingMode").textContent = MODES2[mode]?.label || mode;
  $("workingStep").textContent = step;
}
function stopWorking() {
  $("working").hidden = true;
  S2.busy = false;
}
$("workingStop").onclick = () => {
  S2.abort = true;
  stopWorking();
  toast("Stopped.");
};
async function runAssistant(request) {
  if (!hasKey()) {
    openAIPanel();
    return;
  }
  if (S2.busy) {
    toast("Still working \u2014 press \u25A0 to stop.");
    return;
  }
  const ctx = context();
  const intent = interpret(request, ctx);
  const chosen = S2.commitment === "auto" ? routeMode(intent) : S2.commitment;
  const mode = MODES2[chosen] || MODES2.think;
  if (!MODES2[chosen]) console.warn(`[CREO] unknown commitment ${chosen}; using Think`);
  S2.busy = true;
  S2.abort = false;
  showWorking(chosen, STEP_LABELS.reading);
  try {
    let findings = null;
    if (mode.investigate) {
      const res = await investigate(S2.world, {
        focus: [...S2.selection],
        point: S2.pointer,
        question: request
      }, (kind, visual) => {
        if (S2.abort) return;
        showWorking(chosen, STEP_LABELS[kind] || kind);
        if (visual.highlight) S2.highlight = new Set(visual.highlight);
        if (visual.overlay) S2.overlay = visual.overlay;
        if (visual.trace) S2.overlay = { ...S2.overlay || {}, trace: visual.trace };
        S2.dirty = true;
      });
      if (S2.abort) return;
      findings = summarise(res.findings);
    }
    showWorking(chosen, STEP_LABELS.asking);
    const view = {
      camera: { target: S2.cam.target, dist: S2.cam.dist },
      selection: [...S2.selection],
      pointer: S2.pointer,
      image: mode.vision === "never" ? null : captureView()
    };
    let result = await proposeOperations(
      S2.world,
      request,
      view,
      { effort: mode.effort, vision: mode.vision, findings }
    );
    if (S2.abort) return;
    let verdict = null;
    if (mode.gauntlet && result.operations.length) {
      for (let round2 = 0; round2 < 2 && !S2.abort; round2++) {
        showWorking(chosen, STEP_LABELS.building);
        applyOperations(result.operations, chosen);
        await frameSettled();
        if (S2.abort) return;
        showWorking(chosen, STEP_LABELS.rendering);
        const metrics = S2.plan ? consequenceOf(S2.world, S2.plan).metrics : [];
        const shot = captureView();
        showWorking(chosen, STEP_LABELS.critic);
        verdict = await critique({
          goal: request,
          constraints: (intent.constraints || []).map((c) => c.raw || c.kind),
          metrics,
          image: shot,
          effort: mode.critic.effort
        });
        if (S2.abort) return;
        if (verdict.verdict === "PASS") break;
        if (round2 === 0) {
          showWorking(chosen, STEP_LABELS.revising);
          discardProposal();
          result = await proposeOperations(
            S2.world,
            request,
            view,
            { effort: mode.effort, vision: mode.vision, findings, critique: verdict.largestProblem }
          );
        }
      }
    } else {
      applyOperations(result.operations, chosen);
    }
    stopWorking();
    const said = result.reasoning || "";
    if (!result.operations.length) {
      toast(said || "Nothing here it could act on.");
      return;
    }
    if (verdict) {
      toast(verdict.verdict === "PASS" ? `Reviewed and stands: ${verdict.whatAParticipantWouldSee || said}` : `Still not right \u2014 ${verdict.largestProblem}. Shown anyway; judge for yourself.`);
    } else if (said) toast(said);
  } catch (err) {
    stopWorking();
    reportFailure("Could not answer", err);
  } finally {
    S2.busy = false;
    $("working").hidden = true;
  }
}
function captureView(maxWidth = 1100, quality = 0.72) {
  try {
    rebuild();
    renderer.draw(viewProj());
    const c = document.createElement("canvas");
    const scale = Math.min(1, maxWidth / canvas.width);
    c.width = Math.round(canvas.width * scale);
    c.height = Math.round(canvas.height * scale);
    c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    if (isBlank(c)) {
      console.warn("[CREO] view capture came back empty; sending no image");
      return null;
    }
    return c.toDataURL("image/jpeg", quality);
  } catch (err) {
    console.warn("[CREO] view capture failed:", err);
    return null;
  }
}
function isBlank(c) {
  try {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const step = Math.max(4, Math.floor(d.length / 4 / 500) * 4);
    let first = -1;
    for (let i = 0; i < d.length; i += step) {
      const v = d[i] + d[i + 1] * 256 + d[i + 2] * 65536;
      if (first < 0) first = v;
      else if (v !== first) return false;
    }
    return true;
  } catch {
    return false;
  }
}
var frameSettled = () => new Promise((r) => {
  S2.dirty = true;
  requestAnimationFrame(() => requestAnimationFrame(r));
});
function discardProposal() {
  S2.plan = null;
  S2.altIndex = -1;
  hide("proposal");
  S2.dirty = true;
}
function applyOperations(operations, modeKey) {
  S2.actingAs = `${S2.author || "you"} + assistant`;
  for (const op of operations) {
    switch (op.op) {
      case "look":
        S2.cam.target = [op.at[0], op.at[1], S2.world.place.groundAt(op.at[0], op.at[1])];
        if (op.distance) S2.cam.dist = Math.max(20, Math.min(2e3, op.distance));
        clampCamera();
        updateFidelity();
        break;
      case "point":
        S2.pointer = op.at;
        break;
      case "select":
        S2.selection = new Set(op.ids);
        break;
      case "circle":
        S2.stroke = op.points;
        S2.strokeClosed = true;
        S2.pointer = centroid(op.points);
        break;
      case "line":
        S2.stroke = op.points;
        S2.strokeClosed = false;
        break;
      case "note":
        S2.pointer = op.at;
        saySomething(op.text);
        break;
      case "say":
        saySomething(op.text);
        break;
    }
    S2.dirty = true;
  }
  S2.actingAs = null;
  showTools();
}
function setMode_(key2) {
  if (key2 !== "auto" && !MODES2[key2]) key2 = "auto";
  S2.commitment = key2;
  const chip = $("modeChip");
  chip.textContent = key2 === "auto" ? "\u2726 Auto" : `\u2726 ${MODES2[key2].label}`;
  chip.classList.toggle("set", key2 !== "auto");
}
function openModeMenu() {
  document.querySelector(".modeMenu")?.remove();
  const menu = document.createElement("div");
  menu.className = "menu modeMenu";
  const r = $("modeChip").getBoundingClientRect();
  menu.style.left = `${Math.max(8, r.left)}px`;
  menu.style.bottom = `calc(${innerHeight - r.top + 8}px)`;
  const row = (key2, label3, hint2) => {
    const b = document.createElement("button");
    b.className = S2.commitment === key2 ? "on" : "";
    b.innerHTML = `<span>${label3}</span><span class="mHint">${hint2}</span>`;
    b.onclick = () => {
      menu.remove();
      setMode_(key2);
    };
    menu.append(b);
  };
  row("auto", "Auto", "let CREO judge how much this needs");
  for (const k of MODE_ORDER) row(k, MODES2[k].label, MODES2[k].hint);
  const dev = document.createElement("button");
  dev.className = "mHint";
  dev.style.borderTop = "1px solid var(--edge)";
  dev.style.marginTop = "4px";
  dev.textContent = "The machinery\u2026";
  dev.onclick = () => {
    menu.remove();
    openAIPanel();
  };
  menu.append(dev);
  document.body.append(menu);
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!menu.contains(e.target) && e.target !== $("modeChip")) {
      menu.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
}
var holdTimer = null;
$("modeChip").addEventListener("pointerdown", () => {
  holdTimer = setTimeout(() => {
    holdTimer = null;
    openAIPanel();
  }, 550);
});
$("modeChip").addEventListener("pointerup", () => {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
    openModeMenu();
  }
});
$("modeChip").addEventListener("pointerleave", () => {
  clearTimeout(holdTimer);
  holdTimer = null;
});
function showProposal(p) {
  const src = S2.altIndex >= 0 ? p.alternatives[S2.altIndex] : p;
  $("propTitle").textContent = p.title;
  $("propSummary").textContent = p.summary;
  const cert = src.certificate || { findings: [] };
  $("propCert").replaceChildren(...summarize(cert).map((f2) => {
    const row = document.createElement("div");
    row.className = `finding ${f2.severity}`;
    const code = document.createElement("span");
    code.className = "code";
    code.textContent = f2.code.replace(/_/g, " ");
    const msg = document.createElement("span");
    msg.className = "msg";
    msg.textContent = f2.message;
    row.append(code, msg);
    if (f2.others?.length) {
      const b = document.createElement("button");
      b.textContent = "show";
      b.onclick = () => {
        S2.highlight = new Set(f2.others);
        S2.dirty = true;
      };
      row.append(b);
    }
    return row;
  }));
  $("propImpact").replaceChildren();
  $("propAlts").replaceChildren();
  if (p.alternatives?.length) {
    const mk = (label3, i) => {
      const b = document.createElement("button");
      b.className = `tool${S2.altIndex === i ? " on" : ""}`;
      b.textContent = label3;
      b.onclick = () => {
        S2.altIndex = i;
        S2.dirty = true;
        showProposal(p);
      };
      return b;
    };
    $("propAlts").append(mk("Where it landed", -1), ...p.alternatives.map((a, i) => mk(a.label, i)));
  }
  const btn = $("propCommit");
  btn.disabled = false;
  btn.dataset.armed = "";
  btn.classList.toggle("danger", !cert.valid);
  btn.textContent = p.branchOps?.length ? "Create these futures" : cert.valid ? "Put it in the world" : "Put it in anyway \u2014 it conflicts";
  hide("answer");
  hide("branches");
  hide("tools");
  show("proposal");
  S2.dirty = true;
  if ((src.ghosts?.length || p.removals?.length) && !p.branchOps?.length) {
    setTimeout(() => {
      const c = consequenceOf(S2.world, { ...src, region: p.region, removals: p.removals, patches: p.patches });
      if (S2.plan !== p) return;
      $("propImpact").replaceChildren(...c.metrics.map(metricRow), quantitiesRow(c.quantities));
    }, 16);
  }
}
function metricRow(m) {
  const d = document.createElement("div");
  d.className = "metric";
  const l = document.createElement("span");
  l.className = "label";
  l.textContent = m.label;
  const v = document.createElement("span");
  v.className = "val";
  v.textContent = `${m.before} \u2192 ${m.after}`;
  const delta = document.createElement("span");
  delta.className = `d ${m.good ? "good" : m.bad ? "bad" : ""}`;
  delta.textContent = m.delta > 0.5 ? `+${m.delta.toFixed(0)}` : m.delta < -0.5 ? m.delta.toFixed(0) : "\xB7";
  const b = document.createElement("span");
  b.className = "basis";
  b.textContent = m.basis;
  d.append(l, v, delta, b);
  return d;
}
function quantitiesRow(q) {
  const d = document.createElement("div");
  d.className = "metric";
  const bits = [];
  if (q.earthwork_m3) bits.push(`${q.earthwork_m3} m\xB3 dug`);
  if (q.gravel_m3) bits.push(`${q.gravel_m3} m\xB3 gravel`);
  if (q.plants) bits.push(`${q.plants} plants`);
  if (q.length_m) bits.push(`${q.length_m} m long`);
  if (q.footprint_m2) bits.push(`${q.footprint_m2} m\xB2 footprint`);
  if (q.glazing_m2) bits.push(`${q.glazing_m2} m\xB2 glazing`);
  const l = document.createElement("span");
  l.className = "label";
  l.textContent = "To build it";
  const v = document.createElement("span");
  v.className = "val";
  v.textContent = bits.join(", ") || "\u2014";
  d.append(l, v);
  return d;
}
$("propCommit").onclick = () => {
  const p = S2.plan;
  if (!p) return;
  const btn = $("propCommit");
  const src0 = S2.altIndex >= 0 ? p.alternatives[S2.altIndex] : p;
  if (!src0.certificate?.valid && !btn.dataset.armed) {
    btn.dataset.armed = "1";
    btn.textContent = "Tap again to overrule the place";
    toast("This conflicts with what is already there. Tap again if you mean it.");
    return;
  }
  const src = S2.altIndex >= 0 ? { ...p, ghosts: p.alternatives[S2.altIndex].ghosts } : p;
  const out = commitPlan(S2.world, src, { author: S2.author || "unsigned" });
  S2.plan = null;
  S2.altIndex = -1;
  S2.stroke = null;
  S2.highlight.clear();
  hide("proposal");
  if (out.branches?.length) {
    toast(`${out.branches.length} future${out.branches.length === 1 ? "" : "s"} created. The place as it is is untouched.`);
    showBranches();
  } else {
    toast("In the world. Undo if you want it back.");
    S2.selection = new Set((src.ghosts || []).map((g) => g.id));
  }
  refreshChrome();
  S2.dirty = true;
  showTools();
};
$("propDiscard").onclick = $("propClose").onclick = () => {
  S2.plan = null;
  S2.altIndex = -1;
  S2.highlight.clear();
  hide("proposal");
  S2.dirty = true;
};
function showAnswer(intent, a) {
  $("ansTitle").textContent = intent.question?.kind === "why" ? "Why it is here" : "The place says";
  const body = $("ansBody");
  body.replaceChildren();
  const p = document.createElement("div");
  p.textContent = a.text || "\u2014";
  body.append(p);
  if (a.rows?.length && a.rows[0].who) {
    for (const r of a.rows) {
      const box = document.createElement("div");
      box.className = "why";
      box.textContent = [
        `${r.name}`,
        `made by ${r.who} \xB7 ${r.when} \xB7 ${r.epistemic.toLowerCase()} (certainty ${Math.round((r.certainty ?? 1) * 100)}%)`,
        `because: ${r.how}`,
        `evidence: ${r.evidence}`,
        r.relations.length ? `holds together by: ${r.relations.slice(0, 4).join("; ")}` : null,
        `${r.changes} change${r.changes === 1 ? "" : "s"} since`
      ].filter(Boolean).join("\n");
      body.append(box);
    }
  } else if (a.rows?.length) {
    const t = document.createElement("table");
    const keys = Object.keys(a.rows[0]).slice(0, 5);
    const head = document.createElement("tr");
    for (const k of keys) {
      const th = document.createElement("th");
      th.textContent = k;
      head.append(th);
    }
    t.append(head);
    for (const r of a.rows.slice(0, 24)) {
      const tr = document.createElement("tr");
      for (const k of keys) {
        const td = document.createElement("td");
        td.textContent = String(r[k] ?? "");
        tr.append(td);
      }
      t.append(tr);
    }
    body.append(t);
  }
  S2.highlight = new Set(a.highlight || []);
  S2.overlay = a.overlay ? { ...a.overlay, trace: a.trace } : a.trace?.length ? { trace: a.trace } : null;
  hide("proposal");
  hide("branches");
  show("answer");
  S2.dirty = true;
}
$("ansClose").onclick = () => {
  hide("answer");
  S2.highlight.clear();
  S2.overlay = null;
  S2.dirty = true;
};
function showBranches() {
  const list = $("branchList");
  list.replaceChildren(...[...S2.world.place.branches.values()].map((b) => {
    const row = document.createElement("div");
    row.className = `branchRow${b.id === S2.world.branch ? " on" : ""}`;
    const left = document.createElement("div");
    const n = document.createElement("div");
    n.className = "n";
    n.textContent = b.name;
    const note2 = document.createElement("div");
    note2.className = "note";
    note2.textContent = b.note || (b.id === "AS_IS" ? "the place as it is" : "");
    left.append(n, note2);
    const stat = document.createElement("div");
    stat.className = "stat";
    stat.textContent = `${S2.world.view(b.id).entities.length} things`;
    row.append(left, stat);
    row.onclick = () => {
      S2.world.switchBranch(b.id);
      refreshChrome();
      showBranches();
      S2.dirty = true;
      toast(`Now in \u201C${b.name}\u201D. Nothing else was lost.`);
    };
    return row;
  }));
  hide("proposal");
  hide("answer");
  show("branches");
}
$("brClose").onclick = () => hide("branches");
$("branchChip").onclick = showBranches;
$("compareBtn").onclick = () => {
  const intent = { operation: "ASK", question: { kind: "compare" }, reference: { ids: [], kind: "none", basis: [] } };
  showAnswer(intent, ask(S2.world, intent, { compareBranches: [...S2.world.place.branches.keys()] }));
};
var PART_TYPES2 = /* @__PURE__ */ new Set(["opening", "furniture", "room", "wall"]);
function entitiesInside(ring3) {
  return S2.world.entities().filter((e) => {
    if (PART_TYPES2.has(e.type)) return false;
    const r = S2.world.ringOf(e);
    return r && pointInRing2(centroid(r), ring3);
  });
}
function describeContents(list) {
  if (!list.length) return "Nothing is recorded inside this.";
  const named = list.filter((e) => e.name && !/^(House|Building|Tree|Window) ?\d*$/.test(e.name));
  const kinds = {};
  for (const e of list) {
    const k = e.use || e.subtype || e.type;
    kinds[k] = (kinds[k] || 0) + 1;
  }
  const byKind = Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`);
  const lines = [`${list.length} things: ${byKind.join(", ")}.`];
  if (named.length) lines.push(`By name: ${[...new Set(named.map((e) => e.name))].slice(0, 12).join(", ")}.`);
  const said = list.filter((e) => e.type === "observation");
  if (said.length) lines.push(said.slice(0, 3).map((e) => `Someone said: \u201C${e.text || e.name}\u201D`).join("\n"));
  return lines.join("\n");
}
var SUBJECT_ASKS = {
  area: [
    ["What is in here?", "what is here?"],
    ["Why does water collect?", "why does water collect here?"],
    ["What could go here?", "what could go here?"],
    ["It floods here", "this always floods"],
    ["Three futures", "show three radically different futures for this"]
  ],
  line: [
    ["Who walks this?", "who walks here?"],
    ["People walk here", "people actually walk here"],
    ["A path here", "we need a path here"],
    ["What does it cross?", "what does this cross?"]
  ],
  thing: [
    ["Why is it here?", "why are you here?"],
    ["Who changed it?", "who changed this?"],
    ["Does it flood?", "does this flood?"],
    ["Taller", "make this taller"],
    ["Keep", "keep these"],
    ["Remove", "remove this"],
    ["Three futures", "show three radically different futures for this"]
  ]
};
function subjectFacts() {
  const ids = [...S2.selection];
  const out = [];
  if (S2.stroke && !ids.length) {
    const inside = S2.strokeClosed ? entitiesInside(S2.stroke) : [];
    out.push(S2.strokeClosed ? `${area(S2.stroke).toFixed(0)} m\xB2, ${inside.length} thing${inside.length === 1 ? "" : "s"} inside` : `${perimeter(S2.stroke, false).toFixed(0)} m long`);
    const kinds = {};
    for (const e2 of inside) kinds[e2.type] = (kinds[e2.type] || 0) + 1;
    const parts = Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`);
    if (parts.length) out.push(parts.join(", "));
    const at = S2.strokeClosed ? centroid(S2.stroke) : S2.stroke[0];
    if (S2.world.place.terrain) {
      const g = S2.world.place.terrain.slopeAt(at[0], at[1]);
      out.push(g.grade < 5e-3 ? "almost flat ground" : `ground falls ${(g.grade * 100).toFixed(1)}%`);
    }
    return out;
  }
  const e = ids.length === 1 && S2.world.get(ids[0]);
  if (!e) return [`${ids.length} things chosen`];
  if (e.type === "parcel") {
    const p = e.props || {};
    const ring4 = S2.world.ringOf(e);
    const span = ring4 && groundSpan(ring4, (x, y) => S2.world.place.groundAt(x, y), 12);
    const out2 = [];
    if (p.owner) out2.push(p.owner);
    if (p.deedAcres) {
      out2.push(`${p.deedAcres} acres on the deed` + (p.drawnAcres ? `, ${p.drawnAcres} as drawn (${p.disagreementPercent > 0 ? "+" : ""}${p.disagreementPercent}%)` : ""));
    }
    if (p.address) out2.push(p.address);
    if (p.parcelId) out2.push(`parcel ${p.parcelId.trim()}`);
    if (span) {
      out2.push(`ground ${span.lo.toFixed(0)}\u2013${span.hi.toFixed(0)} m, falling ${(span.hi - span.lo).toFixed(0)} m across it`);
    }
    const inside = ring4 ? entitiesInside(ring4).filter((x) => x.id !== e.id) : [];
    out2.push(inside.length ? `on it: ${[...new Set(inside.map((x) => x.name || x.use || x.type))].slice(0, 5).join(", ")}` : "nothing recorded on it");
    out2.push("boundary from the county \u2014 not a survey");
    return out2;
  }
  const ring3 = S2.world.ringOf(e);
  if (ring3) {
    const { height, fall } = heightOf(e);
    out.push(`${area(ring3).toFixed(0)} m\xB2, ${height.toFixed(1)} m tall` + (fall > 0.5 ? ` on ground that falls ${fall.toFixed(1)} m across it` : ""));
  }
  out.push(`${String(e.epistemic || "MODEL").toLowerCase()} \xB7 by ${e.provenance?.author || "unknown"}`);
  const rels = describeRelations(S2.world.place, e.id).filter((r) => r.ids.length);
  if (rels.length) out.push(rels.slice(0, 3).map((r) => `${r.kind} ${r.ids.length}`).join(", "));
  return out;
}
function threadAdd(q, a, src) {
  const t = $("subjectThread");
  t.hidden = false;
  const wrap2 = document.createElement("div");
  const qd = document.createElement("div");
  qd.className = "q";
  qd.textContent = q;
  const ad = document.createElement("div");
  ad.className = "a";
  ad.textContent = a;
  wrap2.append(qd, ad);
  if (src) {
    const s = document.createElement("div");
    s.className = "src";
    s.textContent = src;
    wrap2.append(s);
  }
  t.append(wrap2);
  t.scrollTop = t.scrollHeight;
  liftPlan();
}
async function askSubject(text) {
  if (!text.trim()) return;
  $("subjectInput").value = "";
  if (hasKey()) {
    threadAdd(text, "\u2026", null);
    const t = $("subjectThread");
    await runAssistant(text);
    t.lastChild?.remove();
    return;
  }
  const intent = interpret(text, context());
  if (/^(what|who)('s| is| are)? ?(in |inside )?(here|this)\b/.test(text.trim().toLowerCase())) {
    const list = S2.strokeClosed && S2.stroke ? entitiesInside(S2.stroke) : [...S2.selection].map((id) => S2.world.get(id)).filter(Boolean);
    threadAdd(text, describeContents(list), "counted from the place");
    return;
  }
  if (["ASK", "MEASURE", "OBSERVE"].includes(intent.operation)) {
    const deep = ["why", "why-not", "what-blocks", "where-fit"].includes(intent.question?.kind);
    if (deep) {
      threadAdd(text, "looking\u2026", null);
      const line2 = $("subjectThread").lastChild;
      const { findings } = await investigate(S2.world, {
        focus: [...S2.selection],
        point: S2.pointer || S2.stroke && centroid(S2.stroke),
        question: text
      }, (kind, v) => {
        line2.querySelector(".a").textContent = STEP_LABELS[kind] || kind;
        if (v.highlight) S2.highlight = new Set(v.highlight);
        if (v.overlay) S2.overlay = v.overlay;
        S2.dirty = true;
      });
      line2.querySelector(".a").textContent = summarise(findings) || "Nothing to report here.";
      line2.querySelector(".src")?.remove();
      const s = document.createElement("div");
      s.className = "src";
      s.textContent = "measured from the world \u2014 no model involved";
      line2.append(s);
      return;
    }
    const a = ask(S2.world, intent, {});
    threadAdd(text, a.text || "\u2014", "from the place\u2019s own record");
    return;
  }
  saySomething(text);
  threadAdd(text, "Proposed \u2014 see the panel below.", null);
}
function showTools() {
  const ids = [...S2.selection];
  const row = $("toolRow");
  const title = $("toolTitle");
  row.replaceChildren();
  if (!ids.length && !S2.stroke) {
    hide("tools");
    $("subjectThread").replaceChildren();
    $("subjectThread").hidden = true;
    liftPlan();
    return;
  }
  const mk = (text, fn, cls = "") => {
    const b = document.createElement("button");
    b.className = `tool ${cls}`;
    b.textContent = text;
    b.onclick = fn;
    return b;
  };
  let kind = "thing";
  if (S2.stroke && !ids.length) kind = S2.strokeClosed ? "area" : "line";
  title.textContent = kind === "area" ? "This area" : kind === "line" ? "This line" : ids.length === 1 ? labelFor(S2.world.get(ids[0])) : `${ids.length} things`;
  $("subjectFacts").textContent = subjectFacts().join(" \xB7 ");
  $("subjectInput").placeholder = kind === "thing" ? "Ask about this" : `Ask about this ${kind}`;
  for (const [label3, sentence] of SUBJECT_ASKS[kind]) row.append(mk(label3, () => askSubject(sentence)));
  row.append(mk("Note here", () => openNote(), "note"));
  if (kind === "thing" && ids.length === 1) {
    const e = S2.world.get(ids[0]);
    const num = document.createElement("label");
    num.className = "tool num";
    num.textContent = "Set width";
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.05";
    inp.inputMode = "decimal";
    const ring3 = S2.world.ringOf(e);
    inp.value = ring3 ? orientedBounds(ring3).width.toFixed(2) : "";
    inp.onchange = () => askSubject(`make this ${inp.value} m`);
    num.append(inp);
    row.append(num);
  }
  if (ids.length === 2) row.append(mk("Connect these", () => askSubject("connect these")));
  show("tools");
  liftPlan();
}
new ResizeObserver(() => liftPlan()).observe($("tools"));
function liftPlan() {
  const t = $("tools");
  document.body.classList.toggle("subject", !t.hidden);
  document.body.style.setProperty(
    "--subjectH",
    t.hidden ? "0px" : `${Math.round(innerHeight - t.getBoundingClientRect().top + 8)}px`
  );
}
$("findChip").onclick = () => openFindPanel();
$("subjectSend").onclick = () => askSubject($("subjectInput").value);
$("subjectInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") askSubject(e.target.value);
  if (e.key === "Escape") e.target.blur();
});
$("subjectClose").onclick = () => {
  S2.selection.clear();
  S2.stroke = null;
  S2.highlight.clear();
  S2.dirty = true;
  $("subjectThread").replaceChildren();
  showTools();
};
function openFindPanel() {
  document.querySelector(".findPanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "menu findPanel";
  const r = $("placeName").getBoundingClientRect();
  panel.style.left = `${Math.max(8, r.left)}px`;
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.width = "min(360px, calc(100vw - 24px))";
  const label3 = document.createElement("div");
  label3.className = "menuLabel";
  label3.textContent = "Go to something in this place";
  const input = document.createElement("input");
  input.className = "nameInput";
  input.placeholder = "a building, a street, a shop\u2026";
  const results = document.createElement("div");
  panel.append(label3, input, results);
  document.body.append(panel);
  input.focus();
  const named = S2.world.entities().filter((e) => (e.name || e.use) && !["opening", "furniture", "room"].includes(e.type));
  const show2 = (q) => {
    results.replaceChildren();
    const needle = q.trim().toLowerCase();
    const scored = named.map((e) => {
      const hay = `${e.name || ""} ${e.use || ""} ${e.type}`.toLowerCase();
      if (!needle) return { e, score: e.name ? 1 : 0.4 };
      if (!hay.includes(needle)) return null;
      return { e, score: (e.name || "").toLowerCase().startsWith(needle) ? 3 : 2 };
    }).filter(Boolean);
    const ring3 = (e) => S2.world.ringOf(e);
    scored.sort((a, b) => b.score - a.score || Math.abs(area(ring3(b.e) || [])) - Math.abs(area(ring3(a.e) || [])));
    for (const { e } of scored.slice(0, 12)) {
      const rg = ring3(e);
      const b = document.createElement("button");
      const area2 = rg ? `${Math.abs(area(rg)).toFixed(0)} m\xB2` : "";
      const { fall } = rg ? heightOf(e) : { fall: 0 };
      b.innerHTML = `${escapeHTML2(e.name || e.use || e.type)}<span class="sub">${e.type}${area2 ? ` \xB7 ${area2}` : ""}${fall > 0.5 ? ` \xB7 on ground falling ${fall.toFixed(1)} m` : ""}</span>`;
      b.onclick = () => {
        panel.remove();
        goToEntity(e.id);
      };
      results.append(b);
    }
    if (!scored.length) {
      const none = document.createElement("div");
      none.className = "importStatus";
      none.textContent = `nothing here called \u201C${q}\u201D`;
      results.append(none);
    }
  };
  show2("");
  input.oninput = () => show2(input.value);
  input.onkeydown = (ev) => {
    if (ev.key === "Escape") panel.remove();
    if (ev.key === "Enter") results.querySelector("button")?.click();
  };
  setTimeout(() => document.addEventListener("pointerdown", function off(ev) {
    if (!panel.contains(ev.target)) {
      panel.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
}
function goToEntity(id) {
  const e = S2.world.get(id);
  const ring3 = e && S2.world.ringOf(e);
  if (!ring3) return;
  const c = centroid(ring3);
  const ob = orientedBounds(ring3);
  S2.cam.target = [c[0], c[1], S2.world.place.groundAt(c[0], c[1])];
  S2.cam.dist = Math.max(35, Math.min(320, Math.max(ob.width, ob.depth) * 2.6));
  S2.cam.pitch = 0.42;
  clampCamera();
  updateFidelity();
  S2.selection = /* @__PURE__ */ new Set([id]);
  S2.dirty = true;
  showTools();
  updateOrientation();
  const { height, fall } = heightOf(e);
  toast(fall > 0.5 ? `${e.name || e.type} \u2014 ${height.toFixed(1)} m on ground that falls ${fall.toFixed(1)} m across it.` : `${e.name || e.type}.`);
}
var escapeHTML2 = (v) => String(v).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
var inHand = null;
var seated = null;
async function bodyFromURL(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const { points } = readGLB(await res.arrayBuffer());
  return bodyFromModel(points, { name: name || url.split("/").pop(), url });
}
function takeInHand(body) {
  inHand = body;
  const ob = orientedBounds(body.footprint);
  toast(`${body.name} \u2014 ${ob.width.toFixed(1)}\xD7${ob.depth.toFixed(1)} m, ${body.height.toFixed(1)} m tall. Tap the ground to put it somewhere.`);
}
function placeInHand(at, { rotation = null, level = "balanced" } = {}) {
  if (!inHand) return false;
  try {
    if (S2.world.place.terrain && S2.world.place.terrain.cell > 4) {
      const r = refineTerrain(S2.world.place, 3, at, 90);
      if (r.refused) {
        toast(r.reason);
        return false;
      }
      if (r.refined) toast(`The ground here is recorded every ${r.from.toFixed(0)} m \u2014 too coarse for a building, so ${r.samples.toLocaleString()} samples were read at ${r.cell} m around this spot. What lies between the original samples is interpolation, not survey.`);
    }
    let rot = rotation;
    let saved = null;
    if (rot === null) {
      let best = null, worst = 0;
      for (let deg = 0; deg < 180; deg += 15) {
        const s = planSeat(S2.world, inHand, at, { level, rotation: deg * Math.PI / 180 });
        const earth = s.cut + s.fill;
        if (!best || earth < best.earth) best = { deg, earth };
        if (earth > worst) worst = earth;
      }
      rot = best.deg * Math.PI / 180;
      saved = worst - best.earth;
    }
    const seat = planSeat(S2.world, inHand, at, { level, rotation: rot });
    if (seated) seated.undo.restore();
    const undo = settleGround(S2.world, seat);
    seated = { seat, undo, hit: disturbances(S2.world, seat) };
    S2.world.place.put(makeBody(S2.world, inHand, seat));
    S2.selection = /* @__PURE__ */ new Set([bodyId(inHand, seat)]);
    invalidate({ plan: true });
    S2.dirty = true;
    showTools();
    const bits = [seat.reads];
    if (saved > 1) bits.push(`Turned ${Math.round(rot * 180 / Math.PI)}\xB0 along the contour, which saves ${Math.round(saved)} m\xB3.`);
    const ways = seated.hit.filter((h) => h.moves !== null && Math.abs(h.moves) > 0.3);
    if (ways.length) bits.push(`${ways[0].name} moves ${ways[0].moves > 0 ? "up" : "down"} ${Math.abs(ways[0].moves).toFixed(1)} m.`);
    toast(bits.join(" "));
    return true;
  } catch (err) {
    reportFailure("Could not seat that", err);
    return false;
  }
}
function bodyId(body, seat) {
  return `body-${body.id}-${Math.round(seat.at[0])}-${Math.round(seat.at[1])}`;
}
function makeBody(world, body, seat) {
  return {
    id: bodyId(body, seat),
    type: "structure",
    name: body.name,
    footprint: seat.ring,
    zBase: seat.floor,
    zTop: seat.floor + body.height,
    epistemic: "PROPOSED",
    collision: "solid",
    sim: { permeability: 0, roughness: 0.02 },
    provenance: { author: S2.author || "you", how: "seated on the ground", when: (/* @__PURE__ */ new Date()).toISOString() },
    props: {
      body: { id: body.id, url: body.appearance?.url || null, rotation: seat.rotation },
      earthwork: { cut: Math.round(seat.cut), fill: Math.round(seat.fill), floor: +seat.floor.toFixed(2) }
    }
  };
}
function unseat() {
  if (!seated) return;
  seated.undo.restore();
  const id = bodyId(seated.seat.body, seated.seat);
  try {
    S2.world.place.remove?.(id);
  } catch {
  }
  seated = null;
  invalidate({ plan: true });
  S2.dirty = true;
  toast("The ground is as it was.");
}
function wireDropTarget() {
  const zone = document.body;
  const bar = $("sayWrap") || $("sayInput");
  const arm = (on, text) => {
    bar?.classList.toggle("dropping", on);
    if (on && text) $("sayInput").placeholder = text;
    else if (!on) $("sayInput").placeholder = "Say something about this place";
  };
  zone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    const f2 = ev.dataTransfer?.items?.[0];
    arm(true, f2 ? "drop it here" : "drop a model or a map here");
  });
  zone.addEventListener("dragleave", (ev) => {
    if (ev.target === zone) arm(false);
  });
  zone.addEventListener("drop", async (ev) => {
    ev.preventDefault();
    arm(false);
    const files = [...ev.dataTransfer?.files || []];
    if (!files.length) return;
    for (const file of files) await takeFile(file);
  });
}
async function takeFile(file) {
  const name = file.name || "file";
  const ext = name.toLowerCase().split(".").pop();
  try {
    if (ext === "glb") {
      const { points } = readGLB(await file.arrayBuffer());
      const body = bodyFromModel(points, { name: name.replace(/\.glb$/i, ""), url: name });
      takeInHand(body);
      return;
    }
    if (ext === "gltf") {
      toast(`${name} is a .gltf, which keeps its geometry in separate files. Export it as .glb \u2014 one file, everything in it \u2014 and drop that.`);
      return;
    }
    if (ext === "geojson" || ext === "json") {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.type === "FeatureCollection" || data.type === "Feature") {
        const added = fromGeoJSON(S2.world, data, { author: S2.author || "you" });
        invalidate({ plan: true });
        toast(`${name}: ${added?.length ?? 0} things brought in. They are marked as imported, not as things CREO invented.`);
        return;
      }
      if (data.entities || data.terrain) {
        adoptWorld(World.load(text), slug(name), name.replace(/\.json$/i, ""));
        toast(`${name} opened.`);
        return;
      }
      toast(`${name} is JSON, but not a map or a place CREO recognises.`);
      return;
    }
    toast(`CREO cannot read ${ext ? `.${ext}` : "that"} yet. It takes .glb for a building, .geojson for ground, and a saved place.`);
  } catch (err) {
    reportFailure(`Could not read ${name}`, err);
  }
}
var PREFERRED = [
  /(^|[-\/])gpt-?5\.6[-.]?sol\b|^sol\b/i,
  /(^|[-\/])gpt-?5\.6[-.]?luna\b|^luna\b/i,
  /(^|[-\/])gpt-?5\.6[-.]?terra\b|^terra\b/i,
  /(^|[-\/])gpt-?5\.6\b/i,
  /(^|[-\/])gpt-?5\b/i,
  /^o[34]\b/i,
  /(^|[-\/])gpt-4\.1\b/i
];
function rankModel(m) {
  for (let i = 0; i < PREFERRED.length; i++) if (PREFERRED[i].test(m)) return i;
  if (/gpt-4o/i.test(m)) return PREFERRED.length + 1;
  return PREFERRED.length;
}
function openAIPanel() {
  const cfg = getConfig();
  $("setupKey").value = cfg.key || "";
  const sel = $("setupModel");
  const status = $("setupStatus");
  const setStatus = (m) => {
    status.textContent = m;
  };
  const fill = (models, chosen) => {
    sel.replaceChildren();
    for (const m of models) {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      if (m === chosen) o.selected = true;
      sel.append(o);
    }
  };
  if (cfg.model) fill([cfg.model], cfg.model);
  else fill(["\u2014 add a key, then Refresh \u2014"], null);
  async function refresh() {
    const k = $("setupKey").value.trim();
    if (!k) {
      setStatus("paste a key first");
      return;
    }
    setConfig({ key: k });
    setStatus("asking the endpoint what it has\u2026");
    try {
      const all = await listModels();
      const usable = all.filter((m) => !/embed|whisper|tts|dall|moderation|audio|realtime|image/.test(m)).sort((a, b) => rankModel(a) - rankModel(b) || b.localeCompare(a));
      if (!usable.length) {
        setStatus("the key works, but this endpoint offers no usable text models");
        return;
      }
      fill(usable, cfg.model || usable[0]);
      const named = PREFERRED.find((p) => usable.some((m) => p.test(m)));
      setStatus(named ? `${usable.length} models \u2014 using ${usable[0]}, the most capable this key can reach` : `${usable.length} models \u2014 ${usable[0]}. No sol/luna/terra model on this key.`);
      if (!cfg.model) setConfig({ model: usable[0] });
    } catch (err) {
      setStatus(String(err.message).slice(0, 140));
    }
  }
  $("setupRefresh").onclick = refresh;
  $("setupKey").onchange = () => {
    setConfig({ key: $("setupKey").value.trim() });
    refresh();
  };
  sel.onchange = () => {
    setConfig({ model: sel.value });
    setStatus(`using ${sel.value}`);
  };
  $("setupDone").onclick = () => {
    const k = $("setupKey").value.trim();
    if (k) setConfig({ key: k });
    if (sel.value && !sel.value.startsWith("\u2014")) setConfig({ model: sel.value });
    hide("setup");
    remember("creo.sawSetup", "1");
    setMode_(S2.commitment);
    if (hasKey()) toast(`Ready \u2014 ${getConfig().model || "model unset"}. Say anything about this place.`);
  };
  $("setupClose").onclick = () => {
    hide("setup");
    remember("creo.sawSetup", "1");
  };
  $("setup").classList.toggle("tucked", $("tools").hidden);
  show("setup");
  if (cfg.key && !cfg.model) refresh();
  else if (!cfg.key) $("setupKey").focus();
}
function openNote() {
  document.querySelector(".notePanel")?.remove();
  if (!S2.pointer && !S2.selection.size && !S2.stroke) {
    toast("Tap a spot first, then leave your note.");
    return;
  }
  const panel = document.createElement("div");
  panel.className = "menu notePanel";
  panel.style.left = "12px";
  panel.style.bottom = `calc(150px + var(--safe))`;
  panel.style.width = "min(400px, calc(100vw - 24px))";
  const label3 = document.createElement("div");
  label3.className = "menuLabel";
  label3.textContent = "What do you want to say about this spot?";
  const input = document.createElement("input");
  input.className = "nameInput";
  input.placeholder = "it floods here when the rain is bad";
  input.setAttribute("aria-label", "Your note");
  const go = document.createElement("button");
  go.className = "tool";
  go.textContent = "Leave it here";
  go.style.margin = "0 6px 6px";
  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    panel.remove();
    saySomething(text);
  };
  go.onclick = submit;
  input.onkeydown = (e) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") panel.remove();
  };
  panel.append(label3, input, go);
  document.body.append(panel);
  input.focus();
}
function setMode(m) {
  S2.mode = m;
  $("modeDraw").classList.toggle("on", m === "draw");
  if (m === "draw") toast("Draw a line, or a loop for an area.");
}
$("modeDraw").onclick = () => setMode(S2.mode === "draw" ? "select" : "draw");
$("fitBtn").onclick = () => frameAll();
$("planBtn").onclick = () => {
  S2.showPlan = !S2.showPlan;
  $("plan").hidden = !S2.showPlan;
  $("planBtn").classList.toggle("on", S2.showPlan);
};
$("layersBtn").onclick = () => openLayers({
  anchorEl: $("layersBtn"),
  off: S2.layersOff,
  onChange: () => {
    S2.dirty = true;
  },
  labelsOn: () => S2.labels !== false,
  onLabels: () => {
    S2.labels = S2.labels === false;
    S2.dirty = true;
  }
});
$("helpBtn").onclick = () => openHelp();
function toggleRain() {
  if (S2.overlay?.kind === "water") {
    S2.overlay = null;
    S2.dirty = true;
    $("waterLegend").hidden = true;
    $("rainBtn").classList.remove("on");
    return;
  }
  toast("Running the rain\u2026");
  setTimeout(() => {
    const w = runWater(S2.world, { rain: "heavy" });
    S2.overlay = { kind: "water", water: w };
    S2.dirty = true;
    $("rainBtn").classList.add("on");
    $("waterLegend").hidden = false;
    $("legendMax").textContent = `${(w.maxDepth * 100).toFixed(0)} cm`;
    const wet = [...w.exposure.entries()].filter(([, v]) => v.maxDepth > 0.05).length;
    $("legendNote").textContent = `${w.floodedArea.toFixed(0)} m\xB2 over 5 cm \xB7 ${wet} built things get wet. ${w.model.assumptions.rainfall_mm.heavy} mm over ${w.model.assumptions.duration_min} min, ${w.cell} m grid. Comparative, not survey: the direction is robust, the depth is not.`;
    toast(`Deepest ${(w.maxDepth * 100).toFixed(0)} cm \xB7 ${w.floodedArea.toFixed(0)} m\xB2 over 5 cm.`);
  }, 30);
}
$("rainBtn").onclick = toggleRain;
$("exportBtn").onclick = (ev) => {
  document.querySelector(".exportPanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "menu exportPanel";
  const r = ev.currentTarget.getBoundingClientRect();
  panel.style.right = "12px";
  panel.style.top = `${r.bottom + 8}px`;
  const head = document.createElement("div");
  head.className = "menuLabel";
  head.textContent = "Take it away";
  panel.append(head);
  const notes = S2.world.entities().filter((e) => e.type === "observation");
  const mine = S2.world.entities().filter((e) => e.epistemic === "PROPOSED" || e.type === "observation");
  const opt = (label3, sub2, fn) => {
    const b = document.createElement("button");
    b.innerHTML = `${label3}<span class="sub">${sub2}</span>`;
    b.onclick = () => {
      panel.remove();
      fn();
    };
    panel.append(b);
  };
  opt(
    "What people said",
    `${notes.length} note${notes.length === 1 ? "" : "s"}, as GeoJSON`,
    () => download(filterGeoJSON((f2) => f2.properties.type === "observation"), "notes")
  );
  opt(
    "Notes and proposals",
    `${mine.length} feature${mine.length === 1 ? "" : "s"} added to this place`,
    () => download(filterGeoJSON((f2) => f2.properties.type === "observation" || f2.properties.epistemic === "PROPOSED"), "proposals")
  );
  opt(
    "This whole branch",
    `${S2.world.entities().length} features, everything visible`,
    () => download(toGeoJSON(S2.world), "place")
  );
  opt(
    "The event log",
    "who changed what, when, and from which words",
    () => downloadText(JSON.stringify(S2.world.journal.toJSON().events.map((e) => ({
      id: e.id,
      at: e.tick,
      by: e.author,
      did: e.label,
      said: e.utterance?.text || null,
      branch: e.branch
    })), null, 2), "history", "json")
  );
  document.body.append(panel);
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!panel.contains(e.target)) {
      panel.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
};
function filterGeoJSON(pred) {
  const fc = toGeoJSON(S2.world);
  return { ...fc, features: fc.features.filter(pred) };
}
function download(geojson, kind) {
  if (!geojson.features.length) {
    toast("Nothing to take away yet.");
    return;
  }
  downloadText(JSON.stringify(geojson, null, 2), kind, "geojson");
  toast(`${geojson.features.length} features saved. Every one carries who said it and when.`);
}
function downloadText(text, kind, ext) {
  const name = `${S2.placeKey}-${kind}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${ext}`;
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4e3);
}
$("undoBtn").onclick = () => {
  const e = S2.world.undo();
  if (e) toast(`Undone: ${e.label}`);
  refreshChrome();
  S2.dirty = true;
};
$("redoBtn").onclick = () => {
  const e = S2.world.redo();
  if (e) toast(`Redone: ${e.label}`);
  refreshChrome();
  S2.dirty = true;
};
$("placeChip").onclick = async (ev) => {
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.style.left = "12px";
  menu.style.top = `${ev.currentTarget.getBoundingClientRect().bottom + 8}px`;
  const anywhere = document.createElement("button");
  anywhere.innerHTML = `Take me anywhere\u2026<span class="sub">search any street, district or village on Earth</span>`;
  anywhere.onclick = () => {
    menu.remove();
    openImportPanel({
      anchorEl: $("placeChip"),
      toast,
      onLoaded: (world, key2, name) => adoptWorld(world, key2, name)
    });
  };
  menu.append(anywhere);
  const who = document.createElement("button");
  who.innerHTML = `${S2.author ? `Signing as ${escapeHTML2(S2.author)}` : "Add your name"}<span class="sub">so the place can remember who changed what</span>`;
  who.onclick = () => {
    menu.remove();
    $("authorChip").click();
  };
  menu.append(who);
  if (S2.world.place.meta?.bbox) {
    const b = S2.world.place.meta.bbox;
    const across = Math.round((b[2] - b[0]) * 111320);
    const more = document.createElement("button");
    more.innerHTML = `Show more around here\u2026<span class="sub">this window is ${across} m across \u2014 widen it, or move it to where you are looking</span>`;
    more.onclick = () => {
      menu.remove();
      openReframePanel({
        anchorEl: $("placeChip"),
        world: S2.world,
        camera: S2.cam,
        currentMetres: across,
        toast,
        onLoaded: (world, key2, name) => adoptWorld(world, key2, name)
      });
    };
    menu.append(more);
  }
  const cached = await listCached();
  for (const p of cached) {
    const b = document.createElement("button");
    b.className = p.key === S2.placeKey ? "on" : "";
    const c = p.counts || {};
    b.innerHTML = `${p.name}<span class="sub">${c.buildings || 0} buildings \xB7 ${(c.roads || 0) + (c.paths || 0)} ways \xB7 ${p.relief || 0} m relief</span>`;
    b.onclick = async () => {
      menu.remove();
      adoptWorld(await loadCached(p.key), p.key, p.name);
    };
    menu.append(b);
  }
  const imported = await listImported();
  if (imported.length) {
    const h = document.createElement("div");
    h.className = "menuLabel";
    h.textContent = "Real places \u2014 OpenStreetMap";
    menu.append(h);
  }
  for (const p of imported) {
    const b = document.createElement("button");
    b.className = p.key === S2.placeKey ? "on" : "";
    const c = p.counts || {};
    b.innerHTML = `${p.name}<span class="sub">${c.buildings || 0} buildings \xB7 ${c.roads || 0} roads \xB7 ${p.relief || 0} m relief</span>`;
    b.onclick = () => {
      menu.remove();
      loadPlace(p.key);
    };
    menu.append(b);
  }
  if (imported.length) {
    const h = document.createElement("div");
    h.className = "menuLabel";
    h.textContent = "Synthetic places \u2014 invented, for testing the loop";
    menu.append(h);
  }
  for (const p of PLACES) {
    const b = document.createElement("button");
    b.className = p.key === S2.placeKey ? "on" : "";
    b.innerHTML = `${p.name}<span class="sub">${p.scale}</span>`;
    b.onclick = () => {
      menu.remove();
      loadPlace(p.key);
    };
    menu.append(b);
  }
  document.body.append(menu);
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
};
var toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 4200);
}
var show = (id) => {
  $(id).hidden = false;
};
var hide = (id) => {
  $(id).hidden = true;
};
function setAuthor(name) {
  S2.author = (name || "").trim();
  if (S2.author) remember("creo.author", S2.author);
  $("authorName").textContent = S2.author || "add your name";
  $("authorChip").classList.toggle("unset", !S2.author);
}
$("authorChip").onclick = (ev) => {
  const menu = document.createElement("div");
  menu.className = "menu";
  const r = ev.currentTarget.getBoundingClientRect();
  menu.style.left = `${Math.max(8, r.left)}px`;
  menu.style.top = `${r.bottom + 8}px`;
  const label3 = document.createElement("div");
  label3.className = "menuLabel";
  label3.textContent = "Who is making these changes?";
  const input = document.createElement("input");
  input.className = "nameInput";
  input.value = S2.author;
  input.placeholder = "your name";
  input.setAttribute("aria-label", "Your name");
  const done = () => {
    setAuthor(input.value);
    menu.remove();
    toast(S2.author ? `Changes will be signed ${S2.author}.` : "Changes will be unsigned.");
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter") done();
  };
  const ok = document.createElement("button");
  ok.textContent = "That's me";
  ok.onclick = done;
  menu.append(label3, input, ok);
  document.body.append(menu);
  input.focus();
  setTimeout(() => document.addEventListener("pointerdown", function off(e) {
    if (!menu.contains(e.target)) {
      done();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
};
function refreshChrome() {
  $("undoBtn").disabled = !S2.world.journal.canUndo();
  $("redoBtn").disabled = !S2.world.journal.canRedo();
  const multi = S2.world.place.branches.size > 1;
  $("branchChip").hidden = !multi;
  $("branchName").textContent = S2.world.place.branches.get(S2.world.branch)?.name || "As it is";
  S2.preserved = new Set(S2.world.place.relations.filter((r) => r.kind === "preserves").map((r) => r.to));
  save();
}
var saveQueued = false;
function save() {
  if (!PLACES.some((p) => p.key === S2.placeKey)) return;
  if (saveQueued) return;
  saveQueued = true;
  const go = () => {
    saveQueued = false;
    if (!S2.world) return;
    const payload = S2.world.save();
    if (payload.length < 9e5) remember(`creo.save.${S2.placeKey}`, payload);
    else cachePut(`autosave.${S2.placeKey}`, { payload, meta: { key: S2.placeKey, autosave: true } });
  };
  if (typeof window !== "undefined" && window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4e3 });
  else setTimeout(go, 300);
}
function adoptWorld(world, key2, name) {
  S2.world = world;
  S2.placeKey = key2;
  S2.selection.clear();
  S2.highlight.clear();
  S2.stroke = null;
  S2.plan = null;
  S2.overlay = null;
  S2.utterances = [];
  hide("proposal");
  hide("answer");
  hide("branches");
  hide("tools");
  $("placeName").textContent = (name || world.place.name).split(" \u2014 ")[0].split(",")[0];
  const credit = attribution(world);
  $("attribution").textContent = credit || "";
  $("attribution").hidden = !credit;
  frameWorld();
  refreshChrome();
  RIG._drawnGround = null;
  S2.dirty = true;
  remember("creo.place", key2);
}
async function loadPlace(key2) {
  S2.placeKey = key2;
  const saved = localStorage.getItem(`creo.save.${key2}`);
  const synthetic = PLACES.some((p) => p.key === key2);
  try {
    if (saved) S2.world = World.load(saved);
    else if (synthetic) S2.world = buildPlace(key2);
    else {
      const shipped2 = await listImported();
      S2.world = shipped2.some((p) => p.key === key2) ? await loadImported(key2) : await loadCached(key2);
    }
  } catch (err) {
    console.warn(`[CREO] could not open ${key2}:`, err.message);
    S2.placeKey = synthetic ? key2 : "settlement";
    S2.world = buildPlace(S2.placeKey);
    if (!synthetic) {
      setTimeout(() => toast(`\u201C${key2}\u201D is not in this browser any more \u2014 showing ${S2.placeKey}. Use Take me anywhere to pull it again.`), 400);
    }
  }
  S2.selection.clear();
  S2.highlight.clear();
  S2.stroke = null;
  S2.plan = null;
  S2.overlay = null;
  S2.utterances = [];
  $("placeName").textContent = (PLACES.find((p) => p.key === S2.placeKey)?.name || S2.world.place.name).split(" \u2014 ")[0].split(",")[0];
  const credit = attribution(S2.world);
  $("attribution").textContent = credit || "";
  $("attribution").hidden = !credit;
  hide("proposal");
  hide("answer");
  hide("branches");
  hide("tools");
  frameWorld();
  refreshChrome();
  S2.dirty = true;
  remember("creo.place", S2.placeKey);
}
addEventListener("keydown", (ev) => {
  if (ev.target.tagName === "INPUT") return;
  lastInputAt = Date.now();
  const k = ev.key.toLowerCase();
  if (k === "z" && (ev.metaKey || ev.ctrlKey)) {
    ev.preventDefault();
    ev.shiftKey ? $("redoBtn").click() : $("undoBtn").click();
  } else if (k === "d") setMode(S2.mode === "draw" ? "select" : "draw");
  else if (k === "b") showBranches();
  else if (k === "l") {
    S2.labels = S2.labels === false;
    S2.dirty = true;
    toast(S2.labels === false ? "Names hidden." : "Names shown.");
  } else if (k === "f") frameAll();
  else if (k === "g") openFindPanel();
  else if (k === "x") $("exploreBtn").click();
  else if (k === "b") $("dropBtn").click();
  else if (k === "t") openThemeMenu();
  else if (k === "-" || k === "_") $("planOut").click();
  else if (k === "=" || k === "+") $("planIn").click();
  else if (minimap?.explore && ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
    ev.preventDefault();
    minimap.step(
      k === "arrowright" ? 1 : k === "arrowleft" ? -1 : 0,
      k === "arrowup" ? 1 : k === "arrowdown" ? -1 : 0
    );
  } else if (minimap?.explore && (k === "enter" || k === " ")) {
    ev.preventDefault();
    $("exploreGo").click();
  } else if (minimap?.explore && k === "escape") {
    $("exploreBtn").click();
  } else if (k === "m") $("planBtn").click();
  else if (k === "?" || k === "/" && ev.shiftKey) {
    ev.preventDefault();
    openHelp();
  } else if (k === "n") openNote();
  else if (k === "r") toggleRain();
  else if (k === "/") {
    ev.preventDefault();
    $("sayInput").focus();
  } else if (k === "escape") {
    S2.selection.clear();
    S2.stroke = null;
    S2.strokeHeights = null;
    hide("tools");
    hide("proposal");
    S2.plan = null;
    S2.dirty = true;
  } else if (k.startsWith("arrow")) {
    ev.preventDefault();
    if (ev.shiftKey) {
      if (k === "arrowleft") S2.cam.yaw -= 0.14;
      else if (k === "arrowright") S2.cam.yaw += 0.14;
      else if (k === "arrowup") S2.cam.dist *= 0.88;
      else S2.cam.dist *= 1.14;
      clampCamera();
      updateFidelity();
    } else {
      const step = S2.cam.dist * 0.08;
      const dx = k === "arrowleft" ? -step : k === "arrowright" ? step : 0;
      const dy = k === "arrowup" ? step : k === "arrowdown" ? -step : 0;
      const yaw = S2.cam.yaw;
      S2.cam.target[0] += Math.cos(yaw) * dy - Math.sin(yaw) * dx;
      S2.cam.target[1] += Math.sin(yaw) * dy + Math.cos(yaw) * dx;
      clampCamera();
      setCrosshair(true);
    }
  } else if (k === "+" || k === "=") {
    S2.cam.dist *= 0.88;
    clampCamera();
    updateFidelity();
  } else if (k === "-" || k === "_") {
    S2.cam.dist *= 1.14;
    clampCamera();
    updateFidelity();
  } else if (k === "enter" || k === " ") {
    ev.preventDefault();
    setCrosshair(true);
    const r = canvas.getBoundingClientRect();
    tap(r.left + r.width / 2, r.top + r.height / 2, ev.shiftKey);
    const e = [...S2.selection].map((id) => S2.world.get(id)).filter(Boolean)[0];
    toast(e ? `Chose ${labelFor(e)}` : "Nothing there \u2014 move with the arrow keys and try again.");
  }
});
function setCrosshair(on) {
  const el = $("crosshair");
  if (!el) return;
  el.hidden = !on;
  if (on) {
    clearTimeout(setCrosshair._t);
    setCrosshair._t = setTimeout(() => {
      el.hidden = true;
    }, 9e3);
    const p = rayToGround(S2.world, rayAt(innerWidth / 2, innerHeight / 2));
    if (p) S2.pointer = p;
  }
}
minimap = new Minimap($("planCanvas"), {
  onGo: (p) => {
    S2.cam.target = [p[0], p[1], S2.world.place.groundAt(p[0], p[1])];
    clampCamera();
  },
  // Ground comes in windows, so moving is a choice between windows: pick one of
  // the eight neighbours, see whether you already have it, then say go. Nothing
  // is fetched by pointing at it.
  onExplore: (phase, pick2) => {
    S2.dirty = true;
    if (phase !== "pick") return;
    describePick(pick2);
  }
});
var COMPASS = {
  "0,1": "north",
  "0,-1": "south",
  "1,0": "east",
  "-1,0": "west",
  "1,1": "north-east",
  "-1,1": "north-west",
  "1,-1": "south-east",
  "-1,-1": "south-west"
};
function placeWidth() {
  const b = S2.world.place.meta?.bbox;
  return b ? Math.round((b[2] - b[0]) * 111320) : 900;
}
function describePick(pick2) {
  const where = $("exploreWhere");
  const go = $("exploreGo");
  if (!pick2) {
    where.textContent = "tap a neighbouring window, or use the arrow keys";
    go.hidden = true;
    return;
  }
  const key2 = `${pick2[0]},${pick2[1]}`;
  const known = minimap.loaded.has(key2);
  where.textContent = known ? `${COMPASS[key2]} \u2014 you already have this ground` : `${COMPASS[key2]} \u2014 ${placeWidth()} m of ground, not loaded yet`;
  go.hidden = false;
  go.textContent = known ? `Go ${COMPASS[key2]}` : `Fetch ${COMPASS[key2]}`;
}
async function refreshNeighbours() {
  minimap.loaded = /* @__PURE__ */ new Set();
  const b = S2.world.place.meta?.bbox;
  if (!b) {
    S2.dirty = true;
    return;
  }
  const h = b[2] - b[0], w = b[3] - b[1];
  const lat = (b[0] + b[2]) / 2, lon = (b[1] + b[3]) / 2;
  const cached = await listCached() || [];
  minimap.neighbourKeys = {};
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      const wantLat = lat + j * h, wantLon = lon + i * w;
      const hit = cached.find((c) => {
        if (!c.bbox) return false;
        const cl = (c.bbox[0] + c.bbox[2]) / 2, cn = (c.bbox[1] + c.bbox[3]) / 2;
        return Math.abs(cl - wantLat) < h * 0.25 && Math.abs(cn - wantLon) < w * 0.25;
      });
      if (hit) {
        minimap.loaded.add(`${i},${j}`);
        minimap.neighbourKeys[`${i},${j}`] = hit.key;
      }
    }
  }
  S2.dirty = true;
}
$("exploreGo").onclick = async () => {
  const pick2 = minimap.pick;
  if (!pick2 || S2.busy) return;
  const key2 = `${pick2[0]},${pick2[1]}`;
  const cachedKey = minimap.neighbourKeys?.[key2];
  const b = S2.world.place.terrain?.bounds || S2.world.place.bounds();
  const at = [pick2[0] * (b[2] - b[0]), pick2[1] * (b[3] - b[1])];
  if (cachedKey) {
    try {
      const world = await loadCached(cachedKey);
      adoptWorld(world, cachedKey, world.place.name);
      minimap.pick = null;
      await refreshNeighbours();
      describePick(null);
      toast(`${COMPASS[key2]} \u2014 from this browser, nothing fetched.`);
    } catch (err) {
      reportFailure("Could not open that ground", err);
    }
    return;
  }
  await exploreTo(at, placeWidth(), COMPASS[key2]);
};
async function exploreTo(at, metres, whereName) {
  if (S2.busy) return;
  S2.busy = true;
  const where = $("exploreWhere");
  try {
    const { bbox: bbox2 } = reframe(S2.world, { at, metres });
    const base = (S2.world.place.name || "here").split(" \xB7 ")[0].split(" \u2014 ")[0];
    const label3 = `${base} \xB7 ${whereName}`;
    const { world, key: key2, name, stats: stats2 } = await importPlace({
      bbox: bbox2,
      name: label3,
      metres,
      log: (m) => {
        where.textContent = String(m).slice(0, 64);
      }
    });
    await cachePut(key2, {
      payload: world.save(),
      meta: {
        key: key2,
        name,
        counts: stats2,
        relief: world.place.meta?.relief || 0,
        bbox: world.place.meta?.bbox,
        fetchedAt: world.place.meta?.fetchedAt,
        source: "OpenStreetMap (ODbL)"
      }
    });
    adoptWorld(world, key2, name);
    minimap.pick = null;
    await refreshNeighbours();
    describePick(null);
    toast(`${whereName} \u2014 ${stats2.buildings || 0} buildings, ${world.place.meta?.relief || 0} m relief.`);
  } catch (err) {
    where.textContent = String(err.message).slice(0, 70);
    reportFailure("Could not fetch that ground", err);
  } finally {
    S2.busy = false;
  }
}
var detailOffer = null;
function outsideDetail() {
  const d = S2.world.place.meta?.detailBounds;
  if (!d) return false;
  const [x, y] = S2.cam.target;
  const pad = Math.max(40, S2.cam.dist * 0.2);
  return x < d[0] - pad || x > d[2] + pad || y < d[1] - pad || y > d[3] + pad;
}
function howFarOut() {
  const d = S2.world.place.meta?.detailBounds;
  if (!d) return 0;
  const cx = (d[0] + d[2]) / 2, cy = (d[1] + d[3]) / 2;
  return Math.hypot(S2.cam.target[0] - cx, S2.cam.target[1] - cy);
}
function reviewFrame() {
  if (S2.busy || !S2.world.place.meta?.detailBounds) return;
  const out = outsideDetail();
  const bar = $("frameOffer");
  if (!out) {
    bar.hidden = true;
    detailOffer = null;
    return;
  }
  const km = howFarOut() / 1e3;
  bar.hidden = false;
  $("frameWhere").textContent = km < 1 ? `You are ${Math.round(km * 1e3)} m past what is mapped here \u2014 the ground is real, nothing on it is recorded yet.` : `You are ${km.toFixed(1)} km past what is mapped here \u2014 the ground is real, nothing on it is recorded yet.`;
  detailOffer = [S2.cam.target[0], S2.cam.target[1]];
}
$("frameGo").onclick = async () => {
  if (!detailOffer || S2.busy) return;
  const at = detailOffer.slice();
  const d = S2.world.place.meta.detailBounds;
  const metres = Math.round(Math.max(d[2] - d[0], d[3] - d[1]));
  $("frameWhere").textContent = "reading what is built here\u2026";
  await exploreTo(at, metres, "here");
  reviewFrame();
};
$("frameDismiss").onclick = () => {
  $("frameOffer").hidden = true;
  detailOffer = null;
};
function toLatLon(x, y) {
  const a = S2.world.place.meta?.anchor;
  if (!a) return null;
  const lat = a[0] + y / 111320;
  const lon = a[1] + x / (111320 * Math.max(0.05, Math.cos(a[0] * Math.PI / 180)));
  return [lat, lon];
}
var CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function updateOrientation() {
  const facing = ((90 - S2.cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const rose = $("compassRose");
  if (rose) rose.style.transform = `rotate(${-facing}deg)`;
  const whereBtn = $("whereAmI");
  if (whereBtn) whereBtn.title = `Facing ${Math.round(facing)}\xB0 ${CARDINALS[Math.round(facing / 22.5) % 16]} \u2014 tap to copy this position`;
  const p = S2.pointer || [S2.cam.target[0], S2.cam.target[1]];
  const ll = toLatLon(p[0], p[1]);
  const dp = innerWidth < 640 ? 4 : 5;
  $("whereLatLon").textContent = ll ? `${Math.abs(ll[0]).toFixed(dp)}\xB0${ll[0] < 0 ? "S" : "N"} ${Math.abs(ll[1]).toFixed(dp)}\xB0${ll[1] < 0 ? "W" : "E"}` : `${Math.round(p[0])}, ${Math.round(p[1])} m`;
  const z = S2.world.place.groundAt(p[0], p[1]);
  const prov = S2.world.place.terrain?.provenanceAt?.(p[0], p[1]);
  $("whereGround").textContent = S2.world.place.terrain ? `${z.toFixed(0)} m${prov && prov !== "measured" ? ` \xB7 ${prov}` : ""}` : "";
}
$("whereAmI").onclick = async () => {
  const p = S2.pointer || [S2.cam.target[0], S2.cam.target[1]];
  const ll = toLatLon(p[0], p[1]);
  const text = ll ? `${ll[0].toFixed(6)}, ${ll[1].toFixed(6)}` : `${Math.round(p[0])}, ${Math.round(p[1])}`;
  try {
    await navigator.clipboard.writeText(text);
    toast(`${text} \u2014 copied. Paste it into Take me anywhere, or send it to someone.`);
  } catch {
    toast(text);
  }
};
$("attribution").onclick = () => $("attribution").classList.toggle("open");
function openThemeMenu() {
  document.querySelector(".themeMenu")?.remove();
  const menu = document.createElement("div");
  menu.className = "menu themeMenu";
  const r = $("themeChip").getBoundingClientRect();
  menu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
  menu.style.top = `${r.bottom + 8}px`;
  const now = localStorage.getItem("creo.theme") || "dark";
  const why = {
    dark: "a lit room",
    black: "outdoors at night, and for saving a phone",
    light: "daylight, and a lit model",
    parchment: "a surveyed drawing rather than a photograph",
    ink: "the land recedes so the lines carry everything"
  };
  for (const t of THEME_LIST) {
    const b = document.createElement("button");
    b.className = t.key === now ? "on" : "";
    b.innerHTML = `<span class="swatch" style="background:${t.swatch}"></span>${t.label}<span class="sub">${why[t.key] || ""}</span>`;
    b.onclick = () => {
      menu.remove();
      applyTheme(t.key);
    };
    menu.append(b);
  }
  document.body.append(menu);
  setTimeout(() => document.addEventListener("pointerdown", function off(ev) {
    if (!menu.contains(ev.target) && ev.target !== $("themeChip")) {
      menu.remove();
      document.removeEventListener("pointerdown", off);
    }
  }), 0);
}
function applyTheme(name) {
  const t = setTheme(name);
  document.body.classList.toggle("day", isLight(t));
  document.body.className = document.body.className.replace(/\btheme-\S+/g, "").trim();
  document.body.classList.add(`theme-${t}`);
  remember("creo.theme", t);
  const meta = THEME_LIST.find((x) => x.key === t);
  $("themeChip").innerHTML = `<span class="swatch" style="background:${meta?.swatch || "#222"}"></span>`;
  $("themeChip").title = `${meta?.label || t} \u2014 tap to choose (T)`;
  invalidate({ plan: true });
  S2.dirty = true;
  return t;
}
$("themeChip").onclick = openThemeMenu;
$("dropBtn").onclick = () => {
  if (inHand) {
    inHand = null;
    $("dropBtn").classList.remove("on");
    toast("Put it down.");
    return;
  }
  takeInHand(boxBody({ name: "House", width: 12, depth: 8, height: 3.2 }));
  $("dropBtn").classList.add("on");
  toast("A 12\xD78 m house, in hand. Tap the ground to seat it \u2014 it will be turned along the contour and the earthwork measured. Drop a .glb on the say bar for your own.");
};
$("planOut").onclick = () => {
  minimap.zoom(1.6);
  invalidate({ plan: true });
  sayPlanReach();
};
$("planIn").onclick = () => {
  minimap.zoom(1 / 1.6);
  invalidate({ plan: true });
  sayPlanReach();
};
function sayPlanReach() {
  const t = S2.world.place.terrain;
  if (!t) return;
  const loaded = (t.bounds[2] - t.bounds[0]) / 1e3;
  const shown = loaded * minimap.out;
  toast(minimap.out > 1.02 ? `Plan showing ${shown.toFixed(1)} km \u2014 ${loaded.toFixed(1)} km of it is ground CREO has. Beyond that is nothing yet.` : `Plan showing ${loaded.toFixed(1)} km of real ground.`);
}
$("exploreBtn").onclick = async () => {
  minimap.explore = !minimap.explore;
  minimap.pick = null;
  $("exploreBtn").classList.toggle("on", minimap.explore);
  $("plan").classList.toggle("exploring", minimap.explore);
  $("exploreHint").hidden = !minimap.explore;
  $("exploreGo").hidden = true;
  if (!minimap.explore) {
    minimap.preview = null;
    S2.dirty = true;
    return;
  }
  describePick(null);
  await refreshNeighbours();
  S2.dirty = true;
  try {
    $("exploreWhere").textContent = "looking at the ground around you\u2026";
    minimap.preview = await previewGround(S2.world, { span: 3 });
    S2.dirty = true;
    describePick(minimap.pick);
  } catch (err) {
    minimap.preview = null;
    describePick(minimap.pick);
    console.warn("[CREO] no preview of the surrounding ground:", err.message);
  }
};
$("plan").hidden = false;
$("planBtn").classList.add("on");
setMode_("auto");
setMode("select");
setAuthor(localStorage.getItem("creo.author") || "");
(async () => {
  let key2 = localStorage.getItem("creo.place") || "settlement";
  try {
    const metas = await listCached() || [];
    const m = metas.find((p) => p.key === key2);
    const weight = m ? (m.counts?.buildings || 0) + (m.counts?.roads || 0) + (m.counts?.paths || 0) : 0;
    if (weight > 6e3) {
      setTimeout(() => toast(`${m.name} is downtown-sized \u2014 open it from the place picker when you want it. Starting light.`), 600);
      key2 = "settlement";
    }
  } catch (_) {
  }
  loadPlace(key2).catch((err) => reportFailure("Could not open that place", err));
})();
wireDropTarget();
applyTheme(localStorage.getItem("creo.theme") || "dark");
if (shouldShowHelp()) setTimeout(() => openHelp(), 600);
else if (!S2.author) setTimeout(() => toast("Tap \u201Cadd your name\u201D at the top so the place can remember who changed what."), 900);
if (!hasKey() && !localStorage.getItem("creo.sawSetup") && !shouldShowHelp()) {
  setTimeout(() => {
    if (!hasKey()) openAIPanel();
  }, 1200);
}
requestAnimationFrame(frame);
addEventListener("resize", () => {
  invalidate({ plan: true });
});
function reportFailure(what, err) {
  const msg = String(err?.message || err || "unknown");
  console.error(`[CREO] ${what}:`, err);
  toast(`${what}: ${msg.slice(0, 120)}`);
  S2.lastError = { what, message: msg, stack: String(err?.stack || ""), at: (/* @__PURE__ */ new Date()).toISOString() };
}
addEventListener("error", (e) => reportFailure("Something broke", e.error || e.message));
addEventListener("unhandledrejection", (e) => reportFailure("A request failed", e.reason));
window.CREO = {
  S: S2,
  saySomething,
  context,
  runAssistant,
  world: () => S2.world,
  interpret: (t) => interpret(t, context()),
  plan: (t) => {
    const c = context();
    return plan(S2.world, interpret(t, c), c);
  },
  select: (ids) => {
    S2.selection = new Set(ids);
    S2.dirty = true;
    showTools();
  },
  frameAll,
  openNote,
  openHelp,
  runAssistant,
  setMode: setMode_,
  openFindPanel,
  goToEntity,
  openSetup: openAIPanel,
  askSubject,
  showTools,
  rankModel,
  captureView,
  PREFERRED,
  drawPointAt: (x, y) => drawPoint(x, y),
  takeInHand,
  placeInHand,
  unseat,
  bodyFromURL,
  boxBody,
  inHand: () => inHand,
  seated: () => seated,
  get minimap() {
    return minimap;
  },
  _minimap: () => minimap,
  pointAt: (p) => {
    S2.pointer = p;
  },
  draw: (pts, closed) => {
    S2.stroke = pts;
    S2.strokeClosed = closed;
    S2.dirty = true;
  },
  commit: () => $("propCommit").click(),
  loadPlace
};
addEventListener("keydown", (ev) => {
  if ((ev.key === "v" || ev.key === "V") && S2.world && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
    RIG.toggle(S2.world, S2.cam);
    S2.dirty = true;
  }
});
addEventListener("rig:worldchanged", () => {
  S2.dirty = true;
  lastInputAt = Date.now();
});
mountDoor(S2, () => {
  autoMount(S2.world, S2.cam);
  ATLAS.bind(S2.world);
  S2.dirty = true;
});
mountConsole(S2);
setTimeout(() => {
  try {
    mountRing(S2);
    S2.showPlan = true;
    S2.dirty = true;
  } catch (e) {
    console.warn("[ring]", e);
  }
}, 300);
async function landAt(query) {
  if (S2.busy) return "still fetching the last ground";
  let q = String(query || "").trim();
  let metres = 0;
  const at = q.match(/@\s*(\d{2,5})\s*$/);
  if (at) {
    metres = +at[1];
    q = q.slice(0, at.index).trim();
  }
  if (metres > 2400) return landPack(q, metres);
  S2.busy = true;
  try {
    if (!q || /^here$/i.test(q)) {
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("no GPS in this browser \u2014 name a place instead"));
        navigator.geolocation.getCurrentPosition(
          (g) => res(g.coords),
          () => rej(new Error("GPS declined \u2014 name a place instead")),
          { timeout: 1e4 }
        );
      });
      q = pos.latitude.toFixed(5) + ", " + pos.longitude.toFixed(5);
    }
    landCard("\u25CD LANDING");
    landGrid(false);
    landStep(`finding \u201C${q}\u201D on Earth\u2026`);
    const found = await resolvePlace(q, { metres: metres || 900 });
    landCard("\u25CD " + String(found.short || found.name || q).split(",")[0].toUpperCase());
    landStep("reading the ground\u2026");
    const { world, key: key2, name, stats: stats2 } = await importPlace({
      bbox: found.bbox,
      name: found.short || found.name,
      metres: metres || 900,
      log: (m) => landStep(m)
    });
    await cachePut(key2, {
      payload: world.save(),
      meta: {
        key: key2,
        name,
        counts: stats2,
        relief: world.place.meta?.relief || 0,
        bbox: world.place.meta?.bbox,
        fetchedAt: world.place.meta?.fetchedAt,
        source: "OpenStreetMap (ODbL)"
      }
    });
    adoptWorld(world, key2, name);
    const gone = await pruneCache(14, key2);
    _metasCache.list = null;
    landDone(`${stats2.buildings || 0} buildings \xB7 ${world.place.meta?.relief || 0} m relief` + (gone.length ? ` \xB7 ${gone.length} oldest window${gone.length > 1 ? "s" : ""} released` : ""));
  } catch (err) {
    landDone(null);
    toast("TERRA: " + String(err.message || err).slice(0, 80));
  } finally {
    S2.busy = false;
  }
}
var LAND = { el: null, grid: null, step: null, head: null, cells: [] };
function landCard(head) {
  if (!LAND.el) {
    const el = document.createElement("div");
    el.id = "land-card";
    el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:88;min-width:250px;max-width:min(400px,92vw);background:rgba(10,14,18,.94);border:1px solid rgba(120,200,170,.42);border-radius:14px;padding:16px 20px;color:#cfe8dd;font:700 12px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-align:center;box-shadow:0 14px 44px rgba(0,0,0,.6);backdrop-filter:blur(12px);";
    const h = document.createElement("div");
    const g = document.createElement("div");
    g.style.cssText = "display:grid;grid-template-columns:repeat(3,16px);gap:3px;justify-content:center;margin:11px 0 9px;";
    for (let i = 0; i < 9; i++) {
      const c = document.createElement("div");
      c.style.cssText = "width:16px;height:16px;border-radius:3px;border:1px solid rgba(151,187,213,.3);background:transparent;";
      g.appendChild(c);
      LAND.cells.push(c);
    }
    const s = document.createElement("div");
    s.style.cssText = "font:500 10px/1.4 system-ui,sans-serif;letter-spacing:.02em;color:#8fb8a8;min-height:14px;";
    el.append(h, g, s);
    document.body.appendChild(el);
    LAND.el = el;
    LAND.grid = g;
    LAND.step = s;
    LAND.head = h;
  }
  LAND.el.style.display = "block";
  if (head) LAND.head.textContent = head;
  return LAND;
}
var landStep = (text) => {
  if (LAND.step) LAND.step.textContent = String(text).slice(0, 90);
};
var landGrid = (on) => {
  if (LAND.grid) LAND.grid.style.display = on ? "grid" : "none";
};
function landCell(i, state) {
  const c = LAND.cells[i];
  if (!c) return;
  c.style.background = state === "done" ? "#6fe0c0" : state === "busy" ? "rgba(111,224,192,.42)" : state === "failed" ? "rgba(223,90,93,.55)" : "transparent";
}
var landDone = (msg) => {
  if (!LAND.el) return;
  if (msg) {
    landStep(msg);
    setTimeout(() => {
      if (LAND.el) LAND.el.style.display = "none";
    }, 2600);
  } else LAND.el.style.display = "none";
};
var CELL_OF = { "0,0": 4, "0,1": 1, "1,0": 5, "0,-1": 7, "-1,0": 3, "1,1": 2, "1,-1": 8, "-1,-1": 6, "-1,1": 0 };
var _packRun = 0;
async function landPack(q, metres) {
  const run = ++_packRun;
  const tileM = Math.min(1400, Math.max(900, Math.round(metres / 3)));
  const covered = tileM * 3;
  let found;
  S2.busy = true;
  landCard("\u25CD CITYPACK");
  landGrid(true);
  for (let i = 0; i < 9; i++) landCell(i, "idle");
  landStep(`finding \u201C${q}\u201D on Earth\u2026`);
  try {
    found = await resolvePlace(q, { metres: tileM });
  } catch (err) {
    S2.busy = false;
    landDone(null);
    toast("TERRA: " + String(err.message || err).slice(0, 80));
    return;
  }
  const lat0 = found.lat ?? (found.bbox[0] + found.bbox[2]) / 2;
  const lon0 = found.lon ?? (found.bbox[1] + found.bbox[3]) / 2;
  const base = (found.short || found.name || q).split(",")[0];
  const dLat = tileM / 111320;
  const dLon = tileM / (111320 * Math.max(0.05, Math.cos(lat0 * Math.PI / 180)));
  const ORDER = [[0, 0], [0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, -1], [-1, 1]];
  const tag2 = ([di, dj]) => di || dj ? (dj > 0 ? "N" : dj < 0 ? "S" : "") + (di > 0 ? "E" : di < 0 ? "W" : "") : "\xB7";
  landCard("\u25CD CITYPACK \u2014 " + base.toUpperCase());
  if (metres > covered + 200) landStep(`a 3\xD73 pack covers ${covered} m of the @${metres} asked`);
  let landed = 0, uncached = 0;
  for (let k = 0; k < ORDER.length; k++) {
    if (run !== _packRun) {
      if (k === 0) S2.busy = false;
      return;
    }
    const [di, dj] = ORDER[k];
    const centre = di === 0 && dj === 0;
    const cell = CELL_OF[`${di},${dj}`];
    const latC = lat0 + dj * dLat, lonC = lon0 + di * dLon;
    const bbox2 = [latC - dLat / 2, lonC - dLon / 2, latC + dLat / 2, lonC + dLon / 2];
    const name = `${base} \xB7 ${tag2(ORDER[k])}`;
    try {
      landCell(cell, "busy");
      landStep(`${k + 1}/9 \xB7 ${centre ? "the centre" : tag2(ORDER[k])} \u2014 asking OpenStreetMap\u2026`);
      const { world, key: key2, name: got, stats: stats2 } = await importPlace({
        bbox: bbox2,
        name,
        metres: tileM,
        log: (m) => landStep(`${k + 1}/9 \xB7 ${m}`)
      });
      if (run !== _packRun) return;
      try {
        await cachePut(key2, {
          payload: world.save(),
          meta: {
            key: key2,
            name: got,
            counts: stats2,
            pack: base,
            relief: world.place.meta?.relief || 0,
            bbox: world.place.meta?.bbox,
            fetchedAt: world.place.meta?.fetchedAt,
            source: "OpenStreetMap (ODbL)"
          }
        });
        _metasCache.list = null;
      } catch (_) {
        uncached++;
      }
      landed++;
      landCell(cell, "done");
      if (centre) {
        adoptWorld(world, key2, got);
        landStep(`the centre stands \u2014 drive it while the ring arrives (${8 - k} to go)`);
      }
    } catch (err) {
      landCell(cell, "failed");
      if (centre) {
        landDone("the centre failed \u2014 " + String(err.message || err).slice(0, 50));
        S2.busy = false;
        return;
      }
      landStep(`${k + 1}/9 \xB7 ${tag2(ORDER[k])} failed \u2014 ` + String(err.message || err).slice(0, 50));
    } finally {
      if (centre) S2.busy = false;
    }
    if (k < ORDER.length - 1) await new Promise((res) => setTimeout(res, 1400));
  }
  if (run === _packRun) {
    const gone = await pruneCache(20, S2.placeKey);
    _metasCache.list = null;
    landDone(`${landed}/9 windows in this browser` + (uncached ? ` (${uncached} would not cache \u2014 storage is full)` : "") + (gone.length ? ` \xB7 ${gone.length} older released` : "") + " \xB7 drive to an edge to cross");
  }
}
var _metasCache = { at: 0, list: null };
async function cachedMetas() {
  if (!_metasCache.list || Date.now() - _metasCache.at > 8e3) {
    _metasCache = { at: Date.now(), list: await listCached() || [] };
  }
  return _metasCache.list;
}
async function neighbourMeta(dir) {
  const bbox2 = S2.world?.place?.meta?.bbox;
  if (!bbox2) return null;
  const [s, w, n, e] = bbox2;
  const H = n - s, W = e - w;
  const cLat = (s + n) / 2, cLon = (w + e) / 2;
  const metas = await cachedMetas();
  const mine = metas.find((m) => m.key === S2.placeKey);
  let best = null, bestErr = Infinity;
  for (const m of metas) {
    const b = m.bbox;
    if (!b || m.key === S2.placeKey) continue;
    const bH = b[2] - b[0], bW = b[3] - b[1];
    const wantLat = cLat + dir[1] * (H + bH) / 2;
    const wantLon = cLon + dir[0] * (W + bW) / 2;
    const errLat = ((b[0] + b[2]) / 2 - wantLat) / Math.min(H, bH);
    const errLon = ((b[1] + b[3]) / 2 - wantLon) / Math.min(W, bW);
    let err = Math.hypot(errLat, errLon);
    if (err > 0.4) continue;
    if (mine?.pack && m.pack === mine.pack) err *= 0.5;
    if (err < bestErr) {
      bestErr = err;
      best = m;
    }
  }
  return best;
}
var _edgeAt = 0;
var _edgeHintAt = 0;
var _crossing = false;
async function crossEdge(dir) {
  if (_crossing || S2.busy) return;
  _crossing = true;
  try {
    const key0 = S2.placeKey, world0 = S2.world;
    const P0 = world0.place.projection;
    if (!P0 || !P0.toWGS84) return;
    const [lat, lon] = P0.toWGS84(RIG.p[0], RIG.p[1]);
    const keep = { dist: S2.cam.dist, yaw: S2.cam.yaw, pitch: S2.cam.pitch };
    const m = await neighbourMeta(dir);
    if (!m) {
      if (Date.now() - _edgeHintAt > 9e3) {
        _edgeHintAt = Date.now();
        const bbox2 = world0.place.meta?.bbox;
        if (bbox2) {
          const midLat = (bbox2[0] + bbox2[2]) / 2;
          const spanM = dir[1] !== 0 ? Math.round((bbox2[2] - bbox2[0]) * 111320) : Math.round((bbox2[3] - bbox2[1]) * 111320 * Math.cos(midLat * Math.PI / 180));
          const sLat = (midLat + dir[1] * (bbox2[2] - bbox2[0])).toFixed(4);
          const sLon = ((bbox2[1] + bbox2[3]) / 2 + dir[0] * (bbox2[3] - bbox2[1])).toFixed(4);
          toast(`the ground ends \u2014 say: land ${sLat}, ${sLon} @${spanM} to pull the next window`);
        }
      }
      return;
    }
    toast(`\u2192 crossing into ${m.name}`);
    const metas = await cachedMetas();
    const mine = metas.find((x2) => x2.key === key0);
    if (mine) {
      try {
        await cachePut(key0, { payload: world0.save(), meta: mine });
        _metasCache.list = null;
      } catch (_) {
      }
    }
    if (S2.placeKey !== key0 || !RIG.on) return;
    const world2 = await loadCached(m.key);
    if (S2.placeKey !== key0 || !RIG.on) return;
    adoptWorld(world2, m.key, m.name);
    const P2 = world2.place.projection;
    const db2 = world2.place.meta?.detailBounds || world2.place.terrain?.bounds;
    let [x, y] = P2 && P2.toLocal ? P2.toLocal(lat, lon) : [0, 0];
    x += dir[0] * 10;
    y += dir[1] * 10;
    if (db2) {
      x = Math.min(Math.max(x, db2[0] + 4), db2[2] - 4);
      y = Math.min(Math.max(y, db2[1] + 4), db2[3] - 4);
    }
    RIG.p = [x, y];
    S2.cam.target = [x, y, world2.place.groundAt(x, y) + 1.1];
    S2.cam.dist = keep.dist;
    if (keep.yaw != null) S2.cam.yaw = keep.yaw;
    if (keep.pitch != null) S2.cam.pitch = keep.pitch;
    S2.dirty = true;
  } catch (err) {
    toast("the seam refused: " + String(err.message || err).slice(0, 60));
  } finally {
    _crossing = false;
  }
}
BUS.register(
  "land",
  (t, raw) => raw.match(/^(?:land|terra)(?:\s+(.+))?$/i),
  (m) => {
    landAt(m[1] || "here");
    return "fetching real ground \u2014 watch the field";
  },
  "land <place> \u2014 real ground anywhere \xB7 @1800 widens \xB7 @4000 lands a 3\xD73 citypack with drivable seams"
);
PERF.install({ renderer });
setTimeout(() => {
  if (S2.world) PERF.install({ world: S2.world });
}, 1500);
if (typeof window !== "undefined") window.TERRA = { S: S2, RIG, renderer, ATLAS, plan: () => minimap, redrawPlan: () => {
  try {
    if (minimap && S2.showPlan) minimap.draw(S2.world, { camera: S2.cam, selection: S2.selection, hidden: hiddenTypes(S2.layersOff) });
  } catch (_) {
  }
} };
console.info("%c[creo-unset-04] PERF ready \u2014 press P \xB7 PERF.report() \xB7 PERF.loads() \xB7 PERF.watch(120)", "color:#6fe0c0");
export {
  MOBILE,
  bodyFromURL,
  stats
};
