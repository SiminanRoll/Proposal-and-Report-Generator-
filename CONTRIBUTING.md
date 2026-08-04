# Contributing

## Development principles

1. Keep source documents and client data inside the browser boundary.
2. Preserve evidence provenance when adding or changing parsers.
3. Prefer client-facing language over internal implementation terminology.
4. Do not infer missing facts when a source does not support them.
5. Add a regression test for every parser or scoring defect.
6. Keep presentation and PDF outputs consistent in data, while allowing each format to use an appropriate layout.

## Before opening a pull request

```bash
npm run verify
```

A pull request should include:

- A concise description of the user-visible change
- The affected workflow and source type
- Tests for new parsing, scoring, migration, or output behavior
- Screenshots for meaningful presentation or PDF layout changes
- Confirmation that no outbound data transport was introduced

## Versioning

- Patch: defect fixes and copy/layout corrections
- Minor: backward-compatible features or meaningful internal refactors
- Major: incompatible project-schema or workflow changes

Do not add per-version markdown files to the repository root. Update `CHANGELOG.md` and use Git tags/releases for detailed history.
