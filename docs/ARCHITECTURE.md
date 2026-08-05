# Architecture

## Overview

Client Compass is a statically exported Next.js application. The Compass home route provides the internal opportunity snapshot, while the report generator remains a dedicated module. The hosting provider serves application assets only; client source documents are processed locally in the browser.

## Main layers

### Application routes and workspace

`src/app` provides the Compass card dashboard, report-generator dashboard, project creation, and project workspace routes. `src/components` contains the workspace editors, client presentation, scheduling, pricing, and HIPAA review interfaces.


### Client Compass current-state engine

`src/lib/compass` owns the Ninja master spreadsheet header mapping, explicit organization resolution, normalized client/location/device model, physical-versus-virtual classification, current findings, Compass Priority Score, opportunity valuation, configuration fingerprinting, automatic recalculation, and browser-local IndexedDB persistence for large current-state datasets.

Only one committed technical dataset is stored. A later import replaces the device and finding snapshot while preserving manually maintained client workflow fields. Card queues and client workspaces are projections of that one current snapshot; changing criteria or estimate assumptions updates the projection without creating history. Reviews Due and Quote Needed are workflow projections only and do not contribute to the technical priority score. No inventory history, score history, trends, analytics, backend, or external data transmission are introduced.

### Managed-client generator bridge

`src/lib/compass/generator-bridge.ts` translates a selected client’s current committed Compass devices and findings into the lifecycle facts used by the client-report generator. The current Ninja/Client Compass snapshot is authoritative for inventory identity, names, locations, device classes, operating systems, check-in status, and complete counts. An optional ScalePad PDF can safely enrich matching devices with age, purchase date, warranty, and aggregate lifecycle summaries without replacing authoritative inventory rows. Source totals and device classes are reconciled before publication; incomplete authoritative inventory creates a blocking review exception. The connection remains browser-local, keeps Huntress as the required current security source, and can be refreshed inside an existing report workspace after a newer import. Proposal workflows continue to use the RFT as their primary technical source.

### Source intelligence

`src/lib/intelligence` reads supported files from browser `ArrayBuffer` values and normalizes the source material into facts, evidence, candidate findings, and review exceptions.

Key adapters include:

- Ninja/Client Compass CSV/XLS/XLSX device inventory as the managed-client inventory authority
- ScalePad lifecycle PDF as optional lifecycle enrichment
- Huntress security PDF
- RFT workbook
- Searchable PDF, DOCX, TXT, and image metadata

### Shared project model

`src/lib/projects` owns the versioned project shape, defaults, migrations, local persistence, source caching, and backup/restore behavior. `schemas/project.schema.json` provides a portable schema for validation and external tooling.

### Outcome generation

`src/lib/outcomes` converts approved project facts into lifecycle summaries, security messaging, planning actions, presentation content, and downloadable PDF documents.

PDF generation occurs locally. Presentation pages are rendered into a document surface, while interactive form controls are added as PDF form fields.

### HIPAA readiness

`src/lib/hipaa` contains the technology-readiness question set, ownership boundaries, technical prefills, scoring, migration logic, and client follow-up rules.

### Proposal pricing

`src/lib/proposals` contains editable pricing defaults, line-item normalization, client-facing descriptions, and proposal validation.

## Privacy boundary

The application intentionally has:

- No API routes
- No application database
- No hosted source-file storage
- No client portal
- No analytics or outbound document-processing calls

The `privacy-boundary` and `static-deployment` regression tests protect these constraints.

## Project evolution

When the project schema changes:

1. Update TypeScript project types.
2. Update defaults and normalization.
3. Add a migration for saved workspaces.
4. Update the JSON schema.
5. Add regression tests for old and new project records.
