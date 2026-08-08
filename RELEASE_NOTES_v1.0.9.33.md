# Client Compass v1.0.9.33

Map rendering hotfix and interaction stabilization.

- Removes the duplicate global map MutationObserver introduced in v1.0.9.32 while preserving drag-preview feedback.
- Adds a final map visual guard so the SVG remains bounded to the canvas and territory fills cannot fall back to browser-default black.
- Restores the map card, right-side insight rail, summary pills, state labels, and bounded desktop/mobile geometry.
- Keeps All / Need-or-Segment / Value behavior, automatic whole-map reset when the final segment is removed, and live refresh when Segment Manager criteria change.
- Keeps the blue-glass segment drawer, compact slots, snap/drop feedback, and permanently reserved View clients space.
