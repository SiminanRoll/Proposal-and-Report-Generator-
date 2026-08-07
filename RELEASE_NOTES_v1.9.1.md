# Client Compass v1.9.1

## HIPAA client-facing follow-up cleanup

- Prevents internal HIPAA questionnaire coaching/helper text from appearing as the client-facing Priority follow-up explanation in the presentation or final PDF.
- Uses one shared response-aware client-facing formatter for both the live presentation and exported report so the two surfaces stay aligned.
- Preserves manually entered Client-visible observation and Recommended next action as the highest-priority wording.
- Adds tailored fallback follow-up language for each HIPAA question when no client-facing note or next action was entered.
- Unanswered or skipped items now use a simple client-facing confirmation message rather than reviewer instructions.
