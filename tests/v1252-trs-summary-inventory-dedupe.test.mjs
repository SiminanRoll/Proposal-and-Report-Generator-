import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("standard TRS packets are parsed before generic natural-heading prompts", () => {
  const tailored = source("src/lib/review-outcomes/tailored-prompt.ts");
  assert.match(tailored, /const TRS_SECTION_LABELS = \[/);
  assert.match(tailored, /environment \/ key findings/);
  assert.match(tailored, /buying signals \/ concerns/);
  assert.match(tailored, /function parseTrsPrompt\(/);
  assert.match(tailored, /parseJsonPrompt\(cleaned\) \?\? parseTrsPrompt\(cleaned\) \?\? parseNaturalPrompt\(cleaned\)/);
  assert.match(tailored, /executiveSummary: executiveSummary \|\| meetingSummary/);
  assert.match(tailored, /!\/\\brecommended\\b\/i\.test\(item\)/);
});

test("PDF inventory sync removes the older repeated radar-device packet", () => {
  const inventory = source("src/lib/outcomes/pdf-inventory-sync.ts");
  assert.match(inventory, /LEGACY_RADAR_PAGE_PATTERN/);
  assert.match(inventory, /function removeLegacyRadarDevicePackets\(/);
  assert.match(inventory, /pdf-page pdf-focus-page pdf-inventory-page/);
  assert.match(inventory, /const deduped = removeLegacyRadarDevicePackets\(withPages\)/);
  assert.match(inventory, /return removeLegacyRadarDevicePackets\(html\)/);
});
