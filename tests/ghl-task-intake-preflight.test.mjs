import test from "node:test";
import assert from "node:assert/strict";

import {
  formatGhlWorkflowDueDate,
  prepareGhlTaskIntake,
  prepareGhlTaskIntakeBatch,
} from "../src/lib/compass/ghl-task-intake-preflight.mjs";

function entry(id = "client-001", businessId = "business-0001", contactId = "contact-0001") {
  return {
    clientId: id,
    companyName: "Example Family Dentistry",
    taskTitle: "Coordination Call",
    taskDetails: "Discuss workstation replacements and review timing.",
    dueDate: "2027-01-01",
    dueTime: "09:30",
    timeZone: "America/Chicago",
    requestId: "cc-request-" + id,
    ownerName: "Patric Beckman",
    identity: {
      verified: true,
      businessId,
      selectedContactId: contactId,
      associatedContacts: [{
        contactId,
        businessId,
        associationVerified: true,
      }],
    },
  };
}

test("GHL workflow due date is a local wall-clock value in the editor's documented format", () => {
  assert.equal(formatGhlWorkflowDueDate("2027-01-01", "09:30"), "01-01-2027 09:30 AM");
  assert.equal(formatGhlWorkflowDueDate("2027-01-01", "12:00"), "01-01-2027 12:00 PM");
  assert.equal(formatGhlWorkflowDueDate("2027-01-01", "00:05"), "01-01-2027 12:05 AM");
  assert.equal(formatGhlWorkflowDueDate("2027-01-01", "23:45"), "01-01-2027 11:45 PM");
  assert.throws(() => formatGhlWorkflowDueDate("2027-02-29", "09:30"), /Invalid due date/);
  assert.throws(() => formatGhlWorkflowDueDate("2027-01-01", "25:90"), /Invalid local due time/);
});

test("a verified existing GHL association prepares body JSON data without sending", () => {
  const prepared = prepareGhlTaskIntake(entry());
  assert.equal(prepared.status, "prepared_not_sent");
  assert.deepEqual(prepared.payload, {
    companyId: "business-0001",
    contactId: "contact-0001",
    companyName: "Example Family Dentistry",
    taskTitle: "Coordination Call",
    taskDetails: "Discuss workstation replacements and review timing.",
    dueDate: "01-01-2027 09:30 AM",
    timeZone: "America/Chicago",
    requestId: "cc-request-client-001",
    clientId: "client-001",
  });
  assert.equal("webhookUrl" in prepared.payload, false);
});

test("never interpret a Compass/Supabase UUID or name alone as an authenticated GHL business match", () => {
  const unverified = entry();
  unverified.identity.verified = false;
  assert.equal(prepareGhlTaskIntake(unverified).reason, "unresolved_business");
  unverified.identity.verified = true;
  unverified.identity.businessId = "sample-company-id";
  assert.equal(prepareGhlTaskIntake(unverified).reason, "unresolved_business");
});

test("ambiguous associated contacts are blocked until one is explicitly chosen", () => {
  const value = entry();
  value.identity.associatedContacts.push({
    contactId: "contact-0002", businessId: "business-0001", associationVerified: true,
  });
  delete value.identity.selectedContactId;
  assert.equal(prepareGhlTaskIntake(value).reason, "ambiguous_contact");
  value.identity.selectedContactId = "contact-0002";
  assert.equal(prepareGhlTaskIntake(value).payload.contactId, "contact-0002");
});

test("never use a contact that lacks a verified association to the intended GHL business", () => {
  const value = entry();
  value.identity.associatedContacts[0].businessId = "business-different";
  assert.equal(prepareGhlTaskIntake(value).reason, "missing_contact");
  value.identity.associatedContacts[0].businessId = "business-0001";
  value.identity.selectedContactId = "contact-someoneelse";
  assert.equal(prepareGhlTaskIntake(value).reason, "unverified_association");
});

test("missing stable request ID, invalid timezone/date, wrong owner, and duplicated title are blocked", () => {
  const value = entry();
  value.requestId = "";
  assert.equal(prepareGhlTaskIntake(value).reason, "missing_request_id");
  value.requestId = "cc-request-client-001";
  value.dueDate = "2027-02-29";
  assert.equal(prepareGhlTaskIntake(value).reason, "invalid_due_date");
  value.dueDate = "2027-01-01";
  value.timeZone = "Mars/Base";
  assert.equal(prepareGhlTaskIntake(value).reason, "invalid_due_date");
  value.timeZone = "America/Chicago";
  value.ownerName = "Another User";
  assert.equal(prepareGhlTaskIntake(value).reason, "unsupported_owner");
  value.ownerName = "Patric Beckman";
  value.taskTitle = "Coordination Call - Example Family Dentistry";
  assert.equal(prepareGhlTaskIntake(value).reason, "invalid_task_title");
});

test("bulk preparation gives per-client results and blocks duplicate client selections", () => {
  const first = entry();
  const second = entry("client-002", "business-0002", "contact-0002");
  const duplicate = entry();
  const invalid = entry("client-003", "business-0003", "contact-0003");
  invalid.identity.verified = false;
  const results = prepareGhlTaskIntakeBatch([first, second, duplicate, invalid]);
  assert.deepEqual(results.map((result) => [result.clientId, result.status, result.reason]), [
    ["client-001", "prepared_not_sent", undefined],
    ["client-002", "prepared_not_sent", undefined],
    ["client-001", "blocked", "duplicate_in_batch"],
    ["client-003", "blocked", "unresolved_business"],
  ]);
});

test("bulk preparation refuses request ID reuse across different client selections", () => {
  const first = entry();
  const second = entry("client-002", "business-0002", "contact-0002");
  second.requestId = first.requestId;
  const results = prepareGhlTaskIntakeBatch([first, second]);
  assert.equal(results[0].status, "prepared_not_sent");
  assert.equal(results[1].reason, "duplicate_request_id");
});

test("bulk preparation refuses cross-company contact reuse with the single contact-level GHL request field", () => {
  const first = entry();
  const second = entry("client-002", "business-0002", "contact-0001");
  const results = prepareGhlTaskIntakeBatch([first, second]);
  assert.deepEqual(results.map((result) => result.reason), [
    "shared_contact_conflict", "shared_contact_conflict",
  ]);
});
