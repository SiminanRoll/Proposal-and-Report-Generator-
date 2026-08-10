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
  physicalAssetCounts,
  sortLifecycleDevicesByPriority,
  storageAttentionSummary,
} from "@/lib/outcomes/client-report-data";
import {
  newOwnershipAgreementSummary,
  newOwnershipMoney,
  normalizedAgreementAuthorizationUrl,
} from "@/lib/projects/new-ownership";
import { downloadNewOwnershipPdf, newOwnershipDocumentTitle, openNewOwnershipEmailDraft } from "@/lib/outcomes/new-ownership-export";
import { ArrowIcon, FileIcon, SparkIcon } from "./icons";
import styles from "./new-ownership-experience.module.css";

type Section = "advantage" | "security" | "network" | "health" | "agreement" | "recap";
const SECTIONS: Section[] = ["advantage", "security", "network", "health", "agreement", "recap"];
const SECTION_LABEL: Record<Section, string> = {
  advantage: "Advantage 360",
  security: "Security",
  network: "Network health",
  health: "Technology health",
  agreement: "IT Agreement",
  recap: "Recap",
};

function Advantage360Slide({ project }: { project: Project }) {
  return <div className={styles.advantageSlide}>
    <div className={styles.advantageHero}>
      <span className={styles.preparedKicker}>Prepared for {project.client.name}</span>
      <h1>Advantage 360</h1>
      <p>One simple program for the technology the practice depends on — managed, protected, and supported by one team.</p>
    </div>
    <div className={styles.pillars}>
      <article><b>01</b><strong>Simple</strong><span>Remove the complex.</span></article>
      <article><b>02</b><strong>Stable</strong><span>Engineered for reliability.</span></article>
      <article><b>03</b><strong>Secure</strong><span>Protected by default.</span></article>
      <article><b>04</b><strong>Supported</strong><span>Local. Familiar. Capable.</span></article>
    </div>
    <div className={styles.advantageFooter}><strong>One partner. One plan. All handled.</strong><span>Support, security, backups, network management, cloud systems, and ongoing technology guidance stay connected under Advantage 360.</span></div>
  </div>;
}

function SecuritySlide({ project }: { project: Project }) {
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const signals = factNumber(project, "huntress.signalsDetected");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  return <div className={styles.securitySlide}>
    <div className={styles.slideHeading}><span>Security</span><h2>{incidents ? "Security activity is visible and documented." : "Security protection is active."}</h2><p>This is a straightforward view of the current protection activity. It is here to show what is being monitored and what has been reported, without turning the ownership transition into a security sales conversation.</p></div>
    <div className={`${styles.metrics} ${styles.metricsFour}`}>
      <article><strong>{formatMetric(events)}</strong><span>Events analyzed</span></article>
      <article><strong>{signals}</strong><span>Signals detected</span></article>
      <article><strong>{investigated}</strong><span>Investigated</span></article>
      <article><strong>{incidents}</strong><span>Reported incidents</span></article>
    </div>
    <div className={styles.splitGrid}>
      <article className={styles.infoPanel}><span>Ransomware early warning</span><strong>{canaries} canary files monitored</strong><p>Early-warning protection remains part of the environment so suspicious file activity can be identified quickly.</p></article>
      <article className={styles.infoPanel}><span>Managed protection</span><strong>{malware} malware file{malware === 1 ? "" : "s"} blocked</strong><p>{incidents ? "Reported incidents remain part of the security history and can be reviewed with Advantage whenever more context is useful." : "No security incidents are reported in the current source period."}</p></article>
    </div>
  </div>;
}

