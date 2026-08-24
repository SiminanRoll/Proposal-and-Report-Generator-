# OTA Tracker

## Purpose

OTA Tracker is the company-wide accountability surface for onsite technology assessments (OTAs). It is intentionally not a sales pipeline. Its job is to answer one operational question quickly:

> Which OTAs have happened, and which of them still have not been quoted fast enough?

The dashboard lives in Client Compass at `/ota-tracker/` and reuses Captain's Log's existing cloud OTA registry rather than maintaining a separate database.

## Source of truth and deployment

- Web implementation source of truth: this repository (`SiminanRoll/Proposal-and-Report-Generator-`, `main`).
- Shared OTA data source of truth: Captain's Log Supabase tables, primarily `public.company_otas` and `public.companies`.
- Client Compass remains a static Next.js export. OTA Tracker does not add a custom Node/API server.
- Browser-side cloud access uses the existing authenticated Captain's Log Supabase helpers in `src/lib/compass/captains-log-cloud.ts`.
- The page follows the same DigitalOcean static-site deployment path as the rest of Client Compass.
- Captain's Log CLV/deployment directives remain authoritative for shared cloud ownership and production-state discipline.

Do not create a second OTA table for this dashboard. Any future OTA feature should extend or safely expose the existing Captain's Log registry unless there is a documented migration reason not to.

## Data model

OTA Tracker currently reads and writes these existing `company_otas` fields:

- `id`
- `company_id`
- `appointment_date`
- `appointment_time`
- `tc_name`
- `contact_name`
- `status`
- `source`
- `notes`
- `source_message_id`
- `source_message_hash`
- `source_subject`
- `source_from`
- `source_sent_at`
- `quoted`
- `quoted_date`
- `updated_at`

Company names are resolved through `public.companies` using `company_id`. Email imports can create a minimal company row when an exact normalized company match does not already exist.

## OTA aging / decay rules

All aging is based on **America/Chicago calendar days**, not elapsed 24-hour periods. This prevents a record from changing color in the middle of the business day.

| State | Rule when not quoted | Display |
| --- | --- | --- |
| Upcoming | OTA date is in the future | Green |
| OTA today | OTA date is today | Green |
| Grace day | 1 calendar day after OTA | Green |
| Quote due | 2 calendar days after OTA | Yellow |
| Overdue | 3 or more calendar days after OTA | Red |
| Quoted | `quoted = true` at any age | Green / clock stopped |
| Needs date | OTA date is missing | Neutral review state |

The aging implementation lives in `src/lib/compass/ota-tracker.ts` (`classifyOtaHealth`). Keep dashboard cards, filters, notification logic, and any future scheduled job aligned to that single rule set.

### Example using August 24, 2026 as today

- August 25+: green, upcoming
- August 24: green, OTA today
- August 23: green, grace day
- August 22: yellow, quote due
- August 21 or earlier: red, overdue
- Any of the above with `quoted = true`: green, quoted

## Email intake

Email is the primary intake path.

The browser can accept:

1. pasted email text in batches;
2. `.eml` files;
3. `.txt` email exports;
4. a manually entered blank OTA row when parser extraction is incomplete.

The parser looks first for labeled values such as:

- Company / Practice / Business / Office / Account
- OTA Date / Appointment Date / Onsite Date / Scheduled Date
- OTA Time / Appointment Time / Onsite Time / Scheduled Time
- Primary Contact / Contact / Office Manager / POC
- TC / Technician / Consultant / Assigned To

Subject-line inference is a fallback for company names in common `OTA - Company` / `OTA: Company` style subjects.

### Import safety

Parsing is a preview step. Email text is not written to the registry simply because it was pasted or loaded.

Before import:

- the extracted fields are shown in editable preview rows;
- company and OTA date are required;
- contact, time and TC can be corrected manually;
- quote/proposal/estimate language only creates a visual hint; it does **not** automatically mark an OTA quoted.

This is intentional. Scheduling emails can contain words such as “quote” or “proposal” without proving a client-facing quote was actually completed.

## Deduplication

Each imported email is traced using the existing Captain's Log source fields.

Deduplication order:

1. exact `source_message_id` match when the message contains a Message-ID;
2. SHA-256 hash of normalized source email text using `source_message_hash`;
3. if neither matches, create a new OTA row.

When a duplicate is detected, OTA scheduling/source fields are updated on the existing row instead of creating another OTA. Existing quote state is not overwritten by the importer.

## Manual corrections and quote status

The dashboard supports direct corrections for:

- OTA date;
- OTA time;
- primary contact;
- TC / technician / consultant;
- notes.

`Mark quoted` sets:

- `quoted = true`
- `quoted_date = <current America/Chicago date>`

`Reopen` sets:

- `quoted = false`
- `quoted_date = null`

The existing Captain's Log database constraint requiring a quoted date when quoted remains in force.

## Dashboard workflow

The default view is **Needs attention**, with severity ordering that puts red OTAs first, then yellow, then grace/today/undated records. Upcoming and quoted records remain available through filters.

Primary KPIs:

- Red / overdue
- Yellow / due
- Needs attention
- Upcoming
- Quoted

The red queue is the operational escalation list.

## Authentication and sharing

Version 1 preserves the existing Captain's Log cloud authentication and row-level security. It does not weaken `company_otas` RLS for public access.

At implementation time, the live Captain's Log registry is owned by the existing Advantage cloud account. A browser must therefore be connected through Client Compass Settings before the dashboard can read or update the shared registry.

If individual team logins are introduced later, add them through an explicit team-access design rather than disabling RLS or exposing an anon write path.

## Notification automation

Version 1 deliberately **does not send unattended email**. It exposes the exact red queue that a notification job will use.

Recommended next-stage architecture:

1. A scheduled server-side job runs at a defined business time in America/Chicago.
2. It selects `quoted = false` OTAs with an appointment date at least 3 calendar days before the current Central date.
3. It resolves the assigned TC/technician and notification recipients from an approved staff mapping.
4. It sends one escalation notification per overdue episode.
5. It records notification idempotency (`notified_at`, event key or a dedicated notification log) before retries are enabled.
6. Reopening a previously quoted OTA starts a new episode only by explicit policy.

Do not implement notification sending by keeping a browser tab open. Unattended escalation belongs in a server-side scheduled job / function with durable idempotency.

## Maintenance checklist

When changing OTA Tracker:

- keep `classifyOtaHealth` as the canonical web aging rule;
- confirm the Captain's Log schema before adding fields;
- do not fork OTA ownership into a second table;
- preserve `company_otas` RLS;
- preserve email source traceability and dedupe;
- verify static export (`npm run verify` / at minimum typecheck + build);
- keep this document updated when parser rules, aging thresholds, authentication or notifications change;
- confirm GitHub `main`, deployed Client Compass, and shared Supabase state agree before calling a deployment complete.
