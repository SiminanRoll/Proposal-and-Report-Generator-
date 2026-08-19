import type { A360ConversationRecord } from "@/lib/projects/types";
import { a360ConversationReportHtml } from "@/lib/prospects/a360-report-export";

type A360ConversationRecordWithPdfOptions = A360ConversationRecord & {
  includeLifecyclePlanning?: boolean;
};

const LIFECYCLE_PLANNING_SECTION = `<article class="value"><strong>Planning ahead</strong><p>Lifecycle and technology planning help turn future needs into a conversation instead of waiting for them to become emergencies.</p></article>`;

const A360_READABLE_TYPE_STYLE = `<style>
html,body{font-family:"Trebuchet MS",Tahoma,Arial,sans-serif!important;font-weight:400;font-synthesis:none;text-rendering:geometricPrecision}
h1,h2,h3,.eyebrow,.priority strong,.value strong,.fact b,.price-hero strong,.appointment-card strong,.step b,.closing strong,.scheduled-strip strong{font-family:"Trebuchet MS",Tahoma,Arial,sans-serif!important}
strong,b{font-weight:700}
.cover p{font-size:12.5pt;line-height:1.58}
</style>`;

function applyA360PdfOptions(record: A360ConversationRecord, html: string): string {
  const includeLifecyclePlanning = (record as A360ConversationRecordWithPdfOptions).includeLifecyclePlanning === true;
  if (includeLifecyclePlanning) return html;

  return html
    .replace(LIFECYCLE_PLANNING_SECTION, "")
    .replace(".value:last-child{grid-column:1/-1}", ".value:last-child{grid-column:auto}");
}

function normalizeAppointmentTimeZoneDisplay(html: string): string {
  return html
    .replaceAll("ET ET", "ET")
    .replaceAll("CT CT", "CT")
    .replaceAll("MT MT", "MT")
    .replaceAll("MST MST", "MST")
    .replaceAll("PT PT", "PT")
    .replaceAll("AKT AKT", "AKT")
    .replaceAll("HT HT", "HT")
    .replaceAll("UTC UTC", "UTC")
    .replaceAll("MST America/Phoenix", "MST")
    .replaceAll("AKT America/Anchorage", "AKT")
    .replaceAll("HT Pacific/Honolulu", "HT")
    .replaceAll("ET America/Detroit", "ET")
    .replaceAll("ET America/Indiana/Indianapolis", "ET")
    .replaceAll("ET America/Kentucky/Louisville", "ET")
    .replaceAll("MT America/Boise", "MT");
}

export function readableA360ConversationReportHtml(record: A360ConversationRecord): string {
  const html = normalizeAppointmentTimeZoneDisplay(applyA360PdfOptions(record, a360ConversationReportHtml(record)));
  return html.replace("</head>", `${A360_READABLE_TYPE_STYLE}</head>`);
}

export function printReadableA360ConversationReport(record: A360ConversationRecord): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow pop-ups to open the A360 PDF report.");
  try { win.opener = null; } catch { /* Keep export usable if opener is read-only. */ }
  win.document.open();
  win.document.write(readableA360ConversationReportHtml(record));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 450);
}
