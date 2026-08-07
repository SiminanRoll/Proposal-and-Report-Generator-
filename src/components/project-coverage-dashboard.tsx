"use client";

import { useEffect, useState } from "react";
import type { ProjectCoverageCardMetric, ProjectCoveragePosition } from "@/lib/compass/project-coverage";
import { ProjectCoverageCard } from "./project-coverage-card";

interface Props {
  cards: ProjectCoverageCardMetric[];
  dataReady: boolean;
  selectedPosition: ProjectCoveragePosition;
  onSelect: (position: ProjectCoveragePosition, scrollToList?: boolean) => void;
}

export function ProjectCoverageDashboard({ cards, dataReady, selectedPosition, onSelect }: Props) {
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
        selected={selectedPosition === metric.id}
        dataReady={dataReady}
        onFlip={() => setFlippedCard((current) => current === metric.id ? null : metric.id)}
        onSelect={() => onSelect(metric.id, true)}
      />)}
    </section>
  );
}
