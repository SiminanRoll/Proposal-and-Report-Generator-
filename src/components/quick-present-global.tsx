"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCompassState } from "@/lib/compass/store";
import { buildCompassGeneratorPrefill } from "@/lib/compass/generator-bridge";
import { QUICK_PRESENT_EVENT, requestQuickPresent, type QuickPresentEventDetail } from "@/lib/compass/quick-present-events";
import { createId, createProject, withSourceFiles } from "@/lib/projects/factory";
import { listProjects, saveProject } from "@/lib/projects/store";
import { saveLocalSourceFile } from "@/lib/projects/file-store";
import type { Project, SourceFileRecord } from "@/lib/projects/types";
import { analyzeBrowserFile, projectWithRebuiltIntelligence, sourceFileRecord } from "@/lib/intelligence/client";
import { outcomeReady, projectWithBuiltOutcome } from "@/lib/outcomes/builder";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function projectCompassClientId(project: Project): string {
  const value = project.intelligence.facts.find((fact) => fact.key === "compass.clientId")?.value;
  return typeof value === "string" ? value : "";
}

function findClientReportProject(clientId: string, clientName: string): Project | undefined {
  const projects = listProjects().filter((project) => project.type === "client-report");
  return projects.find((project) => projectCompassClientId(project) === clientId)
    ?? projects.find((project) => normalize(project.client.name) === normalize(clientName));
}

function huntressSource(project: Project) {
  return project.sources.find((source) => source.kind === "huntress-pdf");
}

function openExceptions(project: Project): number {
  return project.intelligence.exceptions.filter((item) => item.status === "open").length;
}

function PresentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5V8Z"/><path d="M8 21h8M12 17v4"/></svg>;
}

