# Client Compass

Standalone browser-local client technology review, inventory, territory planning, workbench and report/presentation application for Advantage Technologies.

**Current direction (November 6, 2026):** Client Success OS is discontinued. This repository (`SiminanRoll/Proposal-and-Report-Generator-`) is the active Client Compass development source, **not** merely a historical/provenance source awaiting migration to CSOS. Do not restore CSOS as a dependency, route normal users to CSOS, or copy work into its retired repository.

## Static-only architecture

Client Compass is a Next.js application with `output: "export"`. Hosting serves only the prebuilt `out/` directory. There is **no API server, service worker with secret privileges, DigitalOcean backend, new database or hosted report-source-file storage**.

- Source documents and detailed Ninja/technology inventory remain in the employee's browser.
- Structured local projects use browser localStorage; source documents use browser IndexedDB. Back up browser-local work before clearing storage or changing domains.
- GHL integration (merged PR #79) uses a Private Integration Token explicitly entered and stored in that browser only, never committed or embedded in the static bundle. **Browser localStorage is not a credential vault**; same-origin scripts and compromised extensions may read the token. The GHL browser API's CORS behavior must be validated in production.
- GHL is the intended coordination-task source for this Compass workflow. A GHL contact task is created only on explicit confirmation with contact association and duplicate checks. The previously published GHL inbound workflow is separate from this direct-API path and must not duplicate task creation.
- Client Compass client/report/task workflows do not write to Supabase or Captain's Log.

## Deployment

Existing static-site configuration:

| Setting | Value |
| --- | --- |
| Repository root | `SiminanRoll/Proposal-and-Report-Generator-` |
| Build command | `npm run build` |
| Output directory | `out` |
| Route | `/` |
| Run command/service/port | None |

**DigitalOcean deployment identity (November 13/14, 2026):** the existing Client Compass App Platform app is referred to as **Oyster**, independently documented in `SiminanRoll/Content-Machine/docs/DEPLOYMENT.md` (“Oyster remains Client Compass”). Its actual current hostname, component-to-repository binding and deployed revision **are not verified**. The old proposed `dolphin-app-p8jzc.ondigitalocean.app` hostname failed DNS in [post-merge CI 43554652124](https://github.com/SiminanRoll/Proposal-and-Report-Generator-/actions/runs/43554652124), and the user confirmed it never worked. **Do not offer Dolphin as a Client Compass URL.** Preserve the existing production browser origin and all browser-local reports/data before changing hosting.

**EVO Brain interface:** `/evo-brain/` is part of this existing Client Compass static export (PRs #107/#108 merged; post-merge static build and mocked desktop/mobile browser tests passed). The private owner-scoped catalog/auth are in Pat's Task List Supabase, not in the public static HTML. Production deployment and real owner sign-in are **not yet verified**. A separate Supabase Edge dashboard is not the chosen frontend. See `docs/EVO_BRAIN_SECURITY_AND_RELEASE.md` and `docs/DEPLOYMENT.md` for the acceptance checklist. The browser-local GHL integration remains separate, and its actual production API/CORS behavior remains unverified.

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
