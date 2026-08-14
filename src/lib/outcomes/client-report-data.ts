import type { Project } from "@/lib/projects/types";
import { compassProjectPackages as coreCompassProjectPackages } from "./client-report-data-core";

export * from "./client-report-data-core";

/**
 * Project packages are an internal planning/estimation representation. Once a
 * client review has tailored decisions or an agreed next step, client-facing
 * report and presentation surfaces must use those saved decisions instead of
 * inferred package drivers, device counts, and generic ownership defaults.
 */
export function compassProjectPackages(project: Project): ReturnType<typeof coreCompassProjectPackages> {
  const outcome = project.reviewOutcome;
  const hasTailoredPlan = Boolean(
    outcome
      && outcome.status !== "not-reviewed"
      && (outcome.agreedNextStep.trim() || outcome.items.some((item) => item.includeInReport && (item.title.trim() || item.clientFacingNote.trim()))),
  );
  return hasTailoredPlan ? [] : coreCompassProjectPackages(project);
}
