import type { Project } from "@/lib/projects/types";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import {
  factNumber,
  formatMetric,
  inventoryReportDevices,
  lifecycleSummary,
  osSupportSummary,
  physicalAssetCounts,
  sortLifecycleDevicesByPriority,
  storageAttentionSummary,
} from "./client-report-data";
import { downloadFillableClientPdf } from "./fillable-pdf";
import { ADVANTAGE_LOGO_DATA_URI } from "./pdf-assets";
import {
  newOwnershipAgreementSummary,
  newOwnershipMoney,
  normalizedAgreementAuthorizationUrl,
} from "@/lib/projects/new-ownership";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[character] ?? character);
}

function preparedDate(project: Project): string {
  const value = new Date(project.updatedAt || project.createdAt);
  if (Number.isNaN(value.getTime())) return "Prepared";
  return `Prepared ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value)}`;
}

function monthlyAgreementLinesHtml(project: Project): string {
  const agreement = newOwnershipAgreementSummary(project);
  const lines = agreement.lines.filter((line) => line.billing === "monthly");
  if (!lines.length) return `<div class="empty"><strong>Agreement source attached</strong><span>Use the agreement document as the source of truth for the monthly service line items.</span></div>`;
  return lines.slice(0, 12).map((line) => `<div class="agreement-line"><div><strong>${escapeHtml(line.label)}</strong><small>Monthly service${line.quantity ? ` · Qty ${line.quantity}` : ""}</small></div><b>${escapeHtml(newOwnershipMoney(line.amount))}</b></div>`).join("") + (lines.length > 12 ? `<div class="more">+ ${lines.length - 12} additional monthly line item${lines.length - 12 === 1 ? "" : "s"} in the agreement</div>` : "");
}

export function newOwnershipDocumentTitle(project: Project): string {
  return project.client.name.trim()
    ? `New Ownership Technology & IT Overview - ${project.client.name.trim()}`
    : "New Ownership Technology & IT Overview";
}

