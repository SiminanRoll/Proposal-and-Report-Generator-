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
