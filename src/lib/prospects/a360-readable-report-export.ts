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

/** Adapt only the A360 document to the existing local portrait PDF renderer.
 * Set inherited typography on the capture page itself: the measurement iframe
 * has a styled body, while the SVG foreignObject raster wrapper does not.
 * Matching the page-root metrics keeps native link rectangles on the artwork.
 */
export function downloadableA360ConversationReportHtml(record: A360ConversationRecord): string {
  return readableA360ConversationReportHtml(record)
    .replace("</head>", `<meta name="adv-pdf-layout" content="portrait"><style>.sheet[data-pdf-capture-page]{font-family:"Trebuchet MS",Tahoma,Arial,sans-serif!important;font-size:11pt;line-height:1.5;font-weight:400;font-synthesis:none}</style></head>`)
    .replace("<body>", '<body><main class="a360-pdf-pages">')
    .replace("</body>", "</main></body>")
    // The shared renderer hides generic app chrome named top/footer. These are
    // actual A360 page contents, so keep their names separate from app chrome.
    .replaceAll('class="top"', 'class="a360-pdf-top"')
    .replaceAll('class="footer"', 'class="a360-pdf-footer"')
    .replace(/<style>([\s\S]*?)<\/style>/g, (_tag, css: string) => `<style>${css.replace(/\.top\b/g, ".a360-pdf-top").replace(/\.footer\b/g, ".a360-pdf-footer")}</style>`);
}

export async function downloadReadableA360ConversationReport(record: A360ConversationRecord): Promise<void> {
  const { downloadFillableClientPdf } = await import("@/lib/outcomes/fillable-pdf-core");
  const organization = record.discovery.organizationName.trim() || record.discovery.contactName.trim();
  await downloadFillableClientPdf(
    downloadableA360ConversationReportHtml(record),
    organization ? `Advantage 360 Conversation Recap - ${organization}` : "Advantage 360 Conversation Recap",
  );
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
