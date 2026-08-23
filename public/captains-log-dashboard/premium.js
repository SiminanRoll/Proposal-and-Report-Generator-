(()=>{
  const SUPABASE_URL='https://cqhqbucjzgijhskupnlw.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_VVFtD-sgGWs0aK_pCnr9IA_-IOVslw8';
  const DASHBOARD_URL=SUPABASE_URL+'/functions/v1/server-runner-dashboard-web';
  const SESSION_KEY='captains_log_dashboard_auth_v1';
  const nativeFetch=window.fetch.bind(window);
  let session=null;

  const readSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  const saveSession=s=>{session=s;localStorage.setItem(SESSION_KEY,JSON.stringify(s))};
  const clearSession=()=>{session=null;localStorage.removeItem(SESSION_KEY)};
  const normalizeSession=d=>({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Date.now()+Math.max(60,Number(d.expires_in||3600))*1000});

  async function authRequest(path,body){
    const r=await nativeFetch(SUPABASE_URL+path,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.msg||d.error_description||d.error||'Sign in failed');
    return d;
  }
  async function refreshSession(){
    if(!session?.refresh_token)throw new Error('Your session has expired. Please sign in again.');
    const d=await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    saveSession(normalizeSession(d));return session;
  }
  async function ensureSession(){
    if(!session)session=readSession();
    if(!session?.access_token)return null;
    if(!session.expires_at||Date.now()>session.expires_at-60000){try{await refreshSession()}catch{clearSession();return null}}
    return session;
  }
  async function dashboardRead(days,retry=true){
    const s=await ensureSession();
    if(!s)throw new Error('AUTH_REQUIRED');
    const r=await nativeFetch(DASHBOARD_URL,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({window_days:Number(days)||7}),cache:'no-store'});
    if(r.status===401&&retry){try{await refreshSession();return dashboardRead(days,false)}catch{clearSession();showLogin('Your session expired. Please sign in again.');throw new Error('AUTH_REQUIRED')}}
    return r;
  }

  window.fetch=(input,init)=>{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(url.startsWith('/api/status')){
      const parsed=new URL(url,location.origin);return dashboardRead(parsed.searchParams.get('days')||7);
    }
    return nativeFetch(input,init);
  };

  function authStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .card::after{content:none!important;display:none!important}
      .auth-gate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 70% 0%,rgba(52,118,167,.2),transparent 34%),#061019;color:#eef7fc;font:14px "Segoe UI",Arial,sans-serif}
      .auth-box{width:min(420px,100%);padding:24px;border:1px solid #26465e;border-radius:18px;background:linear-gradient(160deg,#102536,#0b1b28);box-shadow:0 24px 70px rgba(0,0,0,.36)}
      .auth-box h2{margin:5px 0 7px;font-size:24px}.auth-box p{color:#8fa6b9;margin:0 0 18px;line-height:1.45}.auth-box label{display:block;color:#8fa6b9;font-size:10px;letter-spacing:.08em;margin:12px 0 5px}.auth-box input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #29465c;background:#071722;color:#eef7fc;outline:none;font:inherit}.auth-box input:focus{border-color:#65bbff;box-shadow:0 0 0 3px rgba(101,187,255,.1)}
      .auth-submit{width:100%;margin-top:16px;padding:11px;border:1px solid #568db7;border-radius:10px;background:linear-gradient(180deg,#19405d,#12314a);color:#f4fbff;font-weight:800;cursor:pointer}.auth-submit:disabled{opacity:.6;cursor:wait}.auth-error{min-height:18px;margin-top:10px;color:#ff9fa5;font-size:11px}.auth-kicker{font-size:10px;letter-spacing:.14em;color:#7ea9c8;font-weight:800}.auth-note{margin-top:15px!important;font-size:11px}
      .chart{position:relative}.chart canvas.timeline-interactive{cursor:crosshair}.timeline-guide{position:absolute;width:1px;background:rgba(101,187,255,.38);pointer-events:none;opacity:0;transition:opacity .1s ease;z-index:3}.timeline-guide.visible{opacity:1}.timeline-tooltip{position:absolute;z-index:5;min-width:185px;max-width:260px;padding:10px 11px;border:1px solid #31536b;border-radius:11px;background:rgba(6,16,25,.97);box-shadow:0 14px 34px rgba(0,0,0,.34);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .1s ease,transform .1s ease;color:var(--text)}.timeline-tooltip.visible{opacity:1;transform:none}.timeline-tooltip .tt-date{font-size:11px;font-weight:800;margin-bottom:7px;color:#dff2ff}.timeline-tooltip .tt-row{display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:11px}.timeline-tooltip .tt-row span{color:var(--muted)}.timeline-tooltip .tt-row b{font-size:11px}.timeline-tooltip .tt-total{border-top:1px solid #1d3447;margin-top:5px;padding-top:6px}.timeline-tooltip .tt-hint{font-size:9px;color:#718da2;margin-top:6px;letter-spacing:.05em}
    `;document.head.appendChild(style);
  }
  function makeLogin(){
    let gate=document.getElementById('authGate');if(gate)return gate;
    gate=document.createElement('div');gate.id='authGate';gate.className='auth-gate';gate.innerHTML=`<form class="auth-box" id="authForm"><div class="auth-kicker">CAPTAIN'S LOG · SECURE ACCESS</div><h2>Operations Dashboard</h2><p>Sign in with your Captain's Log account to view Radar health, history and opportunities.</p><label>EMAIL</label><input id="authEmail" type="email" autocomplete="username" required><label>PASSWORD</label><input id="authPassword" type="password" autocomplete="current-password" required><button class="auth-submit" id="authSubmit" type="submit">SIGN IN</button><div class="auth-error" id="authError"></div><p class="auth-note">Authentication is handled by Supabase. No privileged database key is stored in this static site.</p></form>`;
    document.body.appendChild(gate);
    gate.querySelector('#authForm').addEventListener('submit',async e=>{e.preventDefault();const button=gate.querySelector('#authSubmit'),error=gate.querySelector('#authError');error.textContent='';button.disabled=true;button.textContent='SIGNING IN…';try{const d=await authRequest('/auth/v1/token?grant_type=password',{email:gate.querySelector('#authEmail').value.trim(),password:gate.querySelector('#authPassword').value});saveSession(normalizeSession(d));gate.remove();launch()}catch(err){error.textContent=err.message||'Sign in failed';button.disabled=false;button.textContent='SIGN IN'}});
    return gate;
  }
  function showLogin(message=''){
    document.querySelector('.shell')?.style.setProperty('display','none');const gate=makeLogin();const error=gate.querySelector('#authError');if(error)error.textContent=message;
  }
  function addSignOut(){
    const toolbar=document.querySelector('.toolbar');if(!toolbar||document.getElementById('dashboardSignOut'))return;const b=document.createElement('button');b.className='control';b.id='dashboardSignOut';b.textContent='SIGN OUT';b.addEventListener('click',()=>{clearSession();location.reload()});toolbar.appendChild(b);
  }

  function installDashboardOverrides(){
    window.socialRows=()=> (S.data?.social_signals_window||[]).filter(x=>x.source==='one_stop_social');
    window.socialOpps=()=> socialRows().filter(x=>x.should_surface===true);
    window.socialSuppressed=()=> socialRows().filter(x=>String(x.classification_status||'').toLowerCase()==='suppressed');
    window.chartDays=()=>{const days=Math.max(1,N(S.days)||7),arr=[],now=new Date();for(let i=days-1;i>=0;i--){const d=new Date(now);d.setUTCDate(d.getUTCDate()-i);arr.push(d.toISOString().slice(0,10))}return arr};
    const labelMap={overviewChart:['Permit opportunities','Social opportunities','NPI opportunities'],opportunityChart:['Permit opportunities','Social opportunities','NPI opportunities'],permitChart:['Permit source runs','Permit opportunities'],npiChart:['NPI ingest runs','NPI candidates','NPI opportunities'],intentChart:['Intent validation runs']};
    function tooltipParts(canvas){const parent=canvas.parentElement;let tip=parent.querySelector('.timeline-tooltip'),guide=parent.querySelector('.timeline-guide');if(!guide){guide=document.createElement('div');guide.className='timeline-guide';parent.appendChild(guide)}if(!tip){tip=document.createElement('div');tip.className='timeline-tooltip';parent.appendChild(tip)}return{tip,guide}}
    function nearestIndex(canvas,event){const m=canvas.__timeline;if(!m)return null;const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left;if(m.keys.length===1)return 0;const ratio=(x-m.pad.l)/Math.max(1,m.w-m.pad.l-m.pad.r);return Math.max(0,Math.min(m.keys.length-1,Math.round(ratio*(m.keys.length-1))))}
    function hideTimeline(canvas){const p=tooltipParts(canvas);p.tip.classList.remove('visible');p.guide.classList.remove('visible')}
    function showTimeline(canvas,index,pinned=false){const m=canvas.__timeline;if(!m||index==null)return;const{tip,guide}=tooltipParts(canvas),key=m.keys[index],x=m.xx(index),dateObj=new Date(key+'T12:00:00');const rows=m.series.map(s=>({label:s.label,value:N(s.values[key])})),total=rows.reduce((a,r)=>a+r.value,0);tip.innerHTML=`<div class="tt-date">${dateObj.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>${rows.map(r=>`<div class="tt-row"><span>${esc(r.label)}</span><b>${r.value.toLocaleString()}</b></div>`).join('')}${rows.length>1?`<div class="tt-row tt-total"><span>Total</span><b>${total.toLocaleString()}</b></div>`:''}<div class="tt-hint">${pinned?'PINNED · CLICK ANOTHER DATE TO MOVE':'CLICK TO PIN THIS DATE'}</div>`;const tw=210,left=Math.max(8,Math.min(m.w-tw-8,x+12));tip.style.left=left+'px';tip.style.top='10px';tip.classList.add('visible');guide.style.left=Math.round(x)+'px';guide.style.top=m.pad.t+'px';guide.style.bottom=m.pad.b+'px';guide.classList.add('visible')}
    function bindTimeline(canvas){if(canvas.dataset.timelineBound)return;canvas.dataset.timelineBound='1';canvas.classList.add('timeline-interactive');canvas.addEventListener('mousemove',e=>{if(canvas.__timelinePinned==null)showTimeline(canvas,nearestIndex(canvas,e),false)});canvas.addEventListener('mouseleave',()=>{if(canvas.__timelinePinned==null)hideTimeline(canvas)});canvas.addEventListener('click',e=>{const idx=nearestIndex(canvas,e);if(idx==null)return;if(canvas.__timelinePinned===idx){canvas.__timelinePinned=null;hideTimeline(canvas)}else{canvas.__timelinePinned=idx;showTimeline(canvas,idx,true)}});canvas.addEventListener('dblclick',()=>{canvas.__timelinePinned=null;hideTimeline(canvas)})}
    window.drawMulti=(id,series)=>{const p=prepareCanvas(id);if(!p)return;const{c,x,w,h}=p,keys=chartDays(),pad={l:34,r:14,t:18,b:27},labels=labelMap[id]||[],cooked=series.map((s,i)=>({...s,label:s.label||labels[i]||`Series ${i+1}`})),max=Math.max(1,...cooked.flatMap(s=>keys.map(k=>N(s.values[k]))));x.clearRect(0,0,w,h);x.strokeStyle='#1d3447';x.lineWidth=1;for(let i=0;i<4;i++){const y=pad.t+(h-pad.t-pad.b)*i/3;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke()}x.fillStyle=css('--muted');x.font='10px Segoe UI';x.fillText(String(max),3,pad.t+4);x.fillText('0',14,h-pad.b+4);const xx=i=>keys.length===1?pad.l+(w-pad.l-pad.r)/2:pad.l+(w-pad.l-pad.r)*i/(keys.length-1),yy=v=>h-pad.b-(h-pad.t-pad.b)*(N(v)/max);cooked.forEach(s=>{x.strokeStyle=s.color;x.lineWidth=2;x.beginPath();keys.forEach((k,i)=>{const px=xx(i),py=yy(s.values[k]);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();keys.forEach((k,i)=>{if(N(s.values[k])>0){x.fillStyle=s.color;x.beginPath();x.arc(xx(i),yy(s.values[k]),2.8,0,Math.PI*2);x.fill()}})});const labelStep=Math.max(1,Math.ceil(keys.length/6));x.fillStyle=css('--muted');x.font='10px Segoe UI';keys.forEach((k,i)=>{if(i===0||i===keys.length-1||i%labelStep===0)x.fillText(k.slice(5),Math.max(0,xx(i)-13),h-7)});c.__timeline={keys,series:cooked,pad,w,h,xx,yy};bindTimeline(c);if(c.__timelinePinned!=null){c.__timelinePinned=Math.min(c.__timelinePinned,keys.length-1);showTimeline(c,c.__timelinePinned,true)}};
  }

  function launch(){
    const shell=document.querySelector('.shell');if(shell)shell.style.display='';addSignOut();
    const files=['./premium_core.js?v=1.2.76','./premium_social.js?v=1.2.76'];let i=0;const next=()=>{if(i>=files.length){installDashboardOverrides();const app=document.createElement('script');app.src='./premium_app.js?v=1.2.76';app.onerror=fail;document.body.appendChild(app);return}const s=document.createElement('script');s.src=files[i++];s.onload=next;s.onerror=fail;document.body.appendChild(s)};next();
  }
  function fail(){const e=document.getElementById('error');if(e)e.textContent='Dashboard script failed to load.'}

  authStyles();
  const shell=document.querySelector('.shell');if(shell)shell.style.display='none';
  ensureSession().then(s=>{if(s)launch();else showLogin()}).catch(()=>showLogin());
})();

