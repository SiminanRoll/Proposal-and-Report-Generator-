# Proposal & Report Generator — Phase 3.1 Combined Reports

A privacy-first Next.js/TypeScript application that turns Advantage source material into a polished interactive client report or proposal entirely inside the employee's browser.

## Product paths

1. **Current Client Report** — combine ScalePad, Huntress, and supporting reports into one technology review.
2. **Assessment + A360 Proposal** — combine the RFT, optional onsite notes, photos, and pain points into an Advantage 360 proposal story.
3. **Modernize Existing Proposal** — extract a current or legacy proposal and rebuild it in the shared presentation format.

## Privacy boundary

- DigitalOcean hosts only static HTML, CSS, JavaScript, logos, and templates.
- RFT spreadsheets, PDFs, DOCX notes, text files, and photos are read locally in the browser.
- Source-file bytes are never sent to DigitalOcean or an application API.
- Structured project intelligence is stored in localStorage; source files are cached privately in IndexedDB on this device.
- Dashboard backup and restore covers structured project records. Source-document bytes remain on the originating device.

## Phase 3.1 combined client reports

- One-click generation after the small confirmation queue is complete
- Automatic executive summary built from evidence and client context
- Client-friendly findings grouped as priority, attention, and healthy
- Recommended plan generated from security, network, lifecycle, recovery, operations, and planning needs
- Full-screen presentation mode with Overview, What We Found, and Recommended Plan
- Keyboard navigation in presentation mode
- Self-contained interactive HTML download for local sharing and printing
- Quick title and executive-summary corrections without a complicated document editor
- Technical evidence and files collapsed behind Source Intelligence
- Replacing a source clears the old outcome so it can be regenerated from current information
- Dedicated ScalePad adapter for lifecycle totals, environment counts, warranty/OS status, and named device inventory
- Dedicated Huntress adapter for events, signals, incidents, ransomware canaries, managed antivirus, autoruns, and process monitoring
- Combined Technology Health, Security Protection, Recommended Plan, and Device Detail presentation views
- Real source values carried into the self-contained report export

Pricing, catalog mapping, signature, and internal SKU handoff remain later phases. Phase 3 intentionally does not invent prices or service quantities.

## Run locally

Requirements: Node.js 22.

```bash
npm install
npm run dev
```

## Validate and create the static site

```bash
npm run check
```

The deployable site is generated in `out/`.

## DigitalOcean App Platform

Use a **Static Site** component:

- Build command: `npm run build`
- Output directory: `out`
- HTTP route: `/`
- No Dockerfile
- No run command
- No HTTP port
- No database or object storage

The repository intentionally has no `package-lock.json` in this package. If GitHub still contains a lockfile from an older phase, delete it before deployment or regenerate it locally with `npm install` and commit the synchronized file.
