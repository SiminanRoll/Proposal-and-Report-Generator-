import type { ExtractedFact, FileAnalysis, FindingCandidate } from "@/lib/projects/types";
import {
  classifyTechnicalDevice,
  classifyTechnicalLifecycle,
  TECHNICAL_TRUTH_VERSION,
  classifyTechnicalOsSupport,
  classifyTechnicalServerUrgency,
  classifyTechnicalStorage,
  normalizeTechnicalDeviceName,
  normalizedTechnicalIdentity,
  technicalLifecycleToReport,
  technicalSourceLabel,
  technicalStorageSummary,
  technicalWarrantyExpired,
  type TechnicalDeviceType,
  type TechnicalFieldSources,
  type TechnicalServerUrgency,
  type TechnicalSourceKind,
  type TechnicalStorageState,
} from "@/lib/technical-truth";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function fact(input: Omit<ExtractedFact, "id">): ExtractedFact {
  return { id: id("fact"), ...input };
}

function finding(input: Omit<FindingCandidate, "id">): FindingCandidate {
  return { id: id("candidate"), ...input };
}

function numeric(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value.replace(/,/g, "").trim();
  const suffix = normalized.slice(-1).toUpperCase();
  const base = Number(normalized.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(base)) return 0;
  if (suffix === "M") return Math.round(base * 1_000_000);
  if (suffix === "K") return Math.round(base * 1_000);
  return base;
}

function captureNumber(text: string, expression: RegExp): number {
  const match = text.match(expression);
  return match ? numeric(match[1]) : 0;
}

function labeledCount(text: string, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expressions = [
    new RegExp(`([\\d,]+)[^\\S\\r\\n]+${escaped}\\b`, "im"),
    new RegExp(`(?:^|\\n)[^\\S\\r\\n]*([\\d,]+)[^\\S\\r\\n]*(?:\\r?\\n[^\\S\\r\\n]*){1,2}${escaped}\\b`, "im"),
  ];
  for (const expression of expressions) {
    const value = captureNumber(text, expression);
    if (value) return value;
  }
  const reportLines = lines(text);
  const index = reportLines.findIndex((line) => new RegExp(`^${escaped}$`, "i").test(line));
  if (index >= 0) {
    for (const neighbor of [reportLines[index - 1], reportLines[index + 1]]) {
      const value = numeric(neighbor?.match(/[\d,]+/)?.[0]);
      if (value) return value;
    }
  }
  return 0;
}

function page(text: string, pageNumber: number): string {
  const marker = `[[PAGE ${pageNumber}]]`;
  const start = text.indexOf(marker);
  if (start < 0) return pageNumber === 1 ? text : "";
  const next = text.indexOf("[[PAGE ", start + marker.length);
  return text.slice(start + marker.length, next < 0 ? undefined : next).trim();
}

function pagesFrom(text: string, pageNumber: number): string {
  const marker = `[[PAGE ${pageNumber}]]`;
  const start = text.indexOf(marker);
  if (start < 0) return pageNumber === 1 ? text : "";
  return text.slice(start + marker.length).trim();
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\u0000-\u001F\u007F-\u009F\uE000-\uF8FF\uFFFE\uFFFF]+/g, "-").replace(/\s+/g, " ").replace(/-{2,}/g, "-").trim())
    .filter(Boolean);
}

const SCALEPAD_COLUMN_TOKEN = /^(?:User|Last|Check-?In|Make|Serial|Model|OS|Age|Purchased|Warranty|Expiry|Expires|RAM|CPU|Storage)$/i;

function isScalePadColumnHeaderFragment(value: string): boolean {
  const tokens = value
    .replace(/[|:]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return Boolean(tokens.length) && tokens.every((token) => SCALEPAD_COLUMN_TOKEN.test(token));
}

function normalizeDeviceName(value: string): string {
  return normalizeTechnicalDeviceName(value);
}

function normalizedDeviceNameIdentity(value: string): string {
  return normalizedTechnicalIdentity(value);
}

function cleanScalePadDeviceName(value: string): string {
  let cleaned = normalizeDeviceName(value);
  // Defensive cleanup for projects generated from a fragmented ScalePad header.
  // Header words such as Check-In and Expiry must never become part of a hostname.
  const headerPrefix = /^(?:(?:Last)?Check-?In|WarrantyExpiry|WarrantyExpires|Expiry|Expires)+/i;
  cleaned = cleaned.replace(headerPrefix, "");
  return cleaned;
}

function lifecycleDeviceIdentityKey(device: LifecycleDevice): string {
  const serial = normalizedTechnicalIdentity(device.serial);
  if (serial) return `${device.type}:serial:${serial}`;
  const name = normalizedDeviceNameIdentity(device.name);
  const supporting = [device.model, device.os, device.user, device.purchased, device.warrantyExpires, device.location]
    .map((value) => normalizedTechnicalIdentity(value))
    .join("|");
  return `${device.type}:name:${name}:support:${supporting}`;
}

function reportDate(text: string): string {
  return text.match(/\b([A-Z][a-z]+\s+20\d{2})\b/)?.[1]
    ?? text.match(/\b(20\d{2}-\d{2}-\d{2}\s*(?:-|to)\s*20\d{2}-\d{2}-\d{2})\b/i)?.[1]
    ?? "";
}

function scalePadAssetCounts(text: string): { servers: number; workstations: number; vms: number; networkDevices: number } {
  const reportLines = lines(text);
  const headingIndex = reportLines.findIndex((line) => /\bServers\b[\s\S]*\bWorkstations\b[\s\S]*(?:\bVMs?\b|\bVirtual Machines?\b)/i.test(line));
  if (headingIndex > 0) {
    for (let offset = 1; offset <= 4; offset += 1) {
      const values = reportLines[headingIndex - offset]?.match(/\d+/g)?.map(Number) ?? [];
      if (values.length >= 3) {
        return { servers: values[0], workstations: values[1], vms: values[2], networkDevices: values[3] ?? 0 };
      }
    }
  }
  return {
    servers: labeledCount(text, "Servers"),
    workstations: labeledCount(text, "Workstations"),
    vms: labeledCount(text, "VMs") || labeledCount(text, "Virtual Machines"),
    networkDevices: labeledCount(text, "Network"),
  };
}

interface LifecycleDevice {
  type: "server" | "backup-server" | "workstation" | "vm" | "network";
  name: string;
  user: string;
  lastCheckIn: string;
  make: string;
  serial: string;
  model: string;
  os: string;
  age: number;
  purchased: string;
  warrantyExpires: string;
  ram: string;
  cpu: string;
  storage: string;
  storageUsage?: string;
  storagePercent?: number;
  storageFreeGb?: number;
  graphics: string;
  location: string;
  lifecycleStatus: "current" | "due-soon" | "overdue" | "unknown";
  osStatus: "supported" | "ending-soon" | "unsupported" | "unknown";
  storageState?: TechnicalStorageState;
  serverUrgency?: TechnicalServerUrgency;
  sourceName?: string;
  authoritative?: boolean;
  sourceDetails?: TechnicalFieldSources;
}

function parsePhysicalDevice(line: string, type: "server" | "workstation", pendingName: string[]): LifecycleDevice | null {
  const dateMatch = line.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/);
  if (!dateMatch || dateMatch.index === undefined) return null;
  const beforeDate = line.slice(0, dateMatch.index).trim();
  let afterDate = line.slice(dateMatch.index + dateMatch[0].length).trim();
  const prefixParts = beforeDate.split(/\s+/).filter(Boolean);
  const user = prefixParts.length ? prefixParts[prefixParts.length - 1] : "";
  const inlineName = prefixParts.slice(0, -1).join("");
  const name = preserveWrappedNameContinuation(cleanScalePadDeviceName(inlineName || pendingName.join("")), inlineName);

  const makeMatch = afterDate.match(/^([A-Za-z][A-Za-z0-9&.-]*)\s+/);
  if (!makeMatch) return null;
  const make = makeMatch[1];
  afterDate = afterDate.slice(makeMatch[0].length);
  const serialMatch = afterDate.match(/^(\S+)\s+/);
  if (!serialMatch) return null;
  const serial = serialMatch[1];
  const remainder = afterDate.slice(serialMatch[0].length).replace(/\s+/g, " ").trim();
  const osStart = remainder.search(/\b(?:Microsoft\s+)?(?:Windows|Server|macOS|Chrome\s*OS|Linux)\b/i);
  if (osStart < 0) return null;

  const model = remainder.slice(0, osStart).trim();
  const osAndTail = remainder.slice(osStart).trim();
  const storageMatch = osAndTail.match(/(\d+(?:\.\d+)?\s*(?:GB|TB))\s*$/i);
  if (!storageMatch || storageMatch.index === undefined) return null;
  const storage = storageMatch[1].replace(/\s+/g, " ");
  const beforeStorage = osAndTail.slice(0, storageMatch.index).trim();
  const ramMatches = [...beforeStorage.matchAll(/\b\d+(?:\.\d+)?\s*GB\b/gi)];
  const ramMatch = ramMatches.at(-1);
  if (!ramMatch || ramMatch.index === undefined) return null;

  const ram = ramMatch[0].replace(/\s+/g, " ");
  const cpu = beforeStorage.slice(ramMatch.index + ramMatch[0].length).trim();
  const osAgeDates = beforeStorage.slice(0, ramMatch.index).trim();
  const details = osAgeDates.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:(\d{1,2}\/\d{1,2}\/20\d{2})\s*)?(?:(\d{1,2}\/\d{1,2}\/20\d{2})\s*)?$/i);
  if (!details || !cpu) return null;

  return {
    type,
    name: name || `${type}-${serial}`,
    user,
    lastCheckIn: dateMatch[0],
    make,
    serial,
    model,
    os: details[1].trim(),
    age: numeric(details[2]),
    purchased: details[3] ?? "",
    warrantyExpires: details[4] ?? "",
    ram,
    cpu,
    storage,
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
    osStatus: "unknown",
  };
}



function identityWithoutCheckIn(beforeMake: string, pendingName: string[], type: "server" | "workstation", serial: string): { name: string; user: string } {
  const parts = beforeMake.split(/\s+/).filter(Boolean);
  const pending = cleanScalePadDeviceName(pendingName.join(""));
  const isContinuation = (token: string): boolean => /[-_.]/.test(token)
    || /^\d+$/.test(token)
    || (/^[A-Z0-9]+$/.test(token) && token === token.toUpperCase());

  const inlineName: string[] = [];
  if (!pending && parts.length) inlineName.push(parts.shift()!);
  while (parts.length && isContinuation(parts[0])) inlineName.push(parts.shift()!);

  return {
    name: cleanScalePadDeviceName(`${pending}${inlineName.join("")}`) || `${type}-${serial}`,
    user: parts.join(" "),
  };
}

function preserveWrappedNameContinuation(name: string, beforeMake: string): string {
  return /[-_.]\s*$/.test(beforeMake) && name && !/[-_.]$/.test(name) ? `${name}-` : name;
}

