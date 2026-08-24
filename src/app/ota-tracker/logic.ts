export const OTA_TRACKER_TIME_ZONE = "America/Chicago";
export const OTA_TEAM_VIEW_STORAGE_KEY = "ota_tracker_team_view_code_v1";

// Supabase publishable access is intentionally public. Data remains protected by
// either Captain's Log Auth/RLS or the hashed OTA team-view code RPC.
export const OTA_SHARED_SUPABASE_URL = "https://cqhqbucjzgijhskupnlw.supabase.co";
export const OTA_SHARED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaHFidWNqemdpamhza3Vwbmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzc3MTMsImV4cCI6MjA5NjYxMzcxM30.u8cyo636zYcFmtKS1DUCK3Usb5hRvvePvGB0v-4AOws";

export type OtaHealthKey = "quoted" | "upcoming" | "today" | "grace" | "due" | "overdue" | "undated" | "closed";

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
  messageId: string;
  sourceFileName: string;
  quoteLanguageDetected: boolean;
  selected: boolean;
};

export type SharedOtaSnapshot = {
  ok: boolean;
  error?: string;
  generated_at?: string;
  companies?: Array<{ id: string; display_name: string; normalized_name: string | null; status: string }>;
  otas?: Array<Record<string, unknown>>;
};

function normalized(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function companyKey(value: unknown): string {
  return normalized(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function classifyOtaHealth(
  appointmentDate: string | null | undefined,
  quoted: boolean,
  status = "",
  todayKey = chicagoDateKey(),
): OtaHealth {
  if (/cancel|no[-_ ]?show/i.test(normalized(status))) return { key: "closed", label: "Closed", daysPast: null, rank: 0 };
  if (quoted) return { key: "quoted", label: "Quoted", daysPast: appointmentDate ? calendarNumber(todayKey) - calendarNumber(appointmentDate) : null, rank: 1 };
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };

  const daysPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  if (!Number.isFinite(daysPast)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  if (daysPast < 0) return { key: "upcoming", label: "Upcoming", daysPast, rank: 2 };
  if (daysPast === 0) return { key: "today", label: "OTA today", daysPast, rank: 4 };
  if (daysPast === 1) return { key: "grace", label: "Grace day", daysPast, rank: 5 };
  if (daysPast === 2) return { key: "due", label: "Quote due", daysPast, rank: 6 };
  return { key: "overdue", label: "Overdue", daysPast, rank: 7 };
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
  let match = clean.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = clean.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  const months: Record<string, number> = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };
  match = clean.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i);
  if (match) return `${match[3]}-${String(months[match[1].toLowerCase()]).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
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

function splitEmailBatch(raw: string): string[] {
  let clean = raw.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  clean = clean.replace(/^\s*-{2,}\s*(?:Forwarded|Original) message\s*-{2,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n");
  clean = clean.replace(/^\s*-{3,}\s*NEXT EMAIL\s*-{3,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n");
  clean = clean.replace(/\n(?=From:\s*[^\n]+\n(?:(?:Sent|Date|To|Cc|Bcc):[^\n]*\n){1,5}Subject:)/gi, "\n<<<OTA_SPLIT>>>\n");
  const parts = clean.split("<<<OTA_SPLIT>>>").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [clean];
}

function companyFromSubject(subject: string): string {
  if (!subject) return "";
  let clean = subject.replace(/^(?:re|fw|fwd):\s*/i, "").trim();
  clean = clean.replace(/\b(?:OTA|Onsite Technology Assessment|Onsite Assessment)\b\s*(?:scheduled|appointment|confirmation|set)?\s*[:\-–—|]?\s*/i, "");
  clean = clean.replace(/\s+[|–—-]\s+(?=(?:\d{1,2}\/\d{1,2}\/20\d{2}|20\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)))/i, "\n").split("\n")[0];
  return normalized(clean);
}

export function parseOtaEmailBatch(raw: string, sourceFileName = ""): ParsedOtaEmail[] {
  return splitEmailBatch(raw).map((source, index) => {
    const subject = headerValue(source, ["Subject"]);
    const company = labeledValue(source, ["Practice(?: Name)?", "Company(?: Name)?", "Business(?: Name)?", "Office(?: Name)?", "Organization", "Customer", "Account"])
      || companyFromSubject(subject);
    let dateValue = labeledValue(source, ["OTA(?: Date)?", "Date of OTA", "Appointment Date", "Onsite Date", "Scheduled Date", "Assessment Date"]);
    if (!dateValue) dateValue = source.match(/(?:OTA|onsite(?: technology)? assessment|appointment|scheduled for)[^\n]{0,90}((?:20\d{2}-\d{1,2}-\d{1,2})|(?:\d{1,2}\/\d{1,2}\/20\d{2})|(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}))/i)?.[1] || subject;
    const timeValue = labeledValue(source, ["OTA Time", "Appointment Time", "Onsite Time", "Scheduled Time", "Assessment Time", "Time"])
      || source.match(/(?:OTA|onsite(?: technology)? assessment|appointment|scheduled for)[^\n]{0,120}\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i)?.[1]
      || "";
    const contactName = labeledValue(source, ["Primary Contact", "Contact(?: Name)?", "Office Manager", "POC"]);
    const tcName = labeledValue(source, ["TC", "Technology Consultant", "Technician", "Consultant", "Assigned To", "Assigned TC", "Assigned Consultant", "Onsite Consultant"]);
    const messageId = headerValue(source, ["Message-ID", "Message-Id", "Message ID"]);

    return {
      localId: `email-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      raw: source,
      company,
      appointmentDate: parseDateValue(dateValue),
      appointmentTime: parseTimeValue(timeValue),
      contactName,
      tcName,
      subject,
      messageId,
      sourceFileName,
      quoteLanguageDetected: /\b(?:quoted|quote sent|proposal sent|estimate sent)\b/i.test(source),
      selected: true,
    };
  });
}

export function emptyParsedOta(): ParsedOtaEmail {
  return {
    localId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    raw: "Manual OTA entry",
    company: "",
    appointmentDate: "",
    appointmentTime: "",
    contactName: "",
    tcName: "",
    subject: "Manual OTA entry",
    messageId: "",
    sourceFileName: "",
    quoteLanguageDetected: false,
    selected: true,
  };
}

export async function otaSourceHash(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function fetchSharedOtaSnapshot(shareCode: string): Promise<SharedOtaSnapshot> {
  const response = await fetch(`${OTA_SHARED_SUPABASE_URL}/rest/v1/rpc/ota_tracker_shared_snapshot`, {
    method: "POST",
    headers: {
      apikey: OTA_SHARED_ANON_KEY,
      Authorization: `Bearer ${OTA_SHARED_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_share_code: shareCode.trim() }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({ ok: false, error: `Request failed (${response.status})` })) as SharedOtaSnapshot;
  if (!response.ok) throw new Error(data.error || `Team view request failed (${response.status}).`);
  if (!data.ok) throw new Error(data.error || "Invalid team view code.");
  return data;
}
