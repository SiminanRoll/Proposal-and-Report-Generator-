"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SVGProps } from "react";
import { CompassCardSettingsDialog } from "./compass-card-settings-dialog";
import { CompassClientQueue } from "./compass-client-queue";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { CompassDataDialog } from "./compass-data-dialog";
import { CompassSettingsDialog } from "./compass-settings-dialog";
import { cardMetrics, compassConfigFingerprint, COMPASS_CALCULATION_VERSION, recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassCardCategory, CompassCardIcon } from "@/lib/compass/types";

function OpportunityIcon({ type, ...props }: SVGProps<SVGSVGElement> & { type: CompassCardIcon }) {
  if (type === "server") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5"/></svg>;
  if (type === "calendar") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-5"/></svg>;
  if (type === "windows") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M3 4.7 10.6 3.6v7.7H3V4.7Zm8.7-1.3L21 2v9.3h-9.3V3.4ZM3 12.4h7.6v7.7L3 19v-6.6Zm8.7 0H21v9.4l-9.3-1.4v-8Z"/></svg>;
  if (type === "workstation") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/></svg>;
  if (type === "storage") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
}

function formatMoney(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value >= 10000000 ? 0 : 2).replace(/\.00$/, "")}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatRefresh(value: string): string {
  if (!value) return "No committed import";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Current snapshot" : `Updated ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}`;
}

function formatCalculation(value: string): string {
  if (!value) return "Calculations have not been refreshed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Calculations current" : `Calculated ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}`;
}

