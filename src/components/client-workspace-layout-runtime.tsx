"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useCompassState } from "@/lib/compass/store";

type SummaryKey = "last-review" | "primary-contact" | "tc-sales" | "captains-log";
type ContextKey = "company-notes" | "last-quote";
type SectionKey = "overview" | "technology" | "technical-details";

type LayoutPreference = {
  summaryOrder: SummaryKey[];
  summaryVisible: SummaryKey[];
  contextOrder: ContextKey[];
  contextVisible: ContextKey[];
  sectionOrder: SectionKey[];
  sectionVisible: SectionKey[];
};

const STORAGE_KEY = "client-compass.company-details-layout.v1";
const DEFAULTS: LayoutPreference = {
  summaryOrder: ["last-review", "primary-contact", "tc-sales", "captains-log"],
  summaryVisible: ["last-review", "primary-contact", "tc-sales", "captains-log"],
  contextOrder: ["company-notes", "last-quote"],
  contextVisible: ["company-notes", "last-quote"],
  sectionOrder: ["overview", "technology", "technical-details"],
  sectionVisible: ["overview", "technology", "technical-details"],
};

const SUMMARY_LABELS: Record<SummaryKey, string> = {
  "last-review": "Last review",
  "primary-contact": "Primary contact",
  "tc-sales": "Last TC sales activity",
  "captains-log": "Captain's Log",
};
const CONTEXT_LABELS: Record<ContextKey, string> = {
  "company-notes": "Company notes",
  "last-quote": "Last quote",
};
const SECTION_LABELS: Record<SectionKey, string> = {
  overview: "Overview",
  technology: "Technology picture & review outcome",
  "technical-details": "Technical details",
};

function cleanOrder<K extends string>(value: unknown, allowed: readonly K[], fallback: readonly K[]): K[] {
  const input = Array.isArray(value) ? value.filter((item): item is K => typeof item === "string" && allowed.includes(item as K)) : [];
  return [...new Set([...input, ...fallback])];
}

function cleanVisible<K extends string>(value: unknown, allowed: readonly K[], fallback: readonly K[]): K[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((item): item is K => typeof item === "string" && allowed.includes(item as K));
}

function loadPreference(): LayoutPreference {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<LayoutPreference> | null;
    if (!raw) return DEFAULTS;
    return {
      summaryOrder: cleanOrder(raw.summaryOrder, DEFAULTS.summaryOrder, DEFAULTS.summaryOrder),
      summaryVisible: cleanVisible(raw.summaryVisible, DEFAULTS.summaryOrder, DEFAULTS.summaryVisible),
      contextOrder: cleanOrder(raw.contextOrder, DEFAULTS.contextOrder, DEFAULTS.contextOrder),
      contextVisible: cleanVisible(raw.contextVisible, DEFAULTS.contextOrder, DEFAULTS.contextVisible),
      sectionOrder: cleanOrder(raw.sectionOrder, DEFAULTS.sectionOrder, DEFAULTS.sectionOrder),
      sectionVisible: cleanVisible(raw.sectionVisible, DEFAULTS.sectionOrder, DEFAULTS.sectionVisible),
    };
  } catch {
    return DEFAULTS;
  }
}

function moveKey<K extends string>(items: readonly K[], source: K, target: K): K[] {
  if (source === target) return [...items];
  const next = items.filter((item) => item !== source);
  const targetIndex = next.indexOf(target);
  next.splice(targetIndex < 0 ? next.length : targetIndex, 0, source);
  return next;
}

