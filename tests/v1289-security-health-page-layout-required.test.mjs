import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("v1.2.89 PDF pipeline includes the Security and Technology Health layout pass", () => {
  const pipeline = fs.readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  const layout = fs.readFileSync("src/lib/outcomes/pdf-security-health-layout.ts", "utf8");
  assert.match(pipeline, /prepareSecurityHealthPageHtml\(inventoryHtml\)/);
  assert.match(layout, /grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(layout, /pdf-overview-panel:first-child/);
  assert.match(layout, /pdf-overview-panel:last-child/);
  assert.match(layout, /data-client-compass-page2-layout=\\"v1\.2\.89\\"/);
});
