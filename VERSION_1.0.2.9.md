# Proposal & Report Generator v1.0.2.9

## Proposal workspace icon sizing repair

- Corrects the oversized sparkle artwork that could cover the proposal-pricing workspace.
- Gives every icon placed inside a section kicker an explicit 15 × 15 pixel size.
- Prevents browsers from falling back to the SVG element's large intrinsic dimensions.
- Keeps the pricing heading, monthly total, one-time total, and editable line items in their intended layout.

## Stable CloudPlusBDR client label

- Replaces imported CPBDR hostnames with the fixed client-facing name `CloudPlusBDR`.
- Applies the stable name to replacement-priority cards, lifecycle lists, hardware inventory, downloadable HTML, and PDF output.
- Preserves the original imported hostname internally for matching, deduplication, and source evidence.
- Keeps the descriptive category label as `Cloud Plus backup server`.
