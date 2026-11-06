# Client Compass to GHL task preview wiring (November 6, 2026)

Status: **draft branch only; not deployed; GHL reads and guarded workflow submissions are implemented in code, but no live API calls or task writes have been performed.**

## Reused implementation

This branch is based on PR #78 (feature/ghl-webhook-intake-preflight-20261106). It imports that existing single/batch preflight implementation, rather than recreating batch validation logic. The original local-only client-compass-ghl-cutover worktree's two batch files are not available in the identified remote branches and still require review before merge.

## UI entry points wired in this branch

- The single-client + button in ClientTrackedAction now opens an offline GHL task preflight. It does not call the former Captain's Log/Supabase task writer.
- Project Coverage multi-selection offers Preview GHL tasks using the same preflight function.
- Territory Map client list now has selectable checkboxes, Select all shown, Add to Workbench, and Preview GHL tasks. Compare with the more recent local screen/worktree before merging.
- WorkbenchBulkAction now updates local Workbench selection only, without a Supabase membership write.
- The preview asks for explicit due date, time and timezone. No credentials or webhook URLs are exposed.
- Existing GHL tasks are marked NOT CHECKED until an authenticated readback path is implemented. This does not imply that any task is absent.
- No live send, workflow publish, contact creation, task edit, stage move, sync or backend call is included.

## Read-side awareness contract added

- Pure GHL contact-task normalizer in src/lib/compass/ghl-task-awareness.mjs, plus matching TypeScript declarations and focused offline tests.
- Accepts the documented GET /contacts/:contactId/tasks response shape (id, contactId, title, body, assignedTo, dueDate, completed). It performs NO network requests.
- Requires independently verified existing business/contact association, a complete successful API response, and a recent read timestamp. Missing, stale, incomplete, failed, foreign-contact or malformed results cannot masquerade as zero scheduled tasks.
- Normalizes scheduled, overdue, undated and completed tasks. Important: task records are contact-scoped; a shared contact may serve multiple businesses, so contact task counts do not prove business ownership.
- Detects exact request ID markers and possible coordination-call overlaps separately. A clean snapshot is NOT an atomic duplicate lock and does not authorize submission.
- Preview UI now accepts an optional future trusted readback snapshot and displays counts and overlap warnings per selected client. No source supplies it yet, so current previews accurately say Not checked.
- GHL API read scopes and endpoint are documented at https://marketplace.gohighlevel.com/docs/ghl/contacts/get-all-tasks/ and https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contacts-by-business-id/. Access tokens remain outside the static PWA.

## Trusted read-side sequence (code ready; no live connector)

- The new ghl-trusted-task-reader module accepts three injected **read-only** authenticated provider functions: GET existing GHL business, GET contacts by business (including full pagination), and GET contact tasks. It never imports fetch, exposes bearer tokens, or invents credentials.
- It verifies the existing GHL business ID AND sub-account location, collects the complete business-scoped associated contact list, requires explicit contact selection when ambiguous, and only then retrieves that contact's tasks.
- It rejects missing, contradictory or incomplete GHL associations and safely hides backend exception detail. It passes verified responses to the task normalization contract rather than maintaining duplicate parsing logic.
- All current provider tests use fake in-memory GHL responses. This is not yet connected to authenticated runtime access; the current static PWA remains unable to read live GHL tasks, and the draft workflow is unchanged.
- Vendor references: https://marketplace.gohighlevel.com/docs/ghl/businesses/get-business/ ; https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contacts-by-business-id/ ; https://marketplace.gohighlevel.com/docs/ghl/contacts/get-all-tasks/ .
- Final execution must reuse an authorized trusted environment (for example an approved existing GHL app backend) without introducing a Supabase or Captain's Log fallback. No hosted gateway has been built or approved.

## Production blockers (not resolved)

1. Verify existing GHL business IDs and associated contacts securely. Do not reuse Supabase company UUIDs as GHL business IDs.
2. Connect the new readback contract to a genuinely authenticated GHL source, with company/contact/review-cycle mapping. The parser is implemented, the authenticated fetch is NOT.
3. Confirm draft workflow JSON-body mapping, exact date/time behavior, owner, task details, CORS/browser compatibility.
4. Implement durable/atomic duplicate prevention for retries and concurrent requests.
5. Verify task creation plus persisted readback by task ID before claiming success.
6. Reconcile previous local-only src/lib/compass/client-success-batch.ts and tests/client-success-batch.test.mjs before merge to avoid competing bulk logic.
7. Remove ALL Captain's Log and Supabase dependencies from Client Compass before final cutover: API, credentials, background sync, task writes, Workbench scheduling, client workspace data, models and UI. No fallback, dual-write or shadow synchronization.
8. Obtain separate approval for live testing, workflow publishing, merge and deployment.

