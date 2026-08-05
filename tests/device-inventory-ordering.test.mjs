import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadClientReportData() {
  return transpileTestModule("../src/lib/outcomes/client-report-data.ts", import.meta.url, { prefix: "client-report-data" });
}

function device(overrides) {
  return {
    type: "workstation",
    name: "PC",
    user: "",
    lastCheckIn: "",
    make: "Dell",
    serial: "",
    model: "OptiPlex",
    os: "Windows 11",
    age: 1,
    purchased: "",
    warrantyExpires: "",
    ram: "",
    cpu: "",
    storage: "",
    storageUsage: "",
    storagePercent: 0,
    storageFreeGb: 0,
    graphics: "Not included in source export",
    location: "",
    lifecycleStatus: "current",
    osStatus: "supported",
    ...overrides,
  };
}

test("device inventory keeps server classes first and sorts oldest within each location", async () => {
  const { sortLifecycleDevices } = await loadClientReportData();
  const sorted = sortLifecycleDevices([
    device({ name: "SOUTH-NEW", location: "South Office", age: 2 }),
    device({ name: "NORTH-OLD", location: "North Office", age: 8, lifecycleStatus: "overdue" }),
    device({ name: "NORTH-OLDER", location: "North Office", age: 9, lifecycleStatus: "overdue" }),
    device({ name: "SOUTH-OLD", location: "South Office", age: 7, lifecycleStatus: "overdue" }),
    device({ type: "server", name: "SERVER-01", location: "South Office", age: 6, lifecycleStatus: "overdue" }),
  ]);

  assert.deepEqual(sorted.map((item) => item.name), [
    "SERVER-01",
    "NORTH-OLDER",
    "NORTH-OLD",
    "SOUTH-OLD",
    "SOUTH-NEW",
  ]);
});

test("priority inventory sorting puts replace-now devices before plan-soon and healthy devices", async () => {
  const { sortLifecycleDevicesByPriority } = await loadClientReportData();
  const sorted = sortLifecycleDevicesByPriority([
    device({ name: "HEALTHY", lifecycleStatus: "current", age: 2 }),
    device({ name: "PLAN", lifecycleStatus: "due-soon", age: 4.5 }),
    device({ name: "REPLACE", lifecycleStatus: "overdue", age: 7 }),
  ]);
  assert.deepEqual(sorted.map((item) => item.name), ["REPLACE", "PLAN", "HEALTHY"]);
});

test("storage status uses watch and critical thresholds without changing lifecycle status", async () => {
  const { storageStatus, storageUsageSummary } = await loadClientReportData();
  const healthy = device({ storageUsage: "C: 174.4 / 252.8 GB (69%)", storagePercent: 69, storageFreeGb: 78.4 });
  const watch = device({ storageUsage: "C: 210 / 250 GB (84%)", storagePercent: 84, storageFreeGb: 40 });
  const critical = device({ storageUsage: "C: 235 / 250 GB (94%)", storagePercent: 94, storageFreeGb: 15 });
  assert.equal(storageStatus(healthy), "healthy");
  assert.equal(storageStatus(watch), "watch");
  assert.equal(storageStatus(critical), "critical");
  assert.equal(critical.lifecycleStatus, "current");
  assert.equal(storageUsageSummary(healthy), "C: 174.4 / 252.8 GB (69%)");
});

test("client-facing inventory surfaces location, device model, video card, and storage", () => {
  const presentation = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
  const exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");
  assert.match(presentation, /device\.location/);
  assert.match(presentation, /Device model/);
  assert.match(presentation, /Video card/);
  assert.match(presentation, /StorageStatusBadge/);
  assert.match(exportHtml, /Device model/);
  assert.match(exportHtml, /Video card/);
  assert.match(exportHtml, /Disk volume usage/);
});

test("virtual machines stay visible but are excluded from physical lifecycle replacement counts", async () => {
  const {
    clientDeviceDisplayName,
    deviceTypeLabelForDevice,
    inventoryReportDevices,
    reportableLifecycleDevices,
    lifecycleSummary,
    storageAttentionSummary,
  } = await loadClientReportData();
  const project = {
    type: "client-report",
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    presentation: {},
    intelligence: {
      facts: [{
        key: "scalepad.inventory",
        value: [JSON.stringify(device({
          type: "server",
          name: "DIC-DATA-01",
          model: "Virtual Machine",
          os: "Server 2022 Standard Edition",
          graphics: "Microsoft Hyper-V Video",
          age: 11.8,
          lifecycleStatus: "overdue",
          storageUsage: "C: 29 / 119.4 GB (24%) · D: 1543.8 / 2949.2 GB (52%)",
          storagePercent: 52,
          storageFreeGb: 90.3,
        }))],
      }],
    },
  };

  const inventory = inventoryReportDevices(project);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].type, "vm");
  assert.equal(inventory[0].lifecycleStatus, "unknown");
  assert.equal(clientDeviceDisplayName(inventory[0]), "DIC-DATA-01 (Virtual Machine)");
  assert.equal(deviceTypeLabelForDevice(inventory[0]), "Virtual server");
  assert.equal(reportableLifecycleDevices(project).length, 0);
  assert.equal(lifecycleSummary(project).total, 0);
  assert.equal(storageAttentionSummary(project).reported, 1);
});


test("operating-system support classifies Windows and Server concerns without hiding virtual machines", async () => {
  const { classifyOsSupport, osSupportReason, osSupportSummary } = await loadClientReportData();
  assert.equal(classifyOsSupport("Microsoft Windows 10 Pro Edition"), "unsupported");
  assert.equal(classifyOsSupport("Microsoft Windows Server 2012 R2 Standard Edition"), "unsupported");
  assert.equal(classifyOsSupport("Microsoft Windows Server 2016 Standard Edition"), "ending-soon");
  assert.equal(classifyOsSupport("Microsoft Windows 11 Home Edition"), "ending-soon");
  assert.equal(classifyOsSupport("Microsoft Windows 11 Pro Edition"), "supported");
  assert.equal(classifyOsSupport("Microsoft Windows Server 2022 Standard Edition"), "supported");
  assert.match(osSupportReason(device({ os: "Microsoft Windows 11 Home Edition" })), /business Pro edition/);

  const project = {
    type: "client-report",
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    presentation: {},
    intelligence: {
      facts: [{
        key: "scalepad.inventory",
        value: [
          JSON.stringify(device({ name: "WIN10-PC", os: "Windows 10 Pro Edition" })),
          JSON.stringify(device({ name: "HOME-PC", os: "Windows 11 Home Edition" })),
          JSON.stringify(device({ type: "vm", name: "VM-2016", model: "Virtual Machine", os: "Server 2016 Standard Edition", graphics: "Microsoft Hyper-V Video", lifecycleStatus: "unknown" })),
          JSON.stringify(device({ name: "PRO-PC", os: "Windows 11 Pro Edition" })),
        ],
      }],
    },
  };
  assert.deepEqual(osSupportSummary(project), { reported: 4, supported: 1, planning: 2, endOfSupport: 1, unknown: 0, attention: 3 });
});
