# Version 1.0.3.6

## Deployment type-check repair

- Fixed the production TypeScript error in `src/lib/outcomes/fillable-pdf.ts`.
- Generated PDF bytes are now copied into a concrete `ArrayBuffer` before being passed to `Blob`.
- This avoids the newer DOM typing conflict between `Uint8Array<ArrayBufferLike>` and `BlobPart`.
- No client-facing PDF behavior or HIPAA follow-up rules were changed.

## HIPAA return wording

- The return-by-email instruction remains conditional.
- It is included only when unresolved HIPAA questions are added to the PDF.
- It is omitted when HIPAA is disabled or all questions are resolved.
