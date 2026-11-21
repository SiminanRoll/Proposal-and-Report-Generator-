# EVO Brain access and deployment gate

## November 21, 2026 — Full canonical skill reconciliation

- **Authoritative source:** `SiminanRoll/captains_log` main (owner-approved 27-entry EVO catalog, including newly merged Hammy Living World Engineering PR #180). The GitHub skill files—not the DB cards—remain the procedures. Verify source commits again on future syncs.
- **Database reconciliation independently executed:** Supabase **Pat's Task List** project `cqhqbucjzgijhskupnlw`, owner-scoped `public.evo_brain_entries`: 20 existing registered records retained and seven missing canonical skills safely added: Advantage Affiliate Catalog, Advantage Hardware Recommendations, Advantage Product Research, Advantage WordPress / Elementor, Hammy Living World Engineering, Hammy Reviewer Email Outreach, and Hammy Social Automation & Continuity. Total is **27 records, 27 unique registered `skills/*/SKILL.md` paths**, no proposed placeholder. Confirmed canonical GitHub tree and DB path sets match with no missing/extra source paths. Preserved original entries' maturity/evidence rather than claiming runtime accomplishments. All source mappings were reviewed on Nov 21; `updated_at` reconciled for 27. Rows stay owner-scoped; no RLS, Auth, Client Compass client-data, Hammy account or schema changes.
- **Branches:** Advantage Technologies **12**, Application Development **5**, EVO Core **3**, Hammy & The Strawberry **5**, Personal & Family **2**. `Stage` describes the maturity of the procedure, not deployment certification. Current new skills are **Starter** unless an actual task-specific runtime acceptance justifies promotion.
- **Frontend improvement candidate:** `/evo-brain/` reads `updated_at` after owner authentication, displays the most recent catalog review date, permits an explicit authenticated reload without losing the selected skill, and distributes dense twelve-node branches into staggered rings. Source tests should exercise the complete 27-skill neural map with keyboard/mobile navigation. A reload **only refreshes stored rows**; it is **not a GitHub scan**. Automatic cross-system synchronization remains unimplemented and must not be advertised as connected.
- **Confirmed hosting reference:** Owner supplied `https://oyster-app-xql5x.ondigitalocean.app/evo-brain` as the current intended EVO Brain address. This supersedes the obsolete Dolphin hostname, but independently observing a successful HTTP response, actual deployed commit and signed-in owner browser view remains **NOT VERIFIED** here. Do not confuse a code merge or SQL row update with DigitalOcean deployment.
- **Release checks:** Existing private Supabase Auth/RLS, static page privacy and Client Compass report/local storage must remain unchanged. Verify all 27 entries in an authenticated real browser, a 12-node branch without overlap, mobile horizontal viewport, real sign-out and safe reload. Do not use real credentials or tokens in CI fixtures.
- **Long-term freshness:** Scheduled GitHub→owner DB sync would require an authenticated, separately reviewed server-side integration and monitoring. Until then, the page displays the review timestamp transparently; don't suggest its reload button imports GitHub.


## Verified authority
- Authentication project: Pat's Task List, Supabase project `cqhqbucjzgijhskupnlw`.
- Hammy Supabase is a separate tenant and **must not be used** for EVO login.
- Client Compass is `output: "export"` and has intentionally retired its old globally mounted Supabase auto-sign-in. Do not reactivate it.
- Existing Client Compass local browser report data must not be migrated, reset or overwritten.

## Required secure architecture
1. Serve a **public static shell only** at `/evo-brain/`. Do not embed private brain text, skills, client identifiers, secret keys or raw GitHub content in the static JavaScript/HTML. The current route fetches entries only after authentication; the previous embedded snapshot was removed. Verify actual built assets before publishing.
2. Reuse Supabase Auth for the Pat's Task List project with a **route-local** auth client. Use the publishable browser key only. Never ship a service-role/secret key. Persistent session with explicit sign-out and secure recovery; validate session with Auth server, not merely a local flag.
3. Store private explorer entries in a new owner-scoped `evo_brain_entries` table (or protected Edge Function). RLS must restrict reads to an explicit allowlisted `auth.uid()` and require non-anonymous, real authenticated sessions. A mere `TO authenticated` policy is insufficient.
4. Public static assets must contain no private entries. Fetch data **after** successful authentication from the protected Supabase API; enforce authorization at the database/Edge Function, not just React.
5. Store project/tenant as a required explicit discriminator: `advantage`, `hammy`, `personal`, `development`, `evo-core`. Keep sources and policies scoped. Shared development techniques may be referenced across branches; client records, credentials, assets, and sensitive context must not be copied.
6. The catalog currently contains source-verified and proposed entries; show source provenance and freshness. Never present proposed skills as installed or validated.
7. Optional "remember me" means persistent Supabase session on the current device, not saving the password. Provide a sign-out action. Do not log tokens.

## Acceptance gates before merge/deployment
- Existing Pat's Task List account signs in, refresh survives reload, sign-out clears access.
- Unauthenticated requests to the protected API return no entries.
- A different Supabase account cannot read the owner's entries; anonymous sessions cannot bypass policies.
- No sensitive brain content appears in unauthenticated page HTML or JS bundle.
- Existing Client Compass app and local browser data remain unchanged.
- Static export, TypeScript, tests and browser/mobile checks pass.
- Actual DigitalOcean deployment and auth redirects are verified; GitHub merge alone is not a deploy.
- No changes to Hammy Supabase or unrelated tables.

## Current state (November 13/14, 2026)
- The original route-local Supabase implementation shipped via Client Compass PR #107, merged to main at cd504964. This is not proof of live DigitalOcean deployment.
- The Pat's Task List owner-scoped Supabase public.evo_brain_entries catalog contains 17 mapped capabilities across five explicit branches: 15 registered GitHub skill sources and two proposed skills after manual reconciliation. This is not automatic synchronization.
- Client Compass PR #108 upgrades the existing /evo-brain/ route with an interactive five-domain neural map, mobile panning, domain-selected inspector, source-provenance labels, accessible keyboard controls and Chromium regression coverage. It does not modify client reports, browser-local project storage, or other web applications.
- Post-merge Client Compass static-build and desktop/mobile Chromium browser mock-auth acceptance [CI 43554652124](https://github.com/SiminanRoll/Proposal-and-Report-Generator-/actions/runs/43554652124) **passed** on merged `main` commit `cea91790`. A mock browser sign-in is not a real owner login test.
- Production deployment is **NOT VERIFIED**. The existing Client Compass DigitalOcean App Platform app is called **Oyster** (independently confirmed as the intended app by `SiminanRoll/Content-Machine/docs/DEPLOYMENT.md`), but its live hostname and source-to-component binding remain unknown. The old proposed `dolphin-app-p8jzc.ondigitalocean.app` failed DNS (curl error 6 in post-merge CI 43554652124); the user confirms it has never worked. **Never present Dolphin as a live Client Compass/EVO link.** No DigitalOcean account-level management access is connected to this chat.
- The previous Supabase Edge Function at /functions/v1/evo-brain must not be offered as an ordinary frontend browser page.

## DigitalOcean static deployment checklist
1. In the existing **Oyster** Client Compass DigitalOcean App Platform static site (not retired CSOS/Dolphin), verify GitHub source SiminanRoll/Proposal-and-Report-Generator-, branch main, build command npm run build, output directory out, route /, and deploy-on-push state. Do not create a new Client Compass app or change the browser-data origin by assumption.
2. Deploy the tested main commit through the existing site integration. Confirm build output contains out/evo-brain/index.html and the _next assets.
3. Inspect the actual app's default hostname from DigitalOcean. Verify DNS, a trusted HTTPS certificate, and Content-Type: text/html at /evo-brain/. Do not override TLS errors.
4. Test login with the existing Pat's Task List user, authenticated owner-only data retrieval, refresh after reload, and logout on desktop and iPhone. Never ask the owner to send a password.
5. Preserve Client Compass browser-local report and inventory data by staying on its established origin. Domain changes can strand localStorage and IndexedDB data.

## Security notes
- The standalone static Client Compass route persists Supabase access and refresh tokens in browser localStorage to remember the login. This is accessible to any script executing on that origin, so XSS and extension risks remain. No password is persisted; no service-role key is in the browser.
- Existing database RLS, not visible React filters, enforces ownership. A simulated owner request returned 17 rows and a different synthetic UID returned zero in earlier checks; real sign-in remains unverified.
- The privacy lint allows only narrowly scoped EVO Auth/catalog and OTA snapshot RPC requests to the fixed Supabase project, while rejecting other outbound browser primitives.
