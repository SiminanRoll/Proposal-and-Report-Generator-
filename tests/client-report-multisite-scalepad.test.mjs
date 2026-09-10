import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const intelligence = fs.readFileSync(new URL("../src/lib/intelligence/client.ts", import.meta.url), "utf8");
const experience = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");

test("multiple ScalePad PDFs are treated as distinct site inventories", () => {
  assert.match(intelligence, /mergedMultiSiteLifecycleFacts/);
  assert.match(intelligence, /lifecycleSources\.length < 2/);
  assert.match(intelligence, /lifecycleSources\.every\(\(\{ file \}\) => isPdfLifecycleFile\(file\)\)/);
  assert.match(intelligence, /location: String\(device\.location \?\? ""\)\.trim\(\) \|\| siteLabel/);
  assert.match(intelligence, /sourceDeviceId: `\$\{file\.id\}:\$\{rawIdentity\}`/);
  assert.match(intelligence, /scalepad\.multiSite/);
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
  assert.match(intelligence, /Combined across \$\{locations\.length\} ScalePad site reports/);
});

test("existing presentation and PDF location renderers consume the generated site snapshots", () => {
  assert.match(experience, /function LocationPresentation/);
  assert.match(experience, /const locations = compassLocationSnapshots\(project\)/);
  assert.match(experience, /Each site stays distinct/);
  assert.match(exportHtml, /const locationLabels = locationSnapshots\.length/);
  assert.match(exportHtml, /const locationGroups = locationLabels\.map/);
  assert.match(exportHtml, /locationGroups\.length > 1/);
});

test("single-site and authoritative Compass enrichment paths remain available", () => {
  assert.match(intelligence, /if \(!authoritativeBase\) \{[\s\S]*mergedMultiSiteLifecycleFacts/);
  assert.match(intelligence, /const enrichmentGroups = lifecycleSources\.slice\(1\)/);
  assert.match(intelligence, /mergeTechnicalInventory\(baseInventory, enrichmentGroups\)/);
  assert.match(intelligence, /Ninja \/ Client Compass remains authoritative/);
});
