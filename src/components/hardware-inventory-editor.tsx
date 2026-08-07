"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Project, ProjectManualInventoryDevice } from "@/lib/projects/types";
import { inventoryReportDevices } from "@/lib/outcomes/client-report-data";

function fromProject(project: Project): ProjectManualInventoryDevice[] {
  return inventoryReportDevices(project).map((device, index) => ({
    id: device.sourceDeviceId || `inventory-${index + 1}`,
    type: device.type,
    name: device.name,
    user: device.user || "",
    lastCheckIn: device.lastCheckIn || "",
    make: device.make || "",
    serial: device.serial || "",
    model: device.model || "",
    os: device.os || "",
    age: Number(device.age || 0),
    purchased: device.purchased || "",
    warrantyExpires: device.warrantyExpires || "",
    ram: device.ram || "",
    cpu: device.cpu || "",
    storage: device.storage || "",
    storageUsage: device.storageUsage || "",
    storagePercent: Number(device.storagePercent || 0),
    storageFreeGb: Number(device.storageFreeGb || 0),
    graphics: device.graphics || "",
    location: device.location || "",
    lifecycleStatus: device.lifecycleStatus,
  }));
}

function blankDevice(index: number): ProjectManualInventoryDevice {
  return {
    id: `manual-${Date.now()}-${index}`,
    type: "workstation",
    name: `New computer ${index}`,
    user: "",
    lastCheckIn: "",
    make: "",
    serial: "",
    model: "",
    os: "Windows 11 Pro",
    age: 0,
    purchased: "",
    warrantyExpires: "",
    ram: "",
    cpu: "",
    storage: "",
    storageUsage: "",
    storagePercent: 0,
    storageFreeGb: 0,
    graphics: "",
    location: "",
    lifecycleStatus: "unknown",
  };
}

export function HardwareInventoryEditor({ project, onClose, onSave }: { project: Project; onClose: () => void; onSave: (devices: ProjectManualInventoryDevice[]) => void }) {
  const initial = useMemo(() => fromProject(project), [project]);
  const [devices, setDevices] = useState<ProjectManualInventoryDevice[]>(initial);

  const update = (id: string, patch: Partial<ProjectManualInventoryDevice>) => setDevices((current) => current.map((device) => device.id === id ? { ...device, ...patch } : device));
  const remove = (id: string) => setDevices((current) => current.filter((device) => device.id !== id));
  const add = () => setDevices((current) => [...current, blankDevice(current.length + 1)]);

  return <div className="inventory-editor-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="inventory-editor-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="section-kicker">Report inventory</span><h2 id="inventory-editor-title">Edit hardware inventory</h2><p>Correct names, add missing devices, remove stale entries, and adjust the details used throughout this report. Saving recalculates report totals and Technology Health.</p></div>
        <button type="button" onClick={onClose} aria-label="Close hardware inventory editor">×</button>
      </header>

      <div className="inventory-editor-summary"><strong>{devices.length}</strong><span>devices in the corrected report inventory</span><button className="button secondary compact" type="button" onClick={add}>+ Add missing device</button></div>

      <div className="inventory-editor-list">
        {devices.map((device, index) => <article className="inventory-editor-row" key={device.id}>
          <div className="inventory-editor-row-heading"><span>{String(index + 1).padStart(2, "0")}</span><input value={device.name} onChange={(event: ChangeEvent<HTMLInputElement>) => update(device.id, { name: event.target.value })} aria-label={`Device ${index + 1} name`} /><button type="button" onClick={() => remove(device.id)} aria-label={`Remove ${device.name}`}>Remove</button></div>
          <div className="inventory-editor-fields">
            <label><span>Type</span><select value={device.type} onChange={(event) => update(device.id, { type: event.target.value as ProjectManualInventoryDevice["type"] })}><option value="workstation">Workstation</option><option value="server">Primary server</option><option value="backup-server">Cloud Plus backup server</option><option value="vm">Virtual machine</option></select></label>
            <label><span>Lifecycle</span><select value={device.lifecycleStatus} onChange={(event) => update(device.id, { lifecycleStatus: event.target.value as ProjectManualInventoryDevice["lifecycleStatus"] })}><option value="current">Current</option><option value="due-soon">Plan soon</option><option value="overdue">Replace now</option><option value="unknown">Under review</option></select></label>
            <label><span>Operating system</span><input value={device.os} onChange={(event) => update(device.id, { os: event.target.value })} /></label>
            <label><span>Model</span><input value={device.model} onChange={(event) => update(device.id, { model: event.target.value })} /></label>
            <label><span>Manufacturer</span><input value={device.make} onChange={(event) => update(device.id, { make: event.target.value })} /></label>
            <label><span>Location</span><input value={device.location} onChange={(event) => update(device.id, { location: event.target.value })} /></label>
            <label><span>Age (years)</span><input type="number" min="0" step="0.1" value={device.age || ""} onChange={(event) => update(device.id, { age: Number(event.target.value || 0) })} /></label>
            <label><span>Warranty end</span><input value={device.warrantyExpires} onChange={(event) => update(device.id, { warrantyExpires: event.target.value })} placeholder="MM/DD/YYYY" /></label>
            <label><span>Last check-in</span><input value={device.lastCheckIn} onChange={(event) => update(device.id, { lastCheckIn: event.target.value })} placeholder="MM/DD/YYYY" /></label>
            <label><span>Video card</span><input value={device.graphics} onChange={(event) => update(device.id, { graphics: event.target.value })} /></label>
          </div>
        </article>)}
      </div>

      <footer><span>Manual inventory corrections become authoritative for this report and remain editable later.</span><div><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="button" disabled={!devices.every((device) => device.name.trim())} onClick={() => onSave(devices)}>Save inventory & recalculate</button></div></footer>
    </section>
  </div>;
}
