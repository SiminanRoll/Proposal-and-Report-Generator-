import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function runtime() {
  const config = await transpileTestModule("../src/lib/compass/config.ts", import.meta.url, { prefix: "criteria-config" });
  const engine = await transpileTestModule("../src/lib/compass/engine.ts", import.meta.url, { prefix: "criteria-engine" });
  return { ...config.module, ...engine.module };
}

function parsed(rows) {
  return { sourceName: "Ninja_Master.xlsx", rows, totalRows: rows.length, rejectedRows: 0, detectedHeaders: ["deviceName", "organization"] };
}

function row(index = 0, overrides = {}) {
  return {
    rowNumber: index + 2,
    organization: "Alpha Dental",
    location: "Main",
    deviceName: `PC-${index + 1}`,
    stableId: `W${index + 1}`,
    lastUptime: "2026-08-04",
    videoCard: "Intel UHD",
    warrantyStart: "2021-01-01",
    warrantyEnd: "2024-01-01",
    lastLogin: "2026-08-04",
    memoryGiB: "16",
    osName: "Microsoft Windows 11 Pro",
    deviceStatus: "Active",
    diskVolumeUsage: "C: 60/100 GB (60%)",
    deviceModel: "Dell OptiPlex",
    ...overrides,
  };
}

function card(config, id) { return config.cards.find((item) => item.id === id); }
function opportunity(dataset, clientName, cardId) {
  return dataset.summaries.find((item) => item.clientName === clientName)?.opportunities.find((item) => item.cardCategory === cardId);
}

test("criteria edits survive normalization and recalculate client opportunities", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, normalizeCompassConfig, recalculateDataset } = await runtime();
  const base = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index))), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-05T12:00:00Z")).dataset;
  assert.ok(base);
  const edited = structuredClone(DEFAULT_COMPASS_CONFIG);
  const workstation = card(edited, "workstation-lifecycle");
  workstation.criteria.minAffectedDevices = 6;
  const normalized = normalizeCompassConfig(edited);
  const recalculated = recalculateDataset(base, normalized, new Date("2026-08-05T12:00:00Z"));
  assert.equal(opportunity(recalculated, "Alpha Dental", "workstation-lifecycle"), undefined);
});

test("card estimates support per-device and fixed modes", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, normalizeCompassConfig, recalculateDataset } = await runtime();
  const base = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index))), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-05T12:00:00Z")).dataset;
  assert.ok(base);
  const perDevice = structuredClone(DEFAULT_COMPASS_CONFIG);
  const workstation = card(perDevice, "workstation-lifecycle");
  workstation.estimateMode = "per-device";
  workstation.estimatePerDevice = 1000;
  workstation.fixedEstimate = 0;
  let recalculated = recalculateDataset(base, normalizeCompassConfig(perDevice), new Date("2026-08-05T12:00:00Z"));
  assert.equal(opportunity(recalculated, "Alpha Dental", "workstation-lifecycle")?.estimatedValue, 5000);
  const fixed = structuredClone(DEFAULT_COMPASS_CONFIG);
  const fixedWorkstation = card(fixed, "workstation-lifecycle");
  fixedWorkstation.estimateMode = "fixed";
  fixedWorkstation.fixedEstimate = 12000;
  recalculated = recalculateDataset(base, normalizeCompassConfig(fixed), new Date("2026-08-05T12:00:00Z"));
  assert.equal(opportunity(recalculated, "Alpha Dental", "workstation-lifecycle")?.estimatedValue, 12000);
});

test("card status and visibility are configurable without deleting definitions", async () => {
  const { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } = await runtime();
  const edited = structuredClone(DEFAULT_COMPASS_CONFIG);
  card(edited, "windows-10").enabled = false;
  card(edited, "storage").visible = false;
  const normalized = normalizeCompassConfig(edited);
  assert.equal(card(normalized, "windows-10").enabled, false);
  assert.equal(card(normalized, "storage").visible, false);
  assert.ok(card(normalized, "windows-10"));
  assert.ok(card(normalized, "storage"));
});

test("critical server projects can be tuned without removing the canonical card", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, normalizeCompassConfig, recalculateDataset } = await runtime();
  const source = parsed([row(0, { deviceName: "SERVER-01", stableId: "S1", osName: "Windows Server 2012 R2", warrantyStart: "2017-01-01", deviceModel: "Dell PowerEdge" })]);
  const base = buildImportPreview(source, null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-05T12:00:00Z")).dataset;
  assert.ok(base);
  const edited = structuredClone(DEFAULT_COMPASS_CONFIG);
  const critical = card(edited, "critical-server");
  critical.estimateMode = "fixed";
  critical.fixedEstimate = 20000;
  const recalculated = recalculateDataset(base, normalizeCompassConfig(edited), new Date("2026-08-05T12:00:00Z"));
  assert.equal(opportunity(recalculated, "Alpha Dental", "critical-server")?.estimatedValue, 20000);
});

test("custom criteria cards survive normalization and can feed the all-clients rollup", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, cardMetrics, normalizeCompassConfig, recalculateDataset } = await runtime();
  const base = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index))), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-05T12:00:00Z")).dataset;
  assert.ok(base);
  const edited = structuredClone(DEFAULT_COMPASS_CONFIG);
  const customId = "custom-client-review";
  edited.cards.push({
    id: customId,
    title: "Custom Client Review",
    description: "Custom review rule",
    category: "custom",
    enabled: true,
    visible: true,
    criteria: { findingCategories: [], minimumPriorityScore: 0, minAffectedDevices: 0, matchMode: "any" },
    estimateMode: "fixed",
    fixedEstimate: 10000,
    manualClientIds: [],
  });
  card(edited, "all").sourceCardIds.push(customId);
  const normalized = normalizeCompassConfig(edited);
  const recalculated = recalculateDataset(base, normalized, new Date("2026-08-05T12:00:00Z"));
  const custom = opportunity(recalculated, "Alpha Dental", customId);
  assert.ok(custom);
  assert.equal(custom.estimatedValue, 11000);
  assert.ok(opportunity(recalculated, "Alpha Dental", "all"));
  const metric = cardMetrics(recalculated, normalized).find((item) => item.id === customId);
  assert.equal(metric.count, 1);
  assert.equal(metric.value, 11000);
});

test("Settings page manages the current Project Coverage card setup instead of exposing legacy card controls", () => {
  const settings = fs.readFileSync(new URL("../src/components/compass-settings-page.tsx", import.meta.url), "utf8");
  const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(rail, /Technical-card configuration/);
  assert.match(rail, /href="\/settings\/"/);
  assert.match(settings, /Project Coverage card setup/);
  assert.match(settings, /Workstation project minimum/);
  assert.match(settings, /Enable Health Priority/);
  assert.match(settings, /primaryCardOrder/);
  assert.match(settings, /priorityCardOrder/);
  assert.match(settings, /hiddenCardIds/);
  assert.match(settings, /saveCompassConfigAndDataset/);
  assert.match(settings, /recalculateDataset/);
});