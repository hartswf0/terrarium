// hlidarendi/src/ai-line.js
// ══ THE AGENT LINE — TERRARIUM'S OWN AI STACK, NOT A SECOND ONE ═══════════
//
// NEVER SOLVE THE SAME PHYSICAL QUESTION TWICE applies to the wiring as much
// as to the ground. `unset-04-hartsoe-iii.html` already carries a real,
// used-in-anger AI stack: five providers, the THUNDERHEAD gateway that keeps
// the key server-side, the OpenAI Responses/Chat dual-schema auto-recovery,
// Gemini's JSON mode, the reply extractors, and the key-mistake catcher that
// notices you pasted a URL where the key goes. Writing a second, smaller one
// for this page would have meant two things to configure and two things to
// blame.
//
// So this is that stack, ported — AND IT READS THE SAME CONFIG. The key is
// `trig.ai.config.v2`, exactly III's: configure a model once in Terrarium and
// HLIÐARENDI already has one, and the other way round. When this page runs
// beside III (the sidecar), III's own getAIConfig/saveAIConfig win and this
// module simply uses them.
//
// Ported from unset-04-hartsoe-iii.html: AI_PROVIDER_DEFAULTS, getAIConfig,
// saveAIConfig, aiWorkerUrl, aiLocalAvailable, apiKeyIssue, extractLLMText,
// callConfiguredLLM, requestAIText.

export const AI_CONFIG_KEY='trig.ai.config.v2';
export const AI_PROVIDER_DEFAULTS={
  thunder:{model:'server-router',endpoint:''},
  openai:{model:'gpt-5.4-mini',endpoint:'https://api.openai.com/v1/responses'},
  gemini:{model:'gemini-2.5-flash',endpoint:''},
  anthropic:{model:'claude-sonnet-4-5',endpoint:'https://api.anthropic.com/v1/messages'},
  custom:{model:'',endpoint:''}
};
const DEPRECATED_MODELS=['gpt-4.1','gpt-4.1-mini','gpt-4o','gpt-4o-mini','gpt-4-turbo'];

