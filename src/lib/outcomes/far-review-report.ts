import type { Project } from "@/lib/projects/types";
import { FAR_CATEGORY_LABEL, farPresentationItems } from "@/lib/far/far-review";

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
