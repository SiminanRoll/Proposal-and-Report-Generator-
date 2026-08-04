import type { ExtractedFact, FileAnalysis, FindingCandidate } from "@/lib/projects/types";

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
    .map((line) => line.replace(/[\uE000-\uF8FF]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function reportDate(text: string): string {
  return text.match(/\b([A-Z][a-z]+\s+20\d{2})\b/)?.[1]
    ?? text.match(/\b(20\d{2}-\d{2}-\d{2}\s*(?:-|to)\s*20\d{2}-\d{2}-\d{2})\b/i)?.[1]
    ?? "";
}

function scalePadAssetCounts(text: string): { servers: number; workstations: number; vms: number; networkDevices: number } {
  const reportLines = lines(text);
  const headingIndex = reportLines.findIndex((line) => /\bServers\b[\s\S]*\bWorkstations\b[\s\S]*\bVMs\b[\s\S]*\bNetwork\b/i.test(line));
  if (headingIndex > 0) {
    for (let offset = 1; offset <= 3; offset += 1) {
      const values = reportLines[headingIndex - offset]?.match(/\d+/g)?.map(Number) ?? [];
      if (values.length >= 4) {
        return { servers: values[0], workstations: values[1], vms: values[2], networkDevices: values[3] };
      }
    }
  }
  return {
    servers: labeledCount(text, "Servers"),
    workstations: labeledCount(text, "Workstations"),
    vms: labeledCount(text, "VMs"),
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
  lifecycleStatus: "current" | "due-soon" | "overdue" | "unknown";
  osStatus: "supported" | "ending-soon" | "unsupported" | "unknown";
}

function parsePhysicalDevice(line: string, type: "server" | "workstation", pendingName: string[]): LifecycleDevice | null {
  const dateMatch = line.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/);
  if (!dateMatch || dateMatch.index === undefined) return null;
  const beforeDate = line.slice(0, dateMatch.index).trim();
  let afterDate = line.slice(dateMatch.index + dateMatch[0].length).trim();
  const prefixParts = beforeDate.split(/\s+/).filter(Boolean);
  const user = prefixParts.length ? prefixParts[prefixParts.length - 1] : "";
  const inlineName = prefixParts.slice(0, -1).join("");
  const name = (inlineName || pendingName.join("")).replace(/[^A-Za-z0-9_.-]/g, "");

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
    lifecycleStatus: "unknown",
    osStatus: /Server 2016/i.test(match[1]) ? "ending-soon" : "unknown",
  };
}

function parseNetworkDevice(line: string): LifecycleDevice | null {
  const match = line.match(/^(\S+)\s+([A-Za-z][A-Za-z0-9&.-]*)\s+(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?\s+(?:bytes|GB|TB))$/i);
  if (!match || /Network Make Serial Model Storage/i.test(line)) return null;
  return {
    type: "network",
    name: match[1],
    user: "",
    lastCheckIn: "",
    make: match[2],
    serial: match[3],
    model: match[4].trim(),
    os: "",
    age: 0,
    purchased: "",
    warrantyExpires: "",
    ram: "",
    cpu: "",
    storage: match[5],
    lifecycleStatus: "unknown",
    osStatus: "unknown",
  };
}

const LIFECYCLE_YEARS = {
  server: { planSoon: 4, replaceNow: 5 },
  "backup-server": { planSoon: 4, replaceNow: 5 },
  workstation: { planSoon: 4, replaceNow: 5 },
} as const;

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
  if (named && named.length >= 4) return named;

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
  return /^(?:EQUUS|Dell|HP|HPE|Lenovo|Supermicro)\b/i.test(line)
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
      lifecycleStatus: lifecycleStatusForAge("backup-server", age),
      osStatus: /Server 2016/i.test(os) ? "ending-soon" : os ? "supported" : "unknown",
    });
  }

  return candidates;
}

function lifecycleStatusForAge(type: "server" | "backup-server" | "workstation", age: number): LifecycleDevice["lifecycleStatus"] {
  if (!Number.isFinite(age) || age <= 0) return "unknown";
  const threshold = LIFECYCLE_YEARS[type];
  if (age >= threshold.replaceNow) return "overdue";
  if (age >= threshold.planSoon) return "due-soon";
  return "current";
}

