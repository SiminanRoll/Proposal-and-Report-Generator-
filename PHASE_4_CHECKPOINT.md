# Client Compass v1.8.0 — Phase 4 Checkpoint

## Scope

Phase 4 replaces the temporary coverage-client drawer with the approved prioritized inline client list beneath the three primary coverage cards. The existing coverage engine, expandable navigation shell, client workspace, imports, Report Generator, presentations, and PDF system remain the source of truth and are not rebuilt.

## Implemented

- Added an inline client list directly below the primary cards.
- Defaults the selected coverage position to **Needs Client Review**.
- Keeps selecting a coverage card distinct from flipping it for supporting metrics.
- Added a visible selected-card treatment and separate **Show clients** / **Flip for details** controls.
- Shows the five highest-priority matching clients initially.
- Added **View all** and **Show highest-priority clients** controls for longer lists.
- Added the approved reason filters:
  - All project needs
  - Server projects
  - 5+ workstations
  - Unsupported systems
- Added the approved list fields:
  - Client
  - Project need
  - Why they need attention
  - Last activity
  - Estimated value
  - Open client
- Preserves card-specific ordering from the coverage priority engine:
  - Critical and other server concerns before workstation refreshes for Needs Client Review
  - Past-due follow-ups and oldest reviews first for Discussed, Decision Open
  - Quotes older than twelve months and missing review history before recent quotes for Quoted, Still Open
- Added concise technical attention reasons from the deduplicated project packages.
- Added explicit unsupported-system detection from current Windows 10 and unsupported server findings for the list filter.
- Opens the existing client workspace from every row.
- Uses the existing browser data-change event and workspace save callback so review, quote, outcome, and follow-up changes immediately recalculate the cards and selected list.
- Added responsive desktop-table and smaller-screen stacked-card layouts.
- Preserved empty-filter states, keyboard focus, and reduced-motion behavior.

## Main files

### Added

- `src/components/project-coverage-client-list.tsx`
- `src/components/project-coverage-filters.tsx`
- `tests/v180-phase4-client-list.test.mjs`

### Updated

- `src/components/compass-home.tsx`
- `src/components/project-coverage-dashboard.tsx`
- `src/components/project-coverage-card.tsx`
- `src/lib/compass/project-coverage.ts`
- `src/app/globals.css`
- `tests/v180-primary-coverage-cards.test.mjs`
- `README.md`
- `CHANGELOG.md`

## Preserved boundaries

- No Report Generator changes.
- No presentation or PDF layout changes.
- No import-format or browser-storage migration.
- No change to project qualification thresholds or estimate assumptions.
- No sales-pipeline navigation or additional homepage card set.

## Validation

- Lint passed: 137 source and validation files.
- Tests passed: 293 total, 288 passed, 0 failed, 5 skipped.
- Focused TypeScript check passed for the Phase 4 coverage/list components and coverage engine using temporary external-library declarations because installed dependencies are unavailable in this checkout.
- Focused TypeScript integration check passed for `compass-home.tsx` with the Phase 4 list wiring using the same temporary declarations.
- Full project typecheck was attempted but could not complete because React, Next.js, XLSX, Mammoth, and PDF.js packages/types are not installed.
- Production build was attempted but stopped before Next.js compilation because `node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs` is unavailable. No successful production build is claimed.
- Clean ZIP extraction passed: archive integrity, lint, and all tests were rerun from a fresh extraction.

## Phase 5 boundary

Phase 5 can add the approved chevron card-set navigation with **Client Project Coverage** and **Priority Lens**, while keeping exactly three cards visible and reusing this same inline client list.
