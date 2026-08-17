/* TERRARIUM III · REFERENCE COMMIT GUARD
 * Fail-closed reference cleanup must not disable ordinary non-reference drafts.
 */
(function(global){
'use strict';
function restoreOrdinaryCommit(){
  const proposal=document.getElementById('proposal-ui');
  const commit=document.getElementById('btn-draft-commit');
  if(!proposal||!commit)return;
  if(!proposal.classList.contains('gone')&&!global.__iiiReferenceProposalBuildId)commit.disabled=false;
}
function arm(){
  restoreOrdinaryCommit();
  const proposal=document.getElementById('proposal-ui');
  if(proposal)new MutationObserver(restoreOrdinaryCommit).observe(proposal,{attributes:true,attributeFilter:['class']});
  document.addEventListener('iii-reference-draft-cleared',()=>setTimeout(restoreOrdinaryCommit,0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm,{once:true});else arm();
})(window);
