import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/prospects/a360-service-coverage.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const { a360ServiceCoverage } = module.exports;

const discovery = (changes = {}) => ({
  contactName: "Example Contact", organizationName: "Example Practice", organizationLanguage: "practice", industry: "Dental",
  priorities: ["Better support"], workstations: 14, server: "yes", locations: 1,
  managementSoftware: "Example Management", imagingSoftware: "Example Imaging", imagingEnvironment: "2D + 3D",
  otherSoftware: "Example Accounting; Example Cloud", ...changes,
});

test("coverage describes the sized environment and complete core service without changing input", () => {
  const input = discovery();
  const before = structuredClone(input);
  const coverage = a360ServiceCoverage(input);
  assert.deepEqual(input, before);
  assert.equal(coverage.environmentSummary, "14 workstations · 1 location · 1 onsite server");
  assert.match(coverage.services.find((row) => row.key === "workstations").detail, /14 workstations.*routine operating-system and security patches/);
  assert.match(coverage.services.find((row) => row.key === "network").detail, /1 location/);
  assert.match(coverage.services.find((row) => row.key === "server").detail, /1 onsite server.*standard backup/);
  assert.ok(coverage.services.some((row) => row.title === "Unlimited remote diagnostics"));
  assert.ok(coverage.services.some((row) => row.key === "security"));
  assert.doesNotMatch(JSON.stringify(coverage), /\$|CloudPlus|firewall subscription|Microsoft 365|software licenses included/);
  assert.match(coverage.scopeNote, /Onboarding, onsite work, hardware, projects and third-party subscriptions are quoted separately/);
});

test("software scope retains the saved application names and does not substitute license entitlements", () => {
  const coverage = a360ServiceCoverage(discovery({ managementSoftware: "Example <Suite> & Co" }));
  assert.deepEqual(coverage.software.map((row) => row.title), ["Example <Suite> & Co", "Example Imaging", "Example Accounting; Example Cloud"]);
  assert.ok(coverage.software.every((row) => /Technical support and vendor coordination/.test(row.detail)));
  assert.match(coverage.software.find((row) => row.key === "imaging-software").detail, /2D \+ 3D/);
});

test("a practice without a server is not promised server management or server backup", () => {
  const coverage = a360ServiceCoverage(discovery({ server: "no" }));
  assert.ok(!coverage.services.some((row) => row.key === "server"));
  assert.doesNotMatch(JSON.stringify(coverage.services), /standard backup|onsite server/);
  assert.match(coverage.environmentSummary, /No onsite server/);
  assert.equal(coverage.serverNote, "");
});

test("unknown server and missing software remain explicit unknowns", () => {
  const coverage = a360ServiceCoverage(discovery({
    server: "not-sure", workstations: 0, locations: Number.NaN,
    managementSoftware: "", imagingSoftware: "", imagingEnvironment: "Not sure", otherSoftware: "",
  }));
  assert.ok(!coverage.services.some((row) => row.key === "server"));
  assert.deepEqual(coverage.software, []);
  assert.match(coverage.serverNote, /scope will be confirmed/);
  assert.match(coverage.environmentSummary, /Workstation count to confirm · Location count to confirm · Server details to confirm/);
  assert.doesNotMatch(JSON.stringify(coverage), /NaN|undefined|0 workstations/);
});

test("known imaging type can be represented without inventing an application vendor", () => {
  const coverage = a360ServiceCoverage(discovery({ imagingSoftware: "", imagingEnvironment: "2D + 3D" }));
  const row = coverage.software.find((item) => item.key === "imaging-environment");
  assert.equal(row.title, "2D + 3D imaging");
  assert.match(row.detail, /application name to confirm/);
});

test("lifecycle planning remains opt-in while ongoing technology guidance is always visible", () => {
  const normal = a360ServiceCoverage(discovery()).services.find((row) => row.key === "guidance");
  const optedIn = a360ServiceCoverage(discovery(), { includeLifecyclePlanning: true }).services.find((row) => row.key === "guidance");
  assert.doesNotMatch(normal.detail, /lifecycle/i);
  assert.match(normal.detail, /Technology Consultant guidance/);
  assert.match(optedIn.detail, /lifecycle planning/);
  assert.doesNotMatch(normal.slideDetail, /lifecycle/i);
  assert.match(optedIn.slideDetail, /lifecycle planning/);
});
