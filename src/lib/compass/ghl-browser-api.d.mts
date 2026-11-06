import type { GhlContactTaskRecord } from "./ghl-task-awareness.mjs";
import type { GhlClientTaskReadResult } from "./ghl-trusted-task-reader.mjs";

export class GhlApiHttpError extends Error {
  readonly status: number;
  readonly method: string;
  readonly isTaskCreate: boolean;
  readonly definitelyRejected: boolean;
  constructor(status: number, method: string, path: string);
}

export const GHL_LOCAL_SETTINGS_KEY: string;

export interface GhlLocalCredentials {
  token: string;
  locationId: string;
  assigneeId: string;
}
export function isGhlId(value: unknown): value is string;
export function normalizedGhlName(value: unknown): string;
export function parseLocalSettings(value: unknown): GhlLocalCredentials | null;

export interface GhlBrowserClient {
  listBusinesses(): Promise<Array<{ businessId: string; name: string }>>;
  readBusiness(businessId: string): Promise<{
    business?: { id: string; name: string; locationId: string };
  }>;
  listContactsByBusiness(query: { businessId: string; locationId: string; skip: number; limit: number }): Promise<{
    contacts: Array<{ id: string; locationId: string; businessId?: string | null }>;
    count: number;
  }>;
  findCompanyContacts(companyName: string): Promise<Array<{
    id: string;
    companyName: string;
    displayName: string;
    email: string;
  }>>;
  readContact(contactId: string): Promise<{
    id: string;
    locationId: string;
    companyName?: string;
    businessName?: string;
  }>;
  verifyCompanyContact(contactId: string, companyName: string): Promise<{
    contact: { id: string; locationId: string; companyName?: string; businessName?: string };
    tasks: GhlContactTaskRecord[];
  }>;
  readContactTasks(contactId: string): Promise<{ tasks: GhlContactTaskRecord[] }>;
  verifyClient(query: {
    clientId: string;
    companyName: string;
    businessId: string;
    selectedContactId?: string;
  }): Promise<GhlClientTaskReadResult>;
  createContactTask(task: {
    contactId: string;
    title: string;
    body: string;
    dueDate: string;
    assignedTo: string;
  }): Promise<string>;
}
export function createGhlBrowserApi(input: {
  token: string;
  locationId: string;
  request?: typeof fetch;
}): GhlBrowserClient;
export function localGhlDueToIso(date: string, time: string, timeZone: string): string;
