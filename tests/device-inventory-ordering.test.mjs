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

test("client-facing inventory surfaces both location and graphics shorthand", () => {
  const presentation = fs.readFileSync("src/components/outcome-experience.tsx", "utf8");
  const exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");
  assert.match(presentation, /device\.location/);
  assert.match(presentation, /Graphics:/);
  assert.match(exportHtml, /Location:/);
  assert.match(exportHtml, /Graphics:/);
});
