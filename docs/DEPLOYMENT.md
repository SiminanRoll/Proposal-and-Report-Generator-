# Static Deployment

## Architecture

The hosting provider serves only the generated static application. Source documents are processed by JavaScript running in the employee's browser. There is no web service, API route, server process, database, or hosted client-file storage.

## Existing DigitalOcean target — November 13/14, 2026

The established Client Compass App Platform application is named **Oyster** according to the separate Content Machine repository deployment contract. This source confirms the app association, **not** its actual production hostname, live deployed revision or GitHub static component configuration. **Do not create a replacement DigitalOcean app or change the existing browser-data origin.** The previously proposed `dolphin-app-p8jzc.ondigitalocean.app` host did not resolve in [post-merge CI 43554652124](https://github.com/SiminanRoll/Proposal-and-Report-Generator-/actions/runs/43554652124); the user says it never worked. Do not give that as a working site address.

For the existing Oyster **Static Site** component, independently confirm its source repository is `SiminanRoll/Proposal-and-Report-Generator-` on `main`, build is `npm run build`, output is `out`, and root HTTP route is `/`. The expected EVO Brain export is `out/evo-brain/index.html` (browser path `/evo-brain/`). Then verify the **actual** Oyster hostname, HTTPS, version, owner-authenticated data loading and logout in the live app. Source merges and local/CI builds alone cannot establish deployment. Preserve existing reports and IndexedDB/localStorage during verification.

## Local development

```bash
npm install
npm run dev
```

## Static hosting

Configure one **Static Site** component:

- Source: repository root
- Build command: `npm run build`
- Output directory: `out`
- HTTP route: `/`
- Autodeploy: optional

Leave run command, port, health check, database, and worker settings empty. The repository intentionally contains no Dockerfile.

### DigitalOcean Node runtime

The project pins only the Node.js major version. It intentionally does not declare an npm engine range or a `packageManager` version, so App Platform can use the npm release bundled with its selected Node runtime. This avoids a platform-level npm bootstrap step before dependencies are installed.

When replacing an older repository snapshot, remove stale root-level deployment files that are no longer part of this project—especially `Procfile`, `Dockerfile`, and old patch-note files—rather than copying the new source over the old tree.

## Privacy behavior

- Files are selected from the local device.
- Parsing happens in browser memory.
- Structured project JSON is saved to local storage, and original source files are cached in browser IndexedDB on the same device.
- Source bytes remain only in private browser storage and are never transmitted by the application.
- The user may download and restore an explicit local JSON backup of structured project data. Source documents are excluded from that backup.

## Browser policy

Real projects should be created in an approved work browser profile. Clearing site data removes locally stored projects unless a backup has been downloaded. Private/incognito windows should not be used for persistent work.
