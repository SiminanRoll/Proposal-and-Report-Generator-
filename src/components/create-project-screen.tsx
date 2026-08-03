"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { createProject, createId } from "@/lib/projects/factory";
import { saveProject } from "@/lib/projects/store";
import { saveLocalSourceFile } from "@/lib/projects/file-store";
import { getProjectTemplate } from "@/lib/projects/templates";
import type { ProjectType, SourceFileRecord } from "@/lib/projects/types";
import { analyzeBrowserFile, sourceFileRecord } from "@/lib/intelligence/client";
import { ArrowIcon, SparkIcon } from "./icons";
import { SourceUploadCard } from "./source-upload-card";

export function CreateProjectScreen({ projectType }: { projectType: ProjectType }) {
  const template = getProjectTemplate(projectType);
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [sourceFiles, setSourceFiles] = useState<Record<string, File[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [error, setError] = useState("");

  const requiredComplete = useMemo(() => template.sources.filter((source) => source.required).every((source) => (sourceFiles[source.kind] ?? []).length > 0), [sourceFiles, template.sources]);
  const sourceCount = useMemo(() => template.sources.filter((source) => (sourceFiles[source.kind] ?? []).length > 0).length, [sourceFiles, template.sources]);
  const fileCount = useMemo(() => Object.values(sourceFiles).reduce((sum, files) => sum + files.length, 0), [sourceFiles]);
  const canCreate = clientName.trim().length > 1 && requiredComplete && !processing;

  async function handleCreate() {
    setSubmitted(true);
    setError("");
    if (!canCreate) return;
    setProcessing(true);
    try {
      const sourceRecords: Record<string, SourceFileRecord[]> = {};
      for (const requirement of template.sources) {
        const files = sourceFiles[requirement.kind] ?? [];
        sourceRecords[requirement.kind] = [];
        for (const file of files) {
          const fileId = createId("file");
          setProcessingLabel(`Reading ${file.name}`);
          try {
            const analysis = await analyzeBrowserFile({ file, expectedKind: requirement.kind, fileId });
            try {
              await saveLocalSourceFile(fileId, file);
            } catch {
              analysis.warnings = [...analysis.warnings, "The source was analyzed, but this browser could not retain a local cached copy. Reattach it if later phases need the original file."];
            }
            sourceRecords[requirement.kind].push(sourceFileRecord(file, analysis, undefined, fileId));
          } catch (analysisError) {
            const message = analysisError instanceof Error ? analysisError.message : "Source analysis failed.";
            sourceRecords[requirement.kind].push(sourceFileRecord(file, undefined, message, fileId));
          }
        }
      }
      setProcessingLabel("Building the source intelligence view");
      const project = createProject({ type: projectType, clientName, projectName, contactName, contactEmail, painPoints, sourceRecords });
      saveProject(project);
      window.location.assign(`/project/?id=${encodeURIComponent(project.id)}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "The workspace could not be created.");
      setProcessing(false);
      setProcessingLabel("");
    }
  }

  return (
    <div className="create-page">
      <div className="back-row"><Link href="/">← Back to workspaces</Link><span className={`accent-text-${template.accent}`}>{template.eyebrow}</span></div>
      <section className={`create-hero accent-${template.accent}`}>
        <div><span className="eyebrow">New workspace</span><h1>{template.title}</h1><p>{template.description}</p></div>
        <div className="outcome-badge"><span>Creates</span><strong>{template.outcome}</strong></div>
      </section>

      <div className="create-layout">
        <div className="create-main">
          <section className="form-card">
            <div className="form-section-number">01</div>
            <div className="form-section-copy"><span className="section-kicker">Organization</span><h2>Name the work</h2><p>Only the organization name is required beyond the source material.</p></div>
            <div className="form-grid two-column">
              <label><span>Client, prospect, or practice name *</span><input autoFocus value={clientName} onChange={(event: ChangeEvent<HTMLInputElement>) => setClientName(event.target.value)} placeholder="Example: Dental Studio 4 Kids" className={submitted && clientName.trim().length <= 1 ? "invalid" : ""} />{submitted && clientName.trim().length <= 1 && <small className="field-error">Enter the organization name.</small>}</label>
              <label><span>Workspace name</span><input value={projectName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProjectName(event.target.value)} placeholder={`${clientName || "Client"} — ${template.shortTitle}`} /></label>
              <label><span>Primary contact</span><input value={contactName} onChange={(event: ChangeEvent<HTMLInputElement>) => setContactName(event.target.value)} placeholder="Name" /></label>
              <label><span>Contact email</span><input type="email" value={contactEmail} onChange={(event: ChangeEvent<HTMLInputElement>) => setContactEmail(event.target.value)} placeholder="name@company.com" /></label>
            </div>
          </section>

          <section className="form-card">
            <div className="form-section-number">02</div>
            <div className="form-section-copy"><span className="section-kicker">Sources</span><h2>Attach what the app should understand</h2><p>Required sources are analyzed before the workspace opens. Optional material can be added now or later.</p></div>
            <div className="source-stack">
              {template.sources.map((requirement) => <SourceUploadCard key={requirement.kind} requirement={requirement} files={sourceFiles[requirement.kind] ?? []} onChange={(files) => setSourceFiles((current) => ({ ...current, [requirement.kind]: files }))} />)}
              {submitted && !requiredComplete && <div className="inline-warning">Attach each required source before creating the workspace.</div>}
            </div>
          </section>

          <section className="form-card">
            <div className="form-section-number">03</div>
            <div className="form-section-copy"><span className="section-kicker">Context</span><h2>{template.painPointLabel}</h2><p>Add one thought per line. Source intelligence will keep this human context beside the technical evidence.</p></div>
            <label className="wide-field"><textarea rows={6} value={painPoints} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPainPoints(event.target.value)} placeholder={template.painPointPlaceholder} /></label>
          </section>
        </div>

        <aside className="create-summary-card">
          <span className="section-kicker">Source intelligence</span>
          <h2>{requiredComplete ? "Ready to read the source material" : "Attach the required sources"}</h2>
          <div className="summary-stat"><strong>{fileCount}</strong><span>file{fileCount === 1 ? "" : "s"} across {sourceCount} source groups</span></div>
          <ul>{template.sources.map((source) => <li key={source.kind} className={(sourceFiles[source.kind] ?? []).length ? "complete" : ""}><span>{(sourceFiles[source.kind] ?? []).length ? "✓" : "○"}</span>{source.label}{!source.required && <small>optional</small>}</li>)}</ul>
          {processing ? <div className="processing-panel"><SparkIcon /><strong>Analyzing sources</strong><span>{processingLabel}</span><div className="processing-bar"><i /></div></div> : <button className="button primary full" type="button" onClick={handleCreate}>Analyze and create workspace <ArrowIcon /></button>}
          {error && <p className="field-error block-error">{error}</p>}
          <p className="summary-note">Files are processed inside this browser. Source documents are never uploaded or sent to an application server; cached copies stay in this browser on this device.</p>
        </aside>
      </div>
    </div>
  );
}
