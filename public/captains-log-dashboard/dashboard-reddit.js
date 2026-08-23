(()=>{
  const configuredDefault=[];
  let installed=false;
  const redditRows=()=>S.data?.reddit_signals_window||[];
  const redditRows7d=()=>S.data?.reddit_signals_7d||redditRows();
  const redditOpps=()=>redditRows().filter(x=>x.should_surface===true);
  const redditScans=()=>S.data?.reddit_scans_window||[];
  const redditScans7d=()=>S.data?.reddit_scans_7d||redditScans();
  const configured=()=>S.data?.reddit_configured_subreddits||configuredDefault;
  const latestScan=()=>[...(S.data?.reddit_scans||[])].sort((a,b)=>String(b.received_at||'').localeCompare(String(a.received_at||'')))[0]||null;
  const scanSummary=()=>latestScan()?.raw_summary||{};
  const sumSummary=key=>redditScans().reduce((a,x)=>a+N(x.raw_summary?.[key]),0);
  const sumSummaryCompat=(key,fallback)=>redditScans().reduce((a,x)=>a+N(x.raw_summary?.[key]??x[fallback]),0);
  const redditAccountLabel=()=>{const s=scanSummary(),source=String(s.community_inventory_source||'').toLowerCase(),state=String(s.account_login_state||'not_logged_in').toLowerCase();if(source==='tracked_manual'||state==='manual')return'Manual list';return state==='logged_in'?'Logged in':'Not logged in'};
  const tierLabel=v=>({hot:'HOT',bubble:'WARM',quiet:'QUIET',hidden:'HIDDEN'})[String(v||'').toLowerCase()]||String(v||'—').toUpperCase();
  const typeLabel=v=>typeof socialTypeLabel==='function'?socialTypeLabel(v):String(v||'').replaceAll('_',' ');
  function redditHealth(){
    const s=latestScan();if(!s)return['WARNING','Awaiting first Reddit scan'];
    const summary=s.raw_summary||{},cfg=N(summary.groups_configured)||configured().length,done=N(s.groups_scanned),errs=Array.isArray(summary.errors)?summary.errors.length:0,age=Date.now()-new Date(s.received_at||s.source_timestamp||0).getTime();
    if(age>90*60*1000)return['WARNING',`Reddit scan is stale · ${done}/${cfg} subreddits`];
    if(errs||done<cfg)return['WARNING',`${done}/${cfg} subreddits scanned · ${errs} errors`];
    return['HEALTHY',`${done}/${cfg} subreddits scanned`];
  }
  const subredditKey=value=>String(value||'').trim().replace(/^r\//i,'').toLowerCase();
  const communityRows=scan=>Array.isArray(scan?.raw_summary?.community_stats)?scan.raw_summary.community_stats:[];
  function historicalUnattributed(sinceMs){
    const scans=redditScans7d().filter(x=>communityRows(x).length===0&&new Date(x.received_at||x.source_timestamp||0).getTime()>=sinceMs);
    return scans.reduce((out,scan)=>{
      const summary=scan.raw_summary||{};
      out.posts+=N(summary.prefilter_input??scan.total_processed);
      out.suppressed+=N(summary.prefilter_suppressed);
      out.forwarded+=N(summary.prefilter_forwarded??scan.total_matches);
      return out;
    },{posts:0,suppressed:0,forwarded:0,scans:scans.length});
  }
  function subredditPeriod(name,sinceMs){
    const key=subredditKey(name);
    const scans=redditScans7d().filter(x=>new Date(x.received_at||x.source_timestamp||0).getTime()>=sinceMs);
    let posts=0,localSuppressed=0,forwarded=0;
    scans.forEach(scan=>communityRows(scan).filter(x=>subredditKey(x.name||x.subreddit)===key).forEach(x=>{posts+=N(x.new_posts);localSuppressed+=N(x.prefilter_suppressed);forwarded+=N(x.prefilter_forwarded)}));
    const outcomes=redditRows7d().filter(x=>subredditKey(x.group_name)===key&&new Date(x.created_at||x.first_seen_at||0).getTime()>=sinceMs);
    const aiSuppressed=outcomes.filter(x=>String(x.classification_status||'').toLowerCase()==='suppressed').length;
    const surfaced=outcomes.filter(x=>x.should_surface===true).length;
    return{posts,localSuppressed,aiSuppressed,suppressed:localSuppressed+aiSuppressed,forwarded,surfaced};
  }
  function subredditStats(){
    const now=Date.now(),daySince=now-86400000,weekSince=now-7*86400000;
    const metricScans=redditScans7d().filter(x=>communityRows(x).length>0).sort((a,b)=>String(a.received_at||'').localeCompare(String(b.received_at||'')));
    const newest=[...metricScans].reverse()[0],coverage=metricScans[0]?.received_at||null;
    return configured().map(name=>{
      const latest=communityRows(newest).find(x=>subredditKey(x.name||x.subreddit)===subredditKey(name));
      const today=subredditPeriod(name,daySince),week=subredditPeriod(name,weekSince);
      return{name,today,week,latestFeed:N(latest?.feed_posts_seen),coverage,rate:week.posts?Math.round(week.suppressed/week.posts*100):0};
    }).sort((a,b)=>b.week.posts-a.week.posts||String(a.name).localeCompare(String(b.name)));
  }
  function renderRunnerGridReddit(){
    const cfg=Object.fromEntries((S.data?.runners||[]).map(x=>[x.runner_id,x]));
    const defs=[['social_oss','SOCIAL / OSS'],['permit_radar','PERMIT RADAR'],['npi_radar','NPI RADAR'],['intent_radar','INTENT']];
    $('runnerGrid').innerHTML=defs.map(([id,name])=>{
      if(id==='intent_radar'){
        const[state,msg]=redditHealth(),s=latestScan(),account=redditAccountLabel();return`<div class="runner"><div class="row"><div class="runner-name">${name}</div><span class="badge ${state}">${state}</span></div><div class="runner-msg">Reddit Radar · ${esc(msg)}</div><div class="mini"><span>ACCOUNT</span><b>${esc(account)}</b></div><div class="mini"><span>LAST EVENT</span><b>${ago(s?.received_at||s?.source_timestamp)}</b></div><div class="mini"><span>HOST</span><b class="cut">AWS Lightsail OSS Runner 1</b></div></div>`;
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
    const sec=$('intent');if(!sec)return;const scans=redditScans(),rows=redditRows(),opp=redditOpps(),latest=latestScan(),summary=scanSummary(),stats=subredditStats(),instrumented=scans.filter(x=>x.raw_summary?.feed_posts_seen!==null&&x.raw_summary?.feed_posts_seen!==undefined),fetched=instrumented.reduce((a,x)=>a+N(x.raw_summary?.feed_posts_seen),0),preParser=sumSummaryCompat('prefilter_input','total_processed'),forwarded=sumSummary('prefilter_forwarded'),locallySuppressed=sumSummary('prefilter_suppressed'),aiSuppressed=rows.filter(x=>String(x.classification_status||'').toLowerCase()==='suppressed').length,feedWindowMinutes=N(summary.feed_window_minutes),feedWindowText=feedWindowMinutes?feedWindowMinutes>=60?`${(feedWindowMinutes/60).toFixed(1)} hours`:`${Math.round(feedWindowMinutes)} minutes`:'pending next instrumented scan',[state,msg]=redditHealth(),account=redditAccountLabel(),cfg=N(summary.groups_configured)||configured().length,done=N(latest?.groups_scanned),scanErrors=redditScans().reduce((a,x)=>a+(Array.isArray(x.raw_summary?.errors)?x.raw_summary.errors.length:0),0);
    const postsToday=stats.reduce((a,x)=>a+x.today.posts,0),postsWeek=stats.reduce((a,x)=>a+x.week.posts,0),suppressedWeek=stats.reduce((a,x)=>a+x.week.suppressed,0),forwardedWeek=stats.reduce((a,x)=>a+x.week.forwarded,0),surfacedWeek=stats.reduce((a,x)=>a+x.week.surfaced,0),coverage=stats.find(x=>x.coverage)?.coverage||null,legacyDay=historicalUnattributed(Date.now()-86400000),legacyWeek=historicalUnattributed(Date.now()-7*86400000);
    sec.innerHTML=`<div class="wip reddit-hero"><div class="row"><div><div class="eyebrow">INTENT</div><h2>Reddit Signal Radar</h2></div><span class="badge ${state}">${state}</span></div><div class="subtitle">Buyer-intent monitoring across curated business subreddits. <span class="reddit-session">${esc(account)}</span></div></div><div class="kpis reddit-kpis section-gap" id="intentKpis"></div><div class="grid2"><article class="panel"><div class="panel-head"><div><div class="panel-title">Reddit signal activity</div><div class="tiny">Candidates vs surfaced opportunities</div></div></div><div class="chart"><canvas id="intentChart"></canvas></div></article><article class="panel reddit-pipeline"><div class="panel-head"><div><div class="panel-title">Signal pipeline</div><div class="tiny">Current window</div></div><span class="filter-chip">${esc(msg)}</span></div><div id="redditPipeline"></div></article></div><article class="panel section-gap"><div class="panel-head"><div><div class="panel-title">Subreddit performance</div><div class="tiny">Distinct new posts observed · suppression combines local rules and final classification</div></div><span class="reddit-status"><i class="reddit-status-dot"></i>${done}/${cfg} monitored</span></div><div class="reddit-history-note" id="redditHistoryNote"></div><div class="reddit-grid" id="redditSubreddits"></div></article><article class="panel section-gap"><div class="panel-head"><div><div class="panel-title">Recent Reddit candidates</div><div class="tiny">Click a row to open the original post</div></div><span class="filter-chip">${opp.length} SURFACED</span></div><div class="table-wrap"><table><thead><tr><th>Seen</th><th>Subreddit</th><th>Author</th><th>Signal</th><th>Score</th><th>Tier</th><th>Result</th></tr></thead><tbody id="redditRows"></tbody></table></div></article>`;
    $('intentKpis').innerHTML=[kpi('COMMUNITIES',`${done}/${cfg}`,latest?`${N(summary.feed_posts_seen)||'—'} latest feed · ${feedWindowText}`:'Awaiting scan'),kpi('POSTS · 24 HOURS',(postsToday+legacyDay.posts).toLocaleString(),legacyDay.posts?`${legacyDay.posts} historical unattributed`:'Distinct newly observed'),kpi('POSTS · 7 DAYS',(postsWeek+legacyWeek.posts).toLocaleString(),legacyWeek.posts?`${postsWeek} attributed · ${legacyWeek.posts} historical`:coverage?`Tracking since ${stamp(coverage)}`:'Awaiting first v1.5 scan'),kpi('SUPPRESSED · 7 DAYS',(suppressedWeek+legacyWeek.suppressed).toLocaleString(),legacyWeek.suppressed?`${legacyWeek.suppressed} historical unattributed`:'Local rules + final classifier'),kpi('PASSED PARSER · 7 DAYS',(forwardedWeek+legacyWeek.forwarded).toLocaleString(),'Sent for final classification'),kpi('SURFACED · 7 DAYS',surfacedWeek.toLocaleString(),latest?`Last scan ${ago(latest.received_at)}`:'No scan yet')].join('');
    drawMulti('intentChart',[{label:'Candidates',values:bucket(rows,'created_at'),color:'#7e68d8'},{label:'Surfaced',values:bucket(opp,'created_at'),color:'#b596ff'}]);
    const max=Math.max(1,fetched,preParser,locallySuppressed,forwarded,aiSuppressed,opp.length);$('redditPipeline').innerHTML=progress('Feed entries read',fetched,max)+progress('New unseen posts · pre-parser',preParser,max,'purple')+progress('Suppressed locally',locallySuppressed,max,'yellow')+progress('Passed parser · sent to AI',forwarded,max,'purple')+progress('AI suppressed',aiSuppressed,max,'yellow')+progress('Surfaced opportunities',opp.length,max,'green')+`<div class="mini"><span>ACCOUNT</span><b>${esc(account)}</b></div><div class="mini"><span>SCAN ERRORS</span><b>${scanErrors}</b></div><div class="mini"><span>LATEST SCAN</span><b>${latest?ago(latest.received_at):'Never'}</b></div>`;
    $('redditHistoryNote').innerHTML=legacyWeek.posts?`<b>${legacyWeek.posts} historical posts retained globally</b><span>${legacyWeek.suppressed} suppressed · subreddit was not stored by the older scanner, so these are included in overall totals but not assigned to individual cards.</span>`:'<b>Per-subreddit telemetry active</b><span>Daily and seven-day cards contain deduplicated post counts.</span>';
    $('redditSubreddits').innerHTML=stats.map(g=>`<div class="reddit-card"><div class="reddit-name">${esc(g.name)}</div><div class="reddit-sub">${g.coverage?`Latest feed snapshot ${g.latestFeed} · tracking since ${stamp(g.coverage)}`:'Awaiting per-community telemetry'}</div><div class="reddit-metrics"><div class="reddit-metric"><b>${g.today.posts}</b><span>24H POSTS</span></div><div class="reddit-metric"><b>${g.today.suppressed}</b><span>24H SUPPRESSED</span></div><div class="reddit-metric"><b>${g.week.posts}</b><span>7D POSTS</span></div><div class="reddit-metric"><b>${g.week.suppressed}</b><span>7D SUPPRESSED</span></div><div class="reddit-metric"><b>${g.week.surfaced}</b><span>7D SURFACED</span></div><div class="reddit-metric"><b>${g.rate}%</b><span>7D SUPPRESSION RATE</span></div></div><div class="switch-note">${g.week.forwarded} passed the local parser in the last 7 days</div></div>`).join('')||'<div class="reddit-empty-card">No configured subreddits returned.</div>';
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
