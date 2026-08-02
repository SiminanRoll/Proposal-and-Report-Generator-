# Proposal & Report Generator — Phase 2 Static

A privacy-first Next.js/TypeScript application that turns Advantage source material into structured, evidence-backed project intelligence entirely inside the employee's browser.

## Product paths

1. **Current Client Report** — combine ScalePad, Huntress, and supporting reports.
2. **Assessment + A360 Proposal** — combine the RFT, optional onsite notes, photos, and pain points.
3. **Modernize Existing Proposal** — extract a current or legacy proposal into the shared project model.

## Privacy boundary

- DigitalOcean hosts only static HTML, CSS, JavaScript, logos, and templates.
- RFT spreadsheets, PDFs, DOCX notes, text files, and photos are read locally in the browser.
- Source-file bytes are never sent to DigitalOcean or an application API.
- Structured project intelligence is stored in this browser's local storage, while original source files are cached privately in IndexedDB on this device.
- The dashboard includes JSON backup and restore for structured project records. Source-document bytes are intentionally excluded from backups and remain on the originating device.
- Deleting a project removes its locally cached source files. Clearing browser site data also removes projects and cached sources.

## Phase 2 source intelligence

- RFT workbook parsing for inventory, operating systems, server aging, clinical applications, network ranges, security controls, backup indicators, and patching
- Browser-side searchable PDF text extraction and source classification for ScalePad, Huntress, and legacy proposals
- Browser-side DOCX and TXT extraction for onsite notes
- Multi-photo intake with local metadata retention
- Confidence scoring, source summaries, evidence, and client-language finding candidates
- A deliberately small exception queue containing only information the sources cannot reliably determine
- Automatic migration of Phase 1 browser projects into the Phase 2 model

## Minimal A360 intake

Only the **RFT spreadsheet** is required to create a potential-client assessment project. TC notes may be uploaded or entered as pain points. Office photos are optional.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by Next.js.

## Validate and create the static site

```bash
npm run check
```

The deployable static site is generated in:

```text
out/
```

## DigitalOcean App Platform

Create a **Static Site** component.

- Build command: `npm run build`
- Output directory: `out`
- HTTP route: `/`
- No Dockerfile
- No run command
- No HTTP port
- No database or object storage

See `docs/DEPLOYMENT.md` for the exact setup.
