# DigitalOcean Static Deployment Fix

Before replacing the repository contents, delete these legacy files from GitHub if present:

- `package-lock.json` (stale lockfile from the prior server build)
- `Dockerfile`
- `src/app/api/`
- `Procfile`

The current static package intentionally does not include a package lock. DigitalOcean will use `npm install`, then run the configured static build.

DigitalOcean settings:

- Resource type: Static Site
- Build command: `npm run build`
- Output directory: `out`
- Route: `/`

For deterministic future builds, run `npm install` on a normal development machine and commit the newly generated `package-lock.json` together with `package.json`.
