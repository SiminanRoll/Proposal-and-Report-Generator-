import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync(new URL("../src/components/outcome-experience.tsx", import.meta.url), "utf8");
const pdf = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");

test("client presentation omits redundant Locations slide", () => {
  assert.doesNotMatch(presentation, /beginning\.push\("locations"\)/);
  assert.doesNotMatch(presentation, /section === "locations"/);
});

test("PDF uses one final client-facing next-step close with CSM contact", () => {
  assert.equal((pdf.match(/What this means for you/g) || []).length, 1);
  assert.match(pdf, /Patric Beckman/);
});

test("Captain's Log current state and recent history are company-scoped canonical task reads", () => {
  assert.match(bridge, /syncClientsFromCompassCurrentState/);
  assert.match(currentState, /lifecycle_state: "eq\.open"/);
  assert.match(currentState, /RECENT_COMPLETION_FILTER/);
  assert.match(currentState, /OPEN_LIMIT = 24/);
  assert.match(currentState, /RECENT_COMPLETED_LIMIT = 12/);
  assert.match(writer, /"POST",\s*\n\s*"tasks"/);
  assert.doesNotMatch(currentState, /task_events|app_events/);
  assert.doesNotMatch(writer, /task_events/);
  assert.match(settings, /Supabase project URL/);
});

test("bulk refresh applies matched Supabase snapshots", () => {
  assert.match(dataTools, /appliedResults/);
  assert.match(dataTools, /result\.ok && result\.matched && result\.client_id && result\.synced_at/);
});
