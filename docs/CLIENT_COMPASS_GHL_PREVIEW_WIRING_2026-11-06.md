# Client Compass → GHL static-only handoff (2026-11-06)

**Authoritative constraint:** Client Compass is a Next.js `output: "export"` static PWA hosted on DigitalOcean at the user-supplied address `https://dolphin-app-p8jzc.ondigitalocean.app/`. It must **not** acquire a Node API service or another backend. No Supabase or Captain's Log connection.

**Status:** Draft PR #79. Static build and offline tests only; no confirmed deployment, GHL-native form link, live GHL task read, or end-to-end task creation test.

## Implemented in the static app

- Map Clients / Project Coverage single and bulk selection open the same local coordination-task preparation dialog.
- Users can enter a task title, description, local due date/time, and timezone. The existing pure offline preflight checks the data and fails closed if GHL business/contact identity was not independently verified.
- A **Copy task details** button preserves the selected clients, title, details, due date/time and timezone so an authorized operator can submit in GHL.
- A **GHL form link** can be presented when a public, non-secret `NEXT_PUBLIC_GHL_TASK_REQUEST_FORM_URL` is configured at **static build time**. Until then, the interface accurately says the form link is not configured.
- No static source can call the GHL Private Integration API or the private inbound webhook. No private token or webhook URL is embedded in the PWA.
- All active Client Compass runtime paths are guarded by `tests/client-compass-no-legacy-cloud-runtime.test.mjs` against reachable Captain's Log/Supabase modules. Hardware import still works with local Ninja/company matching. Other standalone apps are unaffected.

## GHL-native task intake required

The user reported that the **Client Compass | Coordination Task Intake** workflow is now **published**. That does **not** establish a GHL-hosted form or a Form Submitted trigger. For a secure static-only workflow:

1. In GHL **Sites → Forms**, configure a **native GHL coordination-task request form** with required contact matching identifiers and the task title, details, due date/time, timezone, client ID and request ID as supported custom fields.
2. In GHL, add a **Form Submitted** trigger (with an exact form filter) to the existing task-creation workflow or a GHL-only wrapper that routes into its existing actions. Do not replace the established task-creation workflow. Avoid creating duplicate contacts or tasks, and validate the existing contact and company association inside GHL.
3. Verify durable duplicate detection, task assignee, due date/time, time zone, exact request-ID markers, and actual GHL task record. The server-side GHL workflow must be authoritative. Form submissions alone are **not** proof of task persistence.
4. Copy the form's publicly shareable GHL link from its Integrate tab and set the **non-secret** `NEXT_PUBLIC_GHL_TASK_REQUEST_FORM_URL` on the existing DigitalOcean **static site** component. Trigger a new static build to bake the link into the PWA.
5. Perform one controlled task submission and inspect the workflow execution log and created contact task. Only then enable routine/bulk use.

A public GHL form link is designed for browser use, whereas a **Private Integration Token or unique inbound webhook URL is not**. A GHL form may create or update contact records depending on its GHL configuration; test matching carefully against existing clients.

## What a static site cannot do

- Store or use `GHL_PRIVATE_INTEGRATION_TOKEN` safely in JavaScript. A DigitalOcean **build-time** environment variable becomes public if embedded in the bundle. The already-configured private key is **unused** by this design and should be removed from the static component if it has no other server-side consumer.
- Read arbitrary private GHL businesses, associated contacts, or scheduled/completed tasks directly from the browser. Use the **authenticated GHL application** for authoritative task awareness unless a separately approved existing trusted integration is explicitly identified. Do not fake task counts, live status or duplicate protection.
- POST directly to the unique published inbound webhook URL without revealing it in the static bundle/network panel; browser CORS may additionally block the request.

## Explicit removals from PR #79

A previous iteration added an **unapproved** DigitalOcean API service, reader and writer credentials, and private workflow relay. Those files, buttons, tests and deployment instructions have been removed in response to the user's static-only constraint. The remaining code is frontend-only and offline. There is no DigitalOcean service deployment step.

## Release gates

1. Confirm the updated static site is the right production application and run baseline hardware data/import, Workbench, map, reviews and report acceptance after deployment.
2. Inspect the live published GHL workflow. Verify the native form trigger, field maps, task creation and duplicate control.
3. Configure the public GHL form link at build-time and deploy this static PR to the right DigitalOcean static component.
4. One live task creation + GHL task readback by an authorized operator, then bulk acceptance.
5. Compare the unpushed Windows local `client-compass-ghl-cutover` worktree UX before merging. Do not overwrite unpushed work.
6. Keep PR draft and unmerged until deployment and acceptance are approved. Existing OTA Performance test failures unrelated to GHL remain a separate issue.

HighLevel's documentation confirms GHL-hosted forms can be embedded/shared on external websites and Form Submitted workflow triggers can invoke actions. No GHL native form or workflow configuration has been changed by this PR.
