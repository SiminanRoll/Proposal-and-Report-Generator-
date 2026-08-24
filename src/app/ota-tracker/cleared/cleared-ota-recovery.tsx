"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { chicagoDateKey, companyKey, OTA_TRACKER_TIME_ZONE } from "../logic";
import styles from "./cleared-recovery.module.css";

type OtaRow = {
  id: string;
  company_id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  time_zone: string;
  tc_name: string;
  contact_name: string;
  notes: string;
  quoted: boolean;
  quoted_date: string | null;
  tracker_cleared: boolean;
  tracker_cleared_at: string | null;
  presentation_set: boolean | null;
  presentation_date: string | null;
};

type CompanyRow = {
  id: string;
  display_name: string;
};

type PresentationChoice = "unset" | "yes" | "no";

type EditForm = {
  appointmentDate: string;
  appointmentTime: string;
  contactName: string;
  tcName: string;
  notes: string;
  quoted: boolean;
  quotedDate: string | null;
  presentationChoice: PresentationChoice;
  presentationDate: string;
};

const OTA_SELECT = "id,company_id,appointment_date,appointment_time,time_zone,tc_name,contact_name,notes,quoted,quoted_date,tracker_cleared,tracker_cleared_at,presentation_set,presentation_date";
const COMPANY_SELECT = "id,display_name";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function formatDate(value: string | null): string {
  if (!value) return "Date not set";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

function formatTime(value: string | null): string {
  if (!value) return "Time not set";
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const hour = Number.isFinite(hourValue) ? hourValue : 0;
  const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatClearedAt(value: string | null): string {
  if (!value) return "Clear date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Clear date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: OTA_TRACKER_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function presentationChoice(row: OtaRow): PresentationChoice {
  if (row.presentation_set === true) return "yes";
  if (row.presentation_set === false) return "no";
  return "unset";
}

function friendlyError(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "Unable to load cleared OTAs.");
  return text.replace(/Captain'?s Log/gi, "OTA Tracker").replace(/captains_log_[a-z0-9_]+/gi, "OTA data");
}

export function ClearedOtaRecovery() {
  const [rows, setRows] = useState<OtaRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (!auth.configured || !auth.signedIn) {
        setSignedIn(false);
        setRows([]);
        setCompanies([]);
        return;
      }

      const [otaRows, companyRows] = await Promise.all([
        captainsLogCloudRest<OtaRow[]>("GET", "company_otas", undefined, {
          select: OTA_SELECT,
          tracker_cleared: "eq.true",
          order: "tracker_cleared_at.desc.nullslast",
        }),
        captainsLogCloudRest<CompanyRow[]>("GET", "companies", undefined, {
          select: COMPANY_SELECT,
          order: "display_name.asc",
        }),
      ]);

      setRows(Array.isArray(otaRows) ? otaRows : []);
      setCompanies(Array.isArray(companyRows) ? companyRows : []);
      setSignedIn(true);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company.display_name])), [companies]);

  const filteredRows = useMemo(() => {
    const needle = companyKey(search);
    if (!needle) return rows;
    return rows.filter((row) => companyKey(`${companyById.get(row.company_id) || ""} ${row.contact_name} ${row.tc_name}`).includes(needle));
  }, [companyById, rows, search]);

  const beginEdit = (row: OtaRow) => {
    setEditingId(row.id);
    setEditForm({
      appointmentDate: row.appointment_date || "",
      appointmentTime: row.appointment_time ? row.appointment_time.slice(0, 5) : "",
      contactName: row.contact_name || "",
      tcName: row.tc_name || "",
      notes: row.notes || "",
      quoted: Boolean(row.quoted),
      quotedDate: row.quoted_date,
      presentationChoice: presentationChoice(row),
      presentationDate: row.presentation_date || "",
    });
  };

  const saveEdit = async (row: OtaRow) => {
    if (!editForm || editingId !== row.id) return;
    setBusy(true);
    setError("");
    try {
      const presentationSet = editForm.presentationChoice === "yes" ? true : editForm.presentationChoice === "no" ? false : null;
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", {
        appointment_date: editForm.appointmentDate || null,
        appointment_time: editForm.appointmentTime ? `${editForm.appointmentTime}:00` : null,
        contact_name: editForm.contactName.trim(),
        tc_name: editForm.tcName.trim(),
        notes: editForm.notes.trim(),
        quoted: editForm.quoted,
        quoted_date: editForm.quoted ? (editForm.quotedDate || chicagoDateKey()) : null,
        presentation_set: presentationSet,
        presentation_date: presentationSet === true ? (editForm.presentationDate || null) : null,
      }, { id: `eq.${row.id}` }, "return=representation");
      setEditingId("");
      setEditForm(null);
      setNotice(`${companyById.get(row.company_id) || "OTA"} updated. It remains cleared and excluded from all stats.`);
      await load();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (row: OtaRow) => {
    setBusy(true);
    setError("");
    try {
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", {
        tracker_cleared: false,
        tracker_cleared_at: null,
      }, { id: `eq.${row.id}` }, "return=representation");
      if (editingId === row.id) {
        setEditingId("");
        setEditForm(null);
      }
      setNotice(`${companyById.get(row.company_id) || "OTA"} restored to the active tracker.`);
      await load();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn && !loading) {
    return <main className={styles.shell}>
      <section className={styles.accessCard}>
        <span>CLEARED OTA RECOVERY</span>
        <h1>Full access required</h1>
        <p>Cleared OTAs can be edited or restored only from a signed-in OTA Tracker session.</p>
        <div className={styles.accessActions}>
          <Link href="/ota-tracker/">← OTA Tracker</Link>
          <Link href="/settings/">Open settings</Link>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <section className={styles.header}>
      <div>
        <Link href="/ota-tracker/" className={styles.backLink}>← OTA Tracker</Link>
        <span>CLEARED RECOVERY</span>
        <h1>Cleared OTAs</h1>
        <p>Archived from the active tracker and excluded from every OTA metric. Edit details here or restore an OTA when needed.</p>
      </div>
      <div className={styles.headerActions}>
        <div className={styles.countCard}><strong>{rows.length}</strong><span>cleared</span></div>
        <button type="button" onClick={() => void load()} disabled={loading || busy}>Refresh</button>
      </div>
    </section>

    <section className={styles.ruleStrip}>
      <strong>Zero-stat archive</strong>
      <span>Anything on this screen stays out of Tracker KPIs, Quoted totals, Performance, TC rankings, charts, and PDF reports until restored.</span>
    </section>

    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}

    <section className={styles.toolbar}>
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cleared company, contact, or TC…" />
      <span>{filteredRows.length} shown</span>
    </section>

    <section className={styles.list}>
      {loading ? <div className={styles.empty}>Loading cleared OTAs…</div> : filteredRows.length === 0 ? <div className={styles.empty}>No cleared OTAs match this view.</div> : filteredRows.map((row) => {
        const companyName = companyById.get(row.company_id) || "Unknown company";
        const editing = editingId === row.id && editForm;
        return <article className={styles.card} key={row.id}>
          <div className={styles.cardTop}>
            <div className={styles.clearedBadge}><span>Cleared</span><small>{formatClearedAt(row.tracker_cleared_at)}</small></div>
            <div className={styles.company}><strong>{companyName}</strong><span>{row.contact_name || "Primary contact not set"}</span></div>
            <div className={styles.fact}><strong>{formatDate(row.appointment_date)}</strong><span>{formatTime(row.appointment_time)}</span></div>
            <div className={styles.fact}><strong>{row.tc_name || "Unassigned"}</strong><span>Assigned TC</span></div>
            <div className={styles.fact}><strong>{row.quoted ? "Quoted" : "Not quoted"}</strong><span>{row.presentation_set === true ? "Presentation set" : row.presentation_set === false ? "Presentation not set" : "Presentation unknown"}</span></div>
            <div className={styles.actions}>
              <button type="button" onClick={() => beginEdit(row)} disabled={busy}>Edit</button>
              <button type="button" className={styles.restoreButton} onClick={() => void restore(row)} disabled={busy}>Restore</button>
            </div>
          </div>

          {editing && <div className={styles.editor}>
            <label>OTA date<input type="date" value={editForm.appointmentDate} onChange={(event) => setEditForm({ ...editForm, appointmentDate: event.target.value })} /></label>
            <label>OTA time<input type="time" value={editForm.appointmentTime} onChange={(event) => setEditForm({ ...editForm, appointmentTime: event.target.value })} /></label>
            <label>Primary contact<input value={editForm.contactName} onChange={(event) => setEditForm({ ...editForm, contactName: event.target.value })} /></label>
            <label>Assigned TC<input value={editForm.tcName} onChange={(event) => setEditForm({ ...editForm, tcName: event.target.value })} /></label>
            <label>Quoted?
              <select value={editForm.quoted ? "yes" : "no"} onChange={(event) => setEditForm({ ...editForm, quoted: event.target.value === "yes" })}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label>Presentation set?
              <select value={editForm.presentationChoice} onChange={(event) => setEditForm({ ...editForm, presentationChoice: event.target.value as PresentationChoice })}>
                <option value="unset">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            {editForm.presentationChoice === "yes" && <label>Presentation date<input type="date" aria-label={`Presentation date for ${companyName}`} value={editForm.presentationDate} onChange={(event) => setEditForm({ ...editForm, presentationDate: event.target.value })} /></label>}
            <label className={styles.notes}>Notes<textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></label>
            <div className={styles.editorActions}>
              <button type="button" onClick={() => { setEditingId(""); setEditForm(null); }}>Cancel</button>
              <button type="button" className={styles.saveButton} onClick={() => void saveEdit(row)} disabled={busy}>Save changes</button>
              <span>Saving changes does not restore this OTA.</span>
            </div>
          </div>}
        </article>;
      })}
    </section>
  </main>;
}
