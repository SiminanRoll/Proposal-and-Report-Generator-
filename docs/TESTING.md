# Testing and release process

## Test layers

### Regression tests

`npm test` runs Node's built-in test runner against the files in `tests/`. The suite protects parser behavior, project migrations, privacy boundaries, presentation structure, client language, scoring, pricing, and PDF-generation contracts.

### Type checking

`npm run typecheck` runs TypeScript in strict, no-emit mode.

### Linting

`npm run lint` applies the Next.js core-web-vitals and TypeScript ESLint configurations.

### Production build

`npm run build` copies the local PDF.js worker and creates the static Next.js export.

## Release gate

Run:

```bash
npm run verify
```

A release is ready only when linting, type checking, regression tests, and the production build succeed.

## Parser defect policy

Every source-parsing defect should be reproduced with a minimal fixture or source-text sample and protected by a regression test. Missing fields must remain missing; parsers must not substitute unrelated dates or infer unsupported hardware facts.

## Repository hygiene

`tests/repository-hygiene.test.mjs` prevents generated build metadata, one-off verification files, patch-note sprawl, and retired cleanup scripts from returning to the tracked source tree.
