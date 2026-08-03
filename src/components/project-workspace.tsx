"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createId, withSourceFiles } from "@/lib/projects/factory";
import { deleteProject, getProject, saveProject } from "@/lib/projects/store";
import { deleteLocalSourceFiles, getLocalSourceFile, saveLocalSourceFile } from "@/lib/projects/file-store";
import { getProjectTemplate } from "@/lib/projects/templates";
import type { IntelligenceException, Project, SourceDocument, SourceFileRecord } from "@/lib/projects/types";
import { analyzeBrowserFile, factDisplayValue, projectWithRebuiltIntelligence, resolvedException, sourceFileRecord } from "@/lib/intelligence/client";
import { outcomeReady, projectWithBuiltOutcome } from "@/lib/outcomes/builder";
import { OutcomeExperience } from "./outcome-experience";
import { HipaaReadiness } from "./hipaa-readiness";
import { ArrowIcon, CheckIcon, FileIcon, SparkIcon, UploadIcon } from "./icons";

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

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [busySourceId, setBusySourceId] = useState("");
  const [reprocessingSources, setReprocessingSources] = useState(false);

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
  const hasOutcome = project ? outcomeReady(project) : false;

  if (project === undefined) return <div className="loading-state">Loading workspace…</div>;
  if (project === null || !template) return <div className="empty-state large"><span className="eyebrow">Workspace unavailable</span><h1>This workspace is not saved in this browser.</h1><p>Return to the dashboard and create or open another workspace.</p><Link className="button primary" href="/">Back to workspaces</Link></div>;

  const currentProject = project;
  const currentTemplate = template;

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
    const rebuilt = projectWithRebuiltIntelligence({ ...currentProject, sources: nextSources, findings: [], recommendations: [], presentation: { ...currentProject.presentation, executiveSummary: "" } });
    update(rebuilt);
    setBusySourceId("");
  }

  async function reprocessCachedSources() {
    setReprocessingSources(true);
    try {
      const nextSources: SourceDocument[] = [];
      for (const source of currentProject.sources) {
        const nextFiles: SourceFileRecord[] = [];
        for (const record of source.files) {
          try {
            const cached = await getLocalSourceFile(record.id);
            if (!cached) {
              nextFiles.push(record);
              continue;
            }
            const analysis = await analyzeBrowserFile({ file: cached, expectedKind: source.kind, fileId: record.id });
            nextFiles.push({ ...sourceFileRecord(cached, analysis, undefined, record.id), addedAt: record.addedAt });
          } catch (error) {
            nextFiles.push({ ...record, error: error instanceof Error ? error.message : "Source reprocessing failed." });
          }
        }
        nextSources.push(withSourceFiles(source, nextFiles));
      }
      const rebuilt = projectWithRebuiltIntelligence({
        ...currentProject,
        sources: nextSources,
        findings: [],
        recommendations: [],
        presentation: { ...currentProject.presentation, executiveSummary: "" },
      });
      update(rebuilt);
    } finally {
      setReprocessingSources(false);
    }
  }

  function resolve(item: IntelligenceException, value: string) {
    const rebuilt = resolvedException(currentProject, item.id, value);
    update({ ...rebuilt, findings: [], recommendations: [], presentation: { ...rebuilt.presentation, executiveSummary: "" } });
  }

  function createOutcome() {
    update(projectWithBuiltOutcome(currentProject));
    window.setTimeout(() => document.getElementById("client-experience")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  return (
    <div className="workspace-page">
      <div className="workspace-header">
        <div><Link className="back-link" href="/">← Workspaces</Link><span className={`accent-text-${currentTemplate.accent}`}>{currentTemplate.eyebrow}</span><h1>{currentProject.client.name}</h1><input className="project-name-input" value={currentProject.name} onChange={(event: ChangeEvent<HTMLInputElement>) => update({ ...currentProject, name: event.target.value })} aria-label="Workspace name" /></div>
        <div className="workspace-header-actions"><span className={`save-indicator ${saved ? "visible" : ""}`}>Saved</span><span className={`status-pill status-${currentProject.status}`}>{statusLabel(currentProject)}</span><button className="button secondary" type="button" onClick={async () => { await deleteProject(currentProject.id); window.location.assign("/"); }}>Delete</button></div>
      </div>

      <div className="workspace-rail compact-rail" aria-label="Workspace progress">
        <div className="rail-step complete"><span><CheckIcon /></span><strong>Sources</strong><small>{attachedSources} attached</small></div>
        <div className="rail-line active" />
        <div className={`rail-step ${openExceptions.length ? "active" : "complete"}`}><span>{openExceptions.length ? "2" : <CheckIcon />}</span><strong>Confirm</strong><small>{openExceptions.length ? `${openExceptions.length} left` : "Complete"}</small></div>
        <div className={`rail-line ${!openExceptions.length ? "active" : ""}`} />
        <div className={`rail-step ${hasOutcome ? "complete" : !openExceptions.length ? "active" : ""}`}><span>{hasOutcome ? <CheckIcon /> : "3"}</span><strong>Package</strong><small>{hasOutcome ? "Ready" : "Generate"}</small></div>
      </div>

      {!hasOutcome && <section className={`intelligence-hero accent-${currentTemplate.accent}`}><div><span className="eyebrow"><SparkIcon /> Source review</span><h2>{openExceptions.length ? `The sources did most of the work. Confirm ${openExceptions.length} item${openExceptions.length === 1 ? "" : "s"}.` : "Everything needed to build the finished package is ready."}</h2><p>{currentProject.intelligence.sourceSummaries.map((item) => item.summary).join(" ") || "Attach the required material to begin."}</p></div><div className="intelligence-score"><strong>{processedFiles}</strong><span>files understood</span></div></section>}

      {hasOutcome && <OutcomeExperience project={currentProject} onUpdate={update} />}

      {!hasOutcome && (
        <div className="workspace-layout intelligence-layout">
          <main className="intelligence-main">
            {openExceptions.length > 0 ? (
              <section className="workspace-card exception-card" id="confirmation-items"><div className="workspace-card-heading"><div><span className="section-kicker">Minimal input</span><h2>Confirm only what the sources cannot know.</h2><p>Suggested answers are prefilled when the source provides a useful starting point.</p></div><div className="readiness-ring warning"><strong>{openExceptions.length}</strong><span>remaining</span></div></div><div className="exception-list">{openExceptions.map((item) => <ExceptionRow key={item.id} item={item} onResolve={(value) => resolve(item, value)} />)}</div></section>
            ) : (
              <section className={`create-outcome-card accent-${currentTemplate.accent}`}><span className="section-kicker">Ready</span><h2>Build the polished package.</h2><p>The report or proposal package will be composed automatically from the approved findings, client context, and recommendations. You can review the finished story instead of assembling sections.</p><button className="button primary" type="button" onClick={createOutcome}>Generate {currentProject.type === "client-report" ? "client report package" : "proposal package"} <ArrowIcon /></button></section>
            )}

            <section className="workspace-card"><div className="workspace-card-heading"><div><span className="section-kicker">At a glance</span><h2>What we found</h2><p>The useful facts are already organized. Supporting evidence stays available below.</p></div></div>{visibleFacts.length ? <div className="fact-grid">{visibleFacts.map((item) => <div className={`fact-card category-${item.category}`} key={item.id}><span>{item.label}</span><strong>{factDisplayValue(item.value)}</strong>{item.confidence !== "high" && <small>{item.confidence} confidence</small>}</div>)}</div> : <div className="empty-inline"><SparkIcon /><div><strong>No structured facts yet</strong><span>Attach or replace a source to run intelligence.</span></div></div>}</section>
          </main>

          <aside className="workspace-sidebar"><section className="workspace-card compact-card"><span className="section-kicker">Approved knowledge</span><h3>{currentProject.intelligence.facts.length} facts with source evidence</h3><ul className="clean-list"><li><CheckIcon /> Structured source summaries</li><li><CheckIcon /> Client-friendly findings</li><li><CheckIcon /> Confidence and evidence retained</li>{resolvedExceptions.length > 0 && <li><CheckIcon /> {resolvedExceptions.length} human confirmations captured</li>}</ul></section></aside>
        </div>
      )}

      <HipaaReadiness project={currentProject} onUpdate={update} />

      <details className="technical-drawer">
        <summary><span><strong>Source intelligence</strong><small>Facts, evidence, and attached files</small></span><span>Open details</span></summary>
        <div className="technical-drawer-body">
          {currentProject.intelligence.findingCandidates.length > 0 && <section className="workspace-card"><div className="workspace-card-heading"><div><span className="section-kicker">Report-ready insights</span><h2>Evidence-backed findings</h2><p>These are the technical findings used to build the client-facing story.</p></div></div><div className="finding-grid">{currentProject.intelligence.findingCandidates.map((item) => <article className={`finding-card severity-${item.severity}`} key={item.id}><div><span>{item.category}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p><details><summary>Evidence</summary><small>{item.evidence}</small></details></article>)}</div></section>}
          <section className="workspace-card source-detail-card"><div className="workspace-card-heading"><div><span className="section-kicker">Source files</span><h2>Attached material</h2><p>Add or replace a file when needed. Replacing or reprocessing a source refreshes the generated outcome.</p></div>{attachedSources > 0 && <button className="button secondary compact" disabled={reprocessingSources} type="button" onClick={() => void reprocessCachedSources()}><SparkIcon />{reprocessingSources ? "Reprocessing…" : "Reprocess cached sources"}</button>}</div><div className="workspace-source-list">{currentProject.sources.map((source) => <SourceWorkspaceRow key={source.id} source={source} busy={busySourceId === source.id} onAttach={attachAndAnalyze} />)}</div><div className="source-analysis-list">{currentProject.sources.flatMap((source) => source.files).map((file) => <details key={file.id}><summary><span>{file.name}</span><small>{formatFileSize(file.size)} · {file.analysis?.sourceType ?? file.status}</small></summary><div className="source-analysis-body"><p>{file.analysis?.summary || file.error || "Attached and awaiting analysis."}</p>{file.analysis?.highlights.length ? <ul>{file.analysis.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul> : null}{file.analysis?.warnings.length ? <div className="source-warning">{file.analysis.warnings.join(" ")}</div> : null}</div></details>)}</div></section>
        </div>
      </details>
    </div>
  );
}
