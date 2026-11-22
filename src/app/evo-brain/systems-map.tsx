"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, CSSProperties } from "react";

/**
 * All project names, asset links and source citations arrive from owner-authorized
 * knowledge profiles. The network never assumes a live integration from co-ownership.
 */
export type AssetEdge={target:string;relation:string;evidence:string};
export type EvoAsset={
  id:string;label:string;type:string;status:string;summary:string;evidence:string;
  project:string;project_label:string;project_summary:string;relationship:string;
  connections?:AssetEdge[];url?:string;
};
export type SystemEntry={
  id:string;title:string;branch:string;skill_path:string|null;
  knowledge_profile?:{label:string;assets?:EvoAsset[]}|null;
};
export const ASSET_TYPES=[
 {id:"repository",label:"Repos",full:"Repositories",color:"#82c1ff"},
 {id:"database",label:"Databases",full:"Databases",color:"#71e0bc"},
 {id:"web_app",label:"Web apps",full:"Web applications",color:"#c4a5ff"},
 {id:"website",label:"Websites",full:"Websites",color:"#ffa989"},
 {id:"domain",label:"Domains",full:"Actual website domains",color:"#f8d980"},
 {id:"application",label:"Applications",full:"Desktop and mobile apps",color:"#afcdff"},
 {id:"service",label:"Services",full:"Services and integrations",color:"#90b6c8"},
 {id:"storage",label:"Storage",full:"Storage and publishing",color:"#edadd4"}
] as const;
export const assetType=(id:string)=>ASSET_TYPES.find(a=>a.id===id)||{id,label:id,full:id,color:"#a2b1c8"};
export const linkedAssets=(entry:SystemEntry):EvoAsset[]=>
  Array.isArray(entry.knowledge_profile?.assets)?entry.knowledge_profile.assets:[];
export function uniqueAssets(entries:SystemEntry[]):EvoAsset[]{
  const assets=new Map<string,EvoAsset>();
  for(const entry of entries)for(const asset of linkedAssets(entry)){
    if(!assets.has(asset.id))assets.set(asset.id,asset);
  }
  return [...assets.values()].sort((a,b)=>a.project_label.localeCompare(b.project_label)||a.label.localeCompare(b.label));
}
type Project={id:string;label:string;summary:string;assets:EvoAsset[]};
export function projectGroups(entries:SystemEntry[]):Project[]{
  const map=new Map<string,Project>();
  for(const asset of uniqueAssets(entries)){
    if(!asset.project)continue;
    if(!map.has(asset.project))map.set(asset.project,{
      id:asset.project,label:asset.project_label||asset.project,summary:asset.project_summary||"",assets:[]});
    map.get(asset.project)!.assets.push(asset);
  }
  return [...map.values()].sort((a,b)=>{
    const order=["evo","client-compass","captains-log","content-machine","advantage","service-area","hammy","brittany","bubblegum","pancake"];
    return order.indexOf(a.id)-order.indexOf(b.id);
  });
}
const nameOf=(entry:SystemEntry)=>entry.knowledge_profile?.label||entry.title;
const short=(v:string,n=25)=>v.length<=n?v:v.slice(0,n-1)+"…";
const urlText=(asset:EvoAsset)=>{if(!asset.url)return "";try{
  const parsed=new URL(asset.url);
  return parsed.hostname.replace(/^www\./,"")+(parsed.pathname!=="/"?parsed.pathname:"");
}catch{return "";}};
const relation=(v:string)=>v.replaceAll("_"," ");
const activate=(event:KeyboardEvent<SVGGElement>,fn:()=>void)=>{
  if(event.key==="Enter"||event.key===" "){event.preventDefault();fn();}
};
const linkCount=(entries:SystemEntry[],id:string)=>entries.filter(row=>linkedAssets(row).some(asset=>asset.id===id)).length;
const rowCore=(assets:EvoAsset[])=>{
  const order=["repository","website","database","web_app","domain","service","application","storage"];
  const result:EvoAsset[]=[];
  for(const type of order){
    const a=assets.find(x=>x.type===type);
    if(a && !result.some(x=>x.id===a.id))result.push(a);
    if(result.length===3)break;
  }
  return result;
};
const graphRank=(asset:EvoAsset)=>{
  if(["repository","storage"].includes(asset.type))return 0;
  if(["website","web_app","application"].includes(asset.type))return 1;
  return 2;
};
const projectPalette=["#83b9f2","#7dd3c7","#b3a8ee","#d6b68d","#e6a37b","#9dcbf4","#f4adbc","#c4adf3","#7fd6da","#adb6ec"];
const palette=(projects:Project[],id:string)=>projectPalette[Math.max(0,projects.findIndex(p=>p.id===id))%projectPalette.length];
function neighborsOf(asset:EvoAsset|undefined,assets:EvoAsset[]){
 if(!asset)return new Set<string>();
 const set=new Set((asset.connections||[]).map(edge=>edge.target));
 for(const source of assets)if(source.connections?.some(edge=>edge.target===asset.id))set.add(source.id);
 return set;
}
function scopedTopology(all:EvoAsset[],project:string,filter:string){
  if(project==="All")return [] as EvoAsset[];
  const local=all.filter(a=>a.project===project);
  const ids=new Set(local.map(a=>a.id));
  // Show true one-hop shared dependencies, not fabricated operational links.
  for(const node of local)for(const edge of node.connections||[])ids.add(edge.target);
  for(const node of all)if(node.connections?.some(edge=>ids.has(edge.target)))ids.add(node.id);
  return all.filter(a=>ids.has(a.id)&&(filter==="All"||a.type===filter));
}

