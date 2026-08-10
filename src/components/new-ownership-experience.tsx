"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
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
import { securityIncidentResponseMessage, securityPresentationMessage } from "@/lib/outcomes/client-report-messaging";
import {
  newOwnershipAgreementSummary,
  newOwnershipMoney,
  normalizedAgreementAuthorizationUrl,
} from "@/lib/projects/new-ownership";
import { downloadNewOwnershipPdf, newOwnershipDocumentTitle, openNewOwnershipEmailDraft } from "@/lib/outcomes/new-ownership-report-export";
import { formatAgeShorthand } from "./age-display-runtime";
import { ArrowIcon, FileIcon, SparkIcon } from "./icons";
import styles from "./new-ownership-experience.module.css";

type Section = "advantage" | "security" | "health" | "agreement" | "recap";
const SECTIONS: Section[] = ["advantage", "security", "health", "agreement", "recap"];
const SECTION_LABEL: Record<Section, string> = {
  advantage: "Advantage 360",
  security: "Security",
  health: "Technology health",
  agreement: "IT Agreement",
  recap: "Recap",
};

const PILLARS = [
  {
    key: "simple",
    tone: "pillarSimple",
    title: "Simple",
    short: "Remove the complex.",
    detail: "One partner coordinates support, vendors, technology planning, and the day-to-day details so your team is not stuck translating technical problems or chasing multiple providers.",
  },
  {
    key: "stable",
    tone: "pillarStable",
    title: "Stable",
    short: "Engineered for reliability.",
    detail: "The environment is designed, maintained, and monitored to reduce downtime, extend useful technology life, and make aging systems visible before they become an emergency.",
  },
  {
    key: "secure",
    tone: "pillarSecure",
    title: "Secure",
    short: "Protected by default.",
    detail: "Security is layered in from the start: firewall and network protection, endpoint detection, antivirus, ransomware defenses, updates, backups, and around-the-clock monitoring work together.",
  },
  {
    key: "supported",
    tone: "pillarSupported",
    title: "Supported",
    short: "Local. Familiar. Capable.",
    detail: "Fast US-based remote support, local onsite engineers, 24/7 monitoring, and people who learn your practice mean you are not starting from zero every time you need help.",
  },
] as const;

function Advantage360Slide({ project }: { project: Project }) {
  const [flipped, setFlipped] = useState<string>("");
  return <div className={styles.advantageSlide}>
    <div className={styles.advantageHero}>
      <div className={styles.advantageHeroCopy}>
        <span className={styles.preparedKicker}>Prepared for {project.client.name}</span>
        <h1>Advantage 360</h1>
      </div>
      <aside className={styles.heroStatement}><span>One IT relationship</span><p>One simple program for the technology the practice depends on — secure, reliable, and handled by one team.</p></aside>
    </div>
    <div className={styles.pillars}>
      {PILLARS.map((pillar) => <button key={pillar.key} type="button" className={`${styles.pillarCard} ${styles[pillar.tone]} ${flipped === pillar.key ? styles.isFlipped : ""}`} onClick={() => setFlipped((current) => current === pillar.key ? "" : pillar.key)} aria-pressed={flipped === pillar.key}>
        <span className={styles.pillarInner}>
          <span className={styles.pillarFront}><strong>{pillar.title}</strong><small>{pillar.short}</small></span>
          <span className={styles.pillarBack}><strong>{pillar.title} means less IT friction.</strong><small>{pillar.detail}</small></span>
        </span>
      </button>)}
    </div>
    <div className={styles.advantageFooter}><strong>One partner. One plan. All handled.</strong><span>Advantage 360 brings support, security, backups, network management, cloud systems, vendor coordination, and ongoing technology guidance together under one relationship.</span></div>
  </div>;
}

