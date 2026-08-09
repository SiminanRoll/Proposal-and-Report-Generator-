"use client";

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
      <h1>Settings</h1>
    </header>

    <section className="compass-settings-section">
      <div className="compass-settings-section-heading"><div><h2>Home &amp; qualification</h2></div></div>
      <div className="compass-settings-grid three-column compass-settings-global-grid">
        <label className="compass-settings-field"><span>Default home view</span><select value={draft.coverage.defaultCardSet} onChange={(event) => updateCoverage({ defaultCardSet: event.target.value as CompassConfig["coverage"]["defaultCardSet"] })}><option value="client-project-coverage">Project Coverage</option>{draft.coverage.priorityLensEnabled && <option value="priority-lens">Health Priority</option>}</select></label>
        <label className="compass-settings-field"><span>Workstation project minimum</span><div className="compass-settings-number"><input type="number" min="1" max="50" step="1" value={draft.coverage.minimumWorkstations} onChange={(event) => updateCoverage({ minimumWorkstations: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}/><em>devices</em></div></label>
        <label className="compass-settings-toggle compass-settings-toggle-compact"><input type="checkbox" checked={draft.coverage.priorityLensEnabled} onChange={(event) => updateCoverage({ priorityLensEnabled: event.target.checked, defaultCardSet: !event.target.checked && draft.coverage.defaultCardSet === "priority-lens" ? "client-project-coverage" : draft.coverage.defaultCardSet })}/><span><strong>Priority Lens</strong></span></label>
      </div>
    </section>

    <section className="compass-settings-section">
      <div className="compass-settings-section-heading"><div><h2>Lifecycle thresholds</h2></div></div>
      <div className="compass-settings-grid">{THRESHOLD_FIELDS.map(([key, label, unit]) => <label className="compass-settings-field" key={key}><span>{label}</span><div className="compass-settings-number"><input type="number" min="0" step="1" value={draft.thresholds[key]} onChange={(event) => setDraft((current) => ({ ...current, thresholds: { ...current.thresholds, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/><em>{unit}</em></div></label>)}</div>
    </section>

    <section className="compass-settings-section">
      <div className="compass-settings-section-heading"><div><h2>Estimated project values</h2></div></div>
      <div className="compass-settings-grid">{VALUE_FIELDS.map(([key, label]) => <label className="compass-settings-field" key={key}><span>{label}</span><div className="compass-settings-number"><em>$</em><input type="number" min="0" step="250" value={draft.value[key]} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/></div></label>)}</div>
      <label className="compass-settings-field compact-field"><span>Planning contingency</span><div className="compass-settings-number"><input type="number" min="0" max="100" step="1" value={draft.value.planningContingencyPercent} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, planningContingencyPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } }))}/><em>%</em></div></label>
    </section>

    <CaptainsLogCloudSettings />

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <footer className="compass-settings-savebar compass-settings-savebar-clean"><span/><button className="button primary" type="button" disabled={!ready || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</button></footer>
  </div>;
}
