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

function fact(key, value) {
  return { id: key, key, label: key, value, category: "lifecycle", confidence: "high", sourceFileId: "scale", evidence: "test" };
}

test("stored projects are normalized so young workstations are not carried forward as replacements", async () => {
  const { lifecycleDevices, lifecycleSummary, replacementDevices } = await loadClientReportData();
  const inventory = [
    { type: "server", name: "SERVER-01", age: 6.5, lifecycleStatus: "overdue" },
    { type: "workstation", name: "OLD-PC", age: 5.8, lifecycleStatus: "overdue" },
    { type: "workstation", name: "YOUNG-PC", age: 2.2, lifecycleStatus: "overdue" },
    { type: "vm", name: "VM-01", age: 9, lifecycleStatus: "overdue" },
    { type: "network", name: "SWITCH-01", age: 9, lifecycleStatus: "overdue" },
  ];
  const project = {
    intelligence: {
      facts: [
        fact("scalepad.servers", 1),
        fact("scalepad.workstations", 2),
        fact("scalepad.vms", 1),
        fact("scalepad.networkDevices", 1),
        fact("scalepad.replacement.overdue", 5),
        fact("scalepad.inventory", inventory.map((item) => JSON.stringify(item))),
      ],
    },
  };

  const devices = lifecycleDevices(project);
  assert.equal(devices.find((device) => device.name === "YOUNG-PC")?.lifecycleStatus, "current");
  assert.equal(replacementDevices(project).some((device) => device.name === "YOUNG-PC"), false);

  const summary = lifecycleSummary(project);
  assert.deepEqual(summary, {
    total: 3,
    current: 1,
    dueSoon: 0,
    overdue: 2,
    unknown: 0,
    healthyPercentage: 33,
  });
});

