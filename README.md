# Proposal & Report Generator — Phase 2

A Next.js/TypeScript web application for turning Advantage source material into structured, evidence-backed project intelligence.

## Product paths

1. **Current Client Report** — combine ScalePad, Huntress, and supporting reports.
2. **Assessment + A360 Proposal** — combine the RFT, optional onsite notes, photos, and pain points.
3. **Modernize Existing Proposal** — extract a current or legacy proposal into the shared project model.

## What Phase 2 adds

- Server-side source analysis through normal Next.js routes
- No Python runtime or local launcher
- RFT workbook parsing for inventory, operating systems, server aging, clinical applications, network ranges, security controls, backup indicators, and patching
- Searchable PDF text extraction and source classification for ScalePad, Huntress, and legacy proposals
- DOCX and TXT extraction for onsite notes
- Multi-photo intake with metadata retention
- Confidence scoring, source summaries, evidence, and client-language finding candidates
- A deliberately small exception queue containing only information the sources cannot reliably determine
- Browser-local persistence of structured intelligence for development
- Automatic migration of Phase 1 browser projects into the Phase 2 model

## Minimal A360 intake

Only the **RFT spreadsheet** is required to create a potential-client assessment project. TC notes may be uploaded or entered as pain points. Office photos are optional.

After analysis, the normal confirmation set is limited to items such as:

- Managed-user count
- Number of included locations
- Primary client pain point when no notes were supplied
- Current backup/recovery design when the RFT is inconclusive

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production check

```bash
npm run typecheck
npm run test
npm run build
npm start
```

## Local data behavior

Uploaded files are sent to the app's own `/api/intelligence/analyze` route, processed in memory, and converted into structured project data. The original file bytes are not retained after the request. Project intelligence is stored in browser `localStorage` during local development.

A hosted phase will move projects to PostgreSQL and original sources to private object storage with access controls and retention rules.

## Deployment

The application runs as one Node.js web service on DigitalOcean App Platform or another standard Node host. The UI and source-analysis routes are deployed together from the same codebase.
