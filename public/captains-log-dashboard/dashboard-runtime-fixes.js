(()=>{
  let installed=false;
  const SOCIAL_SOURCE_IDS=new Set(['facebook_groups','reddit_groups','linkedin_groups','company_page_engagement']);
  const numberFormatter=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});

  function newest(rows){
    return [...(rows||[])].sort((a,b)=>String(b.completed_at||b.started_at||b.created_at||'').localeCompare(String(a.completed_at||a.started_at||a.created_at||'')))[0]||null;
  }

  function numeric(value){
    const n=Number(value);
    return value!==null&&value!==undefined&&Number.isFinite(n)&&n>=0?n:null;
  }

  function formatCount(value){
    const n=numeric(value);
    return n===null?'—':numberFormatter.format(n);
  }

  function sumKnown(rows,field){
    if(!Array.isArray(rows))return null;
    let total=0;
    for(const row of rows){
      const value=numeric(row?.[field]);
      if(value===null)return null;
      total+=value;
    }
    return total;
  }

  function currentMap(){
    return window.SignalMapView?.getState?.().data||null;
  }

  function selectedSource(){
    const state=window.SignalMapView?.getState?.();
    return state?.data?.sources?.find(source=>source.id===state.selectedSourceId)||null;
  }

  function isSocialSource(source){
    return Boolean(source&&SOCIAL_SOURCE_IDS.has(source.id));
  }

  function sourceOpportunityCounts(source){
    if(!isSocialSource(source))return {buyers:null,replies:null,total:null};

    let buyers=numeric(source.buyer_opportunities);
    let replies=numeric(source.reply_opportunities);

    // Company Page rows already carry Buyer-vs-Reply detail at the entity level,
    // while the older source summary can still expose all surfaced activity as
    // buyer_opportunities. Prefer complete entity evidence for this source.
    if(source.id==='company_page_engagement'&&source.entities_complete===true&&Array.isArray(source.entities)){
      buyers=sumKnown(source.entities,'surfaced');
      replies=sumKnown(source.entities,'reply_opportunities');
    }else if(Array.isArray(source.entities)&&source.entities_complete===true){
      if(buyers===null)buyers=sumKnown(source.entities,'surfaced');
      if(replies===null)replies=sumKnown(source.entities,'reply_opportunities');
    }

    return {
      buyers,
      replies,
      total:buyers!==null&&replies!==null?buyers+replies:null
    };
  }

  function monitoredText(source){
    const count=numeric(source?.monitored_count);
    if(count===null)return '—';
    const unit=String(source?.monitored_unit||'').trim().toLowerCase();
    const singular={groups:'group',communities:'community',connections:'connection',accounts:'account',feeds:'feed',feed:'feed'};
    const displayUnit=count===1?(singular[unit]||unit):unit;
    return `${formatCount(count)}${displayUnit?' '+displayUnit:''}`;
  }

  function socialTotals(map){
    const social=(map?.sources||[]).filter(source=>isSocialSource(source)&&source.availability==='available');
    let buyers=0;
    let replies=0;
    let complete=true;
    let producing=0;
    for(const source of social){
      const counts=sourceOpportunityCounts(source);
      if(counts.buyers===null||counts.replies===null){
        complete=false;
        continue;
      }
      buyers+=counts.buyers;
      replies+=counts.replies;
      if(counts.total>0)producing+=1;
    }
    return {
      buyers:complete?buyers:null,
      replies:complete?replies:null,
      producing,
      sourceCount:social.length,
      complete
    };
  }

  function ensureTaxonomyStyles(){
    if(document.getElementById('signalTaxonomyV1286'))return;
    const style=document.createElement('style');
    style.id='signalTaxonomyV1286';
    style.textContent=`
      .map-outcome-orbit[data-taxonomy-legacy]{display:none!important}
      .signal-output-lanes{display:grid;grid-template-columns:1fr 1fr;gap:9px;width:100%;margin:4px 0 12px}
      .signal-output-lane{min-width:0;padding:11px 10px 10px;border:1px solid rgba(116,190,232,.22);border-radius:14px;background:linear-gradient(180deg,rgba(24,55,77,.7),rgba(11,31,46,.54));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
      .signal-output-lane.reply{border-color:rgba(87,219,192,.25)}
      .signal-output-lane span{display:block;color:#84a8bf;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
      .signal-output-lane strong{display:block;margin-top:2px;color:#e8f7ff;font-size:26px;line-height:1;font-weight:800}
      .signal-output-lane small{display:block;margin-top:5px;color:#8daabd;font-size:10px;line-height:1.25}
      .map-source-copy small.signal-source-output{display:flex;align-items:baseline;gap:4px;flex-wrap:wrap}
      .map-source-copy small.signal-source-output strong{color:#dff5ff}
      .map-source-copy small.signal-source-output .reply-count{color:#8ce8d5}
      .signal-opportunity-kind{display:inline-flex;align-items:center;padding:2px 6px;border:1px solid rgba(112,190,235,.24);border-radius:999px;color:#9fd9fb;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
      .signal-opportunity-kind.reply{border-color:rgba(87,219,192,.3);color:#8ce8d5}
      @media(max-width:900px){.signal-output-lanes{grid-template-columns:1fr 1fr}.signal-output-lane strong{font-size:22px}}
    `;
    document.head.append(style);
  }

  function ensureOutputLanes(){
    const outcomes=document.querySelector('.map-outcomes');
    if(!outcomes)return null;
    const legacy=outcomes.querySelector('.map-outcome-orbit');
    if(legacy)legacy.dataset.taxonomyLegacy='1';
    let lanes=outcomes.querySelector('.signal-output-lanes');
    if(!lanes){
      lanes=document.createElement('div');
      lanes.className='signal-output-lanes';
      lanes.innerHTML=`
        <div class="signal-output-lane buyer"><span>Leads</span><strong data-signal-buyer-total>—</strong><small>Buyer Opportunities</small></div>
        <div class="signal-output-lane reply"><span>Replies</span><strong data-signal-reply-total>—</strong><small>Reply Opportunities</small></div>
      `;
      const heading=outcomes.querySelector('#mapDestinationHeading');
      if(heading)heading.before(lanes); else outcomes.append(lanes);
    }
    const label=outcomes.querySelector('.map-outcomes-label');
    const heading=outcomes.querySelector('#mapDestinationHeading');
    if(label)label.textContent='Social Outputs';
    if(heading)heading.textContent='Leads + Replies';
    return lanes;
  }

  function renderNetworkTaxonomy(map){
    if(!map||!Array.isArray(map.sources))return;
    const lanes=ensureOutputLanes();
    const totals=socialTotals(map);
    const buyerNode=lanes?.querySelector('[data-signal-buyer-total]');
    const replyNode=lanes?.querySelector('[data-signal-reply-total]');
    if(buyerNode)buyerNode.textContent=formatCount(totals.buyers);
    if(replyNode)replyNode.textContent=formatCount(totals.replies);

    const producingNode=document.querySelector('[data-phase1-producing-sources]');
    if(producingNode){
      let structuredProducing=0;
      for(const source of map.sources){
        if(source?.availability!=='available'||isSocialSource(source))continue;
        if((numeric(source.surfaced)||0)>0)structuredProducing+=1;
      }
      producingNode.textContent=String(totals.producing+structuredProducing);
    }
  }

  function renderSourceCards(map){
    for(const source of map?.sources||[]){
      if(!isSocialSource(source))continue;
      const node=document.querySelector(`[data-source-id="${source.id}"]`);
      const small=node?.querySelector('.map-source-copy small');
      if(!small)continue;
      const counts=sourceOpportunityCounts(source);
      small.classList.add('signal-source-output');
      small.replaceChildren();

      const monitored=document.createElement('span');
      monitored.dataset.sourceMonitored='';
      monitored.textContent=monitoredText(source);
      const sep1=document.createTextNode(' · ');
      const buyers=document.createElement('strong');
      buyers.dataset.sourceSurfaced='';
      buyers.textContent=formatCount(counts.buyers);
      const buyerLabel=document.createElement('span');
      buyerLabel.dataset.sourceOutcomeUnit='';
      buyerLabel.textContent='leads';
      const sep2=document.createTextNode(' · ');
      const replies=document.createElement('strong');
      replies.className='reply-count';
      replies.textContent=formatCount(counts.replies);
      const replyLabel=document.createElement('span');
      replyLabel.textContent='replies';
      small.append(monitored,sep1,buyers,buyerLabel,sep2,replies,replyLabel);

      node.setAttribute('aria-label',`${source.label||source.id}. ${monitoredText(source)} monitored, ${formatCount(counts.buyers)} leads and ${formatCount(counts.replies)} reply opportunities. Select to trace this source.`);
    }
  }

  function renderSocialRoute(source){
    if(!isSocialSource(source))return;
    const counts=sourceOpportunityCounts(source);
    const stages=[...document.querySelectorAll('.map-flow-track [data-stage-index]')];
    const firstFunnel=Array.isArray(source.public_funnel?.steps)?source.public_funnel.steps[0]:null;
    const route=[
      {label:source.id==='company_page_engagement'?'Interactions':'Observed',value:firstFunnel?.value??source.signals,caption:source.id==='linkedin_groups'?'Emails observed':'Activity observed',icon:'#icon-radar'},
      {label:'Cleared',value:source.signals,caption:'Passed source filter',icon:'#icon-filter'},
      {label:'AI Reviewed',value:source.stages?.scored??source.stages?.filtered,caption:'Classifier reviewed',icon:'#icon-sparkles'},
      {label:'Opportunities',value:counts.total,caption:'Leads + reply opportunities',icon:'#icon-target'}
    ];
    stages.forEach((stage,index)=>{
      const item=route[index];
      if(!item)return;
      stage.hidden=false;
      const label=stage.querySelector('[data-stage-label]');
      const value=stage.querySelector('[data-stage-value]');
      const caption=stage.querySelector('.map-stage-caption');
      const icon=stage.querySelector('.map-stage-icon use');
      if(label)label.textContent=item.label;
      if(value)value.textContent=formatCount(item.value);
      if(caption)caption.textContent=item.caption;
      if(icon)icon.setAttribute('href',item.icon);
    });
    const flow=document.querySelector('.map-flow-track');
    if(flow){
      flow.dataset.stepCount='4';
      flow.setAttribute('aria-label','Observed, cleared, AI reviewed, then separated into leads and reply opportunities');
    }
  }

  function renderSocialContributors(source){
    if(!isSocialSource(source)||document.body.dataset.signalCenterView==='geo')return;
    const list=document.querySelector('[data-entity-list]');
    if(!list)return;
    const entities=Array.isArray(source.entities)?[...source.entities]:[];
    const heading=document.querySelector('[data-entity-heading]');
    const completeness=document.querySelector('[data-entity-completeness]');
    if(heading)heading.textContent='Top Contributors';
    list.replaceChildren();
    list.classList.remove('geo-inline-state-list');
    list.classList.add('entity-performance-list');

    if(!entities.length){
      if(completeness)completeness.textContent='No named activity in this window';
      const empty=document.createElement('div');
      empty.className='map-detail-empty';
      empty.textContent=source.availability==='available'?'No named entity activity in this range.':'Source data unavailable.';
      list.append(empty);
      return;
    }

    const entityOutput=entity=>(numeric(entity.surfaced)||0)+(numeric(entity.reply_opportunities)||0);
    const totalOutput=entities.reduce((sum,entity)=>sum+entityOutput(entity),0);
    const totalSignals=Math.max(numeric(source.signals)||0,entities.reduce((sum,entity)=>sum+(numeric(entity.signals)||0),0),1);
    const useOutput=totalOutput>0;
    if(completeness)completeness.textContent=useOutput?`bars = share of ${formatCount(totalOutput)} opportunities`:'no output yet · bars = activity share';

    entities.sort((a,b)=>entityOutput(b)-entityOutput(a)||(numeric(b.signals)||0)-(numeric(a.signals)||0)||String(a.label||'').localeCompare(String(b.label||'')));
    entities.slice(0,4).forEach(entity=>{
      const buyers=numeric(entity.surfaced)||0;
      const replies=numeric(entity.reply_opportunities)||0;
      const activity=numeric(entity.signals)||0;
      const metric=useOutput?buyers+replies:activity;
      const denominator=useOutput?Math.max(totalOutput,1):totalSignals;
      const share=Math.max(0,Math.min(100,metric/denominator*100));

      const row=document.createElement('div');
      row.className='entity-performance-row';
      row.dataset.performanceState=buyers+replies>0?'producing':activity>0?'active':'idle';

      const title=document.createElement('div');
      title.className='entity-performance-title';
      const dot=document.createElement('span');
      dot.className='entity-performance-dot';
      const name=document.createElement('b');
      name.textContent=String(entity.label||'Unnamed source');
      title.append(dot,name);

      const counts=document.createElement('div');
      counts.className='entity-performance-counts';
      counts.textContent=`${formatCount(buyers)} leads · ${formatCount(replies)} replies · ${formatCount(activity)} seen`;

      const meta=document.createElement('div');
      meta.className='entity-performance-meta';
      const state=document.createElement('span');
      state.className='entity-state-label';
      state.textContent=buyers+replies>0?'Producing':activity>0?'Active':'Idle this window';
      const contribution=document.createElement('span');
      contribution.className='entity-contribution';
      contribution.textContent=useOutput?`${Math.round(share)}% of opportunities`:`${Math.round(share)}% of activity`;
      meta.append(state,contribution);

      const bar=document.createElement('span');
      bar.className='entity-performance-bar';
      bar.style.setProperty('--entity-contribution',`${Math.max(metric>0?3:0,share).toFixed(1)}%`);
      row.append(title,counts,meta,bar);
      list.append(row);
    });
  }

  function isReplyRow(row){
    return String(row?.opportunity_kind||'').toLowerCase()==='conversation'||String(row?.display_kind||'').toLowerCase().includes('reply');
  }

  function socialLatestRows(map,sourceId){
    const seen=new Set();
    const result=[];
    const add=(row,kind)=>{
      if(!row||row.source_id!==sourceId)return;
      const id=String(row.id||`${row.source_id}:${row.occurred_at}:${row.title}`);
      if(seen.has(id))return;
      seen.add(id);
      result.push({...row,__kind:kind});
    };
    for(const row of map?.opportunities?.latest||[]){
      add(row,isReplyRow(row)?'reply':'buyer');
    }
    for(const row of map?.reply_opportunities?.latest||[]){
      add(row,'reply');
    }
    return result.sort((a,b)=>{
      const kindDelta=(a.__kind==='buyer'?0:1)-(b.__kind==='buyer'?0:1);
      if(kindDelta)return kindDelta;
      return String(b.occurred_at||'').localeCompare(String(a.occurred_at||''));
    }).slice(0,4);
  }

  function renderSocialLatest(source,map){
    if(!isSocialSource(source))return;
    const list=document.querySelector('[data-latest-list]');
    const heading=document.querySelector('[data-latest-heading]');
    const countNode=document.querySelector('[data-latest-count]');
    if(!list)return;
    const rows=socialLatestRows(map,source.id);
    if(heading)heading.textContent='Leads + Reply Opportunities';
    if(countNode)countNode.textContent=rows.length?`${rows.length} shown`:'';
    list.replaceChildren();
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='map-detail-empty';
      empty.textContent='No leads or reply opportunities in this range.';
      list.append(empty);
      return;
    }

    rows.forEach((opportunity,index)=>{
      const row=document.createElement('div');
      row.className='map-latest-row';
      const rank=document.createElement('span');
      rank.className='map-latest-rank';
      rank.textContent=String(index+1).padStart(2,'0');
      const copy=document.createElement('span');
      copy.className='map-latest-copy';
      const title=document.createElement('b');
      title.textContent=String(opportunity.title||'Signal opportunity');
      const meta=document.createElement('small');
      const kind=document.createElement('span');
      kind.className=`signal-opportunity-kind ${opportunity.__kind==='reply'?'reply':''}`;
      kind.textContent=opportunity.__kind==='reply'?'Reply':'Lead';
      const detail=document.createElement('span');
      detail.textContent=String(opportunity.source_detail||opportunity.geography||opportunity.why_surfaced||'');
      meta.append(kind,document.createTextNode(' '),detail);
      copy.append(title,meta);
      const score=document.createElement('span');
      score.className='map-latest-score';
      score.textContent=numeric(opportunity.score)!==null?String(Math.round(Number(opportunity.score))):'';
      row.append(rank,copy,score);
      list.append(row);
    });
  }

  function renderSelectedSocial(map){
    const source=selectedSource();
    if(!isSocialSource(source))return;
    const counts=sourceOpportunityCounts(source);
    const summary=document.querySelector('[data-detail-summary]');
    if(summary){
      const parts=[monitoredText(source),`${formatCount(counts.buyers)} leads`,`${formatCount(counts.replies)} replies`];
      const working=numeric(source.working);
      if(working!==null)parts.push(`${formatCount(working)} actioned`);
      summary.textContent=parts.join(' · ');
    }
    renderSocialRoute(source);
    renderSocialContributors(source);
    renderSocialLatest(source,map);
  }

  function applySignalTaxonomy(map=currentMap()){
    if(!map||!Array.isArray(map.sources))return;
    ensureTaxonomyStyles();
    renderNetworkTaxonomy(map);
    renderSourceCards(map);
    renderSelectedSocial(map);
    document.body.dataset.dashboardVersion='1.2.86';
    const build=document.querySelector('.dashboard-build b');
    if(build)build.textContent='v1.2.86';
  }

  function scheduleSignalTaxonomy(map=currentMap()){
    requestAnimationFrame(()=>requestAnimationFrame(()=>applySignalTaxonomy(map)));
  }

  function install(){
    if(installed)return true;
    if(typeof S==='undefined'||typeof latestRunner!=='function'||typeof runnerState!=='function'||typeof permitSources!=='function'||typeof isRunSuccess!=='function')return false;

    const originalLatestRunner=latestRunner;
    const originalRunnerState=runnerState;

    window.latestRunner=function(id){
      const parent=originalLatestRunner(id);
      if(parent)return parent;

      if(id==='permit_radar'){
        const r=newest(S.data?.permit_runs||[]);
        if(r)return {
          runner_id:id,
          status:r.status,
          started_at:r.started_at,
          completed_at:r.completed_at,
          last_error:r.last_error,
          host_name:'Source telemetry',
          __source_fallback:true
        };
      }

      if(id==='npi_radar'){
        const r=newest(S.data?.npi_runs||S.data?.npi_runs_window||[]);
        if(r)return {
          runner_id:id,
          status:r.status,
          started_at:r.started_at,
          completed_at:r.completed_at,
          last_error:r.last_error,
          host_name:'Ingest telemetry',
          metrics:{candidates_created:Number(r.candidates_created||0)},
          __source_fallback:true
        };
      }

      return null;
    };

    window.runnerState=function(id){
      const parent=originalLatestRunner(id);

      if(id==='permit_radar'&&!parent){
        const sources=permitSources();
        if(sources.length){
          const healthy=sources.filter(x=>x.state==='HEALTHY').length;
          if(healthy===sources.length)return['HEALTHY',`${healthy}/${sources.length} sources current · parent telemetry pending`];
          if(healthy>0)return['WARNING',`${healthy}/${sources.length} sources current`];
          return['ERROR','No Permit sources are current'];
        }
      }

      if(id==='npi_radar'&&!parent){
        const r=newest(S.data?.npi_runs||S.data?.npi_runs_window||[]);
        if(r){
          if(!isRunSuccess(r.status))return[typeof statusClass==='function'?statusClass(r.status):'WARNING',r.last_error||'Latest NPI ingest did not complete cleanly'];
          const t=new Date(r.completed_at||r.started_at||0).getTime();
          const age=Date.now()-t;
          if(Number.isFinite(age)&&age>8*86400000)return['WARNING','Latest NPI ingest is overdue'];
          return['HEALTHY',`Latest ingest completed · ${Number(r.candidates_created||0)} candidates`];
        }
      }

      return originalRunnerState(id);
    };

    installed=true;
    if(S.data&&typeof renderOverview==='function')renderOverview();
    scheduleSignalTaxonomy();
    return true;
  }

  window.addEventListener('signal-map:data',event=>scheduleSignalTaxonomy(event.detail));
  window.addEventListener('signal-map:surface',()=>scheduleSignalTaxonomy());
  document.querySelectorAll('[data-source-id]').forEach(node=>node.addEventListener('click',()=>scheduleSignalTaxonomy()));

  const timer=setInterval(()=>{if(install())clearInterval(timer)},250);
})();
