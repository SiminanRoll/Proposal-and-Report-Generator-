"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/projects/types";
import type { ClientReportEditableSectionId, ClientReportSectionOverride, ClientReportTextOverrides, ReviewOutcome } from "@/lib/review-outcomes/types";
import { normalizeReviewOutcome } from "@/lib/review-outcomes/model";
import { getProject, saveProject } from "@/lib/projects/store";
import { clientFacingDocumentTitle, outcomeHtml } from "@/lib/outcomes/export-html";
import { prepareFillableClientPdfHtml } from "@/lib/outcomes/fillable-pdf";
import { preparePdfEditorPreviewHtml } from "@/lib/outcomes/pdf-editor-preview";
import { CLIENT_REPORT_EDITABLE_SECTION_TARGETS, INVENTORY_UNASSIGNED_OVERRIDE_KEY } from "@/lib/outcomes/pdf-report-overrides";
import { scheduledPlanningAppointment } from "@/lib/outcomes/planning-appointment";
import { loadCompassDataset, saveCompassDataset } from "@/lib/compass/store";

const FIELD_SEPARATOR = "::";

type EditableField = "title" | "body";

type DefaultCopyMap = Record<string, string>;

function cloneOverrides(value: ClientReportTextOverrides | undefined): ClientReportTextOverrides {
  return value ? JSON.parse(JSON.stringify(value)) as ClientReportTextOverrides : {};
}

