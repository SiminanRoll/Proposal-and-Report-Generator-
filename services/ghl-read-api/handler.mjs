/**
 * Fail-closed GHL read-only HTTP endpoint for DigitalOcean App Platform.
 *
 * SECURITY NOTES:
 * - Never make this service public until CLIENT_COMPASS_READER_ACCESS_TOKEN
 *   is a separate, high-entropy secret stored in DigitalOcean RUN_TIME.
 * - It is NOT the GHL Private Integration Token; never share the GHL token
 *   with the browser. The reader access secret is entered by a user per session.
 * - Production-grade employee identity via SSO remains preferable; this gate
 *   is a temporary explicit credential mechanism, not user-level authorization.
 * - Route only /api/ghl/* to this Node component; static PWA remains unchanged.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { lookupGhlClientTasks, lookupGhlBusinessMatches } from "./ghl-provider.mjs";
import { deliverCoordinationTask, validTaskWriteRuntime, validateTaskWriteRequest } from "./ghl-workflow-relay.mjs";

// DigitalOcean App Platform strips HTTP route prefixes unless the App Spec
// enables preserve_path_prefix. Support either routing mode, but no other path.
const READ_PATHS = new Set(["/api/ghl/tasks/read", "/tasks/read"]);
const MATCH_PATHS = new Set(["/api/ghl/businesses/matches", "/businesses/matches"]);
const SUBMIT_PATHS = new Set(["/api/ghl/tasks/submit", "/tasks/submit"]);
const HEALTH_PATHS = new Set(["/api/ghl/health", "/health"]);
const ID = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_BYTES = 16_384;

function respond(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
  });
  res.end(JSON.stringify(payload));
}

function constantTimeSame(a, b) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function originAllowed(value, allowed) {
  // No CORS support: service is a same-origin route. Bearer-auth CLI clients
  // with no Origin header are also supported. Reject unexpected origins.
  return !value || value === allowed;
}

function validRuntime(env) {
  return typeof env.GHL_PRIVATE_INTEGRATION_TOKEN === "string" &&
    env.GHL_PRIVATE_INTEGRATION_TOKEN.length >= 20 &&
    typeof env.GHL_LOCATION_ID === "string" && ID.test(env.GHL_LOCATION_ID) &&
    typeof env.CLIENT_COMPASS_READER_ACCESS_TOKEN === "string" &&
    env.CLIENT_COMPASS_READER_ACCESS_TOKEN.length >= 32 &&
    typeof env.CLIENT_COMPASS_ALLOWED_ORIGIN === "string" &&
    /^https:\/\/[^/\s?#]+$/.test(env.CLIENT_COMPASS_ALLOWED_ORIGIN);
}

async function readJson(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid_json"); }
}

export function createReaderHandler({
  env = process.env,
  lookup = lookupGhlClientTasks,
  lookupMatches = lookupGhlBusinessMatches,
  deliverTask = deliverCoordinationTask,
} = {}) {
  // In-process duplicate reduction; the GHL workflow must independently
  // enforce a durable request-ID guard across replicas and restarts.
  const inflight = new Set();
  const recent = new Map();
  return async (req, res) => {
    const path = (req.url || "").split("?")[0];
    if (HEALTH_PATHS.has(path) && req.method === "GET") {
      return respond(res, 200, { ok: true, service: "ghl-read-api" });
    }
    if (!READ_PATHS.has(path) && !MATCH_PATHS.has(path) && !SUBMIT_PATHS.has(path)) return respond(res, 404, { error: "not_found" });
    if (req.method !== "POST") return respond(res, 405, { error: "method_not_allowed" });
    if (!validRuntime(env)) return respond(res, 503, { error: "not_configured" });
    if (!originAllowed(req.headers?.origin, env.CLIENT_COMPASS_ALLOWED_ORIGIN)) {
      return respond(res, 403, { error: "origin_not_allowed" });
    }
    const writing = SUBMIT_PATHS.has(path);
    if (writing && (!validTaskWriteRuntime(env) || typeof env.CLIENT_COMPASS_WRITER_ACCESS_TOKEN !== "string" || env.CLIENT_COMPASS_WRITER_ACCESS_TOKEN.length < 32 || env.CLIENT_COMPASS_WRITER_ACCESS_TOKEN === env.CLIENT_COMPASS_READER_ACCESS_TOKEN)) return respond(res, 503, { error: "task_writer_not_configured" });
    const match = /^Bearer ([^\s]+)$/.exec(req.headers?.authorization || "");
    if (!match || !constantTimeSame(match[1], writing ? env.CLIENT_COMPASS_WRITER_ACCESS_TOKEN : env.CLIENT_COMPASS_READER_ACCESS_TOKEN)) {
      return respond(res, 401, { error: "not_authorized" });
    }
    if (!(req.headers?.["content-type"] || "").toLowerCase().startsWith("application/json")) {
      return respond(res, 415, { error: "json_required" });
    }
    let body;
    try { body = await readJson(req); }
    catch (err) { return respond(res, err.message === "payload_too_large" ? 413 : 400,
      { error: err.message === "payload_too_large" ? "payload_too_large" : "invalid_json" }); }
    if (writing) {
      if (!validateTaskWriteRequest(body)) return respond(res, 400, { error: "invalid_task_request" });
      const key = body.requestId;
      const contact = body.contactId;
      if (recent.has(key)) return respond(res, 409, { error: "request_already_submitted_or_uncertain", requestId: key });
      if (inflight.has(key) || inflight.has("contact:" + contact)) return respond(res, 409, { error: "concurrent_task_submission" });
      inflight.add(key);
      inflight.add("contact:" + contact);
      try {
        const outcome = await deliverTask(body, env);
        if (outcome.status === "accepted_unverified" || outcome.status === "submission_outcome_unknown") {
          recent.set(key, Date.now());
          if (recent.size > 1000) recent.delete(recent.keys().next().value);
        }
        return respond(res, outcome.status === "accepted_unverified" ? 202 :
          outcome.status === "blocked" ? 409 : 502, outcome);
      } catch {
        recent.set(key, Date.now());
        return respond(res, 502, { status: "submission_outcome_unknown", webhookAccepted: false, requestId: key });
      } finally {
        inflight.delete(key);
        inflight.delete("contact:" + contact);
      }
    }
    if (MATCH_PATHS.has(path)) {
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          !Array.isArray(body.clients) || !body.clients.length || body.clients.length > 50 ||
          body.clients.some((entry) => !entry || typeof entry !== "object" ||
            typeof entry.clientId !== "string" || !ID.test(entry.clientId) ||
            typeof entry.companyName !== "string" ||
            !entry.companyName.trim() || entry.companyName.length > 200)) {
        return respond(res, 400, { error: "invalid_business_match_request" });
      }
      try {
        return respond(res, 200, await lookupMatches(body.clients, env));
      } catch {
        return respond(res, 502, { error: "ghl_read_unavailable" });
      }
    }
    const clientId = body?.clientId;
    const businessId = body?.businessId;
    const selectedContactId = body?.selectedContactId;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      typeof clientId !== "string" || !ID.test(clientId) ||
      typeof businessId !== "string" || !ID.test(businessId) ||
      (selectedContactId != null &&
        (typeof selectedContactId !== "string" || !ID.test(selectedContactId))) ||
      (body.companyName != null &&
        (typeof body.companyName !== "string" || !body.companyName.trim() || body.companyName.length > 200))) {
      return respond(res, 400, { error: "invalid_identifiers" });
    }
    try {
      const request = { clientId, businessId, selectedContactId };
      if (body.companyName) request.expectedCompanyName = body.companyName;
      const result = await lookup(request, env);
      return respond(res, 200, result);
    } catch {
      // Never leak upstream response data, tokens, or internal stack traces.
      return respond(res, 502, { error: "ghl_read_unavailable" });
    }
  };
}