export function QuickPresentGlobal() {
  const { dataset, ready } = useCompassState();
  const [mounted, setMounted] = useState(false);
  const [clientId, setClientId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsWorkspaceReview, setNeedsWorkspaceReview] = useState<Project | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const selectedClient = useMemo(() => dataset?.clients.find((client) => client.id === clientId) ?? null, [clientId, dataset]);
  const searchResults = useMemo(() => {
    if (!dataset) return [];
    const needle = normalize(query);
    if (!needle) return dataset.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
    return dataset.clients
      .filter((client) => normalize([client.name, client.primaryContact, client.primaryContactEmail].filter(Boolean).join(" ")).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [dataset, query]);

  const close = () => {
    if (busy) return;
    setPickerOpen(false);
    setClientId("");
    setQuery("");
    setFile(null);
    setStatus("");
    setNeedsWorkspaceReview(null);
  };

  const goToPresentation = (project: Project) => {
    window.location.assign(`/project/?id=${encodeURIComponent(project.id)}&present=1`);
  };

  const chooseClient = (nextClientId: string) => {
    if (!dataset) return;
    const client = dataset.clients.find((item) => item.id === nextClientId);
    if (!client) return;
    const project = findClientReportProject(client.id, client.name);
    if (project && outcomeReady(project)) {
      goToPresentation(project);
      return;
    }
    if (project && huntressSource(project)?.files.length && openExceptions(project) === 0) {
      const built = projectWithBuiltOutcome(project);
      saveProject(built);
      goToPresentation(built);
      return;
    }
    if (project && huntressSource(project)?.files.length && openExceptions(project) > 0) {
      setClientId(client.id);
      setPickerOpen(true);
      setNeedsWorkspaceReview(project);
      setStatus(`${openExceptions(project)} confirmation${openExceptions(project) === 1 ? " is" : "s are"} still required before presentation.`);
      return;
    }
    setClientId(client.id);
    setQuery("");
    setFile(null);
    setNeedsWorkspaceReview(null);
    setStatus("");
    setPickerOpen(true);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<QuickPresentEventDetail>).detail;
      const requestedClientId = detail?.clientId?.trim() ?? "";
      if (requestedClientId) {
        chooseClient(requestedClientId);
        return;
      }
      setClientId("");
      setQuery("");
      setFile(null);
      setStatus("");
      setNeedsWorkspaceReview(null);
      setPickerOpen(true);
    };
    window.addEventListener(QUICK_PRESENT_EVENT, handler as EventListener);
    return () => window.removeEventListener(QUICK_PRESENT_EVENT, handler as EventListener);
  // dataset must remain current when a global event arrives.
  }, [dataset]);

  const analyzeHuntress = async (huntressFile: File): Promise<SourceFileRecord> => {
    const fileId = createId("file");
    const analysis = await analyzeBrowserFile({ file: huntressFile, expectedKind: "huntress-pdf", fileId });
    try {
      await saveLocalSourceFile(fileId, huntressFile);
    } catch {
      analysis.warnings = [...analysis.warnings, "The Huntress report was analyzed, but this browser could not cache the original PDF. Reattach it later if source reprocessing is needed."];
    }
    return sourceFileRecord(huntressFile, analysis, undefined, fileId);
  };

  const generateAndPresent = async () => {
    if (!dataset || !selectedClient || !file || busy) return;
    setBusy(true);
    setStatus(`Reading ${file.name}…`);
    setNeedsWorkspaceReview(null);
    try {
      const huntressRecord = await analyzeHuntress(file);
      const existing = findClientReportProject(selectedClient.id, selectedClient.name);
      let project: Project;

      if (existing) {
        const nextSources = existing.sources.map((source) => source.kind === "huntress-pdf" ? withSourceFiles(source, [huntressRecord]) : source);
        project = projectWithRebuiltIntelligence({
          ...existing,
          sources: nextSources,
          findings: [],
          recommendations: [],
          presentation: { ...existing.presentation, executiveSummary: "", publishedAt: "" },
        });
      } else {
        const prefill = buildCompassGeneratorPrefill(dataset, selectedClient.id);
        if (!prefill) throw new Error("The current Client Compass snapshot could not be connected for this client.");
        project = createProject({
          type: "client-report",
          clientName: prefill.clientName,
          contactName: prefill.contactName,
          contactRole: prefill.contactRole,
          contactEmail: prefill.contactEmail,
          contactPhone: prefill.contactPhone,
          painPoints: prefill.context,
          sourceRecords: { ...prefill.sourceRecords, "huntress-pdf": [huntressRecord] },
          reviewOutcome: prefill.reviewOutcome,
        });
      }

      const remaining = openExceptions(project);
      if (remaining > 0) {
        saveProject(project);
        setNeedsWorkspaceReview(project);
        setStatus(`Huntress is attached. ${remaining} confirmation${remaining === 1 ? " is" : "s are"} still required before the client presentation can be generated.`);
        return;
      }

      const finished = projectWithBuiltOutcome(project);
      saveProject(finished);
      setStatus("Report ready. Opening presentation…");
      window.setTimeout(() => goToPresentation(finished), 120);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "The quick presentation could not be generated.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button className="global-quick-present-button" type="button" onClick={() => requestQuickPresent()} disabled={!ready || !dataset} title="Quickly open or generate a client report presentation"><PresentIcon /><span>Present</span></button>
    {mounted && pickerOpen && createPortal(<div className="quick-present-backdrop" role="presentation" onMouseDown={close}>
      <section className="quick-present-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-present-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><span className="quick-present-mark"><PresentIcon /></span><div><span className="compass-kicker">Quick Present</span><h2 id="quick-present-title">{selectedClient ? selectedClient.name : "Choose a client"}</h2></div><button type="button" onClick={close} aria-label="Close Quick Present">×</button></header>
        {!selectedClient ? <div className="quick-present-client-picker">
          <label><span>Client</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients…" /></label>
          <div className="quick-present-client-results">{searchResults.map((client) => {
            const project = findClientReportProject(client.id, client.name);
            const readyProject = Boolean(project && outcomeReady(project));
            return <button key={client.id} type="button" onClick={() => chooseClient(client.id)}><span><strong>{client.name}</strong><small>{client.primaryContact || client.primaryContactEmail || "Client Compass account"}</small></span><em>{readyProject ? "Ready to present" : "Quick generate"}</em></button>;
          })}</div>
        </div> : <div className="quick-present-generate">
          {needsWorkspaceReview ? <div className="quick-present-review-needed"><strong>Workspace confirmation needed</strong><p>{status}</p><button className="button primary full" type="button" onClick={() => window.location.assign(`/project/?id=${encodeURIComponent(needsWorkspaceReview.id)}`)}>Open workspace</button></div> : <>
            <div className="quick-present-summary"><span>Client Compass snapshot</span><strong>Connected</strong><small>Lifecycle, devices, current review history, and client context are already supplied.</small></div>
            <input ref={inputRef} hidden type="file" accept="application/pdf,.pdf" onChange={(event) => { const next = event.currentTarget.files?.[0] ?? null; setFile(next); setStatus(""); event.currentTarget.value = ""; }} />
            <button className={`quick-present-huntress-drop${file ? " has-file" : ""}`} type="button" onClick={() => inputRef.current?.click()} disabled={busy}><span>{file ? "✓" : "+"}</span><div><strong>{file ? file.name : "Add current Huntress PDF"}</strong><small>{file ? "Ready to generate" : "Security activity is the only missing source."}</small></div></button>
            {status && <div className="quick-present-status" role="status">{status}</div>}
            <footer><button className="button secondary" type="button" onClick={() => { setClientId(""); setFile(null); setStatus(""); }}>Choose another client</button><button className="button primary" type="button" disabled={!file || busy} onClick={() => void generateAndPresent()}>{busy ? "Generating…" : "Generate & Present"}</button></footer>
          </>}
        </div>}
      </section>
    </div>, document.body)}
  </>;
}
