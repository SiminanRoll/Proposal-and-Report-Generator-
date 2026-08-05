import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, isServerClassDevice, osSupportSummary, reportableLifecycleDevices, securityIncidentDetails, sortLifecycleDevices } from "./client-report-data";
import { applicationPlanningCopy, organizationPossessive } from "@/lib/projects/client-language";

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
  actionTitle: string;
  actionDetail: string;
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
      actionTitle: "Maintain the current baseline",
      actionDetail: "Keep systems protected, monitored, and inside the normal lifecycle review schedule.",
      priorityCount: 0,
      hasServerProject: false,
    };
  }

  if (hasServerProject) {
    const relatedSystems = priorities.filter((device) => !isServerClassDevice(device));
    const bothServers = Boolean(primaryServer && backupServer);
    const serverTitle = bothServers
      ? "Plan the next step for both servers"
      : primaryServer
        ? "Plan the server's next step"
        : "Plan the backup server's next step";
    const serverIntro = bothServers
      ? `The primary server and Cloud Plus backup server are aging and should not remain the long-term solution. We will confirm whether they should be replaced, migrated, or safely retired based on the ${organizationPossessive(project)} future plans.`
      : primaryServer
        ? `The server is aging and should not remain the long-term solution. We will confirm whether it should be replaced, migrated, or safely retired based on the ${organizationPossessive(project)} future plans.`
        : `The Cloud Plus backup server is aging. We will confirm whether it should be replaced or safely retired as part of the ${organizationPossessive(project)} server and recovery plan.`;
    const relatedCopy = relatedSystems.length
      ? ` ${relatedSystems.length} other computer${relatedSystems.length === 1 ? " should" : "s should"} be considered in the same plan.`
      : "";
    const consultationCopy = primaryServer
      ? "Review the server, applications, backups, and connected systems, then choose the right path and build the plan."
      : "Review the backup server and recovery setup, then choose the right path and build the plan.";
    return {
      mode: "onsite-project",
      title: serverTitle,
      intro: `${serverIntro}${relatedCopy}`,
      consultationTitle: "Schedule a server planning review",
      consultationCopy,
      sessionOutcomes: ["Confirm future software plans", "Review server dependencies", "Choose the best path", "Build the transition plan"],
      actionTitle: "Determine the direction",
      actionDetail: primaryServer
        ? "Confirm whether the server should be replaced, migrated, or safely retired."
        : "Confirm whether the backup server should be replaced or retired with the server transition.",
      priorityCount: priorities.length,
      hasServerProject: true,
    };
  }

  if (largeRefresh) {
    return {
      mode: "onsite-project",
      title: "Plan the workstation refresh",
      intro: `${priorities.length} computers are past the planned lifecycle. An onsite review will confirm the ${applicationPlanningCopy(project)}, connected equipment, and timing before the project is estimated.`,
      consultationTitle: "Schedule an onsite replacement review",
      consultationCopy: "Confirm the computers, required software, and timing, then prepare the project estimate.",
      sessionOutcomes: ["Confirm the computers", "Review software needs", "Prepare the estimate", "Choose the timing"],
      actionTitle: "Confirm the replacement scope",
      actionDetail: `Confirm which computers, ${applicationPlanningCopy(project)}, and connected tools are included.`,
      priorityCount: priorities.length,
      hasServerProject: false,
    };
  }

  return {
    mode: "remote-estimate",
    title: priorities.length === 1 ? "Plan the computer replacement" : "Plan the computer replacements",
    intro: `${priorities.length === 1 ? "One computer is" : `${priorities.length} computers are`} past the planned lifecycle. A short phone or remote review can confirm what is needed and prepare an estimate.`,
    consultationTitle: "Talk with your Technology Consultant",
    consultationCopy: "Confirm the affected computers, required software, and preferred timing, then prepare the estimate.",
    sessionOutcomes: ["Confirm the computers", "Review software needs", "Prepare the estimate", "Choose the timing"],
    actionTitle: priorities.length === 1 ? "Confirm the replacement" : "Confirm the replacements",
    actionDetail: "Confirm the computers, required software, and preferred timing.",
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
  const antivirusEvents = factNumber(project, "huntress.antivirusEvents");
  const incidentDetails = securityIncidentDetails(project);
  const incidentResponseComplete = incidentDetails.some((detail) => detail.actions.length > 0 || /completed|resolved/i.test(detail.status));
  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const hipaaFollowUp = Boolean(hipaa && (hipaa.notYetAssessedCount || hipaa.counts.no || hipaa.counts.partially));
  const securityFollowUp = incidents > 0 && !incidentResponseComplete;
  const osSupport = osSupportSummary(project);
  const hasActionItems = healthPriorityDevices.length > 0 || osSupport.attention > 0 || hipaaFollowUp || securityFollowUp;

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
        detail: incidents > 0 && incidentResponseComplete
          ? `${incidents} reported incident${incidents === 1 ? " was" : "s were"} investigated and the documented response was completed. Continue routine monitoring with no additional client action identified in this report.`
          : antivirusEvents > 0
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
      title: approach.actionTitle,
      detail: approach.actionDetail,
      timing: approach.mode === "onsite-project" ? "Onsite review" : "Remote review",
      owner: "Consultant + Client",
      tone: approach.mode === "onsite-project" ? "priority" : "attention",
    });
  } else {
    actions.push({
      id: "review-findings",
      title: "Review the findings with your Technology Consultant",
      detail: "Use a guided session to review the findings, confirm the right owners, and agree on the most practical next actions.",
      timing: "Guided session",
      owner: "Consultant + Client",
      tone: "steady",
    });
  }

  if (osSupport.attention > 0) {
    actions.push({
      id: "operating-system-support",
      title: osSupport.endOfSupport > 0 ? "Address end-of-support operating systems" : "Plan the operating-system updates",
      detail: osSupport.endOfSupport > 0
        ? `${osSupport.endOfSupport} device${osSupport.endOfSupport === 1 ? " is" : "s are"} running Windows 10 or Server 2012 and should be prioritized for upgrade, migration, or replacement. ${osSupport.planning ? `${osSupport.planning} additional device${osSupport.planning === 1 ? " needs" : "s need"} planning for Server 2016 or Windows 11 Home.` : ""}`.trim()
        : `${osSupport.planning} device${osSupport.planning === 1 ? " needs" : "s need"} planning for Server 2016 support transition or review of Windows 11 Home versus the business-grade Pro edition.`,
      timing: osSupport.endOfSupport > 0 ? "Near term" : "Forward planning",
      owner: "Consultant + Client",
      tone: osSupport.endOfSupport > 0 ? "priority" : "attention",
    });
  }

  if (hipaa?.notYetAssessedCount) {
    actions.push({
      id: "complete-hipaa-review",
      title: "Complete the HIPAA review",
      detail: `Complete ${hipaa.notYetAssessedCount} unanswered question${hipaa.notYetAssessedCount === 1 ? "" : "s"}, assign the right owner, and confirm any needed evidence.`,
      timing: "Follow-up session",
      owner: "Client + Advantage",
      tone: "priority",
    });
  } else if (hipaa && (hipaa.counts.no + hipaa.counts.partially) > 0) {
    const gaps = hipaa.counts.no + hipaa.counts.partially;
    actions.push({
      id: "close-hipaa-gaps",
      title: `Address ${gaps} HIPAA readiness gap${gaps === 1 ? "" : "s"}`,
      detail: "Assign owners and target dates for policy, training, technical, or documentation work.",
      timing: "30–180 days",
      owner: "Assigned control owners",
      tone: hipaa.counts.no ? "priority" : "attention",
    });
  } else if (securityFollowUp) {
    const evidence = `${incidents} reported incident${incidents === 1 ? "" : "s"}`;
    actions.push({
      id: "security-awareness-refresh",
      title: "Consider a security refresher",
      detail: `${evidence} appeared. Review it and decide whether focused staff training would help.`,
      timing: "Within 30 days",
      owner: "Client leadership + Advantage",
      tone: incidents ? "priority" : "attention",
    });
  }

  if (approach.mode === "onsite-project") {
    actions.push({
      id: "technology-roadmap",
      title: approach.hasServerProject ? "Build the transition plan" : "Build the project plan",
      detail: "Prepare the scope, estimated cost, responsibilities, and timing.",
      timing: "Project roadmap",
      owner: "Consultant + Client",
      tone: "steady",
    });
  } else if (approach.mode === "remote-estimate") {
    actions.push({
      id: "technology-estimate",
      title: "Review the estimate and timing",
      detail: "Review the estimate and choose a practical replacement date.",
      timing: "Equipment estimate",
      owner: "Consultant + Client",
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
