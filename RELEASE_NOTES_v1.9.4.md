# Client Compass v1.9.4

## Inventory identity diagnostics

This release fixes a reconciliation blind spot where an authoritative device could still be included in the source totals while its normalized report name collapsed to an empty value. Earlier diagnostics then dropped the same row and could misleadingly report zero authoritative devices missing.

### Changed

- Authoritative inventory rows are retained for diagnostics when a stable device ID or original source name is available, even if the normalized report name is unusable.
- Newly refreshed Client Compass snapshots preserve such a device with an internal `Identity review` placeholder so it remains visible to the hardware inventory editor.
- The diagnostic CSV now identifies the stable source device ID, original source device name, missing-from-report state, and identity-review state for the affected row.
- Presentation and finished PDF remain paused until the malformed identity is corrected.
- The internal blocker now uses identity-specific wording when the issue is a malformed device identity rather than a generic source-total mismatch.
