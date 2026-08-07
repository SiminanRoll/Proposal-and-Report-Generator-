import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function transpileModule(relativePath, replacements = {}) {
  const module = await transpileTestModule(relativePath, import.meta.url, { replacements, prefix: "client-compass-phase2" });
  return { module };
}

async function loadRuntime() {
  const configResult = await transpileModule("../src/lib/compass/config.ts");
  const engineResult = await transpileModule("../src/lib/compass/engine.ts");
  const headersResult = await transpileModule("../src/lib/compass/headers.ts");
  return { ...configResult.module, ...engineResult.module, ...headersResult.module };
}

function parsed(rows, sourceName = "Ninja_Master.xlsx") {
  return { sourceName, rows, totalRows: rows.length, rejectedRows: 0, detectedHeaders: ["deviceName", "organization"] };
}

function row(overrides = {}) {
  return {
    rowNumber: 2,
    organization: "Alpha Dental",
    location: "Main",
    deviceName: "FRONT-01",
    stableId: "",
    lastUptime: "2026-08-04",
    videoCard: "Intel UHD",
    warrantyStart: "2025-01-01",
    warrantyEnd: "2028-01-01",
    lastLogin: "2026-08-04",
    memoryGiB: "16",
    osName: "Microsoft Windows 11 Pro",
    deviceStatus: "Active",
    diskVolumeUsage: "C: 60/100 GB (60%)",
    deviceModel: "Dell OptiPlex",
    ...overrides,
  };
}

test("product naming and version are Client Compass 1.8.3", () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const compass = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const brand = fs.readFileSync(new URL("../src/components/brand.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.equal(packageJson.name, "client-compass");
  assert.equal(packageJson.version, "1.8.3");
  assert.match(compass, /Client Compass/);
  assert.match(layout, /Client Compass/);
  assert.match(brand, /Client Compass home/);
  assert.match(css, /\.brand-copy > span \{[^}]*text-align: center;/s);
  assert.doesNotMatch(`${compass}\n${layout}\n${brand}`, /Advantage Compass/);
});

test("Ninja headers are case-insensitive, whitespace-tolerant, and preserve aliases", async () => {
  const { mapCompassHeaders } = await loadRuntime();
  const map = mapCompassHeaders([" DEVICE ", "organization", "Last Uptime_formatted", "Video Card", "Warranty Start Date_formatted", "Warranty End Date", "Last Login", "Memory Capacity GiB", "OS Name", "Disk Volume Usage", "Device Model"]);
  assert.equal(map.deviceName, 0);
  assert.equal(map.organization, 1);
  assert.equal(map.lastUptime, 2);
  assert.equal(map.warrantyStart, 4);
  assert.equal(map.diskVolumeUsage, 9);
  const aliases = mapCompassHeaders(["Display Name", "Company", "Site", "BIOS Serial Number", "Operating System", "System Model"]);
  assert.deepEqual({ deviceName: aliases.deviceName, organization: aliases.organization, location: aliases.location, stableId: aliases.stableId, osName: aliases.osName, deviceModel: aliases.deviceModel }, { deviceName: 0, organization: 1, location: 2, stableId: 3, osName: 4, deviceModel: 5 });
});

test("organization matching never guesses unresolved names", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, defaultOrganizationResolutions } = await loadRuntime();
  const source = parsed([row(), row({ organization: "  alpha dental  ", deviceName: "BACK-01", stableId: "W2" })]);
  const defaults = defaultOrganizationResolutions(source, null);
  assert.deepEqual(defaults["Alpha Dental"], { mode: "unresolved" });
  assert.equal(Object.keys(defaults).length, 1);
  const unresolved = buildImportPreview(source, null, defaults, DEFAULT_COMPASS_CONFIG, new Date("2026-08-04T12:00:00Z"));
  assert.equal(unresolved.summary.organizationsDetected, 1);
  assert.equal(unresolved.summary.unmatchedOrganizations, 1);
  assert.equal(unresolved.summary.devicesDetected, 2);
  assert.equal(unresolved.dataset, null);
  const resolved = buildImportPreview(source, null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-04T12:00:00Z"));
  assert.ok(resolved.dataset);
  assert.equal(resolved.summary.newOrganizations, 1);
});

