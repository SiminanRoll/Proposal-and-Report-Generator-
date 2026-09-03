import { sanitizeClientPdfCopy } from "./client-pdf-copy";
import { ensurePdfDeviceInventory } from "./pdf-inventory-sync";
import { prepareAgreedRoadmapHtml } from "./pdf-agreed-roadmap-sync";
import { preparePresentationFocusHtml } from "./pdf-presentation-focus-sync";
import { prepareSecurityHealthPageHtml } from "./pdf-security-health-layout";
import { preparePdfWebsiteLinks } from "./pdf-website-links";
import { downloadFillableClientPdf as downloadCorePdf } from "./fillable-pdf-core";

export * from "./fillable-pdf-core";

/**
 * Keep the generated report snapshot intact, then synchronize the live tailored
 * review focus and agreed roadmap immediately before PDF capture. Device
 * inventory is restored as a closing appendix when the portrait print template
 * does not already contain it. Page-specific PDF layout refinements are applied
 * before the final copy sanitizer removes legacy blanket health claims, then the
 * website-link pass adds contextual Advantage resources whose coordinates are
 * preserved as native PDF link annotations.
 */
export async function downloadFillableClientPdf(html: string, documentTitle: string): Promise<void> {
  const focusHtml = preparePresentationFocusHtml(html, documentTitle);
  const preparedHtml = prepareAgreedRoadmapHtml(focusHtml, documentTitle);
  const inventoryHtml = ensurePdfDeviceInventory(preparedHtml);
  const layoutHtml = prepareSecurityHealthPageHtml(inventoryHtml);
  const sanitizedHtml = sanitizeClientPdfCopy(layoutHtml);
  return downloadCorePdf(preparePdfWebsiteLinks(sanitizedHtml, documentTitle), documentTitle);
}
