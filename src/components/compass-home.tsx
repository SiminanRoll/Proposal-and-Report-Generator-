"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SVGProps } from "react";
import { CompassCardSettingsDialog } from "./compass-card-settings-dialog";
import { CompassDataDialog } from "./compass-data-dialog";
import { CompassSettingsDialog } from "./compass-settings-dialog";
import { cardMetrics, COMPASS_CALCULATION_VERSION, recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassCardIcon, CompassCardMetric } from "@/lib/compass/types";

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

export function CompassHome() {
  const { dataset, config, refresh } = useCompassState();
  const [flippedCards, setFlippedCards] = useState<Set<string>>(() => new Set());
  const [activeCard, setActiveCard] = useState<CompassCardMetric | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeFailureKey, setUpgradeFailureKey] = useState("");
  const cards = useMemo(() => config.cards.filter((card) => card.enabled).sort((a, b) => a.order - b.order), [config.cards]);
  const metrics = useMemo(() => cardMetrics(dataset, config), [dataset, config]);
  const metricsById = useMemo(() => new Map(metrics.map((metric) => [metric.id, metric])), [metrics]);

  useEffect(() => {
    if (!dataset || dataset.calculationVersion === COMPASS_CALCULATION_VERSION || upgrading) return;
    const upgradeKey = `${dataset.importedAt}:${dataset.calculationVersion ?? "legacy"}`;
    if (upgradeFailureKey === upgradeKey) return;
    setUpgrading(true);
    void saveCompassDataset(recalculateDataset(dataset, config))
      .then(refresh)
      .catch(() => setUpgradeFailureKey(upgradeKey))
      .finally(() => setUpgrading(false));
  }, [dataset, config, refresh, upgrading, upgradeFailureKey]);

  useEffect(() => {
    if (!activeCard) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveCard(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCard]);

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
        </div>
        <div className="compass-intro-actions">
          <span className={`compass-preview-badge${dataset ? " is-live" : ""}`}>{upgrading ? "Updating card calculations…" : upgradeFailureKey ? "Card recalculation needs attention" : dataset ? formatRefresh(dataset.importedAt) : "Live data required"}</span>
          <div className="compass-intro-button-row">
            <button className="button primary" type="button" onClick={() => setImportOpen(true)}>Update Client Compass Data</button>
            <button className="button compass-glass-button" type="button" onClick={() => setCardsOpen(true)}>Manage cards</button>
            <button className="button compass-glass-button" type="button" onClick={() => setSettingsOpen(true)}>Scoring &amp; estimates</button>
          </div>
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
                      <button className="compass-view-clients" type="button" tabIndex={isFlipped ? 0 : -1} disabled={!dataset || metric.clients.length === 0} onClick={() => setActiveCard(metric)}>View clients</button>
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

      {activeCard && (
        <div className="compass-drawer-backdrop" role="presentation" onMouseDown={() => setActiveCard(null)}>
          <aside className="compass-client-drawer" role="dialog" aria-modal="true" aria-labelledby="compass-drawer-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="compass-drawer-header"><div><span className="compass-kicker">Current client queue</span><h2 id="compass-drawer-title">{activeCard.title}</h2></div><button className="compass-drawer-close" type="button" onClick={() => setActiveCard(null)} aria-label="Close client queue">×</button></div>
            <div className="compass-drawer-summary"><div><strong>{activeCard.count}</strong><span>clients</span></div><div><strong>{formatMoney(activeCard.value)}</strong><span>estimated value</span></div></div>
            <div className="compass-demo-notice">This queue shows committed current-state calculations. Criteria can be changed from Manage Cards.</div>
            <div className="compass-client-list">
              {activeCard.clients.map((client) => <div className="compass-client-row" key={client.clientId}><div><strong>{client.name}</strong><span>{client.driver}</span><small>Compass Priority {client.score} · {client.tier}</small></div><b>{formatMoney(client.estimate)}</b></div>)}
            </div>
            <div className="compass-drawer-actions"><Link className="button primary" href="/generator/">Open generator</Link><button className="button secondary" type="button" onClick={() => setActiveCard(null)}>Close</button></div>
          </aside>
        </div>
      )}

      <CompassDataDialog open={importOpen} dataset={dataset} config={config} onClose={() => setImportOpen(false)} onCommitted={refresh} />
      <CompassCardSettingsDialog open={cardsOpen} config={config} dataset={dataset} onClose={() => setCardsOpen(false)} onSaved={refresh} />
      <CompassSettingsDialog open={settingsOpen} config={config} dataset={dataset} onClose={() => setSettingsOpen(false)} onSaved={refresh} />
    </div>
  );
}
