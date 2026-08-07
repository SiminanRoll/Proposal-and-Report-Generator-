import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const editor = fs.readFileSync(new URL("../src/components/hardware-inventory-editor.tsx", import.meta.url), "utf8");
const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const truth = fs.readFileSync(new URL("../src/lib/technical-truth/index.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");

test("v1.8.9 exposes a report-level hardware inventory editor with add remove rename and health fields", () => {
  assert.match(outcome, /Edit hardware inventory/);
  assert.match(outcome, /HardwareInventoryEditor/);
  assert.match(editor, /Add missing device/);
  assert.match(editor, /Save inventory & recalculate/);
  assert.match(editor, /Device .* name|aria-label=\{`Device \$\{index \+ 1\} name`\}/);
  assert.match(editor, />Remove</);
  for (const label of ["Type", "Lifecycle", "Operating system", "Model", "Location", "Age \\(years\\)", "Warranty end", "Last check-in"]) assert.match(editor, new RegExp(label));
  assert.match(types, /manualInventory\?: ProjectManualInventory/);
});

test("manual inventory updates authoritative report facts and totals", () => {
  const manual = fs.readFileSync(new URL("../src/lib/outcomes/manual-inventory.ts", import.meta.url), "utf8");
  for (const key of ["compass.authoritativeInventoryTotal", "scalepad.totalAssets", "scalepad.servers", "scalepad.workstations", "scalepad.vms", "scalepad.replacement.current", "scalepad.replacement.dueSoon", "scalepad.replacement.overdue", "scalepad.os.unsupported", "scalepad.inventory"]) assert.match(manual, new RegExp(key.replaceAll(".", "\\.")));
  assert.match(outcome, /projectWithBuiltOutcome/);
  assert.match(outcome, /withManualInventory/);
});

test("Windows 8 and Windows 8.1 are classified as end of support", async () => {
  const module = await transpileTestModule("../src/lib/technical-truth/index.ts", import.meta.url, { prefix: "v189-windows8" });
  assert.equal(module.classifyTechnicalOsSupport("Microsoft Windows 8 Pro"), "unsupported");
  assert.equal(module.classifyTechnicalOsSupport("Windows 8.1 Professional"), "unsupported");
  assert.equal(module.classifyTechnicalOsSupport("Windows 10 Pro"), "unsupported");
  assert.equal(module.classifyTechnicalOsSupport("Windows 11 Pro"), "supported");
  assert.match(truth, /windows8/);
});
