import type { ClientReportTextOverrides } from "@/lib/review-outcomes/types";
import { sanitizeClientPdfCopy } from "./client-pdf-copy";
import { ensurePdfDeviceInventory } from "./pdf-inventory-sync";
import { prepareAgreedRoadmapHtml } from "./pdf-agreed-roadmap-sync";
import { preparePresentationFocusHtml } from "./pdf-presentation-focus-sync";
import { applyReportTextOverridesHtml, prepareReportTextOverridesHtml } from "./pdf-report-overrides";
import { prepareSecurityHealthPageHtml } from "./pdf-security-health-layout";
import { preparePdfWebsiteLinks } from "./pdf-website-links";
import { downloadFillableClientPdf as downloadCorePdf } from "./fillable-pdf-core";

export * from "./fillable-pdf-core";

/**
 * Build the exact HTML snapshot handed to the PDF capture layer. The dedicated
 * PDF editor uses this same function, so what is edited on screen is the same
 * page markup, layout, and copy that will be downloaded.
 *
 * Passing explicit overrides is reserved for the WYSIWYG editor's unsaved draft.
 * Normal downloads continue to resolve the saved overrides from the live report.
 */
export function prepareFillableClientPdfHtml(
  html: string,
  documentTitle: string,
  explicitOverrides?: ClientReportTextOverrides,
): string {
  const focusHtml = preparePresentationFocusHtml(html, documentTitle);
  const preparedHtml = prepareAgreedRoadmapHtml(focusHtml, documentTitle);
  const inventoryHtml = ensurePdfDeviceInventory(preparedHtml);
  const layoutHtml = prepareSecurityHealthPageHtml(inventoryHtml);
  const sanitizedHtml = sanitizeClientPdfCopy(layoutHtml);
  const tailoredHtml = explicitOverrides === undefined
    ? prepareReportTextOverridesHtml(sanitizedHtml, documentTitle)
    : applyReportTextOverridesHtml(sanitizedHtml, explicitOverrides);
  return preparePdfWebsiteLinks(tailoredHtml, documentTitle);
}

export async function downloadFillableClientPdf(html: string, documentTitle: string): Promise<void> {
  return downloadCorePdf(prepareFillableClientPdfHtml(html, documentTitle), documentTitle);
}
