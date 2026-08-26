# OTA Performance

Route: `/ota-stats/`

Purpose: a public, shareable, read-only performance dashboard for OTA volume and assigned-TC activity. It is intentionally separate from the protected operational OTA Tracker.

## Public access model

`/ota-stats/` requires no login, team code, or password.

The browser does **not** receive direct anonymous access to `company_otas`. Instead it calls `public.ota_performance_public_snapshot()`, a narrow read-only Supabase RPC that returns only:

- uncleared OTA `appointment_date`;
- assigned `tc_name`;
- `is_my_set`, a boolean proving whether the OTA has explicit setter provenance for the configured OTA registry owner.

It does not expose company names, contacts, notes, quote details, source metadata, `set_by`, `set_date`, `setter_user_id`, or write access. `tracker_cleared = true` rows are excluded server-side before the public response is built.

## Client bundle isolation

The public Performance route must stay isolated from protected Tracker parsing and mutation code.

- `/ota-stats/` imports its Supabase public endpoint/key and Chicago date helper from `src/app/ota-shared.ts`.
- It must not import `src/app/ota-tracker/logic.ts` merely to obtain those primitives.
- Tracker-only parsing dependencies, including the Outlook `.msg` XLSX reader, must not become an eager dependency of the public Performance route.
- `public.ota_performance_public_snapshot()` remains the only OTA data read required by the public dashboard.

A blocking Main Check regression enforces this boundary and verifies the public primitives remain aligned with the protected Tracker configuration/date semantics.

## Scope contract

OTA Performance has two explicit registry scopes:

- **My Sets** — the default. Only rows whose `setter_user_id` proves the configured registry owner set the appointment are eligible.
- **All Company** — includes every uncleared OTA with a valid `appointment_date`, including historical rows whose setter is unknown or belongs to someone else.

Historical data is conservative by design. A blank/unknown setter never becomes My Sets merely because the row belongs to the owner, was imported by the owner, has a `set_date`, or has an assigned `tc_name`. The assigned TC is a separate field and must never be used as setter provenance.

Changing scope recalculates the period selector, TC selector, KPI totals, timeline, leaderboard, heatmap, breakdown, and PDF export from the selected scope.

## Metric contract

- One eligible, uncleared OTA with a valid `appointment_date` counts once.
- `appointment_date` is the reporting date for every timeframe and chart.
- `set_date` is not used as the Performance calendar date because it means when the appointment was set, not when the onsite assessment occurred.
- `set_by` / `setter_user_id` decide My Sets eligibility only; they do not replace `appointment_date` or `tc_name`.
- `tc_name` remains the assigned-TC breakdown dimension. It is not Set By.
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

The period selector is generated from available OTA dates inside the selected scope plus the current period. The TC selector is generated from that same scoped data set.

## Screen

The screen includes:

1. My Sets / All Company scope selector.
2. Total OTAs for the selected scope and period.
3. Top assigned TC for the selected scope and period.
4. Period-appropriate pace average (`Avg / day`, `Avg / week`, or `Avg / month`).
5. Stacked timeline broken down by assigned TC.
6. Period summary cards.
7. Ranked assigned-TC leaderboard.
8. Assigned-TC x selected-period heatmap.
9. Dynamic breakdown table.
10. Period totals at a glance.
11. Week / Month / Quarter / Year, period, and assigned-TC selectors.

The screen intentionally does not show prior-year comparison or backfill/data-quality KPI cards.

## Missing-info ownership

Data cleanup belongs in `/ota-tracker/`, not in the public report.

The protected Tracker **Missing info** view includes, within the currently selected My Sets / All Company scope:

- every active uncleared OTA with no appointment date;
- active uncleared OTAs in the current year whose assigned TC is blank.

Fixing those records in the Tracker changes subsequent public Performance calculations. Cleared rows never enter public Performance.

## PDF export

`Export PDF` invokes the browser print flow with a Letter landscape report.

The PDF uses the same currently selected:

- My Sets / All Company scope;
- timeframe;
- period;
- assigned-TC filter;
- alias normalization;
- cleared-row exclusion.

The report remains three executive pages: selected-period summary, assigned-TC performance/heatmap, and selected-period breakdown. Users can choose `Save as PDF` in the browser print destination.
