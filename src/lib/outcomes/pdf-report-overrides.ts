import { getProjectsSnapshot } from "@/lib/projects/store";
import type { ClientReportEditableSectionId, ClientReportSectionOverride } from "@/lib/review-outcomes/types";

interface SectionTarget {
  id: ClientReportEditableSectionId;
  selector: string;
  continuationSelector?: string;
}

const SECTION_TARGETS: SectionTarget[] = [
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

function applyHeaderOverride(header: Element, override: ClientReportSectionOverride, options: { continuation?: boolean; inventory?: boolean } = {}): void {
  const titleOverride = cleanOverride(override.title);
  const bodyOverride = cleanOverride(override.body);
  const title = header.querySelector<HTMLElement>("h2");
  const body = header.querySelector<HTMLElement>("p");

  if (title && titleOverride) {
    if (options.inventory) {
      const page = header.closest<HTMLElement>(".pdf-inventory-page");
      const location = page?.dataset.inventoryLocation?.trim() ?? "";
      const wasContinued = /\bcontinued\b/i.test(title.textContent ?? "");
      title.textContent = `${location ? `${location}: ` : ""}${titleOverride}${wasContinued ? " continued" : ""}`;
    } else {
      title.textContent = `${titleOverride}${options.continuation ? " continued" : ""}`;
    }
  }

  if (body && bodyOverride && !options.continuation) body.textContent = bodyOverride;
}

export function prepareReportTextOverridesHtml(html: string, documentTitle: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined" || !documentTitle.startsWith("Technology Health Review")) return html;
  const project = liveClientReportProject(documentTitle);
  const overrides = project?.reviewOutcome?.reportTextOverrides;
  if (!project || !overrides || !Object.keys(overrides).length) return html;

  const documentRef = new DOMParser().parseFromString(html, "text/html");
  let changed = false;

  for (const target of SECTION_TARGETS) {
    const override = overrides[target.id];
    if (!override || (!cleanOverride(override.title) && !cleanOverride(override.body))) continue;

    const headers = [...documentRef.querySelectorAll(target.selector)];
    for (const header of headers) {
      applyHeaderOverride(header, override, { inventory: target.id === "inventory" });
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
