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
    return '<article class="pdf-agreement-line" style="display:grid;grid-template-columns:minmax(0,1fr) 88px;gap:9px;padding:8px 11px;border:1px solid #dae6f1;border-radius:10px;margin-top:6px;background:#fff;break-inside:avoid">'
      + '<div style="min-width:0"><span style="font-size:6.2pt;color:#3e82ae;text-transform:uppercase;font-weight:800">' + e(agreementCategoryLabel(item.category)) + '</span>'
      + '<strong style="display:block;color:#163554;font-size:9.5pt;line-height:1.13;margin:2px 0 3px">' + e(item.name) + '</strong>'
      + (item.productId ? '<small style="display:block;font-size:6pt;color:#7390a6;margin-bottom:2px">SKU ' + e(item.productId) + '</small>' : "")
      + '<p style="color:#65798a;font-size:7.2pt;line-height:1.22;margin:0">' + e(item.description) + '</p></div>'
      + '<div style="text-align:right"><span style="display:block;font-size:6.2pt;color:#6c849a">Quantity ' + e(item.quantity) + '</span>'
      + (agreement.showPricing
        ? '<strong style="display:block;color:#143959;font-size:9.2pt;margin-top:4px">' + (total === null ? "Not supplied" : e(agreementMoney(total))) + '</strong>'
          + '<small style="display:block;color:#71869b;font-size:6pt;margin-top:2px">' + e(AGREEMENT_PERIOD_LABELS[item.billingPeriod]) + '</small>'
        : "") + '</div></article>';
  }).join("");
}
/**
 * Keep ordinary A360 agreements together on one compact printed page.
 * Very long service names/descriptions or a large footer note reduce page
 * capacity instead of blindly clipping content when printed.
 */
function agreementPageChunks(items: NonNullable<Project["agreementBreakdown"]>["items"], notes: string): Array<[number, number]> {
  const chunks: Array<[number, number]> = [];
  const notesReserve = Math.max(0, Math.ceil(Math.max(0, notes.length - 160) / 110)) * 0.55;
  const pageBudget = Math.max(6, 9.8 - notesReserve);
  let from = 0;
  let units = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const extraTitleLines = Math.max(0, Math.ceil(item.name.length / 61) - 1);
    const extraDescriptionLines = Math.max(0, Math.ceil(item.description.length / 110) - 1);
    const rowUnits = 1 + extraTitleLines * 0.35 + extraDescriptionLines * 0.4;
    if (i > from && (i - from >= 9 || units + rowUnits > pageBudget)) {
      chunks.push([from, i]);
      from = i;
      units = 0;
    }
    units += rowUnits;
  }
  if (from < items.length) chunks.push([from, items.length]);
  return chunks;
}
export function agreementBreakdownPdfPages(project: Project, footer: (label: string) => string): string {
  const agreement = includedAgreement(project);
  if (!agreement) return "";
  const chunks = agreementPageChunks(agreement.items, agreement.notes ?? "");
  const totals = agreement.showPricing ? agreementPeriodTotals(agreement) : [];
  return chunks.map(([from, to], pageIndex) => {
    const last = pageIndex === chunks.length - 1;
    const subtitle = "Services listed for " + project.client.name + ", with covered quantities"
      + (agreement.showPricing ? " and charges supplied for this review." : ".");
    const summary = last && totals.length ? '<div class="pdf-agreement-totals" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">'
      + totals.map((item) => '<div style="min-width:128px;padding:7px 10px;border-radius:10px;background:#edf4fb;border:1px solid #d8e5f1">'
        + '<span style="display:block;font-size:7pt;color:#5d7792">' + e(AGREEMENT_PERIOD_LABELS[item.period]) + '</span>'
        + '<strong style="display:block;font-size:10pt;color:#173c62;margin-top:3px">'
        + (item.amount === null ? "Incomplete pricing" : e(agreementMoney(item.amount))) + '</strong></div>').join("")
      + '</div>' : "";
    const disclaimer = last ? '<div style="margin-top:9px;font-size:7pt;line-height:1.26;color:#687f95">'
      + (agreement.notes ? '<p style="margin:0 0 5px">' + e(agreement.notes) + '</p>' : "")
      + 'This overview is for convenience and does not amend the signed agreement. The signed agreement and current invoice govern actual entitlements and billing.</div>' : "";
    return '<section class="pdf-page pdf-agreement-page" data-pdf-page="true">'
      + '<header class="pdf-section-header"><span class="kicker">Advantage 360 · Services Agreement '
      + (chunks.length > 1 ? '· ' + (pageIndex + 1) + ' of ' + chunks.length : "") + '</span>'
      + '<h2>What your agreement includes</h2><p>' + e(subtitle) + '</p></header>'
      + lineHtml(project, from, to) + summary + disclaimer + footer("Services Agreement") + '</section>';
  }).join("");
}
