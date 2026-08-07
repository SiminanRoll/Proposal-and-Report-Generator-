"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, SVGProps } from "react";
import { createPortal } from "react-dom";
import { CompassCardSettingsDialog } from "./compass-card-settings-dialog";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { CompassDataDialog } from "./compass-data-dialog";
import { CompassSettingsDialog } from "./compass-settings-dialog";
import { CompassReviewHistoryDialog } from "./compass-review-history-dialog";
import { compassConfigFingerprint, COMPASS_CALCULATION_VERSION, recalculateDataset } from "@/lib/compass/engine";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import { COMPASS_SHELL_ACTION_EVENT, compassShellActionFromHash, type CompassShellAction } from "@/lib/compass/shell-actions";
import type { CompassCardIcon } from "@/lib/compass/types";
import { buildProjectCoverageSnapshot, type ProjectCoveragePosition } from "@/lib/compass/project-coverage";
import { ProjectCoverageDashboard } from "./project-coverage-dashboard";
import { ProjectCoverageClientList } from "./project-coverage-client-list";

function OpportunityIcon({ type, ...props }: SVGProps<SVGSVGElement> & { type: CompassCardIcon }) {
  if (type === "server") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5"/></svg>;
  if (type === "calendar") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-5"/></svg>;
  if (type === "windows") return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M3 4.7 10.6 3.6v7.7H3V4.7Zm8.7-1.3L21 2v9.3h-9.3V3.4ZM3 12.4h7.6v7.7L3 19v-6.6Zm8.7 0H21v9.4l-9.3-1.4v-8Z"/></svg>;
  if (type === "workstation") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/></svg>;
  if (type === "storage") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>;
}

function formatRefresh(value: string): string {
  if (!value) return "No committed import";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Current snapshot" : `Updated ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}`;
}

function formatCalculation(value: string): string {
  if (!value) return "Calculations pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Calculations current" : "Calculations current";
}

function clientReportUrl(clientId: string, clientName: string, contact: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  if (contact) params.set("contact", contact);
  return `/create/?${params.toString()}`;
}

