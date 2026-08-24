(()=>{
  const STATE_CODES=['WI','MI','IL','IN','OH','KY','TN','AL','GA','FL'];
  const STATE_NAMES={WI:'Wisconsin',MI:'Michigan',IL:'Illinois',IN:'Indiana',OH:'Ohio',KY:'Kentucky',TN:'Tennessee',AL:'Alabama',GA:'Georgia',FL:'Florida'};
  const FULL_TO_CODE=Object.fromEntries(Object.entries(STATE_NAMES).map(([code,name])=>[name.toUpperCase(),code]));
  const SOURCE_META={
    facebook_groups:{label:'Facebook Groups',accent:'#4fc9ff',primary:'Signals',secondary:'Surfaced',tertiary:'Working',note:'State activity is based only on locations detected in retained Facebook signal evidence.'},
    reddit_groups:{label:'Reddit Communities',accent:'#f19a5b',primary:'Signals',secondary:'Surfaced',tertiary:'Working',note:'State activity is based only on locations detected in retained Reddit signal evidence.'},
    linkedin_groups:{label:'LinkedIn Groups',accent:'#4e87c6',primary:'Signals',secondary:'Surfaced',tertiary:'Working',note:'No state-level LinkedIn Groups feed is connected yet.',unavailable:true},
    company_page_engagement:{label:'Company Pages',accent:'#56d8c0',primary:'Surfaced',secondary:'Responses',tertiary:'Located',note:'The map plots recent surfaced company-page signals whose detected location is retained in the normalized Signal Map payload.'},
    permit_offices:{label:'Permit Offices',accent:'#efc55d',primary:'Leads',secondary:'Clerk Sources',tertiary:'Permits Scanned',note:'Clerk coverage uses connected permit sources; lead geography uses verified permit records in the selected window.'},
    npi_new_practice:{label:'NPI Registry',accent:'#9f8cff',primary:'Candidates',secondary:'Review-worthy',tertiary:'Investigated',note:'NPI geography uses the state stored on research candidates in the selected window.'},
  };
  const STORAGE_KEY='signal-map-center-view-v1';
  const process=document.querySelector('.map-process-map');
  const routeHeading=process?.querySelector('.map-process-heading');
  const routeTrack=process?.querySelector('.map-flow-track');
  const entityList=document.querySelector('[data-entity-list]');
  const entityHeading=document.querySelector('[data-entity-heading]');
  const entityCompleteness=document.querySelector('[data-entity-completeness]');
  let currentView='route';
  let lastPayload=null;
  let activeDetail=null;

  function inferState(...values){
    const text=values.filter(Boolean).join(' ').toUpperCase().replace(/[_/.-]+/g,' ');
    for(const [name,code] of Object.entries(FULL_TO_CODE))if(new RegExp(`\\b${name.replace(/ /g,'\\s+')}\\b`).test(text))return code;
    const match=text.match(/\b(WI|MI|IL|IN|OH|KY|TN|AL|GA|FL)\b/);
    return match?.[1]||null;
  }

  function latestIso(a,b){
    if(!a)return b||null;
    if(!b)return a||null;
    return String(a)>String(b)?String(a):String(b);
  }

  function numeric(value){const n=Number(value);return Number.isFinite(n)?n:0}
  function formatCount(value){const n=numeric(value);return new Intl.NumberFormat(undefined,{notation:n>=1000?'compact':'standard',maximumFractionDigits:1}).format(n)}
  function relativeTime(value){
    if(!value)return 'No recent located activity';
    const then=new Date(value).getTime();
    if(!Number.isFinite(then))return 'Activity time unavailable';
    const mins=Math.max(0,Math.floor((Date.now()-then)/60000));
    if(mins<2)return 'Observed just now';
    if(mins<60)return `Observed ${mins}m ago`;
    const hours=Math.floor(mins/60);
    if(hours<24)return `Observed ${hours}h ago`;
    const days=Math.floor(hours/24);
    return days===1?'Observed yesterday':`Observed ${days}d ago`;
  }

  function emptyStates(){
    return Object.fromEntries(STATE_CODES.map(code=>[code,{code,name:STATE_NAMES[code],active:false,primary:0,secondary:0,tertiary:0,lastActivity:null}]));
  }

  function rangeLabel(){
    if(typeof S!=='undefined'&&Number(S.days))return Number(S.days)===1?'24H':`${Number(S.days)}D`;
    const range=window.SignalMapView?.getState?.().range;
    return String(range||'current').toUpperCase();
  }

  function selectedSourceId(){
    return window.SignalMapView?.getState?.().selectedSourceId||document.querySelector('[data-source-id][aria-pressed="true"]')?.dataset.sourceId||'facebook_groups';
  }

  function sourceAvailable(sourceId){
    const source=window.SignalMapView?.getState?.().data?.sources?.find(item=>item.id===sourceId);
    return source?.availability!=='unavailable';
  }

  function socialPayload(sourceId,rows){
    const meta=SOURCE_META[sourceId];
    const states=emptyStates();
    let unlocated=0;
    rows.forEach(row=>{
      const code=inferState(row.location_detected);
      if(!code){unlocated+=1;return}
      const state=states[code];
      state.active=true;
      state.primary+=1;
      if(row.should_surface===true)state.secondary+=1;
      if(row.responded_at||row.completed_at)state.tertiary+=1;
      state.lastActivity=latestIso(state.lastActivity,row.completed_at||row.responded_at||row.created_at||row.first_seen_at||row.posted_at);
    });
    return makePayload(sourceId,meta,Object.values(states),unlocated);
  }

  function companyPayload(){
    const sourceId='company_page_engagement',meta=SOURCE_META[sourceId],states=emptyStates();
    const latest=window.SignalMapView?.getState?.().data?.opportunities?.latest||[];
    const rows=latest.filter(row=>row.source_id===sourceId);
    let unlocated=0;
    rows.forEach(row=>{
      const code=inferState(row.detected_location,row.geography);
      if(!code){unlocated+=1;return}
      const state=states[code];
      state.active=true;
      state.primary+=1;
      if(row.working===true)state.secondary+=1;
      state.tertiary+=1;
      state.lastActivity=latestIso(state.lastActivity,row.occurred_at);
    });
    return makePayload(sourceId,meta,Object.values(states),unlocated);
  }

  function permitPayload(){
    const sourceId='permit_offices',meta=SOURCE_META[sourceId],states=emptyStates();
    const sources=typeof permitSources==='function'?permitSources():[];
    const opportunities=typeof permitOpps==='function'?permitOpps():(typeof S!=='undefined'?S.data?.permit_opportunities_window||[]:[]);
    const sourceState=new Map();
    let unlocated=0;

    sources.forEach(source=>{
      let code=inferState(source.jur,source.label,source.key);
      if(!code){
        const linked=opportunities.find(row=>row.source_key===source.key);
        code=inferState(linked?.state,linked?.city,linked?.address_text);
      }
      if(!code){unlocated+=1;return}
      sourceState.set(source.key,code);
      const state=states[code];
      state.active=true;
      state.secondary+=1;
      state.tertiary+=Number(source.permits||0);
      state.lastActivity=latestIso(state.lastActivity,source.last);
    });

    opportunities.forEach(row=>{
      const code=inferState(row.state,row.city,row.address_text)||sourceState.get(row.source_key)||null;
      if(!code){unlocated+=1;return}
      const state=states[code];
      state.active=true;
      state.primary+=1;
      state.lastActivity=latestIso(state.lastActivity,row.updated_at||row.last_seen_at||row.created_at||row.first_seen_at);
    });
    return makePayload(sourceId,meta,Object.values(states),unlocated);
  }

  function npiPayload(){
    const sourceId='npi_new_practice',meta=SOURCE_META[sourceId],states=emptyStates();
    const candidates=typeof S!=='undefined'?S.data?.npi_candidates_window||[]:[];
    const investigations=typeof S!=='undefined'?S.data?.npi_investigations_window||[]:[];
    const candidateState=new Map();
    let unlocated=0;

    candidates.forEach(row=>{
      const code=inferState(row.state,row.city);
      if(!code){unlocated+=1;return}
      candidateState.set(String(row.id),code);
      const state=states[code];
      state.active=true;
      state.primary+=1;
      if(row.review_worthy===true)state.secondary+=1;
      state.lastActivity=latestIso(state.lastActivity,row.updated_at||row.created_at);
    });
    investigations.forEach(row=>{
      const code=candidateState.get(String(row.candidate_id));
      if(!code)return;
      const state=states[code];
      state.active=true;
      if(String(row.status||'').toLowerCase()==='completed'||row.researched_at)state.tertiary+=1;
      state.lastActivity=latestIso(state.lastActivity,row.researched_at||row.updated_at||row.created_at);
    });
    return makePayload(sourceId,meta,Object.values(states),unlocated);
  }

  function makePayload(sourceId,meta,states,unlocated=0){
    const unavailable=Boolean(meta.unavailable)||!sourceAvailable(sourceId);
    const totals=states.reduce((out,state)=>{
      if(state.active)out.statesActive+=1;
      out.primary+=Number(state.primary||0);
      out.secondary+=Number(state.secondary||0);
      out.tertiary+=Number(state.tertiary||0);
      return out;
    },{statesActive:0,primary:0,secondary:0,tertiary:0,unlocated:Number(unlocated||0)});
    return {sourceId,sourceLabel:meta.label,accent:meta.accent,rangeLabel:rangeLabel(),primaryLabel:meta.primary,secondaryLabel:meta.secondary,tertiaryLabel:meta.tertiary,note:meta.note,unavailable,totals,states};
  }

  function buildPayload(){
    const sourceId=selectedSourceId();
    const meta=SOURCE_META[sourceId]||SOURCE_META.facebook_groups;
    if(meta.unavailable)return makePayload(sourceId,meta,Object.values(emptyStates()),0);
    if(typeof S==='undefined'||!S.data)return makePayload(sourceId,meta,Object.values(emptyStates()),0);
    if(sourceId==='facebook_groups')return socialPayload(sourceId,S.data.social_signals_window||[]);
    if(sourceId==='reddit_groups')return socialPayload(sourceId,S.data.reddit_signals_window||[]);
    if(sourceId==='company_page_engagement')return companyPayload();
    if(sourceId==='permit_offices')return permitPayload();
    if(sourceId==='npi_new_practice')return npiPayload();
    return makePayload(sourceId,meta,Object.values(emptyStates()),0);
  }

  function sendPayload(){
    const frame=document.getElementById('signalGeographyFrame');
    if(!frame?.contentWindow)return;
    const payload=buildPayload()||lastPayload;
    if(!payload)return;
    lastPayload=payload;
    frame.contentWindow.postMessage({type:'signal-geography:data',payload},location.origin);
  }

  function makeMetric(label,value){
    const box=document.createElement('div');
    box.className='geo-inline-metric';
    const strong=document.createElement('b');strong.textContent=formatCount(value);
    const span=document.createElement('span');span.textContent=label;
    box.append(strong,span);return box;
  }

  function renderGeoDetail(detail=activeDetail){
    if(currentView!=='geo'||!entityList||!lastPayload)return;
    entityList.replaceChildren();
    entityList.classList.remove('entity-performance-list');
    entityList.classList.add('geo-inline-state-list');
    const payload=lastPayload;
    const state=detail?.state||null;

    if(state){
      if(entityHeading)entityHeading.textContent=state.name;
      if(entityCompleteness)entityCompleteness.textContent=detail?.pinned?'Pinned state · click again to unpin':'Hover preview · click state to pin';
      const card=document.createElement('div');
      card.className='geo-inline-state-card';
      const top=document.createElement('div');top.className='geo-inline-state-head';
      const copy=document.createElement('div');
      const kicker=document.createElement('span');kicker.textContent=state.active?'STATE ACTIVITY':'NO LOCATED ACTIVITY';
      const title=document.createElement('b');title.textContent=`${payload.sourceLabel} · ${payload.rangeLabel}`;
      copy.append(kicker,title);
      const status=document.createElement('em');status.textContent=relativeTime(state.lastActivity);
      top.append(copy,status);
      const metrics=document.createElement('div');metrics.className='geo-inline-metrics';
      metrics.append(makeMetric(payload.primaryLabel,state.primary),makeMetric(payload.secondaryLabel,state.secondary),makeMetric(payload.tertiaryLabel,state.tertiary));
      const note=document.createElement('p');note.textContent=payload.note;
      card.append(top,metrics,note);
      entityList.append(card);
      return;
    }

    if(entityHeading)entityHeading.textContent=`${payload.sourceLabel} by State`;
    if(entityCompleteness)entityCompleteness.textContent='Hover a state · click to pin';
    const card=document.createElement('div');card.className='geo-inline-state-card geo-inline-summary-card';
    const top=document.createElement('div');top.className='geo-inline-state-head';
    const copy=document.createElement('div');
    const kicker=document.createElement('span');kicker.textContent=payload.unavailable?'GEOGRAPHY UNAVAILABLE':'GEOGRAPHIC SUMMARY';
    const title=document.createElement('b');title.textContent=payload.unavailable?'No state-level feed connected':`${payload.totals.statesActive} states active · ${payload.rangeLabel}`;
    copy.append(kicker,title);top.append(copy);
    const metrics=document.createElement('div');metrics.className='geo-inline-metrics';
    metrics.append(makeMetric('States Active',payload.totals.statesActive),makeMetric(payload.primaryLabel,payload.totals.primary),makeMetric('Unlocated',payload.totals.unlocated));
    const note=document.createElement('p');note.textContent=payload.note;
    card.append(top,metrics,note);
    entityList.append(card);
  }

  function refresh(){
    lastPayload=buildPayload();
    activeDetail=null;
    if(currentView==='geo')requestAnimationFrame(()=>{sendPayload();renderGeoDetail(null)});
  }

  function setCenterView(view,{persist=true}={}){
    currentView=view==='geo'?'geo':'route';
    if(process)process.dataset.centerView=currentView;
    document.body.dataset.signalCenterView=currentView;
    document.querySelectorAll('[data-center-view]').forEach(button=>{
      const active=button.dataset.centerView===currentView;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if(routeHeading)routeHeading.hidden=currentView==='geo';
    if(routeTrack)routeTrack.hidden=currentView==='geo';
    const geo=document.getElementById('signalGeographyPane');
    if(geo)geo.hidden=currentView!=='geo';
    if(persist){try{sessionStorage.setItem(STORAGE_KEY,currentView)}catch{}}
    if(currentView==='geo')requestAnimationFrame(()=>{sendPayload();renderGeoDetail(activeDetail)});
    else requestAnimationFrame(()=>window.SignalMapContributorPanel?.render?.());
  }

  function install(){
    if(!process||document.getElementById('signalCenterViewSwitch'))return;
    const switcher=document.createElement('div');
    switcher.className='signal-center-view-switch';
    switcher.id='signalCenterViewSwitch';
    switcher.setAttribute('aria-label','Signal Map visualization');
    switcher.innerHTML='<button type="button" data-center-view="route" aria-pressed="true"><span>Route</span></button><button type="button" data-center-view="geo" aria-pressed="false"><span>Map</span></button>';

    const pane=document.createElement('div');
    pane.className='signal-geography-pane';
    pane.id='signalGeographyPane';
    pane.hidden=true;
    pane.innerHTML='<iframe id="signalGeographyFrame" class="signal-geography-frame" src="/signal-geography-map/?v=1.2.82" title="Selected source geographic signal activity" loading="eager" scrolling="no"></iframe>';

    process.prepend(switcher);
    process.append(pane);
    switcher.querySelectorAll('[data-center-view]').forEach(button=>button.addEventListener('click',()=>setCenterView(button.dataset.centerView)));
    document.getElementById('signalGeographyFrame')?.addEventListener('load',sendPayload);

    window.addEventListener('message',event=>{
      if(event.origin!==location.origin)return;
      if(event.data?.type==='signal-geography:ready'){sendPayload();return}
      if(event.data?.type==='signal-geography:state'){
        activeDetail=event.data.payload||null;
        renderGeoDetail(activeDetail);
      }
    });
    document.querySelectorAll('[data-source-id]').forEach(node=>node.addEventListener('click',()=>requestAnimationFrame(refresh)));
    window.addEventListener('signal-map:data',()=>requestAnimationFrame(refresh));
    window.addEventListener('signal-map:surface',event=>{if(event.detail?.surface==='map')requestAnimationFrame(refresh)});

    let saved='route';
    try{saved=sessionStorage.getItem(STORAGE_KEY)||'route'}catch{}
    setCenterView(saved,{persist:false});
    refresh();
  }

  window.SignalGeographyView={setView:setCenterView,refresh,renderDetail:renderGeoDetail,getView:()=>currentView};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
