(()=>{
  const body=document.body;
  const mapPanel=document.getElementById('signalMapView');
  const detailPanel=document.getElementById('detailDashboard');
  const workspace=document.querySelector('.signal-map-workspace');
  const status=document.getElementById('signalMapStatus');
  const tabs=[...document.querySelectorAll('[data-signal-surface-target]')];
  const sourceNodes=new Map([...document.querySelectorAll('[data-source-id]')].map(node=>[node.dataset.sourceId,node]));
  const sourceIds=['facebook_groups','reddit_groups','linkedin_groups','company_page_engagement','permit_offices','npi_new_practice'];
  const shortLabels={facebook_groups:'Facebook Groups',reddit_groups:'Reddit Communities',linkedin_groups:'LinkedIn Groups',company_page_engagement:'Company Pages',permit_offices:'Permit Offices',npi_new_practice:'NPI Registry'};
  const entityHeadings={group:'Facebook groups',community:'Reddit communities',account:'Connected pages',clerk_office:'Clerk offices',registry_feed:'Registry feed'};
  const stages=[...document.querySelectorAll('[data-stage-index]')];
  const flowTrack=document.querySelector('.map-flow-track');
  const rejectedBranch=document.querySelector('.map-suppressed-branch');
  const stageIcons={radar:'#icon-radar',filter:'#icon-filter',score:'#icon-score',target:'#icon-target',message:'#icon-message'};
  const destination={
    total:document.querySelector('[data-map-total]'),
    totalLabel:document.querySelector('[data-map-total-label]'),
    hot:document.querySelector('[data-map-hot]'),
    warm:document.querySelector('[data-map-warm]'),
    producing:document.querySelector('[data-map-producing]'),
    selected:document.querySelector('[data-map-selected-surfaced]'),
    selectedUnit:document.querySelector('[data-map-selected-unit]'),
    selectedLabel:document.querySelector('[data-outcome-source-label]')
  };
  const detail={
    kind:document.querySelector('[data-detail-kind]'),
    title:document.querySelector('[data-detail-title]'),
    summary:document.querySelector('[data-detail-summary]'),
    heading:document.querySelector('[data-entity-heading]'),
    completeness:document.querySelector('[data-entity-completeness]'),
    entities:document.querySelector('[data-entity-list]'),
    latest:document.querySelector('[data-latest-list]'),
    latestCount:document.querySelector('[data-latest-count]'),
    latestHeading:document.querySelector('[data-latest-heading]'),
    processLabel:document.querySelector('[data-selected-source-label]'),
    suppressed:document.querySelector('[data-map-suppressed]'),
    rejectedLabel:document.querySelector('[data-rejected-label]')
  };
  const numberFormatter=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
  const compactFormatter=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});
  const singularUnits={groups:'group',communities:'community',connections:'connection',accounts:'account',feeds:'feed',feed:'feed'};
  const mapState={view:'map',range:'7d',data:null,lastUpdatedAt:null,selectedSourceId:null};
  const header={eyebrow:document.querySelector('.top .eyebrow'),title:document.querySelector('.top h1'),subtitle:document.querySelector('.top .subtitle')};
  const copy={
    map:{eyebrow:'SIGNAL INTELLIGENCE',title:'Signal Intelligence Map',subtitle:''},
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

  function formatCount(value,compact=false){
    const count=numeric(value);
    return count===null?'—':(compact?compactFormatter:numberFormatter).format(count);
  }

  function formatMonitored(source){
    const count=numeric(source?.monitored_count);
    if(count===null)return '—';
    const unit=String(source?.monitored_unit||'').trim().toLowerCase();
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
    const monitored=available?formatMonitored(source):'Unavailable';
    const signals=available?formatCount(source.signals):'—';
    const working=available?formatCount(source.working):'—';
    const outcomeLabel=String(source?.outcome_label||'working').trim().toLowerCase();
    const partial=available&&[source.monitored_count,source.working].some(value=>numeric(value)===null);
    const state=available?(partial?'partial':'ready'):'unavailable';
    const label=shortLabels[node.dataset.sourceId]||String(source?.label||'Source').trim();
    const slots={
      '[data-source-name]':label,
      '[data-source-health-label]':healthLabel(health,available),
      '[data-source-monitored]':monitored,
      '[data-source-signals]':signals,
      '[data-source-surfaced]':working,
      '[data-source-outcome-unit]':outcomeLabel
    };
    Object.entries(slots).forEach(([selector,value])=>{const target=node.querySelector(selector);if(target)target.textContent=value});
    node.dataset.sourceState=state;
    node.dataset.sourceHealth=health;
    node.disabled=false;
    node.setAttribute('aria-label',available
      ?`${label}. ${monitored} monitored, ${working} ${outcomeLabel} for ${range}. Select to trace this source.`
      :`${label}. Source is unavailable for ${range}.`);
  }

  function sourceById(id){
    return mapState.data?.sources?.find(source=>source.id===id)||null;
  }

  function renderSources(map){
    const byId=new Map(map.sources.filter(source=>source&&sourceIds.includes(source.id)).map(source=>[source.id,source]));
    const range=String(map.range||'selected range').toUpperCase();
    sourceIds.forEach(id=>{const node=sourceNodes.get(id);if(node)writeSource(node,byId.get(id)||null,range)});
  }

  function renderSourcesUnavailable(){
    sourceIds.forEach(id=>{const node=sourceNodes.get(id);if(node)writeSource(node,null,'selected range')});
  }

  function strongestSource(map){
    return [...map.sources]
      .filter(source=>source.availability==='available')
      .sort((a,b)=>Number(b.working||0)-Number(a.working||0)||Number(b.surfaced||0)-Number(a.surfaced||0)||Number(b.signals||0)-Number(a.signals||0))[0]?.id||sourceIds[0];
  }

  function entityMetric(entity){
    const working=numeric(entity.working);
    const surfaced=numeric(entity.surfaced);
    const signals=numeric(entity.signals);
    return working!==null&&working>0?working*1000000000+(surfaced||0)*1000000+(signals||0):surfaced!==null&&surfaced>0?surfaced*1000000+(signals||0):(signals||0);
  }

  function renderEntities(source){
    if(!detail.entities)return;
    detail.entities.replaceChildren();
    const entities=Array.isArray(source?.entities)?[...source.entities].sort((a,b)=>entityMetric(b)-entityMetric(a)): [];
    if(detail.heading)detail.heading.textContent=entityHeadings[source?.entity_kind]||'Monitored sources';
    if(detail.completeness)detail.completeness.textContent=source?.entities_complete===true?`ranked by ${String(source?.outcome_label||'activity')}`:'observed activity';
    if(!entities.length){
      const empty=document.createElement('div');
      empty.className='map-detail-empty';
      empty.textContent=source?.availability==='available'?'No named source activity in this range.':'Source data unavailable.';
      detail.entities.append(empty);
      return;
    }
    const visible=entities.slice(0,4);
    const maxMetric=Math.max(...visible.map(entityMetric),1);
    visible.forEach(entity=>{
      const row=document.createElement('div');
      row.className='map-entity-row';
      const name=document.createElement('b');
      name.textContent=String(entity.label||'Unnamed source');
      const counts=document.createElement('span');
      const working=formatCount(entity.working);
      const signals=formatCount(entity.signals,true);
      counts.textContent=`${working} ${String(source?.outcome_label||'working')} · ${signals} seen`;
      const meta=document.createElement('small');
      meta.textContent=String(entity.detail||healthLabel(entity.health,entity.monitored!==false));
      const bar=document.createElement('i');
      bar.style.setProperty('--entity-performance',`${Math.max(3,Math.round(entityMetric(entity)/maxMetric*100))}%`);
      row.append(name,counts,meta,bar);
      detail.entities.append(row);
    });
  }

  function latestForSource(sourceId){
    const rows=mapState.data?.outcomes?.latest||mapState.data?.opportunities?.latest||[];
    return rows.filter(row=>row.source_id===sourceId).slice(0,3);
  }

  function renderLatest(source){
    if(!detail.latest)return;
    detail.latest.replaceChildren();
    const rows=latestForSource(source.id);
    const outcomeLabel=String(source?.outcome_label||'working');
    if(detail.latestHeading)detail.latestHeading.textContent=outcomeLabel==='working'?'Working now':outcomeLabel.charAt(0).toUpperCase()+outcomeLabel.slice(1);
    if(detail.latestCount)detail.latestCount.textContent=rows.length?`${rows.length} shown`:'';
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='map-detail-empty';
      empty.textContent=numeric(source.working)===0?`No ${outcomeLabel} in this range.`:'No activity detail available.';
      detail.latest.append(empty);
      return;
    }
    rows.forEach((opportunity,index)=>{
      const row=document.createElement('div');
      row.className='map-latest-row';
      const rank=document.createElement('span');
      rank.className='map-latest-rank';
      rank.textContent=String(index+1).padStart(2,'0');
      const copyNode=document.createElement('span');
      copyNode.className='map-latest-copy';
      const title=document.createElement('b');
      title.textContent=String(opportunity.title||'Active signal');
      const meta=document.createElement('small');
      meta.textContent=String(opportunity.source_detail||opportunity.geography||opportunity.why_surfaced||'');
      copyNode.append(title,meta);
      const score=document.createElement('span');
      score.className='map-latest-score';
      score.textContent=numeric(opportunity.score)!==null?String(Math.round(Number(opportunity.score))):'';
      row.append(rank,copyNode,score);
      detail.latest.append(row);
    });
  }

  function renderSelection(id){
    const source=sourceById(id);
    if(!source)return;
    mapState.selectedSourceId=id;
    sourceNodes.forEach((node,nodeId)=>node.setAttribute('aria-pressed',String(nodeId===id)));
    const activeNode=sourceNodes.get(id);
    if(activeNode&&workspace){
      const accent=getComputedStyle(activeNode).getPropertyValue('--source-accent').trim();
      if(accent)workspace.style.setProperty('--active-source',accent);
    }
    const label=shortLabels[id]||source.label||'Source';
    const funnel=source.public_funnel||{};
    const steps=Array.isArray(funnel.steps)?funnel.steps:[];
    if(flowTrack)flowTrack.dataset.stepCount=String(Math.min(steps.length,stages.length));
    stages.forEach((stage,index)=>{
      const step=steps[index];
      stage.hidden=!step;
      if(!step)return;
      const stageLabel=stage.querySelector('[data-stage-label]');
      const target=stage.querySelector('[data-stage-value]');
      const icon=stage.querySelector('use');
      if(stageLabel)stageLabel.textContent=String(step.label||'Stage');
      if(target)target.textContent=formatCount(step.value,true);
      if(icon)icon.setAttribute('href',stageIcons[step.icon]||stageIcons.target);
    });
    const rejected=funnel.rejected||null;
    const showRejected=rejected&&numeric(rejected.value)!==null;
    if(rejectedBranch)rejectedBranch.hidden=!showRejected;
    if(detail.suppressed)detail.suppressed.textContent=showRejected?formatCount(rejected.value,true):'—';
    if(detail.rejectedLabel)detail.rejectedLabel.textContent=String(rejected?.label||'AI rejected');
    if(detail.processLabel)detail.processLabel.textContent=label;
    if(detail.kind)detail.kind.textContent=entityHeadings[source.entity_kind]||'Source detail';
    if(detail.title)detail.title.textContent=label;
    if(detail.summary){
      const first=steps[0];
      const pieces=[formatMonitored(source)];
      if(first)pieces.push(`${formatCount(first.value,true)} ${String(first.label||'scanned').toLowerCase()}`);
      pieces.push(`${formatCount(source.working)} ${String(source.outcome_label||'working')}`);
      detail.summary.textContent=pieces.join(' · ');
    }
    if(destination.selected)destination.selected.textContent=formatCount(source.working);
    if(destination.selectedUnit)destination.selectedUnit.textContent=String(source.outcome_label||'working');
    if(destination.selectedLabel)destination.selectedLabel.textContent=label;
    renderEntities(source);
    renderLatest(source);
  }

  function renderDestination(map){
    const opportunities=map?.opportunities||{};
    const outcomes=map?.outcomes||{};
    const range=String(map?.range||mapState.range||'').toUpperCase();
    const values={total:outcomes.total??opportunities.total,hot:opportunities.hot,warm:opportunities.warm,producing:outcomes.producing_sources??opportunities.producing_sources};
    Object.entries(values).forEach(([key,value])=>{if(destination[key])destination[key].textContent=formatCount(value)});
    if(destination.totalLabel)destination.totalLabel.textContent=`${String(outcomes.label||'meaningful signals')}${range?' · '+range:''}`;
  }

  function renderDestinationUnavailable(){
    Object.entries(destination).forEach(([key,target])=>{if(target&&!['selectedLabel','selectedUnit','totalLabel'].includes(key))target.textContent='—'});
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

  sourceNodes.forEach((node,id)=>node.addEventListener('click',()=>{if(mapState.data)renderSelection(id)}));

  window.addEventListener('signal-map:data',event=>{
    const map=event.detail;
    if(!map||!Array.isArray(map.sources)){
      if(!mapState.data){renderSourcesUnavailable();renderDestinationUnavailable()}
      setStatus('Live map data unavailable. Detail Dashboard remains available.','warning');
      return;
    }
    mapState.data=map;
    mapState.range=String(map.range||mapState.range);
    mapState.lastUpdatedAt=map.generated_at||null;
    renderSources(map);
    renderDestination(map);
    const selected=sourceById(mapState.selectedSourceId)?.availability==='available'?mapState.selectedSourceId:strongestSource(map);
    renderSelection(selected);
    const available=map.sources.filter(source=>source.availability==='available').length;
    setStatus(`${available}/${map.sources.length} sources · ${String(map.range||'current range').toUpperCase()}`,'ready');
  });

  window.addEventListener('signal-map:error',event=>{
    if(!mapState.data){renderSourcesUnavailable();renderDestinationUnavailable()}
    const lastUpdate=mapState.lastUpdatedAt?` · Last update ${new Date(mapState.lastUpdatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'';
    setStatus(`${event.detail?.message||'Live data unavailable.'}${lastUpdate}`,'error');
  });

  window.SignalMapView={setSurface,selectSource:renderSelection,getSurface:()=>body.dataset.signalSurface||'map',getState:()=>({...mapState})};
  setSurface(body.dataset.signalSurface||'map');
})();
