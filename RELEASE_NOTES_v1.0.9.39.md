# Client Compass v1.0.9.39

Client record simplification and map-selection/compass correction pass.

- Default All / Need / Value compass bearings now come from the donut's actual rendered arc geometry instead of rounded display values.
- With geography selected, the compass points to the highest represented-value section inside the selected scope; the needle color still confirms the target section.
- Normal map clicks replace the previous geography selection. Ctrl+Click (or Cmd+Click) is required to intentionally build a multi-state selection.
- A second normal click on the same map section promotes the selection to its geographic state group.
- All remains a true geography reset.
- Client detail view promotes Account Review Outcome near the top, removes duplicate explanatory subtext, and collapses Client details and Captain's Log history by default while keeping the latest activity visible.
- Presentation cover copy is simplified to “Prepared for <Client>”.
- Captain's Log completion state is sticky across replayed/stale create or update events and only becomes open again on an explicit reopen event.
