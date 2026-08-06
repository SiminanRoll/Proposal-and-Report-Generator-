import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function transpileModule(relativePath, options = {}) {
  return transpileTestModule(relativePath, import.meta.url, { prefix: "client-compass-phase6", ...options });
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
  return { ...config.module, ...projectPackaging.module, ...generator };
}

function volume(state = "healthy") {
  return {
    label: "C:",
    usedPercent: state === "critical" ? 95 : state === "watch" ? 85 : 50,
    usedGb: 50,
    totalGb: 100,
    freeGb: state === "critical" ? 5 : state === "watch" ? 15 : 50,
    isSystem: true,
    state,
    excludedReason: "",
  };
}

function device(id, locationId, type, overrides = {}) {
  const isVirtual = type.startsWith("virtual-");
  return {
    id,
    clientId: "client-1",
    locationId,
    name: id.toUpperCase(),
    organization: "Atlas Dental Group",
    deviceType: type,
    isVirtual,
    virtualizationPlatform: isVirtual ? "Hyper-V" : "",
    model: isVirtual ? "Virtual Machine" : "Dell OptiPlex",
    videoCard: "",
    osName: type.includes("server") ? "Microsoft Windows Server 2012 R2" : "Microsoft Windows 10 Pro",
    status: "Active",
    memoryGiB: 16,
    diskVolumeSource: "C: 50/100 GB (50%)",
    diskVolumes: [volume()],
    warrantyStart: "2018-01-01",
    warrantyEnd: "2024-01-01",
    lastUptime: "2026-08-05",
    lastLogin: "2026-08-05",
    lifecycle: "replace-now",
    source: "Ninja / Client Compass",
    ...overrides,
  };
}

function finding(id, deviceId, category, title, explanation) {
  return { id, clientId: "client-1", deviceId, category, severity: "high", title, explanation, scoreContribution: 4, valueCategory: "none" };
}

