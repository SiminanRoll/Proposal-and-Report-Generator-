import type { A360ConversationRecord } from "@/lib/projects/types";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

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
    .replace(/client-reported/gi, "")
    .replace(/\breported\b/gi, "")
    .replace(/server presence not yet confirmed/gi, "server details to confirm onsite")
    .replace(/not yet technically verified/gi, "details to confirm onsite")
    .replace(/\s+/g, " ")
    .trim();
}

function clientFacingConversationSummary(record: A360ConversationRecord): string {
  const saved = record.report.conversationSummary.trim();
  const oldInternalSignals = [
    /technically assessed or verified/i,
    /final scope and recommendations/i,
    /subject to the onsite assessment/i,
    /preliminary Advantage 360 planning estimate/i,
    /believed to be aging/i,
    /project scope/i,
  ];
  if (oldInternalSignals.filter((pattern) => pattern.test(saved)).length < 2) return saved;

  const d = record.discovery;
  const priorities = d.priorities.slice(0, 4).map((item) => item.toLowerCase());
  const priorityText = priorities.length ? priorities.join(", ") : "the priorities your team shared";
  const softwareText = software(record).join(", ");
  const workstationText = d.workstations > 0 ? `about ${d.workstations} workstation${d.workstations === 1 ? "" : "s"}` : "your workstations";
  const serverText = d.server === "yes" ? "an onsite server" : d.server === "no" ? "no onsite server" : "server details we’ll confirm onsite";
  return `Our conversation focused on what you want most from your technology partner, including ${priorityText}. You also gave us a helpful starting picture of the ${d.organizationLanguage}: ${workstationText}, ${Math.max(1, d.locations)} location${Math.max(1, d.locations) === 1 ? "" : "s"}, and ${serverText}${softwareText ? `, along with ${softwareText}` : ""}. That gives your Technology Consultant a head start before the onsite visit. When we’re there, we’ll walk through the environment together, ask any follow-up questions, and keep the conversation centered on what matters most to your team.`;
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
  const conversationSummary = clientFacingConversationSummary(record);
  const priorityCards = d.priorities.length
    ? d.priorities.slice(0, 5).map((priority, index) => `<article class="priority"><span>${String(index + 1).padStart(2, "0")}</span><div><small>Shared priority</small><strong>${esc(priority)}</strong></div></article>`).join("")
    : `<article class="priority"><span>01</span><div><small>Shared priority</small><strong>Technology support that fits the way your team works</strong></div></article>`;
  const softwareRows = softwareItems.length
    ? softwareItems.map((item) => `<span class="tag">${esc(item)}</span>`).join("")
    : `<span class="muted">We can talk through your key software during the onsite visit.</span>`;
  const range = record.estimate.low === record.estimate.high ? money(record.estimate.low) : `${money(record.estimate.low)}–${money(record.estimate.high)}`;
  const assumptions = record.estimate.assumptions.length
    ? record.estimate.assumptions.map((item) => `<li>${esc(assumptionLabel(item))}</li>`).join("")
    : `<li>The starting picture we discussed together</li>`;
  const preparedDate = new Date(record.capturedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const appointment = `${formatPlanningAppointment(record.appointment)} ${timeZoneLabel(record.appointment.timeZone)}`;
  const logo = `${location.origin}/advantage-logo-full.png`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
    @page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef3f7;font-family:"Segoe UI Variable Text","Segoe UI",Arial,sans-serif;font-synthesis:none;font-weight:400;color:#10263f;font-size:11pt;line-height:1.5}body{counter-reset:page}.sheet{position:relative;width:8.5in;min-height:11in;margin:24px auto;background:#fff;padding:.55in .62in .5in;display:flex;flex-direction:column;break-after:page;page-break-after:always;overflow:hidden}.sheet:last-child{break-after:auto;page-break-after:auto}.top{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2px solid #38d5c4}.top img{height:32px;max-width:250px}.prepared{text-align:right;color:#60788e;font-size:8.5pt;line-height:1.35}.prepared strong{display:block;color:#173651;font-size:9.5pt;margin-top:2px}.eyebrow{font-size:8.5pt;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#138c87}.section-head{margin:34px 0 22px}.section-head h1{margin:6px 0 8px;font-size:34px;line-height:1.02;letter-spacing:-.03em;color:#0c1f35}.section-head p{margin:0;color:#5b7084;max-width:6.7in;font-size:11.5pt;font-weight:400}.cover{background:linear-gradient(145deg,#061d39 0%,#092f59 55%,#095ba2 100%);color:#fff}.cover .top{border-color:rgba(110,236,222,.65)}.cover .top img{filter:brightness(0) invert(1);opacity:.96}.cover .prepared{color:#b8cce0}.cover .prepared strong{color:#fff}.cover-main{display:flex;flex:1;flex-direction:column;justify-content:center;padding:24px 0 46px}.cover .eyebrow{color:#72eadf}.cover h1{font-size:48px;line-height:.96;letter-spacing:-.045em;margin:12px 0 14px;max-width:6.3in}.cover h2{font-size:21px;margin:0 0 20px;font-weight:650;color:#d8eafb}.cover p{font-size:12.25pt;line-height:1.58;max-width:6.4in;color:#d8e6f3;margin:0;font-weight:400}.scheduled-strip{margin-top:34px;border:1px solid rgba(125,233,222,.4);background:rgba(255,255,255,.08);border-radius:16px;padding:19px 20px;display:flex;justify-content:space-between;gap:20px;align-items:center}.scheduled-strip small{display:block;text-transform:uppercase;letter-spacing:.12em;font-size:8pt;color:#7de9df;font-weight:800}.scheduled-strip strong{display:block;margin-top:4px;font-size:10.5pt;color:#fff}.cover .footer{border-color:rgba(255,255,255,.2);color:#b7c8d8}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #dbe5ed;border-radius:16px;padding:19px 20px;background:#fff;break-inside:avoid}.card h2,.card h3{margin:0 0 8px;color:#0b3d67}.card h2{font-size:12pt}.card h3{font-size:10.5pt}.card p{margin:0;color:#4e667c;font-weight:400}.priority-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.priority{display:flex;align-items:center;gap:13px;border:1px solid #dbe5ed;border-radius:14px;padding:16px;background:#f8fafc;min-height:82px}.priority>span{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:11px;background:#e5f0ff;color:#1473c9;font-weight:850;font-size:8.5pt}.priority small{display:block;text-transform:uppercase;letter-spacing:.08em;color:#7b8d9f;font-size:7.5pt;font-weight:800;margin-bottom:4px}.priority strong{display:block;font-size:10.5pt;line-height:1.25;color:#17344f}.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.value{border-radius:15px;background:#f2f7fb;padding:18px 19px}.value:last-child{grid-column:1/-1}.value strong{display:block;font-size:11pt;color:#123a5e;margin-bottom:6px}.value p{font-size:9.5pt;line-height:1.48;color:#61768a;margin:0;font-weight:400}.callout{margin-top:20px;padding:18px 20px;border-radius:14px;background:#edf9f7;border:1px solid #b7e5df;color:#355f62;font-size:10.5pt;line-height:1.5;font-weight:400}.callout strong{color:#0e716c}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:20px 0}.fact{border:1px solid #dce6ed;border-radius:15px;padding:18px;background:#f8fafc;min-height:98px}.fact b{display:block;color:#0a6e6a;font-size:20px;line-height:1.1}.fact small{display:block;color:#697e91;margin-top:7px;font-size:8.5pt;line-height:1.35;font-weight:400}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag{padding:8px 11px;border-radius:999px;background:#edf4f8;color:#274961;font-size:8.5pt;border:1px solid #d9e5ec;font-weight:400}.muted{color:#718597}.discussion{padding:20px;border-radius:15px;background:#f5f8fb;border-left:4px solid #2ccfc0;color:#3e5870}.discussion p{margin:0;font-size:10.5pt;line-height:1.5;font-weight:400}.not-assessed{margin-top:18px;padding:18px 20px;border-radius:14px;background:#fff8ef;border:1px solid #efd8bc;color:#725439;font-size:10pt;line-height:1.5;font-weight:400}.not-assessed strong{display:block;color:#8b5725;margin-bottom:5px;font-size:10.5pt}.price-hero{margin:28px 0 20px;border-radius:20px;background:linear-gradient(135deg,#082b55,#0a67b6);padding:30px;color:#fff}.price-hero small{display:block;text-transform:uppercase;letter-spacing:.12em;font-size:8pt;color:#8eece3;font-weight:800}.price-hero strong{display:block;font-size:38px;line-height:1;margin:9px 0}.price-hero p{margin:0;color:#d9e9f7;max-width:5.8in;font-size:10.5pt;line-height:1.5;font-weight:400}.basis{margin-top:16px}.basis h2{font-size:11pt;margin:0 0 10px;color:#123d62}.basis ul{margin:0;padding:0;list-style:none;display:grid;gap:9px}.basis li{position:relative;padding:11px 13px 11px 36px;border-radius:11px;background:#f5f8fb;color:#465f75;font-size:10pt;line-height:1.4;font-weight:400}.basis li:before{content:'✓';position:absolute;left:13px;top:10px;color:#0b877f;font-weight:900}.appointment-card{margin:28px 0 20px;padding:26px;border-radius:20px;background:#0b3158;color:#fff}.appointment-card small{display:block;color:#79e4da;text-transform:uppercase;letter-spacing:.12em;font-size:8pt;font-weight:800}.appointment-card strong{display:block;font-size:17pt;line-height:1.2;margin:8px 0}.appointment-card span{display:block;color:#d8e8f5;font-size:9.5pt;font-weight:400}.step-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.step{border:1px solid #dbe5ed;border-radius:14px;padding:17px;background:#f8fafc}.step b{display:block;color:#0d456f;font-size:10pt;margin-bottom:5px}.step p{margin:0;color:#63788c;font-size:9.25pt;line-height:1.45;font-weight:400}.closing{margin-top:20px;padding:20px;border-radius:15px;background:linear-gradient(135deg,#ecfaf7,#eef5ff);border:1px solid #c7e3e2}.closing strong{display:block;color:#0d675f;font-size:11pt;margin-bottom:6px}.closing p{margin:0;color:#42666b;font-size:10.5pt;line-height:1.5;font-weight:400}.footer{margin-top:auto;padding-top:12px;border-top:1px solid #dce5ec;display:flex;justify-content:space-between;color:#748697;font-size:7.25pt;font-weight:400}@media print{html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{margin:0;width:8.5in;height:11in;min-height:11in;box-shadow:none}}
  </style></head><body>
    <section class="sheet cover">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Prepared for<strong>${esc(org)}</strong></div></header>
      <div class="cover-main"><span class="eyebrow">Advantage 360</span><h1>Conversation Recap</h1><h2>${esc(org)}</h2><p>${esc(report.executiveSummary)}</p><div class="scheduled-strip"><div><small>Next step already scheduled</small><strong>${esc(appointment)}</strong></div><div><small>Technology Consultant</small><strong>${esc(record.appointment.consultantName)}</strong></div></div></div>
      ${footer(1, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">What we discussed</span><h1>What matters most to your ${esc(term)}.</h1><p>You shared the priorities that matter most in a technology relationship. They help us keep Advantage 360 focused on what your team wants most from its technology partner.</p></div>
      <div class="priority-grid">${priorityCards}</div>
      <div class="value-grid"><article class="value"><strong>One accountable team</strong><p>Advantage 360 is designed to give your team one place to call for support, vendor coordination, and ongoing technology ownership.</p></article><article class="value"><strong>Support around dental workflow</strong><p>Support is built around the practice-management, imaging, and connected systems your team depends on every day.</p></article><article class="value"><strong>Planning ahead</strong><p>Lifecycle and technology planning help turn future needs into a conversation instead of waiting for them to become emergencies.</p></article></div>
      <div class="callout"><strong>A helpful head start for the visit:</strong> this recap keeps the conversation in one place so your Technology Consultant can arrive knowing what matters most to your team.</div>
      ${footer(2, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">What you shared with us</span><h1>A starting point for the onsite.</h1><p>You gave us a helpful starting picture of your ${esc(term)}. We’ll use the onsite visit to confirm the details together and see how everything fits into your day-to-day workflow.</p></div>
      <div class="facts"><div class="fact"><b>${d.workstations ? `About ${d.workstations}` : "To confirm"}</b><small>workstation${d.workstations === 1 ? "" : "s"}</small></div><div class="fact"><b>${Math.max(1, d.locations)}</b><small>location${Math.max(1, d.locations) === 1 ? "" : "s"}</small></div><div class="fact"><b>${esc(serverLabel(d.server))}</b><small>${esc(serverNote(d.server))}</small></div></div>
      <article class="card"><h2>Software discussed</h2><div class="tags">${softwareRows}</div></article>
      <div class="discussion"><p>${esc(conversationSummary)}</p></div>
      <div class="not-assessed"><strong>We’ll confirm the details together onsite.</strong>The conversation gives us a helpful starting point. During the visit, your Technology Consultant will see the environment firsthand, ask follow-up questions, and make sure the next recommendations fit the way your team actually works.</div>
      ${footer(3, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">Pricing discussed</span><h1>Preliminary Advantage 360 pricing.</h1><p>This is the monthly estimate we reviewed together, based on the starting picture you shared.</p></div>
      <div class="price-hero"><small>Preliminary monthly estimate</small><strong>${esc(range)} / month</strong><p>This is the preliminary monthly Advantage 360 estimate we discussed. The onsite visit gives us a chance to confirm the details that could affect the final monthly service.</p></div>
      <div class="basis"><h2>What we used for this estimate</h2><ul>${assumptions}</ul></div>
      <div class="callout"><strong>We’ll talk through anything outside the monthly service separately.</strong> If the onsite visit brings up equipment or one-time project needs, we’ll explain the options and pricing before anything moves forward.</div>
      ${footer(4, preparedDate)}
    </section>

    <section class="sheet">
      <header class="top"><img src="${logo}" alt="Advantage Technologies"><div class="prepared">Advantage 360<strong>${esc(org)}</strong></div></header>
      <div class="section-head"><span class="eyebrow">Your next step</span><h1>Your onsite assessment is scheduled.</h1><p>${esc(report.nextStepSummary)}</p></div>
      <div class="appointment-card"><small>Onsite Technology Assessment</small><strong>${esc(appointment)}</strong><span>with ${esc(record.appointment.consultantName)}</span></div>
      <div class="step-grid"><article class="step"><b>See the environment firsthand</b><p>See how the technology supports your ${esc(term)} day to day.</p></article><article class="step"><b>Confirm the starting picture</b><p>Walk through the workstations, server, network, and connected systems together.</p></article><article class="step"><b>Understand software and workflow</b><p>See how the practice-management, imaging, and other applications fit into the way your team works.</p></article><article class="step"><b>Shape the right plan</b><p>Use what we learn onsite to tailor the Advantage 360 service and any separate recommendations.</p></article></div>
      <div class="closing"><strong>The next step is already on the calendar.</strong><p>This recap simply keeps the conversation, preliminary Advantage 360 pricing, and your team’s priorities together before we meet onsite.</p></div>
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
