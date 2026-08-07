import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/components/project-coverage-dashboard.tsx", import.meta.url), "utf8");
const card = fs.readFileSync(new URL("../src/components/project-coverage-card.tsx", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const filters = fs.readFileSync(new URL("../src/components/project-coverage-filters.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function coverageClient(overrides = {}) {
  return {
    clientId: "client",
    clientName: "Client",
    position: "needs-review",
    projects: [],
    estimatedValue: 10000,
    serverProjectCount: 0,
    workstationProjectCount: 1,
    workstationDeviceCount: 5,
    hasCriticalServer: false,
    technicalSeverity: 1,
    reviewDate: "",
    quoteDate: "",
    quoteAgeBand: "date-missing",
    nextFollowUp: "",
    followUpPastDue: false,
    reviewHistoryMissing: true,
    missingDocumentedOutcome: true,
    noRelationshipHistory: false,
    hasUnsupportedSystems: false,
    attentionReason: "Five aging workstations",
    priorityReason: "Five aging workstations with no review or quote recorded",
    ...overrides,
  };
}

test("Phase 4 defaults to Needs Client Review and renders the selected list inline", () => {
  assert.match(home, /useState<ProjectCoveragePosition>\("needs-review"\)/);
  assert.match(home, /<ProjectCoverageClientList card=\{activeCoverageCard\}/);
  assert.doesNotMatch(home, /<ProjectCoverageClientQueue/);
  assert.match(dashboard, /selectedPosition=\{activeCoveragePosition\}|selectedPosition: ProjectCoveragePosition/);
  assert.match(card, /Show clients/);
  assert.match(card, /Flip for details/);
  assert.match(card, /aria-pressed=\{selected\}/);
  assert.match(css, /\.project-coverage-client-list\{/);
  assert.match(home, /prefers-reduced-motion: reduce/);
});

test("Phase 4 client list includes approved columns filters and five-client initial limit", () => {
  assert.match(list, /const INITIAL_CLIENT_COUNT = 5/);
  for (const heading of ["Client", "Project need", "Why they need attention", "Last activity", "Estimated value", "Action"]) {
    assert.match(list, new RegExp(heading));
  }
  for (const label of ["All project needs", "Server projects", "5+ workstations", "Unsupported systems"]) {
    assert.equal(filters.includes(label), true);
  }
  assert.match(list, /View all \$\{filteredClients\.length\} clients/);
  assert.match(list, /onOpenClient\(client\.clientId\)/);
});

test("coverage sorting follows the card-specific service priority rules", async () => {
  const { compareCoverageClients } = await transpileTestModule("../src/lib/compass/project-coverage-priority.ts", import.meta.url, { prefix: "phase4-priority" });

  const critical = coverageClient({ clientId: "critical", clientName: "Critical", hasCriticalServer: true, serverProjectCount: 1, technicalSeverity: 3 });
  const server = coverageClient({ clientId: "server", clientName: "Server", serverProjectCount: 1, technicalSeverity: 2 });
  const workstations = coverageClient({ clientId: "workstations", clientName: "Workstations" });
  assert.deepEqual([workstations, server, critical].sort((a, b) => compareCoverageClients("needs-review", a, b)).map((client) => client.clientId), ["critical", "server", "workstations"]);

  const recent = coverageClient({ clientId: "recent", clientName: "Recent", position: "quoted-open", quoteAgeBand: "recent", quoteDate: "2026-07-01", reviewHistoryMissing: false });
  const missingReview = coverageClient({ clientId: "missing", clientName: "Missing", position: "quoted-open", quoteAgeBand: "follow-up", quoteDate: "2026-03-01", reviewHistoryMissing: true });
  const old = coverageClient({ clientId: "old", clientName: "Old", position: "quoted-open", quoteAgeBand: "revisit", quoteDate: "2025-01-01", reviewHistoryMissing: false });
  assert.deepEqual([recent, missingReview, old].sort((a, b) => compareCoverageClients("quoted-open", a, b)).map((client) => client.clientId), ["old", "missing", "recent"]);
});
