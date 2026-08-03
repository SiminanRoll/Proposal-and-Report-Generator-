import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { factNumber, lifecycleSummary, reportableLifecycleDevices } from "./client-report-data";

export interface ClientReportScores {
  security: number;
  network: number;
  hipaa: number | null;
  overall: number;
  provisional: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreLabel(value: number): "Strong" | "Good" | "Developing" | "Needs Attention" | "Critical" {
  if (value >= 90) return "Strong";
  if (value >= 75) return "Good";
  if (value >= 60) return "Developing";
  if (value >= 40) return "Needs Attention";
  return "Critical";
}

export function scoreTone(value: number): "strong" | "good" | "developing" | "attention" | "critical" {
  if (value >= 90) return "strong";
  if (value >= 75) return "good";
  if (value >= 60) return "developing";
  if (value >= 40) return "attention";
  return "critical";
}

export function clientReportScores(project: Project): ClientReportScores {
  const lifecycle = lifecycleSummary(project);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const entities = factNumber(project, "huntress.entitiesProtected");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const incidents = factNumber(project, "huntress.incidentsReported");

  let security = 100;
  if (events <= 0) security -= 30;
  if (entities <= 0) security -= 25;
  if (canaries <= 0) security -= 10;
  security -= Math.min(60, incidents * 25);
  security -= Math.min(20, investigated * 5);
  security = clamp(security);

  const lifecycleDevices = reportableLifecycleDevices(project);
  const statusScore = { current: 100, "due-soon": 60, overdue: 10, unknown: 35 } as const;
  const businessImpactWeight = { workstation: 1, server: 5, vm: 2, network: 2.5 } as const;
  const weightedLifecycleBase = lifecycleDevices.length
    ? lifecycleDevices.reduce((sum, device) => sum + (statusScore[device.lifecycleStatus] * businessImpactWeight[device.type]), 0)
      / lifecycleDevices.reduce((sum, device) => sum + businessImpactWeight[device.type], 0)
    : lifecycle.total
      ? ((lifecycle.current * 100) + (lifecycle.dueSoon * 60) + (lifecycle.overdue * 10)) / lifecycle.total
      : 0;
  const overdueServer = lifecycleDevices.some((device) => device.type === "server" && device.lifecycleStatus === "overdue");
  const dueSoonServer = lifecycleDevices.some((device) => device.type === "server" && device.lifecycleStatus === "due-soon");
  const network = clamp(overdueServer
    ? Math.min(weightedLifecycleBase, 79)
    : dueSoonServer
      ? Math.min(weightedLifecycleBase, 88)
      : weightedLifecycleBase);

  const hipaa = project.hipaa.enabled ? scoreHipaaAssessment(project.hipaa) : null;
  const weighted = hipaa
    ? (security * 0.4) + (network * 0.4) + (hipaa.overall * 0.2)
    : (security * 0.5) + (network * 0.5);

  return {
    security,
    network,
    hipaa: hipaa?.overall ?? null,
    overall: clamp(weighted),
    provisional: Boolean(hipaa && hipaa.notYetAssessedCount > 0),
  };
}
