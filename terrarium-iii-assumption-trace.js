/* TERRARIUM III · ARCHITECTURE V4 LOCAL BOOTSTRAP
 * Top-level await is a real barrier: the whole structure compiler is armed
 * before the shared fail-closed gate is allowed to intercept AGENT drafts.
 */
try{
  await import('./terrarium-iii-collision-budget.js?v=4.1.1');
  await import('./terrarium-iii-architecture-v4-prompts.js?v=4.1.1');
  await import('./terrarium-iii-architecture-v4-support.js?v=4.1.1');
  await import('./terrarium-iii-architecture-v4-observer.js?v=4.1.1');
  await import('./terrarium-iii-architecture-v4-runtime.js?v=4.1.1');
  await import('./terrarium-iii-architecture-v4-orchestrator.js?v=4.1.1');
  await import('./terrarium-iii-architecture-v4-finalize.js?v=4.1.1');
  console.info('[III ARCHITECTURE] V4.1 structure/assumption contract armed', window.III_ARCH_RUNTIME_V4?.VERSION || window.III_ARCHITECTURE?.version);
}catch(err){
  console.error('[III ARCHITECTURE V4.1] bootstrap failed',err);
}
