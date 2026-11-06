# DigitalOcean GHL read-only API: draft integration

**Status: code prepared, NOT deployed or tested against live GHL.**
This is part of draft PR #79 and is NOT the final Client Compass cutover.

## Existing architecture and design decision

The Client Compass app uses `next.config.ts: output: "export"` and runs as a **static PWA**. A static site cannot safely read a private GHL key from an environment variable at browser runtime.

The existing GHL Draft workflow **Client Compass | Coordination Task Intake** remains the intended **task-creation route**. Do not publish or alter it as part of this read-only integration.

New code lives under `services/ghl-read-api/`. It is a **separate Node service component in the same DigitalOcean App Platform app and repository**, not a replacement for the static site, not a database, and not a Supabase or Captain's Log dependency.

### Source files

- `ghl-provider.mjs`: allows only fixed GHL **GET** operations to list existing businesses, read a business, list its associated contacts, and read contact tasks.
- `handler.mjs`: strictly authenticated `POST /api/ghl/businesses/matches` and `POST /api/ghl/tasks/read`, JSON input, read-only results, origin restriction, generic errors, no sensitive caching.
- `server.mjs`: minimal DigitalOcean Node HTTP process on `0.0.0.0:8080`, or `PORT` provided by the host.
- `tests/ghl-read-service.test.mjs`: all upstream GHL calls mocked; no credentials or real GHL records.

### GHL scopes

The Private Integration should have only `businesses.readonly` and `contacts.readonly` initially. The existing GHL workflow, not this API, creates tasks.

Official GHL paths as of 2026-11-06:
- `GET /businesses/?locationId=...&skip=...&limit=100` (complete existing-business enumeration; 30-page safety ceiling)
- `GET /businesses/:businessId`
- `GET /contacts/business/:businessId?locationId=...&skip=...&limit=100`
- `GET /contacts/:contactId/tasks`

The business-matching endpoint returns exact normalized-name candidates only; the browser explicitly confirms the correct GHL business. The task reader independently validates the existing business and **exact company name** before returning any contact tasks. For ambiguous associated contacts, the user must choose a contact ID before readback.
- GHL API origin: `https://services.leadconnectorhq.com`, `Version: v3`.

### Secure runtime environment variables (no literal values in GitHub)

All values belong on the **new DO Service component**, encrypted where noted and scoped **RUN_TIME only**. If you already added the GHL token to the existing *static site* component, also attach it **only to this new server-side service** at runtime; never let static site build code consume it.

| Name | Scope | Secret? | Purpose |
| --- | --- | --- | --- |
| `GHL_PRIVATE_INTEGRATION_TOKEN` | RUN_TIME | YES, encrypted | Read-only GHL Private Integration Token |
| `GHL_LOCATION_ID` | RUN_TIME | Can be general | Advantage Technologies GHL sub-account/location ID |
| `CLIENT_COMPASS_ALLOWED_ORIGIN` | RUN_TIME | Can be general | Exact HTTPS origin of the PWA, e.g. `https://compass.example.com`; no trailing slash |
| `CLIENT_COMPASS_READER_ACCESS_TOKEN` | RUN_TIME | YES, encrypted | Independent high-entropy access secret of 32+ characters for the **reader**; **not** the GHL token |

The GHL key alone **does not** unlock the read endpoint. Without all four settings, it responds `503 not_configured`. A wrong access secret receives `401`. A different browser Origin receives `403`.

The reader-access token is a **temporary shared authentication gate**, not employee-level SSO. It must be entered manually by an authorized operator, held in memory only while needed, never compiled into the static PWA or committed to GitHub. Implement verified employee SSO or an approved access proxy before broad rollout. Anyone who obtains the independent reader token could access sensitive GHL task data, so restrict who can use it and rotate on compromise.

### Proposed DO service component (do NOT deploy from draft PR)

In DigitalOcean App Platform, add a **Service** to the *existing* Client Compass app. Use the existing GitHub repository and a reviewed commit/branch, with:

- Source: repository root
- Run command: `node services/ghl-read-api/server.mjs`
- Public HTTP port: `8080`
- HTTP route path: `/api/ghl`; leave static PWA on `/`. DigitalOcean may strip that prefix by default. This handler accepts both `/tasks/read` and `/api/ghl/tasks/read`, plus their health paths. To preserve the full path, set `preserve_path_prefix: true` in the DigitalOcean App Spec (this setting is not offered in the Control Panel). Confirm behavior with the health endpoint.
- The four environment variables above: runtime scope, secrets encrypted
- Do not turn on deployment from the draft branch before authorization

With routing correctly set, the public URL `GET /api/ghl/health` should return `{"ok":true,"service":"ghl-read-api"}`. DigitalOcean may forward the route internally as `/health`; neither response reveals configuration or token status.