function fixture() {
  const devices = [
    device("server-1", "loc-downtown", "physical-server", { diskVolumes: [volume("critical")] }),
    device("vm-1", "loc-downtown", "virtual-server"),
    device("workstation-1", "loc-northside", "physical-workstation"),
    device("workstation-2", "loc-northside", "physical-workstation"),
    device("workstation-3", "loc-downtown", "physical-workstation"),
    device("generic-1", "loc-generic", "physical-workstation", { lifecycle: "current", osName: "Microsoft Windows 11 Pro" }),
  ];
  const findings = [
    finding("finding-server", "server-1", "server-2012", "Unsupported server operating system", "SERVER-1 is running Windows Server 2012 R2."),
    finding("finding-storage", "server-1", "critical-server-storage", "Critical server storage", "SERVER-1 has 5 GB free."),
    finding("finding-w1", "workstation-1", "replace-now", "Replace Now workstation", "WORKSTATION-1 is beyond lifecycle."),
    finding("finding-w2", "workstation-2", "replace-now", "Replace Now workstation", "WORKSTATION-2 is beyond lifecycle."),
    finding("finding-w3", "workstation-3", "replace-now", "Replace Now workstation", "WORKSTATION-3 is beyond lifecycle."),
    finding("finding-os1", "workstation-1", "windows-10-active", "Windows 10", "WORKSTATION-1 requires OS remediation."),
    finding("finding-os2", "workstation-2", "windows-10-active", "Windows 10", "WORKSTATION-2 requires OS remediation."),
    finding("finding-os3", "workstation-3", "windows-10-active", "Windows 10", "WORKSTATION-3 requires OS remediation."),
  ];
  const opportunities = [
    { clientId: "client-1", cardCategory: "critical-server", affectedDeviceIds: ["server-1"], drivers: ["Windows Server 2012 R2", "Critical storage"], estimatedValue: 52500, confidence: "high", assumptionKeys: ["server"] },
    { clientId: "client-1", cardCategory: "storage", affectedDeviceIds: ["server-1"], drivers: ["Critical server storage"], estimatedValue: 7500, confidence: "high", assumptionKeys: ["storage"] },
    { clientId: "client-1", cardCategory: "workstation-lifecycle", affectedDeviceIds: ["workstation-1", "workstation-2", "workstation-3"], drivers: ["Three Replace Now workstations"], estimatedValue: 8850, confidence: "high", assumptionKeys: ["workstations"] },
    { clientId: "client-1", cardCategory: "windows-10", affectedDeviceIds: ["workstation-1", "workstation-2", "workstation-3"], drivers: ["Three active Windows 10 devices"], estimatedValue: 8850, confidence: "high", assumptionKeys: ["windows10"] },
  ];
  return {
    schemaVersion: 1,
    calculationVersion: 5,
    calculationFingerprint: "phase6-fixture",
    calculatedAt: "2026-08-05T20:00:00.000Z",
    clients: [{
      id: "client-1",
      name: "Atlas Dental Group",
      aliases: [],
      primaryContact: "Anne",
      primaryContactRole: "Office Manager",
      primaryContactEmail: "anne@example.com",
      primaryContactPhone: "555-0100",
      assignedOwner: "Patric",
      lastAccountReview: "2026-08-05",
      quoted: false,
      nextFollowUp: "2026-08-12",
      workflowStatus: "Project planning",
      internalNote: "",
      reviewOutcome: {
        status: "confirmed",
        reviewedAt: "2026-08-05",
        meetingSummary: "The server will be retired and two client-purchased computers will be deployed.",
        agreedNextStep: "Verify server dependencies and schedule the computer deployment.",
        reportTitle: "Technology Review",
        executiveSummary: "The agreed project plan is organized by location.",
        items: [
          {
            id: "decision-retire",
            title: "Retire the legacy server",
            technicalFinding: "Windows Server 2012 R2 and critical storage",
            disposition: "retire-decommission",
            clientFacingNote: "Retire the server after dependencies are confirmed.",
            internalNote: "",
            responsibleParty: "Advantage + Client",
            clientResponsibility: "Confirm what data must be retained.",
            advantageResponsibility: "Verify dependencies and securely decommission the server.",
            targetDate: "August 2026",
            quoted: false,
            includeInReport: true,
            deviceIds: ["server-1"],
            locationIds: ["loc-downtown"],
          },
          {
            id: "decision-deploy",
            title: "Deploy client-purchased computers",
            technicalFinding: "Two replacement computers are already purchased.",
            disposition: "advantage-install-client-purchased",
            clientFacingNote: "Advantage will secure, configure, and connect the new computers.",
            internalNote: "",
            responsibleParty: "Advantage + Client",
            clientResponsibility: "Have both computers onsite.",
            advantageResponsibility: "Configure and deploy both computers.",
            targetDate: "Next week",
            quoted: true,
            includeInReport: true,
            deviceIds: ["workstation-1", "workstation-2"],
            locationIds: ["loc-northside"],
          },
        ],
        lastUpdatedAt: "2026-08-05T20:00:00.000Z",
      },
      lastDataRefresh: "2026-08-05T20:00:00.000Z",
    }],
    locations: [
      { id: "loc-downtown", clientId: "client-1", name: "Downtown" },
      { id: "loc-northside", clientId: "client-1", name: "Northside" },
      { id: "loc-generic", clientId: "client-1", name: "Main Location" },
    ],
    devices,
    findings,
    summaries: [{ clientId: "client-1", clientName: "Atlas Dental Group", priorityScore: 92, priorityTier: "Critical", topDrivers: ["Legacy server", "Aging workstations"], totalEstimatedValue: 61200, opportunities }],
    importedAt: "2026-08-05T19:00:00.000Z",
    importSourceName: "Ninja_Master.xlsx",
    importSummary: { totalRows: 6, organizationsDetected: 1, matchedOrganizations: 1, unmatchedOrganizations: 0, newOrganizations: 0, devicesDetected: 6, physicalServers: 1, virtualMachines: 1, workstations: 4, rejectedRows: 0, osConcerns: 4, storageConcerns: 1 },
  };
}

test("Phase 6 preserves real locations and suppresses generic location placeholders", async () => {
  const { buildCompassLocationSnapshots, isNamedCompassLocation } = await runtime();
  const snapshots = buildCompassLocationSnapshots(fixture(), "client-1");
  assert.deepEqual(snapshots.map((item) => item.name), ["Downtown", "Northside"]);
  assert.equal(isNamedCompassLocation("Main"), true);
  assert.equal(isNamedCompassLocation("Main Location"), false);
  assert.equal(isNamedCompassLocation("Location not specified"), false);
  const downtown = snapshots.find((item) => item.name === "Downtown");
  const northside = snapshots.find((item) => item.name === "Northside");
  assert.equal(downtown.physicalServers, 1);
  assert.equal(downtown.virtualServers, 1);
  assert.equal(downtown.physicalWorkstations, 1);
  assert.equal(downtown.storageAttention, 1);
  assert.deepEqual(new Set(downtown.decisionIds), new Set(["decision-retire"]));
  assert.equal(northside.physicalWorkstations, 2);
  assert.equal(northside.windows10, 2);
  assert.deepEqual(new Set(northside.decisionIds), new Set(["decision-deploy"]));
});

