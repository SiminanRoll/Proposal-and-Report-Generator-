# Client Compass

A browser-based project-opportunity, technology-review, and proposal workspace for Advantage Technologies.

## What it does

### Compass home

- Presents a card-only snapshot of current client project opportunities.
- Flips each opportunity card between affected-client count and estimated project value.
- Imports a Ninja master spreadsheet, previews row and organization matching, and commits one current technical snapshot.
- Calculates live card counts, Compass Priority Scores, top drivers, and explainable internal opportunity estimates.
- Lets employees edit built-in card criteria, minimum-device thresholds, exclusions, order, and estimate behavior, or add new custom opportunity cards.
- Uses active-device and free-space safeguards for Windows 10, lifecycle, and storage qualification.
- Recalculates cards automatically when criteria or estimate settings change, with a manual catch-up control.
- Opens sortable client queues and current-state client workspaces behind the cards without adding a permanent homepage table.
- Includes a subtle homepage client search for opening any current client workspace directly.
- Adds Reviews Due and Quote Needed workflow cards while keeping workflow timing separate from technical priority scoring.
- Carries the selected managed client’s committed inventory, lifecycle, OS, storage, warranty, and physical/virtual data directly into the client-report generator.
- Carries the selected client and Compass drivers into new report and proposal workspaces.
- Keeps virtual machines visible while preventing them from creating physical-hardware replacement value.
- Keeps the homepage focused on the questions: **Where are the projects, how much value is represented, and where should the next conversation begin?**

### Report and proposal generator

- Uses the current Ninja/Client Compass inventory as the authoritative managed-client device list and accepts ScalePad lifecycle reports as optional enrichment for age, purchase, warranty, and lifecycle summaries.
- Accepts the current committed Client Compass snapshot as the managed-client inventory source, with a refresh action after newer spreadsheet imports.
- Reconciles source totals and device classes before report generation, keeps unknown-lifecycle assets visible, and blocks publishing only when an authoritative Ninja/Client Compass row is missing from report output.
- Exports an inventory-diagnostics CSV that traces every authoritative device through enrichment, normalization, and final report inclusion.
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
