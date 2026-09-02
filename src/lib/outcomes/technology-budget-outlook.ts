import type { Project } from "@/lib/projects/types";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import type { CompassConfig } from "@/lib/compass/types";
import { compassLocationSnapshots, inventoryReportDevices } from "./client-report-data";

const COMPASS_CONFIG_KEY = "client-compass.configuration.v1";

export interface TechnologyBudgetLocationConcern {
  name: string;
  replaceNow: number;
  planSoon: number;
  windows10: number;
  concernSignals: number;
}

export interface TechnologyBudgetOutlook {
  replaceNowWorkstations: number;
  planSoonWorkstations: number;
  windows10Systems: number;
  nearTermWorkstations: number;
  planningRangeLow: number;
  planningRangeHigh: number;
  quarterlyRangeLow: number;
  quarterlyRangeHigh: number;
  workstationPlanningUnit: number;
  incompleteLifecycleCount: number;
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

function roundPlanningValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / 100) * 100;
}

export function technologyBudgetOutlook(project: Project, config: CompassConfig = currentCompassConfig()): TechnologyBudgetOutlook {
  const devices = inventoryReportDevices(project);
  const workstations = devices.filter((device) => device.type === "workstation");
  const replaceNowWorkstations = workstations.filter((device) => device.lifecycleStatus === "overdue").length;
  const planSoonWorkstations = workstations.filter((device) => device.lifecycleStatus === "due-soon").length;
  const windows10Systems = devices.filter((device) => (device.type === "workstation" || device.type === "vm") && /Windows\s*10/i.test(device.os || "")).length;
  const incompleteLifecycleCount = workstations.filter((device) => device.lifecycleStatus === "unknown" || !Number.isFinite(Number(device.age)) || Number(device.age) <= 0).length;
  const nearTermWorkstations = replaceNowWorkstations + planSoonWorkstations;
  const workstationPlanningUnit = Math.max(0, config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance);
  const basePlanningValue = nearTermWorkstations * workstationPlanningUnit;
  const contingency = Math.max(0, config.value.planningContingencyPercent) / 100;
  const planningRangeLow = roundPlanningValue(basePlanningValue);
  const planningRangeHigh = roundPlanningValue(basePlanningValue * (1 + contingency));
  const quarterlyRangeLow = roundPlanningValue(planningRangeLow / 4);
  const quarterlyRangeHigh = roundPlanningValue(planningRangeHigh / 4);

  const locations = compassLocationSnapshots(project)
    .map((location) => ({
      name: location.name || "Location not specified",
      replaceNow: location.replaceNow,
      planSoon: location.planSoon,
      windows10: location.windows10,
      concernSignals: location.replaceNow + location.planSoon + location.windows10,
    }))
    .filter((location) => location.concernSignals > 0)
    .sort((a, b) => b.concernSignals - a.concernSignals || b.replaceNow - a.replaceNow || b.windows10 - a.windows10 || a.name.localeCompare(b.name))
    .slice(0, 3);

  return {
    replaceNowWorkstations,
    planSoonWorkstations,
    windows10Systems,
    nearTermWorkstations,
    planningRangeLow,
    planningRangeHigh,
    quarterlyRangeLow,
    quarterlyRangeHigh,
    workstationPlanningUnit,
    incompleteLifecycleCount,
    locations,
  };
}

export function formatTechnologyBudgetMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function technologyBudgetRangeLabel(outlook: TechnologyBudgetOutlook): string {
  if (!outlook.nearTermWorkstations) return "$0 currently identified";
  if (outlook.planningRangeLow === outlook.planningRangeHigh) return formatTechnologyBudgetMoney(outlook.planningRangeLow);
  return `${formatTechnologyBudgetMoney(outlook.planningRangeLow)} – ${formatTechnologyBudgetMoney(outlook.planningRangeHigh)}`;
}

