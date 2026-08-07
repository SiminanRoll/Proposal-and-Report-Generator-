# Client Compass v1.8.0 — Phase 2 Checkpoint

## Scope

Phase 2 adds the approved expandable left-side navigation rail while preserving the existing homepage card board and all established client, import, report, proposal, and PDF workflows.

## Implemented

- Added a fixed, narrow icon-only navigation rail that expands on hover, keyboard focus, or click.
- Added collapse behavior for outside click and Escape, plus pointer-leave behavior when the rail is not pinned or keyboard-focused.
- Added a smaller-screen backdrop so the expanded rail behaves as an overlay and does not permanently displace the application layout.
- Added primary destinations for:
  - Compass
  - Find a client
  - Report Generator
  - Data Tools
  - Settings
- Wired Data Tools to existing workflows:
  - Update Ninja data
  - Import review and quote dates
  - Refresh calculations
  - Existing browser-local data tools
- Wired Settings to existing workflows:
  - Estimate assumptions
  - Project qualification thresholds
  - Existing technical-card configuration
  - Existing dashboard/card preferences
- Added hash-based shell actions so rail commands work from Report Generator and other routes, then return to Compass and open the requested existing workflow.
- Added store hydration readiness so navigation actions do not race browser-local IndexedDB startup.
- Added focused scrolling to the existing estimate and threshold sections rather than creating replacement settings dialogs.
- Added keyboard focus treatment, reduced-motion handling, responsive sizing, and mobile overlay behavior.
- Removed the redundant topbar navigation links now represented in the rail.
- Updated the application version to 1.8.0.

## Preserved

No redesign of the homepage cards was performed in this checkpoint. The following remain intact:

- Ninja spreadsheet import
- Review-date and quote-date import
- Newest-date-wins and blank-date protections
- Existing homepage cards and card-flip behavior
- Client search and client workspace
- Current relationship history and review outcomes
- Report Generator
- PDF generation, filenames, and layouts
- Browser-local storage architecture

## Main files

### Added

- `src/components/compass-navigation-rail.tsx`
- `src/lib/compass/shell-actions.ts`
- `tests/v180-navigation-rail.test.mjs`

### Updated

- `src/components/app-shell.tsx`
- `src/components/compass-home.tsx`
- `src/components/compass-settings-dialog.tsx`
- `src/lib/compass/store.ts`
- `src/app/globals.css`
- `src/lib/app-version.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- Existing version and shell validation tests

## Validation

- Lint: **passed** — 127 source and validation files
- Tests: **passed** — 285 total, 280 passed, 0 failed, 5 skipped
- Skipped tests: spreadsheet runtime tests that require dependencies unavailable in this checkout
- Typecheck: **not completed** because dependency installation failed before React, Next.js, and related declarations could be installed
- Production build: **not completed** because the PDF worker dependency was unavailable after the failed install
- Clean ZIP extraction: lint and tests rerun from the packaged checkpoint

## Dependency limitation

`npm ci --ignore-scripts` was attempted without changing the lockfile. The configured package mirror returned HTTP 404 for the locked `xmlbuilder@10.1.1` archive. Because installation could not finish, TypeScript reported missing package declarations and the production build could not copy the `pdfjs-dist` worker. These are environment/dependency availability blockers; lint and the complete dependency-independent test suite passed.
