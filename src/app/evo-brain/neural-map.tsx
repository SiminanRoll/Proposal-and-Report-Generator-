"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { EVO_DOMAINS, domainInfo } from "./domain-info";

export type EvoNode = {
  id: string;
  title: string;
  branch: string;
  stage: string;
  skill_path: string | null;
  knowledge_profile?: { label: string; related?: string[] } | null;
};

type Props = {
  entries: EvoNode[];
  selected: string | null;
  activeBranch: string;
  onSelect: (id: string) => void;
  onBranch: (branch: string) => void;
};

const OVERVIEW_SPOTS = [
  { name: "Advantage Technologies", x: 158, y: 135 },
  { name: "EVO Core", x: 490, y: 116 },
  { name: "Application Development", x: 822, y: 135 },
  { name: "Hammy & The Strawberry", x: 158, y: 448 },
  { name: "Brittany Myra", x: 490, y: 470 },
  { name: "Personal & Family", x: 822, y: 448 },
];

type Point = { x: number; y: number; node: EvoNode };

function readableTitle(value: string): string[] {
  const words = value.trim().split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const index = lines.length - 1;
    const next = (lines[index] + " " + word).trim();
    if (next.length <= 19 || !lines[index]) lines[index] = next;
    else if (lines.length === 1) lines.push(word);
    else lines[1] += " " + word;
  }
  return lines.slice(0, 2).map(line => line.length > 24 ? line.slice(0, 22) + "…" : line);
}

function skillPositions(entries: EvoNode[]): Point[] {
  const skills = [...entries].sort((a, b) =>
    (a.knowledge_profile?.label || a.title).localeCompare(b.knowledge_profile?.label || b.title));
  const count = skills.length;
  if (!count) return [];
  const columns = count <= 4 ? Math.min(2, count) : count <= 8 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const xs = columns === 1 ? [655] : columns === 2 ? [488, 782] : [397, 615, 833];
  const gap = rows === 1 ? 0 : Math.min(117, 435 / (rows - 1));
  const firstY = 293 - (rows - 1) * gap / 2;
  return skills.map((node, i) => ({
    node, x: xs[i % columns], y: firstY + Math.floor(i / columns) * gap,
  }));
}

/** Node positions for reviewed outgoing related-skill IDs, including other domains. */
function relationshipPositions(items: EvoNode[]): Point[] {
  const count = items.length;
  if (!count) return [];
  const columns = count > 4 ? 2 : 1;
  const rows = Math.ceil(count / columns);
  const xs = columns === 1 ? [713] : [620, 832];
  const gap = rows < 2 ? 0 : Math.min(115, 390 / (rows - 1));
  const top = 293 - (rows - 1) * gap / 2;
  return items.slice(0, 8).map((node, index) => ({
    node, x: xs[index % columns], y: top + Math.floor(index / columns) * gap,
  }));
}

function useActivate() {
  return (event: KeyboardEvent<SVGGElement>, fn: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fn();
    }
  };
}

