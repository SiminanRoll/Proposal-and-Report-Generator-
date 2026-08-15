"use client";

import { useEffect } from "react";

const MOTION_CARD_SELECTOR = [
  ".prospect-story-card",
  ".prospect-choice-grid button",
  ".prospect-input-cards article",
  ".prospect-software-grid label",
  ".prospect-summary article",
  ".prospect-ota-grid article",
  ".health-score-card",
  ".aging-systems-card",
  ".security-funnel-step",
  ".security-feature-grid article",
  ".lifecycle-metric-grid article",
  ".environment-count-strip article",
  ".proposal-capability-grid article",
  ".proposal-assessment-metrics article",
  ".proposal-assessment-detail-grid article",
  ".presentation-finding",
  ".presentation-project-package-grid article",
  ".action-plan-grid article",
  ".recap-score-grid article",
  ".recap-roadmap article",
].join(",");

export function PresentationMotionRuntime() {
  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest<HTMLElement>(MOTION_CARD_SELECTOR);
      if (!card || !card.closest(".presentation-overlay")) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--presentation-pointer-x", `${event.clientX - bounds.left}px`);
      card.style.setProperty("--presentation-pointer-y", `${event.clientY - bounds.top}px`);
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, []);

  return null;
}
