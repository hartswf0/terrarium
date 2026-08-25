const ARGOS={
 id:"ARGOS-001/002",title:"ARGOS",subtitle:"recognition ≠ certification · body as world history",
 scenario:"A",witness:false,returned:false,publicIdentity:"DISGUISED",care:.35,shelter:.35,order:.30,absence:20,
 init(l){l.resetShared();this.scenario="A";this.witness=false;this.returned=false;this.publicIdentity="DISGUISED";this.applyHistory(l);l.char.setPose("lie");},
 condition(){return Math.max(.15,Math.min(1,.20+.30*this.care+.18*this.shelter+.24*this.order-.012*Math.max(0,this.absence-5)));},
 applyHistory(l){
   const c=this.condition();
   l.setNeeds({fatigue:(1-c)*.72,hunger:(1-c)*.38,thirst:(1-c)*.28,happiness:-(1-c)*.48});
   l.char.setPose(c<.42?"lie":c<.62?"sit":null);
   l.add("HOUSEHOLD HISTORY",`condition ${Math.round(c*100)}%`);
 },
 recognized(){return this.returned&&this.scenario!=="C";},
 interpreted(){return this.recognized()&&this.witness;},
 doReturn(l){
   this.returned=true;
   l.setHuman([1.4,1.1]);
   if(this.recognized()){
     l.char.lookAt([1.4,0.6,1.1]);l.play("SNIFF");
     l.bias("FOLLOW",1.25,"dog-specific recognition produces bodily response");
     l.remember("ODYSSEUS","recognized",1);l.add("BODILY RESPONSE","look / sniff / approach","ARGOS");
     if(this.interpreted()){this.publicIdentity="CLAIM AVAILABLE";l.add("UPTAKE","observer interprets response","OBSERVER");}
     else l.add("PRIVATE MUTUAL KNOWING","response not socially taken up");
   }else l.add("NO RECOGNITION","shared world unchanged");
 },
 controls(l){return[
   {label:"A · PRIVATE",run:()=>{this.scenario="A";this.witness=false;this.returned=false;this.publicIdentity="DISGUISED";l.add("SCENARIO","A");}},
   {label:"B · WITNESS",run:()=>{this.scenario="B";this.witness=true;this.returned=false;this.publicIdentity="DISGUISED";l.add("SCENARIO","B");}},
   {label:"C · FAIL",run:()=>{this.scenario="C";this.witness=false;this.returned=false;this.publicIdentity="DISGUISED";l.add("SCENARIO","C");}},
   "|",{label:"RETURN",cls:"good",run:()=>this.doReturn(l)},{label:"WITNESS",run:()=>{this.witness=!this.witness;l.add("WITNESS",this.witness?"present":"absent");}},
   "|",{label:"CARE +",run:()=>{this.care=Math.min(1,this.care+.15);this.applyHistory(l)}},{label:"CARE −",run:()=>{this.care=Math.max(0,this.care-.15);this.applyHistory(l)}},
   {label:"SHELTER +",run:()=>{this.shelter=Math.min(1,this.shelter+.15);this.applyHistory(l)}},{label:"SHELTER −",run:()=>{this.shelter=Math.max(0,this.shelter-.15);this.applyHistory(l)}},
   {label:"ORDER +",run:()=>{this.order=Math.min(1,this.order+.15);this.applyHistory(l)}},{label:"ORDER −",run:()=>{this.order=Math.max(0,this.order-.15);this.applyHistory(l)}},
   {label:"ABSENCE +5Y",run:()=>{this.absence=Math.min(30,this.absence+5);this.applyHistory(l)}},{label:"ABSENCE −5Y",run:()=>{this.absence=Math.max(0,this.absence-5);this.applyHistory(l)}},
   {label:"RESET",run:()=>this.init(l)}
 ]},
 update(l,dt,s){},
 state(l,s){return[
   ["DOG KNOWS",this.recognized()?"YES":"NO",this.recognized()?"good":"bad"],
   ["WITNESS",this.witness?"PRESENT":"ABSENT",this.witness?"warn":""],
   ["PUBLIC ID",this.publicIdentity,this.publicIdentity==="DISGUISED"?"":"good"],
   ["BODY",Math.round(this.condition()*100)+"%",this.condition()<.5?"bad":""],
   ["BEHAVIOR",s?.behavior||"—",""],["ABSENCE",this.absence+" YR",""]
 ]},
 causal(){return this.recognized()?`DISGUISED PERSON → DOG RECOGNITION → BODY RESPONSE → ${this.interpreted()?"THIRD-PARTY INTERPRETATION → SOCIAL CLAIM":"PRIVATE MUTUAL KNOWING"}`:"DISGUISED PERSON → NO DOG RECOGNITION → SHARED IDENTITY UNCHANGED";}
};

