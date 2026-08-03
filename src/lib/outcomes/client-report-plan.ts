import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, reportableLifecycleDevices, sortLifecycleDevices } from "./client-report-data";

export interface ClientReportPlanAction {
  id: string;
  title: string;
  detail: string;
  timing: string;
  owner: string;
  tone: "priority" | "attention" | "steady";
}

function names(devices: ReturnType<typeof reportableLifecycleDevices>, maximum = 6): string {
  const visible = devices.slice(0, maximum).map((device) => device.name);
  const remaining = Math.max(0, devices.length - visible.length);
  return `${visible.join(", ")}${remaining ? `, and ${remaining} more` : ""}`;
}

export function clientReportPlanActions(project: Project): ClientReportPlanAction[] {
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const replacements = devices.filter((device) => device.lifecycleStatus === "overdue");
  const planSoon = devices.filter((device) => device.lifecycleStatus === "due-soon");
  const healthPriorityDevices = [...replacements, ...planSoon];
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const antivirusEvents = factNumber(project, "huntress.antivirusEvents");
  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const hipaaFollowUp = Boolean(hipaa && (hipaa.notYetAssessedCount || hipaa.counts.no || hipaa.counts.partially));
  const securityFollowUp = incidents > 0 || investigated > 0 || malware > 0;
  const hasActionItems = healthPriorityDevices.length > 0 || hipaaFollowUp || securityFollowUp;

  if (!hasActionItems) {
    return [
      {
        id: "maintain-healthy-baseline",
        title: "Continue the healthy technology baseline",
        detail: "No immediate replacement or corrective action is recommended. Keep current systems protected, monitored, and inside the normal lifecycle review schedule.",
        timing: "Ongoing",
        owner: "Advantage + Client",
        tone: "steady",
      },
      {
        id: "monitor-security-activity",
        title: "Continue routine security monitoring",
        detail: antivirusEvents > 0
          ? `${antivirusEvents} antivirus event${antivirusEvents === 1 ? " was" : "s were"} processed without a reported incident. Continue monitoring and review meaningful changes at the next check-in.`
          : "Maintain current monitoring and response coverage, with no additional security follow-up required from this reporting period.",
        timing: "Ongoing",
        owner: "Advantage",
        tone: "steady",
      },
      {
        id: "next-review-checkpoint",
        title: "Set the next technology review checkpoint",
        detail: "Choose the next review date so lifecycle, security activity, capacity, and changing business needs can be revisited before they become urgent.",
        timing: "Quarterly or annual",
        owner: "Client + Advantage",
        tone: "steady",
      },
    ];
  }

  const actions: ClientReportPlanAction[] = [];
  actions.push({
    id: "confirm-health-priorities",
    title: healthPriorityDevices.length ? "Confirm health priorities and planning estimates" : "Review the findings with your Technology Consultant",
    detail: healthPriorityDevices.length
      ? `Review ${names(healthPriorityDevices)} with your Technology Consultant. They can validate business impact, confirm the recommended order, and prepare options and budget estimates before any decision is made.`
      : "Use a guided session to review the findings, confirm the right owners, and agree on the most practical next actions.",
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
      detail: "Assign ownership, agree on target dates, and determine which actions require policy work, training, technical changes, or additional documentation.",
      timing: "30–180 days",
      owner: "Assigned control owners",
      tone: hipaa.counts.no ? "priority" : "attention",
    });
  } else if (securityFollowUp) {
    const evidence = [
      incidents ? `${incidents} reported incident${incidents === 1 ? "" : "s"}` : "",
      investigated ? `${investigated} investigated signal${investigated === 1 ? "" : "s"}` : "",
      malware ? `${malware} blocked malware file${malware === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(", ");
    actions.push({
      id: "security-awareness-refresh",
      title: "Discuss a targeted team security refresher",
      detail: `${evidence} appeared in the reporting period. Review the activity and decide whether the team would benefit from focused training on suspicious links, downloads, credential prompts, and reporting unusual behavior.`,
      timing: "Within 30 days",
      owner: "Client leadership + Advantage",
      tone: incidents ? "priority" : "attention",
    });
  }

  actions.push({
    id: "technology-roadmap",
    title: "Build the technology roadmap",
    detail: "Use the guided session to agree on timing, budget ranges, responsible parties, and a clear sequence for the health priorities identified in this review.",
    timing: "Technology roadmap",
    owner: "Technology Consultant + Client",
    tone: "steady",
  });

  if (actions.length < 3) {
    actions.push({
      id: "next-review-checkpoint",
      title: "Set the next review checkpoint",
      detail: "Choose the next technology review date so progress, new risks, security activity, and changing business needs can be revisited before they become urgent.",
      timing: "Quarterly or annual",
      owner: "Client + Advantage",
      tone: "steady",
    });
  }

  return actions.slice(0, 3);
}
