# Changelog


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
