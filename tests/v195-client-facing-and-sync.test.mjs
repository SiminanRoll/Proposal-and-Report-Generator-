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

test("v1.9.7 reads Captain's Log historicals directly from Supabase", () => {
  assert.match(bridge, /fetchAllRows<SupabaseTaskEventRow>\("task_events"/);
  assert.match(bridge, /fetchAllRows<SupabaseCallModeEventRow>\("app_events"/);
  assert.match(bridge, /event_type: "eq.call_mode_event"/);
  assert.match(bridge, /captainsLogCloudRest<null>\("POST", "task_events"/);
  assert.doesNotMatch(bridge, /probeCaptainsLogCloudDesktop|client_compass_response|127\.0\.0\.1|captainslog:\/\//);
  assert.match(settings, /History connection/);
  assert.match(settings, /Supabase project URL/);
  assert.match(settings, /Publishable \/ anon key/);
  assert.match(settings, /Sign-in email/);
  assert.doesNotMatch(settings, /Test desktop sync|Desktop ready|V843/);
});

test("v1.9.7 bulk refresh only applies matched Supabase snapshots", () => {
  assert.match(dataTools, /appliedResults/);
  assert.match(dataTools, /result\.ok && result\.matched && result\.client_id && result\.synced_at/);
  assert.match(dataTools, /Supabase history returned no client matches/);
  assert.match(dataTools, /Synced \${activityCount\.toLocaleString\(\)} Captain\'s Log history record/);
  assert.match(dataTools, /aliases: client\.aliases/);
});
