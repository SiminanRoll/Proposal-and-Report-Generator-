# Client Compass v1.8.0 — Phase 3.5 Checkpoint

## Scope

This focused checkpoint refines the Phase 2 shell and Phase 3 homepage spacing before the Phase 4 inline client list. It does not alter coverage qualification, ranking, estimates, relationship history, report generation, presentations, or PDFs.

## Changes

- Combined the full Advantage Technologies header brand and the expandable navigation trigger.
- Moved the brand closer to the upper-left corner and added a subtle Menu hint.
- Removed the duplicate Advantage mark previously shown at the top of the blue rail.
- Connected the collapsed/expanded blue rail directly beneath the brand header.
- Preserved hover, keyboard focus, click-to-pin, mouse-leave, outside-click, Escape, touch-overlay, and reduced-motion behavior.
- Replaced the large dark Project Coverage hero with a compact light masthead.
- Kept the title, supporting description, client search, freshness state, Update data, Customize menu, and calculation feedback.
- Reduced homepage top padding and vertical gaps so the three coverage cards begin substantially higher on the first screen.
- Added responsive behavior for desktop, laptop, tablet, and narrow mobile widths.

## Files changed

- `src/components/app-shell.tsx`
- `src/components/compass-navigation-rail.tsx`
- `src/app/globals.css`
- `tests/v180-phase35-shell-refinement.test.mjs`
- `README.md`
- `CHANGELOG.md`

## Validation

- Lint passed: 134 source and validation files.
- Tests passed: 290 total, 285 passed, 0 failed, 5 skipped.
- Full typecheck was attempted but remains unavailable because React, Next.js, XLSX, Mammoth, and PDF.js packages/types are not installed in this checkout.
- Dependency installation from the public npm registry could not be completed in the working environment.
- No production build is claimed.

## Phase 4 boundary

Phase 4 can now add the prioritized inline client list immediately below the three cards without the previous hero consuming most of the first viewport.
