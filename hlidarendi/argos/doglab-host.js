
const RUNTIME_SRC="./ARGOSHALFDOGSCULPTEDv01.html";
const $=s=>document.querySelector(s);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

const DOG_LOOKS={
  ARGOS:{label:"weathered ochre",accent:"#ab7b4b",palette:[[171,123,75],[212,194,161],[202,183,157],[34,30,25],[245,240,228],[89,59,31],[7,6,5],[151,117,96],[28,9,7],[235,222,190],[142,65,70]]},
  SAMR:{label:"dark sentinel",accent:"#39352e",palette:[[57,53,46],[106,99,83],[82,76,66],[20,20,19],[244,241,230],[169,111,44],[5,5,5],[74,67,60],[17,5,5],[235,225,199],[137,53,61]]},
  GOODYEAR:{label:"pale companion",accent:"#c7a974",palette:[[222,200,156],[241,226,194],[232,207,177],[44,38,31],[251,248,238],[106,70,35],[8,7,6],[191,145,125],[23,7,6],[245,235,207],[177,76,86]]},
  SILAS:{label:"synthetic graphite",accent:"#58676d",palette:[[88,103,109],[169,181,179],[147,163,164],[24,29,31],[236,241,238],[112,158,165],[5,7,8],[92,109,111],[13,18,19],[229,232,218],[145,74,78]]}
};

const fmt=v=>typeof v==="number"?v.toFixed(2):String(v);

export class DogLab {
  constructor(exp){
    this.exp=exp; this.char=null; this.history=[]; this.relations=new Map();
    this.time=0; this.ready=false; this.lastState=null; this.lastPos=null; this.alive=true;
    this.frame=$("#animal"); this.events=$("#events"); this.state=$("#state"); this.causal=$("#causal");
  }
  async boot(){
    this.frame.src=RUNTIME_SRC;
    this.frame.addEventListener("load",()=>this.attach(),{once:true});
  }
  attach(){
    let win,doc;
    try{ win=this.frame.contentWindow; doc=this.frame.contentDocument; }
    catch(e){ return this.fail("The experiment must be served from the same origin/path as ARGOSHALFDOGSCULPTEDv01.html."); }
    if(!win || !doc) return this.fail("Runtime frame unavailable.");
    const finish=()=>{
      const c=win.ArgosCharacter;
      if(!c) return false;
      this.char=c; this.ready=true;
      this.stripRuntimeChrome(doc);
      this.applyLook(win);
      this.exp.init(this);
      this.mountControls();
      this.add("RUNTIME","ArgosCharacter "+c.version+" attached");
      requestAnimationFrame(t=>this.loop(t));
      return true;
    };
    if(finish()) return;
    win.addEventListener("argos:ready",()=>finish(),{once:true});
    setTimeout(()=>{if(!this.ready)this.fail("ArgosCharacter did not expose its host contract.");},2500);
  }
  stripRuntimeChrome(doc){
    const s=doc.createElement("style");
    s.textContent=`header,#mind,#chatWrap,#dock{display:none!important}#stage{inset:0!important;width:100%!important;height:100%!important}html,body{background:#f2ecdf!important}`;
    doc.head.appendChild(s);
  }

  applyLook(win){
    const look=DOG_LOOKS[this.exp.title]||DOG_LOOKS.ARGOS;
    if(Array.isArray(win.MAT_RGB_DOG)){
      for(let i=0;i<look.palette.length;i++) win.MAT_RGB_DOG[i]=look.palette[i].slice();
    }
    document.documentElement.style.setProperty("--dog-accent",look.accent);
    const badge=document.getElementById("look");
    if(badge) badge.textContent=look.label.toUpperCase();
  }

