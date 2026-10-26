import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const base = {
  totalAssets: 12, physicalAssets: 11, virtualAssets: 1,
  healthyNow: 1, planSoon: 5, replaceNow: 5, ageToVerify: 0,
  osAttention: 4, storageAttention: 0, storageReported: 12,
};
async function generate(input) {
  const mod = await transpileTestModule("../src/lib/outcomes/hardware-inventory-narrative.ts", import.meta.url);
  return mod.hardwareInventoryNarrative(input);
}
test("summarizes actual priorities and reconciles virtual inventory", async () => {
  const r = await generate(base);
  assert.equal(r.title, "Hardware health & replacement priorities");
  assert.match(r.subtitle, /5 of 11 physical devices are at or beyond/);
  assert.match(r.subtitle, /5 additional devices are approaching/);
  assert.match(r.subtitle, /4 devices have operating-system support concerns/);
  assert.match(r.subtitle, /Reported storage capacity shows no current concerns/);
  assert.match(r.subtitle, /1 virtual machine is included in the 12-asset inventory/);
  assert.doesNotMatch(r.subtitle, /select a summary|priority devices appear first|tracked separately/i);
});
test("healthy equipment does not invent priorities", async () => {
  const r = await generate({ ...base, totalAssets: 3, physicalAssets: 3, virtualAssets: 0,
    healthyNow: 3, replaceNow: 0, planSoon: 0, osAttention: 0, storageReported: 0 });
  assert.match(r.subtitle, /3 of 3 physical devices are within/);
  assert.doesNotMatch(r.subtitle, /virtual|support concerns|storage-capacity attention/);
});
test("unknown ages and capacity issues are reported rather than hidden", async () => {
  const r = await generate({ ...base, totalAssets: 2, physicalAssets: 2, virtualAssets: 0,
    healthyNow: 0, replaceNow: 0, planSoon: 0, ageToVerify: 2,
    osAttention: 0, storageAttention: 1, storageReported: 1 });
  assert.match(r.subtitle, /Equipment-age status for 2 devices still needs/);
  assert.match(r.subtitle, /age of 2 physical devices still needs verification/);
  assert.match(r.subtitle, /1 device needs storage-capacity attention/);
});
test("virtual-only and empty inventory make no unverified physical health claims", async () => {
  const v = await generate({ ...base, totalAssets: 2, physicalAssets: 0, virtualAssets: 2,
    healthyNow: 0, replaceNow: 0, planSoon: 0, osAttention: 0, storageReported: 0 });
  assert.match(v.subtitle, /2 virtual machines are included/);
  assert.doesNotMatch(v.subtitle, /physical devices are within/);
  const e = await generate({ ...base, totalAssets: 0, physicalAssets: 0, virtualAssets: 0 });
  assert.match(e.subtitle, /inventory is not yet available/);
});
test("both presentation paths use one narrative and remove template instructions", () => {
  const screen = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
  const exported = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
  assert.match(screen, /hardwareInventoryNarrative/);
  assert.match(exported, /hardwareInventoryNarrative/);
  assert.match(screen, /hardwareNarrative\.subtitle/);
  assert.match(exported, /hardwareNarrative\.subtitle/);
  assert.doesNotMatch(screen, /The devices behind the health score/);
  assert.doesNotMatch(exported, /Select a summary to filter the table/);
});
