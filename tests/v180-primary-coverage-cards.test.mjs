import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function runtime() {
  const model = await transpileTestModule("../src/lib/review-outcomes/model.ts", import.meta.url, { returnFile: true, prefix: "coverage-model" });
  const modelUrl = pathToFileURL(model.file).href;
  const packaging = await transpileTestModule("../src/lib/compass/project-packaging.ts", import.meta.url, {
    returnFile: true,
    prefix: "coverage-packaging",
    replacements: {
      'from "@/lib/review-outcomes/model"': `from ${JSON.stringify(modelUrl)}`,
    },
  });
  const priority = await transpileTestModule("../src/lib/compass/project-coverage-priority.ts", import.meta.url, { returnFile: true, prefix: "coverage-priority" });
  const coverage = await transpileTestModule("../src/lib/compass/project-coverage.ts", import.meta.url, {
    returnFile: true,
    prefix: "coverage-engine",
    replacements: {
      'from "../review-outcomes/model"': `from ${JSON.stringify(modelUrl)}`,
      'from "./project-packaging"': `from ${JSON.stringify(pathToFileURL(packaging.file).href)}`,
      'from "./project-coverage-priority"': `from ${JSON.stringify(pathToFileURL(priority.file).href)}`,
    },
  });
  const config = await transpileTestModule("../src/lib/compass/config.ts", import.meta.url, { prefix: "coverage-config" });
  return { ...coverage.module, ...config };
}

function emptyOutcome(overrides = {}) {
  return { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", items: [], lastUpdatedAt: "", ...overrides };
}

function client(id, overrides = {}) {
  return {
    id,
    name: id.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase()),
    aliases: [],
    primaryContact: "",
    primaryContactRole: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    assignedOwner: "Patric",
    lastAccountReview: "",
    lastSalesInteraction: "",
    lastQuoteDate: "",
    quoted: false,
    nextFollowUp: "",
    workflowStatus: "",
    internalNote: "",
    reviewOutcome: emptyOutcome(),
    lastDataRefresh: "2026-08-06T12:00:00.000Z",
    ...overrides,
  };
}

function device(clientId, id, type) {
  return {
    id,
    clientId,
    locationId: `${clientId}-location`,
    name: id,
    organization: clientId,
    deviceType: type,
    isVirtual: type.startsWith("virtual"),
    virtualizationPlatform: "",
    model: type.includes("server") ? "Dell PowerEdge" : "Dell OptiPlex",
    videoCard: "",
    osName: type.includes("server") ? "Windows Server 2016" : "Windows 10 Pro",
    status: "Active",
    memoryGiB: 16,
    diskVolumeSource: "",
    diskVolumes: [],
    warrantyStart: "2018-01-01",
    warrantyEnd: "2023-01-01",
    lastUptime: "2026-08-05",
    lastLogin: "2026-08-05",
    lifecycle: type === "physical-workstation" ? "replace-now" : "unknown",
    source: "fixture",
  };
}

