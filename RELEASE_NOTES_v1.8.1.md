# Client Compass v1.8.1 — Captain's Log sync and lightweight CRM

## Client workspace
- Reduced the client workspace to a lightweight account-review CRM: primary contact, email, phone, last account review, next follow-up, and one relationship note.
- Removed the large visible relationship-status/contact-management surface from the primary workflow.
- Moved technical inventory, project context, and report/review tooling into collapsed detail sections.

## Captain's Log connection
- The primary browser-to-desktop transport is now an interactive localhost handshake with Captain's Log V836 while the desktop app is running.
- The handshake returns a confirmed result to Client Compass instead of treating a URL launch as proof that a task was created.
- Client Compass checks for an existing open Coordination Call before creating another one.
- A confirmed Captain's Log match can sync the canonical company, primary contact, current Coordination Call, recent activity, and explicit completed account-review date back into Client Compass.
- Client matching stays conservative: a weak match is left unlinked rather than attached to the wrong company.
- Work created from Client Compass remains `Client Coordination` / `Call`. “Account Review Priority” is context in the title/notes, not a task type or proof that the review occurred.

## Dashboard and navigation
- Project Coverage list view includes a subtle Captain's Log quick action and sortable added/not-added state.
- The card-set names are `Project Coverage` and `Health Priority`.
- The masthead kicker is `Client Technology Health`.
- The left navigation keeps the progressively clearer glass gradient toward the bottom.

## Branding
- Added `public/client-compass-icon.png` at high resolution.
- Added `public/client-compass.ico` as a Windows multi-resolution ICO: 16, 24, 32, 48, 64, 128, and 256 px.

## Validation
- Client Compass lint: passed (152 source/validation files).
- Client Compass tests: 321 total; 316 passed, 0 failed, 5 skipped.
- Full typecheck/build was not claimed because the available package mirror cannot provide `xmlbuilder@10.1.1`, preventing a clean dependency install in this environment.

## Desktop requirement
Use Captain's Log V836 for the new sync/creation handshake. The actual Chrome/Windows desktop launch path still needs a live Windows test after installation; the local V836 bridge and task-creation path were exercised headlessly in validation.
