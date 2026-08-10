"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import {
  clientDeviceDisplayName,
  factNumber,
  formatMetric,
  inventoryReportDevices,
  lifecycleSummary,
  osSupportSummary,
  sortLifecycleDevicesByPriority,
  storageAttentionSummary,
} from "@/lib/outcomes/client-report-data";
import {
  newOwnershipAgreementSummary,
  newOwnershipMoney,
  normalizedAgreementAuthorizationUrl,
} from "@/lib/projects/new-ownership";
import { downloadNewOwnershipPdf, newOwnershipDocumentTitle, openNewOwnershipEmailDraft } from "@/lib/outcomes/new-ownership-export";
import { AdvantageStoryPresentation } from "./proposal-experience";
import { ArrowIcon, FileIcon, SparkIcon } from "./icons";
import styles from "./new-ownership-experience.module.css";

type Section = "advantage" | "health" | "agreement" | "recap";
const SECTIONS: Section[] = ["advantage", "health", "agreement", "recap"];
const SECTION_LABEL: Record<Section, string> = {
  advantage: "Advantage 360",
  health: "Technology Health",
  agreement: "IT Agreement",
  recap: "Recap",
};

function TechnologyHealthSlide({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const os = osSupportSummary(project);
  const storage = storageAttentionSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const aging = useMemo(
    () => sortLifecycleDevicesByPriority(inventoryReportDevices(project)).filter((device) => device.type !== "vm" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon")).slice(0, 8),
    [project],
  );
  return <div className={styles.healthSlide}>
    <div className={styles.slideHeading}><span>Technology Health</span><h2>A clear view of what you are inheriting.</h2><p>This is a health snapshot, not a project list. Older systems are visible so there are no surprises, while specific upgrade or replacement decisions can be made separately when the timing makes sense.</p></div>
    <div className={styles.metrics}>
      <article><strong>{lifecycle.inventoryTotal}</strong><span>Technology assets</span></article>
      <article><strong>{lifecycle.current}</strong><span>Healthy assets</span></article>
      <article><strong>{agingCount}</strong><span>Aging systems</span></article>
      <article><strong>{formatMetric(events)}</strong><span>Security events analyzed</span></article>
      <article><strong>{incidents}</strong><span>Reported incidents</span></article>
    </div>
    <div className={styles.healthBody}>
      <div className={styles.healthNote}><strong>What to keep on the radar</strong>{agingCount ? `${agingCount} system${agingCount === 1 ? " is" : "s are"} in an aging or lifecycle-planning window. That does not mean everything needs to change now; it means these systems deserve visibility as you settle into ownership.` : "No aging lifecycle items were identified in the current source data."}{os.attention ? ` ${os.attention} operating-system item${os.attention === 1 ? " also deserves" : "s also deserve"} attention.` : ""}{storage.attention ? ` ${storage.attention} storage item${storage.attention === 1 ? " is" : "s are"} worth monitoring.` : ""}{project.hipaa.enabled ? ` HIPAA Security Readiness is currently ${hipaa.overall}%.` : ""}</div>
      <div className={styles.agingList}>{aging.length ? aging.map((device) => <article key={`${device.type}-${device.name}-${device.serial}`}><div><strong>{clientDeviceDisplayName(device)}</strong><small>{`${device.make} ${device.model}`.trim() || "Business computer"}{device.age ? ` · ${device.age.toFixed(1).replace(/\.0$/, "")} years` : ""}</small></div><span>{device.lifecycleStatus === "overdue" ? "Lifecycle attention" : "Planning window"}</span></article>) : <article><div><strong>No aging hardware rows to highlight</strong><small>The complete inventory remains available in Client Compass.</small></div><span>Current</span></article>}</div>
    </div>
  </div>;
}

function AgreementSlide({ project }: { project: Project }) {
  const agreement = newOwnershipAgreementSummary(project);
  const url = normalizedAgreementAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl);
  return <div className={styles.agreementSlide}>
    <div className={styles.agreementTop}>
      <div className={styles.slideHeading}><span>Advantage 360 IT Agreement</span><h2>The managed IT relationship, in plain English.</h2><p>The agreement source remains the controlling document. This slide pulls the service line items and totals forward so the incoming owner can understand the relationship without digging through paperwork first.</p></div>
      <div className={styles.totals}><article><small>Monthly total</small><strong>{newOwnershipMoney(agreement.monthlyTotal)}</strong></article><article><small>One-time total</small><strong>{newOwnershipMoney(agreement.oneTimeTotal)}</strong></article></div>
    </div>
    <div className={styles.agreementLines}>{agreement.lines.length ? agreement.lines.slice(0, 8).map((line) => <div className={styles.agreementLine} key={line.id}><div><strong>{line.label}</strong><small>{line.billing === "monthly" ? "Monthly service" : "One-time charge"}{line.quantity ? ` · Qty ${line.quantity}` : ""}</small></div><b>{newOwnershipMoney(line.amount)}</b></div>) : <div className={styles.healthNote}><strong>Agreement source attached</strong>{agreement.warnings[0] || "Use the attached agreement as the source of truth for individual service line items."}</div>}</div>
    <div className={styles.cta}><div><strong>Authorization stays simple.</strong><small>The same agreement authorization link is included in the PDF and the email draft.</small></div>{url ? <a href={url} target="_blank" rel="noreferrer">Review &amp; authorize agreement</a> : <small>Add the authorization link before sending.</small>}</div>
  </div>;
}

function RecapSlide({ project }: { project: Project }) {
  const agreement = newOwnershipAgreementSummary(project);
  const lifecycle = lifecycleSummary(project);
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const url = normalizedAgreementAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl);
  return <div className={styles.recapSlide}>
    <div className={styles.slideHeading}><span>New owner recap</span><h2>One relationship, one baseline, and a clear place to start.</h2><p>The goal is to make the technology side of the ownership transition easier—not turn it into an immediate project list.</p></div>
    <div className={styles.recapCards}>
      <article><b>ADVANTAGE 360</b><strong>Your ongoing IT team</strong><p>Support, security, backups, monitoring, and technology guidance continue under one managed relationship.</p></article>
      <article><b>TECHNOLOGY HEALTH</b><strong>{agingCount ? `${agingCount} aging system${agingCount === 1 ? "" : "s"} to keep visible` : "Healthy lifecycle baseline"}</strong><p>{agingCount ? "These items are worth keeping on the radar as you learn the environment. Specific decisions can happen separately and at the right time." : "The current source data does not identify an aging-system priority that needs to dominate the ownership transition."}</p></article>
      <article><b>IT AGREEMENT</b><strong>{newOwnershipMoney(agreement.monthlyTotal)} monthly</strong><p>{agreement.oneTimeTotal !== undefined ? `${newOwnershipMoney(agreement.oneTimeTotal)} in one-time charges is also reflected in the agreement.` : "Any one-time charges are reflected in the agreement source when applicable."}</p></article>
    </div>
    <div className={styles.finalNote}><strong>Ready when you are.</strong><p>Review the agreement, ask anything that would make the transition clearer, and authorize it through the link when you are comfortable moving forward.</p>{url ? <a href={url} target="_blank" rel="noreferrer">Review &amp; authorize the IT agreement</a> : null}</div>
  </div>;
}

