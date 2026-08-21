(()=>{
  const exact=new Map([
    ["CAPTAIN'S LOG · SERVER INTELLIGENCE","VIRTUAL SERVER STATS"],
    ["Operations Intelligence Dashboard","Signal Intelligence Dashboard"],
    ["Live connection health plus historical production across Social, Permit, NPI and Intent Radar. Yield and execution health are intentionally measured separately.","Live signal health, activity, and opportunity production."],
    ["Surfaced Social group leads only · Permit matches · Review-worthy NPI","Across every signal lane"],
    ["Selected time window","Current window"],
    ["Click a card to flip it. Every source is monitored independently.","Live source connections"],
    ["Hover for exact date values · click to pin · suppressed Social excluded","Opportunity history"],
    ["One Stop Social Facebook-group leads only · total vs suppressed vs surfaced","Facebook-group opportunities"],
    ["Suppression is tracked for quality analytics, never counted as opportunity yield","Classifier diagnostics"],
    ["Advantage-owned Page, LinkedIn and Instagram activity is excluded","Lead-producing groups"],
    ["Only One Stop Social group rows with should_surface = true.","Highest priority first"],
    ["Only surfaced Facebook-group opportunities · hover or click the timeline for exact dates","Surfaced leads over time"],
    ["Opportunity types in the selected time window","Opportunity mix"],
    ["Highest-priority leads first · suppression never appears here","Highest priority first"],
    ["Only groups that produced at least one surfaced opportunity are shown","Groups producing leads"],
    ["Secondary diagnostics for what the classifier correctly kept out of the opportunity feed","Classifier diagnostics"],
    ["Useful for tuning signal quality, not sales prioritization","Suppression reasons"],
    ["One card per clerk / permit office. Click to flip; double-click to drill in.","Live source connections"],
    ["Historical activity for the selected range","Activity history"],
    ["Actual permit_opportunities rows","Opportunity yield"],
    ["Matches found in the selected time range","Matched opportunities"],
    ["Changes, candidates and review-worthy opportunities","Opportunity pipeline"],
    ["Candidate records marked review_worthy","Qualified candidates"],
    ["Intent Radar is deliberately not presented as production opportunity yield yet. This tab exposes validation telemetry and classifier activity without implying that the lane is live.","Validation only. Production publishing is off."],
    ["Parent-level runner telemetry","Runner executions"],
    ["Every clerk-office connection attempt","Source executions"],
    ["Sign in with your Captain's Log account to view Radar health, history and opportunities.","Sign in to continue."],
    ["Authentication is handled by Supabase. No privileged database key is stored in this static site.",""]
  ]);
  const normalizeTier=s=>s.replace(/\bBUBBLE\b/g,'WARM').replace(/\bBubble\b/g,'Warm').replace(/\bbubble\b/g,'warm');
  function loadEnhancements(){
    if(!document.getElementById('dashboardLinksCss')){const link=document.createElement('link');link.id='dashboardLinksCss';link.rel='stylesheet';link.href='./dashboard-links.css';document.head.appendChild(link)}
    if(!document.getElementById('dashboardInteractionsJs')){const script=document.createElement('script');script.id='dashboardInteractionsJs';script.src='./dashboard-interactions.js';document.body.appendChild(script)}
  }
  let scheduled=false;
  function clean(){
    scheduled=false;
    document.title='Signal Intelligence Dashboard';
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parent=node.parentElement;if(!parent||['SCRIPT','STYLE','NOSCRIPT'].includes(parent.tagName))return;
      const raw=node.nodeValue||'',trim=raw.trim();let next=raw;
      if(exact.has(trim))next=raw.replace(trim,exact.get(trim));
      next=normalizeTier(next);
      if(next!==raw)node.nodeValue=next;
    });
    document.querySelectorAll('.lead-tag.bubble').forEach(el=>el.classList.add('warm'));
    const active=document.querySelector('#mainTabs .tab.active');
    if(active?.dataset.view)document.body.dataset.signalView=active.dataset.view;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(clean)}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  document.addEventListener('click',schedule,true);
  loadEnhancements();
  clean();
})();
