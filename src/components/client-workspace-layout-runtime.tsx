"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useCompassState } from "@/lib/compass/store";

type LayoutKey = "last-review" | "primary-contact" | "tc-sales" | "captains-log" | "company-notes" | "last-quote" | "technology" | "technical-details";
type LayoutSize = "quarter" | "half" | "full";

type LayoutPreference = {
  order: LayoutKey[];
  visible: LayoutKey[];
  sizes: Record<LayoutKey, LayoutSize>;
};

const STORAGE_KEY = "client-compass.company-details-layout.v2";
const LEGACY_STORAGE_KEY = "client-compass.company-details-layout.v1";
const ALL_ITEMS: LayoutKey[] = ["last-review", "primary-contact", "tc-sales", "captains-log", "company-notes", "last-quote", "technology", "technical-details"];
const LABELS: Record<LayoutKey, string> = {
  "last-review": "Last review",
  "primary-contact": "Primary contact",
  "tc-sales": "Last TC sales activity",
  "captains-log": "Captain's Log",
  "company-notes": "Company notes",
  "last-quote": "Last quote",
  technology: "Technology picture & review outcome",
  "technical-details": "Technical details",
};
const DEFAULTS: LayoutPreference = {
  order: [...ALL_ITEMS],
  visible: [...ALL_ITEMS],
  sizes: {
    "last-review": "quarter",
    "primary-contact": "quarter",
    "tc-sales": "quarter",
    "captains-log": "quarter",
    "company-notes": "half",
    "last-quote": "half",
    technology: "full",
    "technical-details": "full",
  },
};

function cleanOrder(value: unknown): LayoutKey[] {
  const input = Array.isArray(value) ? value.filter((item): item is LayoutKey => typeof item === "string" && ALL_ITEMS.includes(item as LayoutKey)) : [];
  return [...new Set([...input, ...ALL_ITEMS])];
}

function cleanVisible(value: unknown): LayoutKey[] {
  if (!Array.isArray(value)) return [...DEFAULTS.visible];
  return value.filter((item): item is LayoutKey => typeof item === "string" && ALL_ITEMS.includes(item as LayoutKey));
}

function cleanSize(value: unknown, fallback: LayoutSize): LayoutSize {
  return value === "quarter" || value === "half" || value === "full" ? value : fallback;
}

function normalizePreference(raw: Record<string, unknown> | null): LayoutPreference {
  if (!raw) return DEFAULTS;
  const legacyOrder = [
    ...(Array.isArray(raw.summaryOrder) ? raw.summaryOrder : []),
    ...(Array.isArray(raw.contextOrder) ? raw.contextOrder : []),
    ...(Array.isArray(raw.sectionOrder) ? raw.sectionOrder : []).filter((item) => item !== "overview"),
  ];
  const legacyVisible = [
    ...(Array.isArray(raw.summaryVisible) ? raw.summaryVisible : []),
    ...(Array.isArray(raw.contextVisible) ? raw.contextVisible : []),
    ...(Array.isArray(raw.sectionVisible) ? raw.sectionVisible : []).filter((item) => item !== "overview"),
  ];
  const sizes = (raw.sizes && typeof raw.sizes === "object" ? raw.sizes : {}) as Record<string, unknown>;
  return {
    order: cleanOrder(raw.order ?? legacyOrder),
    visible: cleanVisible(raw.visible ?? legacyVisible),
    sizes: Object.fromEntries(ALL_ITEMS.map((key) => [key, cleanSize(sizes[key], DEFAULTS.sizes[key])])) as Record<LayoutKey, LayoutSize>,
  };
}

function loadPreference(): LayoutPreference {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizePreference(saved ? JSON.parse(saved) as Record<string, unknown> : null);
  } catch {
    return DEFAULTS;
  }
}