export function CompassHome() {
  const { dataset, config, refresh } = useCompassState();
  const [flippedCards, setFlippedCards] = useState<Set<string>>(() => new Set());
  const [activeCardId, setActiveCardId] = useState<CompassCardCategory | null>(null);
  const [activeClientId, setActiveClientId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState("");
  const [calculationMessage, setCalculationMessage] = useState("");
  const [calculationFailureKey, setCalculationFailureKey] = useState("");
  const cards = useMemo(() => config.cards.filter((card) => card.enabled).sort((a, b) => a.order - b.order), [config.cards]);
  const metrics = useMemo(() => cardMetrics(dataset, config), [dataset, config]);
  const metricsById = useMemo(() => new Map(metrics.map((metric) => [metric.id, metric])), [metrics]);
  const activeCard = activeCardId ? metricsById.get(activeCardId) ?? null : null;
  const expectedFingerprint = useMemo(() => compassConfigFingerprint(config), [config]);
  const clientSearchResults = useMemo(() => {
    if (!dataset) return [];
    const query = clientSearch.trim().toLowerCase();
    if (!query) return [];
    return dataset.clients
      .filter((client) => dataset.devices.some((device) => device.clientId === client.id))
      .filter((client) => `${client.name} ${client.aliases.join(" ")} ${client.primaryContact} ${client.primaryContactEmail} ${client.assignedOwner}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [clientSearch, dataset]);

  const openSearchedClient = useCallback((clientId: string) => {
    setActiveCardId(null);
    setActiveClientId(clientId);
    setClientSearch("");
    setClientSearchFocused(false);
  }, []);

  const refreshCalculations = useCallback(async (mode: "automatic" | "manual" = "manual") => {
    if (!dataset || calculating) return;
    setCalculating(true);
    setCalculationError("");
    setCalculationMessage("");
    if (mode === "manual") setCalculationFailureKey("");
    try {
      await saveCompassDataset(recalculateDataset(dataset, config));
      await refresh();
      setCalculationFailureKey("");
      setCalculationMessage(mode === "manual" ? "Cards and client workspaces are caught up." : "Cards updated automatically.");
    } catch (cause) {
      setCalculationError(cause instanceof Error ? cause.message : "Client Compass could not refresh its calculations.");
      setCalculationFailureKey(`${dataset.importedAt}:${expectedFingerprint}`);
    } finally {
      setCalculating(false);
    }
  }, [calculating, config, dataset, expectedFingerprint, refresh]);

  useEffect(() => {
    if (!dataset || calculating) return;
    const isCurrent = dataset.calculationVersion === COMPASS_CALCULATION_VERSION && dataset.calculationFingerprint === expectedFingerprint;
    if (isCurrent) return;
    if (calculationFailureKey === `${dataset.importedAt}:${expectedFingerprint}`) return;
    void refreshCalculations("automatic");
  }, [calculating, calculationFailureKey, dataset, expectedFingerprint, refreshCalculations]);

  useEffect(() => {
    if (!activeCardId) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !activeClientId) setActiveCardId(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCardId, activeClientId]);

  const toggleCard = (id: string) => setFlippedCards((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="compass-home">
      <section className="compass-intro" aria-labelledby="compass-title">
        <div>
          <span className="compass-kicker">Current project opportunity snapshot</span>
          <h1 id="compass-title">Client Compass</h1>
          <p>See where client needs are concentrated, how much estimated opportunity they represent, and where the next planning conversation should begin.</p>
          {dataset && <div className="compass-client-search" role="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
            <input
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              onFocus={() => setClientSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setClientSearchFocused(false), 120)}
              onKeyDown={(event) => { if (event.key === "Enter" && clientSearchResults[0]) openSearchedClient(clientSearchResults[0].id); if (event.key === "Escape") { setClientSearch(""); setClientSearchFocused(false); } }}
              placeholder="Find a client…"
              aria-label="Find a Client Compass client"
              aria-expanded={clientSearchFocused && Boolean(clientSearch.trim())}
              aria-controls="compass-client-search-results"
            />
            {clientSearch && <button type="button" aria-label="Clear client search" onMouseDown={(event) => event.preventDefault()} onClick={() => setClientSearch("")}>×</button>}
            {clientSearchFocused && clientSearch.trim() && <div className="compass-client-search-results" id="compass-client-search-results" role="listbox">
              {clientSearchResults.length ? clientSearchResults.map((client) => {
                const summary = dataset.summaries.find((item) => item.clientId === client.id);
                const deviceCount = dataset.devices.filter((device) => device.clientId === client.id).length;
                return <button key={client.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchedClient(client.id)}><span><strong>{client.name}</strong><small>{client.primaryContact || client.assignedOwner || "Client workspace"}</small></span><em>{summary?.priorityTier ?? "Monitor"} · {deviceCount} devices</em></button>;
              }) : <div className="compass-client-search-empty">No matching client in the current snapshot.</div>}
            </div>}
          </div>}
        </div>
        <div className="compass-intro-actions">
          <div className="compass-calculation-status">
            <span className={`compass-preview-badge${dataset ? " is-live" : ""}`}>{calculating ? "Recalculating cards…" : calculationError ? "Calculation catch-up needed" : dataset ? formatRefresh(dataset.importedAt) : "Live data required"}</span>
            {dataset && <span className="compass-calculation-detail">{formatCalculation(dataset.calculatedAt ?? "")}</span>}
          </div>
          <div className="compass-intro-button-row">
            <button className="button primary" type="button" onClick={() => setImportOpen(true)}>Update Client Compass Data</button>
            <button className="button compass-glass-button" type="button" disabled={!dataset || calculating} onClick={() => void refreshCalculations("manual")}>{calculating ? "Refreshing…" : "Refresh calculations"}</button>
            <button className="button compass-glass-button" type="button" onClick={() => setCardsOpen(true)}>Manage cards</button>
            <button className="button compass-glass-button" type="button" onClick={() => setSettingsOpen(true)}>Scoring &amp; estimates</button>
          </div>
          {(calculationMessage || calculationError) && <span className={`compass-calculation-feedback${calculationError ? " is-error" : ""}`} role={calculationError ? "alert" : "status"}>{calculationError || calculationMessage}</span>}
          <Link className="compass-generator-link" href="/generator/">Open report &amp; proposal generator →</Link>
        </div>
      </section>

      {!dataset && (
        <section className="compass-empty-state" aria-label="Client Compass data required">
          <span className="compass-empty-icon"><OpportunityIcon type="compass" /></span>
          <div><strong>Import the current Ninja master spreadsheet</strong><p>Your enabled opportunity cards will calculate from committed client and device data. No illustrative client counts or values are being shown.</p></div>
          <button className="button primary" type="button" onClick={() => setImportOpen(true)}>Choose spreadsheet</button>
        </section>
      )}

      {!cards.length ? <section className="compass-empty-state"><span className="compass-empty-icon"><OpportunityIcon type="compass"/></span><div><strong>No cards are enabled</strong><p>Open Manage Cards to enable a built-in card or create a custom opportunity card.</p></div><button className="button primary" type="button" onClick={() => setCardsOpen(true)}>Manage cards</button></section> : (
        <section className={`compass-board${dataset ? "" : " is-empty"}`} aria-label="Project opportunity cards">
          {cards.map((card) => {
            const metric = metricsById.get(card.id) ?? { id: card.id, title: card.title, count: 0, affectedDeviceCount: 0, value: 0, clients: [] };
            const isFlipped = flippedCards.has(card.id);
            const secondaryLabel = metric.affectedDeviceCount > 0 && card.id !== "all" ? `${metric.affectedDeviceCount} affected device${metric.affectedDeviceCount === 1 ? "" : "s"}` : "";
            return (
              <article key={card.id} className={`compass-opportunity-card accent-${card.accent}${isFlipped ? " is-flipped" : ""}`}>
                <div className="compass-card-inner">
                  <button className="compass-card-face compass-card-front" type="button" onClick={() => toggleCard(card.id)} aria-label={`Show estimated value for ${card.title}`} aria-pressed={isFlipped} tabIndex={isFlipped ? -1 : 0}>
                    <span className="compass-card-topline"><span className="compass-card-icon"><OpportunityIcon type={card.icon} /></span><span className="compass-card-snapshot">{dataset ? "Committed snapshot" : "Awaiting import"}</span></span>
                    <span className="compass-card-title">{card.title}</span>
                    <span className="compass-card-metric">{metric.count}</span>
                    <span className="compass-card-label">{card.countLabel}</span>
                    {secondaryLabel && <span className="compass-card-secondary-metric">{secondaryLabel}</span>}
                    <span className="compass-card-description">{card.description}</span>
                    <span className="compass-card-flip-prompt">Flip for estimated value <span aria-hidden="true">↗</span></span>
                  </button>

                  <div className="compass-card-face compass-card-back" aria-hidden={!isFlipped}>
                    <span className="compass-card-topline"><span className="compass-card-icon"><OpportunityIcon type={card.icon} /></span><span className="compass-card-snapshot">Planning estimate</span></span>
                    <span className="compass-card-title">{card.title}</span>
                    <span className="compass-card-value">{formatMoney(metric.value)}</span>
                    <span className="compass-card-label">{card.valueLabel}</span>
                    <span className="compass-card-estimate-note">Internal opportunity estimate · editable assumptions · not a client quote</span>
                    <div className="compass-card-actions">
                      <button className="compass-view-clients" type="button" tabIndex={isFlipped ? 0 : -1} disabled={!dataset || metric.clients.length === 0} onClick={() => setActiveCardId(card.id)}>View clients</button>
                      <button className="compass-flip-back" type="button" tabIndex={isFlipped ? 0 : -1} onClick={() => toggleCard(card.id)}>Back to count</button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <footer className="compass-footnote">
        <span>{dataset ? `${dataset.devices.length} devices across ${dataset.clients.filter((client) => dataset.devices.some((device) => device.clientId === client.id)).length} active clients.` : "Current-state data is stored only in this browser."}</span>
        <span>Card criteria, priority scoring, and estimates are explainable, configurable, and current-state only.</span>
      </footer>

      {activeCard && dataset && !activeClientId && <CompassClientQueue cardId={activeCard.id} dataset={dataset} config={config} onClose={() => { setActiveCardId(null); setActiveClientId(""); }} onOpenClient={setActiveClientId} onDatasetSaved={refresh} />}
      {activeClientId && dataset && <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => { setActiveClientId(""); setActiveCardId(null); }} onDatasetSaved={refresh} />}

      <CompassDataDialog open={importOpen} dataset={dataset} config={config} onClose={() => setImportOpen(false)} onCommitted={refresh} />
      <CompassCardSettingsDialog open={cardsOpen} config={config} dataset={dataset} onClose={() => setCardsOpen(false)} onSaved={refresh} />
      <CompassSettingsDialog open={settingsOpen} config={config} dataset={dataset} onClose={() => setSettingsOpen(false)} onSaved={refresh} />
    </div>
  );
}