// III's gateway resolver, verbatim in behaviour: the config's own endpoint in
// thunder mode, else the page's <meta name="thunder-ai-url">.
export function aiWorkerUrl(cfg){
  try{cfg=cfg||readConfig()}catch(_){cfg={}}
  const fromCfg=(cfg&&cfg.provider==='thunder'&&cfg.endpoint)?String(cfg.endpoint):'';
  const fromMeta=document.querySelector('meta[name="thunder-ai-url"]')?.content||'';
  return String(fromCfg||fromMeta).trim().replace(/\/+$/,'');
}
function readConfig(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(AI_CONFIG_KEY)||localStorage.getItem('trig.ai.config.v1')||'{}')}catch(_){}
  // HLIÐARENDI's own first-draft key, folded in so nobody has to type it twice
  if(!saved.apiKey){try{const k=localStorage.getItem('hlidarendi.ai.key');
    if(k){saved.provider=saved.provider||'anthropic';saved.apiKey=k}}catch(_){}}
  const migratedFromRouter=saved.provider==='openrouter';
  if(saved.model&&DEPRECATED_MODELS.includes(String(saved.model).trim()))saved.model='';
  const provider=migratedFromRouter?'openai':(saved.provider||'thunder');
  const defaults=AI_PROVIDER_DEFAULTS[provider]||AI_PROVIDER_DEFAULTS.openai;
  return{provider,
    model:migratedFromRouter?defaults.model:(saved.model||defaults.model),
    endpoint:migratedFromRouter?defaults.endpoint:(saved.endpoint||defaults.endpoint),
    apiKey:saved.apiKey||'',shareRoom:!!saved.shareRoom};
}
function writeConfig(config){
  const provider=config.provider||'thunder';
  const defaults=AI_PROVIDER_DEFAULTS[provider]||AI_PROVIDER_DEFAULTS.openai;
  try{localStorage.setItem(AI_CONFIG_KEY,JSON.stringify({provider,
    model:(config.model||defaults.model||'').trim(),
    endpoint:(config.endpoint||defaults.endpoint||'').trim(),
    apiKey:(config.apiKey||'').trim(),shareRoom:!!config.shareRoom}))}catch(_){}
  try{localStorage.removeItem('hlidarendi.ai.key');localStorage.removeItem('hlidarendi.ai')}catch(_){}
}
// If III is on this page it owns the settings; we are a citizen, not a rival.
const HOST_GET=typeof window!=='undefined'&&typeof window.getAIConfig==='function'?window.getAIConfig:null;
const HOST_SAVE=typeof window!=='undefined'&&typeof window.saveAIConfig==='function'?window.saveAIConfig:null;
export function getAIConfig(){return HOST_GET?HOST_GET():readConfig()}
export function saveAIConfig(c){return HOST_SAVE?HOST_SAVE(c):writeConfig(c)}
export function aiLocalAvailable(config){
  const c=config||getAIConfig();
  if(c.provider==='thunder')return !!aiWorkerUrl(c);
  return !!c.apiKey;
}
// The #1 setup mistake, caught before the provider answers with something
// cryptic: a URL, or a password manager's autofill, pasted into the key field.
export function apiKeyIssue(cfg){
  if(!cfg||cfg.provider==='thunder')return '';
  const k=String(cfg.apiKey||'').trim();
  if(!k)return 'No API key entered. Paste your secret key into the KEY field.';
  if(/^https?:\/\//i.test(k)||k.includes('/'))return 'That looks like a URL, not a key. The URL belongs in ENDPOINT — paste the secret key in KEY. A password manager may have filled it: clear the field and paste again.';
  if(/\s/.test(k))return 'The key contains spaces — you probably pasted extra text. Paste just the key.';
  if(cfg.provider==='openai'&&!/^sk-/.test(k))return 'OpenAI keys start with "sk-". Make sure you pasted the KEY, not the org id or an endpoint.';
  return '';
}
export function extractLLMText(provider,result){
  if(typeof result==='string')return result;
  if(provider==='gemini')return (result.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n');
  if(provider==='anthropic')return (result.content||[]).map(p=>p.text||'').join('\n');
  if(result.choices?.[0]?.message?.content)return result.choices[0].message.content;
  if(typeof result.output_text==='string')return result.output_text;
  if(Array.isArray(result.output))return result.output.map(o=>o.content?.map(c=>c.text||'').join('\n')||'').join('\n');
  return JSON.stringify(result);
}
// AICON's job, in this page's idiom: every request and every reply is on the
// record. The phone IS the devtools — you cannot debug a line you cannot see.
export const AILOG={
  lines:[],route:'',last:{task:'',prompt:'',sys:'',reply:''},listeners:[],
  push(msg,cls){
    this.lines.push({t:new Date().toTimeString().slice(0,8),msg:String(msg),cls:cls||''});
    while(this.lines.length>60)this.lines.shift();
    for(const fn of this.listeners){try{fn(this)}catch(_){}}
  },
  text(){return this.lines.map(l=>l.t+' '+l.msg).join('\n')},
  onChange(fn){this.listeners.push(fn);return ()=>{const i=this.listeners.indexOf(fn);if(i>=0)this.listeners.splice(i,1)}}
};
export async function callConfiguredLLM(promptText,systemPrompt,config,imageDataUrl,maxTokens,options){
  config=config||getAIConfig();maxTokens=maxTokens||3000;options=options||{};
  if(config.provider!=='thunder'&&!config.apiKey)throw new Error('NO LOCAL API KEY');
  const provider=config.provider||'thunder';
  const model=config.model||AI_PROVIDER_DEFAULTS[provider]?.model||'';
  let endpoint=config.endpoint||AI_PROVIDER_DEFAULTS[provider]?.endpoint||'';
  let headers={'Content-Type':'application/json'},body;

  // THUNDERHEAD: the key lives in the Cloudflare Worker and never enters this
  // browser. This is the answer to "a raw key in a page", and it already exists.
  if(provider==='thunder'){
    const gw=aiWorkerUrl(config);
    if(!gw)throw new Error('THUNDER AI GATEWAY URL MISSING — set ENDPOINT to https://thunderhead-ai.YOU.workers.dev');
    const url=gw+'/ai/respond';
    const payload={task:options.task||'generic',prompt:String(promptText||''),
      system:String(systemPrompt||''),imageDataUrl:imageDataUrl||null,maxOutputTokens:maxTokens};
    let res;
    try{res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Thunder-User':(options.user||'hlidarendi')},body:JSON.stringify(payload)})}
    catch(_){throw new Error('THUNDER AI NETWORK: could not reach '+url)}
    const raw=await res.text();
    let result={};try{result=raw?JSON.parse(raw):{}}catch(_){result={error:raw}}
    if(!res.ok||!result.ok)throw new Error(result.error||('THUNDER AI HTTP '+res.status));
    AILOG.route='THUNDER / '+(result.model||payload.task);
    return typeof result.text==='string'?result.text:JSON.stringify(result.data??result);
  }

  if(provider==='gemini'){
    endpoint=endpoint||('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent');
    const url=endpoint.includes('?')?endpoint+'&key='+encodeURIComponent(config.apiKey):endpoint+'?key='+encodeURIComponent(config.apiKey);
    const wantsJson=['agent','world','arena','parts','rig_spec'].includes(options.task);
    body={systemInstruction:{parts:[{text:systemPrompt}]},
      contents:[{role:'user',parts:[{text:promptText}]}],
      generationConfig:wantsJson?{responseMimeType:'application/json'}:{}};
    const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
    const json=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(json.error?.message||'Gemini API failed');
    AILOG.route='gemini / '+model;
    return extractLLMText(provider,json);
  }

  if(provider==='anthropic'){
    headers={'Content-Type':'application/json','x-api-key':config.apiKey,
      'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
    body={model,max_tokens:Math.max(2000,maxTokens),system:systemPrompt,messages:[{role:'user',content:promptText}]};
    let res;
    try{res=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)})}
    catch(_){throw new Error('ANTHROPIC NETWORK: could not reach '+endpoint)}
    const json=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(json.error?.message||('Anthropic API failed ('+res.status+')'));
    AILOG.route='anthropic / '+model;
    return extractLLMText(provider,json);
  }

  headers={'Content-Type':'application/json',Authorization:'Bearer '+config.apiKey};
  if(!endpoint)throw new Error('MISSING API ENDPOINT');

  if(provider==='openai'){
    // Endpoint overrides expose either /responses or /chat/completions. Route by
    // URL, then retry ONCE with the other schema when the server says the
    // `messages` or `input` parameter is missing — stale saved endpoints and
    // proxies both get recovered instead of failing at the user.
    const respInput=imageDataUrl
      ?[{role:'user',content:[{type:'input_text',text:promptText},{type:'input_image',image_url:imageDataUrl}]}]
      :promptText;
    const chatUser=imageDataUrl
      ?[{type:'text',text:promptText},{type:'image_url',image_url:{url:imageDataUrl}}]
      :promptText;
    const responseBody={model,instructions:systemPrompt,input:respInput,max_output_tokens:maxTokens};
    if(/^(gpt-5|o[1-9])/i.test(model))responseBody.reasoning={effort:'low'};
    const chatBody={model,messages:[{role:'developer',content:systemPrompt},{role:'user',content:chatUser}],
      max_completion_tokens:maxTokens};
    const looksChat=/\/chat\/completions(?:[/?#]|$)/i.test(endpoint);
    const post=async(payload,routeName)=>{
      let res;
      try{res=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(payload)})}
      catch(_){throw new Error('OPENAI_NETWORK: could not reach '+endpoint)}
      const raw=await res.text();
      let json={};try{json=raw?JSON.parse(raw):{}}catch(_){json={error:{message:raw}}}
      return{res,json,routeName,message:json.error?.message||raw||('OPENAI HTTP '+res.status)};
    };
    let attempt=await post(looksChat?chatBody:responseBody,looksChat?'Chat Completions':'Responses API');
    if(!attempt.res.ok){
      const missingMessages=/missing required parameter[: ]*[`'"]?messages/i.test(attempt.message)||/messages.*required/i.test(attempt.message);
      const missingInput=/missing required parameter[: ]*[`'"]?input/i.test(attempt.message)||/input.*required/i.test(attempt.message);
      if((!looksChat&&missingMessages)||(looksChat&&missingInput)){
        const fallbackIsChat=!looksChat;
        attempt=await post(fallbackIsChat?chatBody:responseBody,fallbackIsChat?'Chat Completions (auto-recovered)':'Responses API (auto-recovered)');
      }
    }
    if(!attempt.res.ok)throw new Error(attempt.message+' [route: '+attempt.routeName+']');
    AILOG.route=attempt.routeName;
    return extractLLMText(provider,attempt.json);
  }

  // Custom endpoints stay Chat-Completions compatible.
  body={model,messages:[{role:'system',content:systemPrompt},{role:'user',content:promptText}],temperature:0.2};
  let res;
  try{res=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)})}
  catch(_){throw new Error('NETWORK: could not reach '+endpoint)}
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(json.error?.message||(provider+' API failed'));
  AILOG.route='custom / '+model;
  return extractLLMText(provider,json);
}
// Every AI request in this page flows through here, and every one of them is
// logged — task, route, prompt length, and what came back.
export async function requestAIText(promptText,systemPrompt,imageDataUrl,maxTokens,options){
  options=options||{};
  const cfg=getAIConfig();
  if(!aiLocalAvailable(cfg))throw new Error('NO AI LINE — open the agent line and connect a model');
  const via=cfg.provider==='thunder'?('thunder '+(aiWorkerUrl(cfg)||'NO-GATEWAY-URL')):(cfg.provider+' '+(cfg.model||''));
  AILOG.last={task:options.task||'generic',prompt:promptText,sys:systemPrompt,reply:''};
  AILOG.push('REQ '+(options.task||'generic')+' · '+via+' · “'+String(promptText||'').slice(0,64).replace(/\s+/g,' ')+'”');
  try{
    const r=await callConfiguredLLM(promptText,systemPrompt,cfg,imageDataUrl||null,maxTokens||3000,options);
    AILOG.last.reply=r;
    AILOG.push('RES '+String(r||'').length+'c · '+String(r||'').slice(0,90).replace(/\s+/g,' '),'ok');
    return r;
  }catch(e){
    AILOG.push('FAILED · '+String(e&&e.message||e).slice(0,200),'err');
    throw e;
  }
}
// Publish the same surface III publishes, so a sidecar, a cartridge or the
// console all find one agent line however they arrived.
if(typeof window!=='undefined'){
  if(!window.getAIConfig)window.getAIConfig=getAIConfig;
  if(!window.saveAIConfig)window.saveAIConfig=saveAIConfig;
  window.requestAIText=window.requestAIText||requestAIText;
  window.AILOG=AILOG;
}
