# Client Compass v1.8.0 — Phase 3 Checkpoint

## Scope

Phase 3 replaces the temporary homepage opportunity-card board with the three approved Client Project Coverage cards. The existing navigation rail, imports, browser-local store, client workspace, Report Generator, presentations, and PDF system remain intact.

## Implemented

- Added exactly three primary homepage cards:
  - Needs Client Review
  - Discussed, Decision Open
  - Quoted, Still Open
- Added a derived project-coverage engine that uses the existing project-packaging and estimate assumptions as its source of truth.
- Qualifies server modernization, migration, consolidation, and retirement needs.
- Qualifies workstation projects only when at least five physical workstations form one coordinated refresh package.
- Keeps operating-system, warranty, storage, security, and recovery findings as supporting reasons rather than standalone project qualifiers.
- Excludes completed, no-action, deferred, monitoring, and client-purchased outcomes from the open-coverage dashboard.
- Deduplicates technical findings into no more than one server project and one workstation project per client.
- Assigns each qualifying client to one current service-coverage position using documented quote history first, confirmed discussion/review history second, and uncovered need otherwise.
- Added quote-age bands for recent, follow-up, re-engagement, and older-than-twelve-month quotes.
- Added card-specific priority ordering and plain-language priority explanations.
- Added card backs with the approved supporting metrics and a temporary coverage-client drawer that opens the existing client workspace. The permanent inline client list remains Phase 4.
- Preserved the three-dimensional flip interaction while limiting the dashboard to one flipped card at a time.
- Added keyboard focus, reduced-motion, responsive, empty-state, and no-data behavior.
- Added a visible reconciliation note comparing Needs Client Review against the current 23-client reference group.

## Business rules applied

- `no-action` is treated as the existing closed/declined equivalent.
- A confirmed discussion requires either a recorded account-review date or a confirmed Review Outcome with an agreed plan.
- Ordinary sales-interaction history alone does not move a project into Discussed, Decision Open.
- `client-purchased` closes the replacement need. `advantage-install-client-purchased` remains open only when five or more physical workstations still form a coordinated deployment project.
- A client appears in only one primary coverage position to keep the three-card counts mutually understandable.

## Main files

### Added

- `src/lib/compass/project-coverage.ts`
- `src/lib/compass/project-coverage-priority.ts`
- `src/components/project-coverage-dashboard.tsx`
- `src/components/project-coverage-card.tsx`
- `src/components/project-coverage-client-queue.tsx`
- `tests/v180-primary-coverage-cards.test.mjs`

### Updated

- `src/components/compass-home.tsx`
- `src/app/globals.css`
- `tests/compass-phase1.test.mjs`
- `README.md`
- `CHANGELOG.md`

## Validation

- Lint: passed — 133 source and validation files.
- Tests: passed — 288 total, 283 passed, 0 failed, 5 skipped.
- Focused TypeScript check for the new coverage engine: passed.
- Focused TypeScript check for the new card/dashboard/queue components: passed using temporary React declarations because dependencies are unavailable in this checkout.
- Full project typecheck: not completed because React and Next.js packages/types are not installed.
- Production build: not completed because `pdfjs-dist` is unavailable and the PDF worker cannot be copied.
- Clean ZIP extraction: lint and tests rerun after packaging.

## Phase 4 boundary

Phase 4 should replace the temporary card client drawer with the approved inline prioritized client list below the cards, including reason filters, card-specific sorting, approximately five initial rows, View all, and immediate recalculation after review, quote, outcome, or follow-up changes.
