"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { buildCompassGeneratorPrefill } from "@/lib/compass/generator-bridge";
import { loadCompassDataset } from "@/lib/compass/store";
import { createId, withSourceFiles } from "@/lib/projects/factory";
import { deleteProject, getProject, saveProject } from "@/lib/projects/store";
import { deleteLocalSourceFiles, getLocalSourceFile, saveLocalSourceFile } from "@/lib/projects/file-store";
import { getProjectTemplate } from "@/lib/projects/templates";
import type { IntelligenceException, Project, SourceDocument, SourceFileRecord } from "@/lib/projects/types";
import { analyzeBrowserFile, factDisplayValue, projectWithRebuiltIntelligence, resolvedException, sourceFileRecord } from "@/lib/intelligence/client";
import { outcomeReady, projectWithBuiltOutcome } from "@/lib/outcomes/builder";
import { enableHipaaAssessment } from "@/lib/hipaa/engine";
import { OutcomeExperience } from "./outcome-experience";
import { NewOwnershipExperience } from "./new-ownership-experience";
import { HipaaReadiness } from "./hipaa-readiness";
import { A360ConversationWorkspace } from "./a360-conversation-workspace";
import { ArrowIcon, CheckIcon, FileIcon, SparkIcon, UploadIcon } from "./icons";
import { normalizeOrganizationTerm } from "@/lib/projects/client-language";
import { latestReviewOutcome } from "@/lib/review-outcomes/model";
import { withManualInventory } from "@/lib/outcomes/manual-inventory";

const ORGANIZATION_TERM_OPTIONS = ["practice", "firm", "hospital", "business", "organization"] as const;

function isPresetOrganizationTerm(value: string): boolean {
  return ORGANIZATION_TERM_OPTIONS.includes(value.trim().toLowerCase() as (typeof ORGANIZATION_TERM_OPTIONS)[number]);
}

function formatFileSize(size: number): string {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function statusLabel(project: Project): string {
  if (outcomeReady(project)) return "Package ready";
  if (project.status === "sources-needed") return "Sources needed";
  if (project.status === "review-needed") return "Confirmation needed";
  if (project.status === "intelligence-ready") return "Ready to create";
  return "Source intake";
}

function ExceptionRow({ item, onResolve }: { item: IntelligenceException; onResolve: (value: string) => void }) {
  const [value, setValue] = useState(item.value || item.suggestedValue);
  useEffect(() => setValue(item.value || item.suggestedValue), [item.value, item.suggestedValue]);
  return (
    <div className={`exception-row ${item.status === "resolved" ? "resolved" : ""}`}>
      <span className="exception-status">{item.status === "resolved" ? <CheckIcon /> : "?"}</span>
      <div className="exception-copy"><strong>{item.prompt}</strong><p>{item.reason}</p></div>
      <div className="exception-answer"><input value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)} placeholder="Enter answer" /><button className="button secondary compact" type="button" onClick={() => onResolve(value)}>{item.status === "resolved" ? "Update" : "Confirm"}</button></div>
    </div>
  );
}

function SourceWorkspaceRow({ source, busy, onAttach }: { source: SourceDocument; busy: boolean; onAttach: (source: SourceDocument, files: File[]) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const complete = source.files.length > 0 && source.status !== "failed";
  const analysisTypes = [...new Set(source.files.map((file) => file.analysis?.sourceType).filter(Boolean))];
  return (
    <div className={`workspace-source-row ${complete ? "complete" : ""} ${busy ? "busy" : ""}`}>
      <span className="workspace-source-icon">{busy ? <SparkIcon /> : complete ? <CheckIcon /> : <UploadIcon />}</span>
      <span className="workspace-source-copy"><strong>{source.label}</strong><small>{busy ? "Reading and structuring the source…" : source.files.length ? `${source.files.length} file${source.files.length === 1 ? "" : "s"} · ${analysisTypes.join(" · ") || "attached"}` : source.acceptedExtensions.join(" · ").toUpperCase()}</small></span>
      <span className={source.required ? "required-tag" : "optional-tag"}>{source.required ? "Required" : "Optional"}</span>
      <input ref={inputRef} hidden type="file" multiple={source.multiple} accept={source.acceptedExtensions.join(",")} onChange={(event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []) as File[]; if (files.length) void onAttach(source, files); event.currentTarget.value = ""; }} />
      <button className="button secondary compact" disabled={busy} type="button" onClick={() => inputRef.current?.click()}><FileIcon />{source.files.length ? (source.multiple ? "Add" : "Replace") : "Attach"}</button>
    </div>
  );
}

