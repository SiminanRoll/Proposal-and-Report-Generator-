"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import {
  OTA_TEAM_VIEW_STORAGE_KEY,
  OTA_TRACKER_TIME_ZONE,
  chicagoDateKey,
  classifyOtaHealth,
  companyKey,
  compareLatestOtaDates,
  compareOtaHealth,
  emptyParsedOta,
  fetchSharedOtaSnapshot,
  otaPreviewTitle,
  otaSourceHash,
  parseOtaEmailBatch,
  parseOtaEmailFile,
  isOtaInLatestWindow,
  type OtaHealth,
  type OtaHealthKey,
  type ParsedOtaEmail,
} from "./logic";
import styles from "./ota-tracker-dashboard.module.css";

type OtaRow = {
  id: string;
  company_id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  time_zone: string;
  tc_name: string;
  contact_name: string;
  status: string;
  source: string;
  notes: string;
  set_date: string | null;
  set_by: string | null;
  setter_user_id: string | null;
  is_my_set?: boolean | null;
  source_message_hash: string | null;
  source_message_id: string | null;
  source_subject: string | null;
  source_file_name: string | null;
  source_imported_at: string | null;
  quoted: boolean;
  quoted_date: string | null;
  tracker_cleared: boolean;
  tracker_cleared_at: string | null;
  presentation_set: boolean | null;
  presentation_date: string | null;
  updated_at: string;
};

type CompanyRow = {
  id: string;
  display_name: string;
  normalized_name: string | null;
  status: string;
};

type DisplayOta = OtaRow & { companyName: string; health: OtaHealth };
type TrackerDraft = ParsedOtaEmail & { setBy: string; setDate: string };
type EditForm = { appointmentDate: string; appointmentTime: string; contactName: string; tcName: string; setBy: string; setDate: string; notes: string };
type FilterKey = "latest" | "action" | "missing" | "all" | "overdue" | "due" | "upcoming" | "quoted" | "cleared";
type OtaScope = "mine" | "company";
type AccessMode = "disconnected" | "writer" | "viewer";
type PresentationChoice = "unset" | "yes" | "no";

const OTA_SELECT = "id,company_id,appointment_date,appointment_time,time_zone,tc_name,contact_name,status,source,notes,set_date,set_by,setter_user_id,source_message_hash,source_message_id,source_subject,source_file_name,source_imported_at,quoted,quoted_date,tracker_cleared,tracker_cleared_at,presentation_set,presentation_date,updated_at";
const COMPANY_SELECT = "id,display_name,normalized_name,status";
const ATTENTION_HEALTH = new Set<OtaHealthKey>(["overdue", "due", "grace", "today", "undated"]);
const MY_SETTER_NAME = "Patric Beckman";

const TC_EMAIL_ALIASES: Record<string, string> = {
  "bryan": "bryan.currier@adv-tech.com",
  "bryan currier": "bryan.currier@adv-tech.com",
  "craig marten": "craig.marten@adv-tech.com",
  "eric": "eric.prywitowski@adv-tech.com",
  "eric prywitowski": "eric.prywitowski@adv-tech.com",
  "jason": "jason.keller@adv-tech.com",
  "jason keller": "jason.keller@adv-tech.com",
  "joshua bruckmoser": "joshua.bruckmoser@adv-tech.com",
  "matt minicozzi": "matthew.minicozzi@adv-tech.com",
  "matthew minicozzi": "matthew.minicozzi@adv-tech.com",
  "shawn": "shawn.lamb@adv-tech.com",
  "shawn lamb": "shawn.lamb@adv-tech.com",
};

function clean(value: unknown): string { return String(value ?? "").trim(); }

