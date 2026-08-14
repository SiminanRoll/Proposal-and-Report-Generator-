export interface ConsultantContact {
  name: string;
  aliases?: string[];
  role: string;
  mobile?: string;
  phone?: string;
  email?: string;
  web?: string;
}

export const PATRIC_CONTACT: ConsultantContact = {
  name: "Patric Beckman",
  role: "Client Success Manager",
  phone: "877.723.8832 x511",
  email: "patric.beckman@adv-tech.com",
  web: "adv.tech",
};

export const CONSULTANT_CONTACTS: ConsultantContact[] = [
  { name: "Chris Beadle", role: "Senior Technology Consultant", mobile: "615.587.8224", phone: "877.723.8832 x660", email: "chris.beadle@adv-tech.com", web: "adv.tech" },
  { name: "Shawn Lamb", role: "Technology Consultant", phone: "877.723.8832 x605", email: "shawn.lamb@adv-tech.com", web: "adv.tech" },
  { name: "Caleb Peake", role: "Technology Consultant", phone: "877.723.8832 x1159", email: "caleb.peake@adv-tech.com", web: "adv.tech" },
  { name: "Eric Prywitowski", role: "Healthcare Technology Consultant", phone: "877.723.8832 x627", email: "ericp@adv-tech.com" },
  { name: "Marty Goldmintz", role: "Technology Consultant", phone: "(877) 723-8832 Ext. 674 (Desk/Mobile)" },
  { name: "Josh Bruckmoser", aliases: ["Joshua Bruckmoser"], role: "National Sales Director", phone: "877.723.8832 x570", email: "joshuab@adv-tech.com", web: "adv.tech" },
  { name: "Jason Keller", role: "Technology Consultant", phone: "877.723.8832 x1156", email: "jason.keller@adv-tech.com", web: "adv-tech" },
];

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function consultantContactFor(value: string): ConsultantContact | null {
  const normalized = normalizeName(value);
  if (!normalized) return null;
  return CONSULTANT_CONTACTS.find((contact) => [contact.name, ...(contact.aliases ?? [])]
    .map(normalizeName)
    .some((name) => normalized === name || normalized.includes(name))) ?? null;
}
