# Source Intelligence Design

## Processing boundary

The browser uploads a file to `POST /api/intelligence/analyze`. The Next.js Node route reads the file in memory and returns structured JSON. It does not save the original bytes.

## Supported Phase 2 sources

- RFT `.xlsx` / `.xls`
- Searchable PDF reports and proposals
- DOCX onsite notes
- TXT notes
- JPG, PNG, and WebP office photos as visual-evidence records

## RFT outputs

The RFT parser reads known report sheets and creates normalized facts for:

- Total computers, workstations, and servers
- Operating-system distribution
- Server lifecycle review
- Network CIDRs and shares
- Printers and SQL servers
- Installed and clinical applications
- Enabled local accounts
- Firewall exceptions
- Endpoint-backup indicators
- Missing or failed update activity

## Confidence and exceptions

Facts may be high, medium, or low confidence. Medium confidence does not automatically create user work. Exceptions are reserved for information needed to produce an accurate report or proposal, such as user quantities, locations, backup design, or unrecognized source documents.

## Phase boundary

Phase 2 creates approved project intelligence and finding candidates. It does not yet compose the final interactive client experience, price an A360 solution, publish a secure link, or collect a signature. Those belong to later phases.
