# Client Compass v1.0.9.10

## Full Captain's Log history sync
- Reworked the full-book Captain's Log sync to pull the complete matched Supabase task and Call Mode history for every client in one pass.
- Removed the previous recent-history caps so matched client activity is no longer limited to a small subset of records.
- Improved company linkage by using matched company names, aliases, and Captain's Log prospect/company identifiers when reconstructing history.
- Fixed bulk-synced history so it is restored from the saved Client Compass client record immediately when that client is opened; a per-client refresh is no longer required just to display already-synced history.
- Increased the Supabase ledger safety ceiling to 250,000 rows per source table before Client Compass refuses an incomplete history load.

## Simpler client activity experience
- Replaced open-work and coordination-state reporting with a straightforward Captain's Log history view.
- The Captain's Log compass is now a passive activity indicator: checked when synced historical activity exists, unmarked when no history is available.
- Replaced the large Refresh from Supabase action with a compact refresh icon that animates while history is being refreshed.
- Added a compact plus action for creating a Coordination Call task with a due-date picker; the task is written directly to Supabase and is picked up by Captain's Log through its normal cloud sync.
- Removed open-task gating and duplicate-work checks from task creation. Client Compass no longer blocks task creation because another Captain's Log task is open.
- Client Compass follow-up dates remain Client Compass-owned and are no longer overwritten by Captain's Log open-task scheduling.

## Data Tools
- Renamed the full-book action to Sync all history and made its result report the number of Captain's Log history records synced across matched clients.
- The bulk action loads the shared Supabase history once, rebuilds every matched client, and persists the resulting history into Client Compass.

## Versioning
- Client Compass releases use the four-part version format beginning with `1.0.9.10`.
