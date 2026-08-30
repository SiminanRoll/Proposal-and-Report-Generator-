# Client Compass / Legacy CLV Web Intelligence Source

Current package version: **1.2.75**

Repository: `SiminanRoll/Proposal-and-Report-Generator-`

Last CLV reconciliation: 2026-08-30, America/Chicago

## Current role

This repository is **not Client Success OS**.

It is the historical Client Compass source plus legacy/shared CLV web-intelligence capability that remains useful as:

- Client Compass presentation/report parity and provenance source;
- historical Client Compass map/territory implementation reference;
- legacy Signal Radar / Signal Intelligence implementation reference;
- legacy OTA Tracker implementation/reference during Opportunity Convergence;
- source of existing engines/models that should be audited before native CSOS rewrites.

The canonical Client Success OS repository is:

`SiminanRoll/client-success-os`

## Client Compass convergence status

The broad Client Compass feature-absorption program into CSOS is complete at the code level.

Native CSOS now covers the useful client record, Technology, Reviews, Plans/Project Coverage, reporting/TRS, internal TC brief, New Ownership, A360, proposal/modernization, client-intelligence and local recovery/configuration workflows.

### Permanent presentation/output role

Client-facing Client Compass presentation/PDF behavior remains a deliberate source-authority exception.

CSOS imports the frozen/pinned Client Compass presentation and export behavior rather than redesigning those client-facing outputs. The pinned source copy is maintained inside CSOS under `vendor/client-compass/` with provenance metadata.

Do not interpret that output-parity requirement as permission to route normal users back into this repository's standalone Client Compass UI.

## Next convergence program

The next major CLV merger is **Opportunity Convergence** in `SiminanRoll/client-success-os`.

Target native structure:

### Opportunities

**Overview → Signals → Assessments**

Signals contains:

**Feed → Intelligence**

- actionable Signal Radar behavior moves to Signals → Feed;
- Signal Intelligence/source-health analytics move to Signals → Intelligence;
- OTA Tracker workflow moves to Assessments.

The historical map capability is intended to converge with the Service Area Checker into **CSOS → Clients → Map**.

Do not add Signal Radar or OTA Tracker back as permanent new top-level CSOS product buttons.

## Runtime references during convergence

Current reference runtimes supplied for parity work include:

- OTA Tracker: `https://oyster-app-xql5x.ondigitalocean.app/ota-tracker/`
- Signal Intelligence: `https://oyster-app-xql5x.ondigitalocean.app/captains-log-dashboard/`

These URLs are runtime references. Do not infer repository identity solely from a deployment hostname.

## Historical Client Compass capability

Client Compass has included:

- **Client Project Coverage** — prioritizes clients needing review, decisions or quote follow-through;
- **Territory Map** — geographic client/territory planning;
- **Segments** — reusable planning/client-book groups;
- **Client Workspace** — inventory, lifecycle, reviews, project signals and related context;
- **Report Generator** — client-facing technology reports/presentations;
- **Data Tools** — Ninja/Compass inventory, lifecycle, review/quote/security/RFT ingestion and reconciliation;
- **A360 / proposal / outcome experiences** — source of the client-facing presentation behaviors now inherited by CSOS.

Useful behavior should be absorbed into the appropriate native CSOS workflow rather than preserving the old application structure for its own sake.

## Data and privacy

Historical Client Compass source documents are processed browser-side. Detailed technology/report source data and structured project workspaces have deliberate local/browser storage boundaries.

CSOS convergence must preserve those boundaries unless a separately approved shared-data contract changes them.

Canonical company UUID remains the identity edge for detailed client information. Do not reintroduce fuzzy matching as authority for detailed local data.

## Development

Requirements:

- Node.js 22
- npm 10+
- modern Chromium-based browser recommended

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
src/components/           Compass UI, workspaces, maps, presentations, dialogs and legacy dashboards
src/lib/compass/          Client data, scoring, territory, project and persistence logic
src/lib/segments/         Saved-segment model, filtering and map-lens logic
src/lib/intelligence/     Browser-side source parsing/normalization and intelligence support
src/lib/outcomes/         Client presentation and PDF generation
src/lib/projects/         Project schema, migration and local persistence
src/lib/proposals/        Proposal pricing and client-facing copy
public/                   Brand and static assets
schemas/                  Portable project schemas
docs/                     Architecture, deployment and product documentation
tests/                    Regression tests
scripts/                  Build and maintenance utilities
```

## Documentation discipline

Git history and `CHANGELOG.md` remain historical implementation/release references.

For current cross-product destination/status, use the CLV platform/system registries in `SiminanRoll/captains_log` and the current roadmap/migration plans in `SiminanRoll/client-success-os` rather than treating an old Client Compass README or deployment screen as the canonical CLV product map.