# DigitalOcean GHL read-only API: draft integration

**Status: code prepared, NOT deployed or tested against live GHL.**
This is part of draft PR #79 and is NOT the final Client Compass cutover.

## Existing architecture and design decision

The Client Compass app uses \`next.config.ts: output: "export"\` and runs as a **static PWA**. A static site cannot safely read a private GHL key from an environment variable at browser runtime.

The existing GHL Draft workflow **Client Compass | Coordination Task Intake** remains the intended **task-creation route**. Do not publish or alter it as part of this read-only integration.

New code lives under \`services/ghl-read-api/\`. It is a **separate Node service component in the same DigitalOcean App Platform app and repository**, not a replacement for the static site, not a database, and not a Supabase or Captain's Log dependency.

### Source files

- \`ghl-provider.mjs\`: allows only three fixed **GET** operations to the official GHL API.
- \`handler.mjs\`: strictly authenticated \`POST /api/ghl/tasks/read\`, JSON input, read-only results, origin restriction, generic errors, no sensitive caching.
- \`server.mjs\`: minimal DigitalOcean Node HTTP process on \`0.0.0.0:8080\`, or \`PORT\` provided by the host.
- \`tests/ghl-read-service.test.mjs\`: all upstream GHL calls mocked; no credentials or real GHL records.

### GHL scopes

The Private Integration should have only \`businesses.readonly\` and \`contacts.readonly\` initially. The existing GHL workflow, not this API, creates tasks.

Official GHL paths as of 2026-11-06:
- \`GET /businesses/:businessId\`
- \`GET /contacts/business/:businessId?locationId=...&skip=...&limit=100\`
- \`GET /contacts/:contactId/tasks\`
- GHL API origin: \`https://services.leadconnectorhq.com\`, \`Version: v3\`.

### Secure runtime environment variables (no literal values in GitHub)

All values belong on the **new DO Service component**, encrypted where noted and scoped **RUN_TIME only**. If you already added the GHL token to the existing *static site* component, also attach it **only to this new server-side service** at runtime; never let static site build code consume it.

| Name | Scope | Secret? | Purpose |
| --- | --- | --- | --- |
| \`GHL_PRIVATE_INTEGRATION_TOKEN\` | RUN_TIME | YES, encrypted | Read-only GHL Private Integration Token |
| \`GHL_LOCATION_ID\` | RUN_TIME | Can be general | Advantage Technologies GHL sub-account/location ID |
| \`CLIENT_COMPASS_ALLOWED_ORIGIN\` | RUN_TIME | Can be general | Exact HTTPS origin of the PWA, e.g. \`https://compass.example.com\`; no trailing slash |
| \`CLIENT_COMPASS_READER_ACCESS_TOKEN\` | RUN_TIME | YES, encrypted | Independent high-entropy access secret of 32+ characters for the **reader**; **not** the GHL token |

The GHL key alone **does not** unlock the read endpoint. Without all four settings, it responds \`503 not_configured\`. A wrong access secret receives \`401\`. A different browser Origin receives \`403\`.

The reader-access token is a **temporary shared authentication gate**, not employee-level SSO. It must be entered manually by an authorized operator, held in memory only while needed, never compiled into the static PWA or committed to GitHub. Implement verified employee SSO or an approved access proxy before broad rollout. Anyone who obtains the independent reader token could access sensitive GHL task data, so restrict who can use it and rotate on compromise.

### Proposed DO service component (do NOT deploy from draft PR)

In DigitalOcean App Platform, add a **Service** to the *existing* Client Compass app. Use the existing GitHub repository and a reviewed commit/branch, with:

- Source: repository root
- Run command: \`node services/ghl-read-api/server.mjs\`
- Public HTTP port: \`8080\`
- HTTP route path: \`/api/ghl\`, **Preserve Full Path** (otherwise the service receives rewritten paths and returns 404). Leave static PWA on \`/\`.
- The four environment variables above: runtime scope, secrets encrypted
- Do not turn on deployment from the draft branch before authorization

With routing correctly set, \`GET /api/ghl/health\` should return \`{"ok":true,"service":"ghl-read-api"}\` (without revealing configuration or credential status).

\`POST /api/ghl/tasks/read\` accepts only a small JSON body:
\`\`\`json
{
  "clientId": "compass-0001",
  "businessId": "existing-ghl-business-id",
  "selectedContactId": "existing-ghl-contact-id"
}
\`\`\`
\`selectedContactId\` may be omitted; if multiple existing contacts belong to the business, the response reports \`ambiguous_contact\` and allows the UI to request an explicit selection. **No contact is created**.

The request must contain:
- \`Authorization: Bearer <independent-reader-access-token>\` (NOT the GHL key)
- \`Content-Type: application/json\`
- When sent by the browser, \`Origin\` must match \`CLIENT_COMPASS_ALLOWED_ORIGIN\`

Response is always private, \`Cache-Control: no-store\`. API errors, incomplete lists, and unverified associations are never presented as zero tasks.

## Still blocked / next steps

1. **Verify DO runtime**: This repo contains no DigitalOcean connector, and editing GitHub does not deploy a DO service. Runtime secrets and component routing have NOT been verified.
2. **Secure employee authentication**: This scaffold uses a separate access secret, not Entra SSO. A public read endpoint must stay locked until an approved identity gate is configured.
3. **Obtain GHL_LOCATION_ID and exact PWA origin** from the actual DO and GHL settings, never guess.
4. **Map existing Compass client IDs to verified GHL business IDs**; never treat old Supabase company UUIDs or name matches as proof.
5. **Read-only smoke test** of one known existing company/contact after service deployment is approved, verifying correct associations, owner, and scheduled/overdue/completed tasks. This may access live client data and should be performed only in the authorized environment.
6. **Wire PWA UI** to the authenticated read service with user session authentication; no GHL key or permanent reader secret in the PWA. Existing preview remains marked \`Not checked\` until a real trusted read is available.
7. **GHL workflow for creation remains Draft** until its mapping, timing, and duplicate handling pass controlled testing; do not bypass it with this read service.
8. **Finish total removal of Supabase and Captain's Log from Client Compass**, including legacy sync and all task/workbench paths, before final cutover. No fallback or dual-write.

There is **no Supabase, Captain's Log, database, task-creation endpoint, or generic API proxy** in the new service.