type Props={
 entries:SystemEntry[];project:string;selectedSkill:string|null;selectedAsset:string|null;
 assetFilter:string;onProject:(id:string)=>void;
 onAsset:(id:string)=>void;onType:(id:string)=>void;
};
export function EvoSystemsMap({entries,project,selectedSkill,selectedAsset,assetFilter,onProject,onAsset,onType}:Props){
  const viewport=useRef<HTMLDivElement>(null);
  const [zoom,setZoom]=useState(1);
  const all=useMemo(()=>uniqueAssets(entries),[entries]);
  const projects=useMemo(()=>projectGroups(entries),[entries]);
  const byId=useMemo(()=>new Map(all.map(asset=>[asset.id,asset])),[all]);
  const focused=project!=="All";
  const visible=useMemo(()=>scopedTopology(all,project,assetFilter),[all,project,assetFilter]);
  const selected=all.find(asset=>asset.id===selectedAsset);
  const neighbors=neighborsOf(selected,all);
  const selectedSkillRow=entries.find(row=>row.id===selectedSkill);
  const highlightSkill=new Set(selectedSkillRow?linkedAssets(selectedSkillRow).map(a=>a.id):[]);
  const rows=projects.length?Math.ceil(projects.length/2):1;
  const overviewHeight=Math.max(620,rows*170+70);
  const byRank=[0,1,2].map(rank=>visible.filter(a=>graphRank(a)===rank));
  const focusHeight=Math.max(590,Math.max(...byRank.map(a=>a.length),1)*113+150);
  const height=focused?focusHeight:overviewHeight;
  const coreX=[173,551,918];
  const positions=visible.map(asset=>{
    const rank=graphRank(asset),col=byRank[rank],i=col.findIndex(a=>a.id===asset.id);
    return {asset,x:coreX[rank],y:116+i*113};
  });
  const positionsById=new Map(positions.map(point=>[point.asset.id,point]));
  const edges=visible.flatMap(asset=>(asset.connections||[]).filter(e=>positionsById.has(e.target)).map(e=>({
    id:asset.id+"-"+e.target,source:asset,target:byId.get(e.target)!,edge:e,
    from:positionsById.get(asset.id)!,to:positionsById.get(e.target)!
  })));
  const cross=all.flatMap(a=>(a.connections||[]).flatMap(edge=>{
    const other=byId.get(edge.target);
    return other&&other.project!==a.project?[{a:a.project,b:other.project,edge:edge.relation}]:[];
  }));
  const cardPos=(index:number)=>({x:index%2===0?28:572,y:76+Math.floor(index/2)*170});
  const focusedName=projects.find(p=>p.id===project)?.label||"Project";
  useEffect(()=>{if(window.matchMedia("(max-width:580px)").matches)setZoom(2);},[]);
  useEffect(()=>{
    const el=viewport.current;if(el)el.scrollLeft=Math.max(0,(el.scrollWidth-el.clientWidth)/2);
  },[zoom,project,assetFilter]);
  const changeZoom=(step:number)=>setZoom(z=>Math.min(2.4,Math.max(.6,Math.round((z+step)*100)/100)));
  const svgStyle:CSSProperties={display:"block",width:zoom*100+"%",minWidth:0,maxWidth:"none",marginInline:zoom<=1?"auto":0};

  return <section className="evo-neural-section evo-systems-section" aria-labelledby="evo-systems-heading">
    <div className="evo-neural-heading">
      <div className="evo-neural-heading-title">
        <h2 id="evo-systems-heading">{focused?focusedName+" systems":"Systems architecture"}</h2>
        <p>{focused?"Named repositories, actual sites, databases and direct documented links":"Explore real projects, not skill categories or anonymous asset totals"}</p>
      </div>
      <div className="evo-map-actions">
        {focused&&<button type="button" className="evo-outline-button" onClick={()=>onProject("All")}>← All projects</button>}
        <div className="evo-zoom-controls" role="group" aria-label="Systems map zoom">
          <button type="button" aria-label="Zoom systems map out" disabled={zoom<=.6} onClick={()=>changeZoom(-.2)}>−</button>
          <output aria-label="Systems map zoom level">{Math.round(zoom*100)}%</output>
          <button type="button" aria-label="Zoom systems map in" disabled={zoom>=2.4} onClick={()=>changeZoom(.2)}>+</button>
          <button type="button" className="evo-fit-map" aria-label="Fit systems map" onClick={()=>setZoom(1)}>Fit</button>
        </div>
      </div>
    </div>
    <div ref={viewport} className="evo-neural-scroll evo-systems-scroll" role="region" tabIndex={0} aria-label="Named project and system relationship network">
      <svg className="evo-system-svg" role="group" viewBox={"0 0 1100 "+height} style={svgStyle}
        aria-label={focused?"Actual named systems for "+focusedName:projects.length+" mapped projects with named assets"}>
        {Array.from({length:12},(_,i)=><line className="evo-atlas-grid" key={"g"+i} x1={i*100} y1="0" x2={i*100} y2={height}/>)}
        {Array.from({length:Math.ceil(height/95)},(_,i)=><line className="evo-atlas-grid" key={"h"+i} x1="0" y1={i*95} x2="1100" y2={i*95}/>)}
        {!focused ? <>
          {cross.map((edge,i)=>{
            const ai=projects.findIndex(p=>p.id===edge.a),bi=projects.findIndex(p=>p.id===edge.b);
            if(ai<0||bi<0)return null;
            const a=cardPos(ai),b=cardPos(bi),x1=a.x+245,y1=a.y+57,x2=b.x+245,y2=b.y+57;
            return <path key={i} d={"M"+x1+" "+y1+" Q550 "+((y1+y2)/2)+" "+x2+" "+y2}
              className="evo-project-edge" stroke={palette(projects,edge.a)} fill="none">
              <title>{projects[ai].label+" → "+projects[bi].label+" ("+relation(edge.edge)+")"}</title>
            </path>;
          })}
          {projects.map((p,i)=>{
            const pos=cardPos(i),pick=()=>onProject(p.id);
            const color=palette(projects,p.id),core=rowCore(p.assets);
            return <g role="button" tabIndex={0} key={p.id} className="evo-project-node evo-neural-clickable"
              aria-label={"Open project "+p.label} onClick={pick} onKeyDown={event=>activate(event,pick)}>
              <title>{p.label+" · "+p.summary}</title>
              <rect x={pos.x} y={pos.y} width="500" height="146" rx="18" fill="#102339" stroke={color} strokeWidth="1.5" strokeOpacity=".85"/>
              <rect x={pos.x+14} y={pos.y+16} width="5" height="26" rx="2" fill={color}/>
              <text x={pos.x+32} y={pos.y+35} className="evo-project-name">{short(p.label,36)}</text>
              <text x={pos.x+462} y={pos.y+35} textAnchor="end" className="evo-project-meta">{p.assets.length+" ASSETS"}</text>
              {core.map((asset,j)=>{
                const y=pos.y+64+j*25;
                return <g key={asset.id}>
                  <circle cx={pos.x+36} cy={y-4} r="4" fill={assetType(asset.type).color}/>
                  <text x={pos.x+50} y={y} className="evo-project-asset-label">{assetType(asset.type).label+": "+short(asset.label,31)}</text>
                  {asset.url&&<text x={pos.x+472} y={y} textAnchor="end" className="evo-project-asset-url">{short(urlText(asset),26)}</text>}
                </g>;
              })}
              <text x={pos.x+476} y={pos.y+131} textAnchor="middle" className="evo-node-arrow">↗</text>
            </g>;
          })}
        </> : <>
          {(["SOURCE & STORAGE","SITES & APPS","DOMAINS, DATA & SERVICES"] as const).map((name,i)=>
            <text key={i} x={coreX[i]-142} y="45" className="evo-system-axis">{name}</text>)}
          {edges.map(item=>{
            const active=selected?.id===item.source.id||selected?.id===item.target.id;
            const highlighted=!selected||(active);
            const x1=item.from.x,y1=item.from.y,x2=item.to.x,y2=item.to.y;
            const mid=(x1+x2)/2;
            return <g key={item.id}>
              <path className="evo-topology-edge"
                d={"M"+x1+" "+y1+" Q"+mid+" "+(Math.min(y1,y2)-10)+" "+x2+" "+y2}
                stroke={assetType(item.source.type).color} strokeWidth={active?2.8:1.35}
                strokeOpacity={highlighted ? (active ? 0.88 : 0.36) : 0.1} fill="none">
                <title>{item.source.label+" → "+item.target.label+" · "+relation(item.edge.relation)+" · "+item.edge.evidence}</title>
              </path>
              {active&&<text x={mid} y={(y1+y2)/2-8} textAnchor="middle" className="evo-graph-edge-label">{relation(item.edge.relation)}</text>}
            </g>;
          })}
          {positions.map(point=>{
            const asset=point.asset,kind=assetType(asset.type),isSelected=selected?.id===asset.id;
            const muted=selected&&!isSelected&&!neighbors.has(asset.id);
            const external=asset.project!==project;
            const skilled=highlightSkill.has(asset.id);
            const pick=()=>onAsset(asset.id);
            return <g key={asset.id} role="button" tabIndex={0} onClick={pick} onKeyDown={e=>activate(e,pick)}
              className={"evo-neural-clickable evo-asset-topology-node"+(isSelected?" is-selected":"")}
              aria-label={"Inspect system "+asset.label} aria-pressed={isSelected} opacity={muted ? 0.36 : 1}>
              <title>{asset.label+" · "+kind.full+" · "+(asset.url||"No verified site URL")+" · "+asset.evidence}</title>
              <rect x={point.x-148} y={point.y-43} width="296" height="88" rx="14"
                fill={isSelected?"#2b4563":external?"#1a2638":"#14263f"}
                stroke={kind.color} strokeOpacity={isSelected ? 1 : (external ? 0.5 : 0.84)} strokeWidth={isSelected?2.5:skilled?2:1}/>
              <circle cx={point.x-129} cy={point.y-22} r="5" fill={kind.color}/>
              <text x={point.x-116} y={point.y-17} className="evo-system-name">{short(asset.label,31)}</text>
              <text x={point.x-129} y={point.y+5} className="evo-system-meta">{kind.label.toUpperCase()}{external?" · SHARED FROM "+short(asset.project_label,12):""}</text>
              <text x={point.x-129} y={point.y+26} className="evo-graph-address">{short(urlText(asset)||asset.status.replaceAll("_"," "),39)}</text>
            </g>;
          })}
          {!visible.length&&<text x="550" y={height/2} className="evo-no-connections" textAnchor="middle">No mapped assets in this category</text>}
        </>}
      </svg>
    </div>
    <div className="evo-neural-legend evo-asset-type-legend" role="group" aria-label="Filter by actual asset type">
      <button type="button" className={assetFilter==="All"?"selected":""} aria-pressed={assetFilter==="All"} onClick={()=>onType("All")}>All systems</button>
      {ASSET_TYPES.map(type=><button type="button" key={type.id} className={assetFilter===type.id?"selected":""}
        aria-pressed={assetFilter===type.id} onClick={()=>onType(assetFilter===type.id?"All":type.id)}>
        <span className="evo-legend-dot" style={{background:type.color}}/>{type.label}
      </button>)}
    </div>
    <p className="evo-map-caption">Named connections are source-documented relationships, not a live uptime or access-permissions monitor. “Domains” here means actual website addresses.</p>
  </section>;
}

