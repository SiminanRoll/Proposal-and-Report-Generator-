"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset, useCompassState } from "@/lib/compass/store";
import type { CompassConfig } from "@/lib/compass/types";
import { CaptainsLogCloudSettings } from "./captains-log-cloud-settings";

type SettingsHubIcon = "pricing" | "data" | "coverage" | "segments" | "reports" | "map" | "recovery";

function SettingsIcon({ type }: { type: SettingsHubIcon }) {
  if (type === "pricing") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.8-2-1.3-3.4-1.3-1.8 0-3.1.9-3.1 2.2 0 3.1 6 1.4 6 4.7 0 1.4-1.3 2.4-3.3 2.4-1.5 0-2.8-.5-3.7-1.4M12 5.5v13"/></svg>;
  if (type === "data") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3 1.5 0 2.8-.1 4-.4"/><path d="M19 16v6M16 19h6"/></svg>;
  if (type === "coverage") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="8" height="7" rx="2"/><rect x="13" y="13" width="8" height="7" rx="2"/></svg>;
  if (type === "segments") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>;
  if (type === "reports") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h4"/></svg>;
  if (type === "recovery") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/><path d="M9 12h6M12 9v6"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z"/><path d="M8.5 4v13.5M15.5 6.5V20"/></svg>;
}

const SETTINGS_AREAS: Array<{ icon: SettingsHubIcon; title: string; description: string; href: string; action: string; badge: string }> = [
  { icon: "pricing", title: "Pricing, estimates & numbers", description: "A360 monthly fees and minimum agreement, lifecycle thresholds, and project-estimate values.", href: "/settings/pricing/", action: "Open pricing settings", badge: "Global defaults" },
  { icon: "data", title: "Data & sync", description: "Inventory imports, client enrichment, calculation refresh, and Captain's Log history sync.", href: "/data/", action: "Open Data Tools", badge: "Specialized tools" },
  { icon: "coverage", title: "Coverage cards & signals", description: "Project Coverage and Health card criteria stay directly on the card backs, where the business signal is easiest to understand.", href: "/", action: "Open coverage cards", badge: "Edit in context" },
  { icon: "segments", title: "Segments", description: "Build reusable client books with rules, include/exclude overrides, display identity, and saved segment definitions.", href: "/segments/", action: "Open Segment Manager", badge: "Specialized editor" },
  { icon: "reports", title: "Reports & presentations", description: "Create and manage client reports, proposals, report presentation content, and saved workspace-specific output.", href: "/generator/", action: "Open Report Generator", badge: "Workspace specific" },
  { icon: "map", title: "Maps, lists & views", description: "Territory and map display choices plus saved list columns, widths, and viewing preferences remain close to the view they control.", href: "/map/", action: "Open Map", badge: "Saved preferences" },
  { icon: "recovery", title: "Connections, backup & recovery", description: "Captain's Log cloud access, local master backups, restore, and persistent browser preferences.", href: "#settings-cloud", action: "Open recovery settings", badge: "Recovery & storage" },
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
      setMessage("Workspace settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save these settings.");
    } finally { setSaving(false); }
  };

  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern settings-hub-page">
    <header className="settings-hub-hero">
      <span className="compass-settings-section-kicker">Client Compass control center</span>
      <h1>Settings</h1>
      <p>One place to understand where every global preference lives — calculations, coverage logic, reports, maps, data, sync, storage, and recovery.</p>
    </header>

    <section className="settings-hub-directory" aria-labelledby="settings-directory-title">
      <div className="settings-hub-directory-heading"><div><span className="compass-settings-section-kicker">Settings map</span><h2 id="settings-directory-title">Everything customizable, organized by what it affects</h2><p>Global defaults live in Settings. Complex editors stay next to the feature they control, but this page gives each one a clear home and direct entry point.</p></div></div>
      <div className="settings-hub-grid">{SETTINGS_AREAS.map((area) => <Link key={area.title} href={area.href} className={`settings-hub-card settings-hub-${area.icon}`}>
        <span className="settings-hub-card-icon"><SettingsIcon type={area.icon} /></span>
        <span className="settings-hub-card-badge">{area.badge}</span>
        <span className="settings-hub-card-copy"><strong>{area.title}</strong><small>{area.description}</small></span>
        <b>{area.action}<span aria-hidden="true">→</span></b>
      </Link>)}</div>
    </section>

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

    <CaptainsLogCloudSettings />

    {(message || error) && <div className={error ? "compass-import-error" : "compass-workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <footer className="compass-settings-savebar compass-settings-savebar-clean"><span>These controls change global workspace defaults. Pricing, data, card criteria, segments, maps, reports, and backup tools save in their dedicated areas above.</span><button className="button primary" type="button" disabled={!ready || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save workspace settings"}</button></footer>
  </div>;
}
