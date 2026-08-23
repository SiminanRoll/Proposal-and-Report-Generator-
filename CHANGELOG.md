# v1.2.70

- Added honest per-subreddit Today and 7-Day post totals based on newly observed, deduplicated Reddit posts instead of summing repeated hourly feed snapshots.
- Added local-parser plus final-classifier suppression totals, surfaced counts, suppression rates, latest feed snapshot size, and telemetry coverage start to every subreddit card.
- Kept Reddit community totals on a fixed seven-day backend window even when another dashboard range is selected.

# v1.1.73

- Added a dedicated inner content canvas so the Company Details viewport measures the full draggable layout height instead of clipping overflowing grid children without creating a scroll range.
- Added direct wheel-to-panel scrolling as a fallback, while retaining native touch, trackpad, keyboard, and scrollbar behavior inside the white detail window.

# v1.1.72

- Rebuilt Company Details as a fixed header plus a dedicated constrained scroll row, removing the conflicting zero-height flex/grid behavior that could paint the content without allowing it to scroll.
- Added an explicit open-state page lock and made the detail canvas keyboard-focusable, so wheel, touch, trackpad, Page Down, and arrow-key scrolling remain inside the white panel.

# v1.1.71

- Moved Company Details scrolling fully inside the white detail window by locking the underlying Compass page while the workspace is open.
- Made the thin glass rail persistent on the detail canvas itself, keeping it aligned with the inside-right edge of the Company Details field.

# v1.1.70

- Added a five-pixel glass scrollbar to the Company Details canvas, with a recessed translucent slot, rounded blue-green thumb, and a brighter hover state.
- Preserved the existing single scroll surface and stable gutter so the new scrollbar does not change card sizing or introduce nested scrolling.

# v1.1.69

- Clarified Company Detail history as the latest completed Captain's Log work with no age cutoff.
- Added bounded duplicate-company recovery: when the primary UUID is empty, Company Detail checks up to eight normalized-name identity candidates and one combined 48-row task response to find the UUID that owns completed work.
- Replaced outlined drag pills with bare dot handles and fixed the sales-card label from overwriting its handle.
- Added empty-canvas drop support with a snapped ghost placeholder, allowing cards and full sections to move through blank grid space instead of only swapping with an occupied card.
- Removed the retired duplicate Latest Activity column from the Captain's Log card.

# v1.1.68

- Fixed Company Detail remaining in a misleading loading state when Supabase could not resolve a company match.
- Added a bounded exact-company fallback for the selected client when the UUID-scoped response is empty, capped at 24 task rows and invoked only on Company Detail open or manual refresh.
- Added safe in-card diagnostics showing the linked company, UUID suffix, and returned row count without exposing credentials.
- Added direct drag-and-snap rearranging on the Company Detail page with a hover grab handle, ghosted source card, and outlined drop target.

# v1.1.67

- Replaced the three isolated Company Detail layout groups with one page-wide draggable item list.
- Added quarter-, half-, and full-width choices for every Company Detail card and section, with responsive stacking on smaller screens.
- Added size-aware information density so compact cards emphasize signals, medium cards add context, and full sections retain complete detail.
- Migrated existing visibility and order choices into the unified layout without discarding saved preferences.

# v1.1.66

- Unified Workbench and Company Detail on one shared Captain's Log "Recent" selector.
- Fixed Company Detail dropping legitimate recent activity solely because it was not labeled completed.
- Made both screens choose the newest completed, scheduled, or created timestamp in the same order, so already-synced Workbench history appears immediately when Company Detail opens.

# v1.1.65

- Restored Company Detail historical activity through Supabase's compact `client_compass_current_state` projection, which includes both Focus task events and Call Mode app events.
- Kept the bounded task-event reader as a compatibility fallback when the historical projection is unavailable or empty.
- Added honest loading and connection-failure states instead of presenting a failed history request as "No completed activity."
- Strengthened the final Company Detail visibility rule so the Captain's Log checkbox outranks every forced responsive card display.

# v1.1.64

- Fixed Company Detail layout visibility so deselecting Captain's Log actually hides the card despite its responsive forced-display rule.
- Reused Workbench-discovered task IDs when Company Detail loads completed activity and recognized completed, done, closed, and resolved statuses consistently.
- Made the automatic Company Detail open sync persist completed activity immediately; manual refresh uses the same path against the latest stored dataset.

# v1.1.63

- Cut automatic Account Review ledger repair frequency in half, from every three minutes to every six minutes.
- Prevented focus and visibility changes from bypassing the Account Review repair throttle while retaining immediate startup repair.
- Fixed Company Detail and its refresh button resolving the canonical company UUID first, then rebuilding company-discovered tasks by task ID so completion events without a repeated company ID still appear.

# v1.1.62

- Restored Company Detail recent-completion history from the same Supabase task-event ledger used by the working Account Review Workbench.
- Kept the compatibility read company-scoped and capped at 80 newest events, triggered only on Company Detail entry or manual refresh rather than global polling.
- Preserved reopened and deleted task handling so only work that is still completed appears in Recent.

# v1.1.61

- Preserved completed Workbench activity when Company Detail receives an empty or narrower foreground task response.
- Merged persisted and live completed history in both Company Detail activity renderers while leaving live open-task state authoritative.
- Replaced the Company Detail priority pill with Healthy, Monitor Needs, and Unhealthy thresholds based on project value and oldest physical-server age.

# v1.1.60

- Fixed completed Supabase tasks flowing into Company Detail and the Account Review Workbench, including legacy `done`/payload completion shapes.
- Changed automatic task reconciliation to follow canonical `tasks.updated_at` changes and forced a one-time full hydration for existing workspaces.
- Kept recently completed review activity in Workbench `In Progress` until the annual review cycle is formally completed.

