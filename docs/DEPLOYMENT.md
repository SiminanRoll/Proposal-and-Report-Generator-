# Deployment Direction

## Local development

```bash
npm install
npm run dev
```

## DigitalOcean App Platform

Deploy one Node.js web service:

- Build command: `npm run build`
- Run command: `npm start`
- HTTP port: `3000`
- Health check: `/api/health`

Phase 2 source analysis runs inside the same Next.js service. There is no Python service and no separate frontend/backend deployment.

## Current storage behavior

Source bytes are processed in memory and discarded after analysis. Structured projects are browser-local during this proof stage. Before real client use, add authenticated users, PostgreSQL project storage, private object storage, encryption, retention controls, and server-side authorization.
