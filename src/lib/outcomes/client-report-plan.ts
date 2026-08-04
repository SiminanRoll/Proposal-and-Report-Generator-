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
    const relatedSystems = priorities.filter((device) => !isServerClassDevice(device));
    const serverStatement = primaryServer && backupServer
      ? "The primary server and Cloud Plus backup server need to be replaced. The primary server runs the practice's core applications and data, while the Cloud Plus backup server provides local and cloud backup and emergency standby capability."
      : primaryServer
        ? "The primary server needs to be replaced. It supports the practice's core applications, data, and connected computers."
        : "The Cloud Plus backup server needs to be replaced. It provides local and cloud backup and emergency standby capability for the primary server.";
    const dependencyTarget = primaryServer && backupServer ? "these systems" : primaryServer ? "the server" : "the backup and recovery setup";
    const relatedCopy = relatedSystems.length
      ? ` ${relatedSystems.length} other computer${relatedSystems.length === 1 ? " also needs" : "s also need"} replacement and should be included in the same plan.`
      : "";
    const consultationCopy = primaryServer && backupServer
      ? "Advantage will review the primary server, Cloud Plus backup server, applications, imaging systems, and connected equipment onsite, then prepare a complete project estimate and installation plan."
      : primaryServer
        ? "Advantage will review the primary server, applications, imaging systems, backups, and connected equipment onsite, then prepare a complete project estimate and installation plan."
        : "Advantage will review the Cloud Plus backup server and the primary server's backup and recovery setup onsite, then prepare a complete project estimate and installation plan.";
    return {
      mode: "onsite-project",
      title: primaryServer ? "Plan on replacing the server" : "Plan on replacing the Cloud Plus backup server",
      intro: `${serverStatement} Advantage should review what depends on ${dependencyTarget} and build one complete replacement project.${relatedCopy} Budget and timing can be flexible once the full scope is understood.`,
      consultationTitle: "Schedule an onsite project review",
      consultationCopy,
      sessionOutcomes: ["Review what is connected", "Confirm everything being replaced", "Prepare the estimate", "Plan the installation"],
      priorityCount: priorities.length,
      hasServerProject: true,
    };
  }

  if (largeRefresh) {
    return {
      mode: "onsite-project",
      title: "Plan on replacing the workstations",
      intro: `${priorities.length} computers need to be replaced. Because more than four computers are involved, Advantage should review the office onsite, confirm the software and imaging needs, and prepare one complete replacement project.`,
      consultationTitle: "Schedule an onsite replacement review",
      consultationCopy: "Advantage will confirm which computers are being replaced, what software each one needs, and how the work should be scheduled, then prepare a complete estimate.",
      sessionOutcomes: ["Confirm the computers", "Review software needs", "Prepare the estimate", "Plan the installation"],
      priorityCount: priorities.length,
      hasServerProject: false,
    };
  }

  return {
    mode: "remote-estimate",
    title: priorities.length === 1 ? "Plan on replacing the computer" : "Plan on replacing the computers",
    intro: `${priorities.length === 1 ? "One computer needs" : `${priorities.length} computers need`} to be replaced. A short phone or remote review with your Technology Consultant is usually enough to confirm what is needed and prepare an estimate.`,
    consultationTitle: "Talk with your Technology Consultant",
    consultationCopy: "Your consultant can confirm the computer or computers being replaced, review the software requirements, and usually prepare the estimate without an onsite project visit.",
    sessionOutcomes: ["Confirm the computers", "Review software needs", "Prepare the estimate", "Choose the timing"],
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
      title: approach.title,
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
