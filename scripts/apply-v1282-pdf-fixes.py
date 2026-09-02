from pathlib import Path

budget = Path('src/lib/outcomes/technology-budget-outlook.ts')
text = budget.read_text()
old = '''  const recapMarkers = [
    '<section class="pdf-page pdf-recap',
    '<section class="pdf-recap',
    '<section class="print-report pdf-recap',
  ];'''
new = '''  const recapMarkers = [
    '<section class="pdf-page pdf-client-success-page',
    '<section class="pdf-page pdf-recap',
    '<section class="pdf-recap',
    '<section class="print-report pdf-recap',
  ];'''
if old not in text:
    raise SystemExit('Budget insertion marker target not found')
budget.write_text(text.replace(old, new, 1))

export = Path('src/lib/outcomes/export-html.ts')
text = export.read_text()
old_condition = 'if (options.includeTechnologyBudgetOutlook && project.type === "client-report" && clientReportAvailable(project)) html = injectTechnologyBudgetOutlookPdf(html, project);'
new_condition = 'if (options.includeTechnologyBudgetOutlook !== false && project.type === "client-report" && clientReportAvailable(project)) html = injectTechnologyBudgetOutlookPdf(html, project);'
if old_condition not in text:
    raise SystemExit('Budget default-inclusion target not found')
text = text.replace(old_condition, new_condition, 1)

css_anchor = '.pdf-hipaa-review .pdf-section-header{margin-bottom:12px!important}'
hipaa_css = '''.pdf-hipaa-answers [data-hipaa-response="no"]{border:1px solid #e99b8b!important;border-left:4px solid #d95f43!important;background:#fff0ed!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.pdf-hipaa-answers [data-hipaa-response="no"]>span{border:1px solid #efab9c!important;background:#ffdcd4!important;color:#a83e29!important}
.pdf-hipaa-answers [data-hipaa-response="partially"]{border:1px solid #e4c675!important;border-left:4px solid #c68a18!important;background:#fff7df!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.pdf-hipaa-answers [data-hipaa-response="partially"]>span{border:1px solid #e5c36f!important;background:#ffedbd!important;color:#805807!important}
'''
if css_anchor not in text:
    raise SystemExit('HIPAA portrait CSS anchor not found')
text = text.replace(css_anchor, hipaa_css + css_anchor, 1)
export.write_text(text)

package = Path('package.json')
p = package.read_text()
if '"version": "1.2.81"' not in p:
    raise SystemExit('Expected package version 1.2.81 not found')
package.write_text(p.replace('"version": "1.2.81"', '"version": "1.2.82"', 1))

app_version = Path('src/lib/app-version.ts')
a = app_version.read_text()
if '1.2.81' not in a:
    raise SystemExit('Expected app version 1.2.81 not found')
app_version.write_text(a.replace('1.2.81', '1.2.82', 1))

test = Path('tests/v1282-pdf-budget-hipaa.test.mjs')
test.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const exportHtml = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");
const budget = fs.readFileSync("src/lib/outcomes/technology-budget-outlook.ts", "utf8");

test("finished client PDF includes budget by default unless explicitly disabled", () => {
  assert.match(exportHtml, /options\.includeTechnologyBudgetOutlook !== false/);
});

test("budget page insertion targets the final page inside print report", () => {
  assert.match(budget, /'<section class="pdf-page pdf-client-success-page'/);
  assert.match(budget, /pdf-page pdf-budget-outlook/);
});

test("portrait HIPAA reviewed answers force visible red No treatment", () => {
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="no"\]\{border:1px solid #e99b8b!important;border-left:4px solid #d95f43!important;background:#fff0ed!important/);
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="no"\]>span\{border:1px solid #efab9c!important;background:#ffdcd4!important;color:#a83e29!important\}/);
});

test("portrait HIPAA reviewed answers force visible yellow Somewhat treatment", () => {
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="partially"\]\{border:1px solid #e4c675!important;border-left:4px solid #c68a18!important;background:#fff7df!important/);
  assert.match(exportHtml, /\.pdf-hipaa-answers \[data-hipaa-response="partially"\]>span\{border:1px solid #e5c36f!important;background:#ffedbd!important;color:#805807!important\}/);
});

test("PDF correction release is version 1.2.82", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.82"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.82/);
});
''')
