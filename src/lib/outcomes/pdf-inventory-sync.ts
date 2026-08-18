const SCREEN_INVENTORY_MARKER = '<span class="kicker">Hardware inventory</span><h2>Device detail</h2>';
const PRINT_REPORT_MARKER = '<div class="print-report">';
const OVERVIEW_MARKER = '<section class="pdf-page pdf-overview-page"';

function tableRows(value: string): string[] {
  return value.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
}

function rowCells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
}

function inventoryRow(row: string): string | null {
  const cells = rowCells(row);
  if (cells.length < 10 || /empty-table/i.test(row) || /colspan=/i.test(row)) return null;
  const open = row.match(/^<tr\b[^>]*>/i)?.[0] ?? "<tr>";
  return `${open}
    <td>${cells[0]}</td>
    <td>${cells[1]}<div class="pdf-inventory-secondary">${cells[2]}</div></td>
    <td>${cells[5]}</td>
    <td><div>${cells[6]}</div><div class="pdf-inventory-secondary">${cells[7]}</div></td>
    <td><div>${cells[8]}</div><div class="pdf-inventory-secondary">${cells[9]}</div></td>
  </tr>`;
}

function screenInventoryRows(html: string): string[] {
  const printStart = html.indexOf(PRINT_REPORT_MARKER);
  const screenHtml = printStart >= 0 ? html.slice(0, printStart) : html;
  const marker = screenHtml.indexOf(SCREEN_INVENTORY_MARKER);
  if (marker < 0) return [];
  const bodyStart = screenHtml.indexOf("<tbody>", marker);
  if (bodyStart < 0) return [];
  const bodyEnd = screenHtml.indexOf("</tbody>", bodyStart);
  if (bodyEnd < 0) return [];
  return tableRows(screenHtml.slice(bodyStart + 7, bodyEnd))
    .map(inventoryRow)
    .filter((row): row is string => Boolean(row));
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

function inventoryPages(rows: string[], footer: string): string {
  const pageSize = 10;
  const chunks: string[][] = [];
  for (let index = 0; index < rows.length; index += pageSize) chunks.push(rows.slice(index, index + pageSize));
  return chunks.map((chunk, pageIndex) => {
    const pageLabel = chunks.length > 1 ? ` · ${pageIndex + 1} of ${chunks.length}` : "";
    const heading = pageIndex === 0 ? "Current device inventory" : "Current device inventory continued";
    const intro = pageIndex === 0
      ? "The systems included in this technology review, with key lifecycle and operating-system details."
      : "Additional systems included in the same technology review.";
    return `<section class="pdf-page pdf-inventory-page" data-pdf-page="true">
      <header class="pdf-section-header"><span class="kicker">Current environment · Device inventory${pageLabel}</span><h2>${heading}</h2><p>${intro}</p></header>
      <table class="pdf-inventory-table"><thead><tr><th>Device</th><th>Type &amp; model</th><th>Operating system</th><th>Age &amp; warranty</th><th>Check-in &amp; status</th></tr></thead><tbody>${chunk.join("")}</tbody></table>
      ${footer}
    </section>`;
  }).join("\n");
}

const INVENTORY_CSS = `<style id="client-compass-pdf-inventory-sync">
.pdf-inventory-page .pdf-section-header{margin-bottom:12px!important}
.pdf-inventory-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:6.5pt;color:#0b1830}
.pdf-inventory-table thead{display:table-header-group}.pdf-inventory-table th{padding:8px 7px;background:#102b50;color:#fff;font-size:6.1pt;letter-spacing:.04em;text-align:left;text-transform:uppercase}
.pdf-inventory-table th:nth-child(1){width:22%}.pdf-inventory-table th:nth-child(2){width:23%}.pdf-inventory-table th:nth-child(3){width:24%}.pdf-inventory-table th:nth-child(4){width:15%}.pdf-inventory-table th:nth-child(5){width:16%}
.pdf-inventory-table td{padding:8px 7px;border-bottom:1px solid #dce5ef;vertical-align:top;line-height:1.25;overflow-wrap:anywhere}.pdf-inventory-table tbody tr{break-inside:avoid;page-break-inside:avoid}.pdf-inventory-table tbody tr:nth-child(even){background:#f6f9fc}
.pdf-inventory-table td strong,.pdf-inventory-table td small{display:block}.pdf-inventory-table td small{margin-top:2px;color:#778599;font-size:5.8pt}.pdf-inventory-secondary{margin-top:3px;color:#68788c;font-size:5.9pt;line-height:1.25}
.pdf-inventory-table .os-support{display:block;max-width:none;padding:0;background:transparent!important}.pdf-inventory-table .os-support b{display:block;color:#0b1830;font-size:6.4pt}.pdf-inventory-table .os-support small{font-size:5.5pt!important}
.pdf-inventory-table .warranty,.pdf-inventory-table .status{display:inline-flex;padding:3px 5px;border-radius:999px;font-size:5.4pt;font-weight:850;text-transform:uppercase}.pdf-inventory-table .warranty.in-warranty,.pdf-inventory-table .status.current{background:#ddf5ee;color:#12725f}.pdf-inventory-table .warranty.ending-soon,.pdf-inventory-table .status.due-soon{background:#fff2ce;color:#8a6517}.pdf-inventory-table .warranty.out-of-warranty,.pdf-inventory-table .status.overdue{background:#ffe2dc;color:#a7442c}.pdf-inventory-table .warranty.unknown,.pdf-inventory-table .status.unknown{background:#e9edf2;color:#5f6d7d}
</style>`;

export function ensurePdfDeviceInventory(html: string): string {
  if (!html || html.includes('class="pdf-page pdf-inventory-page"')) return html;
  const rows = screenInventoryRows(html);
  if (!rows.length) return html;

  const printStart = html.indexOf(PRINT_REPORT_MARKER);
  if (printStart < 0) return html;
  const overviewStart = html.indexOf(OVERVIEW_MARKER, printStart);
  if (overviewStart < 0) return html;
  const overviewEnd = html.indexOf("</section>", overviewStart);
  if (overviewEnd < 0) return html;
  const insertionPoint = overviewEnd + "</section>".length;
  const overviewHtml = html.slice(overviewStart, insertionPoint);
  const pages = inventoryPages(rows, inventoryFooter(overviewHtml));
  const withPages = `${html.slice(0, insertionPoint)}\n${pages}${html.slice(insertionPoint)}`;
  return withPages.includes("</head>") ? withPages.replace("</head>", `${INVENTORY_CSS}</head>`) : withPages;
}
