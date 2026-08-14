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
  return `<article class="metric ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function badge(value: string, tone: string): string {
  return `<span class="badge ${escapeHtml(tone)}">${escapeHtml(value)}</span>`;
}

function pdfHeader(section: string): string {
  return `<div class="pdf-header"><div class="brand-lockup"><strong>ADVANTAGE</strong><span>TECHNOLOGIES</span></div><span class="header-section">${escapeHtml(section)}</span><span class="internal">Internal · TC Use Only</span></div>`;
}

function pdfFooter(clientName: string, label: string): string {
  return `<div class="itc-pdf-footer"><span>${escapeHtml(clientName)}</span><span>${escapeHtml(label)}</span></div>`;
}

function priorityCard(item: InternalTcPriority, index: number): string {
  return `<article class="priority ${item.tone}"><span class="priority-number">${String(index + 1).padStart(2, "0")}</span><div class="priority-copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail || "Verify scope and current state.")}</p></div><aside><strong>${item.value ? escapeHtml(money(item.value)) : "Verify"}</strong><small>${escapeHtml(item.timing)}${item.quoted ? " · Quoted" : ""}</small></aside></article>`;
}

function deviceRowHtml(device: InternalTcDeviceRow): string {
  const rowTone = [device.lifecycleTone, device.warrantyTone, device.storageTone].includes("critical")
    ? "critical"
    : [device.lifecycleTone, device.warrantyTone, device.storageTone].includes("planning") ? "planning" : "healthy";
  const storageLabel = device.storageTone === "critical" ? "Critical" : device.storageTone === "planning" ? "Watch" : device.storageTone === "healthy" ? "Healthy" : "Unknown";
  return `<tr class="${rowTone}"><td><strong>${escapeHtml(device.name)}</strong><small class="cell-note">${escapeHtml(device.model)}</small></td><td><span class="cell-primary">${escapeHtml(device.type)}</span><small class="cell-note">${escapeHtml(device.location)}</small></td><td><span class="cell-os">${escapeHtml(device.os)}</span></td><td>${badge(device.lifecycle, device.lifecycleTone)}<small class="cell-note">${escapeHtml(device.age)}</small></td><td>${badge(device.warranty, device.warrantyTone)}</td><td>${badge(storageLabel, device.storageTone)}<small class="cell-note concern-note">${escapeHtml(device.concern)}</small></td></tr>`;
}

