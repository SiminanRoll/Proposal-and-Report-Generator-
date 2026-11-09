import type { Project } from "@/lib/projects/types";
import {
  AGREEMENT_PERIOD_LABELS, agreementCategoryLabel, agreementLineAmount,
  agreementMoney, agreementPeriodTotals, includedAgreement,
} from "./agreement-breakdown";

function e(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
function lineHtml(project: Project, from: number, to: number): string {
  const agreement = includedAgreement(project);
  if (!agreement) return "";
  return agreement.items.slice(from, to).map((item) => {
    const total = agreement.showPricing ? agreementLineAmount(item) : null;
    return '<article class="pdf-agreement-line" style="display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:12px;padding:13px 15px;border:1px solid #dae6f1;border-radius:12px;margin-top:9px;background:#fff">'
      + '<div style="min-width:0"><span style="font-size:7pt;color:#3e82ae;text-transform:uppercase;font-weight:800">' + e(agreementCategoryLabel(item.category)) + '</span>'
      + '<strong style="display:block;color:#163554;font-size:11pt;line-height:1.14;margin:3px 0 5px">' + e(item.name) + '</strong>'
      + (item.productId ? '<small style="display:block;font-size:7pt;color:#7390a6;margin-bottom:3px">SKU ' + e(item.productId) + '</small>' : "")
      + '<p style="color:#65798a;font-size:8.1pt;line-height:1.32;margin:0">' + e(item.description) + '</p></div>'
      + '<div style="text-align:right"><span style="display:block;font-size:7pt;color:#6c849a">Quantity ' + e(item.quantity) + '</span>'
      + (agreement.showPricing
        ? '<strong style="display:block;color:#143959;font-size:10pt;margin-top:9px">' + (total === null ? "Not supplied" : e(agreementMoney(total))) + '</strong>'
          + '<small style="display:block;color:#71869b;font-size:7pt;margin-top:4px">' + e(AGREEMENT_PERIOD_LABELS[item.billingPeriod]) + '</small>'
        : "") + '</div></article>';
  }).join("");
}
export function agreementBreakdownPdfPages(project: Project, footer: (label: string) => string): string {
  const agreement = includedAgreement(project);
  if (!agreement) return "";
  const chunks: Array<[number, number]> = [];
  for (let from = 0; from < agreement.items.length; from += 5) chunks.push([from, from + 5]);
  const totals = agreement.showPricing ? agreementPeriodTotals(agreement) : [];
  return chunks.map(([from, to], pageIndex) => {
    const last = pageIndex === chunks.length - 1;
    const subtitle = "Services listed for " + project.client.name + ", with covered quantities"
      + (agreement.showPricing ? " and charges supplied for this review." : ".");
    const summary = last && totals.length ? '<div class="pdf-agreement-totals" style="display:flex;flex-wrap:wrap;gap:9px;margin-top:13px">'
      + totals.map((item) => '<div style="min-width:135px;padding:9px 12px;border-radius:10px;background:#edf4fb;border:1px solid #d8e5f1">'
        + '<span style="display:block;font-size:7pt;color:#5d7792">' + e(AGREEMENT_PERIOD_LABELS[item.period]) + '</span>'
        + '<strong style="display:block;font-size:10pt;color:#173c62;margin-top:3px">'
        + (item.amount === null ? "Incomplete pricing" : e(agreementMoney(item.amount))) + '</strong></div>').join("")
      + '</div>' : "";
    const disclaimer = last ? '<div style="margin-top:13px;font-size:7.4pt;line-height:1.32;color:#687f95">'
      + (agreement.notes ? '<p style="margin:0 0 5px">' + e(agreement.notes) + '</p>' : "")
      + 'This overview is for convenience and does not amend the signed agreement. The signed agreement and current invoice govern actual entitlements and billing.</div>' : "";
    return '<section class="pdf-page pdf-agreement-page" data-pdf-page="true">'
      + '<header class="pdf-section-header"><span class="kicker">Advantage 360 · Services Agreement '
      + (chunks.length > 1 ? '· ' + (pageIndex + 1) + ' of ' + chunks.length : "") + '</span>'
      + '<h2>What your agreement includes</h2><p>' + e(subtitle) + '</p></header>'
      + lineHtml(project, from, to) + summary + disclaimer + footer("Services Agreement") + '</section>';
  }).join("");
}
