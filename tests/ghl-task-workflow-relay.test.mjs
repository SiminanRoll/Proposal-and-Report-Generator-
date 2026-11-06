import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { deliverCoordinationTask, workflowWebhookUrl, validTaskWriteRuntime } from "../services/ghl-read-api/ghl-workflow-relay.mjs";
import { createReaderHandler } from "../services/ghl-read-api/handler.mjs";

const NOW = new Date().toISOString();
const URL = "https://services.leadconnectorhq.com/hooks/known-location-token/webhook-trigger/trigger-0000000000001";
const env = {
  GHL_PRIVATE_INTEGRATION_TOKEN: "dummy-private-token-for-test-only-1234",
  GHL_LOCATION_ID: "location-00001",
  CLIENT_COMPASS_ALLOWED_ORIGIN: "https://compass.example.org",
  CLIENT_COMPASS_READER_ACCESS_TOKEN: "dummy-reader-secret-not-for-production-123456789",
  CLIENT_COMPASS_WRITER_ACCESS_TOKEN: "dummy-writer-secret-not-for-production-987654321",
  CLIENT_COMPASS_GHL_TASK_SEND_ENABLED: "true",
  GHL_WORKFLOW_DUPLICATE_GUARD_VERIFIED: "true",
  GHL_COORDINATION_TASK_INTAKE_WEBHOOK_URL: URL,
};
const input = {
  clientId: "client-practice-0001",
  companyName: "Example Dental",
  businessId: "business-0001",
  contactId: "contact-0001",
  requestId: "cc-task-request-0001",
  taskTitle: "Coordination Call",
  taskDetails: "Follow up on an annual review",
  dueDate: "2026-11-16",
  dueTime: "14:00",
  timeZone: "America/Chicago",
  confirmTaskCreation: true,
};
function verified(tasks = [], checkedAt = NOW) {
  return {
    status: "verified_read", clientId: input.clientId,
    identity: {
      verified: true, businessId: input.businessId,
      selectedContactId: input.contactId,
      associatedContacts: [
        { contactId: input.contactId, businessId: input.businessId, associationVerified: true },
      ],
    },
    taskReadback: {
      status: "verified_read", clientId: input.clientId,
      businessId: input.businessId, contactId: input.contactId,
      checkedAt, tasks,
    },
  };
}
const ok = { ok: true, status: 200 };
const dependencies = (snapshot = verified()) => ({
  lookup: async (query) => {
    assert.equal(query.businessId, input.businessId);
    assert.equal(query.selectedContactId, input.contactId);
    assert.equal(query.expectedCompanyName, input.companyName);
    return snapshot;
  },
});

test("rejects any non-GHL webhook destination and redirects", () => {
  assert.equal(workflowWebhookUrl(URL), URL);
  for (const u of [
    "http://services.leadconnectorhq.com/hooks/a/webhook-trigger/b",
    "https://services.leadconnectorhq.com.evil.tld/hooks/a/webhook-trigger/b",
    "https://services.leadconnectorhq.com/contacts/a/tasks",
    "https://user:pass@services.leadconnectorhq.com/hooks/a/webhook-trigger/b",
    "https://services.leadconnectorhq.com:8443/hooks/a/webhook-trigger/b",
    "https://services.leadconnectorhq.com/hooks/a/webhook-trigger/b?token=secret",
    "file:///etc/passwd", "https://127.0.0.1/hooks/a/webhook-trigger/b",
  ]) assert.equal(workflowWebhookUrl(u), null, u);
});

test("task writes fail closed unless separate workflow and duplicate guard gates are set", async () => {
  for (const key of [
    "CLIENT_COMPASS_GHL_TASK_SEND_ENABLED",
    "GHL_WORKFLOW_DUPLICATE_GUARD_VERIFIED",
    "GHL_COORDINATION_TASK_INTAKE_WEBHOOK_URL",
  ]) {
    const changed = { ...env, [key]: "" };
    assert.equal(validTaskWriteRuntime(changed), false);
    const reply = await deliverCoordinationTask(input, changed, {
      lookup: () => { throw Error("should never look up"); },
      send: () => { throw Error("should never send"); },
    });
    assert.equal(reply.status, "blocked");
  }
});

