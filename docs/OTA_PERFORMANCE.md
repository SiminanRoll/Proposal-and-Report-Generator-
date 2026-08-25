# OTA Performance / Year Review

Route: `/ota-stats/`

Purpose: year-review reporting for OTA volume and TC activity. This is intentionally separate from the operational OTA Tracker queue.

## Metric contract

- One **uncleared** OTA counts once in the calendar period containing `company_otas.appointment_date`.
- `appointment_date` is the reporting date for year, month, quarter, TC totals, leaderboard, heatmap, YoY, and PDF output.
- `set_date` is not used by OTA Performance. Historical/manual rows may have import-time or recovery-era `set_date` values that do not represent the OTA month.
- `tracker_cleared = true` is a hard exclusion from OTA Performance. A cleared row contributes zero to year options, TC options, annual totals, monthly/quarterly totals, leaderboard, heatmap, backfill counts, year-over-year comparisons, and PDF output.
- Quote state and presentation state do not change OTA Performance eligibility for an uncleared row.
- TC reporting is grouped by normalized TC name. Known short-name aliases roll up to the canonical name; `Matt Minicozzi` and `Matthew Minicozzi` roll up as `Matt Minicozzi`.
- Uncleared rows with a valid OTA date but no TC are included as `Unassigned` and surfaced as a backfill issue.
- Uncleared rows without an OTA date do not enter year/month/quarter totals and are surfaced as needing an OTA-date backfill.

## Screen

The default view is the current year with all TCs selected.

The screen includes:

1. Annual KPIs: total OTAs, top TC, average per month, year-over-year change, and backfill count.
2. Jan-Dec stacked timeline broken down by TC.
3. Quarterly total cards with quarter-over-quarter context and top TC.
4. Ranked TC leaderboard with annual share and best month.
5. TC x month activity heatmap.
6. Quarterly and monthly breakdown tables.
7. Year and TC filters.

All month/quarter placement comes from the OTA appointment date.

## Read-only access

The stats screen uses the same access model as OTA Tracker:

- signed-in full access reads `company_otas` directly, including `appointment_date`, `tc_name`, and `tracker_cleared`;
- read-only team access reuses the saved OTA team-view code and the existing `ota_tracker_shared_snapshot` RPC, which returns the same fields required by reporting.

No separate stats data store is required.

## PDF export

`Export PDF` invokes the browser print flow with a dedicated Letter landscape print layout. The PDF uses the same OTA-date grouping and cleared-row exclusion as the on-screen report.

The report is formatted as three executive pages:

1. Year summary, KPIs, annual timeline, and quarterly summary.
2. TC leaderboard and activity heatmap.
3. Quarterly detail, monthly totals, and backfill notes.

Users can choose `Save as PDF` in the browser print destination.
