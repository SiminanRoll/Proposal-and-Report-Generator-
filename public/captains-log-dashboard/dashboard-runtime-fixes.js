(()=>{
  let installed=false;

  function newest(rows){
    return [...(rows||[])].sort((a,b)=>String(b.completed_at||b.started_at||b.created_at||'').localeCompare(String(a.completed_at||a.started_at||a.created_at||'')))[0]||null;
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
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer)},250);
})();
