# Client Compass → Client Success Dashboard (GHL) cutover: read-only audit

**Status:** BLOCKED — not cut over. **Date:** 2026-11-05.
**Scope:** GHL task creation (single/bulk), contact identity, and eventual relationship/task read-side migration.
**Safety:** This audit has not created a GHL task, contacted a client, published a GHL workflow, or changed live GHL records.

## Source audit: GitHub main, version 1.3.1

- package.json declares version 1.3.1.
- next.config.ts uses output: "export". Client Compass has a static Next.js export and no server-side API route.
- src/lib/compass/captains-log-task-write.ts writes directly to Supabase tasks; ensures a Supabase company UUID using RPC ensure_company_identity, then inserts with conflict-ignore and reads the saved row back.
- src/lib/compass/captains-log-bridge.ts calls that writer and merges Captain's Log task/activity and contact fields into client state.
- src/lib/compass/captains-log-queue.ts stores pending items in browser localStorage. This is not a server-side idempotency ledger.
- src/lib/compass/captains-log-cloud.ts handles Supabase authentication and REST.
- src/lib/compass/captains-log-current-state.ts and captains-log-account-review-sync.ts read tasks/task events.
- src/components/compass-sync-runtime.tsx and compass-sync-runtime-v1139.tsx poll Supabase tasks and reconcile company identities, task history, account-review resolution and relationships.
- src/components/workbench-page.tsx displays Captain's Log tasks and modifies task schedules through Supabase events.
- src/components/compass-client-review-workspace-v10941.tsx synchronizes Captain's Log activity and client contact/review details.
- src/components/client-workspace-layout-runtime.tsx still includes a Captain's Log panel.
- src/lib/compass/types.ts contains Captain's Log task, activity and client-state models.
- Hardware lifecycle remains in Compass data/engine; do not overwrite it with GHL relationship data.

## Sources NOT directly accessible

- Local-only branch client-compass-ghl-cutover at C:\Users\patri\Documents\Codex\2026-10-30\lead\work\client-compass-ghl.
- Its reported bulk-task helper src/lib/compass/client-success-batch.ts and tests/client-success-batch.test.mjs. The files/branch are absent on published GitHub main; do not recreate or replace them without inspecting the actual local worktree.
- The authenticated draft GHL workflow "Client Compass | Coordination Task Intake" (id 93c78e1d-8716-466f-8735-903e19fd8e97). A working LeadConnector/GHL connector is unavailable. All known draft details are user-provided, not verified here.

## Vendor API findings

CRM contact-task API:
- POST /contacts/{contactId}/tasks accepts title, body, dueDate as ISO 8601, completed and assignedTo; returns task.id.
- GET /contacts/{contactId}/tasks/{taskId} can verify task ID, assigned user, date and contact after creation.
- GET /contacts/{contactId}/tasks lists existing tasks.
- Authenticated bearer-token access is required; a static frontend must not contain a private token.

Identity API:
- GET /businesses/{businessId} verifies an existing GHL business.
- GET /contacts/business/{businessId} lists contacts associated with that business.
- Existing Client Compass companyId is a Supabase identity UUID, not automatically a GHL businessId.
- A contact may have multiple company relations. Do not choose by name alone or silently choose the first associated contact.

Exact dates:
- The CRM task API accepts an absolute ISO 8601 due date; normalize a selected wall-clock date/time using an explicit timezone and verify the persisted result.
- The GHL Task Management support article documents a Dynamic Mode in the Add Task workflow action for a supplied date/time. The mode and saved workflow mapping have not been inspected in this sub-account.

Alternative GHL Project Management Tasks API accepts both businessId and contactId, but this is a DIFFERENT task module from contact tasks. Confirm which tasks are expected in the existing Client Success Dashboard before choosing APIs.

References:
- https://marketplace.gohighlevel.com/docs/ghl/contacts/create-task/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/get-task/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/get-all-tasks/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contacts-by-business-id/
- https://marketplace.gohighlevel.com/docs/ghl/businesses/get-business/
- https://help.gohighlevel.com/support/solutions/articles/155000004498

## Core integration blocker

Requested automatic path:
Static Compass UI → authenticated identity lookup → durable idempotency → task creation → task readback → individual results.

No secure trusted execution boundary for this chain is present.

- Do not compile a private integration token, OAuth client secret, refresh token or sensitive inbound webhook URL into publicly served JavaScript or browser localStorage.
- The GHL inbound webhook URL is effectively a bearer capability. A leaked URL can be used by others to trigger the workflow; a browser CORS response does not provide authorization.
- A webhook HTTP acknowledgment is intake only. It is not proof that an Add Task action ran, preserved the date, used the correct owner or created a unique GHL task.
- LocalStorage-only duplicate checks do not serialize concurrent requests across devices or retries; GHL custom fields/tags cannot be presumed atomic.
- Marketplace OAuth documentation describes token exchanges using a client secret. A browser-only secure private API connection has not been established under these constraints.

