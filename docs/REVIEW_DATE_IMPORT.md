# One-Time Account Review Date Import

Client Compass v1.7.1 includes a browser-local enrichment tool under **Customize → Import account review dates**.

## File structure

Only two columns are required:

| Company Name | Last Account Review Date |
| --- | --- |
| Tosa Dental | 2026-08-05 |

CSV and Excel formats are supported. Dates may use ISO format, common U.S. date formats, or standard Excel date cells.

## Matching behavior

The tool matches imported names only to clients already present in the committed Compass snapshot. It uses:

- Exact current organization names.
- Saved client aliases.
- Case, punctuation, spacing, and legal-suffix normalization.
- Common dental and practice naming equivalents.
- High-confidence similarity scoring.

High-confidence matches are applied in bulk. Only genuine collisions or unmatched rows appear in the compact exception grid. The importer never creates a client.

## Update protections

- Blank review dates are skipped.
- Invalid dates are reported.
- Duplicate rows are consolidated using the newest valid date.
- Older dates never overwrite newer review history.
- Quote status, quote dates, sales-interaction dates, notes, inventory, findings, and Review Outcome content are not changed.
- An obsolete **Needs Review**, **Review Needed**, or **Review Scheduled** workflow status becomes **Review Completed** when a newer review date is imported.
- Campaign health and Reviews Due calculations refresh immediately after commit.

## Template

The dialog can download a CSV containing every current Compass client name and a blank review-date column. Using that template provides deterministic matching while the smart matcher still supports independently gathered company lists.
