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

## Production blockers (not resolved)

1. Verify existing GHL business IDs and associated contacts securely. Do not reuse Supabase company UUIDs as GHL business IDs.
2. Implement authenticated GHL contact task readback with company/contact/review-cycle mapping, due dates, overdue and completed states.
3. Confirm draft workflow JSON-body mapping, exact date/time behavior, owner, task details, CORS/browser compatibility.
4. Implement durable/atomic duplicate prevention for retries and concurrent requests.
5. Verify task creation plus persisted readback by task ID before claiming success.
6. Reconcile previous local-only src/lib/compass/client-success-batch.ts and tests/client-success-batch.test.mjs before merge to avoid competing bulk logic.
7. Remove ALL Captain's Log and Supabase dependencies from Client Compass before final cutover: API, credentials, background sync, task writes, Workbench scheduling, client workspace data, models and UI. No fallback, dual-write or shadow synchronization.
8. Obtain separate approval for live testing, workflow publishing, merge and deployment.

Other legacy Client Compass paths remain on this preview branch; this is not the completed no-Supabase cutover. Do not deploy this branch as a finished product.
