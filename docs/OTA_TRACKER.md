# OTA Tracker

## Purpose

OTA Tracker is the company-wide accountability surface for onsite technology assessments (OTAs). It is intentionally not a sales pipeline. Its operational question is:

> Which OTAs have happened, and which of them still have not been quoted fast enough?

The dashboard is served at `/ota-tracker/` from the Client Compass DigitalOcean static deployment. The year/performance surface is `/ota-stats/`. The full-access cleared recovery surface is `/ota-tracker/cleared/`.

The web implementation stays isolated under `src/app/ota-tracker/` except for genuinely shared Client Compass dependencies.

## Source of truth

- Web source of truth: `SiminanRoll/Proposal-and-Report-Generator-` `main`.
- Shared OTA data source of truth: Captain's Log Supabase, primarily `public.company_otas` and `public.companies`.
- Shared schema/deployment directives: Captain's Log primary repo and `CLV_DIRECTIVE.md` remain authoritative.
- OTA Tracker must **not** create a second OTA registry.

The web app remains a static Next.js export. No separate Node/API server is required for OTA Tracker.

## Client dependency isolation

Public reporting and operational parsing share only the small primitives that are genuinely common.

- `src/app/ota-shared.ts` owns the public-safe Supabase endpoint/key and Chicago date helper used by `/ota-stats/`.
- `/ota-stats/` must not import `src/app/ota-tracker/logic.ts` just to obtain those values.
- Tracker keeps its richer parsing/import behavior in `src/app/ota-tracker/logic.ts`.
- The XLSX dependency used for Outlook `.msg` CFB parsing is loaded on demand from `parseOtaEmailFile()` rather than at Tracker module initialization.
- Plain-text/email-batch parsing, normal Tracker viewing, and public OTA Performance therefore do not require an eager XLSX load.
- Existing Unicode `.msg` fallback behavior remains mandatory if full CFB parsing is unavailable.

Blocking source-level regressions protect the public/Tracker boundary and the on-demand XLSX contract. Parser behavior remains covered by the existing OTA Tracker logic tests.

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
- `set_by`
- `setter_user_id`
- source message/hash/subject/file/import metadata
- `quoted`
- `quoted_date`
- `tracker_cleared`
- `tracker_cleared_at`
- `presentation_set`
- `presentation_date`
- `updated_at`

`set_by` is the authoritative human-readable person who booked the OTA. `setter_user_id` is the explicit authenticated provenance used for My Sets eligibility. A null `setter_user_id` means ownership is unproven even when `set_by` or `set_date` contains historical text/date information.

Email and manual imports use the Captain's Log source conventions `captains_log_email_import` and `captains_log_manual`. New rows use `status = in_progress` and deterministic handoff IDs `ota-tracker:<sha256>`.

## My Sets vs. All Company

Both OTA Tracker and OTA Performance have an explicit registry scope.

- **My Sets** is the default. A row belongs here only when its authenticated `setter_user_id` proves that the configured registry owner set the appointment.
- **All Company** is the master registry and includes every otherwise eligible company OTA, including rows whose setter is unknown or belongs to someone else.

Historical records are intentionally conservative. Do not infer My Sets ownership from any of the following:

- `user_id` ownership of the underlying row;
- who imported or edited the row;
- `source`;
- `set_date` alone;
- notes written in first person;
- assigned `tc_name`.

An old row with unproven setter remains visible in All Company and contributes to All Company reporting, but contributes zero to My Sets until a full-access user explicitly records Set By as the owner and saves the row, establishing `setter_user_id` provenance.

The read-only team snapshot exposes only an `is_my_set` boolean, not `setter_user_id`, so team viewers can use the same scope without receiving authenticated user identifiers.

## Set By, Set Date, Onsite Date, and assigned TC

These fields represent different facts and must remain separate:

- **Set By** (`set_by`) — who booked the appointment.
- **Set Date** (`set_date`) — when the appointment was booked.
- **Onsite Date** (`appointment_date`) — when the technology assessment occurs/occurred.
- **Assigned TC** (`tc_name`) — the Technology Consultant assigned to perform/follow the OTA.

Never substitute the assigned TC for Set By. Never use Set Date as the reporting calendar date. Tracker intake/edit surfaces show these fields separately so corrections remain explicit.

Manual OTA creation defaults Set By to the configured owner and Set Date to the current Chicago date because the owner is explicitly creating the appointment record in the full-access Tracker. Parsed email rows do not auto-claim setter identity: full-access users review Set By and can use the explicit **My set** action when appropriate.

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

## Cleared means excluded everywhere

`tracker_cleared = true` is a hard exclusion from OTA Tracker metrics and OTA Performance.

A cleared OTA contributes **zero** to:

- Red / overdue
- Yellow / due
- Needs Attention
- Missing info
- Upcoming
- annual Quoted totals and quoted filters
- overdue copy/escalation lists
- OTA Performance annual totals
- month and quarter totals
- TC selector options when a TC exists only on cleared rows
- leaderboard and heatmap
- printed/PDF performance reports

Clearing remains non-destructive: the underlying `company_otas` row and its dates/quote state are preserved.

The dedicated full-access recovery screen at `/ota-tracker/cleared/` shows only `tracker_cleared = true` rows. It supports search plus editing of OTA date/time, primary contact, assigned TC, notes, quote state, and presentation state. Saving an edit **does not restore** the OTA; it remains cleared and excluded from all metrics. `Restore` is the explicit action that sets `tracker_cleared = false` and returns the OTA to active Tracker/Performance eligibility.

The read-only shared snapshot may return clear-state flags; all metric-producing client logic must reject `tracker_cleared = true` before calculations.

## Missing info cleanup queue

The normal OTA Tracker owns data-quality cleanup through the **Missing info** filter.

The current-year-biased cleanup rule is applied inside the selected My Sets / All Company scope:

- every active uncleared OTA with no `appointment_date` is included, because it cannot yet be assigned to a reporting year;
- active uncleared OTAs whose `appointment_date` is in the current year are included when `tc_name` is blank;
- cleared OTAs are excluded;
- older dated history with a blank TC is not pulled into the current-year cleanup queue.

Rows with no date sort first, followed by current-year missing-TC rows with the most recent OTA dates first. Editing the date or TC removes the row from this queue automatically when its required fields are complete.

This cleanup queue replaces backfill/data-quality KPI cards on OTA Performance. Performance remains a reporting view, while the Tracker is where missing information is fixed.

## Quote history

The annual `Quoted · YYYY` KPI/filter uses only **uncleared** rows that are actually marked `quoted = true` inside the selected registry scope.

- use `appointment_date` as the primary year/date;
- fall back to `set_date` only when the appointment date is missing;
- include manual and email-imported OTA rows equally;
- never infer or manufacture quote state merely to match an expected total;
- exclude every `tracker_cleared = true` row.

## Email and manual intake

Email is the primary intake method. Supported inputs are Outlook `.msg`, `.eml`, `.txt`, pasted email text/batches, and a blank manual OTA row.

Outlook `.msg` is binary and must not be read with `File.text()`. OTA Tracker uses the CFB reader already shipped through the SheetJS/XLSX dependency to extract subject, body, sender data, and Message-ID when available, then feeds the result through the same field parser. The XLSX module is loaded only when `.msg` parsing is actually requested.

Sales Assist wrapper text is normalized away so preview titles show the practice/company instead of ticket/opportunity/A360 wrapper text.

The parser previews company, onsite OTA date/time, primary contact, and assigned TC before any write. Set By and Set Date are explicit review fields layered on the import preview; parser-derived TC identity never fills Set By. Company and Onsite Date are required before import. Quote/proposal wording is only a review hint and never auto-marks `quoted = true`.

