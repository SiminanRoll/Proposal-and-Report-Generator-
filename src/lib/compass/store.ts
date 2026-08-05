"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COMPASS_CONFIG, normalizeCompassConfig } from "./config";
import type { CompassConfig, CompassDataset } from "./types";

const DATASET_KEY = "client-compass.current-dataset.v1";
const CONFIG_KEY = "client-compass.configuration.v1";
const CHANGE_EVENT = "client-compass-data-changed";

function parseDataset(raw: string | null): CompassDataset | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CompassDataset;
    return value?.schemaVersion === 1 && Array.isArray(value.clients) && Array.isArray(value.devices) ? value : null;
  } catch { return null; }
}

export function loadCompassDataset(): CompassDataset | null {
  if (typeof window === "undefined") return null;
  return parseDataset(window.localStorage.getItem(DATASET_KEY));
}

export function saveCompassDataset(dataset: CompassDataset): void {
  window.localStorage.setItem(DATASET_KEY, JSON.stringify(dataset));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function loadCompassConfig(): CompassConfig {
  if (typeof window === "undefined") return structuredClone(DEFAULT_COMPASS_CONFIG);
  try { return normalizeCompassConfig(JSON.parse(window.localStorage.getItem(CONFIG_KEY) || "null")); }
  catch { return structuredClone(DEFAULT_COMPASS_CONFIG); }
}

export function saveCompassConfig(config: CompassConfig): void {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(normalizeCompassConfig(config)));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCompassState(): { dataset: CompassDataset | null; config: CompassConfig; refresh: () => void } {
  const [dataset, setDataset] = useState<CompassDataset | null>(null);
  const [config, setConfig] = useState<CompassConfig>(structuredClone(DEFAULT_COMPASS_CONFIG));
  const refresh = useCallback(() => { setDataset(loadCompassDataset()); setConfig(loadCompassConfig()); }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(CHANGE_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);
  return { dataset, config, refresh };
}
