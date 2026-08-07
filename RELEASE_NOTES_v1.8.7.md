# Client Compass v1.8.7

## Captain's Log is now sync-first

The Captain's Log compass action no longer means "add a task." It means **check Captain's Log first**.

- Every click requests a fresh Captain's Log client sync.
- **Any open or planned task** tied to the matched client blocks new scheduling, regardless of task type or tag.
- Existing work is synced back into Client Compass instead of creating another task.
- The Coordination Call scheduler appears only after Captain's Log positively confirms **0 open/planned tasks**.
- A pending/queued sync or timeout never counts as permission to schedule.
- The final Schedule action performs the task check again before creating anything.
- Captain's Log remains the source of truth; the old local "added" indicator no longer clears or bypasses existing work.

## Persistent lightweight CRM sync

Captain's Log sync data is now stored on the Client Compass client record so it remains visible after closing the client:

- matched Captain's Log company
- primary contact details
- explicit completed account-review date
- latest client activity date
- next scheduled follow-up from existing open work
- open/planned task count and task details
- recent Captain's Log activity
- last sync time

## Full-book catch-up

Data Tools now includes **Catch up client activity → Sync all clients**.

This batches the full Client Compass client book through the existing authenticated Supabase `app_events` connection, brings back client/contact/activity data, and updates the Captain's Log status for clients with existing open work without clicking them one at a time.

## Companion Captain's Log build

Requires **Captain's Log V841** for the complete any-open-task and batch-sync contract.
