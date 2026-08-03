# Version 1.0.2.4

This release corrects Cloud Plus BDR discovery and connects the recovery appliance to the HIPAA backup review.

- Recognizes the actual `CPBDR` device-name pattern, including compact, hyphenated, underscored, and spaced variants.
- Retains compatibility with the prior `CPBR` pattern, explicit Cloud Plus BDR wording, and EQUUS hardware identification.
- Parses ScalePad inventory from page 2 through the remaining report pages so a CPBDR device is not omitted when the hardware table spans multiple pages.
- Classifies the device as a Cloud Plus BDR backup emergency server, keeps it separate from the primary-server count, includes it in physical lifecycle totals, and places it directly after the primary server in inventory and replacement priorities.
- Includes an aged CPBDR system in the coordinated server replacement project.
- Uses Cloud Plus BDR presence as proposed evidence for HIPAA question 12, Backup Protection and Recovery Verification.
- Describes the appliance as supporting a local emergency recovery copy and cloud backup path without treating appliance presence as proof of current job health or completed recovery testing.
- Refreshes proposed HIPAA technical answers automatically whenever source intelligence is rebuilt or reprocessed.
