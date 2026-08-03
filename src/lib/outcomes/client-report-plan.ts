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
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const antivirusEvents = factNumber(project, "huntress.antivirusEvents");
  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const actions: ClientReportPlanAction[] = [];

  if (replacements.length) {
    actions.push({
      id: "replace-priority-devices",
      title: `Replace ${replacements.length} priority computer${replacements.length === 1 ? "" : "s"}`,
      detail: `Schedule replacement of ${names(replacements)}. Prioritize the systems with the greatest operational impact, expired warranty, unsupported software, or highest age.`,
      timing: "Now–90 days",
      owner: "Client + Advantage",
      tone: "priority",
    });
  }

  if (planSoon.length) {
    actions.push({
      id: "budget-aging-devices",
      title: `Budget for ${planSoon.length} aging device${planSoon.length === 1 ? "" : "s"}`,
      detail: `${names(planSoon)} should be placed into the next replacement budget so they can be changed on schedule instead of after a failure.`,
      timing: "Next 12 months",
      owner: "Client leadership",
      tone: "attention",
    });
  }

  if (hipaa?.notYetAssessedCount) {
    actions.push({
      id: "complete-hipaa-review",
      title: "Complete the HIPAA readiness review",
      detail: `${hipaa.notYetAssessedCount} question${hipaa.notYetAssessedCount === 1 ? " remains" : "s remain"} skipped or unanswered. The displayed readiness score is ${hipaa.overall}/100 with ${hipaa.completionPercentage}% of applicable controls assessed. Revisit the open items before finalizing the readiness snapshot.`,
      timing: "Within 30 days",
      owner: "Client + Advantage",
      tone: "priority",
    });
  } else if (hipaa && (hipaa.counts.no + hipaa.counts.partially) > 0) {
    const gaps = hipaa.counts.no + hipaa.counts.partially;
    actions.push({
      id: "close-hipaa-gaps",
      title: `Close ${gaps} HIPAA readiness gap${gaps === 1 ? "" : "s"}`,
      detail: `Assign an owner and target date to each No or Partially response, attach supporting evidence, and review progress at the next technology meeting.`,
      timing: "30–180 days",
      owner: "Assigned control owners",
      tone: hipaa.counts.no ? "priority" : "attention",
    });
  } else if (hipaa) {
    actions.push({
      id: "maintain-hipaa-readiness",
      title: "Maintain the HIPAA readiness baseline",
      detail: `Keep evidence current, review administrative and technical safeguards after meaningful operational changes, and refresh the assessment at least annually.`,
      timing: "Ongoing",
      owner: "HIPAA security lead",
      tone: "steady",
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
      title: "Reinforce team security awareness",
      detail: `${evidence} appeared in the reporting period. Review the activity with Advantage and provide a targeted refresher on suspicious links, downloads, credential prompts, and how staff should report unusual behavior.`,
      timing: "Within 30 days",
      owner: "Client leadership + Advantage",
      tone: incidents ? "priority" : "attention",
    });
  } else if (antivirusEvents > 0) {
    actions.push({
      id: "review-security-activity",
      title: "Review security activity with the team",
      detail: `${antivirusEvents} antivirus event${antivirusEvents === 1 ? " was" : "s were"} processed without a reported incident. Use the result as a brief reminder of safe email, download, and reporting practices.`,
      timing: "Next staff meeting",
      owner: "Client leadership",
      tone: "steady",
    });
  }

  actions.push({
    id: "technology-roadmap",
    title: "Adopt a 12-month technology roadmap",
    detail: "Confirm the replacement order, assign owners to HIPAA actions, review security activity, and revisit progress at each scheduled technology review.",
    timing: "Quarterly review",
    owner: "Client + Advantage",
    tone: "steady",
  });

  return actions.slice(0, 6);
}
