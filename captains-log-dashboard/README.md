# Captain's Log Operations Dashboard

Static-site deployment of the Captain's Log intelligence dashboard.

This folder is intentionally separate from the Client Compass Next.js application. It is designed to be deployed as a second **Static Site** component from the same GitHub repository.

## Architecture

```text
Windows / server runners
        ↓ telemetry + opportunities
      Supabase
        ↓
JWT-protected server-runner-dashboard-web Edge Function
        ↓ authenticated HTTPS
DigitalOcean Static Site
        ↓
      Browser
```

DigitalOcean only serves HTML, CSS, and JavaScript. There is no Python process, server command, runtime secret, or privileged database key on the static host.

## Authentication

The browser signs in through Supabase Auth using the existing Captain's Log email/password account. After login, the browser receives a normal user JWT and uses it to call `server-runner-dashboard-web`.

The Edge Function:

- requires a valid Supabase user JWT
- only permits the Captain's Log user assigned to this dashboard
- performs privileged reads inside Supabase
- returns sanitized dashboard data
- limits Social data to `source = one_stop_social`

The public Supabase publishable key included in the static JavaScript is intentionally safe for browser use. No service-role key or dashboard HMAC secret is shipped to the browser.

## DigitalOcean Static Site

Use the existing repository and point a Static Site component at:

```text
captains-log-dashboard
```

The folder contains `index.html`, so no application run command is required. The exact Output Directory field depends on how the existing DigitalOcean static component is configured, but the deployed asset root should be this folder.

## Dashboard behavior

- 24H / 7D / 30D / 90D / 1Y time windows
- interactive trend charts: hover for date details and click to pin
- Permit Radar per-clerk/per-source connection monitoring
- actual Permit opportunities from `permit_opportunities`
- Social statistics only from One Stop Social Facebook-group discovery
- Advantage Technologies LinkedIn, Instagram, and Facebook Page activity excluded
- suppressed Social signals tracked for classifier-quality analytics but excluded from opportunities
- NPI change/candidate/investigation/opportunity funnel
- Intent Radar remains validation/WIP
- logout control clears the browser session

## Files

```text
index.html          Static entry point
premium.html        Dashboard markup
premium.css         Dashboard styling
premium.js          Supabase Auth bootstrap, static API routing, interactive chart layer
premium_core.js     Shared dashboard calculations and chart helpers
premium_social.js   Overview / Opportunities / Social rendering
premium_app.js      Permit / NPI / Intent / run-history rendering and app lifecycle
```

## Backend dependency

The production Supabase project must keep the following Edge Function active:

```text
server-runner-dashboard-web
```

That function is JWT-protected and is the secure data boundary for the static dashboard.
