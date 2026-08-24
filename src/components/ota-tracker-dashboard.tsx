"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import {
  chicagoDateKey,
  classifyOtaHealth,
  compareOtaHealth,
  otaSourceHash,
  parseOtaEmailBatch,
  type OtaHealth,
  type OtaHealthKey,
  type ParsedOtaEmail,
} from "@/lib/compass/ota-tracker";
import styles from "./ota-tracker-dashboard.module.css";

type OtaRow = {
  id: string;
  company_id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  tc_name: string;
  contact_name: string;
  status: string;
  source: string;
  notes: string;
  source_message_id: string | null;
  source_message_hash: string | null;
  source_subject: string;
  source_from: string;
  source_sent_at: string | null;
  quoted: boolean;
  quoted_date: string | null;
  updated_at: string;
};

type CompanyRow = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
};

type DisplayOta = OtaRow & {
  companyName: string;
  health: OtaHealth;
};

type EditForm = {
  appointmentDate: string;
  appointmentTime: string;
  contactName: string;
  tcName: string;
  notes: string;
};

type FilterKey = "action" | "all" | OtaHealthKey;

const OTA_SELECT = "id,company_id,appointment_date,appointment_time,tc_name,contact_name,status,source,notes,source_message_id,source_message_hash,source_subject,source_from,source_sent_at,quoted,quoted_date,updated_at";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function companyKey(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatDate(date: string | null): string {
  if (!date) return "Date needed";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day, 12));
}

