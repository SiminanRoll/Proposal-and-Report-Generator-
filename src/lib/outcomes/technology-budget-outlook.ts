import type { Project } from "@/lib/projects/types";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import type { CompassConfig } from "@/lib/compass/types";
import { compassLocationSnapshots, inventoryReportDevices, osSupportStatus } from "./client-report-data";

const COMPASS_CONFIG_KEY = "client-compass.configuration.v1";

export interface TechnologyBudgetLocationConcern {
  name: string;
  replaceNowServers: number;
  planSoonServers: number;
  replaceNow: number;
  planSoon: number;
  osConcerns: number;
  planningSignals: number;
}

export interface TechnologyBudgetOutlook {
  replaceNowServers: number;
  planSoonServers: number;
  planningServers: number;
  replaceNowWorkstations: number;
  planSoonWorkstations: number;
  planningWorkstations: number;
  osConcernSystems: number;
  replacementBudgetLow: number;
  replacementBudgetHigh: number;
  quarterlyBudgetLow: number;
  quarterlyBudgetHigh: number;
  serverReplacementBase: number;
  workstationReplacementUnit: number;
  incompleteServerAgeCount: number;
  incompleteWorkstationAgeCount: number;
  incompleteAgeCount: number;
  locations: TechnologyBudgetLocationConcern[];
}

function currentCompassConfig(): CompassConfig {
  if (typeof window === "undefined") return structuredClone(DEFAULT_COMPASS_CONFIG);
  try {
    const raw = window.localStorage.getItem(COMPASS_CONFIG_KEY);
    return raw ? normalizeCompassConfig(JSON.parse(raw) as unknown) : structuredClone(DEFAULT_COMPASS_CONFIG);
  } catch {
    return structuredClone(DEFAULT_COMPASS_CONFIG);
  }
}

function roundBudgetValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 100) * 100;
}

function isOsConcern(device: ReturnType<typeof inventoryReportDevices>[number]): boolean {
  const status = osSupportStatus(device);
  return status === "unsupported" || status === "ending-soon";
}

function isServer(device: ReturnType<typeof inventoryReportDevices>[number]): boolean {
  return device.type === "server" || device.type === "backup-server";
}

/** Mirrors the Compass server estimate: first physical server at full value,
 * then the saved multi-server multiplier for each additional server. The
 * planning contingency is applied later to the combined server + workstation
 * range so the same dollars are not counted twice.
 */
function serverReplacementBaseValue(count: number, config: CompassConfig): number {
  if (count <= 0) return 0;
  const first = Math.max(0, config.value.standardServerReplacement);
  const additional = Math.max(0, count - 1) * first * Math.max(0, config.value.multiServerAdditionalMultiplier);
  return first + additional;
}

