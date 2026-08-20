import { sanitizeClientPdfCopy } from "./client-pdf-copy";
import { ensurePdfDeviceInventory } from "./pdf-inventory-sync";
import { prepareAgreedRoadmapHtml } from "./pdf-agreed-roadmap-sync";
import { preparePresentationFocusHtml } from "./pdf-presentation-focus-sync";
import { downloadFillableClientPdf as downloadCorePdf } from "./fillable-pdf-core";

export * from "./fillable-pdf-core";

/**
 * Keep the generated report snapshot intact, then synchronize the live tailored
 * review focus and agreed roadmap immediately before PDF capture. Device
 * inventory is restored as a closing appendix when the portrait print template
 * does not already contain it. The final copy sanitizer also removes legacy
 * blanket health claims from both new and already-prepared report snapshots.
 */
export async function downloadFillableClientPdf(html: string, documentTitle: string): Promise<void> {
  const focusHtml = preparePresentationFocusHtml(html, documentTitle);
  const preparedHtml = prepareAgreedRoadmapHtml(focusHtml, documentTitle);
  const inventoryHtml = ensurePdfDeviceInventory(preparedHtml);
  return downloadCorePdf(sanitizeClientPdfCopy(inventoryHtml), documentTitle);
}
