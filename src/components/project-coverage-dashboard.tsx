"use client";

import { useEffect, useState } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric } from "@/lib/compass/project-coverage";
import { ProjectCoverageCard } from "./project-coverage-card";

interface Props {
  cards: ProjectCoverageCardMetric[];
  dataReady: boolean;
  selectedCardId: ProjectCoverageCardId;
  selectedStatId?: string | null;
  onSelect: (cardId: ProjectCoverageCardId, scrollToList?: boolean) => void;
  onSelectStat?: (cardId: ProjectCoverageCardId, statId: string) => void;
}

export function ProjectCoverageDashboard({ cards, dataReady, selectedCardId, selectedStatId = null, onSelect, onSelectStat }: Props) {
  const [flippedCard, setFlippedCard] = useState<ProjectCoverageCardId | null>(null);

  useEffect(() => {
    if (!flippedCard || cards.some((card) => card.id === flippedCard)) return;
    setFlippedCard(null);
  }, [cards, flippedCard]);

  return (
    <section className={`project-coverage-dashboard${dataReady ? "" : " is-awaiting-data"}`} aria-label="Project opportunity cards — Project Coverage">
      {cards.map((metric, index) => <ProjectCoverageCard
        key={metric.id}
        metric={metric}
        flipped={flippedCard === metric.id}
        selected={selectedCardId === metric.id}
        selectedStatId={selectedCardId === metric.id ? selectedStatId : null}
        dataReady={dataReady}
        motionIndex={index}
        onFlip={() => setFlippedCard((current) => current === metric.id ? null : metric.id)}
        onSelect={() => onSelect(metric.id, true)}
        onSelectStat={(statId) => onSelectStat?.(metric.id, statId)}
      />)}
    </section>
  );
}
