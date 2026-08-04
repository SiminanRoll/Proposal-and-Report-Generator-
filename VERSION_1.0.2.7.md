# Proposal & Report Generator v1.0.2.7

## Plain-language server planning

- Replaced the long server-project headline with a direct recommendation: **Plan on replacing the server**.
- Removed device hostnames from Network Health, Planning, Recap, and exported narrative copy.
- Narrative sections now refer to equipment by its client-facing role:
  - **Primary server**
  - **Cloud Plus backup server**
- The report still shows the actual device name inside hardware inventory and priority cards, where technical identification is useful.
- Server replacement copy now explains in plain language that applications, imaging systems, backups, and connected equipment must be reviewed before a complete project estimate and installation plan are prepared.

## Adaptive next steps

- A primary server or Cloud Plus backup server replacement leads to an onsite project review.
- More than four computers leads to an onsite workstation replacement review.
- One to four computers leads to a phone or remote review with the Technology Consultant and an estimate.
- Budget and timing remain flexible, but equipment that belongs in the same project is not automatically deferred.

## Equal server urgency

- The primary server and Cloud Plus backup server now use the same visual weight in the environment summary.
- Both use the same red priority treatment when replacement is required.
- Inventory row urgency now follows lifecycle status, so an overdue Cloud Plus backup server can no longer appear green.
- Type labels remain distinct so clients can tell the two server roles apart without implying different urgency.

## Client-facing terminology

- Replaced client-facing `Cloud Plus BDR`, `backup emergency server`, and `server-class system` language with **Cloud Plus backup server**.
- Updated HIPAA backup evidence and PDF/HTML export wording to use the same terminology.
- Technical CPBDR, CPBR, and EQUUS detection remains intact behind the scenes.