export function newOwnershipPdfHtml(project: Project): string {
  const agreement = newOwnershipAgreementSummary(project);
  const lifecycle = lifecycleSummary(project);
  const os = osSupportSummary(project);
  const storage = storageAttentionSummary(project);
  const hipaa = scoreHipaaAssessment(project.hipaa);
  const events = factNumber(project, "huntress.eventsAnalyzed");
  const signals = factNumber(project, "huntress.signalsDetected");
  const investigated = factNumber(project, "huntress.signalsInvestigated");
  const incidents = factNumber(project, "huntress.incidentsReported");
  const canaries = factNumber(project, "huntress.canaryFiles");
  const malware = factNumber(project, "huntress.malwareFilesBlocked");
  const networkDevices = factNumber(project, "scalepad.networkDevices");
  const physical = physicalAssetCounts(project);
  const inventory = inventoryReportDevices(project);
  const vms = inventory.filter((device) => device.type === "vm").length;
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const agingDevices = sortLifecycleDevicesByPriority(inventory).filter((device) => device.type !== "vm" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon"));
  const authorizationUrl = normalizedAgreementAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl);
  const healthRows = agingDevices.slice(0, 10).map((device) => {
    const model = `${device.make} ${device.model}`.trim() || "Business computer";
    const age = typeof device.age === "number" && Number.isFinite(device.age) ? `${device.age.toFixed(1).replace(/\\.0$/, "")} years` : "Age not listed";
    const status = device.lifecycleStatus === "overdue" ? "Lifecycle attention" : "Planning window";
    return `<div class="health-row"><div><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(model)} · ${escapeHtml(age)}</small></div><span>${status}</span></div>`;
  }).join("");
  const authorization = authorizationUrl
    ? `<a class="authorize" href="${escapeHtml(authorizationUrl)}">Review &amp; authorize the IT agreement</a><div class="url">${escapeHtml(authorizationUrl)}</div>`
    : `<div class="missing-link"><strong>Agreement authorization link pending</strong><span>Add the authorization link in Client Compass before sending this package.</span></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(newOwnershipDocumentTitle(project))}</title><style>
  :root{--navy:#071a34;--blue:#2277e6;--teal:#20a892;--ink:#10213b;--muted:#63758c;--line:#d8e3ee;--soft:#f4f8fc;--gold:#c98b24}*{box-sizing:border-box}body{margin:0;background:#eaf0f6;color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{position:relative;width:min(1120px,calc(100% - 36px));min-height:720px;margin:22px auto;padding:46px;border-radius:28px;background:#fff;box-shadow:0 18px 54px rgba(7,26,52,.09);overflow:hidden}.page:before{content:"";position:absolute;left:0;right:0;top:0;height:7px;background:linear-gradient(90deg,var(--blue),#34bad2,var(--teal))}.brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px;color:#718196;font-size:12px}.brand img{width:180px}.kicker{display:block;color:#3476bd;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.page h1{max-width:820px;margin:12px 0 14px;font-size:70px;line-height:.92;letter-spacing:-.06em}.page h2{margin:10px 0 14px;font-size:43px;line-height:1;letter-spacing:-.045em}.lead{max-width:900px;margin:0;color:var(--muted);font-size:17px;line-height:1.55}.hero{background:radial-gradient(circle at 88% 12%,rgba(73,166,255,.3),transparent 280px),linear-gradient(135deg,#06172f,#0b356c 72%,#1766de);color:#fff}.hero:before{opacity:.8}.hero .brand,.hero .kicker{color:#b8d5f6}.hero .lead{color:#d7e4f5}.pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:58px}.pillars article{padding:22px;border:1px solid #ffffff25;border-radius:18px;background:#ffffff0e}.pillars b{display:block;color:#7dd8ff;font-size:11px}.pillars strong{display:block;margin-top:9px;font-size:23px}.pillars span{display:block;margin-top:6px;color:#c8daef;font-size:12px}.hero-close{margin-top:18px;padding:18px 20px;border:1px solid #ffffff26;border-radius:17px;background:#ffffff10}.hero-close strong{display:block;font-size:20px}.hero-close span{display:block;margin-top:6px;color:#cdddf0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:28px 0}.metrics.five{grid-template-columns:repeat(5,1fr)}.metrics article{padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--soft)}.metrics strong{display:block;font-size:30px}.metrics span{display:block;margin-top:5px;color:var(--muted);font-size:9px;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.two-up{display:grid;grid-template-columns:1fr 1fr;gap:14px}.info{padding:21px;border:1px solid var(--line);border-radius:17px;background:#fafcfe}.info span{display:block;color:#3476bd;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.info strong{display:block;margin:8px 0 6px;font-size:22px}.info p{margin:0;color:var(--muted);line-height:1.5}.health-note{padding:17px 19px;border-left:5px solid var(--gold);border-radius:13px;background:#fff8e8;color:#65552f;line-height:1.48}.health-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:18px}.health-row{display:flex;justify-content:space-between;gap:15px;padding:13px 15px;border:1px solid var(--line);border-radius:13px;background:#fafcfe}.health-row strong,.health-row small{display:block}.health-row small{margin-top:3px;color:var(--muted)}.health-row span{align-self:center;white-space:nowrap;color:#93671e;font-size:9px;font-weight:850;text-transform:uppercase}.empty{padding:28px;border:1px dashed #bdcddd;border-radius:16px;background:var(--soft)}.empty strong,.empty span{display:block}.empty span{margin-top:5px;color:var(--muted)}.agreement-head{display:grid;grid-template-columns:1fr 245px;gap:22px;align-items:end}.monthly-total{padding:20px;border-radius:17px;background:var(--navy);color:#fff}.monthly-total small,.monthly-total strong{display:block}.monthly-total small{color:#a9c5e9;font-size:9px;text-transform:uppercase}.monthly-total strong{margin-top:6px;font-size:31px}.agreement-list{display:grid;grid-template-columns:repeat(2,1fr);gap:7px 14px;margin-top:25px}.agreement-line{display:flex;justify-content:space-between;gap:15px;padding:12px 0;border-bottom:1px solid var(--line)}.agreement-line strong,.agreement-line small{display:block}.agreement-line small{margin-top:3px;color:var(--muted);font-size:10px}.agreement-line b{white-space:nowrap}.more{margin-top:8px;color:var(--muted);font-size:11px}.authorization-box{margin-top:24px;padding:20px;border-radius:18px;background:linear-gradient(120deg,#092e60,#1766de);color:#fff}.authorization-box p{margin:0 0 13px;color:#d8e7fb}.authorize{display:inline-block;padding:12px 17px;border-radius:11px;background:#fff;color:#0a3a79;font-weight:900;text-decoration:none}.url{margin-top:9px;color:#c8dcf8;font-size:9px;word-break:break-all}.missing-link{padding:15px;border:1px solid #efc075;border-radius:13px;background:#fff4dc;color:#775414}.missing-link strong,.missing-link span{display:block}.missing-link span{margin-top:4px}.recap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:28px 0}.recap-grid article{padding:19px;border:1px solid var(--line);border-radius:17px;background:var(--soft)}.recap-grid b{display:block;color:#3476bd;font-size:9px;letter-spacing:.08em}.recap-grid strong{display:block;margin:8px 0 6px;font-size:18px}.recap-grid p{margin:0;color:var(--muted);font-size:11px;line-height:1.45}.closing{padding:24px;border-radius:19px;background:#edf6ff;border:1px solid #b9d4ef}.closing strong{display:block;font-size:22px}.closing p{margin:7px 0 0;color:#526b88;line-height:1.5}.footer{position:absolute;left:46px;right:46px;bottom:26px;display:flex;justify-content:space-between;color:#8492a4;font-size:9px}.warning{margin-top:12px;color:#855f18;font-size:10px}@media print{@page{size:landscape;margin:.3in}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:100%;min-height:7.35in;margin:0;border-radius:0;box-shadow:none;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}}
  </style></head><body>
  <section class="page hero"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>${escapeHtml(preparedDate(project))}</span></div><span class="kicker">Prepared for ${escapeHtml(project.client.name)}</span><h1>Advantage 360</h1><p class="lead">One simple program for the technology the practice depends on — managed, protected, and supported by one team.</p><div class="pillars"><article><b>01</b><strong>Simple</strong><span>Remove the complex.</span></article><article><b>02</b><strong>Stable</strong><span>Engineered for reliability.</span></article><article><b>03</b><strong>Secure</strong><span>Protected by default.</span></article><article><b>04</b><strong>Supported</strong><span>Local. Familiar. Capable.</span></article></div><div class="hero-close"><strong>One partner. One plan. All handled.</strong><span>Support, security, backups, network management, cloud systems, and ongoing technology guidance stay connected under Advantage 360.</span></div><div class="footer"><span>Advantage Technologies</span><span>Advantage 360</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>Security</span></div><span class="kicker">Security protection</span><h2>${incidents ? "Security activity is visible and documented." : "Security protection is active."}</h2><p class="lead">A straightforward view of current monitoring and reported security activity, included as part of the ownership baseline rather than as a separate sales conversation.</p><div class="metrics"><article><strong>${formatMetric(events)}</strong><span>Events analyzed</span></article><article><strong>${signals}</strong><span>Signals detected</span></article><article><strong>${investigated}</strong><span>Investigated</span></article><article><strong>${incidents}</strong><span>Reported incidents</span></article></div><div class="two-up"><article class="info"><span>Ransomware early warning</span><strong>${canaries} canary files monitored</strong><p>Early-warning protection remains part of the environment so suspicious file activity can be identified quickly.</p></article><article class="info"><span>Managed protection</span><strong>${malware} malware file${malware === 1 ? "" : "s"} blocked</strong><p>${incidents ? "Reported incidents remain part of the security history and can be reviewed with Advantage whenever more context is useful." : "No security incidents are reported in the current source period."}</p></article></div><div class="footer"><span>${escapeHtml(project.client.name)}</span><span>Security</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>Network Health</span></div><span class="kicker">Infrastructure baseline</span><h2>The foundation behind the practice, at a glance.</h2><p class="lead">This page shows the systems and infrastructure supporting the practice today. The goal is awareness and continuity for the new owner, not a list of projects to approve.</p><div class="metrics"><article><strong>${physical.workstations}</strong><span>Workstations</span></article><article><strong>${physical.servers + physical.backupServers}</strong><span>Physical servers</span></article><article><strong>${vms}</strong><span>Virtual servers</span></article><article><strong>${networkDevices || "—"}</strong><span>Network devices</span></article></div><div class="two-up"><article class="info"><span>Operating systems</span><strong>${os.attention ? `${os.attention} item${os.attention === 1 ? "" : "s"} to keep visible` : "Current support baseline"}</strong><p>${os.attention ? "Some operating-system items deserve awareness as ownership changes. Timing and any future decisions can be handled separately." : "No operating-system support concern is highlighted in the current source data."}</p></article><article class="info"><span>Storage</span><strong>${storage.attention ? `${storage.attention} item${storage.attention === 1 ? "" : "s"} worth monitoring` : "No storage concern highlighted"}</strong><p>${storage.attention ? "Storage attention is shown so the new owner has visibility into the current environment, without prescribing a project here." : "The current source data does not call out a storage issue requiring special attention."}</p></article></div><div class="footer"><span>${escapeHtml(project.client.name)}</span><span>Network Health</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>Technology Health</span></div><span class="kicker">Lifecycle awareness</span><h2>A clear view of the technology you are inheriting.</h2><p class="lead">This is a point-in-time lifecycle and hardware snapshot, not a project list. Older systems are called out so there are no surprises, while future decisions can be made separately when they make sense.</p><div class="metrics five"><article><strong>${lifecycle.inventoryTotal}</strong><span>Technology assets</span></article><article><strong>${lifecycle.current}</strong><span>Healthy assets</span></article><article><strong>${agingCount}</strong><span>Aging systems</span></article><article><strong>${os.attention}</strong><span>OS attention</span></article><article><strong>${storage.attention}</strong><span>Storage attention</span></article></div><div class="health-note"><strong>What to keep on the radar:</strong> ${agingCount ? `${agingCount} system${agingCount === 1 ? " is" : "s are"} in an aging or lifecycle-planning window. That does not mean everything needs to change now; it means these systems deserve visibility as you settle into ownership.` : "No aging lifecycle items were identified in the current source data."}${project.hipaa.enabled ? ` HIPAA Security Readiness is currently ${hipaa.overall}%.` : ""}</div>${healthRows ? `<div class="health-list">${healthRows}</div>` : `<div class="empty"><strong>No aging hardware rows to highlight</strong><span>The complete source inventory remains part of Client Compass and can be reviewed at any time.</span></div>`}<div class="footer"><span>${escapeHtml(project.client.name)}</span><span>Technology Health</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>IT Agreement</span></div><div class="agreement-head"><div><span class="kicker">Advantage 360 agreement</span><h2>The monthly IT agreement, in plain English.</h2><p class="lead">The agreement is summarized here for an easy ownership handoff. The source agreement remains the controlling document for the complete service description and terms.</p></div><div class="monthly-total"><small>Monthly agreement total</small><strong>${escapeHtml(newOwnershipMoney(agreement.monthlyTotal))}</strong></div></div><div class="agreement-list">${monthlyAgreementLinesHtml(project)}</div><div class="authorization-box"><p>The presentation intentionally keeps authorization off-screen. The agreement can be reviewed and authorized through the link provided in this PDF/report and in the accompanying recap email.</p>${authorization}</div><div class="footer"><span>Source: ${escapeHtml(agreement.sourceName)}</span><span>IT Agreement</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>Recap</span></div><span class="kicker">New owner recap</span><h2>One relationship, one baseline, and a clear place to start.</h2><p class="lead">The goal is to make the technology side of the ownership transition easy to understand without turning the conversation into an immediate project or replacement list.</p><div class="recap-grid"><article><b>ADVANTAGE 360</b><strong>Simple, stable, secure, supported</strong><p>One managed relationship for the day-to-day technology behind the practice.</p></article><article><b>SECURITY &amp; NETWORK</b><strong>${incidents ? `${incidents} reported incident${incidents === 1 ? "" : "s"}` : "Protection and infrastructure are visible"}</strong><p>Security activity and network health are documented separately so the new owner has a clear baseline.</p></article><article><b>TECHNOLOGY HEALTH</b><strong>${agingCount ? `${agingCount} aging system${agingCount === 1 ? "" : "s"} to keep visible` : "Healthy lifecycle baseline"}</strong><p>${agingCount ? "These systems are worth keeping on the radar. Specific decisions can happen later and at the right time." : "The current source data does not identify an aging-system concern that needs to dominate the transition."}</p></article><article><b>IT AGREEMENT</b><strong>${escapeHtml(newOwnershipMoney(agreement.monthlyTotal))} monthly</strong><p>The authorization link is included below and in the recap email.</p></article></div><div class="closing"><strong>Next steps are simple.</strong><p>Review the report, ask anything that would make the transition clearer, and use the agreement link when you are ready to authorize the monthly IT agreement.</p><div style="margin-top:15px">${authorization}</div></div><div class="footer"><span>${escapeHtml(project.client.name)}</span><span>New Ownership Technology &amp; IT Overview</span></div></section>
  </body></html>`;
}

