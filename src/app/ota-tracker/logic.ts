export const OTA_TRACKER_TIME_ZONE = "America/Chicago";
export const OTA_TEAM_VIEW_STORAGE_KEY = "ota_tracker_team_view_code_v1";
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
type CfbApi = { read: (data: Uint8Array, options?: Record<string, unknown>) => unknown; find: (container: unknown, path: string) => CfbEntry | null };
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
  const canonical: Record<string, string> = { dental: "Dental", dentistry: "Dentistry", dds: "DDS", dmd: "DMD", llc: "LLC", pllc: "PLLC", pc: "PC" };
  return normalized(value).split(" ").map((word) => {
    const bare = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.'’&-]+$/g, "");
    const key = bare.toLowerCase();
    if (canonical[key]) return word.replace(bare, canonical[key]);
    if (/^[a-z][a-z.'’&-]*$/.test(bare)) return word.replace(bare, bare[0].toUpperCase() + bare.slice(1));
    return word;
  }).join(" ").trim();
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
  const [y, m, d] = dateKey.split("-").map(Number);
  return y && m && d ? Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) : Number.NaN;
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OTA_TRACKER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function classifyOtaHealth(appointmentDate: string | null | undefined, quoted: boolean, status = "", todayKey = chicagoDateKey()): OtaHealth {
  if (/cancel|no[-_ ]?show/i.test(normalized(status))) return { key: "closed", label: "Closed", daysPast: null, rank: 0 };
  if (quoted) {
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "quoted", label: "Quoted", daysPast: null, rank: 1 };
    const calendarDays = calendarNumber(todayKey) - calendarNumber(appointmentDate);
    const days = calendarDays < 0 ? calendarDays : businessDaysAfter(appointmentDate, todayKey);
    return { key: "quoted", label: "Quoted", daysPast: Number.isFinite(days) ? days : null, rank: 1 };
  }
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  const calendarDays = calendarNumber(todayKey) - calendarNumber(appointmentDate);
  if (!Number.isFinite(calendarDays)) return { key: "undated", label: "Needs date", daysPast: null, rank: 3 };
  if (calendarDays < 0) return { key: "upcoming", label: "Upcoming", daysPast: calendarDays, rank: 2 };
  if (calendarDays === 0) return { key: "today", label: "OTA today", daysPast: 0, rank: 4 };
  const days = businessDaysAfter(appointmentDate, todayKey);
  if (days <= 1) return { key: "grace", label: "Grace window", daysPast: days, rank: 5 };
  if (days === 2) return { key: "due", label: "Quote due", daysPast: days, rank: 6 };
  return { key: "overdue", label: "Overdue", daysPast: days, rank: 7 };
}

export function compareOtaHealth(a: OtaHealth, b: OtaHealth): number {
  return b.rank - a.rank;
}

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
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : "";
}

function sourceYearHint(source: string): number {
  const sent = headerValue(source, ["Sent", "Date"]);
  const explicit = sent.match(/\b(20\d{2})\b/)?.[1];
  if (explicit) return Number(explicit);
  if (sent) {
    const parsed = new Date(sent);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  const discussionTimestamp = source.match(/(?:^|\n)\s*\d{1,2}\/\d{1,2}\/(20\d{2})\s+\d{1,2}:\d{2}\s*(?:A\.?M\.?|P\.?M\.?)?/i)?.[1];
  if (discussionTimestamp) return Number(discussionTimestamp);
  return Number(chicagoDateKey().slice(0, 4));
}

function parseDateValue(value: string, yearHint = Number(chicagoDateKey().slice(0, 4))): string {
  const source = normalized(value);
  if (!source) return "";
  let match = source.match(/\b(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if (match) return validDateKey(Number(match[1]), Number(match[2]), Number(match[3]));
  match = source.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})\b/);
  if (match) return validDateKey(match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]), Number(match[1]), Number(match[2]));
  match = source.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i);
  if (match) return validDateKey(Number(match[3]), MONTHS[match[1].toLowerCase().replace(/\.$/, "")], Number(match[2]));
  match = source.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?[,]?\s+(20\d{2})\b/i);
  if (match) return validDateKey(Number(match[3]), MONTHS[match[2].toLowerCase().replace(/\.$/, "")], Number(match[1]));
  match = source.match(/\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (match) return validDateKey(yearHint, MONTHS[match[1].toLowerCase().replace(/\.$/, "")], Number(match[2]));
  match = source.match(/\b(\d{1,2})[\/-](\d{1,2})(?![\/-]\d)\b/);
  return match ? validDateKey(yearHint, Number(match[1]), Number(match[2])) : "";
}

