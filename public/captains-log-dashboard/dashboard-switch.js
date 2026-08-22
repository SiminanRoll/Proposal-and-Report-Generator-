(()=>{
  const N=v=>Number(v||0);
  let lastRenderKey='';

  function currentInventory(){
    const rows=(typeof S!=='undefined'&&S.data?.monitoring_inventory)||[];
    return rows.filter(x=>x.source==='one_stop_social'&&x.active===true);
  }

  function metrics(){
    const rows=(typeof S!=='undefined'&&S.data?.social_switch_window)||[];
    const inventory=currentInventory();
    const authoritative=S.data?.facebook_inventory_authoritative===true;
    const groups=new Map();

    if(authoritative){
      inventory.forEach(x=>groups.set(String(x.community_name||x.community_key),{name:String(x.community_name||x.community_key),total:0,surfaced:0,suppressed:0,scoreSum:0,scoreCount:0,lastOpp:null,lastSignal:null,monitored:true}));
    }

    rows.forEach(r=>{
      const name=r.group_name||'Unknown';
      if(authoritative&&!inventory.some(x=>String(x.community_name||'').toLowerCase()===String(name).toLowerCase()))return;
      if(!groups.has(name))groups.set(name,{name,total:0,surfaced:0,suppressed:0,scoreSum:0,scoreCount:0,lastOpp:null,lastSignal:null,monitored:!authoritative});
      const g=groups.get(name);g.total++;
      const surfaced=r.should_surface===true;
      if(surfaced){g.surfaced++;g.scoreSum+=N(r.signal_score);g.scoreCount++;if(!g.lastOpp||String(r.created_at)>String(g.lastOpp))g.lastOpp=r.created_at}
      else g.suppressed++;
      if(!g.lastSignal||String(r.created_at)>String(g.lastSignal))g.lastSignal=r.created_at;
    });

    return [...groups.values()].map(g=>({...g,rate:g.total?g.surfaced/g.total*100:0,avgScore:g.scoreCount?Math.round(g.scoreSum/g.scoreCount):0}));
  }

  function classify(g){
    if(g.total===0)return'NO_DATA';
    if(g.total>=12&&g.surfaced===0)return'SWITCH';
    if((g.total>=5&&g.surfaced===0)||(g.total>=12&&g.surfaced<=1&&g.rate<5))return'WATCH';
    return'KEEP';
  }

  function card(g,state){
    const last=g.lastOpp&&typeof ago==='function'?ago(g.lastOpp):'Never';
    return `<div class="switch-card ${state==='WATCH'?'watch':''}"><div class="switch-card-top"><div class="switch-name">${esc(g.name)}</div><span class="switch-badge ${state==='WATCH'?'watch':''}">${state}</span></div><div class="switch-metrics"><div class="switch-metric"><b>${g.total}</b><span>CLASSIFIED</span></div><div class="switch-metric"><b>${g.surfaced}</b><span>OPPORTUNITIES</span></div><div class="switch-metric"><b>${Math.round(g.rate)}%</b><span>YIELD</span></div></div><div class="switch-note">${g.suppressed} suppressed · last opportunity ${esc(last)}</div></div>`;
  }

  function copyList(items,button){
    const text=['Suggested for Switch — 30D',...items.map(g=>`${g.name} — ${g.total} classified / ${g.surfaced} opportunities / ${g.suppressed} suppressed`)].join('\n');
    navigator.clipboard?.writeText(text).then(()=>{const old=button.textContent;button.textContent='COPIED ✓';setTimeout(()=>button.textContent=old,1400)}).catch(()=>{});
  }

  function ensurePanel(){
    const social=document.getElementById('social');if(!social)return null;
    let panel=document.getElementById('socialSwitchPanel');if(panel)return panel;
    panel=document.createElement('article');panel.id='socialSwitchPanel';panel.className='panel section-gap switch-panel';
    const overviewGrid=social.querySelector(':scope > .grid2');
    if(overviewGrid)overviewGrid.insertAdjacentElement('afterend',panel);else social.prepend(panel);
    return panel;
  }

  function render(force=false){
    if(typeof S==='undefined'||!S.data)return false;
    const rows=S.data?.social_switch_window||[],inventory=currentInventory(),authoritative=S.data?.facebook_inventory_authoritative===true;
    const key=`${S.data.generated_at||''}|${rows.length}|${inventory.length}|${authoritative}`;
    if(!force&&key===lastRenderKey)return true;
    const panel=ensurePanel();if(!panel)return false;
    const all=metrics(),switches=all.filter(g=>classify(g)==='SWITCH').sort((a,b)=>b.total-a.total),watch=all.filter(g=>classify(g)==='WATCH').sort((a,b)=>b.total-a.total),noData=all.filter(g=>classify(g)==='NO_DATA').length;
    const inventoryText=authoritative?`${inventory.length} CURRENT GROUPS`:'MEMBERSHIP DISCOVERY PENDING';
    const inventoryNote=authoritative?'Recommendations only include groups currently monitored.':'OSS currently reports the monitored count but not all group names. Recommendations use observed group activity until authoritative membership sync is available.';
    panel.innerHTML=`<div class="panel-head"><div><div class="panel-title">Suggested for Switch</div><div class="tiny">30-day group performance · ${esc(inventoryNote)}</div></div><div class="switch-head-actions"><span class="filter-chip">${inventoryText}</span><span class="filter-chip">${switches.length} SWITCH · ${watch.length} WATCH${authoritative&&noData?` · ${noData} NEW/NO DATA`:''}</span><button class="control" id="copySwitchList" ${switches.length?'':'disabled'}>COPY SWITCH LIST</button></div></div><div id="switchCards">${switches.length?`<div class="switch-grid">${switches.map(g=>card(g,'SWITCH')).join('')}</div>`:'<div class="switch-empty">No current groups meet the switch threshold.</div>'}</div>${watch.length?`<details class="switch-watch"><summary>WATCH LIST · ${watch.length}</summary><div class="switch-grid">${watch.map(g=>card(g,'WATCH')).join('')}</div></details>`:''}`;
    const b=document.getElementById('copySwitchList');if(b&&switches.length)b.addEventListener('click',()=>copyList(switches,b));
    lastRenderKey=key;
    return true;
  }

  window.renderSocialSwitch=()=>render(true);

  const timer=setInterval(()=>render(false),500);
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="social"]'))setTimeout(()=>render(true),50)},true);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
