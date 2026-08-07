import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const dataTools = fs.readFileSync(new URL("../src/components/compass-data-tools-page.tsx", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");

test("v1.8.8 blocks scheduling when any Captain's Log task is open or planned", () => {
  for (const source of [list, workspace]) {
    assert.match(source, /open_task_count/);
    assert.match(source, /open or planned task/);
    assert.match(source, /syncClientFromCaptainsLog/);
  }
  assert.match(list, /quickMode !== "schedule"/);
  assert.match(workspace, /!sync\.synced_at/);
  assert.match(workspace, /Nothing was scheduled/);
});

test("v1.8.8 stores the complete Captain's Log activity snapshot on the Client Compass client", async () => {
  const bridge = await transpileTestModule("../src/lib/compass/captains-log-bridge.ts", import.meta.url, { prefix: "v187-cl-sync" });
  const client = {
    id: "c1", name: "Example Dental", aliases: [], primaryContact: "", primaryContactRole: "", primaryContactEmail: "", primaryContactPhone: "",
    assignedOwner: "", lastAccountReview: "", lastSalesInteraction: "", lastQuoteDate: "", quoted: false, nextFollowUp: "", workflowStatus: "", internalNote: "",
    reviewOutcome: { status: "not-reviewed", reviewedAt: "", meetingSummary: "", agreedNextStep: "", reportTitle: "", executiveSummary: "", items: [], lastUpdatedAt: "" }, lastDataRefresh: "",
  };
  const merged = bridge.mergeCaptainsLogSyncIntoClient(client, {
    ok: true, matched: true, linked_company: "Example Dental", synced_at: "2026-08-07T09:00:00-05:00", open_task_count: 2, has_open_tasks: true,
    open_tasks: [
      { id: "t1", type: "Call", tag: "Client Coordination", title: "Call office", status: "scheduled", scheduled_at: "2026-08-14T09:00:00-05:00", created_at: "", source: "focus" },
      { id: "t2", type: "Email", tag: "Follow Up", title: "Send quote recap", status: "open", scheduled_at: "", created_at: "2026-08-06T09:00:00-05:00", source: "focus" },
    ],
    primary_open_task: { id: "t1", type: "Call", tag: "Client Coordination", title: "Call office", status: "scheduled", scheduled_at: "2026-08-14T09:00:00-05:00", created_at: "", source: "focus" },
    recent_activity: [{ id: "t1", type: "Call", tag: "Client Coordination", title: "Call office", status: "scheduled", scheduled_at: "2026-08-14T09:00:00-05:00", completed_at: "", created_at: "", source: "focus" }],
  });
  assert.equal(merged.nextFollowUp, "2026-08-14");
  assert.equal(merged.captainsLog.openTaskCount, 2);
  assert.equal(merged.captainsLog.openTasks[1].title, "Send quote recap");
  assert.equal(merged.captainsLog.recentActivity.length, 1);
});

test("Data Tools refreshes the entire Client Compass book from one Supabase history load", () => {
  assert.match(dataTools, /Refresh client activity/);
  assert.match(dataTools, /Refresh from Supabase/);
  assert.match(dataTools, /syncClientsFromCaptainsLog/);
  assert.match(dataTools, /replaceCaptainsLogQueue/);
  assert.match(bridgeSource, /const ledger = await loadSupabaseLedger\(false\)/);
  assert.match(bridgeSource, /buildClientSnapshotsFromLedger\(ledger, cleaned\)/);
  assert.doesNotMatch(bridgeSource, /sync_clients_batch|index \+= 20|client_compass_response/);
});
