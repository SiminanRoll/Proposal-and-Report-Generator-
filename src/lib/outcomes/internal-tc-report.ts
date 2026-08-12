import type { Project } from "@/lib/projects/types";
import {
  clientDeviceDisplayName,
  compassProjectPackages,
  deviceTypeLabelForDevice,
  factNumber,
  inventoryReconciliation,
  inventoryReportDevices,
  lifecycleStatusLabel,
  lifecycleSummary,
  osSupportReason,
  osSupportStatus,
  osSupportStatusLabel,
  osSupportSummary,
  reportReferenceDate,
  sortLifecycleDevicesByPriority,
  storageAttentionSummary,
  storageStatus,
  storageStatusLabel,
  storageUsageSummary,
  warrantyStatus,
  warrantyStatusLabel,
  warrantySummary,
} from "./client-report-data";
import { scoreHipaaAssessment } from "@/lib/hipaa/engine";
import { downloadFillableClientPdf } from "./fillable-pdf";

export interface InternalTcDeviceRow {
  name: string;
  type: string;
  location: string;
  model: string;
  os: string;
  age: string;
  lifecycle: string;
  lifecycleTone: "critical" | "planning" | "healthy" | "unknown";
  warranty: string;
  warrantyTone: "critical" | "planning" | "healthy" | "unknown";
  storage: string;
  storageTone: "critical" | "planning" | "healthy" | "unknown";
  concern: string;
}

export interface InternalTcPriority {
  title: string;
  detail: string;
  value: number;
  timing: string;
  quoted: boolean;
  tone: "critical" | "planning" | "info";
}

export interface InternalTcReportModel {
  clientName: string;
  prepared: string;
  summary: string;
  metrics: {
    inventory: number;
    replaceNow: number;
    planSoon: number;
    projectNeed: number;
    osAttention: number;
    storageAttention: number;
    securityIncidents: number;
    hipaaScore: number | null;
  };
  security: {
    events: number;
    signals: number;
    incidents: number;
    malwareBlocked: number;
    canaries: number;
  };
  hipaa: {
    enabled: boolean;
    score: number;
    label: string;
    unanswered: number;
    highRisk: number;
  };
  priorities: InternalTcPriority[];
  devices: InternalTcDeviceRow[];
  context: string[];
  review: {
    reviewedAt: string;
    meetingSummary: string;
    agreedNextStep: string;
    decisions: Array<{ title: string; finding: string; disposition: string; internalNote: string; responsibleParty: string; targetDate: string; quoted: boolean }>;
  };
  openQuestions: string[];
  inventoryWarnings: string[];
  beforeYouLeave: string[];
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));
}

