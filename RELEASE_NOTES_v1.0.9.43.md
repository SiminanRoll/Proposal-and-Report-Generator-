# Client Compass v1.0.9.43

## Territory map layout correction

- Moves the existing interactive donut/compass out of the right rail's layout flow and visually anchors it inside the map field on desktop.
- Preserves the donut's existing hover, click, segment, and compass behavior without re-parenting React content.
- Gives the right rail more vertical room for selected territory details, health bars, View Clients, and segment controls.
- Widens the desktop detail rail slightly while trimming the overall workspace height for a better fit.
- Compacts Clients / In Need / Value into one tighter glass summary cluster inside the map.
- Anchors the saved-segment drawer chevron beside the Segments area instead of letting it float mid-rail.
- Makes segment slots flex into the remaining rail height and keeps Clear map filters visible inside the card.
- Returns the donut to normal document flow on tablet/mobile stacked layouts.

## Safety

- Keeps the v1.0.9.42 native All / Need / Value control fix intact.
- Does not change territory data, selection logic, map geometry, or segment calculations.
- `package-lock.json` is unchanged.
