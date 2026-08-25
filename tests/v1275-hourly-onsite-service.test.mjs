import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const types = readFileSync("src/lib/projects/types.ts", "utf8");
const planningMode = readFileSync("src/lib/outcomes/planning-mode.ts", "utf8");
const builder = readFileSync("src/lib/outcomes/builder.ts", "utf8");
const appointment = readFileSync("src/lib/outcomes/planning-appointment.ts", "utf8");
const scheduler = readFileSync("src/components/onsite-planning-scheduler.tsx", "utf8");
const presentation = readFileSync("src/components/outcome-experience.tsx", "utf8");
const pdf = readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("hourly onsite service is a saved planning mode with the agreed client rate", () => {
  assert.match(types, /"hourly-onsite-service"/);
  assert.match(planningMode, /HOURLY_ONSITE_SERVICE_RATE = 125/);
  assert.match(planningMode, /Hourly onsite service call/);
  assert.match(planningMode, /billed at \$\$\{HOURLY_ONSITE_SERVICE_RATE\} per hour/);
  assert.match(planningMode, /reach out to coordinate and confirm the date and time/);
});

test("selecting hourly service becomes the agreed next step and removes a TC appointment", () => {
  assert.match(builder, /isHourlyOnsiteService\(project\)/);
  assert.match(builder, /planningAppointment: undefined/);
  assert.match(builder, /status: "confirmed"/);
  assert.match(builder, /agreedNextStep: HOURLY_ONSITE_SERVICE_NEXT_STEP/);
  assert.match(appointment, /if \(isHourlyOnsiteService\(project\)\) return null/);
});

test("hourly service is available in the report next-step selector", () => {
  assert.match(planningMode, /select\[aria-label="Planned next step"\]/);
  assert.match(planningMode, /option\.value = "hourly-onsite-service"/);
  assert.match(planningMode, /option\.textContent = "Hourly onsite service call"/);
});

test("confirmed consultation appointments can be removed cleanly", () => {
  assert.match(scheduler, /Clear scheduled appointment/);
  assert.match(scheduler, /function clearAppointment\(\)/);
  assert.match(scheduler, /planningAppointment: undefined/);
  assert.match(scheduler, /nextStepWithoutAppointment\(project\)/);
});

test("presentation and PDF use the agreed next-step text instead of a stale consultation", () => {
  assert.match(presentation, /project\.reviewOutcome\.agreedNextStep/);
  assert.match(pdf, /agreedPlan \? project\.reviewOutcome\.agreedNextStep/);
});
