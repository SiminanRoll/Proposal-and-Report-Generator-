# OTA Tracker

## Purpose

OTA Tracker is the company-wide accountability surface for onsite technology assessments (OTAs). It is intentionally not a sales pipeline. Its job is to answer one operational question quickly:

> Which OTAs have happened, and which of them still have not been quoted fast enough?

The dashboard is served at `/ota-tracker/` from the Client Compass DigitalOcean static deployment, but the implementation is deliberately isolated in its own source folder:

```text
src/app/ota-tracker/
  page.tsx
  ota-tracker-dashboard.tsx
  ota-tracker-dashboard.module.css
  logic.ts
```

Do not scatter OTA Tracker UI/parser code into generic Client Compass component folders unless a future shared dependency genuinely requires it.

## Source of truth

- Web source of truth: `SiminanRoll/Proposal-and-Report-Generator-` `main`.
- Shared OTA data source of truth: Captain's Log Supabase, primarily `public.company_otas` and `public.companies`.
- Shared schema/deployment directives: Captain's Log primary repo and `CLV_DIRECTIVE.md` remain authoritative.
- OTA Tracker must **not** create a second OTA registry.

The web app remains a static Next.js export. No separate Node/API server is required for OTA Tracker.

## Live data model

OTA Tracker uses only columns that exist in the current Captain's Log cloud schema.

### `public.company_otas`

- `id`
- `company_id`
- `appointment_date`
- `appointment_time`
- `time_zone`
- `tc_name`
- `contact_name`
- `status`
- `source`
- `notes`
- `set_date`
- `source_message_hash`
- `source_message_id`
- `source_subject`
- `source_file_name`
- `source_imported_at`
- `quoted`
- `quoted_date`
- `updated_at`

### `public.companies`

- `id`
- `display_name`
- `normalized_name`
- `status`

Email sender and sent-time values can still help parsing, but they are not written into invented `company_otas` columns. Source traceability is maintained through message ID, source hash, subject, source file, source type, and import timestamp.

## OTA aging / decay rules

All aging uses **America/Chicago calendar days**, not rolling 24-hour windows.

| State | Rule when not quoted | Display |
| --- | --- | --- |
| Upcoming | OTA date is in the future | Green |
| OTA today | OTA date is today | Green |
| Grace day | 1 calendar day after OTA | Green |
| Quote due | 2 calendar days after OTA | Yellow |
| Overdue | 3+ calendar days after OTA | Red |
| Quoted | `quoted = true` | Green / clock stopped |
| Needs date | OTA date missing | Neutral review state |
| Closed | cancelled / no-show status | Neutral / no escalation |

The canonical web rule is `classifyOtaHealth()` in `src/app/ota-tracker/logic.ts`. Filters, KPI counts, copy-overdue behavior, and any future server notification job must match this rule.

Example when today is August 24, 2026:

- August 25+: green, upcoming
- August 24: green, OTA today
- August 23: green, grace day
- August 22: yellow
- August 21 or earlier: red unless quoted

## Email intake

Email is the primary intake method.

Supported inputs:

1. pasted email text, including batches / forwarded messages;
2. `.eml` files;
3. `.txt` email exports;
4. a blank manual OTA row when parsing needs human correction.

The parser looks for labeled values such as:

- Company / Practice / Business / Office / Organization
- OTA Date / Appointment Date / Onsite Date / Scheduled Date
- OTA Time / Appointment Time / Onsite Time / Scheduled Time
- Primary Contact / Contact / Office Manager / POC
- TC / Technology Consultant / Technician / Assigned To

Subject-line inference is a fallback for common `OTA - Company` / `OTA: Company` subjects.

Parsing is always a **preview step**. Nothing writes to Captain's Log simply because an email was pasted or loaded. Company and OTA date are required before a selected row can import; contact, time and TC remain editable.

Quote/proposal language is shown only as a hint. It does not auto-mark quoted because scheduling emails can contain those words without proving a quote was actually sent.

## Deduplication and import updates

Each imported email receives a normalized SHA-256 source hash.

Deduplication priority:

1. exact `source_message_id` match when present;
2. exact `source_message_hash` match;
3. one unambiguous same-company / same-OTA-date / same-contact match as a fallback.

If an existing OTA is matched, the importer updates its scheduling/source fields instead of creating a duplicate. Existing quote state is not overwritten.

New companies are created only when no normalized Captain's Log company match exists. Minimal prospect identity metadata is written so the company remains compatible with Captain's Log universal company handling.

## Quote status and manual corrections

Full-access users can edit:

- OTA date
- OTA time
- primary contact
- assigned TC
- notes

`Mark quoted` sets:

- `quoted = true`
- `quoted_date = <current America/Chicago date>`

`Reopen` sets:

- `quoted = false`
- `quoted_date = null`

The existing Captain's Log consistency constraint on quoted state remains authoritative.

## Sharing and security

OTA Tracker supports two access modes.

### Full access

A browser already connected to Captain's Log cloud through Client Compass uses the existing authenticated Supabase session and RLS. Full access can:

- import OTA emails;
- add manual OTA rows;
- correct OTA details;
- mark quoted / reopen;
- set or rotate the team view code.

### Read-only team view

The authenticated OTA registry owner can set a team view code from OTA Tracker. Teammates can then open `/ota-tracker/` and enter that code without receiving the Captain's Log account password.

The shared path is implemented in Captain's Log Supabase by migration:

`supabase/migrations/20260824145500_ota_tracker_shared_view.sql`

It adds:

- `public.ota_tracker_share_config` with hashed codes only;
- `public.ota_tracker_set_share_code(text)` for authenticated owner setup/rotation;
- `public.ota_tracker_shared_snapshot(text)` for safe read-only snapshot access.

The read-only RPC exposes only OTA dashboard fields. It does **not** expose an anonymous write path and does not weaken `company_otas` RLS.

The browser stores the entered team code locally so the shared view can reopen on that browser. Rotating the code invalidates previously shared codes.

## Notification automation

Version 1 does not send unattended escalation email from the browser.

The red queue is intentionally the exact dataset a future server-side notification job should consume:

- `quoted = false`
- OTA appointment date at least 3 America/Chicago calendar days before the current date
- cancelled / no-show rows excluded

Recommended server-side notification design:

1. Run on a scheduled server process / function at a defined business time.
2. Resolve assigned TC and notification recipients from an approved staff mapping.
3. Send one escalation notification per overdue episode.
4. Store durable idempotency / notification history before retries are enabled.
5. Never depend on an open browser tab for unattended sending.

## Deployment and maintenance checklist

When changing OTA Tracker:

- keep implementation files inside `src/app/ota-tracker/`;
- verify the live Captain's Log schema before adding or referencing columns;
- do not create a second OTA table;
- preserve existing Captain's Log RLS;
- preserve email message/hash traceability and dedupe;
- keep `classifyOtaHealth()` aligned with notification rules;
- update this document when parser, aging, sharing, or notification behavior changes;
- run typecheck/build before deployment;
- confirm GitHub `main`, DigitalOcean deployment, and shared Supabase state agree before calling production complete.
