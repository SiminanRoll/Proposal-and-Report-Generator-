(()=>{
  const body=document.body;
  const mapPanel=document.getElementById('signalMapView');
  const detailPanel=document.getElementById('detailDashboard');
  const status=document.getElementById('signalMapStatus');
  const tabs=[...document.querySelectorAll('[data-signal-surface-target]')];
  const layerControls=[...document.querySelectorAll('[data-map-layer]')];
  const sourceNodes=new Map([...document.querySelectorAll('[data-source-id]')].map(node=>[node.dataset.sourceId,node]));
  const sourceIds=['facebook_groups','reddit_groups','linkedin_groups','company_page_engagement','permit_offices','npi_new_practice'];
  const numberFormatter=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
  const singularUnits={groups:'group',communities:'community',connections:'connection',accounts:'account',feeds:'feed',feed:'feed'};
  const mapState={
    view:'map',
    layer:'overview',
    range:'7d',
    selectedSource:null,
    selectedStage:null,
    selectedOpportunity:null,
    data:null,
    lastUpdatedAt:null
  };
  const header={
    eyebrow:document.querySelector('.top .eyebrow'),
    title:document.querySelector('.top h1'),
    subtitle:document.querySelector('.top .subtitle')
  };
  const copy={
    map:{eyebrow:'SIGNAL INTELLIGENCE',title:'Signal Intelligence Map',subtitle:'A live view of how monitored signals become surfaced sales opportunities.'},
    detail:{eyebrow:'OPERATIONS DETAIL',title:'Signal Intelligence Dashboard',subtitle:'Live signal health, activity, and opportunity production.'}
  };

  function setStatus(message,state='loading'){
    if(!status)return;
    status.dataset.state=state;
    const text=status.querySelector('span:last-child');
    if(text)text.textContent=message;
    if(mapPanel)mapPanel.setAttribute('aria-busy',state==='loading'?'true':'false');
  }

  function numeric(value){
    const count=Number(value);
    return value!==null&&value!==undefined&&Number.isFinite(count)&&count>=0?count:null;
  }

  function formatCount(value){
    const count=numeric(value);
    return count===null?'—':numberFormatter.format(count);
  }

  function formatMonitored(source){
    const count=numeric(source.monitored_count);
    if(count===null)return '—';
    const unit=String(source.monitored_unit||'').trim().toLowerCase();
    const displayUnit=count===1?(singularUnits[unit]||unit):unit;
    return `${numberFormatter.format(count)}${displayUnit?' '+displayUnit:''}`;
  }

  function healthLabel(health,available){
    if(!available)return 'Unavailable';
    if(health==='healthy')return 'Healthy';
    if(health==='warning')return 'Review status';
    if(health==='error')return 'Monitoring issue';
    return 'Status unavailable';
  }

  function writeSource(node,source,range){
    const available=source?.availability==='available';
    const health=available&&['healthy','warning','error'].includes(source.health)?source.health:'unknown';
    const monitored=available?formatMonitored(source):'—';
    const signals=available?formatCount(source.signals):'—';
    const surfaced=available?formatCount(source.surfaced):'—';
    const partial=available&&[source.monitored_count,source.signals,source.surfaced].some(value=>numeric(value)===null);
    const state=available?(partial?'partial':'ready'):'unavailable';
    const label=String(source?.label||node.querySelector('[data-source-name]')?.textContent||'Source').trim();
    const healthText=healthLabel(health,available);
    const slots={
      '[data-source-name]':label,
      '[data-source-health-label]':healthText,
      '[data-source-monitored]':monitored,
      '[data-source-signals]':signals,
      '[data-source-surfaced]':surfaced
    };
    Object.entries(slots).forEach(([selector,value])=>{
      const target=node.querySelector(selector);
      if(target)target.textContent=value;
    });
    node.dataset.sourceState=state;
    node.dataset.sourceHealth=health;
    node.setAttribute('aria-busy','false');
    node.setAttribute('aria-label',available
      ?`${label}. ${healthText}. ${monitored==='—'?'Monitoring count unavailable':monitored+' monitored'}, ${signals==='—'?'evaluated count unavailable':signals+' evaluated'}, ${surfaced==='—'?'surfaced count unavailable':surfaced+' surfaced'} for ${range}.`
      :`${label}. Source summary unavailable for ${range}.`);
  }

  function renderSources(map){
    const byId=new Map(map.sources.filter(source=>source&&sourceIds.includes(source.id)).map(source=>[source.id,source]));
    const range=String(map.range||'selected range').toUpperCase();
    sourceIds.forEach(id=>{
      const node=sourceNodes.get(id);
      if(node)writeSource(node,byId.get(id)||null,range);
    });
  }

  function renderSourcesUnavailable(){
    sourceIds.forEach(id=>{
      const node=sourceNodes.get(id);
      if(node)writeSource(node,null,'selected range');
    });
  }

  function syncHeader(surface){
    const next=copy[surface]||copy.map;
    if(header.eyebrow)header.eyebrow.textContent=next.eyebrow;
    if(header.title)header.title.textContent=next.title;
    if(header.subtitle)header.subtitle.textContent=next.subtitle;
    document.title=next.title;
  }

  function setSurface(requested,options={}){
    const surface=requested==='detail'?'detail':'map';
    mapState.view=surface;
    body.dataset.signalSurface=surface;
    if(mapPanel)mapPanel.hidden=surface!=='map';
    if(detailPanel)detailPanel.hidden=surface!=='detail';
    tabs.forEach(tab=>{
      const active=tab.dataset.signalSurfaceTarget===surface;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      if(active&&options.focus)tab.focus();
    });
    syncHeader(surface);
    window.dispatchEvent(new CustomEvent('signal-map:surface',{detail:{surface}}));
    if(surface==='detail')requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }

  function setLayer(requested){
    const allowed=new Set(['overview','social','structured','scoring','opportunities']);
    const layer=allowed.has(requested)?requested:'overview';
    mapState.layer=layer;
    if(mapPanel)mapPanel.dataset.mapLayer=layer;
    layerControls.forEach(control=>{
      const active=control.dataset.mapLayer===layer;
      control.classList.toggle('active',active);
      control.setAttribute('aria-pressed',String(active));
    });
    window.dispatchEvent(new CustomEvent('signal-map:layer',{detail:{layer}}));
  }

  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>setSurface(tab.dataset.signalSurfaceTarget));
    tab.addEventListener('keydown',event=>{
      let next=null;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+tabs.length)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next===null)return;
      event.preventDefault();
      setSurface(tabs[next].dataset.signalSurfaceTarget,{focus:true});
    });
  });

  layerControls.forEach(control=>control.addEventListener('click',()=>setLayer(control.dataset.mapLayer)));

  window.addEventListener('signal-map:data',event=>{
    const map=event.detail;
    if(!map||!Array.isArray(map.sources)){
      if(!mapState.data)renderSourcesUnavailable();
      setStatus('Live map data is not available yet. Detail Dashboard remains available.','warning');
      return;
    }
    mapState.data=map;
    mapState.range=String(map.range||mapState.range);
    mapState.lastUpdatedAt=map.generated_at||null;
    renderSources(map);
    const available=map.sources.filter(source=>source.availability==='available').length;
    const range=String(map.range||'current range').toUpperCase();
    setStatus(`${available} of ${map.sources.length} source lanes available · ${range}`,'ready');
  });
  window.addEventListener('signal-map:error',event=>{
    if(!mapState.data)renderSourcesUnavailable();
    const lastUpdate=mapState.lastUpdatedAt?` · Last update ${new Date(mapState.lastUpdatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'';
    setStatus(`${event.detail?.message||'Live data unavailable.'}${lastUpdate}`,'error');
  });

  window.SignalMapView={
    setSurface,
    setLayer,
    getSurface:()=>body.dataset.signalSurface||'map',
    getState:()=>({...mapState})
  };
  setLayer(mapState.layer);
  setSurface(body.dataset.signalSurface||'map');
})();
