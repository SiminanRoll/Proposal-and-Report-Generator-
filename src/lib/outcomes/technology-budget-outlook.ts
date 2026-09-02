import type { Project } from "@/lib/projects/types";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import type { CompassConfig } from "@/lib/compass/types";
import { compassLocationSnapshots, inventoryReportDevices, osSupportStatus } from "./client-report-data";

const COMPASS_CONFIG_KEY = "client-compass.configuration.v1";

export interface TechnologyBudgetLocationConcern {
  name: string;
  replaceNow: number;
  osConcerns: number;
  attentionSignals: number;
}

export interface TechnologyBudgetOutlook {
  replaceNowWorkstations: number;
  osConcernSystems: number;
  replacementBudgetLow: number;
  replacementBudgetHigh: number;
  workstationReplacementUnit: number;
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

export function technologyBudgetOutlook(project: Project, config: CompassConfig = currentCompassConfig()): TechnologyBudgetOutlook {
  const devices = inventoryReportDevices(project);
  const workstations = devices.filter((device) => device.type === "workstation");
  const replaceNowWorkstations = workstations.filter((device) => device.lifecycleStatus === "overdue").length;
  const osConcernSystems = devices.filter((device) => device.type !== "network" && isOsConcern(device)).length;
  const incompleteAgeCount = workstations.filter((device) => device.lifecycleStatus === "unknown" || !Number.isFinite(Number(device.age)) || Number(device.age) <= 0).length;
  const workstationReplacementUnit = Math.max(0, config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance);
  const baseReplacementValue = replaceNowWorkstations * workstationReplacementUnit;
  const contingency = Math.max(0, config.value.planningContingencyPercent) / 100;
  const replacementBudgetLow = roundBudgetValue(baseReplacementValue);
  const replacementBudgetHigh = roundBudgetValue(baseReplacementValue * (1 + contingency));

  const locations = compassLocationSnapshots(project)
    .map((location) => {
      const ids = new Set(location.deviceIds);
      const matched = devices.filter((device) =>
        (device.sourceDeviceId && ids.has(device.sourceDeviceId))
        || (device.sourceDeviceName && ids.has(device.sourceDeviceName))
        || ids.has(device.name)
        || (device.location && device.location === location.name)
      );
      const replaceNow = matched.length
        ? matched.filter((device) => device.type === "workstation" && device.lifecycleStatus === "overdue").length
        : location.replaceNow;
      const osConcerns = matched.filter((device) => device.type !== "network" && isOsConcern(device)).length;
      const attentionSignals = matched.filter((device) =>
        (device.type === "workstation" && device.lifecycleStatus === "overdue") || (device.type !== "network" && isOsConcern(device))
      ).length;
      return {
        name: location.name || "Location not specified",
        replaceNow,
        osConcerns,
        attentionSignals: attentionSignals || replaceNow + osConcerns,
      };
    })
    .filter((location) => location.replaceNow > 0 || location.osConcerns > 0)
    .sort((a, b) => b.attentionSignals - a.attentionSignals || b.replaceNow - a.replaceNow || b.osConcerns - a.osConcerns || a.name.localeCompare(b.name))
    .slice(0, 3);

  return {
    replaceNowWorkstations,
    osConcernSystems,
    replacementBudgetLow,
    replacementBudgetHigh,
    workstationReplacementUnit,
    incompleteAgeCount,
    locations,
  };
}

export function formatTechnologyBudgetMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function technologyBudgetRangeLabel(outlook: TechnologyBudgetOutlook): string {
  if (!outlook.replaceNowWorkstations) return "$0 currently identified";
  if (outlook.replacementBudgetLow === outlook.replacementBudgetHigh) return formatTechnologyBudgetMoney(outlook.replacementBudgetLow);
  return `${formatTechnologyBudgetMoney(outlook.replacementBudgetLow)} – ${formatTechnologyBudgetMoney(outlook.replacementBudgetHigh)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function technologyBudgetOutlookPdfPage(project: Project): string {
  const outlook = technologyBudgetOutlook(project);
  const locationHtml = outlook.locations.length
    ? outlook.locations.map((location) => `<article style="padding:12px 14px;border:1px solid #efd0c8;border-radius:13px;background:#fff8f6"><strong style="display:block;font-size:11pt;color:#112742">${escapeHtml(location.name)}</strong><span style="display:block;margin-top:5px;color:#7f5b54;font-size:7.2pt;line-height:1.35">${location.replaceNow} replace now · ${location.osConcerns} OS concerns</span></article>`).join("")
    : `<article style="padding:12px 14px;border:1px solid #d9e4f0;border-radius:13px;background:#fff"><strong style="display:block;font-size:10pt;color:#112742">No red workstation or OS items currently identified</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt">This budget view intentionally excludes non-red items.</span></article>`;
  const completeness = outlook.incompleteAgeCount
    ? `<div style="margin-top:12px;padding:11px 13px;border:1px solid #e3c879;border-radius:12px;background:#fff8e4;color:#6f5410;font-size:7.2pt;line-height:1.4"><strong>Some ages still need verification.</strong> ${outlook.incompleteAgeCount} workstation${outlook.incompleteAgeCount === 1 ? " has" : "s have"} no usable age and ${outlook.incompleteAgeCount === 1 ? "is" : "are"} not included in this red-only replacement budget until verified.</div>`
    : `<div style="margin-top:12px;padding:11px 13px;border:1px solid #bfe0d5;border-radius:12px;background:#edf9f5;color:#286d5d;font-size:7.2pt;line-height:1.4"><strong>Age data is complete for the workstations in this view.</strong> Final equipment selections and installation requirements can still change the actual project cost.</div>`;
  const budgetRange = technologyBudgetRangeLabel(outlook);
  return `<section class="pdf-page pdf-budget-outlook" data-pdf-page="true" style="position:relative;padding:.28in .34in .32in;background:linear-gradient(145deg,#fff8f6,#fff 62%);color:#0b1830"><span style="display:block;color:#c45036;font-size:7pt;font-weight:850;letter-spacing:.12em;text-transform:uppercase">Technology Budget</span><h2 style="margin:.05in 0 .06in;font-size:25pt;line-height:1.02">What needs attention now?</h2><p style="max-width:8.9in;margin:0;color:#62748a;font-size:8.5pt;line-height:1.42">A simple red-only view of the items already needing attention in this report. The replacement budget applies only to workstations marked Replace Now. OS concerns are shown separately because some can be resolved without replacing the computer.</p><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:15px"><article style="padding:13px;border:1px solid #ebc6bd;border-top:4px solid #c45036;border-radius:13px;background:#fff"><strong style="display:block;font-size:25pt;color:#b5442d">${outlook.replaceNowWorkstations}</strong><span style="font-size:7pt;font-weight:850;text-transform:uppercase;color:#7f463a">Replace Now workstations</span></article><article style="padding:13px;border:1px solid #ebc6bd;border-top:4px solid #c45036;border-radius:13px;background:#fff"><strong style="display:block;font-size:25pt;color:#b5442d">${outlook.osConcernSystems}</strong><span style="font-size:7pt;font-weight:850;text-transform:uppercase;color:#7f463a">OS concerns</span></article></div><div style="display:grid;grid-template-columns:1.18fr .82fr;gap:12px;margin-top:13px"><article style="padding:17px;border-radius:15px;background:linear-gradient(135deg,#7f2f22,#b84b35);color:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#ffd7cf">Rough workstation replacement budget</span><strong style="display:block;margin-top:6px;font-size:24pt;line-height:1">${escapeHtml(budgetRange)}</strong><p style="margin:7px 0 0;color:#ffe7e1;font-size:7.1pt;line-height:1.4">Based on ${outlook.replaceNowWorkstations} workstation${outlook.replaceNowWorkstations === 1 ? "" : "s"} already marked Replace Now and the current Client Compass workstation and deployment assumptions. Not a formal quote.</p></article><article style="padding:16px;border:1px solid #e6d5d0;border-radius:15px;background:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#8d6258">What the number includes</span><strong style="display:block;margin-top:6px;font-size:13pt;color:#112742">Red replacement items only</strong><p style="margin:7px 0 0;color:#62748a;font-size:7.1pt;line-height:1.45">OS concerns are visible here but are not automatically added as workstation replacements. Non-red items are not included in this budget.</p></article></div><div style="margin-top:13px"><span style="display:block;margin-bottom:7px;color:#8d6258;font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase">Where the red items are concentrated</span><div style="display:grid;grid-template-columns:repeat(${Math.min(3, Math.max(1, outlook.locations.length))},1fr);gap:8px">${locationHtml}</div></div>${completeness}</section>`;
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
