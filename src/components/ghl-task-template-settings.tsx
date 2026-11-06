"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_GHL_TASK_TEMPLATE, GHL_TASK_TEMPLATE_KEY,
  validateGhlTaskTemplate, type GhlTaskTemplate,
} from "@/lib/compass/ghl-task-template.mjs";
import {
  GHL_LOCAL_RECOVERY_EVENT, restoreMissingGhlSettingsFromProtectedWorkspace,
  saveDurableDatabaseMirrorNow,
} from "@/lib/compass/durable-storage";

function localTemplate(): GhlTaskTemplate {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GHL_TASK_TEMPLATE_KEY) || "null");
    return validateGhlTaskTemplate(parsed) ?? { ...DEFAULT_GHL_TASK_TEMPLATE };
  } catch { return { ...DEFAULT_GHL_TASK_TEMPLATE }; }
}

export function GhlTaskTemplateSettings() {
  const [template, setTemplate] = useState<GhlTaskTemplate>({ ...DEFAULT_GHL_TASK_TEMPLATE });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => { if (active) setTemplate(localTemplate()); };
    window.addEventListener(GHL_LOCAL_RECOVERY_EVENT, load);
    void (async () => {
      try { await restoreMissingGhlSettingsFromProtectedWorkspace(); } catch {}
      load();
    })();
    return () => { active = false; window.removeEventListener(GHL_LOCAL_RECOVERY_EVENT, load); };
  }, []);

  async function save() {
    const valid = validateGhlTaskTemplate(template);
    if (!valid) {
      setMessage("Enter a task title, valid time and due-date rule.");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(GHL_TASK_TEMPLATE_KEY, JSON.stringify(valid));
      window.dispatchEvent(new Event(GHL_LOCAL_RECOVERY_EVENT));
      let protectedByFolder = false;
      try {
        const status = await saveDurableDatabaseMirrorNow();
        protectedByFolder = status.connected && status.permission === "granted";
      } catch { /* A disconnected folder must not undo the browser-local save. */ }
      setMessage(protectedByFolder ?
        "Saved in Client Compass and your Protected Workspace." :
        "Saved in this browser. Enable Protected Workspace to back it up.");
    } catch {
      setMessage("The browser could not save this task template.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={{ display: "grid", gap: 10, marginTop: 14 }}>
    <div>
      <strong style={{ fontSize: 14 }}>Default coordination task</strong>
      <p style={{ margin: "4px 0", fontSize: 12, color: "#64748b" }}>
        Set this once. Every Add Task click uses these same settings and calculates a fresh due date.
      </p>
    </div>
    <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Task title
      <input value={template.title} maxLength={120} onChange={(e) => setTemplate((t) => ({ ...t, title: e.target.value }))}
        style={{ padding: 9, borderRadius: 8, border: "1px solid #c6d7e6" }} />
    </label>
    <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Task description
      <textarea value={template.description} rows={3} maxLength={2000}
        onChange={(e) => setTemplate((t) => ({ ...t, description: e.target.value }))}
        style={{ padding: 9, borderRadius: 8, border: "1px solid #c6d7e6" }} />
    </label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px,1fr))", gap: 10 }}>
      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Due after
        <select value={template.dueBusinessDays}
          onChange={(e) => setTemplate((t) => ({ ...t, dueBusinessDays: Number(e.target.value) }))}
          style={{ padding: 9, borderRadius: 8, border: "1px solid #c6d7e6" }}>
          <option value={0}>Today</option>
          <option value={1}>Next business day</option>
          <option value={2}>2 business days</option>
          <option value={3}>3 business days</option>
          <option value={5}>5 business days</option>
          <option value={7}>7 business days</option>
          <option value={10}>10 business days</option>
          <option value={14}>14 business days</option>
        </select>
      </label>
      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Time of day
        <input type="time" value={template.dueTime}
          onChange={(e) => setTemplate((t) => ({ ...t, dueTime: e.target.value }))}
          style={{ padding: 9, borderRadius: 8, border: "1px solid #c6d7e6" }} />
      </label>
      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Time zone
        <select value={template.timeZone}
          onChange={(e) => setTemplate((t) => ({ ...t, timeZone: e.target.value }))}
          style={{ padding: 9, borderRadius: 8, border: "1px solid #c6d7e6" }}>
          <option value="America/Chicago">Central</option>
          <option value="America/New_York">Eastern</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Los_Angeles">Pacific</option>
        </select>
      </label>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" disabled={saving} onClick={() => void save()}
        style={{ border: 0, borderRadius: 7, padding: "9px 14px", color: "#fff", background: "#1766a6" }}>
        {saving ? "Saving…" : "Save task defaults"}
      </button>
      {message && <span role="status" style={{ fontSize: 12, color: "#526b83" }}>{message}</span>}
    </div>
  </section>;
}
