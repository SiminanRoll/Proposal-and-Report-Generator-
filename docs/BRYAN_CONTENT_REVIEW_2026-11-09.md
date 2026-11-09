# Live Bryan Content Review in Client Compass

Date: 2026-11-09

## Current authority

Client Success OS is retired. The live Bryan content-review surface belongs in the active standalone Client Compass repository and is exposed as the static route `/content/`.

Client Compass's existing client/report workflows remain browser-local. This feature is an intentionally isolated exception: its collaboration state lives in the existing CLV Supabase project because two users need to see the same approvals and notes.

## Boundaries

- The content-review route has its own Supabase authentication gate.
- The public Supabase publishable key is safe for browser use; no service-role or private secret is shipped.
- RLS on `content_batches`, `content_items`, and `content_reviews` is the authorization boundary.
- The batch owner controls post content, reviewer assignment, and Ready to Arm.
- The assigned reviewer can read the batch and write only their review records.
- Reviewer sign-up is harmless without an assigned batch because RLS returns no content.
- Content data is auto-refreshed every four seconds for the live shared-review experience.
- Ready to Arm does not publish content. GHL scheduling is a later handoff.
- Exact post graphics can be linked through `content_items.asset_url`; until populated, the UI shows a branded quote preview.
