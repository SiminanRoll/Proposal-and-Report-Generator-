export interface ConsultantContact {
  name: string;
  aliases?: string[];
  role: string;
  mobile?: string;
  phone?: string;
  email?: string;
  web?: string;
  calendarEmail?: string;
}

const STORAGE_KEY = "client-compass.consultant-contacts.v1";
export const CONSULTANT_CONTACTS_CHANGED_EVENT = "client-compass-consultants-changed";

export const PATRIC_CONTACT: ConsultantContact = {
  name: "Patric Beckman",
  role: "Client Success Manager",
  phone: "877.723.8832 x511",
  email: "patric.beckman@adv-tech.com",
  web: "adv.tech",
};

export const DEFAULT_CONSULTANT_CONTACTS: ConsultantContact[] = [
  { name: "Chris Beadle", role: "Senior Technology Consultant", mobile: "615.587.8224", phone: "877.723.8832 x660", email: "chris.beadle@adv-tech.com", web: "adv.tech", calendarEmail: "chris.beadle@adv-tech.com" },
  { name: "Shawn Lamb", role: "Technology Consultant", phone: "877.723.8832 x605", email: "shawn.lamb@adv-tech.com", web: "adv.tech", calendarEmail: "shawn.lamb@adv-tech.com" },
  { name: "Caleb Peake", role: "Technology Consultant", phone: "877.723.8832 x1159", email: "caleb.peake@adv-tech.com", web: "adv.tech", calendarEmail: "caleb.peake@adv-tech.com" },
  { name: "Eric Prywitowski", role: "Healthcare Technology Consultant", phone: "877.723.8832 x627", email: "ericp@adv-tech.com", calendarEmail: "ericp@adv-tech.com" },
  { name: "Marty Goldmintz", role: "Technology Consultant", phone: "(877) 723-8832 Ext. 674 (Desk/Mobile)" },
  { name: "Josh Bruckmoser", aliases: ["Joshua Bruckmoser"], role: "National Sales Director", phone: "877.723.8832 x570", email: "joshuab@adv-tech.com", web: "adv.tech", calendarEmail: "joshuab@adv-tech.com" },
  { name: "Jason Keller", role: "Technology Consultant", phone: "877.723.8832 x1156", email: "jason.keller@adv-tech.com", web: "adv-tech", calendarEmail: "jason.keller@adv-tech.com" },
];

// Backward-compatible export for any callers that only need the seeded defaults.
export const CONSULTANT_CONTACTS = DEFAULT_CONSULTANT_CONTACTS;

function cloneContacts(contacts: ConsultantContact[]): ConsultantContact[] {
  return contacts.map((contact) => ({ ...contact, aliases: [...(contact.aliases ?? [])] }));
}

function normalizeContact(contact: ConsultantContact): ConsultantContact | null {
  const name = String(contact.name ?? "").trim();
  if (!name) return null;
  const clean = (value: unknown) => String(value ?? "").trim();
  const aliases = Array.from(new Set((contact.aliases ?? []).map(clean).filter(Boolean)));
  return {
    name,
    role: clean(contact.role) || "Technology Consultant",
    ...(aliases.length ? { aliases } : {}),
    ...(clean(contact.mobile) ? { mobile: clean(contact.mobile) } : {}),
    ...(clean(contact.phone) ? { phone: clean(contact.phone) } : {}),
    ...(clean(contact.email) ? { email: clean(contact.email) } : {}),
    ...(clean(contact.web) ? { web: clean(contact.web) } : {}),
    ...(clean(contact.calendarEmail) ? { calendarEmail: clean(contact.calendarEmail) } : {}),
  };
}

export function loadConsultantContacts(): ConsultantContact[] {
  if (typeof window === "undefined") return cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
    const contacts = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const normalized = normalizeContact(item as ConsultantContact);
      return normalized ? [normalized] : [];
    });
    return contacts.length ? contacts : cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
  } catch {
    return cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
  }
}

export function saveConsultantContacts(contacts: ConsultantContact[]): ConsultantContact[] {
  const normalized = contacts.flatMap((contact) => {
    const item = normalizeContact(contact);
    return item ? [item] : [];
  });
  const saved = normalized.length ? normalized : cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    window.dispatchEvent(new Event(CONSULTANT_CONTACTS_CHANGED_EVENT));
  }
  return cloneContacts(saved);
}

export function resetConsultantContacts(): ConsultantContact[] {
  const defaults = cloneContacts(DEFAULT_CONSULTANT_CONTACTS);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CONSULTANT_CONTACTS_CHANGED_EVENT));
  }
  return defaults;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function consultantContactFor(value: string, contacts: ConsultantContact[] = loadConsultantContacts()): ConsultantContact | null {
  const normalized = normalizeName(value);
  if (!normalized) return null;
  return contacts.find((contact) => [contact.name, ...(contact.aliases ?? [])]
    .map(normalizeName)
    .some((name) => normalized === name || normalized.includes(name))) ?? null;
}