function dateLabel(value: string): string {
  if (!value) return "Not recorded";
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function ageLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(1))} yr`;
}

function lifecycleTone(value: string): InternalTcDeviceRow["lifecycleTone"] {
  if (value === "overdue") return "critical";
  if (value === "due-soon") return "planning";
  if (value === "current") return "healthy";
  return "unknown";
}

function stateTone(value: string): InternalTcDeviceRow["warrantyTone"] {
  if (value === "out-of-warranty" || value === "unsupported" || value === "critical") return "critical";
  if (value === "ending-soon" || value === "watch") return "planning";
  if (value === "in-warranty" || value === "supported" || value === "healthy") return "healthy";
  return "unknown";
}

function dispositionLabel(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function internalTcReportModel(project: Project): InternalTcReportModel {
  const lifecycle = lifecycleSummary(project);
  const os = osSupportSummary(project);
  const storage = storageAttentionSummary(project);
  const warranties = warrantySummary(project);
  const hipaaScore = scoreHipaaAssessment(project.hipaa);
  const packages = compassProjectPackages(project);
  const projectNeed = packages.reduce((sum, item) => sum + Math.max(0, item.estimatedValue || 0), 0);
  const reference = reportReferenceDate(project);
  const inventoryCheck = inventoryReconciliation(project);

  const devices = sortLifecycleDevicesByPriority(inventoryReportDevices(project)).map((device): InternalTcDeviceRow => {
    const osState = osSupportStatus(device);
    const storageState = storageStatus(device);
    const warrantyState = warrantyStatus(device, reference);
    const concerns = [
      device.lifecycleStatus === "overdue" ? "Replace now" : device.lifecycleStatus === "due-soon" ? "Lifecycle planning" : "",
      osState === "unsupported" ? osSupportReason(device) : osState === "ending-soon" ? osSupportReason(device) : "",
      storageState === "critical" ? "Storage critical" : storageState === "watch" ? "Storage watch" : "",
      warrantyState === "out-of-warranty" ? "Out of warranty" : warrantyState === "ending-soon" ? "Warranty ending soon" : "",
    ].filter(Boolean);
    return {
      name: clientDeviceDisplayName(device),
      type: deviceTypeLabelForDevice(device),
      location: device.location || "—",
      model: `${device.make || ""} ${device.model || ""}`.trim() || "—",
      os: device.os || "—",
      age: ageLabel(device.age),
      lifecycle: lifecycleStatusLabel(device.lifecycleStatus),
      lifecycleTone: lifecycleTone(device.lifecycleStatus),
      warranty: warrantyStatusLabel(warrantyState),
      warrantyTone: stateTone(warrantyState),
      storage: storageUsageSummary(device) || storageStatusLabel(storageState),
      storageTone: stateTone(storageState),
      concern: concerns.join(" · ") || "No current flag",
    };
  });

  const priorities: InternalTcPriority[] = packages.map((item) => ({
    title: item.title,
    detail: [item.technicalDrivers.join(" · "), item.advantageResponsibility].filter(Boolean).join(" — "),
    value: item.estimatedValue || 0,
    timing: item.timing || "Not set",
    quoted: Boolean(item.quoted),
    tone: item.estimatedValue >= 13_000 || /server|priority|replace/i.test(`${item.category} ${item.title}`) ? "critical" : item.estimatedValue > 0 ? "planning" : "info",
  }));

  if (!priorities.length) {
    const flagged = devices.filter((device) => device.lifecycleTone === "critical" || device.storageTone === "critical");
    flagged.slice(0, 8).forEach((device) => priorities.push({
      title: device.name,
      detail: device.concern,
      value: 0,
      timing: "Verify onsite",
      quoted: false,
      tone: "critical",
    }));
  }

  const security = {
    events: factNumber(project, "huntress.eventsAnalyzed"),
    signals: factNumber(project, "huntress.signalsDetected"),
    incidents: factNumber(project, "huntress.incidentsReported"),
    malwareBlocked: factNumber(project, "huntress.malwareFilesBlocked"),
    canaries: factNumber(project, "huntress.canaryFiles"),
  };

  const openExceptions = project.intelligence.exceptions.filter((item) => item.status === "open").map((item) => `${item.prompt}${item.reason ? ` — ${item.reason}` : ""}`);
  const deferredHipaa = project.hipaa.enabled
    ? project.hipaa.answers.filter((item) => item.response === "not-yet-assessed" || item.deferred).map((item) => `HIPAA ${item.questionId}: ${item.deferredReason || "response still needed"}`)
    : [];
  const highRiskHipaa = project.hipaa.enabled ? project.hipaa.answers.filter((item) => item.riskSeverity === "high" || item.riskSeverity === "critical").length : 0;

  const beforeYouLeave = [
    devices.some((device) => /server/i.test(device.type) && device.lifecycleTone !== "healthy") ? "Verify server applications, vendor dependencies, backup/recovery design, UPS, and migration constraints." : "Confirm server/application dependencies if anything differs from the inventory.",
    lifecycle.overdue ? `Validate the ${lifecycle.overdue} Replace Now recommendation${lifecycle.overdue === 1 ? "" : "s"} against what is physically in service.` : "Confirm no unrecorded aging hardware is still in active use.",
    os.attention ? `Confirm remediation path for ${os.attention} operating-system support concern${os.attention === 1 ? "" : "s"}.` : "Confirm operating-system inventory is current.",
    storage.attention ? `Review ${storage.attention} storage-capacity concern${storage.attention === 1 ? "" : "s"} and determine cleanup, expansion, or migration path.` : "Spot-check storage on business-critical systems.",
    project.hipaa.enabled && hipaaScore.notYetAssessedCount ? `Close or document the ${hipaaScore.notYetAssessedCount} unanswered HIPAA readiness item${hipaaScore.notYetAssessedCount === 1 ? "" : "s"}.` : "Capture any security/HIPAA condition that changed since the last review.",
    "Capture model/serial/location corrections, photos, and notes needed for estimating before leaving.",
    "Confirm the client’s actual priority and timing for any project that should move to estimating or quoting.",
  ];

  const summaryParts = [
    `${lifecycle.inventoryTotal || devices.length} managed devices`,
    `${lifecycle.overdue} Replace Now`,
    `${lifecycle.dueSoon} Plan Soon`,
    os.attention ? `${os.attention} OS support concern${os.attention === 1 ? "" : "s"}` : "OS support stable",
    storage.attention ? `${storage.attention} storage concern${storage.attention === 1 ? "" : "s"}` : "storage stable",
    projectNeed ? `${money(projectNeed)} packaged project need` : "no packaged project value",
  ];
  const securityLine = security.events || security.signals || security.incidents
    ? `Security source: ${security.events.toLocaleString("en-US")} events, ${security.signals} signals, ${security.incidents} reported incidents.`
    : "No current Huntress activity source is attached to this workspace.";

  return {
    clientName: project.client.name,
    prepared: dateLabel(project.updatedAt || project.createdAt),
    summary: `${summaryParts.join(" · ")}. ${securityLine}`,
    metrics: {
      inventory: lifecycle.inventoryTotal || devices.length,
      replaceNow: lifecycle.overdue,
      planSoon: lifecycle.dueSoon,
      projectNeed,
      osAttention: os.attention,
      storageAttention: storage.attention,
      securityIncidents: security.incidents,
      hipaaScore: project.hipaa.enabled ? hipaaScore.overall : null,
    },
    security,
    hipaa: {
      enabled: project.hipaa.enabled,
      score: hipaaScore.overall,
      label: hipaaScore.label,
      unanswered: hipaaScore.notYetAssessedCount,
      highRisk: highRiskHipaa,
    },
    priorities,
    devices,
    context: project.painPoints.filter(Boolean),
    review: {
      reviewedAt: project.reviewOutcome.reviewedAt,
      meetingSummary: project.reviewOutcome.meetingSummary,
      agreedNextStep: project.reviewOutcome.agreedNextStep,
      decisions: project.reviewOutcome.items.map((item) => ({
        title: item.title,
        finding: item.technicalFinding,
        disposition: dispositionLabel(item.disposition),
        internalNote: item.internalNote,
        responsibleParty: item.responsibleParty,
        targetDate: item.targetDate,
        quoted: Boolean(item.quoted),
      })),
    },
    openQuestions: [...openExceptions, ...deferredHipaa],
    inventoryWarnings: [...inventoryCheck.messages, ...inventoryCheck.informationalMessages],
    beforeYouLeave,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function metricCard(label: string, value: string, tone = ""): string {
  return `<article class="metric ${tone}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

