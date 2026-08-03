# Version 1.0.2.2

This maintenance release corrects lifecycle classification and client-report totals.

- Recalculates every physical device from its normalized numeric age at render time, including older saved projects.
- Reclassifies rows whose model identifies them as virtual machines so they are not counted as workstations.
- Deduplicates inventory rows before lifecycle totals are calculated.
- Uses one canonical workstation-and-server data set for the introduction, lifecycle, inventory, planning, recap, HTML, and PDF views.
- Removes the legacy standalone warranty and operating-system summary panels and suppresses their former markup classes.
- Keeps all priority cards, including the first-priority server card, on dark report surfaces.
