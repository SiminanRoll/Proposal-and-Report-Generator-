import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function transpileModule(relativePath, replacements = {}) {
  return transpileTestModule(relativePath, import.meta.url, { replacements, prefix: "client-compass-v194" });
}

function fact(key, value) {
  return { key, label: key, value, category: "lifecycle", confidence: "high", sourceFileId: "compass" };
}

test("v1.9.4 diagnostics preserve malformed authoritative rows instead of silently dropping them", async () => {
  const module = await transpileModule("../src/lib/outcomes/inventory-diagnostics.ts", {
    'import { lifecycleDevices } from "./client-report-data";': 'const lifecycleDevices = (project) => project.__reportDevices;',
  });
  const malformed = JSON.stringify({
    type: "workstation",
    name: "",
    sourceDeviceId: "client-1-device-warrantyexpiry-deadbeef",
    sourceDeviceName: "WarrantyExpiry",
    authoritative: true,
    location: "Main",
    lifecycleStatus: "unknown",
  });
  const source = {
    id: "compass",
    name: "Client Compass current snapshot",
    mimeType: "application/x-client-compass-snapshot",
    analysis: {
      sourceType: "scalepad",
      facts: [
        fact("compass.authoritativeInventory", true),
        fact("compass.authoritativeInventoryTotal", 1),
        fact("scalepad.workstations", 1),
        fact("scalepad.inventory", [malformed]),
      ],
    },
  };
  const project = { client: { name: "Example Practice" }, sources: [{ files: [source] }], __reportDevices: [] };
  const diagnostics = module.buildInventoryDiagnostics(project, "2026-08-07T18:30:00Z");
  assert.equal(diagnostics.authoritativeTotal, 1);
  assert.equal(diagnostics.authoritativeMissingFromReport, 1);
  assert.equal(diagnostics.identityReview, 1);
  assert.equal(diagnostics.passed, false);
  assert.equal(diagnostics.rows[0].sourceDeviceId, "client-1-device-warrantyexpiry-deadbeef");
  assert.equal(diagnostics.rows[0].sourceDeviceName, "WarrantyExpiry");
  assert.equal(diagnostics.rows[0].normalizedName, "WarrantyExpiry");
  assert.match(diagnostics.rows[0].disposition, /did not reach report output/i);
});

test("v1.9.4 generator preserves a device whose normalized display name collapses", () => {
  const source = fs.readFileSync(new URL("../src/lib/compass/generator-bridge.ts", import.meta.url), "utf8");
  assert.match(source, /const normalizedName = normalizeTechnicalDeviceName\(device\.name\)/);
  assert.match(source, /const reportName = normalizedName \|\| `Identity review - \$\{device\.id\.slice\(-8\)/);
  assert.match(source, /name: reportName/);
});

test("v1.9.4 treats identity-review placeholders as an internal delivery blocker", () => {
  const report = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  const outcome = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
  assert.match(report, /Identity review\|Identity-review/);
  assert.match(outcome, /One or more source device records needs identity review/);
});
