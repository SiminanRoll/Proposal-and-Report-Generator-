import type { A360ConversationRecord } from "@/lib/projects/types";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import { a360PriorityLabel, normalizeA360PriorityText } from "@/lib/prospects/a360";
import { ADVANTAGE_WEBSITE_LINKS, a360PriorityWebsiteLinkKeys, type AdvantageWebsiteLinkKey } from "@/lib/advantage-website-links";
import { ADVANTAGE_LOGO_DATA_URI } from "@/lib/outcomes/pdf-assets";
import { defaultA360ConversationReport, isA360AppointmentScheduled } from "@/lib/prospects/a360-conversation";
import { a360ServiceCoverage, type A360ServiceCoverageRow } from "@/lib/prospects/a360-service-coverage";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function serverLabel(value: string): string {
  if (value === "yes") return "Onsite server";
  if (value === "no") return "No onsite server";
  return "Server details";
}

function serverNote(value: string): string {
  if (value === "yes") return "we’ll take a look during the visit";
  if (value === "no") return "based on our conversation";
  return "we’ll confirm this onsite";
}

function software(record: A360ConversationRecord): string[] {
  const d = record.discovery;
  const items = [d.managementSoftware.trim(), d.imagingSoftware.trim()];
  if (d.imagingEnvironment.trim() && d.imagingEnvironment !== "Not sure") items.push(d.imagingEnvironment.trim());
  items.push(...d.otherSoftware.split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean));
  return [...new Set(items.filter(Boolean))];
}

function clientFacingConversationSummary(record: A360ConversationRecord): string {
  const summary = normalizeA360PriorityText(record.report.conversationSummary);
  const generated = defaultA360ConversationReport(record.discovery, record.appointment).conversationSummary;
  // The generated paragraph repeats the counts, software and onsite process
  // already shown on this page. Keep any manually tailored discussion intact.
  return summary === normalizeA360PriorityText(generated) ? "" : summary;
}

/** Conservative row budgets keep unusually long application lists readable on
 * continuation pages instead of clipping them in the fixed portrait capture. */
