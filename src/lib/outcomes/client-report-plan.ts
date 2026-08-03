import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { deviceTypeLabel, factNumber, isServerClassDevice, reportableLifecycleDevices, sortLifecycleDevices } from "./client-report-data";

export interface ClientReportPlanAction {
  id: string;
  title: string;
  detail: string;
  timing: string;
  owner: string;
  tone: "priority" | "attention" | "steady";
}

export interface TechnologyPlanningApproach {
  mode: "routine" | "remote-estimate" | "onsite-project";
  title: string;
  intro: string;
  consultationTitle: string;
  consultationCopy: string;
  sessionOutcomes: string[];
  priorityCount: number;
  hasServerProject: boolean;
}

function names(devices: ReturnType<typeof reportableLifecycleDevices>, maximum = 6): string {
  const visible = devices.slice(0, maximum).map((device) => device.name);
  const remaining = Math.max(0, devices.length - visible.length);
  return `${visible.join(", ")}${remaining ? `, and ${remaining} more` : ""}`;
}

export function technologyPlanningApproach(project: Project): TechnologyPlanningApproach {
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const priorities = devices.filter((device) => device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon");
  const primaryServer = priorities.find((device) => device.type === "server");
  const backupServer = priorities.find((device) => device.type === "backup-server");
  const hasServerProject = priorities.some(isServerClassDevice);
  const largeRefresh = priorities.length > 4;

  if (!priorities.length) {
    return {
      mode: "routine",
      title: "Keep the healthy environment on track",
      intro: "This review did not identify an immediate replacement need. Continue the current protection, monitoring, and lifecycle review cadence.",
      consultationTitle: "No immediate hardware action is required",
      consultationCopy: "Keep current systems protected and monitored, then revisit hardware health at the next scheduled technology review.",
      sessionOutcomes: ["Maintain protection", "Continue monitoring", "Track lifecycle", "Schedule review"],
      priorityCount: 0,
      hasServerProject: false,
    };
  }

  if (hasServerProject) {
    const serverNames = [primaryServer?.name, backupServer?.name].filter(Boolean).join(" and ");
    const serverContext = primaryServer && backupServer
      ? `${primaryServer.name} is the primary server and ${backupServer.name} is the Cloud Plus BDR backup emergency server.`
      : primaryServer
        ? `${primaryServer.name} is the primary server and the most operationally critical component in this replacement scope.`
        : `${backupServer?.name ?? "The Cloud Plus BDR system"} is the backup emergency server and a critical part of the recovery path.`;
    const relatedSystems = priorities.filter((device) => !isServerClassDevice(device));
    const relatedCopy = relatedSystems.length
      ? ` The ${relatedSystems.length} other aged system${relatedSystems.length === 1 ? "" : "s"} identified in this review should be evaluated with it as part of the same replacement project.`
      : " Its replacement should still be treated as a coordinated infrastructure project rather than an isolated equipment purchase.";
    return {
      mode: "onsite-project",
      title: "Plan the server-related replacement as one coordinated project",
      intro: `${serverContext}${relatedCopy} The server is the most crucial element, but the complete scope should be planned together; budget timing and implementation phases can remain flexible once dependencies are confirmed.`,
      consultationTitle: "Schedule an onsite project-planning review",
      consultationCopy: `Advantage should review ${serverNames || "the server environment"} onsite, confirm application, backup, imaging, and workstation dependencies, and then prepare a complete project scope with practical budget and implementation options.`,
      sessionOutcomes: ["Verify dependencies", "Confirm complete scope", "Prepare project estimate", "Plan implementation"],
      priorityCount: priorities.length,
      hasServerProject: true,
    };
  }

  if (largeRefresh) {
    return {
      mode: "onsite-project",
      title: "Plan the workstation refresh as a coordinated project",
      intro: `${priorities.length} computers are inside the replacement-planning window. Because the scope is larger than four computers, Advantage should review the environment onsite and plan the refresh as one coordinated project rather than as separate purchases.`,
      consultationTitle: "Schedule an onsite replacement-planning review",
      consultationCopy: "The onsite review will confirm users, software, imaging or peripheral dependencies, replacement quantities, and implementation considerations before a project estimate is prepared.",
      sessionOutcomes: ["Verify each computer", "Confirm complete scope", "Prepare project estimate", "Plan implementation"],
      priorityCount: priorities.length,
      hasServerProject: false,
    };
  }

  return {
    mode: "remote-estimate",
    title: priorities.length === 1 ? "Confirm the computer replacement" : "Confirm the computer replacements",
    intro: `${names(priorities)} ${priorities.length === 1 ? "is" : "are"} inside the replacement-planning window. With ${priorities.length} workstation${priorities.length === 1 ? "" : "s"} involved and no server project identified, the next step is usually a phone or remote review with your Technology Consultant to confirm the need and prepare an estimate.`,
    consultationTitle: "Meet remotely with your Technology Consultant",
    consultationCopy: "Your consultant can confirm the affected computer or computers, answer questions, and usually prepare the replacement estimate without an onsite project assessment.",
    sessionOutcomes: ["Confirm computers", "Review requirements", "Prepare estimate", "Choose timing"],
    priorityCount: priorities.length,
    hasServerProject: false,
  };
}

export function clientReportPlanActions(project: Project): ClientReportPlanAction[] {
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const replacements = devices.filter((device) => device.lifecycleStatus === "overdue");
  const planSoon = devices.filter((device) => device.lifecycleStatus === "due-soon");
  const healthPriorityDevices = [...replacements, ...planSoon];
  const approach = technologyPlanningApproach(project);
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
  if (healthPriorityDevices.length) {
    actions.push({
      id: "confirm-health-priorities",
      title: approach.mode === "onsite-project" ? "Confirm the complete replacement-project scope" : approach.title,
      detail: approach.intro,
      timing: approach.mode === "onsite-project" ? "Onsite project review" : "Phone or remote review",
      owner: "Technology Consultant + Client",
      tone: approach.mode === "onsite-project" ? "priority" : "attention",
    });
  } else {
    actions.push({
      id: "review-findings",
      title: "Review the findings with your Technology Consultant",
      detail: "Use a guided session to review the findings, confirm the right owners, and agree on the most practical next actions.",
      timing: "Guided session",
      owner: "Technology Consultant + Client",
      tone: "steady",
    });
  }

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

  if (approach.mode === "onsite-project") {
    actions.push({
      id: "technology-roadmap",
      title: "Build one complete project plan",
      detail: "Use the onsite findings to confirm the entire replacement scope, dependencies, budget options, implementation timing, and responsible parties. Budgeting and execution can be flexible, but all aged systems tied to the project should be planned together.",
      timing: "Project roadmap",
      owner: "Technology Consultant + Client",
      tone: "steady",
    });
  } else if (approach.mode === "remote-estimate") {
    actions.push({
      id: "technology-estimate",
      title: "Review the replacement estimate and choose timing",
      detail: `After the remote review confirms ${healthPriorityDevices.map((device) => `${device.name} (${deviceTypeLabel(device.type)})`).join(", ")}, your Technology Consultant can provide the estimate and help select a practical replacement date.`,
      timing: "Equipment estimate",
      owner: "Technology Consultant + Client",
      tone: "steady",
    });
  }

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
