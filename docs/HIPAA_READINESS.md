# HIPAA Security Readiness Engine

The HIPAA engine stores the original 31-question model as structured data. Question wording, ownership, mappings, prompts, evidence hints, response state, scoring, and report visibility can be updated without redesigning presentation pages.

## Ownership

- 16 client-owned questions
- 8 joint Advantage/organization questions
- 7 Advantage-prefill questions

Prefill is a proposed technical answer supported by imported evidence. It is not a final compliance determination.

## Completion logic

A response is complete only when its required support is present:

- Yes and Partially require notes or evidence.
- Partially and No require a recommended corrective action.
- Not Applicable requires an explanation.
- Not Yet Assessed remains open unless explicitly deferred with Skip for now.

## Live presentation queue

The queue contains every enabled question that is neither complete nor explicitly deferred. Saving an answer removes it from the queue. Skipping preserves it as Not Yet Assessed and records the deferral time and reason.

## Scoring

- Yes: 100
- Partially: 50
- No: 0
- Not Applicable: excluded
- Not Yet Assessed: zero in the completion-adjusted displayed score

The UI also shows the score among assessed answers and the percentage of applicable questions assessed. This prevents a partially completed review from appearing stronger than it is.

## Storage

Assessment records and snapshots remain in browser-local structured storage. Evidence attachments remain in browser-local file storage and are deleted with their workspace.
