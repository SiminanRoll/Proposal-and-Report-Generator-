# Client Compass v1.0.9.11

## Reports & proposals health glance
- Added a **Health** column to the recent Reports & proposals table.
- Each row shows three compact lifecycle counts: red = Replacement now, yellow = Plan soon, green = Healthy.
- Counts are generated from the same `lifecycleSummary` data used by the Technology Review, keeping the landing page aligned with the report itself.
- Workspaces with no lifecycle inventory show a neutral dash rather than `0 / 0 / 0`.

## Layout
- Rebalanced the recent-work grid to fit the Health column without making the page materially wider.
- Health counts remain visible at tablet widths and collapse on narrow mobile layouts.
