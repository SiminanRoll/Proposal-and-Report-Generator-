(()=>{
  const configuredDefault=['r/Businessowners','r/Dentists','r/LawFirm','r/lawfirms','r/smallbusiness','r/taxpros'];
  let installed=false;
  const redditRows=()=>S.data?.reddit_signals_window||[];
  const redditOpps=()=>redditRows().filter(x=>x.should_surface===true);
  const redditScans=()=>S.data?.reddit_scans_window||[];
  const configured=()=>S.data?.reddit_configured_subreddits||configuredDefault;
  const latestScan=()=>[...(S.data?.reddit_scans||[])].sort((a,b)=>String(b.received_at||'').localeCompare(String(a.received_at||'')))[0]||null;
  const scanSummary=()=>latestScan()?.raw_summary||{};
  const sumSummary=key=>redditScans().reduce((a,x)=>a+N(x.raw_summary?.[key]),0);
  const tierLabel=v=>({hot:'HOT',bubble:'WARM',quiet:'QUIET',hidden:'HIDDEN'})[String(v||'').toLowerCase()]||String(v||'—').toUpperCase();
  const typeLabel=v=>typeof socialTypeLabel==='function'?socialTypeLabel(v):String(v||'').replaceAll('_',' ');
  function redditHealth(){
    const s=latestScan();if(!s)return['WARNING','Awaiting first Reddit scan'];
    const summary=s.raw_summary||{},cfg=N(summary.groups_configured)||configured().length,done=N(s.groups_scanned),errs=Array.isArray(summary.errors)?summary.errors.length:0,age=Date.now()-new Date(s.received_at||s.source_timestamp||0).getTime();
    if(age>30*60*1000)return['WARNING',`Reddit scan is stale · ${done}/${cfg} subreddits`];
    if(errs||done<cfg)return['WARNING',`${done}/${cfg} subreddits scanned · ${errs} errors`];
    return['HEALTHY',`${done}/${cfg} subreddits scanned`];
  }
  function subredditStats(){
    const rows=redditRows();
    return configured().map(name=>{const r=rows.filter(x=>String(x.group_name||'').toLowerCase()===String(name).toLowerCase()),surf=r.filter(x=>x.should_surface===true),sup=r.filter(x=>String(x.classification_status||'').toLowerCase()==='suppressed'),avg=surf.length?Math.round(surf.reduce((a,x)=>a+N(x.signal_score),0)/surf.length):0,last=r.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0];return{name,total:r.length,surfaced:surf.length,suppressed:sup.length,avg,last:last?.created_at||null}})
  }
  function renderRunnerGridReddit(){
    const cfg=Object.fromEntries((S.data?.runners||[]).map(x=>[x.runner_id,x]));
    const defs=[['social_oss','SOCIAL / OSS'],['permit_radar','PERMIT RADAR'],['npi_radar','NPI RADAR'],['intent_radar','INTENT']];
    $('runnerGrid').innerHTML=defs.map(([id,name])=>{
      if(id==='intent_radar'){
        const[state,msg]=redditHealth(),s=latestScan();return`<div class="runner"><div class="row"><div class="runner-name">${name}</div><span class="badge ${state}">${state}</span></div><div class="runner-msg">Reddit Radar · ${esc(msg)}</div><div class="mini"><span>LAST EVENT</span><b>${ago(s?.received_at||s?.source_timestamp)}</b></div><div class="mini"><span>HOST</span><b class="cut">AWS Lightsail OSS Runner 1</b></div></div>`;
      }
      const[state,msg]=runnerState(id),r=latestRunner(id),host=cfg[id]?.host_display_name||r?.host_name||(id==='social_oss'?S.data?.social_health?.[0]?.hostname:null)||'Unverified';
      return`<div class="runner"><div class="row"><div class="runner-name">${name}</div><span class="badge ${state}">${state}</span></div><div class="runner-msg">${esc(msg)}</div><div class="mini"><span>LAST EVENT</span><b>${ago(r?.completed_at||r?.started_at||(id==='social_oss'?S.data?.social_health?.[0]?.heartbeat_at:null))}</b></div><div class="mini"><span>HOST</span><b class="cut">${esc(host)}</b></div></div>`
    }).join('')
  }
  function renderOverviewReddit(){
    const po=permitOpps(),so=socialOpps(),no=npiOpps(),ro=redditOpps(),src=permitSources(),healthy=src.filter(x=>x.state==='HEALTHY').length,allOpp=po.length+so.length+no.length+ro.length;
    $('overviewKpis').classList.add('reddit-overview-six');
    $('overviewKpis').innerHTML=[kpi('TOTAL OPPORTUNITIES',allOpp,`${S.days} day view`),kpi('PERMIT CONNECTIONS',`${healthy}/${src.length}`,healthy===src.length?'All current':'Needs attention'),kpi('SOCIAL OPPORTUNITIES',so.length,`${socialSuppressed().length} suppressed excluded`),kpi('PERMIT OPPORTUNITIES',po.length,`${sum(S.data?.permit_runs_window||[],'records_seen').toLocaleString()} permits scanned`),kpi('NPI OPPORTUNITIES',no.length,'Review-worthy candidates'),kpi('INTENT OPPORTUNITIES',ro.length,'Reddit surfaced')].join('');
    renderRunnerGridReddit();
    drawMulti('overviewChart',[{label:'Permit',values:bucket(po,'created_at'),color:css('--accent')},{label:'Social',values:bucket(so,'created_at'),color:css('--green')},{label:'NPI',values:bucket(no,'created_at'),color:css('--purple')},{label:'Intent',values:bucket(ro,'created_at'),color:'#b596ff'}]);
    const max=Math.max(1,po.length,so.length,no.length,ro.length);$('mixBars').innerHTML=progress('Permit',po.length,max)+progress('Social',so.length,max,'green')+progress('NPI',no.length,max,'purple')+progress('Intent',ro.length,max,'purple');drawBars('mixChart',[{label:'Permit',value:po.length,color:css('--accent')},{label:'Social',value:so.length,color:css('--green')},{label:'NPI',value:no.length,color:css('--purple')},{label:'Intent',value:ro.length,color:'#b596ff'}]);
    const legend=$('overview')?.querySelector('.legend');if(legend&&!legend.querySelector('[data-reddit-legend]'))legend.insertAdjacentHTML('beforeend','<span data-reddit-legend><i style="background:#b596ff"></i>Intent</span>');
    $('overviewPermitSources').innerHTML=src.map(sourceCard).join('');attachFlip();
  }
  function bindRedditLinks(root=document){root.querySelectorAll('[data-reddit-url]').forEach(el=>{if(el.dataset.redditBound)return;el.dataset.redditBound='1';el.addEventListener('click',()=>{const u=el.dataset.redditUrl;if(u)window.open(u,'_blank','noopener')})})}
  function renderOpportunitiesReddit(){
    const po=permitOpps(),so=socialOpps(),no=npiOpps(),ro=redditOpps(),total=po.length+so.length+no.length+ro.length;
    $('opportunityKpis').innerHTML=[kpi('TOTAL OPPORTUNITIES',total,`${S.days} day view`),kpi('SOCIAL',so.length,'Facebook groups'),kpi('PERMITS',po.length,'Actual matches'),kpi('NPI',no.length,'Review-worthy'),kpi('INTENT',ro.length,'Reddit surfaced')].join('');
    drawMulti('opportunityChart',[{label:'Permit',values:bucket(po,'created_at'),color:css('--accent')},{label:'Social',values:bucket(so,'created_at'),color:css('--green')},{label:'NPI',values:bucket(no,'created_at'),color:css('--purple')},{label:'Intent',values:bucket(ro,'created_at'),color:'#b596ff'}]);
    $('latestPermit').innerHTML=po.slice(0,7).map(x=>`<div class="mini"><span>${esc(x.practice_name||x.address_text||'Permit opportunity')}</span><b>${esc(x.opportunity_score??'—')}</b></div>`).join('')||'<div class="empty">No Permit opportunities in this range.</div>';
    const other=[...so.map(x=>({when:x.created_at,label:`Social · ${x.group_name||x.author_name||'Signal'}`,score:x.signal_score})),...no.map(x=>({when:x.created_at,label:`NPI · ${x.practice_name||'Candidate'}`,score:x.opportunity_score})),...ro.map(x=>({when:x.created_at,label:`Intent · ${x.group_name||'Reddit'}`,score:x.signal_score,url:x.post_url}))].sort((a,b)=>String(b.when).localeCompare(String(a.when))).slice(0,12);
    $('latestOther').innerHTML=other.map(x=>`<div class="mini" ${x.url?`data-reddit-url="${esc(x.url)}" style="cursor:pointer"`:''}><span>${esc(x.label)}${x.url?' ↗':''}</span><b>${esc(x.score??'—')}</b></div>`).join('')||'<div class="empty">No Social, NPI, or Intent opportunities in this range.</div>';bindRedditLinks($('latestOther'))
  }
  function renderIntentReddit(){
    const sec=$('intent');if(!sec)return;const scans=redditScans(),rows=redditRows(),opp=redditOpps(),latest=latestScan(),summary=scanSummary(),stats=subredditStats(),processed=sum(scans,'total_processed'),forwarded=sumSummary('prefilter_forwarded'),prefiltered=sumSummary('prefilter_suppressed'),aiSuppressed=rows.filter(x=>String(x.classification_status||'').toLowerCase()==='suppressed').length,[state,msg]=redditHealth(),cfg=N(summary.groups_configured)||configured().length,done=N(latest?.groups_scanned),scanErrors=redditScans().reduce((a,x)=>a+(Array.isArray(x.raw_summary?.errors)?x.raw_summary.errors.length:0),0);
    sec.innerHTML=`<div class="wip reddit-hero"><div class="row"><div><div class="eyebrow">INTENT</div><h2>Reddit Signal Radar</h2></div><span class="badge ${state}">${state}</span></div><div class="subtitle">Buyer-intent monitoring across curated business subreddits.</div></div><div class="kpis reddit-kpis section-gap" id="intentKpis"></div><div class="grid2"><article class="panel"><div class="panel-head"><div><div class="panel-title">Reddit signal activity</div><div class="tiny">Candidates vs surfaced opportunities</div></div></div><div class="chart"><canvas id="intentChart"></canvas></div></article><article class="panel reddit-pipeline"><div class="panel-head"><div><div class="panel-title">Signal pipeline</div><div class="tiny">Current window</div></div><span class="filter-chip">${esc(msg)}</span></div><div id="redditPipeline"></div></article></div><article class="panel section-gap"><div class="panel-head"><div><div class="panel-title">Subreddit performance</div><div class="tiny">Candidate and opportunity yield by community</div></div><span class="reddit-status"><i class="reddit-status-dot"></i>${done}/${cfg} monitored</span></div><div class="reddit-grid" id="redditSubreddits"></div></article><article class="panel section-gap"><div class="panel-head"><div><div class="panel-title">Recent Reddit candidates</div><div class="tiny">Click a row to open the original post</div></div><span class="filter-chip">${opp.length} SURFACED</span></div><div class="table-wrap"><table><thead><tr><th>Seen</th><th>Subreddit</th><th>Author</th><th>Signal</th><th>Score</th><th>Tier</th><th>Result</th></tr></thead><tbody id="redditRows"></tbody></table></div></article>`;
    $('intentKpis').innerHTML=[kpi('COMMUNITIES',`${done}/${cfg}`,latest?'Latest scan':'Awaiting scan'),kpi('SCANS',scans.length,`${S.days} day view`),kpi('POSTS PROCESSED',processed.toLocaleString(),`${prefiltered} filtered locally`),kpi('FORWARDED TO AI',forwarded.toLocaleString(),`${aiSuppressed} AI suppressed`),kpi('SURFACED',opp.length,latest?`Last scan ${ago(latest.received_at)}`:'No scan yet')].join('');
    drawMulti('intentChart',[{label:'Candidates',values:bucket(rows,'created_at'),color:'#7e68d8'},{label:'Surfaced',values:bucket(opp,'created_at'),color:'#b596ff'}]);
    const max=Math.max(1,processed,forwarded,aiSuppressed,opp.length);$('redditPipeline').innerHTML=progress('Posts processed',processed,max)+progress('Forwarded by prefilter',forwarded,max,'purple')+progress('AI suppressed',aiSuppressed,max,'yellow')+progress('Surfaced opportunities',opp.length,max,'green')+`<div class="mini"><span>SCAN ERRORS</span><b>${scanErrors}</b></div><div class="mini"><span>LATEST SCAN</span><b>${latest?ago(latest.received_at):'Never'}</b></div>`;
    $('redditSubreddits').innerHTML=stats.map(g=>`<div class="reddit-card"><div class="reddit-name">${esc(g.name)}</div><div class="reddit-sub">${g.total?'Candidate activity recorded':'Monitoring active'}</div><div class="reddit-metrics"><div class="reddit-metric"><b>${g.total}</b><span>CANDIDATES</span></div><div class="reddit-metric"><b>${g.surfaced}</b><span>OPPORTUNITIES</span></div><div class="reddit-metric"><b>${g.suppressed}</b><span>SUPPRESSED</span></div><div class="reddit-metric"><b>${g.avg||'—'}</b><span>AVG SURFACED SCORE</span></div></div><div class="switch-note">Last candidate ${g.last?esc(ago(g.last)):'—'}</div></div>`).join('')||'<div class="reddit-empty-card">No configured subreddits returned.</div>';
    $('redditRows').innerHTML=rows.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,150).map(x=>`<tr class="reddit-table-row" ${x.post_url?`data-reddit-url="${esc(x.post_url)}"`:''}><td class="nowrap">${stamp(x.posted_at||x.created_at)}</td><td>${esc(x.group_name||'Reddit')}</td><td>${esc(x.author_name||'—')}</td><td class="cut">${esc(typeLabel(x.signal_type)||x.source_ai_label||'Candidate')}${x.post_url?'<span class="reddit-open">OPEN ↗</span>':''}</td><td>${esc(x.signal_score??'—')}</td><td>${esc(tierLabel(x.notification_tier))}</td><td class="${x.should_surface?'HEALTHY':''}">${x.should_surface?'SURFACED':esc(String(x.classification_status||'PENDING').toUpperCase())}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No new Reddit candidates in this window yet. Monitoring is active.</td></tr>';
    bindRedditLinks(sec)
  }
  function install(){
    if(installed)return true;
    if(typeof S==='undefined'||typeof renderOverview!=='function'||typeof renderOpportunities!=='function'||typeof renderRunnerGrid!=='function'||typeof renderIntent!=='function'||typeof permitOpps!=='function')return false;
    window.renderRunnerGrid=renderRunnerGridReddit;window.renderOverview=renderOverviewReddit;window.renderOpportunities=renderOpportunitiesReddit;window.renderIntent=renderIntentReddit;installed=true;
    if(S.data){renderOverviewReddit();renderOpportunitiesReddit();renderIntentReddit()}return true
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer)},200);
})();
