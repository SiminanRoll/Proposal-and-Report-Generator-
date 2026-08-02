# Source Intelligence Design

## Processing boundary

Every source is read by browser-side TypeScript. The application does not make a file-upload request and has no source-analysis API. DigitalOcean receives normal static asset requests only.

## Supported Phase 2 sources

- RFT `.xlsx` / `.xls`
- Searchable PDF reports and proposals
- DOCX onsite notes
- TXT notes
- JPG, PNG, and WebP office photos as visual-evidence records

## Local parsers

- SheetJS reads RFT workbooks from an in-memory `ArrayBuffer`.
- PDF.js extracts searchable PDF text locally.
- Mammoth extracts DOCX text locally.
- Browser `TextDecoder` reads TXT notes.
- Images are recorded as optional local visual evidence; automated interpretation is deferred.

## RFT outputs

The RFT parser reads known report sheets and creates normalized facts for total devices, workstations, servers, operating-system distribution, lifecycle review, network ranges, printers, SQL servers, clinical applications, local accounts, firewall exceptions, backup indicators, and patching activity.

## Persistence

The original file is cached locally in browser IndexedDB so later phases can reuse photos and source documents without uploading them. Structured facts, evidence descriptions, source metadata, finding candidates, and human confirmations are saved in local storage. JSON backups include structured project data but intentionally exclude source-file bytes.

## Phase boundary

Phase 2 creates approved project intelligence and finding candidates. It does not yet compose the final interactive client experience, price an A360 solution, publish a client link, or collect a signature.
