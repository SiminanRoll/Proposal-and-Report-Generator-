export const OTA_TRACKER_TIME_ZONE = "America/Chicago";

export type OtaHealthKey = "quoted" | "upcoming" | "today" | "grace" | "due" | "overdue" | "undated";

export type OtaHealth = {
  key: OtaHealthKey;
  label: string;
  daysPast: number | null;
  rank: number;
};

export type ParsedOtaEmail = {
  localId: string;
  raw: string;
  company: string;
  appointmentDate: string;
  appointmentTime: string;
  contactName: string;
  tcName: string;
  subject: string;
  from: string;
  sentAt: string;
  messageId: string;
  quoteLanguageDetected: boolean;
};

function normalized(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function calendarNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function chicagoDateKey(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OTA_TRACKER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function classifyOtaHealth(appointmentDate: string | null | undefined, quoted: boolean, todayKey = chicagoDateKey()): OtaHealth {
  if (quoted) return { key: "quoted", label: "Quoted", daysPast: appointmentDate ? calendarNumber(todayKey) - calendarNumber(appointmentDate) : null, rank: 0 };
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };

  const daysPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  if (!Number.isFinite(daysPast)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  if (daysPast < 0) return { key: "upcoming", label: "Upcoming", daysPast, rank: 1 };
  if (daysPast === 0) return { key: "today", label: "OTA today", daysPast, rank: 2 };
  if (daysPast === 1) return { key: "grace", label: "Grace day", daysPast, rank: 3 };
  if (daysPast === 2) return { key: "due", label: "Quote due", daysPast, rank: 4 };
  return { key: "overdue", label: "Overdue", daysPast, rank: 5 };
}

export function compareOtaHealth(a: OtaHealth, b: OtaHealth): number {
  return b.rank - a.rank;
}

function headerValue(source: string, labels: string[]): string {
  for (const label of labels) {
    const expression = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+)$`, "im");
    const match = source.match(expression);
    if (match?.[1]) return normalized(match[1]);
  }
  return "";
}

function labeledValue(source: string, labels: string[]): string {
  for (const label of labels) {
    const expression = new RegExp(`^(?:${label})\\s*[:\\-]\\s*(.+)$`, "im");
    const match = source.match(expression);
    if (match?.[1]) return normalized(match[1]);
  }
  return "";
}

function parseDateValue(value: string): string {
  const clean = normalized(value).replace(/\b(?:at|@)\b.*$/i, "").trim();
  if (!clean) return "";
  const iso = clean.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const numeric = clean.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/);
  if (numeric) {
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${year}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
}

function parseTimeValue(value: string): string {
  const match = normalized(value).match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function parseSentAt(source: string): string {
  const value = headerValue(source, ["Sent", "Date"]);
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function splitEmailBatch(raw: string): string[] {
  const clean = raw.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const obvious = clean.split(/\n(?=(?:-{3,}\s*)?(?:From|Subject):\s)/i).map((part) => part.trim()).filter(Boolean);
  if (obvious.length <= 1) return [clean];

  const chunks: string[] = [];
  let current = "";
  for (const part of obvious) {
    const startsMessage = /^(?:-{3,}\s*)?From:\s/i.test(part) || (/^Subject:\s/i.test(part) && current.includes("\nFrom:"));
    if (startsMessage && current) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += `${current ? "\n" : ""}${part}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [clean];
}

function companyFromSubject(subject: string): string {
  if (!subject) return "";
  const patterns = [
    /\bOTA\b\s*(?:scheduled|appointment|onsite)?\s*[:\-–—|]\s*([^|–—\n]+?)(?:\s+[|–—]\s+|$)/i,
    /\b(?:onsite|assessment)\b\s*[:\-–—|]\s*([^|–—\n]+?)(?:\s+[|–—]\s+|$)/i,
  ];
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match?.[1]) return normalized(match[1]);
  }
  return "";
}

export function parseOtaEmailBatch(raw: string): ParsedOtaEmail[] {
  return splitEmailBatch(raw).map((source, index) => {
    const subject = headerValue(source, ["Subject"]);
    const company = labeledValue(source, ["Practice(?: Name)?", "Company(?: Name)?", "Business(?: Name)?", "Office(?: Name)?", "Customer", "Account"])
      || companyFromSubject(subject);
    const dateValue = labeledValue(source, ["OTA(?: Date)?", "Date of OTA", "Appointment Date", "Onsite Date", "Scheduled Date", "Assessment Date"]);
    const timeValue = labeledValue(source, ["OTA Time", "Appointment Time", "Onsite Time", "Scheduled Time", "Assessment Time"])
      || dateValue.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i)?.[0]
      || "";
    const contactName = labeledValue(source, ["Primary Contact", "Contact(?: Name)?", "Office Manager", "POC"]);
    const tcName = labeledValue(source, ["TC", "Technician", "Consultant", "Assigned To", "Assigned Consultant", "Onsite Consultant"]);
    const messageId = headerValue(source, ["Message-ID", "Message-Id", "Message ID"]);

    return {
      localId: `email-${Date.now()}-${index}`,
      raw: source,
      company,
      appointmentDate: parseDateValue(dateValue),
      appointmentTime: parseTimeValue(timeValue),
      contactName,
      tcName,
      subject,
      from: headerValue(source, ["From"]),
      sentAt: parseSentAt(source),
      messageId,
      quoteLanguageDetected: /\b(?:quoted|quote|proposal|estimate)\b/i.test(source),
    };
  });
}

export async function otaSourceHash(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw.replace(/\r\n/g, "\n").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}
