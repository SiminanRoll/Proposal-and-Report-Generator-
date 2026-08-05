"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SVGProps } from "react";

interface DemoClient {
  name: string;
  driver: string;
  estimate: string;
}

interface OpportunityCard {
  id: string;
  title: string;
  count: number;
  countLabel: string;
  value: string;
  valueLabel: string;
  description: string;
  accent: "blue" | "red" | "amber" | "cyan" | "violet" | "teal";
  icon: "compass" | "server" | "calendar" | "windows" | "workstation" | "storage";
  clients: DemoClient[];
}

const opportunityCards: OpportunityCard[] = [
  {
    id: "total-project-opportunity",
    title: "Clients Needing Projects",
    count: 58,
    countLabel: "clients with a current project opportunity",
    value: "$2.84M",
    valueLabel: "estimated opportunity represented",
    description: "A current snapshot of organizations with server, workstation, operating-system, or capacity needs.",
    accent: "blue",
    icon: "compass",
    clients: [
      { name: "Midstate Oral Surgery", driver: "Server planning and Windows 10 refresh", estimate: "$184K" },
      { name: "Franklin Family Dental", driver: "Aging workstations and OS support", estimate: "$92K" },
      { name: "Lakeside Pediatric Dentistry", driver: "Server replacement and storage expansion", estimate: "$146K" },
    ],
  },
  {
    id: "critical-server-projects",
    title: "Critical Server Projects",
    count: 11,
    countLabel: "clients needing immediate server attention",
    value: "$742K",
    valueLabel: "estimated immediate server value",
    description: "Unsupported server operating systems and physical servers substantially beyond expected lifecycle.",
    accent: "red",
    icon: "server",
    clients: [
      { name: "Northview Dental Partners", driver: "Windows Server 2012 R2", estimate: "$78K" },
      { name: "Oak Ridge Orthodontics", driver: "Unsupported physical server", estimate: "$64K" },
      { name: "Riverbend Oral Surgery", driver: "Two critical server workloads", estimate: "$118K" },
    ],
  },
  {
    id: "server-planning",
    title: "Server Planning",
    count: 18,
    countLabel: "clients approaching a server project",
    value: "$864K",
    valueLabel: "estimated planned server value",
    description: "Windows Server 2016 and aging server platforms that should enter the planning conversation now.",
    accent: "amber",
    icon: "calendar",
    clients: [
      { name: "Summit Dental Group", driver: "Windows Server 2016", estimate: "$58K" },
      { name: "Bright Smiles Pediatric", driver: "Server lifecycle planning", estimate: "$46K" },
      { name: "Capital City Endodontics", driver: "Host refresh planning", estimate: "$72K" },
    ],
  },
  {
    id: "windows-10-refresh",
    title: "Windows 10 Refresh",
    count: 34,
    countLabel: "clients with Windows 10 exposure",
    value: "$612K",
    valueLabel: "estimated refresh value",
    description: "Organizations with unsupported Windows 10 workstations that need replacement or modernization.",
    accent: "cyan",
    icon: "windows",
    clients: [
      { name: "Evergreen Family Dentistry", driver: "14 Windows 10 workstations", estimate: "$84K" },
      { name: "Park Avenue Dental", driver: "9 Windows 10 workstations", estimate: "$54K" },
      { name: "Westbrook Dental Arts", driver: "7 Windows 10 workstations", estimate: "$42K" },
    ],
  },
  {
    id: "workstation-lifecycle",
    title: "Workstation Lifecycle",
    count: 29,
    countLabel: "clients with replacement-ready workstations",
    value: "$478K",
    valueLabel: "estimated workstation value",
    description: "Replace Now and Plan Soon devices grouped into practical workstation modernization opportunities.",
    accent: "violet",
    icon: "workstation",
    clients: [
      { name: "Maple Grove Dental", driver: "12 Replace Now devices", estimate: "$72K" },
      { name: "Coastal Periodontics", driver: "8 aging clinical workstations", estimate: "$48K" },
      { name: "Central Wisconsin Dental", driver: "Mixed Replace Now and Plan Soon fleet", estimate: "$66K" },
    ],
  },
  {
    id: "storage-attention",
    title: "Storage Attention",
    count: 9,
    countLabel: "clients with critical capacity concerns",
    value: "$96K",
    valueLabel: "estimated remediation value",
    description: "Critical system drives, server volumes, and capacity constraints that merit a focused project conversation.",
    accent: "teal",
    icon: "storage",
    clients: [
      { name: "Eastside Dental Care", driver: "Server volume at 94%", estimate: "$18K" },
      { name: "Heritage Dental Center", driver: "Three critical workstation drives", estimate: "$9K" },
      { name: "Pinecrest Oral Health", driver: "Server storage expansion", estimate: "$24K" },
    ],
  },
];

