import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(new URL("../src/components/client-activity-runtime.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/client-activity-notes.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const durable = fs.readFileSync(new URL("../src/components/durable-storage-runtime.tsx", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");

test("client review separates upcoming activity from completed history", () => {
  assert.match(runtime, /Next activity/);
  assert.match(runtime, /Recent history/);
  assert.match(runtime, /activitySync\.open_tasks/);
  assert.match(runtime, /filter\(completedActivity\)/);
  assert.match(runtime, /Show all \$\{upcoming\.length\}/);
  assert.match(runtime, /Show all \$\{history\.length\}/);
});

test("upcoming activity is surfaced in the top glance rather than hidden behind past history", () => {
  assert.match(runtime, /createPortal\([\s\S]*client-review-activity-summary-v1123[\s\S]*target\)/);
  assert.match(runtime, /nextActivity = upcoming\[0\]/);
  assert.match(css, /\.client-review-activity-summary-v1123/);
  assert.match(css, /\.client-review-activity-center-v1123\{[\s\S]*grid-column:1\/-1/);
});

test("company notes use the existing Compass client note and durable Supabase snapshot path", () => {
  assert.match(runtime, /internalNote: nextNote/);
  assert.match(runtime, /saveCompassDataset\(recalculateDataset/);
  assert.match(runtime, /Company notes/);
  assert.match(durable, /client-compass-data-changed/);
  assert.match(durable, /saveCloudDatabaseSnapshotNow/);
});

test("v1.1.23 activity styles load last", () => {
  assert.match(layout, /client-review-viewport\.css";\nimport "\.\/client-activity-notes\.css";/);
  assert.match(version, /APP_VERSION = "1\.1\.23"/);
});
