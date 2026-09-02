const SCREEN_INVENTORY_MARKER = '<span class="kicker">Hardware inventory</span><h2>Device detail</h2>';
const PRINT_REPORT_MARKER = '<div class="print-report">';
const OVERVIEW_MARKER = '<section class="pdf-page pdf-overview-page"';
const FINAL_RECAP_MARKER = '<section class="pdf-page pdf-client-success-page"';
const INVENTORY_PAGE_PATTERN = /\s*<section class="pdf-page pdf-focus-page pdf-inventory-page" data-pdf-page="true">[\s\S]*?<\/section>/gi;
const LEGACY_RADAR_PAGE_PATTERN = /\s*<section class="pdf-page pdf-focus-page" data-pdf-page="true">(?:(?!<\/section>)[\s\S])*?<h2>[^<]*what to keep on your radar<\/h2>(?:(?!<\/section>)[\s\S])*?<\/section>/gi;
const SITE_OVERVIEW_PATTERN = /<div class="pdf-site-overview-grid">([\s\S]*?)<\/div>/i;
const UNASSIGNED_LOCATION = "Unassigned";

type InventoryTone = "healthy" | "attention" | "priority";
type InventoryStatus = "current" | "due-soon" | "overdue" | "unknown";
type InventoryIcon = "computer" | "activity" | "check";

interface InventoryDeviceCard {
  status: InventoryStatus;
  location: string;
  osConcern: boolean;
  html: string;
}

