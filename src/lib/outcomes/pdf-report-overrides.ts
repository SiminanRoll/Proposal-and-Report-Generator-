import { getProjectsSnapshot } from "@/lib/projects/store";
import type { ClientReportEditableSectionId, ClientReportSectionOverride, ClientReportSectionLocationOverride, ClientReportTextOverrides } from "@/lib/review-outcomes/types";

interface SectionTarget {
  id: ClientReportEditableSectionId;
  selector: string;
  continuationSelector?: string;
}

export const INVENTORY_UNASSIGNED_OVERRIDE_KEY = "__unassigned__";

export const CLIENT_REPORT_EDITABLE_SECTION_TARGETS: SectionTarget[] = [
  { id: "overview", selector: ".print-report .pdf-overview-page > .pdf-section-header" },
  { id: "review-focus", selector: ".print-report .pdf-tailored-focus-page > .pdf-section-header" },
  { id: "hipaa", selector: ".print-report .pdf-hipaa-review > .pdf-section-header" },
  { id: "planning", selector: ".print-report .pdf-action-page:not(.pdf-action-continuation) > .pdf-section-header", continuationSelector: ".print-report .pdf-action-continuation > .pdf-section-header" },
  { id: "inventory", selector: ".print-report .pdf-inventory-page > .pdf-section-header" },
  { id: "recap", selector: ".print-report .pdf-client-success-page > .pdf-section-header" },
];

function liveClientReportProject(documentTitle: string) {
  if (typeof window === "undefined" || !documentTitle.startsWith("Technology Health Review")) return null;
  return getProjectsSnapshot()
    .filter((project) => {
      if (project.type !== "client-report") return false;
      const clientName = project.client.name.trim();
      const projectTitle = clientName ? `Technology Health Review - ${clientName}` : "Technology Health Review";
      return projectTitle === documentTitle;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function cleanOverride(value: string | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasCopy(override: ClientReportSectionOverride | ClientReportSectionLocationOverride | undefined): boolean {
  return Boolean(override && (cleanOverride(override.title) || cleanOverride(override.body)));
}

export function inventoryOverrideKey(page: Element | null): string {
  const location = page instanceof HTMLElement ? page.dataset.inventoryLocation?.trim() ?? "" : "";
  return location || INVENTORY_UNASSIGNED_OVERRIDE_KEY;
}

function applyHeaderOverride(
  header: Element,
  override: ClientReportSectionOverride | ClientReportSectionLocationOverride,
  options: { continuation?: boolean; inventoryLegacy?: boolean; exactInventory?: boolean } = {},
): void {
  const titleOverride = cleanOverride(override.title);
  const bodyOverride = cleanOverride(override.body);
  const title = header.querySelector<HTMLElement>("h2");
  const body = header.querySelector<HTMLElement>("p");

  if (title && titleOverride) {
    if (options.inventoryLegacy) {
      const page = header.closest<HTMLElement>(".pdf-inventory-page");
      const location = page?.dataset.inventoryLocation?.trim() ?? "";
      const wasContinued = /\bcontinued\b/i.test(title.textContent ?? "");
      title.textContent = `${location ? `${location}: ` : ""}${titleOverride}${wasContinued ? " continued" : ""}`;
    } else if (options.exactInventory) {
      const wasContinued = /\bcontinued\b/i.test(title.textContent ?? "") || options.continuation;
      title.textContent = `${titleOverride}${wasContinued ? " continued" : ""}`;
    } else {
      title.textContent = `${titleOverride}${options.continuation ? " continued" : ""}`;
    }
  }

  if (body && bodyOverride && !options.continuation) body.textContent = bodyOverride;
}

function applyInventoryOverrides(documentRef: Document, target: SectionTarget, override: ClientReportSectionOverride): boolean {
  const headers = [...documentRef.querySelectorAll(target.selector)];
  if (!headers.length) return false;
  let changed = false;
  const seenLocations = new Set<string>();

  for (const header of headers) {
    const page = header.closest<HTMLElement>(".pdf-inventory-page");
    const key = inventoryOverrideKey(page);
    const locationOverride = override.locations?.[key];
    if (hasCopy(locationOverride)) {
      const continuation = seenLocations.has(key) || /\bcontinued\b/i.test(header.querySelector("h2")?.textContent ?? "");
      applyHeaderOverride(header, locationOverride!, { continuation, exactInventory: true });
      changed = true;
    } else if (hasCopy(override)) {
      applyHeaderOverride(header, override, { inventoryLegacy: true });
      changed = true;
    }
    seenLocations.add(key);
  }

  return changed;
}

export function applyReportTextOverridesHtml(html: string, overrides: ClientReportTextOverrides = {}): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined" || !Object.keys(overrides).length) return html;

  const documentRef = new DOMParser().parseFromString(html, "text/html");
  let changed = false;

  for (const target of CLIENT_REPORT_EDITABLE_SECTION_TARGETS) {
    const override = overrides[target.id];
    if (!override) continue;

    if (target.id === "inventory") {
      if (applyInventoryOverrides(documentRef, target, override)) changed = true;
      continue;
    }

    if (!hasCopy(override)) continue;
    const headers = [...documentRef.querySelectorAll(target.selector)];
    for (const header of headers) {
      applyHeaderOverride(header, override);
      changed = true;
    }

    if (target.continuationSelector && cleanOverride(override.title)) {
      const continuationHeaders = [...documentRef.querySelectorAll(target.continuationSelector)];
      for (const header of continuationHeaders) {
        applyHeaderOverride(header, override, { continuation: true });
        changed = true;
      }
    }
  }

  return changed ? `<!doctype html>${documentRef.documentElement.outerHTML}` : html;
}

export function prepareReportTextOverridesHtml(html: string, documentTitle: string): string {
  if (typeof window === "undefined" || !documentTitle.startsWith("Technology Health Review")) return html;
  const project = liveClientReportProject(documentTitle);
  return applyReportTextOverridesHtml(html, project?.reviewOutcome?.reportTextOverrides ?? {});
}