function parsePhysicalDeviceWithoutCheckIn(line: string, type: "server" | "workstation", pendingName: string[]): LifecycleDevice | null {
  // A blank Last Check-In is valid source data. Do not infer a date from Purchased or Expires,
  // and do not discard the device simply because ScalePad has no recent check-in value.
  const makeMatch = line.match(/\b(Dell|HP|HPE|Lenovo|EQUUS|Supermicro|Microsoft|Apple|Acer|ASUS)\b\s+/i);
  if (!makeMatch || makeMatch.index === undefined) return null;

  const beforeMake = line.slice(0, makeMatch.index).trim();
  const make = makeMatch[1];
  const afterMake = line.slice(makeMatch.index + makeMatch[0].length).trim();
  const serialMatch = afterMake.match(/^(\S+)\s+/);
  if (!serialMatch) return null;
  const serial = serialMatch[1];
  const remainder = afterMake.slice(serialMatch[0].length).replace(/\s+/g, " ").trim();
  const osStart = remainder.search(/\b(?:Microsoft\s+)?(?:Windows|Server|macOS|Chrome\s*OS|Linux)\b/i);
  if (osStart < 0) return null;

  const model = remainder.slice(0, osStart).trim();
  const osAndTail = remainder.slice(osStart).trim();
  const storageMatch = osAndTail.match(/(\d+(?:\.\d+)?\s*(?:GB|TB))\s*$/i);
  if (!storageMatch || storageMatch.index === undefined) return null;
  const storage = storageMatch[1].replace(/\s+/g, " ");
  const beforeStorage = osAndTail.slice(0, storageMatch.index).trim();
  const ramMatches = [...beforeStorage.matchAll(/\b\d+(?:\.\d+)?\s*GB\b/gi)];
  const ramMatch = ramMatches.at(-1);
  if (!ramMatch || ramMatch.index === undefined) return null;

  const ram = ramMatch[0].replace(/\s+/g, " ");
  const cpu = beforeStorage.slice(ramMatch.index + ramMatch[0].length).trim();
  const osAgeDates = beforeStorage.slice(0, ramMatch.index).trim();
  const details = osAgeDates.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:(\d{1,2}\/\d{1,2}\/20\d{2})\s*)?(?:(\d{1,2}\/\d{1,2}\/20\d{2})\s*)?$/i);
  if (!details || !cpu || !model) return null;

  const identity = identityWithoutCheckIn(beforeMake, pendingName, type, serial);

  return {
    type,
    name: preserveWrappedNameContinuation(identity.name, beforeMake),
    user: identity.user,
    lastCheckIn: "",
    make,
    serial,
    model,
    os: details[1].trim(),
    age: numeric(details[2]),
    purchased: details[3] ?? "",
    warrantyExpires: details[4] ?? "",
    ram,
    cpu,
    storage,
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
    osStatus: "unknown",
  };
}


function parsePhysicalDeviceMinimal(line: string, type: "server" | "workstation", pendingName: string[]): LifecycleDevice | null {
  const dateMatch = line.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/);
  if (!dateMatch || dateMatch.index === undefined) return null;
  const beforeDate = line.slice(0, dateMatch.index).trim();
  const prefixParts = beforeDate.split(/\s+/).filter(Boolean);
  const user = prefixParts.length ? prefixParts.at(-1)! : "";
  const inlineName = prefixParts.slice(0, -1).join("");
  const name = preserveWrappedNameContinuation(
    cleanScalePadDeviceName(inlineName || pendingName.at(-1) || pendingName.join("")),
    inlineName,
  );
  if (!name) return null;

  const afterDate = line.slice(dateMatch.index + dateMatch[0].length).replace(/\s+/g, " ").trim();
  const osStart = afterDate.search(/\b(?:Microsoft\s+)?(?:Windows|Server|macOS|Chrome\s*OS|Linux)\b/i);
  if (osStart < 0) return null;
  const identityPrefix = afterDate.slice(0, osStart).trim();
  let osAndTail = afterDate.slice(osStart).trim();
  if (!identityPrefix || !osAndTail) return null;

  const knownMake = identityPrefix.match(/^(Dell|HP|HPE|Lenovo|EQUUS|Supermicro|Microsoft|Apple|Acer|ASUS|MSI|Intel)\s+(\S+)\s+(.+)$/i);
  const make = knownMake?.[1] ?? "";
  const serial = knownMake?.[2] ?? "";
  const model = (knownMake?.[3] ?? identityPrefix).trim();

  const storageMatch = osAndTail.match(/(\d+(?:\.\d+)?\s*(?:GB|TB))\s*$/i);
  const storage = storageMatch?.[1]?.replace(/\s+/g, " ") ?? "";
  if (storageMatch?.index !== undefined) osAndTail = osAndTail.slice(0, storageMatch.index).trim();
  const ramMatch = osAndTail.match(/\b\d+(?:\.\d+)?\s*GB\b/i);
  const os = ramMatch?.index !== undefined ? osAndTail.slice(0, ramMatch.index).trim() : osAndTail;
  const ram = ramMatch?.[0]?.replace(/\s+/g, " ") ?? "";
  const cpu = ramMatch?.index !== undefined ? osAndTail.slice(ramMatch.index + ramMatch[0].length).trim() : "";
  if (!os || !model) return null;

  return {
    type,
    name,
    user,
    lastCheckIn: dateMatch[0],
    make,
    serial,
    model,
    os,
    age: 0,
    purchased: "",
    warrantyExpires: "",
    ram,
    cpu,
    storage,
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
    osStatus: exportOsStatus(os),
  };
}


function parsePhysicalDeviceLoose(block: string, type: "server" | "workstation", pendingName: string[]): LifecycleDevice | null {
  // ScalePad sometimes places a blank Last Check-In cell in the middle of a row and
  // wraps the device name across several visual lines. In that layout PDF text
  // extraction may give us only: name fragments + make + serial + model + OS + age.
  // The device still exists and must be counted even when warranty, RAM, CPU, storage,
  // or check-in data are absent.
  const normalized = block.replace(/\s+/g, " ").trim();
  const makeMatch = normalized.match(/\b(Dell|HP|HPE|Lenovo|EQUUS|Supermicro|Microsoft|Apple|Acer|ASUS)\b\s+/i);
  if (!makeMatch || makeMatch.index === undefined) return null;

  const beforeMake = normalized.slice(0, makeMatch.index).trim();
  const make = makeMatch[1];
  let afterMake = normalized.slice(makeMatch.index + makeMatch[0].length).trim();
  const serialMatch = afterMake.match(/^(\S+)\s+/);
  if (!serialMatch) return null;
  const serial = serialMatch[1];
  afterMake = afterMake.slice(serialMatch[0].length).trim();

  const osStart = afterMake.search(/\b(?:Microsoft\s+)?(?:Windows|Server|macOS|Chrome\s*OS|Linux)\b/i);
  if (osStart < 0) return null;
  const model = afterMake.slice(0, osStart).trim();
  if (!model) return null;

  const osAndTail = afterMake.slice(osStart).trim();
  // Age is the first standalone number after the OS whose next value is either a
  // date, memory/storage value, or the end of the reconstructed row. This avoids
  // mistaking OS years such as 2012 or 2025 for device age.
  const ageMatch = osAndTail.match(/\s(\d+(?:\.\d+)?)\s*(?=(?:\d{1,2}\/\d{1,2}\/20\d{2}\b|\d+(?:\.\d+)?\s*(?:GB|TB)\b|$))/i);
  if (!ageMatch || ageMatch.index === undefined) return null;
  const os = osAndTail.slice(0, ageMatch.index).trim();
  const age = numeric(ageMatch[1]);
  if (!os || !Number.isFinite(age)) return null;

  const tail = osAndTail.slice(ageMatch.index + ageMatch[0].length).trim();
  const dates = [...tail.matchAll(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g)].map((match) => match[0]);
  const purchased = dates[0] ?? "";
  const warrantyExpires = dates[1] ?? "";
  const memoryAndStorage = [...tail.matchAll(/\b\d+(?:\.\d+)?\s*(?:GB|TB)\b/gi)].map((match) => match[0].replace(/\s+/g, " "));
  const ram = memoryAndStorage.length >= 2 ? memoryAndStorage.at(-2)! : "";
  const storage = memoryAndStorage.at(-1) ?? "";

  const identity = identityWithoutCheckIn(beforeMake, pendingName, type, serial);

  return {
    type,
    name: preserveWrappedNameContinuation(identity.name, beforeMake),
    user: identity.user,
    lastCheckIn: "",
    make,
    serial,
    model,
    os,
    age,
    purchased,
    warrantyExpires,
    ram,
    cpu: "",
    storage,
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
    osStatus: "unknown",
  };
}

function parseVmDevice(line: string, pendingName: string[]): LifecycleDevice | null {
  const dateMatch = line.match(/\b\d{2}\/\d{2}\/20\d{2}\b/);
  if (!dateMatch || dateMatch.index === undefined || !/Virtual Machine/i.test(line)) return null;
  const beforeDate = line.slice(0, dateMatch.index).trim().split(/\s+/).filter(Boolean);
  const user = beforeDate.length ? beforeDate[beforeDate.length - 1] : "";
  const inlineName = beforeDate.slice(0, -1).join("");
  const name = (inlineName || pendingName.join("")).replace(/[^A-Za-z0-9_.-]/g, "");
  const after = line.slice(dateMatch.index + dateMatch[0].length).trim();
  const match = after.match(/^Microsoft\s+Virtual Machine\s+(.*?)\s+(\d+(?:\.\d+)?\s+GB)\s+(.+?)\s+(\d+(?:\.\d+)?\s+(?:GB|TB))$/i);
  if (!match) return null;
  return {
    type: "vm",
    name: name || "Virtual machine",
    user,
    lastCheckIn: dateMatch[0],
    make: "Microsoft",
    serial: "",
    model: "Virtual Machine",
    os: match[1].trim(),
    age: 0,
    purchased: "",
    warrantyExpires: "",
    ram: match[2],
    cpu: match[3].trim(),
    storage: match[4],
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
    osStatus: exportOsStatus(match[1]),
  };
}

function parseNetworkDevice(line: string): LifecycleDevice | null {
  if (/Network Make Serial Model Storage/i.test(line)) return null;
  const withMakeAndLifecycle = line.match(/^(\S+)\s+([A-Za-z][A-Za-z0-9&.-]*)\s+(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d{1,2}\/\d{1,2}\/20\d{2})\s+(\d+(?:\.\d+)?\s+(?:bytes|GB|TB))$/i);
  const withoutMakeAndLifecycle = line.match(/^(\S+)\s+(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d{1,2}\/\d{1,2}\/20\d{2})\s+(\d+(?:\.\d+)?\s+(?:bytes|GB|TB))$/i);
  const basic = line.match(/^(\S+)\s+([A-Za-z][A-Za-z0-9&.-]*)\s+(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?\s+(?:bytes|GB|TB))$/i);
  if (!withMakeAndLifecycle && !withoutMakeAndLifecycle && !basic) return null;

  const name = withMakeAndLifecycle?.[1] ?? withoutMakeAndLifecycle?.[1] ?? basic![1];
  const make = withMakeAndLifecycle?.[2] ?? basic?.[2] ?? "";
  const serial = withMakeAndLifecycle?.[3] ?? withoutMakeAndLifecycle?.[2] ?? basic![3];
  const model = withMakeAndLifecycle?.[4] ?? withoutMakeAndLifecycle?.[3] ?? basic![4];
  const age = numeric(withMakeAndLifecycle?.[5] ?? withoutMakeAndLifecycle?.[4]);
  const purchased = withMakeAndLifecycle?.[6] ?? withoutMakeAndLifecycle?.[5] ?? "";
  const storage = withMakeAndLifecycle?.[7] ?? withoutMakeAndLifecycle?.[6] ?? basic![5];
  return {
    type: "network",
    name,
    user: "",
    lastCheckIn: "",
    make,
    serial,
    model: model.trim(),
    os: "",
    age,
    purchased,
    warrantyExpires: "",
    ram: "",
    cpu: "",
    storage,
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
    osStatus: "unknown",
  };
}

function isCloudPlusBdrIdentity(identity: string): boolean {
  const compact = identity.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return /CP[\s_-]?BDR/i.test(identity)
    || /CPBR/i.test(identity)
    || /CLOUD\s*PLUS\s*BDR/i.test(identity)
    || compact.includes("CPBDR")
    || compact.includes("CPBR")
    || compact.includes("CLOUDPLUSBDR")
    || /\bEQUUS\b/i.test(identity);
}

function isVirtualMachineIdentity(identity: string): boolean {
  return classifyTechnicalDevice({ name: identity, model: identity, graphics: identity, os: identity }).isVirtual;
}

function isCloudPlusBdrDevice(device: Pick<LifecycleDevice, "name" | "make" | "model" | "serial" | "os" | "user">): boolean {
  return isCloudPlusBdrIdentity(`${device.name} ${device.make} ${device.model} ${device.serial} ${device.os} ${device.user}`);
}

function firstDate(value: string): string {
  return value.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/)?.[0] ?? "";
}

