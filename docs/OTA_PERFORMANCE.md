# OTA Performance / Year Review

Route: `/ota-stats/`

Purpose: year-review reporting for OTA volume and TC activity. This is intentionally separate from the operational OTA Tracker queue.

## Metric contract

- One **uncleared** OTA counts once in the calendar period containing `company_otas.appointment_date`.
- `appointment_date` is the reporting date for year, month, quarter, TC totals, leaderboard, heatmap, and PDF output.
- `set_date` is not used by OTA Performance. Historical/manual rows may have import-time or recovery-era `set_date` values that do not represent the OTA month.
- `tracker_cleared = true` is a hard exclusion from OTA Performance. A cleared row contributes zero to year options, TC options, annual totals, monthly/quarterly totals, leaderboard, heatmap, and PDF output.
- Quote state and presentation state do not change OTA Performance eligibility for an uncleared row.
- TC reporting is grouped by normalized TC name. Known short-name aliases roll up to the canonical name. `Matt Minicozzi` and `Matthew Minicozzi` roll up as `Matt Minicozzi`; `Chris` rolls up as `Chris Beadle`.
- Rows missing OTA date or assigned TC are repaired through the normal OTA Tracker **Missing info** queue rather than surfaced as a Performance KPI/report section.

## Screen

The default view is the current year with all TCs selected.

The screen includes:

1. Annual KPIs: total OTAs, top TC, and average per month.
2. Jan-Dec stacked timeline broken down by TC.
3. Quarterly total cards with quarter-over-quarter context and top TC.
4. Ranked TC leaderboard with annual share and best month.
5. TC x month activity heatmap.
6. Quarterly and monthly breakdown tables.
7. Year and TC filters.

The Performance screen intentionally does **not** show prior-year comparison or backfill/data-quality KPI cards. All month/quarter placement comes from the OTA appointment date.

## Missing-info ownership

Data cleanup belongs in `/ota-tracker/`, not in the year-review report.

The Tracker **Missing info** view includes:

- every active uncleared OTA with no appointment date, because it cannot yet be assigned to a reporting year;
- active uncleared OTAs in the current year whose TC is blank.

Fixing the date or TC in the normal Tracker immediately changes the next Performance calculation. Cleared rows never enter the cleanup queue or Performance metrics.

## Read-only access

The stats screen uses the same access model as OTA Tracker:

- signed-in full access reads `company_otas` directly, including `appointment_date`, `tc_name`, and `tracker_cleared`;
- read-only team access reuses the saved OTA team-view code and the existing `ota_tracker_shared_snapshot` RPC, which returns the same fields required by reporting.

No separate stats data store is required.

## PDF export

`Export PDF` invokes the browser print flow with a dedicated Letter landscape print layout. The PDF uses the same OTA-date grouping, TC alias normalization, and cleared-row exclusion as the on-screen report.

The report is formatted as three executive pages:

1. Year summary with the three current KPIs, annual timeline, and quarterly summary.
2. TC leaderboard and activity heatmap.
3. Quarterly detail and monthly totals.

The PDF does not include prior-year comparison or backfill/data-quality sections. Users can choose `Save as PDF` in the browser print destination.
