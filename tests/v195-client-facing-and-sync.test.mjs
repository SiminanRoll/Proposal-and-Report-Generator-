import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const pdf = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");

test("v1.9.5 removes the redundant Locations slide from the client presentation", () => {
  assert.doesNotMatch(presentation, /beginning\.push\("locations"\)/);
  assert.doesNotMatch(presentation, /section === "locations"/);
  assert.match(presentation, /const CLIENT_REPORT_SECTIONS = \["overview", "security", "lifecycle", "details", "plan", "recap"\]/);
});

test("v1.9.5 PDF uses one final client-facing next-step close with CSM contact", () => {
  assert.doesNotMatch(pdf, /without repeating every detail from the live presentation/);
  assert.equal((pdf.match(/What this means for you/g) || []).length, 1);
  assert.match(pdf, /reach out to your Client Success Manager/i);
  assert.match(pdf, /Patric Beckman/);
  assert.match(pdf, /877\.723\.8832 x511/);
  assert.match(pdf, /patric\.beckman@adv-tech\.com/);
  assert.ok(pdf.indexOf('${printHipaaFollowUp}') < pdf.indexOf('${printRecap}'));
});

test("v1.9.5 Captain's Log sync requires a real V843 desktop acknowledgement", () => {
  assert.match(bridge, /probeCaptainsLogCloudDesktop/);
  assert.match(bridge, /action: "ping"|submitCaptainsLogCloudRequest\("ping"/);
  assert.match(bridge, /desktopVersion < 843/);
  assert.match(bridge, /ok: false,[\s\S]*status: "no-response"/);
  assert.match(bridge, /index \+= 20/);
  assert.match(settings, /Test desktop sync/);
  assert.match(settings, /Desktop ready/);
});

test("v1.9.5 bulk catch-up only counts returned snapshots that were applied", () => {
  assert.match(dataTools, /appliedResults/);
  assert.match(dataTools, /result\.ok && result\.client_id && result\.synced_at/);
  assert.match(dataTools, /returned no client data/);
  assert.match(dataTools, /returned and applied/);
});
