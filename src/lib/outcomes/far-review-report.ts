import type { Project } from "@/lib/projects/types";
import { FAR_CATEGORY_LABEL, farPresentationItems } from "@/lib/far/far-review";
import { FAR_PRIORITY_STATUSES, farPriorityScoreLink, farPriorityStatus, farTopPriorities, priorityActionSummary, safeFarActionText } from "@/lib/far/far-priorities";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** Never print internal FAR excerpts, source ticket data, prices, contacts or unapproved candidates. */
export function farReviewReportHtml(project: Project, pageClass = "pdf-page", footerHtml = ""): string {
  const groups = farPresentationItems(project);
  const kinds = ["service-value", "open-decision", "potential-adjustment"] as const;
  const active = kinds.filter((category) => groups[category].length);
  if (!active.length) return "";
  return '<section class="' + escapeHtml(pageClass) + ' pdf-far-review" data-pdf-page="true">' +
    '<header style="border-bottom:1px solid #c9ddea;padding:6px 0 19px">' +
      '<span style="color:#137ca6;letter-spacing:.16em;font-size:10px;font-weight:900">ACCOUNT REVIEW</span>' +
      '<h2 style="font-size:31px;margin:7px 0;color:#113856">What matters most</h2>' +
      '<p style="font-size:12px;color:#58768d;margin:0">Our recent work and the next decisions worth discussing.</p>' +
    '</header>' +
    '<div style="display:grid;gap:15px;margin-top:22px">' + active.map((kind) =>
      '<article style="border:1px solid #cfdfeb;border-radius:15px;background:#f5faff;padding:16px 18px;break-inside:avoid">' +
        '<strong style="font-size:14px;color:#115c8a">' + escapeHtml(FAR_CATEGORY_LABEL[kind]) + '</strong>' +
        '<ul style="padding-left:18px;margin:9px 0 0;color:#284c67;line-height:1.5;font-size:12px">' +
          groups[kind].map((item) => '<li style="margin:6px 0">' + escapeHtml(item.clientText) + '</li>').join("") +
        '</ul></article>'
    ).join("") + '</div>' + footerHtml + '</section>';
}

/** The sole FAR-derived client PDF page: approved decisions, not internal FAR excerpts. */
export function farPriorityActionPlanHtml(project: Project, pageClass = "pdf-page", footerHtml = ""): string {
  if (project.type !== "client-report") return "";
  const priorities = farTopPriorities(project);
  if (!priorities.length) return "";
  const cards = priorities.map((item, index) => {
    const status = farPriorityStatus(item);
    const label = status === "resolved" ? "Reported resolved" : FAR_PRIORITY_STATUSES.find((row) => row.value === status)?.label || "Needs verification";
    const owner = item.priorityOwner === "client" ? "Client" : "Advantage";
    const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(item.priorityTargetDate ?? "") ? item.priorityTargetDate : "";
    const details = priorityActionSummary(item);
    const score = farPriorityScoreLink(project, item);
    const planNote = safeFarActionText(details) || (status === "resolved" ? "Resolution needs technical confirmation." : "Follow-up to be confirmed.");
    const meta = status === "later" ? "Future review" : status === "resolved" ? "Technical verification pending" : owner + (date ? " · Target " + date : "");
    return '<article style="border:1px solid #cbdde9;border-radius:15px;padding:17px 18px;background:linear-gradient(135deg,#f8fcff,#f2f9fa);break-inside:avoid;">'
      + '<div style="display:flex;align-items:center;gap:12px"><b style="display:grid;place-items:center;flex:0 0 36px;height:36px;background:linear-gradient(125deg,#1766de,#1caaa7);color:#fff;border-radius:10px;font-size:11pt">' + String(index + 1).padStart(2, "0") + '</b>'
      + '<div style="flex:1;min-width:0"><span style="display:block;color:#23869b;font-size:7pt;font-weight:850;letter-spacing:.07em;text-transform:uppercase">' + escapeHtml(label) + '</span>'
      + '<h3 style="margin:3px 0 0;font-size:12pt;line-height:1.22;color:#123751">' + escapeHtml(item.clientText) + '</h3></div></div>'
      + '<div style="padding-left:48px;margin-top:12px;display:grid;gap:7px">'
      + '<p style="margin:0;font-size:8.3pt;color:#244c66;line-height:1.38">' + escapeHtml(planNote) + '</p>'
      + '<p style="margin:0;font-size:7pt;font-weight:800;color:#146e83">' + escapeHtml(meta) + '</p>'
      + '<p style="margin:0;font-size:7pt;color:#6c8192">' + escapeHtml(score.area) + ' · ' + escapeHtml(score.note) + '</p>'
      + '</div></article>';
  }).join("");
  return '<section class="' + escapeHtml(pageClass) + ' pdf-far-priority-page" data-pdf-page="true">'
    + '<header class="pdf-section-header"><span class="kicker">Technology planning · FAR-informed</span>'
    + '<h2>Top priorities &amp; agreed actions</h2>'
    + '<p>What we discussed, who is following up, and what comes next.</p></header>'
    + '<div style="display:grid;gap:13px;margin-top:19px">' + cards + '</div>'
    + '<aside style="margin-top:17px;border-left:3px solid #17aab0;padding:11px 13px;background:#f1f8fa;border-radius:10px;color:#647b8c;font-size:7.3pt;line-height:1.45">'
    + 'FAR history helps identify priorities. The THR score reflects current technology measurements and changes only when those facts are updated.</aside>'
    + footerHtml + '</section>';
}
