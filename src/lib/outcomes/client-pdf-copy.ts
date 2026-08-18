export const RADAR_ATTENTION_COPY = "The items below deserve attention and should be addressed.";

const GOOD_SHAPE_CLAIM = /Most of the environment is in good shape\.\s*/gi;
const LEGACY_RADAR_COPY = /The items below deserve attention over time so they can be addressed thoughtfully and before they create unnecessary disruption\./gi;

/**
 * Final client-PDF copy boundary.
 *
 * Older prepared Technology Health Reviews can retain legacy narrative inside
 * their saved HTML snapshot. Strip the blanket "good shape" claim every time a
 * PDF is prepared, then normalize the legacy radar sentence to neutral wording
 * that stays accurate regardless of the review score or number of findings.
 */
export function sanitizeClientPdfCopy(html: string): string {
  return html
    .replace(GOOD_SHAPE_CLAIM, "")
    .replace(LEGACY_RADAR_COPY, RADAR_ATTENTION_COPY);
}
