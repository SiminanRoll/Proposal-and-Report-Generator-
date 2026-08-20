const SCREEN_INVENTORY_MARKER = '<span class="kicker">Hardware inventory</span><h2>Device detail</h2>';
const PRINT_REPORT_MARKER = '<div class="print-report">';
const OVERVIEW_MARKER = '<section class="pdf-page pdf-overview-page"';
const FINAL_RECAP_MARKER = '<section class="pdf-page pdf-client-success-page"';
const INVENTORY_PAGE_PATTERN = /\s*<section class="pdf-page pdf-focus-page pdf-inventory-page" data-pdf-page="true">[\s\S]*?<\/section>/gi;
const LEGACY_RADAR_PAGE_PATTERN = /\s*<section class="pdf-page pdf-focus-page" data-pdf-page="true">(?:(?!<\/section>)[\s\S])*?<h2>[^<]*what to keep on your radar<\/h2>(?:(?!<\/section>)[\s\S])*?<\/section>/gi;

type InventoryTone = "healthy" | "attention" | "priority";
type InventoryStatus = "current" | "due-soon" | "overdue" | "unknown";

interface InventoryDeviceCard {
  status: InventoryStatus;
  html: string;
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

function reportIcon(kind: "computer" | "activity" | "check"): string {
  const path = kind === "check"
    ? '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>'
    : kind === "activity"
      ? '<path d="M3 12h4l2-5 4 10 2-5h6"/>'
      : '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>';
  return `<span class="pdf-report-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

function inventoryCard(row: string): InventoryDeviceCard | null {
  const cells = rowCells(row);
  if (cells.length < 10 || /empty-table/i.test(row) || /colspan=/i.test(row)) return null;

  const status = lifecycleStatus(row);
  const tone = toneFor(status);
  const device = textOnly(cells[0]) || "Unnamed device";
  const type = textOnly(cells[1]) || "Managed device";
  const model = textOnly(cells[2]) || "Model not reported";
  const os = textOnly(cells[5]) || "Operating system not reported";
  const age = textOnly(cells[6]) || "Age not reported";
  const warranty = textOnly(cells[7]) || "Warranty not reported";
  const checkIn = textOnly(cells[8]) || "Check-in not reported";
  const lifecycle = textOnly(cells[9]) || "Lifecycle not reported";

  const lifecycleLabel = status === "overdue"
    ? "Lifecycle priority"
    : status === "due-soon"
      ? "Planning window"
      : status === "current"
        ? "Current system"
        : "Lifecycle to verify";

  return {
    status,
    html: `<article class="pdf-device-focus-card ${tone}">
      <div class="pdf-device-focus-head">${reportIcon("computer")}<div><span>${type}</span><h3>${device}</h3><p>${model}</p></div></div>
      <div class="pdf-device-concerns">
        <div class="${tone}">${reportIcon(status === "current" ? "check" : "computer")}<span><strong>${lifecycleLabel}</strong><small>${age} · ${warranty}</small></span></div>
        <div class="${status === "current" ? "healthy" : "attention"}">${reportIcon("activity")}<span><strong>Operating system</strong><small>${os}</small></span></div>
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
  return tableRows(screenHtml.slice(bodyStart + 7, bodyEnd))
    .map(inventoryCard)
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

function inventoryPages(cards: InventoryDeviceCard[], footer: string): string {
  const pageSize = 6;
  const chunks: InventoryDeviceCard[][] = [];
  for (let index = 0; index < cards.length; index += pageSize) chunks.push(cards.slice(index, index + pageSize));

  const counts = cards.reduce((result, card) => {
    result[card.status] += 1;
    return result;
  }, { current: 0, "due-soon": 0, overdue: 0, unknown: 0 } as Record<InventoryStatus, number>);

  const summary = [
    `<article class="healthy">${reportIcon("check")}<span><strong>${counts.current}</strong><small>Systems in good shape</small></span></article>`,
    `<article class="attention">${reportIcon("computer")}<span><strong>${counts["due-soon"]}</strong><small>Approaching lifecycle</small></span></article>`,
    `<article class="priority">${reportIcon("computer")}<span><strong>${counts.overdue}</strong><small>Lifecycle priorities</small></span></article>`,
    `<article>${reportIcon("activity")}<span><strong>${counts.unknown}</strong><small>Lifecycle to verify</small></span></article>`,
  ].join("");

  return chunks.map((chunk, pageIndex) => {
    const pageLabel = chunks.length > 1 ? ` · ${pageIndex + 1} of ${chunks.length}` : "";
    const heading = pageIndex === 0 ? "Current device inventory" : "Current device inventory continued";
    const intro = pageIndex === 0
      ? "A reference list of the systems included in this review, with lifecycle, operating-system, and check-in details."
      : "Additional systems included in this review.";
    return `<section class="pdf-page pdf-focus-page pdf-inventory-page" data-pdf-page="true">
      <header class="pdf-section-header"><span class="kicker">Report appendix · Device inventory${pageLabel}</span><h2>${heading}</h2><p>${intro}</p></header>
      ${pageIndex === 0 ? `<div class="pdf-focus-summary">${summary}</div>` : ""}
      <div class="pdf-device-focus-grid">${chunk.map((card) => card.html).join("")}</div>
      ${footer}
    </section>`;
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
