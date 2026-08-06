import type {
  CompassClient,
  CompassConfig,
  CompassDataset,
  CompassDevice,
  CompassFinding,
  CompassLocation,
  CompassOpportunity,
} from "./types";
import type { ReviewDisposition, ReviewOutcomeItem } from "@/lib/review-outcomes/types";
import { dispositionOption, hasAgreedReviewPlan } from "@/lib/review-outcomes/model";

export type CompassProjectCategory =
  | "server-replacement"
  | "server-retirement"
  | "server-migration"
  | "workstation-refresh"
  | "client-purchased-deployment"
  | "os-remediation"
  | "storage-remediation"
  | "hipaa-follow-up"
  | "application-migration"
  | "multisite-rollout"
  | "investigation";

export interface CompassProjectPackage {
  id: string;
  clientId: string;
  category: CompassProjectCategory;
  title: string;
  deviceIds: string[];
  locationIds: string[];
  technicalDrivers: string[];
  disposition: ReviewDisposition;
  clientResponsibility: string;
  advantageResponsibility: string;
  timing: string;
  quoted: boolean;
  estimatedValue: number;
  assumptions: string[];
  includeInReport: boolean;
  source: "review-outcome" | "technical-findings";
}

export interface CompassLocationSnapshot {
  id: string;
  clientId: string;
  name: string;
  deviceIds: string[];
  physicalServers: number;
  virtualServers: number;
  physicalWorkstations: number;
  virtualWorkstations: number;
  replaceNow: number;
  planSoon: number;
  windows10: number;
  storageAttention: number;
  findingIds: string[];
  decisionIds: string[];
}

const GENERIC_LOCATION = /^(?:location\s*(?:not\s*)?specified|location\s*unspecified|not\s*specified|unknown|default\s*location|main\s*location|primary\s*location|n\/a|none|-)?$/i;

