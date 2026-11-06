import test from "node:test";
import assert from "node:assert/strict";
import {
  createGhlBrowserApi, localGhlDueToIso, parseLocalSettings, normalizedGhlName,
} from "../src/lib/compass/ghl-browser-api.mjs";

const locationId = "EHEhS0N72GQuZrYYzyAJ";
const token = "test-only-private-integration-token-123456789";
const apiConfig = { token, locationId };
const json = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test("local settings are validated without putting secrets in public configuration", () => {
  assert.equal(parseLocalSettings(null), null);
  assert.equal(parseLocalSettings({ token, locationId: "!" }), null);
  assert.deepEqual(parseLocalSettings({ token, locationId, assigneeId: "user-patric-0001" }),
    { token, locationId, assigneeId: "user-patric-0001" });
  assert.equal(normalizedGhlName("  ABC   Family Dentistry "), "abc family dentistry");
});

test("browser GHL requests use a fixed origin, scoped IDs, and authorization header only", async () => {
  const requests = [];
  const request = async (url, options) => {
    requests.push({ url, options });
    const u = new URL(url);
    assert.equal(u.origin, "https://services.leadconnectorhq.com");
    assert.equal(options.headers.Authorization, "Bearer " + token);
    assert.equal(options.headers.Version, "v3");
    assert.equal(url.includes(token), false);
    if (u.pathname === "/businesses/") {
      assert.equal(u.searchParams.get("locationId"), locationId);
      return json({ businesses: [
        { id: "business-0001", name: "ABC Family Dentistry", locationId },
      ] });
    }
    if (u.pathname === "/businesses/business-0001") {
      return json({ business: { id: "business-0001", name: "ABC Family Dentistry", locationId } });
    }
    if (u.pathname === "/contacts/business/business-0001") {
      return json({ count: 1, contacts: [
        { id: "contact-0001", locationId, businessId: "business-0001" },
      ] });
    }
    if (u.pathname === "/contacts/contact-0001/tasks" && options.method === "GET") {
      return json({ tasks: [{
        id: "existing-task-0001", contactId: "contact-0001",
        title: "Annual Review", completed: false, dueDate: "2027-07-01T14:00:00.000Z",
      }] });
    }
    throw Error("Unexpected URL");
  };
  const client = createGhlBrowserApi({ ...apiConfig, request });
  const businesses = await client.listBusinesses();
  assert.deepEqual(businesses.map((item) => item.businessId), ["business-0001"]);
  const read = await client.verifyClient({
    clientId: "compass-client-0001", businessId: "business-0001",
    companyName: "ABC Family Dentistry",
  });
  assert.equal(read.status, "verified_read");
  assert.equal(read.identity.selectedContactId, "contact-0001");
  assert.equal(read.taskReadback.tasks.length, 1);
  assert.equal(requests.length, 4);
});

test("invalid company name or tenant fails closed before private contact task read", async () => {
  let calls = 0;
  const client = createGhlBrowserApi({ ...apiConfig, request: async (url) => {
    calls++;
    if (new URL(url).pathname === "/businesses/business-0001") {
      return json({ business: { id: "business-0001", locationId, name: "Different Company" } });
    }
    throw Error("Contact lookup should never happen");
  } });
  const result = await client.verifyClient({
    clientId: "compass-client-0001", businessId: "business-0001",
    companyName: "ABC Family Dentistry",
  });
  assert.equal(result.status, "not_checked");
  assert.equal(result.reason, "business_name_mismatch");
  assert.equal(calls, 1);
});

test("contact task create uses ISO UTC, explicit assigned user and returns a real task id", async () => {
  let posts = 0;
  const client = createGhlBrowserApi({ ...apiConfig, request: async (url, options) => {
    const u = new URL(url);
    assert.equal(u.pathname, "/contacts/contact-0001/tasks");
    assert.equal(options.method, "POST");
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload, {
      title: "Coordination Call - ABC Family Dentistry",
      body: "Client Compass Request ID: cc-request-0001",
      dueDate: "2026-11-06T20:00:00.000Z",
      completed: false,
      assignedTo: "user-patric-0001",
    });
    posts++;
    return json({ task: { id: "task-created-0001" } }, 201);
  } });
  const createdId = await client.createContactTask({
    contactId: "contact-0001",
    title: "Coordination Call - ABC Family Dentistry",
    body: "Client Compass Request ID: cc-request-0001",
    dueDate: localGhlDueToIso("2026-11-06", "14:00", "America/Chicago"),
    assignedTo: "user-patric-0001",
  });
  assert.equal(createdId, "task-created-0001");
  assert.equal(posts, 1);
});