  fail(msg){ $("#status").textContent=msg; $("#status").classList.add("bad"); }
  resetShared(){
    this.history=[];this.relations.clear();this.time=0;this.alive=true;this.lastPos=null;
    const c=this.char;
    c.setAutonomy(true).stop().setPose(null).lookAt(null);
    c.applyProgram({iv:{hunger:-.2,thirst:-.2,happiness:.15,aggression:-.1,fatigue:-.15,fetchDesire:0,guilt:0},prefer:{WANDER:.15},cue:"",reading:"reset"});
  }
  add(kind,detail="",actor=""){
    const e={t:this.time,kind,detail,actor};this.history.push(e);
    if(this.history.length>300)this.history.shift();
    this.renderEvents();
    return e;
  }
  remember(actor,kind,amount=1){
    this.add(kind,String(amount),actor);
  }
  evidence(actor,kind,halfLife=45){
    let total=0;
    for(const e of this.history){
      if(e.actor!==actor || e.kind!==kind)continue;
      const age=this.time-e.t;
      total += (+e.detail||0)*Math.exp(-age/halfLife);
    }
    return total;
  }
  relation(actor,relation,orientation){
    this.relations.set(actor,{relation,orientation});
  }
  discriminate(actor){
    const r=this.relations.get(actor);
    if(!r)return "UNKNOWN";
    return (r.relation==="enemy" || r.orientation==="ill")?"THREAT":"PERMIT";
  }
  setHuman(p){ this.char.setSensors({human:[p[0],0,p[1]],lure:[p[0],0,p[1]]}); }
  bias(name,amount,reading=""){
    this.char.setAutonomy(true);
    this.char.applyProgram({iv:{},prefer:{[name]:amount},cue:"",reading});
  }
  setNeeds(patch){
    this.char.applyProgram({iv:patch,prefer:{},cue:"",reading:"world consequence"});
  }
  directMove(p,speed=1.2){
    this.char.setAutonomy(false).moveTo([p[0],0,p[1]],speed);
  }
  stopDirect(){ this.char.stop().setAutonomy(true); }
  task(name,p,strength=.85){
    this.setHuman(p);
    this.char.setAutonomy(true);
    this.char.applyProgram({iv:{},prefer:{[name]:strength},cue:"",reading:"task directive subject to behavior arbitration"});
  }
  play(name){ try{this.char.play(name);}catch(e){} }
  statePacket(){ return this.char?.getState?.()||null; }
  distanceTo(p){
    const s=this.statePacket(); if(!s?.position)return Infinity;
    return Math.hypot(s.position[0]-p[0],s.position[2]-p[1]);
  }
  mountControls(){
    const box=$("#controls");box.innerHTML="";
    for(const c of this.exp.controls(this)){
      if(c==="|"){ const sep=document.createElement("span");sep.className="sep";box.append(sep);continue; }
      const b=document.createElement("button");b.className="chip "+(c.cls||"");b.textContent=c.label;
      b.onclick=()=>{c.run();this.render();};box.append(b);
    }
    this.render();
  }
  loop(tms){
    if(!this.ready)return;
    const t=tms/1000, dt=this._last?Math.min(.05,t-this._last):.016;this._last=t;this.time+=dt;
    const s=this.statePacket();
    if(s?.position && this.lastPos){
      const d=Math.hypot(s.position[0]-this.lastPos[0],s.position[2]-this.lastPos[2]);
      if(d>.002)this.exp.onMotion?.(this,s,d);
    }
    if(s?.position)this.lastPos=s.position.slice();
    this.lastState=s;
    this.exp.update(this,dt,s);
    this.render();
    requestAnimationFrame(x=>this.loop(x));
  }
  render(){
    if(!this.ready)return;
    const rows=this.exp.state(this,this.lastState)||[];
    this.state.innerHTML=rows.map(r=>`<div class="datum ${r[2]||""}"><b>${r[0]}</b><span>${r[1]}</span></div>`).join("");
    this.causal.textContent=this.exp.causal(this,this.lastState)||"—";
    $("#status").textContent=`LIVE · ${this.exp.id} · runtime ${this.char.version}`;
  }
  renderEvents(){
    this.events.innerHTML=this.history.slice(-7).reverse().map(e=>`<div><b>${e.t.toFixed(1)}</b> ${e.kind}${e.actor?` · ${e.actor}`:""}${e.detail?` · ${e.detail}`:""}</div>`).join("");
  }
}

export function mountLab(exp){
  document.title=exp.title+" · HLIÐARENDI";
  $("#title").textContent=exp.title;
  $("#sub").textContent=exp.subtitle;
  const lab=new DogLab(exp);
  lab.boot();
  window.lab=lab;
}
