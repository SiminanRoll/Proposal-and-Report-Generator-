"use client";

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
