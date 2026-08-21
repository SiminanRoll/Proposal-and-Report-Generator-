(()=>{
  const N=v=>Number(v||0);
  function metrics(){
    const rows=(typeof S!=='undefined'&&S.data?.social_switch_window)||[];
    const groups=new Map();
    rows.forEach(r=>{
      const name=r.group_name||'Unknown';
      if(!groups.has(name))groups.set(name,{name,total:0,surfaced:0,suppressed:0,scoreSum:0,scoreCount:0,lastOpp:null,lastSignal:null});
      const g=groups.get(name);g.total++;
      const surfaced=r.should_surface===true;
      if(surfaced){g.surfaced++;g.scoreSum+=N(r.signal_score);g.scoreCount++;if(!g.lastOpp||String(r.created_at)>String(g.lastOpp))g.lastOpp=r.created_at}
      else g.suppressed++;
      if(!g.lastSignal||String(r.created_at)>String(g.lastSignal))g.lastSignal=r.created_at;
    });
    return [...groups.values()].map(g=>({...g,rate:g.total?g.surfaced/g.total*100:0,avgScore:g.scoreCount?Math.round(g.scoreSum/g.scoreCount):0}));
  }
  function classify(g){
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
    if(overviewGrid)overviewGrid.insertAdjacentElement('afterend',panel);
    else social.prepend(panel);
    return panel;
  }
  function render(){
    const panel=ensurePanel();if(!panel)return;
    const all=metrics(),switches=all.filter(g=>classify(g)==='SWITCH').sort((a,b)=>b.total-a.total),watch=all.filter(g=>classify(g)==='WATCH').sort((a,b)=>b.total-a.total);
    panel.innerHTML=`<div class="panel-head"><div><div class="panel-title">Suggested for Switch</div><div class="tiny">30-day group performance</div></div><div class="switch-head-actions"><span class="filter-chip">${switches.length} SWITCH · ${watch.length} WATCH</span><button class="control" id="copySwitchList" ${switches.length?'':'disabled'}>COPY SWITCH LIST</button></div></div><div id="switchCards">${switches.length?`<div class="switch-grid">${switches.map(g=>card(g,'SWITCH')).join('')}</div>`:'<div class="switch-empty">No groups currently meet the switch threshold.</div>'}</div>${watch.length?`<details class="switch-watch"><summary>WATCH LIST · ${watch.length}</summary><div class="switch-grid">${watch.map(g=>card(g,'WATCH')).join('')}</div></details>`:''}`;
    const b=document.getElementById('copySwitchList');if(b&&switches.length)b.addEventListener('click',()=>copyList(switches,b));
  }
  function install(){
    if(typeof S==='undefined'||typeof window.renderSocial!=='function')return false;
    if(!window.__switchRenderWrapped){const original=window.renderSocial;window.renderSocial=function(){const out=original.apply(this,arguments);queueMicrotask(render);return out};window.__switchRenderWrapped=true}
    if(S.data)render();return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100);
})();
