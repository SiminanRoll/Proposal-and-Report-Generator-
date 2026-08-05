import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function transpileModule(relativePath, replacements = {}) {
  let ts;
  try { ts = await import("typescript"); }
  catch { ts = await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
  let output = ts.default.transpileModule(source, {
    compilerOptions: { target: ts.default.ScriptTarget.ES2022, module: ts.default.ModuleKind.ESNext, verbatimModuleSyntax: true },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) output = output.replaceAll(from, to);
  const file = path.join(os.tmpdir(), `client-report-reconciliation-${path.basename(relativePath).replace(/\W/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, output);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}`);
}

async function loadAdapters() {
  return transpileModule("../src/lib/intelligence/browser/report-adapters.ts");
}

async function loadReportData() {
  return transpileModule("../src/lib/outcomes/client-report-data.ts");
}

async function loadIntelligence() {
  return transpileModule("../src/lib/intelligence/client.ts", {
    'import { enableHipaaAssessment } from "@/lib/hipaa/engine";': "const enableHipaaAssessment = (value) => value;",
    'import { normalizeProposalProject, replaceA360MonthlyDefaults } from "@/lib/proposals/pricing";': "const normalizeProposalProject = (value) => value; const replaceA360MonthlyDefaults = (value) => value;",
  });
}

function fact(key, value, sourceFileId = "source") {
  return { key, label: key, value, category: "lifecycle", confidence: "high", sourceFileId, evidence: "test" };
}

function analysis(sourceFileId, facts) {
  return {
    sourceType: "scalepad",
    confidence: "high",
    summary: "Lifecycle source",
    highlights: [],
    warnings: [],
    facts: facts.map(([key, value]) => fact(key, value, sourceFileId)),
    findingCandidates: [],
  };
}

function projectWithFacts(facts) {
  return {
    intelligence: { facts },
    presentation: { publishedAt: "" },
    updatedAt: "2026-08-05T12:00:00Z",
    createdAt: "2026-08-05T12:00:00Z",
  };
}

test("Ninja inventory keeps punctuation-distinct device identities and normalizes hidden separators", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const common = {
    Organization: "Sample Practice",
    Location: "Main",
    "Last Uptime": "2026-08-05T12:00:00Z",
    "OS Name": "Microsoft Windows 11 Pro Edition",
    "Device Model": "Dell OptiPlex 7010",
  };
  const result = parseDeviceInventoryExport([
    { ...common, Device: "DAL-FRONTDESK-1" },
    { ...common, Device: "DAL-FRONTDESK1" },
    { ...common, Device: "LAPTOP\uFFFEFRONTDESK1" },
  ], "ninja", "Devices.csv");
  const values = Object.fromEntries(result.facts.map((item) => [item.key, item.value]));
  const names = values["scalepad.inventory"].map((item) => JSON.parse(item).name).sort();
  assert.equal(values["scalepad.totalAssets"], 3);
  assert.deepEqual(names, ["DAL-FRONTDESK-1", "DAL-FRONTDESK1", "LAPTOP-FRONTDESK1"]);
});

test("full managed inventory remains visible when physical lifecycle status is unknown", async () => {
  const { inventoryReportDevices, lifecycleSummary } = await loadReportData();
  const inventory = [
    { type: "server", name: "SERVER-01", age: 2, lifecycleStatus: "current", osStatus: "supported" },
    { type: "workstation", name: "UNKNOWN-PC", age: 0, lifecycleStatus: "unknown", osStatus: "supported" },
    { type: "vm", name: "VM-01", age: 0, lifecycleStatus: "unknown", osStatus: "supported" },
  ];
  const facts = [
    fact("scalepad.totalAssets", 3),
    fact("scalepad.sourceReportedTotal", 3),
    fact("scalepad.servers", 1),
    fact("scalepad.workstations", 1),
    fact("scalepad.vms", 1),
    fact("scalepad.replacement.current", 1),
    fact("scalepad.replacement.dueSoon", 0),
    fact("scalepad.replacement.overdue", 0),
    fact("scalepad.replacement.unknown", 1),
    fact("scalepad.inventory", inventory.map((item) => JSON.stringify(item))),
  ];
  const project = projectWithFacts(facts);
  assert.equal(inventoryReportDevices(project).length, 3);
  assert.deepEqual(lifecycleSummary(project), {
    total: 2,
    inventoryTotal: 3,
    assessed: 1,
    current: 1,
    dueSoon: 0,
    overdue: 0,
    unknown: 1,
    healthyPercentage: 100,
  });
});

test("inventory reconciliation identifies count loss instead of silently publishing", async () => {
  const { inventoryReconciliation } = await loadReportData();
  const inventory = [
    { type: "server", name: "SERVER-01", age: 2, lifecycleStatus: "current" },
    { type: "workstation", name: "FRONT-01", age: 2, lifecycleStatus: "current" },
  ];
  const project = projectWithFacts([
    fact("scalepad.sourceReportedTotal", 3),
    fact("scalepad.servers", 1),
    fact("scalepad.workstations", 1),
    fact("scalepad.vms", 1),
    fact("scalepad.inventory", inventory.map((item) => JSON.stringify(item))),
  ]);
  const result = inventoryReconciliation(project);
  assert.equal(result.passed, false);
  assert.match(result.messages.join(" "), /Source reports 3 assets, but 2 unique device records/i);
  assert.match(result.messages.join(" "), /Virtual-machine count mismatch/i);
});

test("Ninja remains authoritative while ScalePad safely enriches lifecycle and summary facts", async () => {
  const { buildProjectIntelligence } = await loadIntelligence();
  const { inventoryReconciliation, lifecycleSummary } = await loadReportData();
  const baseInventory = [
    { type: "workstation", name: "DAL-FRONTDESK-1", age: 0, lifecycleStatus: "unknown", osStatus: "supported" },
    { type: "workstation", name: "DAL-FRONTDESK1", age: 0, lifecycleStatus: "unknown", osStatus: "unsupported" },
    { type: "vm", name: "VM-01", age: 0, lifecycleStatus: "unknown", osStatus: "supported" },
  ];
  const scalePadInventory = [
    { type: "workstation", name: "DAL-FRONTDESK-1", age: 8, purchased: "01/01/2018", warrantyExpires: "01/01/2021", lifecycleStatus: "overdue", osStatus: "supported" },
    { type: "workstation", name: "FRONTDESK1MARKETINGDAL-Procurement2", age: 8, lifecycleStatus: "overdue", osStatus: "unsupported" },
  ];
  const ninjaAnalysis = analysis("ninja", [
    ["scalepad.totalAssets", 3], ["scalepad.physicalAssets", 2], ["scalepad.sourceReportedTotal", 3], ["scalepad.parsedInventoryTotal", 3],
    ["scalepad.servers", 0], ["scalepad.backupServers", 0], ["scalepad.workstations", 2], ["scalepad.vms", 1], ["scalepad.networkDevices", 0],
    ["scalepad.replacement.current", 0], ["scalepad.replacement.dueSoon", 0], ["scalepad.replacement.overdue", 0], ["scalepad.replacement.unknown", 2],
    ["scalepad.os.supported", 2], ["scalepad.os.endingSoon", 0], ["scalepad.os.unsupported", 1],
    ["scalepad.inventory", baseInventory.map((item) => JSON.stringify(item))],
  ]);
  const scalePadAnalysis = analysis("scalepad", [
    ["scalepad.totalAssets", 3], ["scalepad.physicalAssets", 2], ["scalepad.sourceReportedTotal", 3], ["scalepad.parsedInventoryTotal", 2],
    ["scalepad.servers", 0], ["scalepad.backupServers", 0], ["scalepad.workstations", 2], ["scalepad.vms", 1], ["scalepad.networkDevices", 0],
    ["scalepad.replacement.current", 0], ["scalepad.replacement.dueSoon", 0], ["scalepad.replacement.overdue", 1], ["scalepad.replacement.unknown", 1],
    ["scalepad.os.supported", 1], ["scalepad.os.endingSoon", 0], ["scalepad.os.unsupported", 2],
    ["scalepad.inventory", scalePadInventory.map((item) => JSON.stringify(item))],
  ]);
  const sources = [{
    id: "lifecycle", kind: "lifecycle", label: "Lifecycle", required: false,
    files: [
      { id: "ninja", name: "Devices.csv", mimeType: "text/csv", size: 1, addedAt: "", status: "processed", analysis: ninjaAnalysis },
      { id: "scalepad", name: "Lifecycle.pdf", mimeType: "application/pdf", size: 1, addedAt: "", status: "processed", analysis: scalePadAnalysis },
    ],
  }];
  const intelligence = buildProjectIntelligence({ type: "client-report", sources, painPoints: [] });
  const mergedInventory = intelligence.facts.find((item) => item.key === "scalepad.inventory").value.map((item) => JSON.parse(item));
  assert.deepEqual(mergedInventory.map((item) => item.name), ["DAL-FRONTDESK-1", "DAL-FRONTDESK1", "VM-01"]);
  assert.equal(mergedInventory[0].age, 8);
  assert.equal(mergedInventory[1].age, 0);
  assert.equal(intelligence.facts.find((item) => item.key === "scalepad.replacement.overdue").value, 1);
  assert.equal(intelligence.exceptions.some((item) => item.key === "clientReport.inventoryReconciliation"), false);
  const project = projectWithFacts(intelligence.facts);
  assert.equal(inventoryReconciliation(project).passed, true);
  assert.deepEqual(lifecycleSummary(project), {
    total: 2,
    inventoryTotal: 3,
    assessed: 1,
    current: 0,
    dueSoon: 0,
    overdue: 1,
    unknown: 1,
    healthyPercentage: 0,
  });
});
