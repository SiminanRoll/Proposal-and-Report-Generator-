"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset, useCompassState } from "@/lib/compass/store";
import type { CompassConfig } from "@/lib/compass/types";

export function CompassWorkspaceSettingsPage() {
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
      setMessage("Workspace defaults saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these workspace defaults.");
    } finally { setSaving(false); }
  };

  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern compass-workspace-settings-page">
    <header className="settings-detail-hero">
      <Link href="/settings/" className="settings-detail-back">← Settings</Link>
      <span className="compass-settings-section-kicker">Global workspace behavior</span>
      <h1>Workspace defaults</h1>
      <p>Keep the small number of application-wide home and qualification preferences here instead of mixing them into the main Settings directory.</p>
      <div className="settings-detail-scope-row"><span>Default home view</span><span>Project qualification</span><span>Priority Lens</span><span>Global defaults</span></div>
    </header>

    <section className="compass-settings-section settings-workspace-section" id="settings-workspace">
      <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">General workspace</span><h2>Home &amp; qualification defaults</h2><p>Only broad application defaults live here. Detailed card logic and segment rules stay in their own editors.</p></div><span className="settings-pricing-scope-badge">Global</span></div>
      <div className="compass-settings-grid three-column compass-settings-global-grid compass-settings-home-grid">
        <label className="compass-settings-field"><span>Default home view</span><select value={draft.coverage.defaultCardSet} onChange={(event) => updateCoverage({ defaultCardSet: event.target.value as CompassConfig["coverage"]["defaultCardSet"] })}><option value="client-project-coverage">Project Coverage</option>{draft.coverage.priorityLensEnabled && <option value="priority-lens">Health Priority</option>}</select></label>
        <label className="compass-settings-field"><span>Workstation project minimum</span><div className="compass-settings-number is-suffix"><input inputMode="numeric" type="number" min="1" max="50" step="1" value={draft.coverage.minimumWorkstations} onChange={(event) => updateCoverage({ minimumWorkstations: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}/><em>devices</em></div></label>
        <label className="compass-settings-toggle compass-settings-toggle-compact"><input type="checkbox" checked={draft.coverage.priorityLensEnabled} onChange={(event) => updateCoverage({ priorityLensEnabled: event.target.checked, defaultCardSet: !event.target.checked && draft.coverage.defaultCardSet === "priority-lens" ? "client-project-coverage" : draft.coverage.defaultCardSet })}/><span><strong>Priority Lens</strong><small>Show the health-priority home view as an option.</small></span></label>
      </div>
      <div className="settings-context-note-grid">
        <article><span>Coverage cards</span><strong>Edit the signal where you see it.</strong><p>Flip any primary Project Coverage or Health card and choose <b>Edit criteria</b>. Those rules save globally and are included in backup.</p></article>
        <article><span>Segments</span><strong>Keep client-book logic in Segment Manager.</strong><p>Segment rules, colors, include/exclude overrides, and saved client-book definitions remain together in the dedicated editor.</p></article>
        <article><span>Views</span><strong>Keep layout preferences close to the view.</strong><p>Map display choices and list column preferences save where they are used, while Settings remains the directory for finding them.</p></article>
      </div>
    </section>

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <footer className="compass-settings-savebar compass-settings-savebar-clean settings-detail-savebar"><span>These are the broad workspace defaults. Pricing, consultant roster, data, card criteria, reports, maps, and recovery each have their own settings home.</span><button className="button primary" type="button" disabled={!ready || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save workspace defaults"}</button></footer>
  </div>;
}
