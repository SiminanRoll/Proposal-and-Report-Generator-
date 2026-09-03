import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function loadLayoutModule() {
  const source = fs.readFileSync("src/lib/outcomes/pdf-security-health-layout.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

const overviewHtml = `<!doctype html><html><head><style>.pdf-overview-columns{display:grid;grid-template-columns:1fr 1fr}</style></head><body><section class="pdf-page pdf-overview-page" data-pdf-page="true"><header class="pdf-section-header"><h2>Security and technology health</h2></header><div class="pdf-overview-columns"><article class="pdf-overview-panel"><span>Security protection</span><h3>Your security protections are active</h3><div class="pdf-compact-metrics"><article><strong>14M</strong></article><article class="signal"><strong>394</strong></article><article class="incident"><strong>0</strong></article></div><aside class="pdf-security-statement"><span>Protection in place</span><p>Protection remained active across the managed environment.</p></aside></article><article class="pdf-overview-panel"><span>Network health & equipment age</span><h3>Several systems need attention</h3><div class="pdf-technology-recap"><article class="healthy"><strong>31</strong></article><article class="attention"><strong>13</strong></article><article class="os"><strong>21</strong></article></div><p class="pdf-environment-line">1 primary server · 78 workstations · 7 virtual machines</p></article></div><div class="pdf-review-story"><article><strong>Protection active</strong><small>No incidents</small></article></div></section></body></html>`;

test("Page 2 PDF layout becomes stacked full-width security and health sections", () => {
  const { prepareSecurityHealthPageHtml } = loadLayoutModule();
  const result = prepareSecurityHealthPageHtml(overviewHtml);
  assert.match(result, /data-client-compass-page2-layout="v1\.2\.89"/);
  assert.match(result, /\.pdf-overview-page \.pdf-overview-columns\{display:grid!important;grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(result, /\.pdf-overview-page \.pdf-overview-panel:first-child\{display:grid!important/);
  assert.match(result, /background:linear-gradient\(135deg,#eaf3ff 0%,#f3f8ff 55%,#eef9f7 100%\)!important/);
  assert.match(result, /grid-template-columns:1\.28in minmax\(0,1fr\)!important/);
  assert.match(result, /\.pdf-overview-page \.pdf-overview-panel:last-child\{display:grid!important/);
});

test("Page 2 security statement gains readable full-width supporting space", () => {
  const { prepareSecurityHealthPageHtml } = loadLayoutModule();
  const result = prepareSecurityHealthPageHtml(overviewHtml);
  assert.match(result, /grid-area:security-statement!important/);
  assert.match(result, /font-size:7\.45pt!important;line-height:1\.42!important/);
  assert.match(result, /background:rgba\(255,255,255,\.86\)!important/);
});

test("Page 2 takeaway ribbon is retained but materially slimmer", () => {
  const { prepareSecurityHealthPageHtml } = loadLayoutModule();
  const result = prepareSecurityHealthPageHtml(overviewHtml);
  assert.match(result, /\.pdf-overview-page \.pdf-review-story\{grid-template-columns:1fr 14px 1fr 14px 1fr!important/);
  assert.match(result, /\.pdf-overview-page \.pdf-review-story article small\{display:none!important\}/);
});

test("layout injection is idempotent and does not touch unrelated HTML", () => {
  const { prepareSecurityHealthPageHtml } = loadLayoutModule();
  const first = prepareSecurityHealthPageHtml(overviewHtml);
  const second = prepareSecurityHealthPageHtml(first);
  assert.equal(second, first);
  assert.equal(prepareSecurityHealthPageHtml("<html><head></head><body><p>Other report</p></body></html>"), "<html><head></head><body><p>Other report</p></body></html>");
});

test("fillable PDF pipeline applies the Page 2 layout before final capture", () => {
  const pipeline = fs.readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
  assert.match(pipeline, /import \{ prepareSecurityHealthPageHtml \} from "\.\/pdf-security-health-layout"/);
  assert.match(pipeline, /const layoutHtml = prepareSecurityHealthPageHtml\(inventoryHtml\)/);
  assert.match(pipeline, /sanitizeClientPdfCopy\(layoutHtml\)/);
});

test("v1.2.89 carries the Page 2 redesign", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.89"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.89/);
});
