from pathlib import Path

component = r'''"use client";

import { useState, type CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import {
  technologyBudgetOutlook,
  technologyBudgetQuarterlyRangeLabel,
  technologyBudgetRangeLabel,
} from "@/lib/outcomes/technology-budget-outlook";

export function TechnologyBudgetOutlookToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label style={toggleShellStyle}>
    <span style={{ minWidth: 0 }}><strong style={toggleTitleStyle}>Include Technology Budget</strong><small style={toggleHelpStyle}>Optional 12-month technology planning page</small></span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ ...toggleButtonStyle, ...(checked ? toggleButtonOnStyle : {}) }}
    >{checked ? "On" : "Off"}</button>
  </label>;
}

export function TechnologyBudgetOutlookPresentation({ project }: { project: Project }) {
  const outlook = technologyBudgetOutlook(project);
  const quarterlyRange = technologyBudgetQuarterlyRangeLabel(outlook);
  const totalRange = technologyBudgetRangeLabel(outlook);
  const [showTotal, setShowTotal] = useState(false);
  const quarterCopy = outlook.planningWorkstations
    ? "Setting aside roughly this amount each quarter would cover the workstation replacements we can currently see coming over the next 12 months."
    : "No workstation replacement budget is currently identified. We can revisit this as equipment ages and needs are confirmed.";
  const dueCopy = outlook.replaceNowWorkstations && outlook.planSoonWorkstations
    ? `${outlook.replaceNowWorkstations} already due · ${outlook.planSoonWorkstations} approaching replacement age`
    : outlook.replaceNowWorkstations
      ? `${outlook.replaceNowWorkstations} already due for replacement`
      : outlook.planSoonWorkstations
        ? `${outlook.planSoonWorkstations} approaching replacement age`
        : "No workstation replacements currently identified";

  return <div style={slideStyle}>
    <div style={headingStyle}>
      <span style={kickerStyle}>Technology Planning</span>
      <h2 style={titleStyle}>Plan ahead for upcoming technology needs</h2>
      <p style={subtitleStyle}>Based on the equipment we reviewed, here is a practical starting point for budgeting over the next year. The goal is to spread known needs across the year instead of treating every replacement as a one-time surprise.</p>
    </div>

    <div style={planningGridStyle}>
      <button
        type="button"
        onClick={() => setShowTotal((value) => !value)}
        aria-label={showTotal ? "Show quarterly technology budget" : "Show full-year technology estimate"}
        style={flipButtonStyle}
      >
        <span style={{ ...flipInnerStyle, transform: showTotal ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <span style={{ ...flipFaceStyle, ...quarterCardStyle }}>
            <span style={heroKickerStyle}>Suggested quarterly technology budget</span>
            <strong style={heroValueStyle}>{quarterlyRange}</strong>
            <span style={heroCopyStyle}>{quarterCopy}</span>
            <span style={flipHintStyle}>Click to view the full-year estimate →</span>
          </span>
          <span style={{ ...flipFaceStyle, ...flipBackStyle, ...totalCardStyle }}>
            <span style={heroKickerStyle}>Current 12-month workstation estimate</span>
            <strong style={heroValueStyle}>{totalRange}</strong>
            <span style={heroCopyStyle}>Based on {outlook.planningWorkstations} workstation{outlook.planningWorkstations === 1 ? "" : "s"} we can currently identify for replacement planning over the next year.</span>
            <span style={flipHintStyle}>Planning estimate only · Click to return to quarterly view</span>
          </span>
        </span>
      </button>

      <article style={contextCardStyle}>
        <span style={contextKickerStyle}>What we are planning around</span>
        <div style={workstationCountStyle}><strong style={contextValueStyle}>{outlook.planningWorkstations}</strong><span style={contextValueLabelStyle}>workstation{outlook.planningWorkstations === 1 ? "" : "s"}<br />over the next 12 months</span></div>
        <p style={contextCopyStyle}>{dueCopy}</p>
        <div style={contextDividerStyle} />
        <strong style={osValueStyle}>{outlook.osConcernSystems} OS item{outlook.osConcernSystems === 1 ? "" : "s"} to evaluate</strong>
        <p style={osCopyStyle}>Some operating system concerns may be resolved through upgrades rather than replacing the computer, so they are reviewed separately from the workstation budget.</p>
      </article>
    </div>

    <div style={locationsWrapStyle}>
      <span style={locationsKickerStyle}>Where upcoming needs are concentrated</span>
      <div style={{ ...locationsGridStyle, gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, outlook.locations.length))}, minmax(0, 1fr))` }}>
        {outlook.locations.length ? outlook.locations.map((location) => <article key={location.name} style={locationCardStyle}>
          <strong style={locationTitleStyle}>{location.name}</strong>
          <span style={locationCopyStyle}>{locationSummary(location)}</span>
        </article>) : <article style={locationCardStyle}><strong style={locationTitleStyle}>No workstation replacements currently identified</strong><span style={locationCopyStyle}>We can revisit this as equipment ages and needs are confirmed.</span></article>}
      </div>
    </div>

    <div style={outlook.incompleteAgeCount ? incompleteStyle : completeStyle}>
      <strong>{outlook.incompleteAgeCount ? "There may be additional future needs." : "Workstation age data is complete."}</strong>
      <span>{outlook.incompleteAgeCount ? ` We still need to verify the age of ${outlook.incompleteAgeCount} workstation${outlook.incompleteAgeCount === 1 ? "" : "s"}, so this budget reflects the equipment we can confidently plan around today.` : " This gives us a solid starting point for the next 12 months, though final equipment choices and installation needs may change the actual cost."}</span>
    </div>
  </div>;
}

function locationSummary(location: { replaceNow: number; planSoon: number; osConcerns: number }): string {
  const parts: string[] = [];
  if (location.replaceNow) parts.push(`${location.replaceNow} due now`);
  if (location.planSoon) parts.push(`${location.planSoon} upcoming`);
  if (location.osConcerns) parts.push(`${location.osConcerns} OS item${location.osConcerns === 1 ? "" : "s"} to review`);
  return parts.join(" · ") || "No known needs currently identified";
}

const toggleShellStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid #d2deeb", borderRadius: 14, background: "#f8fbff", color: "#193553" };
const toggleTitleStyle: CSSProperties = { display: "block", fontSize: 12, lineHeight: 1.15 };
const toggleHelpStyle: CSSProperties = { display: "block", marginTop: 2, color: "#718299", fontSize: 10, whiteSpace: "nowrap" };
const toggleButtonStyle: CSSProperties = { minWidth: 46, border: "1px solid #c8d6e6", borderRadius: 999, padding: "7px 10px", background: "#fff", color: "#64758a", fontSize: 11, fontWeight: 850, cursor: "pointer" };
const toggleButtonOnStyle: CSSProperties = { borderColor: "#2e9daf", background: "#e8f8fa", color: "#146f7d" };
const slideStyle: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", gap: 18, padding: "2.2vh 3.2vw", color: "#f7fbff" };
const headingStyle: CSSProperties = { maxWidth: 1060 };
const kickerStyle: CSSProperties = { display: "block", color: "#68d1dd", fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { margin: "8px 0 8px", fontSize: "clamp(34px,4vw,64px)", lineHeight: .99, letterSpacing: "-.035em" };
const subtitleStyle: CSSProperties = { maxWidth: 1060, margin: 0, color: "#c8d4e2", fontSize: "clamp(14px,1.18vw,19px)", lineHeight: 1.45 };
const planningGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.18fr .82fr", gap: 16, alignItems: "stretch" };
const flipButtonStyle: CSSProperties = { minHeight: 220, padding: 0, border: 0, borderRadius: 22, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", perspective: "1200px" };
const flipInnerStyle: CSSProperties = { position: "relative", display: "block", width: "100%", height: "100%", minHeight: 220, transformStyle: "preserve-3d", transition: "transform .55s cubic-bezier(.2,.75,.25,1)" };
const flipFaceStyle: CSSProperties = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 26px", borderRadius: 22, WebkitBackfaceVisibility: "hidden", backfaceVisibility: "hidden", boxShadow: "0 18px 42px #03152a35" };
const flipBackStyle: CSSProperties = { transform: "rotateY(180deg)" };
const quarterCardStyle: CSSProperties = { border: "1px solid #72d7df55", background: "linear-gradient(135deg,#106f82,#178da0 64%,#1b7c9c)" };
const totalCardStyle: CSSProperties = { border: "1px solid #75a9d655", background: "linear-gradient(135deg,#174f78,#1c6594 64%,#245b86)" };
const heroKickerStyle: CSSProperties = { color: "#d9fbfd", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const heroValueStyle: CSSProperties = { display: "block", marginTop: 8, color: "#fff", fontSize: "clamp(36px,3.5vw,58px)", lineHeight: 1, letterSpacing: "-.03em" };
const heroCopyStyle: CSSProperties = { display: "block", maxWidth: 760, marginTop: 11, color: "#e8f9fb", fontSize: 13, lineHeight: 1.45 };
const flipHintStyle: CSSProperties = { display: "block", marginTop: 15, color: "#bfeef3", fontSize: 11, fontWeight: 800 };
const contextCardStyle: CSSProperties = { padding: "22px 24px", border: "1px solid #ffffff26", borderRadius: 22, background: "linear-gradient(145deg,#ffffff12,#ffffff08)", boxShadow: "0 18px 42px #03152a24" };
const contextKickerStyle: CSSProperties = { color: "#a9bed2", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const workstationCountStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginTop: 8 };
const contextValueStyle: CSSProperties = { color: "#fff", fontSize: "clamp(34px,3vw,52px)", lineHeight: 1 };
const contextValueLabelStyle: CSSProperties = { color: "#d3dfeb", fontSize: 12, fontWeight: 800, lineHeight: 1.25 };
const contextCopyStyle: CSSProperties = { margin: "8px 0 0", color: "#b9cbe0", fontSize: 12, lineHeight: 1.4 };
const contextDividerStyle: CSSProperties = { height: 1, margin: "14px 0 12px", background: "#ffffff1d" };
const osValueStyle: CSSProperties = { display: "block", color: "#9fe3ea", fontSize: 14 };
const osCopyStyle: CSSProperties = { margin: "6px 0 0", color: "#b9cbe0", fontSize: 11.5, lineHeight: 1.42 };
const locationsWrapStyle: CSSProperties = { display: "grid", gap: 8 };
const locationsKickerStyle: CSSProperties = { color: "#9db4ca", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const locationsGridStyle: CSSProperties = { display: "grid", gap: 10 };
const locationCardStyle: CSSProperties = { padding: "13px 15px", border: "1px solid #ffffff20", borderRadius: 15, background: "#ffffff09" };
const locationTitleStyle: CSSProperties = { display: "block", fontSize: 15 };
const locationCopyStyle: CSSProperties = { display: "block", marginTop: 4, color: "#b9cbe0", fontSize: 12, lineHeight: 1.35 };
const incompleteStyle: CSSProperties = { padding: "11px 14px", border: "1px solid #cfae5f80", borderRadius: 13, background: "#8a68252b", color: "#f0d99e", fontSize: 12, lineHeight: 1.4 };
const completeStyle: CSSProperties = { padding: "11px 14px", border: "1px solid #4cae9970", borderRadius: 13, background: "#174d4335", color: "#aee8d9", fontSize: 12, lineHeight: 1.4 };
'''
Path('src/components/technology-budget-outlook.tsx').write_text(component)

