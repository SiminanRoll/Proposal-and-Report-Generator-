import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function presentationSource() {
  return readFileSync("src/components/multi-practice-workspace.tsx", "utf8");
}
function presenterCss() {
  const standalone = "src/app/generator/combined/styles.css";
  const embedded = "src/app/reports/combined/styles.css";
  const path = existsSync(standalone) ? standalone : embedded;
  return readFileSync(path, "utf8");
}
test("combined review opens as an actual full-viewport dialog, never a card within the report", () => {
  const source = presentationSource();
  const css = presenterCss();
  assert.match(source, /createPortal\(/);
  assert.match(source, /document\.body\s*\)/);
  assert.match(source, /className="multi-presenter-overlay" role="dialog" aria-modal="true"/);
  assert.doesNotMatch(source, /className="multi-card multi-presentation"/);
  assert.match(css, /\.multi-presenter-overlay\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/);
  assert.match(css, /height:\s*100dvh/);
});
test("slide scales to both available width and height, preserving 16:9 aspect", () => {
  const source = presentationSource();
  assert.match(source, /stage\.clientWidth\s*\/\s*1280/);
  assert.match(source, /stage\.clientHeight\s*\/\s*720/);
  assert.match(source, /width:\s*1280\s*\*\s*scale, height:\s*720\s*\*\s*scale/);
  assert.match(source, /multiPracticeHtml\(report, shownPage\)/);
});
test("presenter supports true fullscreen where available and fallback viewport with Esc and arrows", () => {
  const source = presentationSource();
  assert.match(source, /document\.documentElement\.requestFullscreen\(\)/);
  assert.match(source, /document\.exitFullscreen\(\)/);
  for (const key of ["Escape", "ArrowRight", "ArrowLeft", "PageDown", "PageUp"]) {
    assert.ok(source.includes('event.key === "' + key + '"'), key);
  }
  assert.match(source, /className="multi-presenter-navigation"/);
  assert.match(source, /onClick=\{closePresentation\}/);
  assert.match(source, /pointerEvents:\s*"none"/);
});
test("PDF download and source review are kept intact", () => {
  const source = presentationSource();
  assert.match(source, /downloadMultiPracticePdf\(report\)/);
  assert.match(source, /report\.errors\.length/);
  assert.match(source, /onClick=\{launchPresentation\}/);
  assert.match(source, /onClick=\{\(\) => void download\(\)\}/);
});
