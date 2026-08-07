# Phase 13 — Captain's Log Account Review Handoff

Client Compass client workspaces now include a quiet Captain's Log compass action.

- Opens a compact account-review scheduling dialog.
- Prefills the task title as `Coordination Call - CompanyName - Account Review Priority`.
- Defaults the due date to the client's recorded next follow-up or the next business day.
- Sends a local `captainslog://account-review` handoff with company, Client Compass ID, due date, priority context, and a unique request ID.
- Requires Captain's Log Desktop V833+ to receive the handoff.
- Does not expose Captain's Log database or Supabase credentials to the browser.
