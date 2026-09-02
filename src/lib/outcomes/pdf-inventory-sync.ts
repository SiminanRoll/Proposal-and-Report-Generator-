const SCREEN_INVENTORY_MARKER = '<span class="kicker">Hardware inventory</span><h2>Device detail</h2>';
const PRINT_REPORT_MARKER = '<div class="print-report">';
const OVERVIEW_MARKER = '<section class="pdf-page pdf-overview-page"';
const FINAL_RECAP_MARKER = '<section class="pdf-page pdf-client-success-page"';
const INVENTORY_PAGE_PATTERN = /\s*<section class="pdf-page pdf-focus-page pdf-inventory-page" data-pdf-page="true">[\s\S]*?<\/section>/gi;
const LEGACY_RADAR_PAGE_PATTERN = /\s*<section class="pdf-page pdf-focus-page" data-pdf-page="true">(?:(?!<\/section>)[\s\S])*?<h2>[^<]*what to keep on your radar<\/h2>(?:(?!<\/section>)[\s\S])*?<\/section>/gi;
const SITE_OVERVIEW_PATTERN = /<div class="pdf-site-overview-grid">([\s\S]*?)<\/div>/i;
const UNASSIGNED_LOCATION = "Unassigned";
const FIVE_YEAR_ATTENTION_AGE = 5;

type InventoryTone = "healthy" | "attention" | "priority";
type InventoryStatus = "current" | "due-soon" | "overdue" | "unknown";
type InventoryIcon = "computer" | "activity" | "check";

interface InventoryDeviceCard {
  status: InventoryStatus;
  location: string;
  osConcern: boolean;
  fivePlus: boolean;
  ageToVerify: boolean;
  html: string;
}

interface InventorySummaryItem {
  key: "reviewed" | "five-plus" | "os" | "age-verify";
  count: number;
  label: string;
  tone?: InventoryTone;
  icon: InventoryIcon;
}

function tableRows(value: string): string[] {
  return value.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
}

function rowCells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
}

function textOnly(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .trim();
}

function rowAttribute(row: string, name: string): string {
  const match = row.match(new RegExp(`data-${name}="([^"]*)"`, "i"));
  return decodeAttribute(match?.[1] ?? "");
}

