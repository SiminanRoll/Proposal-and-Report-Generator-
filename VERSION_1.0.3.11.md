# Version 1.0.3.11

## Change summary
- Physical servers and workstations are no longer omitted when the ScalePad Last Check-In field is blank.
- A missing check-in remains blank in the parsed record and is displayed as not reported; purchase or warranty dates are never substituted.
- Wrapped device names are recovered before parsing the remaining hardware row.
- Duplicate resolution now prefers a valid check-in date over a missing date without discarding undated devices.

## Regression covered
- Two-server report where one Dell PowerEdge server has no Last Check-In date.
- The undated server remains in inventory, asset totals, lifecycle scoring, and replacement priorities.
