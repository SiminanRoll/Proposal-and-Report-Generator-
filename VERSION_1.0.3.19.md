# Version 1.0.3.19

## Device spreadsheet imports
- The current-client ScalePad source now accepts PDF, CSV, XLSX, or XLS device inventory exports.
- CSV/XLSX device exports are normalized into the same lifecycle inventory facts used by ScalePad PDFs.
- Device type, model, serial number, operating system, last activity, warranty, memory, processor, storage, age, and lifecycle status are mapped from the export.
- Virtual machines are separated from physical server/workstation counts.
- Cloud Plus BDR naming patterns and EQUUS hardware remain classified as backup servers when present.

## Graphics details
- The inventory supports common GPU/video-card column names, including Video Controllers, Video Cards, Graphics Adapters, GPU, and Display Adapters.
- Graphics are shown as a short secondary line on the presentation inventory and printable PDF inventory.
- Graphics are never guessed. When the export does not include a graphics field, the inventory omits it and the workspace reports that limitation.

## Source guidance
- Empty-state guidance now tells the user to attach either a ScalePad PDF or a supported device spreadsheet.
