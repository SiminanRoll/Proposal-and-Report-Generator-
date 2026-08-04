import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadClientReportData() {
  let ts;
  try {
    ts = await import("typescript");
  } catch {
    ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js");
  }
  const source = fs.readFileSync(new URL("../src/lib/outcomes/client-report-data.ts", import.meta.url), "utf8");
  const compiled = ts.default.transpileModule(source, {
    compilerOptions: {
      target: ts.default.ScriptTarget.ES2022,
      module: ts.default.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  const file = path.join(os.tmpdir(), `client-report-data-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, compiled);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}`);
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