test("saved inventory strings, duplicate rows, and misclassified VMs cannot inflate physical lifecycle totals", async () => {
  const { lifecycleSummary, physicalAssetCounts, replacementDevices, reportableLifecycleDevices } = await loadClientReportData();
  const inventory = [
    { type: "SERVER", name: "SERVER-01", serial: "S1", age: "6.5 years", lifecycleStatus: "current", make: "Dell", model: "PowerEdge T340", lastCheckIn: "08/03/2026" },
    { type: "WORKSTATION", name: "OFFICE-01", serial: "W1", age: "2.2 years", lifecycleStatus: "overdue", make: "Dell", model: "Precision 3460", lastCheckIn: "08/03/2026" },
    { type: "workstation", name: "OFFICE-01-OLD-LABEL", serial: "W1", age: 2.2, lifecycleStatus: "overdue", make: "Dell", model: "Precision 3460", lastCheckIn: "07/01/2026" },
    { type: "workstation", name: "DC-01", serial: "VM1", age: 7, lifecycleStatus: "overdue", make: "Microsoft", model: "Virtual Machine", lastCheckIn: "08/03/2026" },
    { type: "workstation", name: "OLD-PC", serial: "W2", age: 5.8, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3070", lastCheckIn: "08/03/2026" },
  ];
  const project = {
    intelligence: {
      facts: [
        fact("scalepad.servers", 1),
        fact("scalepad.workstations", 2),
        fact("scalepad.vms", 1),
        fact("scalepad.inventory", inventory.map((item) => JSON.stringify(item))),
      ],
    },
  };

  const devices = reportableLifecycleDevices(project);
  assert.deepEqual(devices.map((device) => device.name).sort(), ["OFFICE-01", "OLD-PC", "SERVER-01"]);
  assert.equal(devices.find((device) => device.name === "OFFICE-01")?.lifecycleStatus, "current");
  assert.equal(replacementDevices(project).some((device) => device.name === "OFFICE-01"), false);
  assert.deepEqual(physicalAssetCounts(project), { servers: 1, backupServers: 0, workstations: 2, total: 3 });
  assert.deepEqual(lifecycleSummary(project), {
    total: 3,
    current: 1,
    dueSoon: 0,
    overdue: 2,
    unknown: 0,
    healthyPercentage: 33,
  });
});

test("a 13-row import with two virtual machines produces 11 physical assets and internally consistent status totals", async () => {
  const { lifecycleSummary, physicalAssetCounts, replacementDevices } = await loadClientReportData();
  const physical = [
    { type: "server", name: "FRA-VMHOST-01", serial: "S1", age: 6.5, lifecycleStatus: "overdue", make: "Dell", model: "PowerEdge T340" },
    { type: "workstation", name: "FRA-OP3", serial: "W1", age: 8, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3050" },
    { type: "workstation", name: "FRA-HALLWAY", serial: "W2", age: 6.5, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3070" },
    { type: "workstation", name: "FRA-HYG1", serial: "W3", age: 6.5, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3070" },
    { type: "workstation", name: "FRA-OP1", serial: "W4", age: 6.5, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3070" },
    { type: "workstation", name: "FRA-PANO", serial: "W5", age: 6.5, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3070" },
    { type: "workstation", name: "FRA-DOCTOR-AIO", serial: "W6", age: 5.8, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 3280 AIO" },
    { type: "workstation", name: "FRA-OFFICE01", serial: "W7", age: "2.2", lifecycleStatus: "overdue", make: "Dell", model: "Precision 3460" },
    { type: "workstation", name: "FRA-HYG2-25", serial: "W8", age: 1.1, lifecycleStatus: "current", make: "Dell", model: "Pro Slim QCS1250" },
    { type: "workstation", name: "FRA-OP2-25", serial: "W9", age: 1.1, lifecycleStatus: "current", make: "Dell", model: "Pro Slim QCS1250" },
    { type: "workstation", name: "FRA-OFFICE02", serial: "W10", age: 0.7, lifecycleStatus: "current", make: "Dell", model: "Pro Slim QCS1250" },
  ];
  const importedRows = [
    ...physical,
    { type: "workstation", name: "FRA-DC01", serial: "VM1", age: 7, lifecycleStatus: "overdue", make: "Microsoft", model: "Virtual Machine" },
    { type: "workstation", name: "FRA-APP01", serial: "VM2", age: 7, lifecycleStatus: "overdue", make: "Microsoft", model: "Virtual Machine" },
  ];
  const project = {
    intelligence: {
      facts: [
        fact("scalepad.servers", 1),
        fact("scalepad.workstations", 10),
        fact("scalepad.vms", 2),
        fact("scalepad.inventory", importedRows.map((item) => JSON.stringify(item))),
      ],
    },
  };

  const counts = physicalAssetCounts(project);
  const summary = lifecycleSummary(project);
  assert.deepEqual(counts, { servers: 1, backupServers: 0, workstations: 10, total: 11 });
  assert.equal(summary.total, 11);
  assert.equal(summary.current + summary.dueSoon + summary.overdue, 11);
  assert.equal(replacementDevices(project).some((device) => device.name === "FRA-OFFICE01"), false);
});


test("CPBDR systems are retained as Cloud Plus backup servers and included in lifecycle priorities", async () => {
  const { lifecycleDevices, physicalAssetCounts, replacementDevices, sortLifecycleDevices } = await loadClientReportData();
  const inventory = [
    { type: "server", name: "SITE-SERVER-01", serial: "S1", age: 6.2, lifecycleStatus: "overdue", make: "Dell", model: "PowerEdge T440" },
    { type: "server", name: "SITE-CPBDR-01", serial: "B1", age: 6.1, lifecycleStatus: "current", make: "Dell", model: "Recovery Appliance" },
    { type: "workstation", name: "FRONT-01", serial: "W1", age: 2.4, lifecycleStatus: "overdue", make: "Dell", model: "OptiPlex 7010" },
  ];
  const project = {
    intelligence: {
      facts: [
        fact("scalepad.servers", 1),
        fact("scalepad.backupServers", 1),
        fact("scalepad.workstations", 1),
        fact("scalepad.inventory", inventory.map((item) => JSON.stringify(item))),
      ],
    },
  };

  const devices = lifecycleDevices(project);
  const backup = devices.find((device) => device.name === "SITE-CPBDR-01");
  assert.equal(backup?.type, "backup-server");
  assert.equal(backup?.lifecycleStatus, "overdue");
  assert.deepEqual(physicalAssetCounts(project), { servers: 1, backupServers: 1, workstations: 1, total: 3 });
  assert.deepEqual(sortLifecycleDevices(devices).slice(0, 2).map((device) => device.type), ["server", "backup-server"]);
  assert.equal(replacementDevices(project).some((device) => device.name === "SITE-CPBDR-01"), true);
  assert.equal(replacementDevices(project).some((device) => device.name === "FRONT-01"), false);
});

test("summary-only projects keep primary and backup server counts separate", async () => {
  const { physicalAssetCounts } = await loadClientReportData();
  const project = {
    intelligence: {
      facts: [
        fact("scalepad.servers", 1),
        fact("scalepad.backupServers", 1),
        fact("scalepad.workstations", 8),
      ],
    },
  };
  assert.deepEqual(physicalAssetCounts(project), { servers: 1, backupServers: 1, workstations: 8, total: 10 });
});


test("client-facing backup server names use the stable CloudPlusBDR label", async () => {
  const { clientDeviceDisplayName } = await loadClientReportData();
  assert.equal(clientDeviceDisplayName({ type: "backup-server", name: "milyDental-CPBDR" }), "CloudPlusBDR");
  assert.equal(clientDeviceDisplayName({ type: "server", name: "FRA-VMHOST-01" }), "FRA-VMHOST-01");
  assert.equal(clientDeviceDisplayName({ type: "server", name: "Check-InExpiryFRA-VMHOST-01" }), "FRA-VMHOST-01");
  assert.equal(clientDeviceDisplayName({ type: "workstation", name: "FRA-OP1" }), "FRA-OP1");
});
