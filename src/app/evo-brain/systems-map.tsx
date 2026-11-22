"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { EVO_DOMAINS, domainInfo } from "./domain-info";

/** Asset references arrive only with owner-authorized Supabase knowledge_profile rows. */
export type EvoAsset = {
  id: string; label: string; type: string; status: string;
  summary: string; evidence: string; relationship: string; url?: string;
};
export type SystemEntry = {
  id: string; title: string; branch: string; skill_path: string | null;
  knowledge_profile?: { label: string; assets?: EvoAsset[] } | null;
};
export const ASSET_TYPES = [
  { id:"repository", label:"Repos", full:"Repositories", color:"#8fc0ff" },
  { id:"database", label:"Databases", full:"Databases", color:"#7be0c6" },
  { id:"web_app", label:"Web apps", full:"Web apps", color:"#c7a5ff" },
  { id:"website", label:"Websites", full:"Websites", color:"#ffbe95" },
  { id:"domain", label:"Domains", full:"Domains", color:"#efd383" },
  { id:"service", label:"Services", full:"Services", color:"#9eb4d1" },
  { id:"storage", label:"Storage", full:"Storage", color:"#f0aeca" },
] as const;
export const assetType = (type:string) => ASSET_TYPES.find(item=>item.id===type)
  || {id:type,label:type,full:type,color:"#a5b9d5"};
export const linkedAssets = (entry:SystemEntry) => Array.isArray(entry.knowledge_profile?.assets)
  ? entry.knowledge_profile.assets : [];
export function uniqueAssets(entries:SystemEntry[]):EvoAsset[]{
  const map=new Map<string,EvoAsset>();
  for(const entry of entries)for(const asset of linkedAssets(entry))if(!map.has(asset.id))map.set(asset.id,asset);
  return [...map.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label));
}
const nameOf=(entry:SystemEntry)=>entry.knowledge_profile?.label||entry.title;
const short=(value:string,n=22)=>value.length<=n?value:value.slice(0,n-1)+"…";
const activate=(event:KeyboardEvent<SVGGElement>,fn:()=>void)=>{
  if(event.key==="Enter"||event.key===" "){event.preventDefault();fn();}
};
const countLinks=(entries:SystemEntry[],assetId:string)=>entries.filter(entry=>linkedAssets(entry).some(asset=>asset.id===assetId)).length;

type Props = {
  entries:SystemEntry[]; branch:string; selectedSkill:string|null; selectedAsset:string|null;
  assetFilter:string; onBranch:(value:string)=>void; onSkill:(id:string)=>void;
  onAsset:(id:string)=>void; onType:(type:string)=>void;
};

