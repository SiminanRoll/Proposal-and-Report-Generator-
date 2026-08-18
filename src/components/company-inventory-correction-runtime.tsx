"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  clearCompanyInventoryCorrection,
  companyInventoryCorrectionFor,
  latestDeviceActivity,
  parseCompanyInventorySpreadsheet,
  possiblyInactiveDevice,
  prepareCompanyInventoryCorrection,
  restoreStoredCompanyInventoryCorrections,
  saveCompanyInventoryCorrection,
  type PreparedCompanyInventoryCorrection,
} from "@/lib/compass/company-inventory-correction";
import { buildCompassGeneratorPrefill } from "@/lib/compass/generator-bridge";
import { saveCompassDataset, useCompassState } from "@/lib/compass/store";
import type { CompassClient, CompassConfig, CompassDataset, CompassDevice } from "@/lib/compass/types";
import { withSourceFiles } from "@/lib/projects/factory";
import { getProject, saveProject } from "@/lib/projects/store";
import { projectWithRebuiltIntelligence } from "@/lib/intelligence/client";
import { latestReviewOutcome } from "@/lib/review-outcomes/model";
import { withManualInventory } from "@/lib/outcomes/manual-inventory";

type PortalKind = "inventory" | "client-overview" | "create-report" | "project-report";

interface InventoryPortalTarget {
  key: string;
  kind: PortalKind;
  clientId: string;
  target: HTMLElement;
}

function normalizedCompany(value: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveClientByName(dataset: CompassDataset, value: string): CompassClient | null {
  const normalized = normalizedCompany(value);
  if (!normalized) return null;
  const matches = dataset.clients.filter((client) => normalizedCompany(client.name) === normalized || client.aliases.some((alias) => normalizedCompany(alias) === normalized));
  return matches.length === 1 ? matches[0] : null;
}

function selectedClientWorkspace(dataset: CompassDataset | null): { client: CompassClient; inventoryTarget: HTMLElement | null; overviewTarget: HTMLElement | null; inventorySection: HTMLElement | null } | null {
  if (!dataset) return null;
  const title = document.getElementById("compass-client-workspace-title");
  const client = title?.textContent ? resolveClientByName(dataset, title.textContent) : null;
  if (!client) return null;
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".compass-workspace-section"));
  const inventorySection = sections.find((candidate) => candidate.querySelector("h3")?.textContent?.trim() === "Current device inventory") ?? null;
  const inventoryTarget = inventorySection?.querySelector<HTMLElement>(".compass-workspace-section-heading") ?? null;
  const overviewTarget = document.querySelector<HTMLElement>(".client-review-technical-glance-v10941 .client-review-section-heading-v10941");
  return { client, inventoryTarget, overviewTarget, inventorySection };
}

function createReportClient(dataset: CompassDataset): CompassClient | null {
  if (!window.location.pathname.startsWith("/create")) return null;
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("compassClientId")?.trim() || "";
  if (requestedId) {
    const client = dataset.clients.find((item) => item.id === requestedId);
    if (client) return client;
  }
  const input = document.querySelector<HTMLInputElement>(".create-main input[autofocus]");
  return resolveClientByName(dataset, input?.value || params.get("client") || "");
}

function projectReportClient(dataset: CompassDataset): { client: CompassClient; projectId: string } | null {
  if (!window.location.pathname.startsWith("/project")) return null;
  const projectId = new URLSearchParams(window.location.search).get("id")?.trim() || "";
  if (!projectId) return null;
  const project = getProject(projectId);
  if (!project || project.type !== "client-report") return null;
  const snapshot = project.sources.flatMap((source) => source.files).find((record) => record.mimeType === "application/x-client-compass-snapshot");
  const snapshotClientId = snapshot ? String(snapshot.analysis?.facts.find((item) => item.key === "compass.clientId")?.value ?? snapshot.id.replace(/^compass-source-/, "")) : "";
  const client = dataset.clients.find((item) => item.id === snapshotClientId) ?? resolveClientByName(dataset, project.client.name);
  return client ? { client, projectId } : null;
}

function decoratePossiblyInactiveDevices(section: HTMLElement, devices: CompassDevice[], config: CompassConfig): void {
  const byName = new Map<string, CompassDevice[]>();
  for (const device of devices) {
    const key = device.name.trim().toLowerCase();
    if (!key) continue;
    const values = byName.get(key) ?? [];
    values.push(device);
    byName.set(key, values);
  }
  const seen = new Map<string, number>();
  for (const row of Array.from(section.querySelectorAll<HTMLTableRowElement>(".compass-inventory-table tbody tr"))) {
    const name = row.querySelector("td strong")?.textContent?.trim().toLowerCase() || "";
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    const device = byName.get(name)?.[index] ?? byName.get(name)?.[0];
    const stale = Boolean(device && possiblyInactiveDevice(device, config));
    row.classList.toggle("company-inventory-possibly-inactive", stale);
    const checkInCell = row.cells[row.cells.length - 1] as HTMLTableCellElement | undefined;
    if (!checkInCell) continue;
    let badge = checkInCell.querySelector<HTMLElement>(".company-inventory-stale-badge");
    if (!stale) {
      badge?.remove();
      continue;
    }
    const lastActivity = device ? latestDeviceActivity(device) : null;
    const lastActivityCopy = lastActivity
      ? ` Last recorded activity: ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(lastActivity)}.`
      : "";
    const title = `No recorded check-in for at least ${config.thresholds.staleDeviceMonths} months. Verify whether this device is still active or in use.${lastActivityCopy}`;
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "company-inventory-stale-badge";
      checkInCell.appendChild(badge);
    }
    badge.textContent = "Possibly inactive";
    badge.title = title;
  }
}

function formatReferenceDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Manual reference" : `Manual reference · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
}

async function refreshOpenReportProject(dataset: CompassDataset, clientId: string): Promise<void> {
  if (!window.location.pathname.startsWith("/project")) return;
  const projectId = new URLSearchParams(window.location.search).get("id")?.trim() || "";
  if (!projectId) return;
  const project = getProject(projectId);
  if (!project || project.type !== "client-report") return;
  const prefill = buildCompassGeneratorPrefill(dataset, clientId);
  const refreshed = prefill?.sourceRecords["scalepad-pdf"]?.[0];
  if (!prefill || !refreshed) return;
  const connected = project.sources.flatMap((source) => source.files).find((record) => record.mimeType === "application/x-client-compass-snapshot");
  if (!connected) return;
  const nextReviewOutcome = latestReviewOutcome(project.reviewOutcome, prefill.reviewOutcome);
  const nextSources = project.sources.map((source) => withSourceFiles(source, source.files.map((record) => record.id === connected.id ? { ...refreshed, id: record.id } : record)));
  const rebuiltSources = projectWithRebuiltIntelligence({
    ...project,
    reviewOutcome: nextReviewOutcome,
    sources: nextSources,
    findings: [],
    recommendations: [],
    presentation: { ...project.presentation, executiveSummary: "" },
  });
  const rebuilt = project.manualInventory ? withManualInventory(rebuiltSources, project.manualInventory.devices) : rebuiltSources;
  saveProject(rebuilt);
}