function coveragePages(rows: A360ServiceCoverageRow[]): A360ServiceCoverageRow[][] {
  const chunks = (text: string, limit: number): string[] => {
    const parts: string[] = [];
    let remaining = text;
    while (remaining.length > limit) {
      const space = remaining.lastIndexOf(" ", limit);
      const end = space > limit / 2 ? space : limit;
      parts.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trimStart();
    }
    parts.push(remaining);
    return parts;
  };
  const expanded = rows.flatMap((row) => {
    const titles = chunks(row.title, 260);
    const details = chunks(row.detail, 560);
    return Array.from({ length: Math.max(titles.length, details.length) }, (_, index) => ({
      key: `${row.key}-${index}`,
      title: titles[index] || `${row.title.slice(0, 60)} (continued)`,
      detail: details[index] || "Software support and vendor coordination (continued).",
    }));
  });
  const pages: A360ServiceCoverageRow[][] = [[]];
  let used = 0;
  for (const row of expanded) {
    const height = Math.max(Math.ceil(row.title.length / 25), Math.ceil(row.detail.length / 56), 1) * 18 + 18;
    const budget = pages.length === 1 ? 520 : 680;
    if (used + height > budget && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(row);
    used += height;
  }
  return pages;
}

const A360_LINK_LABELS: Partial<Record<AdvantageWebsiteLinkKey, string>> = {
  stable: "How Advantage helps keep technology stable",
  supported: "See what supported IT looks like",
  secure: "Explore Advantage security",
  simple: "See how Advantage keeps IT simple",
  projects: "Explore technology refresh planning",
};

function websiteLink(key: AdvantageWebsiteLinkKey, label: string): string {
  const href = ADVANTAGE_WEBSITE_LINKS[key];
  return `<a href="${esc(href)}" data-pdf-link="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/** Connect the selected priorities to practical outcomes without repeating the report instructions. */
function a360ValueStatement(priorities: string[]): string {
  const benefits: Partial<Record<AdvantageWebsiteLinkKey, string>> = {
    stable: "reduce avoidable technology interruptions",
    secure: "help protect sensitive information and support security readiness",
    supported: "give your team a dependable place to turn for help",
    simple: "make routine technology costs more predictable",
    projects: "plan equipment and future changes before they become urgent",
  };
  const selected = a360PriorityWebsiteLinkKeys(priorities, 2)
    .map((key) => benefits[key])
    .filter((benefit): benefit is string => Boolean(benefit));
  const outcomes = selected.length ? selected.join(" and ") : "give your team dependable support and a clearer plan for technology";
  return `Advantage 360 is designed to ${outcomes}, so your team can spend less time managing IT and more time focused on its work.`;
}

function a360LearnMoreLinks(priorities: string[]): string {
  const contextual = a360PriorityWebsiteLinkKeys(priorities, 2);
  const links = [websiteLink("a360", "Learn more about Advantage 360")];
  for (const key of contextual) links.push(websiteLink(key, A360_LINK_LABELS[key] || "Learn more"));
  return `<div class="learn-links"><span>Discover the Advantage</span>${links.join("")}</div>`;
}

function footer(page: number, preparedDate: string, totalPages: number): string {
  return `<footer class="footer"><span>Advantage Technologies · Advantage 360</span><span>${page} / ${totalPages} · Prepared ${esc(preparedDate)}</span></footer>`;
}

export function a360ConversationReportHtml(record: A360ConversationRecord): string {
  const d = record.discovery;
  const report = record.report;
  const org = d.organizationName.trim() || d.contactName.trim() || "Your organization";
  const term = d.organizationLanguage.trim() || "organization";
  const softwareItems = software(record);
  const executiveSummary = normalizeA360PriorityText(report.executiveSummary);
  const conversationSummary = clientFacingConversationSummary(record);
  const nextStepSummary = normalizeA360PriorityText(report.nextStepSummary);
  const priorityCards = d.priorities.length
    ? d.priorities.slice(0, 5).map((priority, index) => `<article class="priority"><span>${String(index + 1).padStart(2, "0")}</span><div><small>Shared priority</small><strong>${esc(a360PriorityLabel(priority))}</strong></div></article>`).join("")
    : `<article class="priority"><span>01</span><div><small>Shared priority</small><strong>Technology support that fits the way your team works</strong></div></article>`;
  const softwareRows = softwareItems.length
    ? softwareItems.map((item) => `<span class="tag">${esc(item)}</span>`).join("")
    : `<span class="muted">We can talk through your key software during the onsite visit.</span>`;
  const estimateCaptured = record.estimateCaptured !== false;
  const range = record.estimate.low === record.estimate.high ? money(record.estimate.low) : `${money(record.estimate.low)}–${money(record.estimate.high)}`;
  const coverage = a360ServiceCoverage(d, { includeLifecyclePlanning: (record as A360ConversationRecord & { includeLifecyclePlanning?: boolean }).includeLifecyclePlanning === true });
  const servicePages = coveragePages([...coverage.services, ...(coverage.software.length ? coverage.software : [{
    key: "software", title: "Software support & vendor coordination",
    detail: "Technical troubleshooting and vendor coordination for your business applications; key software to confirm onsite.",
  }])]);
  const totalPages = 4 + servicePages.length;
  const preparedDate = new Date(record.capturedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const scheduled = isA360AppointmentScheduled(record.appointment) ? record.appointment : null;
  const appointment = scheduled ? formatPlanningAppointment(scheduled) : "Date and time to confirm";
  const logo = ADVANTAGE_LOGO_DATA_URI;
  const brand = `<a class="brand-link" href="${esc(ADVANTAGE_WEBSITE_LINKS.home)}" data-pdf-link="${esc(ADVANTAGE_WEBSITE_LINKS.home)}" target="_blank" rel="noopener noreferrer"><img src="${logo}" alt="Advantage Technologies"></a>`;
  const learnMoreLinks = a360LearnMoreLinks(d.priorities);
  const contactLink = `<div class="learn-links closing-links"><span>Questions?</span>${websiteLink("contact", "Meet your local Advantage team")}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
    @page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef3f7;font-family:"Segoe UI Variable Text","Segoe UI",Arial,sans-serif;font-synthesis:none;font-weight:400;color:#10263f;font-size:11pt;line-height:1.5}body{counter-reset:page}.sheet{position:relative;width:8.5in;min-height:11in;margin:24px auto;background:#fff;padding:.55in .62in .5in;display:flex;flex-direction:column;break-after:page;page-break-after:always;overflow:hidden}.sheet:last-child{break-after:auto;page-break-after:auto}.top{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2px solid #38d5c4}.top img{height:32px;max-width:250px}.brand-link{display:inline-flex;text-decoration:none}.prepared{text-align:right;color:#60788e;font-size:8.5pt;line-height:1.35}.prepared strong{display:block;color:#173651;font-size:9.5pt;margin-top:2px}.eyebrow{font-size:8.5pt;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#138c87}.section-head{margin:34px 0 22px}.section-head h1{margin:6px 0 8px;font-size:34px;line-height:1.02;letter-spacing:-.03em;color:#0c1f35}.section-head p{margin:0;color:#5b7084;max-width:6.7in;font-size:11.5pt;font-weight:400}.cover{background:linear-gradient(145deg,#061d39 0%,#092f59 55%,#095ba2 100%);color:#fff}.cover .top{border-color:rgba(110,236,222,.65)}.cover .top img{filter:brightness(0) invert(1);opacity:.96}.cover .prepared{color:#b8cce0}.cover .prepared strong{color:#fff}.cover-main{display:flex;flex:1;flex-direction:column;justify-content:center;padding:24px 0 46px}.cover .eyebrow{color:#72eadf}.cover h1{font-size:48px;line-height:.96;letter-spacing:-.045em;margin:12px 0 14px;max-width:6.3in}.cover h2{font-size:21px;margin:0 0 20px;font-weight:650;color:#d8eafb}.cover p{font-size:12.25pt;line-height:1.58;max-width:6.4in;color:#d8e6f3;margin:0;font-weight:400}.scheduled-strip{margin-top:34px;border:1px solid rgba(125,233,222,.4);background:rgba(255,255,255,.08);border-radius:16px;padding:19px 20px;display:flex;justify-content:space-between;gap:20px;align-items:center}.scheduled-strip small{display:block;text-transform:uppercase;letter-spacing:.12em;font-size:8pt;color:#7de9df;font-weight:800}.scheduled-strip strong{display:block;margin-top:4px;font-size:10.5pt;color:#fff}.cover .footer{border-color:rgba(255,255,255,.2);color:#b7c8d8}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #dbe5ed;border-radius:16px;padding:19px 20px;background:#fff;break-inside:avoid}.card h2,.card h3{margin:0 0 8px;color:#0b3d67}.card h2{font-size:12pt}.card h3{font-size:10.5pt}.card p{margin:0;color:#4e667c;font-weight:400}.priority-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.priority{display:flex;align-items:center;gap:13px;border:1px solid #dbe5ed;border-radius:14px;padding:16px;background:#f8fafc;min-height:82px}.priority>span{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:11px;background:#e5f0ff;color:#1473c9;font-weight:850;font-size:8.5pt}.priority small{display:block;text-transform:uppercase;letter-spacing:.08em;color:#7b8d9f;font-size:7.5pt;font-weight:800;margin-bottom:4px}.priority strong{display:block;font-size:10.5pt;line-height:1.25;color:#17344f}.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.value{border-radius:15px;background:#f2f7fb;padding:18px 19px}.value:last-child{grid-column:1/-1}.value strong{display:block;font-size:11pt;color:#123a5e;margin-bottom:6px}.value p{font-size:9.5pt;line-height:1.48;color:#61768a;margin:0;font-weight:400}.callout{margin-top:20px;padding:18px 20px;border-radius:14px;background:#edf9f7;border:1px solid #b7e5df;color:#355f62;font-size:10.5pt;line-height:1.5;font-weight:400}.callout strong{color:#0e716c}.learn-links{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-top:14px}.learn-links>span{flex-basis:100%;color:#74889a;font-size:7.25pt;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.learn-links a{display:inline-flex;padding:5px 8px;border-radius:999px;border:1px solid #c9dce9;background:#f7fbfd;color:#1764a5;font-size:7.75pt;font-weight:700;text-decoration:none}.learn-links a:after{content:'';font-size:7pt}.closing-links{margin-top:12px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:20px 0}.fact{border:1px solid #dce6ed;border-radius:15px;padding:18px;background:#f8fafc;min-height:98px}.fact b{display:block;color:#0a6e6a;font-size:20px;line-height:1.1}.fact small{display:block;color:#697e91;margin-top:7px;font-size:8.5pt;line-height:1.35;font-weight:400}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag{padding:8px 11px;border-radius:999px;background:#edf4f8;color:#274961;font-size:8.5pt;border:1px solid #d9e5ec;font-weight:400}.muted{color:#718597}.discussion{padding:20px;border-radius:15px;background:#f5f8fb;border-left:4px solid #2ccfc0;color:#3e5870}.discussion p{margin:0;font-size:10.5pt;line-height:1.5;font-weight:400}.not-assessed{margin-top:18px;padding:18px 20px;border-radius:14px;background:#fff8ef;border:1px solid #efd8bc;color:#725439;font-size:10pt;line-height:1.5;font-weight:400}.not-assessed strong{display:block;color:#8b5725;margin-bottom:5px;font-size:10.5pt}.price-hero{margin:28px 0 20px;border-radius:20px;background:linear-gradient(135deg,#082b55,#0a67b6);padding:30px;color:#fff}.price-hero small{display:block;text-transform:uppercase;letter-spacing:.12em;font-size:8pt;color:#8eece3;font-weight:800}.price-hero strong{display:block;font-size:38px;line-height:1;margin:9px 0}.price-hero p{margin:0;color:#d9e9f7;max-width:5.8in;font-size:10.5pt;line-height:1.5;font-weight:400}.basis{margin-top:16px}.basis h2{font-size:11pt;margin:0 0 10px;color:#123d62}.basis ul{margin:0;padding:0;list-style:none;display:grid;gap:9px}.basis li{position:relative;padding:11px 13px 11px 36px;border-radius:11px;background:#f5f8fb;color:#465f75;font-size:10pt;line-height:1.4;font-weight:400}.basis li:before{content:'✓';position:absolute;left:13px;top:10px;color:#0b877f;font-weight:900}.appointment-card{margin:28px 0 20px;padding:26px;border-radius:20px;background:#0b3158;color:#fff}.appointment-card small{display:block;color:#79e4da;text-transform:uppercase;letter-spacing:.12em;font-size:8pt;font-weight:800}.appointment-card strong{display:block;font-size:17pt;line-height:1.2;margin:8px 0}.appointment-card span{display:block;color:#d8e8f5;font-size:9.5pt;font-weight:400}.step-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.step{border:1px solid #dbe5ed;border-radius:14px;padding:17px;background:#f8fafc}.step b{display:block;color:#0d456f;font-size:10pt;margin-bottom:5px}.step p{margin:0;color:#63788c;font-size:9.25pt;line-height:1.45;font-weight:400}.closing{margin-top:20px;padding:20px;border-radius:15px;background:linear-gradient(135deg,#ecfaf7,#eef5ff);border:1px solid #c7e3e2}.closing strong{display:block;color:#0d675f;font-size:11pt;margin-bottom:6px}.closing p{margin:0;color:#42666b;font-size:10.5pt;line-height:1.5;font-weight:400}.footer{margin-top:auto;padding-top:12px;border-top:1px solid #dce5ec;display:flex;justify-content:space-between;color:#748697;font-size:7.25pt;font-weight:400}@media print{html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{margin:0;width:8.5in;height:11in;min-height:11in;box-shadow:none}}
    .coverage-sheet .section-head{margin:21px 0 15px}.coverage-sheet .section-head h1{font-size:31px}.coverage-sheet .section-head p{font-size:10pt}.coverage-sheet .price-hero{margin:0 0 16px;padding:18px 22px;border-radius:16px}.coverage-sheet .price-hero strong{font-size:36px;margin:7px 0}.coverage-sheet .price-hero p{font-size:9.5pt;line-height:1.4}.coverage-heading{font-size:12pt;line-height:1.3;color:#123d62;margin:0 0 9px}.coverage-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5pt;line-height:1.35}.coverage-table th,.coverage-table td{text-align:left;vertical-align:top;padding:8px 11px;border-bottom:1px solid #dce6ed;overflow-wrap:anywhere}.coverage-table thead th{font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:#57718a;background:#edf4f8;padding:7px 11px}.coverage-table th:first-child{width:31%}.coverage-table tbody th{color:#123d62;font-weight:700}.coverage-table td{color:#465f75;font-weight:400}.coverage-table tbody tr:nth-child(even){background:#f7fafc}.coverage-scope{margin:14px 0 18px;padding:12px 14px;border-radius:12px;border:1px solid #b7e5df;background:#edf9f7;color:#355f62;font-size:9pt;line-height:1.4}.coverage-scope p{margin:0}.coverage-scope p+p{margin-top:6px}.coverage-scope strong{color:#0e716c}.coverage-sheet .footer{flex-shrink:0}
    .coverage-sheet .section-head{margin:16px 0 12px}.coverage-sheet .price-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;margin-bottom:14px}.coverage-sheet .price-hero small{max-width:155px}.coverage-sheet .price-hero strong{margin:0;font-size:34px;white-space:nowrap}.coverage-scope{margin:10px 0 10px;padding:10px 12px}
  </style></head><body>
    <section class="sheet cover">
      <header class="top">${brand}<div class="prepared">Prepared for<strong>${esc(org)}</strong></div></header>
      <div class="cover-main"><span class="eyebrow">Advantage 360</span><h1>Conversation Recap</h1><h2>${esc(org)}</h2><p>${esc(executiveSummary)}</p><div class="scheduled-strip"><div><small>${scheduled ? "Onsite assessment details" : "Onsite assessment not scheduled"}</small><strong>${esc(appointment)}</strong></div><div><small>Technology Consultant</small><strong>${esc(scheduled?.consultantName || "To confirm")}</strong></div></div></div>
      ${footer(1, preparedDate, totalPages)}
    </section>

    <section class="sheet">
      <header class="top">${brand}<div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">What we discussed</span><h1>What matters most to your ${esc(term)}.</h1><p>Your technology should support the way your team works. These priorities guide the service and recommendations we develop for you.</p></div>
      <div class="priority-grid">${priorityCards}</div>
      <div class="value-grid"><article class="value"><strong>One accountable team</strong><p>Advantage 360 is designed to give your team one place to call for support, vendor coordination, and ongoing technology ownership.</p></article><article class="value"><strong>Support around dental workflow</strong><p>Support is built around the practice-management, imaging, and connected systems your team depends on every day.</p></article><article class="value"><strong>Planning ahead</strong><p>Lifecycle and technology planning help turn future needs into a conversation instead of waiting for them to become emergencies.</p></article></div>
      <div class="callout"><strong>Confidence in your technology:</strong> ${esc(a360ValueStatement(d.priorities))}</div>
      ${learnMoreLinks}
      ${footer(2, preparedDate, totalPages)}
    </section>

    <section class="sheet">
      <header class="top">${brand}<div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">What you shared with us</span><h1>Your technology environment.</h1><p>The workstations, server, and applications your team relies on, as discussed.</p></div>
      <div class="facts"><div class="fact"><b>${d.workstations ? `About ${d.workstations}` : "To confirm"}</b><small>workstation${d.workstations === 1 ? "" : "s"}</small></div><div class="fact"><b>${Math.max(1, d.locations)}</b><small>location${Math.max(1, d.locations) === 1 ? "" : "s"}</small></div><div class="fact"><b>${esc(serverLabel(d.server))}</b><small>${esc(serverNote(d.server))}</small></div></div>
      <article class="card"><h2>Software discussed</h2><div class="tags">${softwareRows}</div></article>
      ${conversationSummary ? `<div class="discussion"><p>${esc(conversationSummary)}</p></div>` : ""}
      <div class="not-assessed"><strong>What still needs to be verified</strong>These details reflect the information you shared. Equipment condition, network configuration, and security and recovery readiness have not yet been technically assessed.</div>
      ${footer(3, preparedDate, totalPages)}
    </section>

    ${servicePages.map((rows, index) => `<section class="sheet coverage-sheet">
      <header class="top">${brand}<div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">${estimateCaptured ? "Your Advantage 360 plan" : "Pricing to confirm"}</span><h1>${index === 0 ? "Your monthly service." : "Your service coverage, continued."}</h1>${!estimateCaptured && index === 0 ? "<p>An estimate was not captured in this saved conversation.</p>" : ""}</div>
      ${index === 0 ? `<div class="price-hero"><small>Preliminary monthly estimate</small><strong>${estimateCaptured ? `${esc(range)} / month` : "Estimate not captured"}</strong></div>` : ""}
      <h2 class="coverage-heading">${estimateCaptured ? "What’s included in your monthly service" : "Proposed service coverage"}</h2>
      <table class="coverage-table"><thead><tr><th scope="col">Service</th><th scope="col">Coverage${index > 0 ? " (continued)" : ""}</th></tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${esc(row.title)}</th><td>${esc(row.detail)}</td></tr>`).join("")}</tbody></table>
      <aside class="coverage-scope"><p>${esc(coverage.scopeNote)} Separate work is reviewed with you before it begins.</p>${coverage.serverNote ? `<p>${esc(coverage.serverNote)}</p>` : ""}</aside>
      ${footer(4 + index, preparedDate, totalPages)}
    </section>`).join("")}

    <section class="sheet">
      <header class="top">${brand}<div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">Your next step</span><h1>${scheduled ? "Your onsite assessment." : "Plan your onsite assessment."}</h1><p>${esc(nextStepSummary)}</p></div>
      <div class="appointment-card"><small>Onsite Technology Assessment</small><strong>${esc(appointment)}</strong><span>${scheduled ? `with ${esc(scheduled.consultantName)}` : "A date, time, and Technology Consultant have not been confirmed."}</span></div>
      <div class="step-grid"><article class="step"><b>See the environment firsthand</b><p>See how the technology supports your ${esc(term)} day to day.</p></article><article class="step"><b>Confirm the starting picture</b><p>Walk through the workstations, server, network, and connected systems together.</p></article><article class="step"><b>Understand software and workflow</b><p>See how the practice-management, imaging, and other applications fit into the way your team works.</p></article><article class="step"><b>Shape the right plan</b><p>Use what we learn onsite to tailor the Advantage 360 service and any separate recommendations.</p></article></div>
      <div class="closing"><strong>What you can expect after the assessment</strong><p>A service proposal that explains the recommended monthly plan, what is included, and any separate onboarding or project costs, so you can make an informed decision.</p>${contactLink}</div>
      ${footer(totalPages, preparedDate, totalPages)}
    </section>
  </body></html>`;
}

export function printA360ConversationReport(record: A360ConversationRecord): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow pop-ups to open the A360 PDF report.");
  try { win.opener = null; } catch { /* Keep export usable if opener is read-only. */ }
  win.document.open();
  win.document.write(a360ConversationReportHtml(record));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 450);
}
