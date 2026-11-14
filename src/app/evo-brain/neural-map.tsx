"use client";

import type { KeyboardEvent } from "react";

export type EvoNode = {
  id: string;
  title: string;
  branch: string;
  stage: string;
  skill_path: string | null;
};

type Props = {
  entries: EvoNode[];
  selected: string | null;
  activeBranch: string;
  onSelect: (id: string) => void;
  onBranch: (branch: string) => void;
};

const DOMAINS = [
  { name: "EVO Core", short: "EVO CORE", color: "#83e6d0", x: 500, y: 134, angle: -90 },
  { name: "Advantage Technologies", short: "ADV-TECH", color: "#79bcff", x: 790, y: 230, angle: -8 },
  { name: "Application Development", short: "DEVELOPMENT", color: "#b49fff", x: 742, y: 451, angle: 50 },
  { name: "Personal & Family", short: "PERSONAL", color: "#eac67e", x: 257, y: 456, angle: 133 },
  { name: "Hammy & The Strawberry", short: "HAMMY", color: "#f0a3be", x: 213, y: 231, angle: 191 },
] as const;

type Position = { x: number; y: number; color: string };

function positions(entries: EvoNode[]): Map<string, Position> {
  const map = new Map<string, Position>();
  for (const domain of DOMAINS) {
    const skills = entries.filter((entry) => entry.branch === domain.name).sort((a, b) => a.title.localeCompare(b.title));
    const span = Math.min(106, Math.max(0, skills.length - 1) * 25);
    skills.forEach((skill, index) => {
      const angle = (domain.angle - span / 2 + (skills.length === 1 ? 0 : (span * index) / (skills.length - 1))) * Math.PI / 180;
      const radius = 93 + (index % 2) * 14;
      map.set(skill.id, {
        x: domain.x + Math.cos(angle) * radius,
        y: domain.y + Math.sin(angle) * radius,
        color: domain.color,
      });
    });
  }
  return map;
}

export function EvoNeuralMap({ entries, selected, activeBranch, onSelect, onBranch }: Props) {
  const mapped = positions(entries);
  const operate = (event: KeyboardEvent<SVGGElement>, activate: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  return (
    <section className="evo-neural-section" aria-labelledby="evo-neural-heading">
      <div className="evo-neural-heading">
        <div>
          <span className="evo-neural-eyebrow">01 / THE CONNECTED SYSTEM</span>
          <h2 id="evo-neural-heading">Your knowledge constellation</h2>
          <p>Five independent domains connected by reusable skills. Select a domain or a smaller skill node to explore.</p>
        </div>
        <button className="evo-neural-reset" type="button" onClick={() => onBranch("All")}>Show all domains</button>
      </div>
      <div className="evo-neural-scroll" role="region" aria-label="Scrollable, interactive EVO skill map" tabIndex={0}>
        <svg viewBox="0 0 1000 600" className="evo-neural-svg" role="group" aria-label="Skill constellation with five domains">
          <defs>
            <radialGradient id="evo-node-gradient">
              <stop offset="0%" stopColor="#283d6d" />
              <stop offset="100%" stopColor="#131d33" />
            </radialGradient>
          </defs>
          <circle cx={500} cy={310} r={220} fill="none" stroke="#344669" strokeDasharray="3 12" opacity=".7" />
          <circle cx={500} cy={310} r={145} fill="none" stroke="#344669" strokeDasharray="3 12" opacity=".58" />
          {DOMAINS.map((domain) => (
            <g key={"edge-" + domain.name} opacity={activeBranch === "All" || activeBranch === domain.name ? 0.65 : 0.12}>
              <path d={"M500 310 L" + domain.x + " " + domain.y} stroke={domain.color} strokeWidth="2" fill="none" opacity=".6" />
            </g>
          ))}
          {entries.map((entry) => {
            const p = mapped.get(entry.id);
            const domain = DOMAINS.find((item) => item.name === entry.branch);
            if (!p || !domain) return null;
            const active = selected === entry.id;
            return <path key={"link-" + entry.id} d={"M" + domain.x + " " + domain.y + " L" + p.x + " " + p.y} stroke={p.color} strokeWidth={active ? 2.6 : 1.4} opacity={activeBranch === "All" || activeBranch === entry.branch ? (active ? .95 : .48) : .08} fill="none" />;
          })}
          <circle cx={500} cy={310} r={69} fill="url(#evo-node-gradient)" stroke="#8999d3" strokeWidth="2.5" />
          <circle cx={500} cy={310} r={56} fill="none" stroke="#6479b3" strokeDasharray="2 7" opacity=".65" />
          <text x={500} y={307} textAnchor="middle" className="evo-neural-core-title">EVO</text>
          <text x={500} y={329} textAnchor="middle" className="evo-neural-core-caption">CONTEXT CORE</text>
          {DOMAINS.map((domain) => {
            const count = entries.filter((entry) => entry.branch === domain.name).length;
            const focused = activeBranch === "All" || activeBranch === domain.name;
            const toggle = () => onBranch(activeBranch === domain.name ? "All" : domain.name);
            return (
              <g
                key={domain.name}
                className="evo-neural-clickable"
                role="button"
                tabIndex={0}
                aria-label={domain.name + ", " + count + " capabilities"}
                onKeyDown={(event) => operate(event, toggle)}
                onClick={toggle}
                opacity={focused ? 1 : .25}
              >
                <title>{domain.name + " · " + count + " capabilities"}</title>
                <circle cx={domain.x} cy={domain.y} r={47} stroke={domain.color} strokeWidth={activeBranch === domain.name ? 3 : 2} fill="#1d2941" />
                <text x={domain.x} y={domain.y - 3} className="evo-neural-domain-name" textAnchor="middle">{domain.short}</text>
                <text x={domain.x} y={domain.y + 15} className="evo-neural-domain-count" textAnchor="middle">{count} SKILLS</text>
              </g>
            );
          })}
          {entries.map((entry) => {
            const p = mapped.get(entry.id);
            if (!p) return null;
            const active = selected === entry.id;
            return (
              <g
                key={entry.id}
                className="evo-neural-clickable"
                role="button"
                tabIndex={0}
                aria-label={"Inspect " + entry.title}
                onKeyDown={(event) => operate(event, () => onSelect(entry.id))}
                onClick={() => onSelect(entry.id)}
                opacity={activeBranch === "All" || activeBranch === entry.branch ? 1 : .2}
              >
                <title>{entry.title + " · " + (entry.skill_path ? "GitHub source registered" : "Proposed")}</title>
                <circle cx={p.x} cy={p.y} r={active ? 17 : 12.5} fill={active ? p.color : "#1c2a46"} stroke={active ? "#fff" : p.color} strokeWidth={active ? 3 : 2} strokeDasharray={entry.stage === "Proposed" ? "3 3" : undefined} />
                {entry.skill_path && <circle cx={p.x} cy={p.y} r={3} fill={active ? "#fff" : p.color} />}
                {active && <text x={p.x} y={p.y - 25} className="evo-neural-selected-title" textAnchor="middle">{entry.title.length > 21 ? entry.title.slice(0, 19) + "…" : entry.title}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="evo-neural-legend">
        {DOMAINS.map((domain) => (
          <button type="button" key={domain.name} className={activeBranch === domain.name ? "selected" : ""} onClick={() => onBranch(activeBranch === domain.name ? "All" : domain.name)}>
            <span style={{ background: domain.color }} />{domain.name}
          </button>
        ))}
      </div>
    </section>
  );
}
