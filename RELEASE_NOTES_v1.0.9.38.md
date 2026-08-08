# Client Compass v1.0.9.38

Map selection, compass targeting, and Segment Manager control correction.

- Keeps hover as a rich preview: map section emphasis, donut contribution highlighting, and live right-rail stats remain non-persistent.
- Makes one user click land on the exact map section; clicking the same section again promotes the selection to the full geographic group (for example OH + IN or AL + TN + KY).
- When a complete geographic group is already selected, clicking a member state removes that member from the active geography filter.
- Keeps bottom geography pills as the visible source of truth for group filters.
- Dims service states that have zero matches for the installed segment stack while leaving every service state visible and inspectable.
- Rebuilds compass targeting from donut metric values rather than SVG path geometry. The winning group is chosen by combined group total and the needle points to the angular center of the entire geographic group, never an individual subsection.
- Colors the compass head with a brightened version of the donut color located at the center of the winning group for visual confirmation.
- Fixes Segment Manager 3D card hit testing so only the visible face accepts pointer input.
- Adds clear hover/press feedback to View clients, Edit segment, and Delete; Delete receives a distinct destructive hover treatment.
