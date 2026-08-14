"use client";

import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, SVGProps } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric } from "@/lib/compass/project-coverage";
import { AnimatedNumber } from "./animated-number";

function CoverageIcon({ type, ...props }: SVGProps<SVGSVGElement> & { type: ProjectCoverageCardId }) {
  if (type === "needs-review" || type === "highest-risk") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>;
  if (type === "discussed-open" || type === "oldest-quotes") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5M9.5 15.5c.7.7 1.5 1 2.5 1 1.4 0 2.5-.7 2.5-1.8 0-2.7-5-1.1-5-3.8 0-1.1 1-1.9 2.5-1.9 1 0 1.8.3 2.4.9M12 8v10"/></svg>;
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

interface Props {
  metric: ProjectCoverageCardMetric;
  flipped: boolean;
  selected: boolean;
  onFlip: () => void;
  onSelect: () => void;
  selectedStatId?: string | null;
  onSelectStat?: (statId: string) => void;
  onEditCriteria?: () => void;
  criteriaCustomized?: boolean;
  dataReady: boolean;
  motionIndex?: number;
}

export function ProjectCoverageCard({ metric, flipped, selected, onFlip, onSelect, selectedStatId = null, onSelectStat, onEditCriteria, criteriaCustomized = false, dataReady, motionIndex = 0 }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const tone = metric.id === "highest-risk" ? "needs-review" : metric.id === "oldest-quotes" ? "discussed-open" : metric.id === "largest-need" ? "quoted-open" : metric.id;

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const normalizedX = x / rect.width - 0.5;
    const normalizedY = y / rect.height - 0.5;
    card.style.setProperty("--motion-x", `${x}px`);
    card.style.setProperty("--motion-y", `${y}px`);
    card.style.setProperty("--tilt-x", `${(-normalizedY * 3.2).toFixed(2)}deg`);
    card.style.setProperty("--tilt-y", `${(normalizedX * 4).toFixed(2)}deg`);
  };

  const resetPointerMotion = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <article
      ref={cardRef}
      className={`project-coverage-card coverage-${tone}${flipped ? " is-flipped" : ""}${selected ? " is-selected" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerMotion}
      style={{ "--card-motion-index": motionIndex } as CSSProperties}
    >
      <div className="project-coverage-card-inner">
        <div className="project-coverage-card-face project-coverage-card-front" aria-hidden={flipped}>
          <div className="project-coverage-card-sheen" aria-hidden="true" />
          <div className="project-coverage-heading">
            <span className="project-coverage-icon"><CoverageIcon type={metric.id} /></span>
            <div>
              <span className="project-coverage-eyebrow">{metric.id === "highest-risk" || metric.id === "oldest-quotes" || metric.id === "largest-need" ? "Priority lens" : "Client project coverage"}</span>
              <h2>{metric.title}</h2>
            </div>
            {(metric.id === "needs-review" || metric.id === "highest-risk") && metric.count > 0 && <span className="project-coverage-priority-badge">Highest priority</span>}
          </div>
          <div className="project-coverage-count"><strong><AnimatedNumber value={metric.count} duration={680} delay={100 + motionIndex * 90} /></strong><span>client{metric.count === 1 ? "" : "s"}</span></div>
          <div className="project-coverage-value"><strong><AnimatedNumber value={metric.estimatedValue} duration={820} delay={180 + motionIndex * 90} format={(value) => formatMoney(Math.round(value))} /></strong><span>{metric.valueLabel}</span></div>
          <p>{metric.explanation}</p>
          <div className="project-coverage-front-actions">
            <button className="project-coverage-select" type="button" disabled={!dataReady || !metric.clients.length} onClick={onSelect} tabIndex={flipped ? -1 : 0} aria-pressed={selected}>
              <span>{selected ? "Clients shown below" : "Show clients"}</span><span aria-hidden="true">↓</span>
            </button>
            <button className="project-coverage-flip" type="button" onClick={onFlip} tabIndex={flipped ? -1 : 0} aria-label={`Flip ${metric.title} for details`} aria-pressed={flipped}>
              <span>Flip for details</span><span aria-hidden="true">↻</span>
            </button>
          </div>
        </div>

        <div className="project-coverage-card-face project-coverage-card-back" aria-hidden={!flipped}>
          <div className="project-coverage-card-sheen" aria-hidden="true" />
          <div className="project-coverage-heading">
            <span className="project-coverage-icon"><CoverageIcon type={metric.id} /></span>
            <div><span className="project-coverage-eyebrow">Coverage details</span><h2>{metric.title}</h2></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", margin: "-3px 0 2px" }}>
            <button
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={onEditCriteria}
              disabled={!dataReady || !onEditCriteria}
              aria-label={`Edit criteria for ${metric.title}`}
              style={{ border: "1px solid rgba(39,94,150,.18)", borderRadius: 999, background: criteriaCustomized ? "rgba(31,112,219,.1)" : "rgba(255,255,255,.72)", color: criteriaCustomized ? "#1766c7" : "#667b91", padding: "5px 9px", fontSize: 9, fontWeight: 800, cursor: dataReady ? "pointer" : "default" }}
            >✎ Edit criteria{criteriaCustomized ? " · Custom" : ""}</button>
          </div>
          <div className="project-coverage-stat-grid">
            {metric.stats.map((stat, index) => <button
              key={stat.id}
              type="button"
              className={`project-coverage-stat${selectedStatId === stat.id ? " is-active" : ""}`}
              style={{ "--stat-motion-index": index } as CSSProperties}
              disabled={!dataReady || !stat.clientIds.length}
              aria-pressed={selectedStatId === stat.id}
              aria-label={`${stat.label}: ${stat.value}. ${selectedStatId === stat.id ? "Showing this client segment below" : "Show this client segment below"}`}
              onClick={() => onSelectStat?.(stat.id)}
            ><strong>{typeof stat.value === "number" ? <AnimatedNumber value={stat.value} duration={560} delay={160 + index * 80} /> : stat.value}</strong><span>{stat.label}</span>{selectedStatId === stat.id && <em aria-hidden="true">✓ Filtering below</em>}</button>)}
          </div>
          <div className="project-coverage-spotlight"><span>Priority signal</span><strong>{metric.spotlight}</strong></div>
          <div className="project-coverage-card-actions">
            <button className="project-coverage-view" type="button" disabled={!dataReady || !metric.clients.length} tabIndex={flipped ? 0 : -1} onClick={onSelect}>{selected ? "Clients shown below" : "View clients"}</button>
            <button className="project-coverage-flip-back" type="button" tabIndex={flipped ? 0 : -1} onClick={onFlip}>Back to summary</button>
          </div>
        </div>
      </div>
    </article>
  );
}
