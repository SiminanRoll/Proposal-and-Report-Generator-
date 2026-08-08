"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset, useCompassState } from "@/lib/compass/store";
import type { CompassConfig, CompassCoverageCardId } from "@/lib/compass/types";
import { CaptainsLogCloudSettings } from "./captains-log-cloud-settings";

const CARD_LABELS: Record<CompassCoverageCardId, { title: string; detail: string }> = {
  "needs-review": { title: "Needs Client Review", detail: "Qualified need with no recorded review or quote." },
  "discussed-open": { title: "Discussed, Decision Open", detail: "Reviewed with the client; decision remains open." },
  "quoted-open": { title: "Quoted, Still Open", detail: "Quote exists without a completed outcome." },
  "highest-risk": { title: "Highest Technical Risk", detail: "Ranks qualified clients by critical server exposure and severity." },
  "oldest-quotes": { title: "Oldest Open Quotes", detail: "Ranks open quotes from oldest to newest." },
  "largest-need": { title: "Largest Estimated Need", detail: "Ranks qualified clients by deduplicated estimated project need." },
};

const VALUE_FIELDS: Array<[keyof CompassConfig["value"], string, string]> = [
  ["standardServerReplacement", "Standard server replacement", "Base planning value for a server modernization project."],
  ["advancedServerMigration", "Server migration allowance", "Additional planning value when migration complexity is present."],
  ["standardWorkstationModernization", "Workstation modernization", "Per-device planning value for workstation refreshes."],
  ["workstationDeploymentAllowance", "Workstation deployment allowance", "Per-device deployment/setup allowance."],
  ["storageRemediation", "Storage remediation", "Planning value for material storage remediation work."],
  ["virtualOsRemediation", "Virtual OS remediation", "Planning allowance for qualifying virtual OS work."],
  ["multisiteAdjustment", "Multi-site adjustment", "Additional planning value when a project spans locations."],
];

