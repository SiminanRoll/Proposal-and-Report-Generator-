import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const scheduler = fs.readFileSync(new URL("../src/components/onsite-planning-scheduler.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const appointment = fs.readFileSync(new URL("../src/lib/outcomes/planning-appointment.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const schema = JSON.parse(fs.readFileSync(new URL("../schemas/project.schema.json", import.meta.url), "utf8"));

test("onsite planning card opens a client-call calendar and records the assigned consultant", () => {
  assert.match(experience, /<OnsitePlanningScheduler/);
  assert.match(experience, /approach\.mode === "onsite-project"/);
  assert.match(scheduler, /Schedule onsite planning/);
  assert.match(scheduler, /Technology Consultant/);
  assert.match(scheduler, /TIME_OPTIONS/);
  assert.match(scheduler, /planningAppointment:/);
});

test("confirmed appointment creates the large commitment stamp and updated planning card", () => {
  assert.match(scheduler, /Onsite Planning Scheduled/);
  assert.match(scheduler, /onsite-planning-toast/);
  assert.match(scheduler, /Onsite planning scheduled/);
  assert.match(css, /@keyframes onsitePlanningStamp/);
  assert.match(css, /\.planning-schedule-trigger\.scheduled/);
});

test("scheduled onsite details are persisted and carried into recap HTML and PDF", () => {
  assert.match(types, /planningAppointment\?: PlanningAppointment/);
  assert.ok(schema.properties.planningAppointment);
  assert.match(appointment, /formatPlanningAppointment/);
  assert.match(experience, /scheduledPlanningAppointment\(project\)/);
  assert.match(exportHtml, /Onsite planning scheduled/);
  assert.match(exportHtml, /Included in this PDF/);
  assert.match(exportHtml, /planningConsultantSentence/);
});