test("verifies contact and duplicate readback before forwarding exact GHL workflow JSON", async () => {
  let sends = 0;
  const send = async (url, request) => {
    sends += 1;
    assert.equal(url, URL);
    assert.equal(request.method, "POST");
    assert.equal(request.redirect, "error");
    const payload = JSON.parse(request.body);
    assert.deepEqual(Object.keys(payload).sort(), [
      "clientId","companyId","companyName","contactId","dueDate","requestId","taskDetails","taskTitle","timeZone",
    ].sort());
    assert.equal(payload.companyId, input.businessId);
    assert.equal(payload.contactId, input.contactId);
    assert.equal(payload.requestId, input.requestId);
    assert.equal(payload.dueDate, "11-16-2026 02:00 PM");
    assert.equal(payload.timeZone, input.timeZone);
    assert.equal(request.body.includes(env.GHL_PRIVATE_INTEGRATION_TOKEN), false);
    return ok;
  };
  const result = await deliverCoordinationTask(input, env, { ...dependencies(), send });
  assert.equal(sends, 1);
  assert.equal(result.status, "accepted_unverified");
  assert.equal(result.webhookAccepted, true);
  assert.equal(result.requestId, input.requestId);
  assert.equal(JSON.stringify(result).includes(URL), false);
});

test("never sends if task readback is incomplete, stale, or already overlapping", async () => {
  let sends = 0;
  const send = async () => { sends++; return ok; };
  for (const bad of [
    { status: "not_checked" },
    verified([], "2000-01-01T00:00:00.000Z"),
    verified([{
      id: "task-0001", contactId: input.contactId, title: "Coordination Call",
      body: "Other task", completed: false, status: "scheduled",
    }]),
    verified([{
      id: "task-0001", contactId: input.contactId, title: "Something else",
      body: "Client Compass Request ID: cc-task-request-0001",
      completed: true, status: "completed",
    }]),
  ]) {
    const result = await deliverCoordinationTask(input, env, { ...dependencies(bad), send });
    assert.equal(result.status, "blocked");
  }
  assert.equal(sends, 0);
});

test("unknown webhook response never reports a created task or automatically retries", async () => {
  let calls = 0;
  const send = async () => { calls++; throw Error("timeout maybe accepted"); };
  const result = await deliverCoordinationTask(input, env, { ...dependencies(), send });
  assert.equal(result.status, "submission_outcome_unknown");
  assert.equal(result.webhookAccepted, false);
  assert.equal(calls, 1);
});

async function request({
  path = "/api/ghl/tasks/submit", token = env.CLIENT_COMPASS_WRITER_ACCESS_TOKEN,
  overrides = {}, payload = input, deliverTask = async () => ({
    status: "accepted_unverified", webhookAccepted: true, requestId: input.requestId,
  }),
  handler,
} = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(payload))]);
  req.url = path;
  req.method = "POST";
  req.headers = {
    origin: env.CLIENT_COMPASS_ALLOWED_ORIGIN,
    authorization: "Bearer " + token,
    "content-type": "application/json",
  };
  let code;
  let result;
  const res = {
    writeHead(status) { code = status; },
    end(body) { result = JSON.parse(body); },
  };
  await (handler || createReaderHandler({ env: { ...env, ...overrides }, deliverTask }))(req,res);
  return { code, result };
}

test("separate writer bearer secret mandatory; reader token cannot submit", async () => {
  assert.equal((await request({ token: env.CLIENT_COMPASS_READER_ACCESS_TOKEN })).code, 401);
  assert.equal((await request({ token: "invalid" })).code, 401);
  assert.equal((await request({ overrides: { CLIENT_COMPASS_WRITER_ACCESS_TOKEN: "" } })).code, 503);
  assert.equal((await request({ overrides: { GHL_WORKFLOW_DUPLICATE_GUARD_VERIFIED: "false" } })).code, 503);
});

test("server blocks repeat request IDs even when workflow merely accepted, no second write", async () => {
  let count = 0;
  const handler = createReaderHandler({
    env,
    deliverTask: async () => { count++; return { status: "accepted_unverified", webhookAccepted: true, requestId: input.requestId }; },
  });
  assert.equal((await request({ handler })).code, 202);
  assert.equal((await request({ handler })).code, 409);
  assert.equal(count, 1);
});

test("server marks uncertain outcomes rather than risking duplicate retries", async () => {
  let count = 0;
  const handler = createReaderHandler({
    env,
    deliverTask: async () => {
      count++; return { status: "submission_outcome_unknown", webhookAccepted: false, requestId: input.requestId };
    },
  });
  assert.equal((await request({ handler })).code, 502);
  assert.equal((await request({ handler })).code, 409);
  assert.equal(count, 1);
});
