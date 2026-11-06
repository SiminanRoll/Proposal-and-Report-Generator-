/** Trusted GHL read-only orchestration. Supply authenticated methods ONLY from a protected execution boundary. */
import type { GhlContactTaskRecord, GhlTaskReadbackSnapshot } from "./ghl-task-awareness.mjs";
import type { GhlTaskIdentityCandidate } from "./ghl-task-intake-preflight.mjs";

export interface GhlTaskReadRequest {
  clientId: string;
  businessId: string;
  locationId: string;
  selectedContactId?: string;
}
export interface GhlReadProvider {
  readBusiness(businessId: string): Promise<{ business?: { id: string; locationId: string } }>;
  listContactsByBusiness(query: { businessId: string; locationId: string; skip: number; limit: number }): Promise<{
    contacts: Array<{ id: string; locationId: string; businessId?: string | null }>;
    count: number;
  }>;
  readContactTasks(contactId: string): Promise<{ tasks: GhlContactTaskRecord[] }>;
}
export interface GhlClientTaskReadResult {
  status: "verified_read" | "not_checked";
  clientId: string;
  reason: string;
  identity: GhlTaskIdentityCandidate | null;
  taskReadback: GhlTaskReadbackSnapshot | null;
  contactCandidates: string[];
}
export function readGhlClientTaskState(request: GhlTaskReadRequest, provider: GhlReadProvider, now?: string): Promise<GhlClientTaskReadResult>;
