import type { ExtractedFact, Project } from "@/lib/projects/types";

export interface ClientReportDevice {
  type: "server" | "workstation" | "vm" | "network";
  name: string;
  user: string;
  lastCheckIn: string;
  make: string;
  serial: string;
  model: string;
  os: string;
  age: number;
  purchased: string;
  warrantyExpires: string;
  ram: string;
  cpu: string;
  storage: string;
  lifecycleStatus: "current" | "due-soon" | "overdue" | "unknown";
  osStatus: "supported" | "ending-soon" | "unsupported" | "unknown";
}

export interface LifecycleSummary {
  total: number;
  current: number;
  dueSoon: number;
  overdue: number;
  unknown: number;
  healthyPercentage: number;
}

function fact(project: Project, key: string): ExtractedFact | undefined {
  return project.intelligence.facts.find((item) => item.key === key);
}

export function factNumber(project: Project, key: string): number {
  const value = fact(project, key)?.value;
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function factText(project: Project, key: string): string {
  const value = fact(project, key)?.value;
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

export function factStrings(project: Project, key: string): string[] {
  const value = fact(project, key)?.value;
  if (Array.isArray(value)) return value.map(String);
  return value === undefined || value === "" ? [] : [String(value)];
}

export function lifecycleDevices(project: Project): ClientReportDevice[] {
  return factStrings(project, "scalepad.inventory").flatMap((entry) => {
    try {
      const parsed = JSON.parse(entry) as Partial<ClientReportDevice>;
      if (!parsed.name || !parsed.type) return [];
      return [{
        user: "",
        lastCheckIn: "",
        make: "",
        serial: "",
        model: "",
        os: "",
        age: 0,
        purchased: "",
        warrantyExpires: "",
        ram: "",
        cpu: "",
        storage: "",
        lifecycleStatus: "unknown",
        osStatus: "unknown",
        ...parsed,
      } as ClientReportDevice];
    } catch {
      return [];
    }
  });
}

export function lifecycleSummary(project: Project): LifecycleSummary {
  const devices = lifecycleDevices(project);
  const deviceCounts = {
    current: devices.filter((device) => device.lifecycleStatus === "current").length,
    dueSoon: devices.filter((device) => device.lifecycleStatus === "due-soon").length,
    overdue: devices.filter((device) => device.lifecycleStatus === "overdue").length,
    unknown: devices.filter((device) => device.lifecycleStatus === "unknown").length,
  };
  const typeTotal = ["scalepad.servers", "scalepad.workstations", "scalepad.vms", "scalepad.networkDevices"]
    .reduce((sum, key) => sum + factNumber(project, key), 0);
  const reported = {
    current: factNumber(project, "scalepad.replacement.current"),
    dueSoon: factNumber(project, "scalepad.replacement.dueSoon"),
    overdue: factNumber(project, "scalepad.replacement.overdue"),
    unknown: factNumber(project, "scalepad.replacement.unknown"),
  };
  const statusTotal = reported.current + reported.dueSoon + reported.overdue + reported.unknown;
  const total = Math.max(factNumber(project, "scalepad.totalAssets"), typeTotal, statusTotal, devices.length);
  const overdue = Math.max(reported.overdue, deviceCounts.overdue);
  const dueSoon = Math.max(reported.dueSoon, deviceCounts.dueSoon);
  const deviceCurrent = deviceCounts.current;
  const reportedCurrent = reported.current;
  const physicalTotal = factNumber(project, "scalepad.servers") + factNumber(project, "scalepad.workstations");
  const inferredPhysicalCurrent = Math.max(0, physicalTotal - overdue - dueSoon);
  const inferredCurrent = Math.max(0, total - overdue - dueSoon - reported.unknown);
  const current = Math.min(total, Math.max(reportedCurrent, deviceCurrent, inferredPhysicalCurrent, inferredCurrent));
  const unknown = Math.max(0, total - current - dueSoon - overdue);
  const healthyPercentage = total ? Math.round((current / total) * 100) : 0;
  return { total, current, dueSoon, overdue, unknown, healthyPercentage };
}

export function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2).replace(/\.00$/, "")}M`;
  if (value >= 1_000) return value.toLocaleString("en-US");
  return String(value);
}

export function lifecycleStatusLabel(value: ClientReportDevice["lifecycleStatus"]): string {
  if (value === "overdue") return "Replace now";
  if (value === "due-soon") return "Plan soon";
  if (value === "current") return "Healthy now";
  return "Under review";
}

export function clientReportAvailable(project: Project): boolean {
  const lifecycle = lifecycleSummary(project);
  return project.type === "client-report"
    && Boolean(lifecycle.total || factNumber(project, "huntress.eventsAnalyzed"));
}
