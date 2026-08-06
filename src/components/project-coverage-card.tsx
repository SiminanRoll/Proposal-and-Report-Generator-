"use client";

import type { SVGProps } from "react";
import type { ProjectCoverageCardMetric, ProjectCoveragePosition } from "@/lib/compass/project-coverage";

function CoverageIcon({ type, ...props }: SVGProps<SVGSVGElement> & { type: ProjectCoveragePosition }) {
  if (type === "needs-review") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>;
  if (type === "discussed-open") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>;
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
  onFlip: () => void;
  onViewClients: () => void;
  dataReady: boolean;
}

export function ProjectCoverageCard({ metric, flipped, onFlip, onViewClients, dataReady }: Props) {
  return (
    <article className={`project-coverage-card coverage-${metric.id}${flipped ? " is-flipped" : ""}`}>
      <div className="project-coverage-card-inner">
        <div className="project-coverage-card-face project-coverage-card-front" aria-hidden={flipped}>
          <div className="project-coverage-heading">
            <span className="project-coverage-icon"><CoverageIcon type={metric.id} /></span>
            <div>
              <span className="project-coverage-eyebrow">Client project coverage</span>
              <h2>{metric.title}</h2>
            </div>
            {metric.id === "needs-review" && metric.count > 0 && <span className="project-coverage-priority-badge">Highest priority</span>}
          </div>
          <div className="project-coverage-count"><strong>{metric.count}</strong><span>client{metric.count === 1 ? "" : "s"}</span></div>
          <div className="project-coverage-value"><strong>{formatMoney(metric.estimatedValue)}</strong><span>{metric.valueLabel}</span></div>
          <p>{metric.explanation}</p>
          <button className="project-coverage-flip" type="button" onClick={onFlip} tabIndex={flipped ? -1 : 0} aria-label={`Flip ${metric.title} for details`} aria-pressed={flipped}>
            <span>Flip for details</span><span aria-hidden="true">↻</span>
          </button>
        </div>

        <div className="project-coverage-card-face project-coverage-card-back" aria-hidden={!flipped}>
          <div className="project-coverage-heading">
            <span className="project-coverage-icon"><CoverageIcon type={metric.id} /></span>
            <div><span className="project-coverage-eyebrow">Coverage details</span><h2>{metric.title}</h2></div>
          </div>
          <div className="project-coverage-stat-grid">
            {metric.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
          </div>
          <div className="project-coverage-spotlight"><span>Priority signal</span><strong>{metric.spotlight}</strong></div>
          <div className="project-coverage-card-actions">
            <button className="project-coverage-view" type="button" disabled={!dataReady || !metric.clients.length} tabIndex={flipped ? 0 : -1} onClick={onViewClients}>View clients</button>
            <button className="project-coverage-flip-back" type="button" tabIndex={flipped ? 0 : -1} onClick={onFlip}>Back to summary</button>
          </div>
        </div>
      </div>
    </article>
  );
}
