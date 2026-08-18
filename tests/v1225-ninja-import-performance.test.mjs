import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dialog = fs.readFileSync(new URL("../src/components/compass-data-dialog.tsx", import.meta.url), "utf8");

test("company selection does not rebuild the full Ninja inventory preview", () => {
  assert.match(dialog, /const \[baseSummary, setBaseSummary\]/);
  assert.match(dialog, /const initialPreview = buildImportPreview\(next, dataset, resolved, config\)/);
  assert.match(dialog, /const commit = async \(\) => \{[\s\S]*const preview = buildImportPreview\(parsed, dataset, resolutions, config\)/);
  assert.doesNotMatch(dialog, /const preview = useMemo\(\(\) => parsed \? buildImportPreview/);
});

test("the importer paints a busy state before the final heavy rebuild", () => {
  assert.match(dialog, /await nextPaint\(\);/);
  assert.match(dialog, /Preparing and saving/);
});
