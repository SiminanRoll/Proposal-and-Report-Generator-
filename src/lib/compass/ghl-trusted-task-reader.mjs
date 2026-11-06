/**
 * Client Compass -> GHL read-side orchestration contract.
 *
 * This is NOT a browser networking client and contains no credentials, URLs
 * or global fetch calls. A trusted caller must inject authenticated methods
 * corresponding to GHL's EXISTING-business, related-contact and task reads.
 * Never expose privileged provider implementations to public Next.js/PWA JS.
 */
import { normalizeGhlTaskReadback } from "./ghl-task-awareness.mjs";

const ID = /^[A-Za-z0-9_-]{8,128}$/;
const txt = (v) => typeof v === "string" ? v.trim() : "";
const okId = (v) => ID.test(txt(v));
const MAX_CONTACT_PAGES = 20;
const PAGE_SIZE = 100;

function problem(clientId, reason) {
  return {
    status: "not_checked", clientId, reason,
    identity: null, taskReadback: null, contactCandidates: [],
  };
}

/**
 * provider.readBusiness(businessId) -> { business: {id, locationId} }
 * provider.listContactsByBusiness({businessId,locationId,skip,limit})
 *  -> {contacts:[{id,locationId,businessId?}], count:number}
 * provider.readContactTasks(contactId) -> {tasks:[...]}, complete list
 *
 * The business-contact response is scoped by business ID on the trusted GHL
 * API. A task response itself has only a contactId; do not claim that every
 * task belongs exclusively to a company when contacts are shared.
 */
export async function readGhlClientTaskState(request, provider, now = new Date().toISOString()) {
  const clientId = txt(request?.clientId);
  const businessId = txt(request?.businessId);
  const locationId = txt(request?.locationId);
  const wantedContactId = txt(request?.selectedContactId);
  if (!clientId || !okId(businessId) || !okId(locationId) ||
      (wantedContactId && !okId(wantedContactId))) {
    return problem(clientId, "missing_verified_mapping");
  }
  if (!provider || typeof provider.readBusiness !== "function" ||
      typeof provider.listContactsByBusiness !== "function" ||
      typeof provider.readContactTasks !== "function") {
    return problem(clientId, "trusted_reader_missing");
  }
  try {
    const record = await provider.readBusiness(businessId);
    if (!record?.business || txt(record.business.id) !== businessId ||
        txt(record.business.locationId) !== locationId) {
      return problem(clientId, "business_mismatch");
    }
    const contacts = [];
    const seen = new Set();
    let expectedTotal = null;
    for (let page = 0; page < MAX_CONTACT_PAGES; page++) {
      const response = await provider.listContactsByBusiness({
        businessId, locationId, limit: PAGE_SIZE, skip: page * PAGE_SIZE,
      });
      if (!response || !Array.isArray(response.contacts) ||
          !Number.isSafeInteger(response.count) || response.count < 0 ||
          response.count > MAX_CONTACT_PAGES * PAGE_SIZE) {
        return problem(clientId, "incomplete_association_list");
      }
      if (expectedTotal === null) expectedTotal = response.count;
      if (expectedTotal !== response.count) {
        return problem(clientId, "association_list_changed");
      }
      if (!response.contacts.length && seen.size < expectedTotal) {
        return problem(clientId, "incomplete_association_list");
      }
      for (const contact of response.contacts) {
        const id = txt(contact?.id);
        // BusinessId may not be included in every contact response. This GHL
        // endpoint is itself business-scoped; contradictory values are unsafe.
        if (!okId(id) || seen.has(id) ||
            txt(contact.locationId) !== locationId ||
            (contact.businessId != null && txt(contact.businessId) !== businessId)) {
          return problem(clientId, "unverified_contact_association");
        }
        seen.add(id);
        contacts.push({ contactId: id, businessId, associationVerified: true });
      }
      if (seen.size === expectedTotal) break;
      if (seen.size > expectedTotal) return problem(clientId, "incomplete_association_list");
    }
    if (contacts.length !== expectedTotal) return problem(clientId, "incomplete_association_list");
    if (!contacts.length) return problem(clientId, "no_associated_contact");
    if (!wantedContactId && contacts.length !== 1) {
      return {
        ...problem(clientId, "ambiguous_contact"),
        contactCandidates: contacts.map((c) => c.contactId),
      };
    }
    const selected = wantedContactId || contacts[0].contactId;
    if (!seen.has(selected)) return problem(clientId, "selected_contact_not_associated");

    const taskResponse = await provider.readContactTasks(selected);
    const taskReadback = normalizeGhlTaskReadback({
      clientId, businessId, contactId: selected, associationVerified: true,
      source: "authenticated_ghl_api", listComplete: true,
      checkedAt: now, response: taskResponse,
    }, now);
    if (taskReadback.status !== "verified_read") {
      return problem(clientId, taskReadback.reason || "unverified_task_readback");
    }
    return {
      status: "verified_read", clientId, reason: "",
      identity: {
        businessId, verified: true, associatedContacts: contacts,
        selectedContactId: selected,
      },
      taskReadback,
      contactCandidates: contacts.map((c) => c.contactId),
    };
  } catch {
    // Never reveal credentials, tokens or raw backend exception text to UI.
    return problem(clientId, "ghl_read_unavailable");
  }
}
