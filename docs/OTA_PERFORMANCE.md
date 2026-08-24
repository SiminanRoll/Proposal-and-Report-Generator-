# OTA Performance / Year Review

Route: `/ota-stats/`

Purpose: appointment-setting performance reporting. This is intentionally separate from the operational OTA Tracker queue.

## Metric contract

- One uncleared OTA counts once in the calendar period containing `company_otas.set_date`.
- `tracker_cleared = true` is a hard exclusion from OTA Performance. A cleared row contributes zero to year options, TC options, annual totals, monthly/quarterly totals, leaderboard, heatmap, backfill counts, year-over-year comparisons, and PDF output.
- `appointment_date` does not determine production credit.
- Quote state and presentation state do not rewrite production credit for an uncleared OTA.
- TC production is grouped by normalized TC name. Known short-name aliases roll up to the canonical name; `Matt Minicozzi` and `Matthew Minicozzi` roll up as `Matt Minicozzi`.
- Uncleared rows with a valid `set_date` but no TC are included as `Unassigned` and surfaced as a backfill issue.
- Uncleared rows with an appointment in the selected year but no `set_date` are excluded from production totals and surfaced in `Needs backfill`.

## Screen

The default view is the current year with all TCs selected.

The screen includes:

1. Annual KPIs: total OTAs set, top TC, average per month, year-over-year change, and backfill count.
2. Jan-Dec stacked timeline broken down by TC.
3. Quarterly total cards with quarter-over-quarter context and top TC.
4. Ranked TC leaderboard with annual share and best month.
5. TC x month activity heatmap.
6. Quarterly and monthly breakdown tables.
7. Year and TC filters.

The OTA Tracker links to this screen with a subtle `Performance` navigation control.

## Read-only access

The stats screen uses the same access model as OTA Tracker:

- signed-in full access reads `company_otas` directly, including `tracker_cleared` so the reporting engine can exclude cleared rows;
- read-only team access reuses the saved OTA team-view code and the existing `ota_tracker_shared_snapshot` RPC, which also returns `tracker_cleared`.

No separate stats data store is required.

## PDF export

`Export PDF` invokes the browser print flow with a dedicated Letter landscape print layout. The PDF uses the same cleared-row exclusion as the on-screen report.

The report is formatted as three executive pages:

1. Year summary, KPIs, annual timeline, and quarterly summary.
2. TC leaderboard and activity heatmap.
3. Quarterly detail, monthly totals, and backfill notes.

Users can choose `Save as PDF` in the browser print destination. Print CSS removes the application controls and dark dashboard chrome so the resulting report is presentation-ready.
