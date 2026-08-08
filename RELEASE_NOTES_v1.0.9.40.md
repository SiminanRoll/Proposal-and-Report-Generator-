# Client Compass v1.0.9.40

Map mode and compass synchronization correction.

- Replaces the competing Map toggle ownership with one authoritative All / Need / Value / Segment Criteria controller.
- Keeps the existing React metric buttons as an internal renderer only; they are no longer independently user-facing or rewritten by the segment bridge.
- Adds a dedicated Need display mode to persisted Map state instead of overloading Segment Criteria onto the Need button.
- Applies saved segment filtering only when Segment Criteria is explicitly active. All, Need, and Value ignore segment population filtering while preserving geography scope.
- Removes automatic mode switching from general map clicks; geography selection now narrows scope without silently changing the active metric.
- Keeps automatic Segment Criteria activation when the first segment is installed and returns to All when the final segment is removed.
- Makes the compass wait for the authoritative Map mode render to settle before reading donut geometry, preventing stale bearings during mode changes.
