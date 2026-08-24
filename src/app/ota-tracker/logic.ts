import * as XLSX from "xlsx";

export const OTA_TRACKER_TIME_ZONE = "America/Chicago";
export const OTA_TEAM_VIEW_STORAGE_KEY = "ota_tracker_team_view_code_v1";

// Supabase publishable access is intentionally public. Data remains protected by
// Auth/RLS or the hashed OTA team-view code RPC.
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

type CfbEntry = { content?: Uint8Array | number[] | ArrayLike<number> };
type CfbApi = {
  read: (data: Uint8Array, options?: Record<string, unknown>) => unknown;
  find: (container: unknown, path: string) => CfbEntry | null;
};

type ScheduleCandidate = {
  date: string;
  time: string;
  context: string;
  score: number;
  lineIndex: number;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function normalized(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n").map((line) => normalized(line)).filter(Boolean);
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

function businessDaysAfter(startDateKey: string, endDateKey: string): number {
  const start = calendarNumber(startDateKey);
  const end = calendarNumber(endDateKey);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;

  let businessDays = 0;
  for (let day = start + 1; day <= end; day += 1) {
    const weekday = new Date(day * 86_400_000).getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays;
}

export function isOtaInLatestWindow(
  appointmentDate: string | null | undefined,
  todayKey = chicagoDateKey(),
  lookbackDays = 60,
): boolean {
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return false;
  const daysPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  return Number.isFinite(daysPast) && daysPast <= lookbackDays;
}

export function compareLatestOtaDates(
  leftDate: string | null | undefined,
  rightDate: string | null | undefined,
  todayKey = chicagoDateKey(),
): number {
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
  if (quoted) {
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "quoted", label: "Quoted", daysPast: null, rank: 1 };
    const calendarDaysPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
    const daysPast = calendarDaysPast < 0 ? calendarDaysPast : businessDaysAfter(appointmentDate, todayKey);
    return { key: "quoted", label: "Quoted", daysPast: Number.isFinite(daysPast) ? daysPast : null, rank: 1 };
  }
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };

  const calendarDaysPast = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  if (!Number.isFinite(calendarDaysPast)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  if (calendarDaysPast < 0) return { key: "upcoming", label: "Upcoming", daysPast: calendarDaysPast, rank: 2 };
  if (calendarDaysPast === 0) return { key: "today", label: "OTA today", daysPast: 0, rank: 4 };

  const daysPast = businessDaysAfter(appointmentDate, todayKey);
  if (daysPast <= 1) return { key: "grace", label: "Grace window", daysPast, rank: 5 };
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
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return validDateKey(year, Number(match[1]), Number(match[2]));
  }

  match = clean.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
  if (match) return validDateKey(Number(match[3]), MONTHS[match[1].toLowerCase().replace(/\.$/, "")], Number(match[2]));

  match = clean.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?[,]?\s+(20\d{2})\b/i);
  if (match) return validDateKey(Number(match[3]), MONTHS[match[2].toLowerCase().replace(/\.$/, "")], Number(match[1]));

  match = clean.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (match) return validDateKey(yearHint, MONTHS[match[1].toLowerCase().replace(/\.$/, "")], Number(match[2]));

  match = clean.match(/\b(\d{1,2})[\/-](\d{1,2})(?![\/-]\d)\b/);
  if (match) return validDateKey(yearHint, Number(match[1]), Number(match[2]));

  return "";
}

