/** Types for the offline-only GHL task-intake preflight. Never sends a request. */

export interface GhlAssociatedContactCandidate {
  contactId: string;
  businessId: string;
  /** Must be based on a real GHL association lookup; not proof by itself. */
  associationVerified: boolean;
}

export interface GhlTaskIdentityCandidate {
  businessId: string;
  /** Must be backed by an existing GHL business record verification. */
  verified: boolean;
  associatedContacts: GhlAssociatedContactCandidate[];
  /** Required if multiple associated contacts are valid. */
  selectedContactId?: string;
}

export interface GhlTaskIntakeEntry {
  clientId: string;
  companyName: string;
  taskTitle?: string;
  taskDetails?: string;
  /** YYYY-MM-DD */
  dueDate: string;
  /** Local HH:mm, 24-hour; no time may be silently invented. */
  dueTime: string;
  /** IANA zone, e.g. America/Chicago. Must match GHL location behavior. */
  timeZone: string;
  /** Stable across retries, NOT newly generated per attempt. */
  requestId: string;
  ownerName?: string;
  identity: GhlTaskIdentityCandidate;
}

export type GhlIntakeBlockReason =
  | "invalid_client"
  | "unresolved_business"
  | "missing_contact"
  | "ambiguous_contact"
  | "unverified_association"
  | "missing_request_id"
  | "unsupported_owner"
  | "invalid_due_date"
  | "invalid_task_title"
  | "invalid_details"
  | "duplicate_in_batch"
  | "duplicate_request_id"
  | "shared_contact_conflict";

export interface GhlIntakeBlocked {
  clientId: string;
  status: "blocked";
  reason: GhlIntakeBlockReason;
  detail: string;
}

export interface GhlWebhookBody {
  companyId: string;
  contactId: string;
  companyName: string;
  taskTitle: string;
  taskDetails: string;
  /** GHL workflow local date format: MM-DD-YYYY hh:mm AM/PM. */
  dueDate: string;
  timeZone: string;
  requestId: string;
  clientId: string;
}

export interface GhlIntakePrepared {
  clientId: string;
  status: "prepared_not_sent";
  contactId: string;
  businessId: string;
  payload: GhlWebhookBody;
}

export type GhlIntakePreflightResult = GhlIntakeBlocked | GhlIntakePrepared;

export function formatGhlWorkflowDueDate(localDate: string, localTime: string): string;
export function prepareGhlTaskIntake(entry: GhlTaskIntakeEntry): GhlIntakePreflightResult;
export function prepareGhlTaskIntakeBatch(entries: GhlTaskIntakeEntry[]): GhlIntakePreflightResult[];
