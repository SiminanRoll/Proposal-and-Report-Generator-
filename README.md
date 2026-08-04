# Proposal & Report Generator

A browser-based application for creating client technology reviews, Advantage 360 proposals, and modernized proposal packages from approved source documents.

## What it does

- Imports ScalePad lifecycle reports or supported device inventory spreadsheets, including site/location data and graphics details when supplied.
- Imports Huntress security reports and RFT assessment workbooks.
- Normalizes source evidence into a shared, versioned project model.
- Builds an interactive client presentation.
- Generates print-friendly, fillable client PDFs.
- Supports an optional technology-focused HIPAA readiness conversation.
- Stores source documents and project data locally in the browser.

## Privacy model

The application is statically hosted. Source documents are processed in the employee's browser and are not uploaded to an application server. Structured projects are stored in local browser storage; source files are cached in browser IndexedDB to support reprocessing after parser updates.

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
src/app/                  Next.js routes and global application styles
src/components/           Workspace and presentation components
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
  - Spreadsheet devices retain their Location/Site value and are ordered by device class, location, lifecycle priority, and age.
  - Graphics/video-adapter models are shown when the export includes them; missing graphics data is identified rather than inferred.
- Huntress security report PDF
- Optional supporting notes and documents

### Advantage 360 proposal

- RFT assessment workbook
- Optional onsite notes, photos, and supporting documents

### Existing proposal modernization

- Existing or legacy proposal documents
- Optional supporting notes

## Important boundaries

- The HIPAA module is a technology-readiness conversation, not a legal audit, certification, or formal risk analysis.
- Lifecycle recommendations are planning guidance. Server outcomes may involve replacement, migration, or safe retirement depending on the client's future application strategy.
- Imported evidence remains reviewable before client presentation.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing and release process](docs/TESTING.md)
- [Client-report adapters](docs/CLIENT_REPORT_ADAPTERS.md)
- [HIPAA readiness](docs/HIPAA_READINESS.md)
- [Product brief](docs/PRODUCT_BRIEF.md)
- [Changelog](CHANGELOG.md)
