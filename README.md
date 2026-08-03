# Proposal & Report Generator — v1.0.0.8

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


## v1.0.0.8 presentation refinement

- Uses one prepared-date pill instead of separate source-report date pills.
- Widens the introduction title lane and shifts the score cluster right.
- Shortens the Network Health headline to reduce visual dominance.
- Applies a restrained glass treatment to the hardware inventory while preserving contrast.
- Stores the package preparation timestamp when the outcome is generated.

## v1.0.0.7 client-report presentation

- Removed the duplicate package-generation prompt and the unnecessary creation-path helper sentence.
- Rebuilt the current-client presentation as a guided story: introduction, security, network health, hardware inventory, HIPAA live review, HIPAA readiness, planning, and final recap.
- Added infographic-style security flow, lifecycle distribution, healthy-device emphasis, HIPAA response distribution, safeguard meters, and recap scorecards.
- Improved ScalePad summary and detailed-inventory extraction, including split device names and layout-based PDF rows.
- Added a local **Reprocess cached sources** action so an existing workspace can benefit from parser improvements without uploading files again.
- Hardware details now display named rows when available and show an explicit corrective message instead of an empty area.
- Skipped or unanswered HIPAA questions remain visible, reduce displayed readiness, and are carried into the final recap.
- The subtle global cache-check label is `v1.0.2.3`.

## Phase 4 HIPAA readiness and interactive review

- **Workspace** is the universal work area for current clients and potential clients.
- **Package** is the finished report, proposal, modernization, appendix, and supporting output.
- Condensed 12-question HIPAA Security Readiness review: 6 client questions, 4 joint questions, and 2 Advantage technical prefills.
- A response is enough to complete a readiness question. Notes, sources, files, owners, dates, and action detail are optional.
- Technical prefills use imported managed-security and backup information only when supported by the source material.
- Unanswered items automatically become short live-review questions.
- Live responses: Yes, Somewhat, No, Does not apply, Not sure, and Skip for now.
- Skipped or unanswered questions remain visible, lower the displayed readiness result, and remain available for follow-up.
- Self-contained client pre-review form: export HTML, email it, receive the small JSON response file, and import it locally.
- The client form autosaves in the client's browser and explicitly warns against including patient information.
- Separate assessed-answer readiness, completion, and completion-adjusted displayed score.
- Administrative, Technical, Physical, and Organizational safeguard results.
- Client confirmation, dated assessment snapshots, and optional detailed-question appendix.
- HIPAA results and required disclaimer embedded in the interactive package export.
- This is a readiness screening, not a formal Security Rule risk analysis, legal advice, certification, or guarantee of compliance.
- Existing ScalePad and Huntress adapters remain part of the combined current-client report path.
- Browser-only source processing and local storage remain unchanged.

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

## Version 1.0.1.5
Presentation metrics now count up on section entry, with guided score, security-flow, lifecycle, inventory, planning, recap, and HIPAA animations. Motion remains one-time and honors reduced-motion preferences.

## Version 1.0.1.6
The finished package and live presentation now include a browser-local **Download PDF** action. It opens a print-ready landscape copy and launches Save as PDF, with major sections separated cleanly and a client-facing document title used for the tab and suggested filename. Presentation mode now shows `Client Name — Technology Health Review` in the browser tab and restores the internal app title when closed.

## Version 1.0.1.9

Corrects animated metric typography across the client presentation and repairs the HIPAA readiness score layout in Planning. Animated values now inherit the intended presentation-scale number styles instead of being reduced by card-label span selectors.

## Version 1.0.2.0

HIPAA readiness is now a short 12-question workflow with optional notes and follow-up detail, plus an export/email/import client pre-review handoff. Client reports now list servers first and include warranty quantities and per-device warranty status throughout the live presentation, HTML package, and PDF.


## Version 1.0.2.2

Lifecycle status is recalculated from normalized device age for both new and previously saved projects. Duplicate rows and virtual machines misread as workstations no longer inflate physical totals. Every client-facing count now uses the same canonical server-and-workstation set, legacy warranty/OS summary panels are removed, and priority cards use dark report surfaces in the live presentation, HTML, and PDF.


## Version 1.0.2.3

Adds a professional managed-security closing statement, including 24/7 monitoring, advanced threat detection, anti-malware, anti-ransomware safeguards, advanced threat response, new-device onboarding guidance, and appropriately limited risk language. Cloud Plus BDR systems identified by CPBR naming or EQUUS hardware are now classified as backup emergency servers and included in lifecycle counts, priorities, inventory, HTML, and PDF output. Hardware next steps now adapt between remote estimates for one to four workstation-only replacements and onsite project planning for larger refreshes or any server-related replacement scope.