/** Two actual navigation levels: domains, then distinct readable skills. No invented dependency edges. */
export function EvoNeuralMap({ entries, selected, activeBranch, onSelect, onBranch }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<"skills" | "connections">("skills");
  const activate = useActivate();
  const focused = activeBranch !== "All";
  const domain = domainInfo(activeBranch);
  const visible = useMemo(() => entries.filter(item => item.branch === activeBranch), [entries, activeBranch]);
  const positioned = useMemo(() => skillPositions(visible), [visible]);
  const active = visible.find(item => item.id === selected);
  const related = new Set((active?.knowledge_profile?.related || []).map(id => "skills/" + id + "/SKILL.md"));
  const current = positioned.find(point => point.node.id === selected);
  const relatedItems = useMemo(() => {
    if (!active?.knowledge_profile?.related) return [];
    const targets = new Set(active.knowledge_profile.related.map(id => "skills/" + id + "/SKILL.md"));
    return entries.filter(node => node.id !== active.id && Boolean(node.skill_path) && targets.has(node.skill_path as string));
  }, [active, entries]);
  const linkedPositions = useMemo(() => relationshipPositions(relatedItems), [relatedItems]);
  useEffect(() => {
    if (window.matchMedia("(max-width: 580px)").matches) setZoom(2);
  }, []);
  useEffect(() => {
    if (!selected || activeBranch === "All") setMode("skills");
  }, [selected, activeBranch]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
  }, [activeBranch, zoom, mode]);
  const adjustZoom = (step: number) => setZoom(currentZoom =>
    Math.min(2.4, Math.max(.6, Math.round((currentZoom + step) * 100) / 100)));
  const fitMap = () => setZoom(1);

  return (
    <section className="evo-neural-section" aria-labelledby="evo-neural-heading">
      <div className="evo-neural-heading">
        <div className="evo-neural-heading-title">
          <h2 id="evo-neural-heading">{focused ? domain.name : "Explore domains"}</h2>
          <p>{focused ? domain.subtitle : "Select a domain to view its skills"}</p>
        </div>
        <div className="evo-map-actions">
          {focused && <button className="evo-outline-button" type="button" onClick={() => onBranch("All")}>← All domains</button>}
          {focused && selected && <div className="evo-map-modes" role="group" aria-label="Knowledge map view">
            <button type="button" aria-pressed={mode === "skills"} className={mode === "skills" ? "active" : ""} onClick={() => setMode("skills")}>Skills</button>
            <button type="button" aria-pressed={mode === "connections"} className={mode === "connections" ? "active" : ""} onClick={() => setMode("connections")}>Connections</button>
          </div>}
          <div className="evo-zoom-controls" role="group" aria-label="Map zoom">
            <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= .6} onClick={() => adjustZoom(-.2)}>−</button>
            <output aria-label="Map zoom level">{Math.round(zoom * 100)}%</output>
            <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 2.4} onClick={() => adjustZoom(.2)}>+</button>
            <button type="button" className="evo-fit-map" aria-label="Fit map" title="Fit map to available width" onClick={fitMap}>Fit</button>
          </div>
        </div>
      </div>
      <div className="evo-neural-mobile-hint">Pinch the page or use the zoom controls; drag sideways when enlarged.</div>
      <div ref={viewport} className="evo-neural-scroll" role="region" tabIndex={0} aria-label={focused ? domain.name + " knowledge map" : "Six-domain EVO knowledge map"}>
        <svg className="evo-neural-svg" viewBox="0 0 980 585" style={{ width: (zoom * 100) + "%", minWidth: 0, maxWidth: "none", marginInline: zoom <= 1 ? "auto" : 0 }} role="group" aria-label={focused ? (mode === "connections" ? "Curated related skills for " + (active?.knowledge_profile?.label || active?.title || domain.name) : "All skills in " + domain.name) : "Six EVO knowledge domains"}>
          <defs>
            <radialGradient id="evo-atlas-core" cx="35%" cy="25%" r="80%">
              <stop offset="0%" stopColor="#253e65" />
              <stop offset="100%" stopColor="#0e1b30" />
            </radialGradient>
            <filter id="evo-atlas-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="15" />
            </filter>
          </defs>
          {Array.from({ length: 11 }, (_, i) => (
            <line key={"v"+i} x1={i * 98} x2={i * 98} y1="0" y2="585" className="evo-atlas-grid" />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line key={"h"+i} x1="0" x2="980" y1={i * 97.5} y2={i * 97.5} className="evo-atlas-grid" />
          ))}
          {!focused ? <>
            {OVERVIEW_SPOTS.map((spot) => {
              const info = domainInfo(spot.name);
              return <path key={"edge-"+spot.name} d={"M490 293 Q490 " + spot.y + " " + spot.x + " " + spot.y} stroke={info.color} strokeOpacity=".3" strokeWidth="1.5" fill="none" />;
            })}
            <circle cx="490" cy="293" r="90" fill="#60b7ff" opacity=".08" filter="url(#evo-atlas-glow)" />
            <circle cx="490" cy="293" r="67" fill="url(#evo-atlas-core)" stroke="#6f99c8" strokeWidth="1.8" />
            <circle cx="490" cy="293" r="55" fill="none" stroke="#6683a9" strokeDasharray="2 9" opacity=".55" />
            <text x="490" y="290" textAnchor="middle" className="evo-core-word">EVO</text>
            <text x="490" y="313" textAnchor="middle" className="evo-core-sub">KNOWLEDGE CORE</text>
            {OVERVIEW_SPOTS.map((spot) => {
              const info = domainInfo(spot.name);
              const count = entries.filter(item => item.branch === spot.name).length;
              const pick = () => onBranch(spot.name);
              return <g key={spot.name} className="evo-neural-clickable evo-domain-node" role="button" tabIndex={0}
                aria-label={spot.name + ", " + count + " capabilities"}
                onClick={pick} onKeyDown={e => activate(e, pick)}>
                <title>{spot.name + " / " + count + " registered skills"}</title>
                <rect x={spot.x - 133} y={spot.y - 52} width="266" height="104" rx="19" fill="#111f35" stroke={info.color} strokeOpacity=".64" strokeWidth="1.5" />
                <rect x={spot.x - 118} y={spot.y - 30} width="4" height="60" rx="2" fill={info.color} />
                <text x={spot.x - 99} y={spot.y - 9} className="evo-domain-name">{info.name}</text>
                <text x={spot.x - 99} y={spot.y + 14} className="evo-domain-sub">{count + " CAPABILITIES"}</text>
                <text x={spot.x + 108} y={spot.y + 16} textAnchor="middle" className="evo-node-arrow">↗</text>
              </g>;
            })}
          </> : mode === "connections" && active ? <>
            <circle cx="252" cy="293" r="124" fill={domain.color} opacity=".07" filter="url(#evo-atlas-glow)" />
            <g aria-label={"Selected skill: " + (active.knowledge_profile?.label || active.title)}>
              <rect x="88" y="232" width="294" height="122" rx="22" fill={domain.soft} stroke={domain.color} strokeWidth="2.5" />
              <text x="109" y="261" className="evo-link-caption">SELECTED SKILL</text>
              {readableTitle(active.knowledge_profile?.label || active.title).map((line,i) => (
                <text key={i} x="109" y={292 + i*20} className="evo-connected-main-label">{line}</text>
              ))}
              <text x="109" y="341" className="evo-link-caption">{domain.short.toUpperCase()}</text>
            </g>
            {linkedPositions.map(point => {
              const info = domainInfo(point.node.branch);
              return <path key={"connection-"+point.node.id}
                d={"M382 293 Q470 293 " + (point.x-111) + " " + point.y}
                fill="none" stroke={info.color} strokeWidth="2" strokeDasharray="5 7" strokeOpacity=".75" />;
            })}
            {linkedPositions.map(point => {
              const info = domainInfo(point.node.branch);
              const label = point.node.knowledge_profile?.label || point.node.title;
              const pick = () => onSelect(point.node.id);
              return <g key={point.node.id} className="evo-neural-clickable evo-relation-node" role="button" tabIndex={0}
                  aria-label={"Inspect " + label} onClick={pick} onKeyDown={event => activate(event,pick)}>
                  <title>{label + " · " + point.node.branch + " · curated related skill"}</title>
                  <rect x={point.x-112} y={point.y-43} width="224" height="86" rx="16" fill={info.soft}
                    stroke={info.color} strokeWidth="1.7" strokeOpacity=".85" />
                  {readableTitle(label).map((line,i) => (
                    <text key={i} x={point.x-92} y={point.y-(i===0?12:-5)} className="evo-skill-name">{line}</text>
                  ))}
                  <text x={point.x-92} y={point.y+28} className="evo-skill-maturity">{info.short.toUpperCase()}</text>
                </g>;
            })}
            {linkedPositions.length===0 && <text x="710" y="295" className="evo-no-connections" textAnchor="middle">No curated related skills yet</text>}
          </> : <>
            <path d="M162 293 L965 293" stroke={domain.color} strokeOpacity=".08" strokeWidth="1" strokeDasharray="5 10" />
            {positioned.map((point) =>
              <path key={"edge-"+point.node.id}
                d={"M232 293 C295 293 " + (point.x - 110) + " " + point.y + " " + (point.x - 98) + " " + point.y}
                stroke={domain.color} strokeWidth="1.25" strokeOpacity={point.node.id===selected?".75":".22"} fill="none" />
            )}
            {current && positioned.filter(point => point.node.id !== current.node.id && related.has(point.node.skill_path || "")).map(point => (
              <path key={"relation-"+point.node.id}
                d={"M" + current.x + " " + current.y + " Q" + ((current.x+point.x)/2) + " " + (((current.y+point.y)/2)-42) + " " + point.x + " " + point.y}
                stroke="#e5d5ff" strokeWidth="2" strokeDasharray="5 6" strokeOpacity=".72" fill="none" />
            ))}
            <g className="evo-root-domain" role="button" tabIndex={0} aria-label={"Overview of " + domain.name}
              onClick={() => onBranch(activeBranch)} onKeyDown={e=>activate(e,()=>onBranch(activeBranch))}>
              <title>{"Show " + domain.name + " overview"}</title>
              <rect x="42" y="236" width="190" height="114" rx="24" fill={domain.soft} stroke={domain.color} strokeWidth="2" />
              <text x="137" y="274" textAnchor="middle" className="evo-root-symbol" fill={domain.color}>{domain.symbol}</text>
              {readableTitle(domain.short).map((line,i)=><text key={line+i} x="137" y={303+i*19} textAnchor="middle" className="evo-root-title">{line}</text>)}
              <text x="137" y="338" textAnchor="middle" className="evo-root-count">{visible.length + " SKILLS"}</text>
            </g>
            {positioned.map((point) => {
              const node = point.node;
              const label = node.knowledge_profile?.label || node.title;
              const isSelected = node.id === selected;
              const isRelated = related.has(node.skill_path || "");
              const pick = () => onSelect(node.id);
              const lines = readableTitle(label);
              return <g key={node.id} role="button" tabIndex={0}
                className={"evo-neural-clickable evo-skill-node" + (isSelected?" is-selected":"") + (isRelated?" is-related":"")}
                aria-label={"Inspect " + label} aria-pressed={isSelected}
                onClick={pick} onKeyDown={e=>activate(e,pick)}>
                <title>{label + " / " + node.stage}</title>
                {isSelected && <rect x={point.x-102} y={point.y-44} width="204" height="88" rx="18" fill={domain.color} opacity=".16" filter="url(#evo-atlas-glow)" />}
                <rect x={point.x-98} y={point.y-39} width="196" height="78" rx="15" fill={isSelected ? domain.soft : "#132039"} stroke={domain.color}
                  strokeOpacity={isSelected?1:isRelated?".78":".38"} strokeWidth={isSelected?2.4:1.2} />
                <rect x={point.x-82} y={point.y-22} width="6" height="6" rx="3" fill={domain.color} />
                {lines.map((line,i)=><text key={i} x={point.x-65} y={point.y-(lines.length===1?1:10)+i*17} className="evo-skill-name">{line}</text>)}
                <text x={point.x-65} y={point.y+24} className="evo-skill-maturity">{node.stage.toUpperCase()}</text>
              </g>;
            })}
          </>}
        </svg>
      </div>
      <div className="evo-neural-legend" role="group" aria-label="Knowledge domain navigation">
        <button type="button" className={activeBranch==="All"?"selected":""} aria-pressed={activeBranch==="All"} onClick={()=>onBranch("All")}>
          <span className="evo-legend-all">◎</span> All domains
        </button>
        {EVO_DOMAINS.map(info => {
          const count=entries.filter(item=>item.branch===info.name).length;
          return <button type="button" key={info.name} className={activeBranch===info.name?"selected":""}
            aria-pressed={activeBranch===info.name} onClick={()=>onBranch(info.name)}>
            <span className="evo-legend-dot" style={{background:info.color}} />{info.short}<small>{count}</small>
          </button>;
        })}
      </div>
      {focused && <div className="evo-map-caption"><span style={{background:domain.color}} /> {mode === "connections" && active ? "Related skill links come from reviewed catalog metadata, not live integrations or shared access." : "Select a skill to inspect it. Connections reveals reviewed relationships across domains."}</div>}
    </section>
  );
}