Vendor references:
- https://help.gohighlevel.com/support/solutions/articles/48001237383
- https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/

## Concrete implementation choices — no option approved yet

A. Native GHL execution only (interim, fully within the no-new-service rule):
Operate from an authenticated GHL contact record/action field or supported GHL bulk enrollment. GHL performs Add Task internally. Compass can show verified existing CRM records and an action link. No GHL secret/webhook in Compass. This DOES NOT give the static Compass interface reliable automatic one-click bulk creation, atomic idempotency, or GHL task-ID confirmation back into Compass. Exact due-date dynamic mapping still requires in-account verification.

B. Trusted local desktop bridge (conditional, NOT implemented):
Keep the Next static export and use an approved native desktop integration with OS-protected GHL credentials, business/contact lookups, durable local request journal, exact-due-date task API, and readback. No separate hosted service or Supabase task path. Requires a review of actual desktop packaging and authorization; cross-device idempotency remains a design challenge.

C. Narrow authenticated serverless gateway (best for full autonomous batch semantics, but NOT ALLOWED by current user constraints):
Store GHL token securely server-side; verify company/contact, use an atomic idempotency ledger, create/read back tasks and return per-client results. This is a separate hosted service and would require explicit user authorization to change the constraint. Supabase remains excluded.

Do not silently pick an option, or publish the draft GHL webhook as a workaround.

## Contract for safe individual/bulk task processing

Input fields: compassClientId; verified ghlBusinessId; verified ghlContactId; taskType=coordination_call; title; details; dueLocalDate; dueLocalTime; IANA timeZone; assignedTo (GHL user ID); stable requestId; stable intentKey associated with the review cycle.

Required flow:
1. Map Compass client to a verified EXISTING GHL business ID. Do not convert Supabase company UUID into a GHL ID or match by name alone.
2. Read linked contact candidates, verify that the intended contact belongs to the specific business. Stop on zero or multiple valid candidates unless a verified explicit mapping or user choice resolves it.
3. Validate owner, task content, due date/time and timezone. Never silently default an invalid due date to today.
4. Acquire durable idempotency/serialization for client + task type + date/time + review-cycle intent. Repeated selections and retries of the same intent return the original task, not a second new task.
5. Create a task using the chosen CRM task API, then read it back by contact ID and task ID.
6. Compare persisted due date, title, assignee, contact ID and any supported business association. Only after verification mark the task created.
7. Return ONE result per client, even if another batch item fails: created, already_exists, unresolved_business, ambiguous_contact, invalid_due_date, invalid_owner, unverified_association, pending_verification, or failed.
8. Preserve owner/user ID, company association, selected due date and original details in the same task record. No new contact or company creation.

## Gated next steps

1. Inspect the local-only branch/helper/tests before implementing bulk behavior, avoid overlapping existing work.
2. Read-only inspect the actual GHL draft: webhook input reference, Find Contact identity guard, branching, Dynamic Due In, assignee values and any auto-create-contact behaviors.
3. Read-only verify the mapping for one known company and its GHL contact candidates.
4. Choose execution strategy A, B or C explicitly. Until then, do not connect a live send button to the static app.
5. Request approval for publishing AND a live test. After approval only, test one fictional/controlled company/contact task, verify exact due date/owner/association/task ID, then retry the SAME request and confirm zero duplicates.
6. Migrate writes, read parity, related workbench/client screens, then legacy sync in stages. Preserve Compass inventory/hardware lifecycle source and keep rollback available.
7. Remove Supabase/Captain's Log task and relationship references only after an end-to-end GHL path is verified and old/new task history reconciles.

**No task workflow should be published and no cutover should be announced based only on the draft webhook mapping or a frontend batch helper.**


## 2026-11-06: Webhook-first PWA direction (investigation, NOT approved live cutover)

User clarified Client Compass runs as an installed Progressive Web App with data stored on the computer, and asked to proceed investigating the existing GHL workflow webhook rather than first building a native desktop helper.

**What this changes:** Runtime-entered integration settings can stay out of the PUBLIC COMPILED SOURCE, and there is no immediate requirement for a hosted task-creation service. This can simplify the UI experience.

**What this does NOT change:** An installed PWA runs normal browser JavaScript from the app's origin. LocalStorage/IndexedDB/sessionStorage are not secret vaults, and malicious same-origin code, browser extensions with broad access, or device access can expose locally held secrets. PWA installation does not provide OS Keychain, bypass CORS, authenticate inbound workflow requests, or make webhook acceptance equivalent to task completion. Never hardcode an intake webhook URL into the GitHub repository or public Next.js bundle.

