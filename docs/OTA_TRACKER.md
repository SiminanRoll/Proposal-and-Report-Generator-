# OTA Tracker

## Purpose

OTA Tracker is the company-wide accountability surface for onsite technology assessments (OTAs). It is intentionally not a sales pipeline. Its operational question is:

> Which OTAs have happened, and which of them still have not been quoted fast enough?

The dashboard is served at `/ota-tracker/` from the Client Compass DigitalOcean static deployment. The year/performance surface is `/ota-stats/`.

The web implementation stays isolated under `src/app/ota-tracker/` except for genuinely shared Client Compass dependencies.

## Source of truth

- Web source of truth: `SiminanRoll/Proposal-and-Report-Generator-` `main`.
- Shared OTA data source of truth: Captain's Log Supabase, primarily `public.company_otas` and `public.companies`.
- Shared schema/deployment directives: Captain's Log primary repo and `CLV_DIRECTIVE.md` remain authoritative.
- OTA Tracker must **not** create a second OTA registry.

The web app remains a static Next.js export. No separate Node/API server is required for OTA Tracker.

## Live OTA data model

OTA Tracker uses the existing Captain's Log `public.company_otas` registry. Relevant fields include:

- `id`
- `company_id`
- `handoff_id`
- `appointment_date`
- `appointment_time`
- `time_zone`
- `tc_name`
- `contact_name`
- `status`
- `source`
- `notes`
- `set_date`
- source message/hash/subject/file/import metadata
- `quoted`
- `quoted_date`
- `tracker_cleared`
- `tracker_cleared_at`
- `presentation_set`
- `presentation_date`
- `updated_at`

Email and manual imports use the Captain's Log source conventions `captains_log_email_import` and `captains_log_manual`. New rows use `status = in_progress` and deterministic handoff IDs `ota-tracker:<sha256>`.

## OTA aging / decay rules

All aging uses **America/Chicago business dates**, not rolling 24-hour windows. Saturday and Sunday do not advance the quote clock.

| State | Rule when not quoted | Display |
| --- | --- | --- |
| Upcoming | OTA date is in the future | Green |
| OTA today | OTA date is today | Green |
| Grace window | Through business day 1 after OTA | Green |
| Quote due | Business day 2 after OTA | Yellow |
| Overdue | Business day 3+ after OTA | Red |
| Quoted | `quoted = true` | Green / clock stopped |
| Needs date | OTA date missing | Neutral review state |
| Closed | cancelled / no-show status | Neutral / no escalation |

The canonical web rule is `classifyOtaHealth()` in `src/app/ota-tracker/logic.ts`.

## Active queue vs. historical quote history

OTA Tracker deliberately separates **active accountability** from **historical reporting**.

### Active accountability

The active queue excludes `tracker_cleared = true` rows. Red, Yellow, Upcoming, Needs Attention, normal active views, overdue copy lists, and any future escalation job operate on uncleared rows only.

The default **Latest OTAs** view includes future uncleared OTAs plus uncleared OTAs from the previous 60 calendar days.

### Historical quoted view

The annual `Quoted · YYYY` KPI and filter are historical and use the complete OTA registry:

- include quoted rows even when `tracker_cleared = true`;
- require `quoted = true`;
- use `appointment_date` as the primary year/date;
- fall back to `set_date` only if the appointment date is missing;
- include manual and email-imported OTA rows equally;
- never infer or manufacture a quote merely to match an expected count.

This prevents the review-list `×` from erasing a legitimate quote from annual totals.

## Clear from review

`tracker_cleared` is a non-destructive operational dismissal state.

Clicking the row-level `×`:

- hides the OTA from the active accountability queue;
- does not delete it;
- does not alter `quoted`, `quoted_date`, dates, source, or historical identity;
- does not remove it from annual quote history or performance/statistical reporting.

Full-access users retain a dedicated **Cleared** view and can restore rows.

The read-only shared snapshot also returns cleared historical rows together with their clear-state flags. The client hides them from active review while retaining them for historical/statistical views. This behavior is established by Captain's Log migration `20260824220450_ota_tracker_preserve_cleared_history.sql`.

## Email intake

Email is the primary intake method. Supported inputs are Outlook `.msg`, `.eml`, `.txt`, pasted email text/batches, and a blank manual OTA row.

Outlook `.msg` is binary and must not be read with `File.text()`. OTA Tracker uses the CFB reader already shipped through the SheetJS/XLSX dependency to extract subject, body, sender data, and Message-ID when available, then feeds the result through the same field parser.

Sales Assist wrapper text is normalized away so preview titles show the practice/company instead of ticket/opportunity/A360 wrapper text.

The parser previews company, OTA date/time, primary contact, and assigned TC before any write. Company and OTA date are required before import. Quote/proposal wording is only a review hint and never auto-marks `quoted = true`.

Assigned TC entry uses the shared Client Compass consultant roster for quick selection while preserving historical/custom names when necessary.

## Deduplication and import updates

Deduplication priority:

1. exact `source_message_id` when present;
2. exact SHA-256 `source_message_hash`;
3. one unambiguous same-company / same-OTA-date / same-contact match.

A match updates scheduling/source fields on the existing OTA. Existing quote state is preserved.

New companies are created only when no normalized Captain's Log company match exists.

## Quote status and manual corrections

Full-access users can edit OTA date/time, primary contact, assigned TC, and notes.

`Mark quoted` sets `quoted = true` and `quoted_date` to the current America/Chicago date. `Reopen` clears both fields.

Manual OTA rows are first-class OTA records. Their `source = captains_log_manual` must not exclude them from quote filters, status filters, year history, or performance reporting.

## `set_date` semantics

`set_date` means the date the OTA was actually set/scheduled for sales-goal reporting. It is distinct from the appointment date and from the date a historical row happens to be imported into the web app.

Historical/manual imports must not silently distort month/year performance by treating import time as the true set date. When future intake work adds explicit set-date capture, preserve existing set dates on deduplicated records unless a user intentionally corrects them.

## Sharing and security

OTA Tracker supports authenticated full access and a code-protected read-only team view.

Base `companies` and `company_otas` RLS remain owner-scoped. The team view uses narrow RPCs and does not create anonymous writes or weaken base-table policies.

The current shared snapshot returns full OTA history, including clear-state flags, because historical reporting must remain complete. Active-queue hiding remains a client/business-rule concern.

Rotating the team code invalidates the prior code.

## OTA vs. OTR

Captain's Log also has `public.company_otrs`. OTA and OTR are distinct historical registries. OTA Tracker must not silently union OTR rows into OTA counts merely to reconcile a total. Any future combined onsite-history view must explicitly define the business meaning and deduplication rule first.

## Notification automation

Version 1 does not send unattended escalation email from the browser.

A future server-side notification job should use the active red queue only:

- `quoted = false`;
- OTA at least business day 3 past;
- cancelled / no-show excluded;
- `tracker_cleared = false`;
- approved recipient mapping;
- durable idempotency/history.

Never depend on an open browser tab for unattended notifications.

## Validation / maintenance

When changing OTA Tracker:

- keep Captain's Log schema and Client Compass UI contract aligned;
- do not create a second OTA table;
- preserve RLS and team-view security boundaries;
- preserve message/hash/handoff dedupe and Outlook `.msg` binary parsing;
- keep clear-state semantics split between active review and historical reporting;
- keep manual rows eligible for normal history/filter behavior;
- update both this document and `captains_log/docs/OTA_TRACKER_WEB_APP.md` for material contract changes;
- run typecheck/build before deployment;
- confirm GitHub `main`, DigitalOcean deployment, and live Supabase state agree before calling production complete.
