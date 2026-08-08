# Client Compass v1.0.9.27

## Managed segment OS criteria
- Added **Server OS** criteria for physical servers.
- Added **Virtual Server OS** criteria for virtual servers.
- Added **Workstation OS** criteria across workstation-class devices.
- OS criteria use dropdowns with normalized values instead of fragile free-text matching.
- Server choices include Windows Server 2008/2008 R2, 2012/2012 R2, 2016, 2019, 2022, 2025, other, and unknown.
- Workstation choices include Windows 8/8.1, Windows 10 and Windows 11 families, explicit Windows 10 Home and Windows 11 Home editions, Pro/Professional editions, macOS, Linux, other, and unknown.
- Broad Windows 10/11 rules match every edition, while Home-specific rules can isolate Home systems.

## Client inventory
- Added a compact **GPU** column backed by the existing video-card data.
- Common vendor/trademark noise is shortened for display while the full source value remains available on hover.
- Rebalanced the inventory columns with a fixed table layout and explicitly disabled horizontal scrolling.
- Long device, model, OS, GPU, type, and storage values truncate with ellipsis instead of widening the table.
