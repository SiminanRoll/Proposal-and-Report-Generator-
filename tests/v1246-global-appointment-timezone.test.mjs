import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const appointment = read("src/lib/outcomes/planning-appointment.ts");
const standardScheduler = read("src/components/onsite-planning-scheduler.tsx");
const a360Scheduler = read("src/components/prospect-a360-scheduler.tsx");
const a360Editor = read("src/components/a360-presentation-details-editor.tsx");
const experience = read("src/components/outcome-experience.tsx");
const exportHtml = read("src/lib/outcomes/export-html.ts");
const a360Conversation = read("src/lib/prospects/a360-conversation.ts");
const a360ReadableExport = read("src/lib/prospects/a360-readable-report-export.ts");

test("shared appointment formatting always carries the stored time zone", () => {
  assert.match(appointment, /PLANNING_TIME_ZONES/);
  assert.match(appointment, /planningTimeZoneShortLabel/);
  assert.match(appointment, /formatPlanningTime/);
  assert.match(appointment, /\$\{suffix\} \$\{zone\}/);
  assert.match(appointment, /formatPlanningAppointment/);
});

test("all scheduling confirmation surfaces expose an explicit time zone selector", () => {
  for (const source of [standardScheduler, a360Scheduler]) {
    assert.match(source, /selectedTimeZone/);
    assert.match(source, />Time zone</);
    assert.match(source, /PLANNING_TIME_ZONES/);
    assert.match(source, /timeZone: selectedTimeZone/);
    assert.match(source, /planningTimeZoneShortLabel\(selectedTimeZone\)/);
    assert.doesNotMatch(source, /timeZone:\s*Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  }
  assert.match(a360Editor, />Time zone</);
});

test("presentations and client reports use the shared appointment formatter", () => {
  assert.match(experience, /formatPlanningAppointment/);
  assert.match(exportHtml, /formatPlanningAppointment/);
  assert.match(a360Conversation, /formatPlanningAppointment/);
  assert.match(a360ReadableExport, /normalizeAppointmentTimeZoneDisplay/);
});