function datasetFixture() {
  const clients = [
    client("needs-review"),
    client("discussed-open", {
      lastAccountReview: "2026-01-10",
      nextFollowUp: "2026-07-01",
      reviewOutcome: emptyOutcome({ status: "confirmed", reviewedAt: "2026-01-10", meetingSummary: "The server should be replaced.", agreedNextStep: "Review options.", lastUpdatedAt: "2026-01-10" }),
    }),
    client("quoted-open", { quoted: true, lastQuoteDate: "2025-05-01" }),
    client("small-refresh"),
    client("resolved-server", {
      lastAccountReview: "2026-02-01",
      reviewOutcome: emptyOutcome({
        status: "confirmed",
        reviewedAt: "2026-02-01",
        meetingSummary: "The server work is complete.",
        items: [{ id: "done", title: "Server replacement", technicalFinding: "Legacy server", disposition: "completed", clientFacingNote: "Completed", internalNote: "", responsibleParty: "", targetDate: "", includeInReport: true, deviceIds: ["resolved-server-s1"] }],
        lastUpdatedAt: "2026-02-01",
      }),
    }),
  ];
  const devices = [
    device("needs-review", "needs-review-s1", "physical-server"),
    device("discussed-open", "discussed-open-s1", "physical-server"),
    ...Array.from({ length: 5 }, (_, index) => device("quoted-open", `quoted-open-w${index + 1}`, "physical-workstation")),
    ...Array.from({ length: 4 }, (_, index) => device("small-refresh", `small-refresh-w${index + 1}`, "physical-workstation")),
    device("resolved-server", "resolved-server-s1", "physical-server"),
  ];
  const opportunities = [
    { clientId: "needs-review", cardCategory: "critical-server", affectedDeviceIds: ["needs-review-s1"], drivers: ["Unsupported server operating system"], estimatedValue: 49500, confidence: "high", assumptionKeys: [] },
    { clientId: "discussed-open", cardCategory: "server-planning", affectedDeviceIds: ["discussed-open-s1"], drivers: ["Windows Server 2016"], estimatedValue: 49500, confidence: "high", assumptionKeys: [] },
    { clientId: "quoted-open", cardCategory: "workstation-lifecycle", affectedDeviceIds: Array.from({ length: 5 }, (_, index) => `quoted-open-w${index + 1}`), drivers: ["Five Replace Now workstations"], estimatedValue: 16225, confidence: "high", assumptionKeys: [] },
    { clientId: "small-refresh", cardCategory: "workstation-lifecycle", affectedDeviceIds: Array.from({ length: 4 }, (_, index) => `small-refresh-w${index + 1}`), drivers: ["Four Replace Now workstations"], estimatedValue: 12980, confidence: "high", assumptionKeys: [] },
    { clientId: "resolved-server", cardCategory: "critical-server", affectedDeviceIds: ["resolved-server-s1"], drivers: ["Legacy server"], estimatedValue: 49500, confidence: "high", assumptionKeys: [] },
  ];
  return {
    schemaVersion: 1,
    clients,
    locations: clients.map((item) => ({ id: `${item.id}-location`, clientId: item.id, name: "Main" })),
    devices,
    findings: [
      { id: "critical", clientId: "needs-review", deviceId: "needs-review-s1", category: "server-2012", severity: "critical", title: "Unsupported server", explanation: "Server 2012", scoreContribution: 50, valueCategory: "critical-server" },
    ],
    summaries: clients.map((item) => ({
      clientId: item.id,
      clientName: item.name,
      priorityScore: item.id === "needs-review" ? 90 : 50,
      priorityTier: item.id === "needs-review" ? "Critical" : "High",
      topDrivers: [],
      totalEstimatedValue: opportunities.filter((opportunity) => opportunity.clientId === item.id).reduce((sum, opportunity) => sum + opportunity.estimatedValue, 0),
      opportunities: opportunities.filter((opportunity) => opportunity.clientId === item.id),
    })),
    importedAt: "2026-08-06T12:00:00.000Z",
    importSourceName: "fixture.xlsx",
    importSummary: { totalRows: devices.length, organizationsDetected: clients.length, matchedOrganizations: clients.length, unmatchedOrganizations: 0, newOrganizations: 0, devicesDetected: devices.length, physicalServers: 3, virtualMachines: 0, workstations: 9, rejectedRows: 0, osConcerns: 0, storageConcerns: 0 },
  };
}

test("coverage engine assigns one service position and excludes nonqualifying or resolved needs", async () => {
  const { buildProjectCoverageSnapshot, DEFAULT_COMPASS_CONFIG } = await runtime();
  const snapshot = buildProjectCoverageSnapshot(datasetFixture(), DEFAULT_COMPASS_CONFIG, new Date("2026-08-06T12:00:00.000Z"));
  assert.equal(snapshot.qualifyingClientCount, 3);
  assert.equal(snapshot.qualifyingProjectCount, 3);
  assert.deepEqual(snapshot.cards.map((card) => [card.id, card.count]), [["needs-review", 1], ["discussed-open", 1], ["quoted-open", 1]]);
  assert.equal(snapshot.clients.some((item) => item.clientId === "small-refresh"), false, "fewer than five physical workstations must not qualify");
  assert.equal(snapshot.clients.some((item) => item.clientId === "resolved-server"), false, "completed work must not remain open");
});

