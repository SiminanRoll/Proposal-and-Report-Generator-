(()=>{
  const STATE_CODES=['WI','MI','IL','IN','OH','KY','TN','AL','GA','FL'];
  const STATE_NAMES={WI:'Wisconsin',MI:'Michigan',IL:'Illinois',IN:'Indiana',OH:'Ohio',KY:'Kentucky',TN:'Tennessee',AL:'Alabama',GA:'Georgia',FL:'Florida'};
  const FULL_TO_CODE=Object.fromEntries(Object.entries(STATE_NAMES).map(([code,name])=>[name.toUpperCase(),code]));
  let wrapped=false;
  let lastPayload=null;

  function inferState(...values){
    const text=values.filter(Boolean).join(' ').toUpperCase().replace(/[_/.-]+/g,' ');
    for(const [name,code] of Object.entries(FULL_TO_CODE))if(text.includes(name))return code;
    const tokens=text.match(/[A-Z]{2}/g)||[];
    const code=tokens.find(token=>STATE_CODES.includes(token));
    return code||null;
  }

  function latestIso(values){
    return values.filter(Boolean).map(String).sort().at(-1)||null;
  }

  function buildPayload(){
    if(typeof permitSources!=='function'||typeof permitOpps!=='function'||typeof S==='undefined')return null;
    const sources=permitSources();
    const opportunities=permitOpps();
    const sourceState=new Map();

    sources.forEach(source=>{
      let code=inferState(source.jur,source.label,source.key);
      if(!code){
        const linked=opportunities.find(row=>row.source_key===source.key);
        code=inferState(linked?.state,linked?.city,linked?.address_text,linked?.source_key);
      }
      if(code)sourceState.set(source.key,code);
    });

    const states=STATE_CODES.map(code=>{
      const clerks=sources.filter(source=>sourceState.get(source.key)===code);
      const leads=opportunities.filter(row=>{
        const direct=inferState(row.state,row.city,row.address_text,row.source_key);
        return (direct||sourceState.get(row.source_key))===code;
      });
      const healthy=clerks.filter(source=>source.state==='HEALTHY');
      return {
        code,
        name:STATE_NAMES[code],
        connected:clerks.length>0,
        clerkCount:clerks.length,
        healthyCount:healthy.length,
        leadCount:leads.length,
        permitsScanned:clerks.reduce((sum,source)=>sum+Number(source.permits||0),0),
        lastScan:latestIso(clerks.map(source=>source.last)),
        clerks:clerks
          .slice()
          .sort((a,b)=>(a.state==='HEALTHY'?0:1)-(b.state==='HEALTHY'?0:1)||String(a.label).localeCompare(String(b.label)))
          .map(source=>({
            key:String(source.key||''),
            label:String(source.label||source.key||'Permit source'),
            jurisdiction:String(source.jur||source.label||''),
            health:String(source.state||'UNKNOWN'),
            lastScan:source.last||null,
            permitsScanned:Number(source.permits||0),
          })),
      };
    });

    return {
      rangeLabel:S.days===1?'24H':`${S.days}D`,
      totalLeads:opportunities.length,
      totalClerks:sources.length,
      connectedStates:states.filter(state=>state.connected).length,
      states,
    };
  }

  function send(){
    const frame=document.getElementById('permitCoverageFrame');
    if(!frame?.contentWindow)return;
    const payload=buildPayload()||lastPayload;
    if(!payload)return;
    lastPayload=payload;
    frame.contentWindow.postMessage({type:'permit-map:data',payload},location.origin);
    const summary=document.getElementById('permitCoverageSummary');
    if(summary)summary.textContent=`${payload.connectedStates} states · ${payload.totalClerks} clerk sources · ${payload.totalLeads} leads · ${payload.rangeLabel}`;
  }

  function render(){
    lastPayload=buildPayload();
    send();
  }

  function wrapPermits(){
    if(wrapped||typeof window.renderPermits!=='function')return false;
    const original=window.renderPermits;
    window.renderPermits=function(...args){
      const result=original.apply(this,args);
      requestAnimationFrame(render);
      return result;
    };
    wrapped=true;
    render();
    return true;
  }

  function install(){
    const frame=document.getElementById('permitCoverageFrame');
    frame?.addEventListener('load',send);
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.data?.type!=='permit-map:ready')return;
      send();
    });
    if(wrapPermits())return;
    const timer=setInterval(()=>{if(wrapPermits())clearInterval(timer)},80);
    setTimeout(()=>clearInterval(timer),15000);
  }

  window.PermitCoverageMap={render,send};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