# v1.0.9.15

- Split Data Tools enrichment into Hardware & inventory and Client records & contacts so device data and relationship data have clear, separate import paths.
- Added client-record fields for city, state, market, industry, tags, contact role, contact details, account-review date, last quote, follow-up, owner, workflow status, and notes.
- Added a generalized client-record enrichment importer with spreadsheet header aliases, smart company matching, blank-safe updates, tag merging, and newest-date protection for account reviews and quotes.
- Added city, state, market, industry, and client-tag fields to Segment Manager rules.
- Expanded the client detail CRM editor to expose the new enrichment fields directly.

# v1.0.9.14

- Fixed static export build failure for managed segment detail pages by moving runtime segment ids from a dynamic Next.js route to `/segments/view/?id=...`.
- Preserved runtime-created segments and left-rail hot-button navigation without requiring build-time `generateStaticParams()`.

## 1.0.9.13

- Added Segment Manager with reusable rule-based client books, custom colors/icons, manual overrides, flip-card metrics, and dedicated segment client views.
- Added dynamic segment hot buttons below the primary left-navigation actions for one-click access to managed client groups.
- Added segment rules for size, lifecycle need, servers/workstations, project value, review/quote timing, owner, Captain's Log activity, location/state text, and client name.
- Restyled the Report Generator title as a subtle pressed/debossed background label while retaining Health sorting and “Search recent.”

## 1.0.9.12

- Added clickable Health sorting to recent reports: highest Replacement Now count first, lowest first, then back to normal recent order.
- Simplified the recent-report search field to “Search recent.”
- Restyled the Ninja spreadsheet/source label as a muted pressed/embossed background treatment instead of heavy dark title text.

## 1.0.9.11

- Added a compact Health column to Reports & proposals with red, yellow, and green lifecycle counts.
- Red shows Replacement now, yellow shows Plan soon, and green shows Healthy devices using the same lifecycle summary as the client report.
- Rows without lifecycle inventory show a neutral dash instead of misleading zero counts.

## 1.0.9.10

- Expanded Captain's Log bulk sync to persist and display the full matched Supabase task/activity history for the entire client book in one pass.
- Removed recent-history display caps and restored bulk-synced history automatically when a client detail screen opens.
- Simplified client activity to a passive Captain's Log history indicator, compact refresh icon, and plus-button task creator with due-date scheduling.
- Removed open-task reporting, coordination-state wording, and open-work gating from the Client Compass experience.
- Improved historical matching with company aliases plus Captain's Log prospect/company identifiers and increased the ledger safety ceiling to 250,000 rows per source table.
- Adopted the four-part Client Compass release version `1.0.9.10`.

## 1.9.9

- Rebuilt the Report Generator landing page as a compact create-and-recent-work view instead of the oversized legacy hero layout.
- Updated recent report/proposal terminology and condensed the list into clearer Client, Type, Status, Sources, and Updated fields.
- Removed the browser-local privacy/backup banner from the generator home and moved backup/restore controls into Settings.

## 1.9.8

- Rebuilt finished client reports as a simplified, non-sticky single-pane workspace centered on the report summary and agreed plan.
- Moved client identity below the product header and collapsed Sources, HIPAA readiness, planning mode, tailoring, and secondary actions into a compact control strip.
- Added focused Sources and HIPAA editors; source additions/replacements now rebuild an existing finished report.
- Added a compact, height-limited hardware inventory showing exactly which assets are included in the presentation.
- Fixed presentation hardware tables so all ten columns fit the presentation viewport without horizontal scrolling.

## 1.9.7

- Retired the dedicated Captain's Log desktop request/acknowledgement path from Client Compass.
- Client history now reads directly from the shared Supabase `task_events` and Call Mode `app_events` ledgers, including open/planned work, recent activity, contacts, and account-review history.
- Coordination Calls are written directly to Supabase `task_events`; Captain's Log receives them through its normal cloud synchronization rather than a Client Compass-specific bridge.
- Reworked Data Tools and Settings wording around a direct Supabase history connection and removed desktop-response status language.
- Rebuilt the client-detail body as a dedicated vertical scroll region with a visible scrollbar and improved Back to list / Client header spacing.
- Retained the in-client Present report quick action.

## 1.9.6

- Requires Captain's Log V843 for live Client Compass cloud acknowledgement and sync.
- Added a Present report quick action inside the client workspace header.
- Fixed client detail modal scrolling and kept the header sticky while browsing long client detail.

## 1.9.5

- Removed the redundant Locations slide from the live client presentation.
- Reworked multi-location PDF follow-up framing so “What this means for you” appears once on the final next-steps page, followed by the Client Success Manager contact block.
- Replaced internal report-assembly wording in the security/technology PDF section with client-facing language.
- Hardened Captain's Log synchronization: Client Compass now probes for an actual V842 desktop acknowledgement, never counts a queued request as synced, and only applies returned client data.
- Reduced batch sizes and made bulk catch-up fail visibly when Captain's Log returns no data.

## 1.9.4

- Inventory diagnostics now preserve authoritative source rows even when the device name normalizes to an empty or malformed identity.
- Client Compass generator snapshots keep those devices as internal `Identity review` placeholders instead of silently dropping them from the detailed inventory.
- Diagnostics expose the stable source device ID and original source device name so the exact record can be corrected.
- Inventory delivery remains blocked until an identity-review device is corrected; the blocker copy now distinguishes identity problems from count-only mismatches.

# v1.8.7

- Captain's Log integration is sync-first: any open/planned task blocks new scheduling.
- Persist Captain's Log contact, activity, open-task, and match state on Client Compass clients.
- Add Data Tools full-book Captain's Log catch-up sync.
- Companion Captain's Log V841 adds any-open-task server enforcement and batch sync.

