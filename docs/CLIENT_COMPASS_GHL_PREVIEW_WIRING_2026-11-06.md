## v1.3.5: saved task defaults and GHL 401 handling

- **Configured once:** In **Settings → Backup & Recovery → GoHighLevel connection → Default coordination task**, set title, description, due after N business days (weekends skipped for positive offsets), time of day, and time zone. Defaults are `Coordination Call`, an empty description, and the next business day at 10:00 Central.
- **One-click daily workflow:** The Add Task dialog no longer asks for the date, time, title or notes. It shows a concise summary of the saved rule and one Add Task button; the due date is recalculated at click time in the configured time zone. Existing contact verification, duplicate detection, local no-retry ledger, GHL task creation, and readback remain in place.
- **Protected Workspace:** Saved task template uses `client-compass.ghl-task-template.v1` and automatically participates in the existing browser-local Documents mirroring and selective Protected Workspace recovery, without changing existing client data.
- **HTTP 401/403:** GHL's definite 401/403 response on `POST /contacts/:contactId/tasks` now reports a rejected request, explicitly **not** an unknown result or a created task. The local pending marker is released so the user can correct their saved integration and retry. Actual network timeouts remain **uncertain** and must be checked in GHL before retrying.
- **Permissions:** GHL's official Create Task endpoint requires sub-account Private Integration authorization and `contacts.write`. A 401 may mean invalid/expired/wrong-sub-account token or missing authorization; verify credentials and scope in **GoHighLevel Settings → Private Integrations**. That permission cannot be granted by this static app. Do not paste credentials into support chats or GitHub.
- **Status:** No live GHL writes were performed in development; browser API acceptance depends on the user's saved GHL integration.

# Client Compass v1.3.3 — GHL Add Task

**Current implementation:** Standalone static-only Client Compass. No backend, GoHighLevel form, Supabase or Captain's Log task writer. GHL contact tasks are created by the official browser-direct GHL v3 API only after explicit **Add Task** click.

## Everyday experience

1. The first time, enter the sub-account GHL Private Integration Token, the location ID, and the assigned GHL user ID. Choose **Save connection**. The settings remain browser-local and are included in the existing Documents/Client Compass Data durable backup when connected and permitted. The connection setup stays collapsed thereafter, with a discreet **Connection settings** control to change or forget the token.
2. When selecting one or more Client Compass clients, the dialog first rechecks previously saved GHL contact links. For an unmatched client it searches GHL's existing Contacts by exact `companyName` or `businessName`, not only the separate GHL Businesses registry. A unique match is verified and remembered automatically; if multiple contacts are found, choose the correct contact once. The contact is never created or guessed.
3. Enter a due date, due time, task title (defaults to `Coordination Call`), and optional notes. Timezone defaults to Central, is saved locally, and can be changed behind the small timezone expander.
4. Click **Add Task** once. The app privately rechecks the GHL contact/company association and reads existing tasks; it blocks the same task title at effectively the same due date/time. It puts a local request marker in the ledger before POST to avoid unsafe automatic retries. Then it creates the task with an explicit assigned user, verifies the returned task ID, date and assignee, and displays a concise result.
5. The internal preflight parser and duplicate safety exist in code but there is no **Run offline preflight** button, diagnostic table, or extra confirmation checkbox.

## Local Work Folder backup

GHL credentials use `client-compass.ghl-local-credentials.v1`, contact mappings use `client-compass.ghl-local-mappings.v1`, and the request ledger uses `client-compass.ghl-submission-ledger.v1`. These localStorage keys match Client Compass's existing durable database/browserState collector. On setup and link changes, the app calls `saveDurableDatabaseMirrorNow` to update the existing `Client Compass Durable Database.json` in the authorized `Documents/Client Compass Data` folder. It does not create a new storage system or repeatedly request folder access.

**Privacy tradeoff:** The user's Private Integration Token appears in that local JSON backup and in downloadable master backups **in cleartext**. It is never in GitHub or Next.js static build configuration. Folder protection and trusted browser extensions/devices are necessary. localStorage does not isolate secrets from same-origin scripts. The app accurately reports when the Documents folder is disconnected or inaccessible, and still persists in browser storage.

## GHL boundaries and diagnostics

- Official v3 endpoints: `POST /contacts/search`, `GET /contacts/:contactId`, `GET /contacts/:contactId/tasks`, and `POST /contacts/:contactId/tasks`. Scope requirements: `contacts.readonly` and `contacts.write`; older Business registry methods still exist but are not required by the simple task flow.
- A Private Integration Token may not be accepted in cross-origin browser requests due to GHL CORS. This has not been proven from the actual DigitalOcean production origin. A CORS/network failure is shown as an error and no task is claimed created.
- Same-title/near-identical due-time duplicate checks and local retry markers are best efforts, not cross-device atomic deduplication. Unknown POST outcomes must be inspected in GHL before retrying.
- The separate published **Client Compass | Coordination Task Intake** GHL workflow is unchanged and not invoked by this direct-task UI, so it must not also create the same task.
- No live authenticated GHL API call/task write was made during source development. Do not infer successful production deployment from a GitHub merge or passing CI.

## Release

Version **1.3.3**: simplified one-action modal, automatic exact company contact matching, one-time browser settings, existing Work Folder backup integration. Focused browser API mocks, no-credential-in-static-build tests, TypeScript and Next static export CI verify source behavior; deployed production API behavior remains to be accepted in the browser.