function OpportunityIcon({ type, ...props }: SVGProps<SVGSVGElement> & { type: OpportunityCard["icon"] }) {
  if (type === "server") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5"/></svg>;
  }
  if (type === "calendar") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-5"/></svg>;
  }
  if (type === "windows") {
    return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M3 4.7 10.6 3.6v7.7H3V4.7Zm8.7-1.3L21 2v9.3h-9.3V3.4ZM3 12.4h7.6v7.7L3 19v-6.6Zm8.7 0H21v9.4l-9.3-1.4v-8Z"/></svg>;
  }
  if (type === "workstation") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/></svg>;
  }
  if (type === "storage") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
}

export function CompassHome() {
  const [flippedCards, setFlippedCards] = useState<Set<string>>(() => new Set());
  const [activeCard, setActiveCard] = useState<OpportunityCard | null>(null);

  useEffect(() => {
    if (!activeCard) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveCard(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCard]);

  const toggleCard = (id: string) => {
    setFlippedCards((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="compass-home">
      <section className="compass-intro" aria-labelledby="compass-title">
        <div>
          <span className="compass-kicker">Current project opportunity snapshot</span>
          <h1 id="compass-title">Advantage Compass</h1>
          <p>See where client needs are concentrated, how much estimated opportunity they represent, and where the next planning conversation should begin.</p>
        </div>
        <div className="compass-intro-actions">
          <span className="compass-preview-badge">Phase 1 · Preview data</span>
          <Link className="button primary" href="/generator/">Open report &amp; proposal generator</Link>
        </div>
      </section>

      <section className="compass-board" aria-label="Project opportunity cards">
        {opportunityCards.map((card) => {
          const isFlipped = flippedCards.has(card.id);
          return (
            <article key={card.id} className={`compass-opportunity-card accent-${card.accent}${isFlipped ? " is-flipped" : ""}`}>
              <div className="compass-card-inner">
                <button
                  className="compass-card-face compass-card-front"
                  type="button"
                  onClick={() => toggleCard(card.id)}
                  aria-label={`Show estimated value for ${card.title}`}
                  aria-pressed={isFlipped}
                  tabIndex={isFlipped ? -1 : 0}
                >
                  <span className="compass-card-topline">
                    <span className="compass-card-icon"><OpportunityIcon type={card.icon} /></span>
                    <span className="compass-card-snapshot">Current snapshot</span>
                  </span>
                  <span className="compass-card-title">{card.title}</span>
                  <span className="compass-card-metric">{card.count}</span>
                  <span className="compass-card-label">{card.countLabel}</span>
                  <span className="compass-card-description">{card.description}</span>
                  <span className="compass-card-flip-prompt">Flip for estimated value <span aria-hidden="true">↗</span></span>
                </button>

                <div className="compass-card-face compass-card-back" aria-hidden={!isFlipped}>
                  <span className="compass-card-topline">
                    <span className="compass-card-icon"><OpportunityIcon type={card.icon} /></span>
                    <span className="compass-card-snapshot">Planning estimate</span>
                  </span>
                  <span className="compass-card-title">{card.title}</span>
                  <span className="compass-card-value">{card.value}</span>
                  <span className="compass-card-label">{card.valueLabel}</span>
                  <span className="compass-card-estimate-note">Internal opportunity estimate · not a client quote</span>
                  <div className="compass-card-actions">
                    <button className="compass-view-clients" type="button" tabIndex={isFlipped ? 0 : -1} onClick={() => setActiveCard(card)}>View clients</button>
                    <button className="compass-flip-back" type="button" tabIndex={isFlipped ? 0 : -1} onClick={() => toggleCard(card.id)}>Back to count</button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="compass-footnote">
        <span>Snapshot values are illustrative in Phase 1.</span>
        <span>Live counts, scoring, and imports arrive in Phase 2.</span>
      </footer>

      {activeCard && (
        <div className="compass-drawer-backdrop" role="presentation" onMouseDown={() => setActiveCard(null)}>
          <aside className="compass-client-drawer" role="dialog" aria-modal="true" aria-labelledby="compass-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="compass-drawer-header">
              <div>
                <span className="compass-kicker">Preview client queue</span>
                <h2 id="compass-drawer-title">{activeCard.title}</h2>
              </div>
              <button className="compass-drawer-close" type="button" onClick={() => setActiveCard(null)} aria-label="Close client queue">×</button>
            </div>
            <div className="compass-drawer-summary">
              <div><strong>{activeCard.count}</strong><span>clients</span></div>
              <div><strong>{activeCard.value}</strong><span>estimated value</span></div>
            </div>
            <div className="compass-demo-notice">Representative preview clients are shown until live Compass imports are introduced in Phase 2.</div>
            <div className="compass-client-list">
              {activeCard.clients.map((client) => (
                <div className="compass-client-row" key={client.name}>
                  <div><strong>{client.name}</strong><span>{client.driver}</span></div>
                  <b>{client.estimate}</b>
                </div>
              ))}
            </div>
            <div className="compass-drawer-actions">
              <Link className="button primary" href="/generator/">Open generator</Link>
              <button className="button secondary" type="button" onClick={() => setActiveCard(null)}>Close</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
