/**
 * Client Compass static-only, browser-local GHL Private Integration client.
 *
 * There is NO backend, no public token in source/build, and no Supabase/CLV.
 * A user-entered token lives in this browser's local storage. IMPORTANT:
 * localStorage is accessible to same-origin JavaScript and browser extensions,
 * and is not a secure credential vault. Users must explicitly accept that risk.
 * Browser requests may be blocked by GHL CORS rules; fail visibly and never
 * attempt to bypass with an unauthenticated proxy or an exposed webhook URL.
 */
import { readGhlClientTaskState } from "./ghl-trusted-task-reader.mjs";

export const GHL_LOCAL_SETTINGS_KEY = "client-compass.ghl-local-credentials.v1";
const API = "https://services.leadconnectorhq.com";
const ID = /^[a-zA-Z0-9_-]{8,128}$/;
const MAX_PAGES = 30;

export function isGhlId(value) {
  return typeof value === "string" && ID.test(value);
}
export function normalizedGhlName(value) {
  return typeof value === "string" ?
    value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") : "";
}
export function parseLocalSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.token !== "string" || value.token.length < 20 ||
      !isGhlId(value.locationId) ||
      (value.assigneeId && !isGhlId(value.assigneeId))) return null;
  return {
    token: value.token,
    locationId: value.locationId,
    assigneeId: typeof value.assigneeId === "string" ? value.assigneeId : "",
  };
}

export class GhlApiHttpError extends Error {
  constructor(status, method) {
    const isWrite = method === "POST";
    const action = isWrite ? "task action" : "read request";
    const reason =
      status === 401 ? "401 Unauthorized. Check whether your saved Private Integration token is valid for this sub-account, and enable the contacts.write scope for task creation." :
      status === 403 ? "403 Forbidden. Check that your Private Integration has contacts.write permission." :
      status === 429 ? "429 Rate limited. Retry after the limit clears." :
      "HTTP " + status + ". Check the contact and task details.";
    super("GHL rejected the " + action + " (" + reason + ")");
    this.name = "GhlApiHttpError";
    this.status = status;
    this.method = method;
    this.definitelyRejected = [400, 401, 403, 404, 422].includes(status);
  }
}

