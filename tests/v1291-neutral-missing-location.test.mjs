import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/outcomes/pdf-inventory-sync.ts", import.meta.url), "utf8");

test("missing inventory location stays internal and uses neutral client-facing copy", () => {
  assert.match(source, /const hasLocation = location !== UNASSIGNED_LOCATION/);
  assert.match(source, /const locationHeading = hasLocation \? `\$\{location\} device inventory` : "Device inventory"/);
  assert.match(source, /const locationSuffix = hasLocation \? ` · \$\{location\}` : ""/);
  assert.match(source, /const locationAttribute = hasLocation \? location : ""/);
  assert.match(source, /system\$\{locationCards\.length === 1 \? "" : "s"\} reviewed\. Red items need attention/);
  assert.doesNotMatch(source, /do not yet have a confirmed office assignment/);
});

test("missing location is omitted from footer, header, and exported data attribute", () => {
  assert.match(source, /if \(location === UNASSIGNED_LOCATION\) return footer/);
  assert.match(source, /Report appendix · Device inventory\$\{locationSuffix\}\$\{pageLabel\}/);
  assert.match(source, /data-inventory-location="\$\{locationAttribute\}"/);
  assert.match(source, /Additional systems reviewed\./);
});

test("real named locations still retain location-specific grouping and language", () => {
  assert.match(source, /assigned to \$\{location\}\. Red items need attention/);
  assert.match(source, /Current Device Inventory · \$\{location\}/);
  assert.match(source, /if \(value === UNASSIGNED_LOCATION\) return 2/);
});

test("neutral missing-location release is version 1.2.91", () => {
  assert.match(readFileSync(new URL("../package.json", import.meta.url), "utf8"), /"version": "1\.2\.91"/);
  assert.match(readFileSync(new URL("../src/lib/app-version.ts", import.meta.url), "utf8"), /1\.2\.91/);
});