function badge(value: string, tone: string): string {
  return `<span class="badge ${escapeHtml(tone)}">${escapeHtml(value)}</span>`;
}

const INTERNAL_CSS = `
*{box-sizing:border-box}html,body{margin:0;background:#e9eff6;color:#10243d;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.print-report{padding:18px}.page{width:816px;height:1056px;margin:0 auto 18px;background:#fff;padding:36px 38px;overflow:hidden;position:relative}.topline{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0c315f;padding-bottom:12px;margin-bottom:22px}.brand{font-weight:900;letter-spacing:.08em;color:#0a315f}.internal{font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#e65b49}.kicker{font-size:10px;letter-spacing:.13em;text-transform:uppercase;font-weight:900;color:#3079bd}.hero h1{font-size:42px;line-height:1;margin:8px 0 10px;letter-spacing:-.04em}.hero p{font-size:13px;line-height:1.55;color:#5c6f85;margin:0}.summary{margin:18px 0 20px;padding:14px 16px;border-left:5px solid #2789d8;background:#f1f7fd;font-size:12px;line-height:1.55}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}.metric{border:1px solid #d8e2ed;border-radius:12px;padding:13px;background:#f9fbfd}.metric strong{display:block;font-size:22px;line-height:1;color:#14385f}.metric span{display:block;margin-top:7px;font-size:8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#6b7f94}.metric.critical{border-top:4px solid #e45d4b}.metric.planning{border-top:4px solid #dca735}.metric.good{border-top:4px solid #28a681}.section-title{display:flex;align-items:end;justify-content:space-between;margin:18px 0 10px}.section-title h2{margin:0;font-size:22px;letter-spacing:-.02em}.section-title span{font-size:9px;color:#77899c;text-transform:uppercase;letter-spacing:.08em}.priority-list{display:grid;gap:9px}.priority{border:1px solid #d8e2ed;border-left:5px solid #5e91c8;border-radius:11px;padding:11px 13px;display:grid;grid-template-columns:1fr auto;gap:8px;background:#fff}.priority.critical{border-left-color:#e45d4b}.priority.planning{border-left-color:#dca735}.priority h3{margin:0 0 4px;font-size:13px}.priority p{margin:0;color:#65788d;font-size:10px;line-height:1.4}.priority aside{text-align:right}.priority aside strong{display:block;font-size:13px}.priority aside small{font-size:8px;color:#71849a}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.panel{border:1px solid #d8e2ed;border-radius:12px;padding:14px}.panel h3{margin:0 0 10px;font-size:14px}.panel p,.panel li{font-size:10px;line-height:1.45;color:#5f7287}.panel ul{padding-left:16px;margin:0}.badge{display:inline-block;padding:4px 7px;border-radius:999px;background:#edf2f7;color:#51667e;font-size:7px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.badge.critical{background:#ffe5df;color:#a83c2d}.badge.planning{background:#fff0c9;color:#8a620d}.badge.healthy{background:#def5ec;color:#17725d}.badge.unknown{background:#edf2f7;color:#66778b}.device-table{width:100%;border-collapse:collapse;font-size:8px}.device-table th{text-align:left;padding:7px 6px;background:#0e315a;color:white;font-size:7px;text-transform:uppercase;letter-spacing:.06em}.device-table td{padding:7px 6px;border-bottom:1px solid #e3e9f0;vertical-align:top}.device-table strong{display:block;font-size:9px}.device-table small{display:block;color:#75869a;margin-top:2px}.review-item{padding:10px 0;border-bottom:1px solid #e2e9f0}.review-item:last-child{border-bottom:0}.review-item h3{font-size:12px;margin:0 0 4px}.review-item p{font-size:9px;color:#61758a;margin:2px 0}.checklist{columns:2;column-gap:24px;padding-left:18px}.checklist li{break-inside:avoid;margin:0 0 9px;font-size:10px;line-height:1.45}.footer{position:absolute;bottom:20px;left:38px;right:38px;border-top:1px solid #e1e8ef;padding-top:8px;display:flex;justify-content:space-between;font-size:7px;color:#7b8b9c;text-transform:uppercase;letter-spacing:.08em}@media print{body{background:#fff}.print-report{padding:0}.page{margin:0;page-break-after:always}}
`;