export function createGhlBrowserApi({ token, locationId, request = globalThis.fetch }) {
  if (typeof token !== "string" || token.length < 20 || !isGhlId(locationId) ||
      typeof request !== "function") throw new Error("Configure a local GHL token and location ID.");
  async function call(path, { method = "GET", query, payload } = {}) {
    if (!/^\/(?:businesses|contacts)\/[A-Za-z0-9_/?&=%.-]*$/.test(path)) {
      throw new Error("This action is not an allowed GHL endpoint.");
    }
    const url = new URL(path, API);
    if (url.origin !== API) throw new Error("Unexpected API origin.");
    if (query) for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
    let response;
    try {
      response = await request(url.toString(), {
        method,
        redirect: "error",
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + token,
          Version: "v3",
          Accept: "application/json",
          ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload != null ? { body: JSON.stringify(payload) } : {}),
      });
    } catch {
      throw new Error("Browser could not reach GHL. This may be GHL's CORS policy or a network issue. No task creation has been confirmed.");
    }
    if (!response?.ok) throw new GhlApiHttpError(response?.status || 0, method);
    try { return await response.json(); }
    catch { throw new Error("GHL returned an invalid JSON response."); }
  }
  return {
    async listBusinesses() {
      const result = [];
      const seen = new Set();
      for (let page = 0; page < MAX_PAGES; page++) {
        const data = await call("/businesses/", {
          query: { locationId, limit: 100, skip: page * 100 },
        });
        if (!Array.isArray(data?.businesses) || data.businesses.length > 100)
          throw new Error("GHL business listing was incomplete.");
        for (const b of data.businesses) {
          if (!isGhlId(b?.id) || typeof b?.name !== "string" ||
              b.locationId !== locationId || seen.has(b.id))
            throw new Error("GHL returned invalid or cross-location business data.");
          seen.add(b.id);
          result.push({ businessId: b.id, name: b.name });
        }
        if (data.businesses.length < 100) return result;
      }
      throw new Error("GHL has more business pages than this client can safely verify.");
    },
    async readBusiness(businessId) {
      if (!isGhlId(businessId)) throw new Error("Invalid business ID.");
      return call("/businesses/" + businessId);
    },
    async listContactsByBusiness({ businessId, locationId: requestedLocation, skip, limit }) {
      if (!isGhlId(businessId) || requestedLocation !== locationId ||
          !Number.isInteger(skip) || skip < 0 ||
          !Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new Error("Invalid associated-contact lookup.");
      return call("/contacts/business/" + businessId, {
        query: { locationId, skip, limit },
      });
    },

    /**
     * Some existing GHL client records are contacts carrying companyName,
     * not separate entries in the GHL Businesses collection. Search the
     * contact registry by exact company name before asking for any manual
     * association. Never silently select the first of multiple matches.
     */
    async findCompanyContacts(companyName) {
      const name = typeof companyName === "string" ? companyName.trim() : "";
      if (!name || name.length > 200) throw new Error("A company name is required.");
      const result = await call("/contacts/search", {
        method: "POST",
        payload: {
          locationId, pageLimit: 100, page: 1,
          filters: [{
            group: "OR",
            filters: [
              { field: "companyName", operator: "eq", value: name },
              { field: "businessName", operator: "eq", value: name },
            ],
          }],
        },
      });
      if (!Array.isArray(result?.contacts) || !Number.isSafeInteger(result?.total) ||
          result.total > 100 || result.total < 0)
        throw new Error("GHL's company contact search was incomplete. Open the contact in GHL.");
      const matches = result.contacts.filter((contact) =>
        isGhlId(contact?.id) && contact.locationId === locationId &&
        (normalizedGhlName(contact.companyName) === normalizedGhlName(name) ||
         normalizedGhlName(contact.businessName) === normalizedGhlName(name)));
      if (matches.length !== result.contacts.length)
        throw new Error("GHL returned unexpected company contact data. No task will be created.");
      return matches.map((contact) => ({
        id: contact.id,
        companyName: name,
        displayName: [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
          contact.contactName || contact.email || contact.id,
        email: typeof contact.email === "string" ? contact.email : "",
      }));
    },
    async readContact(contactId) {
      if (!isGhlId(contactId)) throw new Error("Invalid contact ID.");
      const result = await call("/contacts/" + contactId);
      const contact = result?.contact;
      if (!isGhlId(contact?.id) || contact.id !== contactId ||
          contact.locationId !== locationId) throw new Error("This GHL contact is not in the expected location.");
      return contact;
    },
    async verifyCompanyContact(contactId, companyName) {
      const contact = await this.readContact(contactId);
      if (normalizedGhlName(contact.companyName) !== normalizedGhlName(companyName) &&
          normalizedGhlName(contact.businessName) !== normalizedGhlName(companyName)) {
        throw new Error("This GHL contact no longer matches the selected company.");
      }
      const response = await this.readContactTasks(contactId);
      if (!Array.isArray(response?.tasks) ||
          response.tasks.some((task) => !isGhlId(task?.id) ||
            task.contactId !== contactId || typeof task.title !== "string"))
        throw new Error("GHL task readback is incomplete. No new task will be created.");
      return { contact, tasks: response.tasks };
    },
    async readContactTasks(contactId) {
      if (!isGhlId(contactId)) throw new Error("Invalid contact ID.");
      return call("/contacts/" + contactId + "/tasks");
    },
    async verifyClient({ clientId, businessId, companyName, selectedContactId }) {
      return readGhlClientTaskState({
        clientId, businessId, locationId,
        expectedCompanyName: companyName,
        selectedContactId,
      }, this);
    },
    async createContactTask({ contactId, title, body, dueDate, assignedTo }) {
      if (!isGhlId(contactId) || !isGhlId(assignedTo) ||
          typeof title !== "string" || !title.trim() || title.length > 250 ||
          typeof body !== "string" || body.length > 3000 ||
          !Number.isFinite(Date.parse(dueDate))) {
        throw new Error("Invalid GHL task request or missing assigned user ID.");
      }
      const data = await call("/contacts/" + contactId + "/tasks", {
        method: "POST",
        payload: {
          title, body, dueDate, completed: false, assignedTo,
        },
      });
      const taskId = data?.task?.id;
      if (!isGhlId(taskId)) throw new Error("GHL response lacked a task ID. Check GHL before retrying.");
      return taskId;
    },
  };
}

/**
 * Convert a selected local wall clock to UTC for the GHL task API.
 * Reject non-existent/ambiguous local times at DST transitions.
 * Current Client Compass UI time zones use 15-minute offset boundaries.
 */
export function localGhlDueToIso(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      typeof timeZone !== "string") throw new Error("Invalid due date, time, or timezone.");
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
  } catch { throw new Error("Invalid time zone."); }
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes);
  if (!Number.isFinite(naive)) throw new Error("Invalid due date.");
  const desired = date + " " + time;
  const matches = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const ms = naive - offset * 60000;
    const record = Object.fromEntries(
      formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    const wall = record.year + "-" + record.month + "-" + record.day +
      " " + record.hour + ":" + record.minute;
    if (wall === desired) matches.push(new Date(ms).toISOString());
  }
  if (matches.length !== 1) throw new Error(
    matches.length ? "Due time is ambiguous at a daylight-saving transition." :
      "Due time does not exist in the selected timezone.",
  );
  return matches[0];
}
