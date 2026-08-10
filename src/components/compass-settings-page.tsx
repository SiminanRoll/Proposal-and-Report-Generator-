"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset, useCompassState } from "@/lib/compass/store";
import type { CompassConfig } from "@/lib/compass/types";
import { CaptainsLogCloudSettings } from "./captains-log-cloud-settings";

const VALUE_FIELDS: Array<[keyof CompassConfig["value"], string]> = [
  ["standardServerReplacement", "Standard server replacement"],
  ["advancedServerMigration", "Server migration allowance"],
  ["standardWorkstationModernization", "Workstation modernization"],
  ["workstationDeploymentAllowance", "Workstation deployment allowance"],
  ["storageRemediation", "Storage remediation"],
  ["virtualOsRemediation", "Virtual OS remediation"],
  ["multisiteAdjustment", "Multi-site adjustment"],
];

const THRESHOLD_FIELDS: Array<[keyof CompassConfig["thresholds"], string, string]> = [
  ["serverPlanningYears", "Server planning age", "years"],
  ["serverCriticalYears", "Server critical age", "years"],
  ["workstationPlanSoonYears", "Workstation planning age", "years"],
  ["workstationReplaceNowYears", "Workstation replacement age", "years"],
  ["storageWatchPercent", "Storage watch threshold", "%"],
  ["storageCriticalPercent", "Storage critical threshold", "%"],
];

export function CompassSettingsPage() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [draft, setDraft] = useState<CompassConfig>(() => structuredClone(DEFAULT_COMPASS_CONFIG));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (ready) setDraft(structuredClone(config)); }, [config, ready]);

  const updateCoverage = (patch: Partial<CompassConfig["coverage"]>) => setDraft((current) => ({ ...current, coverage: { ...current.coverage, ...patch } }));

  const save = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const normalized = normalizeCompassConfig(draft);
      const recalculated = dataset ? recalculateDataset(dataset, normalized) : null;
      await saveCompassConfigAndDataset(normalized, recalculated);
      await refresh();
      setDraft(structuredClone(normalized));
      setMessage("Settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these settings.");
    } finally { setSaving(false); }
  };

  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern">
    <header className="compass-admin-hero compass-settings-hero-clean">
      <div>
        <h1>Settings</h1>
      </div>
    </header>

    <nav className="compass-settings-jumpbar" aria-label="Settings sections">
      <a href="#settings-data"><span>01</span><strong>Data</strong></a>
      <a href="#settings-workspace"><span>02</span><strong>Workspace</strong></a>
      <a href="#settings-planning"><span>03</span><strong>Planning</strong></a>
      <a href="#settings-cloud"><span>04</span><strong>Cloud &amp; recovery</strong></a>
    </nav>

    <section className="compass-settings-section compass-settings-data-section" id="settings-data">
      <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Data</span><h2>Data &amp; maintenance</h2><p>Imports and recalculation live in Data Tools so this page stays focused.</p></div></div>
      <Link className="compass-settings-data-tools" href="/data/"><span className="compass-settings-data-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3 1.4 0 2.7-.1 3.8-.4"/><path d="M19 16v6M16 19h6"/></svg></span><span><strong>Data Tools</strong><small>Import client inventory, update current data, and recalculate Compass.</small></span><b>Open →</b></Link>
    </section>

    <section className="compass-settings-section" id="settings-workspace">
      <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Workspace</span><h2>Home &amp; qualification</h2><p>Control the default landing view and the minimum project signal used on the home screen.</p></div></div>
      <div className="compass-settings-grid three-column compass-settings-global-grid compass-settings-home-grid">
        <label className="compass-settings-field"><span>Default home view</span><select value={draft.coverage.defaultCardSet} onChange={(event) => updateCoverage({ defaultCardSet: event.target.value as CompassConfig["coverage"]["defaultCardSet"] })}><option value="client-project-coverage">Project Coverage</option>{draft.coverage.priorityLensEnabled && <option value="priority-lens">Health Priority</option>}</select></label>
        <label className="compass-settings-field"><span>Workstation project minimum</span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" min="1" max="50" step="1" value={draft.coverage.minimumWorkstations} onChange={(event) => updateCoverage({ minimumWorkstations: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}/><em>devices</em></div></label>
        <label className="compass-settings-toggle compass-settings-toggle-compact"><input type="checkbox" checked={draft.coverage.priorityLensEnabled} onChange={(event) => updateCoverage({ priorityLensEnabled: event.target.checked, defaultCardSet: !event.target.checked && draft.coverage.defaultCardSet === "priority-lens" ? "client-project-coverage" : draft.coverage.defaultCardSet })}/><span><strong>Priority Lens</strong><small>Show the health-priority home view as an option.</small></span></label>
      </div>
    </section>

    <section className="compass-settings-section compass-settings-planning-section" id="settings-planning">
      <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Planning</span><h2>Lifecycle &amp; project model</h2><p>Keep the thresholds that create project signals next to the values used to estimate them.</p></div></div>
      <div className="compass-settings-planning-grid">
        <div className="compass-settings-subpanel">
          <div className="compass-settings-subsection-heading"><span>Lifecycle rules</span><h3>Lifecycle thresholds</h3></div>
          <div className="compass-settings-grid compass-settings-rule-grid">{THRESHOLD_FIELDS.map(([key, label, unit]) => <label className="compass-settings-field" key={key}><span>{label}</span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" min="0" step="1" value={draft.thresholds[key]} onChange={(event) => setDraft((current) => ({ ...current, thresholds: { ...current.thresholds, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/><em>{unit}</em></div></label>)}</div>
        </div>

        <div className="compass-settings-subpanel">
          <div className="compass-settings-subsection-heading"><span>Project model</span><h3>Estimated project values</h3></div>
          <div className="compass-settings-grid compass-settings-value-grid">{VALUE_FIELDS.map(([key, label]) => <label className="compass-settings-field" key={key}><span>{label}</span><div className="compass-settings-number is-prefix"><em>$</em><input inputMode="numeric" type="number" min="0" step="250" value={draft.value[key]} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/></div></label>)}</div>
          <label className="compass-settings-field compact-field"><span>Planning contingency</span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" min="0" max="100" step="1" value={draft.value.planningContingencyPercent} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, planningContingencyPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } }))}/><em>%</em></div></label>
        </div>
      </div>
    </section>

    <CaptainsLogCloudSettings />

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <footer className="compass-settings-savebar compass-settings-savebar-clean"><span>Changes to workspace, lifecycle, and project-model settings are saved together.</span><button className="button primary" type="button" disabled={!ready || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</button></footer>
  </div>;
}