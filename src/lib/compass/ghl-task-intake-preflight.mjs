/**
 * Client Compass → existing GHL Inbound Webhook task-intake preflight.
 *
 * Pure, offline contract. This module DOES NOT make network requests, store
 * webhook URLs, authenticate to GHL, prove an identity association, create
 * tasks, or certify idempotency. It must not be wired to a live send button
 * until the GHL mapping, CORS, date persistence and readback have been tested.
 */

const ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRealId(value) {
  const id = text(value);
  return ID_PATTERN.test(id) && !/^(sample|example|placeholder|test)-/i.test(id);
}

function validDate(value) {
  const match = DATE_PATTERN.exec(text(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2020 || year > 2100) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
}

function validZone(value) {
  const zone = text(value);
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Format a selected LOCAL wall-clock due date for GHL workflow Add Task.
 * This does NOT convert to UTC. Workflow location timezone must be verified.
 */
export function formatGhlWorkflowDueDate(localDate, localTime) {
  if (!validDate(localDate)) throw new Error("Invalid due date.");
  const time = TIME_PATTERN.exec(text(localTime));
  if (!time) throw new Error("Invalid local due time; expected HH:mm (24-hour).");
  const [year, month, day] = localDate.split("-");
  const hours = Number(time[1]);
  const twelve = String(hours % 12 || 12).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  return month + "-" + day + "-" + year + " " + twelve + ":" + time[2] + " " + ampm;
}

function block(clientId, reason, detail) {
  return { clientId, status: "blocked", reason, detail };
}

/**
 * Prepare ONE existing-contact request for review, without sending.
 *
 * identity represents an association already checked against GHL by the
 * calling integration. Passing verified:true is only a preflight assertion:
 * browser-controlled data is NOT proof that GHL verification occurred.
 */
export function prepareGhlTaskIntake(entry) {
  const clientId = text(entry?.clientId);
  const companyName = text(entry?.companyName);
  if (!clientId || !companyName) {
    return block(clientId, "invalid_client", "Client Compass client ID and company name are required.");
  }

  const identity = entry?.identity;
  const businessId = text(identity?.businessId);
  if (identity?.verified !== true || !isRealId(businessId)) {
    return block(clientId, "unresolved_business", "An existing GHL business ID must be explicitly verified.");
  }

  // Candidate list must come from an authenticated GHL business-contact
  // association lookup, not a name/phone/email guess.
  const contacts = Array.isArray(identity?.associatedContacts) ? identity.associatedContacts : [];
  const linked = [...new Map(contacts.filter((contact) =>
    contact?.associationVerified === true &&
    text(contact?.businessId) === businessId &&
    isRealId(contact?.contactId),
  ).map((contact) => [contact.contactId, contact])).values()];

  if (!linked.length) {
    return block(clientId, "missing_contact", "No verified contact associated with this business.");
  }

  const chosen = text(identity?.selectedContactId);
  if (!chosen && linked.length > 1) {
    return block(clientId, "ambiguous_contact", "Multiple associated contacts; select the intended person in GHL.");
  }
  const selected = chosen ? linked.find((contact) => contact.contactId === chosen) : linked[0];
  if (!selected) {
    return block(clientId, "unverified_association", "Selected contact is not verified for this GHL business.");
  }

  const requestId = text(entry?.requestId);
  if (!isRealId(requestId)) {
    return block(clientId, "missing_request_id", "A stable, non-sample request ID is required for retries.");
  }

  const ownerName = text(entry?.ownerName) || "Patric Beckman";
  if (ownerName !== "Patric Beckman") {
    return block(clientId, "unsupported_owner", "Current GHL Add Task action is assigned only to Patric Beckman.");
  }

  const localDate = text(entry?.dueDate);
  const localTime = text(entry?.dueTime);
  const timeZone = text(entry?.timeZone);
  if (!validDate(localDate) || !TIME_PATTERN.test(localTime) || !validZone(timeZone)) {
    return block(clientId, "invalid_due_date", "Explicit local date, 24-hour time, and valid timezone are required.");
  }

  const baseTitle = text(entry?.taskTitle) || "Coordination Call";
  if (baseTitle.length > 120 || companyName.length > 200 || baseTitle.toLowerCase().includes(companyName.toLowerCase())) {
    return block(clientId, "invalid_task_title", "Use a short base task title; GHL appends the company name separately.");
  }
  const details = text(entry?.taskDetails);
  if (details.length > 2000) {
    return block(clientId, "invalid_details", "Task details exceed 2,000 characters.");
  }

  return {
    clientId,
    status: "prepared_not_sent",
    contactId: selected.contactId,
    businessId,
    payload: {
      companyId: businessId,
      contactId: selected.contactId,
      companyName,
      taskTitle: baseTitle,
      taskDetails: details,
      dueDate: formatGhlWorkflowDueDate(localDate, localTime),
      timeZone,
      requestId,
      clientId,
    },
  };
}

/**
 * Prepare a multi-client selection, producing one independent result per input.
 * Detects duplicate selections and same-batch request ID collisions. Also
 * blocks contacts reused across different businesses in this batch because
 * the draft GHL workflow has only ONE request-ID field per contact.
 *
 * This is not a durable/atomic idempotency mechanism.
 */
export function prepareGhlTaskIntakeBatch(entries) {
  if (!Array.isArray(entries)) throw new Error("Expected an array of clients.");
  const results = entries.map(prepareGhlTaskIntake);
  const seenClients = new Map();
  const seenRequests = new Map();
  const byContact = new Map();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result.clientId) continue;
    if (seenClients.has(result.clientId)) {
      results[i] = block(result.clientId, "duplicate_in_batch", "This client is already selected in the batch.");
      continue;
    }
    seenClients.set(result.clientId, i);
    if (result.status !== "prepared_not_sent") continue;
    const requestId = result.payload.requestId;
    if (seenRequests.has(requestId)) {
      results[i] = block(result.clientId, "duplicate_request_id", "This request ID is already used by another client.");
      continue;
    }
    seenRequests.set(requestId, i);
    const list = byContact.get(result.contactId) ?? [];
    list.push(i);
    byContact.set(result.contactId, list);
  }

  for (const indexes of byContact.values()) {
    const businesses = new Set(indexes.map((index) => results[index].businessId).filter(Boolean));
    if (businesses.size > 1) {
      for (const index of indexes) {
        const clientId = results[index].clientId;
        results[index] = block(clientId, "shared_contact_conflict", "One contact serves multiple selected businesses; the draft contact-level request-ID guard is unsafe.");
      }
    }
  }
  return results;
}
