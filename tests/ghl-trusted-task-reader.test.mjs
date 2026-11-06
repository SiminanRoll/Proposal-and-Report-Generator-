import test from "node:test";
import assert from "node:assert/strict";
import { readGhlClientTaskState } from "../src/lib/compass/ghl-trusted-task-reader.mjs";

const NOW = "2026-11-06T16:00:00.000Z";
const req = { clientId: "compass-001", businessId: "business-0001", locationId: "location-001", selectedContactId: "contact-0001" };
const c = (id = "contact-0001") => ({ id, locationId: "location-001", businessId: "business-0001" });
const t = () => ({
  id: "task-scheduled1", contactId: "contact-0001", title: "Coordination Call - Example Dental",
  body: "Review hardware.", dueDate: "2026-11-16T17:00:00Z", assignedTo: "owner-0001", completed: false,
});

function provider({ contacts = [c()], count = contacts.length, business = { id: "business-0001", locationId: "location-001" }, taskResponse = { tasks: [t()] } } = {}) {
  const calls = [];
  return {
    calls,
    async readBusiness(businessId) { calls.push(["business", businessId]); return { business }; },
    async listContactsByBusiness(query) {
      calls.push(["contacts", query.skip, query.limit]);
      return { contacts: contacts.slice(query.skip, query.skip + query.limit), count };
    },
    async readContactTasks(contactId) { calls.push(["tasks", contactId]); return taskResponse; },
  };
}

test("trusted reader checks existing business, association, then contact tasks and returns verified GHL state", async () => {
  const p = provider();
  const result = await readGhlClientTaskState(req, p, NOW);
  assert.equal(result.status, "verified_read");
  assert.equal(result.identity.selectedContactId, "contact-0001");
  assert.equal(result.taskReadback.tasks[0].status, "scheduled");
  assert.deepEqual(p.calls.map((x) => x[0]), ["business", "contacts", "tasks"]);
});

test("no new contact is created or guessed when business has multiple contacts", async () => {
  const p = provider({ contacts: [c(), c("contact-0002")] });
  const result = await readGhlClientTaskState({ ...req, selectedContactId: undefined }, p, NOW);
  assert.equal(result.status, "not_checked");
  assert.equal(result.reason, "ambiguous_contact");
  assert.deepEqual(result.contactCandidates, ["contact-0001", "contact-0002"]);
  assert.equal(p.calls.some((x) => x[0] === "tasks"), false);
});

test("selected contact must come from verified business association list", async () => {
  const p = provider();
  const result = await readGhlClientTaskState({ ...req, selectedContactId: "contact-notinlist" }, p, NOW);
  assert.equal(result.reason, "selected_contact_not_associated");
  assert.equal(result.identity, null);
  assert.equal(p.calls.some((x) => x[0] === "tasks"), false);
});

test("wrong business or location rejects before fetching contacts or tasks", async () => {
  const p = provider({ business: { id: "business-other1", locationId: "location-001" } });
  const result = await readGhlClientTaskState(req, p, NOW);
  assert.equal(result.reason, "business_mismatch");
  assert.deepEqual(p.calls.map((x) => x[0]), ["business"]);
});

test("incomplete association listing cannot be misread as zero tasks", async () => {
  const p = provider({ contacts: [c()], count: 2 });
  const result = await readGhlClientTaskState(req, p, NOW);
  assert.equal(result.reason, "incomplete_association_list");
  assert.equal(p.calls.some((x) => x[0] === "tasks"), false);
});

test("business-scoped endpoint returning a contradicting business ID cannot certify identity", async () => {
  const p = provider({ contacts: [{ ...c(), businessId: "business-other1" }] });
  const result = await readGhlClientTaskState(req, p, NOW);
  assert.equal(result.reason, "unverified_contact_association");
});

test("reader handles more than one contact page with no duplicate or missing records", async () => {
  const contacts = Array.from({ length: 101 }, (_, i) => c("contact-" + String(i + 1).padStart(6, "0")));
  const p = provider({ contacts, taskResponse: { tasks: [] } });
  const result = await readGhlClientTaskState({ ...req, selectedContactId: "contact-000101" }, p, NOW);
  assert.equal(result.status, "verified_read");
  assert.equal(result.identity.associatedContacts.length, 101);
  assert.deepEqual(p.calls.filter((x) => x[0] === "contacts").map((x) => x[1]), [0, 100]);
  assert.deepEqual(result.taskReadback.tasks, []);
});

test("failed GHL read or invalid task result never appears as successfully checked", async () => {
  const p = provider({ taskResponse: { error: "permission denied" } });
  assert.equal((await readGhlClientTaskState(req, p, NOW)).status, "not_checked");
  const failing = provider();
  failing.readContactTasks = async () => { throw new Error("internal secret must not surface"); };
  const result = await readGhlClientTaskState(req, failing, NOW);
  assert.equal(result.reason, "ghl_read_unavailable");
  assert.equal(JSON.stringify(result).includes("internal secret"), false);
});
