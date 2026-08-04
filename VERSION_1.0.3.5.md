# Version 1.0.3.5

This release fixes deployment of the PDF-only client workflow introduced in v1.0.3.4.

## Deployment repair

- Adds a pre-build cleanup step that removes obsolete hosted-sharing files left behind when a deployment is updated by copying a new release over an older v1.0.3.3 source directory.
- Removes the retired share API routes, public share page, hosted approval components, sharing libraries, and old HIPAA handoff module before Next.js type-checking begins.
- Restores a small backwards-compatible HIPAA question selector so a stale `handoff.ts` file cannot fail type-checking even when a deployment bypasses the normal npm build script.
- The hosted sharing, access-code, client-session, online approval, email-delivery, and IP-capture features remain removed.

## Conditional HIPAA return instructions

- The sentence **“Please email this completed document to your Technology Consultant, or Patric.Beckman@adv-tech.com.”** appears only when at least one HIPAA question is unanswered, marked Not sure, or skipped.
- When HIPAA is disabled or every HIPAA question is complete, no follow-up questionnaire or return page is generated and the email-return instruction is omitted.
- Completed assessments instead state that the score reflects the responses currently provided and remains subject to Advantage review and verification.

## Workflow

**Internal interactive workspace → client presentation → finalized PDF → client completes any missing HIPAA questions or proposal signature → client emails the PDF back → Advantage reviews and updates the workspace → revised report and score.**
