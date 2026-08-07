import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rail = fs.readFileSync(new URL("../src/components/compass-navigation-rail.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("the visible menu rail is portaled to document.body instead of trapped inside the sticky header", () => {
  assert.match(rail, /import \{ createPortal \} from "react-dom"/);
  assert.match(rail, /mounted && createPortal\(/);
  assert.match(rail, /document\.body/);
  assert.match(rail, /id="client-compass-navigation"/);
  assert.match(css, /\.topbar\{backdrop-filter:none;-webkit-backdrop-filter:none/);
});

test("A hover and rail hover share a short bridge and expanded rail is explicitly visible", () => {
  assert.match(rail, /onMouseEnter=\{openFromHover\}/);
  assert.match(rail, /onMouseLeave=\{scheduleHoverClose\}/);
  assert.match(rail, /}, 120\)/);
  assert.match(css, /\.compass-navigation-rail\.is-expanded\{[^}]*opacity:1[^}]*visibility:visible[^}]*pointer-events:auto/s);
  assert.match(css, /\.compass-navigation-rail\{[^}]*z-index:100!important/s);
});
