import type { A360ConversationRecord } from "@/lib/projects/types";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function serverLabel(value: string): string {
  if (value === "yes") return "Onsite server reported";
  if (value === "no") return "No onsite server reported";
  return "Server status to confirm onsite";
}

function timeZoneLabel(value: string): string {
  const labels: Record<string, string> = {
    "America/New_York": "ET",
    "America/Chicago": "CT",
    "America/Denver": "MT",
    "America/Los_Angeles": "PT",
  };
  return labels[value] || value;
}

function software(record: A360ConversationRecord): string[] {
  const d = record.discovery;
  const items = [d.managementSoftware.trim(), d.imagingSoftware.trim()];
  if (d.imagingEnvironment.trim() && d.imagingEnvironment !== "Not sure") items.push(d.imagingEnvironment.trim());
  items.push(...d.otherSoftware.split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean));
  return [...new Set(items.filter(Boolean))];
}

function assumptionLabel(value: string): string {
  return value
    .replace(/client-reported/gi, "reported")
    .replace(/server presence not yet confirmed/gi, "server status to confirm onsite");
}

function footer(page: number, preparedDate: string): string {
  return `<footer class="footer"><span>Advantage Technologies · Advantage 360</span><span>${page} / 5 · Prepared ${esc(preparedDate)}</span></footer>`;
}