function friendlyError(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value ?? "Something went wrong.");
  text = text.replace(/Captain'?s Log cloud sync failed\s*\(\d+\)\s*:\s*/gi, "");
  text = text.replace(/Captain'?s Log/gi, "OTA Tracker");
  text = text.replace(/captains_log_[a-z0-9_]+/gi, "email import");
  return text;
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
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function healthDetail(health: OtaHealth): string {
  if (health.key === "quoted") return "Clock stopped";
  if (health.key === "closed") return "Cancelled / no-show";
  if (health.key === "upcoming") return `${Math.abs(health.daysPast || 0)} day${Math.abs(health.daysPast || 0) === 1 ? "" : "s"} until OTA`;
  if (health.key === "today") return "OTA is today";
  if (health.key === "grace") return health.daysPast === 0 ? "Weekend · quote clock paused" : "1 business day after OTA";
  if (health.key === "due") return "2 business days after OTA · no quote";
  if (health.key === "overdue") return `${health.daysPast} business days after OTA · no quote`;
  return "Set an OTA date to start the clock";
}

function firstName(value: string): string {
  return clean(value).split(/\s+/)[0] || "there";
}

function tcEmail(value: string): string {
  return TC_EMAIL_ALIASES[clean(value).toLowerCase()] || "";
}

function isMySetterName(value: string): boolean {
  const normalized = clean(value).toLowerCase();
  return normalized === "patric" || normalized === MY_SETTER_NAME.toLowerCase();
}

function scopeLabel(scope: OtaScope): string {
  return scope === "mine" ? "My Sets" : "All Company";
}

function withSetterFields(draft: ParsedOtaEmail): TrackerDraft {
  return { ...draft, setBy: "", setDate: "" };
}

function presentationChoice(row: OtaRow): PresentationChoice {
  if (row.presentation_set === true) return "yes";
  if (row.presentation_set === false) return "no";
  return "unset";
}

function needsAttention(row: DisplayOta): boolean {
  return ATTENTION_HEALTH.has(row.health.key) || row.presentation_set === false;
}

function needsMissingInfo(row: DisplayOta, currentYear: string): boolean {
  const appointmentDate = clean(row.appointment_date);
  if (!appointmentDate) return true;
  return appointmentDate.startsWith(`${currentYear}-`) && !clean(row.tc_name);
}

function otaHistoryDate(row: Pick<OtaRow, "appointment_date" | "set_date">): string {
  return clean(row.appointment_date) || clean(row.set_date);
}

function ReceptionBar({ health }: { health: OtaHealth }) {
  const tone = health.key === "overdue" ? "red" : health.key === "due" ? "yellow" : health.key === "undated" || health.key === "closed" ? "neutral" : "green";
  return <div className={`${styles.reception} ${styles[`reception_${tone}`]}`} aria-label={`${health.label}: ${healthDetail(health)}`} title={`${health.label} · ${healthDetail(health)}`}>
    {[1, 2, 3, 4].map((segment) => <span key={segment} style={{ height: `${28 + segment * 16}%` }} />)}
  </div>;
}

const compactControl: React.CSSProperties = {
  padding: "6px 8px",
  color: "#cddbd8",
  border: "1px solid rgba(160,203,194,.17)",
  borderRadius: 8,
  background: "#09171e",
  fontSize: 12,
  outline: 0,
};

export function OtaTrackerDashboard() {
  const [rows, setRows] = useState<OtaRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [mode, setMode] = useState<AccessMode>("disconnected");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [scope, setScope] = useState<OtaScope>("mine");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<FilterKey>("latest");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [emailBatch, setEmailBatch] = useState("");
  const [drafts, setDrafts] = useState<TrackerDraft[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [teamCode, setTeamCode] = useState("");
  const [newShareCode, setNewShareCode] = useState("");
  const [lastSync, setLastSync] = useState("");

  const loadWriter = useCallback(async () => {
    const auth = getCaptainsLogCloudAuthSnapshot();
    setOwnerUserId(auth.signedIn ? auth.userId : "");
    const [otaRows, companyRows] = await Promise.all([
      captainsLogCloudRest<OtaRow[]>("GET", "company_otas", undefined, { select: OTA_SELECT, order: "appointment_date.asc.nullslast,appointment_time.asc.nullslast" }),
      captainsLogCloudRest<CompanyRow[]>("GET", "companies", undefined, { select: COMPANY_SELECT, order: "display_name.asc" }),
    ]);
    setRows(Array.isArray(otaRows) ? otaRows : []);
    setCompanies(Array.isArray(companyRows) ? companyRows : []);
    setMode("writer");
  }, []);

  const loadViewer = useCallback(async (code: string) => {
    const snapshot = await fetchSharedOtaSnapshot(code);
    setOwnerUserId("");
    setRows((Array.isArray(snapshot.otas) ? snapshot.otas : []) as unknown as OtaRow[]);
    setCompanies((Array.isArray(snapshot.companies) ? snapshot.companies : []) as unknown as CompanyRow[]);
    setMode("viewer");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (auth.configured && auth.signedIn) {
        await loadWriter();
      } else {
        const savedCode = typeof window !== "undefined" ? localStorage.getItem(OTA_TEAM_VIEW_STORAGE_KEY) || "" : "";
        if (savedCode) {
          setTeamCode(savedCode);
          await loadViewer(savedCode);
        } else {
          setOwnerUserId("");
          setMode("disconnected");
        }
      }
      setLastSync(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch (cause) {
      setError(friendlyError(cause));
      setMode("disconnected");
    } finally {
      setLoading(false);
    }
  }, [loadViewer, loadWriter]);

  useEffect(() => { void load(); }, [load]);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const today = chicagoDateKey();
  const currentYear = today.slice(0, 4);
  const newManualDraft = () => ({ ...withSetterFields(emptyParsedOta()), setBy: MY_SETTER_NAME, setDate: today });
  const allDisplayRows = useMemo<DisplayOta[]>(() => rows.map((row) => ({
    ...row,
    companyName: companyById.get(row.company_id)?.display_name || "Unknown company",
    health: classifyOtaHealth(row.appointment_date, row.quoted, row.status, today),
  })).sort((left, right) => {
    const attentionDelta = Number(needsAttention(right)) - Number(needsAttention(left));
    if (attentionDelta) return attentionDelta;
    const severity = compareOtaHealth(left.health, right.health);
    if (severity) return severity;
    return clean(left.appointment_date).localeCompare(clean(right.appointment_date));
  }), [companyById, rows, today]);

  const scopedDisplayRows = useMemo(() => {
    if (scope === "company") return allDisplayRows;
    return allDisplayRows.filter((row) => mode === "writer"
      ? Boolean(ownerUserId) && row.setter_user_id === ownerUserId
      : row.is_my_set === true);
  }, [allDisplayRows, mode, ownerUserId, scope]);
  const activeDisplayRows = useMemo(() => scopedDisplayRows.filter((row) => !row.tracker_cleared), [scopedDisplayRows]);
  const clearedDisplayRows = useMemo(() => scopedDisplayRows.filter((row) => Boolean(row.tracker_cleared)), [scopedDisplayRows]);
  const quotedYearRows = useMemo(() => activeDisplayRows.filter((row) => row.quoted && otaHistoryDate(row).startsWith(`${currentYear}-`)), [activeDisplayRows, currentYear]);
  const missingInfoRows = useMemo(() => activeDisplayRows.filter((row) => needsMissingInfo(row, currentYear)), [activeDisplayRows, currentYear]);

  const counts = useMemo(() => {
    const result: Record<OtaHealthKey, number> = { quoted: 0, upcoming: 0, today: 0, grace: 0, due: 0, overdue: 0, undated: 0, closed: 0 };
    for (const row of activeDisplayRows) {
      if (row.health.key === "quoted") continue;
      result[row.health.key] += 1;
    }
    result.quoted = quotedYearRows.length;
    return result;
  }, [activeDisplayRows, quotedYearRows]);

  const attentionCount = useMemo(() => activeDisplayRows.filter(needsAttention).length, [activeDisplayRows]);

  const filtered = useMemo(() => {
    const needle = companyKey(search);
    const sourceRows = filter === "cleared" ? clearedDisplayRows : activeDisplayRows;
    const matches = sourceRows.filter((row) => {
      if (filter === "latest" && !isOtaInLatestWindow(row.appointment_date, today)) return false;
      if (filter === "action" && !needsAttention(row)) return false;
      if (filter === "missing" && !needsMissingInfo(row, currentYear)) return false;
      if (filter === "quoted" && (!row.quoted || !otaHistoryDate(row).startsWith(`${currentYear}-`))) return false;
      if (filter !== "latest" && filter !== "all" && filter !== "action" && filter !== "missing" && filter !== "cleared" && filter !== "quoted" && row.health.key !== filter) return false;
      if (!needle) return true;
      return companyKey(`${row.companyName} ${row.contact_name} ${row.tc_name} ${row.set_by || ""}`).includes(needle);
    });
    if (filter === "latest") return matches.toSorted((left, right) => compareLatestOtaDates(left.appointment_date, right.appointment_date, today));
    if (filter === "quoted") return matches.toSorted((left, right) => otaHistoryDate(right).localeCompare(otaHistoryDate(left)));
    if (filter === "missing") return matches.toSorted((left, right) => {
      const leftMissingDate = !clean(left.appointment_date);
      const rightMissingDate = !clean(right.appointment_date);
      if (leftMissingDate !== rightMissingDate) return Number(rightMissingDate) - Number(leftMissingDate);
      return clean(right.appointment_date).localeCompare(clean(left.appointment_date)) || left.companyName.localeCompare(right.companyName);
    });
    return matches;
  }, [activeDisplayRows, clearedDisplayRows, currentYear, filter, search, today]);

  const refresh = async () => {
    setLoading(true); setError("");
    try {
      if (mode === "writer") await loadWriter();
      else if (mode === "viewer" && teamCode) await loadViewer(teamCode);
      else await load();
      setLastSync(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setLoading(false); }
  };

  const openTeamView = async () => {
    if (teamCode.trim().length < 8) { setError("Enter the team view code shared with you."); return; }
    setLoading(true); setError("");
    try {
      await loadViewer(teamCode.trim());
      localStorage.setItem(OTA_TEAM_VIEW_STORAGE_KEY, teamCode.trim());
      setNotice("Read-only team view connected.");
      setLastSync(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setLoading(false); }
  };

  const forgetTeamView = () => {
    localStorage.removeItem(OTA_TEAM_VIEW_STORAGE_KEY);
    setRows([]); setCompanies([]); setOwnerUserId(""); setMode("disconnected"); setTeamCode(""); setNotice("");
  };

  const setShareCode = async () => {
    if (mode !== "writer") return;
    if (newShareCode.trim().length < 8) { setError("Team view code must be at least 8 characters."); return; }
    setBusy(true); setError("");
    try {
      await captainsLogCloudRest<null>("POST", "rpc/ota_tracker_set_share_code", { p_share_code: newShareCode.trim() });
      setNotice("Team view code updated. The previous code no longer works.");
      setNewShareCode("");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const markQuoted = async (row: OtaRow, quoted: boolean) => {
    if (mode !== "writer") return;
    setBusy(true); setError("");
    try {
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", { quoted, quoted_date: quoted ? chicagoDateKey() : null }, { id: `eq.${row.id}` }, "return=representation");
      setNotice(quoted ? "Marked quoted. Its quote clock is now green." : "Quote status reopened.");
      await loadWriter();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const setTrackerCleared = async (row: OtaRow, cleared: boolean) => {
    if (mode !== "writer") return;
    setBusy(true); setError("");
    try {
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", {
        tracker_cleared: cleared,
        tracker_cleared_at: cleared ? new Date().toISOString() : null,
      }, { id: `eq.${row.id}` }, "return=representation");
      setNotice(cleared ? `${companyById.get(row.company_id)?.display_name || "OTA"} cleared from the active review list and all OTA metrics.` : "OTA restored to the active review list and metrics.");
      if (!cleared && filter === "cleared") setFilter("all");
      await loadWriter();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const setPresentation = async (row: OtaRow, choice: PresentationChoice) => {
    if (mode !== "writer") return;
    setBusy(true); setError("");
    try {
      const payload = choice === "yes"
        ? { presentation_set: true, presentation_date: row.presentation_date || null }
        : choice === "no"
          ? { presentation_set: false, presentation_date: null }
          : { presentation_set: null, presentation_date: null };
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", payload, { id: `eq.${row.id}` }, "return=representation");
      setNotice(choice === "no" ? "Presentation marked not set. This OTA is now in Needs Attention." : choice === "yes" ? "Presentation marked set." : "Presentation status cleared.");
      await loadWriter();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const setPresentationDate = async (row: OtaRow, value: string) => {
    if (mode !== "writer") return;
    setBusy(true); setError("");
    try {
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", { presentation_set: true, presentation_date: value || null }, { id: `eq.${row.id}` }, "return=representation");
      await loadWriter();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const openTcEmail = (row: DisplayOta) => {
    const to = tcEmail(row.tc_name);
    const subject = `OTA status check - ${row.companyName}`;
    const body = `Hey ${firstName(row.tc_name)},\n\nSaw this one doesn't have a quote in the system yet. Let us know if you need help with anything, or got stuck with anything. Update us when you get a chance.\n\nThanks`;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const beginEdit = (row: OtaRow) => {
    if (mode !== "writer") return;
    setEditingId(row.id);
    setEditForm({
      appointmentDate: row.appointment_date || "",
      appointmentTime: row.appointment_time ? row.appointment_time.slice(0, 5) : "",
      contactName: row.contact_name,
      tcName: row.tc_name,
      setBy: row.set_by || "",
      setDate: row.set_date || "",
      notes: row.notes,
    });
  };

  const saveEdit = async () => {
    if (mode !== "writer" || !editingId || !editForm) return;
    setBusy(true); setError("");
    try {
      const setBy = editForm.setBy.trim();
      await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", {
        appointment_date: editForm.appointmentDate || null,
        appointment_time: editForm.appointmentTime ? `${editForm.appointmentTime}:00` : null,
        contact_name: editForm.contactName.trim(),
        tc_name: editForm.tcName.trim(),
        set_by: setBy || null,
        set_date: editForm.setDate || null,
        setter_user_id: setBy && isMySetterName(setBy) && ownerUserId ? ownerUserId : null,
        notes: editForm.notes.trim(),
      }, { id: `eq.${editingId}` }, "return=representation");
      setEditingId(""); setEditForm(null); setNotice("OTA details updated."); await loadWriter();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const parseBatch = () => {
    const parsed = parseOtaEmailBatch(emailBatch).map(withSetterFields);
    setDrafts(parsed);
    setNotice(parsed.length ? `Parsed ${parsed.length} email${parsed.length === 1 ? "" : "s"}. Review Set By, Set Date, and Onsite Date before importing.` : "No email content found.");
  };

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const parsed: TrackerDraft[] = [];
    for (const file of Array.from(files)) parsed.push(...(await parseOtaEmailFile(file)).map(withSetterFields));
    setDrafts((current) => [...current, ...parsed]);
    setImportOpen(true);
    setNotice(`Parsed ${parsed.length} OTA email${parsed.length === 1 ? "" : "s"} from ${files.length} file${files.length === 1 ? "" : "s"}. Review the populated fields before importing.`);
  };

  const updateDraft = (localId: string, patch: Partial<TrackerDraft>) => setDrafts((current) => current.map((draft) => draft.localId === localId ? { ...draft, ...patch } : draft));

  const importDrafts = async () => {
    if (mode !== "writer") return;
    const selected = drafts.filter((draft) => draft.selected);
    if (!selected.length || selected.some((draft) => !draft.company.trim() || !draft.appointmentDate)) {
      setError("Every selected import row needs a company and Onsite Date. Correct the preview fields first.");
      return;
    }

    setBusy(true); setError(""); setNotice("");
    try {
      const workingCompanies = [...companies];
      const workingRows = [...rows];
      let created = 0; let updated = 0;

      for (const draft of selected) {
        let company = workingCompanies.find((item) => companyKey(item.normalized_name || item.display_name) === companyKey(draft.company));
        if (!company) {
          const inserted = await captainsLogCloudRest<CompanyRow[]>("POST", "companies", {
            display_name: draft.company.trim(),
            relationship_type: "prospect",
            relationship_source: "ota_tracker_email_import",
            metadata: { source: "ota_tracker" },
          }, { select: COMPANY_SELECT }, "return=representation");
          company = inserted?.[0];
          if (!company) throw new Error(`Could not create company record for ${draft.company}.`);
          workingCompanies.push(company);
        }

        const isManual = draft.raw === "Manual OTA entry";
        const hashInput = isManual
          ? `${draft.raw}|${draft.localId}|${draft.company}|${draft.appointmentDate}|${draft.appointmentTime}|${draft.contactName}|${draft.tcName}`
          : draft.raw || `${draft.company}|${draft.appointmentDate}|${draft.appointmentTime}|${draft.contactName}|${draft.tcName}`;
        const hash = await otaSourceHash(hashInput);
        let duplicate = isManual ? undefined : workingRows.find((row) => (draft.messageId && row.source_message_id === draft.messageId) || row.source_message_hash === hash);
        if (!duplicate) {
          const sameDay = workingRows.filter((row) => row.company_id === company.id && row.appointment_date === draft.appointmentDate && companyKey(row.contact_name) === companyKey(draft.contactName));
          if (sameDay.length === 1) duplicate = sameDay[0];
        }

        const source = isManual ? "captains_log_manual" : "captains_log_email_import";
        const setBy = draft.setBy.trim();
        const attribution = {
          ...(draft.setDate ? { set_date: draft.setDate } : {}),
          ...(setBy ? {
            set_by: setBy,
            setter_user_id: isMySetterName(setBy) && ownerUserId ? ownerUserId : null,
          } : {}),
        };
        const payload = {
          company_id: company.id,
          appointment_date: draft.appointmentDate,
          appointment_time: draft.appointmentTime || null,
          time_zone: OTA_TRACKER_TIME_ZONE,
          contact_name: draft.contactName.trim(),
          tc_name: draft.tcName.trim(),
          source,
          source_message_id: draft.messageId || null,
          source_message_hash: hash,
          source_subject: draft.subject || null,
          source_file_name: draft.sourceFileName || null,
          source_imported_at: new Date().toISOString(),
          ...attribution,
        };

        if (duplicate) {
          const changed = await captainsLogCloudRest<OtaRow[]>("PATCH", "company_otas", payload, { id: `eq.${duplicate.id}` }, "return=representation");
          if (changed?.[0]) Object.assign(duplicate, changed[0]);
          updated += 1;
        } else {
          const inserted = await captainsLogCloudRest<OtaRow[]>("POST", "company_otas", {
            ...payload,
            status: "in_progress",
            handoff_id: `ota-tracker:${hash}`,
          }, undefined, "return=representation");
          if (inserted?.[0]) workingRows.push(inserted[0]);
          created += 1;
        }
      }

      setDrafts([]); setEmailBatch(""); setNotice(`Import complete: ${created} new OTA${created === 1 ? "" : "s"}, ${updated} updated / deduplicated.`); await loadWriter();
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const copyOverdue = async () => {
    const overdue = activeDisplayRows.filter((row) => row.health.key === "overdue");
    if (!overdue.length) { setNotice("No 3+ day unquoted OTAs right now."); return; }
    const body = ["OTA QUOTE FOLLOW-UP", `As of ${formatDate(chicagoDateKey())}`, "", ...overdue.map((row) => `${row.health.daysPast} days · ${row.companyName} · OTA ${formatDate(row.appointment_date)} · TC: ${row.tc_name || "Unassigned"} · Contact: ${row.contact_name || "Not set"}`)].join("\n");
    await navigator.clipboard.writeText(body);
    setNotice(`Copied ${overdue.length} overdue OTA${overdue.length === 1 ? "" : "s"}.`);
  };

  const canWrite = mode === "writer";
  const queueTitle = filter === "latest" ? "Latest OTAs" : filter === "action" ? "Needs attention" : filter === "missing" ? `Missing info · ${currentYear} (${missingInfoRows.length})` : filter === "all" ? "All OTAs" : filter === "overdue" ? "Red · overdue" : filter === "due" ? "Yellow · due" : filter === "upcoming" ? "Upcoming" : filter === "cleared" ? `Cleared (${clearedDisplayRows.length})` : `Quoted · ${currentYear}`;

  return <main className={styles.shell}>
    <section className={styles.hero}>
      <div>
        <div className={styles.eyebrow}>Advantage Technologies · OTA accountability</div>
        <h1>OTA Tracker</h1>
        <p>One clock for every onsite technology assessment. Upcoming stays green. Day 2 without a quote turns yellow. Day 3+ turns red until the quote is recorded.</p>
      </div>
      <div className={styles.heroActions}>
        {mode !== "disconnected" && <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading || busy}>Refresh</button>}
        {canWrite && <button type="button" className={styles.secondaryButton} onClick={() => { setImportOpen(true); setDrafts((current) => [...current, newManualDraft()]); }}>Add OTA</button>}
        {canWrite && <button type="button" className={styles.primaryButton} onClick={() => setImportOpen((value) => !value)}>Import emails</button>}
        {canWrite && <button type="button" className={styles.secondaryButton} onClick={() => setShareOpen((value) => !value)}>Team view</button>}
        {mode === "viewer" && <button type="button" className={styles.secondaryButton} onClick={forgetTeamView}>Exit team view</button>}
      </div>
    </section>

    {mode === "disconnected" && <section className={styles.accessPanel}>
      <div><span>READ-ONLY TEAM ACCESS</span><h2>Open the shared OTA dashboard</h2><p>Enter the team view code. This can view OTA status but cannot import, edit, or mark quotes.</p></div>
      <div className={styles.accessActions}><input value={teamCode} onChange={(event) => setTeamCode(event.target.value)} type="password" placeholder="Team view code" onKeyDown={(event) => { if (event.key === "Enter") void openTeamView(); }} /><button type="button" className={styles.primaryButton} onClick={() => void openTeamView()} disabled={loading}>Open team view</button><Link href="/settings/">Full access</Link></div>
    </section>}

    {shareOpen && canWrite && <section className={styles.sharePanel}>
      <div><span>SHARE SAFELY</span><strong>Set or rotate the read-only team view code</strong><p>The current code cannot be displayed because only its secure hash is stored. Enter a new code here to replace it.</p></div>
      <div className={styles.shareActions}><input value={newShareCode} onChange={(event) => setNewShareCode(event.target.value)} type="text" minLength={8} placeholder="At least 8 characters" /><button type="button" className={styles.primaryButton} onClick={() => void setShareCode()} disabled={busy}>Set / rotate code</button></div>
    </section>}

    {error && <div className={styles.errorBanner}><strong>OTA Tracker needs attention.</strong><span>{error}</span>{mode !== "viewer" && <Link href="/settings/">Open cloud settings</Link>}</div>}
    {notice && <div className={styles.noticeBanner}>{notice}</div>}

    {mode !== "disconnected" && <>
      <section className={styles.modeStrip}><span className={canWrite ? styles.writerMode : styles.viewerMode}>{canWrite ? "Full access" : "Read-only team view"}</span><span>{lastSync ? `Last sync ${lastSync}` : "Loading OTA registry"}</span><span>Clock: America/Chicago business days</span></section>

      <section className={styles.kpis} aria-label={`${scopeLabel(scope)} OTA status summary`}>
        <button type="button" onClick={() => setFilter("overdue")} className={`${styles.kpi} ${styles.kpiRed}`}><span>Red · overdue</span><strong>{counts.overdue}</strong><small>3+ business days, no quote</small></button>
        <button type="button" onClick={() => setFilter("due")} className={`${styles.kpi} ${styles.kpiYellow}`}><span>Yellow · due</span><strong>{counts.due}</strong><small>Business day 2</small></button>
        <button type="button" onClick={() => setFilter("action")} className={`${styles.kpi} ${styles.kpiGreen}`}><span>Needs attention</span><strong>{attentionCount}</strong><small>Quote or presentation follow-up</small></button>
        <button type="button" onClick={() => setFilter("upcoming")} className={`${styles.kpi} ${styles.kpiGreen}`}><span>Upcoming</span><strong>{counts.upcoming}</strong><small>Future OTA dates</small></button>
        <button type="button" onClick={() => setFilter("quoted")} className={`${styles.kpi} ${styles.kpiGreen}`}><span>Quoted · {currentYear}</span><strong>{counts.quoted}</strong><small>Uncleared current-year quotes</small></button>
      </section>

      {counts.overdue > 0 && <section className={styles.alertStrip}><div><strong>{counts.overdue} OTA{counts.overdue === 1 ? " is" : "s are"} 3+ business days past without a quote.</strong><span>Follow up with the assigned TC or mark the OTA quoted when it is complete.</span></div><button type="button" onClick={() => void copyOverdue()}>Copy overdue list</button></section>}

      {importOpen && canWrite && <section className={styles.importPanel}>
        <div className={styles.sectionHeading}><div><span>EMAIL INTAKE</span><h2>Parse OTA scheduling emails</h2><p>Paste a batch or load Outlook `.msg`, `.eml`, or `.txt` files. Review the populated fields before import.</p></div><button type="button" className={styles.textButton} onClick={() => setImportOpen(false)}>Close</button></div>
        <div className={styles.importGrid}>
          <div><textarea value={emailBatch} onChange={(event) => setEmailBatch(event.target.value)} placeholder="Paste forwarded OTA scheduling emails here…" /><div className={styles.importActions}><button type="button" className={styles.primaryButton} onClick={parseBatch}>Parse pasted emails</button><label className={styles.fileButton}>Load email files<input type="file" multiple accept=".msg,.eml,.txt,application/vnd.ms-outlook,text/plain,message/rfc822" onChange={(event) => void readFiles(event.target.files)} /></label><button type="button" className={styles.secondaryButton} onClick={() => setDrafts((current) => [...current, newManualDraft()])}>Blank OTA row</button></div></div>
          <div className={styles.parserRules}><strong>Parser priorities</strong><span>Company / practice</span><span>Set By + Set Date</span><span>Onsite date and time</span><span>Primary contact</span><span>Assigned TC</span><span>Message identity + dedupe</span></div>
        </div>
        {drafts.length > 0 && <div className={styles.previewList}>{drafts.map((draft) => <div className={styles.previewCard} key={draft.localId}>
          <div className={styles.previewTop}><input type="checkbox" checked={draft.selected} onChange={(event) => updateDraft(draft.localId, { selected: event.target.checked })} /><strong>{otaPreviewTitle(draft)}</strong>{draft.quoteLanguageDetected && <span className={styles.quoteHint}>Quote language detected · verify</span>}<button type="button" onClick={() => updateDraft(draft.localId, { setBy: MY_SETTER_NAME, setDate: draft.setDate || today })}>My set</button><button type="button" onClick={() => setDrafts((current) => current.filter((item) => item.localId !== draft.localId))}>Remove</button></div>
          <div className={styles.previewFields}><label>Company<input value={draft.company} onChange={(event) => updateDraft(draft.localId, { company: event.target.value })} /></label><label>Primary contact<input value={draft.contactName} onChange={(event) => updateDraft(draft.localId, { contactName: event.target.value })} /></label><label>Set by<input value={draft.setBy} onChange={(event) => updateDraft(draft.localId, { setBy: event.target.value })} placeholder="Who booked it?" /></label><label>Set date<input type="date" value={draft.setDate} onChange={(event) => updateDraft(draft.localId, { setDate: event.target.value })} /></label><label>Onsite date<input type="date" value={draft.appointmentDate} onChange={(event) => updateDraft(draft.localId, { appointmentDate: event.target.value })} /></label><label>Onsite time<input type="time" value={draft.appointmentTime.slice(0, 5)} onChange={(event) => updateDraft(draft.localId, { appointmentTime: event.target.value ? `${event.target.value}:00` : "" })} /></label><label>Assigned TC<input value={draft.tcName} onChange={(event) => updateDraft(draft.localId, { tcName: event.target.value })} /></label></div>
        </div>)}<div className={styles.previewFooter}><span>{drafts.filter((draft) => draft.selected).length} selected</span><button type="button" className={styles.primaryButton} onClick={() => void importDrafts()} disabled={busy}>Import selected</button></div></div>}
      </section>}

      <section className={styles.board}>
        <div className={styles.boardHeader}><div><span>OTA QUEUE</span><h2>{scopeLabel(scope)} · {queueTitle}</h2></div><div className={styles.boardControls}><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, contact, setter, TC…" /><select aria-label="OTA scope" value={scope} onChange={(event) => setScope(event.target.value as OtaScope)}><option value="mine">My Sets</option><option value="company">All Company</option></select><select value={filter} onChange={(event) => setFilter(event.target.value as FilterKey)}><option value="latest">Latest OTAs · upcoming + 60 days</option><option value="action">Needs attention</option><option value="missing">Missing info · {currentYear} ({missingInfoRows.length})</option><option value="all">All OTAs</option><option value="overdue">Red · overdue</option><option value="due">Yellow · due</option><option value="upcoming">Upcoming</option><option value="quoted">Quoted · {currentYear}</option>{canWrite && <option value="cleared">Cleared ({clearedDisplayRows.length})</option>}</select></div></div>
        <div className={styles.rows}>{loading ? <div className={styles.empty}>Loading OTA registry…</div> : filtered.length === 0 ? <div className={styles.empty}>{scope === "mine" ? "No explicitly attributed My Sets match this view. Switch to All Company to see records whose setter is not proven." : filter === "cleared" ? "Nothing has been cleared from the OTA review list." : filter === "missing" ? "No active OTAs are missing an OTA date or TC for this cleanup view." : "No OTAs match this view."}</div> : filtered.map((row) => <article className={`${styles.otaRow} ${styles[`row_${row.health.key}`]}`} key={row.id}>
          <div className={styles.statusCell}><ReceptionBar health={row.health} /><div><strong>{row.health.label}</strong><span>{healthDetail(row.health)}</span></div></div>
          <div className={styles.companyCell}><strong>{row.companyName}</strong><span>{row.contact_name || "Primary contact not set"}</span></div>
          <div className={styles.dateCell}><strong>{formatDate(row.appointment_date)}</strong><span>Onsite · {formatTime(row.appointment_time)}{row.time_zone ? ` · ${row.time_zone === OTA_TRACKER_TIME_ZONE ? "CT" : row.time_zone}` : ""}</span><span>Set by · {row.set_by || "Not recorded"}</span><span>Set date · {row.set_date ? formatDate(row.set_date) : "Not recorded"}</span></div>
          <div className={styles.tcCell}><strong>{row.tc_name || "Unassigned"}</strong><span>Assigned TC</span></div>
          <div className={styles.sourceCell}>
            <span style={{ marginBottom: 3 }}>Presentation set?</span>
            {canWrite ? <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select aria-label={`Presentation set for ${row.companyName}`} value={presentationChoice(row)} onChange={(event) => void setPresentation(row, event.target.value as PresentationChoice)} disabled={busy} style={compactControl}><option value="unset">—</option><option value="yes">Yes</option><option value="no">No</option></select>
              {row.presentation_set === true && <input aria-label={`Presentation date for ${row.companyName}`} type="date" value={row.presentation_date || ""} onChange={(event) => void setPresentationDate(row, event.target.value)} disabled={busy} style={{ ...compactControl, width: 132 }} />}
            </div> : <strong>{row.presentation_set === true ? `Yes${row.presentation_date ? ` · ${formatDate(row.presentation_date)}` : ""}` : row.presentation_set === false ? "No · needs attention" : "Not set"}</strong>}
          </div>
          <div className={styles.rowActions}>{canWrite && row.tracker_cleared ? <button type="button" onClick={() => void setTrackerCleared(row, false)} disabled={busy}>Restore</button> : <>{canWrite && <button type="button" onClick={() => beginEdit(row)} disabled={busy}>Edit</button>}{row.tc_name && <button type="button" onClick={() => openTcEmail(row)} title={tcEmail(row.tc_name) ? `Email ${row.tc_name}` : `Draft email to ${row.tc_name}; recipient address needs to be selected`} aria-label={`Draft status email to ${row.tc_name}`}>✉</button>}{canWrite && row.health.key !== "closed" && (row.quoted ? <button type="button" className={styles.reopenButton} onClick={() => void markQuoted(row, false)} disabled={busy}>Reopen</button> : <button type="button" className={styles.quoteButton} onClick={() => void markQuoted(row, true)} disabled={busy}>Mark quoted</button>)}{canWrite && <button type="button" onClick={() => void setTrackerCleared(row, true)} disabled={busy} title="Clear from active OTA review list and all metrics" aria-label={`Clear ${row.companyName} from active OTA review list and all metrics`}>×</button>}</>}</div>
          {canWrite && !row.tracker_cleared && editingId === row.id && editForm && <div className={styles.editor}><label>Set by<input value={editForm.setBy} onChange={(event) => setEditForm({ ...editForm, setBy: event.target.value })} placeholder="Who booked it?" /></label><label>Set date<input type="date" value={editForm.setDate} onChange={(event) => setEditForm({ ...editForm, setDate: event.target.value })} /></label><label>Onsite date<input type="date" value={editForm.appointmentDate} onChange={(event) => setEditForm({ ...editForm, appointmentDate: event.target.value })} /></label><label>Onsite time<input type="time" value={editForm.appointmentTime} onChange={(event) => setEditForm({ ...editForm, appointmentTime: event.target.value })} /></label><label>Primary contact<input value={editForm.contactName} onChange={(event) => setEditForm({ ...editForm, contactName: event.target.value })} /></label><label>Assigned TC<input value={editForm.tcName} onChange={(event) => setEditForm({ ...editForm, tcName: event.target.value })} /></label><label className={styles.notesField}>Notes<textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} /></label><div className={styles.editorActions}><button type="button" onClick={() => { setEditingId(""); setEditForm(null); }}>Cancel</button><button type="button" className={styles.primaryButton} onClick={() => void saveEdit()} disabled={busy}>Save</button></div></div>}
        </article>)}</div>
      </section>
    </>}
  </main>;
}
