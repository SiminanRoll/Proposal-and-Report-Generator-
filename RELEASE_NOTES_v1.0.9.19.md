# Client Compass v1.0.9.19

## Territory Map

- Added a new **Map** item to the primary Client Compass navigation above Segment Manager.
- Added a compact territory-first service map driven by the client record **Territory** (`market`) field rather than whole-state buckets.
- The view only renders states represented in the current Client Compass client dataset instead of presenting the entire United States as the working area.
- Each territory receives a stable color and interactive marker; hovering a marker highlights the same territory in the synchronized chart.
- Added a donut that switches between **Estimated value** and **Clients in need**.
- Added a compact hover detail with client count, clients needing attention, estimated project value, and red/yellow/green health bars.
- Territory health uses current Client Compass device lifecycle/findings and existing estimated project values; it does not introduce a separate map score.
- The service-area geography is a fully local U.S. state tile layout, so the map works without browser-side network requests or a new mapping dependency.

## Design intent

The first map release deliberately avoids fabricated territory borders. Multi-territory states display separate interactive territory markers inside the state tile. If county assignments are added later, the visualization can graduate to true county-defined territory polygons without changing the underlying territory metrics.

## Build

- No dependency changes.
- `package-lock.json` is intentionally unchanged.