export function internalTcReportHtml(project: Project): string {
  const model = internalTcReportModel(project);
  const priorities = model.priorities.length
    ? model.priorities.slice(0, 8).map((item) => `<article class="priority ${item.tone}"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail || "Verify scope and current state.")}</p></div><aside><strong>${item.value ? escapeHtml(money(item.value)) : "Verify"}</strong><small>${escapeHtml(item.timing)}${item.quoted ? " · Quoted" : ""}</small></aside></article>`).join("")
    : `<div class="panel"><p>No packaged project priorities are currently recorded.</p></div>`;
  const deviceChunks: InternalTcDeviceRow[][] = [];
  for (let index = 0; index < model.devices.length; index += 16) deviceChunks.push(model.devices.slice(index, index + 16));
  if (!deviceChunks.length) deviceChunks.push([]);
  const devicePages = deviceChunks.map((chunk, pageIndex) => `<section class="page"><div class="topline"><span class="brand">ADVANTAGE TECHNOLOGIES</span><span class="internal">Internal · TC Use Only</span></div><div class="section-title"><h2>Technical inventory${deviceChunks.length > 1 ? ` · ${pageIndex + 1}/${deviceChunks.length}` : ""}</h2><span>Priority ordered</span></div><table class="device-table"><thead><tr><th>Device</th><th>Type / Site</th><th>OS</th><th>Lifecycle</th><th>Warranty</th><th>Storage / Concern</th></tr></thead><tbody>${chunk.map((device) => `<tr><td><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(device.model)}</small></td><td>${escapeHtml(device.type)}<small>${escapeHtml(device.location)}</small></td><td>${escapeHtml(device.os)}</td><td>${badge(device.lifecycle, device.lifecycleTone)}<small>${escapeHtml(device.age)}</small></td><td>${badge(device.warranty, device.warrantyTone)}</td><td>${badge(device.storageTone === "critical" ? "Critical" : device.storageTone === "planning" ? "Watch" : device.storageTone === "healthy" ? "Healthy" : "Unknown", device.storageTone)}<small>${escapeHtml(device.concern)}</small></td></tr>`).join("") || `<tr><td colspan="6">No detailed inventory rows are available.</td></tr>`}</tbody></table><div class="footer"><span>${escapeHtml(model.clientName)}</span><span>Internal technical briefing</span></div></section>`).join("");
  const decisions = model.review.decisions.length ? model.review.decisions.map((item) => `<article class="review-item"><h3>${escapeHtml(item.title)}</h3><p><strong>${escapeHtml(item.disposition)}</strong>${item.quoted ? " · Quoted" : ""}${item.targetDate ? ` · Target ${escapeHtml(dateLabel(item.targetDate))}` : ""}</p><p>${escapeHtml(item.finding || item.internalNote || "No supporting detail recorded.")}</p>${item.internalNote && item.finding ? `<p><strong>Internal:</strong> ${escapeHtml(item.internalNote)}</p>` : ""}</article>`).join("") : `<p>No Review Outcome decisions are currently recorded.</p>`;
  const questions = model.openQuestions.length ? `<ul>${model.openQuestions.slice(0, 10).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>No open intelligence/HIPAA questions are currently flagged.</p>`;
  const context = model.context.length ? `<ul>${model.context.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>No additional company context was entered.</p>`;
  const warnings = model.inventoryWarnings.length ? `<ul>${model.inventoryWarnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Inventory reconciliation has no current warning.</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="adv-pdf-layout" content="portrait"><title>${escapeHtml(`Internal TC Report - ${model.clientName}`)}</title><style>${INTERNAL_CSS}</style></head><body><main class="print-report"><section class="page"><div class="topline"><span class="brand">ADVANTAGE TECHNOLOGIES</span><span class="internal">Internal · TC Use Only</span></div><div class="hero"><span class="kicker">Technology Consultant Briefing</span><h1>${escapeHtml(model.clientName)}</h1><p>Prepared ${escapeHtml(model.prepared)} · Technical, lifecycle, security, compliance, and project-planning summary.</p></div><div class="summary">${escapeHtml(model.summary)}</div><div class="metrics">${metricCard("Managed devices", String(model.metrics.inventory))}${metricCard("Replace now", String(model.metrics.replaceNow), model.metrics.replaceNow ? "critical" : "good")}${metricCard("Plan soon", String(model.metrics.planSoon), model.metrics.planSoon ? "planning" : "good")}${metricCard("Project need", money(model.metrics.projectNeed), model.metrics.projectNeed >= 13000 ? "critical" : model.metrics.projectNeed ? "planning" : "good")}${metricCard("OS concerns", String(model.metrics.osAttention), model.metrics.osAttention ? "planning" : "good")}${metricCard("Storage concerns", String(model.metrics.storageAttention), model.metrics.storageAttention ? "planning" : "good")}${metricCard("Security incidents", String(model.metrics.securityIncidents), model.metrics.securityIncidents ? "critical" : "good")}${metricCard("HIPAA readiness", model.metrics.hipaaScore === null ? "N/A" : `${model.metrics.hipaaScore}%`, model.metrics.hipaaScore !== null && model.metrics.hipaaScore < 80 ? "planning" : "good")}</div><div class="section-title"><h2>Priority work</h2><span>What the TC should focus on</span></div><div class="priority-list">${priorities}</div><div class="footer"><span>${escapeHtml(model.clientName)}</span><span>Internal technical briefing</span></div></section>${devicePages}<section class="page"><div class="topline"><span class="brand">ADVANTAGE TECHNOLOGIES</span><span class="internal">Internal · TC Use Only</span></div><div class="section-title"><h2>Security &amp; readiness</h2><span>Operational context</span></div><div class="metrics">${metricCard("Events analyzed", model.security.events.toLocaleString("en-US"))}${metricCard("Signals", String(model.security.signals))}${metricCard("Incidents", String(model.security.incidents), model.security.incidents ? "critical" : "good")}${metricCard("Malware blocked", String(model.security.malwareBlocked), model.security.malwareBlocked ? "planning" : "good")}</div><div class="grid2"><div class="panel"><h3>HIPAA readiness</h3>${model.hipaa.enabled ? `<p><strong>${model.hipaa.score}% · ${escapeHtml(model.hipaa.label)}</strong></p><ul><li>${model.hipaa.unanswered} unanswered / deferred</li><li>${model.hipaa.highRisk} high or critical risk items</li></ul>` : `<p>HIPAA readiness is not enabled in this workspace.</p>`}</div><div class="panel"><h3>Inventory reconciliation</h3>${warnings}</div><div class="panel"><h3>Company / meeting context</h3>${context}</div><div class="panel"><h3>Open questions</h3>${questions}</div></div><div class="section-title"><h2>Review Outcome</h2><span>${escapeHtml(model.review.reviewedAt ? `Reviewed ${dateLabel(model.review.reviewedAt)}` : "No completed review date")}</span></div><div class="panel">${model.review.meetingSummary ? `<p><strong>Meeting summary:</strong> ${escapeHtml(model.review.meetingSummary)}</p>` : ""}${model.review.agreedNextStep ? `<p><strong>Agreed next step:</strong> ${escapeHtml(model.review.agreedNextStep)}</p>` : ""}${decisions}</div><div class="footer"><span>${escapeHtml(model.clientName)}</span><span>Internal technical briefing</span></div></section><section class="page"><div class="topline"><span class="brand">ADVANTAGE TECHNOLOGIES</span><span class="internal">Internal · TC Use Only</span></div><div class="section-title"><h2>Before you leave</h2><span>Onsite / technical verification</span></div><ul class="checklist">${model.beforeYouLeave.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><div class="panel" style="margin-top:24px"><h3>Field notes</h3><p>Use this space for dependencies, vendor/application versions, hardware corrections, cabling/network observations, quote scope changes, or anything estimating/support needs after the visit.</p><div style="height:500px;border:1px dashed #cbd7e4;border-radius:10px;margin-top:12px;background:repeating-linear-gradient(#fff,#fff 31px,#edf2f7 32px)"></div></div><div class="footer"><span>${escapeHtml(model.clientName)}</span><span>Internal technical briefing</span></div></section></main></body></html>`;
}

export async function downloadInternalTcReportPdf(project: Project): Promise<void> {
  await downloadFillableClientPdf(internalTcReportHtml(project), `Internal TC Report - ${project.client.name}`);
}

export { money as formatInternalTcMoney };