export function technologyQuarterlyRangeLabel(outlook: TechnologyBudgetOutlook): string {
  if (!outlook.nearTermWorkstations) return "$0 per quarter currently identified";
  if (outlook.quarterlyRangeLow === outlook.quarterlyRangeHigh) return `${formatTechnologyBudgetMoney(outlook.quarterlyRangeLow)} per quarter`;
  return `${formatTechnologyBudgetMoney(outlook.quarterlyRangeLow)} – ${formatTechnologyBudgetMoney(outlook.quarterlyRangeHigh)} per quarter`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function technologyBudgetOutlookPdfPage(project: Project): string {
  const outlook = technologyBudgetOutlook(project);
  const locationHtml = outlook.locations.length
    ? outlook.locations.map((location) => `<article style="padding:12px 14px;border:1px solid #d9e4f0;border-radius:13px;background:#fff"><strong style="display:block;font-size:11pt;color:#112742">${escapeHtml(location.name)}</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt;line-height:1.35">${location.replaceNow} replace now · ${location.planSoon} plan soon · ${location.windows10} Windows 10</span></article>`).join("")
    : `<article style="padding:12px 14px;border:1px solid #d9e4f0;border-radius:13px;background:#fff"><strong style="display:block;font-size:10pt;color:#112742">No location-specific concerns currently identified</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt">The current report data does not identify a concentration of workstation age or Windows 10 concerns by office.</span></article>`;
  const completeness = outlook.incompleteLifecycleCount
    ? `<div style="margin-top:12px;padding:11px 13px;border:1px solid #e3c879;border-radius:12px;background:#fff8e4;color:#6f5410;font-size:7.2pt;line-height:1.4"><strong>Planning data still needs verification.</strong> ${outlook.incompleteLifecycleCount} workstation${outlook.incompleteLifecycleCount === 1 ? " has" : "s have"} incomplete age data. The final replacement scope and budget may change after those systems are verified.</div>`
    : `<div style="margin-top:12px;padding:11px 13px;border:1px solid #bfe0d5;border-radius:12px;background:#edf9f5;color:#286d5d;font-size:7.2pt;line-height:1.4"><strong>Age data is complete for the workstations included in this planning view.</strong> Final equipment selections and installation requirements can still change the actual project cost.</div>`;
  const budgetRange = technologyBudgetRangeLabel(outlook);
  const quarterlyRange = technologyQuarterlyRangeLabel(outlook);
  return `<section class="pdf-page pdf-budget-outlook" data-pdf-page="true" style="position:relative;padding:.28in .34in .32in;background:linear-gradient(145deg,#f7faff,#fff 62%);color:#0b1830"><span style="display:block;color:#3975b8;font-size:7pt;font-weight:850;letter-spacing:.12em;text-transform:uppercase">Technology Budget Outlook</span><h2 style="margin:.05in 0 .06in;font-size:25pt;line-height:1.02">What should we plan to budget for soon?</h2><p style="max-width:8.7in;margin:0;color:#62748a;font-size:8.5pt;line-height:1.42">A simple planning view based on the workstation age and operating-system information in this report. This is budgeting guidance, not a formal quote.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:15px"><article style="padding:13px;border:1px solid #ebc6bd;border-top:4px solid #d95f43;border-radius:13px;background:#fff"><strong style="display:block;font-size:25pt">${outlook.replaceNowWorkstations}</strong><span style="font-size:7pt;font-weight:850;text-transform:uppercase">Replace Now workstations</span></article><article style="padding:13px;border:1px solid #ead9af;border-top:4px solid #c68a18;border-radius:13px;background:#fff"><strong style="display:block;font-size:25pt">${outlook.planSoonWorkstations}</strong><span style="font-size:7pt;font-weight:850;text-transform:uppercase">Plan Soon workstations</span></article><article style="padding:13px;border:1px solid #c9dff5;border-top:4px solid #1766de;border-radius:13px;background:#fff"><strong style="display:block;font-size:25pt">${outlook.windows10Systems}</strong><span style="font-size:7pt;font-weight:850;text-transform:uppercase">Windows 10 systems to review</span></article></div><div style="display:grid;grid-template-columns:1.12fr .88fr;gap:12px;margin-top:13px"><article style="padding:16px;border-radius:15px;background:linear-gradient(135deg,#0d315f,#15589b);color:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#add3ff">Rough near-term workstation planning range</span><strong style="display:block;margin-top:6px;font-size:23pt;line-height:1">${escapeHtml(budgetRange)}</strong><p style="margin:7px 0 0;color:#d5e6f7;font-size:7.1pt;line-height:1.4">Based on ${outlook.nearTermWorkstations} Replace Now + Plan Soon workstation${outlook.nearTermWorkstations === 1 ? "" : "s"} and the current Client Compass workstation planning assumptions. Not a formal quote.</p></article><article style="padding:16px;border:1px solid #cfe0ef;border-radius:15px;background:#f0f6fb"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#4b6c90">Example four-quarter budget pace</span><strong style="display:block;margin-top:6px;font-size:18pt;color:#112742">${escapeHtml(quarterlyRange)}</strong><p style="margin:7px 0 0;color:#62748a;font-size:7.1pt;line-height:1.4">Illustrative budgeting pace if the same planning range were spread evenly across four quarters. This is not financing or a payment plan.</p></article></div><div style="margin-top:13px"><span style="display:block;margin-bottom:7px;color:#4e6b8b;font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase">Locations with the most OS & age concerns</span><div style="display:grid;grid-template-columns:repeat(${Math.min(3, Math.max(1, outlook.locations.length))},1fr);gap:8px">${locationHtml}</div></div>${completeness}</section>`;
}

export function injectTechnologyBudgetOutlookPdf(html: string, project: Project): string {
  const page = technologyBudgetOutlookPdfPage(project);
  const recapMarkers = [
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
