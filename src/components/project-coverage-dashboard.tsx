"use client";

import { useEffect, useMemo, useState } from "react";
import { buildProjectCoverageSnapshot, type ProjectCoverageCardId, type ProjectCoverageCardMetric } from "@/lib/compass/project-coverage";
import { useCompassState } from "@/lib/compass/store";
import { applyCoverageCardCriteria, loadCoverageCardCriteria } from "@/lib/compass/coverage-card-criteria";
import { ProjectCoverageCard } from "./project-coverage-card";
import { ProjectCoverageCardCriteriaDialog } from "./project-coverage-card-criteria-dialog";

interface Props {
  cards: ProjectCoverageCardMetric[];
  dataReady: boolean;
  selectedCardId: ProjectCoverageCardId;
  selectedStatId?: string | null;
  onSelect: (cardId: ProjectCoverageCardId, scrollToList?: boolean) => void;
  onSelectStat?: (cardId: ProjectCoverageCardId, statId: string) => void;
}

export function ProjectCoverageDashboard({ cards, dataReady, selectedCardId, selectedStatId = null, onSelect, onSelectStat }: Props) {
  const { dataset, config } = useCompassState();
  const [flippedCard, setFlippedCard] = useState<ProjectCoverageCardId | null>(null);
  const [editingCardId, setEditingCardId] = useState<ProjectCoverageCardId | null>(null);
  const [criteriaRevision, setCriteriaRevision] = useState(0);
  const criteriaMap = useMemo(() => loadCoverageCardCriteria(), [cards, criteriaRevision]);
  const qualifiedClients = useMemo(() => buildProjectCoverageSnapshot(dataset, config).clients, [config, dataset]);

  // The same card objects are also consumed by the client list immediately below
  // this dashboard. Keep them synchronized so a saved card definition updates the
  // count, back-side stats, and visible client list as one operation.
  const displayCards = useMemo(() => cards.map((card) => {
    const refined = applyCoverageCardCriteria(card, dataset, criteriaMap, qualifiedClients);
    Object.assign(card, refined);
    return card;
  }), [cards, criteriaMap, dataset, qualifiedClients]);

  const editingCard = editingCardId ? displayCards.find((card) => card.id === editingCardId) ?? null : null;

  useEffect(() => {
    if (!flippedCard || displayCards.some((card) => card.id === flippedCard)) return;
    setFlippedCard(null);
  }, [displayCards, flippedCard]);

  return (
    <>
      <section className={`project-coverage-dashboard${dataReady ? "" : " is-awaiting-data"}`} aria-label="Project opportunity cards — Project Coverage">
        {displayCards.map((metric, index) => <ProjectCoverageCard
          key={metric.id}
          metric={metric}
          flipped={flippedCard === metric.id}
          selected={selectedCardId === metric.id}
          selectedStatId={selectedCardId === metric.id ? selectedStatId : null}
          dataReady={dataReady}
          motionIndex={index}
          criteriaCustomized={Boolean(criteriaMap[metric.id])}
          onEditCriteria={() => setEditingCardId(metric.id)}
          onFlip={() => setFlippedCard((current) => current === metric.id ? null : metric.id)}
          onSelect={() => onSelect(metric.id, true)}
          onSelectStat={(statId) => onSelectStat?.(metric.id, statId)}
        />)}
      </section>
      <ProjectCoverageCardCriteriaDialog
        open={Boolean(editingCard)}
        card={editingCard}
        dataset={dataset}
        qualifiedClientIds={qualifiedClients.map((client) => client.clientId)}
        onClose={() => setEditingCardId(null)}
        onSaved={() => { setCriteriaRevision((current) => current + 1); setEditingCardId(null); }}
      />
    </>
  );
}
