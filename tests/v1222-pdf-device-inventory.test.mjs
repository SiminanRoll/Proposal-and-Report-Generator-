import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync(new URL("../src/lib/outcomes/pdf-inventory-sync.ts", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");

test("client PDF preparation restores the named device inventory", () => {
  assert.match(wrapper, /ensurePdfDeviceInventory/);
  assert.match(helper, /Hardware inventory/);
  assert.match(helper, /Current device inventory/);
  assert.match(helper, /Operating system/);
  assert.match(helper, /Age &amp; warranty/);
  assert.match(helper, /Check-in &amp; status/);
  assert.match(helper, /pageSize = 10/);
});

test("inventory sync does not duplicate an existing PDF inventory page", () => {
  assert.match(helper, /html\.includes\('class="pdf-page pdf-inventory-page"'\)/);
});