# Client Compass v1.8.0 — Phase 8 Premium Motion Polish

- Added a unified motion system with quick tactile, standard drawer/list, and expressive card timings.
- Upgraded the top-left Advantage trigger with a restrained glow, glint, press response, masked downward menu reveal, and staggered navigation items.
- Added smoother Data Tools and Settings submenu movement and more tactile menu-item feedback.
- Added depth-aware coverage-card hover tilt, cursor-position sheen, premium flip easing, flip swish, staggered back-face details, and animated card-set entrances.
- Added animated card counts, project values, card-back numeric metrics, list totals, and estimated-value summaries.
- Added a measured sliding filter indicator, staggered client-row transitions, hover lift, animated action arrows, and polished empty-state motion.
- Upgraded modal, search, and client-workspace entrances with refined scale, slide, blur, and success-check feedback.
- Added comprehensive reduced-motion overrides and disabled fine-pointer tilt/sheens on touch and coarse-pointer devices.
- Preserved all coverage logic, ranking, imports, workspaces, reports, presentations, PDFs, and browser-local data behavior.
- Regression result: 304 tests, 299 passed, 0 failed, and 5 skipped.

# Client Compass v1.8.0 — Final Production Release

- Completed the final responsive, touch, keyboard, reduced-motion, empty-state, and long-content polish pass for the Client Project Coverage dashboard.
- Finalized the top-left navigation as a single blue Advantage mark in the corner with the wordmark on the white header; hovering or focusing the mark drops the full-height rail and clicking pins it open.
- Removed the redundant Home icon and preserved Find a client, Report Generator, Data Tools, and Settings workflows.
- Completed the alternate Priority Lens card set with Highest Technical Risk, Oldest Open Quotes, and Largest Estimated Need using real ranking criteria rather than relabeled coverage cards.
- Persists the selected card set in browser-local storage with a safe fallback when browser privacy settings disable storage.
- Added priority-lens list treatments, long-name wrapping, scroll containment, coarse-pointer touch targets, and additional mobile spacing protection.
- Preserved deduplicated project packaging, immediate recalculation, client workspace behavior, imports, reports, presentations, PDFs, and browser-local data storage.
- Final regression result: 301 tests, 296 passed, 0 failed, and 5 skipped.

# Client Compass v1.8.0 — Phase 4 Prioritized Inline Client List

- Added the selected coverage-position client list directly beneath the three primary cards, with Needs Client Review selected by default.
- Kept card selection separate from the existing three-dimensional flip interaction and added a visible selected-card treatment.
- Shows the five highest-priority clients initially and provides a View all control for larger coverage groups.
- Added reason filters for all project needs, server projects, coordinated refreshes of five or more physical workstations, and unsupported systems.
- Added the approved Client, Project need, Why they need attention, Last activity, Estimated value, and Open client columns.
- Preserved card-specific sorting for uncovered needs, discussed decisions, and open quotes.
- Added concise technical attention reasons without turning supporting findings into separate project values.
- Opens the existing client workspace from each row and refreshes the cards and list after review, quote, outcome, or follow-up changes are saved.
- Added responsive table-to-card behavior for smaller screens while preserving keyboard focus and reduced-motion behavior.
- Kept the Report Generator, PDF layouts, imports, project packaging, estimate assumptions, and browser-local storage architecture unchanged.

# Client Compass v1.8.0 — Phase 3.5 Shell and Spacing Refinement

- Combined the Advantage Technologies header brand and expandable navigation trigger into one connected interaction.
- Moved the brand toward the upper-left corner and added a restrained Menu hint, hover treatment, keyboard focus, and click-to-pin behavior.
- Removed the duplicate Advantage mark from the top of the blue navigation rail; the collapsed rail now begins with the Compass home action.
- Connected the blue rail directly beneath the header brand so it reads as one navigation system while preserving the existing overlay, Escape, outside-click, touch, and reduced-motion behavior.
- Replaced the oversized dark Project Coverage hero with a compact light masthead that keeps the title, description, search, freshness, Update data, and Customize controls without consuming the first screen.
- Preserved the Phase 3 coverage engine, three flip cards, client workspace, imports, Report Generator, presentations, and PDF system.

# Client Compass v1.8.0 — Phase 3 Primary Coverage Cards

- Replaced the homepage opportunity-card board with exactly three service-coverage cards: Needs Client Review, Discussed Decision Open, and Quoted Still Open.
- Added a derived coverage engine that qualifies deduplicated server projects and coordinated refreshes of five or more physical workstations using the existing project-packaging and estimate assumptions.
- Excludes resolved outcomes and keeps storage, warranty, operating-system, security, and recovery findings as supporting evidence rather than standalone project values.
- Added quote-age bands, missing-review flags, past-due follow-up signals, card-specific ranking, and plain-language priority explanations.
- Preserved the three-dimensional card flip while limiting the dashboard to one flipped card at a time.
- Added approved card-back metrics, a temporary client drawer that opens the existing workspace, and a visible comparison against the current 23-client Needs Client Review reference group.
- Kept the Phase 2 navigation rail, client workspace, data imports, Report Generator, presentations, and PDF system unchanged.

# Client Compass v1.8.0 — Phase 2 Expandable Navigation Rail

