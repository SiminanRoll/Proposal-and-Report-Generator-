import { prepareAgreedRoadmapHtml } from "./pdf-agreed-roadmap-sync";
import { downloadFillableClientPdf as downloadCorePdf } from "./fillable-pdf-core";

export * from "./fillable-pdf-core";

/**
 * Keep the generated report snapshot intact, then replace only the client-facing
 * agreed-roadmap markup with the current Tailor Report decisions immediately
 * before the existing PDF renderer captures the pages.
 */
export async function downloadFillableClientPdf(html: string, documentTitle: string): Promise<void> {
  return downloadCorePdf(prepareAgreedRoadmapHtml(html, documentTitle), documentTitle);
}