export function ProjectWorkspace({ projectId, autoPresent = false }: { projectId: string; autoPresent?: boolean }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [busySourceId, setBusySourceId] = useState("");
  const [reprocessingSources, setReprocessingSources] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [hipaaReviewOpen, setHipaaReviewOpen] = useState(false);
  const sourceDrawerRef = useRef<HTMLDetailsElement>(null);
  const automaticCompassRefreshRef = useRef("");

  useEffect(() => setProject(getProject(projectId) ?? null), [projectId]);
  const template = project ? getProjectTemplate(project.type) : null;
  const attachedSources = useMemo(() => project ? project.sources.filter((source) => source.files.length).length : 0, [project]);
  const processedFiles = useMemo(() => project ? project.sources.flatMap((source) => source.files).filter((file) => file.analysis).length : 0, [project]);
  const openExceptions = useMemo(() => project ? project.intelligence.exceptions.filter((item) => item.status === "open") : [], [project]);
  const resolvedExceptions = useMemo(() => project ? project.intelligence.exceptions.filter((item) => item.status === "resolved") : [], [project]);
  const visibleFacts = useMemo(() => {
    if (!project) return [];
    const keys = project.type === "client-report"
      ? ["scalepad.totalAssets", "scalepad.replacement.overdue", "scalepad.replacement.dueSoon", "scalepad.os.unsupported", "huntress.eventsAnalyzed", "huntress.signalsDetected", "huntress.canaryFiles", "huntress.incidentsReported"]
      : ["environment.totalComputers", "environment.workstations", "environment.servers", "applications.clinical", "security.firewallDisabled", "patching.affectedComputers", "lifecycle.serverReview", "backup.endpointMissing"];
    return project.intelligence.facts.filter((item) => keys.includes(item.key)).slice(0, 8);
  }, [project]);
  const technicalSourceFacts = useMemo(() => {
    if (!project) return [];
    const order = [
      "technical.source.primary",
      "technical.source.inventory",
      "technical.source.identity",
      "technical.source.classification",
      "technical.source.os",
      "technical.source.activity",
      "technical.source.storage",
      "technical.source.lifecycle",
      "technical.source.warranty",
      "technical.source.precedence",
    ];
    const rank = new Map(order.map((key, index) => [key, index]));
    return project.intelligence.facts
      .filter((item) => rank.has(item.key))
      .sort((a, b) => (rank.get(a.key) ?? 99) - (rank.get(b.key) ?? 99));
  }, [project]);
  const hasOutcome = project ? outcomeReady(project) : false;

  useEffect(() => {
    if (!project || project.type !== "client-report") return;
    const snapshotRecords = project.sources.flatMap((source) => source.files).filter((record) => record.mimeType === "application/x-client-compass-snapshot");
    if (!snapshotRecords.length) return;
    const record = snapshotRecords[0];
    const clientId = String(record.analysis?.facts.find((item) => item.key === "compass.clientId")?.value ?? record.id.replace(/^compass-source-/, ""));
    const connectedImport = String(record.analysis?.facts.find((item) => item.key === "compass.importedAt")?.value ?? "");
    const authoritative = Boolean(record.analysis?.facts.find((item) => item.key === "compass.authoritativeInventory")?.value);
    const attemptKey = `${project.id}:${clientId}:${connectedImport}:${authoritative}`;
    if (automaticCompassRefreshRef.current === attemptKey) return;
    automaticCompassRefreshRef.current = attemptKey;
    let cancelled = false;
    void (async () => {
      try {
        const dataset = await loadCompassDataset();
        if (!dataset || cancelled) return;
        const prefill = buildCompassGeneratorPrefill(dataset, clientId);
        const refreshed = prefill?.sourceRecords["scalepad-pdf"]?.[0];
        if (!refreshed || !prefill) return;
        const nextReviewOutcome = latestReviewOutcome(project.reviewOutcome, prefill.reviewOutcome);
        const reviewOutcomeChanged = nextReviewOutcome.lastUpdatedAt !== project.reviewOutcome.lastUpdatedAt || nextReviewOutcome.status !== project.reviewOutcome.status;
        if (authoritative && connectedImport === dataset.importedAt && !reviewOutcomeChanged) return;
        const nextSources = project.sources.map((source) => withSourceFiles(source, source.files.map((item) => item.id === record.id ? { ...refreshed, id: item.id } : item)));
        const sourceRebuilt = projectWithRebuiltIntelligence({ ...project, reviewOutcome: nextReviewOutcome, sources: nextSources, findings: [], recommendations: [], presentation: { ...project.presentation, executiveSummary: "" } });
        const rebuilt = project.manualInventory ? withManualInventory(sourceRebuilt, project.manualInventory.devices) : sourceRebuilt;
        if (cancelled) return;
        setProject(rebuilt);
        saveProject(rebuilt);
      } catch {
        /* Manual Refresh source data remains available if automatic catch-up is blocked. */
      }
    })();
    return () => { cancelled = true; };
  }, [project]);

  if (project === undefined) return <div className="loading-state">Loading workspace…</div>;
  if (project === null || !template) return <div className="empty-state large"><span className="eyebrow">Workspace unavailable</span><h1>This workspace is not saved in this browser.</h1><p>Return to the dashboard and create or open another workspace.</p><Link className="button primary" href="/">Back to workspaces</Link></div>;
  if (project.a360Conversation) return <A360ConversationWorkspace project={project} onUpdate={(next) => { setProject(next); saveProject(next); }} />;

  const currentProject = project;
  const currentTemplate = template;
  const streamlinedReport = hasOutcome && currentProject.type === "client-report";
  const newOwnershipPackage = currentProject.type === "client-report" && Boolean(currentProject.newOwnership?.enabled);

  function update(next: Project) {
    setProject(next);
    saveProject(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  async function attachAndAnalyze(source: SourceDocument, files: File[]) {
    setBusySourceId(source.id);
    const records: SourceFileRecord[] = [];
    for (const file of files) {
      const fileId = createId("file");
      try {
        const analysis = await analyzeBrowserFile({ file, expectedKind: source.kind, fileId });
        try { await saveLocalSourceFile(fileId, file); } catch { analysis.warnings = [...analysis.warnings, "The source was analyzed, but this browser could not retain a local cached copy. Reattach it if a later step needs the original file."]; }
        records.push(sourceFileRecord(file, analysis, undefined, fileId));
      } catch (error) {
        records.push(sourceFileRecord(file, undefined, error instanceof Error ? error.message : "Source analysis failed.", fileId));
      }
    }
    if (!source.multiple && source.files.length) {
      try { await deleteLocalSourceFiles(source.files.map((file) => file.id)); } catch { /* Keep the project record even if cache cleanup fails. */ }
    }
    const nextFiles = source.multiple ? [...source.files, ...records] : records.slice(0, 1);
    const nextSources = currentProject.sources.map((item) => item.id === source.id ? withSourceFiles(item, nextFiles) : item);
    const intelligenceRebuilt = projectWithRebuiltIntelligence({ ...currentProject, sources: nextSources, findings: [], recommendations: [], presentation: { ...currentProject.presentation, executiveSummary: "" } });
    const inventoryRebuilt = currentProject.manualInventory ? withManualInventory(intelligenceRebuilt, currentProject.manualInventory.devices) : intelligenceRebuilt;
    const rebuilt = hasOutcome ? projectWithBuiltOutcome(inventoryRebuilt) : inventoryRebuilt;
    update(rebuilt);
    setBusySourceId("");
  }

  async function reprocessCachedSources() {
    setReprocessingSources(true);
    try {
      const nextSources: SourceDocument[] = [];
      let compassDataset: Awaited<ReturnType<typeof loadCompassDataset>> | undefined;
      let nextReviewOutcome = currentProject.reviewOutcome;
      for (const source of currentProject.sources) {
        const nextFiles: SourceFileRecord[] = [];
        for (const record of source.files) {
          try {
            if (record.mimeType === "application/x-client-compass-snapshot") {
              compassDataset ??= await loadCompassDataset();
              const clientId = String(record.analysis?.facts.find((item) => item.key === "compass.clientId")?.value ?? record.id.replace(/^compass-source-/, ""));
              const prefill = compassDataset ? buildCompassGeneratorPrefill(compassDataset, clientId) : null;
              const refreshed = prefill?.sourceRecords["scalepad-pdf"]?.[0];
              if (prefill) nextReviewOutcome = latestReviewOutcome(nextReviewOutcome, prefill.reviewOutcome);
              nextFiles.push(refreshed ? { ...refreshed, id: record.id } : { ...record, status: "failed", error: "The current Client Compass snapshot no longer contains this client." });
              continue;
            }
            const cached = await getLocalSourceFile(record.id);
            if (!cached) {
              nextFiles.push(record);
              continue;
            }
            const analysis = await analyzeBrowserFile({ file: cached, expectedKind: source.kind, fileId: record.id });
            nextFiles.push({ ...sourceFileRecord(cached, analysis, undefined, record.id), addedAt: record.addedAt });
          } catch (error) {
            nextFiles.push({ ...record, error: error instanceof Error ? error.message : "Source reprocessing failed.", id: record.id });
          }
        }
        nextSources.push(withSourceFiles(source, nextFiles));
      }
      const sourceRebuilt = projectWithRebuiltIntelligence({ ...currentProject, reviewOutcome: nextReviewOutcome, sources: nextSources, findings: [], recommendations: [], presentation: { ...currentProject.presentation, executiveSummary: "" } });
      const rebuilt = currentProject.manualInventory ? withManualInventory(sourceRebuilt, currentProject.manualInventory.devices) : sourceRebuilt;
      update(hasOutcome ? projectWithBuiltOutcome(rebuilt) : rebuilt);
    } finally {
      setReprocessingSources(false);
    }
  }

  function resolve(item: IntelligenceException, value: string) {
    const rebuilt = resolvedException(currentProject, item.id, value);
    update({ ...rebuilt, findings: [], recommendations: [], presentation: { ...rebuilt.presentation, executiveSummary: "" } });
  }

  function updateClientName(value: string) {
    update({ ...currentProject, client: { ...currentProject.client, name: value } });
  }

  function updateOrganizationTerm(value: string) {
    update({ ...currentProject, client: { ...currentProject.client, organizationTerm: normalizeOrganizationTerm(value) } });
  }

  function updateProjectName(value: string) { update({ ...currentProject, name: value }); }

  async function removeWorkspace() {
    if (!window.confirm(`Delete ${currentProject.name}? This removes the local workspace and cached source files from this browser.`)) return;
    await deleteProject(currentProject.id);
    window.location.assign("/");
  }

  return <main className="workspace-page">
    <div className="workspace-topline"><Link href="/" className="back-link">← Workspaces</Link><span className="workspace-status">{statusLabel(currentProject)}</span>{saved && <span className="saved-indicator">Saved</span>}</div>
    <section className="workspace-hero">
      <div><span className="eyebrow">{currentTemplate.shortTitle}</span><input className="workspace-title-input" value={currentProject.name} onChange={(event) => updateProjectName(event.target.value)} /><p>{currentTemplate.description}</p></div>
      <div className="workspace-hero-actions"><button className="button danger" type="button" onClick={() => void removeWorkspace()}>Delete workspace</button></div>
    </section>
    <section className="workspace-card client-details-card"><div className="section-heading"><div><span className="eyebrow">Client</span><h2>Who is this for?</h2></div></div><div className="client-details-grid"><label><span>Name</span><input value={currentProject.client.name} onChange={(event) => updateClientName(event.target.value)} /></label><label><span>Organization language</span>{isPresetOrganizationTerm(currentProject.client.organizationTerm) ? <select value={currentProject.client.organizationTerm} onChange={(event) => updateOrganizationTerm(event.target.value)}>{ORGANIZATION_TERM_OPTIONS.map((term) => <option key={term} value={term}>{term[0].toUpperCase() + term.slice(1)}</option>)}</select> : <input value={currentProject.client.organizationTerm} onChange={(event) => updateOrganizationTerm(event.target.value)} />}</label></div></section>
    <section className="workspace-card source-workspace"><div className="section-heading"><div><span className="eyebrow">Sources</span><h2>Build the source record</h2><p>{attachedSources} source group{attachedSources === 1 ? "" : "s"} attached · {processedFiles} file{processedFiles === 1 ? "" : "s"} analyzed</p></div><button className="button secondary compact" type="button" disabled={reprocessingSources} onClick={() => void reprocessCachedSources()}>{reprocessingSources ? "Refreshing…" : "Refresh source data"}</button></div><div className="workspace-source-list">{currentProject.sources.map((source) => <SourceWorkspaceRow key={source.id} source={source} busy={busySourceId === source.id} onAttach={attachAndAnalyze} />)}</div></section>
    {openExceptions.length > 0 && <section className="workspace-card exception-workspace"><div className="section-heading"><div><span className="eyebrow">Review</span><h2>Confirm what the source cannot prove.</h2><p>{openExceptions.length} item{openExceptions.length === 1 ? "" : "s"} need a quick human answer before the package is generated.</p></div></div><div className="exception-list">{openExceptions.map((item) => <ExceptionRow key={item.id} item={item} onResolve={(value) => resolve(item, value)} />)}</div></section>}
    {resolvedExceptions.length > 0 && <details className="workspace-card resolved-exceptions"><summary>{resolvedExceptions.length} confirmed answer{resolvedExceptions.length === 1 ? "" : "s"}</summary><div className="exception-list">{resolvedExceptions.map((item) => <ExceptionRow key={item.id} item={item} onResolve={(value) => resolve(item, value)} />)}</div></details>}
    <section className="workspace-card intelligence-workspace"><div className="section-heading"><div><span className="eyebrow">Intelligence</span><h2>What Compass knows so far</h2><p>{currentProject.intelligence.facts.length} extracted facts · {currentProject.intelligence.findingCandidates.length} finding candidates</p></div></div>{visibleFacts.length > 0 ? <div className="workspace-fact-grid">{visibleFacts.map((item) => <article key={item.id}><span>{item.label}</span><strong>{factDisplayValue(item.value)}</strong><small>{item.confidence} confidence</small></article>)}</div> : <div className="empty-inline">Attach and analyze the source files to build the intelligence record.</div>}{technicalSourceFacts.length > 0 && <details className="technical-source-details"><summary>Technical source details</summary><div className="workspace-fact-grid">{technicalSourceFacts.map((item) => <article key={item.id}><span>{item.label}</span><strong>{factDisplayValue(item.value)}</strong><small>{item.evidence}</small></article>)}</div></details>}</section>
    {currentProject.type === "client-report" && <HipaaReadiness project={currentProject} expanded={hipaaReviewOpen} onToggle={() => setHipaaReviewOpen((value) => !value)} onUpdate={update} />}
    <details ref={sourceDrawerRef} className="workspace-card source-drawer" open={sourceDrawerOpen} onToggle={(event) => setSourceDrawerOpen(event.currentTarget.open)}><summary>Source record</summary><div className="workspace-source-list">{currentProject.sources.map((source) => <SourceWorkspaceRow key={source.id} source={source} busy={busySourceId === source.id} onAttach={attachAndAnalyze} />)}</div></details>
    {newOwnershipPackage ? <NewOwnershipExperience project={currentProject} onUpdate={update} autoPresent={autoPresent} /> : <OutcomeExperience project={currentProject} onUpdate={update} autoPresent={autoPresent} />}
  </main>;
}
