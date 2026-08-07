"use client";

import { useCallback, useEffect, useState } from "react";
import type { SegmentDefinition, SegmentIconName, SegmentRule, SegmentStatId } from "./types";

const STORAGE_KEY = "client-compass.segments.v1";
const CHANGE_EVENT = "client-compass-segments-changed";

const DEFAULT_STATS: SegmentStatId[] = ["replace-now", "managed-assets", "reviews-due"];
const DEFAULT_COLOR = "#7c5cff";
const DEFAULT_ICON: SegmentIconName = "target";

function id(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function newSegmentRule(): SegmentRule {
  return { id: id("rule"), field: "managed-assets", operator: "gte", value: "1" };
}

export function createSegmentDraft(order = 0): SegmentDefinition {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: id("segment"),
    title: "New Segment",
    description: "",
    color: DEFAULT_COLOR,
    icon: DEFAULT_ICON,
    matchMode: "all",
    rules: [newSegmentRule()],
    includeClientIds: [],
    excludeClientIds: [],
    stats: DEFAULT_STATS,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

function validSegment(value: unknown, index: number): SegmentDefinition | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SegmentDefinition>;
  const title = String(row.title || "").trim();
  const segmentId = String(row.id || "").trim();
  if (!segmentId || !title) return null;
  const rules = Array.isArray(row.rules) ? row.rules.filter((rule): rule is SegmentRule => Boolean(rule && typeof rule === "object" && String((rule as SegmentRule).id || ""))) : [];
  return {
    schemaVersion: 1,
    id: segmentId,
    title,
    description: String(row.description || ""),
    color: /^#[0-9a-f]{6}$/i.test(String(row.color || "")) ? String(row.color) : DEFAULT_COLOR,
    icon: (["pin", "server", "users", "building", "target", "shield", "calendar", "spark"] as SegmentIconName[]).includes(row.icon as SegmentIconName) ? row.icon as SegmentIconName : DEFAULT_ICON,
    matchMode: row.matchMode === "any" ? "any" : "all",
    rules,
    includeClientIds: Array.isArray(row.includeClientIds) ? row.includeClientIds.map(String) : [],
    excludeClientIds: Array.isArray(row.excludeClientIds) ? row.excludeClientIds.map(String) : [],
    stats: Array.isArray(row.stats) && row.stats.length ? row.stats.slice(0, 3) as SegmentStatId[] : DEFAULT_STATS,
    order: Number.isFinite(Number(row.order)) ? Number(row.order) : index,
    createdAt: String(row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updatedAt || row.createdAt || new Date().toISOString()),
  };
}

export function loadSegments(): SegmentDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(validSegment).filter((segment): segment is SegmentDefinition => Boolean(segment)).sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
  } catch {
    return [];
  }
}

export function saveSegments(segments: SegmentDefinition[]): void {
  if (typeof window === "undefined") return;
  const normalized = segments.map((segment, index) => ({ ...segment, order: index, updatedAt: segment.updatedAt || new Date().toISOString() }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function upsertSegment(segment: SegmentDefinition): void {
  const current = loadSegments();
  const now = new Date().toISOString();
  const next = current.some((item) => item.id === segment.id)
    ? current.map((item) => item.id === segment.id ? { ...segment, updatedAt: now } : item)
    : [...current, { ...segment, order: current.length, updatedAt: now }];
  saveSegments(next);
}

export function deleteSegment(segmentId: string): void {
  saveSegments(loadSegments().filter((segment) => segment.id !== segmentId));
}

export function moveSegment(segmentId: string, direction: -1 | 1): void {
  const current = loadSegments();
  const index = current.findIndex((segment) => segment.id === segmentId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= current.length) return;
  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  saveSegments(next);
}

export function useSegments(): { segments: SegmentDefinition[]; ready: boolean; refresh: () => void } {
  const [segments, setSegments] = useState<SegmentDefinition[]>([]);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(() => { setSegments(loadSegments()); setReady(true); }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(CHANGE_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);
  return { segments, ready, refresh };
}
