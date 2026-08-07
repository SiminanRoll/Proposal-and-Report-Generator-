# Client Compass v1.0.9.15

## Client record enrichment

- Data Tools now separates **Hardware & inventory** from **Client records & contacts**.
- The client-record importer accepts Company Name plus any supported client/profile field and does not alter hardware inventory.
- Supported record fields: City, State, Market, Industry, Client Tags, Primary Contact, Primary Contact Role, Primary Contact Email, Primary Contact Phone, Assigned Owner, Last Account Review Date, Last Quote Date, Next Follow Up, Workflow Status, and Internal Note.
- Blank incoming fields preserve current values; account-review and quote dates only move forward; client tags merge instead of replacing current tags.
- Matching uses exact names, saved aliases, normalized business names, smart similarity, and manual exception resolution.

## Segmentation

- Segment Manager can now use City, State, Market, Industry, and Client Tags as rule fields in addition to hardware, lifecycle, value, review timing, owner, and Captain's Log data.

## Client detail

- The client CRM editor now exposes geography, market, industry, tags, contact role, and last quote alongside existing relationship fields.
