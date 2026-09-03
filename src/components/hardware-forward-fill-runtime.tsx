"use client";

import { useEffect } from "react";
import { forwardFillMissingHardware } from "@/lib/compass/hardware-forward-fill";
import { loadCompassDataset } from "@/lib/compass/store";
import type { CompassDataset, CompassDevice } from "@/lib/compass/types";
import { withManualInventory } from "@/lib/outcomes/manual-inventory";
import { getProject, saveProject } from "@/lib/projects/store";
import type { Project, ProjectManualInventoryDevice } from "@/lib/projects/types";

const CORRECTION_KEY = "client-compass.company-inventory-corrections.v1";
const CHANGE_EVENT = "client-compass-data-changed";
const DATABASE_NAME = "client-compass";
const DATABASE_VERSION = 1;
const DATASET_STORE = "current-state";
const RECOVERY_KEY = "recovery-dataset";

type StoredCorrection = {
  clientId: string;
  devices: CompassDevice[];
  [key: string]: unknown;
};

type CorrectionStore = Record<string, StoredCorrection>;

function isDataset(value: unknown): value is CompassDataset {
  const dataset = value as CompassDataset | null;
  return Boolean(dataset?.schemaVersion === 1 && Array.isArray(dataset.clients) && Array.isArray(dataset.devices));
}

function readRecoveryDataset(): Promise<CompassDataset | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const database = request.result;
      try {
        const transaction = database.transaction(DATASET_STORE, "readonly");
        const record = transaction.objectStore(DATASET_STORE).get(RECOVERY_KEY);
        record.onsuccess = () => {
          const result = isDataset(record.result) ? record.result : null;
          database.close();
          resolve(result);
        };
        record.onerror = () => {
          database.close();
          resolve(null);
        };
      } catch {
        database.close();
        resolve(null);
      }
    };
  });
}

function correctionStore(): CorrectionStore {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CORRECTION_KEY) || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as CorrectionStore;
  } catch {
    return {};
  }
}

function clientDevices(clientId: string, current: CompassDataset, recovery: CompassDataset | null): CompassDevice[] {
  return [
    ...(recovery?.devices ?? []).filter((device) => device.clientId === clientId),
    ...current.devices.filter((device) => device.clientId === clientId),
  ];
}

function upgradeStoredCorrections(current: CompassDataset, recovery: CompassDataset | null): boolean {
  const store = correctionStore();
  let changed = false;
  for (const [clientId, snapshot] of Object.entries(store)) {
    if (!snapshot || !Array.isArray(snapshot.devices)) continue;
    const fresh = clientDevices(clientId, current, recovery);
    if (!fresh.length) continue;
    const devices = forwardFillMissingHardware(snapshot.devices, fresh) as CompassDevice[];
    if (JSON.stringify(devices) === JSON.stringify(snapshot.devices)) continue;
    store[clientId] = { ...snapshot, devices };
    changed = true;
  }
  if (changed) window.localStorage.setItem(CORRECTION_KEY, JSON.stringify(store));
  return changed;
}

function projectClientId(project: Project): string {
  const connected = project.sources
    .flatMap((source) => source.files)
    .find((record) => record.mimeType === "application/x-client-compass-snapshot");
  if (!connected) return "";
  return String(
    connected.analysis?.facts.find((item) => item.key === "compass.clientId")?.value
      ?? connected.id.replace(/^compass-source-/, ""),
  ).trim();
}

function upgradeOpenProject(current: CompassDataset, recovery: CompassDataset | null): boolean {
  if (!window.location.pathname.startsWith("/project")) return false;
  const projectId = new URLSearchParams(window.location.search).get("id")?.trim() || "";
  if (!projectId) return false;
  const project = getProject(projectId);
  if (!project || project.type !== "client-report" || !project.manualInventory?.devices.length) return false;
  const clientId = projectClientId(project);
  if (!clientId) return false;
  const fresh = clientDevices(clientId, current, recovery);
  if (!fresh.length) return false;

  const devices = forwardFillMissingHardware(project.manualInventory.devices, fresh) as ProjectManualInventoryDevice[];
  if (JSON.stringify(devices) === JSON.stringify(project.manualInventory.devices)) return false;
  saveProject(withManualInventory(project, devices));
  return true;
}

/**
 * Older durable inventory references can predate newly imported Ninja hardware
 * fields. Recover only missing hardware from the current/recovery Ninja record,
 * preserving every nonblank manual value. The recovery dataset matters because
 * a durable company correction may already have overwritten the just-imported
 * current snapshot before this migration gets a chance to run.
 */
export function HardwareForwardFillRuntime() {
  useEffect(() => {
    let disposed = false;
    let running = false;

    const run = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const [current, recovery] = await Promise.all([loadCompassDataset(), readRecoveryDataset()]);
        if (!current || disposed) return;
        const correctionChanged = upgradeStoredCorrections(current, recovery);
        const projectChanged = upgradeOpenProject(current, recovery);
        if (correctionChanged) window.dispatchEvent(new Event("storage"));
        if (projectChanged && !disposed) window.setTimeout(() => window.location.reload(), 80);
      } finally {
        running = false;
      }
    };

    const handleChange = () => { void run(); };
    void run();
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      disposed = true;
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  return null;
}
