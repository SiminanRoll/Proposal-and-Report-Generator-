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
    id: "c1", name: "Example Dental", aliases: [], primaryContact: "", primaryContactRole: "", primaryContactEmail: "", primaryContactPhone: "",
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

test("Project Coverage tracked state remains backed by shared Captain's Log history", () => {
  assert.match(list, /captainsLog\?\.recentActivity\?\.length/);
  assert.match(list, /captainsLog\?\.openTasks\?\.length/);
  assert.match(list, /ClientTrackedAction/);
  assert.match(list, /tracked=\{Boolean\(meta\?\.tracked\)\}/);
  assert.doesNotMatch(list, /Scheduling stays locked|open_task_count|openQuickScheduler/);
});

test("v1.0.9.41 client review shows only compact review/contact/activity data", () => {
  for (const expected of ["Client Review", "Account Review Outcome", "Primary contact", "Last review", "Latest activity", "Upcoming needs"]) assert.match(workspace, new RegExp(expected));
  for (const retired of ["Basic CRM", "Account review tracking", "Next follow-up", "Client history", "Add task", "Captain's Log"]) assert.doesNotMatch(workspace, new RegExp(`>${retired}<`));
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

test("shared history uses authenticated Supabase instead of localhost or protocol delivery", () => {
  const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
  const cloudSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
  assert.match(bridgeSource, /fetchAllRows<SupabaseTaskEventRow>\("task_events"/);
  assert.match(bridgeSource, /fetchAllRows<SupabaseCallModeEventRow>\("app_events"/);
  assert.match(bridgeSource, /event_type: "eq.call_mode_event"/);
  assert.match(bridgeSource, /captainsLogCloudRest<null>\("POST", "task_events"/);
  assert.doesNotMatch(bridgeSource, /client_compass_response|probeCaptainsLogCloudDesktop|127\.0\.0\.1|captainslog:\/\//);
  assert.match(cloudSource, /auth\/v1\/token/);
  assert.match(cloudSource, /rest\/v1/);
  assert.match(workspace, /syncClientFromCaptainsLog/);
});