test("Phase 6 packages agreed work without double-counting devices", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildCompassProjectPackages, totalPackagedValue } = await runtime();
  const projects = buildCompassProjectPackages(fixture(), DEFAULT_COMPASS_CONFIG, "client-1");
  const retirement = projects.find((item) => item.id === "decision-retire");
  const deployment = projects.find((item) => item.id === "decision-deploy");
  const refresh = projects.find((item) => item.category === "workstation-refresh" && item.source === "technical-findings");
  const multisite = projects.find((item) => item.category === "multisite-rollout");

  assert.equal(retirement.estimatedValue, 0);
  assert.deepEqual(retirement.deviceIds, ["server-1"]);
  assert.equal(projects.some((item) => item.category === "server-replacement"), false, "a retirement decision must suppress generic server replacement value");
  assert.equal(deployment.estimatedValue, 990, "two deployment allowances plus configured contingency");
  assert.deepEqual(new Set(deployment.deviceIds), new Set(["workstation-1", "workstation-2"]));
  assert.equal(deployment.quoted, true);
  assert.deepEqual(refresh.deviceIds, ["workstation-3"]);
  assert.equal(refresh.estimatedValue, 3245, "one workstation modernization/deployment allowance plus contingency");
  assert.equal(projects.some((item) => item.category === "os-remediation"), false, "Windows 10 must merge into the already-valued workstation packages");
  assert.match(refresh.technicalDrivers.join(" "), /Windows 10/i);
  assert.deepEqual(new Set(multisite.locationIds), new Set(["loc-downtown", "loc-northside"]));
  assert.equal(multisite.estimatedValue, 5000);
  assert.equal(totalPackagedValue(projects), 9235);

  const valuedDeviceAppearances = new Map();
  for (const project of projects.filter((item) => item.estimatedValue > 0 && item.category !== "multisite-rollout")) {
    for (const id of project.deviceIds) valuedDeviceAppearances.set(id, (valuedDeviceAppearances.get(id) ?? 0) + 1);
  }
  assert.deepEqual([...valuedDeviceAppearances.values()], [1, 1, 1]);
});

test("managed-client generator facts carry location snapshots and grouped project packages", async () => {
  const { DEFAULT_COMPASS_CONFIG, buildCompassGeneratorPrefill } = await runtime();
  const prefill = buildCompassGeneratorPrefill(fixture(), "client-1", new Date("2026-08-05T21:00:00.000Z"), DEFAULT_COMPASS_CONFIG);
  assert.ok(prefill);
  const source = prefill.sourceRecords["scalepad-pdf"][0];
  const facts = new Map(source.analysis.facts.map((item) => [item.key, item.value]));
  assert.deepEqual(facts.get("scalepad.locations"), ["Downtown", "Northside"]);
  assert.equal(facts.get("compass.locationSnapshots").length, 2);
  assert.ok(facts.get("compass.projectPackages").length >= 4);
  const packages = facts.get("compass.projectPackages").map((value) => JSON.parse(value));
  assert.equal(packages.some((item) => item.category === "server-retirement"), true);
  assert.equal(packages.some((item) => item.category === "client-purchased-deployment"), true);
  const inventory = facts.get("scalepad.inventory").map((value) => JSON.parse(value));
  assert.equal(inventory.find((item) => item.sourceDeviceId === "generic-1").location, "");
  assert.match(source.analysis.summary, /2 reportable locations/);
  assert.match(source.analysis.summary, /grouped project packages/);
});

test("Phase 6 UI adds location/project packaging and keeps the homepage hierarchy focused", () => {
  const home = fs.readFileSync(new URL("../src/components/compass-home.tsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
  const presentation = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
  const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
  assert.match(home, />Update data</);
  assert.match(home, />Customize /);
  for (const label of ["Manage cards", "Scoring &amp; estimates", "Refresh calculations", "Calculations current"]) assert.match(home, new RegExp(label));
  assert.match(home, /compass-client-search-report/);
  assert.match(home, />Report<\/Link>/);
  assert.doesNotMatch(home, /Open report & proposal generator/);
  assert.match(workspace, /View the environment by site/);
  assert.match(workspace, /Grouped technology needs/);
  assert.match(workspace, /buildCompassProjectPackages/);
  assert.match(presentation, /LocationPresentation/);
  assert.match(presentation, /presentation-location-projects/);
  assert.match(presentation, /Location project plan/);
  assert.match(presentation, /presentation-project-package-grid/);
  assert.match(exportHtml, /locationPackets/);
  assert.match(exportHtml, /pdf-focus-page/);
  assert.match(exportHtml, /What to keep on your radar/);
  assert.match(exportHtml, /agreedSiteProjects/);
  assert.match(exportHtml, /actionContinuationPages/);
});
