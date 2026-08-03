# HIPAA Security Readiness Engine

The HIPAA module is a short readiness conversation for a technology review. It is not a substitute for the organization’s formal HIPAA Security Rule risk analysis, risk-management process, legal review, or required documentation.

The quick review groups related administrative, physical, technical, organizational, and documentation topics into 12 practical questions:

- 6 client-owned questions
- 4 joint client/Advantage questions
- 2 Advantage technical prefills

This reflects the Security Rule’s scalable, technology-neutral structure while keeping the meeting usable for a small or midsized practice. The organization’s formal risk analysis must still cover all electronic protected health information, threats, vulnerabilities, safeguards, likelihood, impact, and risk-management decisions.

## Fast completion model

A question is complete once a response is selected:

- Yes
- Somewhat
- No
- Does not apply
- Not sure

Notes are optional. Supporting files, evidence sources, review dates, responsible parties, target dates, and recommended actions are optional follow-up details rather than completion requirements.

“Not sure” remains open for the live review. The client can also skip remaining questions without creating a false completed result.

## Client pre-review handoff

1. Export the self-contained client HTML form.
2. Copy the prepared email text and attach the HTML form.
3. The client answers the 10 client and joint questions. The form autosaves locally while they work.
4. The client downloads a small JSON response file and emails it back.
5. Import that JSON file into the same client workspace.
6. Unanswered items remain queued for the live conversation.

The form instructs the client not to include patient information. No client response is transmitted by the app; the form and response file stay local until the sender chooses to email them.

## Prefill boundaries

Advantage prefills only the technical checkpoints it can support from imported managed-security or backup information. A prefill is a proposed technical response, not a compliance determination.

## Scoring

- Yes: 100
- Somewhat: 50
- No: 0
- Does not apply: excluded
- Not sure: zero in the completion-adjusted displayed score

The UI separately shows the result among answered questions and the percentage of applicable questions assessed, preventing an incomplete review from appearing complete.

## Storage and migration

Assessment data and snapshots remain in browser-local structured storage. Existing workspaces created with the earlier detailed question set are migrated into the condensed model; the client confirmation is reset so the consolidated answers can be reviewed again.