budget = r'''import type { Project } from "@/lib/projects/types";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import type { CompassConfig } from "@/lib/compass/types";
import { compassLocationSnapshots, inventoryReportDevices, osSupportStatus } from "./client-report-data";

const COMPASS_CONFIG_KEY = "client-compass.configuration.v1";

export interface TechnologyBudgetLocationConcern {
  name: string;
  replaceNow: number;
  planSoon: number;
  osConcerns: number;
  planningSignals: number;
}

export interface TechnologyBudgetOutlook {
  replaceNowWorkstations: number;
  planSoonWorkstations: number;
  planningWorkstations: number;
  osConcernSystems: number;
  replacementBudgetLow: number;
  replacementBudgetHigh: number;
  quarterlyBudgetLow: number;
  quarterlyBudgetHigh: number;
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
  const planSoonWorkstations = workstations.filter((device) => device.lifecycleStatus === "due-soon").length;
  const planningWorkstations = replaceNowWorkstations + planSoonWorkstations;
  const osConcernSystems = devices.filter((device) => device.type !== "network" && isOsConcern(device)).length;
  const incompleteAgeCount = workstations.filter((device) => device.lifecycleStatus === "unknown" || !Number.isFinite(Number(device.age)) || Number(device.age) <= 0).length;
  const workstationReplacementUnit = Math.max(0, config.value.standardWorkstationModernization + config.value.workstationDeploymentAllowance);
  const baseReplacementValue = planningWorkstations * workstationReplacementUnit;
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
      const replaceNow = matched.length
        ? matched.filter((device) => device.type === "workstation" && device.lifecycleStatus === "overdue").length
        : location.replaceNow;
      const planSoon = matched.length
        ? matched.filter((device) => device.type === "workstation" && device.lifecycleStatus === "due-soon").length
        : location.planSoon;
      const osConcerns = matched.filter((device) => device.type !== "network" && isOsConcern(device)).length;
      const planningSignals = matched.filter((device) =>
        (device.type === "workstation" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon"))
        || (device.type !== "network" && isOsConcern(device))
      ).length;
      return {
        name: location.name || "Location not specified",
        replaceNow,
        planSoon,
        osConcerns,
        planningSignals: planningSignals || replaceNow + planSoon + osConcerns,
      };
    })
    .filter((location) => location.replaceNow > 0 || location.planSoon > 0 || location.osConcerns > 0)
    .sort((a, b) => b.planningSignals - a.planningSignals || (b.replaceNow + b.planSoon) - (a.replaceNow + a.planSoon) || b.osConcerns - a.osConcerns || a.name.localeCompare(b.name))
    .slice(0, 3);

  return {
    replaceNowWorkstations,
    planSoonWorkstations,
    planningWorkstations,
    osConcernSystems,
    replacementBudgetLow,
    replacementBudgetHigh,
    quarterlyBudgetLow,
    quarterlyBudgetHigh,
    workstationReplacementUnit,
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

function locationPlanningSummary(location: TechnologyBudgetLocationConcern): string {
  const parts: string[] = [];
  if (location.replaceNow) parts.push(`${location.replaceNow} due now`);
  if (location.planSoon) parts.push(`${location.planSoon} upcoming`);
  if (location.osConcerns) parts.push(`${location.osConcerns} OS item${location.osConcerns === 1 ? "" : "s"} to review`);
  return parts.join(" · ") || "No known needs currently identified";
}

export function technologyBudgetOutlookPdfPage(project: Project): string {
  const outlook = technologyBudgetOutlook(project);
  const quarterlyRange = technologyBudgetQuarterlyRangeLabel(outlook);
  const totalRange = technologyBudgetRangeLabel(outlook);
  const locationHtml = outlook.locations.length
    ? outlook.locations.map((location) => `<article style="padding:12px 14px;border:1px solid #d7e4ef;border-radius:13px;background:#f8fbfe"><strong style="display:block;font-size:10.5pt;color:#112742">${escapeHtml(location.name)}</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt;line-height:1.35">${escapeHtml(locationPlanningSummary(location))}</span></article>`).join("")
    : `<article style="padding:12px 14px;border:1px solid #d9e4f0;border-radius:13px;background:#f8fbfe"><strong style="display:block;font-size:10pt;color:#112742">No workstation replacements currently identified</strong><span style="display:block;margin-top:5px;color:#62748a;font-size:7.2pt">We can revisit this as equipment ages and needs are confirmed.</span></article>`;
  const completeness = outlook.incompleteAgeCount
    ? `<div style="margin-top:12px;padding:11px 13px;border:1px solid #e4cf8a;border-radius:12px;background:#fff9e9;color:#6e5a20;font-size:7.2pt;line-height:1.4"><strong>There may be additional future needs.</strong> We still need to verify the age of ${outlook.incompleteAgeCount} workstation${outlook.incompleteAgeCount === 1 ? "" : "s"}, so this budget reflects the equipment we can confidently plan around today.</div>`
    : `<div style="margin-top:12px;padding:11px 13px;border:1px solid #bfe0d5;border-radius:12px;background:#edf9f5;color:#286d5d;font-size:7.2pt;line-height:1.4"><strong>Workstation age data is complete.</strong> This gives us a solid starting point for the next 12 months, though final equipment choices and installation needs may change the actual cost.</div>`;
  const dueCopy = outlook.replaceNowWorkstations && outlook.planSoonWorkstations
    ? `${outlook.replaceNowWorkstations} already due · ${outlook.planSoonWorkstations} approaching replacement age`
    : outlook.replaceNowWorkstations
      ? `${outlook.replaceNowWorkstations} already due for replacement`
      : outlook.planSoonWorkstations
        ? `${outlook.planSoonWorkstations} approaching replacement age`
        : "No workstation replacements currently identified";
  return `<section class="pdf-page pdf-budget-outlook" data-pdf-page="true" style="position:relative;padding:.30in .34in .32in;background:linear-gradient(145deg,#f7fbff,#fff 66%);color:#0b1830"><span style="display:block;color:#147f8f;font-size:7pt;font-weight:850;letter-spacing:.12em;text-transform:uppercase">Technology Planning</span><h2 style="margin:.05in 0 .06in;font-size:24pt;line-height:1.02">Plan ahead for upcoming technology needs</h2><p style="max-width:8.8in;margin:0;color:#62748a;font-size:8.4pt;line-height:1.42">Based on the equipment we reviewed, here is a practical starting point for budgeting over the next year. The goal is to spread known workstation needs across the year instead of treating every replacement as a one-time surprise.</p><div style="display:grid;grid-template-columns:1.18fr .82fr;gap:12px;margin-top:15px"><article style="padding:18px;border-radius:16px;background:linear-gradient(135deg,#116f83,#188da0);color:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#d8f7fa">Suggested quarterly technology budget</span><strong style="display:block;margin-top:7px;font-size:26pt;line-height:1">${escapeHtml(quarterlyRange)}</strong><p style="margin:8px 0 0;color:#e9fbfc;font-size:7.3pt;line-height:1.42">Setting aside roughly this amount each quarter would cover the workstation replacements we can currently see coming over the next 12 months.</p></article><article style="padding:16px;border:1px solid #d7e4ef;border-radius:16px;background:#fff"><span style="font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#6b8198">What we are planning around</span><strong style="display:block;margin-top:7px;font-size:22pt;color:#112742">${outlook.planningWorkstations}</strong><span style="display:block;margin-top:1px;color:#425b74;font-size:8pt;font-weight:800">workstation${outlook.planningWorkstations === 1 ? "" : "s"} over the next 12 months</span><p style="margin:8px 0 0;color:#62748a;font-size:7.1pt;line-height:1.4">${escapeHtml(dueCopy)}</p><p style="margin:6px 0 0;color:#62748a;font-size:7.1pt;line-height:1.4"><strong style="color:#315a75">${outlook.osConcernSystems} OS item${outlook.osConcernSystems === 1 ? "" : "s"} to evaluate.</strong> Some may be resolved through upgrades rather than computer replacement.</p></article></div><article style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding:13px 15px;border:1px solid #d7e4ef;border-radius:14px;background:#fff"><div><span style="display:block;color:#6b8198;font-size:6.7pt;font-weight:850;letter-spacing:.09em;text-transform:uppercase">Current 12-month workstation estimate</span><span style="display:block;margin-top:4px;color:#62748a;font-size:7.1pt;line-height:1.35">Planning estimate only. Actual equipment selections and installation needs may change the final cost.</span></div><strong style="white-space:nowrap;color:#143c5a;font-size:19pt">${escapeHtml(totalRange)}</strong></article><div style="margin-top:13px"><span style="display:block;margin-bottom:7px;color:#6b8198;font-size:6.8pt;font-weight:850;letter-spacing:.1em;text-transform:uppercase">Where upcoming needs are concentrated</span><div style="display:grid;grid-template-columns:repeat(${Math.min(3, Math.max(1, outlook.locations.length))},1fr);gap:8px">${locationHtml}</div></div>${completeness}</section>`;
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
'''
Path('src/lib/outcomes/technology-budget-outlook.ts').write_text(budget)

