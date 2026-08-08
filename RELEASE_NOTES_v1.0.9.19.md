# Client Compass v1.0.9.19

## Territory Map

- Added a new **Map** item to the primary Client Compass navigation above Segment Manager.
- Added a compact territory-first service map driven by the client record **Territory** (`market`) field rather than whole-state buckets.
- The map only frames states represented in the current Client Compass client dataset instead of presenting the entire United States as the working area.
- Each territory receives a stable color and interactive map marker; hovering a marker highlights the territory and its corresponding chart slice.
- Added a synchronized donut that can switch between **Estimated value** and **Clients in need**.
- Added a compact hover detail with client count, clients needing attention, estimated project value, and red/yellow/green health bars.
- Territory health uses current Client Compass device lifecycle/findings and existing estimated project values; it does not introduce a separate map score.
- The map uses the public U.S. Census-derived `us-atlas` state geometry at runtime and falls back to territory chips if geometry cannot be loaded.

## Design intent

The first map release deliberately avoids fabricated territory borders. Multi-territory states display separate interactive territory markers inside the real state geometry. Territory boundaries can be made more precise later if county assignments are added to the data model.

## Build

- No dependency changes.
- `package-lock.json` is intentionally unchanged.
