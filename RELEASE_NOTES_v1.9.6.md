# Client Compass v1.9.6

## Captain's Log live sync repair
- Client Compass now requires Captain's Log V843 for the cloud round-trip test and bulk/client sync actions.
- V843 fixes the production desktop listener state owner that prevented the real slot-locked Captain's Log application from processing cloud requests even though V842's loose test doubles passed.
- Sync status still counts only returned desktop data as synced; queued requests are never treated as completed syncs.

## Client workspace usability
- Client detail workspaces now scroll vertically so the full CRM, report context, technical detail, and inventory remain reachable on shorter displays.
- The client header stays available while scrolling.
- Added a **Present report** quick action directly in the client header. It uses the existing Quick Present flow for the selected client, opening a ready presentation immediately or guiding the report-generation flow when needed.
