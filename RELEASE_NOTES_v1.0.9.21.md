# Client Compass v1.0.9.21

## Accurate territory map + quick correction

- Replaced the hand-drawn service-area shapes with locally stored U.S. Census-derived state outlines so the map is geographically recognizable and correctly positioned.
- Removed the fake rectangular territory cuts. Multi-territory states now keep the accurate state outline and use compact territory markers inside the state instead of implying county-precise boundaries we do not actually have.
- Territory hover still synchronizes with the Value / Clients in need donut and the compact health detail panel.
- Clicking any territory marker now opens the actual client list behind that territory.
- Added a quick territory repair drawer with per-client State and Territory edits, state-specific territory suggestions, a bulk “apply one territory to this list” action, and one-save persistence back to the Client Compass dataset.
- Blank and malformed territory values are consolidated into a state-qualified `Needs review` group so records like `GA - Needs review` can be corrected directly from the map.
- Kept the map fully local with no map API, no new dependency, and no package-lock change.
