import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, lifecycleDevices, sortLifecycleDevices } from "./client-report-data";

export interface ClientReportPlanAction {
  id: string;
  title: string;
  detail: string;
  timing: string;
  owner: string;
  tone: "priority" | "attention" | "steady";
}

function names(devices: ReturnType<typeof lifecycleDevices>, maximum = 6): string {
  const visible = devices.slice(0, maximum).map((device) => device.name);
  const remaining = Math.max(0, devices.length - visible.length);
  return `${visible.join(", ")}${remaining ? `, and ${remaining} more` : ""}`;
}

export function clientReportPlanActions(project: Project): ClientReportPlanAction[] {
  const devices = sortLifecycleDevices(lifecycleDevices(project));
  const replacements = devices.filter((device) => device.lifecycleStatus === "overdue");
  const planSoon = devices.filter((device) => device.lifecycleStatus === "due-soon");
  const healthPriorityDevices = [...replacements, ...planSoon];
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const antivirusEvents = factNumber(project, "huntress.antivirusEvents");
  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const actions: ClientReportPlanAction[] = [];

  actions.push({
    id: "confirm-health-priorities",
    title: healthPriorityDevices.length ? "Confirm health priorities and planning estimates" : "Confirm the healthy baseline and future priorities",
    detail: healthPriorityDevices.length
      ? `Review ${names(healthPriorityDevices)} with your Technology Consultant. They can validate business impact, confirm the recommended order, and prepare options and budget estimates before any decision is made.`
      : "Review the healthy environment with your Technology Consultant, confirm what should remain in service, and identify any future lifecycle or capacity needs before they become urgent.",
    timing: "Guided session",
    owner: "Technology Consultant + Client",
    tone: healthPriorityDevices.length ? "attention" : "steady",
  });

  if (hipaa?.notYetAssessedCount) {
    actions.push({
      id: "complete-hipaa-review",
      title: "Complete the HIPAA readiness review",
      detail: `${hipaa.notYetAssessedCount} question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} skipped or unanswered. Use the follow-up session to assign the right client owner, confirm evidence, and finalize the readiness snapshot.`,
      timing: "Follow-up session",
      owner: "Client + Advantage",
      tone: "priority",
    });
  } else if (hipaa && (hipaa.counts.no + hipaa.counts.partially) > 0) {
    const gaps = hipaa.counts.no + hipaa.counts.partially;
    actions.push({
      id: "close-hipaa-gaps",
      title: `Plan corrective action for ${gaps} HIPAA readiness gap${gaps === 1 ? "" : "s"}`,
      detail: "Use the guided planning session to assign ownership, agree on target dates, and determine which actions require policy work, training, technical changes, or additional documentation.",
      timing: "30–180 days",
      owner: "Assigned control owners",
      tone: hipaa.counts.no ? "priority" : "attention",
    });
  }

  if (incidents > 0 || investigated > 0 || malware > 0) {
    const evidence = [
      incidents ? `${incidents} reported incident${incidents === 1 ? "" : "s"}` : "",
      investigated ? `${investigated} investigated signal${investigated === 1 ? "" : "s"}` : "",
      malware ? `${malware} blocked malware file${malware === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(", ");
    actions.push({
      id: "security-awareness-refresh",
      title: "Discuss a targeted team security refresher",
      detail: `${evidence} appeared in the reporting period. Review the activity with Advantage and decide whether the team would benefit from focused training on suspicious links, downloads, credential prompts, and reporting unusual behavior.`,
      timing: "Within 30 days",
      owner: "Client leadership + Advantage",
      tone: incidents ? "priority" : "attention",
    });
  } else if (antivirusEvents > 0) {
    actions.push({
      id: "review-security-activity",
      title: "Use recent security activity as a team reminder",
      detail: `${antivirusEvents} antivirus event${antivirusEvents === 1 ? " was" : "s were"} processed without a reported incident. The Technology Consultant can help determine whether a brief staff reminder is appropriate.`,
      timing: "Next staff meeting",
      owner: "Client leadership",
      tone: "steady",
    });
  }

  actions.push({
    id: "technology-roadmap",
    title: "Build a phased technology plan",
    detail: "Use the guided session to agree on timing, budget ranges, responsible parties, and practical phases so health priorities can be addressed without trying to do everything at once.",
    timing: "12-month roadmap",
    owner: "Technology Consultant + Client",
    tone: "steady",
  });

  actions.push({
    id: "next-review-checkpoint",
    title: "Set the next review checkpoint",
    detail: "Choose the next technology review date so progress, new risks, security activity, and changing business needs can be revisited before they become urgent.",
    timing: "Quarterly or annual",
    owner: "Client + Advantage",
    tone: "steady",
  });

  return actions.slice(0, 4);
}