function formatQuoteDate(value: string): string {
  if (!value) return "Not recorded";
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function quoteAge(value: string): string {
  if (!value) return "No quote date recorded";
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Quote date needs review";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const days = Math.round((start.getTime() - candidate.getTime()) / 86_400_000);
  if (days < 0) return `Future date · ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ahead`;
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function GearIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05-2.86 2.86-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.05.05-2.86-2.86.05-.05A1.7 1.7 0 0 0 3.75 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.55h.05a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05 2.86-2.86.05.05A1.7 1.7 0 0 0 8.15 3.75a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4.05v.05a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.05-.05 2.86 2.86-.05.05A1.7 1.7 0 0 0 19.4 8.15c.13.38.34.72.6 1 .29.25.67.39 1.1.4h.1v4.05h-.1c-.43.01-.81.15-1.1.4-.26.28-.47.62-.6 1Z"/></svg>;
}

export function ClientWorkspaceLayoutRuntime() {
  const { dataset } = useCompassState();
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [notesTarget, setNotesTarget] = useState<HTMLElement | null>(null);
  const [clientName, setClientName] = useState("");
  const [preference, setPreference] = useState<LayoutPreference>(() => DEFAULTS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedSummary, setDraggedSummary] = useState<SummaryKey | null>(null);
  const [draggedContext, setDraggedContext] = useState<ContextKey | null>(null);
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);

  useEffect(() => {
    setPreference(loadPreference());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  }, [preference, ready]);

  useEffect(() => {
    const syncTargets = () => {
      const nextWorkspace = document.querySelector<HTMLElement>(".compass-client-review-workspace-v10941");
      const nextHeader = nextWorkspace?.querySelector<HTMLElement>(".client-review-header-actions-v10941") ?? null;
      const nextNotes = nextWorkspace?.querySelector<HTMLElement>(".client-review-notes-only-v1127") ?? null;
      const nextName = nextWorkspace?.querySelector<HTMLElement>("#compass-client-workspace-title")?.textContent?.trim() ?? "";
      setWorkspace((current) => current === nextWorkspace ? current : nextWorkspace);
      setHeaderTarget((current) => current === nextHeader ? current : nextHeader);
      setNotesTarget((current) => current === nextNotes ? current : nextNotes);
      setClientName((current) => current === nextName ? current : nextName);
      if (!nextWorkspace) setSettingsOpen(false);
    };
    syncTargets();
    const timer = window.setInterval(syncTargets, 300);
    return () => window.clearInterval(timer);
  }, []);

  const client = useMemo(() => {
    if (!dataset || !clientName) return null;
    const normalized = clientName.toLowerCase();
    return dataset.clients.find((item) => item.name === clientName) ?? dataset.clients.find((item) => item.name.trim().toLowerCase() === normalized) ?? null;
  }, [clientName, dataset]);

  useEffect(() => {
    if (!workspace) return;
    const apply = () => {
      const backdrop = workspace.closest<HTMLElement>(".compass-client-workspace-backdrop");
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const topbarBottom = Math.max(0, Math.ceil(topbar?.getBoundingClientRect().bottom ?? 0));
      backdrop?.style.setProperty("--client-workspace-safe-top", `${topbarBottom + 8}px`);

      const scroll = workspace.querySelector<HTMLElement>(".client-review-scroll-v10941");
      const glance = workspace.querySelector<HTMLElement>(".client-review-glance-v10941");
      const technology = workspace.querySelector<HTMLElement>(".client-review-core-v10941");
      const technical = workspace.querySelector<HTMLElement>(".client-review-technical-details-v10941");
      scroll?.classList.add("is-custom-company-layout-v1134");

      const sectionNodes: Record<SectionKey, HTMLElement | null> = { overview: glance, technology, "technical-details": technical };
      for (const key of DEFAULTS.sectionOrder) {
        const node = sectionNodes[key];
        if (!node) continue;
        const visible = preference.sectionVisible.includes(key);
        node.style.order = String((preference.sectionOrder.indexOf(key) + 1) * 10);
        node.style.removeProperty("display");
        node.classList.toggle("is-company-layout-hidden-v1164", !visible);
      }
      const overviewOrder = (preference.sectionOrder.indexOf("overview") + 1) * 10;
      workspace.querySelectorAll<HTMLElement>(".client-review-contact-editor-v10941").forEach((node) => { node.style.order = String(overviewOrder + 1); });
      workspace.querySelectorAll<HTMLElement>(".client-review-message-v10941").forEach((node) => { node.style.order = String(overviewOrder + 2); });

      if (glance) {
        const lastReview = glance.querySelector<HTMLElement>(":scope > article:not(.client-review-latest-activity-v10941):not(.client-review-sales-activity-v1127)");
        const contact = glance.querySelector<HTMLElement>(":scope > .client-review-contact-card-v10941");
        const sales = glance.querySelector<HTMLElement>(":scope > .client-review-sales-activity-v1127");
        const captains = glance.querySelector<HTMLElement>(":scope > .client-review-latest-activity-v10941");
        const summaryNodes: Record<SummaryKey, HTMLElement | null> = { "last-review": lastReview, "primary-contact": contact, "tc-sales": sales, "captains-log": captains };
        for (const key of DEFAULTS.summaryOrder) {
          const node = summaryNodes[key];
          if (!node) continue;
          const visible = preference.summaryVisible.includes(key);
          node.dataset.companySummaryCard = key;
          node.style.order = String(preference.summaryOrder.indexOf(key) + 1);
          node.style.removeProperty("display");
          node.classList.toggle("is-company-layout-hidden-v1164", !visible);
        }
        const salesLabel = sales?.querySelector<HTMLElement>(":scope > span");
        if (salesLabel && salesLabel.textContent !== "Last TC sales activity") salesLabel.textContent = "Last TC sales activity";
      }

      const notesSection = workspace.querySelector<HTMLElement>(".client-review-notes-only-v1127");
      if (notesSection) {
        notesSection.style.order = "100";
        const noteCard = notesSection.querySelector<HTMLElement>(".client-review-company-note-v1123");
        const quoteCard = notesSection.querySelector<HTMLElement>(".client-review-quote-card-v1134");
        const contextNodes: Record<ContextKey, HTMLElement | null> = { "company-notes": noteCard, "last-quote": quoteCard };
        let visibleCount = 0;
        for (const key of DEFAULTS.contextOrder) {
          const node = contextNodes[key];
          if (!node) continue;
          const visible = preference.contextVisible.includes(key);
          node.style.order = String(preference.contextOrder.indexOf(key) + 1);
          node.style.removeProperty("display");
          node.classList.toggle("is-company-layout-hidden-v1164", !visible);
          if (visible) visibleCount += 1;
        }
        notesSection.dataset.contextCount = String(visibleCount);
        notesSection.style.removeProperty("display");
        notesSection.classList.toggle("is-company-layout-hidden-v1164", visibleCount === 0);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(workspace, { childList: true, subtree: true });
    const topbar = document.querySelector<HTMLElement>(".topbar");
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (topbar && resizeObserver) resizeObserver.observe(topbar);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [preference, workspace]);

  const toggle = <K extends SummaryKey | ContextKey | SectionKey>(field: "summaryVisible" | "contextVisible" | "sectionVisible", key: K) => {
    setPreference((current) => {
      const values = current[field] as string[];
      const next = values.includes(key) ? values.filter((item) => item !== key) : [...values, key];
      return { ...current, [field]: next } as LayoutPreference;
    });
  };

  const reset = () => setPreference({
    summaryOrder: [...DEFAULTS.summaryOrder],
    summaryVisible: [...DEFAULTS.summaryVisible],
    contextOrder: [...DEFAULTS.contextOrder],
    contextVisible: [...DEFAULTS.contextVisible],
    sectionOrder: [...DEFAULTS.sectionOrder],
    sectionVisible: [...DEFAULTS.sectionVisible],
  });

  return <>
    {notesTarget && client && createPortal(<article className="client-review-quote-card-v1134" aria-label="Last quote details">
      <span>Last quote</span>
      <strong>{formatQuoteDate(client.lastQuoteDate)}</strong>
      <div><b>{client.lastQuoteDate ? "Quote recorded" : (client.quoted ? "Quoted" : "No quote")}</b><small>{quoteAge(client.lastQuoteDate)}</small></div>
    </article>, notesTarget)}

    {headerTarget && createPortal(<div className="client-workspace-layout-settings-v1134">
      <button className={`client-workspace-layout-trigger-v1134${settingsOpen ? " is-active" : ""}`} type="button" aria-label="Customize company details layout" title="Customize company details" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><GearIcon /></button>
      {settingsOpen && <div className="client-workspace-layout-panel-v1134" role="dialog" aria-label="Company details layout settings">
        <header><div><strong>Company details layout</strong><small>Choose what appears and drag items into your preferred order.</small></div><button type="button" aria-label="Close layout settings" onClick={() => setSettingsOpen(false)}>×</button></header>
        <div className="client-workspace-layout-groups-v1134">
          <section><h4>Summary cards</h4>{preference.summaryOrder.map((key) => <div key={key} className="client-workspace-layout-row-v1134" draggable onDragStart={() => setDraggedSummary(key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedSummary) setPreference((current) => ({ ...current, summaryOrder: moveKey(current.summaryOrder, draggedSummary, key) })); setDraggedSummary(null); }} onDragEnd={() => setDraggedSummary(null)}><span aria-hidden="true">⋮⋮</span><label><input type="checkbox" checked={preference.summaryVisible.includes(key)} onChange={() => toggle("summaryVisible", key)} />{SUMMARY_LABELS[key]}</label></div>)}</section>
          <section><h4>Context cards</h4>{preference.contextOrder.map((key) => <div key={key} className="client-workspace-layout-row-v1134" draggable onDragStart={() => setDraggedContext(key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedContext) setPreference((current) => ({ ...current, contextOrder: moveKey(current.contextOrder, draggedContext, key) })); setDraggedContext(null); }} onDragEnd={() => setDraggedContext(null)}><span aria-hidden="true">⋮⋮</span><label><input type="checkbox" checked={preference.contextVisible.includes(key)} onChange={() => toggle("contextVisible", key)} />{CONTEXT_LABELS[key]}</label></div>)}</section>
          <section><h4>Page sections</h4>{preference.sectionOrder.map((key) => <div key={key} className="client-workspace-layout-row-v1134" draggable onDragStart={() => setDraggedSection(key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedSection) setPreference((current) => ({ ...current, sectionOrder: moveKey(current.sectionOrder, draggedSection, key) })); setDraggedSection(null); }} onDragEnd={() => setDraggedSection(null)}><span aria-hidden="true">⋮⋮</span><label><input type="checkbox" checked={preference.sectionVisible.includes(key)} onChange={() => toggle("sectionVisible", key)} />{SECTION_LABELS[key]}</label></div>)}</section>
        </div>
        <footer><button type="button" onClick={reset}>Reset defaults</button><button className="is-primary" type="button" onClick={() => setSettingsOpen(false)}>Done</button></footer>
      </div>}
    </div>, headerTarget)}
  </>;
}
