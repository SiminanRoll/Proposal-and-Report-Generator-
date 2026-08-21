(()=>{
  function installV4(){
    const style=document.createElement('style');
    style.textContent=`
      .card::after{content:none!important;display:none!important}
      .chart{position:relative}
      .chart canvas.timeline-interactive{cursor:crosshair}
      .timeline-guide{position:absolute;width:1px;background:rgba(101,187,255,.38);pointer-events:none;opacity:0;transition:opacity .1s ease;z-index:3}
      .timeline-guide.visible{opacity:1}
      .timeline-tooltip{position:absolute;z-index:5;min-width:185px;max-width:260px;padding:10px 11px;border:1px solid #31536b;border-radius:11px;background:rgba(6,16,25,.97);box-shadow:0 14px 34px rgba(0,0,0,.34);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .1s ease,transform .1s ease;color:var(--text)}
      .timeline-tooltip.visible{opacity:1;transform:none}
      .timeline-tooltip .tt-date{font-size:11px;font-weight:800;margin-bottom:7px;color:#dff2ff}
      .timeline-tooltip .tt-row{display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:11px}
      .timeline-tooltip .tt-row span{color:var(--muted)}
      .timeline-tooltip .tt-row b{font-size:11px}
      .timeline-tooltip .tt-total{border-top:1px solid #1d3447;margin-top:5px;padding-top:6px}
      .timeline-tooltip .tt-hint{font-size:9px;color:#718da2;margin-top:6px;letter-spacing:.05em}
    `;
    document.head.appendChild(style);

    window.socialRows=()=> (S.data?.social_signals_window||[]).filter(x=>x.source==='one_stop_social');
    window.socialOpps=()=> socialRows().filter(x=>x.should_surface===true);
    window.socialSuppressed=()=> socialRows().filter(x=>String(x.classification_status||'').toLowerCase()==='suppressed');

    window.chartDays=()=>{
      const days=Math.max(1,N(S.days)||7),arr=[],now=new Date();
      for(let i=days-1;i>=0;i--){const d=new Date(now);d.setUTCDate(d.getUTCDate()-i);arr.push(d.toISOString().slice(0,10))}
      return arr;
    };

    const labelMap={
      overviewChart:['Permit opportunities','Social opportunities','NPI opportunities'],
      opportunityChart:['Permit opportunities','Social opportunities','NPI opportunities'],
      permitChart:['Permit source runs','Permit opportunities'],
      npiChart:['NPI ingest runs','NPI candidates','NPI opportunities'],
      intentChart:['Intent validation runs']
    };

    function tooltipParts(canvas){
      const parent=canvas.parentElement;
      let tip=parent.querySelector('.timeline-tooltip'),guide=parent.querySelector('.timeline-guide');
      if(!guide){guide=document.createElement('div');guide.className='timeline-guide';parent.appendChild(guide)}
      if(!tip){tip=document.createElement('div');tip.className='timeline-tooltip';parent.appendChild(tip)}
      return{tip,guide};
    }
    function nearestIndex(canvas,event){
      const m=canvas.__timeline;if(!m)return null;
      const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left;
      if(m.keys.length===1)return 0;
      const ratio=(x-m.pad.l)/Math.max(1,m.w-m.pad.l-m.pad.r);
      return Math.max(0,Math.min(m.keys.length-1,Math.round(ratio*(m.keys.length-1))));
    }
    function hideTimeline(canvas){const p=tooltipParts(canvas);p.tip.classList.remove('visible');p.guide.classList.remove('visible')}
    function showTimeline(canvas,index,pinned=false){
      const m=canvas.__timeline;if(!m||index==null)return;
      const {tip,guide}=tooltipParts(canvas),key=m.keys[index],x=m.xx(index),dateObj=new Date(key+'T12:00:00');
      const rows=m.series.map(s=>({label:s.label,value:N(s.values[key])}));
      const total=rows.reduce((a,r)=>a+r.value,0);
      tip.innerHTML=`<div class="tt-date">${dateObj.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>${rows.map(r=>`<div class="tt-row"><span>${esc(r.label)}</span><b>${r.value.toLocaleString()}</b></div>`).join('')}${rows.length>1?`<div class="tt-row tt-total"><span>Total</span><b>${total.toLocaleString()}</b></div>`:''}<div class="tt-hint">${pinned?'PINNED · CLICK ANOTHER DATE TO MOVE':'CLICK TO PIN THIS DATE'}</div>`;
      const tw=210,left=Math.max(8,Math.min(m.w-tw-8,x+12));
      tip.style.left=left+'px';tip.style.top='10px';tip.classList.add('visible');
      guide.style.left=Math.round(x)+'px';guide.style.top=m.pad.t+'px';guide.style.bottom=m.pad.b+'px';guide.classList.add('visible');
    }
    function bindTimeline(canvas){
      if(canvas.dataset.timelineBound)return;canvas.dataset.timelineBound='1';canvas.classList.add('timeline-interactive');
      canvas.addEventListener('mousemove',e=>{if(canvas.__timelinePinned==null)showTimeline(canvas,nearestIndex(canvas,e),false)});
      canvas.addEventListener('mouseleave',()=>{if(canvas.__timelinePinned==null)hideTimeline(canvas)});
      canvas.addEventListener('click',e=>{const idx=nearestIndex(canvas,e);if(idx==null)return;if(canvas.__timelinePinned===idx){canvas.__timelinePinned=null;hideTimeline(canvas)}else{canvas.__timelinePinned=idx;showTimeline(canvas,idx,true)}});
      canvas.addEventListener('dblclick',()=>{canvas.__timelinePinned=null;hideTimeline(canvas)});
    }

    window.drawMulti=(id,series)=>{
      const p=prepareCanvas(id);if(!p)return;
      const {c,x,w,h}=p,keys=chartDays(),pad={l:34,r:14,t:18,b:27};
      const labels=labelMap[id]||[];
      const cooked=series.map((s,i)=>({...s,label:s.label||labels[i]||`Series ${i+1}`}));
      const max=Math.max(1,...cooked.flatMap(s=>keys.map(k=>N(s.values[k]))));
      x.clearRect(0,0,w,h);x.strokeStyle='#1d3447';x.lineWidth=1;
      for(let i=0;i<4;i++){const y=pad.t+(h-pad.t-pad.b)*i/3;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke()}
      x.fillStyle=css('--muted');x.font='10px Segoe UI';x.fillText(String(max),3,pad.t+4);x.fillText('0',14,h-pad.b+4);
      const xx=i=>keys.length===1?pad.l+(w-pad.l-pad.r)/2:pad.l+(w-pad.l-pad.r)*i/(keys.length-1);
      const yy=v=>h-pad.b-(h-pad.t-pad.b)*(N(v)/max);
      cooked.forEach(s=>{x.strokeStyle=s.color;x.lineWidth=2;x.beginPath();keys.forEach((k,i)=>{const px=xx(i),py=yy(s.values[k]);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();keys.forEach((k,i)=>{if(N(s.values[k])>0){x.fillStyle=s.color;x.beginPath();x.arc(xx(i),yy(s.values[k]),2.8,0,Math.PI*2);x.fill()}})});
      const labelStep=Math.max(1,Math.ceil(keys.length/6));x.fillStyle=css('--muted');x.font='10px Segoe UI';keys.forEach((k,i)=>{if(i===0||i===keys.length-1||i%labelStep===0)x.fillText(k.slice(5),Math.max(0,xx(i)-13),h-7)});
      c.__timeline={keys,series:cooked,pad,w,h,xx,yy};bindTimeline(c);
      if(c.__timelinePinned!=null){c.__timelinePinned=Math.min(c.__timelinePinned,keys.length-1);showTimeline(c,c.__timelinePinned,true)}
    };
  }

  const files=['/premium_core.js','/premium_social.js'];let i=0;
  const loadBase=()=>{
    if(i>=files.length){installV4();const app=document.createElement('script');app.src='/premium_app.js';app.onerror=fail;document.body.appendChild(app);return}
    const s=document.createElement('script');s.src=files[i++];s.onload=loadBase;s.onerror=fail;document.body.appendChild(s)
  };
  function fail(){const e=document.getElementById('error');if(e)e.textContent='Dashboard script failed to load.'}
  loadBase();
})();