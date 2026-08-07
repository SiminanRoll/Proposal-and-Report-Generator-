# Client Compass v1.8.9

## Manual hardware inventory corrections

Client Technology Review workspaces now include **Edit hardware inventory** in the Data controls after the report has been generated.

The editor allows the report inventory to be corrected without changing the original source file:

- rename a device
- add a missing device
- remove a stale or incorrectly included device
- change device type
- change lifecycle status
- correct the operating system
- correct model and manufacturer
- update location
- update age
- update warranty end date
- update last check-in
- update video-card information

When saved, the corrected inventory becomes authoritative for that report. Client Compass recalculates the report inventory totals, server/workstation/VM totals, lifecycle counts, OS-support totals, Technology Health calculations, planning language, location summaries, presentation metrics, and PDF output from the corrected inventory.

Manual corrections persist if source data is refreshed later, so a deliberate report correction is not silently overwritten by a new source-processing pass.

## Windows 8 / 8.1 support status

Windows 8 and Windows 8.1 are now classified as **End of support** by the shared technical-health engine. They are no longer counted as supported operating systems in the Hardware Inventory, Technology Health score, OS-support summary, planning section, or report recap.

## Validation

- `npm run lint` passed.
- Automated suite: 349 total tests, 344 passed, 0 failed, 5 skipped.
- Syntax transpilation passed across 92 TypeScript/TSX source files.
- Full `tsc` dependency resolution remains unavailable in this build environment because the installed workspace does not contain the project React/Next/XLSX dependency packages.
