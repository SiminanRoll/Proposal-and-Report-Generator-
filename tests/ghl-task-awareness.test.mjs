import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGhlTaskReadback, assessGhlTaskOverlap } from "../src/lib/compass/ghl-task-awareness.mjs";

const NOW = "2026-11-06T16:00:00.000Z";
const businessId = "business-0001";
const contactId = "contact-0001";
function task(id, overrides = {}) {
  return {
    id, contactId, title: "Coordination Call - Example Family Dentistry",
    body: "Follow up about annual review.", assignedTo: "owner-0001",
    dueDate: "2026-11-12T16:00:00.000Z", completed: false, ...overrides,
  };
}
function input(tasks = []) {
  return {
    clientId: "compass-001", businessId, contactId, source: "authenticated_ghl_api",
    associationVerified: true, checkedAt: "2026-11-06T15:59:00.000Z",
    listComplete: true, response: { tasks },
  };
}
const proposal = {
  clientId: "compass-001", companyName: "Example Family Dentistry",
  taskTitle: "Coordination Call", requestId: "request-12345678",
};

test("a task list without authenticated identity evidence is NOT an empty verified list", () => {
  const noEvidence = normalizeGhlTaskReadback(undefined, NOW);
  assert.equal(noEvidence.status, "not_checked");
  const unknownBusiness = input([]);
  unknownBusiness.associationVerified = false;
  assert.equal(normalizeGhlTaskReadback(unknownBusiness, NOW).status, "not_checked");
  assert.equal(assessGhlTaskOverlap(noEvidence, proposal, NOW).status, "not_checked");
});

test("GHL API contact tasks normalize due timestamps, completion and overdue state", () => {
  const snapshot = normalizeGhlTaskReadback(input([
    task("task-future-0001"), task("task-overdue-0002", { dueDate: "2026-11-01T14:00:00.000Z" }),
    task("task-done-00003", { completed: true }),
    task("task-no-date-004", { dueDate: null }),
  ]), NOW);
  assert.equal(snapshot.status, "verified_read");
  assert.deepEqual(snapshot.tasks.map((x) => x.status), ["overdue", "scheduled", "unscheduled", "completed"]);
  assert.equal(snapshot.tasks.find(x => x.id === "task-overdue-0002").dueDate, "2026-11-01T14:00:00.000Z");
  assert.equal(snapshot.businessId, businessId);
  assert.equal(snapshot.contactId, contactId);
});

test("partial reads, API failures, stale snapshots and future-skewed timestamps cannot prove no tasks", () => {
  const partial = input([]);
  partial.listComplete = false;
  assert.equal(normalizeGhlTaskReadback(partial, NOW).status, "unavailable");
  const bad = input([]);
  bad.response = { unexpected: true };
  assert.equal(normalizeGhlTaskReadback(bad, NOW).reason, "invalid_task_response");
  const stale = input([]);
  stale.checkedAt = "2026-11-06T15:40:00.000Z";
  assert.equal(normalizeGhlTaskReadback(stale, NOW).reason, "task_readback_stale");
  const future = input([]);
  future.checkedAt = "2026-11-06T16:01:00.000Z";
  assert.equal(normalizeGhlTaskReadback(future, NOW).reason, "task_readback_stale");
});

test("an invalid or cross-contact task invalidates the entire claimed snapshot", () => {
  assert.equal(normalizeGhlTaskReadback(input([
    task("task-valid-0001"),
    task("task-foreign001", { contactId: "contact-other1" }),
  ]), NOW).reason, "unverified_task_record");
  assert.equal(normalizeGhlTaskReadback(input([
    task("task-valid-0001", { dueDate: "2026-02-31-not-real" }),
  ]), NOW).status, "unavailable");
  assert.equal(normalizeGhlTaskReadback(input([
    task("task-valid-0001"), task("task-valid-0001"),
  ]), NOW).status, "unavailable");
});

test("completed task with the same marked request ID is an exact existing request", () => {
  const snapshot = normalizeGhlTaskReadback(input([
    task("task-done-00003", {
      completed: true, body: "Notes\nClient Compass Request ID: request-12345678\n",
    }),
  ]), NOW);
  const conflict = assessGhlTaskOverlap(snapshot, proposal, NOW);
  assert.equal(conflict.status, "request_already_present");
  assert.deepEqual(conflict.matchingTaskIds, ["task-done-00003"]);
});

test("lookalike request ID as substring does not count as an exact duplicate", () => {
  const snapshot = normalizeGhlTaskReadback(input([
    task("task-future-0001", { title: "Replace printer", body: "Client Compass Request ID: request-123456789" }),
  ]), NOW);
  const overlap = assessGhlTaskOverlap(snapshot, proposal, NOW);
  assert.equal(overlap.status, "no_similar_open_tasks_found");
  assert.equal(overlap.openTaskCount, 1);
});

test("open coordination call on the contact is a possible overlap, not proof of same-company task", () => {
  const snapshot = normalizeGhlTaskReadback(input([
    task("task-otherco-001", { title: "Coordination Call - Other Business" }),
    task("task-example-001", { title: "Coordination Call - Example Family Dentistry" }),
    task("task-related-001", { title: "General service follow-up" }),
  ]), NOW);
  const overlap = assessGhlTaskOverlap(snapshot, proposal, NOW);
  assert.equal(overlap.status, "possible_overlap");
  assert.deepEqual(overlap.matchingTaskIds, ["task-example-001", "task-otherco-001"]);
  assert.deepEqual(overlap.companyNamedTaskIds, ["task-example-001"]);
  assert.equal(overlap.counts.scheduled, 3);
});

test("a clean complete read is only the last checked state, not atomic duplicate protection", () => {
  const snapshot = normalizeGhlTaskReadback(input([]), NOW);
  const overlap = assessGhlTaskOverlap(snapshot, proposal, NOW);
  assert.equal(overlap.status, "no_similar_open_tasks_found");
  assert.deepEqual(overlap.matchingTaskIds, []);
  assert.equal(overlap.openTaskCount, 0);
  assert.equal(snapshot.checkedAt, "2026-11-06T15:59:00.000Z");
});

test("mismatched selected Compass client cannot inherit another client's task status", () => {
  const snapshot = normalizeGhlTaskReadback(input([task("task-future-0001")]), NOW);
  assert.equal(assessGhlTaskOverlap(snapshot, { ...proposal, clientId: "compass-002" }, NOW).status, "not_checked");
});

test("an expiring readback must not continue to report clear task status", () => {
  const snapshot = normalizeGhlTaskReadback(input([]), NOW);
  const future = "2026-11-06T16:20:00.000Z";
  assert.equal(assessGhlTaskOverlap(snapshot, proposal, future).status, "not_checked");
});
