import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("OTA tracker quoted card and view are scoped to the current OTA year", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tracker-dashboard.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /const currentYear = today\.slice\(0, 4\)/);
  assert.match(dashboard, /row\.health\.key === "quoted" && row\.appointment_date\?\.startsWith\(`\$\{currentYear\}-`\)/);
  assert.match(dashboard, /result\.quoted = quotedYearRows\.length/);
  assert.match(dashboard, /filter === "quoted" && \(row\.health\.key !== "quoted" \|\| !row\.appointment_date\?\.startsWith\(`\$\{currentYear\}-`\)\)/);
  assert.match(dashboard, /Quoted · \{currentYear\}/);
});

test("OTA tracker keeps operational reaches distinct", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tracker-dashboard.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /filter === "latest" && !isOtaInLatestWindow\(row\.appointment_date, today\)/);
  assert.match(dashboard, /filter === "action" && !needsAttention\(row\)/);
  assert.match(dashboard, /row\.health\.key === "overdue"/);
  assert.match(dashboard, /row\.health\.key === "due"/);
  assert.match(dashboard, /row\.health\.key === "upcoming"/);
});
