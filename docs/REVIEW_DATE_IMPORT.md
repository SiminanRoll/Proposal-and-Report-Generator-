# One-Time Review and Quote Date Import

Client Compass v1.7.10 includes a browser-local enrichment tool under **Customize → Import review & quote dates**.

## File structure

`Company Name` is required. Include either date column or both:

| Company Name | Last Account Review Date | Quote Date |
| --- | --- | --- |
| Tosa Dental | 2026-08-05 | 2026-08-06 |
| Riverpoint Family Dental |  | 07/18/2026 |

CSV and Excel formats are supported. Dates may use ISO format, common U.S. date formats, or standard Excel date cells. A quote-only file containing `Company Name` and `Quote Date` is fully supported.

## Matching behavior

The tool matches imported names only to clients already present in the committed Compass snapshot. It uses:

- Exact current organization names.
- Saved client aliases.
- Case, punctuation, spacing, and legal-suffix normalization.
- Common dental and practice naming equivalents.
- High-confidence similarity scoring.

High-confidence matches are applied in bulk. Only genuine collisions or unmatched rows appear in the compact exception grid. The importer never creates a client.

## Update protections

- Rows with no populated date are skipped.
- Invalid date values are reported without blocking other valid fields in the row.
- Duplicate rows are consolidated using the newest valid date for each field independently.
- Older dates never overwrite newer review or quote history.
- Blank fields never erase existing dates.
- A newer quote date updates the quote date and marks the client as quoted.
- Sales-interaction dates, notes, inventory, findings, and Review Outcome content are not changed.
- An obsolete **Needs Review**, **Review Needed**, or **Review Scheduled** workflow status becomes **Review Completed** only when a newer review date is imported.
- Campaign health and Reviews Due calculations refresh immediately after commit.

## Template

The dialog can download a CSV containing every current Compass client name and blank review-date and quote-date columns. Using that template provides deterministic matching while the smart matcher still supports independently gathered company lists.
