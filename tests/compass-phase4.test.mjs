import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function transpileModule(relativePath, options = {}) {
  return transpileTestModule(relativePath, import.meta.url, { prefix: "client-compass-phase4", ...options });
}

async function runtime() {
  const config = await transpileModule("../src/lib/compass/config.ts", { returnFile: true });
  const reviewModel = await transpileModule("../src/lib/review-outcomes/model.ts", { returnFile: true });
  const projectPackaging = await transpileModule("../src/lib/compass/project-packaging.ts", {
    returnFile: true,
    replacements: {
      'from "@/lib/review-outcomes/model"': `from ${JSON.stringify(pathToFileURL(reviewModel.file).href)}`,
    },
  });
  const generator = await transpileModule("../src/lib/compass/generator-bridge.ts", {
    replacements: {
      'from "./config"': `from ${JSON.stringify(pathToFileURL(config.file).href)}`,
      'from "./project-packaging"': `from ${JSON.stringify(pathToFileURL(projectPackaging.file).href)}`,
    },
  });
  return {
    ...config.module,
    ...(await transpileModule("../src/lib/compass/engine.ts")),
    ...generator,
  };
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
    warrantyStart: "2018-01-01",
    warrantyEnd: "2023-01-01",
    lastLogin: "2026-08-04",
    memoryGiB: "16",
    osName: "Microsoft Windows 10 Pro",
    deviceStatus: "Active",
    diskVolumeUsage: "C: 92/100 GB (92%)",
    deviceModel: "Dell OptiPlex 7090",
    ...overrides,
  };
}

function parsed(rows) {
  return { sourceName: "Ninja_Master.xlsx", rows, totalRows: rows.length, rejectedRows: 0, detectedHeaders: ["deviceName", "organization"] };
}

test("Phase 4 release is versioned as Client Compass 1.7.10", () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const version = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
  assert.equal(packageJson.version, "1.7.10");
  assert.match(version, /APP_VERSION = "1\.7\.10"/);
});

test("Reviews Due and Quote Needed are workflow cards and do not change technical score", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, recalculateDataset } = await runtime();
  const now = new Date("2026-08-05T12:00:00Z");
  const dataset = buildImportPreview(parsed(Array.from({ length: 5 }, (_, index) => row(index))), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, now).dataset;
  assert.ok(dataset);
  const initial = dataset.summaries[0];
  assert.ok(initial.opportunities.some((item) => item.cardCategory === "reviews-due"));
  assert.ok(initial.opportunities.some((item) => item.cardCategory === "quote-needed"));
  const score = initial.priorityScore;

  dataset.clients[0].lastAccountReview = "2026-08-05";
  dataset.clients[0].quoted = true;
  const refreshed = recalculateDataset(dataset, DEFAULT_COMPASS_CONFIG, now);
  assert.equal(refreshed.summaries[0].priorityScore, score);
  assert.equal(refreshed.summaries[0].opportunities.some((item) => item.cardCategory === "reviews-due"), false);
  assert.equal(refreshed.summaries[0].opportunities.some((item) => item.cardCategory === "quote-needed"), false);
});

test("manual contact and workflow fields survive a new current-state import", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview } = await runtime();
  const now = new Date("2026-08-05T12:00:00Z");
  const first = buildImportPreview(parsed([row(0)]), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, now).dataset;
  assert.ok(first);
  Object.assign(first.clients[0], {
    primaryContact: "Bonnie Smith",
    primaryContactRole: "Office Manager",
    primaryContactEmail: "bonnie@example.com",
    primaryContactPhone: "615-555-0100",
    assignedOwner: "Patric",
    lastAccountReview: "2026-08-01",
    lastSalesInteraction: "2026-08-03",
    lastQuoteDate: "2026-08-04",
    quoted: true,
    nextFollowUp: "2026-08-20",
    workflowStatus: "Waiting",
    internalNote: "Call after estimate review.",
    reviewOutcome: { status: "confirmed", reviewedAt: "2026-08-01", meetingSummary: "Client purchased the replacement computers.", agreedNextStep: "Advantage will deploy the client-purchased equipment.", reportTitle: "Agreed Technology Roadmap", executiveSummary: "The review documents the agreed deployment and retirement plan.", items: [], lastUpdatedAt: "2026-08-01T12:00:00.000Z" },
  });
  const second = buildImportPreview(parsed([row(0, { lastUptime: "2026-08-06" })]), first, { "Alpha Dental": { mode: "existing", clientId: first.clients[0].id } }, DEFAULT_COMPASS_CONFIG, new Date("2026-08-06T12:00:00Z")).dataset;
  assert.ok(second);
  for (const [key, value] of Object.entries({
    primaryContact: "Bonnie Smith",
    primaryContactRole: "Office Manager",
    primaryContactEmail: "bonnie@example.com",
    primaryContactPhone: "615-555-0100",
    assignedOwner: "Patric",
    lastAccountReview: "2026-08-01",
    lastSalesInteraction: "2026-08-03",
    lastQuoteDate: "2026-08-04",
    quoted: true,
    nextFollowUp: "2026-08-20",
    workflowStatus: "Waiting",
    internalNote: "Call after estimate review.",
  })) assert.equal(second.clients[0][key], value);
  assert.equal(second.clients[0].reviewOutcome.status, "confirmed");
  assert.equal(second.clients[0].reviewOutcome.meetingSummary, "Client purchased the replacement computers.");
  assert.equal(second.clients[0].reviewOutcome.reportTitle, "Agreed Technology Roadmap");
});