function looseBackupServerName(block: string, blockLines: string[]): string {
  let tightened = block;
  for (let index = 0; index < 3; index += 1) {
    tightened = tightened.replace(/([A-Za-z0-9_.])\s*-\s*([A-Za-z0-9_.])/g, "$1-$2");
  }
  const named = tightened.match(/\b[A-Za-z0-9_.-]*CP(?:[\s_-]?BDR|BR)[A-Za-z0-9_.-]*\b/i)?.[0]
    ?.replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9_.-]/g, "");
  if (named && named.length >= 4) {
    const datedLine = blockLines.find((line) => firstDate(line));
    const makeMatch = datedLine?.match(/\b(?:EQUUS|Dell|HP|HPE|Lenovo|Supermicro)\b/i);
    const prefix = makeMatch?.index !== undefined
      ? datedLine!.slice(0, makeMatch.index).trim().replace(/[^A-Za-z0-9_.-]/g, "")
      : "";
    if (prefix && !normalizedTechnicalIdentity(named).startsWith(normalizedTechnicalIdentity(prefix))) return `${prefix}${named}`;
    return named;
  }

  const datedLine = blockLines.find((line) => firstDate(line));
  if (datedLine) {
    const beforeDate = datedLine.slice(0, datedLine.indexOf(firstDate(datedLine))).trim();
    const parts = beforeDate.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts.slice(0, -1).join("").replace(/[^A-Za-z0-9_.-]/g, "");
      if (candidate && !/^(Servers?|Workstations?|User)$/i.test(candidate)) return candidate;
    }
  }

  const shortIdentifier = [...blockLines]
    .reverse()
    .find((line) => !firstDate(line) && line.length <= 40 && /^[A-Za-z0-9_.-]+$/.test(line) && !/^(CPBDR|CPBR|EQUUS)$/i.test(line));
  return shortIdentifier?.replace(/[^A-Za-z0-9_.-]/g, "") || "Cloud-Plus-BDR";
}

function looseBackupServerAge(block: string): number {
  const ageBeforePurchase = block.match(/\b(\d+(?:\.\d+)?)\s+(?=\d{1,2}\/\d{1,2}\/20\d{2}\b)/)?.[1];
  if (ageBeforePurchase) return numeric(ageBeforePurchase);
  const labeledAge = block.match(/\bAge\s*[:=-]?\s*(\d+(?:\.\d+)?)/i)?.[1];
  if (labeledAge) return numeric(labeledAge);
  return 0;
}

function isInventorySectionHeader(line: string): boolean {
  return /^\[\[PAGE\s+\d+\]\]$/i.test(line)
    || /\b(?:Servers?|Workstations?|Virtual Machines?|Network)\b.*\b(?:User|Make)\b/i.test(line);
}

function likelyBackupContinuation(line: string): boolean {
  return /\b(?:EQUUS|Dell|HP|HPE|Lenovo|Supermicro)\b/i.test(line)
    || /\b(?:Cloud\s*Plus|BDR|Recovery|Backup|Appliance)\b/i.test(line);
}

