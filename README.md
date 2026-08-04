# Proposal & Report Generator — v1.0.3.1

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
- The subtle global cache-check label is `v1.0.3.1`.

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

Potential-client workspaces now include a browser-local A360 pricing proposal, editable one-time project scope, monthly recurring services, and typed client authorization. Hardware, labor, application-installation, and onboarding prices remain intentionally editable and are never invented from incomplete source material. Internal SKU handoff remains a later phase.

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


## Version 1.0.2.4

Corrects Cloud Plus BDR identification for the actual `CPBDR` device-name pattern while retaining `CPBR`, `Cloud Plus BDR`, and `EQUUS` compatibility. Inventory parsing now continues across later ScalePad pages so recovery appliances are not lost when the device table spans multiple pages. Identified systems appear as their own backup emergency-server category, contribute to physical lifecycle totals, and enter replacement planning immediately after the primary server.

Cloud Plus BDR presence now contributes proposed evidence to HIPAA question 12, Backup Protection and Recovery Verification. The presence of the emergency standby appliance supports local and cloud server-backup coverage, while backup-job health and recovery testing remain explicitly subject to confirmation. Technical HIPAA prefills refresh automatically when source intelligence is reprocessed.


## Version 1.0.2.5

Adds a resilient second-pass ScalePad parser for Cloud Plus BDR appliances whose PDF rows are split across multiple extracted lines or omitted by the normal full-row parser. `CPBDR`, `CP-BDR`, `CP BDR`, `CPBR`, Cloud Plus BDR wording, and EQUUS recovery hardware are clustered into one backup emergency-server record with available name, age, purchase, warranty, memory, and storage details. The recovered device is deduplicated against server rows and participates in lifecycle totals, replacement priorities, planning, and HIPAA backup-and-recovery evidence.

The security closing statement is also rewritten in plain client language. It explains 24/7 layered protection, alert review and response, the need to contact Advantage before connecting new or replacement computers, and the reasonable limits of any security solution.


## Version 1.0.2.6

Potential-client proposals now present Advantage Technologies, assessment findings, the recommended A360 plan, detailed one-time and monthly investment, and a client authorization close. Monthly defaults follow the supplied A360 pricing worksheet, while RFT intelligence prefills server, workstation, and replacement-scope quantities. Equipment, labor, application-installation, and onboarding prices remain editable until confirmed.

## Version 1.0.2.7

Server replacement recommendations now use short, plain-language headlines and paragraphs without exposing device hostnames outside the inventory and priority cards. Client-facing terminology is standardized as **Primary server** and **Cloud Plus backup server**. Both server roles now carry equal visual weight and the same red urgency treatment when replacement is required, while the existing remote-versus-onsite planning rules remain intact.
## Version 1.0.2.8

- Rewrites the complete potential-client proposal in direct, client-facing language.
- Uses Advantage 360 as the cover title with Prepared for [Practice Name] above it.
- Adds adaptive plain-language hardware replacement findings.
- Reframes the planning and investment pages around what the practice can expect.
- Uses client-facing pricing names in the live presentation and downloaded proposal.
- Blocks authorization until required project pricing is complete.


## Version 1.0.2.9

- Fixed oversized sparkle SVG artwork in the proposal-pricing workspace by explicitly sizing icons used in section kickers.
- Standardized the client-facing backup appliance name as **CloudPlusBDR** instead of displaying imported device hostnames.
- Applied the stable name to priority cards, lifecycle lists, hardware inventory, downloadable HTML, and PDF output while preserving the original hostname internally.


## Version 1.0.3.0

- Turns the client-report Planning next-step panel into an interactive onsite-planning scheduler when a project review is required.
- Adds a presentation-ready monthly calendar, date selection, common and custom time choices, and a required Technology Consultant name.
- Saves the appointment to the local workspace and replaces the planning card with a confirmed date, time, and consultant summary.
- Adds a large green **Onsite Planning Scheduled** commitment stamp after confirmation.
- Carries the scheduled onsite review into the live recap, downloadable HTML, and print-ready PDF.

## Version 1.0.3.1

- The onsite-planning calendar now renders through a document-level portal so presentation animations and stacking contexts cannot make it translucent or place it behind the header.
- The scheduling backdrop and calendar panels use solid branded surfaces, fully separating the appointment workflow from the report underneath.
- The recap page now includes the same clickable onsite-planning scheduler as the Planning page. Scheduling or editing from either location updates the same appointment record and PDF details.