function formatTime(time: string | null): string {
  if (!time) return "Time not set";
  const [hourValue, minuteValue] = time.split(":").map(Number);
  const hour = Number.isFinite(hourValue) ? hourValue : 0;
  const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function healthDetail(health: OtaHealth): string {
  if (health.key === "quoted") return "Clock stopped";
  if (health.key === "upcoming") return `${Math.abs(health.daysPast || 0)} day${Math.abs(health.daysPast || 0) === 1 ? "" : "s"} until OTA`;
  if (health.key === "today") return "OTA is today";
  if (health.key === "grace") return "1 day after OTA";
  if (health.key === "due") return "2 days after OTA";
  if (health.key === "overdue") return `${health.daysPast} days after OTA`;
  return "Set an OTA date to start the clock";
}

function ReceptionBar({ health }: { health: OtaHealth }) {
  const tone = health.key === "overdue" ? "red" : health.key === "due" ? "yellow" : health.key === "undated" ? "neutral" : "green";
  return <div className={`${styles.reception} ${styles[`reception_${tone}`]}`} aria-label={`${health.label}: ${healthDetail(health)}`} title={`${health.label} · ${healthDetail(health)}`}>
    {[1, 2, 3, 4].map((segment) => <span key={segment} style={{ height: `${28 + segment * 16}%` }} />)}
  </div>;
}

function emptyParsedEmail(): ParsedOtaEmail {
  return {
    localId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    raw: "Manual OTA entry",
    company: "",
    appointmentDate: "",
    appointmentTime: "",
    contactName: "",
    tcName: "",
    subject: "Manual OTA entry",
    from: "",
    sentAt: "",
    messageId: "",
    quoteLanguageDetected: false,
  };
}

export function OtaTrackerDashboard() {
  const [rows, setRows] = useState<OtaRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<FilterKey>("action");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [emailBatch, setEmailBatch] = useState("");
  const [drafts, setDrafts] = useState<ParsedOtaEmail[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = getCaptainsLogCloudAuthSnapshot();
      if (!snapshot.configured || !snapshot.signedIn) throw new Error("Connect this browser to the Captain's Log cloud account in Settings to use the shared OTA registry.");
      const [otaRows, companyRows] = await Promise.all([
        captainsLogCloudRest<OtaRow[]>("GET", "company_otas", undefined, { select: OTA_SELECT, order: "appointment_date.asc.nullslast,appointment_time.asc.nullslast" }),
        captainsLogCloudRest<CompanyRow[]>("GET", "companies", undefined, { select: "id,display_name,email,phone", order: "display_name.asc" }),
      ]);
      setRows(Array.isArray(otaRows) ? otaRows : []);
      setCompanies(Array.isArray(companyRows) ? companyRows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const today = chicagoDateKey();
  const displayRows = useMemo<DisplayOta[]>(() => rows.map((row) => ({
    ...row,
    companyName: companyById.get(row.company_id)?.display_name || "Unknown company",
    health: classifyOtaHealth(row.appointment_date, row.quoted, today),
  })).sort((left, right) => {
    const severity = compareOtaHealth(left.health, right.health);
    if (severity) return severity;
    return clean(left.appointment_date).localeCompare(clean(right.appointment_date));
  }), [companyById, rows, today]);

  const counts = useMemo(() => {
    const result: Record<OtaHealthKey, number> = { quoted: 0, upcoming: 0, today: 0, grace: 0, due: 0, overdue: 0, undated: 0 };
    for (const row of displayRows) result[row.health.key] += 1;
    return result;
  }, [displayRows]);

  const filtered = useMemo(() => {
    const needle = companyKey(search);
    return displayRows.filter((row) => {
      if (filter === "action" && !["overdue", "due", "grace", "today", "undated"].includes(row.health.key)) return false;
      if (filter !== "all" && filter !== "action" && row.health.key !== filter) return false;
      if (!needle) return true;
      return companyKey(`${row.companyName} ${row.contact_name} ${row.tc_name} ${row.source_subject}`).includes(needle);
    });
  }, [displayRows, filter, search]);

  const markQuoted = async (row: OtaRow, quoted: boolean) => {
    setBusy(true);
    setError("");
    try {
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", { quoted, quoted_date: quoted ? chicagoDateKey() : null }, { id: `eq.${row.id}` }, "return=representation");
      setNotice(quoted ? "Marked quoted. Its decay clock is now green." : "Quote status reopened.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (row: OtaRow) => {
    setEditingId(row.id);
    setEditForm({
      appointmentDate: row.appointment_date || "",
      appointmentTime: row.appointment_time ? row.appointment_time.slice(0, 5) : "",
      contactName: row.contact_name || "",
      tcName: row.tc_name || "",
      notes: row.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    setBusy(true);
    setError("");
    try {
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", {
        appointment_date: editForm.appointmentDate || null,
        appointment_time: editForm.appointmentTime ? `${editForm.appointmentTime}:00` : null,
        contact_name: editForm.contactName.trim(),
        tc_name: editForm.tcName.trim(),
        notes: editForm.notes.trim(),
      }, { id: `eq.${editingId}` }, "return=representation");
      setEditingId("");
      setEditForm(null);
      setNotice("OTA details updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const parseBatch = () => {
    const parsed = parseOtaEmailBatch(emailBatch);
    setDrafts(parsed);
    setNotice(parsed.length ? `Parsed ${parsed.length} email${parsed.length === 1 ? "" : "s"}. Review the fields before importing.` : "No email content found.");
  };

  const updateDraft = (localId: string, patch: Partial<ParsedOtaEmail>) => {
    setDrafts((current) => current.map((draft) => draft.localId === localId ? { ...draft, ...patch } : draft));
  };

  const addManualDraft = () => {
    setImportOpen(true);
    setDrafts((current) => [...current, emptyParsedEmail()]);
  };

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const chunks = await Promise.all(Array.from(files).map((file) => file.text()));
    setEmailBatch((current) => [current, ...chunks].filter(Boolean).join("\n\n----- NEXT EMAIL -----\n\n"));
    setImportOpen(true);
  };

  const importDrafts = async () => {
    const ready = drafts.filter((draft) => draft.company.trim() && draft.appointmentDate);
    if (!ready.length) {
      setError("Each imported OTA needs at least a company and OTA date. Correct the preview fields first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const workingCompanies = [...companies];
      const workingRows = [...rows];
      let created = 0;
      let updated = 0;

      for (const draft of ready) {
        let company = workingCompanies.find((item) => companyKey(item.display_name) === companyKey(draft.company));
        if (!company) {
          const inserted = await captainsLogCloudRest<CompanyRow[]>("POST", "companies", { display_name: draft.company.trim() }, undefined, "return=representation");
          company = inserted?.[0];
          if (!company) throw new Error(`Could not create company record for ${draft.company}.`);
          workingCompanies.push(company);
        }

        const hash = await otaSourceHash(draft.raw || `${draft.company}|${draft.appointmentDate}|${draft.appointmentTime}|${draft.contactName}|${draft.tcName}`);
        const duplicate = workingRows.find((row) => (draft.messageId && row.source_message_id === draft.messageId) || row.source_message_hash === hash);
        const source = draft.raw === "Manual OTA entry" ? "captains_log_manual" : "captains_log_email_import";
        const payload = {
          company_id: company.id,
          appointment_date: draft.appointmentDate,
          appointment_time: draft.appointmentTime || null,
          contact_name: draft.contactName.trim(),
          tc_name: draft.tcName.trim(),
          source,
          source_message_id: draft.messageId || null,
          source_message_hash: hash,
          source_subject: draft.subject || "",
          source_from: draft.from || "",
          source_sent_at: draft.sentAt || null,
        };

        if (duplicate) {
          const changed = await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", payload, { id: `eq.${duplicate.id}` }, "return=representation");
          if (changed?.[0]) Object.assign(duplicate, changed[0]);
          updated += 1;
        } else {
          const inserted = await captainsLogCloudRest<OtaRow[]>("POST", "company_otas", { ...payload, status: "in_progress", handoff_id: `ota-tracker:${hash}` }, undefined, "return=representation");
          if (inserted?.[0]) workingRows.push(inserted[0]);
          created += 1;
        }
      }

      setDrafts([]);
      setEmailBatch("");
      setNotice(`Import complete: ${created} new OTA${created === 1 ? "" : "s"}, ${updated} existing OTA${updated === 1 ? "" : "s"} updated.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return <main className={styles.shell}>
    <section className={styles.hero}>
      <div>
        <div className={styles.eyebrow}>Advantage Technologies · Company OTA accountability</div>
        <h1>OTA Tracker</h1>
        <p>One clock for every onsite technology assessment. Upcoming stays green. Day 2 without a quote turns yellow. Day 3+ turns red until the quote is recorded.</p>
      </div>
      <div className={styles.heroActions}>
        <button type="button" className={styles.secondaryButton} onClick={() => void load()} disabled={loading || busy}>Refresh</button>
        <button type="button" className={styles.secondaryButton} onClick={addManualDraft}>Add OTA</button>
        <button type="button" className={styles.primaryButton} onClick={() => setImportOpen((value) => !value)}>Import emails</button>
      </div>
    </section>

    {error && <div className={styles.errorBanner}><strong>OTA Tracker needs attention.</strong><span>{error}</span><Link href="/settings/">Open cloud settings</Link></div>}
    {notice && <div className={styles.noticeBanner}>{notice}</div>}

    <section className={styles.kpis} aria-label="OTA status summary">
      <button type="button" onClick={() => setFilter("overdue")} className={`${styles.kpi} ${styles.kpiRed}`}><span>Red · overdue</span><strong>{counts.overdue}</strong><small>3+ days, no quote</small></button>
      <button type="button" onClick={() => setFilter("due")} className={`${styles.kpi} ${styles.kpiYellow}`}><span>Yellow · due</span><strong>{counts.due}</strong><small>2 days, no quote</small></button>
      <button type="button" onClick={() => setFilter("action")} className={styles.kpi}><span>Needs attention</span><strong>{counts.overdue + counts.due + counts.grace + counts.today + counts.undated}</strong><small>Action queue</small></button>
      <button type="button" onClick={() => setFilter("upcoming")} className={`${styles.kpi} ${styles.kpiGreen}`}><span>Upcoming</span><strong>{counts.upcoming}</strong><small>Future OTAs</small></button>
      <button type="button" onClick={() => setFilter("quoted")} className={`${styles.kpi} ${styles.kpiGreen}`}><span>Quoted</span><strong>{counts.quoted}</strong><small>Clock stopped</small></button>
    </section>

    {counts.overdue > 0 && <section className={styles.alertStrip}>
      <div><strong>{counts.overdue} OTA{counts.overdue === 1 ? " is" : "s are"} beyond the 3-day quote window.</strong><span>These are the records the future notification automation will email about. Version 1 does not send unattended email yet.</span></div>
      <button type="button" onClick={() => setFilter("overdue")}>Show red queue</button>
    </section>}

    {importOpen && <section className={styles.importPanel}>
      <div className={styles.sectionHeading}><div><span>Email intake</span><h2>Parse OTA emails in batches</h2><p>Paste forwarded emails or load .eml/.txt files. Nothing writes to the registry until you review and import the preview.</p></div><button type="button" className={styles.textButton} onClick={() => setImportOpen(false)}>Close</button></div>
      <div className={styles.importGrid}>
        <div>
          <textarea value={emailBatch} onChange={(event) => setEmailBatch(event.target.value)} placeholder={"Paste one or more OTA scheduling emails here…\n\nBest results when the email contains labels such as Company, OTA Date, Primary Contact and TC/Technician."} />
          <div className={styles.importActions}>
            <label className={styles.fileButton}>Load email files<input type="file" accept=".eml,.txt,text/plain,message/rfc822" multiple onChange={(event) => void readFiles(event.target.files)} /></label>
            <button type="button" className={styles.secondaryButton} onClick={parseBatch} disabled={!emailBatch.trim()}>Parse batch</button>
            <button type="button" className={styles.secondaryButton} onClick={addManualDraft}>Blank row</button>
          </div>
        </div>
        <div className={styles.parserRules}><strong>Parser priorities</strong><span>Company / Practice</span><span>OTA or appointment date + time</span><span>Primary contact</span><span>TC / Technician / Consultant</span><span>Message-ID + source hash for dedupe</span></div>
      </div>

      {drafts.length > 0 && <div className={styles.previewList}>
        {drafts.map((draft) => {
          const ready = Boolean(draft.company.trim() && draft.appointmentDate);
          return <article key={draft.localId} className={styles.previewCard}>
            <div className={styles.previewTop}><strong>{draft.subject || "OTA import preview"}</strong><span className={ready ? styles.readyBadge : styles.reviewBadge}>{ready ? "Ready" : "Needs review"}</span>{draft.quoteLanguageDetected && <span className={styles.quoteHint}>Quote language detected · verify manually</span>}<button type="button" onClick={() => setDrafts((current) => current.filter((item) => item.localId !== draft.localId))}>Remove</button></div>
            <div className={styles.previewFields}>
              <label>Company<input value={draft.company} onChange={(event) => updateDraft(draft.localId, { company: event.target.value })} placeholder="Practice or company" /></label>
              <label>OTA date<input type="date" value={draft.appointmentDate} onChange={(event) => updateDraft(draft.localId, { appointmentDate: event.target.value })} /></label>
              <label>OTA time<input type="time" value={draft.appointmentTime ? draft.appointmentTime.slice(0, 5) : ""} onChange={(event) => updateDraft(draft.localId, { appointmentTime: event.target.value ? `${event.target.value}:00` : "" })} /></label>
              <label>Primary contact<input value={draft.contactName} onChange={(event) => updateDraft(draft.localId, { contactName: event.target.value })} placeholder="Contact" /></label>
              <label>TC / technician<input value={draft.tcName} onChange={(event) => updateDraft(draft.localId, { tcName: event.target.value })} placeholder="Who is going out?" /></label>
            </div>
          </article>;
        })}
        <div className={styles.previewFooter}><span>{drafts.filter((draft) => draft.company.trim() && draft.appointmentDate).length} of {drafts.length} ready to import</span><button type="button" className={styles.primaryButton} onClick={() => void importDrafts()} disabled={busy}>Import ready OTAs</button></div>
      </div>}
    </section>}

    <section className={styles.board}>
      <div className={styles.boardHeader}>
        <div><span>Shared registry</span><h2>OTA quote clock</h2></div>
        <div className={styles.boardControls}>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, contact or TC" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as FilterKey)} aria-label="Filter OTA status">
            <option value="action">Needs attention</option><option value="all">All OTAs</option><option value="overdue">Red · overdue</option><option value="due">Yellow · due</option><option value="grace">Grace day</option><option value="today">OTA today</option><option value="upcoming">Upcoming</option><option value="quoted">Quoted</option><option value="undated">Needs date</option>
          </select>
        </div>
      </div>

      {loading ? <div className={styles.empty}>Loading shared OTA registry…</div> : filtered.length === 0 ? <div className={styles.empty}>No OTAs match this view.</div> : <div className={styles.rows}>
        {filtered.map((row) => <article key={row.id} className={`${styles.otaRow} ${styles[`row_${row.health.key}`]}`}>
          <div className={styles.statusCell}><ReceptionBar health={row.health} /><div><strong>{row.health.label}</strong><span>{healthDetail(row.health)}</span></div></div>
          <div className={styles.companyCell}><strong>{row.companyName}</strong><span>{row.contact_name || "Primary contact not set"}</span>{row.source_subject && <small title={row.source_subject}>{row.source_subject}</small>}</div>
          <div className={styles.dateCell}><strong>{formatDate(row.appointment_date)}</strong><span>{formatTime(row.appointment_time)}</span></div>
          <div className={styles.tcCell}><span>Going out</span><strong>{row.tc_name || "Unassigned"}</strong></div>
          <div className={styles.sourceCell}><span>Source</span><strong>{row.source === "captains_log_email_import" ? "Email" : row.source === "captains_log_manual" ? "Manual" : row.source || "Manual"}</strong></div>
          <div className={styles.rowActions}><button type="button" onClick={() => beginEdit(row)}>Edit</button><button type="button" className={row.quoted ? styles.reopenButton : styles.quoteButton} onClick={() => void markQuoted(row, !row.quoted)} disabled={busy}>{row.quoted ? "Reopen" : "Mark quoted"}</button></div>
          {editingId === row.id && editForm && <div className={styles.editor}>
            <label>OTA date<input type="date" value={editForm.appointmentDate} onChange={(event) => setEditForm({ ...editForm, appointmentDate: event.target.value })} /></label>
            <label>OTA time<input type="time" value={editForm.appointmentTime} onChange={(event) => setEditForm({ ...editForm, appointmentTime: event.target.value })} /></label>
            <label>Primary contact<input value={editForm.contactName} onChange={(event) => setEditForm({ ...editForm, contactName: event.target.value })} /></label>
            <label>TC / technician<input value={editForm.tcName} onChange={(event) => setEditForm({ ...editForm, tcName: event.target.value })} /></label>
            <label className={styles.notesField}>Notes<textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></label>
            <div className={styles.editorActions}><button type="button" onClick={() => { setEditingId(""); setEditForm(null); }}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => void saveEdit()} disabled={busy}>Save</button></div>
          </div>}
        </article>)}
      </div>}
    </section>

    <footer className={styles.footer}>Aging is calculated by Central calendar day, not elapsed hours: green through day 1, yellow on day 2, red on day 3+ until quoted.</footer>
  </main>;
}