export function EvoSystemsMap({entries,branch,selectedSkill,selectedAsset,assetFilter,onBranch,onSkill,onAsset,onType}:Props){
  const viewport=useRef<HTMLDivElement>(null);
  const [zoom,setZoom]=useState(1);
  const focused=branch!=="All";
  const activeSkill=entries.find(entry=>entry.id===selectedSkill&&entry.branch===branch);
  const visibleEntries=useMemo(()=>entries.filter(entry=>entry.branch===branch),[entries,branch]);
  const graphEntries=activeSkill?[activeSkill]:visibleEntries;
  const assets=uniqueAssets(graphEntries).filter(asset=>assetFilter==="All"||asset.type===assetFilter);
  const rows=Math.max(1,Math.ceil(assets.length/2));
  const chartHeight=focused?Math.max(565,rows*105+90):660;
  const positioned=assets.map((asset,index)=>({asset,x:index%2===0?637:859,y:84+Math.floor(index/2)*105}));
  const hubName=activeSkill?nameOf(activeSkill):domainInfo(branch).name;
  const domainRows=EVO_DOMAINS.map((info,index)=>({
    info,y:100+index*90, entries:entries.filter(entry=>entry.branch===info.name),
  }));
  const kinds=ASSET_TYPES.map((info,index)=>({info,y:76+index*85}));
  const rootAssets=uniqueAssets(entries);
  useEffect(()=>{
    if(window.matchMedia("(max-width:580px)").matches)setZoom(2);
  },[]);
  useEffect(()=>{
    const element=viewport.current;
    if(element)element.scrollLeft=Math.max(0,(element.scrollWidth-element.clientWidth)/2);
  },[zoom,branch,selectedSkill,assetFilter]);
  const changeZoom=(delta:number)=>setZoom(value=>Math.min(2.4,Math.max(.6,Math.round((value+delta)*100)/100)));

  return <section className="evo-neural-section evo-systems-section" aria-labelledby="evo-systems-heading">
    <div className="evo-neural-heading">
      <div className="evo-neural-heading-title">
        <h2 id="evo-systems-heading">Systems map</h2>
        <p>{activeSkill?nameOf(activeSkill):focused?domainInfo(branch).name:"Domains connected to the assets they reference"}</p>
      </div>
      <div className="evo-map-actions">
        {focused&&<button type="button" className="evo-outline-button" onClick={()=>onBranch("All")}>← Domains</button>}
        {activeSkill&&<button type="button" className="evo-outline-button" onClick={()=>onBranch(branch)}>All {domainInfo(branch).short} skills</button>}
        <div className="evo-zoom-controls" role="group" aria-label="Systems map zoom">
          <button type="button" aria-label="Zoom systems map out" disabled={zoom<=.6} onClick={()=>changeZoom(-.2)}>−</button>
          <output aria-label="Systems map zoom level">{Math.round(zoom*100)}%</output>
          <button type="button" aria-label="Zoom systems map in" disabled={zoom>=2.4} onClick={()=>changeZoom(.2)}>+</button>
          <button type="button" className="evo-fit-map" aria-label="Fit systems map" onClick={()=>setZoom(1)}>Fit</button>
        </div>
      </div>
    </div>
    <div ref={viewport} className="evo-neural-scroll evo-systems-scroll" role="region" tabIndex={0} aria-label="Interactive EVO systems network">
      <svg className="evo-system-svg" role="group" aria-label={focused?"Linked assets for "+hubName:"Six domains and seven asset types"}
        viewBox={"0 0 980 "+chartHeight} style={{display:"block",width:zoom*100+"%",minWidth:0,maxWidth:"none",marginInline:zoom<=1?"auto":0}}>
        <defs><linearGradient id="evo-system-edge" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#567fae" stopOpacity=".24"/><stop offset="1" stopColor="#86b8ed" stopOpacity=".56"/></linearGradient></defs>
        {Array.from({length:11},(_,index)=><line className="evo-atlas-grid" key={index} x1={index*98} y1="0" x2={index*98} y2={chartHeight}/>)}
        {Array.from({length:Math.ceil(chartHeight/95)+1},(_,index)=><line className="evo-atlas-grid" key={"horizontal"+index} x1="0" y1={index*95} x2="980" y2={index*95}/>)}
        {!focused ? <>
          <text x="160" y="45" className="evo-system-axis">DOMAINS</text>
          <text x="720" y="45" className="evo-system-axis">ASSET TYPES</text>
          {domainRows.flatMap(row=>{
            const types=new Set(uniqueAssets(row.entries).map(asset=>asset.type));
            return kinds.filter(kind=>types.has(kind.info.id) && (assetFilter==="All"||kind.info.id===assetFilter)).map(kind=>(
              <path key={row.info.name+"-"+kind.info.id}
                d={"M308 "+row.y+" C456 "+row.y+" 506 "+kind.y+" 626 "+kind.y}
                stroke={kind.info.color} strokeWidth="1.25" strokeOpacity=".24" fill="none"/>
            ));
          })}
          {domainRows.map(row=>{
            const pick=()=>onBranch(row.info.name),count=uniqueAssets(row.entries).length;
            return <g key={row.info.name} className="evo-system-domain-node evo-neural-clickable" role="button" tabIndex={0}
              aria-label={"Open systems for "+row.info.name} onClick={pick} onKeyDown={event=>activate(event,pick)}>
              <rect x="32" y={row.y-34} width="276" height="68" rx="13" fill="#15263c" stroke={row.info.color} strokeOpacity=".62"/>
              <circle cx="53" cy={row.y} r="5" fill={row.info.color}/>
              <text x="69" y={row.y-4} className="evo-system-name">{short(row.info.name,28)}</text>
              <text x="69" y={row.y+16} className="evo-system-meta">{row.entries.length+" SKILLS · "+count+" ASSETS"}</text>
              <text x="290" y={row.y+6} textAnchor="middle" className="evo-node-arrow">↗</text>
            </g>;
          })}
          {kinds.map(kind=>{
            const count=rootAssets.filter(asset=>asset.type===kind.info.id).length;
            const pick=()=>onType(assetFilter===kind.info.id?"All":kind.info.id);
            const isActive=assetFilter===kind.info.id;
            return <g key={kind.info.id} className="evo-system-kind-node evo-neural-clickable" role="button" tabIndex={0}
              aria-label={"Filter "+kind.info.full} aria-pressed={isActive} onClick={pick} onKeyDown={event=>activate(event,pick)}>
              <rect x="626" y={kind.y-32} width="310" height="64" rx="13" fill={isActive?"#263d55":"#16273d"}
                stroke={kind.info.color} strokeWidth={isActive?2:1} strokeOpacity=".7"/>
              <rect x="640" y={kind.y-16} width="4" height="32" rx="2" fill={kind.info.color}/>
              <text x="658" y={kind.y-4} className="evo-system-name">{kind.info.full}</text>
              <text x="658" y={kind.y+16} className="evo-system-meta">{count+" REGISTERED"}</text>
            </g>;
          })}
        </> : <>
          <text x="66" y="42" className="evo-system-axis">{activeSkill?"SKILL":"DOMAIN"}</text>
          <text x="535" y="42" className="evo-system-axis">RELATED ASSETS</text>
          {positioned.map(point=><path key={"edge-"+point.asset.id}
            d={"M330 "+(chartHeight/2)+" C455 "+(chartHeight/2)+" 496 "+point.y+" "+(point.x-100)+" "+point.y}
            stroke={assetType(point.asset.type).color} strokeOpacity=".42" strokeWidth="1.8" fill="none"/>)}
          <g className="evo-system-hub" aria-label={"Mapped "+(activeSkill?"skill":"domain")+" "+hubName}>
            <rect x="45" y={chartHeight/2-80} width="285" height="160" rx="21" fill="#1b2f49"
              stroke={domainInfo(branch).color} strokeWidth="2"/>
            <text x="68" y={chartHeight/2-42} className="evo-system-axis">{activeSkill?"SELECTED SKILL":"KNOWLEDGE DOMAIN"}</text>
            <text x="68" y={chartHeight/2-11} className="evo-system-hub-name">{short(hubName,22)}</text>
            <text x="68" y={chartHeight/2+19} className="evo-system-meta">{graphEntries.length+" SKILLS · "+assets.length+" ASSETS"}</text>
            <text x="68" y={chartHeight/2+53} className="evo-system-hub-note">Source-linked, not live telemetry</text>
          </g>
          {positioned.map(point=>{
            const asset=point.asset,kind=assetType(asset.type),selected=selectedAsset===asset.id,pick=()=>onAsset(asset.id);
            return <g key={asset.id} role="button" tabIndex={0} className={"evo-system-asset-node evo-neural-clickable"+(selected?" is-selected":"")}
              aria-label={"Inspect asset "+asset.label} aria-pressed={selected} onClick={pick} onKeyDown={event=>activate(event,pick)}>
              <title>{asset.label+" — "+kind.full+" — "+asset.relationship}</title>
              <rect x={point.x-99} y={point.y-40} width="198" height="80" rx="13" fill={selected?"#263c57":"#14263c"}
                stroke={kind.color} strokeWidth={selected?2.4:1} strokeOpacity={selected?1:".7"}/>
              <circle cx={point.x-80} cy={point.y-18} r="4" fill={kind.color}/>
              <text x={point.x-69} y={point.y-13} className="evo-system-name">{short(asset.label,20)}</text>
              <text x={point.x-80} y={point.y+15} className="evo-system-meta">{kind.label.toUpperCase()+" · "+asset.relationship.replaceAll("_"," ").toUpperCase()}</text>
              <text x={point.x+80} y={point.y+27} textAnchor="middle" className="evo-node-arrow">↗</text>
            </g>;
          })}
          {!assets.length&&<text x="700" y={chartHeight/2} className="evo-no-connections" textAnchor="middle">No mapped assets for this filter</text>}
        </>}
      </svg>
    </div>
    <div className="evo-neural-legend evo-asset-type-legend" role="group" aria-label="Asset category filters">
      <button type="button" className={assetFilter==="All"?"selected":""} aria-pressed={assetFilter==="All"} onClick={()=>onType("All")}>All assets</button>
      {ASSET_TYPES.map(info=><button type="button" key={info.id} className={assetFilter===info.id?"selected":""}
        aria-pressed={assetFilter===info.id} onClick={()=>onType(assetFilter===info.id?"All":info.id)}>
        <span className="evo-legend-dot" style={{background:info.color}}/>{info.label}
      </button>)}
    </div>
    <p className="evo-map-caption">Connections indicate curated skill-to-asset references, not data transfer, active deployments or access permissions.</p>
  </section>;
}