- Added a narrow icon-only Client Compass navigation rail that expands on hover, keyboard focus, or click without shifting the dashboard when opened.
- Added Compass, Find a client, Report Generator, Data Tools, and Settings destinations using the existing application routes and dialogs.
- Grouped Ninja data import, review and quote-date import, calculation refresh, estimate assumptions, qualification thresholds, technical-card configuration, and dashboard card preferences inside the rail.
- Added hash-based shell actions so Data Tools and Settings can be opened safely from any existing application route.
- Added outside-click, mouse-leave, Escape-key, keyboard-focus, reduced-motion, touch, and smaller-screen overlay behavior.
- Preserved the existing homepage cards and all report, proposal, client-workspace, import, storage, and PDF behavior for this checkpoint.

# Client Compass v1.7.10 — Review and Quote Date Import

- Expanded the tucked-away client-history importer to accept `Company Name` with `Last Account Review Date`, `Quote Date`, or both.
- Quote-only spreadsheets now use the same exact, alias, normalized-name, and high-confidence smart matching used by the review-date importer.
- Newer quote dates update `lastQuoteDate`, automatically mark the client as quoted, and recalculate campaign health immediately.
- Blank fields never erase existing history, and older review or quote dates cannot overwrite newer dates already in Compass.
- Duplicate company rows consolidate independently using the newest review date and newest quote date.
- Updated the downloadable template to include both optional date columns.

# Client Compass v1.7.9 — Client PDF File Naming

- Client technology-review downloads now use `Technology Health Review - ClientName.pdf`.
- The print-fallback document title uses the same wording so browser Save as PDF flows suggest the matching filename.
- Filename sanitization now preserves readable spaces, capitalization, and the standard separator while removing filesystem-invalid characters.

# Client Compass v1.7.7 — Production Type-Check Fix

- Fixed the production Next.js TypeScript failure in the presentation overview by using the non-null HIPAA assessment score inside the HIPAA-enabled render branch.
- Added a regression test that prevents the nullable `scores.hipaa` value from being passed to `scoreTone`.
- Preserves all v1.7.4 PDF/presentation polish and v1.7.5 deployment/device-identity fixes.

---

# Client Compass v1.7.5 — Deployment and Duplicate-Device Identity Fix

## Production build and inventory integrity

- Fixed the malformed responsive HIPAA CSS rule that caused the Next.js Turbopack production build to fail.
- Prevents Compass from collapsing two authoritative Ninja rows merely because they share the same displayed device name.
- Keeps distinct devices when stable IDs differ, and uses technical identity fields when stable IDs are unavailable.
- Prevents lifecycle/ScalePad parsing from collapsing same-name rows when serial numbers or supporting model, OS, user, purchase, warranty, or location details differ.
- Uses supporting model, operating-system, user, location, purchase, and warranty evidence to resolve same-name lifecycle matches safely.
- Adds regression coverage based on the McGuire OfficeThree collision case.

# Client Compass v1.7.4 — PDF and Presentation Visual Polish

## Client-facing report refinement

- Rebuilt the printable report around a shared visual system with larger header branding, centered page hierarchy, subtle blue-to-teal banner graphics, low-contrast texture, and subdued gray footer branding.
- Keeps the overall technology score prominent while changing the supporting security, lifecycle, and HIPAA cards to plain-language status labels instead of repeating three additional scores.
- Replaced the presentation and PDF cover planning-status card with a neutral **Aging Systems** summary that describes lifecycle conditions before inviting Advantage to help.
- Removed repetitive plan/planning language from overview and technical-detail sections while retaining guided planning language where a larger refresh or server project warrants it.
- Simplified the HIPAA client recap into one overall readiness result, counts for questions and follow-up items, a restrained response mix, a plain-language meaning statement, consultant guidance, and only the top priority follow-ups.
- Removed Administrative, Technical, Physical, and Organizational category score tiles from client-facing PDF and presentation output while preserving category scoring internally.
- Preserved full unanswered-question follow-up pages, Review Outcome overrides, multisite detail packing, and consolidated per-device lifecycle, storage, and operating-system findings.

# Client Compass v1.7.2 — HIPAA Guidance and Small Replacement Planning

## Focused report-language patch

- Expanded HIPAA Question 10 to ask whether the practice regularly reviews policies, staff training, and compliance needs with a qualified HIPAA consultant or compliance professional.
- Added concise consultant guidance to the live presentation, screen report, detailed PDF, and pre-meeting preparation content.
- Clarifies that the readiness review highlights possible weaknesses but does not determine HIPAA compliance.
- Recommends qualified ongoing guidance when it is missing, especially when several answers are No or Not sure.
- Introduced a separate purchase-planning path for one to four workstation replacements.
- Removes consultation-call and onsite project-planning prompts from that small-replacement path.
- Uses a low-pressure invitation for Advantage to help confirm business-class equipment, software needs, purchase timing, and coordination whenever the client is ready.
- Keeps guided consultation or onsite-planning language for server projects and refreshes of five or more computers.

# Client Compass v1.7.1 — One-Time Account Review Date Import

## Focused enrichment patch

- Added a tucked-away **Customize → Import account review dates** data tool.
- Accepts CSV or Excel with only **Company Name** and **Last Account Review Date** required.
- Bulk-matches against committed Compass clients using exact names, saved aliases, normalized business names, dental/practice naming equivalence, and similarity scoring.
- Automatically resolves high-confidence matches and presents only true exceptions in one compact grid.
- Consolidates duplicate input rows using the newest valid review date.
- Blank dates never erase data; older dates never replace newer review history.
- Does not create clients, alter inventory, or infer quote or sales history.
- Recalculates campaign health immediately after committed enrichment.
- Includes a downloadable client-name template for near-perfect matching.

# Client Compass v1.7.0 — Client Review Campaigns

## Relationship-first client navigation

