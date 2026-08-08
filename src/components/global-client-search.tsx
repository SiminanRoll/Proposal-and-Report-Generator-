"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CompassClientWorkspace } from "./compass-client-workspace";
import { COMPASS_SHELL_ACTION_EVENT, compassShellActionFromHash, type CompassShellAction } from "@/lib/compass/shell-actions";
import { useCompassState } from "@/lib/compass/store";

function reportUrl(clientId: string, clientName: string, contact: string): string {
  const params = new URLSearchParams({ type: "client-report", compassClientId: clientId, client: clientName });
  if (contact) params.set("contact", contact);
  return `/create/?${params.toString()}`;
}

export function GlobalClientSearch() {
  const { dataset, config, refresh } = useCompassState();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeClientId, setActiveClientId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const showSearch = useCallback(() => {
    setActiveClientId("");
    setQuery("");
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const handleShellAction = (event: Event) => {
      const action = (event as CustomEvent<CompassShellAction>).detail;
      if (action === "find-client") showSearch();
    };
    const consumeHash = () => {
      if (compassShellActionFromHash(window.location.hash) !== "find-client") return;
      showSearch();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener(COMPASS_SHELL_ACTION_EVENT, handleShellAction);
    window.addEventListener("hashchange", consumeHash);
    window.requestAnimationFrame(consumeHash);
    return () => {
      window.removeEventListener(COMPASS_SHELL_ACTION_EVENT, handleShellAction);
      window.removeEventListener("hashchange", consumeHash);
    };
  }, [showSearch]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setQuery("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const results = useMemo(() => {
    if (!dataset) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return dataset.clients
      .filter((client) => `${client.name} ${client.aliases.join(" ")} ${client.primaryContact} ${client.primaryContactEmail} ${client.assignedOwner} ${client.city || ""} ${client.state || ""} ${client.territory || ""}`.toLowerCase().includes(normalized))
      .sort((left, right) => {
        const leftName = left.name.toLowerCase();
        const rightName = right.name.toLowerCase();
        return Number(!leftName.startsWith(normalized)) - Number(!rightName.startsWith(normalized)) || left.name.localeCompare(right.name);
      })
      .slice(0, 10);
  }, [dataset, query]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(<>
    {open && <div className="compass-client-search-modal-backdrop global-client-search-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) { setOpen(false); setQuery(""); } }}>
      <div className="compass-client-search-modal global-client-search-modal" role="dialog" aria-modal="true" aria-labelledby="global-client-search-title">
        <div className="compass-client-search-modal-header">
          <div><span className="compass-kicker">Find a client</span><h2 id="global-client-search-title">Search Client Compass</h2></div>
          <button type="button" className="compass-client-search-close" aria-label="Close client search" onClick={() => { setOpen(false); setQuery(""); }}>×</button>
        </div>
        <div className="compass-client-search is-modal" role="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { setOpen(false); setActiveClientId(results[0].id); } }} placeholder="Find a client…" aria-label="Find a Client Compass client" />
          {query && <button type="button" aria-label="Clear client search" onClick={() => setQuery("")}>×</button>}
        </div>
        <div className="compass-client-search-results is-modal" role="list">
          {!dataset ? <div className="compass-client-search-empty">Import client data before searching.</div> : query.trim() ? results.length ? results.map((client) => {
            const summary = dataset.summaries.find((item) => item.clientId === client.id);
            const deviceCount = dataset.devices.filter((device) => device.clientId === client.id).length;
            return <div className="compass-client-search-result" key={client.id} role="listitem">
              <button className="compass-client-search-open" type="button" onClick={() => { setOpen(false); setQuery(""); setActiveClientId(client.id); }}>
                <span><strong>{client.name}</strong><small>{client.city || client.primaryContact || "Client record"}{client.state ? ` · ${client.state}` : ""}</small></span>
                <em>{summary?.priorityTier ?? "Client"} · {deviceCount} devices</em>
              </button>
              <Link className="compass-client-search-report" href={reportUrl(client.id, client.name, client.primaryContact)} onClick={() => { setOpen(false); setQuery(""); }}>Report</Link>
            </div>;
          }) : <div className="compass-client-search-empty">No matching client in the current snapshot.</div> : <div className="compass-client-search-empty">Start typing a client name, contact, city, state, or territory.</div>}
        </div>
      </div>
    </div>}
    {activeClientId && dataset && <CompassClientWorkspace clientId={activeClientId} dataset={dataset} config={config} onBack={() => setActiveClientId("")} onCloseAll={() => setActiveClientId("")} onDatasetSaved={refresh} />}
  </>, document.body);
}
