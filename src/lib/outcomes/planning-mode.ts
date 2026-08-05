import type { Project } from "@/lib/projects/types";

export type PlanningRecommendationMode = "onsite-review" | "remote-consultation";

export function planningRecommendationMode(project: Project): PlanningRecommendationMode {
  return project.planningRecommendationMode === "remote-consultation" ? "remote-consultation" : "onsite-review";
}

export function isRemoteConsultation(project: Project): boolean {
  return planningRecommendationMode(project) === "remote-consultation";
}

export function planningModeLabel(project: Project): string {
  return isRemoteConsultation(project) ? "Remote consultation" : "Onsite review";
}

export function planningScheduledLabel(project: Project): string {
  return isRemoteConsultation(project) ? "Consultation call scheduled" : "Onsite planning scheduled";
}

export function planningAppointmentNoun(project: Project): string {
  return isRemoteConsultation(project) ? "consultation call" : "onsite planning review";
}