const THRESHOLD_FIELDS: Array<[keyof CompassConfig["thresholds"], string, string, string]> = [
  ["serverPlanningYears", "Server planning age", "years", "Age when a physical server starts entering planning."],
  ["serverCriticalYears", "Server critical age", "years", "Age when a physical server is treated as a critical lifecycle concern."],
  ["workstationPlanSoonYears", "Workstation planning age", "years", "Age when a workstation enters Plan Soon."],
  ["workstationReplaceNowYears", "Workstation replacement age", "years", "Age when a workstation enters Replace Now."],
  ["storageWatchPercent", "Storage watch threshold", "%", "Used for storage planning findings."],
  ["storageCriticalPercent", "Storage critical threshold", "%", "Used for critical storage findings."],
];

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function CompassSettingsPage() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [draft, setDraft] = useState<CompassConfig>(() => structuredClone(DEFAULT_COMPASS_CONFIG));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (ready) setDraft(structuredClone(config)); }, [config, ready]);

  const visiblePrimary = useMemo(() => draft.coverage.primaryCardOrder.filter((id) => !draft.coverage.hiddenCardIds.includes(id)), [draft.coverage]);
  const visiblePriority = useMemo(() => draft.coverage.priorityCardOrder.filter((id) => !draft.coverage.hiddenCardIds.includes(id)), [draft.coverage]);

  const updateCoverage = (patch: Partial<CompassConfig["coverage"]>) => setDraft((current) => ({ ...current, coverage: { ...current.coverage, ...patch } }));
  const toggleCard = (id: CompassCoverageCardId) => {
    setDraft((current) => {
      const hidden = new Set(current.coverage.hiddenCardIds);
      const group = current.coverage.primaryCardOrder.includes(id as never) ? current.coverage.primaryCardOrder : current.coverage.priorityCardOrder;
      const currentlyVisible = group.filter((cardId) => !hidden.has(cardId)).length;
      if (!hidden.has(id) && currentlyVisible <= 1) return current;
      if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
      return { ...current, coverage: { ...current.coverage, hiddenCardIds: [...hidden] } };
    });
  };

  const save = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const normalized = normalizeCompassConfig(draft);
      const recalculated = dataset ? recalculateDataset(dataset, normalized) : null;
      await saveCompassConfigAndDataset(normalized, recalculated);
      await refresh();
      setDraft(structuredClone(normalized));
      setMessage("Settings saved. The current Project Coverage dashboard has been updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these settings.");
    } finally { setSaving(false); }
  };

  const restoreDashboard = () => updateCoverage(structuredClone(DEFAULT_COMPASS_CONFIG.coverage));

  return <div className="compass-admin-page compass-settings-page">
    <header className="compass-admin-hero">
      <span className="compass-kicker">Current dashboard configuration</span>
      <h1>Settings</h1>
      <p>Control the Project Coverage cards you use now, the qualification threshold behind workstation refresh projects, and the planning values used in current estimates.</p>
    </header>

    <section className="compass-settings-section">
      <div className="compass-settings-section-heading"><div><span className="compass-kicker">Dashboard</span><h2>Project Coverage card setup</h2><p>These controls change the cards on the Client Compass home screen—not the retired legacy card dashboard.</p></div><button className="button secondary compact" type="button" onClick={restoreDashboard}>Restore dashboard defaults</button></div>
      <div className="compass-settings-grid two-column">
        <label className="compass-settings-field"><span>Default dashboard view</span><select value={draft.coverage.defaultCardSet} onChange={(event) => updateCoverage({ defaultCardSet: event.target.value as CompassConfig["coverage"]["defaultCardSet"] })}><option value="client-project-coverage">Project Coverage</option>{draft.coverage.priorityLensEnabled && <option value="priority-lens">Health Priority</option>}</select><small>The view shown when Client Compass opens or settings are refreshed.</small></label>
        <label className="compass-settings-field"><span>Workstation project minimum</span><div className="compass-settings-number"><input type="number" min="1" max="50" step="1" value={draft.coverage.minimumWorkstations} onChange={(event) => updateCoverage({ minimumWorkstations: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}/><em>devices</em></div><small>A workstation refresh becomes a qualified Project Coverage need at this device count.</small></label>
      </div>
      <label className="compass-settings-toggle"><input type="checkbox" checked={draft.coverage.priorityLensEnabled} onChange={(event) => updateCoverage({ priorityLensEnabled: event.target.checked, defaultCardSet: !event.target.checked && draft.coverage.defaultCardSet === "priority-lens" ? "client-project-coverage" : draft.coverage.defaultCardSet })}/><span><strong>Enable Priority Lens</strong><small>Allow the alternate health-priority view for risk, quote age, and estimated need from the home-screen chevrons.</small></span></label>

      <div className="compass-current-card-groups">
        <div className="compass-current-card-group"><div><h3>Project Coverage</h3><p>{visiblePrimary.length} of 3 cards shown</p></div>{draft.coverage.primaryCardOrder.map((id, index) => <div className="compass-current-card-row" key={id}><label><input type="checkbox" checked={!draft.coverage.hiddenCardIds.includes(id)} onChange={() => toggleCard(id)}/><span><strong>{CARD_LABELS[id].title}</strong><small>{CARD_LABELS[id].detail}</small></span></label><div><button type="button" aria-label={`Move ${CARD_LABELS[id].title} left`} disabled={index === 0} onClick={() => updateCoverage({ primaryCardOrder: move(draft.coverage.primaryCardOrder, index, -1) })}>←</button><button type="button" aria-label={`Move ${CARD_LABELS[id].title} right`} disabled={index === draft.coverage.primaryCardOrder.length - 1} onClick={() => updateCoverage({ primaryCardOrder: move(draft.coverage.primaryCardOrder, index, 1) })}>→</button></div></div>)}</div>
        {draft.coverage.priorityLensEnabled && <div className="compass-current-card-group"><div><h3>Health Priority</h3><p>{visiblePriority.length} of 3 cards shown</p></div>{draft.coverage.priorityCardOrder.map((id, index) => <div className="compass-current-card-row" key={id}><label><input type="checkbox" checked={!draft.coverage.hiddenCardIds.includes(id)} onChange={() => toggleCard(id)}/><span><strong>{CARD_LABELS[id].title}</strong><small>{CARD_LABELS[id].detail}</small></span></label><div><button type="button" aria-label={`Move ${CARD_LABELS[id].title} left`} disabled={index === 0} onClick={() => updateCoverage({ priorityCardOrder: move(draft.coverage.priorityCardOrder, index, -1) })}>←</button><button type="button" aria-label={`Move ${CARD_LABELS[id].title} right`} disabled={index === draft.coverage.priorityCardOrder.length - 1} onClick={() => updateCoverage({ priorityCardOrder: move(draft.coverage.priorityCardOrder, index, 1) })}>→</button></div></div>)}</div>}
      </div>
    </section>

    <section className="compass-settings-section">
      <div className="compass-settings-section-heading"><div><span className="compass-kicker">Project qualification</span><h2>Lifecycle thresholds</h2><p>Only the thresholds that feed the current technical findings and project packages are exposed here.</p></div></div>
      <div className="compass-settings-grid">{THRESHOLD_FIELDS.map(([key, label, unit, detail]) => <label className="compass-settings-field" key={key}><span>{label}</span><div className="compass-settings-number"><input type="number" min="0" step="1" value={draft.thresholds[key]} onChange={(event) => setDraft((current) => ({ ...current, thresholds: { ...current.thresholds, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/><em>{unit}</em></div><small>{detail}</small></label>)}</div>
    </section>

    <section className="compass-settings-section">
      <div className="compass-settings-section-heading"><div><span className="compass-kicker">Planning context</span><h2>Estimated project values</h2><p>These values drive the estimated need shown on the current coverage cards. They are planning assumptions—not client quotes.</p></div></div>
      <div className="compass-settings-grid">{VALUE_FIELDS.map(([key, label, detail]) => <label className="compass-settings-field" key={key}><span>{label}</span><div className="compass-settings-number"><em>$</em><input type="number" min="0" step="250" value={draft.value[key]} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, [key]: Math.max(0, Number(event.target.value) || 0) } }))}/></div><small>{detail}</small></label>)}</div>
      <label className="compass-settings-field compact-field"><span>Planning contingency</span><div className="compass-settings-number"><input type="number" min="0" max="100" step="1" value={draft.value.planningContingencyPercent} onChange={(event) => setDraft((current) => ({ ...current, value: { ...current.value, planningContingencyPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } }))}/><em>%</em></div></label>
    </section>

    <CaptainsLogCloudSettings />

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <footer className="compass-settings-savebar"><div><strong>Current Project Coverage settings</strong><small>{dataset ? "Saving recalculates the current Client Compass data." : "Settings will apply when data is imported."}</small></div><button className="button primary" type="button" disabled={!ready || saving} onClick={() => void save()}>{saving ? "Saving & recalculating…" : "Save settings"}</button></footer>
  </div>;
}