function moveKey(items: readonly LayoutKey[], source: LayoutKey, target: LayoutKey): LayoutKey[] {
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
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime()) / 86_400_000);
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
  const [draggedKey, setDraggedKey] = useState<LayoutKey | null>(null);

  useEffect(() => {
    setPreference(loadPreference());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
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
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const client = useMemo(() => {
    if (!dataset || !clientName) return null;
    const normalized = clientName.trim().toLowerCase();
    return dataset.clients.find((item) => item.name === clientName) ?? dataset.clients.find((item) => item.name.trim().toLowerCase() === normalized) ?? null;
  }, [clientName, dataset]);

  useEffect(() => {
    if (!workspace) return;
    const apply = () => {
      const backdrop = workspace.closest<HTMLElement>(".compass-client-workspace-backdrop");
      const topbarBottom = Math.max(0, Math.ceil(document.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect().bottom ?? 0));
      backdrop?.style.setProperty("--client-workspace-safe-top", `${topbarBottom + 8}px`);

      const scroll = workspace.querySelector<HTMLElement>(".client-review-scroll-v10941");
      const glance = workspace.querySelector<HTMLElement>(".client-review-glance-v10941");
      const notes = workspace.querySelector<HTMLElement>(".client-review-notes-only-v1127");
      const lastReview = glance?.querySelector<HTMLElement>(":scope > article:not(.client-review-latest-activity-v10941):not(.client-review-sales-activity-v1127)") ?? null;
      const contact = glance?.querySelector<HTMLElement>(":scope > .client-review-contact-card-v10941") ?? null;
      const sales = glance?.querySelector<HTMLElement>(":scope > .client-review-sales-activity-v1127") ?? null;
      const captains = glance?.querySelector<HTMLElement>(":scope > .client-review-latest-activity-v10941") ?? null;
      const nodes: Record<LayoutKey, HTMLElement | null> = {
        "last-review": lastReview,
        "primary-contact": contact,
        "tc-sales": sales,
        "captains-log": captains,
        "company-notes": notes?.querySelector<HTMLElement>(".client-review-company-note-v1123") ?? null,
        "last-quote": notes?.querySelector<HTMLElement>(".client-review-quote-card-v1134") ?? null,
        technology: workspace.querySelector<HTMLElement>(".client-review-core-v10941"),
        "technical-details": workspace.querySelector<HTMLElement>(".client-review-technical-details-v10941"),
      };

      scroll?.classList.add("is-unified-company-layout-v1167");
      glance?.classList.add("is-unified-layout-wrapper-v1167");
      notes?.classList.add("is-unified-layout-wrapper-v1167");
      for (const key of ALL_ITEMS) {
        const node = nodes[key];
        if (!node) continue;
        node.dataset.companyLayoutItem = key;
        node.dataset.companyLayoutSize = preference.sizes[key];
        node.style.order = String((preference.order.indexOf(key) + 1) * 10);
        node.classList.toggle("is-company-layout-hidden-v1164", !preference.visible.includes(key));
      }
      const contactOrder = (preference.order.indexOf("primary-contact") + 1) * 10;
      workspace.querySelectorAll<HTMLElement>(".client-review-contact-editor-v10941").forEach((node) => {
        node.style.order = String(contactOrder + 1);
        node.dataset.companyLayoutSize = "full";
      });
      workspace.querySelectorAll<HTMLElement>(".client-review-message-v10941").forEach((node) => {
        node.style.order = String(contactOrder + 2);
        node.dataset.companyLayoutSize = "full";
      });
      const salesLabel = sales?.querySelector<HTMLElement>(":scope > span");
      if (salesLabel && salesLabel.textContent !== "Last TC sales activity") salesLabel.textContent = "Last TC sales activity";
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

  const toggle = (key: LayoutKey) => setPreference((current) => ({
    ...current,
    visible: current.visible.includes(key) ? current.visible.filter((item) => item !== key) : [...current.visible, key],
  }));
  const setSize = (key: LayoutKey, size: LayoutSize) => setPreference((current) => ({ ...current, sizes: { ...current.sizes, [key]: size } }));
  const reset = () => setPreference({ order: [...DEFAULTS.order], visible: [...DEFAULTS.visible], sizes: { ...DEFAULTS.sizes } });

  return <>
    {notesTarget && client && createPortal(<article className="client-review-quote-card-v1134" aria-label="Last quote details">
      <span>Last quote</span><strong>{formatQuoteDate(client.lastQuoteDate)}</strong><div><b>{client.lastQuoteDate ? "Quote recorded" : (client.quoted ? "Quoted" : "No quote")}</b><small>{quoteAge(client.lastQuoteDate)}</small></div>
    </article>, notesTarget)}

    {headerTarget && createPortal(<div className="client-workspace-layout-settings-v1134">
      <button className={`client-workspace-layout-trigger-v1134${settingsOpen ? " is-active" : ""}`} type="button" aria-label="Customize company details layout" title="Customize company details" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><GearIcon /></button>
      {settingsOpen && <div className="client-workspace-layout-panel-v1134" role="dialog" aria-label="Company details layout settings">
        <header><div><strong>Company details layout</strong><small>Drag any item anywhere. Choose quarter, half, or full width.</small></div><button type="button" aria-label="Close layout settings" onClick={() => setSettingsOpen(false)}>×</button></header>
        <div className="client-workspace-layout-groups-v1134">
          <section><h4>All page items</h4>{preference.order.map((key) => <div key={key} className="client-workspace-layout-row-v1134" draggable onDragStart={() => setDraggedKey(key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedKey) setPreference((current) => ({ ...current, order: moveKey(current.order, draggedKey, key) })); setDraggedKey(null); }} onDragEnd={() => setDraggedKey(null)}>
            <span aria-hidden="true">⋮⋮</span><label><input type="checkbox" checked={preference.visible.includes(key)} onChange={() => toggle(key)} />{LABELS[key]}</label><select value={preference.sizes[key]} onChange={(event) => setSize(key, event.target.value as LayoutSize)} aria-label={`${LABELS[key]} size`}><option value="quarter">Quarter</option><option value="half">Half</option><option value="full">Full</option></select>
          </div>)}</section>
        </div>
        <footer><button type="button" onClick={reset}>Reset defaults</button><button className="is-primary" type="button" onClick={() => setSettingsOpen(false)}>Done</button></footer>
      </div>}
    </div>, headerTarget)}
  </>;
}
