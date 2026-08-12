# Client Compass

Current release: **v1.1.33**

Client Compass is Advantage Technologies' browser-based workspace for client technology review, project coverage, territory planning, segmentation, reporting, and proposal generation.

## Core areas

- **Client Project Coverage** — prioritizes clients that need review, have open decisions, or have open quotes.
- **Territory Map** — visualizes the service portfolio by geography, need, value, and saved segments.
- **Segments** — creates reusable client groups for planning and targeted review.
- **Client Workspace** — centralizes inventory, lifecycle, review history, project signals, and Captain's Log context.
- **Report Generator** — builds client-facing technology reports and presentations from current Compass data and supporting source files.
- **Data Tools** — imports and reconciles Ninja/Client Compass inventory, lifecycle data, review history, quote history, security reports, and RFT workbooks.

## Data and privacy

Client Compass is statically hosted. Source documents are processed in the employee's browser and are not uploaded to an application server. Structured workspaces are stored in browser storage; source files may be cached in IndexedDB to support local reprocessing.

## Development

Requirements:

- Node.js 22
- npm 10+
- Modern Chromium-based browser recommended

```bash
npm install
npm run dev
```

Quality commands remain available through the project scripts:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

## Repository layout

```text
src/app/                  Application routes and shared styling
src/components/           Compass UI, workspaces, maps, presentations, and dialogs
src/lib/compass/          Client data, scoring, territory, project, and persistence logic
src/lib/segments/         Saved-segment model, filtering, and map-lens logic
src/lib/intelligence/     Browser-side source parsing and normalization
src/lib/outcomes/         Client presentation and PDF generation
src/lib/projects/         Project schema, migration, and local persistence
src/lib/proposals/        Proposal pricing and client-facing copy
public/                   Brand and static assets
schemas/                  Portable project schemas
docs/                     Current architecture, deployment, and product documentation
tests/                    Regression tests
scripts/                  Build and maintenance utilities
```

## Documentation

Start with:

- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/TESTING.md`

Historical phase checkpoints and per-release note files are intentionally kept out of the active repository root. Git history remains the source for old implementation snapshots, while `CHANGELOG.md` is the maintained release-history document.