function NetworkHealthSlide({ project }: { project: Project }) {
  const inventory = inventoryReportDevices(project);
  const physical = physicalAssetCounts(project);
  const vms = inventory.filter((device) => device.type === "vm").length;
  const networkDevices = factNumber(project, "scalepad.networkDevices");
  const storage = storageAttentionSummary(project);
  const os = osSupportSummary(project);
  return <div className={styles.networkSlide}>
    <div className={styles.slideHeading}><span>Network health</span><h2>The foundation behind the practice, at a glance.</h2><p>This view shows the systems and infrastructure supporting the practice today. The goal is awareness and continuity for the new owner, not a list of projects to approve.</p></div>
    <div className={`${styles.metrics} ${styles.metricsFour}`}>
      <article><strong>{physical.workstations}</strong><span>Workstations</span></article>
      <article><strong>{physical.servers + physical.backupServers}</strong><span>Physical servers</span></article>
      <article><strong>{vms}</strong><span>Virtual servers</span></article>
      <article><strong>{networkDevices || "—"}</strong><span>Network devices</span></article>
    </div>
    <div className={styles.splitGrid}>
      <article className={styles.infoPanel}><span>Operating systems</span><strong>{os.attention ? `${os.attention} item${os.attention === 1 ? "" : "s"} to keep visible` : "Current support baseline"}</strong><p>{os.attention ? "Some operating-system items deserve awareness as ownership changes. Timing and any future decisions can be handled separately." : "No operating-system support concern is highlighted in the current source data."}</p></article>
      <article className={styles.infoPanel}><span>Storage</span><strong>{storage.attention ? `${storage.attention} item${storage.attention === 1 ? "" : "s"} worth monitoring` : "No storage concern highlighted"}</strong><p>{storage.attention ? "Storage attention is shown so the new owner has visibility into the current environment, without prescribing a project here." : "The current source data does not call out a storage issue requiring special attention."}</p></article>
    </div>
  </div>;
}

