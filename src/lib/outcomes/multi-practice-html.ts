import type { MultiPracticeData, PracticeReview } from "./multi-practice-review";
import { downloadFillableClientPdf } from "./fillable-pdf-core";

function e(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function date(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "Date not available" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function noDataOr(n: number, known = true): string { return known ? String(n) : "Not assessed"; }
function status(p: PracticeReview): string {
  if (p.lifecycle.overdue) return "Replacement priorities";
  if (p.lifecycle.dueSoon) return "Planning recommended";
  if (p.lifecycle.unknown) return "Age verification needed";
  if (p.lifecycle.total) return "Within equipment-age range";
  return "Inventory not established";
}
function page(kicker: string, title: string, subtitle: string, content: string, mark: string): string {
  return '<section class="multi-page"><header class="page-heading"><span class="kicker">' + e(kicker)
    + '</span><h2>' + e(title) + '</h2><p>' + e(subtitle)
    + '</p></header><div class="page-content">' + content
    + '</div><footer class="page-footer"><b>ADVANTAGE <small>TECHNOLOGIES</small></b><span>' + e(mark) + '</span></footer></section>';
}
function box(kicker: string, title: string, body: string, className = ""): string {
  return '<article class="panel ' + e(className) + '"><span class="kicker">' + e(kicker)
    + '</span><h3>' + e(title) + '</h3><p>' + e(body) + '</p></article>';
}
function practiceTitle(p: PracticeReview): string {
  return '<div class="practice-title"><span>Practice</span><h3>' + e(p.name)
    + '</h3><small>Report updated ' + e(date(p.sourceUpdatedAt)) + '</small></div>';
}
function pairing(practices: PracticeReview[], render: (p: PracticeReview) => string): string[] {
  const pages: string[] = [];
  for (let i = 0; i < practices.length; i += 2) {
    const group = practices.slice(i, i + 2);
    pages.push('<div class="practice-grid">' + group.map((p) =>
      '<section class="practice-panel">' + practiceTitle(p) + render(p) + '</section>').join("") + '</div>');
  }
  return pages;
}
function statistic(label: string, value: string | number, tone = ""): string {
  return '<div class="stat ' + e(tone) + '"><strong>' + e(value) + '</strong><span>' + e(label) + '</span></div>';
}
function sectionDetails(label: string, value: string | number): string {
  return '<div class="detail-row"><span>' + e(label) + '</span><strong>' + e(value) + '</strong></div>';
}
function intro(data: MultiPracticeData): string {
  const practices = data.practices.map((p, i) =>
    '<div class="cover-practice"><b>0' + (i + 1) + '</b><span>' + e(p.name) + '</span></div>').join("");
  return '<section class="multi-page cover"><span class="kicker">ADVANTAGE TECHNOLOGIES · OWNERSHIP REVIEW</span>'
    + '<h1>Technology<br>Health Review</h1><p>' + e(data.review.ownerLabel)
    + '</p><h3>' + e(data.review.title) + '</h3><div class="cover-practices">' + practices
    + '</div><footer class="page-footer"><b>ADVANTAGE <small>TECHNOLOGIES</small></b><span>'
    + e(data.practices.length) + ' independent practice reviews · Prepared ' + e(date(new Date().toISOString()))
    + '</span></footer></section>';
}

export function multiPracticePages(data: MultiPracticeData): string[] {
  const mark = data.review.ownerLabel + " · " + data.practices.length + " practices";
  const pages = [intro(data)];
  const overview = pairing(data.practices, (p) =>
    '<div class="highlight">' + e(status(p)) + '</div>'
    + '<div class="stats four">' + statistic("Reported assets", p.assetCount)
    + statistic("Replace now", p.lifecycle.overdue, p.lifecycle.overdue ? "priority" : "")
    + statistic("Plan soon", p.lifecycle.dueSoon)
    + statistic("OS attention", p.os.attention) + '</div>'
    + sectionDetails("Storage concerns", p.storage.attention)
    + sectionDetails("Security reporting", p.securityEvidence ? "Available" : "Not assessed")
    + sectionDetails("HIPAA readiness", p.hipaaEnabled ? p.hipaaLabel : "Not assessed")
    + '<p class="fine">These are separate practice findings, not a combined numerical health score.</p>');
  overview.forEach((body, i) => pages.push(page("Executive overview", "Each practice, clearly accounted for",
    "Independent priorities are shown side by side for the owner. A healthy result at one practice does not cancel an issue at another.",
    body, mark + " · " + (i + 1) + "/" + overview.length)));

  const security = pairing(data.practices, (p) =>
    p.securityEvidence
      ? '<div class="stats three">' + statistic("Events analyzed", p.securityEventsReported ? p.securityEvents.toLocaleString() : "Not reported")
        + statistic("Investigations", p.securityInvestigationsReported ? p.securityInvestigations : "Not reported") + statistic("Incidents reported", p.securityIncidentsReported ? p.securityIncidents : "Not reported") + '</div>'
        + '<p class="fine">Numbers are from this practice’s available security source. Reporting periods may differ between practices. Reported incidents are not a statement that all threats are absent.</p>'
      : box("Source unavailable", "Security reporting not assessed", "Add and validate this practice’s security report before making a cross-practice security comparison."));
  security.forEach((body, i) => pages.push(page("Security", "Protection and reported activity",
    "Security evidence stays attached to its own practice. Do not combine event totals from potentially different reporting periods.", body, mark + " · " + (i + 1) + "/" + security.length)));

  const backup = pairing(data.practices, (p) =>
    '<div class="stats">' + statistic("Cloud Plus BDR devices listed", p.bdrCount)
    + statistic("Server-class systems", p.devices.filter((d) => d.type === "server" || d.type === "backup-server").length)
    + '</div><p class="fine">' + (p.bdrCount
      ? "The inventory identifies a backup appliance; successful backups, offsite replication, recovery-test dates and actual restore capability require separate verification."
      : "No Cloud Plus BDR appliance is identified in this inventory. Other backup arrangements may exist and should be confirmed independently.")
    + '</p>');
  backup.forEach((body, i) => pages.push(page("Backup & recovery", "Recovery coverage should be confirmed",
    "An inventory record is not proof of successful backups or tested restoration. Validate the recovery path independently for each practice.",
    body, mark + " · " + (i + 1) + "/" + backup.length)));

  const lifecycle = pairing(data.practices, (p) =>
    '<div class="stats four">' + statistic("Healthy age", p.lifecycle.current)
    + statistic("Plan soon", p.lifecycle.dueSoon)
    + statistic("Replace now", p.lifecycle.overdue, p.lifecycle.overdue ? "priority" : "")
    + statistic("Age unverified", p.lifecycle.unknown) + '</div>'
    + '<div class="detail-list">' + sectionDetails("OS end of support", p.os.endOfSupport)
    + sectionDetails("OS planning", p.os.planning)
    + sectionDetails("Storage watch / critical", p.storage.attention)
    + sectionDetails("Physical hardware assessed", p.lifecycle.total)
    + '</div><p class="fine">Virtual machines are listed in the detailed inventory but excluded from physical replacement-age counts.</p>');
  lifecycle.forEach((body, i) => pages.push(page("Equipment age & support", "Replacement priorities and platform support",
    "Equipment replacement and operating-system support are distinct considerations, and both are reviewed separately for each practice.",
    body, mark + " · " + (i + 1) + "/" + lifecycle.length)));

  for (const p of data.practices) {
    const devices = p.devices.slice().sort((a, b) => {
      const rank: Record<string, number> = { overdue: 0, "due-soon": 1, unknown: 2, current: 3 };
      return rank[a.lifecycleStatus] - rank[b.lifecycleStatus] || a.name.localeCompare(b.name);
    });
    const chunks: typeof devices[] = [];
    for (let i = 0; i < devices.length; i += 5) chunks.push(devices.slice(i, i + 5));
    if (!chunks.length) chunks.push([]);
    chunks.forEach((chunk, index) => {
      const table = '<table class="device-table"><thead><tr><th>Device</th><th>Type</th><th>OS</th><th>Age</th><th>Priority</th></tr></thead><tbody>'
        + chunk.map((d) => '<tr><td><b>' + e(d.name) + '</b><small>' + e([d.make, d.model, d.location].filter(Boolean).join(" · ")) + '</small></td><td>' + e(d.type)
          + '</td><td>' + e(d.os || "Not reported") + '</td><td>' + e(d.type === "vm" ? "Host-dependent" : d.age > 0 ? String(d.age) + " yrs" : "Verify")
          + '</td><td>' + e(d.type === "vm" ? "Virtual" : d.lifecycleStatus === "overdue" ? "Replace" : d.lifecycleStatus === "due-soon" ? "Plan" : d.lifecycleStatus === "current" ? "Healthy" : "Verify") + '</td></tr>').join("")
        + '</tbody></table>';
      pages.push(page("Hardware inventory · " + p.name, p.name,
        "Device register · " + p.assetCount + " reported assets · Page " + (index + 1) + " of " + chunks.length,
        table + '<p class="fine">Equipment is attributed to this practice’s own report. Duplicate serial numbers across practices require review rather than automatic merging.</p>', mark));
    });
  }

  const hipaa = pairing(data.practices, (p) =>
    p.hipaaEnabled
      ? '<div class="highlight">' + e(p.hipaaLabel) + '</div>'
        + sectionDetails("Unanswered readiness questions", p.hipaaOpen)
        + '<div class="gap-list">' + (p.hipaaGaps.length ? p.hipaaGaps.map((g) => '<div>• ' + e(g) + '</div>').join("")
          : '<div>No specific reportable gaps listed in the current assessment.</div>') + '</div>'
        + '<p class="fine">Readiness results are not a determination of legal HIPAA compliance. Each practice remains responsible for its own assessment and controls.</p>'
      : box("Assessment unavailable", "HIPAA readiness not assessed", "Complete this practice’s separate readiness questionnaire and confirm administrative controls with the practice."));
  hipaa.forEach((body, i) => pages.push(page("HIPAA readiness", "Separate practices, separate assessments",
    "Practice-specific unanswered questions and readiness findings remain distinct, even when ownership or policies overlap.", body, mark + " · " + (i + 1) + "/" + hipaa.length)));

  for (const p of data.practices) {
    const actions = p.actions;
    const chunks: typeof actions[] = [];
    for (let i = 0; i < actions.length; i += 4) chunks.push(actions.slice(i, i + 4));
    if (!chunks.length) chunks.push([]);
    chunks.forEach((chunk, index) => pages.push(page("Technology roadmap · " + p.name, p.name,
      (p.reviewAgreed ? "Agreed next steps" : "Recommended next steps, pending confirmation") + " · " + (index + 1) + "/" + chunks.length,
      '<div class="action-list">' + (chunk.length ? chunk.map((a, idx) =>
        '<article class="action"><strong>' + String(index * 4 + idx + 1).padStart(2, "0") + '</strong><div><h3>' + e(a.title) + '</h3><p>' + e(a.detail)
        + '</p><small>Timing: ' + e(a.timing) + ' · Responsibility: ' + e(a.owner) + '</small></div></article>').join("")
        : '<p>No specific planning actions were entered in the current report.</p>') + '</div>', mark)));
  }

  if (data.review.includeBudget) {
    const budget = pairing(data.practices, (p) =>
      '<div class="money">' + e(money(p.budget.replacementBudgetLow)) + ' – ' + e(money(p.budget.replacementBudgetHigh)) + '</div>'
      + '<p class="fine">Preliminary 12-month replacement planning estimate</p>'
      + sectionDetails("Servers in planning scope", p.budget.planningServers)
      + sectionDetails("Workstations in planning scope", p.budget.planningWorkstations)
      + sectionDetails("Equipment ages to verify", p.budget.incompleteAgeCount)
      + '<p class="fine">Per-practice server and workstation assumptions calculated independently. Final scope, taxes and quotes require confirmation.</p>');
    budget.forEach((body, i) => pages.push(page("Budget outlook", "Per-practice investment planning",
      "These are planning estimates, not quotes. Each practice’s equipment and assumptions are calculated independently.",
      body, mark + " · " + (i + 1) + "/" + budget.length)));
    const total = '<div class="money hero-money">' + e(money(data.combinedBudgetLow)) + ' – ' + e(money(data.combinedBudgetHigh)) + '</div>'
      + '<p>Indicative total across ' + data.practices.length + ' separate practice estimates</p>'
      + '<div class="stats">' + statistic("Suggested quarterly reserve · low", money(data.combinedQuarterlyLow))
      + statistic("Suggested quarterly reserve · high", money(data.combinedQuarterlyHigh)) + '</div>'
      + '<div class="note">Quarterly figures divide the full-year estimate into four reserve targets. They are not a confirmed project schedule or cash-flow projection. Shared scopes, duplicated equipment and final pricing must be reviewed before approval.</div>';
    pages.push(page("Ownership budget", "One planning view, separate practice budgets",
      "A combined owner-level perspective does not change the underlying practice-by-practice scope.",
      total, mark));
  }

  const recap = pairing(data.practices, (p) =>
    '<div class="highlight">' + e(status(p)) + '</div>'
    + '<div class="detail-list">' + sectionDetails("Replacement priorities", p.lifecycle.overdue)
    + sectionDetails("Forward planning", p.lifecycle.dueSoon)
    + sectionDetails("OS support concerns", p.os.attention)
    + sectionDetails("Outstanding HIPAA answers", p.hipaaEnabled ? p.hipaaOpen : "Not assessed") + '</div>'
    + '<p class="fine">Next: review the ' + e(p.actions[0]?.title || "technology findings")
    + ' with the appropriate decision-maker.</p>');
  recap.forEach((body, i) => pages.push(page("Final recap", "Priorities and decisions by practice",
    "Agree on practice-level ownership, approval and timing before implementing equipment or policy changes.",
    body, mark + " · " + (i + 1) + "/" + recap.length)));
  if (data.warnings.length) {
    const warnings = data.warnings.map((w) => '<div class="warning-row">' + e(w) + '</div>').join("");
    pages.push(page("Source disclosures", "Items to confirm before relying on this review",
      "Source attribution and evidence quality are kept visible; no missing facts are silently filled in.",
      '<div class="warning-list">' + warnings + '</div>', mark));
  }
  return pages;
}

const CSS = String.raw`
*{box-sizing:border-box}html,body{margin:0;background:#eaf0f8;color:#10233b;font-family:Arial,"Segoe UI",sans-serif}main{width:1280px;margin:0 auto}.print-report{width:1280px}.multi-page{position:relative;display:flex;flex-direction:column;width:1280px;height:720px;min-height:720px;max-height:720px;padding:55px 66px 44px;margin:0 auto 26px;overflow:hidden;background:#f9fbff;color:#10233b;break-after:page;box-shadow:0 8px 30px #12345616}.multi-page:before{content:"";position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg,#1e75c6,#40c8ae)}.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:800;color:#4186bc}.page-heading{padding-bottom:22px}.page-heading h2{font-size:41px;line-height:1.1;margin:10px 0 9px;letter-spacing:-.035em;color:#092449}.page-heading p{font-size:16px;line-height:1.35;max-width:1060px;color:#62758b;margin:0}.page-content{flex:1;min-height:0}.page-footer{position:absolute;bottom:17px;left:66px;right:66px;display:flex;justify-content:space-between;border-top:1px solid #dce8f4;padding-top:11px;font-size:11px;color:#72859a}.page-footer b{font-size:14px;letter-spacing:.04em;color:#102f60}.page-footer b small{font-size:8px;letter-spacing:.21em}.cover{background:linear-gradient(125deg,#081930 0%,#0b2c55 56%,#174779 100%);color:white;padding-top:80px}.cover:before{height:10px}.cover .kicker{color:#7cdec9}.cover h1{font-size:85px;line-height:.94;letter-spacing:-.065em;margin:23px 0 20px}.cover p{font-size:25px;color:#bed5eb;margin:0}.cover h3{font-weight:500;font-size:20px;margin:10px 0 22px;color:#e5f0fc}.cover .page-footer{border-color:#527092;color:#d8e9f8}.cover .page-footer b{color:#fff}.cover-practices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:1030px}.cover-practice{border:1px solid #4c739b;border-radius:12px;padding:16px 17px;display:flex;align-items:center;gap:16px;background:#ffffff0d;font-weight:700;font-size:17px}.cover-practice b{color:#65cfc2}.practice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;height:100%;align-items:start}.practice-grid:has(.practice-panel:only-child){grid-template-columns:1fr}.practice-panel{border:1px solid #d4e2f0;border-radius:19px;padding:22px;background:white;min-width:0;height:100%;overflow:hidden}.practice-title{border-bottom:1px solid #e1eaf4;padding-bottom:12px;margin-bottom:19px}.practice-title>span{font-size:10px;font-weight:850;color:#168a9a;text-transform:uppercase;letter-spacing:.1em}.practice-title h3{font-size:20px;line-height:1.16;margin:5px 0 5px;color:#0a2c55}.practice-title small{font-size:11px;color:#8494a5}.highlight{padding:12px 15px;border-left:4px solid #e0a84f;border-radius:8px;background:#f3f6fc;color:#174477;font-weight:750;margin-bottom:16px;font-size:17px}.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0 17px}.stats.three{grid-template-columns:repeat(3,minmax(0,1fr))}.stats.four{grid-template-columns:repeat(2,minmax(0,1fr))}.stat{border:1px solid #dce7f3;border-radius:11px;padding:14px 13px;background:#f5f9ff;min-width:0}.stat strong{display:block;color:#0e3262;font-size:29px;line-height:1}.stat.priority strong{color:#b04d42}.stat span{display:block;color:#617b98;font-size:11px;margin-top:5px}.detail-list{margin-top:6px}.detail-row{display:flex;justify-content:space-between;gap:10px;padding:8px 1px;border-bottom:1px solid #e5edf6;color:#566f88;font-size:14px}.detail-row strong{color:#103b68}.fine{font-size:12px!important;color:#6b8197!important;line-height:1.4!important;margin:12px 0!important}.panel{padding:18px;border-radius:13px;background:#f3f7fd;border:1px solid #e0e9f3;margin-bottom:12px}.panel h3{margin:7px 0;font-size:20px}.panel p{font-size:13px;color:#668099}.device-table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:12px;background:#fff;border:1px solid #d8e5f0}.device-table th{background:#e8f1fa;color:#52728f;text-align:left;font-size:11px;padding:12px 10px;text-transform:uppercase}.device-table th:nth-child(1){width:33%}.device-table td{padding:11px 10px;border-top:1px solid #e3eaf3;vertical-align:middle;overflow-wrap:anywhere}.device-table tr:nth-child(even) td{background:#f7f9fd}.device-table td b{display:block;color:#12385c}.device-table td small{display:block;color:#738497;margin-top:4px}.action-list{display:grid;gap:11px}.action{display:grid;grid-template-columns:44px 1fr;gap:14px;background:#fff;border-radius:12px;padding:13px 18px;border:1px solid #dce8f4}.action>strong{font-size:27px;color:#369eab}.action h3{font-size:16px;margin:0 0 4px;color:#10355d}.action p{font-size:12px;line-height:1.4;color:#5d7188;margin:0 0 5px}.action small{font-size:11px;color:#37789b}.gap-list{padding:8px 0;display:grid;gap:7px;font-size:13px;color:#3f5873}.gap-list>div{background:#f5f8fc;padding:9px 12px;border-radius:8px}.money{font-weight:800;font-size:29px;color:#0e3766;letter-spacing:-.04em;margin-top:12px}.hero-money{font-size:58px;margin:45px 0 0}.note{margin:24px 0;padding:16px 20px;border-left:4px solid #2aa9ae;background:#eaf5f7;color:#345b74;font-size:14px;line-height:1.4}.warning-list{display:grid;gap:13px}.warning-row{background:#fff6e8;border:1px solid #f4dab2;border-radius:11px;padding:14px 17px;color:#8c5a23;font-size:15px}body.screen-only{background:#061a32}body.screen-only .multi-page{margin:0;box-shadow:none}@media print{@page{size:landscape;margin:0}html,body{background:white!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.multi-page{margin:0!important;box-shadow:none!important}}
`;

export function multiPracticeHtml(data: MultiPracticeData, screenPage?: number): string {
  const sections = multiPracticePages(data);
  const hidden = screenPage === undefined ? "" : '<style>.print-report>.multi-page{display:none!important}.print-report>.multi-page:nth-child(' + (screenPage + 1) + '){display:flex!important}</style>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1280"><meta name="adv-pdf-layout" content="landscape"><title>'
    + e(data.review.title) + '</title><style>' + CSS + '</style>' + hidden + '</head><body'
    + (screenPage === undefined ? "" : ' class="screen-only"')
    + '><main><div class="print-report">' + sections.join("") + '</div></main></body></html>';
}

export async function downloadMultiPracticePdf(data: MultiPracticeData): Promise<void> {
  if (data.errors.length) throw new Error(data.errors.join(" "));
  // Call the existing, tested native-PDF renderer directly, without applying single-practice
  // editing, appointment or inventory transformations to the combined ownership document.
  await downloadFillableClientPdf(multiPracticeHtml(data), "Technology Health Review - " + data.review.ownerLabel);
}
