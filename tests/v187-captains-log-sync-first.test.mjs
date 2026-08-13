import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-review-workspace-v10941.tsx", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
const currentState = fs.readFileSync(new URL("../src/lib/compass/captains-log-current-state.ts", import.meta.url), "utf8");

test("client review retires task creation chrome while shared task support remains", () => {
  assert.doesNotMatch(workspace, /aria-label="Add a Coordination Call task"/);
  assert.doesNotMatch(workspace, /sendCoordinationCallToCaptainsLogReliable/);
  assert.doesNotMatch(list, /open_task_count|Scheduling stays locked|quickMode/);
  assert.match(bridgeSource, /sendCoordinationCallToCaptainsLogReliable/);
});

test("shared sync stores the bounded canonical activity snapshot on the client", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "v187-cl-sync" });
  const client = {
    id: "c1", name: "Example Dental", aliases: [], city: "", state: "", market: "", industry: "", tags: [], primaryContact: "", primaryContactRole: "", primaryContactEmail: "", primaryContactPhone: "",
    assignedOwner: "", lastAccountReview: "", lastSalesInteraction: "", lastQuoteDate: "", quoted: false, nextFollowUp: "", workflowStatus: "", internalNote: "",
    reviewOutcome: { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", items: [], lastUpdatedAt: "" }, lastDataRefresh: "",
  };
  const merged = bridge.mergeCaptainsLogSyncIntoClient(client, {
    ok: true, matched: true, linked_company: "Example Dental", synced_at: "2026-08-07T09:00:00-05:00", open_task_count: 2,
    open_tasks: [
      { id: "t1", type: "Call", tag: "Client Coordination", title: "Call office", status: "scheduled", scheduled_at: "2026-08-14", created_at: "", source: "focus" },
      { id: "t2", type: "Email", tag: "Follow Up", title: "Send quote recap", status: "open", scheduled_at: "", created_at: "2026-08-06", source: "focus" }
    ],
    recent_activity: [{ id: "t1", type: "Call", tag: "Client Coordination", title: "Call office", status: "scheduled", scheduled_at: "2026-08-14", completed_at: "", created_at: "", source: "focus" }]
  });
  assert.equal(merged.captainsLog.openTaskCount, 2);
  assert.equal(merged.captainsLog.openTasks[1].title, "Send quote recap");
  assert.equal(merged.captainsLog.recentActivity.length, 1);
});

test("Data Tools performs an explicit bounded company-scoped canonical refresh", () => {
  assert.match(dataTools, /Sync all client history/);
  assert.match(dataTools, /syncClientsFromCaptainsLog/);
  assert.match(currentState, /BATCH_CONCURRENCY = 6/);
  assert.match(currentState, /company_id: `eq\.\$\{companyId\}`/);
  assert.match(currentState, /RECENT_COMPLETED_LIMIT = 12/);
  assert.doesNotMatch(currentState, /task_events|app_events|sync_clients_batch/);
});