export function isNamedCompassLocation(location: Pick<CompassLocation, "name"> | string | null | undefined): boolean {
  const name = typeof location === "string" ? location : location?.name ?? "";
  return Boolean(name.trim()) && !GENERIC_LOCATION.test(name.trim());
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function rounded(value: number): number {
  return Math.max(0, Math.round(value));
}

function withContingency(value: number, config: CompassConfig): number {
  return rounded(value * (1 + config.value.planningContingencyPercent / 100));
}

function relevantFindings(findings: CompassFinding[], deviceIds: string[]): CompassFinding[] {
  const ids = new Set(deviceIds);
  return findings.filter((finding) => ids.has(finding.deviceId));
}

function categoryFromText(item: Pick<ReviewOutcomeItem, "title" | "technicalFinding" | "clientFacingNote" | "disposition">): CompassProjectCategory {
  const text = `${item.title} ${item.technicalFinding} ${item.clientFacingNote}`.toLowerCase();
  if (item.disposition === "retire-decommission" || /decommission|retire/.test(text) && /server/.test(text)) return "server-retirement";
  if (item.disposition === "migrate-retire" || /migrat/.test(text) && /server|application|imaging/.test(text)) {
    return /application|imaging|practice management/.test(text) ? "application-migration" : "server-migration";
  }
  if (item.disposition === "advantage-install-client-purchased" || /client[- ]purchased|already (?:ordered|purchased)|deploy/.test(text) && /computer|workstation|device/.test(text)) return "client-purchased-deployment";
  if (/hipaa|readiness/.test(text)) return "hipaa-follow-up";
  if (/storage|disk|free space|capacity/.test(text)) return "storage-remediation";
  if (/windows 10|windows 11 home|operating system|\bos\b|upgrade/.test(text)) return "os-remediation";
  if (/workstation|computer|desktop|laptop/.test(text)) return "workstation-refresh";
  if (/server/.test(text)) return "server-replacement";
  if (/multi[- ]?site|location|rollout/.test(text)) return "multisite-rollout";
  return "investigation";
}

function opportunityCategory(opportunity: CompassOpportunity): CompassProjectCategory | null {
  if (opportunity.cardCategory === "critical-server" || opportunity.cardCategory === "server-planning") return "server-replacement";
  if (opportunity.cardCategory === "windows-10") return "os-remediation";
  if (opportunity.cardCategory === "workstation-lifecycle") return "workstation-refresh";
  if (opportunity.cardCategory === "storage") return "storage-remediation";
  return null;
}

function defaultTitle(category: CompassProjectCategory, critical = false): string {
  const labels: Record<CompassProjectCategory, string> = {
    "server-replacement": critical ? "Priority server modernization" : "Server modernization planning",
    "server-retirement": "Server retirement and decommissioning",
    "server-migration": "Server migration and retirement",
    "workstation-refresh": "Workstation lifecycle refresh",
    "client-purchased-deployment": "Client-purchased computer deployment",
    "os-remediation": "Operating-system remediation",
    "storage-remediation": "Storage remediation",
    "hipaa-follow-up": "HIPAA readiness follow-up",
    "application-migration": "Application and imaging migration",
    "multisite-rollout": "Multisite rollout coordination",
    investigation: "Technical follow-up and investigation",
  };
  return labels[category];
}

function deviceLocationIds(devices: CompassDevice[], namedLocationIds: Set<string>): string[] {
  return unique(devices.map((device) => device.locationId).filter((id) => namedLocationIds.has(id)));
}

function inferDevicesForReviewItem(
  item: ReviewOutcomeItem,
  devices: CompassDevice[],
  opportunities: CompassOpportunity[],
  findings: CompassFinding[],
): CompassDevice[] {
  const explicit = new Set(item.deviceIds);
  if (explicit.size) return devices.filter((device) => explicit.has(device.id));
  const category = categoryFromText(item);
  const opportunityIds = unique(opportunities
    .filter((opportunity) => opportunityCategory(opportunity) === category
      || (category === "client-purchased-deployment" && (opportunity.cardCategory === "windows-10" || opportunity.cardCategory === "workstation-lifecycle")))
    .flatMap((opportunity) => opportunity.affectedDeviceIds));
  if (opportunityIds.length) {
    const ids = new Set(opportunityIds);
    return devices.filter((device) => ids.has(device.id));
  }
  const text = `${item.title} ${item.technicalFinding} ${item.clientFacingNote}`.toLowerCase();
  const findingIds = unique(findings.filter((finding) => text.includes(finding.title.toLowerCase()) || text.includes(finding.category.toLowerCase())).map((finding) => finding.deviceId));
  const ids = new Set(findingIds);
  return devices.filter((device) => ids.has(device.id));
}

function packageValue(
  category: CompassProjectCategory,
  disposition: ReviewDisposition,
  devices: CompassDevice[],
  config: CompassConfig,
  claimedDeviceIds: Set<string>,
  claimedOneTime: Set<string>,
): { value: number; assumptions: string[] } {
  const available = devices.filter((device) => !claimedDeviceIds.has(device.id));
  const physicalServers = available.filter((device) => device.deviceType === "physical-server");
  const virtualServers = available.filter((device) => device.deviceType === "virtual-server");
  const physicalWorkstations = available.filter((device) => device.deviceType === "physical-workstation");
  const virtualWorkstations = available.filter((device) => device.deviceType === "virtual-workstation");
  const assumptions: string[] = [];
  let value = 0;

  if (["client-purchased", "retire-decommission", "monitor", "deferred", "no-action", "completed", "investigate"].includes(disposition)) {
    available.forEach((device) => claimedDeviceIds.add(device.id));
    return { value: 0, assumptions: ["No replacement value counted for the recorded disposition."] };
  }

  if (disposition === "advantage-install-client-purchased") {
    value = physicalWorkstations.length * config.value.workstationDeploymentAllowance;
    if (physicalWorkstations.length) assumptions.push(`${physicalWorkstations.length} client-purchased workstation deployment allowance${physicalWorkstations.length === 1 ? "" : "s"}`);
  } else if (disposition === "migrate-retire") {
    const count = physicalServers.length + virtualServers.length || available.length;
    value = count * config.value.advancedServerMigration;
    if (count) assumptions.push(`${count} server migration allowance${count === 1 ? "" : "s"}`);
  } else if (disposition === "upgrade-only") {
    const count = virtualWorkstations.length + virtualServers.length || available.length;
    value = count * config.value.virtualOsRemediation;
    if (count) assumptions.push(`${count} operating-system remediation allowance${count === 1 ? "" : "s"}`);
  } else if (disposition === "advantage-replace") {
    if (physicalServers.length) {
      value += config.value.standardServerReplacement;
      if (physicalServers.length > 1) value += (physicalServers.length - 1) * config.value.standardServerReplacement * config.value.multiServerAdditionalMultiplier;
      assumptions.push(`${physicalServers.length} physical server replacement${physicalServers.length === 1 ? "" : "s"}`);
    }
    if (virtualServers.length) {
      value += virtualServers.length * config.value.advancedServerMigration;
      assumptions.push(`${virtualServers.length} virtual server migration allowance${virtualServers.length === 1 ? "" : "s"}`);
    }
    if (physicalWorkstations.length) {
      value += physicalWorkstations.length * (config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance);
      assumptions.push(`${physicalWorkstations.length} workstation modernization and deployment allowance${physicalWorkstations.length === 1 ? "" : "s"}`);
    }
    if (virtualWorkstations.length) {
      value += virtualWorkstations.length * config.value.virtualOsRemediation;
      assumptions.push(`${virtualWorkstations.length} virtual OS remediation allowance${virtualWorkstations.length === 1 ? "" : "s"}`);
    }
  }

  if (category === "storage-remediation" && !claimedOneTime.has("storage")) {
    value += config.value.storageRemediation;
    claimedOneTime.add("storage");
    assumptions.push("One storage remediation allowance");
  }

  available.forEach((device) => claimedDeviceIds.add(device.id));
  return { value: withContingency(value, config), assumptions };
}

function responsibilityDefaults(disposition: ReviewDisposition): { client: string; advantage: string } {
  if (disposition === "client-purchased") return { client: "Purchase and stage the agreed equipment.", advantage: "Confirm requirements and remain available for coordination." };
  if (disposition === "advantage-install-client-purchased") return { client: "Have all purchased equipment onsite and accessible.", advantage: "Secure, configure, deploy, and connect the equipment." };
  if (disposition === "retire-decommission") return { client: "Confirm the system and retained data are no longer required.", advantage: "Verify dependencies, preserve required data, and complete secure decommissioning." };
  if (disposition === "migrate-retire") return { client: "Confirm application, access, and timing requirements.", advantage: "Plan the migration, validate dependencies, and retire the legacy system." };
  if (disposition === "advantage-replace") return { client: "Approve scope, timing, and procurement.", advantage: "Design, quote, and deliver the replacement project." };
  if (disposition === "upgrade-only") return { client: "Approve the planned maintenance window.", advantage: "Validate compatibility and complete the upgrade." };
  if (disposition === "monitor") return { client: "Report meaningful changes or operational symptoms.", advantage: "Continue monitoring and revisit during the next review." };
  return { client: "Provide the information or approval needed for the next decision.", advantage: "Complete the documented follow-up and return with a recommendation." };
}

function reviewPackage(
  client: CompassClient,
  item: ReviewOutcomeItem,
  allDevices: CompassDevice[],
  opportunities: CompassOpportunity[],
  findings: CompassFinding[],
  namedLocationIds: Set<string>,
  config: CompassConfig,
  claimedDeviceIds: Set<string>,
  claimedOneTime: Set<string>,
): CompassProjectPackage {
  const devices = inferDevicesForReviewItem(item, allDevices, opportunities, findings);
  const category = categoryFromText(item);
  const drivers = unique([
    item.technicalFinding.trim(),
    ...relevantFindings(findings, devices.map((device) => device.id)).map((finding) => finding.explanation),
  ]).slice(0, 8);
  const estimate = packageValue(category, item.disposition, devices, config, claimedDeviceIds, claimedOneTime);
  const defaults = responsibilityDefaults(item.disposition);
  const option = dispositionOption(item.disposition);
  return {
    id: item.id,
    clientId: client.id,
    category,
    title: item.title.trim() || defaultTitle(category),
    deviceIds: devices.map((device) => device.id),
    locationIds: unique([...(item.locationIds ?? []), ...deviceLocationIds(devices, namedLocationIds)]).filter((id) => namedLocationIds.has(id)),
    technicalDrivers: drivers,
    disposition: item.disposition,
    clientResponsibility: item.clientResponsibility?.trim() || defaults.client,
    advantageResponsibility: item.advantageResponsibility?.trim() || defaults.advantage,
    timing: item.targetDate.trim() || option.defaultTiming,
    quoted: Boolean(item.quoted || client.quoted),
    estimatedValue: estimate.value,
    assumptions: estimate.assumptions,
    includeInReport: item.includeInReport,
    source: "review-outcome",
  };
}

function technicalPackages(
  client: CompassClient,
  opportunities: CompassOpportunity[],
  devices: CompassDevice[],
  findings: CompassFinding[],
  namedLocationIds: Set<string>,
  config: CompassConfig,
  claimedDeviceIds: Set<string>,
  claimedOneTime: Set<string>,
): CompassProjectPackage[] {
  const grouped = new Map<CompassProjectCategory, CompassOpportunity[]>();
  for (const opportunity of opportunities) {
    const category = opportunityCategory(opportunity);
    if (!category) continue;
    const current = grouped.get(category) ?? [];
    current.push(opportunity);
    grouped.set(category, current);
  }
  const result: CompassProjectPackage[] = [];
  const categoryOrder: CompassProjectCategory[] = ["server-replacement", "workstation-refresh", "os-remediation", "storage-remediation"];
  for (const category of categoryOrder) {
    const group = grouped.get(category);
    if (!group?.length) continue;
    const ids = unique(group.flatMap((opportunity) => opportunity.affectedDeviceIds)).filter((id) => !claimedDeviceIds.has(id));
    if (!ids.length) continue;
    const idSet = new Set(ids);
    const packageDevices = devices.filter((device) => idSet.has(device.id));
    const disposition: ReviewDisposition = category === "storage-remediation" ? "investigate" : "advantage-replace";
    const estimateDisposition: ReviewDisposition = category === "storage-remediation" ? "advantage-replace" : disposition;
    const estimate = packageValue(category, estimateDisposition, packageDevices, config, claimedDeviceIds, claimedOneTime);
    const critical = group.some((opportunity) => opportunity.cardCategory === "critical-server");
    result.push({
      id: `technical-${client.id}-${category}`,
      clientId: client.id,
      category,
      title: defaultTitle(category, critical),
      deviceIds: ids,
      locationIds: deviceLocationIds(packageDevices, namedLocationIds),
      technicalDrivers: unique(group.flatMap((opportunity) => opportunity.drivers)),
      disposition,
      clientResponsibility: "Review the findings and confirm priorities, timing, and budget.",
      advantageResponsibility: "Validate scope and translate the findings into a project recommendation.",
      timing: critical ? "Priority planning" : "Upcoming planning cycle",
      quoted: client.quoted,
      estimatedValue: estimate.value,
      assumptions: estimate.assumptions.length ? estimate.assumptions : unique(group.flatMap((opportunity) => opportunity.assumptionKeys)),
      includeInReport: true,
      source: "technical-findings",
    });
  }
  return result;
}

export function buildCompassProjectPackages(dataset: CompassDataset, config: CompassConfig, clientId: string): CompassProjectPackage[] {
  const client = dataset.clients.find((candidate) => candidate.id === clientId);
  const summary = dataset.summaries.find((candidate) => candidate.clientId === clientId);
  if (!client || !summary) return [];
  const devices = dataset.devices.filter((device) => device.clientId === clientId);
  const findings = dataset.findings.filter((finding) => finding.clientId === clientId);
  const namedLocations = dataset.locations.filter((location) => location.clientId === clientId && isNamedCompassLocation(location));
  const namedLocationIds = new Set(namedLocations.map((location) => location.id));
  const claimedDeviceIds = new Set<string>();
  const claimedOneTime = new Set<string>();
  const packages: CompassProjectPackage[] = [];

  if (hasAgreedReviewPlan(client.reviewOutcome)) {
    for (const item of client.reviewOutcome.items.filter((candidate) => candidate.includeInReport)) {
      packages.push(reviewPackage(client, item, devices, summary.opportunities, findings, namedLocationIds, config, claimedDeviceIds, claimedOneTime));
    }
  }
  packages.push(...technicalPackages(client, summary.opportunities, devices, findings, namedLocationIds, config, claimedDeviceIds, claimedOneTime));

  for (const project of packages) {
    const projectDeviceIds = new Set(project.deviceIds);
    const overlappingDrivers = summary.opportunities
      .filter((opportunity) => opportunity.affectedDeviceIds.some((id) => projectDeviceIds.has(id)))
      .flatMap((opportunity) => opportunity.drivers);
    project.technicalDrivers = unique([...project.technicalDrivers, ...overlappingDrivers]).slice(0, 10);
  }

  const activePackages = packages.filter((project) => project.includeInReport && project.deviceIds.length);
  const spannedLocations = unique(activePackages.flatMap((project) => project.locationIds));
  if (namedLocations.length > 1 && spannedLocations.length > 1 && !packages.some((project) => project.category === "multisite-rollout")) {
    packages.push({
      id: `technical-${client.id}-multisite-rollout`,
      clientId: client.id,
      category: "multisite-rollout",
      title: defaultTitle("multisite-rollout"),
      deviceIds: unique(activePackages.flatMap((project) => project.deviceIds)),
      locationIds: spannedLocations,
      technicalDrivers: [`Coordinate sequencing across ${spannedLocations.length} named locations.`],
      disposition: "investigate",
      clientResponsibility: "Confirm location contacts, access windows, and rollout order.",
      advantageResponsibility: "Coordinate a location-aware implementation plan and minimize disruption.",
      timing: "Coordinate with project schedule",
      quoted: client.quoted,
      estimatedValue: claimedOneTime.has("multisite") ? 0 : rounded(config.value.multisiteAdjustment),
      assumptions: ["One multisite coordination adjustment across the packaged work."],
      includeInReport: true,
      source: "technical-findings",
    });
    claimedOneTime.add("multisite");
  }
  return packages;
}

export function buildCompassLocationSnapshots(dataset: CompassDataset, clientId: string): CompassLocationSnapshot[] {
  const client = dataset.clients.find((candidate) => candidate.id === clientId);
  if (!client) return [];
  const devices = dataset.devices.filter((device) => device.clientId === clientId);
  const findings = dataset.findings.filter((finding) => finding.clientId === clientId);
  return dataset.locations
    .filter((location) => location.clientId === clientId && isNamedCompassLocation(location))
    .map((location) => {
      const locationDevices = devices.filter((device) => device.locationId === location.id);
      const ids = new Set(locationDevices.map((device) => device.id));
      const locationFindings = findings.filter((finding) => ids.has(finding.deviceId));
      const decisions = client.reviewOutcome.items.filter((item) => {
        if (item.locationIds?.includes(location.id)) return true;
        return item.deviceIds.some((id) => ids.has(id));
      });
      return {
        id: location.id,
        clientId,
        name: location.name.trim(),
        deviceIds: locationDevices.map((device) => device.id),
        physicalServers: locationDevices.filter((device) => device.deviceType === "physical-server").length,
        virtualServers: locationDevices.filter((device) => device.deviceType === "virtual-server").length,
        physicalWorkstations: locationDevices.filter((device) => device.deviceType === "physical-workstation").length,
        virtualWorkstations: locationDevices.filter((device) => device.deviceType === "virtual-workstation").length,
        replaceNow: locationDevices.filter((device) => device.lifecycle === "replace-now").length,
        planSoon: locationDevices.filter((device) => device.lifecycle === "plan-soon").length,
        windows10: unique(locationFindings.filter((finding) => finding.category === "windows-10-active").map((finding) => finding.deviceId)).length,
        storageAttention: unique(locationFindings.filter((finding) => finding.category === "critical-storage" || finding.category === "watch-storage" || finding.category === "critical-server-storage").map((finding) => finding.deviceId)).length,
        findingIds: locationFindings.map((finding) => finding.id),
        decisionIds: decisions.map((decision) => decision.id),
      };
    })
    .filter((snapshot) => snapshot.deviceIds.length || snapshot.findingIds.length || snapshot.decisionIds.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function totalPackagedValue(packages: CompassProjectPackage[]): number {
  return rounded(packages.filter((project) => project.includeInReport).reduce((total, project) => total + project.estimatedValue, 0));
}
