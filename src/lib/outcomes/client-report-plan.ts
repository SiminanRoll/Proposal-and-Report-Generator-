import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, isServerClassDevice, osSupportSummary, reportableLifecycleDevices, securityIncidentDetails, sortLifecycleDevices } from "./client-report-data";
import { applicationPlanningCopy, organizationPossessive } from "@/lib/projects/client-language";
import { isRemoteConsultation } from "./planning-mode";
import { hasAgreedReviewPlan, reviewOutcomePlanActions } from "@/lib/review-outcomes/model";

export interface ClientReportPlanAction {
  id: string;
  title: string;
  detail: string;
  timing: string;
  owner: string;
  tone: "priority" | "attention" | "steady";
}

export interface TechnologyPlanningApproach {
  mode: "routine" | "purchase-planning" | "remote-estimate" | "onsite-project";
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
  if (hasAgreedReviewPlan(project.reviewOutcome)) {
    const planItems = reviewOutcomePlanActions(project.reviewOutcome);
    const hasServerProject = project.reviewOutcome.items.some((item) => /server/i.test(`${item.title} ${item.technicalFinding}`));
    return {
      mode: isRemoteConsultation(project) ? "remote-estimate" : "onsite-project",
      title: "Follow the agreed technology roadmap",
      intro: project.reviewOutcome.meetingSummary.trim() || "The technical findings were reviewed with the client and converted into an agreed plan.",
      consultationTitle: "Agreed next step",
      consultationCopy: project.reviewOutcome.agreedNextStep.trim() || "Complete the agreed decisions and confirm progress at the next review checkpoint.",
      sessionOutcomes: planItems.slice(0, 4).map((item) => item.title),
      actionTitle: planItems[0]?.title || "Complete the agreed next step",
      actionDetail: planItems[0]?.detail || project.reviewOutcome.agreedNextStep.trim(),
      priorityCount: planItems.length,
      hasServerProject,
    };
  }
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const priorities = devices.filter((device) => device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon");
  const primaryServer = priorities.find((device) => device.type === "server");
  const backupServer = priorities.find((device) => device.type === "backup-server");
  const hasServerProject = priorities.some(isServerClassDevice);
  const largeRefresh = priorities.length > 4;
  const remote = isRemoteConsultation(project);
  const selectedMode: TechnologyPlanningApproach["mode"] = remote ? "remote-estimate" : "onsite-project";
  const selectedTitle = remote
    ? "Schedule a consultation call with your Technology Consultant"
    : "Schedule an onsite project-planning review";

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
    const consultationCopy = remote
      ? primaryServer
        ? "Use a consultation call with your Technology Consultant to review the server, applications, backups, and connected systems, then confirm the right path and next-step plan."
        : "Use a consultation call with your Technology Consultant to review the backup server and recovery setup, then confirm the right path and next-step plan."
      : primaryServer
        ? "Review the server, applications, backups, and connected systems onsite, then choose the right path and build the project plan."
        : "Review the backup server and recovery setup onsite, then choose the right path and build the project plan.";
    return {
      mode: selectedMode,
      title: serverTitle,
      intro: `${serverIntro}${relatedCopy}`,
      consultationTitle: selectedTitle,
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
      mode: selectedMode,
      title: "Plan the workstation refresh",
      intro: remote
        ? `${priorities.length} computers are past the planned lifecycle. A consultation call with your Technology Consultant will confirm the ${applicationPlanningCopy(project)}, connected equipment, and timing before the project is estimated.`
        : `${priorities.length} computers are past the planned lifecycle. An onsite project-planning review will confirm the ${applicationPlanningCopy(project)}, connected equipment, and timing before the project is estimated.`,
      consultationTitle: selectedTitle,
      consultationCopy: remote
        ? "Confirm the computers, required software, connected equipment, and preferred timing during a consultation call, then prepare the project estimate."
        : "Confirm the computers, required software, connected equipment, and timing onsite, then prepare the project estimate.",
      sessionOutcomes: ["Confirm the computers", "Review software needs", "Prepare the estimate", "Choose the timing"],
      actionTitle: "Confirm the replacement scope",
      actionDetail: `Confirm which computers, ${applicationPlanningCopy(project)}, and connected tools are included.`,
      priorityCount: priorities.length,
      hasServerProject: false,
    };
  }

  return {
    mode: "purchase-planning",
    title: "Aging systems to keep on your radar",
    intro: priorities.length === 1
      ? "One computer is nearing or past its recommended lifecycle. There is no pressure to replace it immediately; it is simply worth keeping on your radar."
      : `${priorities.length} computers are nearing or past their recommended lifecycle. There is no pressure to replace them all at once; they are simply worth keeping on your radar.`,
    consultationTitle: "Our team can help when you are ready",
    consultationCopy: priorities.length === 1
      ? "When you are ready, our team can help confirm the right business-class computer, required software, and a comfortable purchase timeline."
      : "When you are ready, our team can help confirm suitable business-class computers, required software, and a comfortable purchase timeline.",
    sessionOutcomes: ["Review suitable options", "Confirm software needs", "Choose a comfortable timeline", "Coordinate when ready"],
    actionTitle: priorities.length === 1 ? "Review a suitable replacement" : "Review suitable replacement options",
    actionDetail: priorities.length === 1
      ? "Advantage can help confirm the right equipment and software whenever the practice is ready to purchase."
      : "Advantage can help confirm the right equipment and software whenever the practice is ready to make the purchases.",
    priorityCount: priorities.length,
    hasServerProject: false,
  };
}

export function clientReportPlanActions(project: Project): ClientReportPlanAction[] {
  const agreedActions = reviewOutcomePlanActions(project.reviewOutcome);
  if (agreedActions.length) return agreedActions.slice(0, 6);
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
      timing: approach.mode === "purchase-planning" ? "When ready" : approach.mode === "onsite-project" ? "Onsite review" : "Consultation call",
      owner: approach.mode === "purchase-planning" ? "Client + Advantage" : "Consultant + Client",
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
        ? `${osSupport.endOfSupport} device${osSupport.endOfSupport === 1 ? " is" : "s are"} running Windows 8 / 8.1, Windows 10, or Server 2012 and should be prioritized for upgrade, migration, or replacement. ${osSupport.planning ? `${osSupport.planning} additional device${osSupport.planning === 1 ? " needs" : "s need"} planning for Server 2016 or Windows 11 Home.` : ""}`.trim()
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
      title: "Confirm the plan and timing",
      detail: "Use the consultation call to confirm the scope, review the estimate, and choose a practical replacement date.",
      timing: "Consultation call",
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