function parseTimeValue(value: string): string {
  const source = normalized(value).replace(/\bA\s*\.?\s*M\.?/gi, "AM").replace(/\bP\s*\.?\s*M\.?/gi, "PM");
  if (/\b(noon|mid[- ]?day)\b/i.test(source)) return "12:00:00";
  if (/\bmidnight\b/i.test(source)) return "00:00:00";
  let match = source.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  let hour: number;
  let minute: number;
  let meridiem = "";
  if (match) {
    hour = Number(match[1]);
    minute = Number(match[2]);
    meridiem = String(match[3] || "").toUpperCase();
  } else {
    match = source.match(/\b(\d{1,2})\s*(AM|PM)\b/i);
    if (!match) return "";
    hour = Number(match[1]);
    minute = 0;
    meridiem = String(match[2]).toUpperCase();
  }
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function splitEmailBatch(raw: string): string[] {
  let source = raw.replace(/\r\n/g, "\n").trim();
  if (!source) return [];
  source = source
    .replace(/^\s*-{2,}\s*(?:Forwarded|Original) message\s*-{2,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n")
    .replace(/^\s*-{3,}\s*NEXT EMAIL\s*-{3,}\s*$/gim, "\n<<<OTA_SPLIT>>>\n")
    .replace(/\n(?=From:\s*[^\n]+\n(?:(?:Sent|Date|To|Cc|Bcc):[^\n]*\n){1,5}Subject:)/gi, "\n<<<OTA_SPLIT>>>\n");
  return source.split("<<<OTA_SPLIT>>>").map((part) => part.trim()).filter(Boolean);
}

function isAdvantageInternalName(value: string): boolean {
  return /^advantage\s+technologies\b/i.test(normalized(value));
}

function isInternalSenderValue(value: string): boolean {
  const candidate = normalized(value);
  return /@adv-tech\.com\b/i.test(candidate) || /\badvantage\s+technologies\b/i.test(candidate) || /^sales\s+(?:team|assist)\b/i.test(candidate);
}

function meaningfulCompany(value: string): boolean {
  const candidate = normalized(value).replace(/^[#\s-]+|[#\s-]+$/g, "");
  return Boolean(candidate && !isAdvantageInternalName(candidate) && /[a-z]/i.test(candidate) && !/^(?:ota|opportunity|ticket|sales assist)?\s*#?\s*\d+$/i.test(candidate) && !/^(?:additional location|new client|project with a360)$/i.test(candidate));
}

export function cleanOtaSourceTitle(value: string): string {
  let candidate = normalized(value).replace(/\.msg$/i, "").replace(/_/g, " ");
  candidate = candidate
    .replace(/^(?:re|fw|fwd):\s*/i, "")
    .replace(/^Sales Assist Ticket#?\s*\d+\s*(?:[\/\-–—|]+|\s+)\s*Advantage Technologies(?:,?\s*Inc\.?)?\s*(?:[\/\-–—|]+|\s+)\s*/i, "")
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
  return displayName(candidate);
}

const DATE_START = /\b(?:20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}[\/-]\d{1,2}(?:[\/-](?:20\d{2}|\d{2}))?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2})\b/i;

function schedulePrefix(source: string): string {
  for (const line of linesOf(source)) {
    if (/^(subject|from|sent|date|to|cc|bcc|message-id)\s*:/i.test(line)) continue;
    const match = DATE_START.exec(line);
    if (!match || match.index <= 0) continue;
    let prefix = normalized(line.slice(0, match.index)).replace(/[,:;\-–—|]+$/g, "").trim();
    prefix = prefix.replace(/^(?:ota|appointment|scheduled|set for|booked|confirmed)\s+/i, "").trim();
    const words = prefix.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 6 && !/\b(ticket|opportunity|date|sent|hello|thanks?|please|good morning|good afternoon|discussion)\b/i.test(prefix)) return displayName(prefix);
  }
  return "";
}

function companyFromSubject(subject: string, sourceFileName: string): string {
  const raw = normalized(subject || sourceFileName);
  const newClient = raw.match(/\bNew\s+Client(?:\s*\([^)]*\))?\s*[:\-–—|]?\s*([^|]+)$/i)?.[1];
  if (newClient && meaningfulCompany(newClient)) return displayName(newClient);
  const cleaned = cleanOtaSourceTitle(raw);
  return meaningfulCompany(cleaned) ? cleaned : "";
}

function existingClientFromBody(source: string): string {
  const patterns = [
    /\b(?:additional\s+(?:site|location|office)\s+for\s+)?existing\s+(?:client|customer|account|practice)\s+([A-Z0-9][A-Za-z0-9&.'’\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'’\-]*){0,5}?)(?=\s+(?:total|with|has|have|is|which|that|and|at|for|consisting|consists|currently|using|running|located)\b|[,.!?;]|$)/i,
    /\b(?:client|practice|office)\s+(?:is\s+)?(?:called|named)\s+([A-Z0-9][A-Za-z0-9&.'’\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'’\-]*){0,5}?)(?=[,.!?;]|$)/i,
  ];
  for (const pattern of patterns) {
    const candidate = source.match(pattern)?.[1] || "";
    if (meaningfulCompany(candidate)) return displayName(candidate);
  }
  return "";
}

function candidateCompany(source: string, subject: string, sourceFileName: string): string {
  const labeled = labeledValue(source, ["Practice(?: Name)?", "Account Name", "Client(?: Name)?", "Customer(?: Name)?", "Company(?: Name)?", "Business(?: Name)?", "Office(?: Name)?", "Organization", "Account"]);
  if (meaningfulCompany(labeled)) return displayName(labeled);
  const existingClient = existingClientFromBody(source);
  if (existingClient) return existingClient;
  const newOffice = source.match(/\bnew\s+office\s+(?:will\s+be|is|called|named)\s+([^\n.!?]+)/i)?.[1];
  if (newOffice && meaningfulCompany(newOffice)) return displayName(newOffice);
  const sourceCompany = companyFromSubject(subject, sourceFileName);
  if (sourceCompany) return sourceCompany;
  const prefix = schedulePrefix(source);
  if (meaningfulCompany(prefix)) return prefix;
  const dental = source.match(/\bof\s+([A-Z][A-Za-z0-9&.'’\- ]{2,70}\b(?:Dental|Dentistry|Orthodontics|Endodontics|Periodontics|Pediatrics|Associates|Group|Center|Clinic|Practice))\b/i)?.[1];
  return dental && meaningfulCompany(dental) ? displayName(dental) : "";
}

function scheduleScore(value: string): number {
  const text = normalized(value).toLowerCase();
  let score = 0;
  if (/\bota\s+(?:is\s+)?(?:set|booked|scheduled|confirmed)\b/.test(text)) score += 260;
  if (/\b(?:ota date|date of ota|onsite date|appointment date|scheduled for|appointment start|scheduled start)\b/.test(text)) score += 180;
  if (/\b(ota|onsite|on-site|technology assessment|assessment|appointment)\b/.test(text)) score += 100;
  if (/\b(booked|scheduled|confirmed|set for|visit|meeting|arrive|arrival)\b/.test(text)) score += 60;
  if (/\bat\s+(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|noon|mid[- ]?day)\b/i.test(text)) score += 25;
  if (/^(sent|date|received|from|to|cc|bcc)\s*:/.test(text)) score -= 240;
  if (/\b(ticket created|created date|date created|modified|last updated|opportunity date|close date|due date|follow[- ]?up|reminder|action required by|submitted|requested on)\b/.test(text)) score -= 150;
  if (/\b(may|might|possibly|tentative|could|if so|if needed|may move|might move|move it to|reschedul)\b/.test(text)) score -= 160;
  if (/\b(quote|proposal|estimate)\b/.test(text) && !/\b(ota|onsite|appointment|assessment)\b/.test(text)) score -= 40;
  return score;
}

function makeScheduleCandidate(context: string, lineIndex: number, yearHint: number, bonus = 0): ScheduleCandidate | null {
  const date = parseDateValue(context, yearHint);
  return date ? { date, time: parseTimeValue(context), context, score: scheduleScore(context) + bonus, lineIndex } : null;
}

function smartOtaSchedule(source: string, subject: string): ScheduleCandidate {
  const year = sourceYearHint(source);
  const explicit = labeledValue(source, ["OTA(?: Date)?", "Date of OTA", "Appointment Date", "Onsite Date", "On-Site Date", "Scheduled Date", "Scheduled For", "Assessment Date", "Visit Date", "Meeting Date", "Appointment Start", "Scheduled Start", "Start Date", "When"]);
  const explicitCandidate = makeScheduleCandidate(explicit, -2, year, 240);
  if (explicitCandidate) return explicitCandidate;
  const lines = linesOf(source);
  const candidates: ScheduleCandidate[] = [];
  lines.forEach((line, index) => {
    const candidate = makeScheduleCandidate(line, index, year);
    if (candidate) candidates.push(candidate);
  });
  for (let index = 0; index < lines.length - 1; index += 1) {
    const joined = `${lines[index]} ${lines[index + 1]}`;
    const candidate = makeScheduleCandidate(joined, index, year, -2);
    if (candidate && candidate.score > scheduleScore(lines[index + 1])) candidates.push(candidate);
  }
  const subjectCandidate = makeScheduleCandidate(subject, -1, year, 25);
  if (subjectCandidate) candidates.push(subjectCandidate);
  if (!candidates.length) return { date: "", time: "", context: "", score: 0, lineIndex: -1 };
  candidates.sort((left, right) => right.score - left.score || right.lineIndex - left.lineIndex);
  const best = { ...candidates[0] };
  if (best.score <= 0) {
    const distinct = [...new Set(candidates.filter((candidate) => candidate.score > -100).map((candidate) => candidate.date))];
    if (distinct.length !== 1) return { date: "", time: "", context: "", score: 0, lineIndex: -1 };
  }
  if (!best.time) best.time = candidates.find((candidate) => candidate.date === best.date && candidate.time && candidate.score > -80)?.time || "";
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

function inferSalesAssistDiscussionAuthor(source: string): string {
  const lines = linesOf(source);
  const discussionIndex = lines.findIndex((line) => /^discussion\b/i.test(line));
  if (discussionIndex < 0) return "";
  for (let index = discussionIndex + 1; index < Math.min(lines.length, discussionIndex + 5); index += 1) {
    const candidate = lines[index];
    if (/^\d{1,2}\/\d{1,2}\/20\d{2}\b/.test(candidate)) continue;
    if (/^[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,3}$/.test(candidate)) return candidate;
  }
  return "";
}

function inferContact(source: string, company: string): string {
  const labeled = labeledValue(source, ["Primary Contact", "Contact Name", "Client Contact", "Contact", "Office Manager", "Practice Manager", "POC"]);
  if (labeled) return labeled;
  const purchaser = source.match(/\b(?:purchasing\s+office|purchaser|buyer|owner)\s+(Dr\.?\s+[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,2})/)?.[1];
  if (purchaser) return normalized(purchaser).replace(/^Dr\.?/, "Dr.");
  const doctor = source.match(/\b(Dr\.?\s+[A-Z][A-Za-z.'’\-]+(?:\s+[A-Z][A-Za-z.'’\-]+){1,2})\s+of\s+[A-Z]/)?.[1];
  if (doctor) return normalized(doctor).replace(/^Dr\.?/, "Dr.");
  const manager = inferRoleSignatureName(source, /\b(?:office|practice|business)\s+manager\b|\badministrator\b/i);
  if (manager && !/@adv-tech\.com/i.test(source.slice(Math.max(0, source.indexOf(manager) - 80), source.indexOf(manager) + 180))) return manager;
  const prefix = schedulePrefix(source);
  if (prefix && companyKey(prefix) === companyKey(company) && /^(?:Dr\.?\s+)?[A-Z][A-Za-z.'’\-]*(?:\s+[A-Z][A-Za-z.'’\-]*){1,3}$/.test(prefix)) return prefix;
  const from = headerValue(source, ["From"]);
  return from && !isInternalSenderValue(from) ? normalized(from.replace(/<[^>]+>/g, "")) : "";
}

function inferTc(source: string): string {
  const labeled = labeledValue(source, ["Assigned TC", "TC", "Technology Consultant", "Technical Consultant", "Territory Consultant", "Technician", "Consultant", "Assigned To", "Assigned Consultant", "Onsite Consultant"]);
  if (labeled) return labeled;
  const signature = inferRoleSignatureName(source, /\b(?:senior\s+)?(?:technology|technical|territory)\s+consultant\b/i);
  if (signature) return signature;
  const discussionAuthor = inferSalesAssistDiscussionAuthor(source);
  if (discussionAuthor) return discussionAuthor;
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

async function getCfbApi(): Promise<CfbApi> {
  const XLSX = await import("xlsx");
  const api = (XLSX as unknown as { CFB?: CfbApi }).CFB;
  if (!api?.read || !api?.find) throw new Error("Outlook .msg reader is unavailable in this browser build.");
  return api;
}

function entryBytes(entry: CfbEntry | null): Uint8Array {
  if (!entry?.content) return new Uint8Array();
  return entry.content instanceof Uint8Array ? entry.content : Uint8Array.from(entry.content as ArrayLike<number>);
}

function findMsgEntry(api: CfbApi, container: unknown, path: string): CfbEntry | null {
  return api.find(container, path) || api.find(container, `/${path}`) || api.find(container, `Root Entry/${path}`);
}

function decodeMsgStream(bytes: Uint8Array, encoding: string): string {
  if (!bytes.length) return "";
  try {
    return new TextDecoder(encoding).decode(bytes).replace(/\u0000+$/g, "").trim();
  } catch {
    return new TextDecoder().decode(bytes).replace(/\u0000+$/g, "").trim();
  }
}

function readMsgString(api: CfbApi, container: unknown, tag: string): string {
  const unicode = entryBytes(findMsgEntry(api, container, `__substg1.0_${tag}001F`));
  if (unicode.length) return decodeMsgStream(unicode, "utf-16le");
  const ansi = entryBytes(findMsgEntry(api, container, `__substg1.0_${tag}001E`));
  return ansi.length ? decodeMsgStream(ansi, "windows-1252") : "";
}

function stripHtml(value: string): string {
  return value.replace(/<\s*br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|tr|td|th|li|h[1-6])\s*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function readMsgBody(api: CfbApi, container: unknown): string {
  const plain = readMsgString(api, container, "1000");
  if (plain) return plain;
  const html = entryBytes(findMsgEntry(api, container, "__substg1.0_10130102"));
  if (html.length) return stripHtml(decodeMsgStream(html, "utf-8"));
  const unicode = readMsgString(api, container, "1013");
  return unicode ? stripHtml(unicode) : "";
}

function isUsefulMsgChar(code: number): boolean {
  return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code === 160 || code === 8211 || code === 8212 || code === 8216 || code === 8217 || code === 8220 || code === 8221 || code === 8230;
}

export function extractMsgUnicodeText(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  let decoded = "";
  try {
    decoded = new TextDecoder("utf-16le").decode(bytes);
  } catch {
    return "";
  }
  const runs: string[] = [];
  let run = "";
  const flush = () => {
    const cleaned = run.replace(/[\t ]+/g, " ").replace(/\r/g, "").trim();
    if (cleaned.length >= 4) runs.push(cleaned);
    run = "";
  };
  for (let index = 0; index < decoded.length; index += 1) {
    const code = decoded.charCodeAt(index);
    if (isUsefulMsgChar(code)) {
      const char = decoded[index] === "\u00a0" ? " " : decoded[index];
      run += char;
      if (char === "\n" && run.length > 3200) flush();
    } else {
      flush();
    }
  }
  flush();
  return [...new Set(runs)].filter((line) => !/^__substg1\.0_/i.test(line) && !/^__.*version1\.0$/i.test(line)).join("\n").slice(0, 80_000);
}

function parsedHasUsefulBodyFields(parsed: ParsedOtaEmail[]): boolean {
  return parsed.some((item) => Boolean(item.appointmentDate || item.appointmentTime || item.tcName));
}

export async function parseOtaEmailFile(file: File): Promise<ParsedOtaEmail[]> {
  if (!/\.msg$/i.test(file.name)) return parseOtaEmailBatch(await file.text(), file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fallbackText = extractMsgUnicodeText(bytes);
  try {
    const api = await getCfbApi();
    const container = api.read(bytes);
    const subject = readMsgString(api, container, "0037") || cleanOtaSourceTitle(file.name);
    const body = readMsgBody(api, container);
    const senderName = readMsgString(api, container, "0C1A") || readMsgString(api, container, "0042");
    const senderEmail = readMsgString(api, container, "0C1F") || readMsgString(api, container, "0065");
    const messageId = readMsgString(api, container, "1035");
    const headers = [subject ? `Subject: ${subject}` : "", senderName || senderEmail ? `From: ${senderName}${senderEmail ? ` <${senderEmail}>` : ""}` : "", messageId ? `Message-ID: ${messageId}` : ""].filter(Boolean).join("\n");
    const raw = [headers, body, fallbackText].filter(Boolean).join("\n\n").trim();
    const parsed = parseOtaEmailBatch(raw || `Subject: ${subject}`, file.name);
    if (parsed.length && (body || parsedHasUsefulBodyFields(parsed))) return parsed;
  } catch (error) {
    console.warn(`Could not fully parse Outlook MSG file ${file.name}`, error);
  }
  if (fallbackText) {
    const fallbackRaw = `Subject: ${cleanOtaSourceTitle(file.name)}\n\n${fallbackText}`;
    const parsed = parseOtaEmailBatch(fallbackRaw, file.name);
    if (parsed.length) return parsed;
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
  const normalizedRaw = raw.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  const identity = normalizedRaw === "Manual OTA entry" ? `${normalizedRaw}|${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}` : normalizedRaw;
  const bytes = new TextEncoder().encode(identity);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function fetchSharedOtaSnapshot(shareCode: string): Promise<SharedOtaSnapshot> {
  const response = await fetch(`${OTA_SHARED_SUPABASE_URL}/rest/v1/rpc/ota_tracker_shared_snapshot`, { method: "POST", headers: { apikey: OTA_SHARED_ANON_KEY, Authorization: `Bearer ${OTA_SHARED_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_share_code: shareCode.trim() }), cache: "no-store" });
  const data = await response.json().catch(() => ({ ok: false, error: `Request failed (${response.status})` })) as SharedOtaSnapshot;
  if (!response.ok) throw new Error(data.error || `Team view request failed (${response.status}).`);
  if (!data.ok) throw new Error(data.error || "Invalid team view code.");
  return data;
}
