import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const scheduler = fs.readFileSync(new URL("../src/components/onsite-planning-scheduler.tsx", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const appointment = fs.readFileSync(new URL("../src/lib/outcomes/planning-appointment.ts", import.meta.url), "utf8");
const planningMode = fs.readFileSync(new URL("../src/lib/outcomes/planning-mode.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const schema = JSON.parse(fs.readFileSync(new URL("../schemas/project.schema.json", import.meta.url), "utf8"));

test("planning card supports onsite reviews and remote Technology Consultant calls", () => {
  assert.match(experience, /<OnsitePlanningScheduler/);
  assert.match(scheduler, /Schedule a consultation call/);
  assert.match(scheduler, /Schedule onsite planning/);
  assert.match(scheduler, /Technology Consultant/);
  assert.match(scheduler, /TIME_OPTIONS/);
  assert.match(scheduler, /planningAppointment:/);
  assert.match(planningMode, /remote-consultation/);
  assert.match(planningMode, /onsite-review/);
});

test("scheduler is available from both planning and recap", () => {
  const schedulerUses = experience.match(/<OnsitePlanningScheduler/g) || [];
  assert.equal(schedulerUses.length, 2);
  assert.match(experience, /variant="compact"/);
  assert.match(experience, /<RecapPresentation project=\{project\} onUpdate=\{onUpdate\}/);
});

test("calendar and commitment toast render above the presentation without inherited transparency", () => {
  assert.match(scheduler, /createPortal/);
  assert.match(scheduler, /document\.body/);
  assert.match(css, /\.planning-scheduler-backdrop\{[\s\S]*z-index:20000/);
  assert.match(css, /background:radial-gradient\(circle at 82% 8%,#12386f/);
  assert.match(css, /\.planning-calendar-panel,\.planning-appointment-panel\{[^}]*background:#071a36/);
});

test("confirmed appointment creates a mode-aware commitment stamp and updated planning card", () => {
  assert.match(scheduler, /Consultation Call Scheduled/);
  assert.match(scheduler, /Onsite Planning Scheduled/);
  assert.match(scheduler, /onsite-planning-toast/);
  assert.match(planningMode, /Consultation call scheduled/);
  assert.match(planningMode, /Onsite planning scheduled/);
  assert.match(css, /@keyframes onsitePlanningStamp/);
  assert.match(css, /\.planning-schedule-trigger\.scheduled/);
});

test("scheduled planning details and recommendation mode persist into recap HTML and PDF", () => {
  assert.match(types, /planningAppointment\?: PlanningAppointment/);
  assert.match(types, /planningRecommendationMode\?: PlanningRecommendationMode/);
  assert.ok(schema.properties.planningAppointment);
  assert.ok(schema.properties.planningRecommendationMode);
  assert.match(appointment, /formatPlanningAppointment/);
  assert.match(experience, /scheduledPlanningAppointment\(project\)/);
  assert.match(exportHtml, /planningScheduledLabel\(project\)/);
  assert.match(exportHtml, /planningModeLabel\(project\)/);
  assert.match(exportHtml, /planningConsultantSentence/);
});

test("no action needed persists as a healthy outcome without consultation scheduling", () => {
  assert.match(types, /"no-action-needed"/);
  assert.ok(schema.properties.planningRecommendationMode.enum.includes("no-action-needed"));
  assert.match(planningMode, /isNoActionNeeded/);
  assert.match(experience, /No action needed/);
  assert.match(experience, /noActionNeeded \|\| approach\.mode === "purchase-planning" \? null/);
  assert.match(exportHtml, /No immediate action needed/);
  assert.match(exportHtml, /No project, replacement, or consultant follow-up is required/);
  assert.match(exportHtml, /const actionEntries = noActionNeeded\s*\? \[\]/);
  assert.match(exportHtml, /pdf-no-action-roadmap/);
  assert.match(exportHtml, /noActionNeeded \? "" : siteOverview/);
  assert.match(exportHtml, /next annual technology review/);
  assert.doesNotMatch(exportHtml, /quarterly/i);
});
