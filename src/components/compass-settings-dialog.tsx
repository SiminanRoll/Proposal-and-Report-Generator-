"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset } from "@/lib/compass/store";
import type { CompassConfig, CompassDataset } from "@/lib/compass/types";

interface Props { open: boolean; config: CompassConfig; dataset: CompassDataset | null; onClose: () => void; onSaved: () => void; }
type NumericGroup = "score" | "value" | "thresholds";

const SCORE_FIELDS: Array<[keyof CompassConfig["score"], string]> = [
  ["server2012First", "First Server 2012 / unsupported OS"], ["server2012Additional", "Additional Server 2012"], ["server2012Cap", "Server 2012 category cap"],
  ["server2016First", "First Server 2016"], ["server2016Additional", "Additional Server 2016"], ["server2016Cap", "Server 2016 category cap"],
  ["serverAgePlanningEach", "Server lifecycle planning"], ["serverAgePlanningCap", "Planning-age server cap"], ["serverAgeCriticalEach", "Critical server lifecycle"], ["serverAgeCriticalCap", "Critical-age server cap"],
  ["windows10Each", "Active Windows 10 device"], ["windows10Cap", "Windows 10 cap"], ["windows11HomeEach", "Windows 11 Home device"], ["windows11HomeCap", "Windows 11 Home cap"],
  ["replaceNowEach", "Replace Now workstation"], ["replaceNowCap", "Replace Now cap"], ["planSoonEach", "Plan Soon workstation"], ["planSoonCap", "Plan Soon cap"],
  ["criticalStorageEach", "Critical-storage device"], ["criticalStorageCap", "Critical-storage cap"], ["watchStorageEach", "Watch-storage device"], ["watchStorageCap", "Watch-storage cap"],
  ["expiredServerWarrantyEach", "Expired server warranty"], ["expiredServerWarrantyCap", "Expired server warranty cap"], ["expiredWorkstationWarrantyEach", "Expired workstation warranty"], ["expiredWorkstationWarrantyCap", "Expired workstation warranty cap"],
];
const VALUE_FIELDS: Array<[keyof CompassConfig["value"], string, string]> = [
  ["standardServerReplacement", "Standard physical server replacement", "$"], ["advancedServerMigration", "Virtual server / advanced migration", "$"], ["multiServerAdditionalMultiplier", "Additional-server multiplier", "×"],
  ["standardWorkstationModernization", "Workstation modernization", "$"], ["workstationDeploymentAllowance", "Workstation deployment allowance", "$"], ["virtualOsRemediation", "Virtual OS remediation", "$"], ["storageRemediation", "Storage remediation", "$"], ["multisiteAdjustment", "Multisite adjustment", "$"], ["planningContingencyPercent", "Planning contingency", "%"],
];
const THRESHOLD_FIELDS: Array<[keyof CompassConfig["thresholds"], string, string]> = [
  ["workstationPlanSoonYears", "Workstation Plan Soon age", "years"], ["workstationReplaceNowYears", "Workstation Replace Now age", "years"], ["workstationExpiredWarrantyReplaceYears", "Expired-warranty replacement age", "years"],
  ["serverPlanningYears", "Server planning age", "years"], ["serverCriticalYears", "Server critical age", "years"], ["serverExpiredWarrantyCriticalYears", "Expired-warranty critical server age", "years"], ["serverWarrantyPlanningMinYears", "Upcoming-warranty minimum server age", "years"], ["warrantyPlanningMonths", "Upcoming warranty window", "months"],
  ["staleDeviceMonths", "Inactive / stale check-in cutoff", "months"], ["storageWatchPercent", "Storage watch utilization", "% used"], ["storageCriticalPercent", "Storage critical utilization", "% used"],
  ["storageSystemWatchFreeGb", "System-drive watch free space", "GB"], ["storageSystemCriticalFreeGb", "System-drive critical free space", "GB"], ["storageWatchFreeGb", "Watch absolute free-space guard", "GB"], ["storageCriticalFreeGb", "Critical absolute free-space guard", "GB"], ["storageMinimumVolumeGb", "Ignore utility volumes below", "GB"],
];

export function CompassSettingsDialog({ open, config, dataset, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<CompassConfig>(structuredClone(config));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setDraft(structuredClone(config)); setSaving(false); setError(""); } }, [open, config]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, saving]);
  if (!open) return null;
  const update = (group: NumericGroup, key: string, value: number) => setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: Number.isFinite(value) ? value : 0 } }));
  const save = async () => {
    setSaving(true); setError("");
    try {
      const normalized = normalizeCompassConfig(draft);
      await saveCompassConfigAndDataset(normalized, dataset ? recalculateDataset(dataset, normalized) : null);
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these settings.");
    } finally { setSaving(false); }
  };
  return (
    <div className="compass-modal-backdrop" role="presentation" onMouseDown={saving ? undefined : onClose}>
      <section className="compass-modal compass-settings-modal" role="dialog" aria-modal="true" aria-labelledby="compass-settings-title" aria-busy={saving} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-modal-header"><div><span className="compass-kicker">Editable assumptions</span><h2 id="compass-settings-title">Scoring &amp; Estimate Settings</h2><p>These internal values create prioritization and planning estimates. They are not quotes or client pricing. Card-specific qualification thresholds are managed under Manage Cards.</p></div><button className="compass-drawer-close" type="button" onClick={onClose} disabled={saving} aria-label="Close settings">×</button></header>
        <div className="compass-settings-section"><h3>Compass Priority Score</h3><div className="compass-settings-grid">{SCORE_FIELDS.map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" step="1" value={draft.score[key]} onChange={(event) => update("score", key, Number(event.target.value))} /></label>)}</div></div>
        <div className="compass-settings-section"><h3>Estimated value assumptions <small>Demo defaults</small></h3><div className="compass-settings-grid">{VALUE_FIELDS.map(([key, label, unit]) => <label key={key}><span>{label}<small>{unit}</small></span><input type="number" min="0" step={key === "multiServerAdditionalMultiplier" ? ".05" : "1"} value={draft.value[key]} onChange={(event) => update("value", key, Number(event.target.value))} /></label>)}</div></div>
        <div className="compass-settings-section"><h3>Lifecycle, activity &amp; storage thresholds</h3><div className="compass-settings-grid">{THRESHOLD_FIELDS.map(([key, label, unit]) => <label key={key}><span>{label}<small>{unit}</small></span><input type="number" min="0" step="1" value={draft.thresholds[key]} onChange={(event) => update("thresholds", key, Number(event.target.value))} /></label>)}</div></div>
        {error && <div className="compass-import-error" role="alert">{error}</div>}
        <footer className="compass-modal-actions"><button className="button secondary" type="button" disabled={saving} onClick={() => setDraft({ ...structuredClone(DEFAULT_COMPASS_CONFIG), cards: structuredClone(draft.cards) })}>Restore numeric defaults</button><span className="compass-modal-spacer"/><button className="button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save and recalculate"}</button></footer>
      </section>
    </div>
  );
}
