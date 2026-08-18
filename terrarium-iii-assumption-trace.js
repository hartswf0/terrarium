/* TERRARIUM III · ARCHITECTURE V4 LOCAL BOOTSTRAP
 * Loaded after the legacy V3 compatibility module on the Pages branch.
 * Top-level await makes this import a real barrier: V4 is fully armed before
 * the serving loader proceeds to the shared fail-closed gate.
 */
try{
  await import('./terrarium-iii-collision-budget.js?v=0.2');
  await import('./terrarium-iii-architecture-v4-prompts.js?v=4.0.0');
  await import('./terrarium-iii-architecture-v4-support.js?v=4.0.0');
  await import('./terrarium-iii-architecture-v4-observer.js?v=4.0.0');
  await import('./terrarium-iii-architecture-v4-runtime.js?v=4.0.0');
  await import('./terrarium-iii-architecture-v4-orchestrator.js?v=4.0.0');
  console.info('[III ARCHITECTURE] V4 assumption contract armed', window.III_ARCHITECTURE?.version);
}catch(err){
  console.error('[III ARCHITECTURE V4] bootstrap failed',err);
}