function SecuritySlide({ project }: { project: Project }) {
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const signals = factNumber(project, "huntress.signalsDetected");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const entities = factNumber(project, "huntress.entitiesProtected");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const response = securityIncidentResponseMessage(project);
  const message = securityPresentationMessage(project);
  const headline = response.visible
    ? response.actions.length
      ? "When a threat showed up, we acted before your team had to."
      : "When security activity needs attention, there is a team behind the tools."
    : "Your team can focus on the practice. We watch the security.";
  return <div className={styles.securitySlide}>
    <div className={styles.slideHeading}><span>Security protection</span><h2>{headline}</h2><p>{response.visible ? message.subtitle : "Advantage 360 combines layered protection with human monitoring and response. Millions of routine events can happen in the background; your team only needs to hear about the ones that actually matter."}</p></div>
    <div className={`${styles.metrics} ${styles.metricsFour}`}>
      <article><strong>{formatMetric(events)}</strong><span>Events analyzed</span><small>Background activity reviewed by the security stack</small></article>
      <article><strong>{signals}</strong><span>Signals detected</span><small>Activity elevated for closer review</small></article>
      <article><strong>{investigated}</strong><span>Investigated</span><small>Signals that received human attention</small></article>
      <article className={incidents ? styles.metricAttention : styles.metricGood}><strong>{incidents}</strong><span>Reported incidents</span><small>{incidents ? "Incidents that required a documented response" : "No incident required response"}</small></article>
    </div>
    {response.visible ? <div className={styles.incidentStory}>
      <article><span>What happened</span><strong>{response.threat || "Security incident detected"}</strong><p>{response.device ? `Affected computer: ${response.device}. ` : ""}{response.status || "The incident was investigated and documented."}</p></article>
      <article className={styles.responsePanel}><span>What Advantage did</span><strong>{response.title}</strong><p>{response.summary}</p>{response.actions.length > 0 && <div className={styles.actionChips}>{response.actions.map((action) => <b key={action}>{action}</b>)}</div>}</article>
      <article><span>Why this matters to you</span><strong>Security becomes action, not another alert for your staff.</strong><p>Your practice gets layered protection plus people who review suspicious activity, investigate what matters, and respond when something needs attention.</p></article>
    </div> : <div className={styles.securityValueGrid}>
      <article><span>Layered protection</span><strong>{entities || "Your"} protected endpoint{entities === 1 ? "" : "s"}</strong><p>Endpoint security, managed antivirus, ransomware protection, network defenses, and updates work together instead of relying on one tool.</p></article>
      <article><span>Ransomware early warning</span><strong>{canaries} canary files monitored</strong><p>Early-warning files help identify suspicious encryption behavior quickly so a potential ransomware event can be escalated before it spreads.</p></article>
      <article><span>Managed response</span><strong>{malware} malware file{malware === 1 ? "" : "s"} blocked</strong><p>Protection runs in the background, while Advantage reviews the activity that needs human attention.</p></article>
    </div>}
  </div>;
}

