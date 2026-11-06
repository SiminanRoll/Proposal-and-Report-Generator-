import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createReaderHandler } from "../services/ghl-read-api/handler.mjs";
import { createGhlReadAdapter, lookupGhlClientTasks } from "../services/ghl-read-api/ghl-provider.mjs";

const env = {
  GHL_PRIVATE_INTEGRATION_TOKEN: "pit-a-long-private-runtime-secret-value",
  GHL_LOCATION_ID: "location-00001",
  CLIENT_COMPASS_READER_ACCESS_TOKEN: "separate-session-secret-value-at-least-32-characters",
  CLIENT_COMPASS_ALLOWED_ORIGIN: "https://compass.example.org",
};
const readBody = { clientId: "compass-0001", businessId: "business-0001", selectedContactId: "contact-0001" };

async function simulate({ method = "POST", path = "/api/ghl/tasks/read", headers = {}, body = readBody, overrides = {}, lookup = async () => ({ status: "verified_read" }) } = {}) {
  const chunks = body == null ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.url = path;
  request.method = method;
  request.headers = {
    authorization: "Bearer " + env.CLIENT_COMPASS_READER_ACCESS_TOKEN,
    origin: env.CLIENT_COMPASS_ALLOWED_ORIGIN,
    "content-type": "application/json",
    ...headers,
  };
  let status = 0;
  let responseHeaders = {};
  let responseText = "";
  const response = {
    writeHead(s, h) { status = s; responseHeaders = h; },
    end(part = "") { responseText += part; },
  };
  await createReaderHandler({ env: { ...env, ...overrides }, lookup })(request, response);
  return { status, responseHeaders, data: JSON.parse(responseText) };
}

test("private read endpoint refuses to start with only a GHL key and no separate access control", async () => {
  const r = await simulate({
    overrides: { CLIENT_COMPASS_READER_ACCESS_TOKEN: "" },
    lookup: () => { throw Error("not called"); },
  });
  assert.equal(r.status, 503);
  assert.equal(r.data.error, "not_configured");
});

test("health shows no token or sub-account identifiers", async () => {
  const r = await simulate({ method: "GET", path: "/api/ghl/health", body: null });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(JSON.stringify(r.data).includes("location-00001"), false);
  assert.equal(JSON.stringify(r.data).includes("pit-"), false);
});

test("bad secret, absent authorization and unexpected Origin cannot read GHL tasks", async () => {
  const lookup = () => { throw Error("must not run"); };
  assert.equal((await simulate({ headers: { authorization: "Bearer wrong" }, lookup })).status, 401);
  assert.equal((await simulate({ headers: { authorization: "" }, lookup })).status, 401);
  assert.equal((await simulate({ headers: { origin: "https://evil.example.net" }, lookup })).status, 403);
});

test("valid separate access secret may perform only validated, read-only lookups", async () => {
  let calls = 0;
  const lookup = async (request, suppliedEnv) => {
    calls++;
    assert.deepEqual(request, readBody);
    assert.equal(suppliedEnv.GHL_PRIVATE_INTEGRATION_TOKEN, env.GHL_PRIVATE_INTEGRATION_TOKEN);
    return { status: "verified_read", taskReadback: { tasks: [] } };
  };
  const r = await simulate({ lookup });
  assert.equal(r.status, 200);
  assert.equal(calls, 1);
  assert.equal(r.data.status, "verified_read");
  assert.equal(r.responseHeaders["cache-control"], "no-store, private");
  assert.equal(JSON.stringify(r.data).includes(env.GHL_PRIVATE_INTEGRATION_TOKEN), false);
});

test("read endpoint rejects invalid identifiers, unknown paths and non-POST", async () => {
  const lookup = () => { throw Error("must not run"); };
  assert.equal((await simulate({ body: { ...readBody, businessId: "!" }, lookup })).status, 400);
  assert.equal((await simulate({ method: "GET", lookup })).status, 405);
  assert.equal((await simulate({ path: "/api/ghl/proxy", lookup })).status, 404);
  assert.equal((await simulate({ headers: { "content-type": "text/plain" }, lookup })).status, 415);
  assert.equal((await simulate({ body: "invalid{", lookup })).status, 400);
  assert.equal((await simulate({ body: "x".repeat(3_000), lookup })).status, 413);
});

test("backend exceptions are sanitized and never reveal the private GHL credential", async () => {
  const r = await simulate({ lookup: () => { throw Error(env.GHL_PRIVATE_INTEGRATION_TOKEN); } });
  assert.equal(r.status, 502);
  assert.equal(r.data.error, "ghl_read_unavailable");
  assert.equal(JSON.stringify(r.data).includes(env.GHL_PRIVATE_INTEGRATION_TOKEN), false);
});

test("GHL provider sends private token only to fixed official upstream GET paths", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/businesses/business-0001")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => ({ business: { id: "business-0001", locationId: env.GHL_LOCATION_ID } }) };
    }
    if (url.includes("/contacts/business/")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => ({ count: 1, contacts: [{ id: "contact-0001", locationId: env.GHL_LOCATION_ID }] }) };
    }
    if (url.endsWith("/contacts/contact-0001/tasks")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => ({ tasks: [{ id: "task-00001", contactId: "contact-0001", title: "Coordination Call", completed: false, dueDate: "2090-01-01T01:00:00Z" }] }) };
    }
    throw Error("Unexpected request");
  };
  const result = await lookupGhlClientTasks(readBody, env, request);
  assert.equal(result.status, "verified_read");
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(new URL(call.url).origin, "https://services.leadconnectorhq.com");
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.headers.Version, "v3");
    assert.equal(call.options.headers.Authorization, "Bearer " + env.GHL_PRIVATE_INTEGRATION_TOKEN);
    assert.equal(call.url.includes(env.GHL_PRIVATE_INTEGRATION_TOKEN), false);
  }
});

test("malformed upstream responses do not pass as complete verified task lists", async () => {
  const badRequest = async () => ({ ok: true, headers: { get: () => "text/html" }, json: async () => ({}) });
  const result = await lookupGhlClientTasks(readBody, env, badRequest);
  assert.equal(result.status, "not_checked");
  assert.equal(result.reason, "ghl_read_unavailable");
});

test("invalid configured GHL token or location cannot yield a working provider", () => {
  assert.throws(() => createGhlReadAdapter({ token: "", locationId: env.GHL_LOCATION_ID }));
  assert.throws(() => createGhlReadAdapter({ token: env.GHL_PRIVATE_INTEGRATION_TOKEN, locationId: "invalid id" }));
});
