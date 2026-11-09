/** Client-facing full device inventory, independent of whether any concerns exist. */
export type InventoryPdfTone = "priority" | "attention" | "current" | "informational";
export interface ClientInventoryPdfRow {
  name: string;
  deviceType: string;
  location: string;
  user: string;
  model: string;
  serial: string;
  operatingSystem: string;
  ram: string;
  storage: string;
  age: string;
  warranty: string;
  status: string;
  tone: InventoryPdfTone;
  concerns: string[];
}
function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"\x27]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\x27": "&#39;" })[c] ?? c);
}

/** The report is printed in portrait. Budget row heights rather than clipping long descriptions. */
function paginate(rows: ClientInventoryPdfRow[]): ClientInventoryPdfRow[][] {
  if (!rows.length) return [[]];
  const pages: ClientInventoryPdfRow[][] = [];
  let current: ClientInventoryPdfRow[] = [];
  let weight = 0;
  for (const row of rows) {
    const extra = Math.max(0, Math.ceil(row.name.length / 27) - 1) * 0.38
      + Math.max(0, Math.ceil(row.model.length / 28) - 1) * 0.26
      + Math.max(0, Math.ceil(row.operatingSystem.length / 28) - 1) * 0.26
      + Math.max(0, Math.ceil(row.concerns.join(" · ").length / 33) - 1) * 0.32;
    const cost = 1 + extra;
    const budget = pages.length === 0 ? 9.9 : 11.8;
    if (current.length && (current.length >= 12 || weight + cost > budget)) {
      pages.push(current); current = []; weight = 0;
    }
    current.push(row); weight += cost;
  }
  if (current.length) pages.push(current);
  return pages;
}

function cellText(value: string, fallback = "Not reported"): string {
  return escapeHtml(value.trim() || fallback);
}
function rowHtml(row: ClientInventoryPdfRow): string {
  const identity = [row.location, row.user].filter(Boolean).join(" · ");
  const systemDetail = [row.ram ? "RAM " + row.ram : "", row.storage ? "Storage " + row.storage : ""].filter(Boolean).join(" · ");
  const statusDetail = row.concerns.join(" · ") || (row.tone === "informational"
    ? "Lifecycle not rated for this device type"
    : "No flagged concerns in available data");
  return `<tr class="pdf-inventory-row ${row.tone}" data-inventory-device="true" data-inventory-status="${row.tone}">
    <td><strong>${cellText(row.name)}</strong><small>${cellText(row.deviceType)}</small>${identity ? `<small>${escapeHtml(identity)}</small>` : ""}</td>
    <td><strong>${cellText(row.model)}</strong>${row.serial ? `<small>Serial ${escapeHtml(row.serial)}</small>` : ""}</td>
    <td><strong>${cellText(row.operatingSystem)}</strong>${systemDetail ? `<small>${escapeHtml(systemDetail)}</small>` : ""}</td>
    <td><strong>${cellText(row.age)}</strong><small>${cellText(row.warranty, "Warranty not reported")}</small></td>
    <td><b class="pdf-inventory-status ${row.tone}">${cellText(row.status)}</b><small>${escapeHtml(statusDetail)}</small></td>
  </tr>`;
}

export function clientInventoryPdfPages(rows: ClientInventoryPdfRow[], footer: (label: string) => string): string {
  const pages = paginate(rows);
  const priority = rows.filter((row) => row.tone === "priority").length;
  const attention = rows.filter((row) => row.tone === "attention").length;
  const current = rows.filter((row) => row.tone === "current").length;
  const informational = rows.filter((row) => row.tone === "informational").length;
  return pages.map((pageRows, index) => {
    const continued = index > 0;
    const summary = !continued ? `<div class="pdf-full-inventory-summary">
      <span><strong>${rows.length}</strong>Devices recorded</span>
      <span class="${priority ? "priority" : ""}"><strong>${priority}</strong>Priority</span>
      <span class="${attention ? "attention" : ""}"><strong>${attention}</strong>Plan / review</span>
      <span class="current"><strong>${current}</strong>Current</span>
      ${informational ? `<span><strong>${informational}</strong>Other / unrated</span>` : ""}
    </div>` : "";
    const details = rows.length
      ? `<table class="pdf-full-inventory-table"><thead><tr><th>Device / location</th><th>Equipment</th><th>OS / storage</th><th>Age / warranty</th><th>Condition</th></tr></thead><tbody>${pageRows.map(rowHtml).join("")}</tbody></table>`
      : `<div class="pdf-inventory-empty"><strong>Detailed equipment inventory not available.</strong>
          <p>No individual device records were supplied with this review. Summary totals elsewhere in the report may come from separate source reports.</p></div>`;
    return `<section class="pdf-page pdf-full-inventory-page" data-pdf-page="true">
      <header class="pdf-section-header"><span class="kicker">Equipment inventory${pages.length > 1 ? ` · ${index + 1} of ${pages.length}` : ""}</span>
      <h2>${continued ? "Equipment inventory continued" : "Your equipment inventory"}</h2>
      ${continued ? "" : "<p>All recorded devices are listed here, including healthy equipment. Items requiring attention are highlighted based on the available information.</p>"}
      </header>${summary}${details}${footer("Equipment Inventory")}</section>`;
  }).join("");
}
