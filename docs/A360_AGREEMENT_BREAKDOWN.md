# Optional A360 Services Agreement Breakdown

The client Technology Health Review now supports an opt-in "Your services" presentation section and a finished PDF services agreement sheet. By default, the section is OFF, with no service lines.

## Source and accuracy

The public descriptions at https://www.adv-tech.com/a360/ are suggested wording only, never proof that an individual client purchased an entitlement. Use the current agreement or invoice to enter each actual line item. Include the original service name, quantity, unit rate if known, billing cadence, editable client-friendly description, optional as-of date and source label.

## How to use

1. Open a completed Technology Health Review.
2. Select Edit services & pricing.
3. Optionally select **Add A360 example items** to insert the nine editable A360 SKU rows shown in the illustration, including a negative $200/month credit. The sample is not evidence of the client's agreement. Update every quantity, rate, credit eligibility and description from the current agreement before enabling client-facing output.
4. Decide whether prices should be visible. If rates are unknown, leave them blank rather than entering zero.
5. Enable Include agreement breakdown and explicitly verify details against the current agreement.
6. Save. The live native presentation gains Your services, and a new finished PDF gains a separate What your agreement includes page, with pagination for longer agreements. Existing PDF files do not update.
7. To update prices or services, reopen and re-verify the edited values. The default toggle remains off for all other clients.

## Contract and accounting safeguards

Service scope, actual charges and legal obligations are governed by the signed contract and current invoice. The report is an informational summary and does not amend them. Verified credits may use negative unit rates and zero-dollar rows remain distinct from blank (unknown) prices. The illustrative nine-row preset calculates to $500/month only when all sample rows apply unchanged. Monthly, quarterly, annual and other charges remain separate, and totals are shown only when every line in that billing group has a valid price. If one is missing, show Incomplete pricing rather than a partial total.

The report stores this on its own browser-local Project record and does not read or write ConnectWise, GHL or Supabase. No sensitive inventory or attachment file is uploaded. Each practice in a multi-practice ownership report retains separate agreement values, without automatically aggregating billing across legal entities.

## Validation

Test the agreement model, saving/reopening, report opt-in/off, mixed billing cadence, incomplete pricing, PDF inclusion and HTML escaping, dynamic THR navigation, and distinct practice details. Run TypeScript and production builds, then visually inspect a generated PDF in the deployed browser.
