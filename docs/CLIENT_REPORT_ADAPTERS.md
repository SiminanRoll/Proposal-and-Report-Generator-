# Combined Client Report Adapters

The current-client path uses two dedicated, browser-only report adapters rather than a generic PDF keyword summary.

## ScalePad hardware lifecycle report or device export

The lifecycle source accepts the standard ScalePad PDF or a CSV/XLSX device inventory export. Both paths are normalized into the same client-report inventory. The adapter reads:

- report period
- total hardware assets
- workstation, server, virtual-machine, and network-device counts
- replacement status: current, due soon, overdue, and under review
- operating-system support status
- device name, user, make, serial number, model, OS, age, purchase date, warranty expiration, RAM, CPU, storage, and graphics/video adapter when supplied
- sample evergreen budget, retained only as a confirmation-required planning reference

For PDF sources, the lifecycle color markers in ScalePad are graphic elements rather than normal PDF text. The adapter uses the exact red/yellow totals from the summary and maps the detailed rows by age and lifecycle order. Device detail stays visible for internal review before presentation.

## Huntress threat report

The Huntress adapter reads:

- reporting period
- protected entities
- total events analyzed
- signals detected, investigated, and incidents reported
- autorun events and persistent-foothold signals
- ransomware canary files, protected profiles, covered endpoints, and ransomware incidents
- managed-antivirus events, blocked malware, investigations, and incidents
- process events, signals, investigations, and incidents

Zero incidents are interpreted as a positive monitored outcome when the report confirms active event analysis. Missing data is not presented as zero protection.

## Unified client outcome

The generated client experience includes:

1. Executive technology-and-security overview
2. Environment and lifecycle health
3. Security monitoring, ransomware protection, and managed antivirus
4. Recommended next steps
5. Expandable device-level evidence
6. Self-contained local HTML download with print-to-PDF support

All parsing, project storage, presentation, and export remain in the employee's browser. No source document bytes are uploaded to the hosting provider.


Spreadsheet exports use manufacturer-fulfillment or warranty-start dates to calculate physical-device age. Graphics information is shown only when the export includes a video-controller, graphics-adapter, display-adapter, or GPU column; it is never inferred from the computer model.
