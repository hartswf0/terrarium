/* TERRARIUM III · ARCHITECTURE V4 FINALIZER
 * The legacy HELLO loop may ask a domain.request() for a post-compile fix.
 * V4 has already certified and visually observed its selected source; an external
 * unobserved repair would violate the transaction. Stop instead of silently
 * creating a new reference/build or slipping back into legacy fallback.
 */
(function(g){
'use strict';
const VERSION='iii-architecture-v4-finalize-1';
let installed=false,timer=0,blockedPostFix=0;
function install(){
  const e=g.HELLO_ENGINE,d=e?.domains?.draft,R=g.III_ARCH_RUNTIME_V4;
  if(!e?.domain||!d?.request||!d.__iiiArchitectureV4||!R)return false;
  if(d.request.__iiiV4Finalizer===VERSION){installed=true;return true}
  const raw=d.request;
  const request=async function(text,img,fix){
    if(fix&&R.isHouse(text)){
      blockedPostFix++;
      const b=R.state.current,msg='POST-V4 CERTIFICATE DRIFT · UNOBSERVED EXTERNAL REPAIR BLOCKED';
      try{await R.trace(b,'fault','Post-V4 repair blocked',String(fix?.err||fix).slice(0,1000))}catch(_){}
      try{g.III_ARCH_SUPPORT_V4?.clearDraft?.()}catch(_){}
      throw Error(msg);
    }
    return raw(text,img,fix);
  };
  Object.defineProperty(request,'__iiiV4Finalizer',{value:VERSION});
  e.domain('draft',Object.assign({},d,{request,__iiiArchitectureV4:R.VERSION}));
  installed=true;return true;
}
function arm(){if(install())return;let n=0;timer=setInterval(()=>{n++;if(install()||n>240){clearInterval(timer);timer=0}},250)}
arm();
g.III_ARCH_V4_FINALIZER=Object.freeze({version:VERSION,get stats(){return{installed,blockedPostFix}}});
})(window);
