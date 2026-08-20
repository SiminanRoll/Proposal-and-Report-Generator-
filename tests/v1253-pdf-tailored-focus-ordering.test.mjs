import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const wrapper = fs.readFileSync(new URL("../src/lib/outcomes/fillable-pdf.ts", import.meta.url), "utf8");
const focus = fs.readFileSync(new URL("../src/lib/outcomes/pdf-presentation-focus-sync.ts", import.meta.url), "utf8");
const inventory = fs.readFileSync(new URL("../src/lib/outcomes/pdf-inventory-sync.ts", import.meta.url), "utf8");

test("explicit presentation focus is rendered as a visible client PDF section", () => {
  assert.match(wrapper, /preparePresentationFocusHtml/);
  assert.match(focus, /buildPresentationFocusStory/);
  assert.match(focus, /presentationConcerns/);
  assert.match(focus, /What this technology review is focused on/);
  assert.match(focus, /Primary focus/);
  assert.match(focus, /Secondary focus/);
  assert.match(focus, /Supporting focus/);
  assert.match(focus, /Why this is in the plan/);
  assert.match(focus, /overview\.insertAdjacentElement\("afterend", page\)/);
});

test("device inventory is a closing appendix rather than an early report section", () => {
  assert.match(inventory, /FINAL_RECAP_MARKER/);
  assert.match(inventory, /closingInsertionPoint/);
  assert.match(inventory, /moveInventoryPagesToClose/);
  assert.match(inventory, /Report appendix · Device inventory/);
  assert.match(inventory, /A reference list of the systems included in this review/);
  assert.doesNotMatch(inventory, /same technology-recap format used throughout Client Compass/);
});

test("legacy radar cleanup is narrow enough not to erase the tailored focus page", () => {
  assert.match(inventory, /<h2>\[\^<\]\*what to keep on your radar/);
  assert.doesNotMatch(focus, /pdf-page pdf-focus-page/);
  assert.match(focus, /pdf-page pdf-tailored-focus-page/);
});