test("browser/CORS errors are explicit and never silently fall back to another endpoint", async () => {
  let calls = 0;
  const client = createGhlBrowserApi({ ...apiConfig, request: async () => {
    calls++;
    throw TypeError("Failed to fetch");
  } });
  await assert.rejects(() => client.listBusinesses(), /CORS policy or a network issue/);
  assert.equal(calls, 1);
});

test("date conversion handles central, eastern, DST gaps and ambiguous times without guessing", () => {
  assert.equal(localGhlDueToIso("2026-11-06", "14:00", "America/Chicago"), "2026-11-06T20:00:00.000Z");
  assert.equal(localGhlDueToIso("2026-07-06", "14:00", "America/Chicago"), "2026-07-06T19:00:00.000Z");
  assert.equal(localGhlDueToIso("2026-11-06", "14:00", "America/New_York"), "2026-11-06T19:00:00.000Z");
  assert.throws(() => localGhlDueToIso("2027-03-14", "02:30", "America/Chicago"), /does not exist/);
  assert.throws(() => localGhlDueToIso("2027-11-07", "01:30", "America/Chicago"), /ambiguous/);
});


test("company contacts are matched by exact company name with no separate Business record", async () => {
  const companyName = "Georgia Microendodontics of Marietta";
  const calls = [];
  const client = createGhlBrowserApi({
    ...apiConfig,
    request: async (url, options) => {
      const path = new URL(url).pathname;
      calls.push(path);
      assert.equal(options.headers.Authorization, "Bearer " + token);
      if (path === "/contacts/search") {
        assert.equal(options.method, "POST");
        const search = JSON.parse(options.body);
        assert.equal(search.locationId, locationId);
        assert.deepEqual(search.filters[0].filters.map((filter) => filter.field),
          ["companyName", "businessName"]);
        return json({ total: 1, contacts: [{
          id: "contact-georgia-0001", companyName, locationId,
          firstName: "Practice", lastName: "Manager", email: "front@example.test",
        }] });
      }
      if (path === "/contacts/contact-georgia-0001") {
        return json({ contact: {
          id: "contact-georgia-0001", companyName, locationId,
        } });
      }
      if (path === "/contacts/contact-georgia-0001/tasks") {
        return json({ tasks: [{
          id: "existing-task-001", contactId: "contact-georgia-0001",
          title: "Prior scheduled call", completed: false,
        }] });
      }
      throw Error("Unexpected URL " + path);
    },
  });
  const contacts = await client.findCompanyContacts(companyName);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].displayName, "Practice Manager");
  const verified = await client.verifyCompanyContact(contacts[0].id, companyName);
  assert.equal(verified.tasks.length, 1);
  assert.deepEqual(calls, [
    "/contacts/search", "/contacts/contact-georgia-0001",
    "/contacts/contact-georgia-0001/tasks",
  ]);
});

test("company lookup rejects incomplete pages and cross-location contacts", async () => {
  const name = "Example Practice";
  const incomplete = createGhlBrowserApi({ ...apiConfig, request: async () =>
    json({ total: 125, contacts: Array.from({ length: 100 }, (_, index) => ({
      id: "contact-" + index + "-0001", locationId, companyName: name,
    })) }) });
  await assert.rejects(() => incomplete.findCompanyContacts(name), /incomplete/);
  const foreign = createGhlBrowserApi({ ...apiConfig, request: async () =>
    json({ total: 1, contacts: [{
      id: "contact-foreign-001", locationId: "another-location-0001", companyName: name,
    }] }) });
  await assert.rejects(() => foreign.findCompanyContacts(name), /unexpected/);
});

test("saved company contact must still belong to exact company and location", async () => {
  let readTasks = 0;
  const client = createGhlBrowserApi({ ...apiConfig, request: async (url) => {
    const path = new URL(url).pathname;
    if (path === "/contacts/contact-0001")
      return json({ contact: { id: "contact-0001", locationId, companyName: "Someone Else" } });
    if (path.endsWith("/tasks")) readTasks++;
    throw Error("should not read another company's task data");
  } });
  await assert.rejects(() => client.verifyCompanyContact("contact-0001", "Example Practice"), /no longer matches/);
  assert.equal(readTasks, 0);
});
