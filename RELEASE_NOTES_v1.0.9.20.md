# Client Compass v1.0.9.20

## Geographic Territory Map

- Rebuilt the Territory Map from oversized state cards into a compact geographic service-area visualization with recognizable state shapes and territory color zones.
- Kept the map territory-first: Florida, Michigan, Illinois, Alabama, Georgia, and other subdivided states retain their separate TC territories rather than collapsing to whole-state metrics.
- Added state-qualified territory identities so similarly named territories such as Central, East, West, North, and South cannot merge across different states.
- Quarantines missing or malformed territory values into a subdued `Needs review` territory instead of rendering unrelated client metadata as a map region.
- Preserved synchronized map/donut interaction: hovering or selecting a territory highlights the corresponding value/client-need slice and updates the compact detail panel.
- Preserved the concise Replace Now / Plan Soon / Healthy bar breakdown without adding a dense analytics dashboard.
- Keeps the map fully browser-local with no remote map API, no new package dependency, and no package-lock change.
