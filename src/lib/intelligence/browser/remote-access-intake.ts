import * as XLSX from "xlsx";

export interface RemoteAccessCandidate {
  software: string;
  account: string;
  assignedTo: string;
}

const TOOLS = [
  ["GoToMyPC", /go\s*to\s*my\s*pc|gotomypc/i],
  ["ScreenConnect", /screenconnect|connectwise control/i],
  ["TeamViewer", /teamviewer/i],
  ["AnyDesk", /anydesk/i],
  ["Splashtop", /splashtop/i],
  ["RemotePC", /\bremotepc\b/i],
  ["Chrome Remote Desktop", /chrome remote desktop/i],
  ["Windows Remote Desktop", /remote desktop|rdp\b/i],
] as const;

function softwareFor(text: string, fallback = "Remote access"): string {
  return TOOLS.find((pair) => pair[1].test(text))?.[0] ?? fallback;
}

function clean(text: unknown): string {
  return String(text ?? "").trim().replace(/\s+/g, " ").slice(0, 180);
}

function email(text: string): string {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function dedupe(rows: RemoteAccessCandidate[]): RemoteAccessCandidate[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.account && !row.software) return false;
    const key = (row.account || row.assignedTo).toLowerCase() + "|" + row.software.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 250);
}

/** Text/PDF/DOCX import: email and nearby software only, never passwords. */
export function remoteAccessFromText(text: string, fileName = ""): RemoteAccessCandidate[] {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const fallback = softwareFor(fileName);
  const entries: RemoteAccessCandidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const address = email(line);
    if (!address) continue;
    const nearby = [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join(" ");
    const software = softwareFor(line, softwareFor(nearby, fallback));
    const assignedTo = clean(line.replace(address, "").replace(/^(account|email|address|software|user)\s*[:|\-]\s*/i, "")).slice(0, 80);
    entries.push({ software, account: address, assignedTo: assignedTo.length > 2 && !/password|secret|token/i.test(assignedTo) ? assignedTo : "" });
  }
  return dedupe(entries);
}

/** CSV/XLS(X): flexible column headings, no imported keep/remove decision. */
export function remoteAccessFromSpreadsheet(buffer: ArrayBuffer, fileName = ""): RemoteAccessCandidate[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const fallback = softwareFor(fileName);
  const candidates: RemoteAccessCandidate[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    const headerIndex = rows.findIndex((row) => row.some((cell) =>
      /^(?:account.*email|email.*address|email|user.?name|login|remote.?access|software|program|product)$/i.test(clean(cell))));
    const headers = headerIndex >= 0 ? rows[headerIndex].map((cell) => clean(cell).toLowerCase()) : [];
    const emailCol = headers.findIndex((h) => /email|account|login|username/.test(h));
    const softwareCol = headers.findIndex((h) => /software|program|product|application|remote.?access/.test(h));
    const userCol = headers.findIndex((h) => /assigned|person|user|device|computer|description|purpose/.test(h));
    for (const row of rows.slice(Math.max(0, headerIndex + 1))) {
      const cells = row.map(clean);
      const address = email(emailCol >= 0 ? cells[emailCol] ?? "" : "") || email(cells.join(" "));
      if (!address) continue;
      const product = softwareCol >= 0 ? cells[softwareCol] : "";
      const software = softwareFor(product || "", product?.trim() || softwareFor(cells.join(" "), softwareFor(name, fallback)));
      const assigned = userCol >= 0 ? cells[userCol] : "";
      candidates.push({ software, account: address, assignedTo: assigned && !/password|secret|token/i.test(headers[userCol] ?? "") ? assigned.slice(0, 80) : "" });
    }
  }
  return dedupe(candidates);
}