export function CompassHome() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [activeCoveragePosition, setActiveCoveragePosition] = useState<ProjectCoveragePosition>("needs-review");
  const [activeClientId, setActiveClientId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"score" | "value" | "thresholds" | undefined>(undefined);
  const [reviewHistoryOpen, setReviewHistoryOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const coverageListRef = useRef<HTMLDivElement>(null);
  const customizeAnchorRef = useRef<HTMLDivElement>(null);
  const customizeMenuRef = useRef<HTMLDivElement>(null);
  const [customizeMenuStyle, setCustomizeMenuStyle] = useState<CSSProperties>({});
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);
  const [pendingShellAction, setPendingShellAction] = useState<CompassShellAction | null>(null);
  const [clientSearchMenuStyle, setClientSearchMenuStyle] = useState<CSSProperties>({});
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState("");
  const [calculationMessage, setCalculationMessage] = useState("");
  const [calculationFailureKey, setCalculationFailureKey] = useState("");
  const coverageSnapshot = useMemo(() => buildProjectCoverageSnapshot(dataset, config), [dataset, config]);
  const activeCoverageCard = coverageSnapshot.cards.find((card) => card.id === activeCoveragePosition) ?? coverageSnapshot.cards[0];
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
    setActiveClientId(clientId);
    setClientSearch("");
    setClientSearchFocused(false);
  }, []);

  const positionCustomizeMenu = useCallback(() => {
    const anchor = customizeAnchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const gutter = 14;
    const width = Math.min(260, Math.max(210, window.innerWidth - gutter * 2));
    const left = Math.min(Math.max(gutter, rect.right - width), Math.max(gutter, window.innerWidth - width - gutter));
    setCustomizeMenuStyle({ left, width, top: rect.bottom + 8 });
  }, []);

  useEffect(() => {
    if (!customizeOpen) return;
    positionCustomizeMenu();
    const update = () => positionCustomizeMenu();
    const closeOnPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (customizeAnchorRef.current?.contains(target) || customizeMenuRef.current?.contains(target)) return;
      setCustomizeOpen(false);
    };
    const closeOnKey = (event: KeyboardEvent) => { if (event.key === "Escape") setCustomizeOpen(false); };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("mousedown", closeOnPointer);
    window.addEventListener("keydown", closeOnKey);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("mousedown", closeOnPointer);
      window.removeEventListener("keydown", closeOnKey);
    };
  }, [customizeOpen, positionCustomizeMenu]);

  const positionClientSearchMenu = useCallback(() => {
    const anchor = clientSearchRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const gutter = 16;
    const width = Math.min(rect.width, Math.max(240, window.innerWidth - gutter * 2));
    const left = Math.min(Math.max(gutter, rect.left), Math.max(gutter, window.innerWidth - width - gutter));
    const roomBelow = window.innerHeight - rect.bottom - gutter;
    const roomAbove = rect.top - gutter;
    const openAbove = roomBelow < 180 && roomAbove > roomBelow;
    const maxHeight = Math.max(120, Math.min(360, openAbove ? roomAbove - 8 : roomBelow - 8));
    setClientSearchMenuStyle(openAbove
      ? { left, width, bottom: window.innerHeight - rect.top + 8, maxHeight }
      : { left, width, top: rect.bottom + 8, maxHeight });
  }, []);

  useEffect(() => {
    if (!clientSearchFocused || !clientSearch.trim()) return;
    positionClientSearchMenu();
    const update = () => positionClientSearchMenu();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [clientSearch, clientSearchFocused, positionClientSearchMenu]);

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

  const handleShellAction = useCallback((action: CompassShellAction) => {
    setCustomizeOpen(false);
    if (!ready && action !== "update-data") {
      setPendingShellAction(action);
      return;
    }

    if (action === "find-client") {
      if (!dataset) {
        setImportOpen(true);
        return;
      }
      setActiveClientId("");
      setClientSearchFocused(true);
      window.requestAnimationFrame(() => {
        clientSearchInputRef.current?.focus();
        positionClientSearchMenu();
      });
      return;
    }

    if (action === "update-data") {
      setImportOpen(true);
      return;
    }

    if (!dataset && (action === "import-review-history" || action === "refresh-calculations")) {
      setImportOpen(true);
      return;
    }

    if (action === "import-review-history") {
      setReviewHistoryOpen(true);
      return;
    }

    if (action === "refresh-calculations") {
      void refreshCalculations("manual");
      return;
    }

    if (action === "estimate-assumptions" || action === "project-thresholds") {
      setSettingsSection(action === "estimate-assumptions" ? "value" : "thresholds");
      setSettingsOpen(true);
      return;
    }

    setCardsOpen(true);
  }, [dataset, positionClientSearchMenu, ready, refreshCalculations]);

  useEffect(() => {
    if (!ready || !pendingShellAction) return;
    const action = pendingShellAction;
    setPendingShellAction(null);
    handleShellAction(action);
  }, [handleShellAction, pendingShellAction, ready]);

  useEffect(() => {
    const consumeHashAction = () => {
      const action = compassShellActionFromHash(window.location.hash);
      if (!action) return;
      handleShellAction(action);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    };
    const handleActionEvent = (event: Event) => handleShellAction((event as CustomEvent<CompassShellAction>).detail);
    window.addEventListener("hashchange", consumeHashAction);
    window.addEventListener(COMPASS_SHELL_ACTION_EVENT, handleActionEvent);
    window.requestAnimationFrame(consumeHashAction);
    return () => {
      window.removeEventListener("hashchange", consumeHashAction);
      window.removeEventListener(COMPASS_SHELL_ACTION_EVENT, handleActionEvent);
    };
  }, [handleShellAction]);

  useEffect(() => {
    if (!dataset || calculating) return;
    const isCurrent = dataset.calculationVersion === COMPASS_CALCULATION_VERSION && dataset.calculationFingerprint === expectedFingerprint;
    if (isCurrent) return;
    if (calculationFailureKey === `${dataset.importedAt}:${expectedFingerprint}`) return;
    void refreshCalculations("automatic");
  }, [calculating, calculationFailureKey, dataset, expectedFingerprint, refreshCalculations]);

  const selectCoveragePosition = useCallback((position: ProjectCoveragePosition, scrollToList = false) => {
    setActiveCoveragePosition(position);
    if (!scrollToList) return;
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      coverageListRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }, []);

  return (
    <div className="compass-home">
      <section className="compass-intro" aria-labelledby="compass-title">
        <div>
          <span className="compass-kicker">Client service coverage</span>
          <h1 id="compass-title">Client Project Coverage</h1>
          <p>Clients with qualified project needs, organized by how far the concern has progressed from review through an open decision or quote.</p>
          {dataset && <div className="compass-client-search" role="search" ref={clientSearchRef}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
            <input
              ref={clientSearchInputRef}
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              onFocus={() => { setClientSearchFocused(true); window.requestAnimationFrame(positionClientSearchMenu); }}
              onBlur={() => window.setTimeout(() => setClientSearchFocused(false), 120)}
              onKeyDown={(event) => { if (event.key === "Enter" && clientSearchResults[0]) openSearchedClient(clientSearchResults[0].id); if (event.key === "Escape") { setClientSearch(""); setClientSearchFocused(false); } }}
              placeholder="Find a client…"
              aria-label="Find a Client Compass client"
              aria-expanded={clientSearchFocused && Boolean(clientSearch.trim())}
              aria-controls="compass-client-search-results"
            />
            {clientSearch && <button type="button" aria-label="Clear client search" onMouseDown={(event) => event.preventDefault()} onClick={() => setClientSearch("")}>×</button>}
          </div>}
          {dataset && clientSearchFocused && clientSearch.trim() && typeof document !== "undefined" && createPortal(
            <div className="compass-client-search-results" id="compass-client-search-results" role="list" style={clientSearchMenuStyle}>
              {clientSearchResults.length ? clientSearchResults.map((client) => {
                const summary = dataset.summaries.find((item) => item.clientId === client.id);
                const deviceCount = dataset.devices.filter((device) => device.clientId === client.id).length;
                return <div className="compass-client-search-result" key={client.id} role="listitem">
                  <button className="compass-client-search-open" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchedClient(client.id)}>
                    <span><strong>{client.name}</strong><small>{client.primaryContact || client.assignedOwner || "Client workspace"}</small></span>
                    <em>{summary?.priorityTier ?? "Monitor"} · {deviceCount} devices</em>
                  </button>
                  <Link className="compass-client-search-report" href={clientReportUrl(client.id, client.name, client.primaryContact)} onClick={() => { setClientSearch(""); setClientSearchFocused(false); }}>Report</Link>
                </div>;
              }) : <div className="compass-client-search-empty">No matching client in the current snapshot.</div>}
            </div>,
            document.body,
          )}
        </div>
        <div className="compass-intro-actions">
          <div className={`compass-data-freshness${calculationError ? " is-error" : dataset ? " is-current" : ""}`}>
            <span className="compass-data-freshness-dot" aria-hidden="true" />
            <span><strong>{calculating ? "Refreshing calculations…" : calculationError ? "Calculation catch-up needed" : dataset ? formatRefresh(dataset.importedAt) : "Live data required"}</strong>{dataset && <small>{calculating ? "Cards are being recalculated" : calculationError ? "Use Customize to retry calculations" : formatCalculation(dataset.calculatedAt ?? "")}</small>}</span>
          </div>
          <div className="compass-intro-button-row">
            <button className="button primary" type="button" onClick={() => setImportOpen(true)}>Update data</button>
            <div className="compass-customize-anchor" ref={customizeAnchorRef}>
              <button className="button compass-glass-button compass-customize-button" type="button" aria-haspopup="menu" aria-expanded={customizeOpen} onClick={() => setCustomizeOpen((value) => !value)}>Customize <span aria-hidden="true">⌄</span></button>
            </div>
          </div>
          {(calculationMessage || calculationError) && <span className={`compass-calculation-feedback${calculationError ? " is-error" : ""}`} role={calculationError ? "alert" : "status"}>{calculationError || calculationMessage}</span>}
          {customizeOpen && typeof document !== "undefined" && createPortal(
            <div className="compass-customize-menu" role="menu" ref={customizeMenuRef} style={customizeMenuStyle}>
              <button type="button" role="menuitem" onClick={() => { setCardsOpen(true); setCustomizeOpen(false); }}><span>Manage cards</span><small>Configure technical cards for diagnostics and future lenses</small></button>
              <button type="button" role="menuitem" onClick={() => { setSettingsSection(undefined); setSettingsOpen(true); setCustomizeOpen(false); }}><span>Scoring &amp; estimates</span><small>Adjust priority and value assumptions</small></button>
              <button type="button" role="menuitem" disabled={!dataset || calculating} onClick={() => { setCustomizeOpen(false); void refreshCalculations("manual"); }}><span>{calculating ? "Refreshing calculations…" : "Refresh calculations"}</span><small>Recalculate cards and client workspaces</small></button>
              <div className="compass-customize-menu-divider" role="separator" />
              <button type="button" role="menuitem" disabled={!dataset} onClick={() => { setReviewHistoryOpen(true); setCustomizeOpen(false); }}><span>Import review & quote dates</span><small>One-time client-history enrichment tool</small></button>
            </div>,
            document.body,
          )}
        </div>
      </section>

      {!dataset && (
        <section className="compass-empty-state" aria-label="Client Compass data required">
          <span className="compass-empty-icon"><OpportunityIcon type="compass" /></span>
          <div><strong>Import the current Ninja master spreadsheet</strong><p>Project coverage will calculate from committed client, device, review, and quote data. No illustrative client counts or values are being shown.</p></div>
          <button className="button primary" type="button" onClick={() => setImportOpen(true)}>Choose spreadsheet</button>
        </section>
      )}

      <ProjectCoverageDashboard
        cards={coverageSnapshot.cards}
        dataReady={Boolean(dataset)}
        selectedPosition={activeCoveragePosition}
        onSelect={selectCoveragePosition}
      />

      {dataset && activeCoverageCard && <div ref={coverageListRef} className="project-coverage-client-list-anchor">
        <ProjectCoverageClientList card={activeCoverageCard} onOpenClient={setActiveClientId} />
      </div>}

      {dataset && <div className={`project-coverage-reconciliation${coverageSnapshot.needsReviewDifference ? " has-difference" : ""}`} role="status">
        <strong>Coverage reconciliation</strong>
        <span>{coverageSnapshot.needsReviewDifference === 0
          ? `Needs Client Review matches the ${coverageSnapshot.needsReviewExpectedCount}-client reference group.`
          : `The current import produces ${coverageSnapshot.cards[0].count} Needs Client Review clients, ${Math.abs(coverageSnapshot.needsReviewDifference)} ${coverageSnapshot.needsReviewDifference > 0 ? "above" : "below"} the ${coverageSnapshot.needsReviewExpectedCount}-client reference group.`}</span>
      </div>}

      <footer className="compass-footnote">
        <span>{dataset ? `${dataset.devices.length} devices across ${dataset.clients.filter((client) => dataset.devices.some((device) => device.clientId === client.id)).length} active clients.` : "Current-state data is stored only in this browser."}</span>
        <span>Qualified project packages are deduplicated; technical findings support the need without creating separate project values.</span>
      </footer>

      {activeClientId && dataset && <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />}

      <CompassDataDialog open={importOpen} dataset={dataset} config={config} onClose={() => setImportOpen(false)} onCommitted={refresh} />
      <CompassCardSettingsDialog open={cardsOpen} config={config} dataset={dataset} onClose={() => setCardsOpen(false)} onSaved={refresh} />
      <CompassSettingsDialog open={settingsOpen} config={config} dataset={dataset} initialSection={settingsSection} onClose={() => setSettingsOpen(false)} onSaved={refresh} />
      <CompassReviewHistoryDialog open={reviewHistoryOpen} dataset={dataset} config={config} onClose={() => setReviewHistoryOpen(false)} onCommitted={refresh} />
    </div>
  );
}
