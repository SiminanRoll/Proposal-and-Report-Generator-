# Client Compass

Current release: **Client Compass v1.8.0**

A browser-based project-opportunity, technology-review, and proposal workspace for Advantage Technologies.

## Current release — v1.8.0 phased Client Project Coverage redesign

Phase 3 replaces the temporary opportunity board with exactly three primary Client Project Coverage cards: **Needs Client Review**, **Discussed, Decision Open**, and **Quoted, Still Open**. The cards derive from existing project packaging, qualify server work and coordinated refreshes of at least five physical workstations, exclude resolved outcomes, and keep technical symptoms as supporting evidence rather than separate project values.

The Phase 2 navigation rail remains icon-only when collapsed, expands by hover, keyboard focus, or click, closes by mouse leave, outside click, or Escape, and overlays smaller screens. Client Compass continues to use one browser-local technical-truth layer across dashboard calculations, client workspaces, managed-client reports, RFT assessments, proposal updates, presentations, and PDFs.

### Compass home

- Presents exactly three primary service-coverage cards rather than a sales pipeline.
- Shows qualifying-client count and an honestly labeled estimated project need on each card.
- Flips one card at a time to show server/workstation mix, relationship-history gaps, overdue follow-ups, quote age, and the highest-priority coverage signal.
- Qualifies server modernization, migration, consolidation, or retirement needs and coordinated refreshes of five or more physical workstations.
- Deduplicates overlapping technical findings into project packages so symptoms do not create separate dollar values.
- Excludes completed, no-action, deferred, monitoring, and client-purchased outcomes from open coverage.
- Assigns each qualifying client to Needs Client Review, Discussed Decision Open, or Quoted Still Open using current review, outcome, and quote history.
- Prioritizes critical server concerns, overdue follow-up, aging quotes, missing review history, technical urgency, and estimated value in card-specific order.
- Imports Ninja data and review/quote history through the expandable Data Tools navigation.
- Opens the existing client workspace and prefilled client report without changing the Report Generator or PDF system.
- Keeps legacy technical-card configuration available for diagnostics and the future Priority Lens card set.
- Stores the current snapshot, settings, and relationship history only in the browser.

### Report and proposal generator

- Uses the current Ninja/Client Compass inventory as the authoritative managed-client device list and accepts ScalePad lifecycle reports as optional enrichment for age, purchase, warranty, and lifecycle summaries.
- Accepts the current committed Client Compass snapshot as the managed-client inventory source, with a refresh action after newer spreadsheet imports.
- Reconciles source totals and device classes before report generation, keeps unknown-lifecycle assets visible, and blocks publishing only when an authoritative Ninja/Client Compass row is missing from report output.
- Exports an inventory-diagnostics CSV that traces every authoritative device through enrichment, normalization, and final report inclusion.
- Imports Huntress security reports and uses RFT assessment workbooks as the primary technical source for both proposal workflows.
- Normalizes source evidence into a shared, versioned project model.
- Applies a ready-to-paste **Tailored report summary** generated from a review transcript to the meeting summary, agreed next step, report framing, and roadmap decisions before saving.
- Builds an interactive client presentation.
- Generates print-friendly, fillable client PDFs.
- Supports an optional technology-focused HIPAA readiness conversation, including ongoing qualified-consultant guidance without presenting the review as a compliance determination.
- Uses a simple invitation to help plan purchases when one to four computers need replacement; consultation or onsite project-planning language begins only for larger refreshes or server work.
- Stores source documents and project data locally in the browser.

The existing generator is available from the **Report Generator** navigation item inside Compass and from the **Report** action in homepage client search results.

## Privacy model

The application is statically hosted. Source documents are processed in the employee's browser and are not uploaded to an application server. Structured workspaces are stored in local browser storage; source files are cached in browser IndexedDB to support reprocessing after parser updates.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and [docs/REVIEW_DATE_IMPORT.md](docs/REVIEW_DATE_IMPORT.md) for details.

## Requirements

- Node.js 22
- npm 10 or newer
- A modern Chromium-based browser for the most consistent PDF form behavior

## Local development

```bash
npm install
npm run dev
```

The application is available at `http://localhost:3000`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run the complete release gate with:

```bash
npm run verify
```

## Production build

```bash
npm run build
```

The static site is written to `out/`.

## Repository layout

```text
src/app/                  Compass, generator, creation, and workspace routes
src/components/           Compass cards, workspace, and presentation components
src/lib/compass/          Current-state import, shared classification, scoring, valuation, location snapshots, project packaging, and browser persistence
src/lib/hipaa/            HIPAA question model and scoring engine
src/lib/intelligence/     Browser-only source parsing and normalization
src/lib/outcomes/         Client presentation and PDF generation
src/lib/projects/         Project schema, migration, and local persistence
src/lib/proposals/        Proposal pricing and client-facing copy
public/                   Brand assets and generated PDF.js worker
schemas/                  Portable project JSON schema
.github/workflows/        Pull-request and main-branch quality gate
tests/                    Node-based regression tests
docs/                     Architecture, deployment, and product documentation
scripts/                  Reproducible build utilities
```

## Supported inputs

### Current-client technology review

- Current Ninja/Client Compass device inventory export
- Optional ScalePad Hardware Lifecycle Report PDF for lifecycle enrichment
- Huntress security report PDF
- Optional supporting notes and documents

### Advantage 360 proposal

- RFT assessment workbook as the primary technical source
- Optional onsite notes, photos, and supporting documents

### Existing proposal modernization

- RFT assessment workbook as the primary technical source
- Existing or legacy proposal document as the scope and pricing reference
- Optional supporting notes

## Important boundaries

- Compass cards show only committed current-state data; before the first import they display a no-data state rather than illustrative values.
- A committed Ninja import replaces the previous technical snapshot and does not create historical inventory or score records.
- Score weights, lifecycle/storage thresholds, card criteria, and estimate assumptions are editable browser-local settings.
- The HIPAA module is a technology-readiness conversation, not a legal audit, certification, or formal risk analysis.
- Opportunity values are internal planning estimates and are not client quotes.