const SAMR={
 id:"SAMR-001/002",title:"SÁMR",subtitle:"mannsvit as relation · placement as security",
 scenario:"A",running:false,phase:0,homeCoupled:true,warning:false,breached:false,
 init(l){l.resetShared();this.scenario="A";this.running=false;this.phase=0;this.homeCoupled=true;this.warning=false;this.breached=false;
   l.relation("STRANGER","enemy","ill");l.relation("THORKELL","friend","well");l.relation("HIDDEN MEN","enemy","ill");
   l.setNeeds({aggression:.22,happiness:.04,fatigue:-.12});l.setHuman([1.4,1.1]);},
 start(l){this.running=true;this.phase=0;l.add("ENCOUNTER START",this.scenario);},
 controls(l){return[
  {label:"A · HOSTILE",run:()=>{this.init(l);this.scenario="A"}},{label:"B · NEIGHBOR",run:()=>{this.init(l);this.scenario="B"}},{label:"C · COERCED",run:()=>{this.init(l);this.scenario="C"}},
  "|",{label:"RUN ENCOUNTER",cls:"good",run:()=>this.start(l)},{label:"RESET",run:()=>this.init(l)}
 ]},
 update(l,dt,s){
   if(!this.running||!s)return;this.phase+=dt;
   if(this.scenario==="A"){
     const p=[1.4-this.phase*.18,1.1];l.setHuman(p);
     if(this.phase>2.0&&this.phase<2.1){l.setNeeds({aggression:.55});l.bias("LURE",1.2,"enemy of Gunnar / ill orientation");l.play("BARK");l.add("THREAT","correctly discriminated","STRANGER");}
   } else if(this.scenario==="B"){
     const p=[1.4-this.phase*.15,1.1];l.setHuman(p);
     if(this.phase>2&&this.phase<2.1){l.setNeeds({happiness:.16,aggression:-.08});l.add("PERMIT","friend + well","THORKELL");}
   } else {
     const p=[1.4-this.phase*.10,1.1+Math.min(1.9,this.phase*.28)];l.setHuman(p);
     if(this.phase>1.1&&this.phase<1.2){l.bias("LURE",1.15,"follow familiar local intermediary");l.add("COERCED ACCESS","neighbor draws sentinel away","THORKELL");}
     this.homeCoupled = (s.position?.[2]||0)<1.25;
     if(this.phase>5.1&&this.phase<5.2){l.setHuman([.55,2.6]);l.setNeeds({aggression:.7});l.play("BARK");l.add("DETECT","hidden enemies correctly recognized","SÁMR");}
     if(this.phase>6.3&&l.alive){l.alive=false;this.warning=true;this.breached=true;l.char.setAutonomy(false).stop().setPose("lie");l.play("BARK");l.add("KILLED","final cry warns Gunnar","SÁMR");}
   }
 },
 state(l,s){return[
   ["CLASSIFIER","UNCHANGED","good"],["PLACEMENT",this.homeCoupled?"HOME BOUNDARY":"DRAWN AWAY",this.homeCoupled?"good":"bad"],
   ["DOG",l.alive?"ALIVE":"KILLED",l.alive?"":"bad"],["WARNING",this.warning?"SENT":"—",this.warning?"warn":""],
   ["HOME",this.breached?"PENETRABLE":"DEFENDED",this.breached?"bad":"good"],["BEHAVIOR",s?.behavior||"—",""]
 ]},
 causal(){if(this.scenario==="C")return`ATTACKERS → COERCE LOCAL INTERMEDIARY → RELOCATE SENTINEL → CORRECT DETECTION → ${this.breached?"KILL + WARNING → BREACH":"CONFLICT"}`;return`PERSON → RELATION TO GUNNAR + WELL/ILL → DISCRIMINATE → ${this.scenario==="A"?"DEFEND / BARK":"PERMIT"}`;}
};

