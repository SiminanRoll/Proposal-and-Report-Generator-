# Proposal & Report Generator — v1.0.0.6

A privacy-first Next.js/TypeScript application that turns Advantage source material into a polished interactive report or proposal package entirely inside the employee's browser.

## Product paths

1. **Current Client Report** — combine ScalePad, Huntress, and supporting reports into one technology review.
2. **Assessment + A360 Proposal** — combine the RFT, optional onsite notes, photos, and pain points into an Advantage 360 proposal story.
3. **Modernize Existing Proposal** — extract a current or legacy proposal and rebuild it in the shared presentation format.

## Privacy boundary

- The hosting provider serves only static HTML, CSS, JavaScript, logos, and templates.
- RFT spreadsheets, PDFs, DOCX notes, text files, and photos are read locally in the browser.
- Source-file bytes are never sent to the hosting provider or an application API.
- Structured workspace intelligence is stored in localStorage; source files and HIPAA evidence are cached privately in IndexedDB on this device.
- Dashboard backup and restore covers structured workspace records. Source-document bytes remain on the originating device.

## v1.0.0.6 client-report presentation

- Removed the duplicate package-generation prompt and the unnecessary creation-path helper sentence.
- Rebuilt the current-client presentation as a guided story: introduction, security, network health, hardware inventory, HIPAA live review, HIPAA readiness, planning, and final recap.
- Added infographic-style security flow, lifecycle distribution, healthy-device emphasis, HIPAA response distribution, safeguard meters, and recap scorecards.
- Improved ScalePad summary and detailed-inventory extraction, including split device names and layout-based PDF rows.
- Added a local **Reprocess cached sources** action so an existing workspace can benefit from parser improvements without uploading files again.
- Hardware details now display named rows when available and show an explicit corrective message instead of an empty area.
- Skipped or unanswered HIPAA questions remain visible, reduce displayed readiness, and are carried into the final recap.
- The subtle global cache-check label is `v1.0.0.6`.

## Phase 4 HIPAA readiness and interactive review

- **Workspace** is the universal work area for current clients and potential clients.
- **Package** is the finished report, proposal, modernization, appendix, and supporting output.
- Structured 31-question HIPAA Security Readiness model: 16 client-owned, 8 joint, and 7 Advantage-prefill.
- Technical prefills from Huntress, RFT/account evidence, and backup findings when supported by imported sources.
- Anything not completed during consultant preparation automatically becomes a live presentation question.
- Live responses: Yes, Partially, No, Not Applicable, and Skip for now.
- Skip all remaining flow with an explicit incomplete-assessment confirmation.
- Skipped controls remain Not Yet Assessed, lower the displayed readiness result, and remain available for follow-up.
- Separate confirmed-answer readiness, assessment completion, and completion-adjusted displayed score.
- Administrative, Technical, Physical, and Organizational safeguard results.
- Client confirmation, dated assessment snapshots, and optional detailed-question appendix.
- HIPAA results and required disclaimer embedded in the interactive package export.
- Existing ScalePad and Huntress adapters remain part of the combined current-client report path.
- Browser-only source processing and local evidence storage remain unchanged.

Pricing, catalog mapping, signature, and internal SKU handoff remain later phases. Phase 4 does not invent prices, service quantities, or legal compliance conclusions.

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

## Static hosting

Use a **Static Site** component:

- Build command: `npm run build`
- Output directory: `out`
- HTTP route: `/`
- No Dockerfile
- No run command
- No HTTP port
- No database or object storage

The repository intentionally has no `package-lock.json` in this package. If GitHub still contains a lockfile from an older phase, delete it before deployment or regenerate it locally with `npm install` and commit the synchronized file.