test("committed managed-client data becomes a processed ScalePad-compatible generator source", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildImportPreview, buildCompassGeneratorPrefill } = await runtime();
  const now = new Date("2026-08-05T12:00:00Z");
  const dataset = buildImportPreview(parsed([row(0)]), null, { "Alpha Dental": { mode: "new" } }, DEFAULT_COMPASS_CONFIG, now).dataset;
  assert.ok(dataset);
  Object.assign(dataset.clients[0], { primaryContact: "Bonnie", primaryContactRole: "Office Manager", primaryContactEmail: "bonnie@example.com", primaryContactPhone: "615-555-0100", reviewOutcome: { status: "confirmed", reviewedAt: "2026-08-05", meetingSummary: "Server will be retired.", agreedNextStep: "Verify dependencies and decommission the server.", reportTitle: "Agreed Technology Roadmap", executiveSummary: "The technical review and agreed plan are documented together.", items: [], lastUpdatedAt: "2026-08-05T12:00:00.000Z" } });
  const prefill = buildCompassGeneratorPrefill(dataset, dataset.clients[0].id, now);
  assert.ok(prefill);
  assert.equal(prefill.clientName, "Alpha Dental");
  assert.equal(prefill.contactRole, "Office Manager");
  assert.equal(prefill.reviewOutcome.status, "confirmed");
  assert.equal(prefill.reviewOutcome.agreedNextStep, "Verify dependencies and decommission the server.");
  const source = prefill.sourceRecords["scalepad-pdf"][0];
  assert.equal(source.mimeType, "application/x-client-compass-snapshot");
  assert.equal(source.status, "processed");
  assert.equal(source.analysis.sourceType, "scalepad");
  const facts = new Map(source.analysis.facts.map((item) => [item.key, item.value]));
  assert.equal(facts.get("compass.clientId"), dataset.clients[0].id);
  assert.equal(facts.get("compass.sourceName"), "Ninja_Master.xlsx");
  assert.equal(facts.get("compass.authoritativeInventory"), true);
  assert.equal(facts.get("compass.authoritativeInventoryTotal"), 1);
  assert.equal(facts.get("scalepad.workstations"), 1);
  const inventory = facts.get("scalepad.inventory");
  assert.equal(Array.isArray(inventory), true);
  assert.match(inventory[0], /FRONT-1/);
  assert.match(inventory[0], /Windows 10 Pro/);
  assert.match(inventory[0], /"sourceDeviceId"/);
  assert.match(inventory[0], /"authoritative":true/);
});

test("generator connection keeps Huntress required and can refresh from a newer Compass snapshot", () => {
  const createPage = fs.readFileSync(new URL("../src/components/create-page-client.tsx", import.meta.url), "utf8");
  const createScreen = fs.readFileSync(new URL("../src/components/create-project-screen.tsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
  const templates = fs.readFileSync(new URL("../src/lib/projects/templates.ts", import.meta.url), "utf8");
  assert.match(createPage, /compassClientId/);
  assert.match(createPage, /buildCompassGeneratorPrefill/);
  assert.match(createScreen, /Current Client Compass snapshot connected/);
  assert.match(createScreen, /initialSourceRecords/);
  assert.match(workspace, /application\/x-client-compass-snapshot/);
  assert.match(workspace, /Refresh source data/);
  assert.match(workspace, /buildCompassGeneratorPrefill/);
  assert.match(workspace, /automaticCompassRefreshRef/);
  const clientReport = templates.slice(templates.indexOf('"client-report"'), templates.indexOf('"prospect-proposal"'));
  assert.match(clientReport, /huntress-pdf[\s\S]*required: true/);
  const proposals = templates.slice(templates.indexOf('"prospect-proposal"'));
  assert.match(proposals, /rft-spreadsheet[\s\S]*required: true/);
});

test("Phase 4 workflow and valuation controls are exposed without changing the card-only homepage", () => {
  const cardSettings = fs.readFileSync(new URL("../src/components/compass-card-settings-dialog.tsx", import.meta.url), "utf8");
  const settings = fs.readFileSync(new URL("../src/components/compass-settings-dialog.tsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
  assert.match(cardSettings, /Account review is due/);
  assert.match(cardSettings, /Current project opportunity is not quoted/);
  assert.match(settings, /Account review due interval/);
  assert.match(settings, /Estimated value assumptions/);
  for (const field of ["Primary contact", "Contact role", "Contact email", "Contact phone", "Technology Consultant / owner", "Last account review", "Last sales interaction", "Last quote date", "Quoted", "Next follow-up", "Relationship status", "Relationship note"]) assert.match(workspace, new RegExp(field));
  assert.match(home, /Find a client/);
  assert.match(home, /openSearchedClient/);
  assert.doesNotMatch(home, /<table/);
});
