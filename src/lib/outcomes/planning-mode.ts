import type { Project } from "@/lib/projects/types";

export type PlanningRecommendationMode = "onsite-review" | "remote-consultation" | "hourly-onsite-service" | "no-action-needed";

export const HOURLY_ONSITE_SERVICE_RATE = 125;
export const HOURLY_ONSITE_SERVICE_NEXT_STEP = `An Advantage Technologies technician will need to come onsite to complete the work discussed. Onsite service is billed at $${HOURLY_ONSITE_SERVICE_RATE} per hour. Our team will reach out to coordinate and confirm the date and time. Please expect a follow-up from us with the scheduling details.`;

export function planningRecommendationMode(project: Project): PlanningRecommendationMode {
  const mode = project.planningRecommendationMode;
  if (mode === "remote-consultation" || mode === "hourly-onsite-service" || mode === "no-action-needed") return mode;
  return "onsite-review";
}

export function isRemoteConsultation(project: Project): boolean {
  return planningRecommendationMode(project) === "remote-consultation";
}

export function isHourlyOnsiteService(project: Project): boolean {
  return planningRecommendationMode(project) === "hourly-onsite-service";
}

export function isNoActionNeeded(project: Project): boolean {
  return planningRecommendationMode(project) === "no-action-needed";
}

export function planningModeLabel(project: Project): string {
  if (isNoActionNeeded(project)) return "No action needed";
  if (isHourlyOnsiteService(project)) return "Hourly onsite service call";
  return isRemoteConsultation(project) ? "Remote consultation" : "Onsite review";
}

export function planningScheduledLabel(project: Project): string {
  if (isHourlyOnsiteService(project)) return "Onsite service scheduling";
  return isRemoteConsultation(project) ? "Consultation call scheduled" : "Onsite planning scheduled";
}

export function planningAppointmentNoun(project: Project): string {
  if (isHourlyOnsiteService(project)) return "hourly onsite service call";
  return isRemoteConsultation(project) ? "consultation call" : "onsite planning review";
}

function installHourlyOnsiteServiceOption(): void {
  if (typeof document === "undefined") return;
  const install = () => {
    document.querySelectorAll<HTMLSelectElement>('select[aria-label="Planned next step"]').forEach((select) => {
      if (select.querySelector('option[value="hourly-onsite-service"]')) return;
      const option = document.createElement("option");
      option.value = "hourly-onsite-service";
      option.textContent = "Hourly onsite service call";
      const noAction = select.querySelector('option[value="no-action-needed"]');
      select.insertBefore(option, noAction);
    });
  };
  install();
  if (typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof window !== "undefined") queueMicrotask(installHourlyOnsiteServiceOption);