export async function downloadNewOwnershipPdf(project: Project): Promise<void> {
  await downloadFillableClientPdf(newOwnershipPdfHtml(project), newOwnershipDocumentTitle(project));
}

export function openNewOwnershipEmailDraft(project: Project): void {
  const agreement = newOwnershipAgreementSummary(project);
  const authorizationUrl = normalizedAgreementAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl);
  const recipient = project.client.contacts.find((contact) => contact.primary)?.email || project.client.contacts[0]?.email || "";
  const subject = `New Ownership Technology & IT Overview - ${project.client.name}`;
  const body = [
    "Hi,",
    "",
    `I've attached the New Ownership Technology & IT Overview for ${project.client.name}. It brings Advantage 360, the current security and network baseline, technology health, and the monthly IT agreement into one place so the technology side of the transition is easy to review.`,
    "",
    `Monthly IT agreement: ${newOwnershipMoney(agreement.monthlyTotal)}.`,
    authorizationUrl ? "" : "The agreement authorization link is still being added to the report.",
    authorizationUrl ? "You can review and authorize the IT agreement here:" : "",
    authorizationUrl,
    "",
    "I'm happy to walk through any part of it or answer anything that would make the ownership transition clearer.",
    "",
    "Patric",
  ].filter((line, index, lines) => line !== "" || index === 1 || index === lines.length - 3).join("\n");
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
