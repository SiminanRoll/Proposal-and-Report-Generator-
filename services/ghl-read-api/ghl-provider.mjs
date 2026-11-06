/**
 * Read-only private integration adapter for the GHL v3 API.
 *
 * Safe for a Node service only: NEVER import into Client Compass's static PWA.
 * No dependency on Captain's Log or Supabase. No task creation or webhook
 * submission. The GHL token stays solely in a DigitalOcean RUN_TIME secret.
 */
import { readGhlClientTaskState } from "../../src/lib/compass/ghl-trusted-task-reader.mjs";

const API_ORIGIN = "https://services.leadconnectorhq.com";
const VERSION = "v3";
const ID = /^[a-zA-Z0-9_-]{8,128}$/;
const DEFAULT_TIMEOUT = 9_000;
const safeId = (value) => typeof value === "string" && ID.test(value);

export function createGhlReadAdapter({ token, locationId, request = globalThis.fetch }) {
  if (typeof token !== "string" || token.length < 20 || !safeId(locationId)) {
    throw new Error("GHL private integration token or sub-account location is not configured");
  }
  if (typeof request !== "function") throw new Error("A fetch implementation is required");
  async function get(path, query) {
    // Fixed upstream host and hardcoded paths; no browser-controlled URL/proxy.
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN) throw new Error("Invalid GHL upstream host");
    if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await request(url.toString(), {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          Version: VERSION,
        },
      });
    } catch {
      // Do not expose upstream URL, token, or network stack to browser clients.
      throw new Error("GHL upstream unavailable");
    }
    if (!response?.ok) throw new Error("GHL upstream request unsuccessful");
    const type = response.headers?.get?.("content-type") || "";
    if (!type.toLowerCase().includes("application/json")) throw new Error("Unexpected GHL response type");
    try {
      return await response.json();
    } catch {
      throw new Error("Invalid GHL response");
    }
  }
  return {
    async readBusiness(businessId) {
      if (!safeId(businessId)) throw new Error("Invalid business ID");
      return get("/businesses/" + encodeURIComponent(businessId));
    },
    async listContactsByBusiness({ businessId, locationId: selectedLocation, skip, limit }) {
      if (!safeId(businessId) || selectedLocation !== locationId ||
          !Number.isInteger(skip) || skip < 0 ||
          !Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("Invalid GHL business contact lookup");
      }
      return get("/contacts/business/" + encodeURIComponent(businessId),
        { locationId, skip, limit });
    },
    async readContactTasks(contactId) {
      if (!safeId(contactId)) throw new Error("Invalid contact ID");
      return get("/contacts/" + encodeURIComponent(contactId) + "/tasks");
    },
  };
}

/**
 * A fully verified lookup using the existing offline reader contract.
 * Live GHL access happens only through a separately authenticated Node handler.
 */
export async function lookupGhlClientTasks({ clientId, businessId, selectedContactId }, env, fetchImplementation) {
  const provider = createGhlReadAdapter({
    token: env.GHL_PRIVATE_INTEGRATION_TOKEN,
    locationId: env.GHL_LOCATION_ID,
    request: fetchImplementation,
  });
  return readGhlClientTaskState({
    clientId,
    businessId,
    locationId: env.GHL_LOCATION_ID,
    selectedContactId,
  }, provider);
}