function parseTimeValue(value: string): string {
  const clean = normalized(value)
    .replace(/\bA\.?\s*M\.?\b/gi, "AM")
    .replace(/\bP\.?\s*M\.?\b/gi, "PM");

  if (/\b(noon|mid[- ]?day)\b/i.test(clean)) return "12:00:00";
  if (/\bmidnight\b/i.test(clean)) return "00:00:00";

  let match = clean.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  let hour: number;
  let minute: number;
  let meridiem = "";
  if (match) {
    hour = Number(match[1]);
    minute = Number(match[2]);
    meridiem = String(match[3] || "").toUpperCase();
  } else {
    match = clean.match(/\b(\d{1,2})\s*(AM|PM)\b/i);
    if (!match) return "";
    hour = Number(match[1]);
    minute = 0;
    meridiem = String(match[2] || "").toUpperCase();
  }
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

function titleCaseLoose(value: string): string {
  const clean = normalized(value).replace(/\bDENTAL\b/gi, "Dental").replace(/\bDENTISTRY\b/gi, "Dentistry");
  if (!clean) return "";
  if (clean === clean.toLowerCase()) return clean.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return clean.replace(/\bdental\b/gi, "Dental").replace(/\bdentistry\b/gi, "Dentistry");
}

function isAdvantageInternalName(value: string): boolean {
  return /^advantage\s+technologies\b/i.test(normalized(value));
}

function meaningfulCompany(value: string): boolean {
  const clean = normalized(value).replace(/^[#\s-]+|[#\s-]+$/g, "");
  if (!clean || isAdvantageInternalName(clean)) return false;
  if (/^(?:ota|opportunity|ticket|sales assist)?\s*#?\s*\d+$/i.test(clean)) return false;
  return /[a-z]/i.test(clean);
}

export function cleanOtaSourceTitle(value: string): string {
  let clean = normalized(value)
    .replace(/\.msg$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  clean = clean.replace(/^(?:re|fw|fwd):\s*/i, "");
  clean = clean.replace(/^Sales Assist Ticket#?\s*\d+\s*[-–—]*\s*Advantage Technologies(?:,?\s*Inc\.?)?\s*[-–—]*\s*/i, "");
  clean = clean.replace(/^OTA\s*/i, "");
  clean = clean.replace(/^Opportunity\s*#?\s*\d+\s*(?:[-:–—|]\s*)?/i, "");
  clean = clean.replace(/^#?\s*\d+\s*(?:[-:–—|]\s*)?/i, "");
  clean = clean.replace(/\s*[-–—]\s*Set to Action Required\s*$/i, "");
  clean = clean.replace(/\s+custom quote\s+Opportunity\s*#?\s*\d+.*$/i, "");
  clean = clean.replace(/\s+Opportunity\s*#?\s*\d+.*$/i, "");
  clean = clean.replace(/^A360\s+Onboarding\s*[-:–—|]\s*/i, "");
  clean = clean.replace(/^New\s+A360\s+/i, "");
  clean = clean.replace(/^Project\s+with\s+A360\s*(?:[-:–—|]\s*)?/i, "");
  clean = clean.replace(/^New\s+Client(?:\s*\([^)]*\))?\s*(?:[-:–—|]\s*)?/i, "");
  return titleCaseLoose(clean.replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, ""));
}

function schedulePrefix(source: string): string {
  for (const line of normalizedLines(source)) {
    if (/^(subject|from|sent|date|to|cc|bcc|message-id)\s*:/i.test(line)) continue;
    const dateStart = line.search(/\b(?:20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}(?:[\/-](?:20\d{2}|\d{2}))?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2})\b/i);
    if (dateStart <= 0) continue;
    let prefix = normalized(line.slice(0, dateStart)).replace(/[,:;\-–—|]+$/g, "").trim();
    prefix = prefix.replace(/^(?:ota|appointment|scheduled|set for|booked|confirmed)\s+/i, "").trim();
    if (prefix.split(/\s+/).length >= 1 && prefix.split(/\s+/).length <= 6 && !/\b(ticket|opportunity|date|sent|good|hello|thanks?)\b/i.test(prefix)) return titleCaseLoose(prefix);
  }
  return "";
}

function companyFromSubject(subject: string, sourceFileName = ""): string {
  const raw = normalized(subject || sourceFileName);
  const newClient = raw.match(/\bNew\s+Client(?:\s*\([^)]*\))?\s*[:\-–—|]?\s*([^\n|]+)$/i)?.[1];
  if (newClient && meaningfulCompany(newClient)) return titleCaseLoose(newClient);
  const clean = cleanOtaSourceTitle(raw);
  return meaningfulCompany(clean) ? clean : "";
}

function candidateCompany(source: string, subject: string, sourceFileName: string): string {
  const labeled = labeledValue(source, [
    "Practice(?: Name)?", "Account Name", "Client(?: Name)?", "Customer(?: Name)?",
    "Company(?: Name)?", "Business(?: Name)?", "Office(?: Name)?", "Organization", "Account",
  ]);
  if (meaningfulCompany(labeled)) return titleCaseLoose(labeled);

  const newOffice = source.match(/\bnew\s+office\s+(?:will\s+be|is|called|named)\s+([^\n.!?]+)/i)?.[1];
  if (newOffice && meaningfulCompany(newOffice)) return titleCaseLoose(newOffice);

  const fromSubject = companyFromSubject(subject, sourceFileName);
  if (fromSubject) return fromSubject;

  const prefix = schedulePrefix(source);
  if (meaningfulCompany(prefix)) return prefix;

  const dentalPhrase = source.match(/\bof\s+([A-Z][A-Za-z0-9&.'’\- ]{2,70}\b(?:Dental|Dentistry|Orthodontics|Endodontics|Periodontics|Pediatrics|Associates|Group|Center|Centre|Clinic|Practice))\b/i)?.[1];
  return dentalPhrase && meaningfulCompany(dentalPhrase) ? titleCaseLoose(dentalPhrase) : "";
}

function scheduleContextScore(textValue: string): number {
  const text = normalized(textValue).toLowerCase();
  let score = 0;
  if (/\bota\s+(?:is\s+)?(?:set|booked|scheduled|confirmed)\b/.test(text)) score += 220;
  if (/\b(?:ota date|date of ota|onsite date|appointment date|scheduled for|appointment start|scheduled start)\b/.test(text)) score += 170;
  if (/\b(ota|onsite|on-site|technology assessment|assessment|appointment)\b/.test(text)) score += 95;
  if (/\b(booked|scheduled|confirmed|set for|visit|meeting|arrive|arrival)\b/.test(text)) score += 55;
  if (/\b(at|for)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(text) || /\bat\s+(?:noon|mid[- ]?day)\b/i.test(text)) score += 15;

  if (/^(sent|date|received|from|to|cc|bcc)\s*:/.test(text)) score -= 220;
  if (/\b(ticket created|created date|date created|modified|last updated|opportunity date|close date|due date|follow[- ]?up|reminder|action required by|submitted|requested on)\b/.test(text)) score -= 130;
  if (/\b(may|might|possibly|tentative|could|if so|if needed|may move|might move|move it to|reschedul)\b/.test(text)) score -= 140;
  if (/\b(quote|proposal|estimate)\b/.test(text) && !/\b(ota|onsite|appointment|assessment)\b/.test(text)) score -= 40;
  return score;
}

function candidateForContext(context: string, lineIndex: number, yearHint: number, bonus = 0): ScheduleCandidate | null {
  const date = parseDateValue(context, yearHint);
  if (!date) return null;
  return {
    date,
    time: parseTimeValue(context),
    context,
    score: scheduleContextScore(context) + bonus,
    lineIndex,
  };
}

function smartOtaSchedule(source: string, subject: string): ScheduleCandidate {
  const yearHint = sourceYearHint(source);
  const explicit = labeledValue(source, [
    "OTA(?: Date)?", "Date of OTA", "Appointment Date", "Onsite Date", "On-Site Date",
    "Scheduled Date", "Scheduled For", "Assessment Date", "Visit Date", "Meeting Date",
    "Appointment Start", "Scheduled Start", "Start Date", "When",
  ]);
  const explicitCandidate = candidateForContext(explicit, -2, yearHint, 240);
  if (explicitCandidate) return explicitCandidate;

  const lines = normalizedLines(source);
  const candidates: ScheduleCandidate[] = [];
  lines.forEach((line, lineIndex) => {
    const candidate = candidateForContext(line, lineIndex, yearHint);
    if (candidate) candidates.push(candidate);
  });

  for (let index = 0; index < lines.length - 1; index += 1) {
    const joined = `${lines[index]} ${lines[index + 1]}`;
    const candidate = candidateForContext(joined, index, yearHint, -2);
    if (candidate && candidate.score > scheduleContextScore(lines[index + 1])) candidates.push(candidate);
  }

  const subjectCandidate = candidateForContext(subject, -1, yearHint, 25);
  if (subjectCandidate) candidates.push(subjectCandidate);

  if (!candidates.length) return { date: "", time: "", context: "", score: 0, lineIndex: -1 };
  candidates.sort((left, right) => right.score - left.score || right.lineIndex - left.lineIndex);

  const best = candidates[0];
  if (best.score <= 0) {
    const reasonable = candidates.filter((candidate) => candidate.score > -100);
    const dates = [...new Set(reasonable.map((candidate) => candidate.date))];
    if (dates.length !== 1) return { date: "", time: "", context: "", score: 0, lineIndex: -1 };
  }

  if (!best.time) {
    const sameDateTimed = candidates.find((candidate) => candidate.date === best.date && candidate.time && candidate.score > -80);
    if (sameDateTimed) best.time = sameDateTimed.time;
  }
  return best;
}

function inferRoleSignatureName(source: string, roleExpression: RegExp): string {
  const lines = normalizedLines(source);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/^(.{2,70}?)\s*\|\s*(.+)$/);
    if (inline && roleExpression.test(inline[2])) {
      const name = normalized(inline[1]);
      if (!isAdvantageInternalName(name)) return name;
    }
    if (roleExpression.test(line) && index > 0) {
      const previous = normalized(lines[index - 1]).replace(/[|,:;]+$/g, "");
      if (/^[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3}$/.test(previous)) return previous;
    }
  }
  return "";
}

function inferContact(source: string, company: string): string {
  const labeled = labeledValue(source, ["Primary Contact", "Contact Name", "Client Contact", "Contact", "Office Manager", "Practice Manager", "POC"]);
  if (labeled) return labeled;

  const manager = inferRoleSignatureName(source, /\b(?:office|practice|business)\s+manager\b|\badministrator\b/i);
  if (manager && !/@adv-tech\.com/i.test(source.slice(Math.max(0, source.indexOf(manager) - 100), source.indexOf(manager) + 200))) return manager;

  const purchaser = source.match(/\b(?:purchasing\s+office|purchaser|buyer|owner)\s+(Dr\.?\s+[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3})/i)?.[1];
  if (purchaser) return normalized(purchaser).replace(/^dr\.?/i, "Dr.");

  const doctorOf = source.match(/\b(Dr\.?\s+[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3})\s+of\s+[A-Z]/i)?.[1];
  if (doctorOf) return normalized(doctorOf).replace(/^dr\.?/i, "Dr.");

  const prefix = schedulePrefix(source);
  if (prefix && companyKey(prefix) === companyKey(company) && /^(?:Dr\.?\s+)?[A-Z][A-Za-z.'’\-]*(?:\s+[A-Z][A-Za-z.'’\-]*){1,3}$/.test(prefix)) return prefix;

  const from = headerValue(source, ["From"]);
  if (from && !/@adv-tech\.com/i.test(from)) return normalized(from.replace(/<[^>]+>/g, ""));
  return "";
}

function inferTc(source: string): string {
  const labeled = labeledValue(source, [
    "Assigned TC", "TC", "Technology Consultant", "Technical Consultant", "Territory Consultant",
    "Technician", "Consultant", "Assigned To", "Assigned Consultant", "Onsite Consultant",
  ]);
  if (labeled) return labeled;

  const signature = inferRoleSignatureName(source, /\b(?:senior\s+)?(?:technology|technical|territory)\s+consultant\b/i);
  if (signature) return signature;

  const from = headerValue(source, ["From"]);
  if (/@adv-tech\.com/i.test(from) && /\b(?:technology|technical|territory)\s+consultant\b/i.test(source)) {
    return normalized(from.replace(/<[^>]+>/g, "").replace(/^From:\s*/i, ""));
  }
  return "";
}

function smartOtaTime(source: string, schedule: ScheduleCandidate): string {
  const explicit = labeledValue(source, [
    "OTA Time", "Appointment Time", "Onsite Time", "On-Site Time", "Scheduled Time",
    "Assessment Time", "Visit Time", "Meeting Time", "Appointment Start", "Scheduled Start", "Start Time", "When", "Time",
  ]);
  return parseTimeValue(explicit) || schedule.time || parseTimeValue(schedule.context);
}

export function parseOtaEmailBatch(raw: string, sourceFileName = ""): ParsedOtaEmail[] {
  return splitEmailBatch(raw).map((source, index) => {
    const subject = headerValue(source, ["Subject"]);
    const schedule = smartOtaSchedule(source, subject);
    const company = candidateCompany(source, subject, sourceFileName);
    const messageId = headerValue(source, ["Message-ID", "Message-Id", "Message ID"]);

    return {
      localId: `email-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      raw: source,
      company,
      appointmentDate: schedule.date,
      appointmentTime: smartOtaTime(source, schedule),
      contactName: inferContact(source, company),
      tcName: inferTc(source),
      subject,
      messageId,
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
  if (entry.content instanceof Uint8Array) return entry.content;
  return Uint8Array.from(entry.content as ArrayLike<number>);
}

function decodeMsgStream(bytes: Uint8Array, encoding: string): string {
  if (!bytes.length) return "";
  try {
    return new TextDecoder(encoding).decode(bytes).replace(/\u0000+$/g, "").trim();
  } catch {
    return new TextDecoder().decode(bytes).replace(/\u0000+$/g, "").trim();
  }
}

function readMsgString(api: CfbApi, container: unknown, propertyTag: string): string {
  const unicode = entryBytes(api.find(container, `__substg1.0_${propertyTag}001F`));
  if (unicode.length) return decodeMsgStream(unicode, "utf-16le");
  const ansi = entryBytes(api.find(container, `__substg1.0_${propertyTag}001E`));
  if (ansi.length) return decodeMsgStream(ansi, "windows-1252");
  return "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|tr|td|th|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    const headers = [
      subject ? `Subject: ${subject}` : "",
      senderName || senderEmail ? `From: ${senderName}${senderEmail ? ` <${senderEmail}>` : ""}` : "",
      messageId ? `Message-ID: ${messageId}` : "",
    ].filter(Boolean).join("\n");
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