export function a360ConversationReportHtml(record: A360ConversationRecord): string {
  const d = record.discovery;
  const report = record.report;
  const org = d.organizationName.trim() || d.contactName.trim() || "Your organization";
  const term = d.organizationLanguage.trim() || "organization";
  const softwareItems = software(record);
  const priorityCards = d.priorities.length
    ? d.priorities.slice(0, 5).map((priority, index) => `<article class="priority"><span>${String(index + 1).padStart(2, "0")}</span><div><small>Shared priority</small><strong>${esc(priority)}</strong></div></article>`).join("")
    : `<article class="priority"><span>01</span><div><small>Shared priority</small><strong>Technology support that fits the way your team works</strong></div></article>`;
  const softwareRows = softwareItems.length
    ? softwareItems.map((item) => `<span class="tag">${esc(item)}</span>`).join("")
    : `<span class="muted">Software details will be confirmed during the onsite assessment.</span>`;
  const range = record.estimate.low === record.estimate.high ? money(record.estimate.low) : `${money(record.estimate.low)}–${money(record.estimate.high)}`;
  const assumptions = record.estimate.assumptions.length
    ? record.estimate.assumptions.map((item) => `<li>${esc(assumptionLabel(item))}</li>`).join("")
    : `<li>Information shared during our first conversation</li>`;
  const preparedDate = new Date(record.capturedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const appointment = `${formatPlanningAppointment(record.appointment)} ${timeZoneLabel(record.appointment.timeZone)}`;
  const logo = `${location.origin}/advantage-logo-full.png`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
    @page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef3f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#10263f;font-size:10.5pt;line-height:1.48}body{counter-reset:page}.sheet{position:relative;width:8.5in;min-height:11in;margin:24px auto;background:#fff;padding:.55in .62in .5in;display:flex;flex-direction:column;break-after:page;page-break-after:always;overflow:hidden}.sheet:last-child{break-after:auto;page-break-after:auto}.top{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2px solid #38d5c4}.top img{height:32px;max-width:250px}.prepared{text-align:right;color:#60788e;font-size:8.5px;line-height:1.35}.prepared strong{display:block;color:#173651;font-size:10px;margin-top:2px}.eyebrow{font-size:8px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#138c87}.section-head{margin:34px 0 22px}.section-head h1{margin:6px 0 8px;font-size:34px;line-height:1.02;letter-spacing:-.03em;color:#0c1f35}.section-head p{margin:0;color:#5b7084;max-width:6.7in;font-size:11pt}.cover{background:linear-gradient(145deg,#061d39 0%,#092f59 55%,#095ba2 100%);color:#fff}.cover .top{border-color:rgba(110,236,222,.65)}.cover .prepared{color:#b8cce0}.cover .prepared strong{color:#fff}.cover-main{display:flex;flex:1;flex-direction:column;justify-content:center;padding:24px 0 46px}.cover .eyebrow{color:#72eadf}.cover h1{font-size:48px;line-height:.96;letter-spacing:-.045em;margin:12px 0 14px;max-width:6.3in}.cover h2{font-size:21px;margin:0 0 20px;font-weight:650;color:#d8eafb}.cover p{font-size:12pt;line-height:1.58;max-width:6.4in;color:#d8e6f3;margin:0}.scheduled-strip{margin-top:34px;border:1px solid rgba(125,233,222,.4);background:rgba(255,255,255,.08);border-radius:16px;padding:17px 19px;display:flex;justify-content:space-between;gap:20px;align-items:center}.scheduled-strip small{display:block;text-transform:uppercase;letter-spacing:.14em;font-size:7.5px;color:#7de9df;font-weight:800}.scheduled-strip strong{display:block;margin-top:3px;font-size:12px;color:#fff}.cover .footer{border-color:rgba(255,255,255,.2);color:#b7c8d8}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #dbe5ed;border-radius:16px;padding:17px 18px;background:#fff;break-inside:avoid}.card h2,.card h3{margin:0 0 7px;color:#0b3d67}.card h2{font-size:15px}.card h3{font-size:12px}.card p{margin:0;color:#4e667c}.priority-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.priority{display:flex;align-items:center;gap:12px;border:1px solid #dbe5ed;border-radius:14px;padding:14px;background:#f8fafc;min-height:74px}.priority>span{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:11px;background:#e5f0ff;color:#1473c9;font-weight:850;font-size:9px}.priority small{display:block;text-transform:uppercase;letter-spacing:.09em;color:#7b8d9f;font-size:7px;font-weight:800;margin-bottom:3px}.priority strong{display:block;font-size:11px;line-height:1.22;color:#17344f}.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:18px}.value{border-radius:15px;background:#f2f7fb;padding:16px}.value strong{display:block;font-size:12px;color:#123a5e;margin-bottom:5px}.value p{font-size:9.5px;color:#61768a;margin:0}.callout{margin-top:18px;padding:16px 18px;border-radius:14px;background:#edf9f7;border:1px solid #b7e5df;color:#355f62}.callout strong{color:#0e716c}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.fact{border:1px solid #dce6ed;border-radius:15px;padding:16px;background:#f8fafc;min-height:92px}.fact b{display:block;color:#0a6e6a;font-size:20px;line-height:1.1}.fact small{display:block;color:#697e91;margin-top:6px;font-size:8.5px}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag{padding:7px 10px;border-radius:999px;background:#edf4f8;color:#274961;font-size:9px;border:1px solid #d9e5ec}.muted{color:#718597}.discussion{padding:18px;border-radius:15px;background:#f5f8fb;border-left:4px solid #2ccfc0;color:#3e5870}.discussion p{margin:0}.not-assessed{margin-top:18px;padding:16px 18px;border-radius:14px;background:#fff8ef;border:1px solid #efd8bc;color:#725439}.not-assessed strong{display:block;color:#8b5725;margin-bottom:4px}.price-hero{margin:26px 0 18px;border-radius:20px;background:linear-gradient(135deg,#082b55,#0a67b6);padding:28px;color:#fff}.price-hero small{display:block;text-transform:uppercase;letter-spacing:.14em;font-size:8px;color:#8eece3;font-weight:800}.price-hero strong{display:block;font-size:38px;line-height:1;margin:8px 0}.price-hero p{margin:0;color:#d9e9f7;max-width:5.8in}.basis{margin-top:14px}.basis h2{font-size:13px;margin:0 0 9px;color:#123d62}.basis ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}.basis li{position:relative;padding:10px 12px 10px 34px;border-radius:11px;background:#f5f8fb;color:#465f75}.basis li:before{content:'✓';position:absolute;left:12px;top:9px;color:#0b877f;font-weight:900}.appointment-card{margin:26px 0 18px;padding:24px;border-radius:20px;background:#0b3158;color:#fff}.appointment-card small{display:block;color:#79e4da;text-transform:uppercase;letter-spacing:.14em;font-size:8px;font-weight:800}.appointment-card strong{display:block;font-size:22px;line-height:1.2;margin:7px 0}.appointment-card span{display:block;color:#d8e8f5;font-size:11px}.step-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.step{border:1px solid #dbe5ed;border-radius:14px;padding:15px;background:#f8fafc}.step b{display:block;color:#0d456f;font-size:11px;margin-bottom:4px}.step p{margin:0;color:#63788c;font-size:9.5px}.closing{margin-top:18px;padding:18px;border-radius:15px;background:linear-gradient(135deg,#ecfaf7,#eef5ff);border:1px solid #c7e3e2}.closing strong{display:block;color:#0d675f;font-size:13px;margin-bottom:5px}.closing p{margin:0;color:#42666b}.footer{margin-top:auto;padding-top:12px;border-top:1px solid #dce5ec;display:flex;justify-content:space-between;color:#748697;font-size:7.5px}@media print{html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{margin:0;width:8.5in;height:11in;min-height:11in;box-shadow:none}}
  </style></head><body>
    <section class="sheet cover">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Prepared for<strong>${esc(org)}</strong></div></header>
      <div class="cover-main"><span class="eyebrow">Advantage 360</span><h1>Conversation Recap</h1><h2>${esc(org)}</h2><p>${esc(report.executiveSummary)}</p><div class="scheduled-strip"><div><small>Next step already scheduled</small><strong>${esc(appointment)}</strong></div><div><small>Technology Consultant</small><strong>${esc(record.appointment.consultantName)}</strong></div></div></div>
      ${footer(1, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">What we discussed</span><h1>What matters most to your ${esc(term)}.</h1><p>You shared the priorities that matter most in a technology relationship. Those priorities give Advantage 360 direction before we ever make a technical recommendation.</p></div>
      <div class="priority-grid">${priorityCards}</div>
      <div class="value-grid"><article class="value"><strong>One accountable team</strong><p>Advantage 360 is designed to give your team one place to call for support, vendor coordination, and ongoing technology ownership.</p></article><article class="value"><strong>Support around dental workflow</strong><p>Support is built around the practice-management, imaging, and connected systems your team depends on every day.</p></article><article class="value"><strong>Protection and maintenance</strong><p>Managed monitoring, maintenance, and security are part of the ongoing service relationship rather than separate projects to coordinate.</p></article><article class="value"><strong>Planning ahead</strong><p>Lifecycle and technology planning help turn future needs into a conversation instead of waiting for them to become emergencies.</p></article></div>
      <div class="callout"><strong>The point of this recap:</strong> capture what matters to your team and what Advantage 360 could mean for the ${esc(term)} — not make technical claims before we have seen the environment.</div>
      ${footer(2, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">Information shared during our conversation</span><h1>A starting point for the onsite.</h1><p>These are the details discussed with us so far. They help your Technology Consultant arrive with context; they are not technical findings.</p></div>
      <div class="facts"><div class="fact"><b>${d.workstations || "—"}</b><small>reported workstations</small></div><div class="fact"><b>${Math.max(1, d.locations)}</b><small>reported location${Math.max(1, d.locations) === 1 ? "" : "s"}</small></div><div class="fact"><b>${esc(serverLabel(d.server))}</b><small>reported starting point</small></div></div>
      <article class="card"><h2>Software discussed</h2><div class="tags">${softwareRows}</div></article>
      <div class="discussion"><p>${esc(report.conversationSummary)}</p></div>
      <div class="not-assessed"><strong>This is not a technical assessment.</strong>Advantage has not yet analyzed the network, confirmed equipment condition, tested backups, validated security, or determined project scope. The scheduled onsite assessment is where that technical picture begins.</div>
      ${footer(3, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">Pricing discussed</span><h1>Preliminary Advantage 360 pricing.</h1><p>This is the monthly estimate discussed during the conversation, based on the starting information provided so far.</p></div>
      <div class="price-hero"><small>Preliminary monthly estimate</small><strong>${esc(range)} / month</strong><p>This is an early Advantage 360 service estimate, not a price for recommended project work. The onsite assessment may change the final service scope or pricing if the environment differs from what was discussed.</p></div>
      <div class="basis"><h2>What the estimate is based on</h2><ul>${assumptions}</ul></div>
      <div class="callout"><strong>No project work has been prescribed in this recap.</strong> Equipment, migrations, backup changes, or other one-time work would only be discussed after the onsite assessment provides the information needed to scope them accurately.</div>
      ${footer(4, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">Your next step</span><h1>Your onsite assessment is scheduled.</h1><p>${esc(report.nextStepSummary)}</p></div>
      <div class="appointment-card"><small>Onsite Technology Assessment</small><strong>${esc(appointment)}</strong><span>with ${esc(record.appointment.consultantName)}</span></div>
      <div class="step-grid"><article class="step"><b>See the environment firsthand</b><p>Get a clear look at the technology supporting the ${esc(term)} instead of relying only on conversation notes.</p></article><article class="step"><b>Confirm the starting information</b><p>Check the workstation, server, network, and connected-system details discussed so far.</p></article><article class="step"><b>Understand software and workflow</b><p>See how the practice-management, imaging, and other applications fit into day-to-day operations.</p></article><article class="step"><b>Build the right scope afterward</b><p>Use verified onsite information to shape any final service recommendations, projects, or next actions.</p></article></div>
      <div class="closing"><strong>The next step is already on the calendar.</strong><p>This recap is simply a summary of the conversation, the preliminary Advantage 360 pricing discussed, and the priorities your team wants us to keep in mind when we arrive onsite.</p></div>
      ${footer(5, preparedDate)}
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
