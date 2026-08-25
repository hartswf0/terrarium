const RUNTIME_SRC='./ARGOSHALFDOGSCULPTEDv01.html';
const $=s=>document.querySelector(s);
const LOOKS={
 ARGOS:{key:'argos',accent:'#a36f36',palette:[[171,123,75],[212,194,161],[202,183,157],[34,30,25],[245,240,228],[89,59,31],[7,6,5],[151,117,96],[28,9,7],[235,222,190],[142,65,70]]},
 'SÁMR':{key:'samr',accent:'#39352e',palette:[[57,53,46],[106,99,83],[82,76,66],[20,20,19],[244,241,230],[169,111,44],[5,5,5],[74,67,60],[17,5,5],[235,225,199],[137,53,61]]},
 GOODYEAR:{key:'goodyear',accent:'#c19d5c',palette:[[222,200,156],[241,226,194],[232,207,177],[44,38,31],[251,248,238],[106,70,35],[8,7,6],[191,145,125],[23,7,6],[245,235,207],[177,76,86]]},
 SILAS:{key:'silas',accent:'#58676d',palette:[[88,103,109],[169,181,179],[147,163,164],[24,29,31],[236,241,238],[112,158,165],[5,7,8],[92,109,111],[13,18,19],[229,232,218],[145,74,78]]}
};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export class DogLab{
 constructor(exp,key){this.exp=exp;this.key=key;this.char=null;this.win=null;this.history=[];this.relations=new Map();this.time=0;this.ready=false;this.lastState=null;this.token=0;}
 boot(){const f=$('#animal');f.src=RUNTIME_SRC;f.addEventListener('load',()=>this.attach(f),{once:true});}
 attach(frame){let win,doc;try{win=frame.contentWindow;doc=frame.contentDocument}catch(e){return this.fail('Serve HALF-DOG from the same origin as the dog runtime.')}this.win=win;
  const finish=()=>{const c=win.ArgosCharacter;if(!c)return false;this.char=c;this.ready=true;this.strip(doc);this.look();this.mobileCamera();this.exp.init(this);this.render();return true};
  if(finish())return;win.addEventListener('argos:ready',finish,{once:true});setTimeout(()=>{if(!this.ready)this.fail('Dog runtime did not start.')},2600);
 }
 strip(doc){const s=doc.createElement('style');s.textContent='header,#mind,#chatWrap,#dock{display:none!important}#stage{inset:0!important;width:100%!important;height:100%!important}html,body{overflow:hidden!important}';doc.head.appendChild(s)}
 look(){const look=LOOKS[this.exp.title]||LOOKS.ARGOS;document.documentElement.style.setProperty('--accent',look.accent);if(Array.isArray(this.win.MAT_RGB_DOG)){for(let i=0;i<look.palette.length;i++)this.win.MAT_RGB_DOG[i]=look.palette[i].slice()}}
 mobileCamera(){const AR=this.win.AR;if(!AR||typeof AR.makeCam!=='function'||AR.__halfDogPlayCam)return;const base=AR.makeCam;AR.__halfDogPlayCam=true;const win=this.win;AR.makeCam=(pos,target,fov)=>{if(Math.abs((+fov||0)-32)<.01&&win.ArgosCharacter?.world){const aspect=Math.max(.34,win.innerWidth/Math.max(1,win.innerHeight));const hf=48*Math.PI/180;const vf=2*Math.atan(Math.tan(hf/2)/aspect)*180/Math.PI;const F=aspect<1?Math.min(78,Math.max(48,vf)):fov;const h=+win.ArgosCharacter.world.heading||0,forward=aspect<1?.16:.08,sx=Math.sin(h)*forward,sz=Math.cos(h)*forward;return base([pos[0]+sx,pos[1]-.035,pos[2]+sz],[target[0]+sx,target[1]-.035,target[2]+sz],F)}return base(pos,target,fov)}}
 resetShared(){this.token++;this.history=[];this.relations.clear();this.time=0;const c=this.char;c.setAutonomy(true).stop().setPose(null).lookAt(null);c.applyProgram({iv:{hunger:-.25,thirst:-.2,happiness:.12,aggression:-.12,fatigue:-.18,fetchDesire:0,guilt:0},prefer:{WANDER:.04},cue:'',reading:'reset'})}
 setHuman(p){this.char.setSensors({human:[p[0],0,p[1]],lure:[p[0],0,p[1]]})}
 setNeeds(p){this.char.applyProgram({iv:p,prefer:{},cue:'',reading:'world consequence'})}
 bias(name,amount,reading=''){this.char.setAutonomy(true);this.char.applyProgram({iv:{},prefer:{[name]:amount},cue:'',reading})}
 task(name,p,strength=.85){this.setHuman(p);this.char.setAutonomy(true);this.char.applyProgram({iv:{},prefer:{[name]:strength},cue:'',reading:'task through arbitration'})}
 directMove(p,speed=1.2){this.char.setAutonomy(false).moveTo([p[0],0,p[1]],speed)}
 stopDirect(){this.char.stop().setAutonomy(true)}
 play(name){try{this.char.play(name)}catch(e){}}
 remember(actor,kind,amount=1){this.history.push({t:this.time,actor,kind,amount});if(this.history.length>160)this.history.shift()}
 evidence(actor,kind,half=45){let total=0;for(const e of this.history)if(e.actor===actor&&e.kind===kind)total+=e.amount*Math.exp(-(this.time-e.t)/half);return total}
 after(ms,fn){const t=this.token;setTimeout(()=>{if(t===this.token)fn()},ms)}
 moment(title,body='',ms=1800){$('#momentTitle').textContent=title;$('#momentBody').textContent=body;$('#moment').classList.add('show');if(navigator.vibrate)navigator.vibrate(title.includes('KILLED')||title.includes('FORCED')?[35,30,70]:25);clearTimeout(this._momentTimer);this._momentTimer=setTimeout(()=>$('#moment').classList.remove('show'),ms)}
 fail(msg){this.moment('IT DID NOT LOAD',msg,5000)}
 render(){if(!this.ready)return;this.lastState=this.char.getState?.()||this.lastState;$('#title').textContent=this.exp.title;$('#story').textContent=this.exp.story;$('#prompt').textContent=this.exp.prompt(this,this.lastState);$('#sceneTag').textContent=this.exp.sceneTag?.(this,this.lastState)||'';$('#round').textContent=this.exp.round?.(this,this.lastState)||'';$('#whyText').textContent=this.exp.why(this,this.lastState);this.renderActions();this.renderState();}
 renderActions(){const box=$('#actions');box.innerHTML='';for(const a of this.exp.actions(this,this.lastState)){const b=document.createElement('button');b.className='act '+(a.kind||'');b.textContent=a.label;b.onclick=()=>{a.run();this.render()};box.appendChild(b)}}
 renderState(){const box=$('#state');box.innerHTML='';for(const [k,v] of (this.exp.state?.(this,this.lastState)||[])){const d=document.createElement('div');d.innerHTML=`${k}<b>${v}</b>`;box.appendChild(d)}}
 loop(ts){if(!this.ready)return;const t=ts/1000,dt=this._last?Math.min(.05,t-this._last):.016;this._last=t;this.time+=dt;this.lastState=this.char.getState?.()||this.lastState;this.exp.update?.(this,dt,this.lastState);this.render();requestAnimationFrame(x=>this.loop(x))}
}
export function mountLab(exp,key){const lab=new DogLab(exp,key);document.title=exp.title+' · HALF-DOG';const strip=$('#dogstrip');for(const k of ['argos','samr','goodyear','silas']){const a=document.createElement('a');a.href='./lab.html?dog='+k;a.className=k===key?'on':'';strip.appendChild(a)}$('#whyBtn').onclick=()=>$('#whyPanel').classList.toggle('open');lab.boot();window.lab=lab;requestAnimationFrame(t=>lab.loop(t));}