function NewOwnershipPresentation({ project, onClose, onDownloadPdf, pdfBusy }: { project: Project; onClose: () => void; onDownloadPdf: () => Promise<void>; pdfBusy: boolean }) {
  const [section, setSection] = useState<Section>("advantage");
  const sectionIndex = SECTIONS.indexOf(section);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = newOwnershipDocumentTitle(project);
    return () => { document.title = previousTitle; };
  }, [project]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setSection(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndex + 1)]);
      if (event.key === "ArrowLeft") setSection(SECTIONS[Math.max(0, sectionIndex - 1)]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, sectionIndex]);

  return <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="New ownership presentation"><div className="presentation-shell"><header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" data-section-count={SECTIONS.length} style={{ "--presentation-progress": `${(sectionIndex / (SECTIONS.length - 1)) * 100}%` } as CSSProperties}>{SECTIONS.map((item, index) => <button key={item} type="button" className={section === item ? "active" : index < sectionIndex ? "complete" : "upcoming"} onClick={() => setSection(item)}>{SECTION_LABEL[item]}</button>)}</nav><div className="presentation-topbar-actions"><button className="presentation-pdf" type="button" disabled={pdfBusy} onClick={() => void onDownloadPdf()}>{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button><button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header><main className="presentation-stage" aria-live="polite"><div className={styles.presentationContent}>{section === "advantage" && <AdvantageStoryPresentation project={project} />}{section === "health" && <TechnologyHealthSlide project={project} />}{section === "agreement" && <AgreementSlide project={project} />}{section === "recap" && <RecapSlide project={project} />}</div></main><footer className="presentation-footer"><span>{sectionIndex + 1} / {SECTIONS.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => setSection(SECTIONS[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === SECTIONS.length - 1} onClick={() => setSection(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer></div></div>;
}

