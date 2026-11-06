/**
 * Restricted server-side relay for the published GHL workflow
 * "Client Compass | Coordination Task Intake".
 *
 * It is deliberately OFF by default. It never exposes the workflow webhook URL
 * to the static browser and never creates tasks through the GHL API.
 */
import { lookupGhlClientTasks } from "./ghl-provider.mjs";
import { prepareGhlTaskIntake } from "../../src/lib/compass/ghl-task-intake-preflight.mjs";
import { assessGhlTaskOverlap } from "../../src/lib/compass/ghl-task-awareness.mjs";

const WEBHOOK_HOST = "services.leadconnectorhq.com";
const ID = /^[A-Za-z0-9_-]{8,128}$/;
const TEXT_MAX = { companyName: 200, taskTitle: 120, taskDetails: 2000 };
const WRITE_TIMEOUT_MS = 8000;

export function workflowWebhookUrl(raw) {
  if (typeof raw !== "string") return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  // Do not accept arbitrary hosts, protocol downgrades, userinfo, extra port,
  // query params, fragments or arbitrary API endpoints as a write destination.
  if (url.protocol !== "https:" || url.hostname !== WEBHOOK_HOST ||
    url.port || url.username || url.password || url.search || url.hash ||
    !/^\/hooks\/[A-Za-z0-9_-]+\/webhook-trigger\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null;
  return url.toString();
}

export function validTaskWriteRuntime(env) {
  return env?.CLIENT_COMPASS_GHL_TASK_SEND_ENABLED === "true" &&
    env?.GHL_WORKFLOW_DUPLICATE_GUARD_VERIFIED === "true" &&
    !!workflowWebhookUrl(env.GHL_COORDINATION_TASK_INTAKE_WEBHOOK_URL);
}

function isString(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function validateTaskWriteRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    !["clientId","businessId","contactId","requestId"].every((k) => typeof value[k] === "string" && ID.test(value[k])) ||
    !isString(value.companyName, TEXT_MAX.companyName) ||
    !isString(value.taskTitle, TEXT_MAX.taskTitle) ||
    typeof value.taskDetails !== "string" || value.taskDetails.length > TEXT_MAX.taskDetails ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.dueTime) ||
    !isString(value.timeZone, 60) ||
    value.confirmTaskCreation !== true) return false;
  return true;
}

const rejected = (reason) => ({ status: "blocked", reason, webhookAccepted: false });

/**
 * A successful webhook HTTP response only says "accepted": it does NOT prove
 * that the workflow ran or an actual GHL task was persisted. Never retry
 * automatically on timeout or an ambiguous response.
 */
export async function deliverCoordinationTask(input, env, {
  lookup = lookupGhlClientTasks,
  send = globalThis.fetch,
} = {}) {
  if (!validTaskWriteRuntime(env)) return rejected("task_writer_not_configured");
  if (!validateTaskWriteRequest(input)) return rejected("invalid_task_request");
  if (typeof lookup !== "function" || typeof send !== "function") return rejected("missing_trusted_provider");

  const { clientId, businessId, contactId, companyName, requestId, taskTitle,
    taskDetails, dueDate, dueTime, timeZone } = input;
  let verified;
  try {
    verified = await lookup({
      clientId, businessId, selectedContactId: contactId,
      expectedCompanyName: companyName,
    }, env);
  } catch {
    return rejected("ghl_read_failed");
  }
  if (verified?.status !== "verified_read" ||
      verified.identity?.businessId !== businessId ||
      verified.identity?.selectedContactId !== contactId ||
      verified.taskReadback?.businessId !== businessId ||
      verified.taskReadback?.contactId !== contactId) {
    return rejected("unverified_ghl_contact");
  }

  const proposal = prepareGhlTaskIntake({
    clientId, companyName, requestId, taskTitle, taskDetails,
    dueDate, dueTime, timeZone, ownerName: "Patric Beckman",
    identity: verified.identity,
  });
  if (proposal.status !== "prepared_not_sent") return rejected(proposal.reason);

  const overlap = assessGhlTaskOverlap(verified.taskReadback, {
    clientId, companyName, requestId, taskTitle,
  });
  if (overlap.status !== "no_similar_open_tasks_found") {
    // Block on any uncertainty, an existing identical request, or a similar
    // open task. No user-controlled "force" flag bypasses this check.
    return rejected(overlap.status);
  }
  const url = workflowWebhookUrl(env.GHL_COORDINATION_TASK_INTAKE_WEBHOOK_URL);
  if (!url) return rejected("invalid_workflow_destination");

  try {
    const response = await send(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(proposal.payload),
    });
    if (response?.ok) {
      return {
        status: "accepted_unverified",
        webhookAccepted: true,
        requestId, contactId, businessId,
        message: "GHL webhook accepted the request. Confirm task ID in GHL before calling this completed.",
      };
    }
    // A failure response can be late or ambiguous; never auto retry.
    return { status: "submission_outcome_unknown", webhookAccepted: false, requestId };
  } catch {
    return { status: "submission_outcome_unknown", webhookAccepted: false, requestId };
  }
}