- Keeps the approved card-only homepage, card counts, card flipping, and big-picture estimated values unchanged.
- Turns each card queue into a client review campaign with a clickable green/yellow/red health bar.
- Updates the selected client count, estimated need, affected-device count, and list whenever a health segment is selected.
- Classifies clients as Reviewed and served, Follow-through needed, or Review needed using review history, quote history, and documented no-quote outcomes.
- Adds fast inline history entry for account-review date, last sales interaction, quote date, quoted status, and next follow-up.
- Refocuses campaign sorting and navigation on review coverage, next relationship action, follow-up timing, and technical urgency.
- Simplifies the client workspace around why the client needs attention, review outcome, agreed next step, relationship history, and current technology needs.
- Keeps one general estimated technology-need figure as secondary context while removing repeated project values and sales-process emphasis from the client page.
- Collapses detailed findings and inventory below the relationship workflow without removing technical truth or report access.
- Keeps Quoted as a lightweight confirmation that a warranted consultation/handoff was completed, not as a sales pipeline.

# Client Compass v1.6.0 — Phase 6

## Multisite views, project packaging, and focused homepage controls

- Adds named-location views in the client workspace with location-specific device totals, physical and virtual servers, lifecycle priorities, Windows 10 exposure, storage findings, and agreed decisions.
- Suppresses generated or generic location placeholders from client-facing location summaries while preserving every authoritative managed-client device in inventory.
- Adds shared project packaging for server replacement, retirement, migration, workstation refresh, client-purchased deployment, OS remediation, storage remediation, application work, HIPAA follow-up, investigation, and multisite coordination.
- Carries grouped projects into the client workspace, report generator facts, presentation, and PDF with devices, locations, drivers, disposition, responsibilities, timing, quote status, assumptions, inclusion status, and explainable value.
- Applies Review Outcome decisions before technical defaults so retirements, client-purchased equipment, upgrades, deferrals, and completed work do not inherit generic replacement recommendations.
- Prevents a device from contributing replacement value to more than one packaged project and applies multisite or storage allowances only once.
- Adds location-specific presentation and printable report sections without creating empty pages for suppressed or unused locations.
- Consolidates the Compass hero into one primary **Update data** action and a **Customize** menu for cards, scoring/estimates, and manual recalculation.
- Simplifies data freshness messaging, removes the redundant generator link from the hero, and adds a direct **Report** action to homepage client-search results.
- Removes the obsolete ESLint/Zod dependency chain that repeatedly produced registry and lockfile install failures, replacing it with a deterministic local TypeScript-aware lint check.
- Keeps the card-only homepage, browser-local privacy boundary, Review Outcome, Tailor Report, onsite/remote wording, HIPAA pages, report polish, diagnostics, and hidden queue-level Generate Proposal behavior intact.

# Client Compass v1.5.0 — Phase 5

## Shared technical truth and generator/proposal parity

- Adds one shared technical classification layer for device type, virtualization, operating-system support, lifecycle, storage, warranty, server urgency, source precedence, and safe inventory enrichment.
- Keeps committed Ninja / Client Compass data authoritative for managed-client inventory, stable device IDs, names, locations, classification, operating systems, activity status, and storage.
- Restricts ScalePad enrichment to uniquely matched age, purchase-date, and warranty fields; unmatched or ambiguous lifecycle records remain diagnostics only.
- Keeps RFT authoritative for potential-client and proposal-update technical findings while retaining older proposals for scope and pricing context.
- Prevents lower-priority proposal facts from overwriting newer RFT facts when the normalized project environment is built.
- Adds field-level source provenance and an internal Technical Source Precedence panel without changing client-facing report or PDF design.
- Routes Compass calculations, managed-client prefill, source adapters, report data, presentation, PDF, and proposal intelligence through the shared technical layer.
- Adds Phase 5 regression fixtures for managed inventory, RFT precedence, proposal updates, lifecycle enrichment, storage, virtualization, multisite preservation, Review Outcome dispositions, onsite/remote wording, and HIPAA preservation.
- Keeps Generate Proposal removed from queue actions and does not add Phase 6 multisite or project-packaging UI.

# Client Compass v1.4.9

## Tailored summary parser stabilization

- Accepts natural transcript-summary headings such as `Meeting Summary`, `Agreed Next Step`, and `Agreed Decisions`.
- Converts ordinary numbered decisions into editable roadmap items without requiring hidden machine-style labels.
- Infers common outcomes for retirement, client-purchased deployment, phased replacement, monitoring, upgrades, and follow-up review.
- Continues to support the original labeled format and JSON format for backward compatibility.
- Updates the Tailor Report prompt example and error guidance to match the simpler human-readable workflow.
- Adds regression coverage using the exact summary format that previously failed.

# Client Compass v1.4.8

- Restored a dedicated HIPAA Readiness Review page to the client-facing PDF.
- Includes the displayed score, assessment completion, category scores, full Yes/Somewhat/No/N/A/unanswered distribution, and client confirmation status.
- Includes every reportable No, Somewhat, or unanswered question with the exact question, client-facing observation, next action, owner, and timing when available.
- Adds continuation pages when the follow-up list is too long for one page while retaining fillable unanswered-question pages.
- Keeps the compact HIPAA score on the cover and removes the duplicate HIPAA recap block.

- Fixed homepage client-search result clipping by rendering the result menu in a fixed portal above the dashboard cards.
- Simplified the first client-PDF page title to **Technology Review** because the client name is already shown in the Prepared for label.

- Removed the repeated Agreed Next Step block from PDF page one; the Planning Status card remains the concise cover summary.
- Removed the entire redundant final-recap page from confirmed agreed-plan PDFs and eliminated repeated action-title chips from agreed-plan pages.
- Suppressed single-location cover/overview duplication, retained multisite packets, and increased priority-table packing to avoid orphan one-row pages.
- Upgraded client PDF raster capture to 288 DPI portrait / 2560x1440 landscape with high-quality image smoothing and JPEG encoding.
- Replaced the low-resolution combined PDF logo with high-resolution embedded brand mark and wordmark assets.
- Added typography and print-rendering polish for smoother lines, gradients, rounded cards, and more consistent footer spacing.

