# Version 1.0.3.17

## ScalePad hostname parsing

- Prevents fragmented ScalePad column headings such as `Check-In` and `Expiry` from being collected as device-name fragments.
- Skips table-header fragments while reconstructing wrapped server and workstation rows.
- Adds a conservative cleanup for previously cached names such as `Check-InExpiryFRA-VMHOST-01`.
- Preserves the actual device name, user, serial number, model, check-in date, and lifecycle data.
- Applies the same cleanup at display time so an existing cached project renders the correct hostname before source reprocessing.

## Regression coverage

- Added a test matching the Franklin Family Dental report layout where `Last`, `Check-In`, `Warranty`, and `Expiry` are split across separate extracted rows.
- Confirmed that the server is displayed as `FRA-VMHOST-01` and that no inventory name contains column-header text.
