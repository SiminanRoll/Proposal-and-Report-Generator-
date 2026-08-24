import * as XLSX from "xlsx";

export const OTA_TRACKER_TIME_ZONE = "America/Chicago";
export const OTA_TEAM_VIEW_STORAGE_KEY = "ota_tracker_team_view_code_v1";

// Publishable browser access; rows remain protected by Auth/RLS or the hashed team-view code RPC.
export const OTA_SHARED_SUPABASE_URL = "https://cqhqbucjzgijhskupnlw.supabase.co";
export const OTA_SHARED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaHFidWNqemdpamhza3Vwbmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzc3MTMsImV4cCI6MjA5NjYxMzcxM30.u8cyo636zYcFmtKS1DUCK3Usb5hRvvePvGB0v-4AOws";

export type OtaHealthKey = "quoted" | "upcoming" | "today" | "grace" | "due" | "overdue" | "undated" | "closed";
export type OtaHealth = { key: OtaHealthKey; label: string; daysPast: number | null; rank: number };

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

type CfbEntry = { content?: Uint8Array | number[] | ArrayLike<number> };
type CfbApi = {
  read: (data: Uint8Array, options?: Record<string, unknown>) => unknown;
  find: (container: unknown, path: string) => CfbEntry | null;
};
type ScheduleCandidate = { date: string; time: string; context: string; score: number; lineIndex: number };

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function normalized(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function linesOf(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n").map(normalized).filter(Boolean);
}

function displayName(value: string): string {
  const canonical: Record<string, string> = {
    dental: "Dental", dentistry: "Dentistry", dds: "DDS", dmd: "DMD", llc: "LLC", pllc: "PLLC", pc: "PC",
  };
  return normalized(value).split(" ").map((word) => {
    const bare = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.'’&-]+$/g, "");
    const key = bare.toLowerCase();
    if (canonical[key]) return word.replace(bare, canonical[key]);
    if (/^[a-z][a-z.'’&-]*$/.test(bare)) return word.replace(bare, bare[0].toUpperCase() + bare.slice(1));
    return word;
  }).join(" ").trim();
}

export function companyKey(value: unknown): string {
  return normalized(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|pllc|pc|inc|corp|corporation|company|co)\b/g, " ").replace(/\s+/g, " ").trim();
}

function calendarNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function businessDaysAfter(startDateKey: string, endDateKey: string): number {
  const start = calendarNumber(startDateKey);
  const end = calendarNumber(endDateKey);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;
  let count = 0;
  for (let day = start + 1; day <= end; day += 1) {
    const weekday = new Date(day * 86_400_000).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

export function isOtaInLatestWindow(appointmentDate: string | null | undefined, todayKey = chicagoDateKey(), lookbackDays = 60): boolean {
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return false;
  const daysPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  return Number.isFinite(daysPast) && daysPast <= lookbackDays;
}

export function compareLatestOtaDates(leftDate: string | null | undefined, rightDate: string | null | undefined, todayKey = chicagoDateKey()): number {
  const left = leftDate ? calendarNumber(leftDate) : Number.NaN;
  const right = rightDate ? calendarNumber(rightDate) : Number.NaN;
  if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
  if (!Number.isFinite(right)) return -1;
  const today = calendarNumber(todayKey);
  const leftUpcoming = left > today;
  const rightUpcoming = right > today;
  if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
  return leftUpcoming ? left - right : right - left;
}

export function chicagoDateKey(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: OTA_TRACKER_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function classifyOtaHealth(appointmentDate: string | null | undefined, quoted: boolean, status = "", todayKey = chicagoDateKey()): OtaHealth {
  if (/cancel|no[-_ ]?show/i.test(normalized(status))) return { key: "closed", label: "Closed", daysPast: null, rank: 0 };
  if (quoted) {
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "quoted", label: "Quoted", daysPast: null, rank: 1 };
    const calendarPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
    const daysPast = calendarPast < 0 ? calendarPast : businessDaysAfter(appointmentDate, todayKey);
    return { key: "quoted", label: "Quoted", daysPast: Number.isFinite(daysPast) ? daysPast : null, rank: 1 };
  }
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  const calendarPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  if (!Number.isFinite(calendarPast)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  if (calendarPast < 0) return { key: "upcoming", label: "Upcoming", daysPast: calendarPast, rank: 2 };
  if (calendarPast === 0) return { key: "today", label: "OTA today", daysPast: 0, rank: 4 };
  const daysPast = businessDaysAfter(appointmentDate, todayKey);
  if (daysPast <= 1) return { key: "grace", label: "Grace window", daysPast, rank: 5 };
  if (daysPast === 2) return { key: "due", label: "Quote due", daysPast, rank: 6 };
  return { key: "overdue", label: "Overdue", daysPast, rank: 7 };
}

export function compareOtaHealth(a: OtaHealth, b: OtaHealth): number { return b.rank - a.rank; }

function headerValue(source: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`^${escaped}\\s*:\\s*(.+)$`, "im"));
    if (match?.[1]) return normalized(match[1]);
  }
  return "";
}

function labeledValue(source: string, labels: string[]): string {
  for (const label of labels) {
    const match = source.match(new RegExp(`^(?:${label})\\s*[:\\-]\\s*(.+)$`, "im"));
    if (match?.[1]) return normalized(match[1]);
  }
  return "";
}

function validDateKey(year: number, month: number, day: number): string {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sourceYearHint(source: string): number {
  const sent = headerValue(source, ["Sent", "Date"]);
  const explicitYear = sent.match(/\b(20\d{2})\b/)?.[1];
  if (explicitYear) return Number(explicitYear);
  if (sent) {
    const parsed = new Date(sent);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  return Number(chicagoDateKey().slice(0, 4));
}

function parseDateValue(value: string, yearHint = Number(chicagoDateKey().slice(0, 4))): string {
  const clean = normalized(value);
  if (!clean) return "";
  let match = clean.match(/\b(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if (match) return validDateKey(Number(match[1]), Number(match[2]), Number(match[3]));
  match = clean.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})\b/);
  if (match) return validDateKey(match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]), Number(match[1]), Number(match[2]));
  match = clean.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
  if (match) return validDateKey(Number(match[3]), MONTHS[match[1].toLowerCase().replace(/\.$/, "")], Number(match[2]));
  match = clean.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?[,]?\s+(20\d{2})\b/i);
  if (match) return validDateKey(Number(match[3]), MONTHS[match[2].toLowerCase().replace(/\.$/, "")], Number(match[1]));
  match = clean.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (match) return validDateKey(yearHint, MONTHS[match[1].toLowerCase().replace(/\.$/, "")], Number(match[2]));
  match = clean.match(/\b(\d{1,2})[\/-](\d{1,2})(?![\/-]\d)\b/);
  return match ? validDateKey(yearHint, Number(match[1]), Number(match[2])) : "";
}