export function AssetInspector({entries,selectedAsset,selectedSkill,onSkill,onClear}:{
  entries:SystemEntry[];selectedAsset:string|null;selectedSkill:string|null;
  onSkill:(id:string)=>void;onClear:()=>void;
}){
  const assets=uniqueAssets(entries);
  const asset=assets.find(item=>item.id===selectedAsset);
  const linked=asset?entries.filter(entry=>linkedAssets(entry).some(item=>item.id===asset.id)):[];
  const selected=entries.find(entry=>entry.id===selectedSkill);
  const tagged=selected?linkedAssets(selected):[];
  return <aside className="evo-detail evo-asset-inspector" id="evo-asset-inspector" aria-live="polite">
    {asset ? <>
      <div className="evo-detail-topline"><span className="evo-detail-kicker">ASSET RECORD</span>
        <span className="evo-asset-type" style={{color:assetType(asset.type).color}}>{assetType(asset.type).full}</span></div>
      <h3>{asset.label}</h3>
      <p className="evo-detail-intro">{asset.summary}</p>
      <div className="evo-asset-status">{asset.status==="verified"?"Source repository confirmed":asset.status==="reference_only"?"Reference only · connection not verified":"Documented · live state not checked"}</div>
      {asset.url&&<a className="evo-source" href={asset.url} target="_blank" rel="noopener noreferrer">Open asset <span aria-hidden="true">↗</span></a>}
      <div className="evo-detail-rule"/>
      <h4 className="evo-asset-inspector-subtitle">Linked skills <span>{linked.length}</span></h4>
      <div className="evo-asset-skill-links">{linked.map(entry=>{
        const rel=linkedAssets(entry).find(item=>item.id===asset.id)?.relationship||"references";
        return <button type="button" key={entry.id} onClick={()=>onSkill(entry.id)}>
          <strong>{nameOf(entry)}</strong><small>{domainInfo(entry.branch).short} · {rel.replaceAll("_"," ")}</small>
        </button>;
      })}</div>
      <details className="evo-evidence"><summary>Source evidence & limits</summary><p>Documented in <code>{asset.evidence}</code>.</p>
        <p>Registry status is not a live uptime check, owner authorization or proof of a deployed integration.</p></details>
      <button type="button" className="evo-return-link" onClick={onClear}>← Close asset details</button>
    </> : <>
      <div className="evo-detail-kicker">SYSTEM INVENTORY</div>
      <h3>{selected?nameOf(selected):"The systems behind EVO"}</h3>
      <p className="evo-detail-intro">{selected?"Select an asset connected to this skill to see its source evidence and every other skill that references it.":"Select a domain or asset category to see the repositories, databases, apps and services behind its skills."}</p>
      <div className="evo-overview-metrics">
        <div><strong>{assets.length}</strong><span>Assets</span></div>
        <div><strong>{entries.length}</strong><span>Skills</span></div>
        <div><strong>{ASSET_TYPES.length}</strong><span>Types</span></div>
      </div>
      <div className="evo-detail-rule"/>
      <div className="evo-detail-small-title">{selected?"SKILL ASSET TAGS":"BUILT FOR TRACEABILITY"}</div>
      {selected?<div className="evo-skill-asset-summary">{tagged.map(asset=><span key={asset.id} className="evo-asset-pill"><i style={{background:assetType(asset.type).color}}/>{asset.label}</span>)}</div>
        :<p className="evo-detail-note">All entries come from private owner-authorized skill metadata. Source links are not the same as functioning connections.</p>}
    </>}
  </aside>;
}

