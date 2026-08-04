# RFT example validation

Phase 2 was mapped against the supplied RFT example workbook rather than a generic spreadsheet assumption.

## Workbook structure verified

- 27 assessment worksheets recognized
- Assessment Summary
- Computer inventory
- Server and workstation aging
- Security and backup status
- Windows update results
- Major application inventory
- Network ranges, shares, printers, SQL, and disk data

## Known example values used as parser checkpoints

- 25 computers
- 23 workstations
- 2 servers
- 22 enabled local accounts, deliberately kept separate from managed-user quantity
- 13 printers
- 10 network shares
- 1 SQL server
- 233 installed applications
- 15 computers with a firewall-off condition in at least one reported firewall row
- 25 computers showing `None` in the endpoint-backup field
- One Windows Server 2016 system at 76 months
- One Windows Server 2025 system at 14 months

## Intentional safeguards

- Enabled local accounts never become proposal user quantities automatically.
- Endpoint backup status does not claim that centralized or cloud backup is absent.
- Security continuation rows remain associated with the computer named above them.
- Extracted pricing from a legacy PDF always requires confirmation.
- Low-confidence or unreadable sources create one focused exception instead of a large questionnaire.
