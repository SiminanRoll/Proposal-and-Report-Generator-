(()=>{
  const stagePresentation=[
    {label:'Scanned',caption:'Posts observed',icon:'#icon-radar'},
    {label:'Cleared',caption:'Passed first filter',icon:'#icon-filter'},
    {label:'Qualified',caption:'AI validated',icon:'#icon-sparkles'},
    {label:'Working Now',caption:'Actionable now',icon:'#icon-target'}
  ];
  const stages=[...document.querySelectorAll('.map-flow-track [data-stage-index]')];
  const outcomes=document.querySelector('.map-outcomes');
  const outcomesLabel=outcomes?.querySelector('.map-outcomes-label');
  const outcomeHeading=outcomes?.querySelector('#mapDestinationHeading');
  const outcomeFacts=outcomes?.querySelector('.map-outcome-facts');
  const processHeading=document.getElementById('mapProcessHeading');
  const flowTrack=document.querySelector('.map-flow-track');

  document.querySelector('.map-suppressed-branch')?.remove();
  document.querySelector('.map-network-lines .map-outcome-line')?.remove();

  if(processHeading)processHeading.textContent='Signal Route';
  if(flowTrack)flowTrack.setAttribute('aria-label','Scanned, cleared, qualified, and working now');
  if(outcomesLabel)outcomesLabel.textContent='Network Overview';
  if(outcomeHeading){
    outcomeHeading.textContent='All Sources';
    outcomeHeading.removeAttribute('data-outcome-source-label');
  }

  if(outcomeFacts){
    outcomeFacts.replaceChildren();
    const active=document.createElement('span');
    active.innerHTML='<b data-phase1-active-sources>—</b><span>/</span><b data-phase1-source-count>—</b><span>sources active</span>';
    const producing=document.createElement('span');
    producing.innerHTML='<b data-phase1-producing-sources>—</b><span>producing sources</span>';
    outcomeFacts.append(active,producing);
  }

  function applyRoutePresentation(){
    stages.forEach((stage,index)=>{
      const presentation=stagePresentation[index];
      if(!presentation)return;
      const label=stage.querySelector('[data-stage-label]');
      const icon=stage.querySelector('.map-stage-icon use');
      let caption=stage.querySelector('.map-stage-caption');
      if(label)label.textContent=presentation.label;
      if(icon)icon.setAttribute('href',presentation.icon);
      if(!caption){
        caption=document.createElement('small');
        caption.className='map-stage-caption';
        stage.append(caption);
      }
      caption.textContent=presentation.caption;
    });
  }

  function renderNetworkOverview(map){
    if(!map||!Array.isArray(map.sources))return;
    const available=map.sources.filter(source=>source?.availability==='available').length;
    const producing=Number(map?.outcomes?.producing_sources ?? map?.opportunities?.producing_sources);
    const activeNode=document.querySelector('[data-phase1-active-sources]');
    const countNode=document.querySelector('[data-phase1-source-count]');
    const producingNode=document.querySelector('[data-phase1-producing-sources]');
    if(activeNode)activeNode.textContent=String(available);
    if(countNode)countNode.textContent=String(map.sources.length);
    if(producingNode)producingNode.textContent=Number.isFinite(producing)?String(producing):'—';
  }

  function refreshPresentation(){
    requestAnimationFrame(applyRoutePresentation);
  }

  applyRoutePresentation();

  document.querySelectorAll('[data-source-id]').forEach(node=>{
    node.addEventListener('click',refreshPresentation);
  });

  window.addEventListener('signal-map:data',event=>{
    renderNetworkOverview(event.detail);
    refreshPresentation();
  });

  window.addEventListener('signal-map:surface',refreshPresentation);
})();