function compactOperatingSystem(value: string): string {
  return value
    .replace(/^Microsoft\s+/i, "")
    .replace(/\s+Edition\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactHardwareValue(value: string): string {
  const cleaned = value
    .replace(/\(R\)|\(TM\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "—";
}

function knownLocationLabels(html: string): string[] {
  const overview = html.match(SITE_OVERVIEW_PATTERN)?.[1] ?? "";
  return [...overview.matchAll(/<article><strong>([\s\S]*?)<\/strong>/gi)]
    .map((match) => textOnly(match[1]))
    .filter(Boolean);
}

function cardLocation(firstCell: string, knownLocations: string[]): string {
  const identity = textOnly(firstCell.match(/<small\b[^>]*>([\s\S]*?)<\/small>/i)?.[1] ?? "");
  const matched = knownLocations.find((location) => identity === location || identity.startsWith(`${location} · `));
  if (matched) return matched;
  if (/^remote(?:\s|·|$)/i.test(identity)) return "Remote";
  return UNASSIGNED_LOCATION;
}

function lifecycleStatus(row: string): InventoryStatus {
  const explicit = row.match(/data-lifecycle="([^"]+)"/i)?.[1]?.toLowerCase();
  if (explicit === "current" || explicit === "due-soon" || explicit === "overdue" || explicit === "unknown") return explicit;
  if (/device-overdue/i.test(row)) return "overdue";
  if (/device-due-soon/i.test(row)) return "due-soon";
  if (/device-current/i.test(row)) return "current";
  return "unknown";
}

function reportIcon(kind: InventoryIcon): string {
  const path = kind === "check"
    ? '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>'
    : kind === "activity"
      ? '<path d="M3 12h4l2-5 4 10 2-5h6"/>'
      : '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>';
  return `<span class="pdf-report-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

function operatingSystemConcern(row: string, os: string): boolean {
  const explicit = row.match(/data-os="([^"]+)"/i)?.[1]?.toLowerCase();
  if (explicit === "unsupported" || explicit === "ending-soon") return true;
  return /\bwindows\s*10\b/i.test(os) || /\bend of support\b|\bunsupported\b/i.test(os);
}

function ageYearsFromText(age: string): number | null {
  const match = age.match(/(-?\d+(?:\.\d+)?)\s+years?/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function displayAge(age: string, ageYears: number | null): string {
  if (ageYears === null) return "Original ship date not listed";
  return age.replace(/\s+old$/i, "");
}

function attentionText(status: InventoryStatus, fivePlus: boolean, osConcern: boolean, ageToVerify: boolean): { tone: InventoryTone; text: string } {
  const needs: string[] = [];
  if (fivePlus) needs.push("5+ years old");
  if (osConcern) needs.push("OS review needed");
  if (status === "overdue" && !fivePlus) needs.push("Replacement age reached");
  if (needs.length) return { tone: "priority", text: needs.join(" · ") };
  if (ageToVerify) return { tone: "attention", text: "Age to verify" };
  if (status === "due-soon") return { tone: "attention", text: "Plan soon" };
  return { tone: "healthy", text: "No immediate concern" };
}

function inventoryCard(row: string, knownLocations: string[]): InventoryDeviceCard | null {
  const cells = rowCells(row);
  if (cells.length < 10 || /empty-table/i.test(row) || /colspan=/i.test(row)) return null;

  const status = lifecycleStatus(row);
  const location = cardLocation(cells[0], knownLocations);
  const device = textOnly(cells[0].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? cells[0]) || "Unnamed device";
  const type = textOnly(cells[1]) || "Managed device";
  const model = textOnly(cells[2]) || "Model not reported";
  const os = rowAttribute(row, "os-name") || textOnly(cells[5]) || "Operating system not reported";
  const cpu = compactHardwareValue(rowAttribute(row, "cpu"));
  const memory = compactHardwareValue(rowAttribute(row, "memory"));
  const storage = compactHardwareValue(rowAttribute(row, "storage-capacity"));
  const age = textOnly(cells[6]) || "Age not reported";
  const osConcern = operatingSystemConcern(row, os);
  const ageYears = ageYearsFromText(age);
  const ageToVerify = ageYears === null;
  const fivePlus = ageYears !== null && ageYears >= FIVE_YEAR_ATTENTION_AGE;
  const attention = attentionText(status, fivePlus, osConcern, ageToVerify);
  const rowTone = attention.tone;

  return {
    status,
    location,
    osConcern,
    fivePlus,
    ageToVerify,
    html: `<article class="pdf-device-list-row ${rowTone}">
      <div class="pdf-device-list-identity"><strong>${device}</strong><small>${type} · ${model}</small></div>
      <div class="pdf-device-list-fact ${fivePlus ? "priority" : ageToVerify ? "attention" : ""}"><strong>${displayAge(age, ageYears)}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-os ${osConcern ? "priority" : ""}"><strong>${compactOperatingSystem(os)}</strong></div>
      <div class="pdf-device-list-fact pdf-device-list-cpu"><strong>${cpu}</strong></div>
      <div class="pdf-device-list-fact"><strong>${memory}</strong></div>
      <div class="pdf-device-list-fact"><strong>${storage}</strong></div>
      <div class="pdf-device-list-action ${attention.tone}"><strong>${attention.text}</strong></div>
    </article>`,
  };
}

function screenInventoryCards(html: string): InventoryDeviceCard[] {
  const printStart = html.indexOf(PRINT_REPORT_MARKER);
  const screenHtml = printStart >= 0 ? html.slice(0, printStart) : html;
  const marker = screenHtml.indexOf(SCREEN_INVENTORY_MARKER);
  if (marker < 0) return [];
  const bodyStart = screenHtml.indexOf("<tbody>", marker);
  if (bodyStart < 0) return [];
  const bodyEnd = screenHtml.indexOf("</tbody>", bodyStart);
  if (bodyEnd < 0) return [];
  const locations = knownLocationLabels(html);
  return tableRows(screenHtml.slice(bodyStart + 7, bodyEnd))
    .map((row) => inventoryCard(row, locations))
    .filter((card): card is InventoryDeviceCard => Boolean(card));
}

function inventoryFooter(overviewHtml: string): string {
  const footer = overviewHtml.match(/<footer class="pdf-page-footer">[\s\S]*?<\/footer>/i)?.[0];
  if (!footer) return '<footer class="pdf-page-footer"><span>Advantage Technologies</span><span>Current Device Inventory</span></footer>';
  const lastSpan = footer.lastIndexOf("<span>");
  if (lastSpan < 0) return footer;
  const spanEnd = footer.indexOf("</span>", lastSpan);
  if (spanEnd < 0) return footer;
  const current = footer.slice(lastSpan + 6, spanEnd);
  const divider = current.lastIndexOf(" · ");
  const next = divider >= 0 ? `${current.slice(0, divider)} · Current Device Inventory` : "Current Device Inventory";
  return `${footer.slice(0, lastSpan)}<span>${next}</span>${footer.slice(spanEnd + 7)}`;
}

function locationFooter(footer: string, location: string): string {
  return footer.replace(/Current Device Inventory(?=<\/span>)/i, `Current Device Inventory · ${location}`);
}

function locationRank(value: string): number {
  if (/^remote$/i.test(value)) return 1;
  if (value === UNASSIGNED_LOCATION) return 2;
  return 0;
}

function groupedInventoryCards(cards: InventoryDeviceCard[]): Array<{ location: string; cards: InventoryDeviceCard[] }> {
  const groups = new Map<string, InventoryDeviceCard[]>();
  for (const card of cards) {
    const current = groups.get(card.location) ?? [];
    current.push(card);
    groups.set(card.location, current);
  }
  return [...groups.entries()]
    .map(([location, locationCards]) => ({ location, cards: locationCards }))
    .sort((left, right) => {
      const rank = locationRank(left.location) - locationRank(right.location);
      return rank || left.location.localeCompare(right.location, undefined, { sensitivity: "base" });
    });
}

function inventorySummary(cards: InventoryDeviceCard[]): string {
  const fivePlus = cards.filter((card) => card.fivePlus).length;
  const osConcerns = cards.filter((card) => card.osConcern).length;
  const ageToVerify = cards.filter((card) => card.ageToVerify).length;

  const items: InventorySummaryItem[] = [
    { key: "reviewed", count: cards.length, label: "Systems reviewed", icon: "computer" },
    { key: "five-plus", count: fivePlus, label: "5+ years", tone: fivePlus > 0 ? "priority" : undefined, icon: "computer" },
    { key: "os", count: osConcerns, label: "OS concerns", tone: osConcerns > 0 ? "priority" : undefined, icon: "activity" },
    { key: "age-verify", count: ageToVerify, label: "Age to verify", tone: ageToVerify > 0 ? "attention" : undefined, icon: "activity" },
  ];

  return items.map((item) => `<article${item.tone ? ` class="${item.tone}"` : ""}>${reportIcon(item.icon)}<span><strong>${item.count}</strong><small>${item.label}</small></span></article>`).join("");
}

function inventoryPages(cards: InventoryDeviceCard[], footer: string): string {
  const pageSize = 24;
  return groupedInventoryCards(cards).flatMap(({ location, cards: locationCards }) => {
    const chunks: InventoryDeviceCard[][] = [];
    for (let index = 0; index < locationCards.length; index += pageSize) chunks.push(locationCards.slice(index, index + pageSize));
    const summary = inventorySummary(locationCards);
    const siteFooter = locationFooter(footer, location);

    return chunks.map((chunk, pageIndex) => {
      const pageLabel = chunks.length > 1 ? ` · ${pageIndex + 1} of ${chunks.length}` : "";
      const locationHeading = `${location} device inventory`;
      const heading = pageIndex === 0 ? locationHeading : `${locationHeading} continued`;
      const intro = pageIndex === 0
        ? location === UNASSIGNED_LOCATION
          ? `${locationCards.length} system${locationCards.length === 1 ? "" : "s"} do not yet have a confirmed office assignment.`
          : `${locationCards.length} system${locationCards.length === 1 ? "" : "s"} assigned to ${location}. Red items need attention; age and OS concerns are called out directly.`
        : `Additional systems assigned to ${location}.`;
      return `<section class="pdf-page pdf-focus-page pdf-inventory-page" data-pdf-page="true" data-inventory-location="${location}">
        <header class="pdf-section-header"><span class="kicker">Report appendix · Device inventory · ${location}${pageLabel}</span><h2>${heading}</h2><p>${intro}</p></header>
        ${pageIndex === 0 ? `<div class="pdf-focus-summary">${summary}</div>` : ""}
        <div class="pdf-device-list-header"><span>Device</span><span>Age</span><span>Operating system</span><span>CPU</span><span>Memory</span><span>Storage</span><span>Needs attention</span></div>
        <div class="pdf-device-focus-grid">${chunk.map((card) => card.html).join("")}</div>
        ${siteFooter}
      </section>`;
    });
  }).join("\n");
}

function removeLegacyRadarDevicePackets(html: string): string {
  return html.replace(LEGACY_RADAR_PAGE_PATTERN, "");
}

function closingInsertionPoint(html: string): number {
  const printStart = html.indexOf(PRINT_REPORT_MARKER);
  if (printStart < 0) return -1;
  const recapStart = html.indexOf(FINAL_RECAP_MARKER, printStart);
  if (recapStart < 0) return -1;
  const recapEnd = html.indexOf("</section>", recapStart);
  return recapEnd < 0 ? -1 : recapEnd + "</section>".length;
}

const INVENTORY_CSS = `<style id="client-compass-pdf-inventory-sync">
.pdf-inventory-page{justify-content:flex-start!important}
.pdf-inventory-page .pdf-section-header{margin-bottom:7px!important;padding-right:0!important}
.pdf-inventory-page .pdf-section-header h2{margin:3px 0 5px!important;font-size:25px!important}
.pdf-inventory-page .pdf-section-header p{max-width:none!important;margin:0!important;font-size:7px!important;line-height:1.3!important}
.pdf-inventory-page .pdf-focus-summary{gap:5px!important;margin:6px 0 8px!important}
.pdf-inventory-page .pdf-focus-summary article{min-height:0!important;padding:5px 7px!important;border-radius:9px!important}
.pdf-inventory-page .pdf-focus-summary article .pdf-report-icon{width:22px!important;height:22px!important;border-radius:7px!important}
.pdf-inventory-page .pdf-focus-summary article .pdf-report-icon svg{width:12px!important;height:12px!important}
.pdf-inventory-page .pdf-focus-summary strong{font-size:13px!important;line-height:1!important}
.pdf-inventory-page .pdf-focus-summary small{margin-top:1px!important;font-size:5.5px!important;line-height:1.05!important}
.pdf-inventory-page .pdf-focus-summary .priority{border-color:#efc1b6!important;background:#fff4f1!important}
.pdf-inventory-page .pdf-focus-summary .priority .pdf-report-icon{background:#ffe1d9!important;color:#c45036!important}
.pdf-inventory-page .pdf-focus-summary .attention{border-color:#edd7a5!important;background:#fff9ec!important}
.pdf-inventory-page .pdf-focus-summary .attention .pdf-report-icon{background:#fff0ce!important;color:#a87515!important}
.pdf-inventory-page .pdf-device-list-header{display:grid;grid-template-columns:1.72fr .58fr 1.08fr 1.28fr .62fr .78fr 1.22fr;gap:0;padding:5px 8px;border:1px solid #d7e1ec;border-bottom:0;border-radius:9px 9px 0 0;background:#eef3f8;color:#52677e;font-size:5.1px;font-weight:850;letter-spacing:.045em;text-transform:uppercase}
.pdf-inventory-page .pdf-device-focus-grid{display:grid!important;grid-template-columns:1fr!important;gap:0!important;border:1px solid #d7e1ec;border-radius:0 0 9px 9px;overflow:hidden;background:#fff}
.pdf-inventory-page .pdf-device-list-row{display:grid;grid-template-columns:1.72fr .58fr 1.08fr 1.28fr .62fr .78fr 1.22fr;gap:0;align-items:center;min-height:27px;padding:4px 8px;border:0;border-bottom:1px solid #e4ebf2;background:#fff;break-inside:avoid}
.pdf-inventory-page .pdf-device-list-row:last-child{border-bottom:0}
.pdf-inventory-page .pdf-device-list-row.priority{box-shadow:inset 3px 0 0 #d95f43}
.pdf-inventory-page .pdf-device-list-row.attention{box-shadow:inset 3px 0 0 #c68a18}
.pdf-inventory-page .pdf-device-list-row>div{min-width:0;padding-right:7px}
.pdf-inventory-page .pdf-device-list-identity strong,.pdf-inventory-page .pdf-device-list-identity small,.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{display:block}
.pdf-inventory-page .pdf-device-list-identity strong{font-size:6.5px;line-height:1.12;color:#152a43;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-identity small{margin-top:1px;color:#748397;font-size:4.9px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-fact strong,.pdf-inventory-page .pdf-device-list-action strong{margin:0;color:#31475f;font-size:5.35px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdf-inventory-page .pdf-device-list-cpu strong,.pdf-inventory-page .pdf-device-list-os strong{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;max-height:2.16em;overflow:hidden}
.pdf-inventory-page .pdf-device-list-fact.priority strong,.pdf-inventory-page .pdf-device-list-action.priority strong{color:#c45036;font-weight:900}
.pdf-inventory-page .pdf-device-list-fact.attention strong,.pdf-inventory-page .pdf-device-list-action.attention strong{color:#9c6d12;font-weight:850}
.pdf-inventory-page .pdf-device-list-action.healthy strong{color:#16866f}
.pdf-inventory-page .pdf-page-footer{margin-top:auto!important;padding-top:6px!important}
</style>`;

function withInventoryStyles(html: string): string {
  if (html.includes('id="client-compass-pdf-inventory-sync"')) return html;
  return html.includes("</head>") ? html.replace("</head>", `${INVENTORY_CSS}</head>`) : html;
}

function moveInventoryPagesToClose(html: string, pages: string): string {
  const withoutOldInventory = removeLegacyRadarDevicePackets(html).replace(INVENTORY_PAGE_PATTERN, "");
  const insertionPoint = closingInsertionPoint(withoutOldInventory);
  if (insertionPoint < 0) return html;
  return withInventoryStyles(`${withoutOldInventory.slice(0, insertionPoint)}\n${pages}${withoutOldInventory.slice(insertionPoint)}`);
}

export function ensurePdfDeviceInventory(html: string): string {
  if (!html) return html;

  const existingPages = html.match(INVENTORY_PAGE_PATTERN) ?? [];
  if (existingPages.length) return moveInventoryPagesToClose(html, existingPages.join("\n"));

  const cards = screenInventoryCards(html);
  if (!cards.length) return html;

  const printStart = html.indexOf(PRINT_REPORT_MARKER);
  if (printStart < 0) return html;
  const overviewStart = html.indexOf(OVERVIEW_MARKER, printStart);
  if (overviewStart < 0) return html;
  const overviewEnd = html.indexOf("</section>", overviewStart);
  if (overviewEnd < 0) return html;
  const overviewHtml = html.slice(overviewStart, overviewEnd + "</section>".length);
  const pages = inventoryPages(cards, inventoryFooter(overviewHtml));
  return moveInventoryPagesToClose(html, pages);
}
