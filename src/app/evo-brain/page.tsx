"use client";

import { useEffect, useMemo, useState } from "react";
import "./evo-brain.css";
import { EvoNeuralMap } from "./neural-map";
import { EVO_DOMAINS, domainInfo } from "./domain-info";

const url = "https://cqhqbucjzgijhskupnlw.supabase.co";
const key = "sb_publishable_VVFtD-sgGWs0aK_pCnr9IA_-IOVslw8";
const storageKey = "evo-brain-session-v1";

type KnowledgeProfile = {
  label: string;
  capabilities: string[];
  operations: string[];
  inputs: string[];
  outputs: string[];
  touches: string[];
  boundaries: string[];
  related: string[];
  source_path?: string;
  source_commit?: string;
};
type Entry = {
  id: string; title: string; branch: string; category: string; stage: string;
  summary: string; skill_path: string | null; context_items: string[];
  next_step: string; evidence: string; updated_at: string;
  knowledge_profile?: KnowledgeProfile | null;
};
type Session = { access_token: string; refresh_token: string; expires_at: number };

const headers = (token?: string) => ({
  apikey: key, "Content-Type": "application/json",
  ...(token ? { Authorization: "Bearer " + token } : {}),
});
const displayName = (item: Entry) => item.knowledge_profile?.label || item.title;
const profileValues = (value: string[] | undefined) => Array.isArray(value) ? value : [];
const formatDate = (iso: string) => {
  if (!iso || Number.isNaN(Date.parse(iso))) return "Not available";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function DetailPanel({ active, branch, entries, onSelect, onBranch }: {
  active: Entry | undefined; branch: string; entries: Entry[];
  onSelect: (id: string) => void; onBranch: (value: string) => void;
}) {
  const domain = domainInfo(branch);
  const branchEntries = entries.filter(entry => entry.branch === branch);
  const established = branchEntries.filter(entry => entry.stage === "Established").length;

  return <aside className="evo-detail" id="evo-skill-inspector" aria-live="polite">
    {active ? <>
      <div className="evo-detail-topline">
        <span className="evo-detail-kicker">SKILL INTELLIGENCE</span>
        <span className={"evo-pill " + active.stage.toLowerCase()}>{active.stage}</span>
      </div>
      <div className="evo-detail-domain"><span style={{ background: domain.color }} />{active.branch}</div>
      <h3>{displayName(active)}</h3>
      <p className="evo-detail-intro">{active.summary}</p>
      <div className="evo-detail-rule" />
      {active.knowledge_profile ? <>
        <section className="evo-knowledge">
          <h4>Capabilities</h4>
          <ul className="evo-knowledge-chips">{profileValues(active.knowledge_profile.capabilities).map(text=><li key={text}>{text}</li>)}</ul>
          <h4>How it operates</h4>
          <ol className="evo-knowledge-steps">{profileValues(active.knowledge_profile.operations).map(text=><li key={text}>{text}</li>)}</ol>
          <details className="evo-knowledge-more">
            <summary>Inputs, outputs & systems <span aria-hidden="true">＋</span></summary>
            <div className="evo-knowledge-columns">
              {[
                { title: "Needs", items: active.knowledge_profile.inputs },
                { title: "Produces", items: active.knowledge_profile.outputs },
                { title: "Touches", items: active.knowledge_profile.touches },
              ].map(group=><div key={group.title}><h5>{group.title}</h5><ul>{profileValues(group.items).map(text=><li key={text}>{text}</li>)}</ul></div>)}
            </div>
          </details>
          <h4>Operating boundaries</h4>
          <ul className="evo-boundaries">{profileValues(active.knowledge_profile.boundaries).map(text=><li key={text}>{text}</li>)}</ul>
          {profileValues(active.knowledge_profile.related).length>0 && <>
            <h4>Related skills</h4>
            <div className="evo-related">
              {active.knowledge_profile.related.map(id=>{
                const item=entries.find(entry=>entry.skill_path==="skills/"+id+"/SKILL.md");
                return item ? <button type="button" key={id} onClick={()=>onSelect(item.id)}>{displayName(item)} <span aria-hidden="true">↗</span></button> : null;
              })}
            </div>
          </>}
        </section>
      </> : <section className="evo-knowledge">
        <h4>Context dependencies</h4>
        <ul className="evo-fallback-list">{profileValues(active.context_items).map(text=><li key={text}>{text}</li>)}</ul>
      </section>}
      <details className="evo-evidence">
        <summary>Source & verification</summary>
        <p><strong>Procedure maturity:</strong> {active.stage}. This does not certify that external systems are deployed or operating.</p>
        <p>{active.evidence}</p>
        <p><strong>Next verification:</strong> {active.next_step}</p>
      </details>
      {active.skill_path && <a className="evo-source" target="_blank" rel="noopener noreferrer" href={"https://github.com/SiminanRoll/captains_log/blob/main/"+active.skill_path}>View canonical skill source <span aria-hidden="true">↗</span></a>}
    </> : branch === "All" ? <>
      <div className="evo-detail-kicker">ATLAS OVERVIEW</div>
      <div className="evo-detail-emblem"><span>✳</span></div>
      <h3>One brain. Six worlds of knowledge.</h3>
      <p className="evo-detail-intro">Each domain contains its own procedures and boundaries. Select one to explore the skills behind it.</p>
      <div className="evo-overview-metrics">
        <div><strong>{entries.length}</strong><span>Skills mapped</span></div>
        <div><strong>{new Set(entries.map(entry=>entry.branch)).size}</strong><span>Domains</span></div>
        <div><strong>{entries.filter(entry=>Boolean(entry.skill_path)).length}</strong><span>Source links</span></div>
      </div>
      <div className="evo-detail-rule" />
      <div className="evo-detail-small-title">FIND YOUR WAY</div>
      <p className="evo-detail-note">Select a domain node to see its capabilities, then choose a skill to understand its operations and connections.</p>
    </> : <>
      <div className="evo-detail-kicker">DOMAIN OVERVIEW</div>
      <div className="evo-domain-emblem" style={{ color:domain.color, background:domain.soft }}>{domain.symbol}</div>
      <h3>{domain.name}</h3>
      <p className="evo-detail-intro">{domain.description}</p>
      <div className="evo-overview-metrics">
        <div><strong>{branchEntries.length}</strong><span>Skills</span></div>
        <div><strong>{established}</strong><span>Established</span></div>
        <div><strong>{branchEntries.filter(entry=>Boolean(entry.knowledge_profile)).length}</strong><span>Mapped</span></div>
      </div>
      <div className="evo-detail-rule" />
      <div className="evo-detail-small-title">IN THIS DOMAIN</div>
      <div className="evo-domain-skill-preview">
        {branchEntries.slice(0,6).map(item=><button type="button" key={item.id} onClick={()=>onSelect(item.id)}>
          <span>{displayName(item)}</span><span aria-hidden="true">↗</span>
        </button>)}
      </div>
      {branchEntries.length>6 && <p className="evo-detail-note">And {branchEntries.length-6} additional capabilities in the library below.</p>}
      <button type="button" className="evo-return-link" onClick={()=>onBranch("All")}>← Return to all domains</button>
    </>}
  </aside>;
}

export default function EvoBrain() {
  const [session,setSession] = useState<Session|null>(null);
  const [entries,setEntries] = useState<Entry[]>([]);
  const [status,setStatus] = useState("Checking session…");
  const [email,setEmail] = useState("Patricb@live.com");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [branch,setBranch] = useState("All");
  const [stage,setStage] = useState("All");
  const [query,setQuery] = useState("");
  const [selected,setSelected] = useState<string|null>(null);

  async function load(token: string) {
    const auth=await fetch(url+"/auth/v1/user",{headers:headers(token),cache:"no-store"});
    if(!auth.ok) throw new Error("Session expired. Please sign in again.");
    const res=await fetch(url+"/rest/v1/evo_brain_entries?select=id,title,branch,category,stage,summary,skill_path,context_items,next_step,evidence,updated_at,knowledge_profile&order=branch.asc,title.asc",
      {headers:headers(token),cache:"no-store"});
    if(!res.ok) throw new Error("Unable to load authorized skills.");
    const data=await res.json() as Entry[];
    setEntries(data);
    setSelected(current=>data.some(row=>row.id===current)?current:null);
    setStatus("Ready");
  }
  async function refresh(s: Session) {
    const res=await fetch(url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:headers(),
      body:JSON.stringify({refresh_token:s.refresh_token}),cache:"no-store"});
    if(!res.ok) throw new Error("Please sign in again.");
    const body=await res.json();
    return {access_token:body.access_token,refresh_token:body.refresh_token,expires_at:Math.floor(Date.now()/1000)+body.expires_in} as Session;
  }
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const raw=localStorage.getItem(storageKey);
        if(!raw){setStatus("Sign in to explore your EVO Brain");return;}
        let s=JSON.parse(raw) as Session;
        if(s.expires_at<Date.now()/1000+90)s=await refresh(s);
        if(cancelled)return;
        await load(s.access_token);
        if(!cancelled){setSession(s);localStorage.setItem(storageKey,JSON.stringify(s));}
      } catch {
        localStorage.removeItem(storageKey);
        if(!cancelled){setSession(null);setStatus("Sign in to explore your EVO Brain");}
      }
    })();
    return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    if(!session)return;
    const timer=setInterval(async()=>{
      try{
        const s=await refresh(JSON.parse(localStorage.getItem(storageKey)||"null") as Session);
        setSession(s);localStorage.setItem(storageKey,JSON.stringify(s));
      }catch{
        localStorage.removeItem(storageKey);setSession(null);setEntries([]);
        setStatus("Session ended. Sign in again.");
      }
    },20*60*1000);
    return()=>clearInterval(timer);
  },[session?.access_token]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try{
      const res=await fetch(url+"/auth/v1/token?grant_type=password",{method:"POST",headers:headers(),
        body:JSON.stringify({email,password}),cache:"no-store"});
      const body=await res.json();
      if(!res.ok)throw new Error("Sign-in failed. Check your credentials.");
      const s:Session={access_token:body.access_token,refresh_token:body.refresh_token,
        expires_at:Math.floor(Date.now()/1000)+body.expires_in};
      await load(s.access_token);setSession(s);
      localStorage.setItem(storageKey,JSON.stringify(s));setPassword("");
    }catch(e){setError(e instanceof Error?e.message:"Sign-in failed");}
    finally{setBusy(false);}
  }
  async function reloadCatalog(){
    if(!session)return;
    setBusy(true);setError("");
    try{
      let s=session;
      if(s.expires_at<Date.now()/1000+90){
        s=await refresh(s);setSession(s);localStorage.setItem(storageKey,JSON.stringify(s));
      }
      await load(s.access_token);
    }catch(e){setError(e instanceof Error?e.message:"Unable to refresh catalog");}
    finally{setBusy(false);}
  }
  async function signOut(){
    const s=session;localStorage.removeItem(storageKey);setSession(null);setEntries([]);
    setSelected(null);setBranch("All");setQuery("");setStatus("Signed out");
    if(s)await fetch(url+"/auth/v1/logout",{method:"POST",headers:headers(s.access_token)}).catch(()=>{});
  }
  const lastUpdate=entries.reduce((latest,item)=>item.updated_at&&item.updated_at>latest?item.updated_at:latest,"");
  const filtered=useMemo(()=>entries.filter(item=>{
    if(branch!=="All" && item.branch!==branch)return false;
    if(stage!=="All" && item.stage!==stage)return false;
    const haystack=[item.title,displayName(item),item.branch,item.category,item.summary,
      ...profileValues(item.knowledge_profile?.capabilities),
      ...profileValues(item.knowledge_profile?.operations),
      ...profileValues(item.knowledge_profile?.touches)].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }),[entries,branch,stage,query]);
  const active=entries.find(item=>item.id===selected);
  const showDomainCards=branch==="All"&&stage==="All"&&!query.trim();
  const chooseBranch=(next:string)=>{
    setBranch(next);setSelected(null);setStage("All");setQuery("");
  };
  const selectNode=(id:string)=>{
    const item=entries.find(entry=>entry.id===id);
    if(!item)return;
    setSelected(id);setBranch(item.branch);setStage("All");setQuery("");
    if(window.matchMedia("(max-width: 980px)").matches)
      requestAnimationFrame(()=>document.getElementById("evo-skill-inspector")?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const search=(value:string)=>{
    setQuery(value);setBranch("All");setSelected(null);setStage("All");
  };
  const counts={domains:new Set(entries.map(item=>item.branch)).size,skills:entries.length,sources:entries.filter(item=>Boolean(item.skill_path)).length};

  return <main className="evo-root">
    <header className="evo-top">
      <div className="evo-top-inner">
        <div className="evo-wordmark"><div className="evo-symbol" aria-hidden="true"><span>✳</span></div>
          <div><strong>EVO</strong><small>KNOWLEDGE ATLAS</small></div>
        </div>
        {session ? <>
          <label className="evo-top-search">
            <span aria-hidden="true" className="evo-search-icon">⌕</span>
            <input aria-label="Search skills" type="search" value={query} onChange={e=>search(e.target.value)} placeholder="Search everything EVO knows…"/>
            <span className="evo-search-hint">/</span>
          </label>
          <div className="evo-top-actions">
            <span className="evo-private-indicator"><i/>PRIVATE</span>
            <button type="button" onClick={reloadCatalog} disabled={busy} aria-label="Reload skills" className="evo-reload" title="Reload stored Supabase catalog">{busy?"↻":"⟳"}</button>
            <button type="button" onClick={signOut} className="evo-signout">Sign out</button>
          </div>
        </> : <span className="evo-private-indicator"><i/>PRIVATE ACCESS</span>}
      </div>
    </header>

    {!session ? <div className="evo-auth-wrap">
      <section className="evo-auth-panel">
        <span className="evo-eyebrow">YOUR PRIVATE KNOWLEDGE SYSTEM</span>
        <div className="evo-auth-glyph" aria-hidden="true">✳</div>
        <h1>Welcome to <em>EVO Brain.</em></h1>
        <p>{status}. Sign in with your existing task-list account to explore the catalog.</p>
        <form className="evo-auth-form" onSubmit={signIn}>
          <label>Email address<input aria-label="Email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Password<input aria-label="Password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <button type="submit" disabled={busy}>{busy?"Signing in…":"Enter EVO Brain"} <span aria-hidden="true">↗</span></button>
          {error && <p role="alert" className="evo-refresh-error">{error}</p>}
        </form>
      </section>
    </div> : <div className="evo-wrap">
      <div className="evo-page-heading">
        <div className="evo-page-heading-copy">
          <span className="evo-eyebrow"><span className="evo-live-dot"/> THE EVO ECOSYSTEM</span>
          <h1>Knowledge, <em>connected.</em></h1>
          <p>Understand the capabilities, procedures and relationships behind every part of EVO.</p>
        </div>
        <div className="evo-heading-aside">
          <div className="evo-head-metrics">
            <div><strong>{counts.domains.toString().padStart(2,"0")}</strong><span>DOMAINS</span></div>
            <div><strong>{counts.skills.toString().padStart(2,"0")}</strong><span>SKILLS</span></div>
            <div><strong>{counts.sources.toString().padStart(2,"0")}</strong><span>SOURCED</span></div>
          </div>
          <div className="evo-catalog-meta">Catalog updated: <strong>{formatDate(lastUpdate)}</strong></div>
        </div>
      </div>
      {error&&<p role="alert" className="evo-refresh-error evo-main-error">{error}</p>}
      <div className="evo-atlas-workspace">
        <EvoNeuralMap entries={entries} selected={selected} activeBranch={branch} onSelect={selectNode} onBranch={chooseBranch}/>
        <DetailPanel active={active} branch={branch} entries={entries} onSelect={selectNode} onBranch={chooseBranch}/>
      </div>
      <section className="evo-library-section" aria-labelledby="evo-library-heading">
        <div className="evo-library-heading">
          <div><span className="evo-eyebrow">EXPLORE THE LIBRARY</span>
            <h2 id="evo-library-heading">{showDomainCards?"Knowledge domains":branch==="All"?"Matching capabilities":domainInfo(branch).short+" capabilities"}</h2>
            <p>{showDomainCards?"Choose a domain to go deeper.":"Select a capability to open its full knowledge profile."}</p>
          </div>
          <div className="evo-library-tools">
            {!showDomainCards&&<span className="evo-results-count">{filtered.length} results</span>}
            <label className="evo-maturity-filter"><span>Maturity</span>
              <select aria-label="Maturity" value={stage} onChange={e=>setStage(e.target.value)}>
                {["All","Established","Starter","Proposed"].map(value=><option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </div>
        {showDomainCards ? <div className="evo-domain-grid">
          {EVO_DOMAINS.map(info=>{
            const subset=entries.filter(item=>item.branch===info.name);
            return <button type="button" key={info.name} className="evo-domain-card" onClick={()=>chooseBranch(info.name)}
              style={{"--domain-accent":info.color} as React.CSSProperties}>
              <div className="evo-domain-card-top"><span className="evo-card-symbol">{info.symbol}</span>
                <span className="evo-card-count">{subset.length} SKILLS</span></div>
              <h3>{info.name}</h3><p>{info.description}</p>
              <div className="evo-domain-card-bottom"><span>{info.subtitle}</span><b aria-hidden="true">↗</b></div>
            </button>;
          })}
        </div> : filtered.length ? <div className="evo-skill-list">
          {filtered.map(item=>{
            const info=domainInfo(item.branch);
            return <button type="button" key={item.id} className={"evo-skill-card"+(selected===item.id?" active":"")}
              style={{"--domain-accent":info.color} as React.CSSProperties}
              onClick={()=>selectNode(item.id)}>
              <div className="evo-card-head"><span className="evo-skill-card-category">{item.category}</span><span className={"evo-pill "+item.stage.toLowerCase()}>{item.stage}</span></div>
              <h3>{displayName(item)}</h3>
              <p>{item.summary}</p>
              <div className="evo-skill-card-bottom">
                <span>{item.branch}</span>
                <span aria-hidden="true">↗</span>
              </div>
            </button>;
          })}
        </div> : <div className="evo-empty"><strong>No matching capabilities</strong><p>Try a different search or maturity filter.</p>
          <button type="button" onClick={()=>{setQuery("");setStage("All");}}>Clear filters</button></div>}
      </section>
      <footer className="evo-footer">EVO Brain · Owner-only capability atlas. This view shows source-safe summaries, not the private skill bodies or external account data. Relationships are curated navigation, not permissions or verified integrations. Reload reads Supabase metadata, not GitHub.</footer>
    </div>}
  </main>;
}
