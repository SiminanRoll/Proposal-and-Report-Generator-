# Proposal & Report Generator v1.0.3.1

## Onsite scheduler presentation fixes

- Moved the scheduling modal and confirmation toast into a document-level React portal.
- Replaced the translucent overlay with a fully opaque branded backdrop.
- Changed both calendar columns to solid dark panels so underlying report content cannot show through.
- Raised the scheduler and toast above the complete presentation, including its sticky header.
- Locks page scrolling while the scheduler is open.

## Recap scheduling

- Added the same onsite-planning scheduling control to the Recap page when an onsite project review is recommended.
- The Planning and Recap controls read and update one shared appointment.
- Confirmed consultant, date, and time continue to flow into the report and PDF.
