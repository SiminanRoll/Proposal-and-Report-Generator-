"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric, ProjectCoverageClient } from "@/lib/compass/project-coverage";
import { ProjectCoverageFilters, projectCoverageFilterMatches, type ProjectCoverageReasonFilter } from "./project-coverage-filters";
import { AnimatedNumber } from "./animated-number";

const INITIAL_CLIENT_COUNT = 5;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CC";
}

function projectNeed(client: ProjectCoverageClient): string {
  return client.projects.map((project) => project.title).join(" + ");
}

function lastActivity(client: ProjectCoverageClient): { primary: string; flag: string } {
  if (client.position === "quoted-open") {
    return {
      primary: client.quoteDate ? `Quoted ${formatDate(client.quoteDate)}` : "Quote date missing",
      flag: client.reviewHistoryMissing ? "Review history missing" : "Outcome still open",
    };
  }
  if (client.position === "discussed-open") {
    return {
      primary: client.reviewDate ? `Reviewed ${formatDate(client.reviewDate)}` : "Discussion recorded",
      flag: client.followUpPastDue ? "Follow-up past due" : "Decision still open",
    };
  }
  return {
    primary: "No review or quote",
    flag: client.noRelationshipHistory ? "No relationship history" : "Coverage needed",
  };
}

function listDescription(position: ProjectCoverageCardId): string {
  if (position === "needs-review") return "Highest-priority qualified needs that have not yet been reviewed or quoted.";
  if (position === "discussed-open") return "Qualified needs already discussed with the client but still missing a completed decision.";
  if (position === "quoted-open") return "Qualified needs with a recorded quote and no completed or otherwise resolved outcome.";
  if (position === "highest-risk") return "The qualified client book ordered by critical server exposure and technical severity.";
  if (position === "oldest-quotes") return "Open quotes ordered from the oldest re-engagement need to the most recent.";
  return "Qualified clients ordered by deduplicated estimated project-package value.";
}

interface Props {
  card: ProjectCoverageCardMetric;
  onOpenClient: (clientId: string) => void;
}

export function ProjectCoverageClientList({ card, onOpenClient }: Props) {
  const [activeFilter, setActiveFilter] = useState<ProjectCoverageReasonFilter>("all");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setActiveFilter("all");
    setShowAll(false);
  }, [card.id]);

  useEffect(() => { setShowAll(false); }, [activeFilter]);

  const filteredClients = useMemo(
    () => card.clients.filter((client) => projectCoverageFilterMatches(client, activeFilter)),
    [activeFilter, card.clients],
  );
  const visibleClients = showAll ? filteredClients : filteredClients.slice(0, INITIAL_CLIENT_COUNT);
  const hiddenCount = Math.max(0, filteredClients.length - visibleClients.length);
  const motionKey = `${card.id}-${activeFilter}-${showAll ? "all" : "priority"}`;

  return (
    <section className={`project-coverage-client-list list-${card.id}`} aria-labelledby="project-coverage-client-list-title">
      <header className="project-coverage-client-list-header">
        <div>
          <span className="project-coverage-list-kicker">Selected coverage position</span>
          <h2 id="project-coverage-client-list-title">{card.title} <small>(<AnimatedNumber value={card.count} duration={520} delay={80} />)</small></h2>
          <p>{listDescription(card.id)}</p>
        </div>
        <div className="project-coverage-list-summary">
          <strong><AnimatedNumber value={card.estimatedValue} duration={760} delay={120} format={(value) => formatMoney(Math.round(value))} /></strong>
          <span>{card.valueLabel}</span>
        </div>
      </header>

      <ProjectCoverageFilters clients={card.clients} activeFilter={activeFilter} onChange={setActiveFilter} />

      {visibleClients.length ? <div key={motionKey} className="project-coverage-table-wrap project-coverage-list-motion">
        <table className="project-coverage-table">
          <thead>
            <tr><th>Client</th><th>Project need</th><th>Why they need attention</th><th>Last activity</th><th>Estimated value</th><th><span className="sr-only">Action</span></th></tr>
          </thead>
          <tbody>
            {visibleClients.map((client, index) => {
              const activity = lastActivity(client);
              return <tr key={client.clientId} style={{ "--row-motion-index": index } as CSSProperties}>
                <td data-label="Client"><div className="project-coverage-client-name"><span aria-hidden="true">{initials(client.clientName)}</span><strong>{client.clientName}</strong></div></td>
                <td data-label="Project need"><strong className="project-coverage-need">{projectNeed(client)}</strong></td>
                <td data-label="Why they need attention"><span className="project-coverage-attention">{client.attentionReason || client.priorityReason}</span></td>
                <td data-label="Last activity"><div className="project-coverage-activity"><strong>{activity.primary}</strong><small>{activity.flag}</small></div></td>
                <td data-label="Estimated value"><strong className="project-coverage-estimate">{formatMoney(client.estimatedValue)}</strong></td>
                <td data-label="Action"><button className="project-coverage-open-client" type="button" onClick={() => onOpenClient(client.clientId)}><span>Open client</span><span aria-hidden="true">→</span></button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <div key={motionKey} className="project-coverage-list-empty project-coverage-list-motion">
        <span className="project-coverage-empty-pulse" aria-hidden="true" />
        <strong>No clients match this reason filter.</strong>
        <span>The selected coverage position still contains {card.count} qualifying client{card.count === 1 ? "" : "s"}.</span>
        <button type="button" onClick={() => setActiveFilter("all")}>Show all project needs</button>
      </div>}

      {filteredClients.length > INITIAL_CLIENT_COUNT && <div className="project-coverage-view-all">
        <button type="button" onClick={() => setShowAll((current) => !current)}>
          {showAll ? "Show highest-priority clients" : `View all ${filteredClients.length} clients`}
          <span aria-hidden="true">{showAll ? "↑" : "→"}</span>
        </button>
        {!showAll && hiddenCount > 0 && <small>{hiddenCount} more client{hiddenCount === 1 ? "" : "s"} in this filtered list</small>}
      </div>}
    </section>
  );
}
