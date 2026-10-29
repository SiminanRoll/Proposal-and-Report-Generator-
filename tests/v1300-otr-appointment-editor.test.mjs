import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const scheduler = fs.readFileSync("src/components/onsite-planning-scheduler.tsx", "utf8");
const workspace = fs.readFileSync("src/components/project-workspace.tsx", "utf8");
const pdfEditor = fs.readFileSync("src/components/project-pdf-editor-page-client.tsx", "utf8");
const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("saved Technology Review exposes a discoverable appointment editor", () => {
  assert.match(workspace, /report-workspace-appointment/);
  assert.match(workspace, /canEditReportAppointment/);
  assert.match(workspace, /<OnsitePlanningScheduler project=\{currentProject\} onUpdate=\{update\} variant="toolbar"/);
  assert.match(workspace, /Changes appear in the presentation and the next PDF/);
});

test("scheduler edits the authoritative appointment, preserving its time zone and consultant", () => {
  assert.match(scheduler, /variant\?: "default" \| "compact" \| "toolbar"/);
  assert.match(scheduler, /variant === "toolbar"/);
  assert.match(scheduler, /appointment \? "Edit appointment" : "Schedule appointment"/);
  assert.match(scheduler, /const planningAppointment: PlanningAppointment = \{/);
  for (const field of ["date: selectedDate", "time: selectedTime", "timeZone: selectedTimeZone", "consultantName: cleanName"]) {
    assert.ok(scheduler.includes(field), field);
  }
  const save = scheduler.indexOf("saveProject(updatedProject);");
  assert.ok(save > -1 && save < scheduler.indexOf("onUpdate(updatedProject);", save));
  assert.match(scheduler, /nextStepWithAppointment\(project, planningAppointment\)/);
});

test("PDF editor preserves saved text edits and refreshes actual appointment source", () => {
  assert.match(pdfEditor, /<OnsitePlanningScheduler project=\{project\} onUpdate=\{updateAppointment\} variant="toolbar" disabled=\{dirty \|\| saving\}/);
  assert.match(pdfEditor, /Save PDF text edits before changing the appointment/);
  assert.match(pdfEditor, /if \(dirty \|\| saving\) return;/);
  assert.match(pdfEditor, /setProject\(next\);/);
  assert.match(pdfEditor, /setPreviewHtml\(buildPdfPreview\(next, draftOverrides\)\)/);
  assert.match(pdfEditor, /setStatus\("Appointment saved\. PDF preview updated\."\)/);
});

test("a confirmed roadmap does not hide a scheduled OTR date in client PDF", () => {
  assert.match(pdf, /const appointment = noActionNeeded \|\| approach\.mode === "purchase-planning" \? null : scheduledPlanningAppointment\(project\)/);
  assert.doesNotMatch(pdf, /const appointment = noActionNeeded \|\| agreedPlan/);
  assert.match(pdf, /consultationTitle = noActionNeeded \? [^;\n]+ : appointment \? formatPlanningAppointment\(appointment\) : agreedPlan/);
  assert.match(pdf, /recapNextPanel = agreedPlan && !appointment \? ""/);
  assert.match(pdf, /planningConsultantSentence\(project, appointment\)/);
});

test("date and time formatting remain tied to the explicit saved time zone", async () => {
  const stub = "data:text/javascript," + encodeURIComponent(
    "export const isHourlyOnsiteService = () => false; export const isRemoteConsultation = () => false;"
  );
  const mod = await transpileTestModule("../src/lib/outcomes/planning-appointment.ts", import.meta.url, {
    replacements: { 'from "./planning-mode"': 'from "' + stub + '"' },
  });
  const appointment = {
    status: "scheduled", date: "2026-11-19", time: "09:00", timeZone: "America/New_York",
    consultantName: "Test Consultant", scheduledAt: "2026-10-29T16:00:00Z",
  };
  const result = mod.formatPlanningAppointment(appointment);
  assert.match(result, /Thursday, November 19, 2026 at 9:00 AM ET/);
  const project = { planningAppointment: appointment };
  assert.equal(mod.scheduledPlanningAppointment(project), appointment);
});
