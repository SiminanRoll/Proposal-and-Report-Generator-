# Proposal & Report Generator v1.0.2.6

## Potential-client proposal pricing

- Added a complete A360 pricing builder for prospect proposals.
- Loaded the monthly baseline from the supplied `A360 Pricing 2.xlsx` worksheet:
  - A360 Site — $125/month
  - A360 Server with Standard Backup — $180/month
  - Multi-server discount — -$100/month per qualifying additional server
  - A360 Workstation — $48/month
  - Cloud Plus Advanced Backup — $100/month
  - Workstation Backup — $35/month
  - Managed Firewall — $50/month
  - GoToMyPC — $20/month
  - Optional new-client discount — -$200/month
- Server and workstation quantities are prefilled from the RFT intelligence results.
- Added editable one-time scope for replacement equipment, installation/configuration labor, practice-management software, imaging software, and onboarding.
- Included line totals, one-time totals, monthly totals, custom items, discounts, and pricing-completion warnings.

## Prospect presentation flow

Potential-client proposals now follow this client-facing sequence:

1. Introduction
2. Why Advantage Technologies
3. What we found
4. HIPAA review and readiness, when enabled
5. The Advantage 360 plan
6. One-time and monthly investment
7. Authorization and close CTA

## Authorization

- Added typed client authorization in presentation mode.
- Captures authorized name, title, acceptance, and timestamp.
- Changing pricing after authorization returns the proposal to draft for reapproval.
- PDF and HTML exports include a client authorization section and signature lines when unsigned.

## RFT scope intelligence

- Added counts for servers and workstations at or beyond the 60-month replacement threshold.
- These counts prefill the applicable one-time equipment and labor scope without inventing hardware prices.