const GOODYEAR={
 id:"GOODYEAR-001/002",title:"GOODYEAR",subtitle:"responsibility ≠ ownership · trust without a flag",
 model:"RELATIONSHIP",finchAlive:true,jeff:[1.4,1.1],
 init(l){l.resetShared();this.model="RELATIONSHIP";this.finchAlive=true;l.setHuman(this.jeff);l.setNeeds({happiness:.18,hunger:.05,fetchDesire:.18});l.remember("FINCH","care",5);l.remember("FINCH","safe",5);},
 support(l){
   const care=l.evidence("JEFF","care",55),safe=l.evidence("JEFF","safe",45),play=l.evidence("JEFF","play",35);
   return {care,safe,play,approach:care*.34+safe*.55+play*.18,follow:care*.28+safe*.30+play*.34};
 },
 action(l,k){
   if(k==="FEED"){l.remember("JEFF","care",1.4);l.setNeeds({hunger:-.45,happiness:.05});l.add("FOOD ACCEPTANCE","care obligation enacted","GOODYEAR");return;}
   if(k==="WAIT"){l.remember("JEFF","safe",.75);l.add("PROXIMITY","no demand","GOODYEAR");return;}
   if(k==="PLAY"){l.remember("JEFF","play",1);l.char.setSensors({ball:[1.15,0,1.05]});l.bias("FETCH",.75,"play opportunity");l.add("PLAY SOLICITATION","ball offered","JEFF");return;}
   const s=this.support(l),need=k==="CALL"?s.approach:s.follow;
   if(this.model==="OWNERSHIP"){l.directMove(this.jeff,1.2);l.add(k,"auto-authority from caregiver status","JEFF");}
   else if(need>.55){l.task("FOLLOW",this.jeff,.88);l.add(k,k==="CALL"?"voluntary approach available":"voluntary following available","GOODYEAR");}
   else l.add("NONCOMPLIANCE",`${k.toLowerCase()} · insufficient observed relation history`,"GOODYEAR");
 },
 controls(l){return[
   {label:"RELATIONSHIP MODEL",cls:"good",run:()=>{this.model="RELATIONSHIP";l.stopDirect();l.add("MODEL","care does not grant authority")}},
   {label:"OWNERSHIP MODEL",cls:"bad",run:()=>{this.model="OWNERSHIP";l.add("MODEL","caregiver auto-authority")}},
   "|",{label:"FEED",cls:"good",run:()=>this.action(l,"FEED")},{label:"WAIT",run:()=>this.action(l,"WAIT")},{label:"CALL",run:()=>this.action(l,"CALL")},{label:"PLAY",run:()=>this.action(l,"PLAY")},{label:"WALK",run:()=>this.action(l,"WALK")},
   {label:"FINCH DIES",cls:"bad",run:()=>{this.finchAlive=false;l.add("FINCH ABSENT","care obligation persists")}},
   {label:"RESET",run:()=>this.init(l)}
 ]},
 update(l,dt,s){},
 state(l,s){
   const recent=l.history.slice(-30),n=k=>recent.filter(e=>e.kind===k).length;
   return[["CAREGIVER","JEFF",""],["OWNS DOG",this.model==="OWNERSHIP"?"ASSUMED":"NO",this.model==="OWNERSHIP"?"bad":"good"],["TRUST FLAG","NONE","good"],
   ["APPROACH OBS",n("CALL"),""],["CARE EVENTS",this.support(l).care.toFixed(1),""],["FINCH",this.finchAlive?"PRESENT":"ABSENT",this.finchAlive?"":"warn"],["BEHAVIOR",s?.behavior||"—",""]];
 },
 causal(){return this.model==="OWNERSHIP"?"CAREGIVER STATUS → ASSIGNED AUTHORITY → DIRECT MOVEMENT":"CARE OBLIGATION → DISTINCT BEHAVIORAL HISTORY → CONTEXTUAL DECISION → APPROACH / AVOID / FOLLOW / PLAY";}
};

