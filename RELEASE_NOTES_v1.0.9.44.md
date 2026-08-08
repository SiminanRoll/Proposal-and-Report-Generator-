# Client Compass v1.0.9.44

## Segment-aware map toggle

- Replaces the middle **Need** map toggle with **Segments** whenever one or more saved segments are slotted.
- Clicking **Segments** now activates the saved segment population directly instead of allowing the native Need action to run first.
- Prevents stale Need mode from bypassing the slotted segment population and producing inconsistent map calculations.
- Returns the middle toggle to **Need** after the final segment is removed.
- Keeps **All** and **Value** available while a segment is slotted.
- Keeps the underlying native Clients renderer for Segment mode so segment totals are calculated from the filtered segment population rather than the Need metric.
- Keeps map criteria controls locked only while Segment mode is actively selected.

## Validation

- Added regression coverage for dynamic All / Need-or-Segments / Value behavior.
- Added coverage that prevents the native Need React handler from firing when Segments owns the middle toggle.
- No dependency changes were required; `package-lock.json` is unchanged.