package = Path('package.json')
text = package.read_text()
if '"version": "1.2.82"' not in text:
    raise SystemExit('Expected package version 1.2.82')
package.write_text(text.replace('"version": "1.2.82"', '"version": "1.2.83"', 1))

app = Path('src/lib/app-version.ts')
text = app.read_text()
if '1.2.82' not in text:
    raise SystemExit('Expected app version 1.2.82')
app.write_text(text.replace('1.2.82', '1.2.83', 1))

test = r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/technology-budget-outlook.tsx", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");

test("budget planning includes due-now and upcoming workstations", () => {
  assert.match(budget, /planSoonWorkstations = workstations\.filter\(\(device\) => device\.lifecycleStatus === "due-soon"\)\.length/);
  assert.match(budget, /planningWorkstations = replaceNowWorkstations \+ planSoonWorkstations/);
  assert.match(budget, /baseReplacementValue = planningWorkstations \* workstationReplacementUnit/);
});

test("quarterly budget is derived from the same 12-month range divided by four", () => {
  assert.match(budget, /quarterlyBudgetLow = replacementBudgetLow \? Math\.round\(replacementBudgetLow \/ 4\) : 0/);
  assert.match(budget, /quarterlyBudgetHigh = replacementBudgetHigh \? Math\.round\(replacementBudgetHigh \/ 4\) : 0/);
});

test("presentation leads with friendly quarterly planning and flips to annual estimate", () => {
  assert.match(component, /Plan ahead for upcoming technology needs/);
  assert.match(component, /Suggested quarterly technology budget/);
  assert.match(component, /setShowTotal/);
  assert.match(component, /rotateY\(180deg\)/);
  assert.match(component, /Current 12-month workstation estimate/);
  assert.doesNotMatch(component, /red-only/i);
  assert.doesNotMatch(component, /Client Compass/);
});

test("portrait PDF mirrors the friendly planning hierarchy", () => {
  assert.match(budget, /Technology Planning/);
  assert.match(budget, /Suggested quarterly technology budget/);
  assert.match(budget, /Current 12-month workstation estimate/);
  assert.match(budget, /Where upcoming needs are concentrated/);
  assert.doesNotMatch(budget, /red-only/i);
  assert.doesNotMatch(budget, /Client Compass/);
});

test("friendly budget release is version 1.2.83", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.83"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.83/);
});
'''
Path('tests/v1283-friendly-budget.test.mjs').write_text(test)
