# Client Compass

Standalone browser-local client technology review, inventory, territory planning, workbench and report/presentation application for Advantage Technologies.

**Current direction (November 6, 2026):** Client Success OS is discontinued. This repository (`SiminanRoll/Proposal-and-Report-Generator-`) is the active Client Compass development source, **not** merely a historical/provenance source awaiting migration to CSOS. Do not restore CSOS as a dependency, route normal users to CSOS, or copy work into its retired repository.

## Static-only architecture

Client Compass is a Next.js application with `output: "export"`. Hosting serves only the prebuilt `out/` directory. There is **no API server, service worker with secret privileges, DigitalOcean backend, new database or hosted report-source-file storage**.

- Source documents and detailed Ninja/technology inventory remain in the employee's browser.
- Structured local projects use browser localStorage; source documents use browser IndexedDB. Back up browser-local work before clearing storage or changing domains.
- GHL integration under **draft PR #79** uses a Private Integration Token explicitly entered and stored in that browser only, never committed or embedded in the static bundle. **Browser localStorage is not a credential vault**; same-origin scripts and compromised extensions may read the token. The GHL browser API's CORS behavior must be validated in production.
- GHL is the intended coordination-task source for this Compass workflow. A GHL contact task is created only on explicit confirmation with contact association and duplicate checks. The previously published GHL inbound workflow is separate from this direct-API path and must not duplicate task creation.
- No active Compass workflow writes to Supabase or Captain's Log.

## Deployment

Existing static-site configuration:

| Setting | Value |
| --- | --- |
| Repository root | `SiminanRoll/Proposal-and-Report-Generator-` |
| Build command | `npm run build` |
| Output directory | `out` |
| Route | `/` |
| Run command/service/port | None |

The user provided `https://dolphin-app-p8jzc.ondigitalocean.app/` as the intended app URL. **The actual DigitalOcean component/repository connection has not been verified**. Historical notes may associate that hostname with the now-discontinued CSOS project. Do not delete the deployed app or overwrite its browser-local data before confirming the component and exporting any needed projects.

This PR remains draft and undeployed. See `docs/CLIENT_COMPASS_GHL_PREVIEW_WIRING_2026-11-06.md` and `docs/DEPLOYMENT.md`.

## Development

Use Node.js 22 and npm. No private GHL token is required for a clean-room build or offline tests.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Relevant locations:

- `src/app/`: static Next.js routes
- `src/components/`: Client Compass UI
- `src/lib/compass/`: browser-local models, workbench, GHL adapter, task preflight, inventory
- `src/lib/outcomes/`: report/presentation generation and exports
- `tests/`: regression, GHL browser API, security and import-boundary tests
- `public/`: static assets

Historical OTA Tracker / Signal Intelligence modules remain separate legacy references and are not part of the Client Compass → GHL task authority change. Existing old release/migration notes are historical evidence, not current instructions to revive CSOS.
