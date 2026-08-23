# Signal Intelligence Map Baseline

Status: Phase 1 complete
Dashboard baseline: `1.2.72`
Backend authority: `SiminanRoll/captains_log` `main`
Frontend authority: `public/captains-log-dashboard/`

## Purpose

This document fixes the pre-map contract so later phases can add the Signal Intelligence Map without replacing authentication, weakening the data boundary, deleting the existing operational dashboard, or inventing unavailable metrics.

Phase 1 changes documentation and regression coverage only. It deliberately does not change runtime behavior, production data, Supabase schema, Edge Functions, or DigitalOcean deployment state.

## Preserved system boundary

The browser remains a static application. Its request path is:

1. `premium.js` signs in through Supabase Auth with the public publishable key.
2. The access and refresh tokens are stored under the existing dashboard session key.
3. Requests to `/api/status?days=<range>` are intercepted in the browser.
4. The browser sends a JWT-authenticated `POST` to `server-runner-dashboard-web` with `{ "window_days": <range> }`.
5. The Edge Function validates the JWT, enforces the existing dashboard-user allowlist, reads with a server-only service-role key, and returns sanitized JSON.

The Signal Map must use this same request path. It must not receive a service-role key, runner HMAC secret, integration secret, or direct privileged database access.

## Frontend baseline

- The authoritative deployed directory is `public/captains-log-dashboard/`.
- The similarly named root-level `captains-log-dashboard/` directory is reference material only.
- `index.html` contains the existing operational views: Overview, Opportunities, Social, Permits, NPI, Intent, and Run History.
- The existing dashboard loads only after authentication succeeds.
- Supported ranges are 1, 7, 30, 90, and 365 days, presented as 24H, 7D, 30D, 90D, and 1Y.
- The default operational range is currently 7D.
- The browser refreshes the dashboard every 60 seconds and supports manual refresh.
- Failed reads retain the page shell and render the request error in the existing error region.
- `bubble` remains a stored compatibility tier but is normalized to `Warm` in user-facing dashboard copy.
- CLV visual tokens are defined in `premium.css` and `dashboard-polish.css`: dark navy shell, Segoe UI, Social green, Permit gold, NPI violet, Intent indigo, Hot red, Warm amber, and Quiet gray.

## Current protected API response

`server-runner-dashboard-web` currently returns:

- `ok`, `generated_at`, and `window_days`
- `runners` and range-filtered parent `runs`
- Social runner health and Facebook scan history
- Range-filtered One Stop Social Facebook signals
- Fixed 30-day Facebook switch-analysis rows
- Current social monitoring inventory
- Dynamic Facebook configured-group names plus an authoritative-inventory flag
- Reddit latest scans, selected-range scans/signals, and fixed seven-day scans/signals
- Dynamic Reddit configured-community names plus an authoritative-inventory flag
- NPI latest/range runs, candidates, and investigations
- Permit latest/range runs and opportunities

The function uses bounded result limits. Phase 2 must calculate only from returned evidence or introduce explicit aggregate queries; it must not treat a capped row array as an uncapped total.

## Six-source normalization matrix

| Stable map ID | User label | Current evidence | Phase 2 rule |
| --- | --- | --- | --- |
| `facebook_groups` | Facebook Groups | `one_stop_social` rows in `social_signal_scans`, `social_signals`, and `social_monitoring_inventory` | Use active inventory for current monitored membership. Use selected-range signals for performance. |
| `reddit_groups` | Reddit Groups | `reddit_atom` rows in the same Social tables | Use active inventory populated from the tracked manual manifest. Never restore the obsolete six-community assumption. |
| `linkedin_groups` | LinkedIn Groups | No dedicated group-ingestion or inventory contract exists | Return unavailable/null metrics until a real group source exists. Do not relabel `linkedin_page` or open-web LinkedIn posts as LinkedIn Groups. |
| `company_page_engagement` | Adv-Tech Company Page Engagement | Owned-page signals exist as `meta_page` and `linkedin_page`; `instagram_page` also exists but is not one of the six requested lanes | Normalize owned Facebook Page and owned LinkedIn Page engagement explicitly. Keep it separate from LinkedIn Groups. |
| `permit_offices` | Permit Offices | `permit_ingest_runs`, `permit_opportunities`, and Permit parent telemetry | Derive current connections and health independently from opportunity production. Preserve jurisdiction limitations. |
| `npi_new_practice` | NPI / New Practice | `npi_ingest_runs`, `npi_research_candidates`, `npi_investigations`, and NPI parent telemetry | Treat review-worthy candidates as opportunities. Do not run these rows through Social classifier semantics. |

