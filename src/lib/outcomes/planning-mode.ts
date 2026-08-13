import type { Project } from "@/lib/projects/types";

export type PlanningRecommendationMode = "onsite-review" | "remote-consultation" | "no-action-needed";

export function planningRecommendationMode(project: Project): PlanningRecommendationMode {
  return project.planningRecommendationMode === "remote-consultation" || project.planningRecommendationMode === "no-action-needed" ? project.planningRecommendationMode : "onsite-review";
}

export function isRemoteConsultation(project: Project): boolean {
  return planningRecommendationMode(project) === "remote-consultation";
}

export function isNoActionNeeded(project: Project): boolean {
  return planningRecommendationMode(project) === "no-action-needed";
}

export function planningModeLabel(project: Project): string {
  return isNoActionNeeded(project) ? "No action needed" : isRemoteConsultation(project) ? "Remote consultation" : "Onsite review";
}

export function planningScheduledLabel(project: Project): string {
  return isRemoteConsultation(project) ? "Consultation call scheduled" : "Onsite planning scheduled";
}

export function planningAppointmentNoun(project: Project): string {
  return isRemoteConsultation(project) ? "consultation call" : "onsite planning review";
}
