# Client Compass v1.0.9.36

Map geography, compass persistence, segment workflow, and calculation-state polish.

- Reorders donut slices clockwise to mirror the service-area geography: Michigan, Ohio/Indiana, Georgia, Florida, Alabama/Tennessee/Kentucky, Illinois, then Wisconsin.
- Moves the compass into a persistent SVG overlay behind the donut text so React slice rerenders can no longer remove it.
- Keeps the compass pointing at the largest grouped geographic section using the reordered donut geometry.
- Moves the saved-segment tray higher and flush to the right-rail edge, and makes the tray open upward so all three segment slots stay exposed while choosing or dragging cards.
- Adds click-to-add for saved segment cards while preserving drag/drop and snap feedback.
- Restores automatic tray collapse on mouse leave, click-away, click-to-add, and successful drag/drop.
- Adds a real Calculating… state tied to actual map/segment DOM settling so large filter changes dim the current view until the updated map is ready.
- Makes All a true reset for geographic map filters and selected state pills while leaving saved segment cards available for later use.
- Adds Delete segment directly to the segment editor, strengthens card delete behavior and hover feedback, and cleans deleted segments out of active Map lens state.
