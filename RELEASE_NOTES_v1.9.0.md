# Client Compass v1.9.0

## TRS-driven summary framing

- Applying the normal three-section TRS format now updates the report's client-facing **Summary Framing** automatically.
- When a TRS contains **Meeting Summary** but no separate framing field, the Meeting Summary becomes the Summary Framing and replaces the generic count-based report introduction.
- **Summary Framing** is now an optional recognized TRS heading when the report introduction should intentionally differ from the Meeting Summary.
- The report builder also falls back to the saved Meeting Summary before generating blanket asset/finding-count language, so previously tailored review records remain client-specific after a rebuild or source refresh.
- The report-tailoring editor now labels the field **Summary framing** and explains the TRS behavior directly.

## Compatibility

The existing TRS structure remains valid and preferred:

- Meeting Summary
- Agreed Next Step
- Agreed Decisions

No fourth heading is required.