test("coverage metrics use deduplicated package value and required card-back signals", async () => {
  const { buildProjectCoverageSnapshot, DEFAULT_COMPASS_CONFIG } = await runtime();
  const snapshot = buildProjectCoverageSnapshot(datasetFixture(), DEFAULT_COMPASS_CONFIG, new Date("2026-08-06T12:00:00.000Z"));
  const needs = snapshot.cards[0];
  const discussed = snapshot.cards[1];
  const quoted = snapshot.cards[2];
  assert.equal(needs.clients[0].hasCriticalServer, true);
  assert.equal(needs.clients[0].hasUnsupportedSystems, true);
  assert.match(needs.clients[0].attentionReason, /Unsupported server operating system/);
  assert.match(needs.clients[0].priorityReason, /Critical server concern/);
  assert.equal(needs.stats.find((item) => item.label === "Server projects").value, 1);
  assert.equal(discussed.stats.find((item) => item.label === "Past-due follow-ups").value, 1);
  assert.equal(quoted.stats.find((item) => item.label === "Quotes older than 12 months").value, 1);
  assert.equal(quoted.clients[0].reviewHistoryMissing, true);
  assert.match(quoted.clients[0].priorityReason, /review history is missing/);
  assert.equal(quoted.clients[0].estimatedValue, 16225);
});

test("Priority Lens exposes exactly three alternate cards with stable ranked client lists", async () => {
  const { buildProjectCoverageSnapshot, projectCoverageCardsForSet, DEFAULT_COMPASS_CONFIG } = await runtime();
  const snapshot = buildProjectCoverageSnapshot(datasetFixture(), DEFAULT_COMPASS_CONFIG, new Date("2026-08-06T12:00:00.000Z"));
  const cards = projectCoverageCardsForSet(snapshot, "priority-lens");
  assert.deepEqual(cards.map((card) => card.id), ["highest-risk", "oldest-quotes", "largest-need"]);
  assert.equal(cards.length, 3);
  assert.equal(cards[0].clients[0].clientId, "needs-review");
  assert.equal(cards[1].clients[0].clientId, "quoted-open");
  assert.equal(cards[2].clients[0].estimatedValue, 49500);
  assert.equal(cards.every((card) => card.stats.length <= 3), true);
});

test("Phase 3 renders exactly three equal primary cards with one shared flip state", () => {
  const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
  const dashboard = fs.readFileSync(new URL("../src/components/project-coverage-dashboard.tsx", import.meta.url), "utf8");
  const card = fs.readFileSync(new URL("../src/components/project-coverage-card.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(home, /buildProjectCoverageSnapshot/);
  assert.match(home, /ProjectCoverageDashboard/);
  assert.match(dashboard, /useState<ProjectCoverageCardId \| null>/);
  assert.match(dashboard, /flippedCard === metric\.id/);
  assert.match(card, /Needs Client Review|metric\.title/);
  assert.match(card, /Flip for details/);
  assert.match(card, /View clients/);
  assert.match(css, /\.project-coverage-dashboard\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css, /\.project-coverage-card\.is-flipped .*rotateY\(180deg\)/s);
});

test("Phase 14 current Settings configuration changes Project Coverage qualification, visibility, order, and available lenses", async () => {
  const { buildProjectCoverageSnapshot, projectCoverageCardsForSet, availableProjectCoverageCardSets, DEFAULT_COMPASS_CONFIG } = await runtime();
  const configured = structuredClone(DEFAULT_COMPASS_CONFIG);
  configured.coverage.minimumWorkstations = 4;
  configured.coverage.primaryCardOrder = ["quoted-open", "needs-review", "discussed-open"];
  configured.coverage.hiddenCardIds = ["discussed-open"];
  configured.coverage.priorityLensEnabled = false;
  configured.coverage.defaultCardSet = "client-project-coverage";
  const snapshot = buildProjectCoverageSnapshot(datasetFixture(), configured, new Date("2026-08-06T12:00:00.000Z"));
  assert.equal(snapshot.clients.some((item) => item.clientId === "small-refresh"), true, "the current workstation minimum setting must change qualification");
  const cards = projectCoverageCardsForSet(snapshot, "client-project-coverage", configured);
  assert.deepEqual(cards.map((card) => card.id), ["quoted-open", "needs-review"]);
  assert.deepEqual(availableProjectCoverageCardSets(configured).map((item) => item.id), ["client-project-coverage"]);
});
