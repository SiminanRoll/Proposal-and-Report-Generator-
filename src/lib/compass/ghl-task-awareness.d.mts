/** Read-only, offline GHL contact-task snapshot types; never sends requests. */

export interface GhlContactTaskRecord {
  id: string;
  contactId: string;
  title: string;
  body?: string | null;
  assignedTo?: string | null;
  /** ISO 8601 timestamp returned by the authenticated GHL API. */
  dueDate?: string | null;
  completed: boolean;
}
export interface GhlTaskReadbackInput {
  clientId: string;
  /** Verified EXISTING GHL business ID, never a Compass/Supabase UUID. */
  businessId: string;
  contactId: string;
  /** Assertion by a trusted caller; not itself proof in browser JavaScript. */
  associationVerified: boolean;
  source: "authenticated_ghl_api";
  /** API was successful and full list returned, not an error or partial page. */
  listComplete: boolean;
  checkedAt: string;
  response: { tasks: GhlContactTaskRecord[] };
}
export interface GhlKnownTask {
  id: string;
  contactId: string;
  title: string;
  body: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  status: "scheduled" | "overdue" | "unscheduled" | "completed";
}
export interface GhlTaskReadbackSnapshot {
  clientId: string;
  status: "not_checked" | "unavailable" | "verified_read";
  reason: string;
  checkedAt: string;
  tasks: GhlKnownTask[];
  businessId?: string;
  contactId?: string;
}
export interface GhlTaskOverlapProposal {
  clientId: string;
  companyName: string;
  taskTitle?: string;
  requestId?: string;
}
export interface GhlTaskStatusCounts {
  scheduled: number;
  overdue: number;
  unscheduled: number;
  completed: number;
}
export interface GhlTaskOverlap {
  status: "not_checked" | "request_already_present" | "possible_overlap" | "no_similar_open_tasks_found";
  matchingTaskIds: string[];
  companyNamedTaskIds?: string[];
  openTaskCount: number;
  counts: GhlTaskStatusCounts | null;
}
export function normalizeGhlTaskReadback(input: GhlTaskReadbackInput | undefined, now?: string): GhlTaskReadbackSnapshot;
export function assessGhlTaskOverlap(snapshot: GhlTaskReadbackSnapshot | undefined, proposal: GhlTaskOverlapProposal, now?: string): GhlTaskOverlap;
