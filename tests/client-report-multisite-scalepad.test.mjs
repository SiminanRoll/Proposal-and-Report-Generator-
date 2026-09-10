import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const intelligence = fs.readFileSync(new URL("../src/lib/intelligence/client.ts", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const sourceUpload = fs.readFileSync(new URL("../src/components/source-upload-card.tsx", import.meta.url), "utf8");
const templates = fs.readFileSync(new URL("../src/lib/projects/templates.ts", import.meta.url), "utf8");
const appVersion = fs.readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("multiple ScalePad PDFs are treated as distinct site inventories", () => {
  assert.match(intelligence, /mergedMultiSiteLifecycleFacts/);
  assert.match(intelligence, /const pdfSources = lifecycleSources\.filter/);
  assert.match(intelligence, /if \(pdfSources\.length < 2\) return null/);
  assert.match(intelligence, /location: siteLabel \|\| `Site \$\{sourceIndex \+ 1\}`/);
  assert.match(intelligence, /sourceDeviceId: `\$\{group\.file\.id\}:\$\{rawIdentity\}`/);
  assert.match(intelligence, /scalepad\.multiSite/);
  assert.match(intelligence, /scalepad\.multiSitePdfCount/);
});

test("connected Client Compass inventory can accept an explicit second ScalePad site", () => {
  assert.match(intelligence, /const authoritativeSource = lifecycleSources\.find/);
  assert.match(intelligence, /mergeTechnicalInventory\(baseInventory, sourceGroups\.map/);
  assert.match(intelligence, /if \(groupIndex === 0\) continue/);
  assert.match(intelligence, /authoritative: true/);
  assert.match(intelligence, /The combined site inventory/);
  assert.match(intelligence, /authoritativeInventory && !multiSiteInventory/);
});

test("multi-site lifecycle totals and location snapshots are combined for report consumers", () => {
  for (const key of [
    "scalepad.totalAssets",
    "scalepad.servers",
    "scalepad.workstations",
    "scalepad.replacement.overdue",
    "scalepad.os.unsupported",
    "compass.locationSnapshots",
  ]) {
    assert.match(intelligence, new RegExp(key.replaceAll(".", "\\.")));
  }
  assert.match(intelligence, /Combined managed inventory with/);
  assert.match(intelligence, /Combined across/);
});

test("Client Report source intake visibly exposes Site 1 and an optional second-site PDF", () => {
  assert.match(templates, /ScalePad lifecycle reports/);
  assert.match(templates, /second ScalePad PDF/);
  assert.match(sourceUpload, /MultiSiteScalePadUpload/);
  assert.match(sourceUpload, /Site 1 · Primary location/);
  assert.match(sourceUpload, /Site 2 · Second location/);
  assert.match(sourceUpload, /Add second site/);
  assert.match(sourceUpload, /accept="\.pdf,application\/pdf"/);
  assert.match(sourceUpload, /Both hardware sets will stay separated by location/);
});

test("existing presentation and PDF location renderers consume the generated site snapshots", () => {
  assert.match(experience, /function LocationPresentation/);
  assert.match(experience, /const locations = compassLocationSnapshots\(project\)/);
  assert.match(experience, /Each site stays distinct/);
  assert.match(exportHtml, /const locationLabels = locationSnapshots\.length/);
  assert.match(exportHtml, /const locationGroups = locationLabels\.map/);
  assert.match(exportHtml, /locationGroups\.length > 1/);
});

test("single-site and authoritative enrichment paths remain available when only one PDF is attached", () => {
  assert.match(intelligence, /const enrichmentGroups = lifecycleSources\.slice\(1\)/);
  assert.match(intelligence, /mergeTechnicalInventory\(baseInventory, enrichmentGroups\)/);
  assert.match(intelligence, /Ninja \/ Client Compass remains authoritative/);
});

test("v1.2.92 is visible in the application version and package metadata", () => {
  assert.match(appVersion, /APP_VERSION = "1\.2\.92"/);
  assert.equal(packageJson.version, "1.2.92");
});