# Changelog

## 1.4.4 — tailored report transcript prompt

- Adds a **Tailored report prompt** input to the Review Outcome and Tailor Report editor.
- Applies a structured summary generated from a meeting transcript to report framing, meeting summary, agreed next step, and roadmap decisions.
- Supports both the labeled `TAILORED REPORT SUMMARY` format and structured JSON.
- Maps supported outcome language to the existing conversation-driven dispositions and warns when an outcome needs manual review.
- Keeps prompt application as an unsaved preview until the employee reviews the populated fields and saves the outcome.
- Preserves existing decisions when a prompt updates only summaries, and replaces the unsaved decision list only when decision blocks are supplied.

## 1.4.3 — conversation-driven review outcomes

- Adds a persistent Review Outcome layer so technical findings stay factual while agreed client decisions control planning language.
- Adds editable meeting summaries, agreed next steps, responsible parties, timing, client-facing notes, internal notes, and PDF inclusion controls.
- Supports client-purchased equipment, deployment, upgrades, retirement/decommissioning, migration, monitoring, deferral, completed work, and investigation outcomes.
- Adds a Tailor Report editor for the report title, executive summary, and agreed roadmap before PDF delivery.
- Preserves review outcomes through future Ninja imports and connected generator refreshes.

## 1.4.2 — authoritative Ninja reporting and diagnostics

- Treats the committed Ninja inventory in Client Compass as the definitive device scope, identity, name, location, operating system, and classification source for managed-client reports.
- Keeps every authoritative Client Compass device in the report by stable device ID and prevents report-side name deduplication from dropping legitimate systems.
- Limits ScalePad to safe lifecycle enrichment and retains its unmatched devices as diagnostic-only rows instead of adding or suppressing managed inventory.
- Adds a downloadable inventory-reconciliation CSV tracing each Ninja device through normalization, enrichment, report inclusion, and any review disposition.
- Automatically catches existing connected report workspaces up to the latest committed Client Compass snapshot.
- Blocks PDF delivery only when an authoritative Ninja device fails to reach the report output.
- Adds a subtle homepage client search that opens the selected Client Compass workspace directly.

## 1.4.1 — report inventory reconciliation

- Makes the current Ninja/Client Compass inventory authoritative for device identity, names, locations, operating systems, status, and complete managed-asset counts.
- Uses ScalePad as a safe lifecycle-enrichment source for age, purchase date, warranty, and aggregate lifecycle and operating-system summaries.
- Keeps every managed device visible, including physical devices whose lifecycle is unknown and virtual machines whose hardware lifecycle belongs to the host.
- Adds source-versus-generator reconciliation for total assets and device classes, and blocks report generation when the authoritative inventory is incomplete.
- Normalizes hidden PDF control characters and wrapped hostname fragments without merging punctuation-distinct Ninja device names.
- Separates full managed inventory from lifecycle-assessed physical assets so health percentages no longer hide unknown devices.
- Shows aggregate priority counts even when a ScalePad priority cannot be safely matched to a named Ninja device, with an explicit review warning before quoting.

## 1.4.0 — Phase 4 workflow and managed-client generator connection

- Adds **Reviews Due** and **Quote Needed** workflow cards without changing technical Compass Priority scores.
- Adds primary-contact role, email, and phone fields plus owner, review, quoted, follow-up, status, and note controls in the client workspace.
- Preserves manually maintained workflow details whenever a new current-state spreadsheet snapshot is committed.
- Makes review intervals and all valuation assumptions editable browser-local settings with immediate recalculation.
- Sends the selected client’s committed ScalePad/Ninja inventory, lifecycle, operating-system, storage, warranty, and physical/virtual data directly into the current-client report generator.
- Keeps Huntress as the required current security source and keeps RFT as the primary technical source for proposal workflows.
- Lets an existing managed-client report workspace refresh its connected Client Compass source after a newer spreadsheet import.

## 1.3.1 — quoted workflow status

- Replaces the ambiguous project-mapping workflow field with a simple **Quoted** yes/no status.
- Shows a checkmark in client queues when a client has been quoted and leaves the status blank otherwise.
- Adds an immediately saved Quoted checkbox to the client workspace.
- Replaces the obsolete **Project Mapping Needed** workflow option with **Quote Needed**.
- Removes **Generate Proposal** from queue-row actions while keeping report generation and the full client workspace available.
- Preserves quoted status when a new current-state Ninja snapshot is committed.

## 1.3.0 — Phase 3 client queues and workspaces

- Automatically recalculates the committed current-state snapshot when card criteria, score weights, thresholds, or estimate assumptions change.
- Adds a visible **Refresh calculations** catch-up action with calculated-at status and actionable storage errors.
- Replaces the Phase 2 preview drawer with sortable and filterable live client queues behind each card.
- Adds queue fields for priority, estimate, qualification drivers, affected devices, review and mapping dates, contact, owner, refresh date, and follow-up status.
- Adds per-client actions to open the client workspace, start reports and proposals, and schedule follow-up.
- Adds a current-state client workspace with technical counts, explainable findings, inventory, card memberships, workflow fields, notes, and completion actions.
- Prefills the existing report and proposal creation paths with the selected client and current Compass context.
- Keeps the homepage card-only and browser-local.

## 1.2.3 — configurable card criteria and storage calibration

