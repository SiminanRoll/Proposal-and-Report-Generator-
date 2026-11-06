/**
 * Read-only GHL contact-task awareness for Client Compass.
 *
 * Pure data parser. Does NOT access GHL, supply credentials, create/update
 * tasks, verify business identity or authorize a submission. Call ONLY with a
 * response independently fetched from the authenticated GHL contact-task API.
 * The browser can forge booleans; evidence values are NOT authentication.
 *
 * API shape: GET /contacts/:contactId/tasks -> { tasks: [
 *   { id, contactId, title, body, assignedTo, dueDate, completed }
 * ] }
 */

const ID = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_AGE_MS = 5 * 60 * 1000;
const trimmed = (value) => typeof value === "string" ? value.trim() : "";
const validId = (value) => ID.test(trimmed(value));

function unknown(clientId, reason) {
  return { clientId, status: "not_checked", reason, tasks: [], checkedAt: "" };
}
function unavailable(clientId, reason) {
  return { clientId, status: "unavailable", reason, tasks: [], checkedAt: "" };
}

function normalizedDate(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? new Date(instant).toISOString() : "";
}

function normalizeTask(raw, contactId, nowMs) {
  if (!raw || typeof raw !== "object" || !validId(raw.id) ||
      trimmed(raw.contactId) !== contactId ||
      typeof raw.title !== "string" || typeof raw.completed !== "boolean") return null;
  // GHL may omit dueDate on unscheduled tasks; an invalid nonempty date is
  // an invalid read, never silently interpreted as "not scheduled".
  const dueDate = raw.dueDate == null || raw.dueDate === "" ? "" : normalizedDate(raw.dueDate);
  if (raw.dueDate != null && raw.dueDate !== "" && !dueDate) return null;
  return {
    id: trimmed(raw.id),
    contactId,
    title: trimmed(raw.title),
    body: trimmed(raw.body),
    assignedTo: trimmed(raw.assignedTo),
    dueDate,
    completed: raw.completed,
    status: raw.completed ? "completed" : !dueDate ? "unscheduled" :
      Date.parse(dueDate) < nowMs ? "overdue" : "scheduled",
  };
}

/**
 * Convert a complete API response supplied by a future trusted read adapter.
 * No available secure adapter is wired into the current static PWA.
 *
 * Preconditions supplied by that adapter:
 *  - The EXISTING GHL business/contact association was checked, not guessed.
 *  - The task response was fetched for exactly that contact.
 *  - The task list is complete and successful; API errors are not empty lists.
 *  - checkedAt is recent enough for a meaningful preview.
 *
 * A contact can serve multiple businesses: this is a CONTACT task snapshot,
 * not a claim that every task refers to the selected company.
 */
export function normalizeGhlTaskReadback(input, now = new Date().toISOString()) {
  const clientId = trimmed(input?.clientId);
  if (!clientId) return unknown("", "missing_client");
  const businessId = trimmed(input?.businessId);
  const contactId = trimmed(input?.contactId);
  if (!validId(businessId) || !validId(contactId) ||
      input?.associationVerified !== true || input?.source !== "authenticated_ghl_api") {
    return unknown(clientId, "association_not_verified");
  }
  if (input?.listComplete !== true) {
    return unavailable(clientId, "task_list_incomplete");
  }

  const nowMs = Date.parse(now);
  const checkedAt = normalizedDate(input?.checkedAt);
  const checkedMs = Date.parse(checkedAt);
  if (!Number.isFinite(nowMs) || !checkedAt || checkedMs > nowMs + 15_000 ||
      nowMs - checkedMs > MAX_AGE_MS) return unavailable(clientId, "task_readback_stale");

  if (!input?.response || !Array.isArray(input.response.tasks)) {
    return unavailable(clientId, "invalid_task_response");
  }
  const tasks = [];
  const ids = new Set();
  for (const raw of input.response.tasks) {
    const task = normalizeTask(raw, contactId, nowMs);
    if (!task || ids.has(task.id)) return unavailable(clientId, "unverified_task_record");
    ids.add(task.id);
    tasks.push(task);
  }

  tasks.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1) ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    a.title.localeCompare(b.title));
  return {
    clientId,
    businessId,
    contactId,
    status: "verified_read",
    reason: "",
    checkedAt,
    tasks,
  };
}

const normalizeLabel = (value) => trimmed(value).toLowerCase().replace(/\s+/g, " ");
function hasRequestMarker(body, requestId) {
  if (!requestId || !validId(requestId)) return false;
  // A whole-line machine marker, not a substring search. Production workflow
  // must be verified to actually persist this marker before relying on it.
  return trimmed(body).split(/\r?\n/).some((line) =>
    normalizeLabel(line) === "client compass request id: " + requestId.toLowerCase());
}

/**
 * Surfacing similar tasks is informational, not a concurrency-safe lock.
 * Exact repeat of an existing request is distinct from a possible new task.
 * Do not block unrelated tasks merely because the contact has open work.
 */
export function assessGhlTaskOverlap(snapshot, proposal) {
  if (!snapshot || snapshot.status !== "verified_read" ||
      snapshot.clientId !== trimmed(proposal?.clientId)) {
    return { status: "not_checked", matchingTaskIds: [], openTaskCount: 0, counts: null };
  }
  const counts = {
    scheduled: snapshot.tasks.filter((task) => task.status === "scheduled").length,
    overdue: snapshot.tasks.filter((task) => task.status === "overdue").length,
    unscheduled: snapshot.tasks.filter((task) => task.status === "unscheduled").length,
    completed: snapshot.tasks.filter((task) => task.status === "completed").length,
  };
  const requestId = trimmed(proposal?.requestId);
  const repeated = snapshot.tasks.filter((task) => hasRequestMarker(task.body, requestId));
  if (repeated.length) {
    return { status: "request_already_present", matchingTaskIds: repeated.map((task) => task.id), openTaskCount: counts.scheduled + counts.overdue + counts.unscheduled, counts };
  }
  const taskTitle = normalizeLabel(proposal?.taskTitle || "Coordination Call");
  const companyName = normalizeLabel(proposal?.companyName);
  // The API is contact-scoped, and a contact may serve multiple companies.
  // The title alone is a potential overlap, NOT verified company ownership.
  const similar = snapshot.tasks.filter((task) =>
    !task.completed && taskTitle && normalizeLabel(task.title).includes(taskTitle));
  if (similar.length) {
    const withCompany = similar.filter((task) => companyName && normalizeLabel(task.title).includes(companyName));
    return {
      status: "possible_overlap",
      matchingTaskIds: similar.map((task) => task.id),
      companyNamedTaskIds: withCompany.map((task) => task.id),
      openTaskCount: counts.scheduled + counts.overdue + counts.unscheduled,
      counts,
    };
  }
  return {
    status: "no_similar_open_tasks_found",
    matchingTaskIds: [],
    openTaskCount: counts.scheduled + counts.overdue + counts.unscheduled,
    counts,
  };
}
