# Client Compass v1.0.9.35

Map stability and no-scroll rail polish.

- Removes the body-wide compass MutationObserver and replaces it with lightweight map-scoped/event-driven updates to reduce lag and eliminate compass flicker.
- Removes expensive moving blur/filter compositing from the segment drawer and compass animation to prevent the masking artifact seen during drawer motion.
- Makes the saved-segment drawer collapse immediately after a card drag/drop and prevents hover from instantly reopening it.
- Visually joins the segment chevron and drawer to the right-side blue-glass rail instead of leaving them floating beside the panel.
- Lets the desktop map and insight rail grow naturally to fit donut metrics, segment slots, selected state pills, clear controls, and View clients without internal vertical scrolling.
- Moves View clients into normal document flow and reserves equivalent space when no state/region is selected so the map does not jump or collide with lower controls.
