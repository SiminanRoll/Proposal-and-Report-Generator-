# Client Compass

A browser-based project-opportunity, technology-review, and proposal workspace for Advantage Technologies.

## What it does

### Compass home

- Presents a card-only snapshot of current client project opportunities.
- Flips each opportunity card between affected-client count and estimated project value.
- Imports a Ninja master spreadsheet, previews row and organization matching, and commits one current technical snapshot.
- Calculates live card counts, Compass Priority Scores, top drivers, and explainable internal opportunity estimates.
- Keeps virtual machines visible while preventing them from creating physical-hardware replacement value.
- Keeps the homepage focused on the questions: **Where are the projects, how much value is represented, and where should the next conversation begin?**

### Report and proposal generator

- Imports ScalePad lifecycle reports or supported device inventory spreadsheets, including site/location data and graphics details when supplied.
- Imports Huntress security reports and uses RFT assessment workbooks as the primary technical source for both proposal workflows.
- Normalizes source evidence into a shared, versioned project model.
- Builds an interactive client presentation.
- Generates print-friendly, fillable client PDFs.
- Supports an optional technology-focused HIPAA readiness conversation.
- Stores source documents and project data locally in the browser.

The existing generator is available from the **Report Generator** navigation item inside Compass.

## Privacy model

The application is statically hosted. Source documents are processed in the employee's browser and are not uploaded to an application server. Structured workspaces are stored in local browser storage; source files are cached in browser IndexedDB to support reprocessing after parser updates.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

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
src/lib/compass/          Current-state import, classification, scoring, valuation, and browser persistence
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

- ScalePad Hardware Lifecycle Report PDF, or supported CSV/XLS/XLSX device inventory export
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
- A committed Ninja import is stored in browser-local IndexedDB, replaces the previous technical snapshot, and does not create historical inventory or score records.
- Score weights, lifecycle/storage thresholds, and estimate assumptions are editable browser-local settings.
- The HIPAA module is a technology-readiness conversation, not a legal audit, certification, or formal risk analysis.
- Opportunity values are internal planning estimates and are not client quotes.
