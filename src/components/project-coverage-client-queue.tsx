"use client";

import type { MouseEvent } from "react";
import type { ProjectCoverageCardMetric } from "@/lib/compass/project-coverage";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

interface Props {
  card: ProjectCoverageCardMetric;
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
}

export function ProjectCoverageClientQueue({ card, onClose, onOpenClient }: Props) {
  return (
    <div className="compass-workspace-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="project-coverage-queue" role="dialog" aria-modal="true" aria-labelledby="project-coverage-queue-title" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <header className="project-coverage-queue-header">
          <div><span className="compass-kicker">Client project coverage</span><h2 id="project-coverage-queue-title">{card.title}</h2><p>{card.explanation}</p></div>
          <button className="compass-drawer-close" type="button" onClick={onClose} aria-label="Close coverage client list">×</button>
        </header>
        <div className="project-coverage-queue-summary"><strong>{card.count} client{card.count === 1 ? "" : "s"}</strong><span>{formatMoney(card.estimatedValue)} {card.valueLabel}</span></div>
        <div className="project-coverage-queue-list">
          {card.clients.map((client) => <article key={client.clientId}>
            <div><strong>{client.clientName}</strong><span>{client.projects.map((project) => project.title).join(" · ")}</span><small>{client.priorityReason}</small></div>
            <div><b>{formatMoney(client.estimatedValue)}</b><button className="button primary compact" type="button" onClick={() => onOpenClient(client.clientId)}>Open client</button></div>
          </article>)}
        </div>
      </section>
    </div>
  );
}
