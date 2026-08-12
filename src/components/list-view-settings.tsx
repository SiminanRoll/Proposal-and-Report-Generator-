"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";

export interface ListViewColumn<K extends string> {
  key: K;
  label: string;
  description?: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  defaultVisible?: boolean;
  required?: boolean;
}

type StoredPreference = {
  order?: unknown[];
  visible?: unknown[];
  widths?: Record<string, unknown>;
};

const STORAGE_PREFIX = "client-compass.list-view.v1.";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useListViewPreferences<K extends string>(scope: string, columns: readonly ListViewColumn<K>[]) {
  const keys = useMemo(() => columns.map((column) => column.key), [columns]);
  const byKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const defaults = useMemo(() => ({
    order: [...keys],
    visible: columns.filter((column) => column.required || column.defaultVisible !== false).map((column) => column.key),
    widths: Object.fromEntries(columns.map((column) => [column.key, column.defaultWidth])) as Record<K, number>,
  }), [columns, keys]);

  const [order, setOrder] = useState<K[]>(defaults.order);
  const [visible, setVisible] = useState<K[]>(defaults.visible);
  const [widths, setWidths] = useState<Record<K, number>>(defaults.widths);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragged, setDragged] = useState<K | null>(null);
  const [dragTarget, setDragTarget] = useState<K | null>(null);

  useEffect(() => {
    setReady(false);
    setOrder(defaults.order);
    setVisible(defaults.visible);
    setWidths(defaults.widths);
    try {
      const parsed = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${scope}`) || "null") as StoredPreference | null;
      if (parsed) {
        const validOrder = Array.isArray(parsed.order) ? parsed.order.filter((key): key is K => typeof key === "string" && byKey.has(key as K)) : [];
        const nextOrder = [...validOrder, ...keys.filter((key) => !validOrder.includes(key))];
        const validVisible = Array.isArray(parsed.visible) ? parsed.visible.filter((key): key is K => typeof key === "string" && byKey.has(key as K)) : [];
        const required = columns.filter((column) => column.required).map((column) => column.key);
        const nextVisible = validVisible.length ? [...new Set([...validVisible, ...required])] : defaults.visible;
        const nextWidths = { ...defaults.widths };
        for (const key of keys) {
          const column = byKey.get(key)!;
          const candidate = Number(parsed.widths?.[key]);
          if (Number.isFinite(candidate)) nextWidths[key] = clamp(candidate, column.minWidth ?? 72, column.maxWidth ?? 520);
        }
        setOrder(nextOrder);
        setVisible(nextVisible);
        setWidths(nextWidths);
      }
    } catch {
      // A damaged local preference should never block a list from rendering.
    }
    setSettingsOpen(false);
    setReady(true);
  }, [byKey, columns, defaults.order, defaults.visible, defaults.widths, keys, scope]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(`${STORAGE_PREFIX}${scope}`, JSON.stringify({ order, visible, widths }));
  }, [order, ready, scope, visible, widths]);

  const rendered = useMemo(() => order.filter((key) => visible.includes(key)), [order, visible]);
  const totalWidth = useMemo(() => rendered.reduce((sum, key) => sum + (widths[key] ?? byKey.get(key)?.defaultWidth ?? 120), 0), [byKey, rendered, widths]);
  const gridTemplate = useMemo(() => rendered.map((key) => `${widths[key] ?? byKey.get(key)?.defaultWidth ?? 120}px`).join(" "), [byKey, rendered, widths]);

  const toggle = (key: K) => {
    if (byKey.get(key)?.required) return;
    setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const move = (source: K, target: K) => {
    if (source === target) return;
    setOrder((current) => {
      const sourceIndex = current.indexOf(source);
      const targetIndex = current.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      // Dropping on a column means crossing that column. This makes adjacent
      // rightward moves actually advance instead of being reinserted before
      // the same neighbor, and keeps the visible rank identical to the saved rank.
      const insertAfterTarget = sourceIndex < targetIndex;
      const next = current.filter((key) => key !== source);
      const nextTargetIndex = next.indexOf(target);
      const insertAt = nextTargetIndex < 0 ? next.length : nextTargetIndex + (insertAfterTarget ? 1 : 0);
      next.splice(insertAt, 0, source);
      return next;
    });
  };

  const beginResize = (key: K, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    const column = byKey.get(key);
    if (!column) return;
    const startX = event.clientX;
    const startWidth = widths[key] ?? column.defaultWidth;
    const min = column.minWidth ?? 72;
    const max = column.maxWidth ?? 520;
    document.body.classList.add("is-resizing-list-column");
    const movePointer = (moveEvent: PointerEvent) => {
      const next = clamp(Math.round(startWidth + moveEvent.clientX - startX), min, max);
      setWidths((current) => current[key] === next ? current : { ...current, [key]: next });
    };
    const finish = () => {
      document.body.classList.remove("is-resizing-list-column");
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", movePointer);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  };

  const resetColumn = (key: K) => {
    const next = byKey.get(key)?.defaultWidth;
    if (typeof next !== "number") return;
    setWidths((current) => ({ ...current, [key]: next }));
  };

  const reset = () => {
    setOrder(defaults.order);
    setVisible(defaults.visible);
    setWidths(defaults.widths);
  };

  return {
    columns,
    byKey,
    order,
    visible,
    widths,
    rendered,
    totalWidth,
    gridTemplate,
    settingsOpen,
    setSettingsOpen,
    dragged,
    setDragged,
    dragTarget,
    setDragTarget,
    toggle,
    move,
    beginResize,
    resetColumn,
    reset,
  };
}

export type ListViewPreferenceController<K extends string> = ReturnType<typeof useListViewPreferences<K>>;

export function ListViewSettings<K extends string>({ view, label = "View settings" }: { view: ListViewPreferenceController<K>; label?: string }) {
  return <div className="list-view-settings-shell">
    <button type="button" className={`list-view-settings-trigger${view.settingsOpen ? " is-active" : ""}`} onClick={() => view.setSettingsOpen(!view.settingsOpen)} aria-expanded={view.settingsOpen} aria-label={label} title={label}>
      <span aria-hidden="true">⚙</span>
    </button>
    {view.settingsOpen && <div className="list-view-settings-panel" role="dialog" aria-label={label}>
      <header><div><strong>{label}</strong><small>Choose visible columns and widths here. Column rank can also be changed directly from any table header.</small></div><button type="button" onClick={() => view.setSettingsOpen(false)} aria-label="Close view settings">×</button></header>
      <div className="list-view-settings-columns">
        {view.order.map((key, index) => {
          const column = view.byKey.get(key)!;
          const enabled = view.visible.includes(key);
          return <div
            key={key}
            className={`list-view-settings-column${view.dragTarget === key ? " is-drop-target" : ""}`}
            draggable
            onDragStart={(event) => { view.setDragged(key); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", key); }}
            onDragEnter={(event) => { event.preventDefault(); if (view.dragged && view.dragged !== key) view.setDragTarget(key); }}
            onDragOver={(event) => { if (!view.dragged || view.dragged === key) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
            onDrop={(event) => { event.preventDefault(); if (view.dragged) view.move(view.dragged, key); view.setDragged(null); view.setDragTarget(null); }}
            onDragEnd={() => { view.setDragged(null); view.setDragTarget(null); }}
          >
            <span className="list-view-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
            <span className="list-view-drag-handle" aria-hidden="true">⋮⋮</span>
            <label><input type="checkbox" checked={enabled} disabled={column.required} onChange={() => view.toggle(key)} /><span><b>{column.label}</b><small>{column.description || (column.required ? "Always shown" : "Optional column")}</small></span></label>
            <em>{Math.round(view.widths[key] ?? column.defaultWidth)}px</em>
          </div>;
        })}
      </div>
      <footer><button type="button" onClick={view.reset}>Reset defaults</button><button type="button" className="is-primary" onClick={() => view.setSettingsOpen(false)}>Done</button></footer>
    </div>}
  </div>;
}

export function ListColumnResizeHandle<K extends string>({ column, view }: { column: K; view: ListViewPreferenceController<K> }) {
  const meta = view.byKey.get(column);
  const finishDrag = () => { view.setDragged(null); view.setDragTarget(null); };
  const dropOnColumn = (event: ReactDragEvent<HTMLElement>) => {
    if (!view.dragged || view.dragged === column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    view.setDragTarget(column);
  };

  return <>
    <span
      className={`list-view-column-drag-handle${view.dragged === column ? " is-dragging" : ""}${view.dragTarget === column && view.dragged !== column ? " is-drop-target" : ""}`}
      draggable
      title={`Drag ${meta?.label ?? column} to reorder columns`}
      aria-hidden="true"
      onDragStart={(event) => {
        view.setDragged(column);
        view.setDragTarget(null);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", column);
      }}
      onDragEnter={dropOnColumn}
      onDragOver={dropOnColumn}
      onDrop={(event) => {
        event.preventDefault();
        if (view.dragged) view.move(view.dragged, column);
        finishDrag();
      }}
      onDragEnd={finishDrag}
    >⋮⋮</span>
    <button className="list-view-column-resizer" type="button" aria-label={`Resize ${meta?.label ?? column} column`} title="Drag to resize · double-click to reset this column" onPointerDown={(event) => view.beginResize(column, event)} onDoubleClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      view.resetColumn(column);
    }} />
  </>;
}