function parseTimeValue(value: string): string {
  const clean = normalized(value).replace(/\bA\s*\.?\s*M\.?/gi, "AM").replace(/\bP\s*\.?\s*M\.?/gi, "PM");
  if (/\b(noon|mid[- ]?day)\b/i.test(clean)) return "12:00:00";
  if (/\bmidnight\b/i.test(clean)) return "00:00:00";
  let match = clean.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  let hour: number;
  let minute: number;
  let meridiem = "";
  if (match) {
    hour = Number(match[1]); minute = Number(match[2]); meridiem = String(match[3] || "").toUpperCase();
  } else {
    match = clean.match(/\b(\d{1,2})\s*(AM|PM)\b/i);
    if (!match) return "";
    hour = Number(match[1]); minute = 0; meridiem = String(match[2]).toUpperCase();
  }
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function splitEmailBatch(raw: string): string[] {
  let clean = raw.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  clean = clean.replace(/^\s*-{2,}\s*(?:Forwarded|Original) message\s*-{2,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n")
    .replace(/^\s*-{3,}\s*NEXT EMAIL\s*-{3,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n")
    .replace(/\n(?=From:\s*[^\n]+\n(?:(?:Sent|Date|To|Cc|Bcc):[^\n]*\n){1,5}Subject:)/gi, "\n<<<OTA_SPLIT>>>\n");
  return clean.split("<<<OTA_SPLIT>>>").map((part) => part.trim()).filter(Boolean);
}

function isAdvantageInternalName(value: string): boolean { return /^advantage\s+technologies\b/i.test(normalized(value)); }

function meaningfulCompany(value: string): boolean {
  const clean = normalized(value).replace(/^[#\s-]+|[#\s-]+$/g, "");
  return Boolean(clean && !isAdvantageInternalName(clean) && /[a-z]/i.test(clean) && !/^(?:ota|opportunity|ticket|sales assist)?\s*#?\s*\d+$/i.test(clean));
}

export function cleanOtaSourceTitle(value: string): string {
  let clean = normalized(value).replace(/\.msg$/i, "").replace(/_/g, " ");
  clean = clean.replace(/^(?:re|fw|fwd):\s*/i, "")
    .replace(/^Sales Assist Ticket#?\s*\d+\s*[-–—]*\s*Advantage Technologies(?:,?\s*Inc\.?)?\s*[-–—]*\s*/i, "")
    .replace(/^OTA\s*/i, "")
    .replace(/^Opportunity\s*#?\s*\d+\s*(?:[-:–—|]\s*)?/i, "")
    .replace(/^#?\s*\d+\s*(?:[-:–—|]\s*)?/i, "")
    .replace(/\s*[-–—]\s*Set to Action Required\s*$/i, "")
    .replace(/\s+custom quote\s+Opportunity\s*#?\s*\d+.*$/i, "")
    .replace(/^A360\s+Onboarding\s*[-:–—|]\s*/i, "")
    .replace(/^New\s+A360\s+/i, "")
    .replace(/^Project\s+with\s+A360\s*(?:[-:–—|]\s*)?/i, "")
    .replace(/^New\s+Client(?:\s*\([^)]*\))?\s*(?:[-:–—|]\s*)?/i, "")
    .replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, "");
  return displayName(clean);
}

const DATE_START = /\b(?:20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}(?:[\/-](?:20\d{2}|\d{2}))?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2})\b/i;

function schedulePrefix(source: string): string {
  for (const line of linesOf(source)) {
    if (/^(subject|from|sent|date|to|cc|bcc|message-id)\s*:/i.test(line)) continue;
    const match = DATE_START.exec(line);
    DATE_START.lastIndex = 0;
    if (!match || match.index <= 0) continue;
    let prefix = normalized(line.slice(0, match.index)).replace(/[,:;\-–—|]+$/g, "").trim();
    prefix = prefix.replace(/^(?:ota|appointment|scheduled|set for|booked|confirmed)\s+/i, "").trim();
    const words = prefix.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 6 && !/\b(ticket|opportunity|date|sent|hello|thanks?|please|good morning|good afternoon)\b/i.test(prefix)) return displayName(prefix);
  }
  return "";
}

function companyFromSubject(subject: string, sourceFileName: string): string {
  const raw = normalized(subject || sourceFileName);
  const newClient = raw.match(/\bNew\s+Client(?:\s*\([^)]*\))?\s*[:\-–—|]?\s*([^|]+)$/i)?.[1];
  if (newClient && meaningfulCompany(newClient)) return displayName(newClient);
  const clean = cleanOtaSourceTitle(raw);
  return meaningfulCompany(clean) ? clean : "";
}

function candidateCompany(source: string, subject: string, sourceFileName: string): string {
  const labeled = labeledValue(source, ["Practice(?: Name)?", "Account Name", "Client(?: Name)?", "Customer(?: Name)?", "Company(?: Name)?", "Business(?: Name)?", "Office(?: Name)?", "Organization", "Account"]);
  if (meaningfulCompany(labeled)) return displayName(labeled);
  const newOffice = source.match(/\bnew\s+office\s+(?:will\s+be|is|called|named)\s+([^\n.!?]+)/i)?.[1];
  if (newOffice && meaningfulCompany(newOffice)) return displayName(newOffice);
  const subjectCompany = companyFromSubject(subject, sourceFileName);
  if (subjectCompany) return subjectCompany;
  const prefix = schedulePrefix(source);
  if (meaningfulCompany(prefix)) return prefix;
  const dental = source.match(/\bof\s+([A-Z][A-Za-z0-9&.'’\- ]{2,70}\b(?:Dental|Dentistry|Orthodontics|Endodontics|Periodontics|Pediatrics|Associates|Group|Center|Clinic|Practice))\b/i)?.[1];
  return dental && meaningfulCompany(dental) ? displayName(dental) : "";
}

function scheduleScore(value: string): number {
  const text = normalized(value).toLowerCase();
  let score = 0;
  if (/\bota\s+(?:is\s+)?(?:set|booked|scheduled|confirmed)\b/.test(text)) score += 220;
  if (/\b(?:ota date|date of ota|onsite date|appointment date|scheduled for|appointment start|scheduled start)\b/.test(text)) score += 170;
  if (/\b(ota|onsite|on-site|technology assessment|assessment|appointment)\b/.test(text)) score += 95;
  if (/\b(booked|scheduled|confirmed|set for|visit|meeting|arrive|arrival)\b/.test(text)) score += 55;
  if (/\bat\s+(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|noon|mid[- ]?day)\b/i.test(text)) score += 15;
  if (/^(sent|date|received|from|to|cc|bcc)\s*:/.test(text)) score -= 220;
  if (/\b(ticket created|created date|date created|modified|last updated|opportunity date|close date|due date|follow[- ]?up|reminder|action required by|submitted|requested on)\b/.test(text)) score -= 130;
  if (/\b(may|might|possibly|tentative|could|if so|if needed|may move|might move|move it to|reschedul)\b/.test(text)) score -= 140;
  if (/\b(quote|proposal|estimate)\b/.test(text) && !/\b(ota|onsite|appointment|assessment)\b/.test(text)) score -= 40;
  return score;
}

function makeScheduleCandidate(context: string, lineIndex: number, yearHint: number, bonus = 0): ScheduleCandidate | null {
  const date = parseDateValue(context, yearHint);
  return date ? { date, time: parseTimeValue(context), context, score: scheduleScore(context) + bonus, lineIndex } : null;
}

function smartOtaSchedule(source: string, subject: string): ScheduleCandidate {
  const yearHint = sourceYearHint(source);
  const explicit = labeledValue(source, ["OTA(?: Date)?", "Date of OTA", "Appointment Date", "Onsite Date", "On-Site Date", "Scheduled Date", "Scheduled For", "Assessment Date", "Visit Date", "Meeting Date", "Appointment Start", "Scheduled Start", "Start Date", "When"]);
  const explicitCandidate = makeScheduleCandidate(explicit, -2, yearHint, 240);
  if (explicitCandidate) return explicitCandidate;
  const lines = linesOf(source);
  const candidates: ScheduleCandidate[] = [];
  lines.forEach((line, index) => { const item = makeScheduleCandidate(line, index, yearHint); if (item) candidates.push(item); });
  for (let index = 0; index < lines.length - 1; index += 1) {
    const joined = `${lines[index]} ${lines[index + 1]}`;
    const item = makeScheduleCandidate(joined, index, yearHint, -2);
    if (item && item.score > scheduleScore(lines[index + 1])) candidates.push(item);
  }
  const subjectCandidate = makeScheduleCandidate(subject, -1, yearHint, 25);
  if (subjectCandidate) candidates.push(subjectCandidate);
  if (!candidates.length) return { date: "", time: "", context: "", score: 0, lineIndex: -1 };
  candidates.sort((a, b) => b.score - a.score || b.lineIndex - a.lineIndex);
  const best = { ...candidates[0] };
  if (best.score <= 0) {
    const distinct = [...new Set(candidates.filter((item) => item.score > -100).map((item) => item.date))];
    if (distinct.length !== 1) return { date: "", time: "", context: "", score: 0, lineIndex: -1 };
  }
  if (!best.time) best.time = candidates.find((item) => item.date === best.date && item.time && item.score > -80)?.time || "";
  return best;
}

function inferRoleSignatureName(source: string, role: RegExp): string {
  const lines = linesOf(source);
  for (let index = 0; index < lines.length; index += 1) {
    const inline = lines[index].match(/^(.{2,70}?)\s*\|\s*(.+)$/);
    if (inline && role.test(inline[2])) return normalized(inline[1]);
    if (role.test(lines[index]) && index > 0 && /^[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3}$/.test(lines[index - 1])) return lines[index - 1];
  }
  return "";
}

function inferContact(source: string, company: string): string {
  const labeled = labeledValue(source, ["Primary Contact", "Contact Name", "Client Contact", "Contact", "Office Manager", "Practice Manager", "POC"]);
  if (labeled) return labeled;
  const purchaser = source.match(/\b(?:purchasing\s+office|purchaser|buyer|owner)\s+(Dr\.?\s+[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3})/i)?.[1];
  if (purchaser) return normalized(purchaser).replace(/^dr\.?/i, "Dr.");
  const doctor = source.match(/\b(Dr\.?\s+[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3})\s+of\s+[A-Z]/i)?.[1];
  if (doctor) return normalized(doctor).replace(/^dr\.?/i, "Dr.");
  const manager = inferRoleSignatureName(source, /\b(?:office|practice|business)\s+manager\b|\badministrator\b/i);
  if (manager && !/@adv-tech\.com/i.test(source.slice(Math.max(0, source.indexOf(manager) - 80), source.indexOf(manager) + 180))) return manager;
  const prefix = schedulePrefix(source);
  if (prefix && companyKey(prefix) === companyKey(company) && /^(?:Dr\.?\s+)?[A-Z][A-Za-z.'’\-]*(?:\s+[A-Z][A-Za-z.'’\-]*){1,3}$/.test(prefix)) return prefix;
  const from = headerValue(source, ["From"]);
  return from && !/@adv-tech\.com/i.test(from) ? normalized(from.replace(/<[^>]+>/g, "")) : "";
}

function inferTc(source: string): string {
  const labeled = labeledValue(source, ["Assigned TC", "TC", "Technology Consultant", "Technical Consultant", "Territory Consultant", "Technician", "Consultant", "Assigned To", "Assigned Consultant", "Onsite Consultant"]);
  if (labeled) return labeled;
  const signature = inferRoleSignatureName(source, /\b(?:senior\s+)?(?:technology|technical|territory)\s+consultant\b/i);
  if (signature) return signature;
  const from = headerValue(source, ["From"]);
  return /@adv-tech\.com/i.test(from) && /\b(?:technology|technical|territory)\s+consultant\b/i.test(source) ? normalized(from.replace(/<[^>]+>/g, "")) : "";
}

function smartOtaTime(source: string, schedule: ScheduleCandidate): string {
  const explicit = labeledValue(source, ["OTA Time", "Appointment Time", "Onsite Time", "On-Site Time", "Scheduled Time", "Assessment Time", "Visit Time", "Meeting Time", "Appointment Start", "Scheduled Start", "Start Time", "When", "Time"]);
  return parseTimeValue(explicit) || schedule.time || parseTimeValue(schedule.context);
}

export function parseOtaEmailBatch(raw: string, sourceFileName = ""): ParsedOtaEmail[] {
  return splitEmailBatch(raw).map((source, index) => {
    const subject = headerValue(source, ["Subject"]);
    const schedule = smartOtaSchedule(source, subject);
    const company = candidateCompany(source, subject, sourceFileName);
    return {
      localId: `email-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      raw: source,
      company,
      appointmentDate: schedule.date,
      appointmentTime: smartOtaTime(source, schedule),
      contactName: inferContact(source, company),
      tcName: inferTc(source),
      subject,
      messageId: headerValue(source, ["Message-ID", "Message-Id", "Message ID"]),
      sourceFileName,
      quoteLanguageDetected: /\b(?:quoted|quote sent|proposal sent|estimate sent)\b/i.test(source),
      selected: true,
    };
  });
}

function getCfbApi(): CfbApi {
  const api = (XLSX as unknown as { CFB?: CfbApi }).CFB;
  if (!api?.read || !api?.find) throw new Error("Outlook .msg reader is unavailable in this browser build.");
  return api;
}

function entryBytes(entry: CfbEntry | null): Uint8Array {
  if (!entry?.content) return new Uint8Array();
  return entry.content instanceof Uint8Array ? entry.content : Uint8Array.from(entry.content as ArrayLike<number>);
}

function decodeMsgStream(bytes: Uint8Array, encoding: string): string {
  if (!bytes.length) return "";
  try { return new TextDecoder(encoding).decode(bytes).replace(/\u0000+$/g, "").trim(); }
  catch { return new TextDecoder().decode(bytes).replace(/\u0000+$/g, "").trim(); }
}

function readMsgString(api: CfbApi, container: unknown, propertyTag: string): string {
  const unicode = entryBytes(api.find(container, `__substg1.0_${propertyTag}001F`));
  if (unicode.length) return decodeMsgStream(unicode, "utf-16le");
  const ansi = entryBytes(api.find(container, `__substg1.0_${propertyTag}001E`));
  return ansi.length ? decodeMsgStream(ansi, "windows-1252") : "";
}

function stripHtml(value: string): string {
  return value.replace(/<\s*br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|tr|td|th|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function readMsgBody(api: CfbApi, container: unknown): string {
  const plain = readMsgString(api, container, "1000");
  if (plain) return plain;
  const htmlBinary = entryBytes(api.find(container, "__substg1.0_10130102"));
  if (htmlBinary.length) return stripHtml(decodeMsgStream(htmlBinary, "utf-8"));
  const htmlUnicode = readMsgString(api, container, "1013");
  return htmlUnicode ? stripHtml(htmlUnicode) : "";
}

export async function parseOtaEmailFile(file: File): Promise<ParsedOtaEmail[]> {
  if (!/\.msg$/i.test(file.name)) return parseOtaEmailBatch(await file.text(), file.name);
  try {
    const api = getCfbApi();
    const container = api.read(new Uint8Array(await file.arrayBuffer()));
    const subject = readMsgString(api, container, "0037") || cleanOtaSourceTitle(file.name);
    const body = readMsgBody(api, container);
    const senderName = readMsgString(api, container, "0C1A") || readMsgString(api, container, "0042");
    const senderEmail = readMsgString(api, container, "0C1F") || readMsgString(api, container, "0065");
    const messageId = readMsgString(api, container, "1035");
    const headers = [subject ? `Subject: ${subject}` : "", senderName || senderEmail ? `From: ${senderName}${senderEmail ? ` <${senderEmail}>` : ""}` : "", messageId ? `Message-ID: ${messageId}` : ""].filter(Boolean).join("\n");
    const raw = `${headers}${headers && body ? "\n\n" : ""}${body}`.trim();
    const parsed = parseOtaEmailBatch(raw || `Subject: ${subject}`, file.name);
    if (parsed.length) return parsed;
  } catch (error) {
    console.warn(`Could not fully parse Outlook MSG file ${file.name}`, error);
  }
  return parseOtaEmailBatch(`Subject: ${cleanOtaSourceTitle(file.name)}`, file.name);
}

export function otaPreviewTitle(draft: ParsedOtaEmail): string {
  return draft.company || cleanOtaSourceTitle(draft.subject || draft.sourceFileName) || "OTA import row";
}

export function emptyParsedOta(): ParsedOtaEmail {
  return { localId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`, raw: "Manual OTA entry", company: "", appointmentDate: "", appointmentTime: "", contactName: "", tcName: "", subject: "Manual OTA entry", messageId: "", sourceFileName: "", quoteLanguageDetected: false, selected: true };
}

export async function otaSourceHash(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function fetchSharedOtaSnapshot(shareCode: string): Promise<SharedOtaSnapshot> {
  const response = await fetch(`${OTA_SHARED_SUPABASE_URL}/rest/v1/rpc/ota_tracker_shared_snapshot`, {
    method: "POST",
    headers: { apikey: OTA_SHARED_ANON_KEY, Authorization: `Bearer ${OTA_SHARED_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_share_code: shareCode.trim() }), cache: "no-store",
  });
  const data = await response.json().catch(() => ({ ok: false, error: `Request failed (${response.status})` })) as SharedOtaSnapshot;
  if (!response.ok) throw new Error(data.error || `Team view request failed (${response.status}).`);
  if (!data.ok) throw new Error(data.error || "Invalid team view code.");
  return data;
}
