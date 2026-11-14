# EVO Brain access and deployment gate

## Verified authority
- Authentication project: Pat's Task List, Supabase project `cqhqbucjzgijhskupnlw`.
- Hammy Supabase is a separate tenant and **must not be used** for EVO login.
- Client Compass is `output: "export"` and has intentionally retired its old globally mounted Supabase auto-sign-in. Do not reactivate it.
- Existing Client Compass local browser report data must not be migrated, reset or overwritten.

## Required secure architecture
1. Serve a **public static shell only** at `/evo-brain/`. Do not embed private brain text, skills, client identifiers, secret keys or raw GitHub content in the static JavaScript/HTML. The current prototype embeds a non-sensitive snapshot and **must be refactored before publishing**.
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

## Current state
The explorer UI is committed on this feature branch, but authentication and protected data retrieval are **not implemented**. Keep PR #107 unmerged and do not deploy it as a private app until the above gates pass.