## Inventory authority

Facebook inventory is authoritative only when current active `one_stop_social` inventory rows are marked authoritative. The OSS IndexedDB inventory sync is the strongest membership source.

Reddit inventory is the tracked manual manifest. Scan telemetry can populate authoritative `configured_communities`; observed leads alone are not authoritative membership. The UI must label the inventory as a manual list where helpful and must not depend on Reddit login state.

There is no current LinkedIn Groups inventory. Company-page integrations are account integrations, not group membership.

## Opportunity contract

Existing opportunity evidence is source-specific:

- Facebook and Reddit: `social_signals.should_surface === true`
- Owned company pages: surfaced `meta_page` and `linkedin_page` signals
- Permits: rows in `permit_opportunities`
- NPI: `npi_research_candidates.review_worthy === true`

The normalized map opportunity must preserve the real source identifier, source URL when present, score when present, tier after user-facing normalization, `why_flagged` or equivalent evidence, and an explicit next action only when the source provides one. Otherwise the UI uses the neutral action `Review opportunity`.

## Engine-stage availability

The map is a conceptual business pipeline, not a claim that every source runs identical code.

- Collect can use source rows or source-run record totals when those totals have an unambiguous meaning.
- Filter and suppression are directly available for classified Social sources. Permit and NPI may not have equivalent suppression counts.
- Score is directly available for Social signals, Permit opportunities, and NPI candidates, but the score definitions are not identical.
- Enrich is evidence-dependent. Existing API selections omit several possible context fields.
- Surface is available from the opportunity rules above.

Missing stage values must be `null` and hidden. Phase 2 must not infer counts by subtracting unrelated source metrics.

## Geography baseline

- Permit opportunities expose city and state.
- NPI candidates expose city and state.
- Social signals have a `location_detected` field in the database, but the current dashboard response does not select it.
- Signals without verified geography belong in `Unknown / Unresolved`.
- Group names, subreddit names, author profiles, and source URLs are not geographic evidence.

## Health baseline

Health and opportunity production are separate dimensions.

- Social/OSS health uses heartbeat freshness plus scan coverage/cadence.
- Reddit health uses actual scan freshness and execution evidence, not Reddit login state.
- Permit and NPI health should prefer normalized parent-run telemetry; child rows are compatibility evidence and do not prove the parent scheduler ran.
- Owned-page health can use integration enabled state, last event/webhook timestamps, and last error fields once selected by the protected API.
- A completed healthy run with zero opportunities remains healthy.

## Deployment and release baseline

- The repository builds a static Next.js export.
- DigitalOcean serves the generated static site; no dashboard server route exists in this repository.
- Dashboard files are copied from `public/captains-log-dashboard/` into the static export.
- Dashboard assets use explicit version query strings, and `version.json` identifies the dashboard release.
- A Signal Map release must update every dashboard asset reference and version label together.
- A GitHub commit or successful local build is not proof of a live release. The authenticated DigitalOcean URL must be checked after deployment.

## Security observations for later phases

- The browser contains only the expected publishable key; no privileged key is present.
- `server-runner-dashboard-web` is JWT protected by the platform default and repeats user validation inside the function.
- The Edge Function has a single-user allowlist in addition to JWT validation. Phase 2 preserves that policy unless authorization is deliberately redesigned.
- The inventory scan trigger is a `SECURITY DEFINER` function in `public`. No matching `REVOKE EXECUTE FROM PUBLIC` appears in the tracked migrations. This is an audit finding, not a Phase 1 runtime change; address it through a reviewed migration rather than an ad hoc production edit.
- New public tables are not required for the normalized response. If a later phase adds one, current Supabase Data API exposure defaults and RLS/grant requirements must be reviewed explicitly.

## Phase 2 contract boundary

Phase 2 should extend the existing successful response with an additive `signal_map` object. It must not rename or remove current fields because the Detail Dashboard consumes them directly.

The additive object should contain:

- `generated_at` and normalized range
- exactly six stable source summaries
- nullable conceptual engine-stage metrics
- normalized surfaced opportunities
- selected-range timeline buckets
- verified geography plus unresolved count

Phase 2 is backend-only except for contract fixtures/tests. The existing frontend continues using the legacy fields until the Map entry-point phase lands.
