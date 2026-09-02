"use client";

import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import {
  technologyBudgetOutlook,
  technologyBudgetRangeLabel,
} from "@/lib/outcomes/technology-budget-outlook";

export function TechnologyBudgetOutlookToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label style={toggleShellStyle}>
    <span style={{ minWidth: 0 }}><strong style={toggleTitleStyle}>Include Technology Budget</strong><small style={toggleHelpStyle}>Optional red-only replacement budget page</small></span>
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
  return <div style={slideStyle}>
    <div style={headingStyle}>
      <span style={kickerStyle}>Technology Budget</span>
      <h2 style={titleStyle}>What needs attention now?</h2>
      <p style={subtitleStyle}>A simple red-only view of the items already needing attention in this report. The replacement budget applies only to workstations marked Replace Now. OS concerns are shown separately because some can be resolved without replacing the computer.</p>
    </div>

    <div style={metricsStyle}>
      <BudgetMetric value={outlook.replaceNowWorkstations} label="Replace Now workstations" />
      <BudgetMetric value={outlook.osConcernSystems} label="OS concerns" />
    </div>

    <div style={budgetGridStyle}>
      <article style={rangeCardStyle}>
        <span style={rangeKickerStyle}>Rough workstation replacement budget</span>
        <strong style={rangeValueStyle}>{budgetRange}</strong>
        <p style={rangeCopyStyle}>Based on {outlook.replaceNowWorkstations} workstation{outlook.replaceNowWorkstations === 1 ? "" : "s"} already marked Replace Now and the current Client Compass workstation and deployment assumptions. Not a formal quote.</p>
      </article>
      <article style={scopeCardStyle}>
        <span style={scopeKickerStyle}>What the number includes</span>
        <strong style={scopeValueStyle}>Red replacement items only</strong>
        <p style={scopeCopyStyle}>OS concerns are visible here but are not automatically added as workstation replacements. Non-red items are not included in this budget.</p>
      </article>
    </div>

    <div style={locationsWrapStyle}>
      <span style={locationsKickerStyle}>Where the red items are concentrated</span>
      <div style={{ ...locationsGridStyle, gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, outlook.locations.length))}, minmax(0, 1fr))` }}>
        {outlook.locations.length ? outlook.locations.map((location) => <article key={location.name} style={locationCardStyle}>
          <strong style={locationTitleStyle}>{location.name}</strong>
          <span style={locationCopyStyle}>{location.replaceNow} replace now · {location.osConcerns} OS concerns</span>
        </article>) : <article style={locationCardStyle}><strong style={locationTitleStyle}>No red workstation or OS items currently identified</strong><span style={locationCopyStyle}>This budget view intentionally excludes non-red items.</span></article>}
      </div>
    </div>

    <div style={outlook.incompleteAgeCount ? incompleteStyle : completeStyle}>
      <strong>{outlook.incompleteAgeCount ? "Some ages still need verification." : "Age data is complete for the workstations in this view."}</strong>
      <span>{outlook.incompleteAgeCount ? ` ${outlook.incompleteAgeCount} workstation${outlook.incompleteAgeCount === 1 ? " has" : "s have"} no usable age and ${outlook.incompleteAgeCount === 1 ? "is" : "are"} not included in this red-only replacement budget until verified.` : " Final equipment selections and installation requirements can still change the actual project cost."}</span>
    </div>
  </div>;
}

function BudgetMetric({ value, label }: { value: number; label: string }) {
  return <article style={metricStyle}><strong style={metricValueStyle}>{value}</strong><span style={metricLabelStyle}>{label}</span></article>;
}

const toggleShellStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid #d2deeb", borderRadius: 14, background: "#f8fbff", color: "#193553" };
const toggleTitleStyle: CSSProperties = { display: "block", fontSize: 12, lineHeight: 1.15 };
const toggleHelpStyle: CSSProperties = { display: "block", marginTop: 2, color: "#718299", fontSize: 10, whiteSpace: "nowrap" };
const toggleButtonStyle: CSSProperties = { minWidth: 46, border: "1px solid #c8d6e6", borderRadius: 999, padding: "7px 10px", background: "#fff", color: "#64758a", fontSize: 11, fontWeight: 850, cursor: "pointer" };
const toggleButtonOnStyle: CSSProperties = { borderColor: "#c45036", background: "#fff0ec", color: "#a03e2c" };
const slideStyle: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", gap: 18, padding: "2.2vh 3.2vw", color: "#f7fbff" };
const headingStyle: CSSProperties = { maxWidth: 1000 };
const kickerStyle: CSSProperties = { display: "block", color: "#ffac9a", fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { margin: "8px 0 8px", fontSize: "clamp(34px,4.1vw,66px)", lineHeight: .98, letterSpacing: "-.035em" };
const subtitleStyle: CSSProperties = { maxWidth: 1040, margin: 0, color: "#c8d4e2", fontSize: "clamp(14px,1.25vw,20px)", lineHeight: 1.45 };
const metricsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 };
const metricStyle: CSSProperties = { padding: "16px 18px", border: "1px solid #ef806255", borderTop: "5px solid #c45036", borderRadius: 18, background: "#7d2e2226" };
const metricValueStyle: CSSProperties = { display: "block", fontSize: "clamp(34px,3vw,52px)", lineHeight: 1, color: "#ffb3a3" };
const metricLabelStyle: CSSProperties = { display: "block", marginTop: 7, color: "#ead0ca", fontSize: 12, fontWeight: 850, letterSpacing: ".04em", textTransform: "uppercase" };
const budgetGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.18fr .82fr", gap: 14 };
const rangeCardStyle: CSSProperties = { padding: "20px 22px", border: "1px solid #ef806270", borderRadius: 20, background: "linear-gradient(135deg,#6f291f,#a64231)" };
const rangeKickerStyle: CSSProperties = { color: "#ffd0c6", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const rangeValueStyle: CSSProperties = { display: "block", marginTop: 7, fontSize: "clamp(28px,3vw,48px)", lineHeight: 1 };
const rangeCopyStyle: CSSProperties = { margin: "8px 0 0", color: "#ffe7e1", fontSize: 13, lineHeight: 1.42 };
const scopeCardStyle: CSSProperties = { padding: "20px 22px", border: "1px solid #ffffff28", borderRadius: 20, background: "#ffffff0d" };
const scopeKickerStyle: CSSProperties = { color: "#c6a49d", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const scopeValueStyle: CSSProperties = { display: "block", marginTop: 7, fontSize: "clamp(21px,2vw,34px)", lineHeight: 1.05 };
const scopeCopyStyle: CSSProperties = { margin: "8px 0 0", color: "#b9cbe0", fontSize: 13, lineHeight: 1.42 };
const locationsWrapStyle: CSSProperties = { display: "grid", gap: 8 };
const locationsKickerStyle: CSSProperties = { color: "#c6a49d", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const locationsGridStyle: CSSProperties = { display: "grid", gap: 10 };
const locationCardStyle: CSSProperties = { padding: "13px 15px", border: "1px solid #ef806240", borderRadius: 15, background: "#7d2e221a" };
const locationTitleStyle: CSSProperties = { display: "block", fontSize: 15 };
const locationCopyStyle: CSSProperties = { display: "block", marginTop: 4, color: "#d8b5ad", fontSize: 12, lineHeight: 1.35 };
const incompleteStyle: CSSProperties = { padding: "11px 14px", border: "1px solid #d6aa49", borderRadius: 13, background: "#6e531d45", color: "#f8d98f", fontSize: 12, lineHeight: 1.4 };
const completeStyle: CSSProperties = { padding: "11px 14px", border: "1px solid #4cae99", borderRadius: 13, background: "#174d4345", color: "#aee8d9", fontSize: 12, lineHeight: 1.4 };
