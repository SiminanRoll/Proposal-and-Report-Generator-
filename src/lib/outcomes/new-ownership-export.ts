import type { Project } from "@/lib/projects/types";
import { organizationTerm } from "@/lib/projects/client-language";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import {
  factNumber,
  formatMetric,
  inventoryReportDevices,
  lifecycleSummary,
  osSupportSummary,
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
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function preparedDate(project: Project): string {
  const value = new Date(project.updatedAt || project.createdAt);
  if (Number.isNaN(value.getTime())) return "Prepared for the ownership transition";
  return `Prepared ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value)}`;
}

function agreementLinesHtml(project: Project): string {
  const agreement = newOwnershipAgreementSummary(project);
  if (!agreement.lines.length) return `<div class="empty"><strong>Agreement source attached</strong><span>Use the agreement document as the source of truth for individual service line items.</span></div>`;
  return agreement.lines.slice(0, 12).map((line) => `<div class="agreement-line"><div><strong>${escapeHtml(line.label)}</strong><small>${line.billing === "monthly" ? "Monthly service" : "One-time charge"}${line.quantity ? ` · Qty ${line.quantity}` : ""}</small></div><b>${escapeHtml(newOwnershipMoney(line.amount))}</b></div>`).join("") + (agreement.lines.length > 12 ? `<div class="more">+ ${agreement.lines.length - 12} additional line item${agreement.lines.length - 12 === 1 ? "" : "s"} in the agreement</div>` : "");
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
  const incidents = factNumber(project, "huntress.incidentsReported");
  const agingCount = lifecycle.overdue + lifecycle.dueSoon;
  const devices = sortLifecycleDevicesByPriority(inventoryReportDevices(project));
  const agingDevices = devices.filter((device) => device.type !== "vm" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon"));
  const authorizationUrl = normalizedAgreementAuthorizationUrl(project.newOwnership?.agreementAuthorizationUrl);
  const organization = organizationTerm(project);
  const healthRows = agingDevices.slice(0, 10).map((device) => {
    const model = `${device.make} ${device.model}`.trim() || "Business computer";
    const age = typeof device.age === "number" && Number.isFinite(device.age) ? `${device.age.toFixed(1).replace(/\.0$/, "")} years` : "Age not listed";
    const status = device.lifecycleStatus === "overdue" ? "Lifecycle attention" : "Planning window";
    return `<div class="health-row"><div><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(model)} · ${escapeHtml(age)}</small></div><span>${status}</span></div>`;
  }).join("");
  const authorization = authorizationUrl
    ? `<a class="authorize" href="${escapeHtml(authorizationUrl)}">Review &amp; authorize the IT agreement</a><div class="url">${escapeHtml(authorizationUrl)}</div>`
    : `<div class="missing-link"><strong>Agreement authorization link pending</strong><span>Add the authorization link in Client Compass before sending this package.</span></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(newOwnershipDocumentTitle(project))}</title><style>
  :root{--navy:#071a34;--blue:#2277e6;--teal:#20a892;--ink:#10213b;--muted:#63758c;--line:#d8e3ee;--soft:#f4f8fc;--gold:#c98b24}*{box-sizing:border-box}body{margin:0;background:#eaf0f6;color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{position:relative;width:min(1120px,calc(100% - 36px));min-height:720px;margin:22px auto;padding:46px;border-radius:28px;background:#fff;box-shadow:0 18px 54px rgba(7,26,52,.09);overflow:hidden}.page:before{content:"";position:absolute;left:0;right:0;top:0;height:7px;background:linear-gradient(90deg,var(--blue),#34bad2,var(--teal))}.brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px;color:#718196;font-size:12px}.brand img{width:180px}.kicker{display:block;color:#3476bd;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.page h1{max-width:820px;margin:12px 0 14px;font-size:64px;line-height:.95;letter-spacing:-.055em}.page h2{margin:10px 0 14px;font-size:43px;line-height:1;letter-spacing:-.045em}.lead{max-width:880px;margin:0;color:var(--muted);font-size:17px;line-height:1.55}.hero{background:radial-gradient(circle at 88% 12%,rgba(73,166,255,.3),transparent 280px),linear-gradient(135deg,#06172f,#0b356c 72%,#1766de);color:#fff}.hero:before{opacity:.8}.hero .brand,.hero .kicker{color:#b8d5f6}.hero .lead{color:#d7e4f5}.hero-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:28px;align-items:end;margin-top:52px}.promise{padding:24px;border:1px solid #ffffff2d;border-radius:20px;background:#ffffff12}.promise strong{display:block;font-size:24px}.promise span{display:block;margin-top:8px;color:#cbdcf2;line-height:1.45}.capabilities{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.capabilities article{padding:20px;border:1px solid #ffffff25;border-radius:17px;background:#ffffff0e}.capabilities b{display:block;color:#7dd8ff;font-size:12px}.capabilities strong{display:block;margin-top:6px}.capabilities small{display:block;margin-top:5px;color:#c7d7ea;line-height:1.35}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:28px 0}.metrics article{padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--soft)}.metrics strong{display:block;font-size:30px}.metrics span{display:block;margin-top:5px;color:var(--muted);font-size:9px;font-weight:850;letter-spacing:.07em;text-transform:uppercase}.health-note{padding:17px 19px;border-left:5px solid var(--gold);border-radius:13px;background:#fff8e8;color:#65552f;line-height:1.48}.health-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:18px}.health-row{display:flex;justify-content:space-between;gap:15px;padding:13px 15px;border:1px solid var(--line);border-radius:13px;background:#fafcfe}.health-row strong,.health-row small{display:block}.health-row small{margin-top:3px;color:var(--muted)}.health-row span{align-self:center;white-space:nowrap;color:#93671e;font-size:9px;font-weight:850;text-transform:uppercase}.empty{padding:28px;border:1px dashed #bdcddd;border-radius:16px;background:var(--soft)}.empty strong,.empty span{display:block}.empty span{margin-top:5px;color:var(--muted)}.agreement-head{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:end}.totals{display:grid;grid-template-columns:repeat(2,190px);gap:10px}.totals article{padding:18px;border-radius:16px;background:var(--navy);color:#fff}.totals small,.totals strong{display:block}.totals small{color:#a9c5e9;font-size:9px;text-transform:uppercase}.totals strong{margin-top:5px;font-size:27px}.agreement-list{display:grid;grid-template-columns:repeat(2,1fr);gap:7px 14px;margin-top:25px}.agreement-line{display:flex;justify-content:space-between;gap:15px;padding:12px 0;border-bottom:1px solid var(--line)}.agreement-line strong,.agreement-line small{display:block}.agreement-line small{margin-top:3px;color:var(--muted);font-size:10px}.agreement-line b{white-space:nowrap}.more{margin-top:8px;color:var(--muted);font-size:11px}.authorization-box{margin-top:24px;padding:20px;border-radius:18px;background:linear-gradient(120deg,#092e60,#1766de);color:#fff}.authorization-box p{margin:0 0 13px;color:#d8e7fb}.authorize{display:inline-block;padding:12px 17px;border-radius:11px;background:#fff;color:#0a3a79;font-weight:900;text-decoration:none}.url{margin-top:9px;color:#c8dcf8;font-size:9px;word-break:break-all}.missing-link{padding:15px;border:1px solid #efc075;border-radius:13px;background:#fff4dc;color:#775414}.missing-link strong,.missing-link span{display:block}.missing-link span{margin-top:4px}.recap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin:30px 0}.recap-grid article{padding:22px;border:1px solid var(--line);border-radius:18px;background:var(--soft)}.recap-grid b{display:block;color:#3476bd;font-size:10px;letter-spacing:.08em}.recap-grid strong{display:block;margin:8px 0 6px;font-size:19px}.recap-grid p{margin:0;color:var(--muted);line-height:1.45}.closing{padding:24px;border-radius:19px;background:#edf6ff;border:1px solid #b9d4ef}.closing strong{display:block;font-size:22px}.closing p{margin:7px 0 0;color:#526b88;line-height:1.5}.footer{position:absolute;left:46px;right:46px;bottom:26px;display:flex;justify-content:space-between;color:#8492a4;font-size:9px}.warning{margin-top:12px;color:#855f18;font-size:10px}@media print{@page{size:landscape;margin:.3in}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:100%;min-height:7.35in;margin:0;border-radius:0;box-shadow:none;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}}
  </style></head><body>
  <section class="page hero"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>${escapeHtml(preparedDate(project))}</span></div><span class="kicker">New ownership · Advantage 360</span><h1>Technology support, clearly handed off.</h1><p class="lead">As ownership changes, this overview brings the Advantage 360 relationship, the current technology environment, and the new IT agreement together in one place.</p><div class="hero-grid"><div class="promise"><strong>One team for the technology behind the ${escapeHtml(organization)}.</strong><span>Support, monitoring, security, backups, onsite coordination, and long-term technology guidance stay connected instead of becoming another transition project for the new owner to manage alone.</span></div><div class="capabilities"><article><b>01</b><strong>Support</strong><small>Day-to-day help for users, computers, network, and applications.</small></article><article><b>02</b><strong>Security</strong><small>Active monitoring, protection, investigation, and response.</small></article><article><b>03</b><strong>Backups</strong><small>Recovery protection designed to reduce disruption when systems fail.</small></article><article><b>04</b><strong>Planning</strong><small>Visibility into aging technology before it becomes an emergency.</small></article></div></div><div class="footer"><span>Advantage Technologies</span><span>Advantage 360</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>Technology Health</span></div><span class="kicker">Current environment</span><h2>A clear view of the technology you are inheriting.</h2><p class="lead">This is a point-in-time health snapshot—not a project list. Older systems are called out so there are no surprises, while specific replacement or upgrade decisions can be made separately when they make sense.</p><div class="metrics"><article><strong>${lifecycle.inventoryTotal}</strong><span>Technology assets</span></article><article><strong>${lifecycle.current}</strong><span>Healthy assets</span></article><article><strong>${agingCount}</strong><span>Aging systems</span></article><article><strong>${formatMetric(events)}</strong><span>Security events analyzed</span></article><article><strong>${incidents}</strong><span>Reported incidents</span></article></div><div class="health-note"><strong>What to keep on the radar:</strong> ${agingCount ? `${agingCount} system${agingCount === 1 ? " is" : "s are"} in an aging or lifecycle-planning window. That does not mean everything needs to change now; it means these systems deserve visibility as you settle into ownership.` : "No aging lifecycle items were identified in the current source data."} ${os.attention ? `${os.attention} operating-system item${os.attention === 1 ? " also deserves" : "s also deserve"} attention.` : ""} ${storage.attention ? `${storage.attention} storage item${storage.attention === 1 ? " is" : "s are"} worth monitoring.` : ""}${project.hipaa.enabled ? ` HIPAA Security Readiness is currently ${hipaa.overall}%.` : ""}</div>${healthRows ? `<div class="health-list">${healthRows}</div>` : `<div class="empty"><strong>No aging hardware rows to highlight</strong><span>The complete source inventory remains part of Client Compass and can be reviewed at any time.</span></div>`}<div class="footer"><span>${escapeHtml(project.client.name)}</span><span>Technology Health</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>IT Agreement</span></div><div class="agreement-head"><div><span class="kicker">Advantage 360 agreement</span><h2>What the IT relationship includes.</h2><p class="lead">The agreement is summarized here for an easy ownership handoff. The source agreement remains the controlling document for the complete service description and terms.</p></div><div class="totals"><article><small>Monthly total</small><strong>${escapeHtml(newOwnershipMoney(agreement.monthlyTotal))}</strong></article><article><small>One-time total</small><strong>${escapeHtml(newOwnershipMoney(agreement.oneTimeTotal))}</strong></article></div></div><div class="agreement-list">${agreementLinesHtml(project)}</div>${agreement.warnings.length ? `<div class="warning">${escapeHtml(agreement.warnings.join(" "))}</div>` : ""}<div class="authorization-box"><p>When you are ready, the agreement can be reviewed and authorized through the secure link provided with this report and in the accompanying email.</p>${authorization}</div><div class="footer"><span>Source: ${escapeHtml(agreement.sourceName)}</span><span>Agreement Overview</span></div></section>

  <section class="page"><div class="brand"><img src="${ADVANTAGE_LOGO_DATA_URI}" alt="Advantage Technologies"><span>Recap</span></div><span class="kicker">New owner recap</span><h2>One relationship, one baseline, and a clear place to start.</h2><p class="lead">The goal is to make the technology side of the ownership transition easier: understand what Advantage 360 covers, know the current condition of the environment, and have the agreement details in one place without turning the handoff into an immediate project list.</p><div class="recap-grid"><article><b>ADVANTAGE 360</b><strong>Your ongoing IT team</strong><p>Support, security, backups, monitoring, and technology guidance continue under one managed relationship.</p></article><article><b>TECHNOLOGY HEALTH</b><strong>${agingCount ? `${agingCount} aging system${agingCount === 1 ? "" : "s"} to keep visible` : "Healthy lifecycle baseline"}</strong><p>${agingCount ? "These items are worth keeping on the radar as you learn the environment. Specific decisions can be made separately and at the right time." : "The current source data does not identify an aging-system priority that needs to dominate the ownership transition."}</p></article><article><b>IT AGREEMENT</b><strong>${escapeHtml(newOwnershipMoney(agreement.monthlyTotal))} monthly</strong><p>${agreement.oneTimeTotal !== undefined ? `${escapeHtml(newOwnershipMoney(agreement.oneTimeTotal))} in one-time charges is also reflected in the agreement.` : "Any one-time charges are reflected in the agreement source when applicable."}</p></article></div><div class="closing"><strong>Ready when you are.</strong><p>Review the agreement, ask anything that would make the transition clearer, and authorize it through the link below when you are comfortable moving forward.</p><div style="margin-top:15px">${authorization}</div></div><div class="footer"><span>${escapeHtml(project.client.name)}</span><span>New Ownership Technology &amp; IT Overview</span></div></section>
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
    `I've attached the New Ownership Technology & IT Overview for ${project.client.name}. It brings the Advantage 360 relationship, current technology health, and the new IT agreement into one place so the technology side of the transition is easy to review.`,
    "",
    `Agreement summary: ${newOwnershipMoney(agreement.monthlyTotal)} monthly${agreement.oneTimeTotal !== undefined ? ` and ${newOwnershipMoney(agreement.oneTimeTotal)} one-time` : ""}.`,
    authorizationUrl ? "" : "The agreement authorization link is still being added to the report.",
    authorizationUrl ? "You can review and authorize the IT agreement here:" : "",
    authorizationUrl,
    "",
    "I'm happy to walk through any part of it with you or answer anything that would make the ownership transition clearer.",
    "",
    "Patric",
  ].filter((line, index, lines) => line !== "" || index === 1 || index === lines.length - 3).join("\n");
  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}