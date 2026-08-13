import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("shared activity sync merges contact and review facts without overriding manual follow-up dates", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "v182-cl-sync" });
  const client = {
    id: "c1", name: "Example Dental", aliases: [], city: "", state: "", market: "", industry: "", tags: [], primaryContact: "", primaryContactRole: "", primaryContactEmail: "", primaryContactPhone: "",
    assignedOwner: "", lastAccountReview: "2026-01-01", lastSalesInteraction: "", lastQuoteDate: "", quoted: false, nextFollowUp: "", workflowStatus: "", internalNote: "",
    reviewOutcome: { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", items: [], lastUpdatedAt: "" }, lastDataRefresh: "",
  };
  const merged = bridge.mergeCaptainsLogSyncIntoClient(client, {
    ok: true,
    contact: { name: "Alex Morgan", role: "Office Manager", email: "alex@example.com", phone: "555-0100" },
    last_account_review: "2026-07-20T10:00:00-05:00",
    coordination: { exists: true, open: true, task_id: "t1", title: "Coordination Call", scheduled_at: "2026-08-14T09:00:00-05:00", status: "scheduled" },
  });
  assert.equal(merged.primaryContact, "Alex Morgan");
  assert.equal(merged.primaryContactEmail, "alex@example.com");
  assert.equal(merged.primaryContactPhone, "555-0100");
  assert.equal(merged.lastAccountReview, "2026-07-20");
  assert.equal(merged.nextFollowUp, "");
});

test("Project Coverage tracked state remains backed by shared Captain's Log state", () => {
  assert.match(list, /captainsLog\?\.recentActivity\?\.length/);
  assert.match(list, /captainsLog\?\.openTasks\?\.length/);
  assert.match(list, /ClientTrackedAction/);
  assert.match(list, /tracked=\{Boolean\(meta\?\.tracked\)\}/);
});

test("client review shows only compact review/contact/activity data", () => {
  for (const expected of ["Client Review", "Account Review Outcome", "Primary contact", "Last review", "Latest activity", "Upcoming needs"]) assert.match(workspace, new RegExp(expected));
  assert.match(workspace, /syncClientFromCaptainsLog/);
  assert.match(workspace, /mergeCaptainsLogSyncIntoClient/);
  assert.match(workspace, /recent_activity/);
});

test("Client Compass ships the full-frame SVG favicon plus the high-resolution PNG asset", () => {
  assert.match(layout, /client-compass-favicon\.svg/);
  assert.match(layout, /client-compass-icon\.png/);
  assert.equal(fs.existsSync(new URL("../public/client-compass-favicon.svg", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../public/client-compass-icon.png", import.meta.url)), true);
});

test("shared current state uses canonical public.tasks instead of task event replay", () => {
  const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
  const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");
  const writer = fs.readFileSync(new URL("../src/lib/compass/captains-log-task-write.ts", import.meta.url), "utf8");
  const cloudSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
  assert.match(currentState, /"GET", "tasks"/);
  assert.match(currentState, /lifecycle_state: "eq\.open"/);
  assert.match(currentState, /lifecycle_state: "eq\.completed"/);
  assert.match(writer, /"POST",\s*\n\s*"tasks"/);
  assert.doesNotMatch(currentState, /task_events|app_events|client_compass_current_state/);
  assert.doesNotMatch(writer, /task_events/);
  assert.doesNotMatch(bridgeSource, /client_compass_response|127\.0\.0\.1|captainslog:\/\//);
  assert.match(cloudSource, /auth\/v1\/token/);
  assert.match(cloudSource, /rest\/v1/);
});
