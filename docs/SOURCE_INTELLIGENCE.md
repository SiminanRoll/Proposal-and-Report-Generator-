# Source intelligence

## Processing boundary

Every source is read by browser-side TypeScript. The application has no source-analysis API and does not upload source documents to the hosting provider.

## Supported sources

- ScalePad hardware lifecycle PDF
- CSV/TSV/XLS/XLSX device inventory export, including compact exports that use `Last Uptime` and omit Device Role or Make/Model
- Huntress security PDF
- RFT assessment workbook
- Searchable proposal and report PDFs
- DOCX and TXT notes
- JPG, PNG, and WebP visual evidence

## Normalized outputs

Adapters create a common source-analysis record containing:

- Facts and normalized values
- Source and evidence descriptions
- Confidence and review status
- Candidate findings
- Human confirmation requirements

Missing data remains missing. Low-confidence or conflicting evidence becomes a focused review item rather than being silently accepted.

## Persistence

Structured project data is saved in local browser storage. Original source bytes are cached in IndexedDB so a project can be reprocessed after parser updates. Downloaded project backups contain structured project data and intentionally exclude source-file bytes.
## Phase 5 source precedence

### Managed clients

- Committed Ninja / Client Compass data controls inventory scope, stable identity, organization, location, physical/virtual classification, operating system, activity, and storage.
- Uniquely matched ScalePad records may enrich age, purchase date, and warranty only. Unmatched or ambiguous records remain diagnostics.
- Huntress supplies security activity, HIPAA supplies readiness content, and Review Outcome supplies agreed responsibilities, timing, and next steps.

### Potential clients and proposal updates

- RFT is the primary technical source.
- Existing proposals retain scope and pricing context.
- Older proposal technical content cannot override newer RFT findings.

The Source Intelligence drawer exposes internal field-level provenance. These source details are not included in the client-facing report.

