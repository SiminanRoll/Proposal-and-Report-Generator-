"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReviewOutcome } from "@/lib/review-outcomes/types";
import type { ChangeEvent } from "react";
import { createProject, createId } from "@/lib/projects/factory";
import { saveProject } from "@/lib/projects/store";
import { saveLocalSourceFile } from "@/lib/projects/file-store";
import { getProjectTemplate } from "@/lib/projects/templates";
import type { ProjectType, SourceFileRecord } from "@/lib/projects/types";
import { analyzeBrowserFile, sourceFileRecord } from "@/lib/intelligence/client";
import { ArrowIcon, SparkIcon } from "./icons";
import { SourceUploadCard } from "./source-upload-card";

const ORGANIZATION_TERM_OPTIONS = ["practice", "firm", "hospital", "business", "organization"] as const;

function isPresetOrganizationTerm(value: string): boolean {
  return ORGANIZATION_TERM_OPTIONS.includes(value.trim().toLowerCase() as (typeof ORGANIZATION_TERM_OPTIONS)[number]);
}

export function CreateProjectScreen({
  projectType,
  initialClientName = "",
  initialContactName = "",
  initialContactRole = "",
  initialContactEmail = "",
  initialContactPhone = "",
  initialContext = "",
  initialCompassClientId = "",
  initialSourceRecords = {},
  initialReviewOutcome,
  prefillWarning = "",
}: {
  projectType: ProjectType;
  initialClientName?: string;
  initialContactName?: string;
  initialContactRole?: string;
  initialContactEmail?: string;
  initialContactPhone?: string;
  initialContext?: string;
  initialCompassClientId?: string;
  initialSourceRecords?: Record<string, SourceFileRecord[]>;
  initialReviewOutcome?: ReviewOutcome;
  prefillWarning?: string;
}) {
  const template = getProjectTemplate(projectType);
  const streamlinedClientReport = projectType === "client-report";
  const [clientName, setClientName] = useState(initialClientName);
  const [organizationTerm, setOrganizationTerm] = useState("practice");
  const [projectName, setProjectName] = useState("");
  const [contactName, setContactName] = useState(initialContactName);
  const [contactRole, setContactRole] = useState(initialContactRole);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [painPoints, setPainPoints] = useState(initialContext);
  const [sourceFiles, setSourceFiles] = useState<Record<string, File[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [error, setError] = useState("");

  const hasSource = (kind: string) => (sourceFiles[kind] ?? []).length > 0 || (initialSourceRecords[kind] ?? []).length > 0;
  const requiredComplete = useMemo(() => template.sources.filter((source) => source.required).every((source) => (sourceFiles[source.kind] ?? []).length > 0 || (initialSourceRecords[source.kind] ?? []).length > 0), [initialSourceRecords, sourceFiles, template.sources]);
  const sourceCount = useMemo(() => template.sources.filter((source) => (sourceFiles[source.kind] ?? []).length > 0 || (initialSourceRecords[source.kind] ?? []).length > 0).length, [initialSourceRecords, sourceFiles, template.sources]);
  const fileCount = useMemo(() => Object.values(sourceFiles).reduce((sum, files) => sum + files.length, 0) + Object.values(initialSourceRecords).reduce((sum, files) => sum + files.length, 0), [initialSourceRecords, sourceFiles]);
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
        const prefilled = initialSourceRecords[requirement.kind] ?? [];
        sourceRecords[requirement.kind] = files.length && !requirement.multiple ? [] : [...prefilled];
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
      const project = createProject({ type: projectType, clientName, organizationTerm, projectName, contactName, contactRole, contactEmail, contactPhone, painPoints, sourceRecords, reviewOutcome: initialReviewOutcome });
      saveProject(project);
      window.location.assign(`/project/?id=${encodeURIComponent(project.id)}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "The workspace could not be created.");
      setProcessing(false);
      setProcessingLabel("");
    }
  }

  return (
    <div className={`create-page${streamlinedClientReport ? " streamlined-client-report" : ""}`}>
      <div className="back-row">
        <Link href="/">← Back to workspaces</Link>
        {!streamlinedClientReport && <span className={`accent-text-${template.accent}`}>{template.eyebrow}</span>}
      </div>
      <section className={`create-hero accent-${template.accent}`}>
        {streamlinedClientReport ? (
          <div><h1>{template.title}</h1></div>
        ) : (
          <>
            <div><span className="eyebrow">New workspace</span><h1>{template.title}</h1><p>{template.description}</p></div>
            <div className="outcome-badge"><span>Creates</span><strong>{template.outcome}</strong></div>
          </>
        )}
      </section>

      {prefillWarning && <div className="inline-warning" role="status">{prefillWarning}</div>}
      {initialCompassClientId && Object.keys(initialSourceRecords).length > 0 && (
        <div className="generator-prefill-banner">
          <span>✓</span>
          <div>
            <strong>{streamlinedClientReport ? "Client Compass data connected" : "Managed-client data connected"}</strong>
            {!streamlinedClientReport && <small>The committed Client Compass snapshot will supply the lifecycle and hardware source. Attach current security material where required.</small>}
          </div>
        </div>
      )}

      <div className="create-layout">
        <div className="create-main">
          <section className="form-card">
            <div className="form-section-number">01</div>
            <div className="form-section-copy">
              {streamlinedClientReport ? <h2>Client details</h2> : <><span className="section-kicker">Organization</span><h2>Name the work</h2><p>Only the organization name is required beyond the source material.</p></>}
            </div>
            <div className="form-grid two-column">
              <label><span>Client or prospect name *</span><input autoFocus value={clientName} onChange={(event: ChangeEvent<HTMLInputElement>) => setClientName(event.target.value)} placeholder="Example: Dental Studio 4 Kids" className={submitted && clientName.trim().length <= 1 ? "invalid" : ""} />{submitted && clientName.trim().length <= 1 && <small className="field-error">Enter the organization name.</small>}</label>
              <label><span>{streamlinedClientReport ? "Organization type" : "Refer to this organization as"}</span><div className="organization-term-picker"><select value={isPresetOrganizationTerm(organizationTerm) ? organizationTerm.toLowerCase() : "__custom__"} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOrganizationTerm(event.target.value === "__custom__" ? "" : event.target.value)} aria-label="How to refer to the organization"><option value="practice">Practice</option><option value="firm">Firm</option><option value="hospital">Hospital</option><option value="business">Business</option><option value="organization">Organization</option><option value="__custom__">Custom term…</option></select>{!isPresetOrganizationTerm(organizationTerm) && <input value={organizationTerm} onChange={(event: ChangeEvent<HTMLInputElement>) => setOrganizationTerm(event.target.value)} placeholder="Enter a custom term" aria-label="Custom organization term" />}</div>{!streamlinedClientReport && <small>Defaults to practice for dental clients. Choose a common term or enter your own.</small>}</label>
              <label><span>Workspace name</span><input value={projectName} onChange={(event: ChangeEvent<HTMLInputElement>) => setProjectName(event.target.value)} placeholder={`${clientName || "Client"} — ${template.shortTitle}`} /></label>
              <label><span>Primary contact</span><input value={contactName} onChange={(event: ChangeEvent<HTMLInputElement>) => setContactName(event.target.value)} placeholder="Name" /></label>
              <label><span>Contact role</span><input value={contactRole} onChange={(event: ChangeEvent<HTMLInputElement>) => setContactRole(event.target.value)} placeholder="Office manager, owner, administrator" /></label>
              <label><span>Contact email</span><input type="email" value={contactEmail} onChange={(event: ChangeEvent<HTMLInputElement>) => setContactEmail(event.target.value)} placeholder="name@company.com" /></label>
              <label><span>Contact phone</span><input type="tel" value={contactPhone} onChange={(event: ChangeEvent<HTMLInputElement>) => setContactPhone(event.target.value)} placeholder="Phone" /></label>
            </div>
          </section>

          <section className="form-card">
            <div className="form-section-number">02</div>
            <div className="form-section-copy">
              {streamlinedClientReport ? <h2>Sources</h2> : <><span className="section-kicker">Sources</span><h2>Attach what the app should understand</h2><p>Required sources are analyzed before the workspace opens. Optional material can be added now or later.</p></>}
            </div>
            <div className="source-stack">
              {template.sources.map((requirement) => (
                <div key={requirement.kind} className="generator-prefilled-source-group">
                  {(initialSourceRecords[requirement.kind] ?? []).map((record) => (
                    <div className="generator-prefilled-source" key={record.id}>
                      <span>✓</span>
                      <div>
                        <strong>{streamlinedClientReport ? "Client Compass inventory connected" : "Current Client Compass snapshot connected"}</strong>
                        {!streamlinedClientReport && <small>{record.name} · imported inventory will flow directly into the generator</small>}
                      </div>
                    </div>
                  ))}
                  <SourceUploadCard requirement={requirement} files={sourceFiles[requirement.kind] ?? []} compact={streamlinedClientReport} onChange={(files) => setSourceFiles((current) => ({ ...current, [requirement.kind]: files }))} />
                </div>
              ))}
              {submitted && !requiredComplete && <div className="inline-warning">Attach each required source before creating the workspace.</div>}
            </div>
          </section>

          <section className="form-card">
            <div className="form-section-number">03</div>
            <div className="form-section-copy">
              {streamlinedClientReport ? <h2>{template.painPointLabel}</h2> : <><span className="section-kicker">Context</span><h2>{template.painPointLabel}</h2><p>Add one thought per line. Source intelligence will keep this human context beside the technical evidence.</p></>}
            </div>
            <label className="wide-field"><textarea rows={streamlinedClientReport ? 4 : 6} value={painPoints} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPainPoints(event.target.value)} placeholder={template.painPointPlaceholder} /></label>
          </section>
        </div>

        <aside className="create-summary-card">
          <span className="section-kicker">{streamlinedClientReport ? "Sources" : "Source intelligence"}</span>
          <h2>{streamlinedClientReport ? (requiredComplete ? "Ready" : "Required files") : (requiredComplete ? "Ready to read the source material" : "Attach the required sources")}</h2>
          <div className="summary-stat"><strong>{fileCount}</strong><span>{streamlinedClientReport ? `file${fileCount === 1 ? "" : "s"}` : `file${fileCount === 1 ? "" : "s"} across ${sourceCount} source groups`}</span></div>
          <ul>{template.sources.map((source) => <li key={source.kind} className={hasSource(source.kind) ? "complete" : ""}><span>{hasSource(source.kind) ? "✓" : "○"}</span>{source.label}{!source.required && <small>optional</small>}</li>)}</ul>
          {processing ? <div className="processing-panel"><SparkIcon /><strong>Analyzing sources</strong><span>{processingLabel}</span><div className="processing-bar"><i /></div></div> : <button className="button primary full" type="button" onClick={handleCreate}>{streamlinedClientReport ? "Create review" : "Analyze and create workspace"} <ArrowIcon /></button>}
          {error && <p className="field-error block-error">{error}</p>}
          {!streamlinedClientReport && <p className="summary-note">Files are processed inside this browser. Source documents are never uploaded or sent to an application server; cached copies stay in this browser on this device.</p>}
        </aside>
      </div>
    </div>
  );
}
