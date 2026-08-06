"use client";

import { useEffect, useState } from "react";
import type { ProjectCoverageCardMetric, ProjectCoveragePosition } from "@/lib/compass/project-coverage";
import { ProjectCoverageCard } from "./project-coverage-card";

interface Props {
  cards: ProjectCoverageCardMetric[];
  dataReady: boolean;
  onViewClients: (position: ProjectCoveragePosition) => void;
}

export function ProjectCoverageDashboard({ cards, dataReady, onViewClients }: Props) {
  const [flippedCard, setFlippedCard] = useState<ProjectCoveragePosition | null>(null);

  useEffect(() => {
    if (!flippedCard || cards.some((card) => card.id === flippedCard)) return;
    setFlippedCard(null);
  }, [cards, flippedCard]);

  return (
    <section className={`project-coverage-dashboard${dataReady ? "" : " is-awaiting-data"}`} aria-label="Project opportunity cards — Client Project Coverage">
      {cards.map((metric) => <ProjectCoverageCard
        key={metric.id}
        metric={metric}
        flipped={flippedCard === metric.id}
        dataReady={dataReady}
        onFlip={() => setFlippedCard((current) => current === metric.id ? null : metric.id)}
        onViewClients={() => onViewClients(metric.id)}
      />)}
    </section>
  );
}
