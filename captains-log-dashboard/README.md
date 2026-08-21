# Captain's Log Operations Dashboard

Self-contained cloud deployment of the Captain's Log server/intelligence dashboard.

This folder is intentionally separate from the Client Compass Next.js application. DigitalOcean can deploy it as a second **Web Service** from the same GitHub repository, using this folder as the service source directory.

## Architecture

```text
Windows / server runners
        ↓ telemetry + opportunities
      Supabase
        ↓ signed server-to-server request
server-runner-dashboard-data Edge Function
        ↓ sanitized dashboard data
DigitalOcean dashboard service
        ↓ authenticated HTTPS
      Browser
```

The DigitalOcean service never needs a Supabase service-role key. It only holds the dashboard HMAC signing secret used by the existing `server-runner-dashboard-data` Edge Function.

The Windows VM remains responsible for running collectors. The dashboard is independent of the VM, so it remains available when a runner or VM is offline.

## DigitalOcean App Platform

Add a new **Web Service** component to the existing app/repository.

Recommended settings:

- Repository: `SiminanRoll/Proposal-and-Report-Generator-`
- Branch: `main`
- Source Directory: `captains-log-dashboard`
- Build Command: `pip install -r requirements.txt`
- Run Command: `python3 dashboard_server.py`
- Health Check Path: `/healthz`
- HTTP Port: use DigitalOcean's injected `PORT` environment variable

### Required environment variables

```text
SUPABASE_URL=https://cqhqbucjzgijhskupnlw.supabase.co
CAPTAINS_LOG_USER_ID=<Captain's Log user UUID>
SERVER_RUNNER_DASHBOARD_SECRET=<same HMAC secret accepted by server-runner-dashboard-data>
DASHBOARD_USERNAME=<dashboard login username>
DASHBOARD_PASSWORD=<dashboard login password>
DASHBOARD_SESSION_SECRET=<separate long random session-signing secret>
```

Set the secret/password values as encrypted DigitalOcean environment variables. Do not commit them to GitHub.

Optional:

```text
SERVER_RUNNER_DASHBOARD_DATA_URL=<override Edge Function URL>
CAPTAINS_LOG_DASHBOARD_BIND=0.0.0.0
DASHBOARD_COOKIE_SECURE=true
```

`PORT` automatically causes the service to bind to `0.0.0.0`; local runs default to `127.0.0.1:8787`.

## Local run

```bash
cd captains-log-dashboard
export CAPTAINS_LOG_USER_ID='...'
export SERVER_RUNNER_DASHBOARD_SECRET='...'
export DASHBOARD_USERNAME='...'
export DASHBOARD_PASSWORD='...'
export DASHBOARD_SESSION_SECRET='...'
python3 dashboard_server.py
```

Then open `http://127.0.0.1:8787`.

## Dashboard behavior

- Time windows: 24H / 7D / 30D / 90D / 1Y
- Interactive trend charts: hover for date details; click to pin a date
- Permit Radar: per-clerk/per-source connection health, last run, scan volume, and actual opportunities
- Social: only `one_stop_social` Facebook-group lead rows
- Advantage Technologies LinkedIn, Instagram, and Facebook Page activity is excluded from Social dashboard statistics
- Suppressed Social rows are tracked for classifier-quality analytics but never counted as opportunities
- NPI: change/candidate/investigation/opportunity funnel
- Intent: validation/WIP telemetry only

## Security

- Browser never receives the dashboard signing secret.
- Browser never receives a Supabase service-role key.
- Public/non-loopback binds refuse to start unless dashboard username/password authentication is configured.
- Dashboard sessions use an HttpOnly, SameSite=Strict cookie signed server-side.
- `/healthz` is intentionally unauthenticated for DigitalOcean health checks.

## Source ownership

The server-side Radar collectors and Supabase Edge Function remain part of the Captain's Log backend. This folder is the deployable web dashboard surface for DigitalOcean.
