# Client Compass → GoHighLevel browser-local integration

**User-approved architecture, November 6, 2026:** The Client Compass PWA stays a **static-only** Next.js export hosted at `https://dolphin-app-p8jzc.ondigitalocean.app/`. It uses a **user-entered GHL Private Integration Token saved in this browser's localStorage**. No DigitalOcean service, server runtime, GHL key in GitHub/build environment, Supabase or Captain's Log data path.

**Status:** Code implemented in draft PR #79, not merged or deployed. Tests are mocked and do NOT establish that GHL accepts authenticated cross-origin browser requests. No live tasks have been created.

## How it works

1. Open the **Coordination task preflight** dialog from the blue plus or Map Clients/Workbench bulk selection.
2. In **GHL connection on this device**, enter the Private Integration Token, GHL sub-account Location ID and Patric's GHL user ID. Explicitly acknowledge the local-storage security risk. Save locally.
3. Click **Test GHL connection and find businesses**. Client-side code calls fixed `GET https://services.leadconnectorhq.com/businesses/?locationId=...`, using the locally stored bearer token. **No key is in source code, HTML, static build output, or a NEXT_PUBLIC variable.**
4. Select the exact matching existing business. Existing mapping ID is stored locally, not treated as proof of association; every read rechecks the actual GHL business and location. The existing company, related contacts and contact tasks are read using fixed GHL v3 GET endpoints. When multiple contacts exist, choose the intended contact explicitly. No contacts or companies are created.
5. Enter explicit task title, details, local due date/time and timezone; click **Run offline preflight**. Task counts and duplicate warnings are shown only after successful authenticated GHL readback.
6. Enter Patric's GHL user ID in local settings (required for assignment). Check the separate authorization box and click **Create task in GHL**. Immediately before each write, the browser re-verifies existing GHL company/contact/task data and blocks possible overlapping tasks.
7. A direct GHL `POST /contacts/:contactId/tasks` creates the task with ISO UTC due time and explicit `assignedTo`. A local persistent ledger marks the request **pending before posting** to prevent accidental automatic retries. After GHL returns a task ID, an authenticated GET reads back that ID, title, assigned user and due time. Unknown network results must be inspected in GHL before a new attempt; the browser never retries automatically.

## What this deliberately does not do

- This direct API path does **not** invoke or alter the existing published **Client Compass | Coordination Task Intake** GHL workflow. Both must not create the same task. GHL is still the task record system.
- It does not promise atomic deduplication between browser devices. A fresh read plus a per-device pending ledger reduces duplicates but cannot prevent simultaneous requests from other GHL users or devices.
- It does not provide robust credential isolation. A Private Integration Token stored in localStorage can be read by page JavaScript, injected scripts, browser extensions, or someone with access to the user's device/browser. This tradeoff is explicitly acknowledged by the user in the UI. Use a narrowly scoped, sub-account-only token; rotate immediately if compromised. Never store tokens in source, GitHub, DigitalOcean static environment variables, query strings, or error logs.
- It cannot bypass CORS. Browser `fetch` with the `Authorization` and `Version` headers triggers an OPTIONS preflight. GHL's cross-origin behavior from the DigitalOcean origin must be verified in the actual browser. If blocked, this direct design cannot work from a static site; an approved separate trusted environment would then be needed. **Do not use a public proxy or expose the workflow webhook URL as a workaround.**
- It does not ask for a GHL-hosted form; that proposal was superseded by the user's local-token direction.

## Private Integration scopes

Required for this direct design: `businesses.readonly`, `contacts.readonly` and **`contacts.write`**. The previously configured read-only token may need a `contacts.write` permission added inside GHL. No broad agency scopes are required.

The assigned user ID can be copied from the existing GHL user record once, then saved in local settings. The code does not invent or hardcode a GHL user ID.

## Deployment and test

- Deploy the static site from the reviewed PR and perform a hard refresh at the existing DigitalOcean URL.
- Test **business listing first**. If browser reports CORS/network failure, stop; do not attempt task creation.
- For one known existing practice, verify business and selected contact, inspect existing task readback, prepare one task due at a known local date/time, confirm authorization and create it.
- Verify the task ID, title, Patric assignment and exact UTC due date in GHL. Test a repeat to confirm the local ledger/duplicate checks stop an unintentional second create.
- Only after a single verified success, use bulk operations.
- CI includes typecheck, `tests/ghl-browser-api.test.mjs`, other GHL offline tests, a static-build credential guard, active-route legacy-cloud import guard, and a complete static export build.

No backend code/service is present. The old private GHL token reported in DigitalOcean is **not consumed**; delete it from the static site's environment variables if unused.
