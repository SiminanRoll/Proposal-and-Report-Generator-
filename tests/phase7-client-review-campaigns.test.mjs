import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function runtime() {
  return transpileTestModule("../src/lib/compass/review-campaigns.ts", import.meta.url, { prefix: "client-compass-phase7" });
}

function outcome(status = "not-reviewed", dispositions = [], quoted = false) {
  return {
    status,
    reviewedAt: status === "not-reviewed" ? "" : "2026-08-01",
    meetingSummary: status === "not-reviewed" ? "" : "Review completed.",
    agreedNextStep: "",
    reportTitle: "Technology Review",
    executiveSummary: "",
    items: dispositions.map((disposition, index) => ({
      id: `item-${index}`,
      title: disposition,
      technicalFinding: "",
      disposition,
      clientFacingNote: "",
      internalNote: "",
      responsibleParty: "",
      clientResponsibility: "",
      advantageResponsibility: "",
      targetDate: "",
      quoted,
      includeInReport: true,
      deviceIds: [],
      locationIds: [],
    })),
    lastUpdatedAt: "2026-08-01T12:00:00.000Z",
  };
}

function client(overrides = {}) {
  return {
    id: "client-1",
    name: "Example Dental",
    aliases: [],
    primaryContact: "Anne",
    primaryContactRole: "Office Manager",
    primaryContactEmail: "anne@example.com",
    primaryContactPhone: "",
    assignedOwner: "Patric",
    lastAccountReview: "",
    lastSalesInteraction: "",
    lastQuoteDate: "",
    quoted: false,
    nextFollowUp: "",
    workflowStatus: "",
    internalNote: "",
    reviewOutcome: outcome(),
    lastDataRefresh: "2026-08-05",
    ...overrides,
  };
}

function row(clientValue, value = 10000, devices = 2) {
  return {
    client: clientValue,
    opportunity: { clientId: clientValue.id, cardCategory: "critical-server", affectedDeviceIds: ["a", "b"], drivers: [], estimatedValue: value, confidence: "high", assumptionKeys: [] },
    affectedDeviceCount: devices,
  };
}

test("campaign health separates served, follow-through, and review-needed clients", async () => {
  const { campaignHealthForClient } = await runtime();

  assert.equal(campaignHealthForClient(client({ lastAccountReview: "2026-08-01", quoted: true, lastQuoteDate: "2026-08-03" })).health, "served");
  assert.equal(campaignHealthForClient(client({ lastAccountReview: "2026-08-01", reviewOutcome: outcome("confirmed", ["monitor"]) })).health, "served", "a documented no-quote outcome is healthy");
  assert.equal(campaignHealthForClient(client({ lastAccountReview: "2026-08-01" })).health, "follow-through");
  assert.equal(campaignHealthForClient(client({ quoted: true })).health, "follow-through", "quote history without review history needs cleanup rather than a new review");
  assert.equal(campaignHealthForClient(client()).health, "review-needed");
});

test("campaign metrics change count, value, and affected devices by health segment", async () => {
  const { campaignHealthMetrics } = await runtime();
  const rows = [
    row(client({ id: "served", lastAccountReview: "2026-08-01", quoted: true }), 12000, 2),
    row(client({ id: "yellow", lastAccountReview: "2026-07-15" }), 8000, 3),
    row(client({ id: "red" }), 5000, 1),
  ];
  const metrics = new Map(campaignHealthMetrics(rows).map((metric) => [metric.health, metric]));
  assert.deepEqual(metrics.get("all"), { health: "all", count: 3, value: 25000, affectedDeviceCount: 6 });
  assert.deepEqual(metrics.get("served"), { health: "served", count: 1, value: 12000, affectedDeviceCount: 2 });
  assert.deepEqual(metrics.get("follow-through"), { health: "follow-through", count: 1, value: 8000, affectedDeviceCount: 3 });
  assert.deepEqual(metrics.get("review-needed"), { health: "review-needed", count: 1, value: 5000, affectedDeviceCount: 1 });
});

test("campaign queue provides clickable health filtering and fast relationship-history entry", () => {
  const queue = readFileSync("src/components/compass-client-queue.tsx", "utf8");
  assert.match(queue, /compass-campaign-health-bar/);
  assert.match(queue, /setHealthFilter\(health\)/);
  assert.match(queue, /selectedValue/);
  assert.match(queue, /Update History/);
  assert.match(queue, /Last sales interaction|Sales interaction/);
  assert.match(queue, /Quote date/);
  assert.match(queue, /Review need first/);
});

test("client workspace is a streamlined account-review view and keeps technical detail secondary", () => {
  const entry = readFileSync("src/components/compass-client-workspace.tsx", "utf8");
  const workspace = readFileSync("src/components/compass-client-review-workspace-v10941.tsx", "utf8");
  assert.match(entry, /CompassClientReviewWorkspaceV10941/);
  assert.match(workspace, /Client Review/);
  assert.match(workspace, /Technology picture & review outcome/);
  assert.match(workspace, /Latest activity/);
  assert.match(workspace, /Technical details/);
  assert.match(workspace, /contactOpen/);
  assert.match(workspace, /reviewEditorOpen/);
  assert.doesNotMatch(workspace, /Next follow-up/);
  assert.doesNotMatch(workspace, /Last sales interaction/);
  assert.doesNotMatch(workspace, /Relationship status/);
  assert.doesNotMatch(workspace, /Explainable estimates/);
  assert.doesNotMatch(workspace, /Generate Potential Client Proposal/);
  assert.doesNotMatch(workspace, /Modernize Existing Proposal/);
});
