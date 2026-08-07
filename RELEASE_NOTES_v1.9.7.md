# Client Compass v1.9.7

## Supabase-first history
- Client Compass now reads Captain's Log history directly from Supabase instead of posting a request for the desktop app to acknowledge.
- Historical reads combine `task_events` with Call Mode `app_events` to recover client matches, contacts, open/planned work, recent activity, and completed account-review activity.
- Client aliases participate in matching during individual and bulk refreshes.
- New Coordination Calls are written directly to the shared `task_events` ledger, so they remain available even when Captain's Log is closed.

## Client workspace polish
- Rebuilt the client details body around a dedicated vertical scroll container with a persistent scrollbar gutter.
- Kept the client header fixed outside that scroll region so the navigation and quick actions remain available.
- Added clear spacing and a divider between “Back to list” and the CLIENT label.
- Preserved the Present report quick button in the client header.

## Settings and Data Tools
- Replaced desktop-sync testing language with a Supabase History connection state.
- Data Tools now uses “Refresh from Supabase” and describes the historical data it pulls directly.
- Removed the old V843/desktop acknowledgement dependency from the Client Compass workflow.