export function NewOwnershipExperience({
  project,
  onUpdate,
  onOpenSources,
  onOpenHipaa,
  onDelete,
  onReprocessSources,
  reprocessingSources,
  canReprocessSources,
  initialPresent = false,
}: {
  project: Project;
  onUpdate: (project: Project) => void;
  onOpenSources: () => void;
  onOpenHipaa: () => void;
  onDelete: () => Promise<void>;
  onReprocessSources: () => void;
  reprocessingSources: boolean;
  canReprocessSources: boolean;
  initialPresent?: boolean;
}) {
  const [presenting, setPresenting] = useState(initialPresent);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailDrafted, setEmailDrafted] = useState(false);
  const [authorizationUrl, setAuthorizationUrl] = useState(project.newOwnership?.agreementAuthorizationUrl ?? "");
  const agreement = newOwnershipAgreementSummary(project);
  const lifecycle = lifecycleSummary(project);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const validAuthorizationUrl = normalizedAgreementAuthorizationUrl(authorizationUrl);
  const agreementSource = project.sources.find((source) => source.label === "New IT agreement");

  useEffect(() => setAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl ?? ""), [project.id, project.newOwnership?.agreementAuthorizationUrl]);

  function saveAuthorizationUrl() {
    const value = authorizationUrl.trim();
    if (value === (project.newOwnership?.agreementAuthorizationUrl ?? "")) return;
    onUpdate({ ...project, newOwnership: { enabled: true, agreementAuthorizationUrl: value }, updatedAt: new Date().toISOString() });
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try { await downloadNewOwnershipPdf(project); }
    finally { setPdfBusy(false); }
  }

  function draftEmail() {
    openNewOwnershipEmailDraft(project);
    setEmailDrafted(true);
    window.setTimeout(() => setEmailDrafted(false), 3000);
  }

  return <>
    <section className={styles.workspace} id="client-experience">
      <div className={styles.toolbar}>
        <div className={styles.toolbarCopy}><span>New Ownership package</span><strong>Advantage 360 → Technology Health → IT Agreement → Recap</strong><small>Project planning is intentionally left out of this package. Aging technology is presented as awareness for the incoming owner, not as an immediate prescribed project.</small></div>
        <div className={styles.actions}><button type="button" onClick={onOpenSources}><FileIcon /> Sources</button>{project.hipaa.enabled && <button type="button" onClick={onOpenHipaa}>HIPAA</button>}<button type="button" disabled={!canReprocessSources || reprocessingSources} onClick={onReprocessSources}><SparkIcon />{reprocessingSources ? "Refreshing…" : "Refresh"}</button><button type="button" onClick={draftEmail}>{emailDrafted ? "Email opened" : "Draft email"}</button><button type="button" onClick={() => setPresenting(true)}>Present</button><button className={styles.primary} type="button" disabled={pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button><button className={styles.danger} type="button" onClick={() => void onDelete()}>Delete</button></div>
      </div>

      <div className={styles.linkPanel}>
        <div><label><span>Agreement authorization link</span><input type="url" value={authorizationUrl} onChange={(event) => setAuthorizationUrl(event.target.value)} onBlur={saveAuthorizationUrl} placeholder="https://…" /></label><small className={authorizationUrl && !validAuthorizationUrl ? styles.invalid : undefined}>{authorizationUrl && !validAuthorizationUrl ? "Enter a complete http:// or https:// authorization link." : "This link is placed in the presentation, combined PDF, and new-owner email draft."}</small></div>
        {validAuthorizationUrl ? <a className="button secondary compact" href={validAuthorizationUrl} target="_blank" rel="noreferrer">Open agreement link</a> : <span />}
      </div>

      <div className={styles.flow}>
        <article><b>01 · ADVANTAGE 360</b><h3>What we do</h3><p>A compact explanation of the managed IT relationship: support, security, backups, monitoring, and planning.</p><strong>One IT team</strong><small>Easy handoff for the new owner</small></article>
        <article><b>02 · TECHNOLOGY HEALTH</b><h3>What they are inheriting</h3><p>Security, asset health, lifecycle, operating-system and HIPAA readiness context—without a project-plan slide.</p><strong>{lifecycle.inventoryTotal} assets</strong><small>{agingCount} aging · {formatMetric(events)} security events · {incidents} incidents</small></article>
        <article><b>03 · IT AGREEMENT</b><h3>Services and totals</h3><p>Agreement line items are read from the additional source document and summarized beside the actual totals.</p><strong>{newOwnershipMoney(agreement.monthlyTotal)}</strong><small>Monthly · {newOwnershipMoney(agreement.oneTimeTotal)} one-time</small></article>
        <article><b>04 · RECAP</b><h3>Simple ownership handoff</h3><p>Brings the relationship, technology awareness, agreement totals, and authorization link together without pushing immediate replacement decisions.</p><strong>Ready to send</strong><small>One presentation · one PDF · one authorization path</small></article>
      </div>

      <div className={styles.sourceStatus}><div><strong>{agreementSource?.files.length ? agreement.sourceName : "New IT agreement needed"}</strong><small>{agreement.warnings[0] || `${agreement.lines.length} agreement line item${agreement.lines.length === 1 ? "" : "s"} recognized from the source material.`}</small></div><span>{agreementSource?.files.length ? "Agreement connected" : "Source needed"}</span></div>
    </section>
    {presenting && <NewOwnershipPresentation project={project} onClose={() => setPresenting(false)} onDownloadPdf={downloadPdf} pdfBusy={pdfBusy} />}
  </>;
}