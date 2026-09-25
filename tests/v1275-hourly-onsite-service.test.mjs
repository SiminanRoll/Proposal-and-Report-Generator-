import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const types = readFileSync("src/lib/projects/types.ts", "utf8");
const reviewTypes = readFileSync("src/lib/review-outcomes/types.ts", "utf8");
const planningMode = readFileSync("src/lib/outcomes/planning-mode.ts", "utf8");
const builder = readFileSync("src/lib/outcomes/builder.ts", "utf8");
const appointment = readFileSync("src/lib/outcomes/planning-appointment.ts", "utf8");
const scheduler = readFileSync("src/components/onsite-planning-scheduler.tsx", "utf8");
const editor = readFileSync("src/components/review-outcome-editor.tsx", "utf8");
const presentation = readFileSync("src/components/outcome-experience.tsx", "utf8");
const pdf = readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("hourly onsite service is a saved review next-step mode with the agreed client rate", () => {
  assert.match(types, /PlanningRecommendationMode = ReviewNextStepMode/);
  assert.match(reviewTypes, /"hourly-onsite-service"/);
  assert.match(planningMode, /HOURLY_ONSITE_SERVICE_RATE = 125/);
  assert.match(planningMode, /Hourly onsite service call/);
  assert.match(planningMode, /billed at \$\{HOURLY_ONSITE_SERVICE_RATE\} per hour/);
  assert.match(planningMode, /reach out to coordinate and confirm the date and time/);
});

test("selecting hourly service stays planned until the client review is confirmed", () => {
  assert.doesNotMatch(builder, /isHourlyOnsiteService\(project\)/);
  assert.doesNotMatch(builder, /status: "confirmed"[\s\S]*HOURLY_ONSITE_SERVICE_NEXT_STEP/);
  assert.match(editor, /planningModeDefaultNextStep\(nextStepMode\)/);
  assert.match(editor, /status[^\n]*confirmed/);
  assert.match(appointment, /if \(isHourlyOnsiteService\(project\)\) return null/);
});

test("hourly service is available in the unified Finalize Review next-step selector", () => {
  assert.match(editor, /value: "hourly-onsite-service"/);
  assert.match(editor, /label: "Hourly onsite service call"/);
  assert.doesNotMatch(planningMode, /MutationObserver/);
  assert.doesNotMatch(planningMode, /select\[aria-label="Planned next step"\]/);
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
