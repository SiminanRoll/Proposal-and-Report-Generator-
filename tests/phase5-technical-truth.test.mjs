import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTechnicalTruthForTest, transpileTestModule } from "./test-transpile-helper.mjs";

async function loadAdapters() {
  return transpileTestModule("../src/lib/intelligence/browser/report-adapters.ts", import.meta.url, { prefix: "phase5-adapters" });
}

async function loadIntelligence() {
  return transpileTestModule("../src/lib/intelligence/client.ts", import.meta.url, {
    prefix: "phase5-intelligence",
    replacements: {
      'import { enableHipaaAssessment } from "@/lib/hipaa/engine";': "const enableHipaaAssessment = (value) => value;",
      'import { normalizeProposalProject, replaceA360MonthlyDefaults } from "@/lib/proposals/pricing";': "const normalizeProposalProject = (value) => value; const replaceA360MonthlyDefaults = (value) => value;",
    },
  });
}

function extractedFact(key, value, sourceFileId, confidence = "high", category = "lifecycle") {
  return { id: `${sourceFileId}-${key}`, key, label: key, value, category, confidence, sourceFileId, evidence: `${sourceFileId} evidence` };
}

function analysis(sourceType, sourceFileId, facts) {
  return {
    sourceType,
    confidence: "high",
    title: sourceFileId,
    summary: `${sourceType} source`,
    facts,
    findingCandidates: [],
    highlights: [],
    warnings: [],
    rawTextPreview: "",
    analyzedAt: "2026-08-05T12:00:00.000Z",
  };
}

function fileRecord(id, name, mimeType, sourceType, facts) {
  return {
    id,
    name,
    mimeType,
    size: 1,
    addedAt: "2026-08-05T12:00:00.000Z",
    status: "processed",
    analysis: analysis(sourceType, id, facts),
  };
}

test("shared technical truth centralizes VM, OS, lifecycle, storage, warranty, and server urgency", async () => {
  const truth = await loadTechnicalTruthForTest();
  assert.equal(truth.TECHNICAL_TRUTH_VERSION, 1);

  const googleVm = truth.classifyTechnicalDevice({
    name: "GCE-APP-01",
    model: "Google Compute Engine",
    os: "Windows Server 2022 Standard",
  });
  assert.equal(googleVm.deviceType, "virtual-server");
  assert.equal(googleVm.virtualizationPlatform, "Google Compute Engine");

  const ec2Vm = truth.classifyTechnicalDevice({ model: "HVM domU", os: "Windows 11 Pro" });
  assert.equal(ec2Vm.deviceType, "virtual-workstation");
  assert.equal(ec2Vm.virtualizationPlatform, "Amazon EC2");

  assert.equal(truth.classifyTechnicalOsSupport("Microsoft Windows 10 Pro"), "unsupported");
  assert.equal(truth.classifyTechnicalOsSupport("Microsoft Windows Server 2016 Standard"), "ending-soon");
  assert.equal(truth.classifyTechnicalWarranty("2025-01-01", new Date("2026-08-05T12:00:00Z")), "out-of-warranty");

  const lifecycle = truth.classifyTechnicalLifecycle({
    deviceType: "physical-server",
    model: "Dell PowerEdge T340",
    ageYears: 6.2,
    warrantyEnd: "2025-01-01",
  }, undefined, new Date("2026-08-05T12:00:00Z"));
  assert.equal(lifecycle, "replace-now");

  const summary = truth.technicalStorageSummary('Name: "C:"/ Type: "Local Disk"/ Capacity: "252878778368 (235.5 GiB)"/ Usage %: "91%"', undefined, "physical-workstation");
  assert.equal(summary.summary, "C: 214.3 / 235.5 GB (91%)");
  assert.equal(summary.percent, 91);
  assert.equal(truth.classifyTechnicalStorage({ storageUsage: summary.summary, storagePercent: summary.percent, storageFreeGb: summary.freeGb }, undefined, "physical-workstation"), "critical");
  assert.equal(truth.classifyTechnicalServerUrgency({ deviceType: "physical-server", os: "Windows Server 2022", lifecycle, storage: "healthy" }), "critical");
});

test("managed lifecycle enrichment cannot change authoritative Ninja or Compass technical fields", async () => {
  const { mergeTechnicalInventory } = await loadTechnicalTruthForTest();
  const authoritative = [{
    sourceDeviceId: "ninja-001",
    sourceDeviceName: "FRONT-01",
    name: "FRONT-01",
    serial: "ABC123",
    make: "Dell",
    model: "OptiPlex 7010",
    os: "Windows 11 Pro",
    storage: "C: 100 / 250 GB (40%)",
    age: 0,
    purchased: "",
    warrantyExpires: "",
    sourceDetails: { identity: "Ninja / Client Compass", os: "Ninja / Client Compass", storage: "Ninja / Client Compass" },
  }];
  const enrichment = [{
    sourceDeviceId: "different-id",
    name: "RENAMED-BY-LIFECYCLE",
    serial: "ABC123",
    make: "Other",
    model: "Conflicting model",
    os: "Windows 10 Pro",
    storage: "C: 245 / 250 GB (98%)",
    age: 7.4,
    purchased: "2019-02-01",
    warrantyExpires: "2024-02-01",
  }];

  const result = mergeTechnicalInventory(authoritative, [{ label: "ScalePad lifecycle", inventory: enrichment }]);
  assert.equal(result.inventory.length, 1);
  assert.equal(result.enrichedDevices, 1);
  assert.equal(result.unmatchedEnrichment.length, 0);
  assert.equal(result.inventory[0].sourceDeviceId, "ninja-001");
  assert.equal(result.inventory[0].name, "FRONT-01");
  assert.equal(result.inventory[0].make, "Dell");
  assert.equal(result.inventory[0].model, "OptiPlex 7010");
  assert.equal(result.inventory[0].os, "Windows 11 Pro");
  assert.equal(result.inventory[0].storage, "C: 100 / 250 GB (40%)");
  assert.equal(result.inventory[0].age, 7.4);
  assert.equal(result.inventory[0].purchased, "2019-02-01");
  assert.equal(result.inventory[0].warrantyExpires, "2024-02-01");
  assert.equal(result.inventory[0].sourceDetails.lifecycle, "ScalePad lifecycle");
  assert.equal(result.inventory[0].sourceDetails.warranty, "ScalePad lifecycle");
});