interface InventorySummaryItem {
  key: InventoryStatus | "os";
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

function toneFor(status: InventoryStatus): InventoryTone {
  if (status === "overdue") return "priority";
  if (status === "current") return "healthy";
  return "attention";
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

function lifecycleDetail(status: InventoryStatus, age: string, warranty: string): string {
  const ageMissing = status === "unknown"
    || /^0(?:\.0+)?\s+years?\s+old$/i.test(age)
    || /\bage (?:not listed|not reported|unknown)\b/i.test(age);
  const warrantyMissing = /\bwarranty (?:unknown|not reported|not listed)\b/i.test(warranty)
    || /\bdate not listed\b/i.test(warranty);

  if (ageMissing) {
    return warrantyMissing
      ? "Original ship date not listed · Warranty details not listed"
      : `Original ship date not listed · ${warranty}`;
  }
  if (warrantyMissing) return `${age} · Warranty details not listed`;

  return `${age} · ${warranty}`;
}

function inventoryCard(row: string, knownLocations: string[]): InventoryDeviceCard | null {
  const cells = rowCells(row);
  if (cells.length < 10 || /empty-table/i.test(row) || /colspan=/i.test(row)) return null;

  const status = lifecycleStatus(row);
  const tone = toneFor(status);
  const location = cardLocation(cells[0], knownLocations);
  const device = textOnly(cells[0].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? cells[0]) || "Unnamed device";
  const type = textOnly(cells[1]) || "Managed device";
  const model = textOnly(cells[2]) || "Model not reported";
  const os = textOnly(cells[5]) || "Operating system not reported";
  const age = textOnly(cells[6]) || "Age not reported";
  const warranty = textOnly(cells[7]) || "Warranty not reported";
  const checkIn = textOnly(cells[8]) || "Check-in not reported";
  const lifecycle = textOnly(cells[9]) || "Lifecycle not reported";
  const osConcern = operatingSystemConcern(row, os);
  const lifecycleContext = lifecycleDetail(status, age, warranty);

  const lifecycleLabel = status === "overdue"
    ? "Lifecycle priority"
    : status === "due-soon"
      ? "Planning window"
      : status === "current"
        ? "Current system"
        : "Lifecycle to verify";

  return {
    status,
    location,
    osConcern,
    html: `<article class="pdf-device-focus-card ${tone}">
      <div class="pdf-device-focus-head">${reportIcon("computer")}<div><span>${type}</span><h3>${device}</h3><p>${model}</p></div></div>
      <div class="pdf-device-concerns">
        <div class="${tone}">${reportIcon(status === "current" ? "check" : "computer")}<span><strong>${lifecycleLabel}</strong><small>${lifecycleContext}</small></span></div>
        <div class="${osConcern ? "attention" : status === "current" ? "healthy" : "attention"}">${reportIcon("activity")}<span><strong>Operating system</strong><small>${os}</small></span></div>
        <div class="${status === "overdue" ? "priority" : status === "current" ? "healthy" : "attention"}">${reportIcon("activity")}<span><strong>Check-in and status</strong><small>${checkIn} · ${lifecycle}</small></span></div>
      </div>
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
  const counts = cards.reduce((result, card) => {
    result[card.status] += 1;
    return result;
  }, { current: 0, "due-soon": 0, overdue: 0, unknown: 0 } as Record<InventoryStatus, number>);
  const osConcerns = cards.filter((card) => card.osConcern).length;

  const usefulItems: InventorySummaryItem[] = [
    { key: "current", count: counts.current, label: "Systems in good shape", tone: "healthy", icon: "check" },
    ...(counts.overdue > 0 ? [{ key: "overdue" as const, count: counts.overdue, label: "Lifecycle priorities", tone: "priority" as const, icon: "computer" as const }] : []),
    ...(counts["due-soon"] > 0 ? [{ key: "due-soon" as const, count: counts["due-soon"], label: "Approaching lifecycle", tone: "attention" as const, icon: "computer" as const }] : []),
    ...(osConcerns > 0 ? [{ key: "os" as const, count: osConcerns, label: "OS concerns", tone: "attention" as const, icon: "activity" as const }] : []),
    ...(counts.unknown > 0 ? [{ key: "unknown" as const, count: counts.unknown, label: "Lifecycle to verify", icon: "activity" as const }] : []),
  ];

  const zeroFillers: InventorySummaryItem[] = [
    { key: "overdue", count: 0, label: "Lifecycle priorities", tone: "priority", icon: "computer" },
    { key: "due-soon", count: 0, label: "Approaching lifecycle", tone: "attention", icon: "computer" },
    { key: "unknown", count: 0, label: "Lifecycle to verify", icon: "activity" },
  ];
  const presentKeys = new Set(usefulItems.map((item) => item.key));
  const items = [...usefulItems, ...zeroFillers.filter((item) => !presentKeys.has(item.key))].slice(0, 4);

  return items.map((item) => `<article${item.tone ? ` class="${item.tone}"` : ""}>${reportIcon(item.icon)}<span><strong>${item.count}</strong><small>${item.label}</small></span></article>`).join("");
}

function inventoryPages(cards: InventoryDeviceCard[], footer: string): string {
  const pageSize = 6;
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
          ? `${locationCards.length} system${locationCards.length === 1 ? "" : "s"} in this review do not currently have a confirmed office assignment.`
          : `${locationCards.length} system${locationCards.length === 1 ? "" : "s"} assigned to ${location}, with lifecycle, operating-system, and check-in details.`
        : `Additional systems assigned to ${location}.`;
      return `<section class="pdf-page pdf-focus-page pdf-inventory-page" data-pdf-page="true" data-inventory-location="${location}">
        <header class="pdf-section-header"><span class="kicker">Report appendix · Device inventory · ${location}${pageLabel}</span><h2>${heading}</h2><p>${intro}</p></header>
        ${pageIndex === 0 ? `<div class="pdf-focus-summary">${summary}</div>` : ""}
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
.pdf-inventory-page .pdf-device-focus-card.healthy{border-left-color:#15977f!important}
.pdf-inventory-page .pdf-device-concerns .healthy{border-color:#b7dace!important;background:#eff9f5!important}
.pdf-inventory-page .pdf-device-concerns .healthy>.pdf-report-icon{background:#ddf5ee!important;color:#15977f!important}
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
