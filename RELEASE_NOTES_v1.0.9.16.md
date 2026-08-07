# Client Compass v1.0.9.16

## Client enrichment + territory
- Client enrichment now treats **Territory** as the primary label for the existing market/territory field.
- Spreadsheet headers such as `Territory`, `Market`, `Sales Market`, and `Region Market` are all recognized.
- Territory remains available to Segment Manager through the Territory / market rule.

## Create new companies from unmatched imports
- Unmatched client-record rows can now create a new Client Compass company directly from the import review.
- Truly unmatched rows default to **Create new company record**; ambiguous rows remain review-first so likely duplicates are not created automatically.
- New companies are populated from the spreadsheet, flagged **Needs record review**, and remain available to search and segmentation even when they do not yet have hardware inventory.

## Record review group
- Data Tools now shows a compact **Needs record review** group whenever imported company records require cleanup.
- Opening a record uses the normal client editor, and **Mark reviewed** removes it from the group after the record is verified.
