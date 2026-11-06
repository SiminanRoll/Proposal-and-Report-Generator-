# Client Compass to GHL task preview wiring (November 6, 2026)

Status: **draft branch only; not deployed; no GHL requests or task writes.**

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