- Applies the approved qualification rules for Clients Needing Projects, Critical Server Projects, Server Planning, Windows 10 Refresh, and Workstation Lifecycle.
- Requires five active Windows 10 devices and five devices within either the Replace Now or Plan Soon workstation group before those cards qualify a client.
- Excludes six-month-stale, inactive, duplicate, virtual-hardware, missing-lifecycle, and same-project critical-server overlaps where applicable.
- Rebuilds Storage Attention around percentage plus free-space safeguards and excludes recovery, EFI, reserved, utility, and undersized partitions.
- Adds **Manage Cards & Criteria** so built-in cards can be edited and reordered, and custom opportunity cards can be added with configurable signals, minimum counts, exclusions, estimates, and manual client overrides.
- Recalculates the current browser-local snapshot immediately after card or threshold changes.

## 1.2.2 — header alignment polish

- Centers the **Client Compass** subtitle more cleanly beneath the Advantage wordmark in the top application bar.
- Keeps the existing logo, branding, and mobile hide behavior unchanged.

## 1.2.0 — Client Compass Phase 2

- Renames the product to **Client Compass** while retaining Advantage Technologies branding.
- Adds browser-local Ninja master spreadsheet import, preview, explicit organization resolution, and current-snapshot commit.
- Adds normalized client, location, device, finding, score, and opportunity models without historical snapshots.
- Adds physical/virtual classification; OS, lifecycle, storage, and warranty findings; configurable scoring; and explainable estimate assumptions.
- Replaces illustrative card metrics with committed-data calculations and a no-data empty state.
- Preserves the Report & Proposal Generator, planning-mode toggle, security layout, and consolidated generator controls.

## 1.1.0 — Client Compass Phase 1

- Rebrands the application as **Client Compass** and makes Compass the default home route.
- Introduces a card-only project-opportunity snapshot with no permanent client table on the homepage.
- Adds six interactive opportunity cards for total project needs, critical servers, server planning, Windows 10 refresh, workstation lifecycle, and storage attention.
- Flips every card between the current affected-client count and the estimated project value represented by that category.
- Adds hover, focus, keyboard, reduced-motion, and active flip states for the opportunity cards.
- Adds a **View clients** control with a Phase 1 preview queue and clearly marks all counts and values as illustrative until live imports arrive in Phase 2.
- Preserves the existing report and proposal generator under a dedicated **Report Generator** route and global navigation item.
- Updates application branding, metadata, package identity, local-backup language, and product documentation for Client Compass.

## 1.0.5.1 — Generator workflow and planning format

- Adds a workspace-level planning recommendation toggle for **Onsite Review** or **Remote Consultation**.
- Updates client reports, proposals, presentation recaps, pre-meeting material, scheduled-appointment copy, and downloadable PDFs to use the selected planning format consistently.
- Reframes remote next steps as a consultation call with the client’s Technology Consultant rather than onsite project planning.
- Consolidates source, refresh, editing, pre-meeting, presentation, and PDF actions into one ordered generator command center.
- Keeps source attachments reachable from the command center and scrolls directly to the supporting source workspace when opened.
- Places Autorun Events and Process Events side by side on the left of the security monitoring row, with the incident-response panel aligned to the right.
- Tightens incident-response spacing and preserves separate fields for the affected computer, identified threat, outcome, and documented actions.
- Carries the selected planning format into the Potential Client and Existing Proposal Update workflows and their authorization handoffs.

## 1.0.5.0 — RFT-driven proposal parity

- Makes the RFT workbook the primary technical source for both Potential Client and Modernize Existing Proposal workflows.
- Adds the RFT as a required source in the proposal-updater workflow while keeping the existing proposal as the scope and pricing reference.
- Normalizes RFT computer, aging, detailed hardware, login-session, drive-detail, Hyper-V, security, backup, and Windows Update sheets into the same device model used by the client report.
- Carries virtual-machine identification, device model, storage utilization, lifecycle priority, and operating-system support concerns into both proposal presentations and PDFs.
- Adds RFT security-configuration slides covering firewall exceptions, update issues, and backup records that need confirmation, with clear point-in-time assessment language.
- Adds the interactive lifecycle, storage, OS-support, and hardware inventory views to both proposal modes.
- Adds RFT assessment and complete hardware-inventory pages to proposal PDFs before the solution, investment, and authorization sections.
- Refreshes the proposal's starting A360 quantities when the first RFT source is attached, while the existing proposal remains available for pricing and scope confirmation.
- Enables the same HIPAA readiness experience for the proposal updater so both proposal paths follow the same assessment-to-authorization flow.


## 1.0.4.9 — Security presentation clarity

- Separates ransomware canary totals from protected-endpoint totals so each number has a clear label and visual weight.
- Uses restrained blue, teal, orange, and green number accents to make security results easier to scan without making the page feel alarming.
- Rebuilds the security-team response area as a full-width panel with a calm outcome headline, dedicated computer and threat fields, and a single completion badge.
- Removes duplicate device and threat details from the incident headline and replaces cramped pills with readable labeled fields.
- Shows documented containment, cleanup, quarantine, and deletion steps as concise completed-action indicators.
- Applies the same incident-response hierarchy to the downloadable and printable report layouts.

## 1.0.4.8 — Virtual-machine identification and storage filtering

- Accepts `Device` as the computer-name header in ScalePad-style spreadsheet exports.
- Identifies virtual machines from explicit models and common virtualization indicators such as Microsoft Hyper-V Video, VMware, VirtualBox, QEMU, VirtIO, KVM, Xen, and Parallels.
- Keeps virtual machines visible throughout the interactive inventory and location paperwork while excluding them from physical replacement counts and labeling their lifecycle as host-dependent.
- Adds `(Virtual Machine)` to the displayed computer name and distinguishes server workloads as `Virtual server`.
- Makes the Storage Capacity panel clickable so Critical and Watch devices can be reviewed together, sorted by storage priority.
- Includes virtual-machine disk usage in storage-health reporting and site-specific storage pages.

