# Version 1.0.1.9

This release fixes presentation metrics that remained visually small after count-up animation was introduced.

## Changes

- Animated numbers now inherit the size, weight, and line height of their numeric container instead of inheriting label styling from surrounding card selectors.
- Restored presentation-scale values across Security, Network Health, Hardware summaries, HIPAA review/results, Planning, and Recap.
- Rebuilt the Planning HIPAA readiness metric as a unified value (`score /100`) with a separate readable label.
- Enlarged HIPAA live-review progress, results metrics, category percentages, lifecycle proof points, and recap figures.
- Preserved the separate document-first PDF layout from version 1.0.1.8.