test("RFT technical findings outrank older proposal content while proposal scope and pricing remain available", async () => {
  const { buildProjectIntelligence, environmentFromIntelligence } = await loadIntelligence();
  const rft = fileRecord("rft", "Current RFT.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "rft", [
    extractedFact("environment.totalComputers", 18, "rft", "medium"),
    extractedFact("technical.source.primary", "RFT assessment", "rft"),
  ]);
  const proposal = fileRecord("proposal", "Older Proposal.pdf", "application/pdf", "legacy-proposal", [
    extractedFact("environment.totalComputers", 11, "proposal", "high"),
    extractedFact("pricing.monthly", 2200, "proposal", "high", "pricing"),
  ]);
  const sources = [{ id: "technical", kind: "rft", label: "RFT", required: true, multiple: true, acceptedExtensions: [".xlsx", ".pdf"], files: [proposal, rft], status: "processed" }];
  const result = buildProjectIntelligence({ type: "legacy-modernization", sources, painPoints: ["Current proposal update"] });

  assert.equal(result.facts.find((item) => item.key === "environment.totalComputers")?.value, 18);
  assert.equal(result.facts.find((item) => item.key.startsWith("environment.totalComputers.") && item.value === 11)?.value, 11);
  assert.equal(result.facts.find((item) => item.key === "pricing.monthly")?.value, 2200);
  assert.equal(result.facts.find((item) => item.key === "technical.source.primary")?.value, "RFT assessment");
  assert.equal(environmentFromIntelligence(result)["environment.totalComputers"], 18);
});

test("RFT inventory keeps locations and field provenance without introducing Phase 6 UI", async () => {
  const { parseDeviceInventoryExport } = await loadAdapters();
  const result = parseDeviceInventoryExport([
    { Device: "MAIN-PC", Organization: "Sample Practice", Location: "Main Office", "OS Name": "Windows 11 Pro", "Device Model": "Dell OptiPlex 7010", "Warranty Start Date": "2024-01-01" },
    { Device: "NORTH-PC", Organization: "Sample Practice", Location: "North Office", "OS Name": "Windows 10 Pro", "Device Model": "Dell OptiPlex 7060", "Warranty Start Date": "2018-01-01" },
  ], "rft", "Current RFT.xlsx", { sourceKind: "rft", sourceLabel: "RFT assessment", authoritative: true });
  const facts = Object.fromEntries(result.facts.map((item) => [item.key, item.value]));
  const inventory = facts["scalepad.inventory"].map((entry) => JSON.parse(entry));

  assert.equal(result.sourceType, "rft");
  assert.deepEqual(facts["scalepad.locations"], ["Main Office", "North Office"]);
  assert.equal(facts["technical.source.inventory"], "RFT assessment");
  assert.equal(facts["technical.source.warranty"], "RFT assessment");
  assert.deepEqual(inventory.map((item) => item.location), ["Main Office", "North Office"]);
  assert.ok(inventory.every((item) => item.sourceDetails.identity === "RFT assessment"));

  const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /location-specific\s+(?:view|selector)|multisite project packaging/i);
});

test("Phase 5 routes every output path through shared technical truth and preserves approved report controls", () => {
  const files = [
    "../src/lib/compass/engine.ts",
    "../src/lib/compass/generator-bridge.ts",
    "../src/lib/intelligence/browser/report-adapters.ts",
    "../src/lib/intelligence/client.ts",
    "../src/lib/outcomes/client-report-data.ts",
  ];
  for (const relative of files) {
    const source = fs.readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /technical-truth/, `${relative} should use the shared technical truth layer`);
  }

  const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Technical source precedence/);
  assert.doesNotMatch(workspace, /Generate Proposal/);

  const repository = [
    fs.readFileSync(new URL("../src/lib/review-outcomes/types.ts", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../src/lib/hipaa/engine.ts", import.meta.url), "utf8"),
  ].join("\n");
  assert.match(repository, /client-purchased|client already purchased|client-purchased equipment/i);
  assert.match(repository, /retire-decommission|retire and decommission/i);
  assert.match(repository, /onsite/i);
  assert.match(repository, /remote/i);
  assert.match(repository, /HIPAA Readiness/i);
});
