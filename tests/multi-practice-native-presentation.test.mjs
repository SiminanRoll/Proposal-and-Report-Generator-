import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const source = read("src/components/multi-practice-presentation.tsx");
const workspace = read("src/components/multi-practice-workspace.tsx");
const adapter = read("src/components/multi-practice-native-sections.ts");
const standaloneStyles = "src/app/generator/combined/styles.css";
const styles = read(existsSync(standaloneStyles) ? standaloneStyles : "src/app/reports/combined/styles.css");

test("combined presenter reuses the native Technology Health Review screen structure", () => {
  for (const cls of ["presentation-overlay", "presentation-shell", "presentation-topbar", "presentation-progress-nav",
    "presentation-stage", "presentation-slide-motion", "presentation-footer", "presentation-pdf", "presentation-close"]) {
    assert.ok(source.includes(cls), "missing native THR class: " + cls);
  }
  assert.match(source, /className="presentation-health-cover multi-native-overview"/);
  assert.match(source, /className="health-evidence-strip four-up"/);
  assert.match(source, /className="presentation-section-heading"/);
  assert.match(source, /className="presentation-plan multi-native-plan-list"/);
  assert.doesNotMatch(source, /<iframe|srcDoc|multiPracticeHtml|multiPracticePages/);
  assert.match(workspace, /<MultiPracticePresentation/);
  assert.doesNotMatch(workspace, /<iframe|srcDoc|multiPracticeHtml|multiPracticePages/);
});
test("native security, lifecycle, inventory, recovery and budget components are reused", () => {
  for (const name of ["MultiPracticeSecuritySection", "MultiPracticeLifecycleSection", "MultiPracticeInventorySection", "MultiPracticeBackupSection", "MultiPracticeBudgetSection"]) {
    assert.ok(adapter.includes(name), name);
    assert.ok(source.includes("<" + name + " project={project}"), name + " not rendered");
  }
  const owner = existsSync("src/components/outcome-experience.tsx") ?
    read("src/components/outcome-experience.tsx") :
    read("vendor/client-compass/src/components/outcome-experience.tsx");
  assert.match(owner, /SecurityPresentation as MultiPracticeSecuritySection/);
  assert.match(owner, /LifecyclePresentation as MultiPracticeLifecycleSection/);
  assert.match(owner, /DeviceDetailPresentation as MultiPracticeInventorySection/);
});
test("practice-specific filters and owner-level comparison persist across all native THR sections", () => {
  for (const section of ["overview", "security", "lifecycle", "details", "hipaa", "plan", "budget", "recap"]) assert.ok(source.includes(section), section);
  assert.match(source, /data\.practices\.map/);
  assert.match(source, /const \[selection, setSelection\]/);
  assert.match(source, /const chosen = data\.practices\.find/);
  assert.match(source, /selection === "all"/);
  assert.match(source, /<Compare data=\{data\}/);
  assert.match(source, /<PracticeDetail data=\{data\}/);
  assert.match(styles, /multi-native-practice-tabs/);
  assert.doesNotMatch(source, /\/100|scoreTone\(|clientReportScores\(/, "no composite numeric health score in client view");
});
test("native navigation supports section jumps, arrows, and exit; PDF output is independent", () => {
  assert.match(source, /onClick=\{\(\) => navigate\(item\)\}/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /onClick=\{onDownloadPdf\}/);
  assert.match(workspace, /downloadMultiPracticePdf\(report\)/);
  assert.doesNotMatch(source, /requestFullscreen|scale\(\\|canvas|window\.print/);
});