## 1.0.4.7 — Calm incident-response reporting

- Uses the calmer client-facing headline “Security activity was identified.” when a report contains an incident.
- Reads affected-device, threat-name, and response-action details from Huntress incident summaries when those details are available.
- Adds a dedicated security-team response panel to the interactive report and printable PDF, including the computer, identified threat, completed containment and cleanup steps, and current status.
- Treats documented containment or cleanup as a completed response rather than leaving an automatic security follow-up open in Planning and Recap.
- Keeps unresolved incidents clearly visible when the source report does not contain completed response details.



## 1.0.4.6 — Interactive inventory and site-ready planning packets

- Makes the hardware summary cards interactive: hover feedback, persistent active state, and click-to-filter views for all assets, healthy devices, plan-soon devices, and replace-now devices.
- Sorts the full hardware inventory by lifecycle priority so Replace Now systems appear before Plan Soon and Healthy Now systems.
- Shows the workstation/device model and video-card model as separate report details.
- Adds multisite PDF planning packets with a cover page for each location and a concise site-specific list containing only Plan Soon and Replace Now equipment.
- Reads disk volume utilization from both compact `Disk Volume Usage` values and ScalePad-style `Volumes` records containing capacity and usage percent.
- Adds storage health to the interactive report and per-location PDF packets using Healthy, Watch, and Critical states while keeping storage pressure separate from lifecycle replacement status.


## 1.0.4.5 — Lean device export detection

- Recognizes device CSV/XLSX exports that use `Last Uptime` instead of `Last Online` or `Last Update`.
- Accepts the compact export shape containing Display Name, OS, activity, warranty, memory, graphics, login, organization, and location columns even when Device Role and Make/Model are omitted.
- Uses the operating-system name to distinguish servers from workstations when the Device Role column is absent.
- Adds regression coverage for the exact `Devices (8).csv` header pattern.

## 1.0.4.4 — Spreadsheet detection reliability

- Detects device inventory data across every worksheet instead of assuming the first sheet contains the table.
- Finds device headers below cover rows, report titles, and other introductory content.
- Supports UTF-8 and UTF-16 comma-, tab-, and semicolon-delimited exports, including files mislabeled by Windows as Excel CSV files.
- Recognizes XLSM, XLSB, and TSV uploads in addition to CSV, XLS, and XLSX.
- Uses workbook content to distinguish RFT assessments from device inventory exports and gives a clear review warning for unsupported layouts instead of silently producing an empty inventory.
- Adds executable regression coverage for multi-sheet workbooks, delayed headers, UTF-16 tab exports, and unsupported spreadsheet structures.

## 1.0.4.2 — DigitalOcean npm bootstrap fix

- Removed the npm engine range and `packageManager` pin that caused the Heroku/DigitalOcean buildpack to replace its bundled npm before dependency installation.
- Kept Node.js pinned to the supported 22.x runtime.
- Added a repository regression test so platform npm bootstrap constraints are not reintroduced.

This project follows semantic versioning. Git history and release tags are the source of truth for patch-level implementation history.

## 1.0.4.1 — Multi-site inventory and release polish

- Preserved spreadsheet location data and grouped device classes by site, with oldest lifecycle items first within each location.
- Added concise location labels to presentation and PDF inventory rows and replacement cards.
- Displayed explicit graphics/video-adapter models when supplied by the source export.
- Marked workstation graphics as “Not included in source export” when the spreadsheet does not contain that field, rather than guessing hardware.
- Removed obsolete compatibility code and patch-era version comments.
- Added repository editor settings, a proprietary license notice, and a GitHub Actions quality gate.

## 1.0.4.0 — Repository quality and maintainability

- Removed accumulated patch notes, verification artifacts, generated TypeScript build metadata, and obsolete hosted-sharing cleanup code from the repository.
- Consolidated current product, architecture, deployment, and testing documentation.
- Removed an unused legacy HIPAA HTML-export module.
- Added repository-hygiene regression checks.
- Simplified build scripts and pinned declared dependency versions for more predictable installs.
- Preserved the existing application behavior and regression suite.

## 1.0.3 — Client workflow and report maturity

- Added interactive client technology reviews and Advantage 360 proposals.
- Added ScalePad PDF and device-spreadsheet lifecycle import.
- Added Huntress security report import.
- Added Cloud Plus backup server recognition and lifecycle planning.
- Added technology-focused HIPAA readiness, pre-meeting packets, and fillable PDF follow-up.
- Added client-specific organization terminology.
- Added onsite planning scheduling and print-friendly PDF exports.

## 1.0.2 — Proposal workflow

- Added RFT-driven proposal generation, editable pricing, project scope, monthly services, and authorization.
- Added browser-local project persistence and portable project backups.

## 1.0.1 — Presentation and lifecycle reporting

- Added presentation mode, lifecycle scoring, hardware inventory, security summaries, and client-facing planning language.

## 1.0.0 — Initial application

- Established the static Next.js application, shared project model, local source processing, and the three primary workflow types.

## 1.9.3
- Inventory reconciliation is now an internal delivery blocker instead of client-facing presentation copy.
- Diagnostics now explain summary-vs-detail and device-category count mismatches directly.
# 1.1.58

- Added an instant first-time prospect Advantage 360 presentation launcher beside Workbench.
- Added guided, ordered discovery for priorities, environment, industry software, and Dental imaging.
- Added a personalized concern-weighted A360 story, client-provided summary, and live preliminary estimate using the existing A360 pricing constants.
- Added an OTA close that explicitly identifies the pending CRM prospect-save and scheduling integration.