const INTERNAL_CSS = `
*{box-sizing:border-box}html,body{margin:0;background:#e7edf4;color:#102943;font-family:Arial,"Segoe UI",sans-serif}.print-report{padding:18px}.page{width:816px;height:1056px;margin:0 auto 18px;background:#fff;padding:28px 32px 40px;overflow:hidden;position:relative;flex-direction:column!important}.print-report [data-pdf-capture-page]{display:block!important}.pdf-header{height:52px;display:grid;grid-template-columns:190px 1fr auto;align-items:center;gap:14px;border-bottom:1px solid #dbe5ef;margin-bottom:20px}.brand-lockup{line-height:.92;color:#0c315f;letter-spacing:.075em}.brand-lockup strong,.brand-lockup span{display:block}.brand-lockup strong{font-size:16px;font-weight:900}.brand-lockup span{font-size:12px;font-weight:900;margin-top:4px}.header-section{justify-self:center;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#6d8094}.internal{justify-self:end;padding:7px 10px;border-radius:999px;background:#fff0ec;border:1px solid #ffd8cf;color:#b54837;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}.cover-band{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:18px;align-items:stretch;margin-bottom:15px}.hero{padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,#0b315e 0%,#15588c 100%);color:#fff;min-height:150px}.kicker{font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#8bddff}.hero h1{font-size:34px;line-height:1.02;margin:9px 0 10px;letter-spacing:-.035em}.hero p{font-size:11px;line-height:1.5;color:#d9e8f5;margin:0}.prepared-card{border:1px solid #d9e4ee;border-radius:18px;padding:18px;background:#f7fafc;display:flex;flex-direction:column;justify-content:space-between}.prepared-card span{font-size:8px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:#7a8b9d}.prepared-card strong{display:block;margin-top:7px;font-size:15px;color:#153a61}.prepared-card small{font-size:9px;line-height:1.4;color:#6e8194}.summary{margin:0 0 14px;padding:11px 14px;border-radius:10px;background:#eef6fc;border:1px solid #d8eaf8;font-size:10px;line-height:1.45;color:#425e78}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:17px}.metric{position:relative;min-height:70px;border:1px solid #dbe5ee;border-radius:11px;padding:10px 11px;background:#fbfdff;overflow:hidden}.metric:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#89a8c3}.metric.critical:before{background:#e76552}.metric.planning:before{background:#d4a435}.metric.good:before{background:#28a17e}.metric span{display:block;font-size:7px;font-weight:900;letter-spacing:.075em;text-transform:uppercase;color:#75879a;line-height:1.2}.metric strong{display:block;margin-top:8px;font-size:20px;line-height:1;color:#153a61;letter-spacing:-.02em}.section-title{display:flex;align-items:end;justify-content:space-between;margin:14px 0 8px;border-bottom:1px solid #e2e9f0;padding-bottom:7px}.section-title h2{margin:0;font-size:18px;letter-spacing:-.02em;color:#123655}.section-title span{font-size:8px;color:#7b8b9a;text-transform:uppercase;letter-spacing:.09em;font-weight:800}.priority-list{display:grid;gap:7px}.priority{border:1px solid #dbe4ec;border-radius:10px;padding:9px 10px;display:grid;grid-template-columns:28px minmax(0,1fr) 92px;align-items:start;gap:9px;background:#fff;box-shadow:0 2px 7px rgba(21,55,87,.035)}.priority.critical{border-left:4px solid #e15c49}.priority.planning{border-left:4px solid #d2a337}.priority.info{border-left:4px solid #5f93c3}.priority-number{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:#eef4f9;color:#41698e;font-size:8px;font-weight:900}.priority h3{margin:0 0 3px;font-size:11px;color:#163a5d}.priority p{margin:0;color:#64788c;font-size:8.5px;line-height:1.35}.priority aside{text-align:right;padding-top:1px}.priority aside strong{display:block;font-size:10px;color:#173b5e}.priority aside small{display:block;margin-top:3px;font-size:7px;color:#7c8d9e;line-height:1.3}.priority-continuation{margin-top:4px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.panel{border:1px solid #dbe4ec;border-radius:11px;padding:12px 13px;background:#fbfdff}.panel h3{margin:0 0 8px;font-size:12px;color:#173b5e}.panel p,.panel li{font-size:9px;line-height:1.4;color:#5f7488}.panel p{margin:0 0 6px}.panel ul{padding-left:15px;margin:0}.panel li+li{margin-top:4px}.badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 6px;border-radius:999px;background:#edf2f7;color:#51667e;font-size:6.5px;font-weight:900;letter-spacing:.045em;text-transform:uppercase;line-height:1.1;white-space:nowrap}.badge.critical{background:#fee5df;color:#a83b2d}.badge.planning{background:#fff0c9;color:#825d0e}.badge.healthy{background:#ddf4eb;color:#176e59}.badge.unknown{background:#edf2f7;color:#66778b}.inventory-title{margin-top:3px}.inventory-count{display:inline-flex!important;align-items:center;padding:4px 7px;border-radius:999px;background:#edf4fa;color:#416886!important}.table-shell{border:1px solid #d8e3ec;border-radius:10px;overflow:hidden}.device-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.6px}.device-table th:nth-child(1){width:19%}.device-table th:nth-child(2){width:14%}.device-table th:nth-child(3){width:18%}.device-table th:nth-child(4){width:13%}.device-table th:nth-child(5){width:13%}.device-table th:nth-child(6){width:23%}.device-table th{text-align:left;padding:7px 7px;background:#103b66;color:white;font-size:6.7px;text-transform:uppercase;letter-spacing:.055em;line-height:1.15}.device-table td{padding:7px 7px;border-bottom:1px solid #e5ebf0;vertical-align:top;color:#20384f;line-height:1.2;overflow:hidden}.device-table tr:last-child td{border-bottom:0}.device-table tr:nth-child(even) td{background:#fbfcfe}.device-table tr.critical td:first-child{box-shadow:inset 3px 0 0 #e15c49}.device-table tr.planning td:first-child{box-shadow:inset 3px 0 0 #d2a337}.device-table strong{display:block;font-size:8.4px;color:#102f4d;line-height:1.15}.cell-primary{display:block;font-size:7.5px;color:#243d55}.cell-os{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:7.3px;line-height:1.2}.cell-note{display:block;color:#7b8b9b;margin-top:2px;font-size:6.5px;line-height:1.18}.concern-note{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.review-item{padding:8px 0;border-bottom:1px solid #e2e9f0}.review-item:last-child{border-bottom:0}.review-item h3{font-size:10px;margin:0 0 3px;color:#153957}.review-item p{font-size:8px;color:#61758a;margin:2px 0;line-height:1.35}.checklist{display:grid;grid-template-columns:1fr 1fr;gap:9px 18px;padding:0;margin:0;list-style:none;counter-reset:check}.checklist li{position:relative;border:1px solid #dbe4ec;border-radius:10px;padding:10px 10px 10px 38px;min-height:58px;font-size:9px;line-height:1.38;color:#50687e;counter-increment:check;background:#fbfdff}.checklist li:before{content:counter(check);position:absolute;left:10px;top:10px;width:20px;height:20px;border-radius:6px;background:#e8f2f9;color:#275f8c;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900}.notes-panel{margin-top:15px}.notes-area{height:430px;border:1px solid #d6e0e9;border-radius:9px;margin-top:10px;background:repeating-linear-gradient(#fff,#fff 29px,#e8eef4 30px)}.itc-pdf-footer{position:absolute;bottom:15px;left:32px;right:32px;border-top:1px solid #e1e8ef;padding-top:7px;display:flex;justify-content:space-between;font-size:6.5px;color:#7b8b9c;text-transform:uppercase;letter-spacing:.08em}.security-metrics{grid-template-columns:repeat(4,1fr)}.review-panel{margin-top:8px;max-height:380px;overflow:hidden}.continuation-note{margin-top:7px;font-size:7px;color:#8190a0;text-align:right}.page-number{color:#4f6f8d;font-weight:900}@media print{body{background:#fff}.print-report{padding:0}.page{margin:0;page-break-after:always}}
`;

