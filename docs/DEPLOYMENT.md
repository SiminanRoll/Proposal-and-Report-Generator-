# Static Deployment

## Architecture

DigitalOcean serves only the generated static application. Source documents are processed by JavaScript running in the employee's browser. There is no web service, API route, server process, database, or hosted client-file storage.

## Local development

```bash
npm install
npm run dev
```

## DigitalOcean App Platform

Configure one **Static Site** component:

- Source: repository root
- Build command: `npm run build`
- Output directory: `out`
- HTTP route: `/`
- Autodeploy: optional

Leave run command, port, health check, database, and worker settings empty. The repository intentionally contains no Dockerfile.

## Privacy behavior

- Files are selected from the local device.
- Parsing happens in browser memory.
- Structured project JSON is saved to local storage, and original source files are cached in browser IndexedDB on the same device.
- Source bytes remain only in private browser storage and are never transmitted by the application.
- The user may download and restore an explicit local JSON backup of structured project data. Source documents are excluded from that backup.

## Browser policy

Real projects should be created in an approved work browser profile. Clearing site data removes locally stored projects unless a backup has been downloaded. Private/incognito windows should not be used for persistent work.
