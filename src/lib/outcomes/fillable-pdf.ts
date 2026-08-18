import { sanitizeClientPdfCopy } from "./client-pdf-copy";
import { ensurePdfDeviceInventory } from "./pdf-inventory-sync";
import { prepareAgreedRoadmapHtml } from "./pdf-agreed-roadmap-sync";
import { downloadFillableClientPdf as downloadCorePdf } from "./fillable-pdf-core";

export * from "./fillable-pdf-core";

/**
 * Keep the generated report snapshot intact, then replace only the client-facing
 * agreed-roadmap markup with the current Tailor Report decisions immediately
 * before the existing PDF renderer captures the pages. The PDF inventory sync
 * restores the named device list from the report view when the portrait print
 * template does not already contain it. The final copy sanitizer also removes
 * legacy blanket health claims from both new and already-prepared report
 * snapshots before any PDF page is rendered.
 */
export async function downloadFillableClientPdf(html: string, documentTitle: string): Promise<void> {
  const preparedHtml = prepareAgreedRoadmapHtml(html, documentTitle);
  const inventoryHtml = ensurePdfDeviceInventory(preparedHtml);
  return downloadCorePdf(sanitizeClientPdfCopy(inventoryHtml), documentTitle);
}