`POST /api/ghl/tasks/read` accepts only a small JSON body:
```json
{
  "clientId": "compass-0001",
  "businessId": "existing-ghl-business-id",
  "selectedContactId": "existing-ghl-contact-id"
}
```
`selectedContactId` may be omitted; if multiple existing contacts belong to the business, the response reports `ambiguous_contact` and allows the UI to request an explicit selection. **No contact is created**.

The request must contain:
- `Authorization: Bearer <independent-reader-access-token>` (NOT the GHL key)
- `Content-Type: application/json`
- When sent by the browser, `Origin` must match `CLIENT_COMPASS_ALLOWED_ORIGIN`

Response is always private, `Cache-Control: no-store`. API errors, incomplete lists, and unverified associations are never presented as zero tasks.

## Still blocked / next steps

1. **Verify DO runtime**: This repo contains no DigitalOcean connector, and editing GitHub does not deploy a DO service. Runtime secrets and component routing have NOT been verified.
2. **Secure employee authentication**: This scaffold uses a separate access secret, not Entra SSO. A public read endpoint must stay locked until an approved identity gate is configured.
3. **Confirm GHL_LOCATION_ID and exact PWA origin** against actual DO/GHL settings. The prior CLV blueprint provides a location ID; it still must match the Private Integration token's live sub-account.
4. **Verify and accept company mapping through the new UI**. Exact-name discovery offers existing candidate businesses, and a selected ID is reverified by the server for name, location and contact association. Never treat old Supabase UUIDs or fuzzy name matches as proof.
5. **Read-only smoke test** of one known existing company/contact after service deployment is authorized, verifying correct associations, owner, and scheduled/overdue/completed tasks. This is not yet done; CI uses mocked GHL responses.
6. **PWA read UI is wired in this draft.** It accepts the *separate reader-access secret in memory only*, finds exact business candidates, allows explicit selection, verifies associations and displays existing task statuses. It remains Not checked until a real authenticated DO read succeeds; no GHL private key is entered in the PWA.
7. **GHL workflow for creation remains Draft** until its mapping, timing, and duplicate handling pass controlled testing; do not bypass it with this read service.
8. **Finish total removal of Supabase and Captain's Log from Client Compass**, including legacy sync and all task/workbench paths, before final cutover. No fallback or dual-write.

There is **no Supabase, Captain's Log, database, task-creation endpoint, or generic API proxy** in the new service.

## Deployment target ambiguity found during source review

The public Client Compass repository README labels this code as a historical/legacy Compass source, while the private `SiminanRoll/client-success-os` README describes Client Success OS as the native unified work surface (both READMEs may lag November 2026 working decisions). Therefore do not assume that adding the service to any DigitalOcean app will connect the PWA the user currently operates. Verify which actual DO component/domain the user called Client Compass before changing app routing or deploying this code. This draft branch deliberately changes neither CSOS nor an existing DO deployment.


## CLV master directive deployment cross-check (2026-11-06)

Read-only sources checked in the connected GitHub account:

- `SiminanRoll/captains_log/CLV_DIRECTIVE.md`, section 9: identifies `SiminanRoll/client-success-os` as the primary unified interface and `SiminanRoll/Proposal-and-Report-Generator-` as the legacy Client Compass/presentation source.
- `SiminanRoll/captains_log/docs/ai/CLV_PLATFORM_STATE.md` and `docs/ai/CLV_SYSTEMS_REGISTRY.md`: distinguish the standalone Client Compass implementation from CSOS and explicitly require runtime evidence rather than inferring deployment from commits.
- The historical Compass repository README identifies `oyster-app-xql5x.ondigitalocean.app` as an OTA Tracker / Signal Intelligence reference runtime, **not authoritative proof that the root URL currently hosts the PWA**.
- `SiminanRoll/client-success-os` is a separate private repository; do not automatically attach this draft service to its DigitalOcean app.

**Result:** GitHub documents repository ownership and some DigitalOcean reference runtimes, but the inspected CLV master directive and registry do **not** uniquely establish the current standalone Client Compass PWA hostname, actual DigitalOcean App Platform app ID, or component routing. Do not invent these values or attempt production deployment based on hostname similarity. Confirm the DigitalOcean app/component through the real App Platform deployment configuration using authorized DO access.

The Advantage Technologies GHL sub-account location identifier is known from the GHL implementation blueprint and need not be requested from the user again. Configure it under `GHL_LOCATION_ID` as a DigitalOcean runtime variable; no Private Integration Token belongs in this repository.

### New exact-name business endpoint

`POST /api/ghl/businesses/matches` accepts up to 50 `{clientId, companyName}` entries per request, paginates existing businesses in the configured GHL location and returns only exact normalized-name candidates. Unmatched and duplicate names remain explicit. No business is created or silently selected. Same bearer-access and origin checks as task readback apply.
