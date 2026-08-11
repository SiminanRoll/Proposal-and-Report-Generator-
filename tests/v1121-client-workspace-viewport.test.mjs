import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/client-review-viewport.css", import.meta.url), "utf8");

test("client review viewport fix loads after the motion polish layers", () => {
  const motionIndex = layout.indexOf('import "./v110-polish.css";');
  const viewportIndex = layout.indexOf('import "./client-review-viewport.css";');
  assert.ok(motionIndex >= 0);
  assert.ok(viewportIndex > motionIndex);
});

test("Compass home releases its animation transform so fixed client workspaces use the viewport", () => {
  assert.match(css, /\.page-shell\s*>\s*\.compass-home\s*\{[\s\S]*animation-fill-mode:\s*none\s*!important/);
});

test("client review workspace cannot grow wider or taller than its viewport surface", () => {
  assert.match(css, /width:\s*min\(1280px,\s*100%\)\s*!important/);
  assert.match(css, /max-width:\s*100%\s*!important/);
  assert.match(css, /max-height:\s*calc\(100dvh\s*-\s*24px\)\s*!important/);
});
