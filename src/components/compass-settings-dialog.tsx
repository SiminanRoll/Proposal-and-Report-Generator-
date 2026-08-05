"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfig, saveCompassDataset } from "@/lib/compass/store";
import type { CompassConfig, CompassDataset } from "@/lib/compass/types";

interface Props { open: boolean; config: CompassConfig; dataset: CompassDataset | null; onClose: () => void; onSaved: () => void; }

type NumericGroup = "score" | "value" | "thresholds";

const SCORE_FIELDS: Array<[keyof CompassConfig["score"], string]> = [
  ["server2012First", "First Server 2012 / unsupported OS"], ["server2012Additional", "Additional Server 2012"], ["server2012Cap", "Server 2012 category cap"],
  ["server2016First", "First Server 2016"], ["server2016Additional", "Additional Server 2016"], ["server2016Cap", "Server 2016 category cap"],
  ["serverAgePlanningEach", "Server age 5–6 years"], ["serverAgePlanningCap", "Planning-age server cap"], ["serverAgeCriticalEach", "Server age 7+ years"], ["serverAgeCriticalCap", "Critical-age server cap"],
  ["windows10Each", "Windows 10 device"], ["windows10Cap", "Windows 10 cap"], ["windows11HomeEach", "Windows 11 Home device"], ["windows11HomeCap", "Windows 11 Home cap"],
  ["replaceNowEach", "Replace Now workstation"], ["replaceNowCap", "Replace Now cap"], ["planSoonEach", "Plan Soon workstation"], ["planSoonCap", "Plan Soon cap"],
  ["criticalStorageEach", "Critical-storage device"], ["criticalStorageCap", "Critical-storage cap"], ["watchStorageEach", "Watch-storage device"], ["watchStorageCap", "Watch-storage cap"],
  ["expiredServerWarrantyEach", "Expired server warranty"], ["expiredServerWarrantyCap", "Expired server warranty cap"], ["expiredWorkstationWarrantyEach", "Expired workstation warranty"], ["expiredWorkstationWarrantyCap", "Expired workstation warranty cap"],
];
const VALUE_FIELDS: Array<[keyof CompassConfig["value"], string, string]> = [
  ["standardServerReplacement", "Standard physical server replacement", "$"], ["advancedServerMigration", "Virtual server / advanced migration", "$"], ["multiServerAdditionalMultiplier", "Additional-server multiplier", "×"],
  ["standardWorkstationModernization", "Workstation modernization", "$"], ["workstationDeploymentAllowance", "Workstation deployment allowance", "$"], ["virtualOsRemediation", "Virtual OS remediation", "$"], ["storageRemediation", "Storage remediation", "$"], ["multisiteAdjustment", "Multisite adjustment", "$"], ["planningContingencyPercent", "Planning contingency", "%"],
];
const THRESHOLD_FIELDS: Array<[keyof CompassConfig["thresholds"], string, string]> = [
  ["workstationPlanSoonYears", "Workstation Plan Soon", "years"], ["workstationReplaceNowYears", "Workstation Replace Now", "years"], ["serverPlanningYears", "Server planning", "years"], ["serverCriticalYears", "Server critical", "years"], ["storageWatchPercent", "Storage watch", "%"], ["storageCriticalPercent", "Storage critical", "%"],
];

export function CompassSettingsDialog({ open, config, dataset, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<CompassConfig>(structuredClone(config));
  useEffect(() => { if (open) setDraft(structuredClone(config)); }, [open, config]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  const update = (group: NumericGroup, key: string, value: number) => setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: Number.isFinite(value) ? value : 0 } }));
  const save = () => {
    saveCompassConfig(draft);
    if (dataset) saveCompassDataset(recalculateDataset(dataset, draft));
    onSaved();
    onClose();
  };
  return (
    <div className="compass-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="compass-modal compass-settings-modal" role="dialog" aria-modal="true" aria-labelledby="compass-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-modal-header"><div><span className="compass-kicker">Editable assumptions</span><h2 id="compass-settings-title">Scoring &amp; Estimate Settings</h2><p>These internal values create prioritization and planning estimates. They are not quotes or client pricing.</p></div><button className="compass-drawer-close" type="button" onClick={onClose} aria-label="Close settings">×</button></header>
        <div className="compass-settings-section"><h3>Compass Priority Score</h3><div className="compass-settings-grid">{SCORE_FIELDS.map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" step="1" value={draft.score[key]} onChange={(event) => update("score", key, Number(event.target.value))} /></label>)}</div></div>
        <div className="compass-settings-section"><h3>Estimated value assumptions <small>Demo defaults</small></h3><div className="compass-settings-grid">{VALUE_FIELDS.map(([key, label, unit]) => <label key={key}><span>{label}<small>{unit}</small></span><input type="number" min="0" step={key === "multiServerAdditionalMultiplier" ? ".05" : "1"} value={draft.value[key]} onChange={(event) => update("value", key, Number(event.target.value))} /></label>)}</div></div>
        <div className="compass-settings-section"><h3>Lifecycle &amp; storage thresholds</h3><div className="compass-settings-grid">{THRESHOLD_FIELDS.map(([key, label, unit]) => <label key={key}><span>{label}<small>{unit}</small></span><input type="number" min="0" step="1" value={draft.thresholds[key]} onChange={(event) => update("thresholds", key, Number(event.target.value))} /></label>)}</div></div>
        <footer className="compass-modal-actions"><button className="button secondary" type="button" onClick={() => setDraft(structuredClone(DEFAULT_COMPASS_CONFIG))}>Restore demo defaults</button><span className="compass-modal-spacer"/><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="button" onClick={save}>Save and recalculate</button></footer>
      </section>
    </div>
  );
}
