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
            nextFiles.push({ ...record, error: error instanceof Error ? error.message : "Source reprocessing failed." });
          }
        }
        nextSources.push(withSourceFiles(source, nextFiles));
      }
      const sourceRebuilt = projectWithRebuiltIntelligence({
        ...currentProject,
        reviewOutcome: nextReviewOutcome,
        sources: nextSources,
        findings: [],
        recommendations: [],
        presentation: { ...currentProject.presentation, executiveSummary: "" },
      });
      const inventoryRebuilt = currentProject.manualInventory ? withManualInventory(sourceRebuilt, currentProject.manualInventory.devices) : sourceRebuilt;
      const rebuilt = hasOutcome ? projectWithBuiltOutcome(inventoryRebuilt) : inventoryRebuilt;
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

  function updateOrganizationTerm(value: string) {
    const organizationTerm = normalizeOrganizationTerm(value);
    const changed = { ...currentProject, client: { ...currentProject.client, organizationTerm } };
    const next = hasOutcome
      ? projectWithBuiltOutcome({ ...changed, findings: [], recommendations: [], presentation: { ...changed.presentation, executiveSummary: "" } })
      : changed;
    update(next);
  }

  function openSourceDrawer() {
    setSourceDrawerOpen(true);
    if (!streamlinedReport) window.setTimeout(() => sourceDrawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  function setPlanningRecommendationMode(mode: "onsite-review" | "remote-consultation" | "no-action-needed") {
    const changed: Project = { ...currentProject, planningRecommendationMode: mode, planningAppointment: undefined };
    const next = hasOutcome
      ? projectWithBuiltOutcome({ ...changed, findings: [], recommendations: [], presentation: { ...changed.presentation, executiveSummary: "" } })
      : changed;
    update(next);
  }

  function toggleHipaa(enabled: boolean) {
    const toggled: Project = enabled
      ? enableHipaaAssessment(currentProject)
      : { ...currentProject, hipaa: { ...currentProject.hipaa, enabled: false, lastUpdatedAt: new Date().toISOString() } };
    const next = hasOutcome
      ? projectWithBuiltOutcome({ ...toggled, findings: [], recommendations: [], presentation: { ...toggled.presentation, executiveSummary: "" } })
      : toggled;
    update(next);
  }

  return (
    <div className="workspace-page">
      {streamlinedReport ? <header className="report-workspace-header">
        <Link className="report-workspace-back" href="/">← Workspaces</Link>
        <div className="report-workspace-identity">
          <span className="report-workspace-avatar" aria-hidden="true">{currentProject.client.name.trim().slice(0, 2).toUpperCase()}</span>
          <div><h1>{currentProject.client.name}</h1><div className="report-workspace-meta"><label><span>Client wording</span><select value={isPresetOrganizationTerm(currentProject.client.organizationTerm || "practice") ? (currentProject.client.organizationTerm || "practice").toLowerCase() : "__custom__"} onChange={(event: ChangeEvent<HTMLSelectElement>) => { const selected = event.target.value; if (selected === "__custom__") { const custom = window.prompt("Enter the word you want to use for this organization:", "organization"); if (custom?.trim()) updateOrganizationTerm(custom); return; } updateOrganizationTerm(selected); }} aria-label="How to refer to the organization"><option value="practice">Practice</option><option value="firm">Firm</option><option value="hospital">Hospital</option><option value="business">Business</option><option value="organization">Organization</option><option value="__custom__">Custom term…</option></select></label><span className={`save-indicator ${saved ? "visible" : ""}`}>Saved</span></div></div>
        </div>
      </header> : <div className="workspace-header">
        <div><Link className="back-link" href="/">← Workspaces</Link><span className={`accent-text-${currentTemplate.accent}`}>{currentTemplate.eyebrow}</span><h1>{currentProject.client.name}</h1><input className="project-name-input" value={currentProject.name} onChange={(event: ChangeEvent<HTMLInputElement>) => update({ ...currentProject, name: event.target.value })} aria-label="Workspace name" /><label className="organization-term-control"><span>Client wording</span><div className="organization-term-picker compact"><select value={isPresetOrganizationTerm(currentProject.client.organizationTerm || "practice") ? (currentProject.client.organizationTerm || "practice").toLowerCase() : "__custom__"} onChange={(event: ChangeEvent<HTMLSelectElement>) => { const selected = event.target.value; if (selected === "__custom__") { const custom = window.prompt("Enter the word you want to use for this organization:", "organization"); if (custom?.trim()) updateOrganizationTerm(custom); return; } updateOrganizationTerm(selected); }} aria-label="How to refer to the organization"><option value="practice">Practice</option><option value="firm">Firm</option><option value="hospital">Hospital</option><option value="business">Business</option><option value="organization">Organization</option><option value="__custom__">Custom term…</option></select>{!isPresetOrganizationTerm(currentProject.client.organizationTerm || "practice") && <input value={currentProject.client.organizationTerm || ""} onChange={(event: ChangeEvent<HTMLInputElement>) => updateOrganizationTerm(event.target.value)} placeholder="Custom term" aria-label="Custom organization term" />}</div></label></div>
        <div className="workspace-header-actions"><span className={`save-indicator ${saved ? "visible" : ""}`}>Saved</span><span className={`status-pill status-${currentProject.status}`}>{statusLabel(currentProject)}</span><button className="button secondary" type="button" onClick={async () => { await deleteProject(currentProject.id); window.location.assign("/"); }}>Delete</button></div>
      </div>}

      {!streamlinedReport && <div className="workspace-rail compact-rail" aria-label="Workspace progress">
        <div className="rail-step complete"><span><CheckIcon /></span><strong>Sources</strong><small>{attachedSources} attached</small></div>
        <div className="rail-line active" />
        <div className={`rail-step ${openExceptions.length ? "active" : "complete"}`}><span>{openExceptions.length ? "2" : <CheckIcon />}</span><strong>Confirm</strong><small>{openExceptions.length ? `${openExceptions.length} left` : "Complete"}</small></div>
        <div className={`rail-line ${!openExceptions.length ? "active" : ""}`} />
        <div className={`rail-step ${hasOutcome ? "complete" : !openExceptions.length ? "active" : ""}`}><span>{hasOutcome ? <CheckIcon /> : "3"}</span><strong>Package</strong><small>{hasOutcome ? "Ready" : "Generate"}</small></div>
      </div>}

      {!hasOutcome && <section className="generator-command-center" aria-label="Generator controls">
        <div className="generator-command-group"><span>1 · Data</span><div><button className="button secondary compact" type="button" onClick={openSourceDrawer}><FileIcon /> Sources & attachments</button><button className="button secondary compact" disabled={!attachedSources || reprocessingSources} type="button" onClick={() => void reprocessCachedSources()}><SparkIcon />{reprocessingSources ? "Refreshing…" : "Refresh source data"}</button></div></div>
        {!newOwnershipPackage && <div className="generator-command-group planning-mode-group"><span>2 · Planned next step</span><div className="planning-mode-toggle" role="group" aria-label="Recommended planning format"><button type="button" className={(currentProject.planningRecommendationMode ?? "onsite-review") === "onsite-review" ? "active" : ""} aria-pressed={(currentProject.planningRecommendationMode ?? "onsite-review") === "onsite-review"} onClick={() => setPlanningRecommendationMode("onsite-review")}>Onsite review</button><button type="button" className={currentProject.planningRecommendationMode === "remote-consultation" ? "active" : ""} aria-pressed={currentProject.planningRecommendationMode === "remote-consultation"} onClick={() => setPlanningRecommendationMode("remote-consultation")}>Remote consultation</button><button type="button" className={currentProject.planningRecommendationMode === "no-action-needed" ? "active" : ""} aria-pressed={currentProject.planningRecommendationMode === "no-action-needed"} onClick={() => setPlanningRecommendationMode("no-action-needed")}>No action needed</button></div></div>}
        <div className="generator-command-group generator-command-primary"><span>{newOwnershipPackage ? "2" : "3"} · Package</span><div><button className="button primary" type="button" disabled={openExceptions.length > 0} onClick={createOutcome}>Generate {newOwnershipPackage ? "new ownership package" : currentProject.type === "client-report" ? "client report" : "proposal"} <ArrowIcon /></button></div></div>
      </section>}

      {!hasOutcome && <section className={`intelligence-hero accent-${currentTemplate.accent}`}><div><span className="eyebrow"><SparkIcon /> Source review</span><h2>{openExceptions.length ? `The sources did most of the work. Confirm ${openExceptions.length} item${openExceptions.length === 1 ? "" : "s"}.` : "Everything needed to build the finished package is ready."}</h2><p>{currentProject.intelligence.sourceSummaries.map((item) => item.summary).join(" ") || "Attach the required material to begin."}</p></div><div className="intelligence-score"><strong>{processedFiles}</strong><span>files understood</span></div></section>}

      {hasOutcome && (newOwnershipPackage ? <NewOwnershipExperience project={currentProject} onUpdate={update} onOpenSources={openSourceDrawer} onOpenHipaa={() => setHipaaReviewOpen(true)} onDelete={async () => { await deleteProject(currentProject.id); window.location.assign("/"); }} onReprocessSources={() => void reprocessCachedSources()} reprocessingSources={reprocessingSources} canReprocessSources={attachedSources > 0} initialPresent={autoPresent} /> : <OutcomeExperience project={currentProject} onUpdate={update} onOpenSources={openSourceDrawer} onOpenHipaa={() => setHipaaReviewOpen(true)} onDelete={async () => { await deleteProject(currentProject.id); window.location.assign("/"); }} onReprocessSources={() => void reprocessCachedSources()} reprocessingSources={reprocessingSources} canReprocessSources={attachedSources > 0} onSetPlanningMode={setPlanningRecommendationMode} initialPresent={autoPresent} />)}

      {!hasOutcome && (
        <div className="workspace-layout intelligence-layout">
          <main className="intelligence-main">
            {openExceptions.length > 0 ? (
              <section className="workspace-card exception-card" id="confirmation-items"><div className="workspace-card-heading"><div><span className="section-kicker">Minimal input</span><h2>Confirm only what the sources cannot know.</h2><p>Suggested answers are prefilled when the source provides a useful starting point.</p></div><div className="readiness-ring warning"><strong>{openExceptions.length}</strong><span>remaining</span></div></div><div className="exception-list">{openExceptions.map((item) => <ExceptionRow key={item.id} item={item} onResolve={(value) => resolve(item, value)} />)}</div></section>
            ) : (
              <section className={`create-outcome-card accent-${currentTemplate.accent}`}><span className="section-kicker">Ready</span><h2>Build the polished package.</h2><p>Use the consolidated controls above to confirm the planned next step and generate the finished report or proposal.</p></section>
            )}

            <section className="workspace-card"><div className="workspace-card-heading"><div><span className="section-kicker">At a glance</span><h2>What we found</h2><p>The useful facts are already organized. Supporting evidence stays available below.</p></div></div>{visibleFacts.length ? <div className="fact-grid">{visibleFacts.map((item) => <div className={`fact-card category-${item.category}`} key={item.id}><span>{item.label}</span><strong>{factDisplayValue(item.value)}</strong>{item.confidence !== "high" && <small>{item.confidence} confidence</small>}</div>)}</div> : <div className="empty-inline"><SparkIcon /><div><strong>No structured facts yet</strong><span>Attach or replace a source to run intelligence.</span></div></div>}</section>
          </main>

          <aside className="workspace-sidebar"><section className="workspace-card compact-card"><span className="section-kicker">Approved knowledge</span><h3>{currentProject.intelligence.facts.length} facts with source evidence</h3><ul className="clean-list"><li><CheckIcon /> Structured source summaries</li><li><CheckIcon /> Client-friendly findings</li><li><CheckIcon /> Confidence and evidence retained</li>{resolvedExceptions.length > 0 && <li><CheckIcon /> {resolvedExceptions.length} human confirmations captured</li>}</ul></section></aside>
        </div>
      )}

      {!streamlinedReport && <HipaaReadiness project={currentProject} onUpdate={update} onToggle={toggleHipaa} />}

      {streamlinedReport && hipaaReviewOpen && <div className="report-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setHipaaReviewOpen(false); }}>
        <section className="report-editor-modal hipaa-editor-modal" role="dialog" aria-modal="true" aria-label="HIPAA readiness review">
          <header><div><span className="section-kicker">HIPAA readiness</span><h2>Review and edit answers</h2></div><button type="button" aria-label="Close HIPAA review" onClick={() => setHipaaReviewOpen(false)}>×</button></header>
          <div className="report-editor-scroll"><HipaaReadiness project={currentProject} onUpdate={update} onToggle={toggleHipaa} initialOpen /></div>
        </section>
      </div>}

      {streamlinedReport && sourceDrawerOpen && <div className="report-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSourceDrawerOpen(false); }}>
        <section className="report-editor-modal source-editor-modal" role="dialog" aria-modal="true" aria-label="Report sources">
          <header><div><span className="section-kicker">Report sources</span><h2>Sources</h2></div><button type="button" aria-label="Close sources" onClick={() => setSourceDrawerOpen(false)}>×</button></header>
          <div className="report-source-actions"><span><strong>{attachedSources}</strong> source {attachedSources === 1 ? "group" : "groups"} attached</span><button className="button secondary compact" disabled={!attachedSources || reprocessingSources} type="button" onClick={() => void reprocessCachedSources()}><SparkIcon />{reprocessingSources ? "Refreshing…" : "Refresh source data"}</button></div>
          <div className="report-editor-scroll report-source-list"><div className="workspace-source-list">{currentProject.sources.map((source) => <SourceWorkspaceRow key={source.id} source={source} busy={busySourceId === source.id} onAttach={attachAndAnalyze} />)}</div>{currentProject.sources.flatMap((source) => source.files).length > 0 && <div className="report-source-files">{currentProject.sources.flatMap((source) => source.files).map((file) => <div key={file.id}><strong>{file.name}</strong><span>{formatFileSize(file.size)} · {file.analysis?.sourceType ?? file.status}</span></div>)}</div>}</div>
        </section>
      </div>}

      {!streamlinedReport && <details ref={sourceDrawerRef} className="technical-drawer" open={sourceDrawerOpen} onToggle={(event) => setSourceDrawerOpen(event.currentTarget.open)}>
        <summary><span><strong>Source intelligence</strong><small>Facts, evidence, and attached files</small></span><span>Open details</span></summary>
        <div className="technical-drawer-body">
          {technicalSourceFacts.length > 0 && <section className="workspace-card technical-source-card"><div className="workspace-card-heading"><div><span className="section-kicker">Shared technical truth</span><h2>Technical source precedence</h2><p>Internal source details show which system supplied each technical field. These labels are not included in the client-facing report.</p></div></div><div className="technical-source-grid">{technicalSourceFacts.map((item) => <article className="technical-source-item" key={item.id}><span>{item.label}</span><strong>{factDisplayValue(item.value)}</strong><small>{item.evidence}</small></article>)}</div></section>}
          {currentProject.intelligence.findingCandidates.length > 0 && <section className="workspace-card"><div className="workspace-card-heading"><div><span className="section-kicker">Report-ready insights</span><h2>Evidence-backed findings</h2><p>These are the technical findings used to build the client-facing story.</p></div></div><div className="finding-grid">{currentProject.intelligence.findingCandidates.map((item) => <article className={`finding-card severity-${item.severity}`} key={item.id}><div><span>{item.category}</span><em>{item.severity}</em></div><h3>{item.title}</h3><p>{item.clientSummary}</p><details><summary>Evidence</summary><small>{item.evidence}</small></details></article>)}</div></section>}
          <section className="workspace-card source-detail-card"><div className="workspace-card-heading"><div><span className="section-kicker">Source files</span><h2>Attached material</h2><p>Add or replace a file when needed. Replacing or reprocessing a source refreshes the generated outcome.</p></div>{attachedSources > 0 && <button className="button secondary compact" disabled={reprocessingSources} type="button" onClick={() => void reprocessCachedSources()}><SparkIcon />{reprocessingSources ? "Reprocessing…" : "Reprocess cached sources"}</button>}</div><div className="workspace-source-list">{currentProject.sources.map((source) => <SourceWorkspaceRow key={source.id} source={source} busy={busySourceId === source.id} onAttach={attachAndAnalyze} />)}</div><div className="source-analysis-list">{currentProject.sources.flatMap((source) => source.files).map((file) => <details key={file.id}><summary><span>{file.name}</span><small>{formatFileSize(file.size)} · {file.analysis?.sourceType ?? file.status}</small></summary><div className="source-analysis-body"><p>{file.analysis?.summary || file.error || "Attached and awaiting analysis."}</p>{file.analysis?.highlights.length ? <ul>{file.analysis.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul> : null}{file.analysis?.warnings.length ? <div className="source-warning">{file.analysis.warnings.join(" ")}</div> : null}</div></details>)}</div></section>
        </div>
      </details>}
    </div>
  );
}