function parseScalePadInventory(inventoryText: string, fullReportText = inventoryText): LifecycleDevice[] {
  const result: LifecycleDevice[] = [];
  let section: LifecycleDevice["type"] | "" = "";
  let pendingName: string[] = [];
  let lastDevice: LifecycleDevice | null = null;
  const ignored = /^(Hardware Lifecycle Report|Advantage Technologies|Information is deemed|Last Check-In|Make Serial|User Last|Age Purchased|Storage|OS|RAM|CPU)$/i;

  for (const rawLine of lines(inventoryText)) {
    const line = rawLine.replace(/^\W+/, "").trim();
    if (/\bServers?\b.*\bUser\b/i.test(line)) { section = "server"; pendingName = []; lastDevice = null; continue; }
    if (/\bWorkstations?\b.*\bUser\b/i.test(line)) { section = "workstation"; pendingName = []; lastDevice = null; continue; }
    if (/\bVirtual Machines?\b.*\bUser\b/i.test(line)) { section = "vm"; pendingName = []; lastDevice = null; continue; }
    if (/\bNetwork\b.*\bMake\b.*\bSerial\b/i.test(line)) { section = "network"; pendingName = []; lastDevice = null; continue; }
    if (!section || ignored.test(line)) continue;

    if (lastDevice && lastDevice.name.endsWith("-") && !/\d{1,2}\/\d{1,2}\/20\d{2}/.test(line) && line.length <= 30 && /^[A-Za-z0-9_.-]+$/.test(line)) {
      lastDevice.name = `${lastDevice.name}${line.replace(/[^A-Za-z0-9_.-]/g, "")}`;
      continue;
    }

    if (section === "server" || section === "workstation") {
      const parsed = parsePhysicalDevice(line, section, pendingName);
      if (parsed) { result.push(parsed); lastDevice = parsed; pendingName = []; continue; }
    } else if (section === "vm") {
      const parsed = parseVmDevice(line, pendingName);
      if (parsed) { result.push(parsed); lastDevice = parsed; pendingName = []; continue; }
    } else if (section === "network") {
      const parsed = parseNetworkDevice(line);
      if (parsed) { result.push(parsed); lastDevice = parsed; continue; }
    }

    if (!/\d{1,2}\/\d{1,2}\/20\d{2}/.test(line) && line.length <= 30 && /^[A-Za-z0-9_.-]+$/.test(line)) {
      pendingName.push(line);
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
    if ((device.type === "server" || device.type === "workstation") && /virtual machine/i.test(`${device.make} ${device.model}`)) {
      device.type = "vm";
      device.age = 0;
    } else if ((device.type === "server" || device.type === "workstation") && isCloudPlusBdrDevice(device)) {
      device.type = "backup-server";
    }
    if (device.type === "server" || device.type === "backup-server" || device.type === "workstation") {
      device.lifecycleStatus = lifecycleStatusForAge(device.type, device.age);
    }
    if (/Windows 10/i.test(device.os)) device.osStatus = "unsupported";
    else if (/Server 2016/i.test(device.os)) device.osStatus = "ending-soon";
    else if (device.os) device.osStatus = "supported";
  });

  const unique = new Map<string, LifecycleDevice>();
  for (const device of result) {
    const serial = device.serial.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = device.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const physical = device.type === "server" || device.type === "backup-server" || device.type === "workstation";
    const key = serial ? `${physical ? "physical" : device.type}:serial:${serial}` : `${physical ? "physical" : device.type}:name:${name}`;
    const existing = unique.get(key);
    const preferBackupServer = device.type === "backup-server" && existing?.type !== "backup-server";
    const newerCheckIn = Date.parse(device.lastCheckIn) >= Date.parse(existing?.lastCheckIn ?? "");
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
  const reportedDueSoon = labeledCount(summary, "Due soon");
  const reportedOverdue = labeledCount(summary, "Overdue");
  const reportedUnknown = labeledCount(summary, "Unknown");
  const osSupported = labeledCount(summary, "OS supported");
  const osEndingSoon = labeledCount(summary, "OS ending soon");
  const osUnsupported = labeledCount(summary, "OS unsupported");
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
  const parsedOverdue = physicalDevices.filter((device) => device.lifecycleStatus === "overdue").length;
  const parsedDueSoon = physicalDevices.filter((device) => device.lifecycleStatus === "due-soon").length;
  const parsedCurrent = physicalDevices.filter((device) => device.lifecycleStatus === "current").length;
  const parsedUnknown = physicalDevices.filter((device) => device.lifecycleStatus === "unknown").length;
  const overdue = hasNamedPhysicalInventory ? parsedOverdue : Math.min(reportedOverdue, physicalTotal);
  const dueSoon = hasNamedPhysicalInventory ? parsedDueSoon : Math.min(reportedDueSoon, Math.max(0, physicalTotal - overdue));
  const current = hasNamedPhysicalInventory ? parsedCurrent : Math.max(0, physicalTotal - overdue - dueSoon - reportedUnknown);
  const unknown = hasNamedPhysicalInventory
    ? parsedUnknown + Math.max(0, physicalTotal - namedPhysicalTotal)
    : Math.max(0, physicalTotal - current - dueSoon - overdue);
  const totalAssets = physicalTotal;
  const reportPeriod = reportDate(summary);
  const expiredWarranty = devices.filter((device) => device.warrantyExpires && device.lifecycleStatus !== "unknown").map((device) => device.name);
  const sampleBudget = captureNumber(page(text, 3), /Budget Amount[\s\S]*?\$([\d,]+)\s*$/im)
    || captureNumber(page(text, 3), /\$([\d,]+)\s+The Hidden Cost/i);

  const facts: ExtractedFact[] = [
    fact({ key: "scalepad.reportPeriod", label: "Lifecycle report period", value: reportPeriod, category: "planning", confidence: "high", sourceFileId: fileId, evidence: "ScalePad report header" }),
    fact({ key: "scalepad.totalAssets", label: "Hardware assets", value: totalAssets || physicalDevices.length, category: "lifecycle", confidence: "high", sourceFileId: fileId, evidence: "Primary servers, Cloud Plus backup servers, and workstations only" }),
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
      `${overdue} overdue · ${dueSoon} due soon`,
      `${osUnsupported} unsupported operating systems`,
    ],
    warnings: [
      ...(sampleBudget ? ["The evergreen budget in the source report is a planning example, not an approved quote."] : []),
      ...(!devices.length ? ["The summary was read, but the detailed inventory needs visual confirmation."] : []),
    ],
    rawTextPreview: lines(text).slice(0, 70).join("\n").slice(0, 7000),
    analyzedAt: new Date().toISOString(),
  };
}

