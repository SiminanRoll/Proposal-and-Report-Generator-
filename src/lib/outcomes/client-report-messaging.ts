import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, isServerClassDevice, lifecycleSummary, osSupportSummary, reportableLifecycleDevices, securityIncidentDetails, sortLifecycleDevices } from "./client-report-data";
import { technologyPlanningApproach } from "./client-report-plan";
import { organizationPossessive } from "@/lib/projects/client-language";

export interface ClientFacingMessage {
  title: string;
  subtitle: string;
  tone: "healthy" | "attention" | "priority" | "neutral";
}

export interface PlanningStatus {
  label: "Routine monitoring" | "Planning recommended" | "Consultation recommended" | "Immediate attention";
  detail: string;
  tone: "healthy" | "attention" | "priority";
}

export interface SecurityIncidentResponseMessage {
  visible: boolean;
  title: string;
  summary: string;
  device: string;
  threat: string;
  status: string;
  actions: string[];
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function securityPresentationMessage(project: Project): ClientFacingMessage {
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const entities = factNumber(project, "huntress.entitiesProtected");
  const signals = factNumber(project, "huntress.signalsDetected");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const incidentResponse = securityIncidentResponseMessage(project);

  if (events <= 0 || entities <= 0) {
    return {
      title: "Security coverage could not be fully confirmed from this report.",
      subtitle: "We need a current security report to verify protected systems, monitoring activity, and whether anything requires follow-up.",
      tone: "attention",
    };
  }
  if (incidents > 0) {
    return {
      title: "Security activity was identified.",
      subtitle: incidentResponse.actions.length
        ? `Our security team was alerted, investigated ${countLabel(incidents, "reported incident")}, and confirmed the response shown below.`
        : `Our security team is aware of ${countLabel(incidents, "reported incident")} and investigated the available details. The affected computer and incident information are shown below.`,
      tone: incidentResponse.actions.length ? "attention" : "priority",
    };
  }
  if (investigated > 0) {
    return {
      title: "Suspicious activity was investigated, with no incidents reported.",
      subtitle: `Your security protections escalated ${countLabel(investigated, "signal")} for review. No targeted attack was reported during this period.`,
      tone: "attention",
    };
  }
  if (malware > 0) {
    return {
      title: malware === 1
        ? "A potential threat was stopped before it could run."
        : "Potential threats were stopped before they could run.",
      subtitle: `Your protection automatically blocked ${countLabel(malware, "malware file")} and continued monitoring the environment for additional activity.`,
      tone: "attention",
    };
  }
  if (signals > 0) {
    return {
      title: "Your security protections are active, with no incidents reported.",
      subtitle: `Monitoring reviewed activity across ${entities} protected systems, identified ${countLabel(signals, "signal")}, and found nothing that required an incident response.`,
      tone: "healthy",
    };
  }
  return {
    title: "Your security protections are active, with no incidents reported.",
    subtitle: `Monitoring remained active across ${entities} protected systems, with no security incident requiring follow-up during this reporting period.`,
    tone: "healthy",
  };
}

function actionSentence(actions: string[]): string {
  const normalized = actions.map((action) => action.toLowerCase());
  const isolated = normalized.some((action) => action.includes("isolated"));
  const cleaned = normalized.some((action) => action.includes("cleaned"));
  const deleted = normalized.some((action) => action.includes("deleted") || action.includes("removed"));
  const quarantined = normalized.some((action) => action.includes("quarantined"));
  if (isolated && cleaned && deleted) return "The real-time response isolated the computer, cleaned the affected file, and deleted the malicious file.";
  if (isolated && quarantined && deleted) return "The real-time response isolated the computer, quarantined the threat, and deleted the malicious file.";
  if (actions.length) {
    const human = actions.map((action) => action.replace(/^Computer /, "computer ").replace(/^Threat /, "the threat ").replace(/^Affected /, "the affected ").replace(/^Malicious /, "malicious "));
    if (human.length === 1) return `The response confirmed ${human[0].toLowerCase()}.`;
    return `The response confirmed ${human.slice(0, -1).join(", ").toLowerCase()}, and ${human.at(-1)?.toLowerCase()}.`;
  }
  return "The security team investigated the activity and documented the incident for review.";
}

export function securityIncidentResponseMessage(project: Project): SecurityIncidentResponseMessage {
  const incidents = factNumber(project, "huntress.incidentsReported");
  const detail = securityIncidentDetails(project)[0];
  if (!incidents) return { visible: false, title: "", summary: "", device: "", threat: "", status: "", actions: [] };
  const device = detail?.device ?? "";
  const threat = detail?.threat ?? "";
  const actions = detail?.actions ?? [];
  const title = actions.length
    ? "Threat contained and removed"
    : "Incident reviewed by our security team";
  return {
    visible: true,
    title,
    summary: actions.length
      ? `Advantage's security team is aware of the concern and completed its investigation. ${actionSentence(actions)}`
      : "Advantage's security team is aware of the concern, investigated the activity, and documented the incident. No additional automated response details were included in the source report.",
    device,
    threat,
    status: detail?.status || (actions.length ? "Response completed" : "Investigation completed"),
    actions,
  };
}

export function securityProtectionStatement(project: Project): string {
  const entities = factNumber(project, "huntress.entitiesProtected");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const incidentResponse = securityIncidentResponseMessage(project);
  const currentPosition = entities > 0
    ? `This report shows that Advantage security protection was active on ${entities} computer${entities === 1 ? "" : "s"} during the reporting period${incidents ? incidentResponse.actions.length ? `, with ${countLabel(incidents, "incident")} investigated and the documented response completed` : `, with ${countLabel(incidents, "incident")} investigated by our security team` : ", with no security incident requiring follow-up"}.`
    : "This report did not provide enough information to confirm protection on every computer, so Advantage should verify coverage with you.";
  return `${currentPosition} Computers enrolled in our managed security service are protected 24/7 with anti-malware, anti-ransomware, and advanced threat detection and response. Our security team reviews alerts and is ready to act when something requires attention. Please contact us before connecting a new or replacement computer so we can set it up and make sure it is protected from day one. No security solution can eliminate every risk, but this layered approach helps us detect and respond to suspicious activity quickly.`;
}

export function networkPresentationMessage(project: Project): ClientFacingMessage {
  const lifecycle = lifecycleSummary(project);
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const overdue = devices.filter((device) => device.lifecycleStatus === "overdue");
  const dueSoon = devices.filter((device) => device.lifecycleStatus === "due-soon");
  const priorities = overdue.length + dueSoon.length || lifecycle.overdue + lifecycle.dueSoon;
  const priorityPrimaryServer = [...overdue, ...dueSoon].find((device) => device.type === "server");
  const priorityBackupServer = [...overdue, ...dueSoon].find((device) => device.type === "backup-server");
  const criticalOverdue = overdue.some((device) => isServerClassDevice(device) || device.type === "network");
  const osSupport = osSupportSummary(project);

  const subtitle = priorityPrimaryServer && priorityBackupServer
    ? "The primary server and Cloud Plus backup server have reached the planning window. Confirm whether they should be replaced, migrated, or safely retired together, along with any related systems."
    : priorityPrimaryServer
      ? `The server has reached the planning window. Confirm whether it should be replaced, migrated, or safely retired based on the ${organizationPossessive(project)} future software plans.`
      : priorityBackupServer
        ? "The Cloud Plus backup server has reached the planning window. Confirm whether it should be replaced or retired as part of the server and recovery plan."
        : "We reviewed device age, warranty coverage, and software support to show what can remain in service and what should be planned next.";

  if (priorityPrimaryServer?.lifecycleStatus === "overdue" && priorityBackupServer?.lifecycleStatus === "overdue") {
    return {
      title: "Both servers need a next-step plan.",
      subtitle,
      tone: "priority",
    };
  }
  if (priorityPrimaryServer?.lifecycleStatus === "overdue") {
    return {
      title: "The server needs a next-step plan.",
      subtitle,
      tone: "priority",
    };
  }
  if (priorityBackupServer?.lifecycleStatus === "overdue") {
    return {
      title: "The Cloud Plus backup server needs a next-step plan.",
      subtitle,
      tone: "priority",
    };
  }
  if (priorityPrimaryServer?.lifecycleStatus === "due-soon" && priorityBackupServer?.lifecycleStatus === "due-soon") {
    return {
      title: "Plan for the primary server and Cloud Plus backup server.",
      subtitle,
      tone: "attention",
    };
  }
  if (priorityPrimaryServer?.lifecycleStatus === "due-soon") {
    return {
      title: "Plan for the primary server.",
      subtitle,
      tone: "attention",
    };
  }
  if (priorityBackupServer?.lifecycleStatus === "due-soon") {
    return {
      title: "Plan for the Cloud Plus backup server.",
      subtitle,
      tone: "attention",
    };
  }
  if (criticalOverdue) {
    return {
      title: "A critical system needs planning attention.",
      subtitle,
      tone: "priority",
    };
  }
  if (priorities === 0 && osSupport.attention > 0) {
    return {
      title: osSupport.endOfSupport > 0 ? "Operating-system support needs attention." : "Operating-system updates should be planned.",
      subtitle: `${osSupport.endOfSupport ? `${countLabel(osSupport.endOfSupport, "system")} reached end of support. ` : ""}${osSupport.planning ? `${countLabel(osSupport.planning, "system")} should be included in forward planning. ` : ""}The affected computers are identified in the inventory below.`.trim(),
      tone: osSupport.endOfSupport > 0 ? "priority" : "attention",
    };
  }
  if (priorities === 0) {
    return {
      title: "Your technology is in a healthy position.",
      subtitle,
      tone: "healthy",
    };
  }
  if (priorities <= 2) {
    return {
      title: `Most of your technology is healthy. ${priorities} ${priorities === 1 ? "system needs" : "systems need"} attention.`,
      subtitle,
      tone: overdue.length ? "attention" : "neutral",
    };
  }
  if (priorities >= 5 || overdue.length >= 3) {
    return {
      title: "Several systems need attention to reduce operational risk.",
      subtitle,
      tone: "priority",
    };
  }
  return {
    title: "Most of your technology is healthy. A few systems should be planned for next.",
    subtitle,
    tone: "attention",
  };
}

export function planningStatus(project: Project): PlanningStatus {
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const overdue = devices.filter((device) => device.lifecycleStatus === "overdue");
  const dueSoon = devices.filter((device) => device.lifecycleStatus === "due-soon");
  const criticalPriority = [...overdue, ...dueSoon].some((device) => isServerClassDevice(device) || device.type === "network");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const incidentResponse = securityIncidentResponseMessage(project);
  const unresolvedIncident = incidents > 0 && !incidentResponse.actions.length;
  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const hipaaFollowUp = Boolean(hipaa && (hipaa.notYetAssessedCount || hipaa.counts.no || hipaa.counts.partially));
  const priorityCount = overdue.length + dueSoon.length;
  const approach = technologyPlanningApproach(project);
  const osSupport = osSupportSummary(project);

  if (unresolvedIncident) {
    return {
      label: "Immediate attention",
      detail: `${countLabel(incidents, "security incident")} was identified and should be reviewed with Advantage promptly.`,
      tone: "priority",
    };
  }
  if (osSupport.endOfSupport > 0) {
    return {
      label: "Consultation recommended",
      detail: `${countLabel(osSupport.endOfSupport, "operating system")} reached end of support and should be prioritized for upgrade, migration, or replacement.`,
      tone: "priority",
    };
  }
  if (criticalPriority || approach.mode === "onsite-project") {
    return {
      label: "Consultation recommended",
      detail: approach.consultationCopy,
      tone: "priority",
    };
  }
  if (priorityCount > 0 || osSupport.attention > 0 || investigated > 0 || malware > 0 || hipaaFollowUp) {
    return {
      label: "Planning recommended",
      detail: approach.mode === "remote-estimate"
        ? approach.consultationCopy
        : "The review identified items that should be discussed, prioritized, and converted into a clear action plan.",
      tone: "attention",
    };
  }
  return {
    label: "Routine monitoring",
    detail: "No immediate action is recommended. Continue monitoring and revisit the environment at the next scheduled technology review.",
    tone: "healthy",
  };
}
