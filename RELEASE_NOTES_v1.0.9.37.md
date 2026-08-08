# Client Compass v1.0.9.37

Map settle and donut stability correction.

- Simplifies the donut center label to All, Need, Value, or Segment.
- Makes map snapshots react directly to saved segment, match-mode, display-mode, and geography lens changes so the donut and totals commit from the actual current filter state instead of catching up later.
- Stops map-only lens changes from triggering a full asynchronous IndexedDB dataset reload, removing the unnecessary second refresh that caused late number jumps.
- Removes the synthetic Calculating overlay and its artificial flash/delay.
- Moves donut geographic ordering into the React source data so slice boundaries are deterministic before render.
- Makes the compass runtime read-only: it no longer rewrites donut paths or separator lines and never reacts to hover.
- Keeps the compass pointed at the largest grouped section for the current metric while hover only changes presentation.
- Moves the saved-segment handle up and left so it straddles the right glass edge immediately above the segment divider.
