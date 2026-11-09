import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const renderer = await transpileTestModule("../src/lib/outcomes/client-inventory-pdf.ts", import.meta.url);
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
function item(index, overrides = {}) {
  return {
    name: "EQUIPMENT-" + index, deviceType: "Workstation", location: "Operatory " + index, user: "User " + index,
    model: "Dell OptiPlex 7010", serial: "SN-" + index, operatingSystem: "Windows 11 Pro",
    ram: "16 GB", storage: "256 GB SSD", age: "2 years", warranty: "In warranty",
    status: "Current", tone: "current", concerns: [], ...overrides,
  };
}
const footer = () => "<footer>Advantage Technologies</footer>";

test("all recorded devices appear even when everything is healthy", () => {
  const html = renderer.clientInventoryPdfPages([item(1), item(2), item(3)], footer);
  assert.match(html, /Your equipment inventory/);
  assert.equal((html.match(/data-inventory-device="true"/g) || []).length, 3);
  assert.equal((html.match(/pdf-full-inventory-page/g) || []).length, 1);
  assert.match(html, /EQUIPMENT-1/);
  assert.match(html, /EQUIPMENT-2/);
  assert.match(html, /EQUIPMENT-3/);
  assert.match(html, /3<\/strong>Devices recorded/);
  assert.match(html, /0<\/strong>Priority/);
});

test("priority and follow-up flags are visible beside the complete inventory", () => {
  const html = renderer.clientInventoryPdfPages([
    item(1, { status:"Priority review", tone:"priority", concerns:["OS end of support", "Storage critical"] }),
    item(2, { status:"Plan / review", tone:"attention", concerns:["Approaching replacement age"] }),
    item(3),
    item(4, { deviceType:"Virtual server", status:"Recorded", tone:"informational", concerns:[] }),
  ], footer);
  assert.equal((html.match(/data-inventory-device="true"/g) || []).length, 4);
  assert.match(html, /class="pdf-inventory-status priority"/);
  assert.match(html, /OS end of support/);
  assert.match(html, /Storage critical/);
  assert.match(html, /Approaching replacement age/);
  assert.match(html, /Lifecycle not rated for this device type/);
});

test("large inventories paginate, preserve every row, and repeat headings", () => {
  const rows = Array.from({ length: 38 }, (_, i) => item(i+1));
  const html = renderer.clientInventoryPdfPages(rows, footer);
  assert.equal((html.match(/data-inventory-device="true"/g) || []).length, 38);
  assert.ok((html.match(/class="pdf-page pdf-full-inventory-page"/g) || []).length >= 4);
  assert.match(html, /Equipment inventory continued/);
  assert.equal((html.match(/<thead>/g) || []).length, (html.match(/class="pdf-page pdf-full-inventory-page"/g) || []).length);
});

test("missing inventory is disclosed instead of silently skipping a page", () => {
  const html = renderer.clientInventoryPdfPages([], footer);
  assert.match(html, /Detailed equipment inventory not available/);
  assert.match(html, /No individual device records were supplied/);
  assert.equal((html.match(/pdf-full-inventory-page/g) || []).length, 1);
});

test("client-entered inventory values are escaped and no private sync is needed", () => {
  const html = renderer.clientInventoryPdfPages([item(1, {name:"EQUIPMENT <1> & dental", location:"<Front Desk>", serial:"A&B"})], footer);
  assert.match(html, /EQUIPMENT &lt;1&gt; &amp; dental/);
  assert.match(html, /&lt;Front Desk&gt;/);
  assert.match(html, /Serial A&amp;B/);
  assert.doesNotMatch(html, /<Front Desk>|EQUIPMENT <1>/);
  assert.match(exportHtml, /sortLifecycleDevicesByPriority\(lifecycleDevices\(project\)\)\.map/);
  assert.match(exportHtml, /clientInventoryPdfPages\(inventoryPdfRows, pdfFooter\)/);
  assert.match(exportHtml, /\$\{printInventory\}/);
});