Manual OTA rows must receive unique source identities. They must never deduplicate merely because another manual entry also originated from the Tracker.

Assigned TC entry uses the OTA TC picker with the shared consultant roster plus required Tracker entries. `Matt Minicozzi` and `Craig Marten` are guaranteed selectable options, and historical `Matthew Minicozzi` values are treated as Matt Minicozzi for reporting.

## Deduplication and import updates

Email deduplication priority:

1. exact `source_message_id` when present;
2. exact SHA-256 `source_message_hash`;
3. one unambiguous same-company / same-OTA-date / same-contact match.

Manual entries do not reuse a generic manual source hash.

A valid match updates scheduling/source fields on the existing OTA. Existing quote state is preserved. Setter provenance is also preserved unless the import preview explicitly supplies Set By; a blank parsed Set By never erases or invents an existing setter.

New companies are created only when no normalized Captain's Log company match exists.

## Quote status and manual corrections

Full-access users can edit Set By, Set Date, Onsite Date/time, primary contact, assigned TC, and notes.

When a full-access user explicitly saves Set By as the configured owner, the row receives the authenticated `setter_user_id` and becomes eligible for My Sets. Saving another person or a blank Set By clears that owner provenance. This is an explicit correction path, not an inference rule.

`Mark quoted` sets `quoted = true` and `quoted_date` to the current America/Chicago date. `Reopen` clears both fields.

Manual OTA rows are first-class OTA records. Their `source = captains_log_manual` must not exclude them from normal filters or reporting; only `tracker_cleared = true` removes them from metrics.

## Date semantics

`appointment_date` is the canonical reporting date for OTA Performance. The year/month/quarter, assigned-TC totals, charts, leaderboard, heatmap, and PDF report all use the actual onsite OTA appointment date.

`set_date` remains a stored historical/sales field representing when the appointment was booked. It must never drive the Performance calendar.

## TC normalization

OTA Performance rolls known short or historical TC names into one reporting identity. In particular:

- `Chris` → `Chris Beadle`
- `Matt Minicozzi` and `Matthew Minicozzi` → `Matt Minicozzi`
- existing short-name aliases for Shawn, Eric, Jason, Joshua, Marty, Bryan, and Craig remain normalized to their canonical names.

TC normalization affects assigned-TC reporting only. It never changes Set By or My Sets provenance.

## Sharing and security

OTA Tracker supports authenticated full access and a code-protected read-only team view.

Base `companies` and `company_otas` RLS remain owner-scoped. The team view uses narrow RPCs and does not create anonymous writes or weaken base-table policies.

The team snapshot may expose `set_by`, `set_date`, and `is_my_set`, but not the authenticated `setter_user_id`. The public `/ota-stats/` snapshot exposes only `appointment_date`, `tc_name`, and `is_my_set`.

The cleared recovery screen requires authenticated full access because it can mutate OTA records and restore them to metric eligibility.

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
- preserve the `/ota-stats/` isolation from protected Tracker parser/mutation logic;
- keep XLSX/CFB loading on demand for Outlook `.msg` rather than eager at Tracker module load;
- preserve Outlook `.msg` binary parsing, Unicode fallback, and email dedupe;
- preserve unique manual-entry identities;
- treat clear-state as a universal metric exclusion;
- keep the cleared recovery screen non-destructive until explicit Restore;
- keep the Missing info cleanup queue in the operational Tracker rather than Performance;
- keep manual rows eligible for normal history/filter behavior when not cleared;
- keep OTA Performance grouped by `appointment_date`, never `set_date`;
- keep Set By / Set Date / Onsite Date / assigned TC semantically separate;
- never infer My Sets from `tc_name` or unattributed historical records;
- update both this document and Captain's Log OTA web/performance contracts for material behavior changes;
- run typecheck/build before deployment;
- confirm GitHub `main`, DigitalOcean deployment, and live Supabase state agree before calling production complete.
