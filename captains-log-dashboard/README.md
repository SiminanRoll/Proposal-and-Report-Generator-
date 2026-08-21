# Signal Intelligence Dashboard

Captain's Log's cloud operations dashboard is published as part of the Client Compass static export.

## Live static files

The deployed copy lives under:

`public/captains-log-dashboard/`

That directory is copied into the Next.js static export and is available at:

`/captains-log-dashboard/`

The older files in this top-level `captains-log-dashboard/` folder are retained as source/reference material. The `public/` copy is the authoritative DigitalOcean-served dashboard.

## Architecture

The browser is a static site. It signs in with Supabase Auth using the public publishable key, then calls the JWT-protected `server-runner-dashboard-web` Edge Function. Privileged database credentials remain inside Supabase.

Social dashboard data is restricted to One Stop Social Facebook-group signals. Advantage-owned Facebook Page, LinkedIn, and Instagram activity is excluded from Social opportunity analytics.

## Current UI conventions

- Dashboard name: **Signal Intelligence Dashboard**
- Hero eyebrow: **VIRTUAL SERVER STATS**
- Social priority labels: **Hot**, **Warm**, **Quiet**
- The database may retain the legacy `bubble` tier value for compatibility; the dashboard renders that tier as **Warm**.
- Suppressed Social signals are classifier diagnostics only and never count as opportunities.
