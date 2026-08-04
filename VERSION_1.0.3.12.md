# Version 1.0.3.12

## ScalePad server-row recovery

- Reconstructs physical server and workstation rows split across up to five visual PDF text lines.
- Keeps devices when Last Check-In is blank.
- Accepts lifecycle rows that contain only device name, make, serial, model, operating system, and age.
- Preserves wrapped hostnames such as `MID-HYPERV-01`.
- Never substitutes purchase, warranty, or report dates for a missing check-in value.
- Includes recovered devices in server counts, total assets, lifecycle scoring, inventory, and replacement priorities.