function CompanyInventoryControl({
  client,
  dataset,
  config,
  refresh,
  compact = false,
  onSaved,
}: {
  client: CompassClient;
  dataset: CompassDataset;
  config: CompassConfig;
  refresh: () => Promise<void>;
  compact?: boolean;
  onSaved?: (prepared: PreparedCompanyInventoryCorrection) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PreparedCompanyInventoryCorrection | null>(null);
  const [correction, setCorrection] = useState(() => companyInventoryCorrectionFor(client.id));
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCorrection(companyInventoryCorrectionFor(client.id));
    setPending(null);
    setError("");
  }, [client.id, client.lastDataRefresh, dataset.calculatedAt]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const staleCount = useMemo(
    () => dataset.devices.filter((device) => device.clientId === client.id && possiblyInactiveDevice(device, config)).length,
    [client.id, config, dataset.devices],
  );

  const chooseFile = () => {
    setError("");
    inputRef.current?.click();
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const parsed = await parseCompanyInventorySpreadsheet(file, client.name);
      const prepared = prepareCompanyInventoryCorrection(dataset, client.id, parsed, config);
      setPending(prepared);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The inventory file could not be prepared.");
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    try {
      saveCompanyInventoryCorrection(pending.snapshot);
      await saveCompassDataset(pending.dataset);
      await refresh();
      setCorrection(pending.snapshot);
      setPending(null);
      setToast(`${pending.deviceCount} devices saved as ${client.name}'s inventory reference.`);
      await onSaved?.(pending);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The company inventory correction could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const releaseReference = async () => {
    if (!correction || busy) return;
    const confirmed = window.confirm(`Release the manual inventory reference for ${client.name}? The current inventory will remain visible until the next source refresh, but future full imports will be allowed to replace it.`);
    if (!confirmed) return;
    clearCompanyInventoryCorrection(client.id);
    setCorrection(null);
    setToast("Manual reference released. Future inventory refreshes can replace it.");
  };

  return <>
    <div className={`company-inventory-correction-controls${compact ? " is-compact" : ""}`}>
      {!compact && staleCount > 0 && <span className="company-inventory-stale-count" title={`Verify ${staleCount} device${staleCount === 1 ? "" : "s"} with no recorded check-in for at least ${config.thresholds.staleDeviceMonths} months.`}>{staleCount} possibly inactive</span>}
      {!compact && correction && <span className="company-inventory-reference-chip" title={`${correction.sourceName}${correction.sourceOrganization ? ` · ${correction.sourceOrganization}` : ""}`}>{formatReferenceDate(correction.updatedAt)}</span>}
      <button className="company-inventory-import-button" type="button" disabled={busy} onClick={chooseFile}>{busy ? "Preparing…" : correction ? (compact ? "Replace inventory" : "Replace reference") : "Import inventory"}</button>
      {!compact && correction && <button className="company-inventory-release-button" type="button" disabled={busy} onClick={() => void releaseReference()}>Release</button>}
      <input ref={inputRef} className="company-inventory-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void onFile(event)} />
    </div>
    {error && <div className="company-inventory-correction-error" role="alert">{error}</div>}
    {toast && createPortal(<div className="company-inventory-correction-toast" role="status">{toast}</div>, document.body)}
    {pending && createPortal(<div className="company-inventory-confirm-backdrop" role="presentation" onMouseDown={() => !busy && setPending(null)}>
      <section className="company-inventory-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="company-inventory-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <span>Company inventory correction</span>
        <h2 id="company-inventory-confirm-title">Use {pending.deviceCount} devices as the reference for {client.name}?</h2>
        <p>This replaces only this company's inventory. The correction stays in place during later full inventory refreshes until you release it.</p>
        <div className="company-inventory-confirm-meta">
          <article><span>Source file</span><strong>{pending.snapshot.sourceName}</strong></article>
          <article><span>Source organization</span><strong>{pending.sourceOrganization || client.name}</strong></article>
        </div>
        <footer><button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button><button className="primary" type="button" disabled={busy} onClick={() => void confirmImport()}>{busy ? "Saving…" : "Save inventory reference"}</button></footer>
      </section>
    </div>, document.body)}
  </>;
}

export function CompanyInventoryCorrectionRuntime() {
  const { dataset, config, ready, refresh } = useCompassState();
  const restoring = useRef(false);
  const [portals, setPortals] = useState<InventoryPortalTarget[]>([]);

  useEffect(() => {
    if (!ready || !dataset || restoring.current) return;
    const restored = restoreStoredCompanyInventoryCorrections(dataset, config);
    if (!restored.changed) return;
    restoring.current = true;
    void (async () => {
      try {
        await saveCompassDataset(restored.dataset);
        await refresh();
      } finally {
        restoring.current = false;
      }
    })();
  }, [config, dataset, ready, refresh]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const scan = () => {
      frame = 0;
      if (!dataset) {
        setPortals([]);
        return;
      }
      const next: InventoryPortalTarget[] = [];
      const selected = selectedClientWorkspace(dataset);
      if (selected) {
        const clientDevices = dataset.devices.filter((device) => device.clientId === selected.client.id);
        if (selected.inventorySection) decoratePossiblyInactiveDevices(selected.inventorySection, clientDevices, config);
        if (selected.inventoryTarget) next.push({ key: `inventory:${selected.client.id}`, kind: "inventory", clientId: selected.client.id, target: selected.inventoryTarget });
        if (selected.overviewTarget) next.push({ key: `overview:${selected.client.id}`, kind: "client-overview", clientId: selected.client.id, target: selected.overviewTarget });
      }

      const createClient = createReportClient(dataset);
      const createTarget = document.querySelector<HTMLElement>(".generator-prefill-banner") ?? document.querySelector<HTMLElement>(".create-hero");
      if (createClient && createTarget) next.push({ key: `create:${createClient.id}`, kind: "create-report", clientId: createClient.id, target: createTarget });

      const projectContext = projectReportClient(dataset);
      const projectTarget = document.querySelector<HTMLElement>(".report-workspace-header") ?? document.querySelector<HTMLElement>(".workspace-header-actions");
      if (projectContext && projectTarget) next.push({ key: `project:${projectContext.client.id}`, kind: "project-report", clientId: projectContext.client.id, target: projectTarget });

      setPortals((current) => {
        const same = current.length === next.length && current.every((item, index) => item.key === next[index]?.key && item.target === next[index]?.target);
        return same ? current : next;
      });
    };
    const requestScan = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(scan);
    };
    const observer = new MutationObserver(requestScan);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", requestScan, true);
    requestScan();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", requestScan, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [config, dataset, ready]);

  if (!dataset || !portals.length) return null;
  return <>{portals.map((portal) => {
    const client = dataset.clients.find((item) => item.id === portal.clientId);
    if (!client || !document.body.contains(portal.target)) return null;
    const compact = portal.kind !== "inventory";
    const onSaved = portal.kind === "create-report"
      ? async () => { window.setTimeout(() => window.location.reload(), 250); }
      : portal.kind === "project-report"
        ? async (prepared: PreparedCompanyInventoryCorrection) => {
            await refreshOpenReportProject(prepared.dataset, client.id);
            window.setTimeout(() => window.location.reload(), 250);
          }
        : undefined;
    return createPortal(<CompanyInventoryControl client={client} dataset={dataset} config={config} refresh={refresh} compact={compact} onSaved={onSaved} />, portal.target, portal.key);
  })}</>;
}
