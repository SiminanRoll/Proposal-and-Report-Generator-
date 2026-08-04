/**
 * Browser-only PDF handoff generator.
 *
 * The presentation pages are rendered from the same client-facing HTML used by
 * the workspace, then embedded as page images in a PDF. Elements marked with
 * data-pdf-field attributes are overlaid as standard AcroForm fields so the
 * client can type responses and save the completed document in Adobe Reader or
 * another compatible PDF application.
 */

export type PdfFieldKind = "text" | "choice";

export interface PdfFieldDefinition {
  name: string;
  kind: PdfFieldKind;
  x: number;
  y: number;
  width: number;
  height: number;
  options?: string[];
  multiline?: boolean;
  fontSize?: number;
}

export interface PdfRasterPage {
  jpegBytes: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  fields: PdfFieldDefinition[];
}

interface PdfObjectStore {
  reserve(): number;
  set(reference: number, body: Uint8Array): void;
  add(body: Uint8Array): number;
  serialize(rootReference: number, infoReference?: number): Uint8Array;
}

const encoder = new TextEncoder();
export interface PdfPageLayout {
  captureWidth: number;
  captureHeight: number;
  outputWidth: number;
  outputHeight: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}

const LANDSCAPE_LAYOUT: PdfPageLayout = {
  captureWidth: 1280,
  captureHeight: 720,
  outputWidth: 1920,
  outputHeight: 1080,
  pdfPageWidth: 960,
  pdfPageHeight: 540,
};

const PORTRAIT_LAYOUT: PdfPageLayout = {
  captureWidth: 816,
  captureHeight: 1056,
  outputWidth: 1632,
  outputHeight: 2112,
  pdfPageWidth: 612,
  pdfPageHeight: 792,
};

function requestedLayout(documentRef: Document): PdfPageLayout {
  const requested = documentRef.querySelector<HTMLMetaElement>('meta[name="adv-pdf-layout"]')?.content.trim().toLowerCase();
  return requested === "portrait" ? PORTRAIT_LAYOUT : LANDSCAPE_LAYOUT;
}

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function streamObject(dictionary: string, payload: Uint8Array): Uint8Array {
  return concat([
    bytes(`<< ${dictionary} /Length ${payload.length} >>\nstream\n`),
    payload,
    bytes("\nendstream"),
  ]);
}

function pdfString(value: string): string {
  const ascii = value.replace(/[^\x20-\x7e]/g, " ");
  return `(${ascii.replace(/([\\()])/g, "\\$1")})`;
}

function createObjectStore(): PdfObjectStore {
  const objects: Array<Uint8Array | null> = [null];

  return {
    reserve() {
      objects.push(null);
      return objects.length - 1;
    },
    set(reference, body) {
      if (reference <= 0 || reference >= objects.length) throw new Error(`Invalid PDF object reference ${reference}.`);
      objects[reference] = body;
    },
    add(body) {
      objects.push(body);
      return objects.length - 1;
    },
    serialize(rootReference, infoReference) {
      const header = concat([bytes("%PDF-1.7\n%"), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), bytes("\n")]);
      const chunks: Uint8Array[] = [header];
      const offsets: number[] = [0];
      let cursor = header.length;

      for (let reference = 1; reference < objects.length; reference += 1) {
        const body = objects[reference];
        if (!body) throw new Error(`PDF object ${reference} was reserved but never populated.`);
        const prefix = bytes(`${reference} 0 obj\n`);
        const suffix = bytes("\nendobj\n");
        offsets[reference] = cursor;
        chunks.push(prefix, body, suffix);
        cursor += prefix.length + body.length + suffix.length;
      }

      const xrefOffset = cursor;
      const xrefRows = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
      for (let reference = 1; reference < objects.length; reference += 1) {
        xrefRows.push(`${String(offsets[reference]).padStart(10, "0")} 00000 n `);
      }
      const trailerParts = [`trailer\n<< /Size ${objects.length} /Root ${rootReference} 0 R`];
      if (infoReference) trailerParts.push(` /Info ${infoReference} 0 R`);
      trailerParts.push(` >>\nstartxref\n${xrefOffset}\n%%EOF`);
      chunks.push(bytes(`${xrefRows.join("\n")}\n${trailerParts.join("")}`));
      return concat(chunks);
    },
  };
}

