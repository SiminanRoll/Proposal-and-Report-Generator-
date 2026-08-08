# Client Compass v1.0.9.42

## Territory map hero refinement

- Removed the redundant Territory View / Map title block so the map starts higher on the page.
- Moved portfolio totals into the map surface as glass summary bubbles.
- Tightened the overall map workspace width and desktop height to reduce unused space.
- Added layered map depth, subtle grid texture, stronger geographic edge separation, and state extrusion/shadow treatment.
- Kept contextual territory metrics in the insight rail while making the map the primary visual surface.

## Persistent map mode controls

- Replaced the v1.0.9.40 portal-based map mode overlay with a native control controller.
- The All / Need / Value controls now remain in the React map surface instead of being hidden behind a portal copy.
- Added DOM replacement detection so the controller safely rebinds if the map control surface is recreated after hydration or a map rerender.
- Preserved stored map mode synchronization and Segment Criteria locking behavior.

`package-lock.json` is intentionally unchanged in this release.