export function AssetInspector({entries,selectedAsset,selectedSkill,onSkill,onAsset,onClear}:{
 entries:SystemEntry[];selectedAsset:string|null;selectedSkill:string|null;
 onSkill:(id:string)=>void;onAsset:(id:string)=>void;onClear:()=>void;
}){
 const assets=uniqueAssets(entries),byId=new Map(assets.map(asset=>[asset.id,asset]));
 const asset=assets.find(row=>row.id===selectedAsset);
 const related=asset?entries.filter(row=>linkedAssets(row).some(a=>a.id===asset.id)):[];
 const selectedSkillRow=entries.find(row=>row.id===selectedSkill);
 const linked=selectedSkillRow?linkedAssets(selectedSkillRow):[];
 const connected=asset?[
   ...(asset.connections||[]).map(edge=>({asset:byId.get(edge.target),relation:edge.relation,direction:"→",evidence:edge.evidence})),
   ...assets.flatMap(other=>(other.connections||[]).filter(edge=>edge.target===asset.id).map(edge=>
     ({asset:other,relation:edge.relation,direction:"←",evidence:edge.evidence})))
 ].filter(x=>Boolean(x.asset)):[];
 const grouped=projectGroups(entries);
 return <aside className="evo-detail evo-asset-inspector" id="evo-asset-inspector" aria-live="polite">
   {asset?<>
     <div className="evo-detail-topline">
       <span className="evo-detail-kicker">NAMED SYSTEM</span>
       <span className="evo-asset-type" style={{color:assetType(asset.type).color}}>{assetType(asset.type).full}</span>
     </div>
     <p className="evo-asset-project-context">{asset.project_label}</p>
     <h3>{asset.label}</h3>
     <p className="evo-detail-intro">{asset.summary}</p>
     <div className="evo-asset-status">{asset.status==="verified"?"Source/resource confirmed · live state not implied":asset.status==="reference_only"?"Reference only · no connected access":"Documented · live state not checked"}</div>
     {asset.url&&<div className="evo-asset-real-url">
       <span>Actual destination</span>
       <a href={asset.url} target="_blank" rel="noopener noreferrer">{asset.url} <span aria-hidden="true">↗</span></a>
     </div>}
     <div className="evo-detail-rule"/>
     <h4 className="evo-asset-inspector-subtitle">Connected systems <span>{connected.length}</span></h4>
     <div className="evo-asset-skill-links">
       {connected.length?connected.map(({asset:other,relation:verb,direction,evidence},i)=>
         <button type="button" key={other!.id+"-"+i} onClick={()=>onAsset(other!.id)}>
           <strong>{direction+" "+other!.label}</strong>
           <small>{relation(verb)} · {other!.project_label} · {evidence}</small>
         </button>):<p className="evo-detail-note">No direct system-to-system connection has been documented for this asset yet.</p>}
     </div>
     <h4 className="evo-asset-inspector-subtitle">Skills tied to this system <span>{related.length}</span></h4>
     <div className="evo-asset-skill-links">
       {related.map(entry=>{
         const rel=linkedAssets(entry).find(item=>item.id===asset.id)?.relationship||"references";
         return <button type="button" key={entry.id} onClick={()=>onSkill(entry.id)}>
           <strong>{nameOf(entry)}</strong><small>{entry.branch} · {relation(rel)}</small>
         </button>;
       })}
     </div>
     <details className="evo-evidence"><summary>Source evidence and verification scope</summary>
       <p>Asset source: <code>{asset.evidence}</code></p>
       <p>Relationships are versioned evidence references, not proof of operational access, live dependency health, or permissions.</p>
     </details>
     <button type="button" className="evo-return-link" onClick={onClear}>← Back to system overview</button>
   </>:<>
     <div className="evo-detail-kicker">PROJECT SYSTEMS</div>
     <h3>{selectedSkillRow?nameOf(selectedSkillRow):"The systems behind EVO"}</h3>
     <p className="evo-detail-intro">Explore actual projects, then inspect a named repository, website, domain, database or application to see its direct connections.</p>
     <div className="evo-overview-metrics">
       <div><strong>{grouped.length}</strong><span>Projects</span></div>
       <div><strong>{assets.length}</strong><span>Named assets</span></div>
       <div><strong>{assets.reduce((n,a)=>n+(a.connections||[]).length,0)}</strong><span>Documented links</span></div>
     </div>
     <div className="evo-detail-rule"/>
     {selectedSkillRow?<>
       <div className="evo-detail-small-title">SKILL SYSTEM TAGS</div>
       <div className="evo-skill-asset-summary">{linked.map(item=>
         <button type="button" className="evo-asset-pill" key={item.id} onClick={()=>onAsset(item.id)}>
           <i style={{background:assetType(item.type).color}}/>{item.label}
         </button>)}</div>
     </>:<>
       <div className="evo-detail-small-title">HOW THIS MAP WORKS</div>
       <p className="evo-detail-note">Knowledge categories tell you what EVO can do. This view shows real project boundaries, URLs and source-backed system relationships. The two should not be confused.</p>
     </>}
   </>}
 </aside>;
}
export function AssetDirectory({entries,project,filter,query,selected,onSelect}:{
  entries:SystemEntry[];project:string;filter:string;query:string;selected:string|null;onSelect:(id:string)=>void;
}){
 const all=uniqueAssets(entries);
 const assets=all.filter(a=>(project==="All"||a.project===project)&&(filter==="All"||a.type===filter)&&
   (a.label+" "+a.url+" "+a.type+" "+a.project_label+" "+a.summary).toLowerCase().includes(query.trim().toLowerCase()));
 return <section className="evo-library-section evo-assets-library" aria-labelledby="evo-assets-heading">
   <div className="evo-library-heading">
     <div><span className="evo-eyebrow">REAL PROJECTS · REAL ASSETS</span>
       <h2 id="evo-assets-heading">{project==="All"?"Systems directory":(all.find(a=>a.project===project)?.project_label||"Project")+" assets"}</h2>
       <p>Actual destinations and documented relationships, organized without mixing project ownership or skill categories.</p></div>
     <span className="evo-results-count">{assets.length} named systems</span>
   </div>
   {assets.length?<div className="evo-asset-grid">{assets.map(asset=>{
     const type=assetType(asset.type);
     return <button type="button" key={asset.id} className={"evo-asset-card"+(selected===asset.id?" active":"")}
       onClick={()=>onSelect(asset.id)} style={{"--domain-accent":type.color} as CSSProperties}>
       <div className="evo-asset-card-top"><span className="evo-asset-pill"><i style={{background:type.color}}/>{type.label}</span>
         <span className="evo-asset-card-status">{asset.status==="reference_only"?"Reference only":asset.status==="verified"?"Source confirmed":"Documented"}</span></div>
       <strong>{asset.label}</strong>
       <p>{asset.summary}</p>
       {asset.url&&<span className="evo-asset-directory-url">{urlText(asset)}</span>}
       <div className="evo-asset-card-bottom"><span>{asset.project_label} · {linkCount(entries,asset.id)} skills</span>
         <span aria-hidden="true">↗</span></div>
     </button>;
   })}</div>:<div className="evo-empty"><strong>No named systems match</strong><p>Try a different project, asset type or search.</p></div>}
 </section>;
}
