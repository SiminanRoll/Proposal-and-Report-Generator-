"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset, useCompassState } from "@/lib/compass/store";
import type { CompassConfig } from "@/lib/compass/types";
import { WORKSTATION_PLAN_SOON_YEARS, WORKSTATION_REPLACE_NOW_YEARS } from "@/lib/technical-truth";
import { A360PricingSettingsPanel } from "./a360-pricing-settings-panel";

const VALUE_FIELDS: Array<[keyof CompassConfig["value"], string, string]> = [
  ["standardServerReplacement", "Standard server replacement", "Default project value for a standard server replacement."],
  ["advancedServerMigration", "Server migration allowance", "Planning allowance for advanced server migration work."],
  ["standardWorkstationModernization", "Workstation modernization", "Default equipment value assigned to workstation modernization."],
  ["workstationDeploymentAllowance", "Workstation deployment allowance", "Deployment and setup allowance used in workstation project estimates."],
  ["storageRemediation", "Storage remediation", "Default project value when storage remediation is identified."],
  ["virtualOsRemediation", "Virtual OS remediation", "Default project value for virtual operating-system remediation."],
  ["multisiteAdjustment", "Multi-site adjustment", "Additional planning value applied to multi-location projects."],
];

const THRESHOLD_FIELDS: Array<[keyof CompassConfig["thresholds"], string, string, string]> = [
  ["serverPlanningYears", "Server planning age", "years", "Age where a server enters the planning window."],
  ["serverCriticalYears", "Server critical age", "years", "Age where a server becomes a critical lifecycle signal."],
  ["storageWatchPercent", "Storage watch threshold", "%", "Utilization level that creates a storage watch signal."],
  ["storageCriticalPercent", "Storage critical threshold", "%", "Utilization level that creates a critical storage signal."],
];

function withGlobalWorkstationPolicy(config: CompassConfig): CompassConfig {
  return {
    ...config,
    thresholds: {
      ...config.thresholds,
      workstationPlanSoonYears: WORKSTATION_PLAN_SOON_YEARS,
      workstationReplaceNowYears: WORKSTATION_REPLACE_NOW_YEARS,
      workstationExpiredWarrantyReplaceYears: WORKSTATION_REPLACE_NOW_YEARS,
    },
  };
}

export function CompassPricingSettingsPage() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [draft, setDraft] = useState<CompassConfig>(() => withGlobalWorkstationPolicy(structuredClone(DEFAULT_COMPASS_CONFIG)));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (ready) setDraft(withGlobalWorkstationPolicy(structuredClone(config))); }, [config, ready]);

  const savePlanning = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const normalized = normalizeCompassConfig(withGlobalWorkstationPolicy(draft));
      const recalculated = dataset ? recalculateDataset(dataset, normalized) : null;
      await saveCompassConfigAndDataset(normalized, recalculated);
      await refresh();
      setDraft(withGlobalWorkstationPolicy(structuredClone(normalized)));
      setMessage("Planning numbers saved and Compass calculations refreshed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these pricing and planning settings.");
    } finally { setSaving(false); }
  };

  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern compass-pricing-settings-page">
    <header className="settings-detail-hero">
      <Link href="/settings/" className="settings-detail-back">← Settings</Link>
      <span className="compass-settings-section-kicker">Global calculation controls</span>
      <h1>Pricing, estimates &amp; numbers</h1>
      <p>One place for the values Client Compass uses to estimate projects, trigger lifecycle signals, and present preliminary A360 monthly pricing.</p>
      <div className="settings-detail-scope-row"><span>A360 monthly pricing</span><span>Project estimates</span><span>Lifecycle thresholds</span><span>Included in backup</span></div>
    </header>

    <nav className="settings-detail-jumpbar" aria-label="Pricing settings sections">
      <a href="#pricing-a360">A360 monthly pricing</a>
      <a href="#pricing-lifecycle">Lifecycle thresholds</a>
      <a href="#pricing-projects">Project estimate model</a>
    </nav>

    <div id="pricing-a360" className="settings-detail-anchor"><A360PricingSettingsPanel /></div>

    <section className="compass-settings-section settings-number-section" id="pricing-lifecycle">
      <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Lifecycle signals</span><h2>Lifecycle thresholds</h2><p>Workstation lifecycle is a global reporting policy: 4+ years is planning and 5+ years is replacement. Server and storage thresholds remain configurable below.</p></div><span className="settings-pricing-scope-badge">Global policy</span></div>
      <div className="settings-number-card-grid">
        <label className="settings-number-card settings-fixed-policy-card"><span><strong>Workstation planning age</strong><small>Global policy used by Compass, reports, presentations, maps, segments, and project coverage.</small></span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" value={WORKSTATION_PLAN_SOON_YEARS} readOnly disabled/><em>years</em></div></label>
        <label className="settings-number-card settings-fixed-policy-card"><span><strong>Workstation replacement age</strong><small>At 5 years and above, a physical workstation is a replacement signal everywhere.</small></span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" value={WORKSTATION_REPLACE_NOW_YEARS} readOnly disabled/><em>years</em></div></label>
        {THRESHOLD_FIELDS.map(([key, label, unit, detail]) => <label className="settings-number-card" key={key}><span><strong>{label}</strong><small>{detail}</small></span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" min="0" step="1" value={draft.thresholds[key]} onChange={(event) => setDraft((current) => ({ ...current, thresholds: { ...current.thresholds, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/><em>{unit}</em></div></label>)}
      </div>
    </section>

    <section className="compass-settings-section settings-number-section" id="pricing-projects">
      <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Project value model</span><h2>Estimated project values</h2><p>These are planning estimates used for opportunity sizing and prioritization. They are not client-facing quotes.</p></div><span className="settings-pricing-scope-badge">Planning model</span></div>
      <div className="settings-number-card-grid">{VALUE_FIELDS.map(([key, label, detail]) => <label className="settings-number-card" key={key}><span><strong>{label}</strong><small>{detail}</small></span><div className="compass-settings-number is-prefix"><em>$</em><input inputMode="numeric" type="number" min="0" step="250" value={draft.value[key]} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/></div></label>)}</div>
      <label className="settings-number-card settings-contingency-card"><span><strong>Planning contingency</strong><small>Percentage added to the planning model after the base estimate is calculated.</small></span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" min="0" max="100" step="1" value={draft.value.planningContingencyPercent} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, planningContingencyPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } }))}/><em>%</em></div></label>
    </section>

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <footer className="compass-settings-savebar compass-settings-savebar-clean settings-detail-savebar"><span>The 4-year planning / 5-year replacement workstation policy is fixed globally. Server, storage, and project-estimate changes save here and immediately recalculate the current Compass snapshot.</span><button className="button primary" type="button" disabled={!ready || saving} onClick={() => void savePlanning()}>{saving ? "Saving…" : "Save planning numbers"}</button></footer>
  </div>;
}