### Workflow-first intake contract to verify in the existing draft

Expected values for one request (do not assume these are already mapped in the sample):
- requestId: stable opaque ID reused on retransmission of the SAME request.
- compassClientId: local client identifier, not a GHL ID.
- ghlBusinessId: verified existing business record ID.
- ghlContactId: verified, selected existing associated contact ID.
- ownerUserId: existing GHL assignee ID.
- dueDateLocal: exact YYYY-MM-DD selected in Compass.
- dueTimeLocal: an explicit time selection (do not silently invent a time).
- timeZone: IANA zone such as America/Chicago.
- dueAt: exact ISO timestamp if known; use the workflow-supported required dynamic format only after mapping is confirmed.
- title and description: the exact coordination task content.
- intentKey: stable key identifying a coordination task for one client/review cycle; must not be regenerated on retries.

GHL actions to audit:
1. Inbound Webhook trigger: existing mapping reference saved; do not publish for audit.
2. Find Contact using webhook ghlContactId. Do NOT add Create/Update Contact, and end on not-found.
3. Verify association to the intended EXISTING GHL business. Finding a contact ID alone does not prove company association. Missing/ambiguous mapping must halt, not guess.
4. Any duplicate guard must be tested for concurrent retry and repeated selections. Workflow tags, one-off checks, and PWA localStorage alone are NOT proven atomic.
5. Add Task action: inspect its "Due In" **Dynamic Mode** (documented by GHL). Map selected date and time only after confirming the accepted exact format and actual behavior in this account. Set assignedTo to verified user. Include stable request ID in task description if feasible for independent verification.
6. Suppress all message/call actions. Do not start other workflows or create companies/contacts.

Official docs:
- https://help.gohighlevel.com/support/solutions/articles/155000004498 (Add Task Dynamic Mode supports a specific date/time).
- https://help.gohighlevel.com/support/solutions/articles/48001237383 (Inbound Webhook trigger, Find Contact by contact ID, JSON mapping, premium executions; compromised URL can be rotated).
- https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/ (installed PWAs remain browser technology and can use static hosting).

### Go/no-go tests requiring separate user approval

1. Examine screenshots/read-only configuration of the specific draft workflow, including saved inbound mapping, Find Contact, and Add Task Dynamic Mode. Do not submit live payload yet.
2. Assess direct browser fetch feasibility using the ACTUAL app origin and ACTUAL webhook endpoint, including CORS preflight. Public GHL docs do not establish cross-origin browser access. Do not assume a successful server-to-server webhook sample demonstrates CORS.
3. Do not record webhook URL in GitHub, screenshots, comments, logs, URL query parameters, or a publicly accessible environment variable. A user-entered runtime URL is not bundled in source, but storing it in browser storage still has exposure risk. Start with in-memory per-session configuration only unless user explicitly accepts persistent browser storage risk.
4. Once approved, perform a controlled single request through the actual PWA to a known EXISTING GHL test contact/business, then verify the resulting task in GHL itself including ID, assignee, date/time, title, description, and correct business/contact relationship.
5. Repeat the same request ID and then test a concurrent duplicate; verify a single task exists. If GHL cannot enforce a reliable idempotency guard, webhook-only cannot satisfy the original durability requirement.
6. Only then consider enabling the real send control and multi-client queue, preserving independent per-client results, retries, and explicit "accepted / pending verification" rather than claiming success on receipt.
7. If exact association, atomic deduplication or readback cannot be achieved with webhook-only, keep the PWA static and add a narrowly scoped **trusted local verification path** or seek explicit approval to relax one requirement. Do not silently compromise requirements.

**Known limitation of webhook-only PWA:** A static page that can only POST to a GHL workflow has no authenticated task readback. Without another authenticated pathway, it can show "request delivered" but CANNOT independently prove task created, due date saved, or exactly-once delivery. The design is not ready for production cutover until this gap is resolved.

### Inputs needed from user (no secrets)

- Screenshots or a redacted screen recording of the existing draft's inbound field-mapping reference, Find Contact match and both outcomes, and Add Task editing panel with Dynamic Mode and assigned user.
- If available, a sanitized copy of the previously received fictional webhook sample's FIELD NAMES only, excluding the actual webhook URL, tokens and real client details.
- Before any workflow publishing or live task tests, a separate explicit authorization identifying a controlled existing GHL test contact/company. Do not assume "proceed" authorizes live side effects.

Until these are provided, prepare documentation/contract only; do not create a competing implementation of local-only client-success-batch.ts that has not been inspected.