export function internalTcReportHtml(project: Project): string {
  const model = internalTcReportModel(project);
  const coverPriorityCount = Math.min(5, model.priorities.length);
  const coverPriorities = model.priorities.length
    ? model.priorities.slice(0, coverPriorityCount).map((item, index) => priorityCard(item, index)).join("")
    : `<div class="panel"><p>No packaged project priorities are currently recorded.</p></div>`;
  const remainingPriorities = model.priorities.slice(coverPriorityCount);
  const priorityChunks: InternalTcPriority[][] = [];
  for (let index = 0; index < remainingPriorities.length; index += 8) priorityChunks.push(remainingPriorities.slice(index, index + 8));
  const priorityPages = priorityChunks.map((chunk, pageIndex) => `<section class="page">${pdfHeader("Priority work")}<div class="section-title"><h2>Priority work · continued</h2><span>${coverPriorityCount + pageIndex * 8 + 1}-${coverPriorityCount + pageIndex * 8 + chunk.length} of ${model.priorities.length}</span></div><div class="priority-list priority-continuation">${chunk.map((item, index) => priorityCard(item, coverPriorityCount + pageIndex * 8 + index)).join("")}</div>${pdfFooter(model.clientName, "Priority work")}</section>`).join("");

  const deviceChunks: InternalTcDeviceRow[][] = [];
  for (let index = 0; index < model.devices.length; index += 14) deviceChunks.push(model.devices.slice(index, index + 14));
  if (!deviceChunks.length) deviceChunks.push([]);
  const devicePages = deviceChunks.map((chunk, pageIndex) => `<section class="page">${pdfHeader("Technical inventory")}<div class="section-title inventory-title"><h2>Technical inventory${deviceChunks.length > 1 ? ` · ${pageIndex + 1}/${deviceChunks.length}` : ""}</h2><span class="inventory-count">${chunk.length} devices · priority ordered</span></div><div class="table-shell"><table class="device-table"><thead><tr><th>Device</th><th>Type / Site</th><th>OS</th><th>Lifecycle</th><th>Warranty</th><th>Storage / Concern</th></tr></thead><tbody>${chunk.map(deviceRowHtml).join("") || `<tr><td colspan="6">No detailed inventory rows are available.</td></tr>`}</tbody></table></div>${pdfFooter(model.clientName, `Technical inventory · ${pageIndex + 1}/${deviceChunks.length}`)}</section>`).join("");

  const decisions = model.review.decisions.length ? model.review.decisions.map((item) => `<article class="review-item"><h3>${escapeHtml(item.title)}</h3><p><strong>${escapeHtml(item.disposition)}</strong>${item.quoted ? " · Quoted" : ""}${item.targetDate ? ` · Target ${escapeHtml(dateLabel(item.targetDate))}` : ""}</p><p>${escapeHtml(item.finding || item.internalNote || "No supporting detail recorded.")}</p>${item.internalNote && item.finding ? `<p><strong>Internal:</strong> ${escapeHtml(item.internalNote)}</p>` : ""}</article>`).join("") : `<p>No Review Outcome decisions are currently recorded.</p>`;
  const questions = model.openQuestions.length ? `<ul>${model.openQuestions.slice(0, 10).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>No open intelligence/HIPAA questions are currently flagged.</p>`;
  const context = model.context.length ? `<ul>${model.context.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>No additional company context was entered.</p>`;
  const warnings = model.inventoryWarnings.length ? `<ul>${model.inventoryWarnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>Inventory reconciliation has no current warning.</p>`;

  const coverPage = `<section class="page">${pdfHeader("Technology Consultant Briefing")}<div class="cover-band"><div class="hero"><span class="kicker">Technology Consultant Briefing</span><h1>${escapeHtml(model.clientName)}</h1><p>Technical, lifecycle, security, compliance, and project-planning summary built for fast internal review.</p></div><aside class="prepared-card"><div><span>Prepared</span><strong>${escapeHtml(model.prepared)}</strong></div><small>Use this briefing to focus the onsite or planning conversation on the items that actually need action.</small></aside></div><div class="summary">${escapeHtml(model.summary)}</div><div class="metrics">${metricCard("Managed devices", String(model.metrics.inventory))}${metricCard("Replace now", String(model.metrics.replaceNow), model.metrics.replaceNow ? "critical" : "good")}${metricCard("Plan soon", String(model.metrics.planSoon), model.metrics.planSoon ? "planning" : "good")}${metricCard("Project need", money(model.metrics.projectNeed), model.metrics.projectNeed >= 13000 ? "critical" : model.metrics.projectNeed ? "planning" : "good")}${metricCard("OS concerns", String(model.metrics.osAttention), model.metrics.osAttention ? "planning" : "good")}${metricCard("Storage concerns", String(model.metrics.storageAttention), model.metrics.storageAttention ? "planning" : "good")}${metricCard("Security incidents", String(model.metrics.securityIncidents), model.metrics.securityIncidents ? "critical" : "good")}${metricCard("HIPAA readiness", model.metrics.hipaaScore === null ? "N/A" : `${model.metrics.hipaaScore}%`, model.metrics.hipaaScore !== null && model.metrics.hipaaScore < 80 ? "planning" : "good")}</div><div class="section-title"><h2>Priority work</h2><span>${model.priorities.length > coverPriorityCount ? `Top ${coverPriorityCount} of ${model.priorities.length}` : "What the TC should focus on"}</span></div><div class="priority-list">${coverPriorities}</div>${model.priorities.length > coverPriorityCount ? `<div class="continuation-note">${model.priorities.length - coverPriorityCount} additional priorit${model.priorities.length - coverPriorityCount === 1 ? "y" : "ies"} continue on the next page.</div>` : ""}${pdfFooter(model.clientName, "Internal technical briefing")}</section>`;

  const readinessPage = `<section class="page">${pdfHeader("Security & readiness")}<div class="section-title"><h2>Security &amp; readiness</h2><span>Operational context</span></div><div class="metrics security-metrics">${metricCard("Events analyzed", model.security.events.toLocaleString("en-US"))}${metricCard("Signals", String(model.security.signals))}${metricCard("Incidents", String(model.security.incidents), model.security.incidents ? "critical" : "good")}${metricCard("Malware blocked", String(model.security.malwareBlocked), model.security.malwareBlocked ? "planning" : "good")}</div><div class="grid2"><div class="panel"><h3>HIPAA readiness</h3>${model.hipaa.enabled ? `<p><strong>${model.hipaa.score}% · ${escapeHtml(model.hipaa.label)}</strong></p><ul><li>${model.hipaa.unanswered} unanswered / deferred</li><li>${model.hipaa.highRisk} high or critical risk items</li></ul>` : `<p>HIPAA readiness is not enabled in this workspace.</p>`}</div><div class="panel"><h3>Inventory reconciliation</h3>${warnings}</div><div class="panel"><h3>Company / meeting context</h3>${context}</div><div class="panel"><h3>Open questions</h3>${questions}</div></div><div class="section-title"><h2>Review Outcome</h2><span>${escapeHtml(model.review.reviewedAt ? `Reviewed ${dateLabel(model.review.reviewedAt)}` : "No completed review date")}</span></div><div class="panel review-panel">${model.review.meetingSummary ? `<p><strong>Meeting summary:</strong> ${escapeHtml(model.review.meetingSummary)}</p>` : ""}${model.review.agreedNextStep ? `<p><strong>Agreed next step:</strong> ${escapeHtml(model.review.agreedNextStep)}</p>` : ""}${decisions}</div>${pdfFooter(model.clientName, "Security, readiness & review outcome")}</section>`;

  const fieldPage = `<section class="page">${pdfHeader("Onsite verification")}<div class="section-title"><h2>Before you leave</h2><span>Onsite / technical verification</span></div><ul class="checklist">${model.beforeYouLeave.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><div class="panel notes-panel"><h3>Field notes</h3><p>Capture dependencies, vendor/application versions, hardware corrections, cabling/network observations, quote-scope changes, and anything estimating or support should know after the visit.</p><div class="notes-area"></div></div>${pdfFooter(model.clientName, "Onsite verification & field notes")}</section>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="adv-pdf-layout" content="portrait"><title>${escapeHtml(`Internal TC Report - ${model.clientName}`)}</title><style>${INTERNAL_CSS}</style></head><body><main class="print-report">${coverPage}${priorityPages}${devicePages}${readinessPage}${fieldPage}</main></body></html>`;
}

export async function downloadInternalTcReportPdf(project: Project): Promise<void> {
  await downloadFillableClientPdf(internalTcReportHtml(project), `Internal TC Report - ${project.client.name}`);
}

export { money as formatInternalTcMoney };
