import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const workspace = fs.readFileSync(new URL("../src/components/compass-client-workspace.tsx", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../src/components/project-coverage-client-list.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("v1.8.1 merges Captain's Log contact and explicit review/follow-up facts into the lightweight CRM", async () => {
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
  assert.equal(merged.nextFollowUp, "2026-08-14");
});

test("v1.8.1 list quick action checks Captain's Log before creating another Coordination Call", () => {
  assert.match(list, /syncClientFromCaptainsLogInteractive\(client\.clientId, client\.clientName/);
  assert.match(list, /if \(sync\.coordination\?\.open\)/);
  assert.match(list, /onCaptainsLogSync\?\./);
  assert.match(list, /Captain's Log <span aria-hidden="true">\{sortIndicator\("captains-log"/);
  assert.match(list, /project-coverage-compass-quick/);
});

test("v1.8.1 client workspace exposes only the basic CRM fields up front and syncs Captain's Log activity", () => {
  for (const expected of ["Basic CRM", "Account review tracking", "Primary contact", "Last account review", "Next follow-up", "Refresh from Captain's Log", "Client connection & activity"]) assert.match(workspace, new RegExp(expected));
  for (const retired of ["Relationship status", "Technology Consultant / owner", "Last sales interaction"]) assert.doesNotMatch(workspace, new RegExp(retired));
  assert.match(workspace, /syncClientFromCaptainsLogInteractive/);
  assert.match(workspace, /mergeCaptainsLogSyncIntoClient/);
  assert.match(workspace, /recent_activity/);
});

test("v1.8.1 ships the high-resolution Client Compass icon through app metadata", () => {
  assert.match(layout, /client-compass-icon\.png/);
  assert.match(layout, /client-compass\.ico/);
  assert.equal(fs.existsSync(new URL("../public/client-compass-icon.png", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../public/client-compass.ico", import.meta.url)), true);
});


test("v1.8.1 uses an interactive localhost handshake as the primary browser-to-desktop transport", () => {
  const bridgeSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-bridge.ts", import.meta.url), "utf8");
  assert.match(bridgeSource, /\/v1\/client-compass/);
  assert.match(bridgeSource, /window\.open\("about:blank"/);
  assert.match(bridgeSource, /addEventListener\("message"/);
  assert.match(workspace, /sendCoordinationCallToCaptainsLogInteractive/);
  assert.match(workspace, /syncClientFromCaptainsLogInteractive/);
});
