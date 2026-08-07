import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function transpileModule(relativePath) {
  return transpileTestModule(relativePath, import.meta.url, { prefix: "client-compass-phase3" });
}

async function runtime() {
  return { ...(await transpileModule("../src/lib/compass/config.ts")), ...(await transpileModule("../src/lib/compass/engine.ts")) };
}

function row(index, overrides = {}) {
  return {
    rowNumber: index + 2,
    organization: "Alpha Dental",
    location: "Main",
    deviceName: `FRONT-${index + 1}`,
    stableId: `AGENT-${index + 1}`,
    lastUptime: "2026-08-04",
    videoCard: "Intel UHD",
    warrantyStart: "2022-01-01",
    warrantyEnd: "2027-01-01",
    lastLogin: "2026-08-04",
    memoryGiB: "16",
    osName: "Microsoft Windows 10 Pro",
    deviceStatus: "Active",
    diskVolumeUsage: "C: 60/100 GB (60%)",
    deviceModel: "Dell OptiPlex 7090",
    ...overrides,
  };
}

function parsed(rows) {
  return { sourceName: "Ninja_Master.xlsx", rows, totalRows: rows.length, rejectedRows: 0, detectedHeaders: ["deviceName", "organization"] };
}

test("Phase 3 maintenance release is versioned as Client Compass 1.9.5", () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
  assert.equal(packageJson.version, "1.9.5");
  assert.match(version, /APP_VERSION = "1\.9\.5"/);
});

test("calculation fingerprints detect criteria and estimate changes without a new import", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, compassConfigFingerprint, recalculateDataset } = await runtime();
  const now = new Date("2026-08-05T12:00:00Z");
  const dataset = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index))), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, now).dataset;
  assert.ok(dataset);
  const originalFingerprint = compassConfigFingerprint(DEFAULT_COMPASS_CONFIG);
  assert.equal(dataset.calculationFingerprint, originalFingerprint);
  assert.equal(dataset.calculatedAt, now.toISOString());
  assert.ok(dataset.summaries[0].opportunities.some((item) => item.cardCategory === "windows-10"));

  const edited = structuredClone(DEFAULT_COMPASS_CONFIG);
  edited.cards.find((card) => card.id === "windows-10").rules[0].minimumDevices = 6;
  edited.value.standardWorkstationModernization += 500;
  const changedFingerprint = compassConfigFingerprint(edited);
  assert.notEqual(changedFingerprint, originalFingerprint);

  const recalculated = recalculateDataset(dataset, edited, new Date("2026-08-05T13:00:00Z"));
  assert.equal(recalculated.importedAt, dataset.importedAt);
  assert.equal(recalculated.calculationFingerprint, changedFingerprint);
  assert.equal(recalculated.calculatedAt, "2026-08-05T13:00:00.000Z");
  assert.equal(recalculated.summaries[0].opportunities.some((item) => item.cardCategory === "windows-10"), false);
});

test("quoted status survives current-snapshot replacement", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const initial = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index))), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-05T12:00:00Z")).dataset;
  assert.ok(initial);
  initial.clients[0].quoted = true;
  initial.clients[0].workflowStatus = "Project Mapping Needed";
  const refreshed = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index, { lastUptime: "2026-08-06" }))), initial, { "Alpha Dental": { mode: "existing", clientId: initial.clients[0].id } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-06T12:00:00Z")).dataset;
  assert.ok(refreshed);
  assert.equal(refreshed.clients[0].quoted, true);
  assert.equal(refreshed.clients[0].workflowStatus, "Quote Needed");
});

test("Compass home exposes automatic catch-up status and a manual calculation refresh", () => {
  const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
  const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
  const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
  assert.match(home, /compassConfigFingerprint/);
  assert.match(home, /dataset\.calculationFingerprint === expectedFingerprint/);
  assert.match(home, /refreshCalculations\("automatic"\)/);
  assert.match(dataTools, /Refresh calculations/);
  assert.match(home, /Cards and client workspaces are caught up/);
  assert.match(dataTools, /Update Ninja data/);
  assert.match(rail, /Settings/);
});

test("card queues retain technical context while operating as relationship-first review campaigns", () => {
  const queue = fs.readFileSync(new URL("../src/components/compass-client-queue.tsx", import.meta.url), "utf8");
  for (const expected of ["Client review campaign", "Review need first", "Technical urgency", "Estimated value", "Oldest account review", "All owners", "All locations", "Why included", "Review coverage", "Next relationship action", "affected device", "Report", "Update History", "Open Client"]) {
    assert.match(queue, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(queue, /campaignHealthMetrics/);
  assert.match(queue, /saveCompassDataset/);
  assert.match(queue, /lastSalesInteraction/);
  assert.match(queue, /lastQuoteDate/);
  assert.doesNotMatch(queue, /Generate Proposal/);
});

test("client workspace is a basic CRM first with technical truth collapsed behind details", () => {
  const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
  for (const expected of ["Basic CRM", "Account review tracking", "Last account review", "Next follow-up", "Primary contact", "Captain's Log", "Environment & technical detail", "Physical servers", "Virtual servers", "Physical workstations", "Virtual machines", "Current device inventory", "Open Client Report"]) {
    assert.match(workspace, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(workspace, /saveCompassDataset/);
  assert.match(workspace, /device\.isVirtual/);
  assert.doesNotMatch(workspace, /Relationship status/);
  assert.doesNotMatch(workspace, /Last sales interaction/);
  assert.doesNotMatch(workspace, /Technology Consultant \/ owner/);
  assert.doesNotMatch(workspace, /Explainable estimates/);
  assert.doesNotMatch(workspace, /Generate Potential Client Proposal/);
});

test("generator creation routes accept Client Compass prefill context", () => {
  const page = fs.readFileSync(new URL("../src/components/create-page-client.tsx", import.meta.url), "utf8");
  const screen = fs.readFileSync(new URL("../src/components/create-project-screen.tsx", import.meta.url), "utf8");
  assert.match(page, /params\.get\("client"\)/);
  assert.match(page, /params\.get\("contact"\)/);
  assert.match(page, /params\.get\("context"\)/);
  assert.match(screen, /initialClientName/);
  assert.match(screen, /initialContactName/);
  assert.match(screen, /initialContext/);
});