export function technologyBudgetOutlook(project: Project, config: CompassConfig = currentCompassConfig()): TechnologyBudgetOutlook {
  const devices = inventoryReportDevices(project);
  const servers = devices.filter(isServer);
  const workstations = devices.filter((device) => device.type === "workstation");
  const replaceNowServers = servers.filter((device) => device.lifecycleStatus === "overdue").length;
  const planSoonServers = servers.filter((device) => device.lifecycleStatus === "due-soon").length;
  const planningServers = replaceNowServers + planSoonServers;
  const replaceNowWorkstations = workstations.filter((device) => device.lifecycleStatus === "overdue").length;
  const planSoonWorkstations = workstations.filter((device) => device.lifecycleStatus === "due-soon").length;
  const planningWorkstations = replaceNowWorkstations + planSoonWorkstations;
  const osConcernSystems = devices.filter((device) => device.type !== "network" && isOsConcern(device)).length;
  const incompleteServerAgeCount = servers.filter((device) => device.lifecycleStatus === "unknown" || !Number.isFinite(Number(device.age)) || Number(device.age) <= 0).length;
  const incompleteWorkstationAgeCount = workstations.filter((device) => device.lifecycleStatus === "unknown" || !Number.isFinite(Number(device.age)) || Number(device.age) <= 0).length;
  const incompleteAgeCount = incompleteServerAgeCount + incompleteWorkstationAgeCount;
  const serverReplacementBase = serverReplacementBaseValue(planningServers, config);
  const workstationReplacementUnit = Math.max(0, config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance);
  const workstationReplacementBase = planningWorkstations * workstationReplacementUnit;
  const baseReplacementValue = serverReplacementBase + workstationReplacementBase;
  const contingency = Math.max(0, config.value.planningContingencyPercent) / 100;
  const replacementBudgetLow = roundBudgetValue(baseReplacementValue);
  const replacementBudgetHigh = roundBudgetValue(baseReplacementValue * (1 + contingency));
  const quarterlyBudgetLow = replacementBudgetLow ? Math.round(replacementBudgetLow / 4) : 0;
  const quarterlyBudgetHigh = replacementBudgetHigh ? Math.round(replacementBudgetHigh / 4) : 0;

  const locations = compassLocationSnapshots(project)
    .map((location) => {
      const ids = new Set(location.deviceIds);
      const matched = devices.filter((device) =>
        (device.sourceDeviceId && ids.has(device.sourceDeviceId))
        || (device.sourceDeviceName && ids.has(device.sourceDeviceName))
        || ids.has(device.name)
        || (device.location && device.location === location.name)
      );
      const replaceNowServersAtLocation = matched.filter((device) => isServer(device) && device.lifecycleStatus === "overdue").length;
      const planSoonServersAtLocation = matched.filter((device) => isServer(device) && device.lifecycleStatus === "due-soon").length;
      const fallbackIsWorkstationOnly = !matched.length && location.physicalServers === 0 && location.virtualServers === 0;
      const replaceNow = matched.length
        ? matched.filter((device) => device.type === "workstation" && device.lifecycleStatus === "overdue").length
        : fallbackIsWorkstationOnly ? location.replaceNow : 0;
      const planSoon = matched.length
        ? matched.filter((device) => device.type === "workstation" && device.lifecycleStatus === "due-soon").length
        : fallbackIsWorkstationOnly ? location.planSoon : 0;
      const osConcerns = matched.filter((device) => device.type !== "network" && isOsConcern(device)).length;
      const planningSignals = replaceNowServersAtLocation + planSoonServersAtLocation + replaceNow + planSoon + osConcerns;
      return {
        name: location.name || "Location not specified",
        replaceNowServers: replaceNowServersAtLocation,
        planSoonServers: planSoonServersAtLocation,
        replaceNow,
        planSoon,
        osConcerns,
        planningSignals,
      };
    })
    .filter((location) => location.planningSignals > 0)
    .sort((a, b) =>
      (b.replaceNowServers - a.replaceNowServers)
      || (b.planSoonServers - a.planSoonServers)
      || (b.planningSignals - a.planningSignals)
      || (b.replaceNow + b.planSoon) - (a.replaceNow + a.planSoon)
      || b.osConcerns - a.osConcerns
      || a.name.localeCompare(b.name)
    )
    .slice(0, 3);

  return {
    replaceNowServers,
    planSoonServers,
    planningServers,
    replaceNowWorkstations,
    planSoonWorkstations,
    planningWorkstations,
    osConcernSystems,
    replacementBudgetLow,
    replacementBudgetHigh,
    quarterlyBudgetLow,
    quarterlyBudgetHigh,
    serverReplacementBase,
    workstationReplacementUnit,
    incompleteServerAgeCount,
    incompleteWorkstationAgeCount,
    incompleteAgeCount,
    locations,
  };
}

export function formatTechnologyBudgetMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function budgetRangeLabel(low: number, high: number, emptyLabel: string): string {
  if (!low && !high) return emptyLabel;
  if (low === high) return formatTechnologyBudgetMoney(low);
  return `${formatTechnologyBudgetMoney(low)} – ${formatTechnologyBudgetMoney(high)}`;
}

export function technologyBudgetRangeLabel(outlook: TechnologyBudgetOutlook): string {
  return budgetRangeLabel(outlook.replacementBudgetLow, outlook.replacementBudgetHigh, "$0 currently identified");
}

