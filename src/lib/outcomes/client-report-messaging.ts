import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, lifecycleSummary, reportableLifecycleDevices, sortLifecycleDevices } from "./client-report-data";

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

  if (events <= 0 || entities <= 0) {
    return {
      title: "Security coverage could not be fully confirmed from this report.",
      subtitle: "We need a current security report to verify protected systems, monitoring activity, and whether anything requires follow-up.",
      tone: "attention",
    };
  }
  if (incidents > 0) {
    return {
      title: "Security activity was identified and needs follow-up.",
      subtitle: `We reviewed activity across your protected systems and found ${countLabel(incidents, "reported incident")}. The details below show what happened and what should be addressed next.`,
      tone: "priority",
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

export function networkPresentationMessage(project: Project): ClientFacingMessage {
  const lifecycle = lifecycleSummary(project);
  const devices = sortLifecycleDevices(reportableLifecycleDevices(project));
  const overdue = devices.filter((device) => device.lifecycleStatus === "overdue");
  const dueSoon = devices.filter((device) => device.lifecycleStatus === "due-soon");
  const priorities = overdue.length + dueSoon.length || lifecycle.overdue + lifecycle.dueSoon;
  const priorityServer = [...overdue, ...dueSoon].find((device) => device.type === "server");
  const criticalOverdue = overdue.some((device) => device.type === "server" || device.type === "network");

  const subtitle = priorityServer
    ? `${priorityServer.name} is listed first because server health has a larger operational impact. We also reviewed device age, warranty coverage, and software support across the environment.`
    : "We reviewed device age, warranty coverage, and software support to show what can remain in service and what should be planned next.";
  if (priorityServer?.lifecycleStatus === "overdue") {
    return {
      title: "A server needs planning attention first.",
      subtitle,
      tone: "priority",
    };
  }
  if (priorityServer?.lifecycleStatus === "due-soon") {
    return {
      title: "A server should be planned for before it becomes urgent.",
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
  const priorityServer = [...overdue, ...dueSoon].find((device) => device.type === "server");
  const criticalPriority = [...overdue, ...dueSoon].some((device) => device.type === "server" || device.type === "network");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const hipaaFollowUp = Boolean(hipaa && (hipaa.notYetAssessedCount || hipaa.counts.no || hipaa.counts.partially));
  const priorityCount = overdue.length + dueSoon.length;

  if (incidents > 0) {
    return {
      label: "Immediate attention",
      detail: `${countLabel(incidents, "security incident")} and the related findings should be reviewed with Advantage promptly.`,
      tone: "priority",
    };
  }
  if (criticalPriority) {
    return {
      label: "Consultation recommended",
      detail: priorityServer
        ? `${priorityServer.name} is the first health priority because server replacement carries greater business impact than a standard workstation.`
        : "A business-critical network system is part of the health priorities and should be reviewed with your Technology Consultant.",
      tone: "priority",
    };
  }
  if (priorityCount > 0 || investigated > 0 || malware > 0 || hipaaFollowUp) {
    return {
      label: "Planning recommended",
      detail: "The review identified items that should be discussed, prioritized, and converted into a clear action plan.",
      tone: "attention",
    };
  }
  return {
    label: "Routine monitoring",
    detail: "No immediate action is recommended. Continue monitoring and revisit the environment at the next scheduled technology review.",
    tone: "healthy",
  };
}
