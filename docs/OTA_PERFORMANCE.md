# OTA Performance

Route: `/ota-stats/`

Purpose: a public, shareable, read-only performance dashboard for OTA volume and TC activity. It is intentionally separate from the protected operational OTA Tracker.

## Public access model

`/ota-stats/` requires no login, team code, or password.

The browser does **not** receive direct anonymous access to `company_otas`. Instead it calls `public.ota_performance_public_snapshot()`, a narrow read-only Supabase RPC that returns only:

- uncleared OTA `appointment_date`;
- assigned `tc_name`.

It does not expose company names, contacts, notes, quote details, source metadata, or write access. `tracker_cleared = true` rows are excluded server-side before the public response is built.

## Client bundle isolation

The public Performance route must stay isolated from protected Tracker parsing and mutation code.

- `/ota-stats/` imports its Supabase public endpoint/key and Chicago date helper from `src/app/ota-shared.ts`.
- It must not import `src/app/ota-tracker/logic.ts` merely to obtain those primitives.
- Tracker-only parsing dependencies, including the Outlook `.msg` XLSX reader, must not become an eager dependency of the public Performance route.
- `public.ota_performance_public_snapshot()` remains the only OTA data read required by the public dashboard.

A blocking Main Check regression enforces this boundary and verifies the public primitives remain aligned with the protected Tracker configuration/date semantics.

## Metric contract

- One uncleared OTA with a valid `appointment_date` counts once.
- `appointment_date` is the reporting date for every timeframe and chart.
- `set_date` is not used by OTA Performance because historical/manual backfills can contain import-time values that do not represent when the OTA occurred.
- Quote state and presentation state do not change Performance eligibility for an uncleared row.
- TC aliases are normalized for reporting. `Matt Minicozzi` and `Matthew Minicozzi` roll up as `Matt Minicozzi`; `Chris` rolls up as `Chris Beadle`.
- Missing OTA date / TC cleanup remains in the protected Tracker **Missing info** queue rather than appearing as a Performance KPI.

## Timeframes

The public dashboard supports four interactive timeframes:

- **Week** — selected Monday-Sunday week, visualized by day.
- **Month** — selected calendar month, visualized by calendar-week buckets.
- **Quarter** — selected quarter, visualized by month.
- **Year** — selected year, visualized by month with quarter summary cards.

Changing timeframe or period recalculates the entire display: KPI totals, top TC, pace average, timeline, TC legend, summary cards, leaderboard, heatmap, detail table, period totals, and PDF export.

The period selector is generated from available OTA dates plus the current period. The TC selector remains available across the public data set.

## Screen

The screen includes:

1. Total OTAs for the selected period.
2. Top TC for the selected period.
3. Period-appropriate pace average (`Avg / day`, `Avg / week`, or `Avg / month`).
4. Stacked timeline broken down by TC.
5. Period summary cards.
6. Ranked TC leaderboard.
7. TC x selected-period heatmap.
8. Dynamic breakdown table.
9. Period totals at a glance.
10. Week / Month / Quarter / Year, period, and TC selectors.

The screen intentionally does not show prior-year comparison or backfill/data-quality KPI cards.

## Missing-info ownership

Data cleanup belongs in `/ota-tracker/`, not in the public report.

The protected Tracker **Missing info** view includes:

- every active uncleared OTA with no appointment date;
- active uncleared OTAs in the current year whose TC is blank.

Fixing those records in the Tracker changes subsequent public Performance calculations. Cleared rows never enter public Performance.

## PDF export

`Export PDF` invokes the browser print flow with a Letter landscape report.

The PDF uses the same currently selected:

- timeframe;
- period;
- TC filter;
- alias normalization;
- cleared-row exclusion.

The report remains three executive pages: selected-period summary, TC performance/heatmap, and selected-period breakdown. Users can choose `Save as PDF` in the browser print destination.
