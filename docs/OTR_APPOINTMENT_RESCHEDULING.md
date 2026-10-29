# Rescheduling an OTR / Technology Consultant Appointment in Client Compass

Introduced in Client Compass **v1.3.0**.

## Workflow

1. Open the existing Technology Review from **Reports & proposals**.
2. Under the report heading, find **Appointment in this report** and select **Edit appointment**. When no appointment is saved, use **Schedule appointment**.
3. Choose the revised date, time, explicit time zone, and Technology Consultant in the existing scheduling calendar.
4. Confirm. Client Compass updates the original report's \`planningAppointment\` record without regenerating its ScalePad, Huntress, inventory, or HIPAA findings.
5. Open the presentation or download a **new PDF**. The scheduling information comes from the revised appointment, including when the review's client decisions are already confirmed.

The same control appears in the **PDF Editor** toolbar. If the PDF Editor has unsaved text changes, save them first; the appointment button is disabled while text changes are unsaved. Following confirmation, the PDF preview is rebuilt using the updated source report and saved text overrides.

## Data and accuracy contract

- \`project.planningAppointment\` is the authoritative saved appointment: \`date\`, \`time\`, \`timeZone\`, \`consultantName\`, and \`scheduledAt\`.
- \`scheduledPlanningAppointment\`, \`formatPlanningAppointment\`, and the common report/PDF renderer provide consistent client-facing date/time text.
- Rescheduling updates the generated appointment sentence in \`reviewOutcome.agreedNextStep\`, retaining unrelated notes when the sentence was system-generated.
- Confirmed client-roadmap state does not hide an otherwise valid scheduled appointment on the PDF.
- The final PDF capture layer also re-reads the saved report for scheduled next-step and consultant details.
- The user must download a **new** PDF after editing; previously generated PDF files are static.
- Changing the Client Compass report **does not** change the external Microsoft Bookings, Outlook, GHL or other calendar event. Coordinate the actual meeting separately.
- Existing report content and source files remain unchanged; no Supabase or external CRM write is triggered.

## Test gates

- \`node --test tests/v1300-otr-appointment-editor.test.mjs tests/v1246-global-appointment-timezone.test.mjs\`
- \`npm run typecheck\`
- \`npm run build\`

No unrelated report layout or client-health scoring changes were part of this feature.
