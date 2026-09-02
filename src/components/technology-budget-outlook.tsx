"use client";

import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import {
  technologyBudgetOutlook,
  technologyBudgetRangeLabel,
  technologyQuarterlyRangeLabel,
} from "@/lib/outcomes/technology-budget-outlook";

export function TechnologyBudgetOutlookToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label style={toggleShellStyle}>
    <span style={{ minWidth: 0 }}><strong style={toggleTitleStyle}>Include Technology Budget Outlook</strong><small style={toggleHelpStyle}>Optional financial planning slide</small></span>
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
  const budgetRange = technologyBudgetRangeLabel(outlook);
  const quarterlyRange = technologyQuarterlyRangeLabel(outlook);
  return <div style={slideStyle}>
    <div style={headingStyle}>
      <span style={kickerStyle}>Technology Budget Outlook</span>
      <h2 style={titleStyle}>What should we plan to budget for soon?</h2>
      <p style={subtitleStyle}>A simple workstation planning view based on the lifecycle and operating-system information in this report. This is budgeting guidance, not a formal quote.</p>
    </div>

    <div style={metricsStyle}>
      <BudgetMetric value={outlook.replaceNowWorkstations} label="Replace Now workstations" tone="priority" />
      <BudgetMetric value={outlook.planSoonWorkstations} label="Plan Soon workstations" tone="planning" />
      <BudgetMetric value={outlook.windows10Systems} label="Windows 10 systems to review" tone="os" />
    </div>

    <div style={budgetGridStyle}>
      <article style={rangeCardStyle}>
        <span style={rangeKickerStyle}>Rough near-term workstation planning range</span>
        <strong style={rangeValueStyle}>{budgetRange}</strong>
        <p style={rangeCopyStyle}>Based on {outlook.nearTermWorkstations} Replace Now + Plan Soon workstation{outlook.nearTermWorkstations === 1 ? "" : "s"} and the current Client Compass workstation planning assumptions. Not a formal quote.</p>
      </article>
      <article style={quarterCardStyle}>
        <span style={quarterKickerStyle}>Example four-quarter budget pace</span>
        <strong style={quarterValueStyle}>{quarterlyRange}</strong>
        <p style={quarterCopyStyle}>Illustrative budgeting pace if the same planning range were spread evenly across four quarters. This is not financing or a payment plan.</p>
      </article>
    </div>

    <div style={locationsWrapStyle}>
      <span style={locationsKickerStyle}>Locations with the most OS & lifecycle concerns</span>
      <div style={{ ...locationsGridStyle, gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, outlook.locations.length))}, minmax(0, 1fr))` }}>
        {outlook.locations.length ? outlook.locations.map((location) => <article key={location.name} style={locationCardStyle}>
          <strong style={locationTitleStyle}>{location.name}</strong>
          <span style={locationCopyStyle}>{location.replaceNow} replace now · {location.planSoon} plan soon · {location.windows10} Windows 10</span>
        </article>) : <article style={locationCardStyle}><strong style={locationTitleStyle}>No concentrated site concern</strong><span style={locationCopyStyle}>The current report data does not identify one office carrying a larger workstation lifecycle or Windows 10 concern.</span></article>}
      </div>
    </div>

    <div style={outlook.incompleteLifecycleCount ? incompleteStyle : completeStyle}>
      <strong>{outlook.incompleteLifecycleCount ? "Planning data still needs verification." : "Lifecycle data is complete for the workstations in this planning view."}</strong>
      <span>{outlook.incompleteLifecycleCount ? ` ${outlook.incompleteLifecycleCount} workstation${outlook.incompleteLifecycleCount === 1 ? " has" : "s have"} incomplete lifecycle data, so the final scope and budget may change after verification.` : " Final equipment selections and installation requirements can still change the actual project cost."}</span>
    </div>
  </div>;
}

function BudgetMetric({ value, label, tone }: { value: number; label: string; tone: "priority" | "planning" | "os" }) {
  const border = tone === "priority" ? "#ef8062" : tone === "planning" ? "#d7a83d" : "#4c91ea";
  return <article style={{ ...metricStyle, borderTopColor: border }}><strong style={metricValueStyle}>{value}</strong><span style={metricLabelStyle}>{label}</span></article>;
}

const toggleShellStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid #d2deeb", borderRadius: 14, background: "#f8fbff", color: "#193553" };
const toggleTitleStyle: CSSProperties = { display: "block", fontSize: 12, lineHeight: 1.15 };
const toggleHelpStyle: CSSProperties = { display: "block", marginTop: 2, color: "#718299", fontSize: 10, whiteSpace: "nowrap" };
const toggleButtonStyle: CSSProperties = { minWidth: 46, border: "1px solid #c8d6e6", borderRadius: 999, padding: "7px 10px", background: "#fff", color: "#64758a", fontSize: 11, fontWeight: 850, cursor: "pointer" };
const toggleButtonOnStyle: CSSProperties = { borderColor: "#5bbca6", background: "#e5f7f1", color: "#117660" };
const slideStyle: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", gap: 18, padding: "2.2vh 3.2vw", color: "#f7fbff" };
const headingStyle: CSSProperties = { maxWidth: 980 };
const kickerStyle: CSSProperties = { display: "block", color: "#91c7ff", fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { margin: "8px 0 8px", fontSize: "clamp(34px,4.1vw,66px)", lineHeight: .98, letterSpacing: "-.035em" };
const subtitleStyle: CSSProperties = { maxWidth: 1000, margin: 0, color: "#b9cbe0", fontSize: "clamp(14px,1.25vw,20px)", lineHeight: 1.45 };
const metricsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 };
const metricStyle: CSSProperties = { padding: "16px 18px", border: "1px solid #ffffff24", borderTop: "5px solid", borderRadius: 18, background: "#ffffff0d" };
const metricValueStyle: CSSProperties = { display: "block", fontSize: "clamp(34px,3vw,52px)", lineHeight: 1 };
const metricLabelStyle: CSSProperties = { display: "block", marginTop: 7, color: "#c8d8ea", fontSize: 12, fontWeight: 850, letterSpacing: ".04em", textTransform: "uppercase" };
const budgetGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.12fr .88fr", gap: 14 };
const rangeCardStyle: CSSProperties = { padding: "20px 22px", border: "1px solid #6db2ec70", borderRadius: 20, background: "linear-gradient(135deg,#153e72,#1b68a9)" };
const rangeKickerStyle: CSSProperties = { color: "#b8dbff", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const rangeValueStyle: CSSProperties = { display: "block", marginTop: 7, fontSize: "clamp(28px,3vw,48px)", lineHeight: 1 };
const rangeCopyStyle: CSSProperties = { margin: "8px 0 0", color: "#d8e7f5", fontSize: 13, lineHeight: 1.42 };
const quarterCardStyle: CSSProperties = { padding: "20px 22px", border: "1px solid #ffffff28", borderRadius: 20, background: "#ffffff0d" };
const quarterKickerStyle: CSSProperties = { color: "#9ebbd7", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const quarterValueStyle: CSSProperties = { display: "block", marginTop: 7, fontSize: "clamp(23px,2.3vw,38px)", lineHeight: 1.05 };
const quarterCopyStyle: CSSProperties = { margin: "8px 0 0", color: "#b9cbe0", fontSize: 13, lineHeight: 1.42 };
const locationsWrapStyle: CSSProperties = { display: "grid", gap: 8 };
const locationsKickerStyle: CSSProperties = { color: "#8faac7", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const locationsGridStyle: CSSProperties = { display: "grid", gap: 10 };
const locationCardStyle: CSSProperties = { padding: "13px 15px", border: "1px solid #ffffff20", borderRadius: 15, background: "#ffffff0a" };
const locationTitleStyle: CSSProperties = { display: "block", fontSize: 15 };
const locationCopyStyle: CSSProperties = { display: "block", marginTop: 4, color: "#aebfd2", fontSize: 12, lineHeight: 1.35 };
const incompleteStyle: CSSProperties = { padding: "11px 14px", border: "1px solid #d6aa49", borderRadius: 13, background: "#6e531d45", color: "#f8d98f", fontSize: 12, lineHeight: 1.4 };
const completeStyle: CSSProperties = { padding: "11px 14px", border: "1px solid #4cae99", borderRadius: 13, background: "#174d4345", color: "#aee8d9", fontSize: 12, lineHeight: 1.4 };