export function parseHuntressReport(text: string, fileId: string, fileName: string): FileAnalysis {
  const reportPeriod = text.match(/Threat Report\s+(20\d{2}-\d{2}-\d{2})\s*(?:-|to)\s*(20\d{2}-\d{2}-\d{2})/i);
  const eventsAnalyzed = captureNumber(text, /analyzed\s+([\d,]+)\s+events\s+from/i);
  const entitiesProtected = captureNumber(text, /events\s+from\s+([\d,]+)\s+entities/i);
  const signalsDetected = captureNumber(text, /there were\s+([\d,]+)\s+signals detected/i);
  const signalsInvestigated = /no further investigation was warranted/i.test(page(text, 2)) ? 0 : captureNumber(page(text, 2), /SIGNALS INVESTIGATED\s+([\d,.MK]+)/i);
  const incidentsReported = captureNumber(text, /had\s+([\d,]+)\s+incidents reported/i) || captureNumber(page(text, 2), /INCIDENTS REPORTED\s+([\d,.MK]+)/i);
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
  ];

  const findings: FindingCandidate[] = [];
  if (incidentsReported > 0 || ransomwareIncidents > 0 || antivirusIncidents > 0 || processIncidents > 0 || footholdIncidents > 0) {
    const incidentTotal = incidentsReported + ransomwareIncidents + antivirusIncidents + processIncidents + footholdIncidents;
    findings.push(finding({ category: "security", title: `${incidentTotal} security incident${incidentTotal === 1 ? " requires" : "s require"} review`, clientSummary: "The report contains incident activity that should be reviewed with the security team and connected to any remediation already completed.", severity: "priority", sourceFileId: fileId, evidence: `Summary ${incidentsReported}; ransomware ${ransomwareIncidents}; antivirus ${antivirusIncidents}; process ${processIncidents}; footholds ${footholdIncidents}` }));
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