function cleanText(value: string | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function copyKey(sectionId: ClientReportEditableSectionId, field: EditableField, locationKey = ""): string {
  return [sectionId, locationKey, field].join(FIELD_SEPARATOR);
}

function inventoryLocationKey(page: HTMLElement | null): string {
  return page?.dataset.inventoryLocation?.trim() || INVENTORY_UNASSIGNED_OVERRIDE_KEY;
}

function sectionHasCopy(section: ClientReportSectionOverride | undefined): boolean {
  if (!section) return false;
  if (cleanText(section.title) || cleanText(section.body)) return true;
  return Boolean(section.locations && Object.values(section.locations).some((item) => cleanText(item.title) || cleanText(item.body)));
}

function normalizeOverrides(value: ClientReportTextOverrides): ClientReportTextOverrides {
  const output: ClientReportTextOverrides = {};
  for (const [rawId, rawSection] of Object.entries(value)) {
    if (!rawSection) continue;
    const id = rawId as ClientReportEditableSectionId;
    const title = cleanText(rawSection.title);
    const body = cleanText(rawSection.body);
    const locations: NonNullable<ClientReportSectionOverride["locations"]> = {};
    for (const [locationKey, rawLocation] of Object.entries(rawSection.locations ?? {})) {
      const locationTitle = cleanText(rawLocation.title);
      const locationBody = cleanText(rawLocation.body);
      if (locationTitle || locationBody) locations[locationKey] = { title: locationTitle || undefined, body: locationBody || undefined };
    }
    const section: ClientReportSectionOverride = {
      title: title || undefined,
      body: body || undefined,
      locations: Object.keys(locations).length ? locations : undefined,
    };
    if (sectionHasCopy(section)) output[id] = section;
  }
  return output;
}

function buildPdfPreview(project: Project, overrides: ClientReportTextOverrides): string {
  const title = clientFacingDocumentTitle(project);
  const finalPdfHtml = prepareFillableClientPdfHtml(outcomeHtml(project), title, overrides);
  return preparePdfEditorPreviewHtml(finalPdfHtml, project);
}

function defaultCopyFromHtml(html: string): DefaultCopyMap {
  if (typeof DOMParser === "undefined") return {};
  const documentRef = new DOMParser().parseFromString(html, "text/html");
  const defaults: DefaultCopyMap = {};

  for (const target of CLIENT_REPORT_EDITABLE_SECTION_TARGETS) {
    const headers = Array.from(documentRef.querySelectorAll<HTMLElement>(target.selector));
    if (target.id === "inventory") {
      const seen = new Set<string>();
      for (const header of headers) {
        const page = header.closest<HTMLElement>(".pdf-inventory-page");
        const locationKey = inventoryLocationKey(page);
        if (seen.has(locationKey)) continue;
        seen.add(locationKey);
        defaults[copyKey(target.id, "title", locationKey)] = cleanText(header.querySelector("h2")?.textContent ?? "");
        defaults[copyKey(target.id, "body", locationKey)] = cleanText(header.querySelector("p")?.textContent ?? "");
      }
      continue;
    }

    const header = headers[0];
    if (!header) continue;
    defaults[copyKey(target.id, "title")] = cleanText(header.querySelector("h2")?.textContent ?? "");
    defaults[copyKey(target.id, "body")] = cleanText(header.querySelector("p")?.textContent ?? "");
  }
  return defaults;
}

function updateOverrideValue(
  current: ClientReportTextOverrides,
  sectionId: ClientReportEditableSectionId,
  field: EditableField,
  value: string,
  defaultValue: string,
  locationKey = "",
): ClientReportTextOverrides {
  const next = cloneOverrides(current);
  const normalized = cleanText(value);
  const isDefault = normalized === cleanText(defaultValue);

  if (sectionId === "inventory") {
    const inventory = { ...(next.inventory ?? {}) };
    const locations = { ...(inventory.locations ?? {}) };
    const location = { ...(locations[locationKey] ?? {}) };
    if (isDefault) delete location[field];
    else location[field] = normalized;
    if (!cleanText(location.title) && !cleanText(location.body)) delete locations[locationKey];
    else locations[locationKey] = location;
    inventory.locations = Object.keys(locations).length ? locations : undefined;
    // Once the WYSIWYG editor touches inventory copy, location-specific values
    // become authoritative and the v1.2.93 global inventory override is retired.
    delete inventory.title;
    delete inventory.body;
    if (sectionHasCopy(inventory)) next.inventory = inventory;
    else delete next.inventory;
    return next;
  }

  const section = { ...(next[sectionId] ?? {}) };
  if (isDefault) delete section[field];
  else section[field] = normalized;
  if (sectionHasCopy(section)) next[sectionId] = section;
  else delete next[sectionId];
  return next;
}

async function syncCompassReviewOutcome(project: Project, outcome: ReviewOutcome): Promise<void> {
  const compassClientId = project.intelligence.facts.find((fact) => fact.key === "compass.clientId")?.value;
  if (typeof compassClientId !== "string" || !compassClientId) return;
  try {
    const dataset = await loadCompassDataset();
    if (!dataset?.clients.some((client) => client.id === compassClientId)) return;
    await saveCompassDataset({
      ...dataset,
      clients: dataset.clients.map((client) => client.id === compassClientId ? { ...client, reviewOutcome: outcome } : client),
    });
  } catch {
    // The local report save is authoritative even if the current Compass snapshot is unavailable.
  }
}

export function ProjectPdfEditorPageClient() {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const defaultsRef = useRef<DefaultCopyMap>({});
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [draftOverrides, setDraftOverrides] = useState<ClientReportTextOverrides>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id")?.trim();
    const loaded = id ? getProject(id) : undefined;
    if (!loaded || loaded.type !== "client-report") {
      setProject(null);
      return;
    }

    const savedOverrides = cloneOverrides(loaded.reviewOutcome?.reportTextOverrides);
    const defaultPreview = buildPdfPreview(loaded, {});
    defaultsRef.current = defaultCopyFromHtml(defaultPreview);
    setProject(loaded);
    setDraftOverrides(savedOverrides);
    setPreviewHtml(buildPdfPreview(loaded, savedOverrides));
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function patchFromDisplayedText(sectionId: ClientReportEditableSectionId, field: EditableField, element: HTMLElement, locationKey = "") {
    const value = cleanText(element.textContent ?? "");
    const defaultValue = defaultsRef.current[copyKey(sectionId, field, locationKey)] ?? "";
    setDraftOverrides((current) => updateOverrideValue(current, sectionId, field, value, defaultValue, locationKey));
    element.dataset.pdfEditDirty = value === cleanText(defaultValue) ? "false" : "true";
    setDirty(true);
    setStatus("Unsaved changes");
  }

  function makeInlineEditable(sectionId: ClientReportEditableSectionId, field: EditableField, element: HTMLElement, locationKey = "") {
    element.dataset.pdfInlineEdit = "true";
    element.dataset.pdfEditSection = sectionId;
    element.dataset.pdfEditField = field;
    element.dataset.pdfEditLocation = locationKey;
    element.contentEditable = "plaintext-only";
    element.spellcheck = true;
    element.setAttribute("role", "textbox");
    element.setAttribute("aria-label", `Edit ${field === "title" ? "heading" : "text"} in ${sectionId.replace(/-/g, " ")}`);

    element.addEventListener("beforeinput", (event) => {
      const input = event as InputEvent;
      if (input.inputType === "insertParagraph" || input.inputType === "insertLineBreak") event.preventDefault();
    });
    element.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain").replace(/\s+/g, " ").trim() ?? "";
      element.ownerDocument.execCommand("insertText", false, text);
    });
    element.addEventListener("input", () => patchFromDisplayedText(sectionId, field, element, locationKey));
  }

  function wireEditablePreview() {
    const documentRef = frameRef.current?.contentDocument;
    if (!documentRef || !project) return;
    const scheduled = Boolean(scheduledPlanningAppointment(project));

    for (const target of CLIENT_REPORT_EDITABLE_SECTION_TARGETS) {
      const headers = Array.from(documentRef.querySelectorAll<HTMLElement>(target.selector));
      if (!headers.length) continue;

      if (target.id === "inventory") {
        const seen = new Set<string>();
        for (const header of headers) {
          const page = header.closest<HTMLElement>(".pdf-inventory-page");
          const locationKey = inventoryLocationKey(page);
          if (seen.has(locationKey)) continue;
          seen.add(locationKey);
          const title = header.querySelector<HTMLElement>("h2");
          const body = header.querySelector<HTMLElement>("p");
          if (title) makeInlineEditable(target.id, "title", title, locationKey);
          if (body) makeInlineEditable(target.id, "body", body, locationKey);
        }
        continue;
      }

      // A scheduled Next Steps page is rewritten by the final PDF capture layer,
      // so keep that generated copy locked rather than pretending an edit would survive.
      if (target.id === "recap" && scheduled) continue;
      const header = headers[0];
      const title = header.querySelector<HTMLElement>("h2");
      const body = header.querySelector<HTMLElement>("p");
      if (title) makeInlineEditable(target.id, "title", title);
      if (body) makeInlineEditable(target.id, "body", body);
    }
  }

  async function saveChanges() {
    if (!project || saving) return;
    setSaving(true);
    setStatus("Saving…");
    const cleaned = normalizeOverrides(draftOverrides);
    const now = new Date().toISOString();
    const outcome = normalizeReviewOutcome({
      ...project.reviewOutcome,
      reportTextOverrides: cleaned,
      lastUpdatedAt: now,
    });
    const nextProject: Project = { ...project, reviewOutcome: outcome, updatedAt: now };
    saveProject(nextProject);
    setProject(nextProject);
    setDraftOverrides(cleaned);
    setDirty(false);
    setSaving(false);
    setStatus("Saved");
    void syncCompassReviewOutcome(nextProject, outcome);
  }

  function resetToDefault() {
    if (!project) return;
    setDraftOverrides({});
    setPreviewHtml(buildPdfPreview(project, {}));
    setDirty(true);
    setStatus("Defaults restored. Save changes to keep the reset.");
  }

  function backToReport() {
    if (!project) return;
    if (dirty && !window.confirm("You have unsaved PDF edits. Leave without saving them?")) return;
    router.push(`/project?id=${encodeURIComponent(project.id)}`);
  }

  if (project === undefined) return <div className="pdf-editor-loading">Preparing exact PDF preview…</div>;
  if (project === null) {
    return <div className="pdf-editor-empty"><span>PDF Editor</span><h1>Client report not found.</h1><p>Open a saved Client Compass technology review, then launch the PDF editor from that report.</p><button type="button" onClick={() => router.push("/")}>Back to Client Compass</button></div>;
  }

  const hasCustomCopy = Object.keys(normalizeOverrides(draftOverrides)).length > 0;

  return (
    <div className="pdf-editor-screen">
      <header className="pdf-editor-toolbar">
        <div className="pdf-editor-toolbar-title">
          <button type="button" className="pdf-editor-back" onClick={backToReport}>← Back to report</button>
          <div><span>PDF Editor</span><h1>{project.client.name || "Technology Health Review"}</h1><p>Edit the wording directly on the PDF pages. Scores, inventory facts, security activity, HIPAA answers, dates, and other source data remain locked.</p></div>
        </div>
        <div className="pdf-editor-toolbar-actions">
          <small className={dirty ? "dirty" : "saved"}>{status || (dirty ? "Unsaved changes" : "Saved version")}</small>
          <button type="button" className="pdf-editor-reset" onClick={resetToDefault} disabled={!hasCustomCopy && !dirty}>Reset to default</button>
          <button type="button" className="pdf-editor-save" onClick={() => void saveChanges()} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </header>
      <div className="pdf-editor-help"><strong>Click highlighted report text to edit it in place.</strong><span>The page size, typography, spacing, pagination, and locked report data mirror the PDF capture view.</span></div>
      <iframe
        ref={frameRef}
        className="pdf-editor-frame"
        title={`Editable PDF preview for ${project.client.name}`}
        srcDoc={previewHtml}
        onLoad={wireEditablePreview}
      />
    </div>
  );
}