export function AssetDirectory({entries,branch,filter,query,selected,onSelect}:{
  entries:SystemEntry[];branch:string;filter:string;query:string;selected:string|null;onSelect:(id:string)=>void;
}){
  const scoped=entries.filter(entry=>branch==="All"||entry.branch===branch);
  const assets=uniqueAssets(scoped).filter(asset=>(filter==="All"||asset.type===filter)&&
    (asset.label+" "+asset.type+" "+asset.summary).toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="evo-library-section evo-assets-library" aria-labelledby="evo-assets-heading">
    <div className="evo-library-heading">
      <div><span className="evo-eyebrow">SOURCE-BACKED ASSET CATALOG</span>
        <h2 id="evo-assets-heading">Asset directory</h2>
        <p>Organized by type, with ownership boundaries and linked skills kept distinct.</p></div>
      <span className="evo-results-count">{assets.length} assets</span>
    </div>
    {assets.length?<div className="evo-asset-grid">{assets.map(asset=>{
      const type=assetType(asset.type);
      return <button type="button" key={asset.id} className={"evo-asset-card"+(selected===asset.id?" active":"")}
        onClick={()=>onSelect(asset.id)} style={{"--domain-accent":type.color} as React.CSSProperties}>
        <div className="evo-asset-card-top"><span className="evo-asset-pill"><i style={{background:type.color}}/>{type.label}</span>
          <span className="evo-asset-card-status">{asset.status==="reference_only"?"Reference only":asset.status==="verified"?"Source confirmed":"Documented"}</span></div>
        <strong>{asset.label}</strong><p>{asset.summary}</p>
        <div className="evo-asset-card-bottom"><span>{countLinks(scoped,asset.id)} linked skills</span><span aria-hidden="true">↗</span></div>
      </button>;
    })}</div>:<div className="evo-empty"><strong>No assets match</strong><p>Try a different category or search.</p></div>}
  </section>;
}