const SILAS={
 id:"SILAS-001/002",title:"SILAS",subtitle:"direction provenance · task abstraction · dog motor truth",
 mode:"MOTIVATION",goal:[-1.2,.8],
 init(l){l.resetShared();this.mode="MOTIVATION";l.setHuman(this.goal);l.setNeeds({hunger:.35,fatigue:.22,happiness:-.06});},
 come(l){
   l.setHuman(this.goal);
   if(this.mode==="MOTIVATION"){l.bias("FOLLOW",.58,"COME enters as motivational preference");l.add("COME","motivation bias");}
   if(this.mode==="TASK"){l.task("FOLLOW",this.goal,.72);l.add("COME","semantic task through arbiter");}
   if(this.mode==="MOTOR"){l.directMove(this.goal,1.25);l.add("COME","direct motor bypass");}
 },
 controls(l){return[
   {label:"A · MOTIVATION",run:()=>{this.mode="MOTIVATION";l.stopDirect();l.add("LEVEL","motivation")}},
   {label:"B · TASK",run:()=>{this.mode="TASK";l.stopDirect();l.add("LEVEL","task")}},
   {label:"C · MOTOR",cls:"bad",run:()=>{this.mode="MOTOR";l.add("LEVEL","direct motor")}},
   "|",{label:"COME",cls:"good",run:()=>this.come(l)},
   {label:"MAKE HUNGRY",run:()=>{l.setNeeds({hunger:.72});l.add("NEED","hunger high")}},
   {label:"MAKE TIRED",run:()=>{l.setNeeds({fatigue:.72});l.add("NEED","fatigue high")}},
   {label:"CLEAR NEEDS",run:()=>{l.setNeeds({hunger:-.8,fatigue:-.8});l.add("NEEDS","competition lowered")}},
   {label:"RESET",run:()=>this.init(l)}
 ]},
 update(l,dt,s){},
 state(l,s){const refus=this.mode!=="MOTOR";return[
   ["REQUEST","COME",""],["PROVENANCE",this.mode,this.mode==="MOTOR"?"bad":"warn"],["WINNER",s?.behavior||"—",s?.behavior==="FOLLOW"?"good":""],
   ["REFUSABLE",refus?"YES":"NO",refus?"good":"bad"],["GAIT",s?.gait||"—",""],["GROUNDED",s?.grounded?"YES":"NO",s?.grounded?"good":"bad"]
 ]},
 causal(l,s){if(this.mode==="MOTOR")return"DIRECT MOTOR → BYPASS BEHAVIOR ARBITRATION → DOG CONTROLLER → MOTOR SKILLS → PAW CONTACT → GEOMETRY";return`${this.mode==="TASK"?"SEMANTIC TASK":"MOTIVATION BIAS"} → BEHAVIOR ARBITRATION → ${s?.behavior||"—"} → DOG CONTROLLER → MOTOR SKILLS → PAW CONTACT → GEOMETRY`;}
};

export const EXPERIMENTS={argos:ARGOS,samr:SAMR,goodyear:GOODYEAR,silas:SILAS};
