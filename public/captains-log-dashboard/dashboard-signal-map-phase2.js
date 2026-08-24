(()=>{
  const plane=document.querySelector('.map-overview-plane');
  const sourcePaths=[...document.querySelectorAll('.map-source-lines path')];
  const entityList=document.querySelector('[data-entity-list]');
  const entityHeading=document.querySelector('[data-entity-heading]');
  const entityCompleteness=document.querySelector('[data-entity-completeness]');

  function numeric(value){
    const n=Number(value);
    return value!==null&&value!==undefined&&Number.isFinite(n)&&n>=0?n:null;
  }

  function formatCount(value){
    const n=numeric(value);
    return n===null?'—':new Intl.NumberFormat(undefined,{notation:n>=1000?'compact':'standard',maximumFractionDigits:1}).format(n);
  }

  function outcomeWord(source,count){
    const label=String(source?.outcome_label||'working').trim().toLowerCase();
    if(count===1){
      if(label==='responses')return 'response';
      if(label==='opportunities')return 'opportunity';
      if(label==='investigated')return 'investigated';
      if(label==='active')return 'active';
      if(label==='working')return 'working';
    }
    return label;
  }

  function relativeTime(value){
    if(!value)return 'Observation time unavailable';
    const then=new Date(value).getTime();
    if(!Number.isFinite(then))return 'Observation time unavailable';
    const delta=Math.max(0,Date.now()-then);
    const mins=Math.floor(delta/60000);
    if(mins<2)return 'Observed just now';
    if(mins<60)return `Observed ${mins}m ago`;
    const hours=Math.floor(mins/60);
    if(hours<24)return `Observed ${hours}h ago`;
    const days=Math.floor(hours/24);
    if(days===1)return 'Observed yesterday';
    if(days<14)return `Observed ${days}d ago`;
    return `Observed ${new Date(then).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
  }

  function entityState(entity){
    const working=numeric(entity?.working)||0;
    const signals=numeric(entity?.signals)||0;
    if(working>0)return {key:'producing',label:'Producing'};
    if(signals>0)return {key:'active',label:'Active'};
    return {key:'idle',label:'Idle this window'};
  }

  function selectedSource(){
    const state=window.SignalMapView?.getState?.();
    const id=state?.selectedSourceId;
    return state?.data?.sources?.find(source=>source.id===id)||null;
  }

  function renderContributorPanel(){
    const source=selectedSource();
    if(!source||!entityList)return;
    const entities=Array.isArray(source.entities)?[...source.entities]:[];
    entityList.replaceChildren();
    entityList.classList.add('entity-performance-list');

    if(entityHeading)entityHeading.textContent='Top Contributors';

    if(!entities.length){
      if(entityCompleteness)entityCompleteness.textContent='No named activity in this window';
      const empty=document.createElement('div');
      empty.className='map-detail-empty';
      empty.textContent=source.availability==='available'?'No named entity activity in this range.':'Source data unavailable.';
      entityList.append(empty);
      return;
    }

    const sourceOutput=numeric(source.working)||0;
    const sourceSignals=numeric(source.signals)||0;
    const useOutputShare=sourceOutput>0;
    if(entityCompleteness){
      entityCompleteness.textContent=useOutputShare
        ?`bars = share of ${formatCount(sourceOutput)} ${outcomeWord(source,sourceOutput)}`
        :sourceSignals>0?'no output yet · bars = activity share':'monitored entities';
    }

    const metricValue=entity=>{
      const output=numeric(entity.working)||0;
      const activity=numeric(entity.signals)||0;
      return useOutputShare?output:activity;
    };
    const denominator=useOutputShare
      ?sourceOutput
      :Math.max(sourceSignals,entities.reduce((sum,entity)=>sum+(numeric(entity.signals)||0),0),1);

    entities.sort((a,b)=>metricValue(b)-metricValue(a)
      ||(numeric(b.working)||0)-(numeric(a.working)||0)
      ||(numeric(b.signals)||0)-(numeric(a.signals)||0)
      ||String(a.label||'').localeCompare(String(b.label||'')));

    entities.slice(0,4).forEach(entity=>{
      const output=numeric(entity.working)||0;
      const activity=numeric(entity.signals)||0;
      const share=denominator>0?Math.max(0,Math.min(100,metricValue(entity)/denominator*100)):0;
      const state=entityState(entity);

      const row=document.createElement('div');
      row.className='entity-performance-row';
      row.dataset.performanceState=state.key;

      const title=document.createElement('div');
      title.className='entity-performance-title';
      const dot=document.createElement('span');
      dot.className='entity-performance-dot';
      const name=document.createElement('b');
      name.textContent=String(entity.label||'Unnamed source');
      title.append(dot,name);

      const counts=document.createElement('div');
      counts.className='entity-performance-counts';
      counts.textContent=`${formatCount(output)} ${outcomeWord(source,output)} · ${formatCount(activity)} seen`;

      const meta=document.createElement('div');
      meta.className='entity-performance-meta';
      const stateLabel=document.createElement('span');
      stateLabel.className='entity-state-label';
      stateLabel.textContent=state.label;
      const lastObserved=document.createElement('span');
      lastObserved.textContent=relativeTime(entity.last_activity_at);
      const contribution=document.createElement('span');
      contribution.className='entity-contribution';
      contribution.textContent=useOutputShare?`${Math.round(share)}% contribution`:`${Math.round(share)}% activity`;
      meta.append(stateLabel,lastObserved,contribution);

      const bar=document.createElement('span');
      bar.className='entity-performance-bar';
      bar.style.setProperty('--entity-contribution',`${Math.max(metricValue(entity)>0?3:0,share).toFixed(1)}%`);

      row.append(title,counts,meta,bar);
      entityList.append(row);
    });
  }

  function alignSourceGeometry(){
    const starts=[45,97,149,201,253,305];
    sourcePaths.forEach((path,index)=>{
      const y=starts[index]??175;
      path.setAttribute('d',`M220 ${y} C285 ${y} 300 190 360 190`);
    });
    if(plane&&!plane.querySelector('.map-intake-waypoint')){
      const intake=document.createElement('span');
      intake.className='map-intake-waypoint';
      intake.setAttribute('aria-hidden','true');
      plane.append(intake);
    }
  }

  function refresh(){
    alignSourceGeometry();
    requestAnimationFrame(renderContributorPanel);
  }

  document.querySelectorAll('[data-source-id]').forEach(node=>node.addEventListener('click',refresh));
  window.addEventListener('signal-map:data',refresh);
  window.addEventListener('signal-map:surface',refresh);
  refresh();
})();
