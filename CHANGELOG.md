# Changelog

## 1.0.5.1 — Generator workflow and planning format

- Adds a workspace-level planning recommendation toggle for **Onsite Review** or **Remote Consultation**.
- Updates client reports, proposals, presentation recaps, pre-meeting material, scheduled-appointment copy, and downloadable PDFs to use the selected planning format consistently.
- Reframes remote next steps as a consultation call with the client’s Technology Consultant rather than onsite project planning.
- Consolidates source, refresh, editing, pre-meeting, presentation, and PDF actions into one ordered generator command center.
- Keeps source attachments reachable from the command center and scrolls directly to the supporting source workspace when opened.
- Places Autorun Events and Process Events side by side on the left of the security monitoring row, with the incident-response panel aligned to the right.
- Tightens incident-response spacing and preserves separate fields for the affected computer, identified threat, outcome, and documented actions.
- Carries the selected planning format into the Potential Client and Existing Proposal Update workflows and their authorization handoffs.

## 1.0.5.0 — RFT-driven proposal parity

- Makes the RFT workbook the primary technical source for both Potential Client and Modernize Existing Proposal workflows.
- Adds the RFT as a required source in the proposal-updater workflow while keeping the existing proposal as the scope and pricing reference.
- Normalizes RFT computer, aging, detailed hardware, login-session, drive-detail, Hyper-V, security, backup, and Windows Update sheets into the same device model used by the client report.
- Carries virtual-machine identification, device model, storage utilization, lifecycle priority, and operating-system support concerns into both proposal presentations and PDFs.
- Adds RFT security-configuration slides covering firewall exceptions, update issues, and backup records that need confirmation, with clear point-in-time assessment language.
- Adds the interactive lifecycle, storage, OS-support, and hardware inventory views to both proposal modes.
- Adds RFT assessment and complete hardware-inventory pages to proposal PDFs before the solution, investment, and authorization sections.
- Refreshes the proposal's starting A360 quantities when the first RFT source is attached, while the existing proposal remains available for pricing and scope confirmation.
- Enables the same HIPAA readiness experience for the proposal updater so both proposal paths follow the same assessment-to-authorization flow.


## 1.0.4.9 — Security presentation clarity

- Separates ransomware canary totals from protected-endpoint totals so each number has a clear label and visual weight.
- Uses restrained blue, teal, orange, and green number accents to make security results easier to scan without making the page feel alarming.
- Rebuilds the security-team response area as a full-width panel with a calm outcome headline, dedicated computer and threat fields, and a single completion badge.
- Removes duplicate device and threat details from the incident headline and replaces cramped pills with readable labeled fields.
- Shows documented containment, cleanup, quarantine, and deletion steps as concise completed-action indicators.
- Applies the same incident-response hierarchy to the downloadable and printable report layouts.

## 1.0.4.8 — Virtual-machine identification and storage filtering

- Accepts `Device` as the computer-name header in ScalePad-style spreadsheet exports.
- Identifies virtual machines from explicit models and common virtualization indicators such as Microsoft Hyper-V Video, VMware, VirtualBox, QEMU, VirtIO, KVM, Xen, and Parallels.
- Keeps virtual machines visible throughout the interactive inventory and location paperwork while excluding them from physical replacement counts and labeling their lifecycle as host-dependent.
- Adds `(Virtual Machine)` to the displayed computer name and distinguishes server workloads as `Virtual server`.
- Makes the Storage Capacity panel clickable so Critical and Watch devices can be reviewed together, sorted by storage priority.
- Includes virtual-machine disk usage in storage-health reporting and site-specific storage pages.

## 1.0.4.7 — Calm incident-response reporting

- Uses the calmer client-facing headline “Security activity was identified.” when a report contains an incident.
- Reads affected-device, threat-name, and response-action details from Huntress incident summaries when those details are available.
- Adds a dedicated security-team response panel to the interactive report and printable PDF, including the computer, identified threat, completed containment and cleanup steps, and current status.
- Treats documented containment or cleanup as a completed response rather than leaving an automatic security follow-up open in Planning and Recap.
- Keeps unresolved incidents clearly visible when the source report does not contain completed response details.



## 1.0.4.6 — Interactive inventory and site-ready planning packets