test("user-confirmed organization mappings become reusable aliases", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, defaultOrganizationResolutions } = await loadRuntime();
  const original = buildImportPreview(parsed([row()]), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-01T12:00:00Z")).dataset;
  assert.ok(original);
  const clientId = original.clients[0].id;
  const mappedSource = parsed([
    row({ organization: "Alpha Dental PLC", deviceName: "FRONT-01", stableId: "W1" }),
    row({ organization: "Alpha Dental - North", location: "North", deviceName: "NORTH-01", stableId: "W2" }),
  ]);
  const mapped = buildImportPreview(mappedSource, original, { "Alpha Dental PLC": { mode: "existing", clientId }, "Alpha Dental - North": { mode: "existing", clientId } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-04T12:00:00Z")).dataset;
  assert.ok(mapped);
  assert.deepEqual(mapped.clients[0].aliases.sort(), ["Alpha Dental - North", "Alpha Dental PLC"]);
  const aliasDefaults = defaultOrganizationResolutions(parsed([row({ organization: "Alpha Dental PLC" })]), mapped);
  assert.deepEqual(aliasDefaults["Alpha Dental PLC"], { mode: "existing", clientId });
});

test("device classification keeps virtual machines visible without physical lifecycle replacement", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, classifyDevice } = await loadRuntime();
  assert.equal(classifyDevice({ deviceName: "MYSTERY", deviceModel: "", videoCard: "", osName: "" }).deviceType, "unknown");
  const source = parsed([
    row({ deviceName: "HOST-01", stableId: "S1", osName: "Microsoft Windows Server 2012 R2", warrantyStart: "2017-01-01", warrantyEnd: "2022-01-01", deviceModel: "Dell PowerEdge T340", diskVolumeUsage: "C: 94/100 GB (94%)" }),
    row({ deviceName: "DC-01", stableId: "VM1", osName: "Microsoft Windows Server 2016", warrantyStart: "2016-01-01", warrantyEnd: "2019-01-01", deviceModel: "Virtual Machine", videoCard: "Microsoft Hyper-V Video", diskVolumeUsage: "C: 85/100 GB (85%)" }),
    row({ deviceName: "FRONT-01", stableId: "W1", osName: "Microsoft Windows 10 Pro", warrantyStart: "2019-01-01", warrantyEnd: "2022-01-01", deviceModel: "Dell OptiPlex" }),
  ]);
  const preview = buildImportPreview(source, null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-04T12:00:00Z"));
  const dataset = preview.dataset;
  assert.ok(dataset);
  assert.equal(preview.summary.physicalServers, 1);
  assert.equal(preview.summary.virtualMachines, 1);
  const vm = dataset.devices.find((device) => device.name === "DC-01");
  assert.equal(vm.deviceType, "virtual-server");
  assert.equal(vm.lifecycle, "unknown");
  assert.equal(dataset.findings.some((finding) => finding.deviceId === vm.id && finding.category === "server-age-critical"), false);
  assert.equal(dataset.findings.some((finding) => finding.deviceId === vm.id && finding.category === "server-2016"), true);
  assert.ok(dataset.findings.some((finding) => finding.scoreContribution > 0));
  const summary = dataset.summaries.find((item) => item.clientName === "Alpha Dental");
  assert.equal(summary.priorityScore, 100);
  assert.ok(summary.opportunities.some((opportunity) => opportunity.cardCategory === "critical-server"));
  assert.ok(summary.opportunities.some((opportunity) => opportunity.cardCategory === "server-planning"));
  assert.equal(summary.opportunities.some((opportunity) => opportunity.cardCategory === "windows-10"), false);
});

test("storage parsing supports percentages and used-over-capacity values", async () => {
  const { DEFAULT_COMPASS_CONFIG, parseDiskVolumes } = await loadRuntime();
  const values = parseDiskVolumes("C: 174.4/252.8 GB (69.0%), D: 94/100 GB", DEFAULT_COMPASS_CONFIG);
  assert.equal(values.length, 2);
  assert.equal(values[0].state, "healthy");
  assert.equal(values[1].state, "critical");
  assert.equal(values[1].usedPercent, 94);
});

test("priority categories honor first/additional weights and caps", async () => {
  const { DEFAULT_COMPASS_CONFIG, scoreClient } = await loadRuntime();
  const finding = (category, index) => ({ id: `${category}-${index}`, clientId: "c", deviceId: `d-${index}`, category, severity: "high", title: category, explanation: category, scoreContribution: 0, valueCategory: "none" });
  const findings = [finding("server-2012", 1), finding("server-2012", 2), ...Array.from({ length: 20 }, (_, index) => finding("windows-10", index + 10))];
  const result = scoreClient(findings, DEFAULT_COMPASS_CONFIG);
  assert.equal(result.contributions["2 critical unsupported server OS instances"], 60);
  assert.equal(result.contributions["20 Windows 10 devices"], 30);
  assert.equal(result.score, 90);
  assert.deepEqual(result.topDrivers.slice(0, 2), ["2 critical unsupported server OS instances", "20 Windows 10 devices"]);
});

