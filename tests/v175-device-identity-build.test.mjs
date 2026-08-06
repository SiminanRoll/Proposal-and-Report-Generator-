import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTechnicalTruthForTest, transpileTestModule } from "./test-transpile-helper.mjs";

async function loadCompassRuntime() {
  const [config, engine] = await Promise.all([
    transpileTestModule("../src/lib/compass/config.ts", import.meta.url, { prefix: "v175-config" }),
    transpileTestModule("../src/lib/compass/engine.ts", import.meta.url, { prefix: "v175-engine" }),
  ]);
  return { ...config, ...engine };
}

async function loadAdapters() {
  return transpileTestModule("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url, { prefix: "v175-adapters" });
}

function row(overrides = {}) {
  return {
    rowNumber: 2,
    organization: "McGuire, Mark DDS",
    location: "Main Office",
    deviceName: "KEN-OFFICETHREE",
    stableId: "",
    lastUptime: "2026-08-06",
    videoCard: "Intel Graphics",
    warrantyStart: "2025-05-24",
    warrantyEnd: "2026-08-25",
    lastLogin: "2026-08-06",
    memoryGiB: "16.6",
    osName: "Windows 11 Pro",
    deviceStatus: "Active",
    diskVolumeUsage: "C: 300/1000 GB (30%)",
    deviceModel: "Tower ECT1250",
    ...overrides,
  };
}

test("Compass preserves same-name devices when their stable IDs or technical identities differ", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, deduplicateRawRows } = await loadCompassRuntime();
  const rows = [
    row({ stableId: "9X25894", rowNumber: 2, lastLogin: "OfficeThree" }),
    row({ stableId: "10L2894", rowNumber: 3, lastLogin: "OfficeOne" }),
    row({ stableId: "", rowNumber: 4, deviceName: "OFFICETHREE", deviceModel: "MS-7850", osName: "Windows 10 Pro", warrantyStart: "", warrantyEnd: "", memoryGiB: "4.2" }),
  ];
  assert.equal(deduplicateRawRows(rows).length, 3);

  const parsed = { sourceName: "Ninja.xlsx", rows, totalRows: rows.length, rejectedRows: 0, detectedHeaders: ["deviceName", "organization"] };
  const preview = buildImportPreview(parsed, null, { "McGuire, Mark DDS": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-06T17:00:00Z"));
  assert.ok(preview.dataset);
  assert.equal(preview.dataset.devices.length, 3);
  assert.equal(new Set(preview.dataset.devices.map((device) => device.id)).size, 3);
});




test("lifecycle parsing preserves same-name rows with distinct serials and supporting details", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const analysis = parseDeviceInventoryExport([
    { Device: "KEN-OFFICETHREE", Organization: "McGuire, Mark DDS", "BIOS Serial Number": "9X25894", "Device Model": "Tower ECT1250", "OS Name": "Windows 11 Pro", "Last Login": "OfficeThree" },
    { Device: "KEN-OFFICETHREE", Organization: "McGuire, Mark DDS", "BIOS Serial Number": "10L2894", "Device Model": "Tower ECT1250", "OS Name": "Windows 11 Pro", "Last Login": "OfficeOne" },
    { Device: "OFFICETHREE", Organization: "McGuire, Mark DDS", "Device Model": "MS-7850", "OS Name": "Windows 10 Pro", "Last Login": "office3" },
  ], "lifecycle", "Hardware Lifecycle.xlsx");
  const inventoryFact = analysis.facts.find((item) => item.key === "scalepad.inventory");
  assert.ok(inventoryFact);
  assert.equal(inventoryFact.value.length, 3);
});

test("wrapped lifecycle hostnames do not consume the following OfficeThree row", async () => {
  const { parseScalePadReport } = await loadAdapters();
  const text = `Hardware Lifecycle Report
McGuire, Mark DDS
16 Hardware assets
\fHardware Lifecycle Report
Workstations User Last Check-In Make Serial Model OS Age Purchased Warranty Expiry RAM CPU Storage
MYOTRONICS- mrmcguire 08/06/2026 MSI MS-7C96 Windows 11 25H2 Pro Edition 64-bit 34.2 GB AMD Ryzen 5 5500 4.3 TB
K7X
OFFICETHREE office3 08/06/2026 MSI MS-7850 Windows 10 22H2 Pro Edition 64-bit 4.2 GB Core i3-4340 3.60GHZ 249.4 GB`;
  const analysis = parseScalePadReport(text, "mcguire", "Hardware Lifecycle Report.pdf");
  const inventoryFact = analysis.facts.find((item) => item.key === "scalepad.inventory");
  const inventory = inventoryFact.value.map((entry) => JSON.parse(entry));
  assert.ok(inventory.some((device) => device.name === "MYOTRONICS-K7X"));
  assert.ok(inventory.some((device) => device.name === "OFFICETHREE"));
  assert.ok(!inventory.some((device) => /K7XOFFICETHREE/i.test(device.name)));
});

test("same-name lifecycle candidates are matched using model and operating-system evidence", async () => {
  const { mergeTechnicalInventory } = await loadTechnicalTruthForTest();
  const authoritative = [
    { sourceDeviceId: "compass-new", sourceDeviceName: "KEN-OFFICETHREE", name: "KEN-OFFICETHREE", model: "Tower ECT1250", os: "Windows 11 Pro", age: 0 },
    { sourceDeviceId: "compass-old", sourceDeviceName: "OFFICETHREE", name: "OFFICETHREE", model: "MS-7850", os: "Windows 10 Pro", age: 0 },
  ];
  const enrichment = [
    { name: "KEN-OFFICETHREE", serial: "9X25894", model: "Tower ECT1250", os: "Windows 11 Pro", age: 1.2, purchased: "2025-05-24" },
    { name: "OFFICETHREE", model: "MS-7850", os: "Windows 10 Pro", age: 8.4, purchased: "2018-03-01" },
  ];
  const result = mergeTechnicalInventory(authoritative, [{ label: "ScalePad lifecycle", inventory: enrichment }]);
  assert.equal(result.enrichedDevices, 2);
  assert.equal(result.ambiguousEnrichment.length, 0);
  assert.equal(result.unmatchedEnrichment.length, 0);
  assert.deepEqual(result.inventory.map((device) => device.age), [1.2, 8.4]);
});

test("production CSS has a complete responsive HIPAA rule", () => {
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.hipaa-results-metrics,\s*\}/);
  assert.match(css, /@media\(max-width:980px\)[^{]*\{[\s\S]*?\.hipaa-results-metrics\{grid-template-columns:repeat\(3,1fr\)\}\}/);
});
