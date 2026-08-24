import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(path.join(root, "src", "app", "signal-geography-map", "page.tsx"), "utf8");
const styles = readFileSync(path.join(root, "src", "app", "signal-geography-map", "signal-geography-map.module.css"), "utf8");

test("geography iframe surface is transparent so the dashboard background shows through", () => {
  assert.match(styles, /:global\(html\)/);
  assert.match(styles, /:global\(body\)/);
  assert.match(styles, /background:\s*transparent\s*!important/);
  assert.match(page, /style\.setProperty\("background",\s*"transparent",\s*"important"\)/);
});

test("service states begin at the top center of the primary map field", () => {
  assert.match(styles, /\.map\s*\{[\s\S]*?top:\s*12px;/);
  assert.match(styles, /left:\s*50%;/);
  assert.match(styles, /transform-origin:\s*50%\s*0%/);
});

test("map supports zoom reset plus pointer drag navigation without scrollbars", () => {
  assert.match(page, /DRAG TO MOVE/);
  assert.match(page, /onPointerDown=\{handlePointerDown\}/);
  assert.match(page, /onPointerMove=\{handlePointerMove\}/);
  assert.match(page, /onPointerUp=\{endDrag\}/);
  assert.match(page, /setPointerCapture/);
  assert.match(page, /setPan/);
  assert.match(page, /resetView/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /cursor:\s*grab/);
  assert.match(styles, /overflow:\s*hidden\s*!important/);
});