test("a committed import replaces devices while preserving manual client workflow fields", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, defaultOrganizationResolutions } = await loadRuntime();
  const first = buildImportPreview(parsed([row({ deviceName: "FRONT-01", stableId: "W1" }), row({ deviceName: "BACK-01", stableId: "W2" })]), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-01T12:00:00Z")).dataset;
  assert.ok(first);
  first.clients[0].primaryContact = "Jamie";
  first.clients[0].assignedOwner = "Patric";
  first.clients[0].lastAccountReview = "2026-07-15";
  first.clients[0].internalNote = "Preserve this workflow note.";
  const secondSource = parsed([row({ deviceName: "FRONT-01", stableId: "W1", osName: "Microsoft Windows 10 Pro" })], "Ninja_Master_August.xlsx");
  const resolutions = defaultOrganizationResolutions(secondSource, first);
  assert.equal(resolutions["Alpha Dental"].mode, "existing");
  const second = buildImportPreview(secondSource, first, resolutions, DEFAULT_COMPASS_CONFIG, new Date("2026-08-04T12:00:00Z")).dataset;
  assert.ok(second);
  assert.equal(second.devices.length, 1);
  assert.equal(second.devices[0].name, "FRONT-01");
  assert.equal(second.clients[0].primaryContact, "Jamie");
  assert.equal(second.clients[0].assignedOwner, "Patric");
  assert.equal(second.clients[0].lastAccountReview, "2026-07-15");
  assert.equal(second.clients[0].internalNote, "Preserve this workflow note.");
  assert.equal(second.importSourceName, "Ninja_Master_August.xlsx");
});

test("live card metrics deduplicate the all-clients count and overall estimate", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, cardMetrics } = await loadRuntime();
  const dataset = buildImportPreview(parsed([
    row({ deviceName: "SERVER-01", stableId: "S1", osName: "Windows Server 2012 R2", warrantyStart: "2017-01-01", deviceModel: "Dell PowerEdge" }),
    ...Array.from({ length: 5 }, (_, index) => row({ rowNumber: index + 3, deviceName: `FRONT-${index + 1}`, stableId: `W${index + 1}`, osName: "Windows 10 Pro", warrantyStart: "2019-01-01" })),
  ]), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-04T12:00:00Z")).dataset;
  assert.ok(dataset);
  const metrics = cardMetrics(dataset, DEFAULT_COMPASS_CONFIG);
  const all = metrics.find((metric) => metric.id === "all");
  const critical = metrics.find((metric) => metric.id === "critical-server");
  const windows = metrics.find((metric) => metric.id === "windows-10");
  assert.equal(all.count, 1);
  assert.equal(critical.count, 1);
  assert.equal(windows.count, 1);
  assert.equal(all.value, dataset.summaries[0].totalEstimatedValue);
  assert.notEqual(all.value, critical.value + windows.value + metrics.find((metric) => metric.id === "workstation-lifecycle").value);
});

test("large current snapshots use IndexedDB and commits cannot fail silently", () => {
  const store = fs.readFileSync(new URL("../src/lib/compass/store.ts", import.meta.url), "utf8");
  const dialog = fs.readFileSync(new URL("../src/components/compass-data-dialog.tsx", import.meta.url), "utf8");
  assert.match(store, /indexedDB\.open\(DATABASE_NAME, DATABASE_VERSION\)/);
  assert.match(store, /transaction\(DATASET_STORE, "readwrite"\)/);
  assert.match(store, /objectStore\(DATASET_STORE\)\.put\(dataset, DATASET_RECORD_KEY\)/);
  assert.match(store, /await writeIndexedDataset\(dataset\)/);
  assert.doesNotMatch(store, /localStorage\.setItem\(LEGACY_DATASET_KEY/);
  assert.match(dialog, /await saveCompassDataset\(preview\.dataset\)/);
  assert.match(dialog, /Saving current snapshot/);
  assert.match(dialog, /setCommitError/);
  assert.match(dialog, /aria-live="polite"/);
});

test("Phase 2 stays current-state only and retains generator regression hooks", () => {
  const types = fs.readFileSync(new URL("../src/lib/compass/types.ts", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../src/lib/compass/store.ts", import.meta.url), "utf8");
  const generator = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(store, /current-dataset/);
  assert.doesNotMatch(types, /snapshotHistory|scoreHistory|trend/);
  assert.match(generator, /remote-consultation/);
  assert.match(generator, /onsite-review/);
  assert.match(css, /security-monitoring-row/);
  assert.match(css, /security-incident-response/);
});