function fieldAppearance(field: PdfFieldDefinition): string {
  const fontSize = Math.max(7, Math.min(14, field.fontSize ?? 10));
  return `/DA (/Helv ${fontSize} Tf 0.04 0.09 0.18 rg) /MK << /BC [0.16 0.42 0.76] /BG [0.985 0.993 1] >> /BS << /W 0.8 /S /S >>`;
}

/** Pure PDF assembler exported for regression tests. */
export function buildFillablePdfBytes(pages: PdfRasterPage[], title: string, layout: PdfPageLayout = LANDSCAPE_LAYOUT): Uint8Array {
  if (!pages.length) throw new Error("No PDF pages were provided.");
  const store = createObjectStore();
  const catalogReference = store.reserve();
  const pagesReference = store.reserve();
  const acroFormReference = store.reserve();
  const fontReference = store.add(bytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  const pageReferences: number[] = [];
  const fieldReferences: number[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const input = pages[pageIndex];
    const pageReference = store.reserve();
    pageReferences.push(pageReference);

    const imageReference = store.add(streamObject(
      `/Type /XObject /Subtype /Image /Width ${input.imageWidth} /Height ${input.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      input.jpegBytes,
    ));
    const content = bytes(`q\n${layout.pdfPageWidth} 0 0 ${layout.pdfPageHeight} 0 0 cm\n/Im${pageIndex + 1} Do\nQ`);
    const contentReference = store.add(streamObject("", content));
    const pageFieldReferences: number[] = [];

    for (const field of input.fields) {
      const fieldReference = store.reserve();
      fieldReferences.push(fieldReference);
      pageFieldReferences.push(fieldReference);
      const x1 = Math.max(0, Math.min(layout.pdfPageWidth, field.x));
      const y1 = Math.max(0, Math.min(layout.pdfPageHeight, field.y));
      const x2 = Math.max(x1 + 1, Math.min(layout.pdfPageWidth, field.x + field.width));
      const y2 = Math.max(y1 + 1, Math.min(layout.pdfPageHeight, field.y + field.height));
      const common = `/Type /Annot /Subtype /Widget /T ${pdfString(field.name)} /Rect [${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}] /P ${pageReference} 0 R /F 4 ${fieldAppearance(field)}`;
      if (field.kind === "choice") {
        const options = (field.options?.length ? field.options : ["Yes", "No", "Not sure", "Not applicable"])
          .map((option) => pdfString(option)).join(" ");
        store.set(fieldReference, bytes(`<< ${common} /FT /Ch /Ff 131072 /Opt [${options}] >>`));
      } else {
        const flags = field.multiline ? 4096 : 0;
        store.set(fieldReference, bytes(`<< ${common} /FT /Tx /Ff ${flags} /Q 0 >>`));
      }
    }

    const annots = pageFieldReferences.length ? `/Annots [${pageFieldReferences.map((reference) => `${reference} 0 R`).join(" ")}]` : "";
    store.set(pageReference, bytes(`<< /Type /Page /Parent ${pagesReference} 0 R /MediaBox [0 0 ${layout.pdfPageWidth} ${layout.pdfPageHeight}] /Resources << /XObject << /Im${pageIndex + 1} ${imageReference} 0 R >> /Font << /Helv ${fontReference} 0 R >> >> /Contents ${contentReference} 0 R ${annots} >>`));
  }

  store.set(pagesReference, bytes(`<< /Type /Pages /Count ${pageReferences.length} /Kids [${pageReferences.map((reference) => `${reference} 0 R`).join(" ")}] >>`));
  store.set(acroFormReference, bytes(`<< /Fields [${fieldReferences.map((reference) => `${reference} 0 R`).join(" ")}] /NeedAppearances true /DR << /Font << /Helv ${fontReference} 0 R >> >> /DA (/Helv 10 Tf 0 g) >>`));
  store.set(catalogReference, bytes(`<< /Type /Catalog /Pages ${pagesReference} 0 R /AcroForm ${acroFormReference} 0 R /PageMode /UseNone >>`));
  const infoReference = store.add(bytes(`<< /Title ${pdfString(title)} /Author ${pdfString("Advantage Technologies")} /Creator ${pdfString("Advantage Proposal and Report Generator")} /Producer ${pdfString("Advantage local client PDF handoff")} >>`));
  return store.serialize(catalogReference, infoReference);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "advantage-client-document";
}

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The PDF page image could not be rendered."));
    image.src = url;
  });
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("The browser could not encode a PDF page image."));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/jpeg", 0.93);
  });
}

function captureFields(page: HTMLElement, layout: PdfPageLayout): PdfFieldDefinition[] {
  const pageRect = page.getBoundingClientRect();
  if (!pageRect.width || !pageRect.height) return [];
  return Array.from(page.querySelectorAll<HTMLElement>("[data-pdf-field]")).flatMap((element) => {
    const name = element.dataset.pdfField?.trim();
    const rect = element.getBoundingClientRect();
    if (!name || !rect.width || !rect.height) return [];
    const x = ((rect.left - pageRect.left) / pageRect.width) * layout.pdfPageWidth;
    const width = (rect.width / pageRect.width) * layout.pdfPageWidth;
    const height = (rect.height / pageRect.height) * layout.pdfPageHeight;
    const top = ((rect.top - pageRect.top) / pageRect.height) * layout.pdfPageHeight;
    const y = layout.pdfPageHeight - top - height;
    const kind: PdfFieldKind = element.dataset.pdfFieldType === "choice" ? "choice" : "text";
    const options = element.dataset.pdfOptions?.split("|").map((item) => item.trim()).filter(Boolean);
    const fontSize = Number(element.dataset.pdfFontSize);
    return [{
      name,
      kind,
      x,
      y,
      width,
      height,
      options,
      multiline: element.dataset.pdfMultiline === "true",
      fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : undefined,
    }];
  });
}

function pageStyles(documentRef: Document, layout: PdfPageLayout): string {
  // The capture runs inside an SVG image where the browser does not activate
  // print media queries. Promote print rules to all media so the rasterized PDF
  // uses the exact print layout rather than falling back to screen styling.
  const css = Array.from(documentRef.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n")
    .replace(/@media\s+print/gi, "@media all");
  return `${css}\n
    *{animation:none!important;transition:none!important;caret-color:transparent!important}
    html,body{margin:0!important;padding:0!important;width:${layout.captureWidth}px!important;height:${layout.captureHeight}px!important;overflow:hidden!important;background:#fff!important}
    main{width:${layout.captureWidth}px!important;max-width:none!important;margin:0!important;padding:0!important}
    .print-report,.pdf-capture-document,[data-pdf-capture-page]{font-family:Arial,"Segoe UI",sans-serif!important}
    .print-report{display:block!important;width:${layout.captureWidth}px!important;margin:0!important;padding:0!important}
    .screen-report,.toolbar,.top,.footer{display:none!important}
    [data-pdf-capture-page]{display:flex!important;box-sizing:border-box!important;width:${layout.captureWidth}px!important;height:${layout.captureHeight}px!important;min-height:${layout.captureHeight}px!important;max-height:${layout.captureHeight}px!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:hidden!important;page-break-after:auto!important;break-after:auto!important}
    [data-pdf-capture-page].pdf-flow-page{display:block!important}
    [data-pdf-capture-page] .pdf-page-footer{position:absolute!important;left:18px!important;right:18px!important;bottom:12px!important}
  `;
}

async function rasterizePage(page: HTMLElement, documentRef: Document, css: string, layout: PdfPageLayout): Promise<PdfRasterPage> {
  page.dataset.pdfCapturePage = "true";
  page.style.width = `${layout.captureWidth}px`;
  page.style.height = `${layout.captureHeight}px`;
  page.style.minHeight = `${layout.captureHeight}px`;
  page.style.maxHeight = `${layout.captureHeight}px`;
  page.style.margin = "0";
  page.style.overflow = "hidden";
  await waitForFrame();

  const fields = captureFields(page, layout);
  const clone = page.cloneNode(true) as HTMLElement;
  clone.dataset.pdfCapturePage = "true";
  clone.style.width = `${layout.captureWidth}px`;
  clone.style.height = `${layout.captureHeight}px`;
  clone.style.minHeight = `${layout.captureHeight}px`;
  clone.style.maxHeight = `${layout.captureHeight}px`;
  clone.style.margin = "0";
  clone.style.overflow = "hidden";
  const clientReportWrapper = Boolean(page.closest(".print-report"));
  const wrapperClass = clientReportWrapper ? "print-report" : "pdf-capture-document";
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.captureWidth} ${layout.captureHeight}"><foreignObject x="0" y="0" width="${layout.captureWidth}" height="${layout.captureHeight}"><div xmlns="http://www.w3.org/1999/xhtml" class="${wrapperClass}" style="width:${layout.captureWidth}px;height:${layout.captureHeight}px;overflow:hidden;background:#fff"><style>${css}</style>${serialized}</div></foreignObject></svg>`;
  // A data URL keeps the self-contained SVG origin-clean when it is drawn onto
  // canvas. Chromium treats a blob-backed SVG containing foreignObject as
  // tainted, which prevents canvas.toBlob() and breaks client PDF downloads.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = await loadImage(url);
  const canvas = documentRef.createElement("canvas");
  canvas.width = layout.outputWidth;
  canvas.height = layout.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create the PDF rendering surface.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { jpegBytes: await canvasJpeg(canvas), imageWidth: canvas.width, imageHeight: canvas.height, fields };
}

function sourcePages(documentRef: Document): HTMLElement[] {
  const printReport = documentRef.querySelector<HTMLElement>(".print-report");
  if (printReport) {
    // Elements inside the hidden rendering iframe belong to a different browser
    // realm, so parent-window instanceof checks are unreliable. The tag and
    // node type are enough to identify the direct presentation pages safely.
    return Array.from(printReport.children)
      .filter((node) => node.nodeType === 1 && node.tagName === "SECTION") as HTMLElement[];
  }
  const proposalPages = Array.from(documentRef.querySelectorAll<HTMLElement>("main > section.page"));
  if (proposalPages.length) return proposalPages;
  return Array.from(documentRef.querySelectorAll<HTMLElement>("main > section, main > .hero"));
}

async function renderHtmlPages(html: string): Promise<{ pages: PdfRasterPage[]; layout: PdfPageLayout }> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-20000px",
    top: "0",
    width: `${LANDSCAPE_LAYOUT.captureWidth}px`,
    height: `${LANDSCAPE_LAYOUT.captureHeight}px`,
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  try {
    const documentRef = iframe.contentDocument;
    if (!documentRef) throw new Error("The PDF rendering frame could not be initialized.");
    documentRef.open();
    documentRef.write(html);
    documentRef.close();
    await new Promise<void>((resolve) => {
      if (documentRef.readyState === "complete") resolve();
      else iframe.addEventListener("load", () => resolve(), { once: true });
    });
    if (documentRef.fonts?.ready) await documentRef.fonts.ready.catch(() => undefined);
    const layout = requestedLayout(documentRef);
    iframe.style.width = `${layout.captureWidth}px`;
    iframe.style.height = `${layout.captureHeight}px`;
    const override = documentRef.createElement("style");
    override.textContent = pageStyles(documentRef, layout);
    documentRef.head.appendChild(override);
    await waitForFrame();
    const pages = sourcePages(documentRef);
    if (!pages.length) throw new Error("No client-facing pages were found for the PDF.");
    const css = pageStyles(documentRef, layout);
    const rendered: PdfRasterPage[] = [];
    for (const page of pages) rendered.push(await rasterizePage(page, documentRef, css, layout));
    return { pages: rendered, layout };
  } finally {
    iframe.remove();
  }
}

export async function downloadFillableClientPdf(html: string, documentTitle: string): Promise<void> {
  const { pages, layout } = await renderHtmlPages(html);
  const pdf = buildFillablePdfBytes(pages, documentTitle, layout);
  // BlobPart requires an ArrayBuffer-backed value. Copying the generated bytes
  // into a concrete ArrayBuffer avoids the ArrayBufferLike/SharedArrayBuffer
  // incompatibility enforced by newer TypeScript DOM definitions.
  const pdfBuffer = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(pdfBuffer).set(pdf);
  const url = URL.createObjectURL(new Blob([pdfBuffer], { type: "application/pdf" }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(documentTitle)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
}
