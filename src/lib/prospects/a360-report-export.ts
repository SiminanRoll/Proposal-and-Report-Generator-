import type { A360ConversationRecord } from "@/lib/projects/types";
import { formatPlanningAppointment } from "@/lib/outcomes/planning-appointment";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function serverLabel(value: string): string {
  if (value === "yes") return "Server reported";
  if (value === "no") return "No onsite server reported";
  return "Server status to confirm";
}

function software(record: A360ConversationRecord): string[] {
  const d = record.discovery;
  return [d.managementSoftware, d.imagingSoftware, d.imagingEnvironment, d.otherSoftware].map((item) => item.trim()).filter(Boolean);
}

export function a360ConversationReportHtml(record: A360ConversationRecord): string {
  const d = record.discovery;
  const report = record.report;
  const org = d.organizationName.trim() || d.contactName.trim() || "Potential Client";
  const softwareItems = software(record);
  const priorityCards = d.priorities.length
    ? d.priorities.slice(0, 5).map((priority, index) => `<div class="priority"><span>${index + 1}</span><strong>${esc(priority)}</strong></div>`).join("")
    : `<div class="priority"><span>•</span><strong>Priorities discussed during our conversation</strong></div>`;
  const softwareRows = softwareItems.length ? softwareItems.map((item) => `<span class="tag">${esc(item)}</span>`).join("") : `<span class="muted">Software details will be confirmed onsite.</span>`;
  const range = record.estimate.low === record.estimate.high ? money(record.estimate.low) : `${money(record.estimate.low)}–${money(record.estimate.high)}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
    @page{size:letter;margin:.42in}*{box-sizing:border-box}body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;color:#10263f;background:#fff;font-size:10.5pt;line-height:1.45}.page{min-height:10in}.top{display:flex;justify-content:space-between;align-items:center;padding:8px 0 18px;border-bottom:2px solid #38d5c4}.brand{display:flex;align-items:center;gap:12px}.brand img{height:34px}.brand strong{letter-spacing:.18em;font-size:10px}.prepared{text-align:right;color:#5a7086;font-size:9px}.hero{padding:28px 30px;margin:22px 0 18px;border-radius:18px;background:linear-gradient(135deg,#08264b,#0b4d75);color:white}.eyebrow{font-size:8.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#77e7dc}.hero h1{font-size:25px;line-height:1.08;margin:7px 0 9px;max-width:560px}.hero p{margin:0;max-width:620px;color:#d9e8f5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #d9e4ee;border-radius:15px;padding:17px 18px;break-inside:avoid}.card h2{font-size:13px;margin:0 0 9px;color:#0a3d67}.card p{margin:0;color:#314b63}.priority-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.priority{display:flex;align-items:center;gap:9px;background:#f2f7fa;border-radius:10px;padding:9px}.priority span{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#0b6e74;color:white;font-size:9px;font-weight:800}.priority strong{font-size:9.5px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.fact{background:#f5f8fb;border-radius:10px;padding:10px}.fact b{display:block;font-size:14px;color:#0b6e74}.fact small{display:block;color:#63788b;margin-top:2px}.tags{display:flex;flex-wrap:wrap;gap:6px}.tag{padding:6px 8px;border-radius:999px;background:#edf4f8;color:#23445f;font-size:9px}.muted{color:#6d8193}.estimate{margin:14px 0;border:1px solid #a9ded8;background:#eefaf8;border-radius:15px;padding:16px 18px;display:flex;justify-content:space-between;gap:20px;align-items:center}.estimate strong{display:block;font-size:19px;color:#076b65}.estimate p{margin:2px 0 0;color:#456b70;font-size:9.5px;max-width:400px}.next{border-radius:15px;padding:18px;background:#0d3157;color:white}.next h2{margin:0 0 7px;font-size:14px}.next p{margin:0;color:#d9e7f2}.appointment{margin-top:10px;display:inline-block;padding:7px 10px;border-radius:9px;background:#164a72;font-weight:700;font-size:9.5px}.footer{display:flex;justify-content:space-between;border-top:1px solid #dce5ec;margin-top:18px;padding-top:10px;color:#6b8093;font-size:8px}.disclaimer{margin-top:9px;color:#718496;font-size:7.8px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{min-height:auto}}
  </style></head><body><main class="page">
    <header class="top"><div class="brand"><img src="${location.origin}/advantage-logo-full.png" alt="Advantage Technologies"></div><div class="prepared">Prepared for<br><strong>${esc(org)}</strong></div></header>
    <section class="hero"><span class="eyebrow">Advantage 360 · Conversation recap</span><h1>${esc(report.title)}</h1><p>${esc(report.executiveSummary)}</p></section>
    <section class="grid">
      <article class="card"><h2>What we heard</h2><div class="priority-grid">${priorityCards}</div></article>
      <article class="card"><h2>Starting picture</h2><p>${esc(report.conversationSummary)}</p><div class="facts"><div class="fact"><b>${d.workstations || "—"}</b><small>reported workstations</small></div><div class="fact"><b>${Math.max(1,d.locations)}</b><small>reported locations</small></div><div class="fact"><b>${esc(serverLabel(d.server))}</b><small>starting point</small></div></div></article>
      <article class="card"><h2>Software discussed</h2><div class="tags">${softwareRows}</div></article>
      <article class="card"><h2>Why the onsite matters</h2><p>The first conversation gives us direction. The onsite assessment is where Advantage can see the environment firsthand, validate what was discussed, understand workflow dependencies, and make sure the final recommendation is grounded in the way the ${esc(d.organizationLanguage)} actually operates.</p></article>
    </section>
    <section class="estimate"><div><span class="eyebrow" style="color:#147a75">Preliminary planning range</span><strong>${esc(range)} / month</strong></div><p>This range is based only on the information shared during the initial conversation. It is a planning estimate, not a final quote, and may change after the onsite assessment.</p></section>
    <section class="next"><h2>The next step</h2><p>${esc(report.nextStepSummary)}</p><span class="appointment">${esc(formatPlanningAppointment(record.appointment))} · ${esc(record.appointment.consultantName)}</span></section>
    <p class="disclaimer">This recap summarizes information discussed with the potential client before an onsite technical assessment. Environment details, risks, scope, and recommendations have not yet been technically verified.</p>
    <footer class="footer"><span>Advantage Technologies · Advantage 360</span><span>Prepared ${esc(new Date(record.capturedAt).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" }))}</span></footer>
  </main></body></html>`;
}

export function printA360ConversationReport(record: A360ConversationRecord): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) throw new Error("Allow pop-ups to open the A360 PDF report.");
  win.document.open();
  win.document.write(a360ConversationReportHtml(record));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 450);
}
