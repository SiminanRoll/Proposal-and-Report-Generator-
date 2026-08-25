import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("OTA tracker quoted card and view use active current-year OTA history", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tracker-dashboard.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /const currentYear = today\.slice\(0, 4\)/);
  assert.match(dashboard, /const quotedYearRows = useMemo\(\(\) => activeDisplayRows\.filter/);
  assert.match(dashboard, /row\.quoted && otaHistoryDate\(row\)\.startsWith\(`\$\{currentYear\}-`\)/);
  assert.match(dashboard, /result\.quoted = quotedYearRows\.length/);
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

test("missing info cleanup catches undated rows and current-year rows without a TC", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tracker-dashboard.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /function needsMissingInfo\(row: DisplayOta, currentYear: string\)/);
  assert.match(dashboard, /if \(!appointmentDate\) return true/);
  assert.match(dashboard, /appointmentDate\.startsWith\(`\$\{currentYear\}-`\) && !clean\(row\.tc_name\)/);
  assert.match(dashboard, /filter === "missing" && !needsMissingInfo\(row, currentYear\)/);
  assert.match(dashboard, /Missing info · \{currentYear\} \(\{missingInfoRows\.length\}\)/);
});
