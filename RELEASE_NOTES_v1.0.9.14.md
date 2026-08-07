# Client Compass v1.0.9.14

## Static-export build hotfix

- Replaced the runtime dynamic segment route (`/segments/[segmentId]`) with the export-safe static route `/segments/view/?id=...`.
- Segment Manager cards and left-rail segment hot buttons now open the static detail page using the segment id query parameter.
- Segment detail reads the selected segment client-side, preserving fully customizable runtime-created segments without requiring `generateStaticParams()`.
- Removed the dynamic route that caused `next build` to fail under `output: "export"`.

No segment rules, enrollment logic, colors, icons, stats, or client-book behavior changed.
