# Client Compass workspace instructions

Preserve the project-specific safety and contribution rules in `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, and `docs/TESTING.md`. EVO does not supersede them.

For development work, discover the current shared EVO core at `SiminanRoll/captains_log` and read its latest merged `skills/evo-development/SKILL.md`. With a real checkout of that core, run `node scripts/evo.mjs discover --request "<task>"`; the local adapter delegates to the shared executable harness and never bundles a copy. Set `EVO_HOME` to the authoritative core checkout or place `captains_log` alongside this repository. Inspect current main HEAD in both repositories before changing files.

Before a PR, run `npm run verify`. Do not modify production Client Compass behavior, customer-facing reports, presentations, inventories, GHL, Supabase, or deployments for EVO adoption. Use a task-scoped contract, preserve protected functionality, record actual checks and GitHub evidence, and do not claim a merge or runtime verification without readback. CLV Bootstrap remains a fallback.

Repository instruction files do not automatically execute tooling in ordinary ChatGPT; Codex/Claude native discovery requires separate real-session verification.
