import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync(new URL("../src/lib/outcomes/pdf-inventory-sync.ts", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");

test("client PDF preparation restores named devices using the standard report recap design", () => {
  assert.match(wrapper, /ensurePdfDeviceInventory/);
  assert.match(helper, /Hardware inventory/);
  assert.match(helper, /Current device inventory/);
  assert.match(helper, /pdf-focus-page pdf-inventory-page/);
  assert.match(helper, /pdf-focus-summary/);
  assert.match(helper, /pdf-device-focus-grid/);
  assert.match(helper, /pdf-device-focus-card/);
  assert.match(helper, /pdf-device-focus-head/);
  assert.match(helper, /pdf-device-concerns/);
  assert.match(helper, /pageSize = 6/);
  assert.doesNotMatch(helper, /pdf-inventory-table/);
});

test("inventory sync does not duplicate an existing PDF inventory page", () => {
  assert.match(helper, /html\.includes\('class="pdf-page pdf-focus-page pdf-inventory-page"'\)/);
});