export function technologyBudgetQuarterlyRangeLabel(outlook: TechnologyBudgetOutlook): string {
  return budgetRangeLabel(outlook.quarterlyBudgetLow, outlook.quarterlyBudgetHigh, "$0 currently identified");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function devicePhrase(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function replacementTimingSummary(replaceNow: number, planSoon: number, noun: string): string {
  const parts: string[] = [];
  if (replaceNow) parts.push(`${replaceNow} ${noun}${replaceNow === 1 ? "" : "s"} due now`);
  if (planSoon) parts.push(`${planSoon} ${noun}${planSoon === 1 ? "" : "s"} upcoming`);
  return parts.join(" · ");
}

function locationPlanningSummary(location: TechnologyBudgetLocationConcern): string {
  const parts: string[] = [];
  const serverSummary = replacementTimingSummary(location.replaceNowServers, location.planSoonServers, "server");
  const workstationSummary = replacementTimingSummary(location.replaceNow, location.planSoon, "workstation");
  if (serverSummary) parts.push(serverSummary);
  if (workstationSummary) parts.push(workstationSummary);
  if (location.osConcerns) parts.push(`${location.osConcerns} OS item${location.osConcerns === 1 ? "" : "s"} to review`);
  return parts.join(" · ") || "No known needs currently identified";
}

function budgetScopeCopy(outlook: TechnologyBudgetOutlook): string {
  if (outlook.planningServers && outlook.planningWorkstations) return "the server and workstation replacements we can currently see coming";
  if (outlook.planningServers) return "the server replacement needs we can currently see coming";
  if (outlook.planningWorkstations) return "the workstation replacements we can currently see coming";
  return "the replacement needs we can currently identify";
}

function completenessHtml(outlook: TechnologyBudgetOutlook): string {
  if (!outlook.incompleteAgeCount) return `<div style="margin-top:12px;padding:11px 13px;border:1px solid #bfe0d5;border-radius:12px;background:#edf9f5;color:#286d5d;font-size:7.2pt;line-height:1.4"><strong>Lifecycle age data is complete.</strong> This gives us a solid starting point for the next 12 months, though final equipment choices and installation needs may change the actual cost.</div>`;
  const missing: string[] = [];
  if (outlook.incompleteServerAgeCount) missing.push(devicePhrase(outlook.incompleteServerAgeCount, "server"));
  if (outlook.incompleteWorkstationAgeCount) missing.push(devicePhrase(outlook.incompleteWorkstationAgeCount, "workstation"));
  return `<div style="margin-top:12px;padding:11px 13px;border:1px solid #e4cf8a;border-radius:12px;background:#fff9e9;color:#6e5a20;font-size:7.2pt;line-height:1.4"><strong>There may be additional future needs.</strong> We still need to verify the age of ${escapeHtml(missing.join(" and "))}, so this budget reflects the equipment we can confidently plan around today.</div>`;
}

export function technologyBudgetOutlookPdfPage(project: Project): string {
  const outlook = technologyBudgetOutlook(project);
  const quarterlyRange = technologyBudgetQuarterlyRangeLabel(outlook);
  const totalRange = technologyBudgetRangeLabel(outlook);
  const locationHtml = outlook.locations.length
    ? outlook.locations.map((location) => `<article style="padding:12px 14px;border:1px solid #d7e4ef;border-radius:13px;background:#f8fbfe"><strong style="display:block;font-size:10.5pt;color:#112742">${escapeHtml(location.name)}</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt;line-height:1.35">${escapeHtml(locationPlanningSummary(location))}</span></article>`).join("")
    : `<article style="padding:12px 14px;border:1px solid #d9e4f0;border-radius:13px;background:#f8fbfe"><strong style="display:block;font-size:10pt;color:#112742">No replacement needs currently identified</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt">We can revisit this as equipment ages and needs are confirmed.</span></article>`;
  const serverDueCopy = replacementTimingSummary(outlook.replaceNowServers, outlook.planSoonServers, "server");
  const workstationDueCopy = replacementTimingSummary(outlook.replaceNowWorkstations, outlook.planSoonWorkstations, "workstation");
  const primaryPlanning = outlook.planningServers
    ? `<strong style="display:block;margin-top:7px;font-size:22pt;color:#112742">${outlook.planningServers}</strong><span style="display:block;margin-top:1px;color:#425b74;font-size:8pt;font-weight:800">server${outlook.planningServers === 1 ? "" : "s"} over the next 12 months</span><p style="margin:8px 0 0;color:#62748a;font-size:7.1pt;line-height:1.4">${escapeHtml(serverDueCopy)}</p>`
    : "";
  const workstationPlanning = outlook.planningWorkstations
    ? `<p style="margin:${outlook.planningServers ? "9px" : "7px"} 0 0;color:#425b74;font-size:7.4pt;line-height:1.4"><strong>${devicePhrase(outlook.planningWorkstations, "workstation")}</strong> over the next 12 months${workstationDueCopy ? ` · ${escapeHtml(workstationDueCopy)}` : ""}</p>`
    : "";
  const noPlanning = !outlook.planningServers && !outlook.planningWorkstations
    ? `<p style="margin:8px 0 0;color:#62748a;font-size:7.1pt;line-height:1.4">No server or workstation replacements currently identified.</p>`
    : "";
  return `<section class="pdf-page pdf-budget-outlook" data-pdf-page="true" style="position:relative;padding:.30in .34in .32in;background:linear-gradient(145deg,#f7fbff,#fff 66%);color:#0b1830"><span style="display:block;color:#147f8f;font-size:7pt;font-weight:850;letter-spacing:.12em;text-transform:uppercase">Technology Planning</span><h2 style="margin:.05in 0 .06in;font-size:24pt;line-height:1.02">Plan ahead for upcoming technology needs</h2><p style="max-width:8.8in;margin:0;color:#62748a;font-size:8.4pt;line-height:1.42">Based on the equipment we reviewed, here is a practical starting point for budgeting over the next year. The goal is to spread known technology needs across the year instead of treating every replacement as a one-time surprise.</p><div style="display:grid;grid-template-columns:1.18fr .82fr;gap:12px;margin-top:15px"><article style="padding:18px;border-radius:16px;background:linear-gradient(135deg,#116f83,#188da0);color:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#d8f7fa">Suggested quarterly technology budget</span><strong style="display:block;margin-top:7px;font-size:26pt;line-height:1">${escapeHtml(quarterlyRange)}</strong><p style="margin:8px 0 0;color:#e9fbfc;font-size:7.3pt;line-height:1.42">Setting aside roughly this amount each quarter would cover ${escapeHtml(budgetScopeCopy(outlook))} over the next 12 months.</p></article><article style="padding:16px;border:1px solid #d7e4ef;border-radius:16px;background:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#6b8198">What we are planning around</span>${primaryPlanning}${workstationPlanning}${noPlanning}<p style="margin:8px 0 0;color:#62748a;font-size:7.1pt;line-height:1.4"><strong style="color:#315a75">${outlook.osConcernSystems} OS item${outlook.osConcernSystems === 1 ? "" : "s"} to evaluate.</strong> Some may be resolved through upgrades rather than replacement.</p></article></div><article style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding:13px 15px;border:1px solid #d7e4ef;border-radius:14px;background:#fff"><div><span style="display:block;color:#6b8198;font-size:6.7pt;font-weight:850;letter-spacing:.09em;text-transform:uppercase">Current 12-month technology estimate</span><span style="display:block;margin-top:4px;color:#62748a;font-size:7.1pt;line-height:1.35">Planning estimate only. Actual equipment selections and installation needs may change the final cost.</span></div><strong style="white-space:nowrap;color:#143c5a;font-size:19pt">${escapeHtml(totalRange)}</strong></article><div style="margin-top:13px"><span style="display:block;margin-bottom:7px;color:#6b8198;font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase">Where upcoming needs are concentrated</span><div style="display:grid;grid-template-columns:repeat(${Math.min(3, Math.max(1, outlook.locations.length))},1fr);gap:8px">${locationHtml}</div></div>${completenessHtml(outlook)}</section>`;
}

export function injectTechnologyBudgetOutlookPdf(html: string, project: Project): string {
  const page = technologyBudgetOutlookPdfPage(project);
  const recapMarkers = [
    '<section class="pdf-page pdf-client-success-page',
    '<section class="pdf-page pdf-recap',
    '<section class="pdf-recap',
    '<section class="print-report pdf-recap',
  ];
  for (const marker of recapMarkers) {
    const index = html.lastIndexOf(marker);
    if (index >= 0) return `${html.slice(0, index)}${page}${html.slice(index)}`;
  }
  const toolbarIndex = html.lastIndexOf('<div class="toolbar">');
  return toolbarIndex >= 0 ? `${html.slice(0, toolbarIndex)}${page}${html.slice(toolbarIndex)}` : html.replace("</main>", `${page}</main>`);
}