function TechnologyHealthSlide({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const os = osSupportSummary(project);
  const storage = storageAttentionSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const aging = useMemo(
    () => sortLifecycleDevicesByPriority(inventoryReportDevices(project)).filter((device) => device.type !== "vm" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon")).slice(0, 8),
    [project],
  );
  return <div className={styles.healthSlide}>
    <div className={styles.slideHeading}><span>Technology health</span><h2>A clear view of what you are inheriting.</h2><p>This is a lifecycle and hardware snapshot, not a project list. Older systems are visible so there are no surprises, while future decisions can be made separately when the timing makes sense.</p></div>
    <div className={styles.metrics}>
      <article><strong>{lifecycle.inventoryTotal}</strong><span>Technology assets</span></article>
      <article><strong>{lifecycle.current}</strong><span>Healthy assets</span></article>
      <article><strong>{agingCount}</strong><span>Aging systems</span></article>
      <article><strong>{os.attention}</strong><span>OS attention</span></article>
      <article><strong>{storage.attention}</strong><span>Storage attention</span></article>
    </div>
    <div className={styles.healthBody}>
      <div className={styles.healthNote}><strong>What to keep on the radar</strong>{agingCount ? `${agingCount} system${agingCount === 1 ? " is" : "s are"} in an aging or lifecycle-planning window. That does not mean everything needs to change now; it means these systems deserve visibility as you settle into ownership.` : "No aging lifecycle items were identified in the current source data."}{project.hipaa.enabled ? ` HIPAA Security Readiness is currently ${hipaa.overall}%.` : ""}</div>
      <div className={styles.agingList}>{aging.length ? aging.map((device) => <article key={`${device.type}-${device.name}-${device.serial}`}><div><strong>{clientDeviceDisplayName(device)}</strong><small>{`${device.make} ${device.model}`.trim() || "Business computer"}{device.age ? ` · ${device.age.toFixed(1).replace(/\.0$/, "")} years` : ""}</small></div><span>{device.lifecycleStatus === "overdue" ? "Lifecycle attention" : "Planning window"}</span></article>) : <article><div><strong>No aging hardware rows to highlight</strong><small>The complete inventory remains available in Client Compass.</small></div><span>Current</span></article>}</div>
    </div>
  </div>;
}

function AgreementSlide({ project }: { project: Project }) {
  const agreement = newOwnershipAgreementSummary(project);
  const monthlyLines = agreement.lines.filter((line) => line.billing === "monthly");
  return <div className={styles.agreementSlide}>
    <div className={styles.agreementTop}>
      <div className={styles.slideHeading}><span>Advantage 360 IT Agreement</span><h2>The monthly IT agreement, in plain English.</h2><p>The agreement source remains the controlling document. This slide brings the monthly services and total forward so the incoming owner can understand the ongoing relationship without digging through paperwork first.</p></div>
      <article className={styles.monthlyTotal}><small>Monthly agreement total</small><strong>{newOwnershipMoney(agreement.monthlyTotal)}</strong></article>
    </div>
    <div className={styles.agreementLines}>{monthlyLines.length ? monthlyLines.slice(0, 10).map((line) => <div className={styles.agreementLine} key={line.id}><div><strong>{line.label}</strong><small>Monthly service{line.quantity ? ` · Qty ${line.quantity}` : ""}</small></div><b>{newOwnershipMoney(line.amount)}</b></div>) : <div className={styles.healthNote}><strong>Agreement source attached</strong>{agreement.warnings[0] || "Use the attached agreement as the source of truth for the monthly service line items."}</div>}</div>
    <div className={styles.nextStepNote}><div><strong>Next step</strong><small>The agreement authorization link is intentionally not shown in presentation mode. It will be included in the PDF/report and in the recap email sent after the review.</small></div></div>
  </div>;
}

function RecapSlide({ project }: { project: Project }) {
  const agreement = newOwnershipAgreementSummary(project);
  const lifecycle = lifecycleSummary(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  return <div className={styles.recapSlide}>
    <div className={styles.slideHeading}><span>New owner recap</span><h2>One relationship, one baseline, and a clear place to start.</h2><p>The goal is to make the technology side of the ownership transition easy to understand without turning the conversation into a project or replacement list.</p></div>
    <div className={styles.recapCards}>
      <article><b>ADVANTAGE 360</b><strong>Simple, stable, secure, supported</strong><p>One managed relationship for the day-to-day technology behind the practice.</p></article>
      <article><b>SECURITY & NETWORK</b><strong>{incidents ? `${incidents} reported incident${incidents === 1 ? "" : "s"}` : "Protection and infrastructure are visible"}</strong><p>Security activity and network health are documented separately so the new owner has a clear baseline.</p></article>
      <article><b>TECHNOLOGY HEALTH</b><strong>{agingCount ? `${agingCount} aging system${agingCount === 1 ? "" : "s"} to keep visible` : "Healthy lifecycle baseline"}</strong><p>{agingCount ? "These systems are worth keeping on the radar. Specific decisions can happen later and at the right time." : "The current source data does not identify an aging-system concern that needs to dominate the transition."}</p></article>
      <article><b>IT AGREEMENT</b><strong>{newOwnershipMoney(agreement.monthlyTotal)} monthly</strong><p>The PDF/report and recap email will include the authorization link when it is time to complete the agreement.</p></article>
    </div>
    <div className={styles.finalNote}><strong>Next steps are simple.</strong><p>Review the report, ask anything that would make the transition clearer, and use the agreement link included in the PDF/report or recap email when you are ready to authorize the monthly IT agreement.</p></div>
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

  return <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="New ownership presentation"><div className="presentation-shell"><header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" data-section-count={SECTIONS.length} style={{ "--presentation-progress": `${(sectionIndex / (SECTIONS.length - 1)) * 100}%` } as CSSProperties}>{SECTIONS.map((item, index) => <button key={item} type="button" className={section === item ? "active" : index < sectionIndex ? "complete" : "upcoming"} onClick={() => setSection(item)}>{SECTION_LABEL[item]}</button>)}</nav><div className="presentation-topbar-actions"><button className="presentation-pdf" type="button" disabled={pdfBusy} onClick={() => void onDownloadPdf()}>{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button><button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header><main className="presentation-stage" aria-live="polite"><div className={styles.presentationContent}>{section === "advantage" && <Advantage360Slide project={project} />}{section === "security" && <SecuritySlide project={project} />}{section === "network" && <NetworkHealthSlide project={project} />}{section === "health" && <TechnologyHealthSlide project={project} />}{section === "agreement" && <AgreementSlide project={project} />}{section === "recap" && <RecapSlide project={project} />}</div></main><footer className="presentation-footer"><span>{sectionIndex + 1} / {SECTIONS.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => setSection(SECTIONS[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === SECTIONS.length - 1} onClick={() => setSection(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer></div></div>;
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
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceHeaderCopy}><span>New Ownership</span><h2>Ownership transition package</h2><p>Advantage 360, security, network health, technology health, the monthly IT agreement, and a final recap — all in the same client-facing flow.</p></div>
        <div className={styles.primaryActions}><button className="button secondary" type="button" onClick={() => setPresenting(true)}>Present</button><button className="button primary" type="button" disabled={pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? "Preparing PDF…" : "Download PDF"} <ArrowIcon /></button></div>
      </header>

      <div className={styles.secondaryActions}><button className="button secondary compact" type="button" onClick={onOpenSources}><FileIcon /> Sources</button>{project.hipaa.enabled && <button className="button secondary compact" type="button" onClick={onOpenHipaa}>HIPAA</button>}<button className="button secondary compact" type="button" disabled={!canReprocessSources || reprocessingSources} onClick={onReprocessSources}><SparkIcon />{reprocessingSources ? "Refreshing…" : "Refresh source data"}</button><button className="button secondary compact" type="button" onClick={draftEmail}>{emailDrafted ? "Email opened" : "Draft recap email"}</button><button className={styles.deleteAction} type="button" onClick={() => void onDelete()}>Delete package</button></div>

      <section className={styles.setupCard}>
        <div className={styles.setupCopy}><span>Agreement handoff</span><strong>Authorization link</strong><p>The link is kept out of presentation mode. It is included in the combined PDF/report and in the recap email.</p></div>
        <div className={styles.linkPanel}><label><span>Agreement authorization link</span><input type="url" value={authorizationUrl} onChange={(event) => setAuthorizationUrl(event.target.value)} onBlur={saveAuthorizationUrl} placeholder="https://…" /></label><small className={authorizationUrl && !validAuthorizationUrl ? styles.invalid : undefined}>{authorizationUrl && !validAuthorizationUrl ? "Enter a complete http:// or https:// authorization link." : "Used in the PDF/report and recap email only."}</small></div>
        {validAuthorizationUrl ? <a className="button secondary compact" href={validAuthorizationUrl} target="_blank" rel="noreferrer">Open link</a> : <span />}
      </section>

      <div className={styles.flowGrid}>
        <article className={styles.flowCard}><span className={styles.flowNumber}>01</span><b>ADVANTAGE 360</b><h3>Simple. Stable. Secure. Supported.</h3><p>The opening slide mirrors the Advantage 360 story and keeps the message focused on what the new owner receives.</p></article>
        <article className={styles.flowCard}><span className={styles.flowNumber}>02</span><b>SECURITY</b><h3>Protection activity</h3><p>Security events, signals, monitoring, and reported incidents are shown as a clear baseline.</p><strong>{formatMetric(events)}</strong><small>events analyzed · {incidents} incidents</small></article>
        <article className={styles.flowCard}><span className={styles.flowNumber}>03</span><b>NETWORK HEALTH</b><h3>Infrastructure baseline</h3><p>Workstations, servers, network equipment, operating-system support, and storage stay visible without project pressure.</p></article>
        <article className={styles.flowCard}><span className={styles.flowNumber}>04</span><b>TECHNOLOGY HEALTH</b><h3>Lifecycle awareness</h3><p>Aging systems are called out as awareness for the incoming owner, not an immediate replacement recommendation.</p><strong>{lifecycle.inventoryTotal}</strong><small>assets · {agingCount} aging</small></article>
        <article className={styles.flowCard}><span className={styles.flowNumber}>05</span><b>IT AGREEMENT</b><h3>Monthly services and total</h3><p>The additional agreement source supplies the monthly line items and the ongoing Advantage 360 total.</p><strong>{newOwnershipMoney(agreement.monthlyTotal)}</strong><small>monthly agreement</small></article>
        <article className={styles.flowCard}><span className={styles.flowNumber}>06</span><b>RECAP</b><h3>Simple next step</h3><p>The presentation points the owner to the PDF/report and recap email, where the agreement authorization link is provided.</p></article>
      </div>

      <div className={styles.sourceStatus}><div><strong>{agreementSource?.files.length ? agreement.sourceName : "New IT agreement needed"}</strong><small>{agreement.warnings[0] || `${agreement.lines.filter((line) => line.billing === "monthly").length} monthly agreement line item${agreement.lines.filter((line) => line.billing === "monthly").length === 1 ? "" : "s"} recognized from the source material.`}</small></div><span>{agreementSource?.files.length ? "Agreement connected" : "Source needed"}</span></div>
    </section>
    {presenting && <NewOwnershipPresentation project={project} onClose={() => setPresenting(false)} onDownloadPdf={downloadPdf} pdfBusy={pdfBusy} />}
  </>;
}