Other legacy Client Compass paths remain on this preview branch; this is not the completed no-Supabase cutover. Do not deploy this branch as a finished product.

## November 6 continuation: DigitalOcean read-only API and UI wiring

This draft now contains an authenticated GHL GET adapter and browser-to-DigitalOcean read flow. This is code only, not a deployed, live connection. The GHL task creation workflow remains Draft.

- Server files: `services/ghl-read-api/ghl-provider.mjs`, `handler.mjs`, and `server.mjs`. The GHL Private Integration Token is read only from a DO runtime secret, never bundled into the PWA.
- `POST /api/ghl/businesses/matches` pages through existing GHL businesses in the configured location and returns only exact company-name candidates, including ambiguous duplicates. No fuzzy or first-result company matching.
- `POST /api/ghl/tasks/read` re-verifies the selected business ID, tenant, exact Compass company name and associated contact before returning contact-scoped tasks.
- Each endpoint requires a *separate* reader-access secret and exact same-origin check. No GHL Private Integration Token is ever exposed to the browser.
- `src/components/ghl-task-reader-panel.tsx` is wired into the shared single/bulk task dialog for exact GHL business matching, explicit confirmation, optional GHL business ID verification, contact selection and verified task readback.
- Verified GHL business/contact IDs can be saved browser-locally. Reader access secrets and task response bodies are never persisted.
- Incomplete, stale, mismatched or ambiguous GHL data displays Not checked. The presence of similar tasks provides warnings, not guaranteed atomic idempotency.
- No GHL task creation, publishing, contact creation, CRM changes or webhook delivery is implemented. The existing GHL workflow is the intended task-creation route after validation.
- All added GHL-specific tests and TypeScript pass. Other legacy standalone Compass code still references Supabase and Captain's Log; this is not a completed cutover and must not be deployed as one.

Read-only DigitalOcean deployment details: `docs/CLIENT_COMPASS_GHL_DO_READ_API_2026-11-06.md`.

## Release-candidate code checkpoint (November 6, 2026)

The user reports the existing GHL `Client Compass | Coordination Task Intake` workflow is **live**. No authenticated GHL workflow introspection or execution trace has been obtained, so live field mapping, idempotency and persisted task creation are **not yet verified**.

New work in this same Draft PR:

- DigitalOcean Node GHL API adapter for read-only existing businesses, exact-name matching, associated contacts and contact-scoped tasks.
- Explicit authenticated workflow submission endpoint that forwards only the existing published workflow JSON, never direct GHL task writes.
- Strong separation of GHL Private Integration Token, workflow webhook URL, read access and write access secrets (all server-side where applicable).
- Writer defaults to disabled until full `GHL_COORDINATION_TASK_INTAKE_WEBHOOK_URL`, independent writer secret, `CLIENT_COMPASS_GHL_TASK_SEND_ENABLED=true` and `GHL_WORKFLOW_DUPLICATE_GUARD_VERIFIED=true` are explicitly configured after real GHL checks.
- Server verifies existing business name/location/contact and recent task readback again immediately before sending. It blocks prior requests, similar open tasks and uncertain reads. Webhook acceptance is `accepted_unverified` until a persisted task ID is confirmed.
- The same preflight dialogue now supplies guarded single/bulk submission (one at a time, stops on uncertainty) and a memory-only 5-minute GHL task snapshot store for Workbench.
- Workbench displays `Not checked` when no verified GHL task readback exists, never stale Captain's Log task presence.
- Legacy Captain's Log/Supabase automatic runtime mounts, Workbench cloud membership/snooze/reschedule writes, review cloud dates, company summary publication, client activity refresh and old Supabase recovery UI were removed from active Compass routes.
- The remaining data-import cloud registry has been retired in `src/lib/compass/company-identity.ts`. A new import-graph CI test checks that active Client Compass routes cannot reach prohibited Captain's Log/Supabase cloud modules.
- Report rendering, device inventory and local backup/recovery remain unchanged.
- No DigitalOcean deployment, no authenticated GHL smoke test, and no verified task readback has occurred with the tools available here.

**The code checkpoint is not production acceptance.** The deployment domain/component, DO secret configuration, GHL workflow mapping, actual duplicate guard, task-owner/due-time persistence, and end-to-end smoke test must all pass before a release. Public repository files can exist with legacy code if not imported by active Compass routes; separately scheduled full source cleanup is still desirable. Preserve any unrelated standalone Captain's Log/Supabase apps.