function TechnologyHealthSlide({ project }: { project: Project }) {
  const lifecycle = lifecycleSummary(project);
  const os = osSupportSummary(project);
  const storage = storageAttentionSummary(project);
  const networkDevices = factNumber(project, "scalepad.networkDevices");
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const aging = useMemo(
    () => sortLifecycleDevicesByPriority(inventoryReportDevices(project)).filter((device) => device.type !== "vm" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon")).slice(0, 8),
    [project],
  );
  return <div className={styles.healthSlide}>
    <div className={styles.slideHeading}><span>Technology health</span><h2>Know what you are inheriting before it becomes a surprise.</h2><p>This is a practical baseline of the computers, servers, network equipment, operating systems, and storage behind the practice. Older items are visible for awareness — not as a project list you are expected to approve today.</p></div>
    <div className={`${styles.metrics} ${styles.metricsFour}`}>
      <article><strong>{lifecycle.inventoryTotal}</strong><span>Technology assets</span><small>The managed environment included in this review</small></article>
      <article className={styles.metricGood}><strong>{lifecycle.current}</strong><span>Healthy assets</span><small>Currently inside the normal lifecycle window</small></article>
      <article className={agingCount ? styles.metricAttention : styles.metricGood}><strong>{agingCount}</strong><span>Aging systems</span><small>Worth keeping visible as ownership changes</small></article>
      <article><strong>{networkDevices || "—"}</strong><span>Network devices</span><small>Managed infrastructure reported in the source data</small></article>
    </div>
    <div className={styles.healthBody}>
      <div className={styles.healthNote}><strong>What this means for you</strong><p>{agingCount ? `${agingCount} system${agingCount === 1 ? " is" : "s are"} in an aging or lifecycle-planning window. Nothing on this page means you have to replace equipment immediately; it means you can take ownership with a clear picture of what deserves attention over time.` : "The current lifecycle data does not identify an aging-system concern that needs to dominate the ownership transition."}</p><div className={styles.healthSignals}><span>{os.attention ? `${os.attention} OS item${os.attention === 1 ? "" : "s"} to keep visible` : "Operating systems look current"}</span><span>{storage.attention ? `${storage.attention} storage item${storage.attention === 1 ? "" : "s"} to monitor` : "No storage concern highlighted"}</span></div></div>
      <div className={styles.agingList}>{aging.length ? aging.map((device) => <article key={`${device.type}-${device.name}-${device.serial}`}><div><strong>{clientDeviceDisplayName(device)}</strong><small>{`${device.make} ${device.model}`.trim() || "Business computer"}{device.age ? ` · ${formatAgeShorthand(device.age)}` : ""}</small></div><span>{device.lifecycleStatus === "overdue" ? "Aging" : "Planning window"}</span></article>) : <article><div><strong>No aging hardware rows to highlight</strong><small>The current source inventory is inside the normal lifecycle window.</small></div><span>Current</span></article>}</div>
    </div>
  </div>;
}

function AgreementSlide({ project }: { project: Project }) {
  const agreement = newOwnershipAgreementSummary(project);
  const monthlyLines = agreement.lines.filter((line) => line.billing === "monthly");
  return <div className={styles.agreementSlide}>
    <div className={styles.agreementTop}>
      <div className={styles.slideHeading}><span>Advantage 360 IT Agreement</span><h2>Your monthly IT services.</h2><p>These are the line items that make up the monthly agreement total.</p></div>
      <article className={styles.monthlyTotal}><small>Monthly agreement total</small><strong>{newOwnershipMoney(agreement.monthlyTotal)}</strong></article>
    </div>
    {monthlyLines.length ? <div className={styles.agreementTable}>
      <div className={styles.agreementTableHead}><span>Service</span><span>Qty</span><span>Price / each</span><span>Monthly total</span></div>
      {monthlyLines.slice(0, 10).map((line) => <div className={styles.agreementTableRow} key={line.id}><strong>{line.label}</strong><span>{line.quantity ?? 1}</span><span>{newOwnershipMoney(line.unitPrice ?? line.amount)}</span><b>{newOwnershipMoney(line.amount)}</b></div>)}
      {monthlyLines.length > 10 && <div className={styles.agreementMore}>+ {monthlyLines.length - 10} additional monthly line item{monthlyLines.length - 10 === 1 ? "" : "s"} in the attached agreement</div>}
    </div> : <div className={styles.healthNote}><strong>Agreement details need a quick review</strong><p>{agreement.warnings[0] || "The agreement is attached, but the individual monthly service rows were not read confidently enough to display."}</p></div>}
  </div>;
}

function RecapSlide({ project }: { project: Project }) {
  const agreement = newOwnershipAgreementSummary(project);
  const lifecycle = lifecycleSummary(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const response = securityIncidentResponseMessage(project);
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  return <div className={styles.recapSlide}>
    <div className={styles.slideHeading}><span>Your ownership transition</span><h2>You know what you are taking over — and who has your back.</h2><p>Advantage 360 gives you one team for the technology behind the practice, while this review gives you a clear starting point for the environment you are inheriting.</p></div>
    <div className={styles.recapCards}>
      <article><b>YOUR IT TEAM</b><strong>Simple, stable, secure, supported</strong><p>Support, security, backups, vendors, network management, and technology guidance stay connected under one managed relationship.</p></article>
      <article><b>YOUR SECURITY</b><strong>{incidents ? response.title || `${incidents} incident${incidents === 1 ? "" : "s"} investigated` : "Protection stays on in the background"}</strong><p>{incidents ? "You have a team behind the tools to investigate meaningful activity and respond when something needs attention." : "Layered protection and human monitoring help keep security work off your staff's plate."}</p></article>
      <article><b>YOUR TECHNOLOGY</b><strong>{agingCount ? `${agingCount} aging system${agingCount === 1 ? "" : "s"} are now on your radar` : "A healthy lifecycle baseline"}</strong><p>{agingCount ? "You know what deserves visibility without being forced into immediate replacement decisions." : "There is no aging-system concern in the current source data that needs to dominate the transition."}</p></article>
      <article><b>YOUR MONTHLY AGREEMENT</b><strong>{newOwnershipMoney(agreement.monthlyTotal)} / month</strong><p>The attached agreement shows exactly what is included, and your recap email and PDF/report provide the authorization link when you are ready.</p></article>
    </div>
    <div className={styles.finalNote}><strong>From here, the technology side can stay simple.</strong><p>Review the report and monthly agreement, ask anything you want clarified, and use the authorization link in the PDF/report or recap email when you are comfortable moving forward. Advantage handles the IT relationship from there.</p></div>
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

  return <div className="presentation-overlay" role="dialog" aria-modal="true" aria-label="New ownership presentation"><div className="presentation-shell"><header className="presentation-topbar"><div className="presentation-brand"><img src="/advantage-mark.png" alt="" /><img className="presentation-wordmark" src="/advantage-wordmark-no-a.png" alt="Advantage Technologies" /></div><nav className="presentation-progress-nav" data-section-count={SECTIONS.length} style={{ "--presentation-progress": `${(sectionIndex / (SECTIONS.length - 1)) * 100}%` } as CSSProperties}>{SECTIONS.map((item, index) => <button key={item} type="button" className={section === item ? "active" : index < sectionIndex ? "complete" : "upcoming"} onClick={() => setSection(item)}>{SECTION_LABEL[item]}</button>)}</nav><div className="presentation-topbar-actions"><button className="presentation-pdf" type="button" disabled={pdfBusy} onClick={() => void onDownloadPdf()}>{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button><button className="presentation-close" type="button" onClick={onClose}>Close</button></div></header><main className="presentation-stage" aria-live="polite"><div className={styles.presentationContent}>{section === "advantage" && <Advantage360Slide project={project} />}{section === "security" && <SecuritySlide project={project} />}{section === "health" && <TechnologyHealthSlide project={project} />}{section === "agreement" && <AgreementSlide project={project} />}{section === "recap" && <RecapSlide project={project} />}</div></main><footer className="presentation-footer"><span>{sectionIndex + 1} / {SECTIONS.length}</span><div><button type="button" disabled={sectionIndex === 0} onClick={() => setSection(SECTIONS[Math.max(0, sectionIndex - 1)])}>Previous</button><button className="next" type="button" disabled={sectionIndex === SECTIONS.length - 1} onClick={() => setSection(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndex + 1)])}>Next <ArrowIcon /></button></div></footer></div></div>;
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
  const [pdfError, setPdfError] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState(project.newOwnership?.agreementAuthorizationUrl ?? "");
  const agreement = newOwnershipAgreementSummary(project);
  const lifecycle = lifecycleSummary(project);
  const incidents = factNumber(project, "huntress.incidentsReported");
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const validAuthorizationUrl = normalizedAgreementAuthorizationUrl(authorizationUrl);
  const agreementSource = project.sources.find((source) => source.label === "New IT agreement");
  const monthlyLines = agreement.lines.filter((line) => line.billing === "monthly");

  useEffect(() => setAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl ?? ""), [project.id, project.newOwnership?.agreementAuthorizationUrl]);

  function saveAuthorizationUrl() {
    const value = authorizationUrl.trim();
    if (value === (project.newOwnership?.agreementAuthorizationUrl ?? "")) return;
    onUpdate({ ...project, newOwnership: { enabled: true, agreementAuthorizationUrl: value }, updatedAt: new Date().toISOString() });
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setPdfError("");
    try { await downloadNewOwnershipPdf(project); }
    catch (error) { setPdfError(error instanceof Error ? error.message : "The PDF could not be created."); }
    finally { setPdfBusy(false); }
  }

  function draftEmail() {
    openNewOwnershipEmailDraft(project);
    setEmailDrafted(true);
    window.setTimeout(() => setEmailDrafted(false), 3000);
  }

  return <>
    <section className={styles.workspace} id="client-experience">
      <div className={styles.workspaceHeader}><div className={styles.workspaceHeaderCopy}><span>New Ownership package</span><h2>One clear handoff for the incoming owner</h2><p>Advantage 360, security, technology health, the monthly IT agreement, and the final recap stay together in one client-facing package.</p></div><div className={styles.primaryActions}><button className="button secondary" type="button" onClick={() => setPresenting(true)}>Present</button><button className="button primary" type="button" disabled={pdfBusy} onClick={() => void downloadPdf()}>{pdfBusy ? "Preparing PDF…" : "Download PDF"} <ArrowIcon /></button></div></div>
      {pdfError && <div className={styles.pdfError} role="alert">PDF error: {pdfError}</div>}
      <div className={styles.setupCard}><div className={styles.setupCopy}><span>Agreement handoff</span><strong>{newOwnershipMoney(agreement.monthlyTotal)} monthly</strong><p>{monthlyLines.length} monthly service line item{monthlyLines.length === 1 ? "" : "s"} recognized from {agreement.sourceName}.</p></div><div className={styles.linkPanel}><label><span>Agreement authorization link</span><input type="url" value={authorizationUrl} onChange={(event) => setAuthorizationUrl(event.target.value)} onBlur={saveAuthorizationUrl} placeholder="https://…" /></label><small className={authorizationUrl && !validAuthorizationUrl ? styles.invalid : undefined}>{authorizationUrl && !validAuthorizationUrl ? "Enter a complete http:// or https:// authorization link." : "Included in the finished PDF/report and recap email. It is never shown during presentation mode."}</small></div>{validAuthorizationUrl ? <a className="button secondary compact" href={validAuthorizationUrl} target="_blank" rel="noreferrer">Open link</a> : <span />}</div>
      <div className={styles.flowGrid}>
        <article className={styles.flowCard}><b>ADVANTAGE 360</b><h3>Simple, stable, secure, supported</h3><p>A client-friendly introduction to what the managed relationship means in everyday terms.</p><strong>One IT team</strong><small>Cards expand during presentation</small></article>
        <article className={styles.flowCard}><b>SECURITY</b><h3>Protection with people behind it</h3><p>Shows security activity, what happened when an incident occurred, and what Advantage did about it.</p><strong>{incidents ? `${incidents} incident${incidents === 1 ? "" : "s"} reported` : "No incidents reported"}</strong><small>Monitoring → investigation → response</small></article>
        <article className={styles.flowCard}><b>TECHNOLOGY HEALTH</b><h3>What the new owner is inheriting</h3><p>Lifecycle, hardware, network, operating-system, and storage awareness without project pressure.</p><strong>{agingCount} aging system{agingCount === 1 ? "" : "s"}</strong><small>{lifecycle.inventoryTotal} total managed assets</small></article>
        <article className={styles.flowCard}><b>IT AGREEMENT</b><h3>Monthly services and pricing</h3><p>Line items, quantities, price per item, monthly totals, and the complete monthly agreement total.</p><strong>{newOwnershipMoney(agreement.monthlyTotal)}</strong><small>Monthly agreement</small></article>
        <article className={styles.flowCard}><b>RECAP</b><h3>A clear starting point</h3><p>Explains what the client now knows, what Advantage handles, and where the authorization link will be provided.</p><strong>Ready to review</strong><small>One presentation · one PDF · one recap email</small></article>
      </div>
      <div className={styles.secondaryActions}><button className="button secondary compact" type="button" onClick={onOpenSources}><FileIcon /> Sources</button>{project.hipaa.enabled && <button className="button secondary compact" type="button" onClick={onOpenHipaa}>HIPAA</button>}<button className="button secondary compact" type="button" disabled={!canReprocessSources || reprocessingSources} onClick={onReprocessSources}><SparkIcon />{reprocessingSources ? "Refreshing…" : "Refresh source data"}</button><button className="button secondary compact" type="button" onClick={draftEmail}>{emailDrafted ? "Email opened" : "Draft recap email"}</button><button className={styles.deleteAction} type="button" onClick={() => void onDelete()}>Delete workspace</button></div>
      <div className={styles.sourceStatus}><div><strong>{agreementSource?.files.length ? agreement.sourceName : "New IT agreement needed"}</strong><small>{agreement.warnings[0] || `${monthlyLines.length} monthly line item${monthlyLines.length === 1 ? "" : "s"} recognized from the attached agreement.`}</small></div><span>{agreementSource?.files.length ? "Agreement connected" : "Source needed"}</span></div>
    </section>
    {presenting && <NewOwnershipPresentation project={project} onClose={() => setPresenting(false)} onDownloadPdf={downloadPdf} pdfBusy={pdfBusy} />}
  </>;
}
