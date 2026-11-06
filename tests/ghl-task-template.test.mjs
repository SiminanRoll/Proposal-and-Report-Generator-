import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_GHL_TASK_TEMPLATE, GHL_TASK_TEMPLATE_KEY,
  validateGhlTaskTemplate, dueDateForTaskTemplate,
} from "../src/lib/compass/ghl-task-template.mjs";
import { missingGhlStateFromBackup } from "../src/lib/compass/ghl-local-workspace-recovery.mjs";

const withDays = (dueBusinessDays, timeZone = "America/Chicago") => ({
  ...DEFAULT_GHL_TASK_TEMPLATE, dueBusinessDays, timeZone,
});

test("safe defaults are a reusable coordination call, not a fixed due date", () => {
  assert.equal(DEFAULT_GHL_TASK_TEMPLATE.title, "Coordination Call");
  assert.equal(DEFAULT_GHL_TASK_TEMPLATE.dueBusinessDays, 1);
  assert.equal(DEFAULT_GHL_TASK_TEMPLATE.dueTime, "10:00");
  assert.equal(DEFAULT_GHL_TASK_TEMPLATE.timeZone, "America/Chicago");
});

test("relative task due date skips weekend and recomputes on every click", () => {
  const friday = new Date("2026-11-06T17:00:00Z");
  const monday = new Date("2026-11-09T17:00:00Z");
  assert.deepEqual(dueDateForTaskTemplate(withDays(1), friday), {
    date: "2026-11-09", time: "10:00", timeZone: "America/Chicago",
  });
  assert.equal(dueDateForTaskTemplate(withDays(2), friday).date, "2026-11-10");
  assert.equal(dueDateForTaskTemplate(withDays(1), monday).date, "2026-11-10");
  assert.equal(dueDateForTaskTemplate(withDays(0), friday).date, "2026-11-06");
});

test("current calendar day uses configured timezone near midnight", () => {
  const utcEarlySaturday = new Date("2026-11-07T02:00:00Z");
  assert.equal(dueDateForTaskTemplate(withDays(0, "America/Chicago"), utcEarlySaturday).date, "2026-11-06");
  assert.equal(dueDateForTaskTemplate(withDays(0, "America/New_York"), utcEarlySaturday).date, "2026-11-06");
  assert.equal(dueDateForTaskTemplate(withDays(1), utcEarlySaturday).date, "2026-11-09");
});

test("invalid template is rejected and cannot be auto-restored from local Work Folder", () => {
  const invalid = { ...DEFAULT_GHL_TASK_TEMPLATE, dueTime: "invalid" };
  assert.equal(validateGhlTaskTemplate(invalid), null);
  assert.equal(validateGhlTaskTemplate({ ...DEFAULT_GHL_TASK_TEMPLATE, dueBusinessDays: 999 }), null);
  assert.equal(validateGhlTaskTemplate({ ...DEFAULT_GHL_TASK_TEMPLATE, title: "" }), null);
  assert.deepEqual(missingGhlStateFromBackup({}, {
    [GHL_TASK_TEMPLATE_KEY]: JSON.stringify(invalid),
  }), {});
});

test("valid saved template is included in Protected Workspace recovery without overwriting new settings", () => {
  const raw = JSON.stringify({
    ...DEFAULT_GHL_TASK_TEMPLATE, title: "THR Coordination Call",
    description: "Confirm the next client account review",
    dueBusinessDays: 2, dueTime: "09:15",
  });
  assert.deepEqual(missingGhlStateFromBackup({}, { [GHL_TASK_TEMPLATE_KEY]: raw }),
    { [GHL_TASK_TEMPLATE_KEY]: raw });
  assert.deepEqual(missingGhlStateFromBackup({ [GHL_TASK_TEMPLATE_KEY]: "newer" },
    { [GHL_TASK_TEMPLATE_KEY]: raw }), {});
});

test("ordinary Add Task dialog has no repeated due-date/time/description fields", () => {
  const modal = readFileSync("src/components/ghl-task-preflight-dialog.tsx", "utf8");
  const settings = readFileSync("src/components/ghl-task-template-settings.tsx", "utf8");
  const backup = readFileSync("src/components/compass-master-backup-settings.tsx", "utf8");
  assert.match(modal, /dueDateForTaskTemplate/);
  assert.match(modal, /Change task defaults in Settings/);
  assert.doesNotMatch(modal, /type="date"|type="time"|<textarea/);
  assert.match(settings, /Save task defaults/);
  assert.match(settings, /saveDurableDatabaseMirrorNow/);
  assert.match(backup, /GhlTaskTemplateSettings/);
});
