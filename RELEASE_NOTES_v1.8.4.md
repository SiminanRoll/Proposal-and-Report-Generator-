# Client Compass v1.8.4

## Project Coverage card redesign
- Increased the primary client counts substantially and strengthened metric hierarchy.
- Tightened card height and spacing so the client list comes into view sooner.
- Added a restrained metric wash, animated top accent, stronger selected-card elevation, and more premium hover treatment.
- Preserved all existing card flip, stat-segment, filtering, and client-list mechanics.

## Client-facing report presentation polish
- Hardware Inventory now uses a fixed-layout 10-column table sized to the presentation viewport.
- Removed the horizontal table scroll requirement and tightened cell padding/type scale while preserving every inventory field.
- Replaced the internal phrase “critical systems weighted” with the client-facing phrase “critical systems need attention.”

## Captain's Log handoff reliability
- Client Compass now checks the V839 localhost bridge for confirmed two-way sync.
- Coordination Call creation no longer depends on reverse sync: if localhost is unavailable, Client Compass launches the durable Windows `captainslog://` handoff and queues the call in Captain's Log.
- If reverse sync becomes available after launch, Client Compass retries the confirmed desktop creation path using the same request ID to avoid duplicates.
- Client/contact/activity synchronization remains a separate confirmed capability and can catch up after task creation.

## Validation
- `npm run lint` passed.
- `npm test` passed: 335 tests total, 330 passed, 0 failed, 5 skipped.
