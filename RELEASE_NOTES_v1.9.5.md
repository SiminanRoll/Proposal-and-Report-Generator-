# Client Compass v1.9.5

## Client-facing report polish
- Removed the Locations slide from the live presentation.
- Multi-location detail remains in the PDF, but repetitive “What this means for you” blurbs were removed from each site.
- The final PDF page now contains one overall next-steps message plus Patric Beckman’s Client Success Manager contact information.
- Security/technology overview subtext is now written for the client rather than describing report-generation behavior.

## Captain's Log sync reliability
- Cloud configuration and desktop availability are now separate states.
- A real ping/ack proves Captain's Log V842 is processing the shared Supabase queue.
- Individual and bulk sync no longer report a queued request as a successful sync.
- Bulk catch-up applies only returned client snapshots and reports timeouts clearly.
- Batch size reduced to 20 clients to keep response payloads manageable.
