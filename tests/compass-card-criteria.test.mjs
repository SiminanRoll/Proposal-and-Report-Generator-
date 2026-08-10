import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function transpileModule(relativePath) {
  return transpileTestModule(relativePath, import.meta.url, { prefix: "client-compass-criteria" });
}

async function runtime() {
  return {
    ...(await transpileModule("../src/lib/compass/config.ts")),
    ...(await transpileModule("../src/lib/compass/engine.ts")),
  };
}

const NOW = new Date("2026-08-04T12:00:00Z");

function row(overrides = {}) {
  return {
    rowNumber: 2,
    organization: "Alpha Dental",
    location: "Main",
    deviceName: "FRONT-01",
    stableId: "W1",
    lastUptime: "2026-08-04",
    videoCard: "Intel UHD",
    warrantyStart: "2025-01-01",
    warrantyEnd: "2028-01-01",
    lastLogin: "2026-08-04",
    memoryGiB: "16",
    osName: "Microsoft Windows 11 Pro",
    deviceStatus: "Active",
    diskVolumeUsage: "C: 60/100 GB (60%)",
    deviceModel: "Dell OptiPlex 7090",
    ...overrides,
  };
}

function parsed(rows, sourceName = "Ninja_Master.xlsx") {
  return { sourceName, rows, totalRows: rows.length, rejectedRows: 0, detectedHeaders: ["deviceName", "organization"] };
}

function resolutions(rows) {
  return Object.fromEntries([...new Set(rows.map((item) => item.organization))].map((organization) => [organization, { mode: "new" }]));
}

function build(buildImportPreview, config, rows) {
  const preview = buildImportPreview(parsed(rows), null, resolutions(rows), config, NOW);
  assert.ok(preview.dataset);
  return preview.dataset;
}

function opportunity(dataset, organization, cardCategory) {
  const summary = dataset.summaries.find((item) => item.clientName === organization);
  assert.ok(summary, `Missing summary for ${organization}`);
  return summary.opportunities.find((item) => item.cardCategory === cardCategory) ?? null;
}

function card(config, id) {
  const found = config.cards.find((item) => item.id === id);
  assert.ok(found, `Missing card ${id}`);
  return found;
}

test("default card definitions match the approved qualification thresholds", async () => {
  const { DEFAULT_COMPASS_CONFIG } = await runtime();
  assert.deepEqual(card(DEFAULT_COMPASS_CONFIG, "all").sourceCardIds, ["critical-server", "server-planning", "windows-10", "workstation-lifecycle"]);
  assert.equal(card(DEFAULT_COMPASS_CONFIG, "all").sourceCardIds.includes("storage"), false);
  assert.deepEqual(card(DEFAULT_COMPASS_CONFIG, "windows-10").rules.map((rule) => [rule.signal, rule.minimumDevices]), [["windows-10-active", 5]]);
  assert.deepEqual(card(DEFAULT_COMPASS_CONFIG, "workstation-lifecycle").rules.map((rule) => [rule.signal, rule.minimumDevices]), [["replace-now", 5], ["plan-soon", 5]]);
  assert.equal(card(DEFAULT_COMPASS_CONFIG, "workstation-lifecycle").matchMode, "any");
  assert.equal(DEFAULT_COMPASS_CONFIG.thresholds.staleDeviceMonths, 6);
  assert.equal(DEFAULT_COMPASS_CONFIG.thresholds.serverCriticalYears, 7);
  assert.equal(DEFAULT_COMPASS_CONFIG.thresholds.serverExpiredWarrantyCriticalYears, 6);
  assert.equal(DEFAULT_COMPASS_CONFIG.thresholds.serverPlanningYears, 5);
});


