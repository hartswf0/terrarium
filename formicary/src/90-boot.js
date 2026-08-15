/* ============================================================
   90-boot.js — wiring.  OWNER: CHAPTERS.
   Sizes the field, builds the parts that exist, runs the single rAF loop
   (the only caller of FZ.sim.step()), and opens chapter 0.
   Every call is guarded so a partial build still boots and still draws.
   ============================================================ */
(function () {
  'use strict';

  var stage, canvas, crown, lastW = 0, lastH = 0;

  function applySize(w, h) {
    lastW = w; lastH = h;
    if (FZ.sim && FZ.sim.state) { FZ.sim.state.w = w; FZ.sim.state.h = h; }
    if (FZ.render && FZ.render.resize) { try { FZ.render.resize(w, h); } catch (e) { console.error(e); } }
  }

  /* The canvas box is laid out by CSS (flex-basis 0), so its own measurement is the
     truth: the sim field and the bitmap must be exactly the box the player sees, or the
     drawing is squashed and a tap lands somewhere other than where it looked. The stage
     arithmetic is only a fallback for before first layout. */
  function sizeField() {
    if (!stage || !canvas) return;
    var w = Math.round(canvas.clientWidth);
    var h = Math.round(canvas.clientHeight);
    if (w < 40 || h < 40) {
      w = Math.round(stage.clientWidth);
      h = Math.round(stage.clientHeight);
    }
    w = Math.max(160, w); h = Math.max(120, h);
    if (w === lastW && h === lastH) return;
    applySize(w, h);
  }

  function boot() {
    stage = document.getElementById('stage');
    canvas = document.getElementById('field');
    crown = document.getElementById('crown');

    if (FZ.render && FZ.render.init && canvas) { try { FZ.render.init(canvas); } catch (e) { console.error(e); } }
    sizeField();
    if (FZ.table && FZ.table.build) { try { FZ.table.build(); } catch (e) { console.error(e); } }
    if (FZ.controls && FZ.controls.build) { try { FZ.controls.build(); } catch (e) { console.error(e); } }

    window.addEventListener('resize', sizeField, { passive: true });
    window.addEventListener('orientationchange', function () { setTimeout(sizeField, 220); });
    /* observe the canvas, not only the stage: the crown growing to a second line
       shrinks the field without changing the stage at all. */
    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(sizeField);
        if (stage) ro.observe(stage);
        if (canvas) ro.observe(canvas);
        if (crown) ro.observe(crown);
      } catch (e) { }
    }
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    if (FZ.chapters && FZ.chapters.start) { try { FZ.chapters.start(0); } catch (e) { console.error(e); } }

    requestAnimationFrame(frame);
  }

  function frame() {
    requestAnimationFrame(frame);
    var S = FZ.sim && FZ.sim.state;
    if (!S) return;

    var playing = !FZ.chapters || !FZ.chapters.phase || FZ.chapters.phase() === 'play';

    try {
      if (playing && !S.gameOver && FZ.sim.step) {
        FZ.sim.step();
        if (FZ.outbreak && FZ.outbreak.update) FZ.outbreak.update(S);
      }
    } catch (e) { console.error(e); }

    try { if (FZ.chapters && FZ.chapters.update) FZ.chapters.update(S); } catch (e) { console.error(e); }
    try { if (FZ.controls && FZ.controls.paint) FZ.controls.paint(S); } catch (e) { console.error(e); }
    try { if (FZ.table && FZ.table.paint) FZ.table.paint(S); } catch (e) { console.error(e); }
    try { if (FZ.render && FZ.render.draw) FZ.render.draw(S); } catch (e) { console.error(e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
