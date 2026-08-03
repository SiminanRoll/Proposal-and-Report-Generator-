# Version 1.0.2.1

- Removed the standalone warranty and operating-system summary panels from the network-health presentation.
- Removed the separate warranty-count ribbon from the hardware-inventory presentation and from exported HTML/PDF output.
- Kept warranty status and expiration evidence attached to each individual device row.
- Corrected total asset counts so client-facing totals include only servers and workstations.
- Reworked lifecycle classification so device age determines replacement status instead of forcing report-level overdue counts onto the oldest parsed rows.
- Added runtime normalization for existing saved projects, preventing a young workstation previously stored as overdue from remaining flagged after the update.
- Standardized server priority cards on the same dark presentation surface as the other priority devices.
