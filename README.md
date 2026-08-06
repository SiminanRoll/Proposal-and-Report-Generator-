# Client Compass

A browser-based project-opportunity, technology-review, and proposal workspace for Advantage Technologies.

## Current release — v1.7.1 review campaigns and review-date enrichment

Client Compass uses one browser-local technical-truth layer across dashboard calculations, client workspaces, managed-client reports, RFT assessments, proposal updates, presentations, and PDFs. Homepage cards remain the big-picture opportunity view, while card queues operate as client-review campaigns focused on review coverage and relationship follow-through. The v1.7.1 patch adds a separate one-time account-review date enrichment tool without changing technical source precedence, inventory, or quote history.

### Compass home

- Presents a card-only snapshot of current client project opportunities.
- Flips each opportunity card between affected-client count and estimated project value.
- Imports a Ninja master spreadsheet, previews row and organization matching, and commits one current technical snapshot.
- Calculates live card counts, Compass Priority Scores, top drivers, and explainable internal opportunity estimates.
- Lets employees edit built-in card criteria, minimum-device thresholds, exclusions, order, and estimate behavior, or add new custom opportunity cards.
- Uses active-device and free-space safeguards for Windows 10, lifecycle, and storage qualification.
- Recalculates cards automatically when criteria or estimate settings change, with the manual catch-up control grouped inside a compact **Customize** menu.
- Opens sortable client queues and current-state client workspaces behind the cards without adding a permanent homepage table.
- Includes a subtle homepage client search with direct actions to open either the client workspace or a prefilled client report.
- Adds Reviews Due and Quote Needed workflow cards while keeping workflow timing separate from technical priority scoring.
- Opens each card as a review campaign with clickable reviewed-and-served, follow-through-needed, and review-needed segments that update client counts, affected devices, and estimated value.
- Includes a tucked-away one-time account-review date importer that smart-matches a two-column company/date list to existing clients and presents only true exceptions.
- Carries the selected managed client’s committed inventory, lifecycle, OS, storage, warranty, and physical/virtual data directly into the client-report generator.
- Adds location-specific workspace views for named sites while suppressing generic location placeholders from client-facing output.
- Packages overlapping technical findings and Review Outcome decisions into explainable projects with responsibilities, timing, quote status, devices, locations, and deduplicated value.
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
- Applies a ready-to-paste **Tailored report summary** generated from a review transcript to the meeting summary, agreed next step, report framing, and roadmap decisions before saving.
- Builds an interactive client presentation.
- Generates print-friendly, fillable client PDFs.
- Supports an optional technology-focused HIPAA readiness conversation.
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