test("legacy v1.2.2 defaults migrate to the approved 5/7-year lifecycle criteria without overwriting custom values", async () => {
  const { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } = await runtime();
  const legacyDefaults = normalizeCompassConfig({
    score: DEFAULT_COMPASS_CONFIG.score,
    value: DEFAULT_COMPASS_CONFIG.value,
    thresholds: { workstationPlanSoonYears: 4, workstationReplaceNowYears: 5, serverPlanningYears: 5, serverCriticalYears: 7, storageWatchPercent: 80, storageCriticalPercent: 90 },
  });
  assert.equal(legacyDefaults.thresholds.workstationPlanSoonYears, 5);
  assert.equal(legacyDefaults.thresholds.workstationReplaceNowYears, 7);
  assert.equal(legacyDefaults.cards.length, 8);

  const customized = normalizeCompassConfig({
    score: DEFAULT_COMPASS_CONFIG.score,
    value: DEFAULT_COMPASS_CONFIG.value,
    thresholds: { workstationPlanSoonYears: 6, workstationReplaceNowYears: 8 },
  });
  assert.equal(customized.thresholds.workstationPlanSoonYears, 6);
  assert.equal(customized.thresholds.workstationReplaceNowYears, 8);
});

test("Clients Needing Projects ignores storage-only and one-to-four Windows 10 clients", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const rows = [
    ...Array.from({ length: 4 }, (_, index) => row({ organization: "Four Windows Dental", rowNumber: index + 2, deviceName: `FRONT-${index + 1}`, stableId: `FW-${index + 1}`, osName: "Windows 10 Pro" })),
    row({ organization: "Storage Only Dental", deviceName: "STORAGE-PC", stableId: "SO-1", diskVolumeUsage: "C: 75/100 GB (75%)" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);
  assert.equal(opportunity(dataset, "Four Windows Dental", "windows-10"), null);
  assert.equal(opportunity(dataset, "Four Windows Dental", "all"), null);
  assert.ok(opportunity(dataset, "Storage Only Dental", "storage"));
  assert.equal(opportunity(dataset, "Storage Only Dental", "all"), null);
});

test("Windows 10 requires five active devices, counts mixed device types, and values only valid workstation types", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const rows = [
    ...Array.from({ length: 3 }, (_, index) => row({ rowNumber: index + 2, deviceName: `FRONT-${index + 1}`, stableId: `PHYS-${index + 1}`, osName: "Windows 10 Pro" })),
    row({ rowNumber: 5, deviceName: "WIN10-VM", stableId: "VM-1", osName: "Windows 10 Pro", deviceModel: "Virtual Machine", videoCard: "Microsoft Hyper-V Video" }),
    row({ rowNumber: 6, deviceName: "SERVER-10", stableId: "REVIEW-1", osName: "Windows 10 Pro", deviceModel: "Dell PowerEdge T440", videoCard: "Matrox" }),
    row({ rowNumber: 7, deviceName: "STALE-10", stableId: "STALE-1", osName: "Windows 10 Pro", lastUptime: "2026-01-01", lastLogin: "2026-01-01" }),
    row({ rowNumber: 8, deviceName: "INACTIVE-10", stableId: "INACTIVE-1", osName: "Windows 10 Pro", deviceStatus: "Inactive" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);
  const win10 = opportunity(dataset, "Alpha Dental", "windows-10");
  assert.ok(win10);
  assert.equal(win10.affectedDeviceIds.length, 5);
  assert.equal(win10.estimatedValue, 10560);
  assert.ok(win10.drivers.some((driver) => driver.startsWith("5 active Windows 10")));
  assert.ok(opportunity(dataset, "Alpha Dental", "all"));
  assert.equal(dataset.findings.filter((item) => item.category === "windows-10-active").length, 5);
});

test("duplicate agent rows do not inflate a five-device Windows 10 threshold", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const rows = [
    ...Array.from({ length: 4 }, (_, index) => row({ rowNumber: index + 2, deviceName: `FRONT-${index + 1}`, stableId: `DUP-${index + 1}`, osName: "Windows 10 Pro" })),
    row({ rowNumber: 9, deviceName: "FRONT-1", stableId: "DUPLICATE-AGENT-ID", osName: "Windows 10 Pro", lastUptime: "2026-08-03" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);
  assert.equal(dataset.devices.length, 4);
  assert.equal(opportunity(dataset, "Alpha Dental", "windows-10"), null);
});

test("critical server rules take precedence over planning on the same physical server", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const rows = [
    row({ organization: "Old OS Dental", deviceName: "SERVER-OLD", stableId: "S-OLD", osName: "Windows Server 2008 R2", warrantyStart: "2024-01-01", warrantyEnd: "2028-01-01", deviceModel: "Dell PowerEdge R550" }),
    row({ organization: "Seven Year Dental", deviceName: "SERVER-7", stableId: "S-7", osName: "Windows Server 2019", warrantyStart: "2018-01-01", warrantyEnd: "2027-01-01", deviceModel: "Dell PowerEdge R740" }),
    row({ organization: "Six Expired Dental", deviceName: "SERVER-6", stableId: "S-6", osName: "Windows Server 2019", warrantyStart: "2020-01-01", warrantyEnd: "2025-01-01", deviceModel: "HP ProLiant DL360" }),
    row({ organization: "Storage Server Dental", deviceName: "SERVER-STORAGE", stableId: "S-STORAGE", osName: "Windows Server 2022", warrantyStart: "2024-01-01", warrantyEnd: "2029-01-01", deviceModel: "Dell PowerEdge R650", diskVolumeUsage: "C: 96/100 GB (96%)" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);
  for (const organization of ["Old OS Dental", "Seven Year Dental", "Six Expired Dental", "Storage Server Dental"]) {
    assert.ok(opportunity(dataset, organization, "critical-server"), `${organization} should be critical`);
  }
  assert.equal(opportunity(dataset, "Seven Year Dental", "server-planning"), null);
  assert.equal(opportunity(dataset, "Six Expired Dental", "server-planning"), null);
  assert.equal(opportunity(dataset, "Storage Server Dental", "server-planning"), null);
});

test("Server Planning includes approved triggers but ignores newer servers, VM hardware age, and missing lifecycle data", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const rows = [
    row({ organization: "Server 2016 Dental", deviceName: "SERVER-2016", stableId: "P-2016", osName: "Windows Server 2016", warrantyStart: "2024-01-01", warrantyEnd: "2028-01-01", deviceModel: "Dell PowerEdge R550" }),
    row({ organization: "Five Year Dental", deviceName: "SERVER-5", stableId: "P-5", osName: "Windows Server 2019", warrantyStart: "2021-01-01", warrantyEnd: "2028-01-01", deviceModel: "Dell PowerEdge R640" }),
    row({ organization: "Warranty Soon Dental", deviceName: "SERVER-W", stableId: "P-W", osName: "Windows Server 2019", warrantyStart: "2022-01-01", warrantyEnd: "2027-02-01", deviceModel: "HP ProLiant DL380" }),
    row({ organization: "Consolidation Dental", deviceName: "SERVER-A", stableId: "P-C1", osName: "Windows Server 2019", warrantyStart: "2021-01-01", warrantyEnd: "2028-01-01", deviceModel: "Dell PowerEdge R640" }),
    row({ organization: "Consolidation Dental", deviceName: "SERVER-B", stableId: "P-C2", osName: "Windows Server 2019", warrantyStart: "2021-02-01", warrantyEnd: "2028-01-01", deviceModel: "Dell PowerEdge R640" }),
    row({ organization: "Modern Server Dental", deviceName: "SERVER-2019", stableId: "NO-1", osName: "Windows Server 2019", warrantyStart: "2024-01-01", warrantyEnd: "2029-01-01", deviceModel: "Dell PowerEdge R650" }),
    row({ organization: "Old VM Dental", deviceName: "VM-SERVER", stableId: "NO-2", osName: "Windows Server 2019", warrantyStart: "2015-01-01", warrantyEnd: "2018-01-01", deviceModel: "Virtual Machine", videoCard: "Microsoft Hyper-V Video" }),
    row({ organization: "Missing Data Dental", deviceName: "SERVER-UNKNOWN", stableId: "NO-3", osName: "Windows Server 2019", warrantyStart: "", warrantyEnd: "", deviceModel: "Unknown" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);
  for (const organization of ["Server 2016 Dental", "Five Year Dental", "Warranty Soon Dental", "Consolidation Dental"]) {
    assert.ok(opportunity(dataset, organization, "server-planning"), `${organization} should be in planning`);
  }
  for (const organization of ["Modern Server Dental", "Old VM Dental", "Missing Data Dental"]) {
    assert.equal(opportunity(dataset, organization, "server-planning"), null, `${organization} should not be in planning`);
  }
});

test("Workstation Lifecycle needs five Replace Now or five Plan Soon devices separately", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const replace = Array.from({ length: 5 }, (_, index) => row({ organization: "Replace Dental", rowNumber: index + 2, deviceName: `REPLACE-${index + 1}`, stableId: `R-${index + 1}`, warrantyStart: "2018-01-01", warrantyEnd: "2027-01-01" }));
  const plan = Array.from({ length: 5 }, (_, index) => row({ organization: "Plan Dental", rowNumber: index + 10, deviceName: `PLAN-${index + 1}`, stableId: `P-${index + 1}`, warrantyStart: "2021-01-01", warrantyEnd: "2028-01-01" }));
  const mixed = [
    ...Array.from({ length: 3 }, (_, index) => row({ organization: "Mixed Dental", rowNumber: index + 20, deviceName: `MIX-R-${index + 1}`, stableId: `MR-${index + 1}`, warrantyStart: "2018-01-01", warrantyEnd: "2027-01-01" })),
    ...Array.from({ length: 2 }, (_, index) => row({ organization: "Mixed Dental", rowNumber: index + 30, deviceName: `MIX-P-${index + 1}`, stableId: `MP-${index + 1}`, warrantyStart: "2021-01-01", warrantyEnd: "2028-01-01" })),
  ];
  const exclusions = [
    row({ organization: "Recent Expired Dental", deviceName: "RECENT", stableId: "EX-1", warrantyStart: "2024-01-01", warrantyEnd: "2025-01-01" }),
    row({ organization: "Unknown Model Dental", deviceName: "UNKNOWN", stableId: "EX-2", warrantyStart: "2017-01-01", warrantyEnd: "2020-01-01", deviceModel: "Unknown" }),
    row({ organization: "Virtual Dental", deviceName: "VM-OLD", stableId: "EX-3", warrantyStart: "2017-01-01", warrantyEnd: "2020-01-01", deviceModel: "Virtual Machine", videoCard: "VMware SVGA" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, [...replace, ...plan, ...mixed, ...exclusions]);
  assert.ok(opportunity(dataset, "Replace Dental", "workstation-lifecycle"));
  assert.ok(opportunity(dataset, "Plan Dental", "workstation-lifecycle"));
  assert.equal(opportunity(dataset, "Mixed Dental", "workstation-lifecycle"), null);
  assert.equal(opportunity(dataset, "Recent Expired Dental", "workstation-lifecycle"), null);
  assert.equal(opportunity(dataset, "Unknown Model Dental", "workstation-lifecycle"), null);
  assert.equal(opportunity(dataset, "Virtual Dental", "workstation-lifecycle"), null);
});

test("storage criteria combine utilization and free-space guards and exclude utility partitions", async () => {
  const { DEFAULT_COMPASS_CONFIG, parseDiskVolumes, buildImportPreview } = await runtime();
  const volumes = parseDiskVolumes("C: 75/100 GB (75%), D: 3600/4000 GB (90%), Recovery: 0.9/1 GB (90%), EFI: 0.3/0.5 GB (60%)", DEFAULT_COMPASS_CONFIG, "physical-workstation");
  assert.equal(volumes.find((item) => item.label === "C:").state, "watch");
  assert.equal(volumes.find((item) => item.label === "D:").state, "healthy");
  assert.match(volumes.find((item) => /Recovery/i.test(item.label)).excludedReason, /Recovery|utility/);
  assert.match(volumes.find((item) => /EFI/i.test(item.label)).excludedReason, /Recovery|utility/);

  const critical = parseDiskVolumes("C: 86/100 GB (86%)", DEFAULT_COMPASS_CONFIG, "physical-workstation")[0];
  assert.equal(critical.freeGb, 14);
  assert.equal(critical.state, "critical");

  const rows = [
    row({ organization: "Storage Risk Dental", deviceName: "STORAGE-1", stableId: "ST-1", diskVolumeUsage: "C: 75/100 GB (75%)" }),
    row({ organization: "Healthy Large Dental", deviceName: "STORAGE-2", stableId: "ST-2", diskVolumeUsage: "D: 3600/4000 GB (90%)" }),
    row({ organization: "Utility Only Dental", deviceName: "STORAGE-3", stableId: "ST-3", diskVolumeUsage: "Recovery: 0.9/1 GB (90%)" }),
  ];
  const dataset = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);
  assert.ok(opportunity(dataset, "Storage Risk Dental", "storage"));
  assert.equal(opportunity(dataset, "Healthy Large Dental", "storage"), null);
  assert.equal(opportunity(dataset, "Utility Only Dental", "storage"), null);
});

test("existing criteria are editable and custom cards can be added, valued, and rolled up", async () => {
  const { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig, buildImportPreview, recalculateDataset, cardMetrics } = await runtime();
  const rows = Array.from({ length: 5 }, (_, index) => row({ rowNumber: index + 2, deviceName: `HOME-${index + 1}`, stableId: `H-${index + 1}`, osName: "Windows 11 Home" }));
  const base = build(buildImportPreview, DEFAULT_COMPASS_CONFIG, rows);

  const edited = structuredClone(DEFAULT_COMPASS_CONFIG);
  card(edited, "windows-10").rules[0].minimumDevices = 6;
  const customId = "custom-windows-home";
  edited.cards.push({
    id: customId,
    builtIn: false,
    enabled: true,
    order: edited.cards.length,
    title: "Windows Home Remediation",
    countLabel: "clients with five Home-edition devices",
    valueLabel: "estimated remediation value",
    description: "Custom card test",
    accent: "blue",
    icon: "windows",
    criteriaType: "signals",
    matchMode: "any",
    rules: [{ id: "home-rule", signal: "windows-11-home", minimumDevices: 5, enabled: true }],
    sourceCardIds: [],
    excludeSignals: [],
    estimateMode: "fixed",
    fixedEstimate: 10000,
    manualClientIds: [],
  });
  card(edited, "all").sourceCardIds.push(customId);
  const normalized = normalizeCompassConfig(edited);
  const recalculated = recalculateDataset(base, normalized, NOW);
  const custom = opportunity(recalculated, "Alpha Dental", customId);
  assert.ok(custom);
  assert.equal(custom.estimatedValue, 11000);
  assert.ok(opportunity(recalculated, "Alpha Dental", "all"));
  const metric = cardMetrics(recalculated, normalized).find((item) => item.id === customId);
  assert.equal(metric.count, 1);
  assert.equal(metric.value, 11000);
});

test("Settings page manages the current Project Coverage qualification controls", () => {
  const settings = fs.readFileSync(new URL("../src/components/compass-settings-page.tsx", import.meta.url), "utf8");
  const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(rail, /Technical-card configuration/);
  assert.match(rail, /href="\/settings\/"/);
  assert.match(settings, /Home &amp; qualification/);
  assert.match(settings, /Workstation project minimum/);
  assert.match(settings, /Priority Lens/);
  assert.match(settings, /defaultCardSet/);
  assert.match(settings, /minimumWorkstations/);
  assert.match(settings, /priorityLensEnabled/);
  assert.match(settings, /saveCompassConfigAndDataset/);
  assert.match(settings, /recalculateDataset/);
});
