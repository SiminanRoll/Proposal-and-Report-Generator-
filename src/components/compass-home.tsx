"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
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
import { PROJECT_COVERAGE_CARD_SETS, buildProjectCoverageSnapshot, projectCoverageCardsForSet, type ProjectCoverageCardId, type ProjectCoverageCardSetId } from "@/lib/compass/project-coverage";
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


function clientReportUrl(clientId: string, clientName: string, contact: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  if (contact) params.set("contact", contact);
  return `/create/?${params.toString()}`;
}

export function CompassHome() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [activeCoverageCardId, setActiveCoverageCardId] = useState<ProjectCoverageCardId>("needs-review");
  const [activeCardSet, setActiveCardSet] = useState<ProjectCoverageCardSetId>("client-project-coverage");
  const [cardSetPreferenceReady, setCardSetPreferenceReady] = useState(false);
  const [activeClientId, setActiveClientId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"score" | "value" | "thresholds" | undefined>(undefined);
  const [reviewHistoryOpen, setReviewHistoryOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const coverageListRef = useRef<HTMLDivElement>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);
  const [pendingShellAction, setPendingShellAction] = useState<CompassShellAction | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [, setCalculationError] = useState("");
  const [, setCalculationMessage] = useState("");
  const [calculationFailureKey, setCalculationFailureKey] = useState("");
  const coverageSnapshot = useMemo(() => buildProjectCoverageSnapshot(dataset, config), [dataset, config]);
  const activeCardSetDefinition = useMemo(() => PROJECT_COVERAGE_CARD_SETS.find((item) => item.id === activeCardSet) ?? PROJECT_COVERAGE_CARD_SETS[0], [activeCardSet]);
  const visibleCoverageCards = useMemo(() => projectCoverageCardsForSet(coverageSnapshot, activeCardSet), [coverageSnapshot, activeCardSet]);
  const activeCoverageCard = visibleCoverageCards.find((card) => card.id === activeCoverageCardId) ?? visibleCoverageCards[0];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("client-compass:project-coverage-card-set");
      if (PROJECT_COVERAGE_CARD_SETS.some((item) => item.id === saved)) setActiveCardSet(saved as ProjectCoverageCardSetId);
    } catch {
      // Browser privacy settings may disable local storage; the default set still works.
    } finally {
      setCardSetPreferenceReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cardSetPreferenceReady) return;
    try {
      window.localStorage.setItem("client-compass:project-coverage-card-set", activeCardSet);
    } catch {
      // Keep the in-memory preference when browser storage is unavailable.
    }
  }, [activeCardSet, cardSetPreferenceReady]);

  useEffect(() => {
    if (visibleCoverageCards.some((card) => card.id === activeCoverageCardId)) return;
    setActiveCoverageCardId(visibleCoverageCards[0]?.id ?? "needs-review");
  }, [activeCoverageCardId, visibleCoverageCards]);
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
      setClientSearch("");
      setClientSearchFocused(true);
      window.requestAnimationFrame(() => {
        clientSearchInputRef.current?.focus();
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
  }, [dataset, ready, refreshCalculations]);

  useEffect(() => {
    if (!ready || !pendingShellAction) return;
    const action = pendingShellAction;
    setPendingShellAction(null);
    handleShellAction(action);
  }, [handleShellAction, pendingShellAction, ready]);
  useEffect(() => {
    if (!clientSearchFocused) return;
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setClientSearch("");
      setClientSearchFocused(false);
    };
    window.addEventListener("keydown", closeOnKey);
    window.requestAnimationFrame(() => clientSearchInputRef.current?.focus());
    return () => window.removeEventListener("keydown", closeOnKey);
  }, [clientSearchFocused]);


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

  const cycleCardSet = useCallback((direction: -1 | 1) => {
    setActiveCardSet((current) => {
      const index = PROJECT_COVERAGE_CARD_SETS.findIndex((item) => item.id === current);
      const nextIndex = (index + direction + PROJECT_COVERAGE_CARD_SETS.length) % PROJECT_COVERAGE_CARD_SETS.length;
      return PROJECT_COVERAGE_CARD_SETS[nextIndex]?.id ?? PROJECT_COVERAGE_CARD_SETS[0].id;
    });
  }, []);

  const selectCoverageCard = useCallback((cardId: ProjectCoverageCardId, scrollToList = false) => {
    setActiveCoverageCardId(cardId);
    if (!scrollToList) return;
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      coverageListRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }, []);

  return (
    <div className="compass-home">
      <section className="compass-intro" aria-labelledby="compass-title">
        <span className="compass-kicker">Client service coverage</span>
        <div key={activeCardSet} className="compass-card-set-title-motion"><div className="compass-intro-title-row">
          <button type="button" className="compass-intro-chevron" onClick={() => cycleCardSet(-1)} aria-label="Show previous card set">‹</button>
          <h1 id="compass-title">{activeCardSetDefinition.title}</h1>
          <button type="button" className="compass-intro-chevron" onClick={() => cycleCardSet(1)} aria-label="Show next card set">›</button>
        </div></div>
        <p key={`${activeCardSet}-description`} className="compass-card-set-description-motion">{activeCardSetDefinition.description}</p>
      </section>

      {dataset && clientSearchFocused && typeof document !== "undefined" && createPortal(
        <div className="compass-client-search-modal-backdrop" onClick={() => { setClientSearchFocused(false); setClientSearch(""); }}>
          <div className="compass-client-search-modal" role="dialog" aria-modal="true" aria-labelledby="compass-client-search-title" onClick={(event) => event.stopPropagation()}>
            <div className="compass-client-search-modal-header">
              <div>
                <span className="compass-kicker">Find a client</span>
                <h2 id="compass-client-search-title">Search the current Compass snapshot</h2>
              </div>
              <button type="button" className="compass-client-search-close" aria-label="Close client search" onClick={() => { setClientSearchFocused(false); setClientSearch(""); }}>×</button>
            </div>
            <div className="compass-client-search is-modal" role="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
              <input
                ref={clientSearchInputRef}
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && clientSearchResults[0]) openSearchedClient(clientSearchResults[0].id); }}
                placeholder="Find a client…"
                aria-label="Find a Client Compass client"
              />
              {clientSearch && <button type="button" aria-label="Clear client search" onClick={() => setClientSearch("")}>×</button>}
            </div>
            <div className="compass-client-search-results is-modal" id="compass-client-search-results" role="list">
              {clientSearch.trim()
                ? clientSearchResults.length
                  ? clientSearchResults.map((client) => {
                      const summary = dataset.summaries.find((item) => item.clientId === client.id);
                      const deviceCount = dataset.devices.filter((device) => device.clientId === client.id).length;
                      return <div className="compass-client-search-result" key={client.id} role="listitem">
                        <button className="compass-client-search-open" type="button" onClick={() => openSearchedClient(client.id)}>
                          <span><strong>{client.name}</strong><small>{client.primaryContact || client.assignedOwner || "Client workspace"}</small></span>
                          <em>{summary?.priorityTier ?? "Monitor"} · {deviceCount} devices</em>
                        </button>
                        <Link className="compass-client-search-report" href={clientReportUrl(client.id, client.name, client.primaryContact)} onClick={() => { setClientSearch(""); setClientSearchFocused(false); }}>Report</Link>
                      </div>;
                    })
                  : <div className="compass-client-search-empty">No matching client in the current snapshot.</div>
                : <div className="compass-client-search-empty">Start typing a client name, contact, or owner.</div>}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {!dataset && (
        <section className="compass-empty-state" aria-label="Client Compass data required">
          <span className="compass-empty-icon"><OpportunityIcon type="compass" /></span>
          <div><strong>Import the current Ninja master spreadsheet</strong><p>Project coverage will calculate from committed client, device, review, and quote data. No illustrative client counts or values are being shown.</p></div>
          <button className="button primary" type="button" onClick={() => setImportOpen(true)}>Choose spreadsheet</button>
        </section>
      )}

      <ProjectCoverageDashboard
        key={activeCardSet}
        cards={visibleCoverageCards}
        dataReady={Boolean(dataset)}
        selectedCardId={activeCoverageCardId}
        onSelect={selectCoverageCard}
      />

      {dataset && activeCoverageCard && <div ref={coverageListRef} className="project-coverage-client-list-anchor">
        <ProjectCoverageClientList card={activeCoverageCard} key={activeCoverageCard.id} onOpenClient={setActiveClientId} />
      </div>}

      <footer className="compass-footnote">
        <span>{dataset ? `${dataset.devices.length} devices across ${dataset.clients.filter((client) => dataset.devices.some((device) => device.clientId === client.id)).length} active clients.` : "Current-state data is stored only in this browser."}</span>
      </footer>

      {activeClientId && dataset && <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />}

      <CompassDataDialog open={importOpen} dataset={dataset} config={config} onClose={() => setImportOpen(false)} onCommitted={refresh} />
      <CompassCardSettingsDialog open={cardsOpen} config={config} dataset={dataset} onClose={() => setCardsOpen(false)} onSaved={refresh} />
      <CompassSettingsDialog open={settingsOpen} config={config} dataset={dataset} initialSection={settingsSection} onClose={() => setSettingsOpen(false)} onSaved={refresh} />
      <CompassReviewHistoryDialog open={reviewHistoryOpen} dataset={dataset} config={config} onClose={() => setReviewHistoryOpen(false)} onCommitted={refresh} />
    </div>
  );
}
