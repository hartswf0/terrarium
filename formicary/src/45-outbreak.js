/* ============================================================
   45-outbreak.js — THE CORE LOOP.  OWNER: PLAY.
   See CONTRACT.md §14 and REFERENCE-EOT.md §2B.

   STUB. This currently does nothing except satisfy the interface so the build stays
   green. The PLAY builder replaces it wholesale with the real outbreak loop:
   a detector fires -> a timed, located, named outbreak opens -> the player answers it
   with the right institution before the fuse runs out -> it visibly resolves or lands.
   ============================================================ */
window.FZ = window.FZ || {};

FZ.outbreak = {
  list: [],
  mastery: {},
  enabled: false,          // PLAY sets true when the real loop is implemented
  cap: 1,

  reset(scenario) { this.list.length = 0; this.cap = (scenario && scenario.outbreakCap) || 1; },
  update(S) { /* PLAY: age fuses, land damage, expire answered marks */ },
  tryAnswer(kind, x, y) { return { hit: false, right: false, sym: null, msg: '' }; },
};