- Makes the hardware summary cards interactive: hover feedback, persistent active state, and click-to-filter views for all assets, healthy devices, plan-soon devices, and replace-now devices.
- Sorts the full hardware inventory by lifecycle priority so Replace Now systems appear before Plan Soon and Healthy Now systems.
- Shows the workstation/device model and video-card model as separate report details.
- Adds multisite PDF planning packets with a cover page for each location and a concise site-specific list containing only Plan Soon and Replace Now equipment.
- Reads disk volume utilization from both compact `Disk Volume Usage` values and ScalePad-style `Volumes` records containing capacity and usage percent.
- Adds storage health to the interactive report and per-location PDF packets using Healthy, Watch, and Critical states while keeping storage pressure separate from lifecycle replacement status.


## 1.0.4.5 — Lean device export detection

- Recognizes device CSV/XLSX exports that use `Last Uptime` instead of `Last Online` or `Last Update`.
- Accepts the compact export shape containing Display Name, OS, activity, warranty, memory, graphics, login, organization, and location columns even when Device Role and Make/Model are omitted.
- Uses the operating-system name to distinguish servers from workstations when the Device Role column is absent.
- Adds regression coverage for the exact `Devices (8).csv` header pattern.

## 1.0.4.4 — Spreadsheet detection reliability

- Detects device inventory data across every worksheet instead of assuming the first sheet contains the table.
- Finds device headers below cover rows, report titles, and other introductory content.
- Supports UTF-8 and UTF-16 comma-, tab-, and semicolon-delimited exports, including files mislabeled by Windows as Excel CSV files.
- Recognizes XLSM, XLSB, and TSV uploads in addition to CSV, XLS, and XLSX.
- Uses workbook content to distinguish RFT assessments from device inventory exports and gives a clear review warning for unsupported layouts instead of silently producing an empty inventory.
- Adds executable regression coverage for multi-sheet workbooks, delayed headers, UTF-16 tab exports, and unsupported spreadsheet structures.

## 1.0.4.2 — DigitalOcean npm bootstrap fix

- Removed the npm engine range and `packageManager` pin that caused the Heroku/DigitalOcean buildpack to replace its bundled npm before dependency installation.
- Kept Node.js pinned to the supported 22.x runtime.
- Added a repository regression test so platform npm bootstrap constraints are not reintroduced.

This project follows semantic versioning. Git history and release tags are the source of truth for patch-level implementation history.

## 1.0.4.1 — Multi-site inventory and release polish

- Preserved spreadsheet location data and grouped device classes by site, with oldest lifecycle items first within each location.
- Added concise location labels to presentation and PDF inventory rows and replacement cards.
- Displayed explicit graphics/video-adapter models when supplied by the source export.
- Marked workstation graphics as “Not included in source export” when the spreadsheet does not contain that field, rather than guessing hardware.
- Removed obsolete compatibility code and patch-era version comments.
- Added repository editor settings, a proprietary license notice, and a GitHub Actions quality gate.

## 1.0.4.0 — Repository quality and maintainability

- Removed accumulated patch notes, verification artifacts, generated TypeScript build metadata, and obsolete hosted-sharing cleanup code from the repository.
- Consolidated current product, architecture, deployment, and testing documentation.
- Removed an unused legacy HIPAA HTML-export module.
- Added repository-hygiene regression checks.
- Simplified build scripts and pinned declared dependency versions for more predictable installs.
- Preserved the existing application behavior and regression suite.

## 1.0.3 — Client workflow and report maturity

- Added interactive client technology reviews and Advantage 360 proposals.
- Added ScalePad PDF and device-spreadsheet lifecycle import.
- Added Huntress security report import.
- Added Cloud Plus backup server recognition and lifecycle planning.
- Added technology-focused HIPAA readiness, pre-meeting packets, and fillable PDF follow-up.
- Added client-specific organization terminology.
- Added onsite planning scheduling and print-friendly PDF exports.

## 1.0.2 — Proposal workflow

- Added RFT-driven proposal generation, editable pricing, project scope, monthly services, and authorization.
- Added browser-local project persistence and portable project backups.

## 1.0.1 — Presentation and lifecycle reporting

- Added presentation mode, lifecycle scoring, hardware inventory, security summaries, and client-facing planning language.

## 1.0.0 — Initial application

- Established the static Next.js application, shared project model, local source processing, and the three primary workflow types.
