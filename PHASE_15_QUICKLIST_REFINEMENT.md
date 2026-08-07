# Client Compass v1.8.1 — Quick List / Captain's Log refinement pass

## Included in this pass
- Added a **Captain's Log quick action** directly in Project Coverage list view.
- Added **sortable column headers** where they make sense, including **Captain's Log added/not-added** status.
- Added persistent local **queued state** so list rows and the client workspace both reflect whether a client has already been added to Captain's Log.
- Clicking an already-added Captain's Log icon now **clears the queued state**.
- Preserved the existing **Captain's Log receiver + protocol fallback** handoff flow.
- Added quiet **closest-match client association** language in the quick scheduler and workspace scheduler.
- Updated home masthead copy:
  - kicker: **Client Technology Health**
  - card-set title: **Project Coverage**
  - alternate set title: **Health Priority**
- Refined the left rail to use a more **glass-like transparency gradient** toward the bottom.

## Verification completed
- `npm run lint` ✅
- `npm test` ✅

## Notes
- The persistent queued/not-queued Captain's Log status is stored locally in browser storage for the current Client Compass environment.