function parseCloudPlusBdrFallback(inventoryText: string): LifecycleDevice[] {
  const reportLines = lines(inventoryText);
  const markerIndexes = reportLines
    .map((line, index) => isCloudPlusBdrIdentity(line) ? index : -1)
    .filter((index) => index >= 0);
  const clusters: number[][] = [];
  for (const markerIndex of markerIndexes) {
    const current = clusters.at(-1);
    if (current && markerIndex - current.at(-1)! <= 4) current.push(markerIndex);
    else clusters.push([markerIndex]);
  }

  const candidates: LifecycleDevice[] = [];
  for (const cluster of clusters) {
    const firstMarker = cluster[0];
    const lastMarker = cluster.at(-1)!;
    let start = firstMarker;
    const earliest = Math.max(0, firstMarker - 4);
    for (let index = firstMarker - 1; index >= earliest; index -= 1) {
      if (isInventorySectionHeader(reportLines[index])) break;
      const date = firstDate(reportLines[index]);
      const tokenCount = reportLines[index].split(/\s+/).length;
      if (date && tokenCount > 5 && !likelyBackupContinuation(reportLines[index])) break;
      start = index;
    }

    let end = lastMarker + 1;
    const latest = Math.min(reportLines.length, lastMarker + 5);
    let includedCheckInLine = reportLines.slice(start, end).some((line) => firstDate(line));
    for (let index = end; index < latest; index += 1) {
      const line = reportLines[index];
      if (isInventorySectionHeader(line)) break;
      const date = firstDate(line);
      const tokenCount = line.split(/\s+/).length;
      if (date && includedCheckInLine && tokenCount > 5 && !likelyBackupContinuation(line)) break;
      end = index + 1;
      if (date) includedCheckInLine = true;
    }

    const blockLines = reportLines.slice(start, end);
    const block = blockLines.join(" ").replace(/\s+/g, " ").trim();
    if (!isCloudPlusBdrIdentity(block)) continue;

    const dates = [...block.matchAll(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g)].map((match) => match[0]);
    const lastCheckIn = dates[0] ?? "";
    const lastCheckPosition = lastCheckIn ? block.indexOf(lastCheckIn) : -1;
    const afterCheckIn = lastCheckPosition >= 0 ? block.slice(lastCheckPosition + lastCheckIn.length).trim() : block;
    const make = /\bEQUUS\b/i.test(block)
      ? "EQUUS"
      : afterCheckIn.match(/^([A-Za-z][A-Za-z0-9&.-]*)\s+/)?.[1] ?? "";
    const afterMake = make ? afterCheckIn.replace(new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "") : afterCheckIn;
    const serial = afterMake.match(/^(\S+)\s+/)?.[1] ?? "";
    const age = looseBackupServerAge(block);
    const os = block.match(/\b((?:Microsoft\s+)?(?:Windows\s+)?Server\s+20\d{2}[^0-9]*?(?:Standard|Essentials|Datacenter)?(?:\s+Edition)?)/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const warrantyExpires = dates.length >= 3 ? dates[2] : dates.length >= 2 ? dates.at(-1) ?? "" : "";
    const purchased = dates.length >= 3 ? dates[1] : "";
    const memoryAndStorage = [...block.matchAll(/\b\d+(?:\.\d+)?\s*(?:GB|TB)\b/gi)].map((match) => match[0].replace(/\s+/g, " "));
    const ram = memoryAndStorage.length >= 2 ? memoryAndStorage.at(-2)! : "";
    const storage = memoryAndStorage.at(-1) ?? "";
    const name = looseBackupServerName(block, blockLines);

    candidates.push({
      type: "backup-server",
      name,
      user: "",
      lastCheckIn,
      make,
      serial,
      model: /\bEQUUS\b/i.test(block) ? "Cloud Plus backup appliance" : "Cloud Plus backup appliance",
      os,
      age,
      purchased,
      warrantyExpires,
      ram,
      cpu: "",
      storage,
      graphics: "",
      location: "",
      lifecycleStatus: lifecycleStatusForAge("backup-server", age),
      osStatus: exportOsStatus(os),
    });
  }

  return candidates;
}

function technicalDeviceType(type: LifecycleDevice["type"]): TechnicalDeviceType {
  if (type === "server" || type === "backup-server") return "physical-server";
  if (type === "workstation") return "physical-workstation";
  if (type === "vm") return "virtual-workstation";
  if (type === "network") return "network";
  return "unknown";
}

function lifecycleStatusForAge(type: "server" | "backup-server" | "workstation", age: number, model = "Known hardware", warrantyExpires = "", referenceDate = new Date()): LifecycleDevice["lifecycleStatus"] {
  const lifecycle = classifyTechnicalLifecycle({
    deviceType: technicalDeviceType(type),
    isVirtual: false,
    model: model || "Known hardware",
    ageYears: age,
    warrantyEnd: warrantyExpires,
  }, undefined, referenceDate);
  return technicalLifecycleToReport(lifecycle);
}

function parseScalePadInventory(inventoryText: string, fullReportText = inventoryText): LifecycleDevice[] {
  const result: LifecycleDevice[] = [];
  let section: LifecycleDevice["type"] | "" = "";
  let pendingName: string[] = [];
  let lastDevice: LifecycleDevice | null = null;
  const ignored = /^(Hardware Lifecycle Report|Advantage Technologies|Information is deemed|Last Check-In|Make Serial|User Last|Age Purchased|Storage|OS|RAM|CPU)$/i;

  const inventoryLines = lines(inventoryText);
  for (let lineIndex = 0; lineIndex < inventoryLines.length; lineIndex += 1) {
    const rawLine = inventoryLines[lineIndex];
    const line = rawLine.replace(/^\W+/, "").trim();
    if (/\bServers?\b.*\bUser\b/i.test(line)) { section = "server"; pendingName = []; lastDevice = null; continue; }
    if (/\bWorkstations?\b.*\bUser\b/i.test(line)) { section = "workstation"; pendingName = []; lastDevice = null; continue; }
    if (/\bVirtual Machines?\b.*\bUser\b/i.test(line)) { section = "vm"; pendingName = []; lastDevice = null; continue; }
    if (/\bNetwork\b.*\bMake\b.*\bSerial\b/i.test(line)) { section = "network"; pendingName = []; lastDevice = null; continue; }
    if (!section || ignored.test(line) || isScalePadColumnHeaderFragment(line)) continue;

    if (lastDevice && lastDevice.name.endsWith("-") && !/\d{1,2}\/\d{1,2}\/20\d{2}/.test(line) && line.length <= 30 && /^[A-Za-z0-9_.-]+$/.test(line)) {
      lastDevice.name = `${lastDevice.name}${line.replace(/[^A-Za-z0-9_.-]/g, "")}`;
      continue;
    }

    if (section === "server" || section === "workstation") {
      let parsed = parsePhysicalDevice(line, section, pendingName)
        ?? parsePhysicalDeviceWithoutCheckIn(line, section, pendingName)
        ?? parsePhysicalDeviceLoose(line, section, pendingName)
        ?? parsePhysicalDeviceMinimal(line, section, pendingName);
      let consumedThrough = lineIndex;

      // PDF text extraction can split one table row across several visual lines,
      // especially when the device name wraps and Last Check-In is blank. Rebuild
      // a small row window before deciding that the server/workstation is absent.
      if (!parsed) {
        const fragments: string[] = [];
        for (let lookAhead = lineIndex; lookAhead < Math.min(inventoryLines.length, lineIndex + 5); lookAhead += 1) {
          const fragment = inventoryLines[lookAhead].replace(/^\W+/, "").trim();
          if (lookAhead > lineIndex && (/\bServers?\b.*\bUser\b/i.test(fragment) || /\bWorkstations?\b.*\bUser\b/i.test(fragment) || /\bVirtual Machines?\b.*\bUser\b/i.test(fragment) || /\bNetwork\b.*\bMake\b.*\bSerial\b/i.test(fragment))) break;
          if (ignored.test(fragment) || isScalePadColumnHeaderFragment(fragment)) continue;
          fragments.push(fragment);
          const joined = fragments.join(" ");
          parsed = parsePhysicalDevice(joined, section, pendingName)
            ?? parsePhysicalDeviceWithoutCheckIn(joined, section, pendingName)
            ?? parsePhysicalDeviceLoose(joined, section, pendingName)
            ?? parsePhysicalDeviceMinimal(joined, section, pendingName);
          if (parsed) { consumedThrough = lookAhead; break; }
        }
      }

      if (parsed) {
        result.push(parsed);
        lastDevice = parsed;
        pendingName = [];
        lineIndex = consumedThrough;
        continue;
      }
    } else if (section === "vm") {
      const parsed = parseVmDevice(line, pendingName);
      if (parsed) { result.push(parsed); lastDevice = parsed; pendingName = []; continue; }
    } else if (section === "network") {
      const parsed = parseNetworkDevice(line);
      if (parsed) { result.push(parsed); lastDevice = parsed; continue; }
    }

    if (!/\d{1,2}\/\d{1,2}\/20\d{2}/.test(line) && line.length <= 40 && /^[A-Za-z0-9_.-]+$/.test(line)) {
      const candidate = cleanScalePadDeviceName(line);
      const prior = pendingName.join("");
      pendingName = prior && (prior.endsWith("-") || /^\d+$/.test(candidate) || candidate.startsWith("-"))
        ? [...pendingName, candidate]
        : [candidate];
      if (pendingName.length > 4) pendingName.shift();
    }
  }

  for (const fallback of parseCloudPlusBdrFallback(fullReportText)) {
    const serial = fallback.serial.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = fallback.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = result.find((device) => {
      const existingSerial = device.serial.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const existingName = device.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      return (serial && existingSerial === serial) || (name && existingName === name);
    });
    if (existing) {
      existing.type = "backup-server";
      existing.name = existing.name || fallback.name;
      existing.make = existing.make || fallback.make;
      existing.model = existing.model || fallback.model;
      existing.os = existing.os || fallback.os;
      existing.age = existing.age || fallback.age;
      existing.purchased = existing.purchased || fallback.purchased;
      existing.warrantyExpires = existing.warrantyExpires || fallback.warrantyExpires;
      existing.ram = existing.ram || fallback.ram;
      existing.storage = existing.storage || fallback.storage;
    } else {
      result.push(fallback);
    }
  }

  result.forEach((device) => {
    device.name = cleanScalePadDeviceName(device.name) || device.name;
    if ((device.type === "server" || device.type === "workstation") && isVirtualMachineIdentity(`${device.name} ${device.make} ${device.model} ${device.os} ${device.graphics}`)) {
      device.type = "vm";
    } else if ((device.type === "server" || device.type === "workstation") && isCloudPlusBdrDevice(device)) {
      device.type = "backup-server";
    }
    if (device.type === "server" || device.type === "backup-server" || device.type === "workstation") {
      device.lifecycleStatus = lifecycleStatusForAge(device.type, device.age);
    }
    device.osStatus = exportOsStatus(device.os);
  });

  const unique = new Map<string, LifecycleDevice>();
  for (const device of result) {
    const key = lifecycleDeviceIdentityKey(device);
    const existing = unique.get(key);
    const preferBackupServer = device.type === "backup-server" && existing?.type !== "backup-server";
    const deviceCheckIn = Date.parse(device.lastCheckIn);
    const existingCheckIn = Date.parse(existing?.lastCheckIn ?? "");
    const newerCheckIn = Number.isFinite(deviceCheckIn)
      && (!Number.isFinite(existingCheckIn) || deviceCheckIn >= existingCheckIn);
    if (!existing || preferBackupServer || newerCheckIn) unique.set(key, device);
  }
  return [...unique.values()];
}

function namesForStatus(devices: LifecycleDevice[], status: LifecycleDevice["lifecycleStatus"]): string[] {
  return devices.filter((device) => device.lifecycleStatus === status).map((device) => device.name);
}

export function parseScalePadReport(text: string, fileId: string, fileName: string): FileAnalysis {
  const summary = page(text, 1);
  const inventoryPages = pagesFrom(text, 2);
  const reportedCurrent = captureNumber(summary, /Replacement status:[\s\S]*?(\d[\d,]*)\s+Supported/i);
  const reportedDueSoon = labeledCount(summary, "Due soon");
  const reportedOverdue = labeledCount(summary, "Overdue");
  const reportedUnknown = labeledCount(summary, "Unknown");
  const reportedOsSupported = labeledCount(summary, "OS supported");
  const reportedOsEndingSoon = labeledCount(summary, "OS ending soon");
  const reportedOsUnsupported = labeledCount(summary, "OS unsupported");
  const reportedCounts = scalePadAssetCounts(summary);
  const devices = parseScalePadInventory(inventoryPages || text, text);
  const parsedCounts = {
    servers: devices.filter((device) => device.type === "server").length,
    backupServers: devices.filter((device) => device.type === "backup-server").length,
    workstations: devices.filter((device) => device.type === "workstation").length,
    vms: devices.filter((device) => device.type === "vm").length,
    networkDevices: devices.filter((device) => device.type === "network").length,
  };
  const physicalDevices = devices.filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation");
  const namedPhysicalTotal = physicalDevices.length;
  const reportedPhysicalTotal = reportedCounts.servers + reportedCounts.workstations;
  const hasNamedPhysicalInventory = namedPhysicalTotal > 0;
  const hasCompleteNamedPhysicalInventory = hasNamedPhysicalInventory && namedPhysicalTotal >= reportedPhysicalTotal;
  const backupServers = parsedCounts.backupServers;
  const reportedPrimaryServers = Math.max(0, reportedCounts.servers - backupServers);
  const servers = hasCompleteNamedPhysicalInventory ? parsedCounts.servers : reportedPrimaryServers;
  const workstations = hasCompleteNamedPhysicalInventory ? parsedCounts.workstations : reportedCounts.workstations;
  const vms = reportedCounts.vms || parsedCounts.vms;
  const networkDevices = reportedCounts.networkDevices || parsedCounts.networkDevices;
  const physicalTotal = Math.max(reportedPhysicalTotal, namedPhysicalTotal);
  const reportedInventoryTotal = reportedCounts.servers + reportedCounts.workstations + reportedCounts.vms + reportedCounts.networkDevices;
  const explicitHardwareTotal = captureNumber(summary, /(\d[\d,]*)\s+Hardware assets/i);
  const reportedNonPhysicalTotal = Math.max(0, Math.max(explicitHardwareTotal, reportedInventoryTotal) - physicalTotal);
  const reportedPhysicalUnknown = Math.max(0, reportedUnknown - reportedNonPhysicalTotal);
  const parsedOverdue = physicalDevices.filter((device) => device.lifecycleStatus === "overdue").length;
  const parsedDueSoon = physicalDevices.filter((device) => device.lifecycleStatus === "due-soon").length;
  const parsedCurrent = physicalDevices.filter((device) => device.lifecycleStatus === "current").length;
  const parsedUnknown = physicalDevices.filter((device) => device.lifecycleStatus === "unknown").length;
  const hasReportedLifecycleSummary = reportedCurrent + reportedDueSoon + reportedOverdue + reportedUnknown > 0;
  const overdue = hasReportedLifecycleSummary ? Math.min(reportedOverdue, physicalTotal) : parsedOverdue;
  const dueSoon = hasReportedLifecycleSummary ? Math.min(reportedDueSoon, Math.max(0, physicalTotal - overdue)) : parsedDueSoon;
  const unknown = hasReportedLifecycleSummary ? Math.min(reportedPhysicalUnknown, Math.max(0, physicalTotal - overdue - dueSoon)) : parsedUnknown + Math.max(0, physicalTotal - namedPhysicalTotal);
  const explicitCurrent = Math.min(reportedCurrent, Math.max(0, physicalTotal - overdue - dueSoon - unknown));
  const current = hasReportedLifecycleSummary
    ? (reportedCurrent > 0 ? explicitCurrent : Math.max(0, physicalTotal - overdue - dueSoon - unknown))
    : parsedCurrent;
  const totalAssets = Math.max(explicitHardwareTotal, reportedInventoryTotal, devices.length);
  const osInventoryDevices = devices.filter((device) => device.type !== "network" && Boolean(device.os));
  const hasReportedOsSummary = reportedOsSupported + reportedOsEndingSoon + reportedOsUnsupported > 0;
  const osSupported = hasReportedOsSummary ? reportedOsSupported : osInventoryDevices.filter((device) => device.osStatus === "supported").length;
  const osEndingSoon = hasReportedOsSummary ? reportedOsEndingSoon : osInventoryDevices.filter((device) => device.osStatus === "ending-soon").length;
  const osUnsupported = hasReportedOsSummary ? reportedOsUnsupported : osInventoryDevices.filter((device) => device.osStatus === "unsupported").length;
  const reportPeriod = reportDate(summary);
  const expiredWarranty = devices.filter((device) => device.warrantyExpires && device.lifecycleStatus !== "unknown").map((device) => device.name);
  const sampleBudget = captureNumber(page(text, 3), /Budget Amount[\s\S]*?\$([\d,]+)\s*$/im)
    || captureNumber(page(text, 3), /\$([\d,]+)\s+The Hidden Cost/i);
  const sourceKind = "scalepad" as const;
  const fieldSourceLabel = technicalSourceLabel(sourceKind);
  devices.forEach((device) => {
    device.sourceName = fieldSourceLabel;
    device.authoritative = false;
    device.sourceDetails = {
      identity: fieldSourceLabel,
      inventory: fieldSourceLabel,
      classification: fieldSourceLabel,
      os: fieldSourceLabel,
      activity: fieldSourceLabel,
      storage: fieldSourceLabel,
      lifecycle: fieldSourceLabel,
      warranty: fieldSourceLabel,
    };
  });

  const facts: ExtractedFact[] = [
    fact({ key: "technical.truth.version", label: "Shared technical truth version", value: TECHNICAL_TRUTH_VERSION, category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Shared Phase 5 classification layer" }),
    fact({ key: "technical.source.primary", label: "Primary technical source", value: fieldSourceLabel, category: "planning", confidence: "high", sourceFileId: fileId, evidence: "ScalePad lifecycle source used for lifecycle findings and enrichment" }),
    fact({ key: "technical.source.identity", label: "Inventory identity source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Device names and inventory rows" }),
    fact({ key: "technical.source.inventory", label: "Inventory scope source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Inventory rows and current technical scope" }),
    fact({ key: "technical.source.classification", label: "Device classification source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Shared physical, virtual, server, workstation, and network classification" }),
    fact({ key: "technical.source.os", label: "Operating system source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Operating-system fields in the technical source" }),
    fact({ key: "technical.source.activity", label: "Activity status source", value: fieldSourceLabel, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Last check-in and activity fields in the technical source" }),
    fact({ key: "technical.source.storage", label: "Storage source", value: fieldSourceLabel, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Disk usage fields in the technical source" }),
    fact({ key: "technical.source.lifecycle", label: "Lifecycle source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Age, purchase, and warranty fields in the technical source" }),
    fact({ key: "technical.source.warranty", label: "Warranty source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Warranty fields in the technical source" }),

    fact({ key: "scalepad.reportPeriod", label: "Lifecycle report period", value: reportPeriod, category: "planning", confidence: "high", sourceFileId: fileId, evidence: "ScalePad report header" }),
    fact({ key: "scalepad.totalAssets", label: "Hardware assets", value: totalAssets || devices.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "All servers, workstations, virtual machines, and network devices shown in the ScalePad summary" }),
    fact({ key: "scalepad.physicalAssets", label: "Physical lifecycle assets", value: physicalTotal, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Primary servers, Cloud Plus backup servers, and physical workstations" }),
    fact({ key: "scalepad.sourceReportedTotal", label: "Source-reported inventory total", value: explicitHardwareTotal || reportedInventoryTotal || totalAssets, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad summary asset counts" }),
    fact({ key: "scalepad.parsedInventoryTotal", label: "Parsed detailed inventory total", value: devices.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Unique named devices reconstructed from the detailed inventory pages" }),
    fact({ key: "scalepad.servers", label: "Primary servers", value: servers, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad detailed inventory, excluding Cloud Plus backup servers" }),
    fact({ key: "scalepad.backupServers", label: "Cloud Plus backup servers", value: backupServers, category: "backup", confidence: "high", sourceFileId: fileId, evidence: "CPBDR/CPBR device name, Cloud Plus BDR identification, or EQUUS hardware model in ScalePad inventory" }),
    fact({ key: "scalepad.workstations", label: "Workstations", value: workstations, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad summary page" }),
    fact({ key: "scalepad.vms", label: "Virtual machines", value: vms, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad summary page" }),
    fact({ key: "scalepad.networkDevices", label: "Network devices", value: networkDevices, category: "network", confidence: "high", sourceFileId: fileId, evidence: "ScalePad summary page" }),
    fact({ key: "scalepad.replacement.current", label: "Current devices", value: current, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Total assets less due-soon, overdue, and unknown assets" }),
    fact({ key: "scalepad.replacement.dueSoon", label: "Devices due soon", value: dueSoon, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad replacement-status summary" }),
    fact({ key: "scalepad.replacement.overdue", label: "Devices overdue", value: overdue, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad replacement-status summary" }),
    fact({ key: "scalepad.replacement.unknown", label: "Assets under review", value: unknown, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad replacement-status summary" }),
    fact({ key: "scalepad.os.supported", label: "Operating systems supported", value: osSupported, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad operating-system summary" }),
    fact({ key: "scalepad.os.endingSoon", label: "Operating systems ending soon", value: osEndingSoon, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad operating-system summary" }),
    fact({ key: "scalepad.os.unsupported", label: "Operating systems unsupported", value: osUnsupported, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad operating-system summary" }),
    fact({ key: "scalepad.inventory", label: "Device inventory", value: devices.map((device) => JSON.stringify(device)), category: "lifecycle", confidence: devices.length ? "high" : "medium", sourceFileId: fileId, evidence: "ScalePad detailed hardware inventory" }),
    fact({ key: "scalepad.replaceNow", label: "Replace now", value: namesForStatus(devices, "overdue"), category: "planning", confidence: "high", sourceFileId: fileId, evidence: "ScalePad overdue assets" }),
    fact({ key: "scalepad.planSoon", label: "Plan soon", value: namesForStatus(devices, "due-soon"), category: "planning", confidence: "high", sourceFileId: fileId, evidence: "ScalePad due-soon assets" }),
    fact({ key: "scalepad.warrantyExpired", label: "Warranty expired", value: expiredWarranty, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "ScalePad warranty-expiration column" }),
  ];
  if (sampleBudget) facts.push(fact({ key: "scalepad.sampleBudget", label: "Sample replacement budget", value: sampleBudget, category: "planning", confidence: "medium", sourceFileId: fileId, evidence: "ScalePad sample evergreen budget; discussion only", requiresConfirmation: true }));

  const findings: FindingCandidate[] = [];
  if (overdue) findings.push(finding({ category: "lifecycle", title: `${overdue} device${overdue === 1 ? " is" : "s are"} past the planned lifecycle`, clientSummary: "These systems should be prioritized by business impact so replacements happen deliberately instead of during a failure.", severity: "priority", sourceFileId: fileId, evidence: namesForStatus(devices, "overdue").join(", ") || `${overdue} overdue assets in ScalePad` }));
  if (osUnsupported) findings.push(finding({ category: "lifecycle", title: `${osUnsupported} operating system${osUnsupported === 1 ? " is" : "s are"} no longer supported`, clientSummary: "Unsupported operating systems no longer receive normal security maintenance and should be included in the near-term replacement or upgrade plan.", severity: "priority", sourceFileId: fileId, evidence: devices.filter((device) => device.osStatus === "unsupported").map((device) => `${device.name}: ${device.os}`).join("; ") || `${osUnsupported} unsupported operating systems` }));
  if (osEndingSoon) findings.push(finding({ category: "planning", title: `${osEndingSoon} operating system${osEndingSoon === 1 ? " needs" : "s need"} support planning`, clientSummary: "Server 2016 systems should be included in forward planning, and Windows 11 Home systems should be reviewed for the business-grade Pro edition.", severity: "attention", sourceFileId: fileId, evidence: devices.filter((device) => device.osStatus === "ending-soon").map((device) => `${device.name}: ${device.os}`).join("; ") || `${osEndingSoon} operating systems need planning` }));
  if (dueSoon) findings.push(finding({ category: "planning", title: `${dueSoon} device${dueSoon === 1 ? " is" : "s are"} approaching replacement`, clientSummary: "These systems are not emergency replacements today, but budgeting for them now will prevent a larger unplanned refresh later.", severity: "attention", sourceFileId: fileId, evidence: namesForStatus(devices, "due-soon").join(", ") || `${dueSoon} due-soon assets in ScalePad` }));
  if (current) findings.push(finding({ category: "lifecycle", title: `${current} device${current === 1 ? " remains" : "s remain"} current`, clientSummary: "These devices are within the planned lifecycle window and can remain in service while higher-priority systems are addressed.", severity: "healthy", sourceFileId: fileId, evidence: namesForStatus(devices, "current").join(", ") }));
  const backupPriorities = devices.filter((device) => device.type === "backup-server" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon"));
  if (backupPriorities.length) findings.push(finding({ category: "backup", title: `${backupPriorities.length} Cloud Plus backup server${backupPriorities.length === 1 ? " needs" : "s need"} replacement planning`, clientSummary: "This system provides local and cloud backup plus emergency recovery for the primary server and should be included in the same replacement plan when it reaches lifecycle.", severity: "priority", sourceFileId: fileId, evidence: backupPriorities.map((device) => `${device.name}: ${device.make} ${device.model}, ${device.age} years old`).join("; ") }));
  if (networkDevices) findings.push(finding({ category: "network", title: "Core network equipment is documented", clientSummary: `${networkDevices} network device${networkDevices === 1 ? " is" : "s are"} included in the inventory, giving the practice a clearer baseline for future planning and support.`, severity: "healthy", sourceFileId: fileId, evidence: devices.filter((device) => device.type === "network").map((device) => `${device.name}: ${device.model}`).join("; ") }));

  return {
    sourceType: "scalepad",
    confidence: totalAssets && (devices.length || workstations || servers) ? "high" : "medium",
    title: fileName,
    summary: `${totalAssets} primary servers, Cloud Plus backup servers, and workstations were reviewed: ${overdue} overdue, ${dueSoon} due soon, and ${unknown} under review. The detailed inventory contains ${physicalDevices.length} named physical systems.`,
    facts,
    findingCandidates: findings,
    highlights: [
      `${totalAssets} workstations and servers`,
      `${servers} primary server${servers === 1 ? "" : "s"}, ${backupServers} Cloud Plus backup server${backupServers === 1 ? "" : "s"}, and ${workstations} workstations`,
      ...(vms ? [`${vms} virtual machine${vms === 1 ? "" : "s"} identified separately`] : []),
      `${overdue} overdue · ${dueSoon} due soon`,
      `${osUnsupported} unsupported operating systems`,
    ],
    warnings: [
      ...(sampleBudget ? ["The evergreen budget in the source report is a planning example, not an approved quote."] : []),
      ...(!devices.length ? ["The summary was read, but the detailed inventory needs visual confirmation."] : []),
      ...(reportedInventoryTotal && devices.length !== reportedInventoryTotal ? [`Inventory reconciliation needs review: the ScalePad summary reports ${reportedInventoryTotal} assets, while ${devices.length} detailed device rows were reconstructed.`] : []),
    ],
    rawTextPreview: lines(text).slice(0, 70).join("\n").slice(0, 7000),
    analyzedAt: new Date().toISOString(),
  };
}



export type DeviceInventoryExportRow = Record<string, string>;

function normalizedExportHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function exportRowValue(row: DeviceInventoryExportRow, aliases: string[]): string {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizedExportHeader(key), String(value ?? "").trim()]));
  for (const alias of aliases) {
    const value = normalized.get(normalizedExportHeader(alias));
    if (value) return value;
  }
  return "";
}

function exportDate(value: string): Date | null {
  const clean = value.trim();
  if (!clean) return null;
  const iso = clean.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const us = clean.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (us) {
    const parsed = new Date(Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2])));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2000) return null;
  return parsed;
}

function exportDateLabel(value: string): string {
  const date = exportDate(value);
  if (!date) return "";
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function exportReportPeriod(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function exportAge(start: Date | null, reference: Date): number {
  if (!start || start.getTime() > reference.getTime()) return 0;
  const years = (reference.getTime() - start.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  return Math.max(0.1, Math.round(years * 10) / 10);
}

function exportMake(value: string): string {
  return value
    .replace(/^Dell Inc\.?$/i, "Dell")
    .replace(/^Microsoft Corporation$/i, "Microsoft")
    .replace(/^Hewlett Packard Enterprise$/i, "HPE")
    .replace(/^HP Inc\.?$/i, "HP")
    .trim();
}

function exportModel(value: string, make: string): string {
  const clean = value.trim();
  if (!make) return clean;
  return clean.replace(new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "").trim();
}

function exportOs(value: string): string {
  return value
    .replace(/^Microsoft\s+/i, "")
    .replace(/^Windows Server\s+/i, "Server ")
    .replace(/^Microsoft Windows Server\s+/i, "Server ")
    .trim();
}

function exportUser(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  return clean.split(/[\\/]/).filter(Boolean).at(-1) ?? clean;
}

function exportBytes(value: string): string {
  const raw = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return "";
  if (raw >= 1_000_000_000_000) return `${(raw / 1_000_000_000_000).toFixed(1)} TB`;
  return `${(raw / 1_000_000_000).toFixed(1)} GB`;
}

function exportMemory(row: DeviceInventoryExportRow): string {
  const raw = exportRowValue(row, ["Memory Capacity"]);
  if (raw) return exportBytes(raw);
  const gib = numeric(exportRowValue(row, ["Memory Capacity GiB", "Memory GiB", "RAM GiB"]));
  return gib > 0 ? `${gib.toFixed(gib >= 10 ? 1 : 2).replace(/\.0$/, "")} GiB` : "";
}

function exportStorage(value: string): string {
  const readableCapacities = [...value.matchAll(/Capacity:[^()]*\((\d+(?:\.\d+)?)\s*(TiB|GiB|TB|GB)\)/gi)].map((match) => `${match[1]} ${/t/i.test(match[2]) ? "TB" : "GB"}`);
  if (readableCapacities.length) return readableCapacities.join(" · ");
  const capacities = [...value.matchAll(/Capacity:\s*"?(\d+)/gi)].map((match) => Number(match[1])).filter(Number.isFinite);
  if (capacities.length) return exportBytes(String(capacities.reduce((sum, amount) => sum + amount, 0)));
  const bytes = [...value.matchAll(/\b(\d{9,})\b/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  if (bytes.length) return exportBytes(String(Math.max(...bytes)));
  const readable = value.match(/\b\d+(?:\.\d+)?\s*(?:TiB|GiB|TB|GB)\b/i)?.[0] ?? "";
  return readable.replace(/TiB/i, "TB").replace(/GiB/i, "GB");
}


function exportGraphics(value: string): string {
  const cleaned = value
    .replace(/\(R\)|\(TM\)/gi, "")
    .replace(/\bCorporation\b/gi, "")
    .replace(/\bGraphics Controller\b/gi, "Graphics")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const unique = [...new Set(cleaned.split(/\s*(?:;|,|\||\n)\s*/).map((item) => item.trim()).filter(Boolean))];
  const label = unique.slice(0, 2).join(" + ");
  return label.length > 58 ? `${label.slice(0, 55).trim()}…` : label;
}

function exportOsStatus(os: string): LifecycleDevice["osStatus"] {
  return classifyTechnicalOsSupport(os);
}

function exportDeviceType(row: DeviceInventoryExportRow, name: string, make: string, model: string, graphics: string): LifecycleDevice["type"] {
  const role = exportRowValue(row, ["Device Role", "Role", "Device Type"]);
  const os = exportRowValue(row, ["OS Name", "Operating System", "OS"]);
  const identity = `${name} ${make} ${model} ${graphics} ${role} ${os}`;
  if (isCloudPlusBdrIdentity(identity)) return "backup-server";
  const classification = classifyTechnicalDevice({ name, make, model, graphics, role, os });
  if (classification.deviceType === "virtual-server" || classification.deviceType === "virtual-workstation") return "vm";
  if (classification.deviceType === "physical-server") return "server";
  if (classification.deviceType === "network") return "network";
  return "workstation";
}

function exportWarrantyExpired(device: LifecycleDevice, reference: Date): boolean {
  return technicalWarrantyExpired(device.warrantyExpires, reference);
}

export interface DeviceInventorySourceOptions {
  sourceKind?: Extract<TechnicalSourceKind, "rft" | "scalepad" | "ninja" | "compass">;
  sourceLabel?: string;
  authoritative?: boolean;
}

export function parseDeviceInventoryExport(rows: DeviceInventoryExportRow[], fileId: string, fileName: string, options: DeviceInventorySourceOptions = {}): FileAnalysis {
  const sourceKind = options.sourceKind ?? "scalepad";
  const fieldSourceLabel = options.sourceLabel || technicalSourceLabel(sourceKind);
  const populated = rows.filter((row) => exportRowValue(row, ["Device", "Display Name", "System Name", "Device Name", "Computer Name", "Host Name", "Name"]));
  const referenceCandidates = populated.flatMap((row) => [
    exportDate(exportRowValue(row, ["Last Online", "Last Online formatted", "Last Update", "Last Update formatted", "Last Uptime", "Last Uptime formatted"])),
  ]).filter((value): value is Date => Boolean(value));
  const referenceDate = referenceCandidates.length
    ? new Date(Math.max(...referenceCandidates.map((date) => date.getTime())))
    : new Date();
  const graphicsHeaders = rows.length
    ? Object.keys(rows[0]).filter((key) => /video|graphics|display adapter|gpu/i.test(key))
    : [];

  const devices: LifecycleDevice[] = populated.flatMap((row) => {
    const name = normalizeDeviceName(exportRowValue(row, ["Device", "Display Name", "System Name", "Device Name", "Computer Name", "Host Name", "Name"]));
    const make = exportMake(exportRowValue(row, ["Device Make", "Manufacturer", "Make"]));
    const model = exportModel(exportRowValue(row, ["Device Model", "System Model", "Computer Model", "System Product Name", "Product Name", "Hardware Model", "Model"]), make);
    const explicitGraphics = exportGraphics(exportRowValue(row, ["Video Controllers", "Video Controller", "Video Controllers Name", "Video Controller Name", "Video Cards", "Video Card", "Video Card Name", "Graphics Cards", "Graphics Card", "Graphics Adapters", "Graphics Adapter", "Graphics Adapter Name", "Graphics", "GPU", "GPUs", "GPU Name", "Display Adapters", "Display Adapter", "Display Adapter Name"]));
    const type = exportDeviceType(row, name, make, model, explicitGraphics);
    const purchasedSource = exportRowValue(row, ["Manufacturer Fulfillment Date", "Manufacturer Fulfillment Date formatted", "Warranty Start Date", "Warranty Start Date formatted", "Purchased"]);
    const explicitAgeYears = numeric(exportRowValue(row, ["Age", "Age Years", "Device Age", "Hardware Age"]));
    const explicitAgeMonths = numeric(exportRowValue(row, ["Age (months)", "Age Months", "Device Age Months", "OS Age Months"]));
    const age = type === "network"
      ? 0
      : explicitAgeYears > 0
        ? Math.round(explicitAgeYears * 10) / 10
        : explicitAgeMonths > 0
          ? Math.round((explicitAgeMonths / 12) * 10) / 10
          : exportAge(exportDate(purchasedSource), referenceDate);
    const os = exportOs(exportRowValue(row, ["OS Name", "Operating System", "OS"]));
    const lastOnline = exportRowValue(row, ["Last Online", "Last Online formatted", "Last Update", "Last Update formatted", "Last Check-In", "Last Uptime", "Last Uptime formatted"]);
    const graphics = explicitGraphics || (type === "workstation"
      ? graphicsHeaders.length ? "Not reported" : "Not included in source export"
      : "");
    const storageSource = exportRowValue(row, ["Volumes", "Storage", "Disk Capacity", "Storage Capacity", "Disk Size"]);
    const storageUsageSource = exportRowValue(row, ["Disk Volume Usage", "Disk Volume Usage formatted", "Disk Volume Usage_formatted", "Volume Usage", "Volume Usage formatted", "Volume Usage_formatted", "Disk Usage", "Disk Usage Details", "Volume Usage Details"]);
    const storageUsage = technicalStorageSummary(
      storageUsageSource || (/usage\s*%|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:TiB|GiB|TB|GB)?\s*\//i.test(storageSource) ? storageSource : ""),
      undefined,
      technicalDeviceType(type),
    );
    const location = exportRowValue(row, ["Location", "Site", "Office", "Facility", "Branch"]);
    const device: LifecycleDevice = {
      type,
      name,
      user: exportUser(exportRowValue(row, ["Last Login", "User", "Last User"])),
      lastCheckIn: exportDateLabel(lastOnline),
      make,
      serial: exportRowValue(row, ["BIOS Serial Number", "Serial Number", "Serial"]),
      model,
      os,
      age,
      purchased: exportDateLabel(purchasedSource),
      warrantyExpires: exportDateLabel(exportRowValue(row, ["Warranty End Date", "Warranty End Date formatted", "Warranty Expiry", "Warranty Expires"])),
      ram: exportMemory(row),
      cpu: exportRowValue(row, ["Processors Name", "Processor Name", "CPU"]),
      storage: exportStorage(storageSource),
      storageUsage: storageUsage.summary,
      storagePercent: storageUsage.percent,
      storageFreeGb: storageUsage.freeGb,
      graphics,
      location,
      lifecycleStatus: type === "server" || type === "backup-server" || type === "workstation" ? lifecycleStatusForAge(type, age, model, exportDateLabel(exportRowValue(row, ["Warranty End Date", "Warranty End Date formatted", "Warranty Expiry", "Warranty Expires"])), referenceDate) : "unknown",
      osStatus: exportOsStatus(os),
      storageState: classifyTechnicalStorage({ storageUsage: storageUsage.summary, storagePercent: storageUsage.percent, storageFreeGb: storageUsage.freeGb }, undefined, technicalDeviceType(type)),
      sourceName: fieldSourceLabel,
      authoritative: Boolean(options.authoritative || sourceKind === "rft"),
      sourceDetails: {
        identity: fieldSourceLabel,
        inventory: fieldSourceLabel,
        classification: fieldSourceLabel,
        os: fieldSourceLabel,
        activity: fieldSourceLabel,
        storage: fieldSourceLabel,
        lifecycle: fieldSourceLabel,
        warranty: fieldSourceLabel,
      },
    };
    device.serverUrgency = classifyTechnicalServerUrgency({
      deviceType: technicalDeviceType(device.type),
      os: device.os,
      lifecycle: device.lifecycleStatus === "overdue" ? "replace-now" : device.lifecycleStatus === "due-soon" ? "plan-soon" : device.lifecycleStatus,
      storage: device.storageState,
    });
    return [device];
  });

  const unique = new Map<string, LifecycleDevice>();
  for (const device of devices) unique.set(lifecycleDeviceIdentityKey(device), device);
  const inventory = [...unique.values()];
  const physical = inventory.filter((device) => device.type === "server" || device.type === "backup-server" || device.type === "workstation");
  const servers = physical.filter((device) => device.type === "server").length;
  const backupServers = physical.filter((device) => device.type === "backup-server").length;
  const workstations = physical.filter((device) => device.type === "workstation").length;
  const vms = inventory.filter((device) => device.type === "vm").length;
  const networkDevices = inventory.filter((device) => device.type === "network").length;
  const current = physical.filter((device) => device.lifecycleStatus === "current").length;
  const dueSoon = physical.filter((device) => device.lifecycleStatus === "due-soon").length;
  const overdue = physical.filter((device) => device.lifecycleStatus === "overdue").length;
  const unknown = physical.filter((device) => device.lifecycleStatus === "unknown").length;
  const osDevices = inventory.filter((device) => device.type !== "network" && Boolean(device.os));
  const osSupported = osDevices.filter((device) => device.osStatus === "supported").length;
  const osEndingSoon = osDevices.filter((device) => device.osStatus === "ending-soon").length;
  const osUnsupported = osDevices.filter((device) => device.osStatus === "unsupported").length;
  const expiredWarranty = physical.filter((device) => exportWarrantyExpired(device, referenceDate)).map((device) => device.name);
  const storageReported = inventory.filter((device) => device.type !== "network" && device.storageState !== "unknown" && Boolean(device.storageUsage));
  const storageCritical = storageReported.filter((device) => device.storageState === "critical");
  const storageWatch = storageReported.filter((device) => device.storageState === "watch");
  const storageAttention = [...storageCritical, ...storageWatch];
  const organization = exportRowValue(populated[0] ?? {}, ["Organization", "Client", "Practice"]);
  const locations = [...new Set(inventory.map((device) => device.location).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sourceLabel = options.sourceLabel || (organization ? `${organization} device inventory export` : technicalSourceLabel(sourceKind));

  const facts: ExtractedFact[] = [
    fact({ key: "technical.truth.version", label: "Shared technical truth version", value: TECHNICAL_TRUTH_VERSION, category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Shared Phase 5 classification layer" }),
    fact({ key: "technical.source.primary", label: "Primary technical source", value: fieldSourceLabel, category: "planning", confidence: "high", sourceFileId: fileId, evidence: sourceKind === "rft" ? "RFT is authoritative for potential-client and proposal-update technical findings" : "Device inventory source used for technical findings" }),
    fact({ key: "technical.source.identity", label: "Inventory identity source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Device names and inventory rows" }),
    fact({ key: "technical.source.inventory", label: "Inventory scope source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Inventory rows and current technical scope" }),
    fact({ key: "technical.source.classification", label: "Device classification source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Shared physical, virtual, server, workstation, and network classification" }),
    fact({ key: "technical.source.os", label: "Operating system source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Operating-system fields in the technical source" }),
    fact({ key: "technical.source.activity", label: "Activity status source", value: fieldSourceLabel, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Last check-in and activity fields in the technical source" }),
    fact({ key: "technical.source.storage", label: "Storage source", value: fieldSourceLabel, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Disk usage fields in the technical source" }),
    fact({ key: "technical.source.lifecycle", label: "Lifecycle source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Age, purchase, and warranty fields in the technical source" }),
    fact({ key: "technical.source.warranty", label: "Warranty source", value: fieldSourceLabel, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Warranty fields in the technical source" }),
    ...(sourceKind === "rft" ? [fact({ key: "technical.source.precedence", label: "Technical source precedence", value: [technicalSourceLabel("rft"), technicalSourceLabel("proposal")], category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Newer RFT findings override older proposal technical content; proposal remains scope and pricing context" })] : []),
    fact({ key: "scalepad.reportPeriod", label: "Lifecycle report period", value: exportReportPeriod(referenceDate), category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Latest device activity date in the spreadsheet export" }),
    fact({ key: "scalepad.totalAssets", label: "Hardware assets", value: inventory.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "All servers, workstations, virtual machines, and network devices in the device export" }),
    fact({ key: "scalepad.physicalAssets", label: "Physical lifecycle assets", value: physical.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Primary servers, Cloud Plus backup servers, and physical workstations in the device export" }),
    fact({ key: "scalepad.sourceReportedTotal", label: "Source inventory rows", value: populated.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Populated device rows in the spreadsheet export" }),
    fact({ key: "scalepad.parsedInventoryTotal", label: "Parsed inventory rows", value: inventory.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Unique device records retained after stable identity reconciliation" }),
    fact({ key: "scalepad.servers", label: "Primary servers", value: servers, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Device Role and model fields in the spreadsheet export" }),
    fact({ key: "scalepad.backupServers", label: "Cloud Plus backup servers", value: backupServers, category: "backup", confidence: "high", sourceFileId: fileId, evidence: "CPBDR/CPBR, Cloud Plus BDR, or EQUUS identity in the spreadsheet export" }),
    fact({ key: "scalepad.workstations", label: "Workstations", value: workstations, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Windows desktop devices in the spreadsheet export" }),
    fact({ key: "scalepad.vms", label: "Virtual machines", value: vms, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Virtual Machine model records in the spreadsheet export" }),
    fact({ key: "scalepad.networkDevices", label: "Network devices", value: networkDevices, category: "network", confidence: "high", sourceFileId: fileId, evidence: "Network-role records in the spreadsheet export" }),
    ...(locations.length ? [fact({ key: "scalepad.locations", label: "Locations", value: locations, category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Location/Site values in the spreadsheet export" })] : []),
    fact({ key: "scalepad.replacement.current", label: "Current devices", value: current, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Device age calculated from manufacturer fulfillment or warranty-start date" }),
    fact({ key: "scalepad.replacement.dueSoon", label: "Devices due soon", value: dueSoon, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Device age calculated from manufacturer fulfillment or warranty-start date" }),
    fact({ key: "scalepad.replacement.overdue", label: "Devices overdue", value: overdue, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Device age calculated from manufacturer fulfillment or warranty-start date" }),
    fact({ key: "scalepad.replacement.unknown", label: "Assets under review", value: unknown, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Physical devices without a usable fulfillment or warranty-start date" }),
    fact({ key: "scalepad.os.supported", label: "Operating systems supported", value: osSupported, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Operating-system fields in the spreadsheet export" }),
    fact({ key: "scalepad.os.endingSoon", label: "Operating systems ending soon", value: osEndingSoon, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Operating-system fields in the spreadsheet export" }),
    fact({ key: "scalepad.os.unsupported", label: "Operating systems unsupported", value: osUnsupported, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Operating-system fields in the spreadsheet export" }),
    fact({ key: "scalepad.inventory", label: "Device inventory", value: inventory.map((device) => JSON.stringify(device)), category: "lifecycle", confidence: inventory.length ? "high" : "medium", sourceFileId: fileId, evidence: sourceLabel }),
    fact({ key: "scalepad.replaceNow", label: "Replace now", value: namesForStatus(inventory, "overdue"), category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Calculated lifecycle status from the spreadsheet export" }),
    fact({ key: "scalepad.planSoon", label: "Plan soon", value: namesForStatus(inventory, "due-soon"), category: "planning", confidence: "high", sourceFileId: fileId, evidence: "Calculated lifecycle status from the spreadsheet export" }),
    fact({ key: "scalepad.warrantyExpired", label: "Warranty expired", value: expiredWarranty, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Warranty End Date in the spreadsheet export" }),
    ...(storageReported.length ? [
      fact({ key: "scalepad.storage.reported", label: "Devices with disk usage reported", value: storageReported.length, category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Disk-usage details in the spreadsheet export" }),
      fact({ key: "scalepad.storage.watch", label: "Devices to watch for storage", value: storageWatch.map((device) => device.name), category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Disk utilization at or above 80 percent" }),
      fact({ key: "scalepad.storage.critical", label: "Devices with critical storage pressure", value: storageCritical.map((device) => device.name), category: "operations", confidence: "high", sourceFileId: fileId, evidence: "Disk utilization at or above 90 percent or less than 20 GB free on the system volume" }),
    ] : []),
  ];

  const findings: FindingCandidate[] = [];
  if (overdue) findings.push(finding({ category: "lifecycle", title: `${overdue} device${overdue === 1 ? " is" : "s are"} past the planned lifecycle`, clientSummary: "These systems should be prioritized by business impact so replacements happen deliberately instead of during a failure.", severity: "priority", sourceFileId: fileId, evidence: namesForStatus(inventory, "overdue").join(", ") }));
  if (osUnsupported) findings.push(finding({ category: "lifecycle", title: `${osUnsupported} operating system${osUnsupported === 1 ? " is" : "s are"} no longer supported`, clientSummary: "Unsupported operating systems no longer receive normal security maintenance and should be included in the near-term replacement or upgrade plan.", severity: "priority", sourceFileId: fileId, evidence: inventory.filter((device) => device.osStatus === "unsupported").map((device) => `${device.name}: ${device.os}`).join("; ") }));
  if (osEndingSoon) findings.push(finding({ category: "planning", title: `${osEndingSoon} operating system${osEndingSoon === 1 ? " needs" : "s need"} support planning`, clientSummary: "Server 2016 systems should be included in forward planning, and Windows 11 Home systems should be reviewed for the business-grade Pro edition.", severity: "attention", sourceFileId: fileId, evidence: inventory.filter((device) => device.osStatus === "ending-soon").map((device) => `${device.name}: ${device.os}`).join("; ") }));
  if (dueSoon) findings.push(finding({ category: "planning", title: `${dueSoon} device${dueSoon === 1 ? " is" : "s are"} approaching replacement`, clientSummary: "These systems are not emergency replacements today, but budgeting for them now will prevent a larger unplanned refresh later.", severity: "attention", sourceFileId: fileId, evidence: namesForStatus(inventory, "due-soon").join(", ") }));
  if (storageAttention.length) findings.push(finding({ category: "operations", title: `${storageAttention.length} device${storageAttention.length === 1 ? " needs" : "s need"} storage-capacity attention`, clientSummary: "Disk utilization is tracked separately from lifecycle replacement. Review cleanup, archiving, or storage expansion before limited free space affects daily work.", severity: storageCritical.length ? "priority" : "attention", sourceFileId: fileId, evidence: storageAttention.map((device) => `${device.name}: ${device.storageUsage}`).join("; ") }));
  if (current) findings.push(finding({ category: "lifecycle", title: `${current} device${current === 1 ? " remains" : "s remain"} current`, clientSummary: "These devices are within the planned lifecycle window and can remain in service while higher-priority systems are addressed.", severity: "healthy", sourceFileId: fileId, evidence: namesForStatus(inventory, "current").join(", ") }));
  const backupPriorities = inventory.filter((device) => device.type === "backup-server" && (device.lifecycleStatus === "overdue" || device.lifecycleStatus === "due-soon"));
  if (backupPriorities.length) findings.push(finding({ category: "backup", title: `${backupPriorities.length} Cloud Plus backup server${backupPriorities.length === 1 ? " needs" : "s need"} replacement planning`, clientSummary: "This system provides local and cloud backup plus emergency recovery for the primary server and should be included in the same replacement plan when it reaches lifecycle.", severity: "priority", sourceFileId: fileId, evidence: backupPriorities.map((device) => `${device.name}: ${device.make} ${device.model}, ${device.age} years old`).join("; ") }));

  return {
    sourceType: sourceKind === "rft" ? "rft" : "scalepad",
    confidence: physical.length ? "high" : "medium",
    title: fileName,
    summary: `${physical.length} physical lifecycle asset${physical.length === 1 ? "" : "s"} and ${vms} virtual machine${vms === 1 ? "" : "s"} were reviewed from the device export: ${overdue} overdue, ${dueSoon} due soon, and ${unknown} physical asset${unknown === 1 ? "" : "s"} under review.`,
    facts,
    findingCandidates: findings,
    highlights: [
      `${physical.length} workstations and servers`,
      `${servers} primary server${servers === 1 ? "" : "s"}, ${backupServers} Cloud Plus backup server${backupServers === 1 ? "" : "s"}, and ${workstations} workstations`,
      ...(vms ? [`${vms} virtual machine${vms === 1 ? "" : "s"} identified separately`] : []),
      `${overdue} overdue · ${dueSoon} due soon`,
      ...(locations.length > 1 ? [`${locations.length} locations represented`] : []),
      ...(storageReported.length ? [`${storageAttention.length} storage attention item${storageAttention.length === 1 ? "" : "s"}`] : []),
      `${osUnsupported} unsupported operating systems`,
    ],
    warnings: [
      ...(!graphicsHeaders.length ? ["The device export does not include a video-card or graphics-adapter column. Workstation inventory rows are marked “Not included in source export” rather than guessing the installed hardware."] : []),
      ...(!storageReported.length ? ["The device export does not include usable Disk Volume Usage details. Storage attention will remain unavailable until a disk-usage column is supplied."] : []),
      ...(unknown ? [`${unknown} physical device${unknown === 1 ? " has" : "s have"} no usable fulfillment or warranty-start date and ${unknown === 1 ? "remains" : "remain"} under review.`] : []),
    ],
    rawTextPreview: populated.slice(0, 20).map((row) => [
      exportRowValue(row, ["Device", "Display Name", "System Name", "Device Name", "Computer Name", "Host Name", "Name"]),
      exportRowValue(row, ["Device Role", "Role"]),
      exportRowValue(row, ["Device Make", "Make"]),
      exportRowValue(row, ["Device Model", "Model"]),
    ].filter(Boolean).join(" · ")).join("\n").slice(0, 7000),
    analyzedAt: new Date().toISOString(),
  };
}

export function parseHuntressReport(text: string, fileId: string, fileName: string): FileAnalysis {
  const reportPeriod = text.match(/Threat Report\s+(20\d{2}-\d{2}-\d{2})\s*(?:-|to)\s*(20\d{2}-\d{2}-\d{2})/i);
  const eventsAnalyzed = captureNumber(text, /analyzed\s+([\d,]+)\s+events\s+from/i);
  const entitiesProtected = captureNumber(text, /events\s+from\s+([\d,]+)\s+entities/i);
  const signalsDetected = captureNumber(text, /there were\s+([\d,]+)\s+signals detected/i);
  const signalsInvestigated = /no further investigation was warranted/i.test(page(text, 2))
    ? 0
    : captureNumber(page(text, 2), /SIGNALS INVESTIGATED\s+([\d,.MK]+)/i)
      || captureNumber(page(text, 2), /([\d,.MK]+)\s+SIGNALS INVESTIGATED/i);
  const incidentsReported = captureNumber(text, /had\s+([\d,]+)\s+incidents reported/i)
    || captureNumber(page(text, 2), /INCIDENTS REPORTED\s+([\d,.MK]+)/i)
    || captureNumber(text, /([\d,.MK]+)\s+INCIDENTS REPORTED/i);
  const autorunEvents = captureNumber(text, /analyzed\s+([\d,]+)\s+autorun events/i);
  const autorunSignals = captureNumber(text, /there were\s+([\d,]+)\s+autorun signals/i);
  const autorunInvestigated = /None of the detected signals were suspicious/i.test(page(text, 3)) ? 0 : captureNumber(page(text, 3), /Autorun Signals Investigated\s+([\d,]+)/i);
  const footholdIncidents = captureNumber(page(text, 3), /([\d,]+)\s+Foothold Incidents Reported/i);
  const canaryFiles = captureNumber(text, /monitored\s+([\d,]+)\s+canary files/i);
  const canaryPage = page(text, 4);
  const protectedProfiles = captureNumber(canaryPage, /Protected User Profiles[\s\S]{0,100}?([\d,]+)/i)
    || captureNumber(canaryPage, /([\d,]+)[\s\S]{0,60}?Protected User Profiles/i);
  const canaryEndpoints = captureNumber(text, /Ransomware Incidents Reported[\s\S]{0,80}?across\s+([\d,]+)\s+endpoints/i);
  const ransomwareIncidents = captureNumber(text, /([\d,]+)\s+Ransomware Incidents Reported/i);
  const antivirusEvents = captureNumber(text, /analyzed\s+([\d,]+)\s+antivirus event/i);
  const malwareBlocked = captureNumber(text, /blocked\s+([\d,]+)\s+potential malware file/i);
  const antivirusSignalsInvestigated = captureNumber(text, /there were\s+([\d,]+)\s+antivirus signals investigated/i);
  const antivirusIncidents = captureNumber(page(text, 5), /([\d,]+)\s+ANTIVIRUS INCIDENTS REPORTED/i);
  const processEvents = captureNumber(text, /analyzed\s+([\d,]+)\s+process events/i);
  const processSignals = captureNumber(text, /there were\s+([\d,]+)\s+process signals/i);
  const processInvestigated = /no further investigation was warranted/i.test(page(text, 6)) ? 0 : captureNumber(page(text, 6), /PROCESS SIGNALS INVESTIGATED\s+([\d,.MK]+)/i);
  const processIncidents = captureNumber(page(text, 6), /PROCESS INCIDENTS REPORTED\s+([\d,.MK]+)/i);
  const period = reportPeriod ? `${reportPeriod[1]} to ${reportPeriod[2]}` : reportDate(text);

  const incidentStart = text.search(/INCIDENT SUMMARY/i);
  const incidentText = incidentStart >= 0 ? text.slice(incidentStart) : pagesFrom(text, 7);
  const incidentLines = lines(incidentText);
  const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  const cleanIncidentValue = (value: string) => value
    .replace(/^[•·\-–—|]+\s*/, "")
    .replace(/^\d+[.)]?\s+/, "")
    .replace(/\s+[|·-]?\s*\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const sectionValues = (heading: RegExp, valueHint?: RegExp): string[] => {
    const headingIndex = incidentLines.findIndex((line) => heading.test(line));
    if (headingIndex < 0) return [];
    const values: string[] = [];
    const sameLine = incidentLines[headingIndex].split(/:\s*/, 2)[1];
    if (sameLine) values.push(cleanIncidentValue(sameLine));
    for (const line of incidentLines.slice(headingIndex + 1, headingIndex + 10)) {
      if (/^(?:CRITICAL|HIGH|MEDIUM|LOW|INCIDENTS? BY|MOST TARGETED|MOST COMMON(?:LY)?|RESPONSE|REMEDIATION|CONTAINMENT|PRODUCT|SEVERITY|MANAGED EDR|MANAGED ITDR|MANAGED SIEM|ANALYST NOTES|GLOBAL THREATS?)\b/i.test(line)) break;
      const cleaned = cleanIncidentValue(line);
      if (!cleaned || /^\d+$/.test(cleaned) || /incidents? reported/i.test(cleaned)) continue;
      if (!valueHint || valueHint.test(cleaned)) values.push(cleaned);
    }
    return values;
  };
  const directDevices = [...incidentText.matchAll(/(?:affected\s+)?(?:device|host(?:name)?|endpoint|computer)(?:\s+name)?\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9_.-]{2,})/gi)].map((match) => match[1]);
  const sectionDevices = sectionValues(/(?:MOST TARGETED|AFFECTED)\s+(?:DEVICES?|ENDPOINTS?|HOSTS?|COMPUTERS?)/i, /[A-Za-z]/);
  const incidentDevices = unique([...directDevices, ...sectionDevices])
    .filter((value) => !/^(?:device|host|endpoint|computer|critical|high|low|edr|itdr|siem)$/i.test(value))
    .slice(0, Math.max(incidentsReported, 5));

  const directThreats = [...incidentText.matchAll(/(?:threat|detection|malware|virus|av signal)(?:\s+(?:name|type))?\s*[:\-]\s*([^\n\r]{3,100})/gi)].map((match) => cleanIncidentValue(match[1]));
  const sectionThreats = sectionValues(/(?:MOST COMMON(?:LY)? REPORTED\s+)?(?:AV SIGNALS?|THREATS?|DETECTIONS?|MALWARE(?: TYPES?)?)/i, /captcha|trojan|malware|ransomware|backdoor|stealer|loader|dropper|phish|pup|adware|hacktool|virus|worm|exploit/i);
  const keywordThreats = incidentLines
    .filter((line) => line.length <= 110 && /captcha|trojan|malware|ransomware|backdoor|stealer|loader|dropper|phish|pup|adware|hacktool|virus|worm|exploit/i.test(line))
    .map(cleanIncidentValue);
  const incidentThreats = unique([...directThreats, ...sectionThreats, ...keywordThreats])
    .filter((value) => !/^(?:threats?|detections?|malware|av signals?)$/i.test(value))
    .slice(0, Math.max(incidentsReported, 5));

  const responseActions: string[] = [];
  if (/\b(?:host|device|computer|endpoint)?\s*(?:was\s+)?isolat(?:ed|ion)\b/i.test(incidentText)) responseActions.push("Computer isolated from the network");
  if (/\bquarantin(?:ed|e|ing)\b/i.test(incidentText)) responseActions.push("Threat quarantined");
  if (/\bclean(?:ed|up)\b/i.test(incidentText)) responseActions.push("Affected file cleaned");
  if (/\b(?:delet(?:ed|ion)|remov(?:ed|al))\b/i.test(incidentText)) responseActions.push("Malicious file deleted");
  if (/\bblock(?:ed|ing)\b/i.test(incidentText)) responseActions.push("Malicious activity blocked");
  const incidentResolved = /\b(?:resolved|remediat(?:ed|ion)|response completed|no further action required)\b/i.test(incidentText)
    || responseActions.some((action) => /isolated|quarantined|cleaned|deleted/i.test(action));
  const detailCount = Math.min(10, Math.max(incidentsReported, incidentDevices.length, incidentThreats.length));
  const incidentDetails = Array.from({ length: detailCount }, (_, index) => JSON.stringify({
    device: incidentDevices[index] ?? incidentDevices[0] ?? "",
    threat: incidentThreats[index] ?? incidentThreats[0] ?? "",
    actions: unique(responseActions),
    status: incidentResolved ? "Response completed" : "Investigated by the security team",
  }));

  const facts: ExtractedFact[] = [
    fact({ key: "huntress.reportPeriod", label: "Security report period", value: period, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress threat-report header" }),
    fact({ key: "huntress.entitiesProtected", label: "Entities protected", value: entitiesProtected, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress report summary" }),
    fact({ key: "huntress.eventsAnalyzed", label: "Events analyzed", value: eventsAnalyzed, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress report summary" }),
    fact({ key: "huntress.signalsDetected", label: "Signals detected", value: signalsDetected, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress report summary" }),
    fact({ key: "huntress.signalsInvestigated", label: "Signals investigated", value: signalsInvestigated, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress report summary" }),
    fact({ key: "huntress.incidentsReported", label: "Security incidents reported", value: incidentsReported, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress incident summary" }),
    fact({ key: "huntress.autorunEvents", label: "Autorun events analyzed", value: autorunEvents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress persistent-footholds page" }),
    fact({ key: "huntress.autorunSignals", label: "Autorun signals detected", value: autorunSignals, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress persistent-footholds page" }),
    fact({ key: "huntress.autorunSignalsInvestigated", label: "Autorun signals investigated", value: autorunInvestigated, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress persistent-footholds page" }),
    fact({ key: "huntress.footholdIncidents", label: "Foothold incidents reported", value: footholdIncidents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress persistent-footholds page" }),
    fact({ key: "huntress.canaryFiles", label: "Ransomware canary files", value: canaryFiles, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress ransomware-canaries page" }),
    fact({ key: "huntress.protectedProfiles", label: "Protected user profiles", value: protectedProfiles, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress ransomware-canaries page" }),
    fact({ key: "huntress.canaryEndpoints", label: "Endpoints with canary protection", value: canaryEndpoints || entitiesProtected, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress ransomware-canaries page" }),
    fact({ key: "huntress.ransomwareIncidents", label: "Ransomware incidents", value: ransomwareIncidents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress ransomware-canaries page" }),
    fact({ key: "huntress.antivirusEvents", label: "Antivirus events", value: antivirusEvents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress managed-antivirus page" }),
    fact({ key: "huntress.malwareFilesBlocked", label: "Malware files blocked", value: malwareBlocked, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress managed-antivirus page" }),
    fact({ key: "huntress.antivirusSignalsInvestigated", label: "Antivirus signals investigated", value: antivirusSignalsInvestigated, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress managed-antivirus page" }),
    fact({ key: "huntress.antivirusIncidents", label: "Antivirus incidents", value: antivirusIncidents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress managed-antivirus page" }),
    fact({ key: "huntress.processEvents", label: "Process events analyzed", value: processEvents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress process-insights page" }),
    fact({ key: "huntress.processSignals", label: "Process signals detected", value: processSignals, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress process-insights page" }),
    fact({ key: "huntress.processSignalsInvestigated", label: "Process signals investigated", value: processInvestigated, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress process-insights page" }),
    fact({ key: "huntress.processIncidents", label: "Process incidents", value: processIncidents, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress process-insights page" }),
    ...(incidentDevices.length ? [fact({ key: "huntress.incidentDevices", label: "Devices named in security incidents", value: incidentDevices, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress incident-summary targeted-device details" })] : []),
    ...(incidentThreats.length ? [fact({ key: "huntress.incidentThreats", label: "Threats named in security incidents", value: incidentThreats, category: "security", confidence: "high", sourceFileId: fileId, evidence: "Huntress incident-summary AV signal and threat details" })] : []),
    ...(responseActions.length ? [fact({ key: "huntress.incidentResponseActions", label: "Security response actions", value: unique(responseActions), category: "security", confidence: "high", sourceFileId: fileId, evidence: "Containment and cleanup actions named in the Huntress incident details" })] : []),
    ...(incidentDetails.length ? [fact({ key: "huntress.incidentDetails", label: "Security incident details", value: incidentDetails, category: "security", confidence: incidentDevices.length && incidentThreats.length ? "high" : "medium", sourceFileId: fileId, evidence: "Huntress incident summary, targeted devices, AV signals, and response status" })] : []),
  ];

  const findings: FindingCandidate[] = [];
  if (incidentsReported > 0 || ransomwareIncidents > 0 || antivirusIncidents > 0 || processIncidents > 0 || footholdIncidents > 0) {
    const incidentTotal = incidentsReported + ransomwareIncidents + antivirusIncidents + processIncidents + footholdIncidents;
    findings.push(finding({
      category: "security",
      title: `${incidentTotal} security incident${incidentTotal === 1 ? " was" : "s were"} identified`,
      clientSummary: incidentResolved
        ? "The security team investigated the reported activity and the source report documents completed containment or cleanup actions."
        : "The security team investigated the reported activity. Review the incident details and confirm whether any remaining response step is required.",
      severity: incidentResolved ? "attention" : "priority",
      sourceFileId: fileId,
      evidence: `Summary ${incidentsReported}; ransomware ${ransomwareIncidents}; antivirus ${antivirusIncidents}; process ${processIncidents}; footholds ${footholdIncidents}; response ${incidentResolved ? "completed" : "under review"}`,
    }));
  } else {
    findings.push(finding({ category: "security", title: "No reportable security incidents", clientSummary: `${eventsAnalyzed.toLocaleString("en-US")} events were analyzed and ${signalsDetected} signals were identified, with no suspicious activity requiring escalation during the reporting period.`, severity: "healthy", sourceFileId: fileId, evidence: `${eventsAnalyzed} events; ${signalsDetected} signals; 0 incidents` }));
  }
  if (canaryFiles) findings.push(finding({ category: "security", title: `${canaryFiles} ransomware canary files are active`, clientSummary: `These hidden early-warning files protect ${canaryEndpoints || entitiesProtected} endpoints and were not triggered during the reporting period.`, severity: ransomwareIncidents ? "priority" : "healthy", sourceFileId: fileId, evidence: `${protectedProfiles} protected profiles; ${canaryFiles} canary files; ${ransomwareIncidents} ransomware incidents` }));
  if (malwareBlocked) findings.push(finding({ category: "security", title: `Managed antivirus blocked ${malwareBlocked} malware file${malwareBlocked === 1 ? "" : "s"}`, clientSummary: "Protection acted automatically before the file could execute, demonstrating that endpoint controls are actively reducing risk rather than simply recording activity.", severity: "healthy", sourceFileId: fileId, evidence: `${antivirusEvents} antivirus events; ${malwareBlocked} malware files blocked; ${antivirusIncidents} incidents` }));
  if (signalsInvestigated > 0 && incidentsReported === 0) findings.push(finding({ category: "security", title: `${signalsInvestigated} signal${signalsInvestigated === 1 ? " was" : "s were"} investigated`, clientSummary: "The security team reviewed suspicious activity and did not report a confirmed incident. The investigation record remains useful evidence that monitoring is active.", severity: "attention", sourceFileId: fileId, evidence: `${signalsInvestigated} signals investigated; 0 incidents` }));

  return {
    sourceType: "huntress",
    confidence: eventsAnalyzed && entitiesProtected ? "high" : "medium",
    title: fileName,
    summary: `${eventsAnalyzed.toLocaleString("en-US")} events were analyzed across ${entitiesProtected} protected entities. ${signalsDetected} signals were detected, ${malwareBlocked} malware file${malwareBlocked === 1 ? " was" : "s were"} blocked, and ${incidentsReported} incidents were reported.`,
    facts,
    findingCandidates: findings,
    highlights: [
      `${entitiesProtected} entities protected`,
      `${eventsAnalyzed.toLocaleString("en-US")} events analyzed`,
      `${signalsDetected} signals · ${incidentsReported} incidents`,
      `${canaryFiles} ransomware canary files`,
      `${malwareBlocked} malware files blocked`,
    ],
    warnings: [],
    rawTextPreview: lines(text).slice(0, 90).join("\n").slice(0, 8000),
    analyzedAt: new Date().toISOString(),
  };
}
