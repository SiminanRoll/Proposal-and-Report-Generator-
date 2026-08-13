import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const presentation = fs.readFileSync(new URL("../src/components/prospect-a360-global.tsx", import.meta.url), "utf8");
const model = fs.readFileSync(new URL("../src/lib/prospects/a360.ts", import.meta.url), "utf8");

test("top bar exposes a no-save first-time A360 launcher next to Workbench", () => {
  assert.ok(shell.indexOf("<ProspectA360Global />") > shell.indexOf("Workbench</span>"));
  assert.match(presentation, /Contact name/);
  assert.match(presentation, /No prospect record is required/);
  assert.match(presentation, /createPortal/);
  assert.match(presentation, /prospect-launcher-backdrop/);
  assert.match(presentation, /<ProspectPresentation[\s\S]*document\.body/);
  for (const value of ["practice", "firm", "business", "organization", "Dental", "Medical", "Legal", "Accounting", "Other"]) assert.match(presentation, new RegExp(value));
});

test("guided prospect presentation contains ordered discovery and evidence-safe recap", () => {
  for (const section of ["Welcome", "Priorities", "Environment", "Software", "Your A360", "Summary", "Estimate", "Next step"]) assert.match(presentation, new RegExp(`"${section}"`));
  assert.match(presentation, /data\.priorities\.indexOf/);
  assert.match(presentation, /Client-provided preliminary information/);
  assert.match(presentation, /not verified technical findings/);
  assert.match(model, /Practice management software/);
  assert.match(presentation, /Imaging software/);
  assert.match(presentation, /2D \+ 3D/);
});

test("preliminary range reuses real pricing constants and exposes the missing CRM hook", () => {
  assert.match(model, /A360_MONTHLY_PRICING\.site/);
  assert.match(model, /A360_MONTHLY_PRICING\.workstation/);
  assert.match(model, /A360_MONTHLY_PRICING\.serverStandardBackup/);
  assert.match(presentation, /Calculated live from the current Advantage 360/);
  assert.match(presentation, /Prospect saving and OTA scheduling are not connected to a CRM endpoint/);
  assert.match(presentation, /Save Prospect & Request OTA/);
});
