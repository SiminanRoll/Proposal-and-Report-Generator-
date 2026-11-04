import test from "node:test";
import assert from "node:assert/strict";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const uri = (source) => "data:text/javascript," + encodeURIComponent(source);
const coreStub = uri([
  "export const lifecycleDevices = (project) => project.manualInventory ? project.manualInventory.devices.map(item => ({ ...item, authoritative: true, sourceDeviceId: item.id, sourceDeviceName: item.name })) : project.sourceDevices;",
  "export const lifecycleSummary = () => ({total: 0, inventoryTotal: 0, assessed: 0, current: 0, dueSoon: 0, overdue: 0, unknown: 0, healthyPercentage: 0});",
  "export const reportReferenceDate = () => new Date('2026-11-04T12:00:00Z');",
  "export const sortLifecycleDevices = (devices) => devices.slice();",
  "export const compassLocationSnapshots = () => [];",
  "export const compassProjectPackages = () => [];",
].join("\n"));
const configStub = uri("export const normalizeCompassConfig = () => ({ thresholds: { workstationPlanSoonYears: 5, workstationReplaceNowYears: 7, workstationExpiredWarrantyReplaceYears: 6, serverPlanningYears: 5, serverCriticalYears: 7, serverExpiredWarrantyCriticalYears: 6, serverWarrantyPlanningMinYears: 4, warrantyPlanningMonths: 12, staleDeviceMonths: 6 } });");

async function reportModule() {
  return transpileTestModule("../src/lib/outcomes/client-report-data.ts", import.meta.url, {
    prefix: "manual-lifecycle-override",
    replacements: {
      'from "@/lib/compass/config"': "from " + JSON.stringify(configStub),
      'from "./client-report-data-core"': "from " + JSON.stringify(coreStub),
    },
  });
}
async function saveModule() {
  return transpileTestModule("../src/lib/outcomes/manual-inventory.ts", import.meta.url, {
    prefix: "manual-inventory-save",
  });
}
function workstation(id, name, lifecycleStatus, age = 5.15) {
  return {
    id, type: "workstation", name, serial: id + "-SERIAL",
    make: "Dell", model: "OptiPlex 3080", os: "Microsoft Windows 11 Pro Edition",
    age, location: "Main", lifecycleStatus,
    user: "", lastCheckIn: "2026-10-22", purchased: "", warrantyExpires: "2024-12-16",
    ram: "", cpu: "", storage: "", storageUsage: "", storagePercent: 0,
    storageFreeGb: 0, graphics: "",
  };
}
function sourceProject() {
  return {
    id: "warner-parks",
    intelligence: { facts: [] },
    sourceDevices: [
      workstation("device-op01", "OP01", "due-soon"),
      workstation("device-fd01", "FD01", "due-soon"),
    ],
  };
}
function withSavedSettings(run) {
  const oldWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: (key) => key === "client-compass.configuration.v1" ? "{}" : null } };
  try { return run(); }
  finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
}

test("OP01 manual Replace now is authoritative; FD01 with the same model stays Plan soon", async () => {
  const { withManualInventory } = await saveModule();
  const { inventoryReportDevices, lifecycleSummary, replacementDevices } = await reportModule();
  withSavedSettings(() => {
    const project = sourceProject();
    const saved = withManualInventory(project, [
      workstation("device-op01", "OP01", "overdue"),
      workstation("device-fd01", "FD01", "due-soon"),
    ]);
    assert.equal(saved.manualInventory.devices.find((d) => d.id === "device-op01").lifecycleStatus, "overdue");
    assert.equal(saved.intelligence.facts.find((f) => f.key === "scalepad.replacement.overdue").value, 1);
    const items = inventoryReportDevices(saved);
    assert.equal(items.find((d) => d.name === "OP01").lifecycleStatus, "overdue");
    assert.equal(items.find((d) => d.name === "FD01").lifecycleStatus, "due-soon");
    assert.deepEqual(replacementDevices(saved).map((d) => d.sourceDeviceId), ["device-op01"]);
    assert.equal(lifecycleSummary(saved).overdue, 1);
    assert.equal(lifecycleSummary(saved).dueSoon, 1);

    // Persisted project JSON round-trips to the same report state on reopening.
    const reopened = JSON.parse(JSON.stringify(saved));
    assert.equal(inventoryReportDevices(reopened).find((d) => d.name === "OP01").lifecycleStatus, "overdue");
    assert.equal(lifecycleSummary(reopened).overdue, 1);
  });
});

test("manual classification follows immutable device IDs even if editor row order changes", async () => {
  const { withManualInventory } = await saveModule();
  const { lifecycleDevices, lifecycleSummary } = await reportModule();
  withSavedSettings(() => {
    const input = [
      workstation("device-fd01", "FD01", "due-soon"),
      workstation("device-op01", "OP01", "overdue"),
    ];
    const saved = withManualInventory(sourceProject(), input);
    assert.deepEqual(lifecycleDevices(saved).map((d) => [d.sourceDeviceId, d.lifecycleStatus]), [
      ["device-fd01", "due-soon"], ["device-op01", "overdue"],
    ]);
    assert.equal(lifecycleSummary(saved).overdue, 1);
    assert.equal(lifecycleSummary(saved).dueSoon, 1);
  });
});

test("manual Under review remains unknown even if hardware age is known", async () => {
  const { withManualInventory } = await saveModule();
  const { lifecycleDevices, lifecycleSummary } = await reportModule();
  withSavedSettings(() => {
    const saved = withManualInventory(sourceProject(), [
      workstation("device-op01", "OP01", "unknown", 8),
      workstation("device-fd01", "FD01", "due-soon"),
    ]);
    assert.equal(lifecycleDevices(saved)[0].lifecycleStatus, "unknown");
    assert.equal(lifecycleSummary(saved).unknown, 1);
  });
});

test("source-imported rows without manual inventory still follow configured age policy", async () => {
  const { lifecycleDevices, lifecycleSummary } = await reportModule();
  withSavedSettings(() => {
    const project = sourceProject();
    project.sourceDevices[0].lifecycleStatus = "overdue";
    // An imported workstation age 5.15 is in the plan-soon window, not replace now.
    const rows = lifecycleDevices(project);
    assert.equal(rows.find((d) => d.name === "OP01").lifecycleStatus, "due-soon");
    assert.equal(lifecycleSummary(project).overdue, 0);
    assert.equal(lifecycleSummary(project).dueSoon, 2);
  });
});
